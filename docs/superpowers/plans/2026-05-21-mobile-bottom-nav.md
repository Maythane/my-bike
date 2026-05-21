# Mobile Bottom Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed bottom nav (Garage | FAB+ | Settings) on mobile (≤ 639px), move theme toggle to Settings page, and rebuild SettingsPage with Account + Appearance + App sections.

**Architecture:** A new `BottomNav` component renders fixed at viewport bottom on mobile via CSS. FAB opens a compact popup (reusing `.quick-log-menu` / `.quick-log-item` styles). Forms accept optional `bikeId` — when absent, show an inline bike-picker. Desktop layout unchanged.

**Tech Stack:** React, React Router v6 (`useLocation`), TanStack Query, CSS custom properties

---

## File Map

| File | Action |
|---|---|
| `frontend/src/components/ui/BottomNav.tsx` | **Create** — fixed bottom nav + FAB popup + form launchers |
| `frontend/src/App.tsx` | **Modify** — add `<BottomNav />` inside AppShell ProtectedRoute |
| `frontend/src/index.css` | **Modify** — add `.bottom-nav-*` CSS; hide `.app-nav-toggle` + `.app-nav-links` on mobile; adjust `.page` padding |
| `frontend/src/pages/SettingsPage.tsx` | **Modify** — add Account, Appearance (dark mode), App (gas) sections |
| `frontend/src/components/logs/ServiceLogForm.tsx` | **Modify** — make `bikeId` and `currentMileage` optional; add bike-picker when absent |
| `frontend/src/components/logs/FuelLogForm.tsx` | **Modify** — same as ServiceLogForm |

---

### Task 1: CSS — bottom nav styles + mobile adjustments

**Files:**
- Modify: `frontend/src/index.css` (append at end of file)

- [ ] **Step 1: Append bottom nav CSS to `index.css`**

Add at the very end of `frontend/src/index.css`:

```css
/* ─── Bottom Nav (mobile only) ────────────────────────────────────────────── */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 60px;
  background: var(--canvas);
  border-top: 1px solid var(--hairline);
  z-index: 200;
  padding-bottom: env(safe-area-inset-bottom);
}

.bottom-nav-tab {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 2px;
  font-size: 9px; font-weight: 500;
  color: var(--slate);
  background: transparent;
  border: none; border-top: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s, background 0.15s;
}
.bottom-nav-tab.is-active {
  color: var(--purple);
  font-weight: 700;
  border-top-color: var(--purple);
  background: var(--purple-bg);
}

.bottom-nav-fab-wrap {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: flex-end;
  padding-bottom: 6px;
  position: relative;
}
.bottom-nav-fab {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--purple);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  position: absolute; top: -18px;
  box-shadow: 0 3px 10px rgba(108, 92, 231, 0.45);
  color: #fff;
  font-size: 24px; line-height: 1; font-weight: 300;
  transition: transform 0.2s var(--jelly-ease), background 0.15s;
}
.bottom-nav-fab:active { background: #5a4cd6; }
.bottom-nav-fab.is-open { transform: rotate(45deg); }
.bottom-nav-fab-label {
  font-size: 9px;
  color: var(--slate);
}

.bottom-nav-popup {
  position: fixed;
  bottom: 78px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 220px;
  background: var(--canvas);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-md);
  box-shadow: 0 -6px 24px rgba(0,0,0,0.36), 0 2px 6px rgba(0,0,0,0.18);
  overflow: hidden;
  z-index: 202;
  animation: quick-log-pop 0.22s var(--jelly-ease);
}
html.light .bottom-nav-popup {
  box-shadow: 0 -6px 20px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06);
}
.bottom-nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 201;
  background: rgba(0, 0, 0, 0.15);
}

@media (max-width: 639px) {
  .bottom-nav { display: flex; }
  .app-nav-links, .app-nav-toggle { display: none; }
  .page { padding-bottom: calc(60px + max(16px, env(safe-area-inset-bottom))); }
}
```

