import { Request, Response, NextFunction } from 'express';
export declare class AuthorityController {
    dashboard(req: Request, res: Response, next: NextFunction): Promise<void>;
    listSos(req: Request, res: Response, next: NextFunction): Promise<void>;
    listHazards(req: Request, res: Response, next: NextFunction): Promise<void>;
    decideHazard(req: Request, res: Response, next: NextFunction): Promise<void>;
    listIncidents(req: Request, res: Response, next: NextFunction): Promise<void>;
    createIncident(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateIncident(req: Request, res: Response, next: NextFunction): Promise<void>;
    incidentHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
    listAlerts(req: Request, res: Response, next: NextFunction): Promise<void>;
    alertHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
    createAlert(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateAlert(req: Request, res: Response, next: NextFunction): Promise<void>;
    listFacilities(req: Request, res: Response, next: NextFunction): Promise<void>;
    createFacility(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateFacility(req: Request, res: Response, next: NextFunction): Promise<void>;
    listReliefRequests(req: Request, res: Response, next: NextFunction): Promise<void>;
    transitionReliefRequest(req: Request, res: Response, next: NextFunction): Promise<void>;
    allocateReliefRequest(req: Request, res: Response, next: NextFunction): Promise<void>;
    listInventory(req: Request, res: Response, next: NextFunction): Promise<void>;
    adjustInventory(req: Request, res: Response, next: NextFunction): Promise<void>;
    listStaff(req: Request, res: Response, next: NextFunction): Promise<void>;
    staffHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
    createStaff(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateStaff(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const authorityController: AuthorityController;
