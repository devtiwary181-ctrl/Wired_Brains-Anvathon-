import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { citizenRouter } from './modules/citizen/citizen.routes.js';
import { authorityRouter } from './modules/authority/authority.routes.js';
import { copilotRouter } from './modules/copilot/copilot.routes.js';
import { realtimeRouter } from './modules/realtime/realtime.routes.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function createApp() {
    const app = express();
    // 1. Security Headers
    app.use(helmet({
        contentSecurityPolicy: false, // Enabled fine-grained in production
        crossOriginEmbedderPolicy: false,
    }));
    // 2. Explicit CORS Origin Allowlist
    const allowedOrigins = env.FRONTEND_URL.split(',').map((origin) => origin.trim());
    app.use(cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
            if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
                callback(null, true);
            }
            else {
                callback(new Error(`Origin ${origin} not permitted by CORS policy`));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));
    // 3. Request Parsers
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());
    // 3b. Static file serving for uploaded evidence photos
    app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
    // 4. Request Logging
    if (env.NODE_ENV !== 'test') {
        app.use(morgan('dev'));
    }
    // 5. Swagger / OpenAPI Documentation
    try {
        const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'swagger.yaml'));
        app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    }
    catch (e) {
        // Graceful fallback if swagger doc not found
    }
    // 6. API Versioning Router (/api/v1)
    const apiRouter = express.Router();
    apiRouter.use('/health', healthRouter);
    apiRouter.use('/auth', authRouter);
    apiRouter.use('/authority', authorityRouter);
    apiRouter.use('/copilot', copilotRouter);
    apiRouter.use('/realtime', realtimeRouter);
    // 6a. Centralized Public Map & App Configuration
    apiRouter.get('/config', (_req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({
            success: true,
            data: {
                mapTileUrl: env.MAP_TILE_URL,
                mapTileFallbackUrl: env.MAP_TILE_FALLBACK_URL,
                esriTopoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
                esriSatelliteUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                esriTerrainUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
                osrmUrl: env.OSRM_BASE_URL,
                nominatimUrl: env.NOMINATIM_BASE_URL,
            },
        });
    });
    // 6b. Centralized Backend Text-To-Speech (TTS) Endpoint Fallback
    apiRouter.get('/tts', async (req, res) => {
        try {
            const text = (req.query.text || '').trim();
            const rawLang = (req.query.lang || 'hi').toLowerCase().trim();
            if (!text) {
                return res.status(400).json({ success: false, message: 'Text query parameter is required.' });
            }
            // Map language code to 2-letter Google TTS code
            const langMap = {
                'hi': 'hi', 'hi-in': 'hi',
                'bn': 'bn', 'bn-in': 'bn',
                'ta': 'ta', 'ta-in': 'ta',
                'te': 'te', 'te-in': 'te',
                'mr': 'mr', 'mr-in': 'mr',
                'gu': 'gu', 'gu-in': 'gu',
                'kn': 'kn', 'kn-in': 'kn',
                'ml': 'ml', 'ml-in': 'ml',
                'pa': 'pa', 'pa-in': 'pa',
                'en': 'en', 'en-in': 'en', 'en-us': 'en',
            };
            const tl = langMap[rawLang] || 'hi';
            const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tl}&client=tw-ob&q=${encodeURIComponent(text.substring(0, 200))}`;
            const response = await fetch(googleTtsUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (!response.ok) {
                return res.status(502).json({ success: false, message: 'TTS upstream error' });
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            // Convert MP3 to standard uncompressed WAV using macOS native afconvert for maximum browser compatibility
            const tmpIn = path.join(os.tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);
            const tmpOut = tmpIn.replace('.mp3', '.wav');
            try {
                await fs.promises.writeFile(tmpIn, buffer);
                await new Promise((resolve, reject) => {
                    execFile('afconvert', ['-f', 'WAVE', '-d', 'LEI16@24000', tmpIn, tmpOut], (error) => {
                        if (error)
                            reject(error);
                        else
                            resolve(true);
                    });
                });
                const wavBuffer = await fs.promises.readFile(tmpOut);
                res.setHeader('Content-Type', 'audio/wav');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.send(wavBuffer);
            }
            catch (convErr) {
                // Fallback to sending original MP3 if afconvert is unavailable
                res.setHeader('Content-Type', 'audio/mpeg');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.send(buffer);
            }
            finally {
                fs.promises.unlink(tmpIn).catch(() => { });
                fs.promises.unlink(tmpOut).catch(() => { });
            }
        }
        catch (err) {
            return res.status(500).json({ success: false, message: err?.message || 'TTS generation failed' });
        }
    });
    // Citizen endpoints accessible under /citizen/ prefix AND at root for convenience
    apiRouter.use('/citizen', citizenRouter);
    apiRouter.use('/', citizenRouter);
    app.use('/api/v1', apiRouter);
    app.use('/copilot', copilotRouter);
    // 7. Frontend Static Serving & Unified Internal Routing
    const frontendDir = path.join(process.cwd(), 'stitch-reference');
    app.use(express.static(frontendDir, { index: false }));
    // Friendly Route Aliases matching Target URL Architecture
    const screenRouteMap = {
        '/': '01-language-location/index.html',
        '/onboarding': '01-language-location/index.html',
        '/dashboard': '02-citizen-dashboard/index.html',
        '/hazards': '03-get-to-safety-step-1/index.html',
        '/journey': '04-get-to-safety-step-2/index.html',
        '/routes': '05-get-to-safety-step-4/index.html',
        '/navigation': '06-get-to-safety-step-5/index.html',
        '/shelters': '07-safe-places/index.html',
        '/safe-places': '07-safe-places/index.html',
        '/supplies': '08-emergency-relief/index.html',
        '/relief': '08-emergency-relief/index.html',
        '/tracking': '09-relief-tracking/index.html',
        '/tracking-alt': '10-relief-tracking-alternative/index.html',
        '/preparedness': '11-preparedness/index.html',
        '/offline-library': '11-preparedness/index.html',
        '/sos': '12-emergency-help/index.html',
        '/emergency': '12-emergency-help/index.html',
        '/login': '13-staff-login/index.html',
        '/staff': '13-staff-login/index.html',
        '/admin': '13-staff-login/index.html',
        '/authority': '14-authority-dashboard/index.html',
        '/admin/dashboard': '14-authority-dashboard/index.html',
        '/staff/tools': '15-staff-tools-settings/index.html',
        '/simulations': '15-staff-tools-settings/index.html',
    };
    for (const [routePath, screenFile] of Object.entries(screenRouteMap)) {
        app.get(routePath, (_req, res) => {
            res.sendFile(path.join(frontendDir, 'screens', screenFile));
        });
    }
    // 8. Root fallback handler for frontend HTML requests that are not API calls
    app.use((req, res, next) => {
        // If request is not GET, or begins with /api, /copilot, /socket.io, or /uploads, skip
        if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/copilot') || req.path.startsWith('/socket.io') || req.path.startsWith('/uploads')) {
            return next();
        }
        // Serve landing page on unmatched frontend URLs
        res.sendFile(path.join(frontendDir, 'screens', '01-language-location', 'index.html'));
    });
    // 9. Centralized Error Handler Middleware
    app.use(errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map