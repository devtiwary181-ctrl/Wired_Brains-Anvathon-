# DisasterReady India — Production Deployment Guide

This guide details the steps to deploy DisasterReady India across production infrastructure, adhering to stateful geospatial requirements, background outbox workers, persistent WebSockets, and zero-downtime resilience.

---

## 🏗️ Architecture Topology

| Layer | Provider Option A (Recommended) | Provider Option B | Critical Capabilities Required |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel | Cloudflare Pages / AWS S3 + CloudFront | Static asset hosting, HTTPS, SPA routing fallback |
| **Backend API** | Render (Web Service) | Railway / AWS ECS Fargate | Long-lived WebSocket connections, Node 20+, persistent process |
| **Database** | Supabase PostgreSQL | AWS RDS PostgreSQL / Neon | PostgreSQL 15+, PostGIS extension (`CREATE EXTENSION postgis;`) |
| **Redis** | Upstash Redis | Aiven Redis / AWS ElastiCache | Sub-millisecond latency, pub/sub capability, eviction policy |

---

## 🗄️ Step 1: PostgreSQL with PostGIS Setup

DisasterReady India depends strictly on PostGIS for spatial queries (`ST_DWithin`, `ST_Buffer`, `ST_MakePoint`).

### Supabase Deployment:
1. Create a new Supabase Project.
2. In the Supabase SQL Editor, enable PostGIS:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
3. Copy the **Direct Connection String** (Session Pooler mode port 5432 is recommended for migrations; transaction pooler port 6543 for queries):
   ```
   DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require"
   ```

---

## ⚡ Step 2: Managed Redis Setup

### Upstash Redis Deployment:
1. Create a Redis database with TLS enabled.
2. Copy the standard Redis connection string:
   ```
   REDIS_URL="rediss://default:[TOKEN]@[HOST]:6379"
   ```

---

## 🚀 Step 3: Backend Deployment (Render / Railway)

Because DisasterReady India runs a **Socket.IO Real-Time Server** and a **Transactional Outbox Poller Worker**, it must run as a persistent Node.js service (not serverless functions).

### Render Web Service Configuration:
1. Connect the GitHub repository.
2. Choose **Node** runtime.
3. Configure build & start commands:
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npm run start`
4. Configure Environment Variables in the Render Dashboard (refer to [ENVIRONMENT_VARIABLES.md](file:///Users/devsmaccie/Desktop/anvathon/ENVIRONMENT_VARIABLES.md)):
   - `NODE_ENV=production`
   - `PORT=10000`
   - `DATABASE_URL=...`
   - `REDIS_URL=...`
   - `JWT_SECRET=...` (Use 64-char high-entropy string)
   - `CORS_ORIGIN=https://disaster-ready.vercel.app`
5. Enable Auto-Deploy on push to `main`.
6. Configure Health Check Path: `/api/v1/health`.

### Apply Database Migrations on Render:
Add a pre-deploy command or run via Render Shell:
```bash
npx prisma migrate deploy
npm run seed
```

---

## 🌐 Step 4: Frontend Deployment (Vercel)

The frontend is located in `/stitch-reference` and consists of vanilla HTML5, CSS tokens, and modern JavaScript modules.

### Vercel Deployment:
1. Import the GitHub repository in Vercel.
2. Configure Project Settings:
   - **Root Directory:** `stitch-reference`
   - **Build Command:** *(Leave empty / static)*
   - **Output Directory:** `.`
3. Set Frontend Environment Variable (if utilizing build-time templating) or set `api-client.js` base URL fallback:
   - `window.APP_CONFIG = { API_BASE_URL: "https://your-backend.onrender.com/api/v1" };`
4. Add a `vercel.json` rewrite rule to support routing if needed:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/$1" }
     ],
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "X-Frame-Options", "value": "DENY" },
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
         ]
       }
     ]
   }
   ```

---

## 🛡️ Step 5: CORS, HTTPS & Security Checklist

- [x] **HTTPS Enforcement:** Vercel and Render automatically provision SSL/TLS certificates via Let's Encrypt.
- [x] **CORS Lockdown:** Verify `CORS_ORIGIN` matches the exact frontend domain (e.g. `https://disaster-ready.vercel.app`).
- [x] **Cookie Security:** Verify `NODE_ENV=production` ensures cookies are set with `SameSite=None` and `Secure=true`.
- [x] **Outbox Worker Verification:** Inspect backend logs to confirm:
  `[OutboxService] Transactional outbox polling initialized (interval: 3000ms)`
- [x] **Socket.IO Heartbeat:** Test WebSocket connection in browser console:
  `window.disasterApiClient.getSocket().connected === true`

---

## 💾 Step 6: Backup Strategy & Disaster Recovery

1. **Automated Point-in-Time Recovery (PITR):** Enable Supabase/RDS daily automated backups with 7-day retention.
2. **Geo-Redundant Read Replica:** During active cyclone or monsoon emergencies, configure a read replica in an alternate region (e.g., AWS Mumbai `ap-south-1` primary + AWS Hyderabad `ap-south-2` replica).
3. **Emergency Cold Export:**
   ```bash
   pg_dump -Fc --no-acl --no-owner -h [HOST] -U postgres -d postgres > disasterready_backup_$(date +%Y%m%d).dump
   ```
