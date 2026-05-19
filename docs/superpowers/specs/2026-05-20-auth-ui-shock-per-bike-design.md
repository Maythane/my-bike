# Design: Auth UI + ShockSetting Per Motorcycle

**Date:** 2026-05-20
**Scope:** Landing page (login/register tabs), avatar dropdown (manage account + settings), ShockSetting per motorcycle, ShockPreset future-proofing

---

## Goals

1. หน้า auth ที่สวยงาม consistent กับ Jelly Glass design system
2. Avatar dropdown ใน NavBar แทนปุ่ม 🚪 เดิม
3. Modal สำหรับ Manage Account (เปลี่ยน email/password) และ Settings (unit/timezone)
4. ShockSetting ผูกกับรถแต่ละคัน (ไม่ใช่ global per user อีกต่อไป)
5. ShockPreset รองรับ shock brand/model ในอนาคต

---

## CSS Constraint

**ทุก component ใหม่ใช้ CSS variables จาก Jelly Glass เท่านั้น:**

```css
--canvas, --surface, --elevated, --glass-bg, --glass-border
--green (#39ff96), --green-bg, --green-border
--purple, --purple-hover, --purple-bg, --purple-border
--ink, --slate, --steel, --muted
--hairline, --hairline-strong
--red, --red-bg
--r, --r-md, --r-lg, --r-full
```

ห้าม hardcode สี hex ใหม่ในไฟล์ `.tsx` หรือ `.css`

---

## Part 1: Auth Page

### Route
- `/login` — AuthPage (เดิม LoginPage + RegisterPage รวมกัน)
- `/register` → redirect ไป `/login`
- ลบ `LoginPage.tsx` และ `RegisterPage.tsx` ออก

### Component: `frontend/src/pages/AuthPage.tsx`

Layout:
```
FullScreen (background: var(--canvas) + Blobs)
  ┌─────────────────────────────┐
  │  🏍️  Moto Tracker           │
  │  ติดตามการบำรุงรักษา...      │
  │                             │
  │  [เข้าสู่ระบบ] [สมัครสมาชิก] │  ← tab switcher
  │                             │
  │  email input                │
  │  password input             │
  │  (confirm input — register) │
  │                             │
  │  [Submit Button]            │
  └─────────────────────────────┘
```

- Tab switcher ใช้ `--surface` background, active tab ใช้ `--green-bg` + `--green` text
- Submit button: `background: var(--green)`, `color: #000`, `font-weight: 700`
- Error text: `color: var(--red)`
- Input: `background: var(--surface)`, `border: 1px solid var(--glass-border)`
- Card: `background: var(--glass-bg)`, `border: 1px solid var(--glass-border)`, `border-radius: var(--r-md)`
- Reuse `Blobs` component จาก `App.tsx` (extract เป็น export)

### CSS Classes (เพิ่มใน index.css)

ลบ class เก่า `.auth-*` ทิ้ง แล้วเพิ่มใหม่:
```css
.auth-page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:1rem; }
.auth-card { background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:var(--r-md);
             padding:2rem; width:100%; max-width:380px; display:flex; flex-direction:column; gap:1rem; }
.auth-card h1 { font-size:1.5rem; margin:0; text-align:center; color:var(--ink); }
.auth-card h2 { font-size:1rem; margin:0; color:var(--slate); text-align:center; }
.auth-tabs { display:flex; background:var(--surface); border-radius:var(--r); padding:3px; gap:2px; }
.auth-tab  { flex:1; text-align:center; padding:0.5rem; border-radius:calc(var(--r) - 2px);
             font-size:0.875rem; font-weight:500; color:var(--slate); cursor:pointer; transition:all 0.15s; }
.auth-tab.active { background:var(--green-bg); color:var(--green); font-weight:600; }
.auth-form { display:flex; flex-direction:column; gap:0.625rem; }
.auth-form label { display:flex; flex-direction:column; gap:0.25rem; font-size:0.875rem; color:var(--slate); }
.auth-form input { padding:0.6rem 0.8rem; border-radius:var(--r); border:1px solid var(--glass-border);
                   background:var(--surface); color:var(--ink); font-size:1rem; }
.auth-form input:focus { outline:none; border-color:var(--green-border); }
.auth-btn { margin-top:0.5rem; padding:0.75rem; border-radius:var(--r); border:none;
            background:var(--green); color:#000; font-weight:700; font-size:1rem; cursor:pointer; }
.auth-btn:disabled { opacity:0.5; cursor:not-allowed; }
.auth-error { color:var(--red); font-size:0.875rem; margin:0; }
.auth-link  { text-align:center; font-size:0.875rem; color:var(--slate); margin:0; }
```

