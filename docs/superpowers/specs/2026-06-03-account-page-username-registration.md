# Account Page & Username-First Registration

**Date:** 2026-06-03
**Status:** Approved

---

## Overview

แยก Account management ออกจาก modal เป็น full page `/account` และเปลี่ยน registration ให้ใช้ username เป็น primary identifier แทน email (email กลายเป็น optional)

---

## Goals

1. Account page เป็น full page รองรับ feature ใหม่ในอนาคตได้ง่าย
2. สมัครสมาชิกด้วย username ง่ายกว่า email — user เพิ่ม email เองทีหลังได้
3. Existing users (email-based) ไม่กระทบ — login ด้วย email ยังทำงานได้ปกติ

---

## Architecture

### หน้าที่ถูกสร้าง/เปลี่ยน

| Component | Action | หมายเหตุ |
|---|---|---|
| `pages/AccountPage.tsx` | สร้างใหม่ | แทน AccountModal ทั้งหมด |
| `components/ui/AccountModal.tsx` | ลบ | ย้าย logic ไป AccountPage |
| `components/ui/AvatarMenu.tsx` | แก้ไข | modal → `navigate('/account')` |
| `pages/AuthPage.tsx` | แก้ไข | register form: username-first |
| `App.tsx` | แก้ไข | เพิ่ม route `/account` |
| `api/auth.ts` | แก้ไข | `fetchRegister` รับ username แทน email |
| `backend/app/routers/auth.py` | แก้ไข | `RegisterRequest`, `UserRead`, endpoint |
| `backend/app/database.py` | แก้ไข | migration: `User.email` → nullable |
| `backend/app/models.py` | แก้ไข | `User.email` เป็น `Optional[str]` |

---

## Account Page (`/account`)

### Layout: Hero Profile + Grouped Sections

```
┌─────────────────────────────┐
│ ‹ กลับ    บัญชีของฉัน       │
│                             │
│  ┌─── Hero (purple grad) ─┐ │
│  │   [Avatar]  Mark        │ │
│  │            @maythane01  │ │
│  └─────────────────────────┘ │
│                             │
│  บัญชี                      │
│  ┌─────────────────────────┐ │
│  │ ชื่อที่แสดง   Mark    › │ │
│  │ Username  @maythane01 › │ │
│  │ Email     ยังไม่ได้เพิ่ม [+เพิ่ม] │
│  └─────────────────────────┘ │
│                             │
│  ความปลอดภัย                │
│  ┌─────────────────────────┐ │
│  │ Password  ••••••••    › │ │
│  │ เบอร์โทร  ยังไม่ได้เพิ่ม [+เพิ่ม] │
│  └─────────────────────────┘ │
│                             │
│  [ ออกจากระบบ (red) ]       │
└─────────────────────────────┘
```

### Inline Editing

แต่ละ row ใน section กด `›` แล้วขยาย inline form ด้านล่าง row นั้น (เหมือน pattern ปัจจุบันใน AccountModal) — ไม่ navigate ออกไป

### Avatar Editing

กดที่ hero avatar → ImageCropper ขึ้นมา (Portal) → crop → preview → กด "บันทึก" ใน hero section

### Email Row (user ไม่มี email)

แสดง `"ยังไม่ได้เพิ่ม"` + ปุ่ม `+ เพิ่ม` สีม่วง → ขยาย inline form ให้ใส่ email

### Navigation

- เข้าถึงจาก: `AvatarMenu → navigate('/account')`
- ออกจาก: back button ซ้ายบน (`navigate(-1)`)
- AvatarMenu ปิด dropdown แล้ว navigate ทันที (ไม่มี modal เปิดค้าง)
- Route: `/account` เพิ่มใน authenticated routes

---

## Registration — Username-First

### Form Fields

| Field | Required | Validation |
|---|---|---|
| Username | ✅ | a–z, 0–9, _ · 3–30 chars · unique |
| Password | ✅ | min 8 chars |
| ยืนยัน Password | ✅ | ต้องตรงกับ password |
| Email | ❌ (optional) | valid email format ถ้ากรอก |

