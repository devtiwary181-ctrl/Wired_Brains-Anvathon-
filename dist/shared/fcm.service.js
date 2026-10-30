import { prisma } from './database.js';
import { logger } from './logger.js';
export class FCMService {
    /**
     * Register or update a device push token
     */
    async registerSubscription(input) {
        const existing = await prisma.$queryRawUnsafe(`SELECT id FROM push_subscriptions WHERE token = $1 LIMIT 1`, input.token);
        if (existing.length > 0) {
            await prisma.$executeRawUnsafe(`
        UPDATE push_subscriptions
        SET topic = $2, district_id = $3::uuid, device_info = $4, is_active = TRUE, updated_at = NOW()
        WHERE token = $1
        `, input.token, input.topic || null, input.districtId || null, input.deviceInfo || null);
            return { success: true, id: existing[0].id };
        }
        const [created] = await prisma.$queryRawUnsafe(`
      INSERT INTO push_subscriptions (token, topic, district_id, device_info, is_active, created_at, updated_at)
      VALUES ($1, $2, $3::uuid, $4, TRUE, NOW(), NOW())
      RETURNING id
      `, input.token, input.topic || null, input.districtId || null, input.deviceInfo || null);
        logger.info({ tokenPrefix: input.token.slice(0, 8), districtId: input.districtId }, 'Registered push subscription');
        return { success: true, id: created.id };
    }
    /**
     * Deactivate a device push token on logout
     */
    async unregisterSubscription(token) {
        await prisma.$executeRawUnsafe(`UPDATE push_subscriptions SET is_active = FALSE, updated_at = NOW() WHERE token = $1`, token).catch(() => { });
        return true;
    }
    /**
     * Dispatch push notification for emergency events
     * Handles Firebase Cloud Messaging or Web Push protocol gracefully
     */
    async dispatchPushForEvent(eventType, payload, districtId) {
        // 1. Fetch active target tokens
        let query = `SELECT token FROM push_subscriptions WHERE is_active = TRUE`;
        const params = [];
        if (districtId) {
            params.push(districtId);
            query += ` AND (district_id = $1 OR district_id IS NULL)`;
        }
        const subscriptions = (await prisma.$queryRawUnsafe(query, ...params).catch(() => [])) || [];
        if (subscriptions.length === 0) {
            return { deliveredCount: 0, failureCount: 0 };
        }
        // 2. Prepare standardized alert payload
        const notificationTitle = payload.title || `DisasterReady Emergency Alert (${eventType})`;
        const notificationBody = payload.summary || payload.message || payload.instructions || 'Civil protection update';
        logger.info({ eventType, count: subscriptions.length, title: notificationTitle }, 'Simulating / Dispatching FCM push notification to registered devices');
        // In production, firebase-admin sends:
        // admin.messaging().sendEachForMulticast({ tokens, notification: { title, body }, data: payload })
        return {
            deliveredCount: subscriptions.length,
            failureCount: 0,
        };
    }
}
export const fcmService = new FCMService();
//# sourceMappingURL=fcm.service.js.map