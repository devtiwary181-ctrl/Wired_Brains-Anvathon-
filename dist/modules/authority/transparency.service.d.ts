export interface AnalyticsSummary {
    calculatedAt: string;
    isRealDatabaseCalculated: true;
    isDemoData: false;
    incidents: {
        total: number;
        verifiedActive: number;
        unverified: number;
        resolved: number;
        bySeverity: Record<string, number>;
        byHazardType: Record<string, number>;
    };
    reports: {
        totalUserReports: number;
        verificationRatePct: number;
    };
    reliefRequests: {
        total: number;
        byStage: Record<string, number>;
        deliveryFulfillmentRatePct: number;
        totalHeadcountAffected: number;
    };
    inventory: {
        totalDepots: number;
        depotsOperational: number;
        stockLevels: Array<{
            depotName: string;
            itemSku: string;
            itemName: string;
            quantityAvailable: number;
            quantityReserved: number;
            unit: string;
        }>;
    };
    facilities: {
        totalShelters: number;
        totalCapacity: number;
        currentOccupancy: number;
        occupancyRatePct: number;
        totalHospitals: number;
    };
    responseTimeline: {
        averageResolutionMinutes: number;
        activeAuditEventsCount: number;
    };
}
export interface TransparencyPortalData {
    portalStatus: 'ONLINE_SECURE';
    generatedAt: string;
    zeroPiiEnforced: true;
    officialDataSources: Array<{
        agency: string;
        description: string;
        telemetryProtocol: string;
        freshness: string;
    }>;
    civicMetrics: {
        totalReliefBeneficiaries: number;
        deliveryVerificationRatePct: number;
        operationalFacilitiesCount: number;
        activeReliefCorridorsCount: number;
    };
    immutableAuditLedger: Array<{
        blockIndex: string;
        transactionType: string;
        timestamp: string;
        cryptographicHashSeal: string;
        actionSummary: string;
        status: 'CONFIRMED_LIVE' | 'SIMULATION_ONLY';
    }>;
    areaWiseReliefLedger: Array<{
        areaName: string;
        totalRequests: number;
        fulfilled: number;
        partlyFulfilled: number;
        unmetPending: number;
        fulfillmentRatePct: number;
    }>;
}
export declare class TransparencyService {
    /**
     * Calculate live analytics derived strictly from production database records.
     */
    getAnalytics(districtId?: string): Promise<AnalyticsSummary>;
    /**
     * Provide publicly verifiable transparency data with zero citizen PII.
     */
    getTransparencyPortalData(districtId?: string): Promise<TransparencyPortalData>;
    /**
     * Log an immutable cryptographic seal into the transparency ledger.
     */
    appendLedgerEntry(transactionType: string, details: Record<string, unknown>, districtId?: string): Promise<{
        id: string;
        districtId: string | null;
        timestamp: Date;
        blockIndex: bigint;
        transactionType: string;
        details: import("@prisma/client/runtime/library").JsonValue;
        previousBlockHash: string;
        currentBlockHash: string;
    }>;
}
export declare const transparencyService: TransparencyService;
