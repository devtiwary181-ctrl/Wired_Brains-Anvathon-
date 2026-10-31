#!/bin/bash
# DisasterReady India - All Services Startup Script

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=== Starting DisasterReady India Services ==="

# 1. Start Core Backend API (Port 5001)
echo "Starting backend API server on port 5001..."
if lsof -i :5001 >/dev/null 2>&1; then
  echo "Backend API is already running on port 5001."
else
  nohup node dist/server.js </dev/null >> server.log 2>&1 &
  sleep 3
  echo "Backend API started (PID $!)."
fi

# 2. Start Frontend Static Server (Port 3000)
echo "Starting frontend server on port 3000..."
if lsof -i :3000 >/dev/null 2>&1; then
  echo "Frontend server is already running on port 3000."
else
  (cd stitch-reference && nohup python3 -m http.server 3000 </dev/null >> ../app.log 2>&1 &)
  sleep 2
  echo "Frontend server started."
fi

echo "=== Verification ==="
lsof -i :3000 -i :5001

echo "DisasterReady India is live at http://localhost:3000"