### UX Notes

- Email field แสดงอยู่ในฟอร์มทันที แต่ dashed border + label `(ไม่บังคับ)`
- hint ใต้ email: "แนะนำ — ใช้กู้รหัสผ่าน, เพิ่มทีหลังได้ใน Account"
- ปุ่ม submit: "สร้างบัญชี"
- Error states: username ซ้ำ → "Username นี้ถูกใช้แล้ว"

### Backend: RegisterRequest

```python
class RegisterRequest(BaseModel):
    username: str          # required
    password: str          # required, min 8 chars
    email: Optional[str] = None   # optional
```

Validation:
- username: `r'^[a-zA-Z0-9_]{3,30}$'`
- username unique check
- email unique check ถ้ากรอก
- password length ≥ 8

---

## Backend Changes

### User Model (`models.py`)

```python
email: Optional[str] = Field(default=None, unique=True, index=True)
```

เปลี่ยนจาก `str` เป็น `Optional[str]` — SQLite รองรับ NULL ใน UNIQUE column (หลาย NULL ได้)

### Database Migration (`database.py`)

เพิ่ม `_migrate_email_optional()` ใน `create_db()`:

```python
def _migrate_email_optional():
    # SQLite ไม่รองรับ ALTER COLUMN DROP NOT NULL
    # ต้องสร้าง table ใหม่แล้ว migrate ข้อมูล
    # หรือ: rebuild table with nullable email
```

**หมายเหตุ SQLite:** SQLite ไม่รองรับ `ALTER COLUMN` ดังนั้น migration ต้องใช้วิธี:
1. สร้าง `users_new` table ที่ email เป็น nullable
2. `INSERT INTO users_new SELECT ...` จาก `users`
3. `DROP TABLE users` → `ALTER TABLE users_new RENAME TO users`

ทำ idempotent โดย check `PRAGMA table_info(users)` ว่า email column มี `notnull=1` หรือไม่ก่อน migrate

### `UserRead` (`auth.py`)

```python
class UserRead(BaseModel):
    email: Optional[str] = None   # เปลี่ยนจาก str
    username: Optional[str] = None
    ...
```

### Login (ไม่เปลี่ยน)

`/api/auth/login` รับ `identifier` (email หรือ username) เหมือนเดิม — existing email users ไม่กระทบ

---

## Frontend Changes

### `api/auth.ts`

```typescript
// เปลี่ยน fetchRegister
export async function fetchRegister(
  username: string,
  password: string,
  email?: string
): Promise<TokenResponse>

// UserInfo: email optional
export interface UserInfo {
  email: string | null;
  ...
}
```

### `hooks/useAuth.ts`

```typescript
// register signature เปลี่ยน
register(username: string, password: string, email?: string)
```

### `AuthPage.tsx`

- Register tab: fields เรียงใหม่ (username, password, confirm, email optional)
- Login tab: identifier label เป็น "Username หรือ Email" (ไม่เปลี่ยน logic)

### `App.tsx`

```tsx
<Route path="/account" element={<AccountPage />} />
```

อยู่ใน authenticated routes group

### `AvatarMenu.tsx`

```tsx
// เปลี่ยนจาก
{showAccount && createPortal(<AccountModal onClose={...} />, document.body)}

// เป็น
onClick={() => { setOpen(false); navigate('/account'); }}
```

ลบ `showAccount` state และ AccountModal import ออก

---

## Existing Users Compatibility

- Users ที่มี email อยู่แล้ว: ไม่กระทบ ทำงานปกติ
- Login ด้วย email ยังได้เสมอ
- Account page แสดง email ที่มีอยู่แล้วถ้า user มี
- Users ที่ไม่มี email (new): เห็น "ยังไม่ได้เพิ่ม" + ปุ่ม `+ เพิ่ม`

---

## Files to Delete

- `frontend/src/components/ui/AccountModal.tsx`

---

## Out of Scope

- Password reset via email (future feature)
- Social login / OAuth
- Email verification flow
- Account deletion
