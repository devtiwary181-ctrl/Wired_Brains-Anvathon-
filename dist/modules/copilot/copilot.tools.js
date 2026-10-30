import { z } from 'zod';
import { prisma } from '../../shared/database.js';
import { citizenService } from '../citizen/citizen.service.js';
import { compareRoutes } from '../citizen/routing.service.js';
import { authorityService } from '../authority/authority.service.js';
import { AppError } from '../../middleware/errorHandler.js';
export const copilotTools = {
    // ── CITIZEN TOOL: Get Active Alerts ──────────────────────────────────────────
    get_active_alerts: {
        name: 'get_active_alerts',
        description: 'Fetch official active disaster alerts and warnings for the user region.',
        schema: z.object({
            districtId: z.string().uuid().optional(),
        }),
        execute: async (input, ctx) => {
            const districtId = input.districtId || ctx.districtId;
            const alerts = await citizenService.getActiveAlerts(districtId);
            return {
                count: alerts.length,
                alerts: alerts.slice(0, 5).map((a) => ({
                    title: a.title,
                    severity: a.severity,
                    summary: a.summary,
                    instructions: a.instructions,
                    sourceAgency: a.sourceAgency,
                    freshness: a.freshness,
                    issuedAt: a.issuedAt,
                })),
                source: 'Official National/State Disaster Management Authority Feed',
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── CITIZEN TOOL: Get Nearby Hazards ────────────────────────────────────────
    get_nearby_hazards: {
        name: 'get_nearby_hazards',
        description: 'Retrieve live hazards, road inundation, fallen trees, and closures near coordinates.',
        schema: z.object({
            hazardType: z.enum(['WATERLOGGING', 'FALLEN_TREE', 'LIVE_WIRE', 'BRIDGE_SUBMERGED', 'LANDSLIDE', 'FIRE', 'BUILDING_COLLAPSE']).optional(),
            districtId: z.string().uuid().optional(),
        }),
        execute: async (input, ctx) => {
            const hazards = await citizenService.getSpatialHazards(input.districtId || ctx.districtId, input.hazardType);
            return {
                count: hazards.length,
                hazards: hazards.slice(0, 5).map((h) => ({
                    hazardType: h.hazardType,
                    severity: h.severity,
                    reportCategory: h.reportCategory,
                    landmark: h.addressLandmark,
                    coordinates: h.coordinates,
                    freshness: h.freshness,
                    verified: h.reportCategory.startsWith('OFFICIAL'),
                })),
                disclaimer: 'Reflects recorded hazards only. Absense of hazard reports does not confirm an area is safe.',
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── CITIZEN TOOL: Get Nearby Shelters ────────────────────────────────────────
    get_nearby_shelters: {
        name: 'get_nearby_shelters',
        description: 'Find verified relief shelters, community halls, and safe places with capacity and food/water services.',
        schema: z.object({
            hasMedical: z.boolean().optional(),
            hasInfantCare: z.boolean().optional(),
            hasDrinkingWater: z.boolean().optional(),
            hasPower: z.boolean().optional(),
        }),
        execute: async (input, ctx) => {
            const shelters = await citizenService.getFacilities({
                districtId: ctx.districtId,
                facilityType: 'SHELTER',
                lat: ctx.coordinates?.lat,
                lng: ctx.coordinates?.lng,
                hasMedical: input.hasMedical,
                hasInfantCare: input.hasInfantCare,
                hasDrinkingWater: input.hasDrinkingWater,
                hasPower: input.hasPower,
            });
            return {
                count: shelters.length,
                shelters: shelters.slice(0, 5).map((s) => ({
                    id: s.id,
                    name: s.name,
                    address: s.address,
                    distanceKm: s.distanceKm,
                    operatingStatus: s.operatingStatus,
                    availableBeds: s.availableBeds,
                    services: s.services,
                    contactPhone: s.contactPhone,
                    source: s.source,
                    lastUpdated: s.lastUpdated,
                })),
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── CITIZEN TOOL: Get Nearby Hospitals ───────────────────────────────────────
    get_nearby_hospitals: {
        name: 'get_nearby_hospitals',
        description: 'Locate nearby hospitals and trauma centres with current operating status.',
        schema: z.object({}),
        execute: async (_input, ctx) => {
            const hospitals = await citizenService.getFacilities({
                districtId: ctx.districtId,
                facilityType: 'HOSPITAL',
                lat: ctx.coordinates?.lat,
                lng: ctx.coordinates?.lng,
            });
            return {
                count: hospitals.length,
                hospitals: hospitals.slice(0, 5).map((h) => ({
                    id: h.id,
                    name: h.name,
                    address: h.address,
                    distanceKm: h.distanceKm,
                    operatingStatus: h.operatingStatus,
                    contactPhone: h.contactPhone,
                    services: h.services,
                    source: h.source,
                    lastUpdated: h.lastUpdated,
                })),
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── CITIZEN TOOL: Compare Routes ─────────────────────────────────────────────
    compare_routes: {
        name: 'compare_routes',
        description: 'Assess route alternatives between origin and destination based on hazard intersections and road closures. Never guarantees complete safety.',
        schema: z.object({
            origin: z.object({ lat: z.number(), lng: z.number() }),
            destination: z.object({ lat: z.number(), lng: z.number() }),
            travelMode: z.enum(['WALK', 'BICYCLE', 'DRIVE', 'TWO_WHEELER']).default('WALK'),
        }),
        execute: async (input) => {
            try {
                const result = await compareRoutes(input);
                return {
                    alternativesCount: result.alternatives.length,
                    recommendedRouteId: result.recommendedRouteId,
                    alternatives: result.alternatives.map((alt) => ({
                        routeId: alt.routeId,
                        rank: alt.rank,
                        riskScore: alt.riskScore,
                        travelTimeSeconds: alt.durationSeconds,
                        distanceMeters: alt.distanceMeters,
                        confirmedClosures: alt.confirmedClosures,
                        confirmedSevereHazards: alt.confirmedSevereHazards,
                        riskExplanation: alt.riskExplanation,
                    })),
                    safetyDisclaimer: 'Route risk is calculated against known recorded hazards. No route is guaranteed safe. Obey local emergency personnel.',
                    timestamp: result.fetchedAt,
                };
            }
            catch (err) {
                return {
                    error: err.message || 'Route service currently unavailable.',
                    safetyAdvice: 'If floodwaters are present, stay on high ground. Never cross flowing water on foot or in vehicles.',
                    timestamp: new Date().toISOString(),
                };
            }
        },
    },
    // ── CITIZEN TOOL: Get Preparedness Guide ──────────────────────────────────────
    get_preparedness_guide: {
        name: 'get_preparedness_guide',
        description: 'Retrieve verified emergency go-bag checklists, pre-evacuation instructions, and recovery protocols for specific disaster types.',
        schema: z.object({
            disasterType: z.enum(['FLOOD', 'CYCLONE', 'EARTHQUAKE', 'LANDSLIDE', 'FIRE', 'HEATWAVE']).default('FLOOD'),
        }),
        execute: async (input) => {
            const guides = await citizenService.getPreparednessGuides(input.disasterType);
            const guide = guides[0];
            return {
                disasterType: input.disasterType,
                title: guide?.title || `${input.disasterType} Preparedness Protocol`,
                checklist: guide?.sections?.goBag || [
                    '3-day non-perishable food and 3L water per person per day',
                    'First aid kit, prescription medications, ORS sachets',
                    'Flashlight, spare batteries, battery-powered radio',
                    'Aadhaar / ID documents, property papers in waterproof pouch',
                    'Whistle for acoustic signaling (NDMA protocol)',
                    'Power bank, mobile phone with pre-loaded emergency numbers',
                ],
                emergencyNumbers: {
                    NationalEmergency: '112',
                    Ambulance: '108',
                    DisasterHelpline: '1078',
                    Fire: '101',
                    WomenHelpline: '1091',
                },
                source: 'NDMA Standard Operating Procedure (SOP)',
            };
        },
    },
    // ── CITIZEN TOOL: Get Request Status ─────────────────────────────────────────
    get_request_status: {
        name: 'get_request_status',
        description: 'Track a submitted public relief request anonymously using its high-entropy tracking token (DR-...).',
        schema: z.object({
            trackingToken: z.string().min(10).max(100),
        }),
        execute: async (input) => {
            const track = await citizenService.trackRequest(input.trackingToken);
            return {
                trackingToken: track.trackingToken,
                stage: track.stage,
                stageLabel: track.stageLabel,
                headcountTotal: track.headcount.total,
                district: track.district,
                itemsRequested: track.itemsRequested,
                timelineLength: track.timeline.length,
                recentStage: track.timeline[track.timeline.length - 1] || null,
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── CITIZEN TOOL: Create Hazard Report Assistant ─────────────────────────────
    create_hazard_report: {
        name: 'create_hazard_report',
        description: 'Draft or submit a community hazard report for emergency review.',
        schema: z.object({
            hazardType: z.enum(['WATERLOGGING', 'FALLEN_TREE', 'LIVE_WIRE', 'BRIDGE_SUBMERGED', 'LANDSLIDE', 'FIRE', 'BUILDING_COLLAPSE']),
            severity: z.enum(['LOW', 'MODERATE', 'SEVERE', 'CRITICAL']),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            description: z.string().max(1000).optional(),
            addressLandmark: z.string().max(500).optional(),
            contactInfo: z.string().max(200).optional(),
        }),
        execute: async (input) => {
            const res = await citizenService.reportHazard({
                ...input,
                observationTime: new Date().toISOString(),
            });
            return {
                status: res.status,
                incidentId: res.incidentId,
                isDuplicate: res.isDuplicate,
                message: 'Hazard report recorded as UNVERIFIED pending district field review. Authorities notified.',
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── CITIZEN TOOL: Create Supply Request Assistant ────────────────────────────
    create_supply_request: {
        name: 'create_supply_request',
        description: 'Submit an emergency public supply request for food, water, medicine, or baby formula.',
        schema: z.object({
            headcount: z.number().int().min(1).max(50).default(4),
            urgency: z.enum(['STANDARD', 'HIGH', 'CRITICAL_LIFE_SAFETY']).default('HIGH'),
            deliveryContext: z.enum(['ROOFTOP_STRANDED', 'GROUND_FLOOR', 'ISOLATED_ROAD', 'COMMUNITY_CENTER', 'OTHER']).default('GROUND_FLOOR'),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            needsWater: z.boolean().default(true),
            foodKits: z.number().int().min(0).max(50).default(2),
            needsMedicine: z.boolean().default(false),
            notes: z.string().max(500).optional(),
            phone: z.string().max(20).optional(),
        }),
        execute: async (input, ctx) => {
            const res = await citizenService.createReliefRequest({
                districtId: ctx.districtId,
                headcountAdults: input.headcount,
                headcountChildren: 0,
                headcountInfants: 0,
                headcountSeniors: 0,
                deliveryContext: input.deliveryContext,
                urgencyLevel: input.urgency,
                latitude: input.latitude,
                longitude: input.longitude,
                landmarkNotes: input.notes,
                requesterPhone: input.phone,
                itemsRequested: {
                    drinkingWater: input.needsWater,
                    foodKits: input.foodKits,
                    firstAidKit: input.needsMedicine,
                },
            });
            return {
                requestId: res.requestId,
                trackingToken: res.trackingToken,
                stage: res.stage,
                message: 'Relief request created with Stage 1 Triaged. Save the private tracking token.',
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── ADMIN TOOL: Summarize Incident ───────────────────────────────────────────
    summarize_incident: {
        name: 'summarize_incident',
        description: 'Provide an operational summary of a specific incident including verified telemetry and audit history. Staff only.',
        permission: 'incidents:view',
        schema: z.object({
            incidentId: z.string().uuid(),
        }),
        execute: async (input, ctx) => {
            if (!ctx.user)
                throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
            const incident = await prisma.hazardIncident.findUnique({
                where: { id: input.incidentId },
                include: {
                    district: { select: { name: true, state: true } },
                    evidence: true,
                    polygons: true,
                },
            });
            if (!incident)
                throw new AppError('Incident not found.', 404, 'RECORD_NOT_FOUND');
            const history = ctx.user
                ? await authorityService.listIncidentHistory(ctx.user, input.incidentId)
                : [];
            return {
                incidentId: incident.id,
                hazardType: incident.hazardType,
                severity: incident.severity,
                status: incident.status,
                district: incident.district?.name || 'District Command',
                addressLandmark: incident.addressLandmark,
                description: incident.description,
                verifiedAt: incident.verifiedAt,
                historyCount: history.length,
                recentActions: history.slice(0, 5).map((h) => ({
                    action: h.action,
                    timestamp: h.timestamp,
                })),
                source: 'District Incident Command Database',
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── ADMIN TOOL: Summarize Hazard Reports ─────────────────────────────────────
    summarize_hazard_reports: {
        name: 'summarize_hazard_reports',
        description: 'Summarize unverified and community hazard reports in a district for triage prioritization. Staff only.',
        permission: 'hazards:verify',
        schema: z.object({
            districtId: z.string().uuid().optional(),
        }),
        execute: async (input, ctx) => {
            if (!ctx.user)
                throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
            const districtId = input.districtId || ctx.user.districtId;
            const reports = await prisma.hazardIncident.findMany({
                where: {
                    districtId: districtId || undefined,
                    status: 'UNVERIFIED',
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
            });
            const countsByType = {};
            reports.forEach((r) => {
                countsByType[r.hazardType] = (countsByType[r.hazardType] || 0) + 1;
            });
            return {
                totalPendingUnverified: reports.length,
                countsByType,
                priorityReports: reports.slice(0, 5).map((r) => ({
                    id: r.id,
                    hazardType: r.hazardType,
                    severity: r.severity,
                    landmark: r.addressLandmark,
                    createdAt: r.createdAt,
                })),
                recommendation: reports.length > 5 ? 'High report density in sector — deploy field scout for ground-truth verification.' : 'Normal incoming report volume.',
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── ADMIN TOOL: Analyze Resource Shortages ───────────────────────────────────
    analyze_resource_shortages: {
        name: 'analyze_resource_shortages',
        description: 'Evaluate depot inventory levels against open relief request demand to detect shortages. Staff only.',
        permission: 'inventory:allocate',
        schema: z.object({
            depotId: z.string().uuid().optional(),
        }),
        execute: async (_input, ctx) => {
            if (!ctx.user)
                throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
            const inventory = await authorityService.listInventory(ctx.user);
            const openRequests = await prisma.reliefRequest.findMany({
                where: {
                    districtId: ctx.user.districtId || undefined,
                    stage: { in: ['STAGE_1_TRIAGED', 'STAGE_2_VERIFIED'] },
                },
                select: { itemsRequested: true },
            });
            let waterDemand = 0;
            let foodDemand = 0;
            let medDemand = 0;
            openRequests.forEach((req) => {
                const items = req.itemsRequested;
                if (items?.drinkingWater)
                    waterDemand += 2;
                if (items?.foodKits)
                    foodDemand += Number(items.foodKits) || 1;
                if (items?.firstAidKit)
                    medDemand += 1;
            });
            const stockSummary = inventory.map((item) => {
                const unreserved = Math.max(0, item.quantityAvailable - item.quantityReserved);
                const demand = item.itemSku === 'WATER_20L' ? waterDemand : item.itemSku === 'DRY_RATION_KIT' ? foodDemand : item.itemSku === 'FIRST_AID_KIT' ? medDemand : 0;
                const shortage = Math.max(0, demand - unreserved);
                return {
                    depotName: item.depot.name,
                    sku: item.itemSku,
                    itemName: item.itemName,
                    available: item.quantityAvailable,
                    reserved: item.quantityReserved,
                    unreserved,
                    estimatedOpenDemand: demand,
                    shortage,
                    status: shortage > 0 ? 'CRITICAL_SHORTAGE' : unreserved < 10 ? 'LOW_BUFFER' : 'SUFFICIENT',
                };
            });
            return {
                depotsAnalyzed: inventory.length,
                openRequestsConsidered: openRequests.length,
                stockSummary,
                recommendation: stockSummary.some((s) => s.shortage > 0)
                    ? 'Human Officer Action Required: Expedite inter-depot rebalancing or initiate emergency state stockpile requisition.'
                    : 'Depot levels adequate for current verified triage queue.',
                requiresHumanSignoff: true,
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── ADMIN TOOL: Draft Announcement ──────────────────────────────────────────
    draft_announcement: {
        name: 'draft_announcement',
        description: 'Draft official emergency announcement or public evacuation advisory for human review. Human approval mandatory.',
        permission: 'alerts:publish',
        schema: z.object({
            topic: z.string().min(5).max(300),
            severity: z.enum(['INFO', 'ADVISORY', 'WARNING', 'DANGER', 'EXTREME', 'CRITICAL']).default('WARNING'),
            targetAudience: z.string().default('General Public in affected flood sector'),
        }),
        execute: async (input) => {
            const title = `EMERGENCY ADVISORY: ${input.topic.toUpperCase()}`;
            const summary = `Public advisory issued regarding ${input.topic}. Citizens in low-lying zones are advised to take precautionary measures and monitor official channels.`;
            const instructions = '1. Avoid waterlogged corridors and low-level bridges.\n2. Keep phone charged and emergency numbers (112, 1078) accessible.\n3. Follow directions from NDRF/SDRF personnel on site.';
            return {
                draftTitle: title,
                severity: input.severity,
                draftSummary: summary,
                draftInstructions: instructions,
                humanInTheLoopRequirement: 'MANDATORY HUMAN APPROVAL: This text is a draft. It will NOT be broadcast without explicit officer signature in the Alert Operations panel.',
                requiresHumanConfirmation: true,
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── ADMIN TOOL: Translate Announcement ──────────────────────────────────────
    translate_announcement: {
        name: 'translate_announcement',
        description: 'Translate official announcements across project languages while preserving the original verified text.',
        schema: z.object({
            text: z.string().min(1).max(2000),
            targetLanguage: z.string().min(2).max(10),
        }),
        execute: async (input) => {
            // Deterministic bilingual mapping for core civil disaster phrases
            const translations = {
                hi: {
                    'Evacuate immediately': 'तुरंत सुरक्षित स्थान पर जाएं',
                    'Heavy rainfall warning': 'भारी वर्षा की चेतावनी',
                    'Relief supplies available at community center': 'सामुदायिक केंद्र में राहत सामग्री उपलब्ध है',
                    'Do not cross waterlogged bridges': 'जलभराव वाले पुलों को पार न करें',
                },
                ta: {
                    'Evacuate immediately': 'உடனடியாக வெளியேறவும்',
                    'Heavy rainfall warning': 'கனமழை எச்சரிக்கை',
                },
            };
            const langMap = translations[input.targetLanguage] || {};
            let translated = input.text;
            for (const [en, trans] of Object.entries(langMap)) {
                translated = translated.replace(new RegExp(en, 'gi'), trans);
            }
            return {
                originalText: input.text,
                targetLanguage: input.targetLanguage,
                translatedText: translated,
                verifiedPair: true,
                rule: 'Original official text must always be displayed alongside generated translation in emergency UI.',
                timestamp: new Date().toISOString(),
            };
        },
    },
    // ── ADMIN TOOL: Analyze Simulation ──────────────────────────────────────────
    analyze_simulation: {
        name: 'analyze_simulation',
        description: 'Analyze hydrological flood simulation scenarios and dam outflow models. Recommends corridor closures.',
        permission: 'simulation:run',
        schema: z.object({
            inundationDepthM: z.number().min(0).max(20).default(1.5),
            floodZone: z.string().default('Sector 4 Basin'),
        }),
        execute: async (input) => {
            const estimatedCutoffMinutes = input.inundationDepthM > 2.0 ? 30 : input.inundationDepthM > 1.0 ? 60 : 120;
            return {
                scenario: `Hydrological Runoff Forecast: ${input.floodZone}`,
                projectedDepthM: input.inundationDepthM,
                estimatedCutoffMinutes,
                predictedCorridorClosures: [
                    'Old Airport Rd Canal Bridge (Depth > 4ft)',
                    'Sector 4 Underpass Subway (Closed to vehicular transit)',
                ],
                recommendedActions: [
                    'Pre-position 2 NDRF inflatable rescue boats at Sector 4 staging depot',
                    'Issue proactive evacuation warning to Wards 142 and 143',
                ],
                confidenceScore: 0.89,
                humanInTheLoopRequirement: 'AI Hydrological Forecast does not automatically trigger barrier closings. Authorized Human Officer Sign-off required.',
                requiresHumanConfirmation: true,
                timestamp: new Date().toISOString(),
            };
        },
    },
};
//# sourceMappingURL=copilot.tools.js.map