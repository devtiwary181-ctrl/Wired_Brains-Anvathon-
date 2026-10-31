export type Coordinate = {
    lat: number;
    lng: number;
};
export type RouteMode = 'WALK' | 'BICYCLE' | 'DRIVE' | 'TWO_WHEELER';
type RouteRequest = {
    origin: Coordinate;
    destination: Coordinate;
    travelMode: RouteMode;
};
export declare function decodeGooglePolyline(encoded: string): Coordinate[];
export declare function scoreRouteFactors(factors: {
    severity: number;
    exposure: number;
    closure: number;
    freshness: number;
    uncertainty: number;
}): number;
export declare function rankRouteResults<T extends {
    confirmedClosures: number;
    confirmedSevereHazards: number;
    riskScore: number;
    durationSeconds: number;
    distanceMeters: number;
}>(routes: T[]): T[];
export type ParsedRoute = {
    routeId: string;
    label: string;
    points: Coordinate[];
    distanceMeters: number;
    durationSeconds: number;
    instructions: string[];
};
export declare function compareRoutes(request: RouteRequest, fetcher?: typeof fetch): Promise<{
    alternatives: {
        rank: number;
        recommended: boolean;
        coordinates: Coordinate[];
        confirmedClosures: number;
        confirmedSevereHazards: number;
        riskScore: number;
        riskFactors: {
            severity: number;
            exposure: number;
            closure: number;
            freshness: number;
            uncertainty: number;
        };
        hazardExposureMeters: number;
        hazardIntersections: {
            id: string;
            hazardType: string | undefined;
            severity: string | undefined;
            verification: string;
            lastUpdated: string;
        }[];
        nearbyUnverifiedReports: {
            id: string;
            hazardType: string | undefined;
            severity: string | undefined;
            lastUpdated: string;
        }[];
        roadClosures: {
            id: string;
            status: string | undefined;
            lastUpdated: string;
        }[];
        riskExplanation: string;
        source: string;
        dataUpdatedAt: string;
        routeId: string;
        label: string;
        points: Coordinate[];
        distanceMeters: number;
        durationSeconds: number;
        instructions: string[];
    }[];
    recommendedRouteId: string | null;
    noReliablyLowRiskRoute: boolean;
    message: string;
    source: string;
    fetchedAt: string;
    riskModel: {
        weights: {
            severity: number;
            exposure: number;
            closure: number;
            freshness: number;
            uncertainty: number;
        };
        note: string;
    };
}>;
export declare function checkRouteRisk(input: {
    coordinates: Coordinate[];
    knownFeatureIds?: string[];
    previousRiskScore?: number;
    previousFreshness?: number;
}): Promise<{
    materialChange: boolean;
    recalculateRecommended: boolean;
    riskScore: number;
    riskDelta: number;
    freshness: number;
    newClosures: {
        id: string;
        status: string | undefined;
    }[];
    newSevereHazards: {
        id: string;
        severity: string | undefined;
        hazardType: string | undefined;
    }[];
    currentFeatureIds: string[];
    nearbyUnverifiedReports: {
        id: string;
        hazardType: string | undefined;
        severity: string | undefined;
    }[];
    checkedAt: string;
    message: string;
}>;
export declare function geocodeSearch(query: string, fetcher?: typeof fetch): Promise<{
    placeId: string;
    label: string;
    coordinates: Coordinate;
}[]>;
export declare function getMapsBrowserConfig(): {
    provider: string;
    tileUrl: string;
    attribution: string;
    osrmUrl: string;
    nominatimUrl: string;
    libraries: readonly ["leaflet"];
};
export {};
