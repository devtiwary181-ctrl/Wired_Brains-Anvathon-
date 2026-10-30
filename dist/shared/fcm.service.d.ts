export interface PushRegistrationInput {
    token: string;
    topic?: string;
    districtId?: string;
    deviceInfo?: string;
}
export declare class FCMService {
    /**
     * Register or update a device push token
     */
    registerSubscription(input: PushRegistrationInput): Promise<{
        success: boolean;
        id: string;
    }>;
    /**
     * Deactivate a device push token on logout
     */
    unregisterSubscription(token: string): Promise<boolean>;
    /**
     * Dispatch push notification for emergency events
     * Handles Firebase Cloud Messaging or Web Push protocol gracefully
     */
    dispatchPushForEvent(eventType: string, payload: any, districtId?: string | null): Promise<{
        deliveredCount: number;
        failureCount: number;
    }>;
}
export declare const fcmService: FCMService;
