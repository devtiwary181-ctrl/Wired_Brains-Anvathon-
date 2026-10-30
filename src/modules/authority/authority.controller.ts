import { Request, Response, NextFunction } from 'express';
import { authorityService } from './authority.service.js';
import { AppError } from '../../middleware/errorHandler.js';

function actor(req: Request) {
  if (!req.user) throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  return req.user;
}

function routeId(req: Request) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) throw new AppError('A record ID is required.', 400, 'INVALID_RECORD_ID');
  return id;
}

function requestIp(req: Request) {
  return req.ip || req.socket.remoteAddress;
}

export class AuthorityController {
  async dashboard(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.getDashboard(actor(req)) }); } catch (error) { next(error); }
  }
  async listSos(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.listSos(actor(req)) }); } catch (error) { next(error); }
  }
  async listHazards(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.listHazards(actor(req), req.query.status as string | undefined) }); } catch (error) { next(error); }
  }
  async decideHazard(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.decideHazard(actor(req), routeId(req), req.body.decision, req.body.reason, requestIp(req)) }); } catch (error) { next(error); }
  }
  async listIncidents(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.listIncidents(actor(req), req.query.status as string | undefined) }); } catch (error) { next(error); }
  }
  async createIncident(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ success: true, data: await authorityService.createIncident(actor(req), req.body, requestIp(req)) }); } catch (error) { next(error); }
  }
  async updateIncident(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.updateIncident(actor(req), routeId(req), req.body, requestIp(req)) }); } catch (error) { next(error); }
  }
  async incidentHistory(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.listIncidentHistory(actor(req), routeId(req)) }); } catch (error) { next(error); }
  }
  async listAlerts(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.listAlerts(actor(req)) }); } catch (error) { next(error); }
  }
  async alertHistory(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.alertHistory(actor(req), routeId(req)) }); } catch (error) { next(error); }
  }
  async createAlert(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ success: true, data: await authorityService.createAlert(actor(req), req.body, requestIp(req)) }); } catch (error) { next(error); }
  }
  async updateAlert(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.updateAlert(actor(req), routeId(req), req.body, requestIp(req)) }); } catch (error) { next(error); }
  }
  async listFacilities(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.listFacilities(actor(req)) }); } catch (error) { next(error); }
  }
  async createFacility(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ success: true, data: await authorityService.createFacility(actor(req), req.body, requestIp(req)) }); } catch (error) { next(error); }
  }
  async updateFacility(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.updateFacility(actor(req), routeId(req), req.body, requestIp(req)) }); } catch (error) { next(error); }
  }
  async listReliefRequests(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.listReliefRequests(actor(req), req.query.stage as string | undefined) }); } catch (error) { next(error); }
  }
  async transitionReliefRequest(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.transitionReliefRequest(actor(req), routeId(req), req.body, requestIp(req)) }); } catch (error) { next(error); }
  }
  async allocateReliefRequest(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.allocateReliefRequest(actor(req), routeId(req), req.body, requestIp(req)) }); } catch (error) { next(error); }
  }
  async listInventory(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.listInventory(actor(req)) }); } catch (error) { next(error); }
  }
  async adjustInventory(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.adjustInventory(actor(req), routeId(req), req.body, requestIp(req)) }); } catch (error) { next(error); }
  }
  async listStaff(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.listStaff(actor(req)) }); } catch (error) { next(error); }
  }
  async staffHistory(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.staffHistory(actor(req), routeId(req)) }); } catch (error) { next(error); }
  }
  async createStaff(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ success: true, data: await authorityService.createStaff(actor(req), req.body, requestIp(req)) }); } catch (error) { next(error); }
  }
  async updateStaff(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await authorityService.updateStaff(actor(req), routeId(req), req.body, requestIp(req)) }); } catch (error) { next(error); }
  }
}

export const authorityController = new AuthorityController();
