import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.middleware.js';
import { RoleType } from '../auth/rbac.js';
export declare class AuthorityService {
    getDashboard(user: AuthenticatedUser): Promise<{
        fetchedAt: string;
        districtId: string | null;
        scope: string;
        demoDataLabel: string;
        metrics: {
            activeIncidents: number;
            activeHazards: number;
            pendingReports: number | null;
            verifiedReports: number | null;
            criticalAlerts: number;
            openSupplyRequests: number | null;
            criticalUnallocatedRequests: number | null;
            trackedPeopleInOpenRequests: number | null;
            unresolvedSos: number | null;
        };
        facilities: {
            facilityType: string;
            status: string;
            count: number;
        }[];
        inventory: {
            depotId: string;
            depotName: string;
            itemSku: string;
            itemName: string;
            quantityAvailable: number;
            quantityReserved: number;
            quantityUnreserved: number;
            unit: string;
            lastRestockedAt: Date;
        }[];
        supplyRequests: {
            stage: string;
            count: number;
        }[];
        recentUpdates: {
            id: string;
            action: string;
            entityType: string;
            entityId: string;
            metadata: Prisma.JsonValue;
            actor: string;
            actorRole: string | null;
            timestamp: Date;
        }[];
    }>;
    listSos(user: AuthenticatedUser): Promise<{
        id: string;
        description: string | null;
        latitude: number | null;
        longitude: number | null;
        contactInfo: string | null;
        status: string;
        serviceType: string;
        emergencyType: string | null;
        gpsAccuracy: number | null;
        affectedPeople: number;
        triggeredAt: Date;
        acknowledgedAt: Date | null;
        acknowledgedByStaffId: string | null;
        responderNotes: string | null;
        resolvedAt: Date | null;
    }[] | {
        id: string;
        service_type: string;
        latitude: number | null;
        longitude: number | null;
        triggered_at: Date;
        status: string;
    }[]>;
    listHazards(user: AuthenticatedUser, status?: string): Promise<{
        id: string;
        district: {
            id: string;
            name: string;
            state: string;
        } | null;
        hazardType: string;
        severity: string;
        coordinates: {
            lat: number;
            lng: number;
        };
        addressLandmark: string | null;
        description: string | null;
        observedAt: Date | null;
        contactInfo: string | null;
        waterDepthCm: number;
        status: string;
        reportedByCitizen: boolean;
        verifiedByStaffId: string | null;
        verifiedAt: Date | null;
        evidence: {
            id: string;
            incidentId: string;
            mediaUrl: string;
            mediaType: string;
            fileSize: number | null;
            uploadedAt: Date;
        }[];
        polygons: {
            id: string;
            isActive: boolean;
            updatedAt: Date;
            incidentId: string;
            zoneType: string;
            coordinates: Prisma.JsonValue;
            depthM: number;
        }[];
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    listIncidents(user: AuthenticatedUser, status?: string): Promise<{
        assignedStaffId: string | null;
        operationalNotes: string | null;
        lastUpdatedBy: {
            id: string;
            fullName: string;
        } | null;
        id: string;
        district: {
            id: string;
            name: string;
            state: string;
        } | null;
        hazardType: string;
        severity: string;
        coordinates: {
            lat: number;
            lng: number;
        };
        addressLandmark: string | null;
        description: string | null;
        observedAt: Date | null;
        waterDepthCm: number;
        status: string;
        reportedByCitizen: boolean;
        verifiedByStaffId: string | null;
        verifiedAt: Date | null;
        polygons: {
            id: string;
            isActive: boolean;
            updatedAt: Date;
            incidentId: string;
            zoneType: string;
            coordinates: Prisma.JsonValue;
            depthM: number;
        }[];
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    listIncidentHistory(user: AuthenticatedUser, incidentId: string): Promise<({
        staffUser: {
            id: string;
            fullName: string;
            role: string;
        } | null;
    } & {
        id: string;
        action: string;
        entityType: string;
        entityId: string;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        timestamp: Date;
        staffUserId: string | null;
    })[]>;
    decideHazard(user: AuthenticatedUser, incidentId: string, decision: 'VERIFY' | 'REJECT', reason: string, ipAddress?: string): Promise<{
        id: string;
        status: string;
        verifiedAt: Date | null;
        district: {
            id: string;
            name: string;
            state: string;
        } | null;
        message: string;
    }>;
    createIncident(user: AuthenticatedUser, data: {
        districtId?: string;
        hazardType: string;
        severity: string;
        latitude: number;
        longitude: number;
        addressLandmark?: string;
        description?: string;
        status: 'UNVERIFIED' | 'VERIFIED_ACTIVE';
        assignedStaffId?: string;
        notes?: string;
        affectedArea?: {
            coordinates: unknown;
            zoneType: string;
            depthM?: number;
        };
    }, ipAddress?: string): Promise<{
        id: string;
        districtId: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        severity: string;
        hazardType: string;
        latitude: number;
        longitude: number;
        addressLandmark: string | null;
        observedAt: Date | null;
        contactInfo: string | null;
        waterDepthCm: number;
        status: string;
        reportedByCitizen: boolean;
        verifiedByStaffId: string | null;
        verifiedAt: Date | null;
        photoUrl: string | null;
    }>;
    updateIncident(user: AuthenticatedUser, incidentId: string, data: {
        severity?: string;
        status?: string;
        assignedStaffId?: string | null;
        notes?: string;
        affectedArea?: {
            coordinates: unknown;
            zoneType: string;
            depthM?: number;
        };
    }, ipAddress?: string): Promise<{
        id: string;
        districtId: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        severity: string;
        hazardType: string;
        latitude: number;
        longitude: number;
        addressLandmark: string | null;
        observedAt: Date | null;
        contactInfo: string | null;
        waterDepthCm: number;
        status: string;
        reportedByCitizen: boolean;
        verifiedByStaffId: string | null;
        verifiedAt: Date | null;
        photoUrl: string | null;
    }>;
    listAlerts(user: AuthenticatedUser): Promise<{
        translations: {};
        district: {
            id: string;
            name: string;
            state: string;
        };
        id: string;
        districtId: string;
        isActive: boolean;
        expiresAt: Date | null;
        title: string;
        severity: string;
        disasterType: string;
        summary: string;
        instructions: string;
        sourceAgency: string;
        issuedAt: Date;
    }[]>;
    alertHistory(user: AuthenticatedUser, alertId: string): Promise<({
        staffUser: {
            id: string;
            fullName: string;
            role: string;
        } | null;
    } & {
        id: string;
        action: string;
        entityType: string;
        entityId: string;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        timestamp: Date;
        staffUserId: string | null;
    })[]>;
    createAlert(user: AuthenticatedUser, data: {
        districtId?: string;
        title: string;
        severity: string;
        disasterType: string;
        summary: string;
        instructions: string;
        sourceAgency: string;
        translations?: Record<string, {
            title: string;
            summary: string;
            instructions: string;
        }>;
        expiresAt?: string;
        publish: boolean;
        confirmationText?: string;
    }, ipAddress?: string): Promise<{
        id: string;
        districtId: string;
        isActive: boolean;
        expiresAt: Date | null;
        title: string;
        severity: string;
        disasterType: string;
        summary: string;
        instructions: string;
        sourceAgency: string;
        issuedAt: Date;
    }>;
    updateAlert(user: AuthenticatedUser, alertId: string, data: {
        title?: string;
        severity?: string;
        disasterType?: string;
        summary?: string;
        instructions?: string;
        expiresAt?: string | null;
        cancel?: boolean;
        confirmationText?: string;
        translations?: Record<string, {
            title: string;
            summary: string;
            instructions: string;
        }>;
    }, ipAddress?: string): Promise<{
        id: string;
        districtId: string;
        isActive: boolean;
        expiresAt: Date | null;
        title: string;
        severity: string;
        disasterType: string;
        summary: string;
        instructions: string;
        sourceAgency: string;
        issuedAt: Date;
    }>;
    listFacilities(user: AuthenticatedUser): Promise<{
        dataQuality: {
            unknownFields: ("contactPhone" | "totalCapacity" | "currentOccupancy" | "hasMedicalSupport" | "hasGeneratorPower" | "hasDrinkingWater" | "hasInfantCare" | "isPetFriendly")[];
            stale: boolean;
        };
        district: {
            id: string;
            name: string;
        };
        id: string;
        districtId: string;
        updatedAt: Date;
        name: string;
        contactPhone: string;
        totalCapacity: number;
        currentOccupancy: number;
        hasMedicalSupport: boolean;
        hasGeneratorPower: boolean;
        hasDrinkingWater: boolean;
        hasInfantCare: boolean;
        isPetFriendly: boolean;
        latitude: number;
        longitude: number;
        facilityType: string;
        address: string;
        inChargeName: string | null;
        isVerified: boolean;
        operatingStatus: string;
    }[]>;
    createFacility(user: AuthenticatedUser, data: {
        districtId?: string;
        facilityType: string;
        name: string;
        address: string;
        latitude: number;
        longitude: number;
        contactPhone: string;
        totalCapacity: number;
        currentOccupancy: number;
        operatingStatus: string;
        hasMedicalSupport: boolean;
        hasGeneratorPower: boolean;
        hasDrinkingWater: boolean;
        hasInfantCare: boolean;
        isPetFriendly: boolean;
    }, ipAddress?: string): Promise<{
        id: string;
        districtId: string;
        updatedAt: Date;
        name: string;
        contactPhone: string;
        totalCapacity: number;
        currentOccupancy: number;
        hasMedicalSupport: boolean;
        hasGeneratorPower: boolean;
        hasDrinkingWater: boolean;
        hasInfantCare: boolean;
        isPetFriendly: boolean;
        latitude: number;
        longitude: number;
        facilityType: string;
        address: string;
        inChargeName: string | null;
        isVerified: boolean;
        operatingStatus: string;
    }>;
    updateFacility(user: AuthenticatedUser, facilityId: string, data: {
        name?: string;
        address?: string;
        contactPhone?: string;
        totalCapacity?: number;
        currentOccupancy?: number;
        operatingStatus?: string;
        hasMedicalSupport?: boolean;
        hasGeneratorPower?: boolean;
        hasDrinkingWater?: boolean;
        hasInfantCare?: boolean;
        isPetFriendly?: boolean;
        isVerified?: boolean;
        markUnknown?: string[];
    }, ipAddress?: string): Promise<{
        id: string;
        districtId: string;
        updatedAt: Date;
        name: string;
        contactPhone: string;
        totalCapacity: number;
        currentOccupancy: number;
        hasMedicalSupport: boolean;
        hasGeneratorPower: boolean;
        hasDrinkingWater: boolean;
        hasInfantCare: boolean;
        isPetFriendly: boolean;
        latitude: number;
        longitude: number;
        facilityType: string;
        address: string;
        inChargeName: string | null;
        isVerified: boolean;
        operatingStatus: string;
    }>;
    listReliefRequests(user: AuthenticatedUser, stage?: string): Promise<({
        district: {
            id: string;
            name: string;
        };
        auditLogs: {
            id: string;
            timestamp: Date;
            previousStage: string | null;
            newStage: string;
            actorType: string;
            actorId: string | null;
            notes: string | null;
            requestId: string;
        }[];
    } & {
        id: string;
        districtId: string;
        createdAt: Date;
        updatedAt: Date;
        latitude: number;
        longitude: number;
        trackingToken: string;
        requesterPhone: string | null;
        headcountAdults: number;
        headcountChildren: number;
        headcountInfants: number;
        headcountSeniors: number;
        deliveryContext: string;
        urgencyLevel: string;
        landmarkNotes: string | null;
        itemsRequested: Prisma.JsonValue;
        specialMedicalNeeds: string | null;
        stage: string;
        assignedDepotId: string | null;
        assignedResponderId: string | null;
        etaMinutes: number | null;
        deliveryProofPhoto: string | null;
        deliveredAt: Date | null;
    })[]>;
    transitionReliefRequest(user: AuthenticatedUser, requestId: string, data: {
        stage: string;
        notes: string;
        etaMinutes?: number;
        assignedResponderId?: string;
    }, ipAddress?: string): Promise<{
        id: string;
        districtId: string;
        createdAt: Date;
        updatedAt: Date;
        latitude: number;
        longitude: number;
        trackingToken: string;
        requesterPhone: string | null;
        headcountAdults: number;
        headcountChildren: number;
        headcountInfants: number;
        headcountSeniors: number;
        deliveryContext: string;
        urgencyLevel: string;
        landmarkNotes: string | null;
        itemsRequested: Prisma.JsonValue;
        specialMedicalNeeds: string | null;
        stage: string;
        assignedDepotId: string | null;
        assignedResponderId: string | null;
        etaMinutes: number | null;
        deliveryProofPhoto: string | null;
        deliveredAt: Date | null;
    }>;
    allocateReliefRequest(user: AuthenticatedUser, requestId: string, data: {
        depotId: string;
        allocations: Array<{
            itemSku: string;
            quantity: number;
        }>;
        etaMinutes?: number;
        assignedResponderId?: string;
        notes: string;
    }, ipAddress?: string): Promise<{
        request: {
            id: string;
            districtId: string;
            createdAt: Date;
            updatedAt: Date;
            latitude: number;
            longitude: number;
            trackingToken: string;
            requesterPhone: string | null;
            headcountAdults: number;
            headcountChildren: number;
            headcountInfants: number;
            headcountSeniors: number;
            deliveryContext: string;
            urgencyLevel: string;
            landmarkNotes: string | null;
            itemsRequested: Prisma.JsonValue;
            specialMedicalNeeds: string | null;
            stage: string;
            assignedDepotId: string | null;
            assignedResponderId: string | null;
            etaMinutes: number | null;
            deliveryProofPhoto: string | null;
            deliveredAt: Date | null;
        };
        depot: {
            id: string;
            districtId: string;
            name: string;
            isOperational: boolean;
        };
        allocations: {
            itemSku: string;
            quantity: number;
            remaining: number;
        }[];
    }>;
    listInventory(user: AuthenticatedUser): Promise<({
        depot: {
            district: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            districtId: string;
            name: string;
            contactPhone: string;
            latitude: number;
            longitude: number;
            isOperational: boolean;
        };
    } & {
        id: string;
        depotId: string;
        itemSku: string;
        itemName: string;
        quantityAvailable: number;
        quantityReserved: number;
        unit: string;
        lastRestockedAt: Date;
    })[]>;
    adjustInventory(user: AuthenticatedUser, inventoryId: string, data: {
        quantityAvailable: number;
        reason: string;
    }, ipAddress?: string): Promise<{
        id: string;
        depotId: string;
        itemSku: string;
        itemName: string;
        quantityAvailable: number;
        quantityReserved: number;
        unit: string;
        lastRestockedAt: Date;
    }>;
    getInventoryMovements(user: AuthenticatedUser, depotId?: string): Promise<{
        id: string;
        createdAt: Date;
        actorId: string | null;
        notes: string | null;
        depotId: string;
        itemSku: string;
        quantity: number;
        movementType: string;
        previousAvailable: number;
        newAvailable: number;
        previousReserved: number;
        newReserved: number;
        referenceId: string | null;
    }[]>;
    acknowledgeSos(user: AuthenticatedUser, sosId: string, notes?: string, ipAddress?: string): Promise<{
        id: string;
        description: string | null;
        latitude: number | null;
        longitude: number | null;
        contactInfo: string | null;
        status: string;
        serviceType: string;
        emergencyType: string | null;
        gpsAccuracy: number | null;
        affectedPeople: number;
        triggeredAt: Date;
        acknowledgedAt: Date | null;
        acknowledgedByStaffId: string | null;
        responderNotes: string | null;
        resolvedAt: Date | null;
    }>;
    updateSosStatus(user: AuthenticatedUser, sosId: string, status: 'RESPONDER_DISPATCHED' | 'RESOLVED', notes?: string, ipAddress?: string): Promise<{
        id: string;
        description: string | null;
        latitude: number | null;
        longitude: number | null;
        contactInfo: string | null;
        status: string;
        serviceType: string;
        emergencyType: string | null;
        gpsAccuracy: number | null;
        affectedPeople: number;
        triggeredAt: Date;
        acknowledgedAt: Date | null;
        acknowledgedByStaffId: string | null;
        responderNotes: string | null;
        resolvedAt: Date | null;
    }>;
    listStaff(user: AuthenticatedUser): Promise<{
        id: string;
        username: string;
        fullName: string;
        phoneNumber: string;
        email: string;
        role: string;
        districtId: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    staffHistory(user: AuthenticatedUser, staffId: string): Promise<{
        id: string;
        action: string;
        entityType: string;
        entityId: string;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        timestamp: Date;
        staffUserId: string | null;
    }[]>;
    createStaff(user: AuthenticatedUser, data: {
        username: string;
        fullName: string;
        email: string;
        phoneNumber: string;
        password: string;
        role: RoleType;
        districtId?: string;
    }, ipAddress?: string): Promise<{
        permissions: import("../auth/rbac.js").PermissionType[];
        id: string;
        username: string;
        fullName: string;
        phoneNumber: string;
        email: string;
        role: string;
        districtId: string | null;
        isActive: boolean;
    }>;
    updateStaff(user: AuthenticatedUser, staffId: string, data: {
        role?: RoleType;
        isActive?: boolean;
        districtId?: string;
    }, ipAddress?: string): Promise<{
        permissions: import("../auth/rbac.js").PermissionType[];
        id: string;
        username: string;
        fullName: string;
        role: string;
        districtId: string | null;
        isActive: boolean;
    }>;
}
export declare const authorityService: AuthorityService;
