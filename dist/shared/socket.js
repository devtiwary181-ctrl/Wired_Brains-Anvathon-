import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { prisma } from './database.js';
import { outboxService } from './outbox.service.js';
import { ROLE_PERMISSIONS } from '../modules/auth/rbac.js';
let io = null;
export function initSocketIO(httpServer) {
    const allowedOrigins = env.FRONTEND_URL.split(',').map((u) => u.trim());
    io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
                    callback(null, true);
                }
                else {
                    callback(new Error(`Origin ${origin} not permitted by CORS policy`));
                }
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });
    // Socket Connection Pipeline
    io.on('connection', async (socket) => {
        logger.info({ socketId: socket.id }, 'Socket.IO client connected');
        // 1. Join public alerts room by default
        socket.join('public:alerts');
        // 2. Client joins district channel (public civil alerts)
        socket.on('join:district', (districtId) => {
            if (typeof districtId === 'string' && districtId.length > 0) {
                socket.join(`district:${districtId}`);
                logger.debug({ socketId: socket.id, districtId }, 'Client subscribed to district channel');
            }
        });
        // 3. Client joins private request tracking room (token-based authorization)
        socket.on('join:request', async (trackingToken, callback) => {
            if (!trackingToken || typeof trackingToken !== 'string') {
                if (callback)
                    callback({ success: false, error: 'Tracking token required.' });
                return;
            }
            // Verify request exists with this token
            const reqRecord = await prisma.reliefRequest.findUnique({
                where: { trackingToken },
                select: { id: true, stage: true },
            });
            if (!reqRecord) {
                if (callback)
                    callback({ success: false, error: 'Invalid or unknown tracking token.' });
                return;
            }
            socket.join(`request:${trackingToken}`);
            logger.debug({ socketId: socket.id, trackingToken }, 'Client subscribed to private relief request channel');
            if (callback)
                callback({ success: true, currentStage: reqRecord.stage });
        });
        // 4. Authenticated Staff joins EOC operations room (JWT authorization check)
        socket.on('join:eoc', async (authPayload, callback) => {
            try {
                const token = authPayload?.token;
                if (!token) {
                    if (callback)
                        callback({ success: false, error: 'Authentication required to join EOC command room.' });
                    return;
                }
                const decoded = jwt.verify(token, env.JWT_SECRET);
                const session = await prisma.staffSession.findUnique({
                    where: { sessionToken: decoded.sessionToken },
                    include: { staffUser: true },
                });
                if (!session || new Date() > session.expiresAt || !session.staffUser?.isActive) {
                    if (callback)
                        callback({ success: false, error: 'Staff session expired or unauthorized.' });
                    return;
                }
                const user = session.staffUser;
                const role = user.role;
                const permissions = ROLE_PERMISSIONS[role] || [];
                // Join central EOC room
                socket.join('eoc:central');
                // Join specific district EOC room if provided
                const targetDistrict = authPayload.districtId || user.districtId;
                if (targetDistrict) {
                    socket.join(`eoc:${targetDistrict}`);
                }
                logger.info({ socketId: socket.id, userId: user.id, role, targetDistrict }, 'Staff authenticated and joined EOC real-time command room');
                if (callback)
                    callback({ success: true, user: { id: user.id, role, permissions } });
            }
            catch (err) {
                if (callback)
                    callback({ success: false, error: err.message || 'EOC authentication failed' });
            }
        });
        // 5. Missed-events recovery after reconnection
        socket.on('recover:events', async (data, callback) => {
            try {
                let isStaff = false;
                if (data.token) {
                    try {
                        const decoded = jwt.verify(data.token, env.JWT_SECRET);
                        const session = await prisma.staffSession.findUnique({ where: { sessionToken: decoded.sessionToken } });
                        if (session && new Date() <= session.expiresAt) {
                            isStaff = true;
                        }
                    }
                    catch { }
                }
                const missed = await outboxService.getMissedEvents(data.since, data.districtId, isStaff);
                if (callback) {
                    callback({
                        success: true,
                        recoveredCount: missed.length,
                        events: missed.map((m) => m.payload),
                    });
                }
            }
            catch (err) {
                if (callback)
                    callback({ success: false, error: err.message });
            }
        });
        socket.on('disconnect', () => {
            logger.debug({ socketId: socket.id }, 'Socket.IO client disconnected');
        });
    });
    return io;
}
export function getIO() {
    if (!io) {
        throw new Error('Socket.IO is not initialized yet. Call initSocketIO first.');
    }
    return io;
}
//# sourceMappingURL=socket.js.map