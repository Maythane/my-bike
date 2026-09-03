# Account Page & Username-First Registration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AccountModal with a full `/account` page (Hero + grouped sections), and change registration to require username instead of email (email becomes optional).

**Architecture:** Backend makes `User.email` nullable via a SQLite table-recreation migration, and updates `/register` to accept `username` as the required identifier. Frontend creates `AccountPage.tsx` as a standalone page following the same pattern as `SettingsPage.tsx`, replaces AccountModal's modal with page navigation, and rewrites the register form to be username-first.

**Tech Stack:** FastAPI + SQLModel + SQLite (backend), React 19 + TanStack Query + React Router (frontend), Jelly Glass CSS design system (`index.css`).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/app/models.py` | Modify | `User.email → Optional[str]` |
| `backend/app/database.py` | Modify | Add `_migrate_email_optional()` |
| `backend/app/routers/auth.py` | Modify | `RegisterRequest` username-first, `UserRead.email` optional, update `/register` |
| `frontend/src/api/auth.ts` | Modify | `UserInfo.email: string \| null`, `fetchRegister(username, password, email?)` |
| `frontend/src/hooks/useAuth.ts` | Modify | `register(username, password, email?)` |
| `frontend/src/pages/AuthPage.tsx` | Modify | Register form: username required, email optional |
| `frontend/src/index.css` | Modify | Add `.acct-hero`, `.acct-page-section`, `.acct-page-row*` CSS |
| `frontend/src/pages/AccountPage.tsx` | **Create** | Full account management page |
| `frontend/src/components/ui/AvatarMenu.tsx` | Modify | Remove modal state, navigate to `/account` |
| `frontend/src/App.tsx` | Modify | Add `/account` route |
| `frontend/src/components/ui/AccountModal.tsx` | **Delete** | Replaced by AccountPage |

---

## Task 1: Backend — Make User.email nullable

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/database.py`

- [ ] **Step 1: Update User model**

In `backend/app/models.py`, change the `User` class:

```python
# Before
email: str = Field(unique=True, index=True)

# After
email: Optional[str] = Field(default=None, unique=True, index=True)
```

- [ ] **Step 2: Add migration function to database.py**

In `backend/app/database.py`, add before `create_db()`:

```python
def _migrate_email_optional():
    """Make users.email nullable (idempotent). SQLite requires table recreation."""
    with engine.connect() as conn:
        info = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        col = next((r for r in info if r[1] == "email"), None)
        if col is None or col[3] == 0:
            return  # column missing or already nullable
        conn.execute(text("PRAGMA foreign_keys = OFF"))
        conn.execute(text("""
            CREATE TABLE users_new (
                id INTEGER PRIMARY KEY,
                email TEXT UNIQUE,
                hashed_password TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                is_admin INTEGER NOT NULL DEFAULT 0,
                username TEXT UNIQUE,
                phone TEXT UNIQUE,
                phone_verified INTEGER NOT NULL DEFAULT 0,
                display_name TEXT,
                avatar_url TEXT,
                created_at DATETIME NOT NULL
            )
        """))
        conn.execute(text("""
            INSERT INTO users_new
            SELECT id, email, hashed_password, is_active, is_admin,
                   username, phone, phone_verified, display_name, avatar_url, created_at
            FROM users
        """))
        conn.execute(text("DROP TABLE users"))
        conn.execute(text("ALTER TABLE users_new RENAME TO users"))
        conn.execute(text("PRAGMA foreign_keys = ON"))
        conn.commit()
```

- [ ] **Step 3: Call migration in create_db()**

```python
def create_db():
    SQLModel.metadata.create_all(engine)
    _migrate()
    _migrate_shock_per_bike()
    _migrate_shock_charts()
    _migrate_images()
    _migrate_reminders()
    _migrate_expenses()
    _migrate_user_profile()
    _migrate_email_optional()   # ← add this line
```

- [ ] **Step 4: Verify migration runs cleanly**

