@AGENTS.md

---

## Design System — Jelly Glass

Dark mode default · light mode ผ่าน `html.light`

### CSS Variables
```css
--canvas --surface --surface-soft --elevated
--glass-bg --glass-border
--ink --slate --steel --muted
--purple --purple-bg --purple-border --purple-hover
--red --red-bg --green --green-border
--hairline --hairline-strong
--r --r-md --r-lg --r-full
--jelly-ease --spring --shadow-card --shadow-modal
```

### CSS Classes
```
.btn .btn-primary .btn-secondary .btn-ghost .btn-danger .btn-sm
.modal-overlay .modal .modal-plain .modal-box
.auth-card .auth-input .auth-field .auth-error .auth-success .auth-link
.acct-modal .acct-section .acct-section-row .acct-profile-edit
.confirm-dialog .confirm-dialog-body .confirm-dialog-footer
.card .card-surface
```

CSS ทั้งหมดอยู่ใน `frontend/src/index.css` ไฟล์เดียว — ไม่มี CSS modules

---

## Adapting External Code

เมื่อได้รับ code ที่ใช้ shadcn/lucide/Next.js ให้ adapt เป็น:

| ต้นฉบับ | แปลงเป็น |
|--------|---------|
| `<Button variant="outline">` | `<button className="btn btn-ghost">` |
| `<Button variant="destructive">` | `<button className="btn btn-danger">` |
| `<Input>` | `<input className="auth-input">` |
| `<Label>` | `<label>` (styled via CSS) |
| `<Dialog>` / `<DialogContent>` | `<div className="modal-overlay"><div className="modal modal-plain">` |
| lucide icons | Inline `<svg>` |
| `Link` from next | `<a>` หรือ `useNavigate()` |
| `"use client"` | ลบออก (ไม่ใช้ Next.js) |
| `@/components/ui/...` | native elements + CSS classes |
