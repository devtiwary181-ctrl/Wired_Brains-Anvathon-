import { Request, Response, NextFunction } from 'express';
/**
 * Optional user extractor: populates req.user if valid token/cookie is present,
 * without throwing errors if anonymous.
 */
export declare function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void>;
export declare class CopilotController {
    chat(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const copilotController: CopilotController;
