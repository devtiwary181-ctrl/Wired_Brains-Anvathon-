import { Request, Response, NextFunction } from 'express';
import { PermissionType, RoleType } from './rbac.js';
export interface AuthenticatedUser {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: RoleType;
    districtId: string | null;
    permissions: PermissionType[];
    sessionToken: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}
/**
 * Require valid authenticated staff session
 */
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Require specific granular permission
 */
export declare function requirePermission(permission: PermissionType): (req: Request, res: Response, next: NextFunction) => void;
