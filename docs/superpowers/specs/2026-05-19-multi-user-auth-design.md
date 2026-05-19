# Design: Multi-User Auth (Phase 1 — Email + Password + JWT)

**Date:** 2026-05-19
**Scope:** Registration, login, JWT auth, full data isolation per user
**Phase 2 (out of scope):** OAuth (Google/GitHub) — DB designed to support it later

---

## Goal

ให้ผู้ใช้ทั่วไป register/login ด้วย email+password แล้วมี data ที่ fully isolated จากกัน — user A ไม่เห็นข้อมูลของ user B เลย

---

## Architecture

```
User (new)
  ├── Profile (add user_id FK)
  │     └── Motorcycle
  │           ├── MaintenanceTask → MaintenanceLog
  │           └── FuelLog
  ├── AppSettings (add user_id FK)
  ├── ShockSetting (add user_id FK)
  └── ShockPreset (add user_id FK)

TaskTemplate — global, ไม่ผูกกับ user (system reference data)
```

Auth flow:
1. Client ส่ง `POST /api/auth/login` → server return JWT
2. Client เก็บ token ใน localStorage
3. ทุก request ส่ง `Authorization: Bearer <token>`
4. FastAPI Dependency `get_current_user` verify token → inject `User` object
5. Router filter/verify ownership ทุก query

---

## New Files

### `backend/app/auth.py`

Auth utilities (ไม่ใช่ router):

```python
SECRET_KEY = os.environ["AUTH_SECRET_KEY"]  # required env var, ไม่มี default
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

def hash_password(plain: str) -> str: ...
def verify_password(plain: str, hashed: str) -> bool: ...
def create_access_token(user_id: int) -> str: ...  # JWT {sub: str(user_id), exp: ...}
def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> User: ...
    # raises HTTPException(401) if token invalid/expired
```

### `backend/app/routers/auth.py`

```
POST /api/auth/register   {email, password} → 201 {access_token, token_type}
POST /api/auth/login      {email, password} → 200 {access_token, token_type}
GET  /api/auth/me         (auth required)   → 200 {id, email, created_at}
```

Register side effects:
- สร้าง `AppSettings` default สำหรับ user ใหม่
- สร้าง `ShockSetting` default สำหรับ user ใหม่

### `frontend/src/api/auth.ts`

```typescript
fetchRegister(email, password) → {access_token, token_type}
fetchLogin(email, password) → {access_token, token_type}
fetchMe() → {id, email, created_at}
```

### `frontend/src/hooks/useAuth.ts`

```typescript
// อ่าน/เขียน localStorage โดยตรง — ไม่ใช้ React Context
login(email, password): Promise<void>
register(email, password): Promise<void>
logout(): void
isAuthenticated: boolean
```

### `frontend/src/pages/LoginPage.tsx`

Form: email + password → submit → redirect GaragePage

### `frontend/src/pages/RegisterPage.tsx`

Form: email + password + confirm password → submit → redirect GaragePage

---

## Modified Files

### `backend/app/models.py`

**เพิ่ม `User` model:**

```python
class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    profiles: List["Profile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
```

**แก้ `Profile`:** เพิ่ม `user_id: int = Field(foreign_key="users.id")` + Relationship back

**แก้ `AppSettings`:** เพิ่ม `user_id: int = Field(foreign_key="users.id")`

**แก้ `ShockSetting`:** เพิ่ม `user_id: int = Field(foreign_key="users.id")`

**แก้ `ShockPreset`:** เพิ่ม `user_id: int = Field(foreign_key="users.id")`

### `backend/app/utils.py`

เพิ่ม ownership helper:

```python
def get_motorcycle_for_user(bike_id: int, user: User, session: Session) -> Motorcycle:
    """Return motorcycle if owned by user, raise 404 otherwise (ไม่ leak ว่า ID มีอยู่)"""
    bike = session.get(Motorcycle, bike_id)
    if not bike or bike.profile.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    return bike
```

### `backend/requirements.txt`

```
python-jose[cryptography]
passlib[bcrypt]
```

### `backend/app/routers/` — ทุกไฟล์ (ยกเว้น templates.py)

เพิ่ม `current_user: User = Depends(get_current_user)` ทุก endpoint:

| Router | Pattern |
|--------|---------|
| `profiles.py` | filter `WHERE user_id = current_user.id` |
| `motorcycles.py` | `get_motorcycle_for_user(bike_id, current_user, session)` |
| `tasks.py` | verify via motorcycle ownership |
| `logs.py` | verify via motorcycle ownership |
| `fuel.py` | verify via motorcycle ownership |
| `shock.py` | filter `WHERE user_id = current_user.id` |
| `shock_presets.py` | filter `WHERE user_id = current_user.id` |
| `settings.py` | filter `WHERE user_id = current_user.id` |

### `frontend/src/api/client.ts`

Inject `Authorization: Bearer <token>` header ถ้ามี token ใน localStorage
Handle 401 response → clear token → redirect `/login`

### `frontend/src/App.tsx`

- เพิ่ม route `/login` → LoginPage
- เพิ่ม route `/register` → RegisterPage
- Protected route wrapper: ถ้าไม่มี token → redirect `/login`

---

## Security Notes

- **SECRET_KEY** ต้องตั้งเป็น env var (`AUTH_SECRET_KEY`) — `os.environ["AUTH_SECRET_KEY"]` จะ raise `KeyError` ตอน startup ถ้าไม่ตั้ง (fail fast, ไม่ silent) — server.py ต้อง pass ผ่าน env
- **Password** hash ด้วย bcrypt (cost factor default passlib = 12)
- **404 ไม่ใช่ 403** สำหรับ ownership mismatch — ป้องกัน enumeration attack
- **Token expiry** 7 วัน (ปรับได้ผ่าน env var `ACCESS_TOKEN_EXPIRE_DAYS`)
- **Email** เก็บเป็น lowercase, unique index

---

## Migration Note

DB ปัจจุบัน (`data/moto.db`) มีข้อมูลอยู่แล้ว — การเพิ่ม `user_id` FK ที่ NOT NULL จะทำให้ existing rows error
**วิธีจัดการ:** เพิ่ม column เป็น nullable ก่อน หรือ migrate ด้วย script ที่สร้าง default user แล้ว assign ข้อมูลเก่าทั้งหมดให้ user นั้น

**Migration script approach:**
1. สร้าง `User` row แรก (owner ของข้อมูลเดิม)
2. `UPDATE profiles SET user_id = 1`
3. `UPDATE settings SET user_id = 1`
4. `UPDATE shock_settings SET user_id = 1`
5. `UPDATE shock_presets SET user_id = 1`

---

## Phase 2 Preview (OAuth — out of scope now)

เมื่อต้องการเพิ่ม OAuth:
- เพิ่ม `OAuthAccount` table: `{user_id, provider, provider_user_id, access_token}`
- User model รองรับอยู่แล้ว (id-based)
- `hashed_password` เป็น nullable สำหรับ OAuth-only users
