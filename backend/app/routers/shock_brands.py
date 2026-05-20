import json
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth import get_current_user
from app.database import get_session
from app.models import ShockBrand, User

router = APIRouter(tags=["shock-brands"])

BRANDS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "static", "brands")


class ShockBrandRead(BaseModel):
    id: int
    name: str
    accent_color: str
    banner_bg_color: str
    header_image_url: Optional[str]
    shock_models: List[str]

    @classmethod
    def from_model(cls, brand: ShockBrand) -> "ShockBrandRead":
        return cls(
            id=brand.id,
            name=brand.name,
            accent_color=brand.accent_color,
            banner_bg_color=brand.banner_bg_color,
            header_image_url=f"/static/brands/{brand.header_image_path}"
            if brand.header_image_path else None,
            shock_models=json.loads(brand.shock_models) if brand.shock_models else [],
        )


@router.get("/api/shock-brands", response_model=List[ShockBrandRead])
def list_brands(session: Session = Depends(get_session)):
    brands = session.exec(select(ShockBrand).order_by(ShockBrand.id)).all()
    return [ShockBrandRead.from_model(b) for b in brands]


@router.put("/api/admin/shock-brands/{brand_id}/image", response_model=ShockBrandRead)
async def upload_brand_image(
    brand_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    brand = session.get(ShockBrand, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    filename = f"{brand.name.lower().replace(' ', '_').replace('ö', 'o')}{ext}"
    os.makedirs(BRANDS_DIR, exist_ok=True)
    dest = os.path.join(BRANDS_DIR, filename)
    contents = await file.read()
    with open(dest, "wb") as f:
        f.write(contents)
    brand.header_image_path = filename
    session.add(brand)
    session.commit()
    session.refresh(brand)
    return ShockBrandRead.from_model(brand)
