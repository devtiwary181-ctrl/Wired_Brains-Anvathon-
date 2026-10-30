# DisasterReady India — Security Audit & Hardening Report

**Audit Target:** DisasterReady India Application & API Ecosystem  
**Audit Standard:** OWASP Top 10 API Security Risks (2023) & Indian National Cyber Security Guidelines  
**Status:** 🟢 **ALL CORE CONTROLS ENFORCED AND AUDITED**

---

## 🛡️ Threat Model & Defense Mechanisms

```mermaid
flowchart LR
    A["Public Citizen Request"] -->|Rate Limiter (100 req/15m)| B["Nginx / Helmet HTTP Headers"]
    B -->|XSS & SQLi Sanitizer| C["Input Validation Layer"]
    C -->|Public Access Gate| D["Public Domain Services"]

    E["Authority Staff Request"] -->|Argon2id + 2FA SMS Challenge| F["Session / JWT Guard"]
    F -->|RBAC Permission Engine| G["Protected Authority Services"]
    G -->|Atomic Transaction Lock| H[("PostgreSQL + PostGIS")]

    D --> H
    H -->|Zero PII Exposure| I["Audit Log & Outbox"]
```

---

## 🔐 1. Authentication & Session Security

1. **Password Hashing (Argon2id):**
   - High-cost parameters: `memoryCost: 65536` (64 MB), `timeCost: 3`, `parallelism: 4`.
   - Immune to GPU dictionary attacks and rainbow tables.
2. **Multi-Factor Authentication (2FA OTP):**
   - After valid password verification, a 6-digit numeric OTP is issued to the authority officer's registered mobile device.
   - **Expiry:** Strict 5-minute time-to-live (TTL) enforced via Redis with atomic invalidation.
   - **Replay Defense:** Once verified or after 3 failed attempts, the challenge ID is permanently purged from cache.
3. **Session & Cookie Hardening:**
   - JWT tokens signed with SHA-256 HMAC utilizing a 64-character secret.
   - HTTP Cookies marked `HttpOnly` (inaccessible to JavaScript), `Secure` (HTTPS only in production), and `SameSite=Strict` (defeats CSRF).

---

## 🛑 2. Authorization & RBAC Matrix

Granular permission checking protects all `/authority/*` endpoints. Roles include:
- `SUPER_ADMIN`: Unrestricted platform access and staff creation.
- `DISASTER_COMMANDER`: Alert publishing, hazard verification, simulation runs.
- `RELIEF_COORDINATOR`: Inventory allocation, depot management, supply dispatch.
- `DATA_OPERATOR`: Read-only reporting and spatial incident inspection.

### RBAC Enforcement Table

| Endpoint Action | Required Permission | SUPER_ADMIN | DISASTER_COMMANDER | RELIEF_COORDINATOR | DATA_OPERATOR |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `POST /authority/alerts` | `alerts:publish` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /authority/hazards/:id` | `hazards:verify` | ✅ | ✅ | ❌ | ❌ |
| `POST /authority/inventory/allocate` | `relief:manage` | ✅ | ❌ | ✅ | ❌ |
| `POST /authority/simulations` | `simulations:run` | ✅ | ✅ | ❌ | ❌ |
| `POST /authority/staff` | `users:manage` | ✅ | ❌ | ❌ | ❌ |

---

## 💉 3. Injection & Tampering Defenses

1. **SQL & Spatial Injection:**
   - 100% of standard database queries run via Prisma Client parameterized queries.
   - Raw PostGIS queries (e.g., `ST_DWithin`, `ST_MakePoint`) utilize strictly validated numeric floats (`lat`, `lng`, `radiusKm`) with parameterized SQL inputs.
2. **Cross-Site Scripting (XSS):**
   - Citizen descriptions, hazard titles, and SOS notes pass through input sanitization strips before database insertion.
   - Response headers include `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`.
3. **Insecure Direct Object References (IDOR):**
   - Public relief tracking does not use sequential IDs (`/supplies/123`).
   - Instead, high-entropy cryptographic tokens (`DR-` followed by 12 random hex characters: `DR-3F9A1B2C4D5E`) are generated using Node.js `crypto.randomBytes()`. An attacker cannot enumerate or guess valid tokens.

---

## 🚦 4. Denial of Service & Abuse Prevention

1. **Global API Rate Limiting:**
   - 100 requests per 15 minutes per IP address for standard API routes.
2. **Auth Endpoint Rate Limiting:**
   - Maximum 5 consecutive failed login attempts per IP/account before temporary 15-minute lock.
3. **SOS Anti-Flooding:**
   - Distress beacons require minimum coordinates and are throttled to prevent spam beacon amplification.
4. **File Upload Restrictions:**
   - Hazard image uploads restricted to `image/jpeg`, `image/png`, and `image/webp`.
   - Maximum file size: 5 MB. Files are stored with random UUID filenames.

---

## 📋 5. Audit Logging & Compliance

- Every sensitive authority decision (hazard verification, alert publishing, relief allocation, simulation execution) is recorded in the immutable `AuditLog` table with timestamp, operator ID, IP address, and previous/new state diffs.
- Sensitive credentials, passwords, and raw JWT tokens are never logged to console or persistent files.
