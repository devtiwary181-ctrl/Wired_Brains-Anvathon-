export declare const FACILITY_TRACKED_FIELDS: readonly ["contactPhone", "totalCapacity", "currentOccupancy", "hasMedicalSupport", "hasGeneratorPower", "hasDrinkingWater", "hasInfantCare", "isPetFriendly"];
export type FacilityTrackedField = (typeof FACILITY_TRACKED_FIELDS)[number];
export declare function getFacilityUnknownFields(facilityIds: string[]): Promise<Map<string, Set<"contactPhone" | "totalCapacity" | "currentOccupancy" | "hasMedicalSupport" | "hasGeneratorPower" | "hasDrinkingWater" | "hasInfantCare" | "isPetFriendly">>>;
