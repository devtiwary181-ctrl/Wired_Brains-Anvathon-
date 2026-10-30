import { Prisma } from '@prisma/client';
export declare class CitizenService {
    /**
     * Reverse geocode GPS coordinate to district and state.
     */
    reverseGeocode(lat: number, lng: number): Promise<{
        state: null;
        district: null;
        districtId: null;
        districtCode: null;
        coordinates: {
            lat: number;
            lng: number;
        };
        source: string;
        timestamp: string;
    }>;
    /**
     * Search districts / cities / landmarks by free-text query.
     */
    searchDistricts(query: string): Promise<{
        id: string;
        name: string;
        code: string;
        state: string;
        eocPhone: string | null;
    }[]>;
    /**
     * Aggregate dashboard data: alerts, hazards, facilities, announcements.
     */
    getDashboard(districtId?: string): Promise<{
        meta: {
            fetchedAt: string;
            districtId: string | null;
            disclaimer: string;
        };
        summary: {
            criticalAlertCount: number;
            activeHazardCount: number;
            operationalShelterCount: number;
            announcementCount: number;
        };
        alerts: {
            id: string;
            title: string;
            severity: string;
            disasterType: string;
            summary: string;
            instructions: string;
            sourceAgency: string;
            issuedAt: Date;
            expiresAt: Date | null;
            district: string;
            state: string;
            translations: {};
            freshness: string;
        }[];
        recentHazards: {
            id: string;
            hazardType: string;
            severity: string;
            coordinates: {
                lat: number;
                lng: number;
            };
            addressLandmark: string | null;
            waterDepthCm: number;
            reportCategory: string;
            status: string;
            verifiedAt: Date | null;
            district: string | undefined;
            state: string | undefined;
            evidenceCount: number;
            hasPhoto: boolean;
            createdAt: Date;
            freshness: string;
            polygons: {
                id: string;
                zoneType: string;
                depthM: number;
                coordinates: Prisma.JsonValue;
            }[];
            disclaimer: string;
        }[];
        nearestShelters: {
            id: string;
            name: string;
            facilityType: string;
            address: string;
            coordinates: {
                lat: number;
                lng: number;
            };
            contactPhone: string | null;
            inChargeName: string | null;
            totalCapacity: number | null;
            currentOccupancy: number | null;
            availableBeds: number | null;
            capacitySource: string;
            services: {
                medical: boolean | null;
                generatorPower: boolean | null;
                drinkingWater: boolean | null;
                infantCare: boolean | null;
                petFriendly: boolean | null;
            };
            dataQuality: {
                unknownFields: ("contactPhone" | "totalCapacity" | "currentOccupancy" | "hasMedicalSupport" | "hasGeneratorPower" | "hasDrinkingWater" | "hasInfantCare" | "isPetFriendly")[];
                stale: boolean;
            };
            isVerified: boolean;
            operatingStatus: string;
            distanceKm: number | null;
            lastUpdated: Date;
            source: string;
        }[];
        announcements: {
            id: string;
            title: string;
            message: string;
            severity: string;
            issuedBy: string;
            issuedAt: Date;
            freshness: string;
        }[];
    }>;
    /**
     * Get active official alerts.
     */
    getActiveAlerts(districtId?: string): Promise<{
        id: string;
        title: string;
        severity: string;
        disasterType: string;
        summary: string;
        instructions: string;
        sourceAgency: string;
        issuedAt: Date;
        expiresAt: Date | null;
        district: string;
        state: string;
        translations: {};
        freshness: string;
    }[]>;
    /**
     * Get announcements (official broadcast messages).
     */
    getAnnouncements(districtId?: string): Promise<{
        id: string;
        title: string;
        message: string;
        severity: string;
        issuedBy: string;
        issuedAt: Date;
        freshness: string;
    }[]>;
    /**
     * Spatial hazards with filters: type, severity, status, time range.
     * Includes polygons, verification status, and data source clarity.
     */
    getSpatialHazards(districtId?: string, hazardType?: string, statusFilter?: string, severity?: string, since?: string): Promise<{
        id: string;
        hazardType: string;
        severity: string;
        coordinates: {
            lat: number;
            lng: number;
        };
        addressLandmark: string | null;
        waterDepthCm: number;
        reportCategory: string;
        status: string;
        verifiedAt: Date | null;
        district: string | undefined;
        state: string | undefined;
        evidenceCount: number;
        hasPhoto: boolean;
        createdAt: Date;
        freshness: string;
        polygons: {
            id: string;
            zoneType: string;
            depthM: number;
            coordinates: Prisma.JsonValue;
        }[];
        disclaimer: string;
    }[]>;
    /**
     * Submit anonymous citizen hazard report with duplicate protection.
     */
    reportHazard(data: {
        districtId?: string;
        hazardType: string;
        severity: string;
        latitude: number;
        longitude: number;
        addressLandmark?: string;
        waterDepthCm?: number;
        description?: string;
        observationTime?: string;
        contactInfo?: string;
        photoUrl?: string;
    }): Promise<{
        incidentId: string;
        status: string;
        message: string;
        isDuplicate: boolean;
        submittedAt?: undefined;
    } | {
        incidentId: string;
        status: string;
        isDuplicate: boolean;
        message: string;
        submittedAt: Date;
    }>;
    /**
     * Nearby facility search with Haversine distance sorting.
     * Never fabricates capacity or availability data.
     */
    getFacilities(params: {
        districtId?: string;
        facilityType?: string;
        lat?: number;
        lng?: number;
        radiusKm?: number;
        hasMedical?: boolean;
        hasInfantCare?: boolean;
        hasPower?: boolean;
        hasDrinkingWater?: boolean;
    }): Promise<{
        id: string;
        name: string;
        facilityType: string;
        address: string;
        coordinates: {
            lat: number;
            lng: number;
        };
        contactPhone: string | null;
        inChargeName: string | null;
        totalCapacity: number | null;
        currentOccupancy: number | null;
        availableBeds: number | null;
        capacitySource: string;
        services: {
            medical: boolean | null;
            generatorPower: boolean | null;
            drinkingWater: boolean | null;
            infantCare: boolean | null;
            petFriendly: boolean | null;
        };
        dataQuality: {
            unknownFields: ("contactPhone" | "totalCapacity" | "currentOccupancy" | "hasMedicalSupport" | "hasGeneratorPower" | "hasDrinkingWater" | "hasInfantCare" | "isPetFriendly")[];
            stale: boolean;
        };
        isVerified: boolean;
        operatingStatus: string;
        distanceKm: number | null;
        lastUpdated: Date;
        source: string;
    }[]>;
    /**
     * Disaster-specific preparedness guides with before/during/after sections.
     */
    getPreparednessGuides(disasterType?: string): Promise<{
        id: string;
        disasterType: string;
        title: string;
        sections: Prisma.JsonValue;
        updatedAt: Date;
    }[]>;
    /**
     * Submit an anonymous citizen relief request.
     * Returns a high-entropy tracking token — no login required.
     */
    createReliefRequest(data: {
        districtId?: string;
        requesterPhone?: string;
        headcountAdults: number;
        headcountChildren: number;
        headcountInfants: number;
        headcountSeniors: number;
        deliveryContext: string;
        urgencyLevel: string;
        latitude: number;
        longitude: number;
        landmarkNotes?: string;
        itemsRequested: Record<string, unknown>;
        specialMedicalNeeds?: string;
    }): Promise<{
        trackingToken: string;
        stage: string;
        estimatedResponseMinutes: number;
        eocPhone: null;
        message: string;
        submittedAt: Date;
    }>;
    /**
     * Track relief request by high-entropy token — no login required.
     */
    trackRequest(token: string): Promise<{
        trackingToken: string;
        district: string;
        state: string;
        eocPhone: string | null;
        stage: string;
        stageLabel: string;
        urgencyLevel: string;
        deliveryContext: string;
        headcount: {
            adults: number;
            children: number;
            infants: number;
            seniors: number;
            total: number;
        };
        itemsRequested: Prisma.JsonValue;
        etaMinutes: number | null;
        deliveredAt: Date | null;
        timeline: {
            stage: string;
            label: string;
            actorType: string;
            notes: string | null;
            timestamp: Date;
        }[];
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Log an SOS event (call intent) for analytics and dispatch coordination.
     * Does not replace calling 112 — that must be done via phone.
     */
    logSos(data: {
        serviceType: string;
        latitude?: number;
        longitude?: number;
    }): Promise<{
        sosId: string;
        serviceType: string;
        status: string;
        message: string;
        emergency_numbers: {
            '112': string;
            '1078': string;
            '108': string;
            '101': string;
            '1091': string;
            national: string;
            ndrf: string;
            ambulance: string;
            fire: string;
            women_helpline: string;
        };
        loggedAt: Date;
    }>;
}
export declare const citizenService: CitizenService;
