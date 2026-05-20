# Design: Auth UI + ShockSetting Per Motorcycle

**Date:** 2026-05-20 (revised after mockup review)
**Scope:** Auth page, avatar dropdown, account modal, settings page, shock brand theming, ShockSetting per motorcycle

---

## Goals

1. Auth page สวยงาม consistent กับ Jelly Glass design system
2. Avatar dropdown ใน NavBar แทนปุ่ม 🚪 เดิม
3. Modal สำหรับ Manage Account (email / password)
4. **Settings = หน้าแยก `/settings`** (ไม่ใช่ modal) — unit, timezone, และ shock brand/model ต่อคัน
5. ShockSettingsPage แสดง brand banner + accent color ของโช้คที่คันนั้นใช้
6. ShockSetting ผูกกับรถแต่ละคัน (motorcycle_id FK)
7. ShockBrand table เก็บ logo + accent color — admin upload ได้

---

## CSS Constraint

**ทุก component ใหม่ใช้ CSS variables จาก Jelly Glass เท่านั้น:**

```css
--canvas, --surface, --elevated, --glass-bg, --glass-border
--purple, --purple-hover, --purple-bg, --purple-border   ← ปุ่มหลัก / active tab ทุกหน้า
--ink, --slate, --steel, --muted
--hairline, --hairline-strong
--red, --red-bg
--green, --green-bg, --green-border                      ← สถานะ OK เท่านั้น ไม่ใช่ปุ่ม
--r, --r-md, --r-lg, --r-full
```

**Brand accent (เฉพาะ ShockSettingsPage):**
```css
--brand-accent      /* hex จาก ShockBrand.accent_color */
--brand-accent-bg   /* rgba ที่ opacity 0.14 */
--brand-accent-border /* rgba ที่ opacity 0.40 */
--brand-accent-glow   /* rgba ที่ opacity 0.28 */
--brand-banner-bg   /* hex จาก ShockBrand.banner_bg_color */
```
ตั้งค่าผ่าน `style` attribute บน container ของ ShockSettingsPage เท่านั้น  
ห้าม hardcode สี hex ใหม่ในไฟล์ `.tsx` หรือ `.css`

**กฎปุ่ม:** ปุ่ม submit / save ทุกหน้าใช้ `.btn.btn-primary` (purple) ยกเว้น ShockSettingsPage ใช้ `.btn-brand` ที่อ่านค่าจาก `--brand-accent`

---

## Part 1: Auth Page

### Route
- `/login` — AuthPage (Login tab + Register tab รวมกัน)
- `/register` → redirect ไป `/login`
- ลบ `LoginPage.tsx` และ `RegisterPage.tsx` ออก

### Component: `frontend/src/pages/AuthPage.tsx`

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
  │  [Submit]  ← btn-primary    │
  └─────────────────────────────┘
```

- Active tab: `background: var(--purple-bg)`, `color: var(--purple)`, `border: 1px solid var(--purple-border)`
- Inactive tab: `color: var(--slate)`
- Submit button: `.btn.btn-primary` (purple)
- Error text: `color: var(--red)`
- Input: `background: var(--surface)`, `border: 1px solid var(--glass-border)`
- Input focus: `border-color: var(--purple-border)`
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
.auth-tab.active { background:var(--purple-bg); color:var(--purple);
                   border:1px solid var(--purple-border); font-weight:600; }
.auth-form { display:flex; flex-direction:column; gap:0.625rem; }
.auth-form label { display:flex; flex-direction:column; gap:0.25rem; font-size:0.875rem; color:var(--slate); }
.auth-form input { padding:0.6rem 0.8rem; border-radius:var(--r); border:1px solid var(--glass-border);
                   background:var(--surface); color:var(--ink); font-size:1rem; }
.auth-form input:focus { outline:none; border-color:var(--purple-border); }
.auth-error { color:var(--red); font-size:0.875rem; margin:0; }
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
│ user@example.com       │
├────────────────────────┤
│ 👤  Manage Account     │  → เปิด AccountModal
│ ⚙️  Settings           │  → navigate ไป /settings
├────────────────────────┤
│ 🚪  Logout             │  → clear token + redirect /login
└────────────────────────┘
```

- Dropdown: `background: var(--elevated)`, `border: 1px solid var(--glass-border)`
- Hover item: `background: var(--surface)`
- Logout item: `color: var(--red)`
- **Settings item navigate ไป `/settings`** (ไม่ใช่ modal)

### App.tsx changes

- ลบปุ่ม 🚪 เดิมออกจาก NavBar
- เพิ่ม `<AvatarMenu />` แทน (render เฉพาะตอน authenticated)
- NavBar ไม่ render ใน `/login` และ `/register`

---

## Part 3: Account Modal

### Component: `frontend/src/components/ui/AccountModal.tsx`

Modal overlay: `background: rgba(0,0,0,0.6)`, click backdrop → ปิด

Tabs: **Email** | **Password** (ใช้ `.auth-tabs` / `.auth-tab` เหมือน AuthPage — purple active)

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

ปุ่ม Submit: `.btn.btn-primary`

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

