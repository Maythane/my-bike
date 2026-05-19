# Moto Tracker

Night Rider-themed motorcycle maintenance tracker for local home server use.

## Quick Start (Docker)

```bash
docker compose up --build
```

Open `http://<server-ip>:8080` from any device on your LAN.

## Local Development

**Backend:**
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
DB_PATH=./data/moto.db .venv/bin/uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev       # proxy to localhost:8000
```

**Build & serve together:**
```bash
cd frontend && npm run build && cp -r dist ../backend/static
cd ../backend && DB_PATH=./data/moto.db .venv/bin/uvicorn app.main:app
```

## Stack

- Backend: FastAPI + SQLite via SQLModel (Python 3.9+)
- Frontend: React + TypeScript + Vite
- State: TanStack Query
- Deployment: Docker single-container (builds frontend + serves via FastAPI)
