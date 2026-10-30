import { z } from 'zod';
import { AuthenticatedUser } from '../auth/auth.middleware.js';
export interface ToolContext {
    user?: AuthenticatedUser;
    language: string;
    districtId?: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
}
export interface CopilotToolDefinition<TInput = any, TOutput = any> {
    name: string;
    description: string;
    permission?: string;
    schema: z.ZodType<TInput>;
    execute: (input: TInput, context: ToolContext) => Promise<TOutput>;
}
export declare const copilotTools: Record<string, CopilotToolDefinition>;