## Part 4: Settings Page

### Route: `/settings` (protected, แยกจาก landing)

### Component: `frontend/src/pages/SettingsPage.tsx`

```
NavBar: ← กลับ  |  ⚙️ Settings
─────────────────────────────────
ส่วนที่ 1: ทั่วไป
  Distance Unit  [km] [miles]
  Timezone       Asia/Bangkok

ส่วนที่ 2: Shock Setup ต่อคัน
  ┌─ Honda CB500X ─────── แก้ไข ─┐
  │  Profender · P-Series         │
  └───────────────────────────────┘
  ┌─ Yamaha MT-07 ──────── แก้ไข ─┐
  │  Öhlins · STX 36              │
  └───────────────────────────────┘

[Save Settings]  ← btn-primary
```

- Load จาก `GET /api/settings` + `GET /api/motorcycles` + `GET /api/motorcycles/{id}/shock-setting` ทุกคัน
- กด "แก้ไข" ข้างรถ → navigate ไป `/settings/bikes/{bikeId}/shock` (sub-route)
- Save → `PUT /api/settings` (unit + timezone เท่านั้น, shock save แยก)

### Sub-page: `frontend/src/pages/ShockSetupPage.tsx`

Route: `/settings/bikes/:bikeId/shock`

```
NavBar: ← Settings  |  Shock Setup
── Honda CB500X ──────────────────
Step 1: Shock Brand
  [Profender] [Öhlins] [YSS] [Stock]

Step 2: Shock Model  (แสดงหลังเลือก brand)
  [P-Series] [G30]

[บันทึก]  ← btn-primary
```

- Load brands จาก `GET /api/shock-brands`
- Load current setting จาก `GET /api/motorcycles/{bikeId}/shock-setting`
- Step 2 แสดงเฉพาะ models ของ brand ที่เลือก
- Save → `PUT /api/motorcycles/{bikeId}/shock-setting` `{ shock_brand, shock_model }`

### Frontend: `frontend/src/api/settings.ts`

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

## Part 5: ShockBrand System

### Model: `backend/app/models.py`

```python
class ShockBrand(SQLModel, table=True):
    __tablename__ = "shock_brands"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)            # "Profender", "Öhlins", "YSS", "Stock"
    accent_color: str = Field(default="#a78bfa")   # hex ใช้สร้าง --brand-accent
    banner_bg_color: str = Field(default="#09091a") # hex พื้นหลัง banner
    header_image_path: Optional[str] = Field(default=None)  # relative path ใน static/
    models: Optional[str] = Field(default=None)   # JSON array เช่น '["P-Series","G30"]'
```

### API: `backend/app/routers/shock_brands.py` (ไฟล์ใหม่)

```
GET  /api/shock-brands              → list ทุก brand (public, ไม่ต้อง auth)
GET  /api/shock-brands/{id}         → detail + models list
PUT  /api/admin/shock-brands/{id}/image  → upload logo (multipart, admin only)
```

`GET /api/shock-brands` response:
```json
[
  {
    "id": 1, "name": "Profender",
    "accent_color": "#e8251a", "banner_bg_color": "#000000",
    "header_image_url": "/static/brands/profender.png",
    "models": ["P-Series", "G30"]
  }
]
```

Admin auth: ตรวจสอบ `current_user.is_admin` — เพิ่ม field `is_admin: bool = Field(default=False)` ใน `User` model

Image upload: เก็บที่ `backend/static/brands/{filename}`, serve ผ่าน `StaticFiles` mount ที่ `/static`

### Frontend: `frontend/src/api/shockBrands.ts` (ไฟล์ใหม่)

```typescript
export interface ShockBrand {
  id: number;
  name: string;
  accent_color: string;
  banner_bg_color: string;
  header_image_url: string | null;
  models: string[];
}

export const fetchShockBrands = () =>
  client.get<ShockBrand[]>("/api/shock-brands").then(r => r.data);
```

---

## Part 6: ShockSetting Per Motorcycle (Updated)

### Schema: `backend/app/models.py`

**ShockSetting** — เพิ่ม `motorcycle_id`, `shock_brand`, `shock_model`:
```python
class ShockSetting(SQLModel, table=True):
    __tablename__ = "shock_settings"
    id: Optional[int] = Field(default=None, primary_key=True)
    motorcycle_id: Optional[int] = Field(default=None, foreign_key="motorcycles.id", index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    rider_weight: float = Field(default=75.0)
    passenger_weight: float = Field(default=0.0)
    mode: str = Field(default="street")
    shock_brand: Optional[str] = Field(default=None)   # "Profender", "Öhlins", "YSS"
    shock_model: Optional[str] = Field(default=None)   # "P-Series", "STX 36"
```

