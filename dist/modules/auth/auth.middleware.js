import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../shared/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ROLE_PERMISSIONS } from './rbac.js';
/**
 * Require valid authenticated staff session
 */
export async function requireAuth(req, res, next) {
    try {
        let token;
        // 1. Check HttpOnly cookie
        if (req.cookies && req.cookies['dr_staff_token']) {
            token = req.cookies['dr_staff_token'];
        }
        // 2. Check Authorization Bearer header
        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            throw new AppError('Authentication required. Official credentials must be verified.', 401, 'UNAUTHORIZED');
        }
        let payload;
        try {
            payload = jwt.verify(token, env.JWT_SECRET);
        }
        catch (e) {
            throw new AppError('Session expired or invalid. Please sign in again.', 401, 'INVALID_SESSION');
        }
        // 3. Verify session exists and is active in database
        const session = await prisma.staffSession.findUnique({
            where: { sessionToken: payload.sessionToken },
            include: { staffUser: true },
        });
        if (!session || new Date() > session.expiresAt) {
            throw new AppError('Session has expired or was revoked. Please sign in again.', 401, 'SESSION_EXPIRED');
        }
        const user = session.staffUser;
        if (!user || !user.isActive) {
            throw new AppError('This staff account is deactivated.', 403, 'FORBIDDEN');
        }
        const role = user.role;
        const permissions = ROLE_PERMISSIONS[role] || [];
        req.user = {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            role,
            districtId: user.districtId,
            permissions,
            sessionToken: session.sessionToken,
        };
        next();
    }
    catch (error) {
        next(error);
    }
}
/**
 * Require specific granular permission
 */
export function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
        }
        if (!req.user.permissions.includes(permission)) {
            return next(new AppError(`Access Denied: Your account role (${req.user.role}) lacks the '${permission}' authorization.`, 403, 'PERMISSION_DENIED'));
        }
        next();
    };
}
export function requireAnyPermission(...permissions) {
    return (req, res, next) => {
        if (!req.user)
            return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
        if (!permissions.some(permission => req.user?.permissions.includes(permission))) {
            return next(new AppError('Access denied. Your role lacks the required permission.', 403, 'PERMISSION_DENIED'));
        }
        next();
    };
}
//# sourceMappingURL=auth.middleware.js.map