Restart backend and check no errors in stdout:
```bash
DB_PATH=/Users/mark/my-work-space/My-Project/My-bike/data/moto.db \
  /Users/mark/my-work-space/My-Project/My-bike/backend/.venv/bin/uvicorn app.main:app \
  --host 0.0.0.0 --port 8764 --reload --app-dir /Users/mark/my-work-space/My-Project/My-bike/backend
```

Expected: server starts, no migration errors, existing users still queryable.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/app/database.py
git commit -m "feat: make User.email nullable with SQLite migration"
```

---

## Task 2: Backend — Username-first register endpoint

**Files:**
- Modify: `backend/app/routers/auth.py`

- [ ] **Step 1: Update RegisterRequest and UserRead**

In `backend/app/routers/auth.py`, replace the existing `RegisterRequest` and `UserRead` classes:

```python
class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class UserRead(BaseModel):
    id: int
    email: Optional[str] = None          # was: email: str
    username: Optional[str] = None
    phone: Optional[str] = None
    phone_verified: bool = False
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Rewrite /register endpoint**

Replace the existing `register` function:

```python
@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: RegisterRequest, session: Session = Depends(get_session)):
    if not re.match(r'^[a-zA-Z0-9_]{3,30}$', data.username):
        raise HTTPException(status_code=422, detail="Username ต้องใช้ a–z, 0–9, _ · 3–30 ตัวอักษร")
    if session.exec(select(User).where(User.username == data.username)).first():
        raise HTTPException(status_code=409, detail="Username นี้ถูกใช้แล้ว")
    if len(data.password) < 8:
        raise HTTPException(status_code=422, detail="Password ต้องมีอย่างน้อย 8 ตัวอักษร")

    email: Optional[str] = None
    if data.email and data.email.strip():
        email = data.email.lower().strip()
        if session.exec(select(User).where(User.email == email)).first():
            raise HTTPException(status_code=409, detail="Email นี้ถูกใช้แล้ว")

    user = User(
        username=data.username,
        email=email,
        hashed_password=hash_password(data.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    _seed_user_defaults(user, session)
    return TokenResponse(access_token=create_access_token(user.id))
```

- [ ] **Step 3: Test register via curl**

```bash
curl -s -X POST http://localhost:8764/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser99","password":"password123"}' | python3 -m json.tool
```

Expected: `{"access_token": "...", "token_type": "bearer"}`

```bash
# Test duplicate username rejection
curl -s -X POST http://localhost:8764/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser99","password":"password123"}' | python3 -m json.tool
```

Expected: `{"detail": "Username นี้ถูกใช้แล้ว"}`

```bash
# Test with email
curl -s -X POST http://localhost:8764/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser100","password":"password123","email":"test100@example.com"}' | python3 -m json.tool
```