**ShockPreset** — เพิ่ม fields:
```python
class ShockPreset(SQLModel, table=True):
    __tablename__ = "shock_presets"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    motorcycle_id: Optional[int] = Field(default=None, foreign_key="motorcycles.id", index=True)
    shock_brand: Optional[str] = Field(default=None)
    shock_model: Optional[str] = Field(default=None)
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

### API: `backend/app/routers/shock.py`

เปลี่ยนจาก `/api/shock-setting` → `/api/motorcycles/{bike_id}/shock-setting`

```
GET  /api/motorcycles/{bike_id}/shock-setting  → ShockSetting (auto-create ถ้าไม่มี)
PUT  /api/motorcycles/{bike_id}/shock-setting  → ShockSetting
```

### Frontend: ShockSettingsPage Brand Theming

`ShockSettingsPage.tsx` — logic หลัก:

1. Load `selectedBikeId` จาก localStorage `lastSelectedBikeId` (default รถแรก)
2. Load `GET /api/motorcycles/{bikeId}/shock-setting` → ได้ `shock_brand`
3. Load `GET /api/shock-brands` → หา brand record ที่ตรงกับ `shock_brand`
4. ถ้าเจอ brand → set CSS variables บน container:
   ```tsx
   const brandStyle = brand ? {
     "--brand-accent": brand.accent_color,
     "--brand-accent-bg": hexToRgba(brand.accent_color, 0.14),
     "--brand-accent-border": hexToRgba(brand.accent_color, 0.40),
     "--brand-accent-glow": hexToRgba(brand.accent_color, 0.28),
     "--brand-banner-bg": brand.banner_bg_color,
   } as React.CSSProperties : {};
   ```
5. ถ้าไม่มี brand → ไม่มี banner, ใช้ `--purple` ปกติ

Banner (แสดงเฉพาะมี `header_image_url`):
```tsx
{brand?.header_image_url && (
  <div className="shock-brand-banner" style={{ background: "var(--brand-banner-bg)" }}>
    <img src={brand.header_image_url} alt={brand.name} />
    <div className="shock-brand-banner-fade" />
  </div>
)}
```

Navbar left-edge tint (เฉพาะ ShockSettingsPage):
```css
.shock-page-nav::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--brand-accent, var(--purple));
}
```

Bike selector chips + step numbers + save button ใช้ `--brand-accent` ผ่าน class `.btn-brand`:
```css
.btn-brand {
  background: var(--brand-accent, var(--purple));
  color: #fff;
  box-shadow: 0 4px 16px var(--brand-accent-glow, rgba(167,139,250,0.30));
}
.chip-brand-active {
  background: var(--brand-accent-bg, var(--purple-bg));
  border: 1px solid var(--brand-accent-border, var(--purple-border));
  color: var(--brand-accent, var(--purple));
}
```

### Frontend: `frontend/src/api/shock.ts`

```typescript
export const getShockSetting = (bikeId: number) =>
  client.get<ShockSetting>(`/api/motorcycles/${bikeId}/shock-setting`).then(r => r.data);

export const updateShockSetting = (bikeId: number, data: Partial<Omit<ShockSetting, "id">>) =>
  client.put<ShockSetting>(`/api/motorcycles/${bikeId}/shock-setting`, data).then(r => r.data);
```

### Migration: `backend/migrate_shock_per_bike.py`

```python
# 1. ALTER TABLE shock_settings ADD COLUMN motorcycle_id INTEGER REFERENCES motorcycles(id)
# 2. ALTER TABLE shock_settings ADD COLUMN shock_brand TEXT
# 3. ALTER TABLE shock_settings ADD COLUMN shock_model TEXT
# 4. UPDATE shock_settings SET motorcycle_id = (
#      SELECT id FROM motorcycles WHERE user_id = shock_settings.user_id LIMIT 1
#    )
# 5. ALTER TABLE shock_presets ADD COLUMN motorcycle_id INTEGER REFERENCES motorcycles(id)
# 6. ALTER TABLE shock_presets ADD COLUMN shock_brand TEXT
# 7. ALTER TABLE shock_presets ADD COLUMN shock_model TEXT
# 8. CREATE TABLE shock_brands (...) และ seed ข้อมูลเริ่มต้น
# 9. ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0
```

---

## File Summary

| Action | File |
|--------|------|
| Create | `frontend/src/pages/AuthPage.tsx` |
| Create | `frontend/src/pages/SettingsPage.tsx` |
| Create | `frontend/src/pages/ShockSetupPage.tsx` |
| Create | `frontend/src/components/ui/AvatarMenu.tsx` |
| Create | `frontend/src/components/ui/AccountModal.tsx` |
| Create | `frontend/src/api/settings.ts` |
| Create | `frontend/src/api/shockBrands.ts` |
| Create | `backend/app/routers/shock_brands.py` |
| Create | `backend/migrate_shock_per_bike.py` |
| Create | `backend/static/brands/` (directory) |
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
| Modify | `backend/app/main.py` (register shock_brands router + StaticFiles) |
| Delete | `frontend/src/pages/LoginPage.tsx` |
| Delete | `frontend/src/pages/RegisterPage.tsx` |

---

## Out of Scope (Future)

- Weight calculation logic → recommended preload/comp/reb อัตโนมัติ
- Shock compatibility matrix (shock X กับ bike Y)
- Forgot password flow
- OAuth login
- Full admin dashboard (ตอนนี้ admin upload image ผ่าน API โดยตรง)
