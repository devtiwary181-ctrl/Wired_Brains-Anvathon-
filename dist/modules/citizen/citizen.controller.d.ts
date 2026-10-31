/**
 * Citizen Controller — DisasterReady India
 * HTTP request handlers for all public citizen endpoints.
 * No authentication required for any route in this controller.
 */
import { Request, Response, NextFunction } from 'express';
export declare class CitizenController {
    compareRoutes(req: Request, res: Response, next: NextFunction): Promise<void>;
    checkRouteRisk(req: Request, res: Response, next: NextFunction): Promise<void>;
    searchPlaces(req: Request, res: Response, next: NextFunction): Promise<void>;
    mapsConfig(_req: Request, res: Response, next: NextFunction): Promise<void>;
    reverseGeocode(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getStates(req: Request, res: Response, next: NextFunction): Promise<void>;
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