---

## Part 2: Avatar Dropdown (NavBar)

### Component: `frontend/src/components/ui/AvatarMenu.tsx`

- Avatar circle: gradient `linear-gradient(135deg, var(--green), #00d2ff)`, ตัวอักษรแรกของ email
- Click avatar → toggle dropdown
- Click นอก dropdown → ปิด (useRef + useEffect document.mousedown)
- แสดง email ปัจจุบันใน dropdown header (ดึงจาก `/api/auth/me` cache ผ่าน TanStack Query)

Dropdown items:
```
┌────────────────────────┐
│ Signed in as           │
│ maythane@gmail.com     │
├────────────────────────┤
│ 👤  Manage Account     │  → เปิด AccountModal
│ ⚙️  Settings           │  → เปิด SettingsModal
├────────────────────────┤
│ 🚪  Logout             │  → clear token + redirect /login
└────────────────────────┘
```

- Dropdown: `background: var(--elevated)`, `border: 1px solid var(--glass-border)`
- Hover item: `background: var(--surface)`
- Logout item: `color: var(--red)`

### App.tsx changes

- ลบปุ่ม 🚪 เดิมออกจาก NavBar
- เพิ่ม `<AvatarMenu />` แทน (render เฉพาะตอน authenticated)
- NavBar ไม่ render ใน `/login` และ `/register`

---

## Part 3: Account Modal

### Component: `frontend/src/components/ui/AccountModal.tsx`

Modal overlay: `background: rgba(0,0,0,0.6)`, click backdrop → ปิด

Tabs: **Email** | **Password**

**Email tab:**
- แสดง email ปัจจุบัน (read-only, styled `--surface`)
- Input: New email
- Submit → `PUT /api/auth/email` `{ new_email: string }`
- Success → toast "อัปเดต email แล้ว" + ปิด modal + refetch /me

**Password tab:**
- Input: Current password
- Input: New password (min 8 chars)
- Input: Confirm new password
- Submit → `PUT /api/auth/password` `{ current_password, new_password }`
- Success → toast "เปลี่ยน password แล้ว"

Tab switcher ใช้ class `.auth-tabs` / `.auth-tab` เหมือน AuthPage

### Backend: เพิ่มใน `backend/app/routers/auth.py`

```python
class UpdateEmailRequest(BaseModel):
    new_email: str

class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str  # min 8 chars validated server-side

@router.put("/email", status_code=200)
def update_email(data: UpdateEmailRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    email = data.new_email.lower().strip()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=409, detail="Email already in use")
    current_user.email = email
    session.add(current_user)
    session.commit()
    return {"ok": True}

@router.put("/password", status_code=200)
def update_password(data: UpdatePasswordRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    current_user.hashed_password = hash_password(data.new_password)
    session.add(current_user)
    session.commit()
    return {"ok": True}
```

### Frontend: เพิ่มใน `frontend/src/api/auth.ts`

```typescript
export async function fetchUpdateEmail(new_email: string): Promise<void> {
  await client.put("/api/auth/email", { new_email });
}

export async function fetchUpdatePassword(current_password: string, new_password: string): Promise<void> {
  await client.put("/api/auth/password", { current_password, new_password });
}
```

---

## Part 4: Settings Modal

### Component: `frontend/src/components/ui/SettingsModal.tsx`

- Load ค่าปัจจุบันจาก `GET /api/settings` ตอนเปิด modal
- Unit: toggle button group `km` | `miles`
- Timezone: `<input type="text">` (free text เช่น `Asia/Bangkok`)
- Save → `PUT /api/settings` → ปิด modal

### Frontend: สร้าง `frontend/src/api/settings.ts`

```typescript
export interface AppSettings {
  id: number;
  default_unit: "km" | "miles";
  timezone: string;
  user_id: number;
}

export const fetchSettings = () =>
  client.get<AppSettings>("/api/settings").then(r => r.data);

export const updateSettings = (data: Partial<Pick<AppSettings, "default_unit" | "timezone">>) =>
  client.put<AppSettings>("/api/settings", data).then(r => r.data);
```

---

## Part 5: ShockSetting Per Motorcycle

### Schema Change: `backend/app/models.py`

