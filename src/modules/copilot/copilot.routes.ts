import { Router } from 'express';
import { copilotController, optionalAuth } from './copilot.controller.js';

export const copilotRouter = Router();

// POST /copilot/chat
copilotRouter.post('/chat', optionalAuth, copilotController.chat);
// Also support direct POST /
copilotRouter.post('/', optionalAuth, copilotController.chat);
