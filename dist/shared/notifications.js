import { getIO } from './socket.js';
import { notificationQueue } from './queue.js';
import { logger } from './logger.js';
/**
 * Emit an emergency / operational notification to authorized staff.
 * Broadcasts via Socket.IO to authority rooms and enqueues to the BullMQ notification queue.
 */
export async function notifyAuthorizedStaff(payload) {
    const timestamp = payload.timestamp || new Date().toISOString();
    const eventData = { ...payload, timestamp };
    let socketDelivered = false;
    try {
        const io = getIO();
        if (io) {
            if (payload.districtId) {
                io.to(`eoc:${payload.districtId}`).emit('staff:notification', eventData);
            }
            // Also broadcast to central EOC / command room
            io.to('eoc:central').emit('staff:notification', eventData);
            socketDelivered = true;
        }
    }
    catch (err) {
        // Socket server may not be active during standalone test execution
        logger.debug({ err }, 'Socket.IO notification not delivered (server may be offline)');
    }
    let queueDelivered = false;
    try {
        await notificationQueue.add('staff-alert', eventData, {
            priority: payload.type === 'NEW_SOS' ? 1 : 2,
        });
        queueDelivered = true;
    }
    catch (err) {
        logger.warn({ err }, 'Failed to enqueue notification job to BullMQ');
    }
    return {
        delivered: socketDelivered || queueDelivered,
        channel: socketDelivered && queueDelivered ? 'SOCKET_AND_QUEUE' : socketDelivered ? 'SOCKET_ONLY' : queueDelivered ? 'QUEUE_ONLY' : 'NONE',
    };
}
//# sourceMappingURL=notifications.js.map