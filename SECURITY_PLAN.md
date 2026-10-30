# DisasterReady India — Security & Compliance Plan

## 1. Zero-Trust Architecture Principles

1. **Strict Partitioning Between Citizen & Authority Operations:**
   - Public citizen endpoints are completely decoupled from administrative endpoints.
   - Admin routes are gated behind custom middleware that checks valid signed sessions and verifies IP/user-agent consistency.
2. **Citizen Anonymity & Dignity First:**
   - Under catastrophic conditions, citizens must never face biometric, Aadhaar, password, or OTP barriers to find shelter, report danger, or request drinking water.
   - Request tracking relies on cryptographically generated high-entropy random identifiers (`e.g., RELIEF-IN-8492-XQ7` generated via `crypto.randomBytes(16)`). This prevents sequential ID enumeration attacks.

---

## 2. Staff Authentication & 2FA Protocol

### The Strict 7-Step Admin Flow:
1. **Step 1 (Credential Validation):**
   - Staff user enters `username` (Government Employee ID) and `password`.
   - Passwords are verified using **Argon2id** (memory-hard, resistant to GPU brute-force).
   - If valid, account status (`is_active`) and assigned district are checked.
2. **Step 2 (OTP Generation & SMS Dispatch):**
   - System generates a secure 6-digit numeric OTP via `crypto.randomInt(100000, 999999)`.
   - The OTP is hashed with a per-challenge salt and saved in `staff_otp_challenges` (or Redis) with a strict **5-minute TTL** (`expires_at = now + 300s`).
   - The OTP is dispatched to the staff user's pre-registered emergency mobile number via the Indian DLT SMS Gateway.
   - The API returns a temporary `challengeId` and masked phone number (e.g., `+91 98*** **412`).
3. **Step 3 (OTP Verification & Session Issuance):**
   - Staff user enters the 6-digit OTP into the UI.
   - Rate limiting: Maximum **3 failed OTP attempts** allowed per challenge. Exceeding 3 invalid attempts immediately revokes the challenge.
   - Upon successful verification, the challenge is marked `is_used = TRUE`.
   - A signed JWT session is issued inside an `HttpOnly`, `SameSite=Strict`, `Secure` cookie.
   - Passwords and raw tokens are **never** stored in browser `localStorage`, `sessionStorage`, or plain JavaScript memory.

---

## 3. Public API Protection & Anti-Spam Defenses

1. **Tiered Rate Limiting (Redis Token Bucket):**
   - General public reads (`/alerts`, `/facilities`): 120 requests / minute / IP.
   - Citizen Hazard Reporting (`POST /hazards/report`): 5 requests / 10 minutes / IP.
   - Supplies Requisition (`POST /relief-requests`): 3 requests / 15 minutes / IP.
   - Copilot Chat Gateway (`POST /copilot/chat`): 30 requests / minute / IP.
2. **Honeypot Fields & Nonce Validation:**
   - Requisition and hazard report forms include an invisible honeypot field (`website_source_ref`). Automated bots filling this field are silently rejected.
3. **Input Sanitization & Injection Prevention:**
   - All string inputs are strictly sanitized via `DOMPurify` / `validator.js` to eliminate Cross-Site Scripting (XSS).
   - All database interactions use parameterized queries via **Prisma ORM**; zero raw SQL concatenation.
   - PostGIS geometry constructors use validated coordinate float pairs (`lat: [-90, 90]`, `lng: [-180, 180]`).

---

## 4. Role-Based Access Control (RBAC) Matrix

| User Role | View Telemetry | Triage Requests | Allocate Depot Stock | Dispatch Responders | Broadcast Public Alerts | Run Simulations |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **EOC Director** | Yes | Yes | Yes | Yes | Yes | Yes |
| **Logistics Officer** | Yes | Yes | Yes | Yes | No | No |
| **Field Commander** | Yes | View Only | View Only | Update Status | No | No |
| **Data Operator** | Yes | Review Only | No | No | No | No |
| **Citizen (Public)** | View Public Only | Track Own Only | No | No | View Only | No |

---

## 5. Data Privacy & Audit Trail

- **Data Minimization:** Citizen relief requests only record information essential for life-safety dispatch (headcounts, delivery location, stranded context). Sensitive personal data is purged 30 days after disaster de-escalation.
- **Immutable Transparency Ledger:** All verified supply disbursements, donor rations, and dispatched assets are recorded in the `transparency_ledger` using cryptographic SHA-256 block hashing to prevent corruption and guarantee public auditability.
