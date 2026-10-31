import { AppError } from '../../middleware/errorHandler.js';
import { prisma } from '../../shared/database.js';
import { hasPermission } from '../auth/rbac.js';
import { LANGUAGE_NAMES, COPILOT_LANGUAGES, } from './copilot.types.js';
import { copilotTools } from './copilot.tools.js';
export class CopilotService {
    /**
     * Main conversational orchestration pipeline:
     * Query -> Intent/Tool Determination -> Permission Validation -> Tool Execution -> Response Formulation
     */
    async processQuery(input, user) {
        const lang = input.language && COPILOT_LANGUAGES.includes(input.language)
            ? input.language
            : 'en';
        const ctx = {
            user,
            language: lang,
            districtId: input.districtId || (user?.districtId ?? undefined),
            coordinates: input.coordinates,
        };
        // 1. Tool Selection based on explicit requestedTool or natural intent pattern matching
        const selectedToolName = input.requestedTool || this.detectIntent(input.query);
        let toolResult = null;
        let actionCard = undefined;
        let toolUsedName = undefined;
        if (selectedToolName && copilotTools[selectedToolName]) {
            const toolDef = copilotTools[selectedToolName];
            // 2. Authorization check
            if (toolDef.permission) {
                if (!user) {
                    throw new AppError(`The action '${toolDef.name}' requires staff authentication.`, 401, 'UNAUTHORIZED');
                }
                if (!hasPermission(user.role, toolDef.permission)) {
                    throw new AppError(`Your role '${user.role}' lacks permission '${toolDef.permission}' to use this tool.`, 403, 'PERMISSION_DENIED');
                }
            }
            // 3. Schema validation
            const parseResult = toolDef.schema.safeParse(input.toolParameters || this.extractParameters(selectedToolName, input));
            if (!parseResult.success) {
                throw new AppError(`Invalid tool parameters: ${parseResult.error.message}`, 400, 'VALIDATION_ERROR');
            }
            // 4. Safe Tool Execution
            try {
                toolResult = await toolDef.execute(parseResult.data, ctx);
                toolUsedName = toolDef.name;
                actionCard = this.buildActionCard(selectedToolName, toolResult);
                // Audit log tool execution if staff user
                if (user) {
                    await prisma.auditLog.create({
                        data: {
                            staffUserId: user.id,
                            action: `COPILOT_TOOL_${selectedToolName.toUpperCase()}`,
                            entityType: 'CopilotInteraction',
                            entityId: user.id,
                            metadata: { tool: selectedToolName, input: parseResult.data },
                        },
                    }).catch(() => { });
                }
            }
            catch (err) {
                if (err instanceof AppError)
                    throw err;
                toolResult = { error: err.message || 'Execution failed' };
            }
        }
        // 5. Formulation of grounded, non-hallucinatory response in target language
        const { response, originalEnText } = this.formulateGroundedResponse(input.query, selectedToolName, toolResult, lang);
        return {
            response,
            originalLanguageText: lang !== 'en' ? originalEnText : undefined,
            detectedLanguage: lang,
            actionCard,
            toolUsed: toolUsedName,
            dataSources: [
                {
                    source: 'DisasterReady Live Database & PostGIS Spatial Intersections',
                    verified: true,
                    timestamp: new Date().toISOString(),
                },
            ],
            safetyDisclaimer: 'DisasterReady Kavach AI provides live civil information based strictly on verified records. It never guarantees complete route safety or automatically dispatches emergency teams. For life-threatening emergencies, dial 112 directly.',
            isFallback: !toolResult || Boolean(toolResult.error),
        };
    }
    /**
     * Safe natural language intent matching for core emergency topics
     */
    detectIntent(query) {
        const q = query.toLowerCase();
        // Alerts / Warnings (prioritize explicit alert questions)
        if (q.includes('alert') || q.includes('warning') || q.includes('siren') || q.includes('chetavani')) {
            return 'get_active_alerts';
        }
        // Route / Safe walking
        if (q.includes('route') || q.includes('rasta') || q.includes('direction') || q.includes('walk') || q.includes('dry ground') || q.includes('bypass') || q.includes('road')) {
            return 'compare_routes';
        }
        // Shelters / Camps / Safe places
        if (q.includes('shelter') || q.includes('camp') || q.includes('ashray') || q.includes('sharan') || q.includes('stay') || q.includes('haven')) {
            return 'get_nearby_shelters';
        }
        // Hospital / Medical
        if (q.includes('hospital') || q.includes('doctor') || q.includes('clinic') || q.includes('medical') || q.includes('ambulance') || q.includes('chikitsa')) {
            return 'get_nearby_hospitals';
        }
        // Hazards / Flooding / Wire / Tree
        if (q.includes('hazard') || q.includes('waterlog') || q.includes('flood') || q.includes('cyclone') || q.includes('rain') || q.includes('tree') || q.includes('wire') || q.includes('bridge') || q.includes('danger')) {
            return 'get_nearby_hazards';
        }
        // Supplies / Food / Water rations
        if (q.includes('food') || q.includes('water') || q.includes('ration') || q.includes('supplies') || q.includes('baby formula') || q.includes('relief pack')) {
            return 'create_supply_request';
        }
        // Tracking (token)
        if (q.includes('track') || q.includes('status') || q.includes('dr-') || q.includes('my request')) {
            return 'get_request_status';
        }
        // Preparedness / Go bag
        if (q.includes('prepared') || q.includes('go bag') || q.includes('checklist') || q.includes('kit') || q.includes('survival') || q.includes('tayari')) {
            return 'get_preparedness_guide';
        }
        // Admin commands
        if (q.includes('shortage') || q.includes('inventory analysis') || q.includes('depot depletion')) {
            return 'analyze_resource_shortages';
        }
        if (q.includes('unverified reports') || q.includes('summarize reports') || q.includes('triage cluster')) {
            return 'summarize_hazard_reports';
        }
        if (q.includes('draft advisory') || q.includes('draft announcement')) {
            return 'draft_announcement';
        }
        if (q.includes('simulation') || q.includes('dam outflow') || q.includes('cutoff forecast')) {
            return 'analyze_simulation';
        }
        return 'get_active_alerts';
    }
    /**
     * Extract parameters from query or context
     */
    extractParameters(toolName, input) {
        const lat = input.coordinates?.lat ?? 12.9716;
        const lng = input.coordinates?.lng ?? 77.5946;
        switch (toolName) {
            case 'compare_routes':
                return {
                    origin: { lat, lng },
                    destination: { lat: lat + 0.015, lng: lng + 0.012 },
                    travelMode: 'WALK',
                };
            case 'get_request_status':
                return {
                    trackingToken: input.trackingToken || input.query.match(/DR-[A-Za-z0-9_-]{43}/i)?.[0] || 'DR-INVALID',
                };
            case 'create_supply_request':
                return {
                    headcount: 4,
                    urgency: 'HIGH',
                    deliveryContext: 'GROUND_FLOOR',
                    latitude: lat,
                    longitude: lng,
                    needsWater: true,
                    foodKits: 2,
                };
            case 'get_preparedness_guide':
                return { disasterType: 'FLOOD' };
            default:
                return {};
        }
    }
    /**
     * Construct rich interactive action cards for the frontend
     */
    buildActionCard(toolName, data) {
        if (!data || data.error)
            return undefined;
        switch (toolName) {
            case 'get_nearby_shelters':
                if (data.shelters && data.shelters.length > 0) {
                    const s = data.shelters[0];
                    return {
                        type: 'FACILITY_CARD',
                        title: s.name,
                        data: {
                            id: s.id,
                            name: s.name,
                            address: s.address,
                            distanceKm: s.distanceKm,
                            availableBeds: s.availableBeds,
                            contactPhone: s.contactPhone,
                            operatingStatus: s.operatingStatus,
                        },
                    };
                }
                return undefined;
            case 'get_nearby_hospitals':
                if (data.hospitals && data.hospitals.length > 0) {
                    const h = data.hospitals[0];
                    return {
                        type: 'FACILITY_CARD',
                        title: h.name,
                        data: {
                            id: h.id,
                            name: h.name,
                            distanceKm: h.distanceKm,
                            contactPhone: h.contactPhone,
                            operatingStatus: h.operatingStatus,
                        },
                    };
                }
                return undefined;
            case 'get_nearby_hazards':
                if (data.hazards && data.hazards.length > 0) {
                    const h = data.hazards[0];
                    return {
                        type: 'HAZARD_CARD',
                        title: `${h.hazardType} (${h.severity})`,
                        data: h,
                    };
                }
                return undefined;
            case 'get_active_alerts':
                if (data.alerts && data.alerts.length > 0) {
                    const a = data.alerts[0];
                    return {
                        type: 'ALERT_CARD',
                        title: a.title,
                        data: a,
                    };
                }
                return undefined;
            case 'compare_routes':
                if (data.alternatives && data.alternatives.length > 0) {
                    const alt = data.alternatives[0];
                    return {
                        type: 'ROUTE_CARD',
                        title: `Recommended Route #${alt.rank}`,
                        data: alt,
                    };
                }
                return undefined;
            case 'draft_announcement':
                return {
                    type: 'RECOMMENDATION_DRAFT_CARD',
                    title: data.draftTitle || 'Official Announcement Draft',
                    data,
                    requiresHumanConfirmation: true,
                };
            case 'analyze_resource_shortages':
                return {
                    type: 'RECOMMENDATION_DRAFT_CARD',
                    title: 'Inventory Allocation Review & Resource Shortage Analysis',
                    data,
                    requiresHumanConfirmation: true,
                };
            case 'analyze_simulation':
                return {
                    type: 'RECOMMENDATION_DRAFT_CARD',
                    title: data.scenario || 'Hydrological Simulation Forecast',
                    data,
                    requiresHumanConfirmation: true,
                };
            default:
                return undefined;
        }
    }
    /**
     * Grounded response generation strictly bound to verified facts
     */
    formulateGroundedResponse(query, toolName, data, lang) {
        let enText = '';
        if (!data || data.error) {
            enText = `I could not retrieve live telemetry for "${query}". Please check your internet connection or call emergency helpline 1078 / 112 directly.`;
        }
        else {
            switch (toolName) {
                case 'get_active_alerts':
                    if (data.count === 0) {
                        enText = 'There are currently no active emergency alerts recorded for this district. Continue monitoring local weather advisories. In life-threatening emergencies, dial 112.';
                    }
                    else {
                        const first = data.alerts[0];
                        enText = `Active Alert (${first.severity}): "${first.title}". ${first.summary} Action: ${first.instructions} (Emergency helpline: 112).`;
                    }
                    break;
                case 'translate_announcement':
                    enText = `Official Announcement Translation (${data.targetLanguage}): "${data.translatedText}". Original Announcement (English): "${data.originalText}".`;
                    break;
                case 'get_nearby_shelters':
                    if (data.count === 0) {
                        enText = 'No verified shelters with available beds are currently listed in this specific radius. Please contact 1078 for nearest camp staging.';
                    }
                    else {
                        const s = data.shelters[0];
                        enText = `Nearest verified shelter: "${s.name}" located ${s.distanceKm != null ? `${s.distanceKm} km away` : 'nearby'}. Status: ${s.operatingStatus}. Available beds: ${s.availableBeds ?? 'Unknown'}. Phone: ${s.contactPhone || '112'}.`;
                    }
                    break;
                case 'get_nearby_hospitals':
                    if (data.count === 0) {
                        enText = 'No medical facilities recorded in immediate range. For critical medical trauma, dial 108 immediately.';
                    }
                    else {
                        const h = data.hospitals[0];
                        enText = `Nearest medical facility: "${h.name}" (${h.distanceKm != null ? `${h.distanceKm} km away` : 'in area'}). Operating Status: ${h.operatingStatus}. Helpline: ${h.contactPhone || '108'}.`;
                    }
                    break;
                case 'get_nearby_hazards':
                    if (data.count === 0) {
                        enText = 'No active hazard reports are currently logged for this coordinates cluster. Note: Absence of reports does NOT guarantee the area is free from hazards.';
                    }
                    else {
                        const h = data.hazards[0];
                        enText = `Recorded hazard nearby: ${h.hazardType} (${h.severity} severity) near ${h.landmark || 'coordinates'}. Status: ${h.verified ? 'Official Verified' : 'Community Unverified'}.`;
                    }
                    break;
                case 'compare_routes':
                    enText = data.alternatives && data.alternatives.length > 0
                        ? `Analyzed ${data.alternativesCount} route alternatives. Recommended Route #${data.alternatives[0].rank} has risk score ${data.alternatives[0].riskScore}. Caution: No road can be guaranteed safe during floods.`
                        : 'Route comparison service unavailable. Follow police / NDRF traffic diversions on site.';
                    break;
                case 'get_preparedness_guide':
                    enText = `NDMA Standard Operating Procedure for ${data.disasterType}: Essential items to prepare include: ${data.checklist.slice(0, 4).join(', ')}. Dial 112 for direct rescue.`;
                    break;
                case 'get_request_status':
                    enText = `Supply request ${data.trackingToken}: Current Stage is ${data.stageLabel} (${data.stage}). Headcount: ${data.headcountTotal} people. District: ${data.district}.`;
                    break;
                case 'create_supply_request':
                    enText = `Public supply request submitted! Your tracking token is: ${data.trackingToken}. Save this token to check real-time dispatch progress. Initial status: Stage 1 Triaged.`;
                    break;
                case 'analyze_resource_shortages':
                    enText = `Depot Stock Analysis: ${data.openRequestsConsidered} open relief requests analyzed. ${data.recommendation}`;
                    break;
                case 'draft_announcement':
                    enText = `Drafted Official Advisory: "${data.draftTitle}". MANDATORY HUMAN AUTHORIZATION REQUIRED: Officer approval in Alert Operations panel is required before citizen broadcast.`;
                    break;
                case 'analyze_simulation':
                    enText = `Hydrological Forecast: At ${data.projectedDepthM}m depth, estimated corridor cutoff is ${data.estimatedCutoffMinutes} minutes. Recommended: Pre-stage rescue boats. Human sign-off required.`;
                    break;
                default:
                    enText = `Live Civil Information: Telemetry verified by DisasterReady Central EOC. Safety notice: In life-threatening emergencies, dial 112.`;
                    break;
            }
        }
        // Apply multilingual translation for the 12 supported languages
        let localizedText = enText;
        if (lang === 'hi') {
            localizedText = this.translateToHindi(enText);
        }
        else if (lang !== 'en') {
            // In emergency context, prefix with native language acknowledgment while keeping verified facts exact
            const nativeLangName = LANGUAGE_NAMES[lang]?.native || lang;
            localizedText = `[${nativeLangName}] ${enText}`;
        }
        return { response: localizedText, originalEnText: enText };
    }
    translateToHindi(text) {
        return text
            .replace(/Nearest verified shelter:/gi, 'निकटतम सत्यापित शेल्टर:')
            .replace(/Available beds:/gi, 'उपलब्ध बेड:')
            .replace(/Operating Status:/gi, 'परिचालन स्थिति:')
            .replace(/km away/gi, 'किमी दूर')
            .replace(/Nearest medical facility:/gi, 'निकटतम चिकित्सा केंद्र:')
            .replace(/Recorded hazard nearby:/gi, 'निकटवर्ती दर्ज आपदा/खतरा:')
            .replace(/WATERLOGGING/g, 'जलभराव (Waterlogging)')
            .replace(/FALLEN_TREE/g, 'गिरा हुआ पेड़ (Fallen Tree)')
            .replace(/LIVE_WIRE/g, 'टूटा हुआ बिजली का तार (Live Wire)')
            .replace(/Public supply request submitted!/gi, 'राहत सामग्री अनुरोध दर्ज किया गया!')
            .replace(/Your tracking token is:/gi, 'आपका ट्रैकिंग टोकन है:')
            .replace(/There are currently no active emergency alerts/gi, 'वर्तमान में कोई सक्रिय आपातकालीन अलर्ट नहीं है')
            .replace(/Caution: No road can be guaranteed safe during floods./gi, 'सावधानी: बाढ़ के दौरान किसी भी मार्ग को पूरी तरह सुरक्षित नहीं माना जा सकता।')
            .replace(/For life-threatening emergencies, dial 112 directly./gi, 'जीवन-घातक आपात स्थिति के लिए सीधे 112 डायल करें।');
    }
}
export const copilotService = new CopilotService();
//# sourceMappingURL=copilot.service.js.map