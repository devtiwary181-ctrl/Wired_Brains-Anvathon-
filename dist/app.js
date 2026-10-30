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
    // Citizen endpoints accessible under /citizen/ prefix AND at root for convenience
    apiRouter.use('/citizen', citizenRouter);
    apiRouter.use('/', citizenRouter);
    app.use('/api/v1', apiRouter);
    // 7. Root API Gateway Ping
    app.get('/', (req, res) => {
        res.json({
            name: 'DisasterReady India Core API',
            status: 'ONLINE',
            version: 'v1.0.0',
            docs: '/api/docs',
            health: '/api/v1/health',
        });
    });
    // 8. Centralized Error Handler Middleware
    app.use(errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map