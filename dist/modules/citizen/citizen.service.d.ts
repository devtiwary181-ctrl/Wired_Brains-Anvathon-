import { Prisma } from '@prisma/client';
export declare class CitizenService {
    /**
     * Reverse geocode GPS coordinate to district and state.
     */
    reverseGeocode(lat: number, lng: number): Promise<{
        state: any;
        district: any;
        districtId: string | null;
        districtCode: string | null;
        coordinates: {
            lat: number;
            lng: number;
        };
        source: string;
        timestamp: string;
    }>;
    /**
     * Get all distinct states for state-first district selector.
     */
    getStates(): Promise<string[]>;
    /**
     * Search districts / cities / landmarks by free-text query or state.
     */
    searchDistricts(query?: string, state?: string): Promise<{
        id: string;
        name: string;
        code: string;
        state: string;
        eocPhone: string | null;
    }[]>;
    /**
     * Aggregate dashboard data: alerts, hazards, facilities, announcements.
     */
    getDashboard(districtId?: string, lat?: number, lng?: number): Promise<{
        meta: {
            fetchedAt: string;
            districtId: string | null;
            userCoordinates: {
                lat: number | undefined;
                lng: number | undefined;
            } | null;
            designatedState: string;
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
            id: any;
            name: any;
            facilityType: any;
            address: any;
            coordinates: {
                lat: any;
                lng: any;
            };
            contactPhone: any;
            inChargeName: any;
            totalCapacity: any;
            currentOccupancy: any;
            availableBeds: number | null;
            capacitySource: string;
            services: {
                medical: any;
                generatorPower: any;
                drinkingWater: any;
                infantCare: any;
                petFriendly: any;
                wheelchairRamp: any;
                womenWing: any;
            };
            hazardSuitability: any;
            dataQuality: {
                unknownFields: ("contactPhone" | "totalCapacity" | "currentOccupancy" | "hasMedicalSupport" | "hasGeneratorPower" | "hasDrinkingWater" | "hasInfantCare" | "isPetFriendly")[];
                stale: boolean;
            };
            isVerified: any;
            operatingStatus: any;
            distanceKm: number | null;
            lastUpdated: any;
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
        hazard?: string;
        facilities?: string;
        hasMedical?: boolean;
        hasInfantCare?: boolean;
        hasPower?: boolean;
        hasDrinkingWater?: boolean;
        hasWheelchairRamp?: boolean;
        hasWomenWing?: boolean;
        isPetFriendly?: boolean;
    }): Promise<{
        id: any;
        name: any;
        facilityType: any;
        address: any;
        coordinates: {
            lat: any;
            lng: any;
        };
        contactPhone: any;
        inChargeName: any;
        totalCapacity: any;
        currentOccupancy: any;
        availableBeds: number | null;
        capacitySource: string;
        services: {
            medical: any;
            generatorPower: any;
            drinkingWater: any;
            infantCare: any;
            petFriendly: any;
            wheelchairRamp: any;
            womenWing: any;
        };
        hazardSuitability: any;
        dataQuality: {
            unknownFields: ("contactPhone" | "totalCapacity" | "currentOccupancy" | "hasMedicalSupport" | "hasGeneratorPower" | "hasDrinkingWater" | "hasInfantCare" | "isPetFriendly")[];
            stale: boolean;
        };
        isVerified: any;
        operatingStatus: any;
        distanceKm: number | null;
        lastUpdated: any;
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
        requestId: string;
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
        emergencyType?: string;
        latitude?: number;
        longitude?: number;
        gpsAccuracy?: number;
        affectedPeople?: number;
        description?: string;
        contactInfo?: string;
    }): Promise<{
        sosId: string;
        serviceType: string;
        emergencyType: string | null;
        affectedPeople: number;
        status: string;
        message: string;
        directHelplines: {
            service: string;
            number: string;
            telUri: string;
        }[];
    }>;
    /**
     * Get list of relief depots sorted by distance to coordinates
     */
    getReliefDepots(lat?: number, lng?: number): Promise<{
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        contactPhone: string;
        isOperational: boolean;
        district: string;
        state: string;
        distanceKm: number | null;
        verifiedMinutesAgo: number;
        inventory: {
            sku: string;
            name: string;
            quantityAvailable: number;
            quantityReserved: number;
            unit: string;
            status: string;
        }[];
    }[]>;
    /**
     * Rule-based natural language parser for emergency supply needs
     */
    analyzeSuppliesText(text: string): {
        parsed: {
            totalPeople: number;
            adults: number;
            children: number;
            infants: number;
            elderly: number;
            disabled: number;
            items: {
                drinkingWater: boolean;
                foodKits: boolean;
                babyFormula: boolean;
                firstAidKit: boolean;
                blankets: boolean;
                emergencyTents: boolean;
                sanitationKit: boolean;
            };
            medicinesNeeded: boolean;
        };
        calculation: string;
        waterLiters: number;
        rationsKits: number;
    };
}
export declare const citizenService: CitizenService;
