# My Bike — Project Reference

แอปบันทึกการบำรุงรักษาและเชื้อเพลิงรถมอเตอร์ไซค์

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite + React 19 + TypeScript + TanStack Query |
| Backend | FastAPI + SQLModel + Python 3.9 |
| Database | SQLite (`data/moto.db`) |
| Styling | Custom CSS — Jelly Glass design system |

**ไม่มีใน project นี้:** Tailwind, shadcn/ui, lucide-react, Next.js, Alembic, PostgreSQL, Docker (local dev)

---

## Running the Project

### Backend
```bash
DB_PATH=/Users/mark/My-Project/My-bike/data/moto.db \
  backend/.venv/bin/uvicorn app.main:app \
  --host 0.0.0.0 --port 8764 --reload --app-dir backend
```
- Port: **8764** — production + local dev
- ต้อง restart ทุกครั้งที่แก้ backend เพื่อโหลด route ใหม่
- `DB_PATH` ต้องระบุเสมอ (default คือ `/app/data/moto.db` ซึ่งไม่มีในเครื่อง)

### Frontend build + deploy
```bash
cd frontend && npm run deploy
# = npm run build && rm -rf ../backend/static/assets && cp -r dist/. ../backend/static/
```

### Frontend dev server (แยก)
```bash
cd frontend && npm run dev   # port 5173
```

---

## Project Structure

```
My-bike/
├── frontend/src/
│   ├── pages/              # Route-level components
│   ├── components/ui/      # Shared UI (ConfirmDialog, AccountModal, AvatarMenu ฯลฯ)
│   ├── api/                # Axios API clients (auth.ts, motorcycles.ts ฯลฯ)
│   ├── hooks/              # useAuth, useConfirm, useTheme, useGeoLocation ฯลฯ
│   └── index.css           # ไฟล์ CSS เดียว — styles ทั้งหมดอยู่ที่นี่
├── backend/app/
│   ├── main.py             # FastAPI app, lifespan, mount routers
│   ├── models.py           # SQLModel table definitions
│   ├── database.py         # engine, create_db(), manual migrations
│   ├── auth.py             # JWT helpers (get_current_user, create_access_token)
│   ├── utils.py            # save_compressed_image, recalc_odometer ฯลฯ
│   ├── seed.py             # default data
│   └── routers/            # FastAPI route handlers
├── data/moto.db            # SQLite database
└── backend/uploads/        # uploaded images (bikes/, avatars/, fuel/, service/)
```

---

## Data Model

```
User
  ├── id, email, hashed_password
  ├── username, phone, phone_verified
  ├── display_name, avatar_url        ← เพิ่ม 2025
  └── profiles[]
        └── Profile → Motorcycle → MaintenanceTask → MaintenanceLog
                                 → FuelLog
ShockSetting  (per user)
AppSettings   (per user)
TaskTemplate  (standalone)
```

---

## API Endpoints

```
/api/auth/
  POST   /register        email + password
  POST   /login           identifier (email/username) + password
  POST   /otp/send        phone OTP
  POST   /otp/login
  GET    /me              UserRead (incl. display_name, avatar_url)
  PUT    /email
  PUT    /password
  PUT    /username
  PUT    /display-name    { display_name: string }
  POST   /avatar          multipart file upload → /uploads/avatars/
  DELETE /avatar
  POST   /phone/request
  POST   /phone/confirm

/api/profiles/            CRUD
/api/motorcycles/         CRUD + image upload
/api/logs/                maintenance logs + images
/api/fuel/                fuel logs
/api/tasks/               maintenance tasks
/api/reminders/           service reminders
/api/expenses/            expense tracking
/api/shock/               shock settings
/api/settings/            app settings
```

---

## Database Migrations

ไม่ใช้ Alembic — manual migration pattern:

```python
def _migrate_something():
    with engine.connect() as conn:
        existing = [r[1] for r in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
        if "new_column" not in existing:
            conn.execute(text("ALTER TABLE users ADD COLUMN new_column TEXT"))
        conn.commit()

# เรียกใน create_db() เสมอ — idempotent
def create_db():
    SQLModel.metadata.create_all(engine)
    _migrate()
    ...
    _migrate_something()
```

---

## Auth System

- Token เก็บใน `localStorage` key: `moto_token`
- **ไม่มี expire** — ค้างจนกว่าจะ logout หรือ clear storage
- `useAuth()` hook: `login`, `loginWithOtp`, `register`, `logout`, `isAuthenticated`

---

## Image Upload Pattern

```python
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "bikes")

async def upload_image(file: UploadFile, ...):
    filename = f"{uuid.uuid4().hex}.jpg"
    dest = os.path.join(UPLOAD_DIR, filename)
    save_compressed_image(await file.read(), dest)
    model.image_path = f"/uploads/bikes/{filename}"
```

`save_compressed_image()` — resize ≤1920px, JPEG quality 82, EXIF transpose

---

## Frontend Patterns

### Delete confirmation
```tsx
const { dialog, confirm } = useConfirm();
if (await confirm("ลบรายการนี้?", { title: "ลบ", confirmLabel: "ลบ" }))
  deleteMutation.mutate();
// render: {dialog}
```

### Modal rendering
AccountModal และ modal ที่ render จาก component ใน `<nav>` ต้องใช้ Portal:
```tsx
import { createPortal } from "react-dom";
{showModal && createPortal(<MyModal onClose={...} />, document.body)}
```

### Query invalidation
```tsx
qc.invalidateQueries({ queryKey: ["me"] });
```

### Error handling
```tsx
catch (err: any) {
  setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
}
```

---

## Naming Conventions

| Context | Convention |
|---------|-----------|
| Python vars/functions | snake_case |
| Python classes | PascalCase |
| TypeScript vars/functions | camelCase |
| TypeScript components/types | PascalCase |

---

## Rules

- ❌ ห้ามใช้ Alembic, PostgreSQL, subprocess, Docker
- ❌ ห้ามเพิ่ม npm/pip package โดยไม่แจ้งก่อน
- ❌ ห้ามสร้าง `.env` — ใช้ env var ตรงๆ
- ❌ ห้ามเพิ่ม test ถ้าไม่ถูกขอ
- ❌ ห้าม print() ใน production code
- ⚠️ ไฟล์ >500 บรรทัด → ระบุ line range ก่อนอ่าน
- ⚠️ 1 task = 1 feature
- ✅ Type hints ทุก Python function
- ✅ HTTPException เท่านั้นสำหรับ error
