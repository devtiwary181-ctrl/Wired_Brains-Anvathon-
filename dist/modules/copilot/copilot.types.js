import { z } from 'zod';
export const COPILOT_LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'bn', 'mr', 'gu', 'or', 'pa', 'as'];
export const LANGUAGE_NAMES = {
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
        .array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(4000),
    }))
        .max(20)
        .optional(),
    requestedTool: z.string().max(80).optional(),
    toolParameters: z.record(z.string(), z.unknown()).optional(),
});
//# sourceMappingURL=copilot.types.js.map