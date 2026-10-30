import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';
import { initSocketIO } from './shared/socket.js';
import { prisma } from './shared/database.js';
import { redis } from './shared/redis.js';
async function bootstrap() {
    const app = createApp();
    const server = http.createServer(app);
    // Initialize Realtime WebSockets
    initSocketIO(server);
    // Start HTTP Listener
    server.listen(env.PORT, () => {
        logger.info(`🚨 DisasterReady India Core API running on port ${env.PORT} [${env.NODE_ENV}]`);
        logger.info(`📖 API Docs available at http://localhost:${env.PORT}/api/docs`);
        logger.info(`🩺 Health check at http://localhost:${env.PORT}/api/v1/health`);
    });
    // Graceful Shutdown
    const shutdown = async (signal) => {
        logger.info(`Received ${signal}. Shutting down gracefully...`);
        server.close(async () => {
            await prisma.$disconnect();
            redis.disconnect();
            logger.info('Cleaned up database and redis connections. Process exiting.');
            process.exit(0);
        });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
bootstrap().catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
});
//# sourceMappingURL=server.js.map