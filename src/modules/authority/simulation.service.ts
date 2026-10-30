import { prisma } from '../../shared/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { AuthenticatedUser } from '../auth/auth.middleware.js';
import { PERMISSIONS } from '../auth/rbac.js';

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

export class SimulationService {
  /**
   * Run a completely isolated, rule-based crisis scenario simulation.
   * STRICT SAFETY GUARANTEE: Never modifies live incidents, alerts, or dispatches actual resources.
   */
  async runSimulation(user: AuthenticatedUser, input: SimulationInput): Promise<SimulationResult> {
    const params = input.scenarioParameters || {};
    const severityFactor =
      input.severity === 'CATASTROPHIC' ? 3.0 : input.severity === 'SEVERE' ? 2.0 : 1.2;

    const basePopPerArea = 1200;
    const areasCount = Math.max(1, input.affectedAreaNames.length);
    const affectedPopulation = Math.round(basePopPerArea * areasCount * severityFactor);

    // Rule-based vulnerable sub-demographic calculation
    const infants = Math.round(affectedPopulation * 0.04);
    const elderly = Math.round(affectedPopulation * 0.08);
    const bedridden = Math.round(affectedPopulation * 0.015);

    // Rule-based inundation / affected km2 calculation
    let predictedKm2 = 0;
    if (input.disasterType === 'FLOOD') {
      const rain = params.rainfallMmPerHour || 85;
      const dam = params.damReleaseCusecs || 25000;
      predictedKm2 = parseFloat(((rain * 0.15 + dam * 0.0004) * (severityFactor / 1.5)).toFixed(2));
    } else if (input.disasterType === 'CYCLONE') {
      const wind = params.windSpeedKmph || 120;
      predictedKm2 = parseFloat((wind * 0.25 * severityFactor).toFixed(2));
    } else if (input.disasterType === 'EARTHQUAKE') {
      const mag = params.richterMagnitude || 6.5;
      predictedKm2 = parseFloat((Math.pow(1.8, mag) * 0.5 * severityFactor).toFixed(2));
    } else if (input.disasterType === 'LANDSLIDE') {
      predictedKm2 = parseFloat((areasCount * 4.2 * severityFactor).toFixed(2));
    } else if (input.disasterType === 'WILDFIRE') {
      const spread = params.fireSpreadRateKmph || 18;
      predictedKm2 = parseFloat((spread * 1.5 * severityFactor).toFixed(2));
    }

    // Corridors & Rerouting
    const defaultCorridors = ['Route 4 - Bellandur Causeway Bypass (Ch. 14+200)'];
    const chosenCorridors = (params.blockedCorridors && params.blockedCorridors.length > 0)
      ? params.blockedCorridors
      : defaultCorridors;

    const blockedTransitCorridors = chosenCorridors.map((c) => ({
      corridorName: c,
      alternateRoute: 'North Perimeter Feeder Road via Outer Sector Link',
      additionalTransitMinutes: Math.round(25 * severityFactor),
      status: 'BLOCKED_SIMULATED' as const,
    }));

    // Resource Requirements calculation (NDMA standard: 3L water/person/day + 2 ration packs/day)
    const potableWaterLiters = Math.round(affectedPopulation * 3.5);
    const readyMealsPacks = Math.round(affectedPopulation * 2);
    const firstAidKits = Math.round(affectedPopulation * 0.08);
    const emergencyShelterBedsNeeded = Math.round(affectedPopulation * 0.35);

    // Simulated depot deficit
    const inducedDeficit = params.inducedStockDeficitLiters || 4000;
    const baseBuffer = 12000;
    const availableDepotBufferLiters = Math.max(0, baseBuffer - inducedDeficit);
    const netWaterDeficitLiters = Math.max(0, potableWaterLiters - availableDepotBufferLiters);

    const recommendedInterDepotTransfers = [
      {
        sourceDepot: 'Depot C - Yelahanka Railhead Regional Hub',
        destinationDepot: params.targetDepotName || 'Depot A - Domlur Central',
        transferQuantityLiters: Math.min(6000, netWaterDeficitLiters > 0 ? netWaterDeficitLiters + 1000 : 3500),
      },
    ];

    const narrative = `[SIMULATION ONLY — NOT LIVE DISASTER DATA] In scenario "${input.name}" (${input.disasterType} - ${input.severity}), estimated ${affectedPopulation.toLocaleString('en-IN')} citizens across ${input.affectedAreaNames.join(', ')} require emergency logistics. ${blockedTransitCorridors.length} corridor(s) blocked with average +${blockedTransitCorridors[0]?.additionalTransitMinutes || 30} mins detour. Water demand is ${potableWaterLiters.toLocaleString('en-IN')}L; transfer of ${recommendedInterDepotTransfers[0].transferQuantityLiters.toLocaleString('en-IN')}L water from ${recommendedInterDepotTransfers[0].sourceDepot} recommended.`;

    // Persist scenario to simulation_scenarios table
    const scenarioRecord = await prisma.simulationScenario.create({
      data: {
        name: `[SIMULATION] ${input.name}`,
        rainfallMmPerHour: params.rainfallMmPerHour || 0,
        damReleaseCusecs: params.damReleaseCusecs || 0,
        windSpeedKmph: params.windSpeedKmph || 0,
        predictedFloodedKm: predictedKm2,
        affectedRoadIds: blockedTransitCorridors.map((b) => b.corridorName),
      },
    });

    return {
      simulationId: scenarioRecord.id,
      name: input.name,
      disasterType: input.disasterType,
      severity: input.severity,
      isSimulated: true,
      safetyNotice: 'NON-DESTRUCTIVE SIMULATION WORKSPACE: All outputs are synthetic rule-based projections. Live disaster dispatches and alerts remain unmodified.',
      parameters: {
        ...params,
        affectedAreaNames: input.affectedAreaNames,
      },
      estimatedImpact: {
        affectedPopulation,
        vulnerableIndividuals: { infants, elderly, bedridden },
        predictedInundatedKm2: predictedKm2,
        blockedTransitCorridors,
      },
      resourceRequirements: {
        potableWaterLiters,
        readyMealsPacks,
        firstAidKits,
        emergencyShelterBedsNeeded,
        availableDepotBufferLiters,
        netWaterDeficitLiters,
        recommendedInterDepotTransfers,
      },
      summaryNarrative: narrative,
      createdAt: scenarioRecord.createdAt.toISOString(),
    };
  }

  async listSimulations() {
    return prisma.simulationScenario.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

export const simulationService = new SimulationService();
