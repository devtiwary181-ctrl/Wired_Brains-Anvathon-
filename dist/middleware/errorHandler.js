import { ZodError } from 'zod';
import { logger } from '../shared/logger.js';
export class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
export function errorHandler(err, req, res, next) {
    // Handle Zod Validation Errors
    if (err instanceof ZodError) {
        res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request input parameters.',
                details: err.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            },
            timestamp: new Date().toISOString(),
        });
        return;
    }
    // Handle Custom Application Errors
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
            timestamp: new Date().toISOString(),
        });
        return;
    }
    // Handle Generic / Unexpected Errors
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled Exception in API handler');
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected internal error occurred. Please try again or use emergency helplines.',
        },
        timestamp: new Date().toISOString(),
    });
}
//# sourceMappingURL=errorHandler.js.map