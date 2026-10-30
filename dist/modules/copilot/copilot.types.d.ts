import { z } from 'zod';
export declare const COPILOT_LANGUAGES: readonly ["en", "hi", "ta", "te", "kn", "ml", "bn", "mr", "gu", "or", "pa", "as"];
export type CopilotLanguage = (typeof COPILOT_LANGUAGES)[number];
export declare const LANGUAGE_NAMES: Record<CopilotLanguage, {
    native: string;
    english: string;
}>;
export declare const copilotChatSchema: z.ZodObject<{
    query: z.ZodString;
    language: z.ZodDefault<z.ZodEnum<{
        te: "te";
        en: "en";
        hi: "hi";
        ta: "ta";
        kn: "kn";
        ml: "ml";
        bn: "bn";
        mr: "mr";
        gu: "gu";
        or: "or";
        pa: "pa";
        as: "as";
    }>>;
    districtId: z.ZodOptional<z.ZodString>;
    coordinates: z.ZodOptional<z.ZodObject<{
        lat: z.ZodCoercedNumber<unknown>;
        lng: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>;
    trackingToken: z.ZodOptional<z.ZodString>;
    conversationHistory: z.ZodOptional<z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
            system: "system";
        }>;
        content: z.ZodString;
    }, z.core.$strip>>>;
    requestedTool: z.ZodOptional<z.ZodString>;
    toolParameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type CopilotChatInput = z.infer<typeof copilotChatSchema>;
export interface CopilotActionCard {
    type: 'FACILITY_CARD' | 'HAZARD_CARD' | 'ALERT_CARD' | 'ROUTE_CARD' | 'SUPPLY_REQUEST_CARD' | 'TRACKING_CARD' | 'EMERGENCY_DIALER_CARD' | 'RECOMMENDATION_DRAFT_CARD';
    title: string;
    data: Record<string, unknown>;
    requiresHumanConfirmation?: boolean;
}
export interface CopilotResponse {
    response: string;
    originalLanguageText?: string;
    detectedLanguage: CopilotLanguage;
    actionCard?: CopilotActionCard;
    toolUsed?: string;
    dataSources: Array<{
        source: string;
        verified: boolean;
        timestamp: string;
    }>;
    safetyDisclaimer: string;
    isFallback: boolean;
}