Expected: `{"access_token": "...", "token_type": "bearer"}`

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/auth.py
git commit -m "feat: register with username, email optional"
```

---

## Task 3: Frontend — api/auth.ts + useAuth.ts

**Files:**
- Modify: `frontend/src/api/auth.ts`
- Modify: `frontend/src/hooks/useAuth.ts`

- [ ] **Step 1: Update UserInfo and fetchRegister in api/auth.ts**

```typescript
// Change email field in UserInfo interface
export interface UserInfo {
  id: number;
  email: string | null;          // was: string
  username: string | null;
  phone: string | null;
  phone_verified: boolean;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

// Replace fetchRegister function
export async function fetchRegister(
  username: string,
  password: string,
  email?: string,
): Promise<TokenResponse> {
  const body: Record<string, string> = { username, password };
  if (email) body.email = email;
  const { data } = await client.post<TokenResponse>("/api/auth/register", body);
  return data;
}
```

- [ ] **Step 2: Update useAuth.ts register signature**

In `frontend/src/hooks/useAuth.ts`, update the import and `register` function:

```typescript
import { fetchLogin, fetchRegister, otpLogin } from "../api/auth";

// Replace register function inside useAuth()
async function register(username: string, password: string, email?: string): Promise<void> {
  const { access_token } = await fetchRegister(username, password, email);
  setToken(access_token);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/auth.ts frontend/src/hooks/useAuth.ts
git commit -m "feat: update fetchRegister and useAuth for username-first"
```

---

## Task 4: Frontend — AuthPage register form

**Files:**
- Modify: `frontend/src/pages/AuthPage.tsx`

- [ ] **Step 1: Add state fields for register**

In `AuthPage`, add three new state variables alongside the existing ones:

```typescript
const [username, setUsername] = useState("");
const [regEmail, setRegEmail] = useState("");
const [showRegEmail, setShowRegEmail] = useState(false); // not needed, email shown always
```

Actually just add:
```typescript
const [username, setUsername] = useState("");
const [regEmail, setRegEmail] = useState("");
```

- [ ] **Step 2: Update handleSubmit register branch**

In `handleSubmit`, replace the register branch:

```typescript
} else {
  await register(username.trim(), password, regEmail.trim() || undefined);
}
```

- [ ] **Step 3: Replace register tab form fields**

Replace the register form content (from `<form onSubmit={handleSubmit}` to `</form>` in the register tab):

```tsx
<form onSubmit={handleSubmit} className="auth-form">
  <div className="auth-field">
    <label htmlFor="reg-username">Username <span style={{ color: "var(--purple)" }}>*</span></label>
    <input
      id="reg-username"
      className="auth-input"
      type="text"
      value={username}
      onChange={(e) => { setUsername(e.target.value); setError(null); }}
      placeholder="rider_mark"
      pattern="[a-zA-Z0-9_]+"
      minLength={3}
      maxLength={30}
      required
      autoFocus
      autoComplete="username"
    />
    <p style={{ fontSize: 11, color: "var(--slate)", margin: "2px 0 0" }}>a–z, 0–9, _ · 3–30 ตัวอักษร</p>
  </div>

  <div className="auth-field">
    <label htmlFor="reg-password">Password <span style={{ color: "var(--purple)" }}>*</span></label>
    <div className="auth-input-wrap">
      <input
        id="reg-password"
        className="auth-input auth-input--icon-right"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="อย่างน้อย 8 ตัวอักษร"
        minLength={8}
        required
        autoComplete="new-password"
      />
      <button type="button" className="auth-eye-btn"
        onClick={() => setShowPassword((v) => !v)}
        aria-label={showPassword ? "ซ่อน password" : "แสดง password"}>
        {showPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
      </button>
    </div>
  </div>

  <div className="auth-field">
    <label htmlFor="reg-confirm">ยืนยัน Password <span style={{ color: "var(--purple)" }}>*</span></label>
    <div className="auth-input-wrap">
      <input
        id="reg-confirm"
        className="auth-input auth-input--icon-right"
        type={showConfirm ? "text" : "password"}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />
      <button type="button" className="auth-eye-btn"
        onClick={() => setShowConfirm((v) => !v)}
        aria-label={showConfirm ? "ซ่อน password" : "แสดง password"}>
        {showConfirm ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
      </button>
    </div>
  </div>

  <div className="auth-field">
    <label htmlFor="reg-email" style={{ display: "flex", gap: 6, alignItems: "center" }}>
      Email
      <span style={{ fontSize: 11, color: "var(--steel)", fontWeight: 400 }}>(ไม่บังคับ)</span>
    </label>
    <input
      id="reg-email"
      className="auth-input"
      type="email"
      value={regEmail}
      onChange={(e) => setRegEmail(e.target.value)}
      placeholder="email@example.com"
      autoComplete="email"
      style={{ borderStyle: "dashed", opacity: 0.8 }}
    />
    <p style={{ fontSize: 11, color: "var(--slate)", margin: "2px 0 0" }}>แนะนำ — ใช้กู้รหัสผ่าน, เพิ่มทีหลังได้ใน Account</p>
  </div>

  {error && <p className="auth-error">{error}</p>}

  <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
    {loading ? "กำลังดำเนินการ…" : "สร้างบัญชี"}
    {!loading && <ArrowRightIcon width={16} height={16} />}
  </button>
</form>
```

Also remove the `agreeTerms` state, `setAgreeTerms`, and the checkbox that references it — it's no longer in the form.

- [ ] **Step 4: Build to check for TypeScript errors**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend && npm run build 2>&1 | tail -20
```

Expected: `✓ built in ...ms` with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AuthPage.tsx
git commit -m "feat: register form — username required, email optional"
```

---

## Task 5: Frontend CSS — Account page styles

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add account page CSS at end of index.css**

Append the following after all existing CSS (before the final closing brace if any, or at end of file):

```css
/* ─── Account Page ───────────────────────────────────────────────────────── */

.acct-hero {
  background: linear-gradient(135deg, rgba(124,58,237,0.22), rgba(79,70,229,0.14));
  border: 1px solid rgba(124,58,237,0.28);
  border-radius: var(--r-lg);
  padding: 20px 16px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  text-align: center;
}

.acct-hero-avatar-btn {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: visible;
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
  flex-shrink: 0;
}

.acct-hero-avatar-btn img,
.acct-hero-avatar-inner {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--purple);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
}

.acct-hero-avatar-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--elevated);
  border: 2px solid var(--canvas);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--slate);
  pointer-events: none;
}

