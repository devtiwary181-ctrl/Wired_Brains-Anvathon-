import { AuthenticatedUser } from '../auth/auth.middleware.js';
import { CopilotChatInput, CopilotResponse } from './copilot.types.js';
export declare class CopilotService {
    /**
     * Main conversational orchestration pipeline:
     * Query -> Intent/Tool Determination -> Permission Validation -> Tool Execution -> Response Formulation
     */
    processQuery(input: CopilotChatInput, user?: AuthenticatedUser): Promise<CopilotResponse>;
    /**
     * Safe natural language intent matching for core emergency topics
     */
    private detectIntent;
    /**
     * Extract parameters from query or context
     */
    private extractParameters;
    /**
     * Construct rich interactive action cards for the frontend
     */
    private buildActionCard;
    /**
     * Grounded response generation strictly bound to verified facts
     */
    private formulateGroundedResponse;
    private translateToHindi;
}
export declare const copilotService: CopilotService;