- [ ] **Step 2: Verify CSS loads without errors**

```bash
cd /Users/mark/My-Project/My-bike/frontend && npm run build 2>&1 | tail -5
```
Expected: no CSS parse errors (build may fail on TS — that's fine for now)

- [ ] **Step 3: Commit**

```bash
git -C /Users/mark/My-Project/My-bike add frontend/src/index.css
git -C /Users/mark/My-Project/My-bike commit -m "style: add bottom nav CSS and mobile layout adjustments"
```

---

### Task 2: Create `BottomNav` component

**Files:**
- Create: `frontend/src/components/ui/BottomNav.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/components/ui/BottomNav.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAllMotorcycles } from "../../api/motorcycles";
import ServiceLogForm from "../logs/ServiceLogForm";
import FuelLogForm from "../logs/FuelLogForm";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);
  const [showService, setShowService] = useState(false);
  const [showFuel, setShowFuel] = useState(false);

  const { data: bikes = [] } = useQuery({
    queryKey: ["motorcycles"],
    queryFn: getAllMotorcycles,
  });

  const garageActive =
    location.pathname === "/" ||
    location.pathname.startsWith("/bikes/") ||
    location.pathname === "/shock-settings";
  const settingsActive = location.pathname.startsWith("/settings");

  const singleBike = bikes.length === 1 ? bikes[0] : undefined;

  function openService() {
    setFabOpen(false);
    setShowService(true);
  }
  function openFuel() {
    setFabOpen(false);
    setShowFuel(true);
  }

  return (
    <>
      {fabOpen && (
        <>
          <div className="bottom-nav-backdrop" onClick={() => setFabOpen(false)} />
          <div className="bottom-nav-popup">
            <button className="quick-log-item" onClick={openService}>
              <span
                className="quick-log-icon"
                style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-border)" }}
              >
                🔧
              </span>
              บำรุงรักษา
            </button>
            <button className="quick-log-item" onClick={openFuel}>
              <span
                className="quick-log-icon"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.28)",
                }}
              >
                ⛽
              </span>
              เติมน้ำมัน
            </button>
          </div>
        </>
      )}

      <nav className="bottom-nav">
        <button
          className={`bottom-nav-tab${garageActive ? " is-active" : ""}`}
          onClick={() => navigate("/", { viewTransition: true })}
        >
          <span style={{ fontSize: 20 }}>🏍️</span>
          Garage
        </button>

        <div className="bottom-nav-fab-wrap">
          {bikes.length > 0 && (
            <button
              className={`bottom-nav-fab${fabOpen ? " is-open" : ""}`}
              onClick={() => setFabOpen((v) => !v)}
              aria-label="บันทึกรายการ"
            >
              +
            </button>
          )}
          <span className="bottom-nav-fab-label">บันทึก</span>
        </div>

        <button
          className={`bottom-nav-tab${settingsActive ? " is-active" : ""}`}
          onClick={() => navigate("/settings", { viewTransition: true })}
        >
          <span style={{ fontSize: 20 }}>⚙️</span>
          Settings
        </button>
      </nav>

      {showService && (
        <ServiceLogForm
          bikeId={singleBike?.id}
          currentMileage={singleBike?.current_mileage}
          onClose={() => setShowService(false)}
        />
      )}
      {showFuel && (
        <FuelLogForm
          bikeId={singleBike?.id}
          currentMileage={singleBike?.current_mileage}
          tankCapacity={singleBike?.tank_capacity ?? null}
          onClose={() => setShowFuel(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/mark/My-Project/My-bike add frontend/src/components/ui/BottomNav.tsx
git -C /Users/mark/My-Project/My-bike commit -m "feat: add BottomNav component with FAB popup"
```

---

### Task 3: Wire `BottomNav` into `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add import**

In `frontend/src/App.tsx`, add after the existing UI imports:

```tsx
import BottomNav from "./components/ui/BottomNav";
```

- [ ] **Step 2: Add `<BottomNav />` inside AppShell**

Find the protected route layout div (the one containing `<NavBar>` and the scrollable div) and add `<BottomNav />` as the last child:

```tsx
// Before:
<div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", zIndex: 1 }}>
  <NavBar theme={theme} toggle={toggle} />
  <div style={{ flex: 1, overflowY: "auto" }}>
    <Routes>...</Routes>
  </div>
</div>

// After:
<div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", zIndex: 1 }}>
  <NavBar theme={theme} toggle={toggle} />
  <div style={{ flex: 1, overflowY: "auto" }}>
    <Routes>...</Routes>
  </div>
  <BottomNav />
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/mark/My-Project/My-bike/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: errors only from ServiceLogForm/FuelLogForm prop changes (next tasks), not from BottomNav.

- [ ] **Step 4: Commit**

```bash
git -C /Users/mark/My-Project/My-bike add frontend/src/App.tsx
git -C /Users/mark/My-Project/My-bike commit -m "feat: wire BottomNav into AppShell"
```

---

### Task 4: Make `ServiceLogForm` accept optional `bikeId`

**Files:**
- Modify: `frontend/src/components/logs/ServiceLogForm.tsx`

- [ ] **Step 1: Update `Props` interface and add `getAllMotorcycles` import**

Replace the existing `Props` interface and add the import:

```tsx
// Add to imports at top:
import { useQuery } from "@tanstack/react-query";
import { getAllMotorcycles } from "../../api/motorcycles";
import type { Motorcycle } from "../../types";
```

Wait — `useQuery` is already imported (`import { useMutation, useQueryClient } from "@tanstack/react-query"`). Add `useQuery` to that import:

```tsx
import { useState, useRef, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { createServiceLog, updateServiceLog, uploadServiceLogImage, deleteServiceLogImageById } from "../../api/logs";
import { getAllMotorcycles } from "../../api/motorcycles";
import { useGeoLocation } from "../../hooks/useGeoLocation";
import { useAnimatedClose } from "../../hooks/useAnimatedClose";
import Lightbox from "../ui/Lightbox";
import type { ServiceLog, LogImage } from "../../types";
```

Replace the `Props` interface:

```tsx
interface Props {
  bikeId?: number;
  currentMileage?: number;
  onClose: () => void;
  log?: ServiceLog;
  pastLocations?: string[];
}
```

- [ ] **Step 2: Add bike-picker state and derived values inside the component**

After `const isEdit = !!log;` add:

```tsx
const [pickedBikeId, setPickedBikeId] = useState<number | undefined>(bikeId);

const { data: allBikes = [] } = useQuery({
  queryKey: ["motorcycles"],
  queryFn: getAllMotorcycles,
  enabled: bikeId === undefined,
});

const effectiveBikeId = bikeId ?? pickedBikeId;
const pickedBike = bikeId === undefined ? allBikes.find((b) => b.id === pickedBikeId) : undefined;
const effectiveMileage = bikeId !== undefined
  ? (currentMileage ?? 0)
  : (pickedBike?.current_mileage ?? 0);
```

- [ ] **Step 3: Replace all uses of `bikeId` and `currentMileage` with effective values in the component body**

In `ServiceLogForm`, find every place `bikeId` and `currentMileage` are used in logic/mutations (not the prop destructure). Replace:
- `bikeId` → `effectiveBikeId`
- `currentMileage` → `effectiveMileage`

The `createServiceLog` / `updateServiceLog` calls pass `bikeId` — change to `effectiveBikeId!` (non-null assertion is safe because submit is disabled when undefined).

- [ ] **Step 4: Add bike-picker JSX at the top of the form (inside the modal, before any inputs)**

Find the form's first visible input section (after the modal header/title). Add before it:

```tsx
{bikeId === undefined && (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--steel)", display: "block", marginBottom: 6 }}>
      รถ
    </label>
    <select
      value={pickedBikeId ?? ""}
      onChange={(e) => setPickedBikeId(e.target.value ? Number(e.target.value) : undefined)}
      style={{
        width: "100%", padding: "9px 12px", borderRadius: "var(--r)",
        border: "1px solid var(--hairline)", background: "var(--surface)",
        color: "var(--ink)", fontSize: 14,
      }}
    >
      <option value="">เลือกรถ...</option>
      {allBikes.map((b) => (
        <option key={b.id} value={b.id}>
          {b.nickname ?? `${b.make} ${b.model}`} ({b.current_mileage.toLocaleString()} km)
        </option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 5: Disable submit button when `effectiveBikeId` is undefined**

Find the submit `<button>` in the form. Add `disabled={!effectiveBikeId || isPending}` (replacing just `disabled={isPending}`).

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/mark/My-Project/My-bike/frontend && npx tsc --noEmit 2>&1 | grep ServiceLog
```
Expected: no ServiceLogForm errors

- [ ] **Step 7: Commit**

```bash
git -C /Users/mark/My-Project/My-bike add frontend/src/components/logs/ServiceLogForm.tsx
git -C /Users/mark/My-Project/My-bike commit -m "feat: make ServiceLogForm bikeId optional with bike-picker"
```

---

### Task 5: Make `FuelLogForm` accept optional `bikeId`

**Files:**
- Modify: `frontend/src/components/logs/FuelLogForm.tsx`

- [ ] **Step 1: Update imports and `Props` interface**

```tsx
import { useState, useRef, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { createFuelLog, updateFuelLog, uploadFuelLogImage, deleteFuelLogImageById } from "../../api/fuel";
import { getAllMotorcycles } from "../../api/motorcycles";
import { useGeoLocation } from "../../hooks/useGeoLocation";
import { useAnimatedClose } from "../../hooks/useAnimatedClose";
import Lightbox from "../ui/Lightbox";
import type { FuelLog, LogImage } from "../../types";
```

Replace `Props` interface:

```tsx
interface Props {
  bikeId?: number;
  currentMileage?: number;
  tankCapacity?: number | null;
  onClose: () => void;
  log?: FuelLog;
  pastLocations?: string[];
}
```

- [ ] **Step 2: Add bike-picker state and derived values**

After `const isEdit = !!log;` add:

```tsx
const [pickedBikeId, setPickedBikeId] = useState<number | undefined>(bikeId);

const { data: allBikes = [] } = useQuery({
  queryKey: ["motorcycles"],
  queryFn: getAllMotorcycles,
  enabled: bikeId === undefined,
});

const effectiveBikeId = bikeId ?? pickedBikeId;
const pickedBike = bikeId === undefined ? allBikes.find((b) => b.id === pickedBikeId) : undefined;
const effectiveMileage = bikeId !== undefined
  ? (currentMileage ?? 0)
  : (pickedBike?.current_mileage ?? 0);
const effectiveTankCapacity = bikeId !== undefined
  ? (tankCapacity ?? null)
  : (pickedBike?.tank_capacity ?? null);
```

- [ ] **Step 3: Replace `bikeId`, `currentMileage`, `tankCapacity` with effective values in component body**

- `bikeId` → `effectiveBikeId` (use `effectiveBikeId!` in mutation calls)
- `currentMileage` → `effectiveMileage`
- `tankCapacity` → `effectiveTankCapacity`

- [ ] **Step 4: Add bike-picker JSX (same as ServiceLogForm)**

At the top of the form's input section, add:

```tsx
{bikeId === undefined && (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--steel)", display: "block", marginBottom: 6 }}>
      รถ
    </label>
    <select
      value={pickedBikeId ?? ""}
      onChange={(e) => setPickedBikeId(e.target.value ? Number(e.target.value) : undefined)}
      style={{
        width: "100%", padding: "9px 12px", borderRadius: "var(--r)",
        border: "1px solid var(--hairline)", background: "var(--surface)",
        color: "var(--ink)", fontSize: 14,
      }}
    >
      <option value="">เลือกรถ...</option>
      {allBikes.map((b) => (
        <option key={b.id} value={b.id}>
          {b.nickname ?? `${b.make} ${b.model}`} ({b.current_mileage.toLocaleString()} km)
        </option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 5: Disable submit when `effectiveBikeId` is undefined**

Find the submit button, change `disabled={isPending}` to `disabled={!effectiveBikeId || isPending}`.

- [ ] **Step 6: Verify TypeScript — should be clean**

```bash
cd /Users/mark/My-Project/My-bike/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git -C /Users/mark/My-Project/My-bike add frontend/src/components/logs/FuelLogForm.tsx
git -C /Users/mark/My-Project/My-bike commit -m "feat: make FuelLogForm bikeId optional with bike-picker"
```

---

### Task 6: Rebuild `SettingsPage` with Account, Appearance, App sections

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add imports**

Add to the top of `SettingsPage.tsx`:

```tsx
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { fetchMe } from "../api/auth";
```

- [ ] **Step 2: Add hooks inside the component**

After the existing hooks (`navigate`, `qc`, `settings` query, etc.), add:

```tsx
const { theme, toggle } = useTheme();
const { logout } = useAuth();
const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });
const displayName = user?.username ? `@${user.username}` : (user?.email ?? "…");
const initial = (user?.username?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
```

- [ ] **Step 3: Add gas station handler**

```tsx
function openGasStation() {
  if (!navigator.geolocation) {
    window.open("https://maps.google.com/?q=ปั๊มน้ำมัน", "_blank");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      window.open(
        `https://www.google.com/maps/search/ปั๊มน้ำมัน/@${coords.latitude},${coords.longitude},15z`,
        "_blank",
      );
    },
    () => window.open("https://maps.google.com/?q=ปั๊มน้ำมัน", "_blank"),
  );
}
```

- [ ] **Step 4: Replace the return JSX**

Replace the entire `return (...)` block with:

```tsx
return (
  <div className="page">
    <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 24 }}>Settings</h1>

    {/* ── Account ── */}
    <div className="settings-section-label">Account</div>
    <div className="settings-card" style={{ marginBottom: 20 }}>
      <div className="settings-row" style={{ gap: 12, alignItems: "center" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", background: "var(--purple-bg)",
          border: "1px solid var(--purple-border)", display: "flex", alignItems: "center",
          justifyContent: "center", fontWeight: 700, fontSize: 15, color: "var(--purple)", flexShrink: 0,
        }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{displayName}</div>
          {user?.email && <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 1 }}>{user.email}</div>}
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--hairline)", marginTop: 4 }}>
        <button
          className="settings-row"
          style={{ width: "100%", background: "none", border: "none", cursor: "pointer",
            color: "var(--danger, #e55)", fontSize: 14, fontWeight: 500, justifyContent: "flex-start", gap: 8 }}
          onClick={logout}
        >
          🚪 ออกจากระบบ
        </button>
      </div>
    </div>

    {/* ── Appearance ── */}
    <div className="settings-section-label">Appearance</div>
    <div className="settings-card" style={{ marginBottom: 20 }}>
      <div className="settings-row" style={{ justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, color: "var(--ink)" }}>
          {theme === "dark" ? "🌙" : "☀️"} Dark Mode
        </span>
        <button
          onClick={toggle}
          style={{
            width: 44, height: 24, borderRadius: 99, border: "none", cursor: "pointer",
            background: theme === "dark" ? "var(--purple)" : "var(--hairline)",
            position: "relative", transition: "background 0.2s",
          }}
          aria-label="Toggle dark mode"
        >
          <span style={{
            position: "absolute", top: 2,
            left: theme === "dark" ? "calc(100% - 22px)" : 2,
            width: 20, height: 20, borderRadius: "50%", background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.2s var(--jelly-ease)",
          }} />
        </button>
      </div>
    </div>

    {/* ── General (existing unit/timezone settings) ── */}
    <div className="settings-section-label">ทั่วไป</div>
    <div className="settings-card" style={{ marginBottom: 20 }}>
      <div className="settings-row">
        <span className="settings-row-label">Distance Unit</span>
        <div className="toggle-group">
          <button
            className={`toggle-btn${effectiveUnit === "km" ? " active" : ""}`}
            onClick={() => setUnit("km")}
          >km</button>
          <button
            className={`toggle-btn${effectiveUnit === "miles" ? " active" : ""}`}
            onClick={() => setUnit("miles")}
          >miles</button>
        </div>
      </div>
      <div className="settings-row">
        <span className="settings-row-label">Timezone</span>
        <input
          style={{
            background: "var(--surface)", border: "1px solid var(--glass-border)",
            borderRadius: "var(--r)", padding: "6px 12px", color: "var(--ink)",
            fontSize: 13, width: 160,
          }}
          value={effectiveTz}
          onChange={(e) => setTimezone(e.target.value)}
        />
      </div>
    </div>

    {/* ── App ── */}
    <div className="settings-section-label">App</div>
    <div className="settings-card" style={{ marginBottom: 20 }}>
      <button
        className="settings-row"
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer",
          fontSize: 14, color: "var(--ink)", justifyContent: "space-between" }}
        onClick={openGasStation}
      >
        <span>⛽ ค้นหาปั๊มน้ำมันใกล้เคียง</span>
        <span style={{ fontSize: 12, color: "var(--slate)" }}>›</span>
      </button>
    </div>

    {/* Save button (for unit/timezone) */}
    <button
      className="btn btn-primary"
      style={{ width: "100%" }}
      onClick={() => saveSettings()}
      disabled={isPending}
    >
      {saveMsg ?? (isPending ? "กำลังบันทึก…" : "บันทึก")}
    </button>
  </div>
);
```


- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/mark/My-Project/My-bike/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git -C /Users/mark/My-Project/My-bike add frontend/src/pages/SettingsPage.tsx
git -C /Users/mark/My-Project/My-bike commit -m "feat: rebuild SettingsPage with Account, Dark Mode, and Gas sections"
```

---

### Task 7: Dev server smoke-test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/mark/My-Project/My-bike/frontend && npm run dev
```

- [ ] **Step 2: Check mobile layout (resize browser to ≤ 639px)**

Verify:
- Bottom nav appears with Garage | FAB(+) | Settings
- Top bar shows only logo + Avatar (no 🌙 or ⛽ buttons)
- Content scrolls above the bottom nav (not hidden behind it)

- [ ] **Step 3: Test FAB**

- Tap FAB → compact popup appears above nav with 🔧 / ⛽
- Tap backdrop → popup closes
- FAB rotates 45° when open

- [ ] **Step 4: Test FAB with multiple bikes**

- Open ServiceLogForm via FAB (multiple bikes scenario)
- Verify bike-picker dropdown appears at top of form
- Selecting a bike enables the submit button

- [ ] **Step 5: Test Settings tab**

- Tap Settings tab → navigates to `/settings`
- Dark Mode toggle works (page theme changes)
- ออกจากระบบ button logs out correctly

- [ ] **Step 6: Check desktop (resize > 639px)**

- Bottom nav hidden
- Top nav fully visible including 🌙 and ⛽
- Everything unchanged

- [ ] **Step 7: Final commit**

```bash
git -C /Users/mark/My-Project/My-bike add -A
git -C /Users/mark/My-Project/My-bike commit -m "feat: mobile bottom navigation complete" 2>/dev/null || echo "nothing to commit"
```
