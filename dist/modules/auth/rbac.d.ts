export declare const ROLES: {
    readonly SUPER_ADMIN: "SUPER_ADMIN";
    readonly EOC_DIRECTOR: "EOC_DIRECTOR";
    readonly LOGISTICS_OFFICER: "LOGISTICS_OFFICER";
    readonly FIELD_COMMANDER: "FIELD_COMMANDER";
    readonly DATA_OPERATOR: "DATA_OPERATOR";
};
export type RoleType = (typeof ROLES)[keyof typeof ROLES];
export declare const PERMISSIONS: {
    readonly INCIDENTS_VIEW: "incidents:view";
    readonly INCIDENTS_CREATE: "incidents:create";
    readonly HAZARDS_VERIFY: "hazards:verify";
    readonly HAZARDS_UPDATE: "hazards:update";
    readonly ALERTS_PUBLISH: "alerts:publish";
    readonly ANNOUNCEMENTS_MANAGE: "announcements:manage";
    readonly FACILITIES_VIEW: "facilities:view";
    readonly FACILITIES_MANAGE: "facilities:manage";
    readonly RELIEF_TRIAGE: "relief:triage";
    readonly INVENTORY_ALLOCATE: "inventory:allocate";
    readonly INVENTORY_RESTOCK: "inventory:restock";
    readonly SOS_VIEW: "sos:view";
    readonly DISPATCH_VEHICLE: "dispatch:vehicle";
    readonly STAFF_MANAGE: "staff:manage";
    readonly SIMULATION_RUN: "simulation:run";
    readonly AUDIT_LOG_VIEW: "audit:view";
};
export type PermissionType = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export declare const ROLE_PERMISSIONS: Record<RoleType, PermissionType[]>;
