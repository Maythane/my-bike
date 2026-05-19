#!/usr/bin/env bash
set -euo pipefail

# Install Python venv if missing
if [ ! -f "backend/.venv/bin/activate" ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi

source backend/.venv/bin/activate
export DB_PATH="$(pwd)/data/moto.db"

# Install frontend deps if missing
if [ ! -d "frontend/node_modules" ]; then
  (cd frontend && npm install --silent)
fi

echo "My-bike ready — DB=$DB_PATH"
