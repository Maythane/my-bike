from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from sqlmodel import Session
import os

from app.database import create_db, engine
from app.seed import seed_defaults
from app.routers import profiles, motorcycles, tasks, logs, settings, templates, fuel, shock, shock_presets, auth, shock_brands, reminders, expenses


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()
    with Session(engine) as session:
        seed_defaults(session)
    yield


app = FastAPI(title="Moto Tracker API", version="1.0.0", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(motorcycles.router)
app.include_router(tasks.router)
app.include_router(logs.router)
app.include_router(settings.router)
app.include_router(templates.router)
app.include_router(fuel.router)
app.include_router(shock.router)
app.include_router(shock_presets.router)
app.include_router(shock_brands.router)
app.include_router(reminders.router)
app.include_router(expenses.router)

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
if os.path.isdir(UPLOADS_DIR):
    app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

BRANDS_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "brands")
os.makedirs(BRANDS_DIR, exist_ok=True)
app.mount("/static/brands", StaticFiles(directory=BRANDS_DIR), name="brands")

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        static_file = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(static_file):
            return FileResponse(static_file)
        index = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(index, headers={"Cache-Control": "no-store"})
