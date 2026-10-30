/**
 * Rate Limiting Middleware — DisasterReady India
 * Applies different limits to public citizen endpoints vs upload vs tracking endpoints.
 */
import rateLimit from 'express-rate-limit';
/** General public API: 60 req / 1 min per IP */
export const publicRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please wait one minute and try again.',
        },
    },
    skip: (req) => req.method === 'OPTIONS',
});
/** Hazard submission: 5 submissions / 10 min per IP (spam protection) */
export const hazardReportRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'REPORT_RATE_LIMIT',
            message: 'Too many hazard reports submitted recently. Please wait 10 minutes.',
        },
    },
});
/** Relief request submission: 3 submissions / 10 min per IP */
export const reliefRequestRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'RELIEF_RATE_LIMIT',
            message: 'Too many relief requests submitted recently. Please wait 10 minutes.',
        },
    },
});
/** SOS logging: 10 / 5 min per IP */
export const sosRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'SOS_RATE_LIMIT',
            message: 'SOS rate limit reached. Please call 112 directly.',
        },
    },
});
/** Google Maps-backed public queries: 10 provider requests / minute per IP */
export const mapsQueryRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: { code: 'MAPS_RATE_LIMIT', message: 'Too many map or route requests. Wait briefly and try again.' },
    },
});
//# sourceMappingURL=rateLimiter.js.map