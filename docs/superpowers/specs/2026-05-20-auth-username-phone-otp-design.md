# Auth: Username / Phone OTP Login + Account Settings Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to log in with email, username, or phone number (OTP); let users set username and verified phone in account settings; fix avatar dropdown CSS on mobile.

**Architecture:** Auto-detect login identifier type on the frontend; backend login endpoint accepts a single `identifier` field and routes accordingly. OTP is stored in-memory with a 5-minute TTL (mock phase — SMS logged to console). Phone and username are optional fields on the User model added via idempotent migration.

**Tech Stack:** FastAPI + SQLModel + SQLite (backend), React 19 + TypeScript + TanStack Query v5 (frontend), existing Jelly Glass CSS system.

---

## Scope

Three loosely-coupled changes shipped together:

1. **Username login** — optional `username` field on User; login accepts email or username
2. **Phone + OTP login** — optional `phone` field on User; OTP-based login and phone verification flow; SMS mocked to console
3. **Dropdown CSS fix** — avatar dropdown background too transparent on mobile

---

## Backend Design

### User Model (`backend/app/models.py`)

Add two nullable unique fields:

```python
username: Optional[str] = Field(default=None, unique=True, index=True)
phone:    Optional[str] = Field(default=None, unique=True, index=True)
phone_verified: bool    = Field(default=False)
```

### Migration (`backend/app/database.py`)

Add to the startup migration using existing `col_exists()` pattern:

```sql
ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN phone TEXT UNIQUE;
ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
```

No backfill needed — all new fields are nullable/defaulted.

### OTP Storage (`backend/app/routers/auth.py`)

In-memory dict, module-level. Keys are prefixed to avoid collision between login OTP and phone-verification OTP:

```python
_otp_store: dict[str, tuple[str, datetime]] = {}
# key: "login:{phone}" or "verify:{phone}", value: (otp_code, expires_at)
OTP_TTL_SECONDS = 300  # 5 minutes
```

Mock send function:
```python
def _send_otp(phone: str, code: str) -> None:
    print(f"[OTP MOCK] {phone} → {code}", flush=True)
```

### Updated `UserRead` Response

```python
class UserRead(BaseModel):
    id: int
    email: str
    username: Optional[str]
    phone: Optional[str]
    phone_verified: bool
    created_at: datetime
```

### Login Endpoint (`POST /api/auth/login`)

Change request body from `email: str` to `identifier: str`. Detection logic:

```python
identifier = data.identifier.strip()
if "@" in identifier:
    user = session.exec(select(User).where(User.email == identifier.lower())).first()
elif identifier.lstrip("+").isdigit():
    # Phone login must use OTP — reject password login for phone
    raise HTTPException(400, "เบอร์โทรต้องใช้ OTP login — ใช้ /api/auth/otp/send")
else:
    user = session.exec(select(User).where(User.username == identifier)).first()
```

### New OTP Endpoints

**`POST /api/auth/otp/send`** — public, no auth required
```
Request:  { phone: str }
Response: { ok: true, expires_in: 300 }
Errors:   404 if phone not registered
          429 if OTP sent < 60s ago (check expires_at - (TTL - 60))
```
Generates 6-digit OTP, stores in `_otp_store`, calls `_send_otp()`.

**`POST /api/auth/otp/login`** — public, no auth required
```
Request:  { phone: str, otp_code: str }
Response: TokenResponse
Errors:   401 if wrong/expired OTP
          403 if account disabled
```
Validates OTP from `_otp_store`, clears entry on success, returns JWT.

### Account Settings Endpoints

**`PUT /api/auth/username`** — requires auth
```
Request:  { username: str }
Response: { ok: true }
Errors:   409 if username already taken
          422 if username < 3 chars or contains spaces
```
Username rules: 3–30 chars, alphanumeric + underscore only (`^[a-zA-Z0-9_]{3,30}$`).

**`POST /api/auth/phone/request`** — requires auth
```
Request:  { phone: str }
Response: { ok: true, expires_in: 300 }
Errors:   409 if phone already registered to another user
```
Generates OTP, stores with phone as key (same `_otp_store`), calls `_send_otp()`.

**`POST /api/auth/phone/confirm`** — requires auth
```
Request:  { phone: str, otp_code: str }
Response: { ok: true }
Errors:   401 if wrong/expired OTP
```
Validates OTP, sets `user.phone = phone`, `user.phone_verified = True`, clears OTP entry.

---

## Frontend Design

### `frontend/src/types/index.ts`

Update `User` type (add to existing `UserRead` equivalent):
```typescript
export interface AuthUser {
  id: number;
  email: string;
  username: string | null;
  phone: string | null;
  phone_verified: boolean;
  created_at: string;
}
```

### `frontend/src/pages/AuthPage.tsx`

**Changes to login tab only:**

1. Replace `email` state with `identifier` state (`useState("")`)
2. Change input from `type="email"` to `type="text"`, placeholder: `"Email, username หรือเบอร์โทร"`
3. Add `isPhoneIdentifier(identifier)` helper: `return /^\+?[0-9]{8,15}$/.test(identifier.trim())`
4. When `isPhoneIdentifier` is true:
   - Hide password field
   - Show "ส่ง OTP" button (calls `POST /api/auth/otp/send`)
   - After OTP sent: show 6-digit OTP input + countdown timer (5:00 → 0:00)
   - Submit calls `POST /api/auth/otp/login`
