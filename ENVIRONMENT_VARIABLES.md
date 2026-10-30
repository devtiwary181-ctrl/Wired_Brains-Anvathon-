# DisasterReady India — Environment Variables Specification

This document details all environment variables used across the backend and frontend services, their sensitivity level, defaults, and rotation guidelines.

---

## 🔒 Backend Configuration (`.env`)

| Variable Name | Required | Default / Example Value | Sensitivity | Purpose / Description |
| :--- | :---: | :--- | :---: | :--- |
| `NODE_ENV` | Yes | `production` (or `development`) | Low | Sets operational mode, logging verbosity, and secure cookie flags. |
| `PORT` | Yes | `5000` | Low | Port on which the Express HTTP server and Socket.IO listen. |
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/disaster_ready?schema=public` | **Critical** | Connection URI for PostgreSQL with PostGIS extension. |
| `REDIS_URL` | Yes | `redis://localhost:6379` | **High** | Connection URI for Redis session cache, OTP challenge stores, and locks. |
| `JWT_SECRET` | Yes | `[RANDOM_64_CHAR_HEX_STRING]` | **Critical** | Cryptographic key used to sign and verify citizen/admin JWT bearer tokens. |
| `JWT_EXPIRES_IN` | No | `8h` | Low | Lifespan of JWT access tokens. |
| `CORS_ORIGIN` | Yes | `http://localhost:3000` | Medium | Allowed origin for Cross-Origin Resource Sharing. Accepts comma-separated list. |
| `COOKIE_SECRET` | Yes | `[RANDOM_32_CHAR_STRING]` | **High** | Secret used by `cookie-parser` for signing HTTP cookies. |
| `GEMINI_API_KEY` | No | `AIzaSy...` (Optional) | **High** | Google Gemini API key for DisasterReady Copilot natural language responses. If omitted, Copilot runs in deterministic fallback mode. |
| `SMS_GATEWAY_API_KEY`| No | `sms_live_...` (Optional) | **High** | API key for Fast2SMS / Twilio. If omitted, dev OTPs print to local logs. |
| `OUTBOX_POLL_INTERVAL`| No | `3000` | Low | Transactional outbox polling frequency in milliseconds. |
| `RATE_LIMIT_MAX` | No | `100` | Low | Max requests per IP window on general API routes. |
| `RATE_LIMIT_WINDOW_MS`| No | `900000` (15 mins) | Low | Time window for rate limiter in milliseconds. |

---

## 💻 Frontend Configuration

In the static Google Stitch frontend (`/stitch-reference`), configuration is loaded dynamically or through a top-level configuration object:

```javascript
window.APP_CONFIG = {
  API_BASE_URL: "http://localhost:5000/api/v1", // In production: "https://your-api-domain.com/api/v1"
  WS_URL: "http://localhost:5000",              // In production: "https://your-api-domain.com"
  DEFAULT_MAP_CENTER: [19.0760, 72.8777],      // Mumbai [lat, lng]
  DEFAULT_MAP_ZOOM: 12
};
```

---

## 🔑 Secret Generation & Rotation

### Generate Cryptographic Secrets:
```bash
# Generate 64-byte hex string for JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate 32-byte hex string for COOKIE_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Rotation Policy:
1. **JWT_SECRET:** Rotate every 90 days. During rotation, maintain dual-key validation grace period if zero-downtime re-authentication is required.
2. **DATABASE_URL / REDIS_URL:** Update via hosting dashboard environment management, trigger zero-downtime rolling restart.