.acct-hero-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.2;
}

.acct-hero-username {
  font-size: 12px;
  color: var(--purple);
  margin-top: 2px;
}

.acct-group-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--steel);
  margin: 0 0 6px 4px;
}

.acct-page-section {
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  overflow: hidden;
  margin-bottom: 20px;
}

.acct-page-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--hairline);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s;
}

.acct-page-row:last-child {
  border-bottom: none;
}

.acct-page-row:active {
  background: var(--elevated);
}

.acct-page-row-label {
  font-size: 13px;
  color: var(--slate);
  min-width: 90px;
  flex-shrink: 0;
}

.acct-page-row-value {
  flex: 1;
  font-size: 13px;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acct-page-row-value em {
  color: var(--steel);
  font-style: normal;
}

.acct-page-add-badge {
  font-size: 11px;
  color: var(--purple);
  background: var(--purple-bg);
  border: 1px solid var(--purple-border);
  border-radius: var(--r);
  padding: 2px 8px;
  flex-shrink: 0;
}

.acct-page-row-body {
  padding: 12px 14px 14px;
  border-bottom: 1px solid var(--hairline);
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--surface-soft);
}

.acct-page-row-body:last-child {
  border-bottom: none;
}

.acct-page-row-body .auth-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

html.light .acct-hero {
  background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(79,70,229,0.07));
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add account page CSS tokens"
```

---

## Task 6: Frontend — AccountPage.tsx (new file)

**Files:**
- Create: `frontend/src/pages/AccountPage.tsx`

- [ ] **Step 1: Create AccountPage.tsx**

Create `frontend/src/pages/AccountPage.tsx` with the following content:

```tsx
import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import {
  fetchMe,
  fetchUpdateDisplayName,
  fetchUpdateEmail,
  fetchUpdatePassword,
  fetchUpdateUsername,
  fetchUploadAvatar,
  fetchRequestPhone,
  fetchConfirmPhone,
} from "../api/auth";
import { useAuth } from "../hooks/useAuth";
import ImageCropper from "../components/ui/ImageCropper";
import EyeIcon from "../components/ui/EyeIcon";

