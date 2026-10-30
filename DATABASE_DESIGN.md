    tracking_token VARCHAR(64) UNIQUE NOT NULL, -- Opaque 256-bit random bearer token; never a sequential identifier
# DisasterReady India — Database Design & Data Model

## 1. Relational Schema & PostGIS Extensions

The database utilizes **PostgreSQL 16** with the **PostGIS 3.4** extension enabled for native geospatial computations (points, linestrings, polygons, distance calculations, and containment testing).

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
```

---

## 2. Table Schemas, Constraints & Indexes

### A. Geospatial Boundaries & Districts
```sql
CREATE TABLE districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(32) UNIQUE NOT NULL, -- e.g., 'IN-DL-CENTRAL'
    name VARCHAR(128) NOT NULL,
    state VARCHAR(128) NOT NULL,
    boundary GEOMETRY(MultiPolygon, 4326),
    eoc_phone VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_districts_boundary ON districts USING GIST (boundary);
```

### B. Hazards & Emergency Alerts
```sql
CREATE TABLE disaster_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID REFERENCES districts(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(32) NOT NULL, -- 'INFO', 'ADVISORY', 'WARNING', 'DANGER', 'EXTREME'
    disaster_type VARCHAR(64) NOT NULL, -- 'FLOOD', 'CYCLONE', 'EARTHQUAKE', 'LANDSLIDE', 'FIRE'
    summary TEXT NOT NULL,
    instructions TEXT NOT NULL,
    source_agency VARCHAR(128) DEFAULT 'NDMA / IMD Feed',
    is_active BOOLEAN DEFAULT TRUE,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_alerts_active_district ON disaster_alerts(district_id, is_active);

CREATE TABLE hazard_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
    hazard_type VARCHAR(64) NOT NULL, -- 'WATERLOGGING', 'FALLEN_TREE', 'LIVE_WIRE', 'BRIDGE_SUBMERGED', 'LANDSLIDE'
    severity VARCHAR(32) NOT NULL, -- 'LOW', 'MODERATE', 'SEVERE', 'CRITICAL'
    location GEOMETRY(Point, 4326) NOT NULL,
    address_landmark VARCHAR(255),
    water_depth_cm INTEGER DEFAULT 0,
    status VARCHAR(32) DEFAULT 'UNVERIFIED', -- 'UNVERIFIED', 'VERIFIED_ACTIVE', 'RESOLVED', 'REJECTED'
    reported_by_citizen BOOLEAN DEFAULT TRUE,
    verified_by_staff_id UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_hazard_incidents_location ON hazard_incidents USING GIST (location);
CREATE INDEX idx_hazard_incidents_status ON hazard_incidents(status);

CREATE TABLE hazard_polygons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID REFERENCES hazard_incidents(id) ON DELETE CASCADE,
    zone_type VARCHAR(64) NOT NULL, -- 'INUNDATION_ZONE', 'EVACUATION_CORRIDOR_CLOSED', 'DEBRIS_FIELD'
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    depth_m NUMERIC(4, 2) DEFAULT 0.0,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_hazard_polygons_geom ON hazard_polygons USING GIST (geometry);
```

### C. Safe Places (Shelters & Hospitals)
```sql
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID REFERENCES districts(id) ON DELETE CASCADE,
    facility_type VARCHAR(32) NOT NULL, -- 'SHELTER', 'HOSPITAL', 'FOOD_WATER_POINT', 'COMMUNITY_KITCHEN'
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    contact_phone VARCHAR(32) NOT NULL,
    in_charge_name VARCHAR(128),
    total_capacity INTEGER NOT NULL DEFAULT 100,
    current_occupancy INTEGER NOT NULL DEFAULT 0,
    is_verified BOOLEAN DEFAULT TRUE,
    has_medical_support BOOLEAN DEFAULT FALSE,
    has_generator_power BOOLEAN DEFAULT TRUE,
    has_drinking_water BOOLEAN DEFAULT TRUE,
    has_infant_care BOOLEAN DEFAULT FALSE,
    is_pet_friendly BOOLEAN DEFAULT FALSE,
    operating_status VARCHAR(32) DEFAULT 'OPERATIONAL', -- 'OPERATIONAL', 'FILLING_UP', 'FULL', 'DAMAGED_CLOSED'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_facilities_location ON facilities USING GIST (location);
CREATE INDEX idx_facilities_type_status ON facilities(facility_type, operating_status);
```

### D. Emergency Relief Requests & High-Entropy Tracking
```sql
CREATE TABLE relief_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_token VARCHAR(64) UNIQUE NOT NULL, -- Cryptographically secure high-entropy token: e.g. 'RELIEF-IN-8492-XQ7'
    district_id UUID REFERENCES districts(id) ON DELETE CASCADE,
    requester_phone VARCHAR(32), -- Optional for SMS updates, never used for login
    headcount_adults INTEGER DEFAULT 1,
    headcount_children INTEGER DEFAULT 0,
    headcount_infants INTEGER DEFAULT 0,
    headcount_seniors INTEGER DEFAULT 0,
    delivery_context VARCHAR(64) NOT NULL, -- 'ROOFTOP_STRANDED', 'GROUND_FLOOR', 'ISOLATED_ROAD', 'COMMUNITY_CENTER'
    urgency_level VARCHAR(32) NOT NULL, -- 'STANDARD', 'HIGH', 'CRITICAL_LIFE_SAFETY'
    location GEOMETRY(Point, 4326) NOT NULL,
    landmark_notes TEXT,
    items_requested JSONB NOT NULL, -- {"drinking_water": true, "food_kits": 4, "baby_milk": true, "insulin": false}
    special_medical_needs TEXT,
    
    -- Multi-Stage Triage State Machine
    stage VARCHAR(32) DEFAULT 'STAGE_1_TRIAGED', 
    -- 'STAGE_1_TRIAGED', 'STAGE_2_VERIFIED', 'STAGE_3_ALLOCATED', 'STAGE_4_IN_TRANSIT', 'STAGE_5_DELIVERED', 'CANCELLED'
    
    assigned_depot_id UUID,
    assigned_responder_id UUID,
    eta_minutes INTEGER,
    delivery_proof_photo_url TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_relief_requests_token ON relief_requests(tracking_token);
CREATE INDEX idx_relief_requests_stage ON relief_requests(stage);
CREATE INDEX idx_relief_requests_location ON relief_requests USING GIST (location);

CREATE TABLE request_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES relief_requests(id) ON DELETE CASCADE,
    previous_stage VARCHAR(32),
    new_stage VARCHAR(32) NOT NULL,
    actor_type VARCHAR(32) NOT NULL, -- 'CITIZEN', 'STAFF_OFFICER', 'SYSTEM_DISPATCHER'
    actor_id UUID,
    notes TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### E. Inventory Depots & Resource Allocation
```sql
CREATE TABLE relief_depots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID REFERENCES districts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    contact_phone VARCHAR(32) NOT NULL,
    is_operational BOOLEAN DEFAULT TRUE
);

CREATE TABLE depot_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    depot_id UUID REFERENCES relief_depots(id) ON DELETE CASCADE,
    item_sku VARCHAR(64) NOT NULL, -- 'WATER_20L', 'DRY_RATION_KIT', 'BABY_FORMULA', 'FIRST_AID_KIT', 'TARPAULIN'
    item_name VARCHAR(128) NOT NULL,
    quantity_available INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    unit VARCHAR(32) NOT NULL, -- 'liters', 'kits', 'packs'
    last_restocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_depot_item UNIQUE (depot_id, item_sku)
);
```

### F. Staff Authentication, 2FA & Roles
```sql
CREATE TABLE staff_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(64) UNIQUE NOT NULL, -- Government Employee ID or authorized handle
    full_name VARCHAR(128) NOT NULL,
    phone_number VARCHAR(32) NOT NULL, -- Destination for SMS OTP
    email VARCHAR(128) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Argon2id hashed
    role VARCHAR(32) NOT NULL, -- 'EOC_DIRECTOR', 'LOGISTICS_OFFICER', 'FIELD_COMMANDER', 'DATA_OPERATOR'
    district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff_otp_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_user_id UUID REFERENCES staff_users(id) ON DELETE CASCADE,
    otp_hash VARCHAR(255) NOT NULL, -- Hashed 6-digit OTP
    attempt_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- 5-minute validity window
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_staff_otp_lookup ON staff_otp_challenges(staff_user_id, is_used, expires_at);
```

### G. Public Transparency Ledger
```sql
CREATE TABLE transparency_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_index BIGSERIAL UNIQUE NOT NULL,
    transaction_type VARCHAR(64) NOT NULL, -- 'RELIEF_DELIVERED', 'DEPOT_DISPATCH', 'DONATION_RECEIVED'
    district_id UUID REFERENCES districts(id),
    details JSONB NOT NULL,
    previous_block_hash VARCHAR(64) NOT NULL,
    current_block_hash VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ledger_block ON transparency_ledger(block_index);
```
