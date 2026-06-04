# Redesign: Tailwind + shadcn — Direction C (Dark Formal)

**Date:** 2026-06-04  
**Status:** Approved  
**Approach:** Incremental (Approach A — Foundation First)

---

## Goal

Migrate My Bike's frontend from custom "Jelly Glass" CSS to Tailwind CSS v4 + shadcn/ui, achieving a **formal, clean, dark** aesthetic (Direction C) while preserving the app's core identity: dark-first, personal, instrument-panel feel.

---

## Visual Direction

**"Dark Formal with Subtle Glass"** — inspired by Linear, Raycast, Vercel.

- Flat dark solid surfaces for most UI (no backdrop-filter by default)
- Subtle glass (blur 8px, opacity 8%) retained **only** for: top nav, modal overlays, bottom sheets
- Smaller radii (8px cards, 6px buttons) — more structured, less bubbly
- Consistent component vocabulary across all screens
- Violet accent (#8b5cf6) kept as primary brand color

**Not:** removing the dark identity, removing all motion, making it look like a generic SaaS dashboard.

---

## Tech Stack Changes

| Package | Action | Notes |
|---|---|---|
| `@tailwindcss/vite` v4 | Add | Vite plugin, CSS-based config |
| `shadcn/ui` (Tailwind v4 compatible) | Add | Components copied to `src/components/ui/` |
| `tailwindcss-animate` | Add | Animation utilities |
| `class-variance-authority` | Add | Component variant system |
| `clsx` + `tailwind-merge` | Add | className utilities |
| Custom `index.css` | Phase out | Keep during migration, remove class by class |

No new npm packages added beyond the above. No Alembic, no PostgreSQL, no Docker.

---

## Design Tokens

Defined in `frontend/src/index.css` via Tailwind v4 `@theme` block, replacing/supplementing existing CSS variables.

### Palette

| Token | Value | Usage |
|---|---|---|
| `--color-canvas` | `#0d0d0d` | Page background |
| `--color-surface` | `#141414` | Card, panel background |
| `--color-elevated` | `#1a1a1a` | Hover state, dropdown |
| `--color-border` | `#1f1f1f` | All borders, dividers |
| `--color-border-strong` | `#2a2a2a` | Emphasized borders |
| `--color-ink` | `rgba(255,255,255,0.92)` | Primary text |
| `--color-slate` | `rgba(255,255,255,0.55)` | Secondary text, labels |
| `--color-steel` | `rgba(255,255,255,0.35)` | Muted text, placeholders |
| `--color-accent` | `#8b5cf6` | Primary CTA, active states |
| `--color-accent-hover` | `#7c3aed` | Accent hover |
| `--color-accent-subtle` | `rgba(139,92,246,0.12)` | Accent background tint |
| `--color-success` | `#4ade80` | Success states |
| `--color-warning` | `#fbbf24` | Due soon, caution |
| `--color-danger` | `#f87171` | Destructive, overdue |
| `--color-glass-bg` | `rgba(255,255,255,0.08)` | Subtle glass (nav, modal) |
| `--color-glass-border` | `rgba(255,255,255,0.12)` | Glass element borders |

### Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `6px` | Buttons, inputs, badges |
| `--radius-md` | `8px` | Cards, panels |
| `--radius-lg` | `12px` | Modals, bottom sheets |
| `--radius-full` | `9999px` | Pills, avatar rings |

### Typography

Inter remains the sole typeface. Scale unchanged — no fluid clamp.

### Motion

Spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) retained for interactive state changes. Duration reduced to 150–220ms for product UI. All animations respect `prefers-reduced-motion`.

---

## Component Migration Map

### Replace with shadcn components

