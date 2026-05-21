# Mobile Bottom Navigation

**Date:** 2026-05-21
**Scope:** `frontend/src/App.tsx`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/index.css`

---

## Goal

Add a bottom navigation bar on mobile (≤ 640px) with the pattern: **Garage | FAB(+) | Settings**, replacing the current top-bar navigation items on small screens. Desktop top nav is unchanged.

---

## Layout

### Mobile (≤ 640px)

**Top bar:** Logo (🏍️ + "My Bike") + Avatar only — theme toggle removed.

**Bottom nav (fixed, 60px tall):**

```
[ 🏍️ Garage ] [ ➕ FAB ] [ ⚙️ Settings ]
```

- **Garage** and **Settings** are standard tabs with icon + label
- **FAB** is a 40px circular purple button floating 18px above the bar, centered
- Active tab shows `border-top: 2px solid var(--purple)` + `background: var(--purple-bg)`

**Content area:** `padding-bottom: 60px` to clear the fixed bottom nav.

### Desktop (> 640px)

No change — existing top nav with all items remains.

---

## FAB Popup Menu

Tapping FAB opens a compact popup anchored above the button (not a full bottom sheet).

**Appearance:**
- Reuses existing `.quick-log-menu` and `.quick-log-item` CSS classes
- Width: `min-width: 220px`
- Items: 46px tall, 36px icon, 14px font-weight-600 — identical to desktop quick-log menu
- Two items: 🔧 บำรุงรักษา / ⛽ เติมน้ำมัน
- Backdrop: `rgba(0,0,0,0.15)` behind popup, tap to close

**Behavior:**
- FAB tap → set `fabOpen: boolean` state
- Selecting an item → close popup, open the relevant log form (same as existing `setShowLog` / `setShowFuelLog` flow)
- FAB icon rotates 45° when open (becomes ✕), rotates back on close

**Scope:** FAB appears on all protected routes. The log forms (`ServiceLogForm`, `FuelLogForm`) require a `bikeId`:
- **1 bike in garage:** popup shows 🔧 / ⛽ directly → open form with that bike's id
- **Multiple bikes:** popup shows 🔧 / ⛽ → open form; form receives no `bikeId` → add an inline bike-picker dropdown at the top of the form (new addition to both forms)
- **0 bikes:** FAB is hidden (no bikes to log against)

---

## Settings Tab

`/settings` route becomes a proper Settings page (currently minimal). Sections:

### Account
- Avatar + display name + email (read-only)
- "ออกจากระบบ" button (moves logout here from `AvatarMenu`)

### Appearance
- **Dark Mode toggle** — uses existing `useTheme()` hook (`toggle()` function)

### App
- **ค้นหาปั๊มน้ำมัน** — same geolocation logic currently in top nav ⛽ button
- Version string (static)

---

## Bottom Nav Visibility

Bottom nav shows on **all protected routes** except none — it is always visible on mobile when logged in.

On detail pages (`/bikes/:bikeId`, `/shock-settings`, `/settings/bikes/:bikeId/shock`), the bottom nav remains visible. The back button on those pages handles upward navigation.

---

## Active State Logic

| Route | Active tab |
|---|---|
| `/` | Garage |
| `/bikes/:bikeId` | Garage |
| `/shock-settings` | Garage |
| `/settings` | Settings |
| `/settings/bikes/:bikeId/shock` | Settings |

Use `useLocation()` + `startsWith` matching.

---

## Files Changed

| File | Change |
|---|---|
| `App.tsx` | Add `BottomNav` component; simplify `NavBar` (remove theme toggle + ⛽ button); wrap content area with `padding-bottom` on mobile |
| `SettingsPage.tsx` | Add Account section + Dark Mode toggle + gas station button |
| `index.css` | Add `.bottom-nav`, `.bottom-nav-tab`, `.bottom-nav-fab` CSS (mobile-only via `@media (max-width: 640px)`) |
| `ServiceLogForm.tsx` | Add optional `bikeId` prop (undefined = show bike-picker dropdown at top of form) |
| `FuelLogForm.tsx` | Same as above |

---

## Non-goals

- No animation on bottom nav tab switch (nav is structural, not animated)
- No badge/notification indicators on tabs
- No changes to desktop layout
- No changes to `AvatarMenu` component itself — logout moves to Settings, but AvatarMenu stays in top bar for desktop
