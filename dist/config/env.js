import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const envSchema = z.object({
    PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    FRONTEND_URL: z.string().default('http://localhost:3000,http://localhost:5173'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
    GOOGLE_MAPS_API_KEY: z.string().default(''),
    SMS_PROVIDER_API_KEY: z.string().default(''),
    SMS_SENDER_ID: z.string().default('NDMAIND'),
    AI_PROVIDER_API_KEY: z.string().default(''),
    AI_MODEL_NAME: z.string().default('gemini-1.5-pro'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.format());
    process.exit(1);
}
export const env = parsed.data;
//# sourceMappingURL=env.js.map