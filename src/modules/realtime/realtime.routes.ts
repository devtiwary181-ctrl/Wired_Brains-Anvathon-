import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { outboxService } from '../../shared/outbox.service.js';
import { fcmService } from '../../shared/fcm.service.js';
import { AppError } from '../../middleware/errorHandler.js';
import { optionalAuth } from '../copilot/copilot.controller.js';

export const realtimeRouter = Router();

const pushSubscriptionSchema = z.object({
  token: z.string().min(10).max(500),
  topic: z.string().max(200).optional(),
  districtId: z.string().uuid().optional(),
  deviceInfo: z.string().max(200).optional(),
});

/**
 * GET /api/v1/realtime/events/missed
 * Recover missed events since a specific timestamp or cursor
 */
realtimeRouter.get('/events/missed', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const since = (req.query.since as string) || new Date(Date.now() - 3600000).toISOString();
    const districtId = (req.query.districtId as string) || undefined;
    const isStaff = Boolean(req.user);

    const events = await outboxService.getMissedEvents(since, districtId, isStaff);

    res.json({
      success: true,
      data: {
        since,
        count: events.length,
        events: events.map((e) => e.payload),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/realtime/notifications/subscribe
 * Register device token for FCM push alerts
 */
realtimeRouter.post('/notifications/subscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = pushSubscriptionSchema.safeParse(req.body);
    if (!parse.success) {
      throw new AppError('Invalid subscription registration payload.', 400, 'VALIDATION_ERROR');
    }

    const result = await fcmService.registerSubscription(parse.data);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/realtime/notifications/unsubscribe
 * Deactivate device token on logout
 */
realtimeRouter.post('/notifications/unsubscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.body?.token;
    if (!token || typeof token !== 'string') {
      throw new AppError('Token required for unsubscribe.', 400, 'TOKEN_REQUIRED');
    }

    await fcmService.unregisterSubscription(token);
    res.json({
      success: true,
      message: 'Push subscription deactivated.',
    });
  } catch (error) {
    next(error);
  }
});
