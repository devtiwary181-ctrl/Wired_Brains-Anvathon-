import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../shared/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { CopilotService } from './copilot.service.js';
import { copilotChatSchema } from './copilot.types.js';
import { ROLE_PERMISSIONS } from '../auth/rbac.js';
const copilotService = new CopilotService();
/**
 * Optional user extractor: populates req.user if valid token/cookie is present,
 * without throwing errors if anonymous.
 */
export async function optionalAuth(req, _res, next) {
    try {
        let token;
        if (req.cookies && req.cookies['dr_staff_token']) {
            token = req.cookies['dr_staff_token'];
        }
        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (token) {
            try {
                const payload = jwt.verify(token, env.JWT_SECRET);
                const session = await prisma.staffSession.findUnique({
                    where: { sessionToken: payload.sessionToken },
                    include: { staffUser: true },
                });
                if (session && new Date() <= session.expiresAt && session.staffUser?.isActive) {
                    const user = session.staffUser;
                    const role = user.role;
                    req.user = {
                        id: user.id,
                        username: user.username,
                        fullName: user.fullName,
                        email: user.email,
                        role,
                        districtId: user.districtId,
                        permissions: ROLE_PERMISSIONS[role] || [],
                        sessionToken: session.sessionToken,
                    };
                }
            }
            catch {
                // Silently ignore invalid tokens for optional auth
            }
        }
        next();
    }
    catch (error) {
        next(error);
    }
}
export class CopilotController {
    async chat(req, res, next) {
        try {
            const parseResult = copilotChatSchema.safeParse(req.body);
            if (!parseResult.success) {
                const issues = parseResult.error.issues || parseResult.error.errors || [];
                throw new AppError(`Invalid chat request: ${issues.map((e) => e.message).join(', ')}`, 400, 'VALIDATION_ERROR');
            }
            const result = await copilotService.processQuery(parseResult.data, req.user);
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
export const copilotController = new CopilotController();
//# sourceMappingURL=copilot.controller.js.map