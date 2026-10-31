import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
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