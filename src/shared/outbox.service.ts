import { prisma } from './database.js';
import { getIO } from './socket.js';
import { logger } from './logger.js';
import { fcmService } from './fcm.service.js';

export type RealtimeEventType =
  | 'hazard:created'
  | 'hazard:updated'
  | 'alert:published'
  | 'road:closure_updated'
  | 'route:risk_changed'
  | 'facility:status_updated'
  | 'shelter:capacity_updated'
  | 'inventory:updated'
  | 'request:status_changed'
  | 'delivery:status_changed'
  | 'sos:received'
  | 'sos:acknowledged'
  | 'announcement:published';

export interface OutboxRecord {
  id: string;
  eventType: RealtimeEventType;
  aggregateId: string;
  districtId?: string | null;
  payload: Record<string, unknown>;
  published: boolean;
  createdAt: Date;
}

export class OutboxService {
  /**
   * Write an event into the transactional outbox and dispatch immediately to Socket.IO & Push
   */
  async publishEvent(
    eventType: RealtimeEventType,
    aggregateId: string,
    payload: Record<string, unknown>,
    districtId?: string | null,
    prismaClient: any = prisma
  ): Promise<OutboxRecord> {
    const rawPayload = JSON.stringify({
      ...payload,
      eventType,
      aggregateId,
      districtId: districtId || null,
      timestamp: new Date().toISOString(),
    });

    const [event] = await prismaClient.$queryRawUnsafe(
      `
      INSERT INTO outbox_events (event_type, aggregate_id, district_id, payload, published, created_at)
      VALUES ($1, $2, $3::uuid, $4::jsonb, $5, NOW())
      RETURNING id, event_type as "eventType", aggregate_id as "aggregateId", district_id as "districtId", payload, published, created_at as "createdAt"
      `,
      eventType,
      aggregateId,
      districtId || null,
      rawPayload,
      false
    );

    // Dispatch asynchronously to active clients via Socket.IO
    this.dispatchSocketEvent(event).catch((err) => {
      logger.warn({ err, eventType, aggregateId }, 'Failed immediate socket dispatch of outbox event');
    });

    // Send push notification if alert or severe hazard
    if (['alert:published', 'hazard:created', 'announcement:published', 'sos:received'].includes(eventType)) {
      fcmService.dispatchPushForEvent(eventType, event.payload, districtId).catch((err) => {
        logger.warn({ err, eventType }, 'Failed push dispatch for outbox event');
      });
    }

    return event;
  }

  /**
   * Route event to appropriate Socket.IO rooms based on authorization tier
   */
  async dispatchSocketEvent(event: OutboxRecord): Promise<void> {
    try {
      const io = getIO();
      if (!io) return;

      const eventType = event.eventType;
      const payload = event.payload;
      const districtId = event.districtId;

      // 1. Admin/Staff-only events -> strictly EOC rooms
      if (['sos:received', 'sos:acknowledged', 'inventory:updated', 'delivery:status_changed'].includes(eventType)) {
        if (districtId) {
          io.to(`eoc:${districtId}`).emit(eventType, payload);
        }
        io.to('eoc:central').emit(eventType, payload);
      }
      // 2. Private citizen tracking events -> strictly request room
      else if (eventType === 'request:status_changed') {
        const trackingToken = (payload as any).trackingToken;
        if (trackingToken) {
          io.to(`request:${trackingToken}`).emit(eventType, payload);
        }
        // Also inform staff
        if (districtId) io.to(`eoc:${districtId}`).emit(eventType, payload);
        io.to('eoc:central').emit(eventType, payload);
      }
      // 3. Public civic information -> district broadcast and public channels
      else {
        if (districtId) {
          io.to(`district:${districtId}`).emit(eventType, payload);
        }
        // Public alerts & general announcements
        io.to('public:alerts').emit(eventType, payload);
        // Also send to staff rooms
        io.to('eoc:central').emit(eventType, payload);
        if (districtId) io.to(`eoc:${districtId}`).emit(eventType, payload);
      }

      // Mark outbox published
      await prisma.$executeRawUnsafe(
        `UPDATE outbox_events SET published = TRUE WHERE id = $1`,
        event.id
      ).catch(() => {});
    } catch {
      // In offline / testing modes without active socket server
    }
  }

  /**
   * Fetch missed events after client reconnection using a timestamp or cursor
   */
  async getMissedEvents(
    since: string | Date,
    districtId?: string,
    isStaff: boolean = false
  ): Promise<OutboxRecord[]> {
    const sinceDate = new Date(since);
    const validDate = isNaN(sinceDate.getTime()) ? new Date(Date.now() - 3600000) : sinceDate;

    let query = `
      SELECT id, event_type as "eventType", aggregate_id as "aggregateId", district_id as "districtId", payload, published, created_at as "createdAt"
      FROM outbox_events
      WHERE created_at > $1
    `;
    const params: any[] = [validDate];

    if (!isStaff) {
      // Citizens must NOT receive internal admin events (SOS logs, depot stock moves)
      query += ` AND event_type NOT IN ('sos:received', 'sos:acknowledged', 'inventory:updated', 'delivery:status_changed')`;
    }

    if (districtId) {
      params.push(districtId);
      query += ` AND (district_id = $${params.length}::uuid OR district_id IS NULL)`;
    }

    query += ` ORDER BY created_at ASC LIMIT 100`;

    const records: OutboxRecord[] = await prisma.$queryRawUnsafe(query, ...params);
    return records;
  }
}

export const outboxService = new OutboxService();
