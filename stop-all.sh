#!/usr/bin/env bash

echo "Stopping DisasterReady India full stack..."

# Kill process listening on port 5001
lsof -ti :5001 | xargs kill -9 2>/dev/null && echo "Stopped Unified Server on port 5001" || true
lsof -ti :3000 | xargs kill -9 2>/dev/null 2>&1 || true

echo "All app services stopped."
