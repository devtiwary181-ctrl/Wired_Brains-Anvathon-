export interface StaffNotificationPayload {
    type: 'NEW_SOS' | 'NEW_RELIEF_REQUEST' | 'RELIEF_STAGE_CHANGED' | 'INVENTORY_ALLOCATED' | 'DELIVERY_COMPLETED';
    title: string;
    message: string;
    districtId?: string | null;
    entityId?: string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
}
/**
 * Emit an emergency / operational notification to authorized staff.
 * Broadcasts via Socket.IO to authority rooms and enqueues to the BullMQ notification queue.
 */
export declare function notifyAuthorizedStaff(payload: StaffNotificationPayload): Promise<{
    delivered: boolean;
    channel: string;
}>;
