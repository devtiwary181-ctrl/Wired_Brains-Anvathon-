#!/bin/bash
# DisasterReady India - All Services Shutdown Script

echo "=== Stopping DisasterReady India Services ==="

# 1. Stop Frontend Python Server on Port 3000
FRONTEND_PID=$(lsof -ti :3000)
if [ -n "$FRONTEND_PID" ]; then
  echo "Stopping Frontend server on port 3000 (PID $FRONTEND_PID)..."
  kill -9 $FRONTEND_PID 2>/dev/null
  echo "Frontend server stopped."
else
  echo "No process running on port 3000."
fi

# 2. Stop Core Backend Node.js API on Port 5001
BACKEND_PID=$(lsof -ti :5001)
if [ -n "$BACKEND_PID" ]; then
  echo "Stopping Backend server on port 5001 (PID $BACKEND_PID)..."
  kill -9 $BACKEND_PID 2>/dev/null
  echo "Backend server stopped."
else
  echo "No process running on port 5001."
fi

echo "=== Verification ==="
lsof -i :3000 -i :5001 || echo "All application ports cleared."
