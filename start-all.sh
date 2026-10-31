#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=================================================="
echo " Starting DisasterReady India Full Stack"
echo "=================================================="

# 1. Start Docker Containers (PostGIS & Redis)
echo "[1/4] Ensuring Docker containers (PostgreSQL + PostGIS, Redis) are running..."
docker compose up -d

# Wait for postgres to be ready
echo "Waiting for PostgreSQL..."
until docker exec disasterready_postgres pg_isready -U disasterready -d disasterready_db >/dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL & PostGIS are ready!"

# 2. Kill any stale process on 5001
echo "[2/3] Clearing port 5001..."
lsof -ti :5001 | xargs kill -9 2>/dev/null || true

# 3. Start Unified Application (Frontend + Backend + Socket.IO) with nohup
echo "[3/3] Starting Unified Single-Server Application on port 5001..."
nohup npm run dev > app.log 2>&1 &
APP_PID=$!
echo "Unified server started with PID $APP_PID (logging to app.log)"

# Wait for application health probe
echo "Waiting for Single-Server health probe..."
for i in {1..30}; do
  if curl -s http://localhost:5001/api/v1/health | grep -q "ONLINE"; then
    echo "Backend API is ONLINE!"
    break
  fi
  sleep 1
done

# Wait for frontend serving probe
echo "Waiting for Frontend to respond on port 5001..."
for i in {1..20}; do
  if curl -sI http://localhost:5001/ | grep -q "200 OK"; then
    echo "Frontend is accessible and verified (200 OK) on http://localhost:5001!"
    break
  fi
  sleep 1
done

echo ""
echo "=================================================="
echo " DisasterReady India UNIFIED SERVER is LIVE!"
echo " Public Application URL: http://localhost:5001/"
echo " Citizen Dashboard:      http://localhost:5001/dashboard"
echo " Hazard Map:             http://localhost:5001/hazards"
echo " Route Safety:           http://localhost:5001/routes"
echo " Safe Places / Shelters: http://localhost:5001/shelters"
echo " Authority Dashboard:    http://localhost:5001/admin"
echo " Backend Health API:     http://localhost:5001/api/v1/health"
echo " Real-Time Socket.IO:    http://localhost:5001/socket.io/"
echo " Logs: app.log"
echo " Stop: ./stop-all.sh"
echo "=================================================="
