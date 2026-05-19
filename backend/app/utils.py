import io
import os
from PIL import Image
from sqlmodel import Session, select, func
from app.models import MaintenanceLog, MaintenanceTask, FuelLog, Motorcycle

MAX_DIMENSION = 1920
JPEG_QUALITY = 82


def save_compressed_image(file_bytes: bytes, dest_path: str) -> None:
    """Resize and compress an uploaded image, always saving as JPEG."""
    img = Image.open(io.BytesIO(file_bytes))
    # Correct orientation from EXIF before anything else
    try:
        from PIL import ImageOps
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    w, h = img.size
    if max(w, h) > MAX_DIMENSION:
        ratio = MAX_DIMENSION / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    img.save(dest_path, format="JPEG", quality=JPEG_QUALITY, optimize=True)


def recalc_odometer(bike_id: int, session: Session) -> None:
    service_max = session.exec(
        select(func.max(MaintenanceLog.mileage_at_service))
        .join(MaintenanceTask, MaintenanceTask.id == MaintenanceLog.task_id)
        .where(MaintenanceTask.motorcycle_id == bike_id)
    ).first() or 0
    fuel_max = session.exec(
        select(func.max(FuelLog.mileage_at_fillup))
        .where(FuelLog.motorcycle_id == bike_id)
    ).first() or 0
    new_km = max(service_max, fuel_max)
    if new_km > 0:
        bike = session.get(Motorcycle, bike_id)
        if bike:
            bike.current_mileage = new_km
            session.add(bike)
