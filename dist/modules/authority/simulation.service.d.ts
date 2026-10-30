import { AuthenticatedUser } from '../auth/auth.middleware.js';
export type DisasterSimulationType = 'FLOOD' | 'EARTHQUAKE' | 'CYCLONE' | 'LANDSLIDE' | 'WILDFIRE';
export type SimulationSeverity = 'MODERATE' | 'SEVERE' | 'CATASTROPHIC';
export interface SimulationInput {
    name: string;
    disasterType: DisasterSimulationType;
    districtId?: string;
    affectedAreaNames: string[];
    severity: SimulationSeverity;
    scenarioParameters: {
        rainfallMmPerHour?: number;
        damReleaseCusecs?: number;
        windSpeedKmph?: number;
        richterMagnitude?: number;
        soilSaturationPct?: number;
        slopeInclineDeg?: number;
        fireSpreadRateKmph?: number;
        blockedCorridors?: string[];
        inducedStockDeficitLiters?: number;
        targetDepotName?: string;
    };
}
export interface SimulationResult {
    simulationId: string;
    name: string;
    disasterType: DisasterSimulationType;
    severity: SimulationSeverity;
    isSimulated: true;
    safetyNotice: string;
    parameters: Record<string, unknown>;
    estimatedImpact: {
        affectedPopulation: number;
        vulnerableIndividuals: {
            infants: number;
            elderly: number;
            bedridden: number;
        };
        predictedInundatedKm2: number;
        blockedTransitCorridors: Array<{
            corridorName: string;
            alternateRoute: string;
            additionalTransitMinutes: number;
            status: 'BLOCKED_SIMULATED';
        }>;
    };
    resourceRequirements: {
        potableWaterLiters: number;
        readyMealsPacks: number;
        firstAidKits: number;
        emergencyShelterBedsNeeded: number;
        availableDepotBufferLiters: number;
        netWaterDeficitLiters: number;
        recommendedInterDepotTransfers: Array<{
            sourceDepot: string;
            destinationDepot: string;
            transferQuantityLiters: number;
        }>;
    };
    summaryNarrative: string;
    createdAt: string;
}
export declare class SimulationService {
    /**
     * Run a completely isolated, rule-based crisis scenario simulation.
     * STRICT SAFETY GUARANTEE: Never modifies live incidents, alerts, or dispatches actual resources.
     */
    runSimulation(user: AuthenticatedUser, input: SimulationInput): Promise<SimulationResult>;
    listSimulations(): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        rainfallMmPerHour: number;
        damReleaseCusecs: number;
        windSpeedKmph: number;
        predictedFloodedKm: number;
        affectedRoadIds: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
}
export declare const simulationService: SimulationService;
