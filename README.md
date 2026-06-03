# Moto Tracker

Night Rider-themed motorcycle maintenance tracker for local home server use.

## Quick Start (Docker)

```bash
docker compose up --build
```

Open `http://<server-ip>:8080` from any device on your LAN.

## Local Build

**Install dependencies:**
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd frontend
npm install
```

**Build frontend and serve through FastAPI:**
```bash
cd frontend && npm run deploy
cd ..
AUTH_SECRET_KEY=<your-secret> DB_PATH=./data/moto.db backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8764 --app-dir backend
```

## Stack

- Backend: FastAPI + SQLite via SQLModel (Python 3.9+)
- Frontend: React + TypeScript + Vite
- State: TanStack Query
- Deployment: Docker single-container (builds frontend + serves via FastAPI)
