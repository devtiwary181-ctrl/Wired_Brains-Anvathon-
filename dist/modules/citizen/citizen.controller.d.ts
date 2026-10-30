/**
 * Citizen Controller — DisasterReady India
 * HTTP request handlers for all public citizen endpoints.
 * No authentication required for any route in this controller.
 */
import { Request, Response, NextFunction } from 'express';
export declare class CitizenController {
    reverseGeocode(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    searchDistricts(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getDashboard(req: Request, res: Response, next: NextFunction): Promise<void>;
    getActiveAlerts(req: Request, res: Response, next: NextFunction): Promise<void>;
    getAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void>;
    getSpatialHazards(req: Request, res: Response, next: NextFunction): Promise<void>;
    reportHazard(req: Request, res: Response, next: NextFunction): Promise<void>;
    getFacilities(req: Request, res: Response, next: NextFunction): Promise<void>;
    getPreparednessGuides(req: Request, res: Response, next: NextFunction): Promise<void>;
    createReliefRequest(req: Request, res: Response, next: NextFunction): Promise<void>;
    trackRequest(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    logSos(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const citizenController: CitizenController;