**ShockSetting** — เพิ่ม `motorcycle_id` FK:
```python
class ShockSetting(SQLModel, table=True):
    __tablename__ = "shock_settings"
    id: Optional[int] = Field(default=None, primary_key=True)
    motorcycle_id: Optional[int] = Field(default=None, foreign_key="motorcycles.id", index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    rider_weight: float = Field(default=75.0)
    passenger_weight: float = Field(default=0.0)
    mode: str = Field(default="street")
    # future: shock_brand, shock_model เพิ่มทีหลัง
```

**ShockPreset** — เพิ่ม future-proof fields:
```python
class ShockPreset(SQLModel, table=True):
    __tablename__ = "shock_presets"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    motorcycle_id: Optional[int] = Field(default=None, foreign_key="motorcycles.id", index=True)
    shock_brand: Optional[str] = Field(default=None)   # เช่น "Öhlins", "YSS"
    shock_model: Optional[str] = Field(default=None)   # เช่น "STX 36", "G-Series"
    name: str
    rider_weight: float
    passenger_weight: float
    mode: str = Field(default="street")
    preload: float
    comp: int
    reb: int
    note: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

### API Change: `backend/app/routers/shock.py`

เปลี่ยนจาก `/api/shock-setting` → `/api/motorcycles/{bike_id}/shock-setting`

```
GET  /api/motorcycles/{bike_id}/shock-setting  → ShockSetting (auto-create ถ้าไม่มี)
PUT  /api/motorcycles/{bike_id}/shock-setting  → ShockSetting
```

ใช้ `get_motorcycle_for_user(bike_id, current_user, session)` สำหรับ ownership check

### API: ShockPreset เพิ่ม fields

`POST /api/shock-presets` request body เพิ่ม:
```typescript
shock_brand?: string
shock_model?: string
motorcycle_id?: number
```

### Frontend: `frontend/src/api/shock.ts`

```typescript
export const getShockSetting = (bikeId: number) =>
  client.get<ShockSetting>(`/api/motorcycles/${bikeId}/shock-setting`).then(r => r.data);

export const updateShockSetting = (bikeId: number, data: Partial<Omit<ShockSetting, "id">>) =>
  client.put<ShockSetting>(`/api/motorcycles/${bikeId}/shock-setting`, data).then(r => r.data);
```

### ShockSettingsPage.tsx — Bike Selector

เพิ่ม bike selector ด้านบนสุดของ ShockSettingsPage:
- ดึง motorcycles list จาก `GET /api/motorcycles`
- Dropdown/tabs เลือกรถ
- เมื่อเลือกรถ → load shock setting ของรถนั้น
- Default: รถคันแรก (หรือคันที่เคยเลือก ใช้ localStorage `lastSelectedBikeId`)

ShockPreset form เพิ่ม optional fields:
- `shock_brand` input
- `shock_model` input

### Migration

เพิ่มใน `backend/migrate_add_users.py` หรือสร้าง `backend/migrate_shock_per_bike.py`:

```python
# เพิ่ม motorcycle_id column ใน shock_settings และ shock_presets
# Assign existing shock_settings ให้ motorcycle แรกของ user นั้น
```

---

## File Summary

| Action | File |
|--------|------|
| Create | `frontend/src/pages/AuthPage.tsx` |
| Create | `frontend/src/components/ui/AvatarMenu.tsx` |
| Create | `frontend/src/components/ui/AccountModal.tsx` |
| Create | `frontend/src/components/ui/SettingsModal.tsx` |
| Create | `frontend/src/api/settings.ts` |
| Create | `backend/migrate_shock_per_bike.py` |
| Modify | `frontend/src/App.tsx` |
| Modify | `frontend/src/index.css` |
| Modify | `frontend/src/api/auth.ts` |
| Modify | `frontend/src/api/shock.ts` |
| Modify | `frontend/src/api/shock_presets.ts` |
| Modify | `frontend/src/pages/ShockSettingsPage.tsx` |
| Modify | `backend/app/models.py` |
| Modify | `backend/app/routers/auth.py` |
| Modify | `backend/app/routers/shock.py` |
| Modify | `backend/app/routers/shock_presets.py` |
| Delete | `frontend/src/pages/LoginPage.tsx` |
| Delete | `frontend/src/pages/RegisterPage.tsx` |

---

## Out of Scope (Future)

- Shock brand/model catalog table (`ShockModel`, `ShockBrand`)
- Compatibility matrix (shock X works best with bike Y)
- Forgot password flow
- OAuth login