5. Otherwise: show password field as before, submit calls `POST /api/auth/login` with `{ identifier, password }`

OTP step state:
```typescript
const [otpSent, setOtpSent] = useState(false);
const [otp, setOtp] = useState("");
const [countdown, setCountdown] = useState(0); // seconds remaining
```

Countdown: `useEffect` with `setInterval(1s)` when `countdown > 0`.

Register tab: unchanged (still requires email + password).

### `frontend/src/hooks/useAuth.ts`

Update `login` and add `loginWithOtp`:

```typescript
async function login(identifier: string, password: string): Promise<void> {
  const { access_token } = await fetchLogin(identifier, password);
  setToken(access_token);
}

async function loginWithOtp(phone: string, otp_code: string): Promise<void> {
  const token = await otpLogin(phone, otp_code);
  setToken(token);
}
```

### `frontend/src/api/auth.ts`

Add:
```typescript
export const sendOtp = (phone: string) =>
  client.post("/api/auth/otp/send", { phone });

export const otpLogin = (phone: string, otp_code: string) =>
  client.post<{ access_token: string }>("/api/auth/otp/login", { phone, otp_code })
    .then(r => r.data.access_token);

export const fetchUpdateUsername = (username: string) =>
  client.put("/api/auth/username", { username });

export const fetchRequestPhone = (phone: string) =>
  client.post("/api/auth/phone/request", { phone });

export const fetchConfirmPhone = (phone: string, otp_code: string) =>
  client.post("/api/auth/phone/confirm", { phone, otp_code });
```

Update `fetchLogin` signature to use `identifier` instead of `email`:
```typescript
export const fetchLogin = (identifier: string, password: string) =>
  client.post<{ access_token: string }>("/api/auth/login", { identifier, password })
    .then(r => r.data);
```

### `frontend/src/components/ui/AccountModal.tsx`

Change `Tab` type from `"email" | "password"` to `"email" | "password" | "username" | "phone"`.

Add two new tabs:

**Username tab:**
- Show current username if set: `"ปัจจุบัน: @{username}"`
- Input field (text, 3–30 chars, pattern `[a-zA-Z0-9_]+`)
- Submit → `fetchUpdateUsername` → invalidate `["me"]` → show success

**Phone tab (2-step):**

Step 1 — Enter phone:
- Input (tel, placeholder `"0812345678"`)
- "ส่ง OTP" button → calls `fetchRequestPhone` → moves to step 2

Step 2 — Enter OTP:
- Show phone being verified
- 6-digit OTP input
- Countdown display `MM:SS`
- "ยืนยัน" button → calls `fetchConfirmPhone` → invalidate `["me"]` → show success
- "ส่งใหม่" button (enabled when countdown = 0) → calls `fetchRequestPhone` again

If `user.phone_verified` already true: show verified badge + option to change.

### `frontend/src/components/ui/AvatarMenu.tsx`

Update display name logic:
```typescript
const displayName = user.username ? `@${user.username}` : user.email;
```
Avatar initial: first char of `username` if set, else first char of `email`.

### CSS Fix — Avatar Dropdown Mobile (`frontend/src/index.css`)

Change `.avatar-dropdown` background from `rgba(9, 9, 26, 0.50)` to `rgba(9, 9, 26, 0.88)`:

```css
.avatar-dropdown {
  background: rgba(9, 9, 26, 0.88);
  /* rest unchanged */
}
```

This makes text readable on all backgrounds on mobile without losing the glass blur effect.

---

## Data Flow Summary

```
Login (email/username):
  AuthPage → POST /api/auth/login { identifier, password } → JWT → localStorage

Login (phone OTP):
  AuthPage → POST /api/auth/otp/send { phone } → OTP in console
           → POST /api/auth/otp/login { phone, otp_code } → JWT → localStorage

Set username:
  AccountModal (Username tab) → PUT /api/auth/username { username } → invalidate ["me"]

Set phone:
  AccountModal (Phone tab) → POST /api/auth/phone/request { phone } → OTP in console
                           → POST /api/auth/phone/confirm { phone, otp_code } → phone_verified=true
```

---

## Error Handling

| Scenario | Response | UI |
|----------|----------|----|
| Username taken | 409 | "Username นี้ถูกใช้แล้ว" |
| Username invalid format | 422 | "ใช้ได้เฉพาะ a-z 0-9 _ (3–30 ตัว)" |
| OTP expired | 401 | "OTP หมดอายุ กรุณาขอใหม่" |
| OTP wrong | 401 | "OTP ไม่ถูกต้อง" |
| Phone already registered | 409 | "เบอร์นี้ถูกใช้แล้ว" |
| Login with unregistered identifier | 401 | "ไม่พบบัญชีนี้" |
| Phone login without OTP | 400 | redirect to OTP step automatically |

---

## Out of Scope

- Real SMS sending (use console mock — wire provider later)
- Username change history / audit log
- Forgot password via phone
- 2FA (phone as second factor)