| Current | shadcn Component | Notes |
|---|---|---|
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-sm` | `Button` + variants | Custom variant: `jelly` for green confirm actions |
| `.auth-input`, `<input>` | `Input` | Custom dark styling via CSS vars |
| `<label>` | `Label` | |
| `.auth-card` | `Card` | |
| `.card`, `.card-surface` | `Card` + `CardContent` variants | `surface` variant = lighter |
| `.modal-overlay`, `.modal`, `.modal-plain`, `.modal-form` | `Dialog` + `Sheet` (mobile bottom) | Sheet for mobile, Dialog for desktop |
| `.confirm-dialog` + `useConfirm()` | `AlertDialog` | Update hook to use AlertDialog internally |
| Native `<select>` | `Select` (Radix) | Accessible, keyboard-nav |
| `.auth-error`, `.auth-success` | inline with `cn()` + color tokens | No separate component needed |
| Status badges (overdue/ok/warn) | `Badge` + variants | `overdue`, `ok`, `warn` variants |

### Rewrite with Tailwind utilities

| Current | New | Notes |
|---|---|---|
| `.modal-header`, `.modal-body`, `.modal-footer` | Tailwind layout classes inside Dialog | Structure moves to JSX |
| Top nav bar | Tailwind + subtle glass CSS vars | `backdrop-blur-sm`, glass tokens |
| Bottom nav (mobile) | Tailwind utilities | Solid dark, no glass |
| `.acct-section`, `.acct-section-row` | Tailwind layout | AccountPage only |
| `.auth-field` | Tailwind `flex flex-col gap-1.5` | |

### Keep custom (not replaced by shadcn)

| Component | Reason |
|---|---|
| FAB (GaragePage) | No shadcn equivalent, complex radial expansion |
| Garage bike selector/dropdown | Custom card-based UI |
| SwipeReveal rows | Touch gesture component, no shadcn equivalent |
| SkeletonCard | Custom dimensions |
| View Transitions (page nav) | CSS View Transitions API, no shadcn |

---

## shadcn Components to Install

```
npx shadcn@latest add button input label card dialog alert-dialog
npx shadcn@latest add select badge separator tabs
npx shadcn@latest add sheet toast
```

---

## File Structure Changes

```
frontend/src/
├── components/ui/          ← shadcn outputs here (Button, Input, Dialog…)
├── components/             ← custom components (FAB, SwipeReveal, SkeletonCard…)
├── lib/
│   └── utils.ts            ← cn() utility (added by shadcn init)
└── index.css               ← @tailwind + @theme tokens + legacy classes (phased out)
```

`tailwind.config.ts` is **not used** in Tailwind v4 — config lives in `index.css` via `@theme`.

---

## Implementation Phases

### Phase 0: Setup (1–2 days)
- Install `@tailwindcss/vite`, configure in `vite.config.ts`
- Run `npx shadcn@latest init` — choose: TypeScript, Zinc base, CSS variables, dark mode via class
- Add `@theme` block to `index.css` with Direction C tokens
- Add `cn()` utility, `tailwindcss-animate`
- Verify: existing app still works (index.css intact, Tailwind + old CSS coexist)

### Phase 1: Shared Components (3–5 days)
- `Button` — replace all `.btn*` usages across all pages
- `Input` + `Label` — replace all `.auth-input` usages
- `Card` — replace `.card`, `.card-surface`
- `Badge` — replace status pill patterns
- `Dialog` + `Sheet` — replace `.modal*` system, update `createPortal` usages
- `AlertDialog` — replace `.confirm-dialog`, update `useConfirm()` hook
- `Select` — replace native selects

After Phase 1: delete corresponding legacy blocks from `index.css`.

### Phase 2: Pages (1–2 weeks)
Priority order:

1. **AuthPage** — Form, Input, Button, Card. Cleanest migration, lowest risk.
2. **AccountPage** — Dialog → Sheet (mobile), section layout with Tailwind
3. **GaragePage** — Card, Badge, FAB (keep custom), stats row
4. **BikePage** — Card, image upload UI, log rows
5. **ServiceRemindersPage** — List, Badge, SwipeReveal rows
6. **ExpenseDashboardPage** — Card, chart wrappers
7. **SettingsPage** — Card sections, Select, Toggle
8. **ShockSettingsPage** — Slider/Stepper (Radix primitives), Card groups

After each page: delete page-specific legacy CSS from `index.css`.

### Phase 3: Cleanup (1–2 days)
- Delete remaining `index.css` legacy classes (verify nothing references them)
- Update `CLAUDE.md` design system table — replace Jelly Glass references
- Update `DESIGN.md` with new token values and component list
- Delete `visual-directions.html` (brainstorm artifact)

---

## Light Mode & Dark Mode Class Strategy

**Current:** app is dark by default; `html.light` class activates light mode.  
**Tailwind v4 default:** uses `.dark` class for dark mode, which conflicts.

**Resolution:** Configure Tailwind v4 dark mode with a custom variant:
```css
/* index.css */
@custom-variant dark (&:not(.light));
```
This tells Tailwind's `dark:` modifier to apply when `.light` is NOT on `<html>` — matching the existing behavior exactly. No change to `useTheme.ts` or any existing logic.

Light mode token mapping is deferred to after Phase 2 — dark tokens are defined first.

---

## What This Does NOT Change

- Backend, API, routing — no changes
- Data model, hooks, query patterns — no changes  
- TypeScript types, API clients — no changes
- Page structure and navigation flow — preserved
- Core animations (spring easing, view transitions) — preserved
- FAB, SwipeReveal, bike selector — kept as custom components

---

## Success Criteria

- All pages render correctly with new design system
- No `.btn`, `.card`, `.modal`, `.auth-input` classes remain in JSX (replaced by shadcn)
- `index.css` contains only: `@tailwind`, `@theme` tokens, and component CSS for custom components (FAB, SwipeReveal)
- `shadcn` components use Direction C tokens (dark, 8px radius, subtle glass where applicable)
- Existing functionality unchanged (auth, CRUD, image upload, navigation)
