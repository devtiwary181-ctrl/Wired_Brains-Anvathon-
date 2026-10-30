export type RealtimeEventType = 'hazard:created' | 'hazard:updated' | 'alert:published' | 'road:closure_updated' | 'route:risk_changed' | 'facility:status_updated' | 'shelter:capacity_updated' | 'inventory:updated' | 'request:status_changed' | 'delivery:status_changed' | 'sos:received' | 'sos:acknowledged' | 'announcement:published';
export interface OutboxRecord {
    id: string;
    eventType: RealtimeEventType;
    aggregateId: string;
    districtId?: string | null;
    payload: Record<string, unknown>;
    published: boolean;
    createdAt: Date;
}
export declare class OutboxService {
    /**
     * Write an event into the transactional outbox and dispatch immediately to Socket.IO & Push
     */
    publishEvent(eventType: RealtimeEventType, aggregateId: string, payload: Record<string, unknown>, districtId?: string | null, prismaClient?: any): Promise<OutboxRecord>;
    /**
     * Route event to appropriate Socket.IO rooms based on authorization tier
     */
    dispatchSocketEvent(event: OutboxRecord): Promise<void>;
    /**
     * Fetch missed events after client reconnection using a timestamp or cursor
     */
    getMissedEvents(since: string | Date, districtId?: string, isStaff?: boolean): Promise<OutboxRecord[]>;
}
export declare const outboxService: OutboxService;
