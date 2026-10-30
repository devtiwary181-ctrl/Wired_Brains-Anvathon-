import { z } from 'zod';

export const COPILOT_LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'bn', 'mr', 'gu', 'or', 'pa', 'as'] as const;
export type CopilotLanguage = (typeof COPILOT_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<CopilotLanguage, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  hi: { native: 'हिन्दी', english: 'Hindi' },
  ta: { native: 'தமிழ்', english: 'Tamil' },
  te: { native: 'తెలుగు', english: 'Telugu' },
  kn: { native: 'ಕನ್ನಡ', english: 'Kannada' },
  ml: { native: 'മലയാളം', english: 'Malayalam' },
  bn: { native: 'বাংলা', english: 'Bengali' },
  mr: { native: 'मराठी', english: 'Marathi' },
  gu: { native: 'ગુજરાતી', english: 'Gujarati' },
  or: { native: 'ଓଡ଼ିଆ', english: 'Odia' },
  pa: { native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  as: { native: 'অসমীয়া', english: 'Assamese' },
};

export const copilotChatSchema = z.object({
  query: z.string().min(1).max(2000),
  language: z.enum(COPILOT_LANGUAGES).default('en'),
  districtId: z.string().uuid().optional(),
  coordinates: z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
    })
    .optional(),
  trackingToken: z.string().max(100).optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
  requestedTool: z.string().max(80).optional(),
  toolParameters: z.record(z.string(), z.unknown()).optional(),
});

export type CopilotChatInput = z.infer<typeof copilotChatSchema>;

export interface CopilotActionCard {
  type:
    | 'FACILITY_CARD'
    | 'HAZARD_CARD'
    | 'ALERT_CARD'
    | 'ROUTE_CARD'
    | 'SUPPLY_REQUEST_CARD'
    | 'TRACKING_CARD'
    | 'EMERGENCY_DIALER_CARD'
    | 'RECOMMENDATION_DRAFT_CARD';
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
