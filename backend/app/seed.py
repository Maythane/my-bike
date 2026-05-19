from sqlmodel import Session, select
from app.models import AppSettings, TaskTemplate

TEMPLATES = [
    {"name": "เปลี่ยนน้ำมันเครื่อง", "default_interval_km": 3000, "default_interval_months": 6, "category": "Engine"},
    {"name": "เปลี่ยนไส้กรองน้ำมันเครื่อง", "default_interval_km": 6000, "default_interval_months": 12, "category": "Engine"},
    {"name": "ทำความสะอาดไส้กรองอากาศ", "default_interval_km": 6000, "default_interval_months": 12, "category": "Engine"},
    {"name": "เปลี่ยนไส้กรองอากาศ", "default_interval_km": 12000, "default_interval_months": 24, "category": "Engine"},
    {"name": "เปลี่ยนหัวเทียน", "default_interval_km": 12000, "default_interval_months": 24, "category": "Engine"},
    {"name": "หล่อลื่นโซ่", "default_interval_km": 500, "default_interval_months": None, "category": "Drivetrain"},
    {"name": "ปรับความตึงโซ่", "default_interval_km": 3000, "default_interval_months": None, "category": "Drivetrain"},
    {"name": "เปลี่ยนโซ่", "default_interval_km": 20000, "default_interval_months": None, "category": "Drivetrain"},
    {"name": "ตรวจผ้าเบรกหน้า", "default_interval_km": 6000, "default_interval_months": 12, "category": "Brakes"},
    {"name": "ตรวจผ้าเบรกหลัง", "default_interval_km": 6000, "default_interval_months": 12, "category": "Brakes"},
    {"name": "เปลี่ยนน้ำมันเบรก", "default_interval_km": None, "default_interval_months": 24, "category": "Brakes"},
    {"name": "ตรวจลมยาง", "default_interval_km": 1000, "default_interval_months": 1, "category": "Tires"},
    {"name": "ตรวจสภาพยาง", "default_interval_km": 5000, "default_interval_months": 6, "category": "Tires"},
    {"name": "เปลี่ยนน้ำยาหม้อน้ำ", "default_interval_km": None, "default_interval_months": 24, "category": "Cooling"},
    {"name": "ทำความสะอาดคาร์บูเรเตอร์/ลิ้นเร่ง", "default_interval_km": 10000, "default_interval_months": 24, "category": "Engine"},
    {"name": "เปลี่ยนน้ำมันโช้คหน้า", "default_interval_km": None, "default_interval_months": 24, "category": "Suspension"},
    {"name": "ตรวจแบตเตอรี่", "default_interval_km": None, "default_interval_months": 6, "category": "Electrical"},
]

GRAND_FILANO_TEMPLATES = [
    {"name": "เปลี่ยนน้ำมันเครื่อง", "model": "Grand Filano", "default_interval_km": 4000, "default_interval_months": 12, "category": "Engine"},
    {"name": "เปลี่ยนน้ำมันเกียร์", "model": "Grand Filano", "default_interval_km": 12000, "default_interval_months": 24, "category": "Engine"},
    {"name": "เปลี่ยนไส้กรองอากาศ", "model": "Grand Filano", "default_interval_km": 16000, "default_interval_months": None, "category": "Engine"},
    {"name": "เปลี่ยนหัวเทียน", "model": "Grand Filano", "default_interval_km": 8000, "default_interval_months": None, "category": "Engine"},
    {"name": "เปลี่ยนสายพาน V", "model": "Grand Filano", "default_interval_km": 25000, "default_interval_months": None, "category": "Drivetrain"},
    {"name": "ตรวจสายพาน V", "model": "Grand Filano", "default_interval_km": 8000, "default_interval_months": None, "category": "Drivetrain"},
    {"name": "ตรวจระยะวาล์ว", "model": "Grand Filano", "default_interval_km": 4000, "default_interval_months": None, "category": "Engine"},
    {"name": "ตรวจแบตเตอรี่", "model": "Grand Filano", "default_interval_km": None, "default_interval_months": 3, "category": "Electrical"},
    {"name": "เปลี่ยนน้ำมันเบรก", "model": "Grand Filano", "default_interval_km": None, "default_interval_months": 24, "category": "Brakes"},
]


def seed_defaults(session: Session):
    existing = session.exec(select(AppSettings)).first()
    if not existing:
        session.add(AppSettings())
        session.commit()

    all_templates = TEMPLATES + GRAND_FILANO_TEMPLATES
    for t in all_templates:
        existing_t = session.exec(
            select(TaskTemplate).where(
                TaskTemplate.name == t["name"],
                TaskTemplate.model == t.get("model")
            )
        ).first()
        if not existing_t:
            session.add(TaskTemplate(**t))

    session.commit()
