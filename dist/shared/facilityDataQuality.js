import { prisma } from './database.js';
export const FACILITY_TRACKED_FIELDS = [
    'contactPhone',
    'totalCapacity',
    'currentOccupancy',
    'hasMedicalSupport',
    'hasGeneratorPower',
    'hasDrinkingWater',
    'hasInfantCare',
    'isPetFriendly',
];
export async function getFacilityUnknownFields(facilityIds) {
    const result = new Map();
    if (!facilityIds.length)
        return result;
    const logs = await prisma.auditLog.findMany({
        where: { entityType: 'Facility', entityId: { in: facilityIds } },
        select: { entityId: true, action: true, metadata: true, timestamp: true },
        orderBy: { timestamp: 'desc' },
    });
    const decided = new Map();
    const valid = new Set(FACILITY_TRACKED_FIELDS);
    for (const log of logs) {
        const metadata = log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)
            ? log.metadata
            : {};
        const unknown = Array.isArray(metadata.markedUnknown) ? metadata.markedUnknown.filter((field) => typeof field === 'string' && valid.has(field)) : [];
        const changed = Array.isArray(metadata.changedFields) ? metadata.changedFields.filter((field) => typeof field === 'string' && valid.has(field)) : [];
        const handled = decided.get(log.entityId) || new Set();
        const values = result.get(log.entityId) || new Set();
        for (const field of [...unknown, ...changed]) {
            if (handled.has(field))
                continue;
            handled.add(field);
            if (unknown.includes(field))
                values.add(field);
        }
        decided.set(log.entityId, handled);
        result.set(log.entityId, values);
    }
    return result;
}
//# sourceMappingURL=facilityDataQuality.js.map