type Section = "displayName" | "username" | "email" | "password" | "phone";

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export default function AccountPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { logout } = useAuth();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });

  // Avatar state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const cropSrcRef = useRef<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // Section accordion
  const [open, setOpen] = useState<Section | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Field values (populated when section opens)
  const [displayName, setDisplayName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => () => {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
  }, []);

  function reset() {
    setError(null); setSuccess(null); setLoading(false);
    setDisplayName(""); setNewUsername(""); setNewEmail("");
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    setPhone(""); setOtpCode(""); setOtpSent(false); setCountdown(0);
  }

  function toggleSection(s: Section, onOpen?: () => void) {
    if (open === s) { setOpen(null); reset(); return; }
    reset();
    setOpen(s);
    onOpen?.();
  }

  // Avatar handlers
  function handleAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    const src = URL.createObjectURL(file);
    cropSrcRef.current = src;
    setCropSrc(src);
    e.target.value = "";
  }

  async function handleAvatarCropConfirm(blob: Blob) {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    cropSrcRef.current = null;
    setCropSrc(null);
    setAvatarLoading(true);
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      await fetchUploadAvatar(file);
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch {
      // silent — avatar just doesn't update
    } finally {
      setAvatarLoading(false);
    }
  }

  function handleAvatarCropCancel() {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    cropSrcRef.current = null;
    setCropSrc(null);
  }

  function safeError(err: unknown): string {
    const detail = (err as any)?.response?.data?.detail;
    return typeof detail === "string" ? detail : "เกิดข้อผิดพลาด";
  }

  async function handleDisplayNameSave(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      await fetchUpdateDisplayName(displayName.trim());
      qc.invalidateQueries({ queryKey: ["me"] });
      setSuccess("อัปเดตแล้ว");
      setTimeout(() => { setOpen(null); reset(); }, 900);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  async function handleUsernameSave(e: FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      await fetchUpdateUsername(newUsername.trim());
      qc.invalidateQueries({ queryKey: ["me"] });
      setSuccess("อัปเดตแล้ว");
      setTimeout(() => { setOpen(null); reset(); }, 900);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  async function handleEmailSave(e: FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      await fetchUpdateEmail(newEmail.trim());
      qc.invalidateQueries({ queryKey: ["me"] });
      setSuccess("อัปเดตแล้ว");
      setTimeout(() => { setOpen(null); reset(); }, 900);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { setError("Password ใหม่ไม่ตรงกัน"); return; }
    if (loading) return;
    setLoading(true); setError(null);
    try {
      await fetchUpdatePassword(currentPw, newPw);
      setSuccess("เปลี่ยน password แล้ว");
      setTimeout(() => { setOpen(null); reset(); }, 900);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  async function handlePhoneSend() {
    if (!phone.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      await fetchRequestPhone(phone.trim());
      setOtpSent(true); setCountdown(300);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  async function handlePhoneConfirm(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError(null);
    try {
      await fetchConfirmPhone(phone.trim(), otpCode);
      qc.invalidateQueries({ queryKey: ["me"] });
      setSuccess("ยืนยันเบอร์โทรแล้ว");
      setTimeout(() => { setOpen(null); reset(); }, 900);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  const headingName = user?.display_name || (user?.username ? `@${user.username}` : (user?.email ?? "…"));
  const initial = (user?.display_name?.[0] ?? user?.username?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { document.documentElement.dataset.navDir = "back"; navigate(-1); }}
          aria-label="กลับ"
          style={{ padding: "6px 8px" }}
        >
          <BackIcon />
        </button>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>บัญชีของฉัน</h1>
      </div>

      {/* Hero */}
      <div className="acct-hero">
        <button
          className="acct-hero-avatar-btn"
          onClick={() => !avatarLoading && avatarInputRef.current?.click()}
          aria-label="เปลี่ยนรูปโปรไฟล์"
          disabled={avatarLoading}
        >
          {user?.avatar_url
            ? <img src={user.avatar_url} alt={headingName} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
            : <div className="acct-hero-avatar-inner">{initial}</div>
          }
          <span className="acct-hero-avatar-badge">✎</span>
        </button>
        <div>
          <div className="acct-hero-name">{headingName}</div>
          {user?.username && <div className="acct-hero-username">@{user.username}</div>}
        </div>
        {avatarLoading && <div style={{ fontSize: 12, color: "var(--slate)" }}>กำลังอัปโหลด…</div>}
      </div>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleAvatarFileChange}
      />

      {/* Section: บัญชี */}
      <div className="acct-group-label">บัญชี</div>
      <div className="acct-page-section">

        {/* Display name */}
        <div
          className="acct-page-row"
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("displayName", () => setDisplayName(user?.display_name ?? ""))}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("displayName", () => setDisplayName(user?.display_name ?? ""))}
        >
          <span className="acct-page-row-label">ชื่อที่แสดง</span>
          <span className="acct-page-row-value">{user?.display_name || <em>ยังไม่ได้ตั้ง</em>}</span>
          <ChevronIcon />
        </div>
        {open === "displayName" && (
          <div className="acct-page-row-body">
            <form onSubmit={handleDisplayNameSave} className="auth-form">
              <input
                className="auth-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                placeholder="ชื่อที่ต้องการแสดง"
                autoFocus
                required
              />
              {error && <p className="auth-error" role="alert">{error}</p>}
              {success && <p className="auth-success" role="status">{success}</p>}
              <button className="btn btn-primary btn-sm" disabled={loading}>
                {loading ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </form>
          </div>
        )}

        {/* Username */}
        <div
          className="acct-page-row"
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("username")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("username")}
        >
          <span className="acct-page-row-label">Username</span>
          <span className="acct-page-row-value">
            {user?.username ? `@${user.username}` : <em>ยังไม่ได้ตั้ง</em>}
          </span>
          <ChevronIcon />
        </div>
        {open === "username" && (
          <div className="acct-page-row-body">
            <form onSubmit={handleUsernameSave} className="auth-form">
              <input
                className="auth-input"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                pattern="[a-zA-Z0-9_]+"
                minLength={3}
                maxLength={30}
                placeholder="rider_mark"
                autoFocus
                required
              />
              <p style={{ fontSize: 11, color: "var(--slate)", margin: 0 }}>a–z, 0–9, _ · 3–30 ตัวอักษร</p>
              {error && <p className="auth-error" role="alert">{error}</p>}
              {success && <p className="auth-success" role="status">{success}</p>}
              <button className="btn btn-primary btn-sm" disabled={loading}>
                {loading ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </form>
          </div>
        )}

        {/* Email */}
        <div
          className="acct-page-row"
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("email")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("email")}
          style={{ borderBottom: "none" }}
        >
          <span className="acct-page-row-label">Email</span>
          <span className="acct-page-row-value">{user?.email || <em>ยังไม่ได้เพิ่ม</em>}</span>
          {!user?.email
            ? <span className="acct-page-add-badge">+ เพิ่ม</span>
            : <ChevronIcon />
          }
        </div>
        {open === "email" && (
          <div className="acct-page-row-body" style={{ borderTop: "1px solid var(--hairline)" }}>
            <form onSubmit={handleEmailSave} className="auth-form">
              <input
                className="auth-input"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={user?.email ?? "email@example.com"}
                autoFocus
                required
              />
              {error && <p className="auth-error" role="alert">{error}</p>}
              {success && <p className="auth-success" role="status">{success}</p>}
              <button className="btn btn-primary btn-sm" disabled={loading}>
                {loading ? "กำลังบันทึก…" : user?.email ? "อัปเดต Email" : "เพิ่ม Email"}
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Section: ความปลอดภัย */}
      <div className="acct-group-label">ความปลอดภัย</div>
      <div className="acct-page-section">

        {/* Password */}
        <div
          className="acct-page-row"
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("password")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("password")}
        >
          <span className="acct-page-row-label">Password</span>
          <span className="acct-page-row-value">••••••••</span>
          <ChevronIcon />
        </div>
        {open === "password" && (
          <div className="acct-page-row-body">
            <form onSubmit={handlePasswordSave} className="auth-form">
              <div className="pw-wrap">
                <input
                  className="auth-input"
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Password ปัจจุบัน"
                  autoFocus
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowCurrent((v) => !v)} aria-label="แสดง/ซ่อน">
                  <EyeIcon visible={showCurrent} />
                </button>
              </div>
              <div className="pw-wrap">
                <input
                  className="auth-input"
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Password ใหม่ (อย่างน้อย 8 ตัว)"
                  minLength={8}
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowNew((v) => !v)} aria-label="แสดง/ซ่อน">
                  <EyeIcon visible={showNew} />
                </button>
              </div>
              <div className="pw-wrap">
                <input
                  className="auth-input"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="ยืนยัน Password ใหม่"
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowConfirm((v) => !v)} aria-label="แสดง/ซ่อน">
                  <EyeIcon visible={showConfirm} />
                </button>
              </div>
              {error && <p className="auth-error" role="alert">{error}</p>}
              {success && <p className="auth-success" role="status">{success}</p>}
              <button className="btn btn-primary btn-sm" disabled={loading}>
                {loading ? "กำลังเปลี่ยน…" : "เปลี่ยน Password"}
              </button>
            </form>
          </div>
        )}

        {/* Phone */}
        <div
          className="acct-page-row"
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("phone")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("phone")}
          style={{ borderBottom: "none" }}
        >
          <span className="acct-page-row-label">เบอร์โทร</span>
          <span className="acct-page-row-value" style={user?.phone_verified ? { color: "var(--green)" } : undefined}>
            {user?.phone_verified ? user.phone : <em>ยังไม่ได้เพิ่ม</em>}
          </span>
          {!user?.phone_verified
            ? <span className="acct-page-add-badge">+ เพิ่ม</span>
            : <ChevronIcon />
          }
        </div>
        {open === "phone" && (
          <div className="acct-page-row-body" style={{ borderTop: "1px solid var(--hairline)" }}>
            {!otpSent ? (
              <div className="auth-form">
                <input
                  className="auth-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812345678"
                  autoFocus
                />
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handlePhoneSend}
                  disabled={loading || !phone.trim()}
                >
                  {loading ? "กำลังส่ง…" : "ส่ง OTP"}
                </button>
              </div>
            ) : (
              <form onSubmit={handlePhoneConfirm} className="auth-form">
                <p style={{ fontSize: 12, color: "var(--slate)", margin: 0 }}>
                  ส่ง OTP ไปที่ <strong style={{ color: "var(--ink)" }}>{phone}</strong>
                </p>
                <input
                  className="auth-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoFocus
                  required
                />
                <div className="auth-otp-hint">
                  {countdown > 0 ? `OTP หมดอายุใน ${mm}:${ss}` : "OTP หมดอายุแล้ว"}
                  {countdown === 0 && (
                    <button type="button" className="auth-resend-btn" onClick={handlePhoneSend} disabled={loading}>
                      ส่งใหม่
                    </button>
                  )}
                </div>
                {error && <p className="auth-error" role="alert">{error}</p>}
                {success && <p className="auth-success" role="status">{success}</p>}
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={loading || otpCode.length < 6 || countdown === 0}
                >
                  {loading ? "กำลังยืนยัน…" : "ยืนยัน"}
                </button>
              </form>
            )}
          </div>
        )}

      </div>

      {/* Logout */}
      <button
        className="btn btn-danger"
        style={{ width: "100%", marginTop: 8, marginBottom: 32 }}
        onClick={() => logout()}
      >
        ออกจากระบบ
      </button>

      {/* ImageCropper portal */}
      {cropSrc && createPortal(
        <ImageCropper
          src={cropSrc}
          aspectRatio={1}
          exportSize={512}
          quality={0.82}
          onConfirm={handleAvatarCropConfirm}
          onCancel={handleAvatarCropCancel}
        />,
        document.body
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend && npm run build 2>&1 | tail -15
```

Expected: `✓ built in ...ms`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AccountPage.tsx
git commit -m "feat: add AccountPage with hero profile + grouped sections"
```

---

## Task 7: Frontend — Wire up route and AvatarMenu

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/ui/AvatarMenu.tsx`

- [ ] **Step 1: Add /account route in App.tsx**

In `frontend/src/App.tsx`, add lazy import and route:

```tsx
// Add with other lazy imports (around line 14-17)
const AccountPage = lazy(() => import("./pages/AccountPage"));

// Add inside the authenticated <Routes> block, alongside other routes
<Route path="/account" element={<AccountPage />} />
```

- [ ] **Step 2: Update AvatarMenu.tsx — remove modal, add navigate**

In `frontend/src/components/ui/AvatarMenu.tsx`:

1. Remove import: `import AccountModal from "./AccountModal";`
2. Remove state: `const [showAccount, setShowAccount] = useState(false);`
3. Replace the "จัดการบัญชี" dropdown item:

```tsx
// Replace the onClick/onKeyDown handlers on the "จัดการบัญชี" item
<div
  className="avatar-dropdown-item"
  role="button"
  tabIndex={0}
  onClick={() => { setOpen(false); navigate("/account", { viewTransition: true }); }}
  onKeyDown={(e) => e.key === "Enter" && (setOpen(false), navigate("/account", { viewTransition: true }))}
>
  <IconUser /> จัดการบัญชี
</div>
```

4. Remove the portal at the bottom of the component's return:

```tsx
// Delete these lines entirely:
{showAccount && createPortal(
  <AccountModal onClose={() => setShowAccount(false)} />,
  document.body
)}
```

5. Remove `createPortal` import from react-dom (if no longer used):

```tsx
// Before: import { createPortal } from "react-dom";
// After: remove this import
```

- [ ] **Step 3: Build to verify**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend && npm run build 2>&1 | tail -10
```

Expected: `✓ built in ...ms`, no errors about missing AccountModal.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/ui/AvatarMenu.tsx
git commit -m "feat: wire /account route, AvatarMenu navigates to page"
```

---

## Task 8: Delete AccountModal and deploy

**Files:**
- Delete: `frontend/src/components/ui/AccountModal.tsx`

- [ ] **Step 1: Delete AccountModal.tsx**

```bash
git rm frontend/src/components/ui/AccountModal.tsx
```

- [ ] **Step 2: Final build verification**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend && npm run build 2>&1 | tail -10
```

Expected: `✓ built in ...ms`, no missing module errors.

- [ ] **Step 3: Deploy**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend && npm run deploy
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: remove AccountModal (replaced by AccountPage)"
```

---

## Task 9: Smoke Test

- [ ] **Test: Register new user (username only)**

Open `http://localhost:8764/login` → switch to "สร้างบัญชีใหม่"
- Fill: username=`smoketest1`, password=`test1234!!`
- Leave email blank
- Click "สร้างบัญชี"
- Expected: redirects to `/` (Garage page)

- [ ] **Test: Account page accessible**

Click avatar in top-right → "จัดการบัญชี"
- Expected: navigates to `/account`
- Expected: Hero shows "smoketest1" (no display name yet), no email row shows "ยังไม่ได้เพิ่ม"

- [ ] **Test: Add email from Account page**

On `/account`, click Email row → type valid email → click "เพิ่ม Email"
- Expected: success message, email row updates

- [ ] **Test: Change display name**

On `/account`, click "ชื่อที่แสดง" → type name → "บันทึก"
- Expected: hero updates with new name

- [ ] **Test: Avatar upload**

On `/account`, tap avatar circle → select image → crop → confirm
- Expected: avatar uploads, hero shows new image immediately

- [ ] **Test: Existing user (email-based) login still works**

Login with `maythane.psb@gmail.com` + password
- Expected: login succeeds, redirects to Garage

- [ ] **Final commit**

```bash
git add -A && git commit -m "chore: smoke test verified — account page + username registration"
```
