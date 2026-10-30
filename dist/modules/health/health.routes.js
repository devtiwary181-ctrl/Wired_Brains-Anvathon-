import { Router } from 'express';
import { prisma } from '../../shared/database.js';
import { redis } from '../../shared/redis.js';
export const healthRouter = Router();
/**
 * Basic Liveness Probe
 */
healthRouter.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'ONLINE',
        service: 'DisasterReady India Core API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
/**
 * Database & PostGIS Connectivity Healthcheck
 */
healthRouter.get('/database', async (req, res) => {
    try {
        const start = Date.now();
        const result = await prisma.$queryRaw `
      SELECT PostGIS_Version() as postgis_version;
    `;
        const latencyMs = Date.now() - start;
        res.status(200).json({
            success: true,
            status: 'HEALTHY',
            database: 'PostgreSQL 16',
            postgis: result[0]?.postgis_version || 'Enabled',
            latencyMs,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        res.status(503).json({
            success: false,
            status: 'DEGRADED',
            database: 'PostgreSQL unreachable',
            error: err.message,
            timestamp: new Date().toISOString(),
        });
    }
});
/**
 * All Core Services Healthcheck (PostgreSQL, PostGIS, Redis)
 */
healthRouter.get('/services', async (req, res) => {
    let dbStatus = 'UNKNOWN';
    let dbLatency = 0;
    let redisStatus = 'UNKNOWN';
    let redisLatency = 0;
    // 1. Check PostgreSQL & PostGIS
    try {
        const dbStart = Date.now();
        await prisma.$queryRaw `SELECT 1;`;
        dbLatency = Date.now() - dbStart;
        dbStatus = 'HEALTHY';
    }
    catch (err) {
        dbStatus = 'FAILED';
    }
    // 2. Check Redis
    try {
        const redisStart = Date.now();
        const pong = await redis.ping();
        redisLatency = Date.now() - redisStart;
        redisStatus = pong === 'PONG' ? 'HEALTHY' : 'DEGRADED';
    }
    catch (err) {
        redisStatus = 'FAILED';
    }
    const allHealthy = dbStatus === 'HEALTHY' && redisStatus === 'HEALTHY';
    res.status(allHealthy ? 200 : 503).json({
        success: allHealthy,
        status: allHealthy ? 'OPERATIONAL' : 'DEGRADED',
        services: {
            database: {
                status: dbStatus,
                latencyMs: dbLatency,
            },
            redis: {
                status: redisStatus,
                latencyMs: redisLatency,
            },
        },
        timestamp: new Date().toISOString(),
    });
});
//# sourceMappingURL=health.routes.js.map