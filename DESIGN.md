---
name: My Bike
description: Personal motorcycle maintenance tracker — bold, dark, yours.
colors:
  void-black: "#09091a"
  glass-surface: "rgba(255,255,255,0.06)"
  glass-elevated: "rgba(255,255,255,0.11)"
  glass-border: "rgba(255,255,255,0.15)"
  phosphor-violet: "#a78bfa"
  phosphor-violet-dim: "#6e5dd4"
  phosphor-green: "#39ff96"
  warning-red: "#ff7070"
  ink-primary: "rgba(255,255,255,0.92)"
  ink-secondary: "rgba(255,255,255,0.52)"
  ink-muted: "rgba(255,255,255,0.32)"
  accent-amber: "#ffbe0b"
typography:
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "16px"
  md: "24px"
  lg: "32px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "rgba(109,40,217,0.82) + backdrop-filter: blur(16px) saturate(180%)"
    textColor: "#ffffff"
    borderColor: "rgba(167,139,250,0.50)"
    rounded: "{rounded.sm}"
    padding: "9px 20px"
  button-jelly:
    backgroundColor: "rgba(5,150,105,0.78) + backdrop-filter: blur(16px) saturate(180%)"
    textColor: "#ecfdf5"
    borderColor: "rgba(52,211,153,0.42)"
    rounded: "{rounded.sm}"
    padding: "9px 20px"
  button-secondary:
    backgroundColor: "rgba(255,255,255,0.08) + backdrop-filter: blur(16px) saturate(150%)"
    textColor: "{ink-primary}"
    borderColor: "rgba(255,255,255,0.13)"
    rounded: "{rounded.sm}"
    padding: "9px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{ink-secondary}"
    rounded: "{rounded.sm}"
    padding: "9px 20px"
  button-danger:
    backgroundColor: "rgba(220,38,38,0.72) + backdrop-filter: blur(16px) saturate(160%)"
    textColor: "#ffffff"
    borderColor: "rgba(252,165,165,0.30)"
    rounded: "{rounded.sm}"
    padding: "9px 20px"
  card-glass:
    backgroundColor: "rgba(255,255,255,0.07) + backdrop-filter: blur(24px) saturate(180%)"
    borderColor: "rgba(255,255,255,0.15)"
    rounded: "{rounded.md}"
    padding: "20px"
  input-default:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{ink-primary}"
    borderColor: "rgba(255,255,255,0.15)"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  modal:
    backgroundColor: "rgba(12,12,28,0.82) + backdrop-filter: blur(36px) saturate(200%)"
    rounded: "{rounded.lg} (top only on mobile, all corners on ≥640px)"
    maxWidth: "480px"
---

# Design System: My Bike

## 1. Overview

**Creative North Star: "The Rider's Instrument Panel"**

My Bike's interface is built on a single metaphor: a precision instrument panel — dark, purposeful, and unmistakably personal. Every surface is a glass layer over a deep void, every accent is a phosphor glow. The design doesn't decorate; it *informs*. When a user opens this app at a petrol station or in the garage, information must be readable in one glance and actions must be reachable with one thumb.

The Jelly Glass system is the identity, not a theme. Dark mode is the product. Surfaces are translucent glass panels stacked over `#09091a` void-black. Accent colors (`#a78bfa` violet, `#39ff96` green, `#ff7070` red, `#ffbe0b` amber) behave like instrument lights: rare, meaningful, never decorative. Motion is spring-loaded — physical and responsive, never performative.

A light mode exists (`html.light`) as a usability concession for bright environments, but it is a secondary path — the glass aesthetic is preserved rather than inverted. New features should be designed dark-first.

This system explicitly rejects: generic SaaS grays, bloated OEM car-app chrome, over-animated interface theater, and plain-white utility design.

**Key Characteristics:**
- Dark-first: `#09091a` void-black canvas, glass surfaces via `rgba(255,255,255,0.06–0.11)`
- Glass treatment: all surfaces use `backdrop-filter: blur()` — never flat/opaque fills
- Jelly physics: `cubic-bezier(0.34, 1.56, 0.64, 1)` — snappy spring, never bouncy
- Phosphor accents: violet primary, green success, red warning, amber caution — sparse
- Touch-native: 44px minimum targets, thumb-zone-biased layout, swipe-reveal on list rows
- View Transitions: directional slide (forward/back) via CSS View Transitions API
- One sans: Inter throughout — no display font, no decorative mixing

## 2. Colors: The Phosphor Palette

Dark glass layers over void — accents glow like instrument lights.

### Primary
- **Phosphor Violet** (`#a78bfa` / `--purple`): The single primary accent. Used on CTAs, active states, selected items, focus rings, and the app logo. Never used as a background fill across more than 10% of any screen. Light mode resolves to `#6e5dd4`.

### Secondary
- **Phosphor Green** (`#39ff96` / `--green`): Success, confirmation, connected states, verified badges. Used as glow on avatar rings and positive data points. Never for actions. Light mode: `#0f9b6c`.
- **Warning Amber** (`#ffbe0b` / `--accent-amber`): Caution states, "due soon" reminders, mid-range status. Light mode: `#d97706`.

### Tertiary
- **Warning Red** (`#ff7070` / `--red`): Destructive actions, overdue reminders, error states. Always paired with a confirmation step. Never decorative. Light mode: `#e05050`.

### Neutral
- **Void Black** (`#09091a` / `--canvas`): The canvas. Every screen starts here.
- **Glass Surface** (`rgba(255,255,255,0.06)` / `--surface`): Cards, inputs, panels — the first glass layer.
- **Glass Surface Soft** (`rgba(255,255,255,0.04)` / `--surface-soft`): Subtler inset areas, dividers that need less presence than `--surface`.
- **Glass Elevated** (`rgba(255,255,255,0.11)` / `--elevated`): Hover states, dropdowns, elevated surfaces.
- **Glass Bg** (`rgba(255,255,255,0.07)` / `--glass-bg`): The card background shorthand token.
- **Glass Border** (`rgba(255,255,255,0.15)` / `--glass-border`): Hairlines, input strokes, card borders.

### Text
- **Ink** (`rgba(255,255,255,0.92)` / `--ink`): Body text, headings, values. Never pure white.
- **Slate** (`rgba(255,255,255,0.52)` / `--slate`, aliased `--text-secondary`): Labels, metadata, secondary text.
- **Steel** (`rgba(255,255,255,0.32)` / `--steel`, aliased `--text-muted`): Placeholders, disabled states.
- **Muted** (`rgba(255,255,255,0.16)` / `--muted`): Hairline dividers, subtle separators.

### Hairlines
- `--hairline`: `rgba(255,255,255,0.10)` — standard dividers and list separators
- `--hairline-strong`: `rgba(255,255,255,0.18)` — more visible borders

### Semantic Variants
- `--purple-bg` / `--purple-border` / `--purple-hover`: Violet fill/stroke/hover swatches for non-button UI (chips, badges, active tab fills)
- `--red-bg`: `rgba(255,112,112,0.12)` — error/danger surface tint
- `--green-bg` / `--green-border`: `rgba(57,255,150,0.12)` / `rgba(57,255,150,0.32)` — success surface tint
- `--accent-green` / `--accent-amber` / `--accent-red`: Task status accent tokens (map to green/amber/red, adjusted for light mode)

### Named Rules
**The One Voice Rule.** Phosphor Violet appears on ≤10% of any given screen. If violet is everywhere, it marks nothing.

**The Glass Stack Rule.** Surfaces are never opaque. Every card, modal, and panel is a glass layer over void-black. Solid fills are forbidden except the canvas itself.

**The No Pure White Rule.** White text is always `rgba(255,255,255,0.92)`, never `#ffffff`. Pure white on dark glass causes halation.

## 3. Typography

**Body & UI Font:** Inter (with `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` fallback)

**Character:** A single humanist sans throughout — no display/body pairing. Inter's optical balance at small sizes makes it ideal for dense data (mileage, dates, km readings).

### Hierarchy
- **Title** (700, 16–20px, 1.3 line-height, `-0.01em`): Page headings, modal titles, bike names. Use `font-variant-numeric: tabular-nums` on numeric values.
- **Body** (400, 14px, 1.55 line-height): All reading text, descriptions, log entries. 65–75ch max line length on prose.
- **Label** (600, 12px, `0.04em` letter-spacing): Section headers, field labels, status badges.
- **Data** (500–700, 14–28px): Mileage readings, dates, fuel amounts. Always `font-variant-numeric: tabular-nums`.

### Named Rules
**The No Display Font Rule.** No decorative or display typefaces. Inter in its weight range is the entire typographic vocabulary.

## 4. Elevation

This system uses **tonal layering + ambient blur**, not drop shadows. Depth is conveyed by glass opacity stack: `--canvas` → `--surface` → `--elevated` → modal. Shadows are diffuse and dark — never crisp outlines.

### Shadow Vocabulary
- **Card shadow** (`0 8px 32px rgba(0,0,0,0.40)` / `--shadow-card`): Cards and panels against the canvas.
- **Modal shadow** (`0 24px 64px rgba(0,0,0,0.65)` / `--shadow-modal`): Full-screen overlays and bottom sheets.
- **Hairline border** (`rgba(255,255,255,0.10–0.18)`): The primary "elevation" signal for list items and inputs.

### Named Rules
**The Ambient-Only Rule.** No crisp offset shadows. Every shadow should read as a glow from underneath, not a box border.

## 5. Motion & Transitions

### Easing Tokens
- `--jelly-ease`: `cubic-bezier(0.34, 1.56, 0.64, 1)` — spring, slightly past then settle. Used for buttons, modal entrance, interactive state changes.
- `--jelly-fast`: `cubic-bezier(0.40, 1.60, 0.40, 0.90)` — faster spring, less overshoot. Used for micro-interactions that need snap without float.
- `--spring`: `0.38s cubic-bezier(0.34, 1.56, 0.64, 1)` — the full `transition` shorthand for spring animations.

### Page Transitions (View Transitions API)
Directional slide animations using the native View Transitions API:
- **Forward**: old page fades out + slides left (`translateX(-28px) scale(0.97)`), new page slides in from right (`translateX(48px)`)
- **Back**: triggered by `html[data-nav-dir="back"]` — reversed directions
- Duration: old exits at 200ms ease, new enters at 320ms `cubic-bezier(0.22, 1, 0.36, 1)`
- `navigate()` calls use `{ viewTransition: true }` option

### Reduced Motion
Every animation must have a `@media (prefers-reduced-motion: reduce)` fallback. The modal and page transitions collapse to instant crossfades. Jelly transforms collapse to `scale(1)`.

## 6. Components

### Buttons

All primary button variants use `backdrop-filter: blur()` — the glass treatment is built into the button system, not optional.

**Base `.btn`:** `display: inline-flex`, 9px 20px padding, 16px radius, 600 weight, 14px, spring transition. Press: `scale(0.94) translateY(2px)`. Hover: `scale(1.03)`. Disabled: 0.4 opacity. Touch devices: hover scale suppressed.

**`.btn-primary`:** Deep violet glass — `rgba(109,40,217,0.82)` + `backdrop-filter: blur(16px) saturate(180%)`, white text, `rgba(167,139,250,0.50)` border, violet glow shadow. The CTA. One per screen.

**`.btn-jelly`:** Emerald glass — `rgba(5,150,105,0.78)` + blur, `#ecfdf5` text, green border + glow. Used for positive confirmation actions (e.g. accept, save with positive valence).

**`.btn-secondary`:** Neutral glass — `rgba(255,255,255,0.08)` + blur, ink text, subtle white border + soft shadow. The standard secondary action button.

**`.btn-ghost`:** Transparent, slate text. Hover: `rgba(255,255,255,0.08)` fill. For tertiary / inline actions.

**`.btn-danger`:** Red glass — `rgba(220,38,38,0.72)` + blur, white text. Always paired with ConfirmDialog. Never fires on first click.

**`.btn-sm`:** `padding: 6px 14px; font-size: 13px` — for compact contexts.

### Cards / Glass Panels

- **`.card`:** `rgba(255,255,255,0.07)` background + `backdrop-filter: blur(24px) saturate(180%)`, `1px solid rgba(255,255,255,0.15)`, 24px radius, 20px padding, card shadow. Press feedback: `scale(0.97) translateY(2px)` via fast transition.
- **`.card-surface`:** Lighter variant — uses `--surface` bg + `--hairline` border + `blur(12px)`. For nested surfaces that need less visual weight than a full card.
- **Corner Style:** 24px (`--r-md`) for cards; 32px (`--r-lg`) for modals and full-page panels.

### Inputs / Fields

- **Style:** `rgba(255,255,255,0.06)` background, `1px solid rgba(255,255,255,0.15)` border, 16px radius, 10px 14px padding.
- **Focus:** Border → `var(--purple)`, `box-shadow: 0 0 0 3px var(--purple-bg)`, background lightens to `rgba(255,255,255,0.10)`.
- **Error:** Border to `rgba(255,112,112,0.5)`, helper text in `--red`.
- **Placeholder:** `--steel` (`rgba(255,255,255,0.32)`).

### Navigation

- **Top Bar** (desktop): Fixed, glass-surface background + `backdrop-filter` blur. App name/logo left, avatar right.
- **Bottom Nav** (mobile): Replaces top bar links. Tab icons for primary routes.
- **FAB** (Floating Action Button): Present on GaragePage — expands radially to show "เติมน้ำมัน" and "บำรุงรักษา" quick-log actions. Pulses when there are overdue reminders.

### Modal / Bottom Sheet (`.modal`)

- **Background:** `rgba(12,12,28,0.82)` + `backdrop-filter: blur(36px) saturate(200%)` — darker and more opaque than cards to focus attention.
- **Overlay:** `rgba(0,0,0,0.55)` + `backdrop-filter: blur(6px)`.
- **Mobile:** Bottom sheet, slides up via `--jelly-ease`. Drag handle visible.
- **Desktop (≥640px):** Centered dialog, `border-radius: var(--r-lg)` all corners, scales in.
- **Portal:** Always rendered via `ReactDOM.createPortal` to `document.body` — never inside overflow-hidden containers.
- **Variants:** `.modal-plain` (no drag handle), `.modal-form` (fixed header/footer, scrollable body), `.modal-box` (smaller, non-scrolling).

### ConfirmDialog (Signature Component)

The destructive action gate. Always two interactions minimum.
- Warning triangle in circular `rgba(255,112,112,0.12)` container, red stroke icon.
- Title (700, 15px) + description (14px, `--slate`).
- Ghost cancel + Danger confirm at footer, right-aligned.
- Invoked via `useConfirm()` hook: `const ok = await confirm("message", { title, confirmLabel })`.

### Garage Selector (Dropdown)

Card-based bike picker with animated expand/collapse. Open state adds `.open` class for the chevron rotation. Dropdown uses `.closing` class for exit animation. Options show thumbnail + name + mileage; active option shows violet checkmark.

### SwipeReveal (List Rows)

Service and fuel log rows reveal delete/edit actions on left swipe. Implemented via `useSwipeReveal` hook. Threshold-based commit: past ~40% reveal, action fires on release.

### StatusBadge

Small pill component for task status: overdue (red), due-soon (amber), ok (green). Uses `--accent-*` tokens.

### SkeletonCard

Loading placeholder with shimmer animation. Matches card dimensions for layout stability.

### EmptyState

Centered state for zero-data views: emoji icon (48px), h3 title, supporting paragraph, optional CTA button. Consistent padding: `56px 24px`.

## 7. Light Mode

Light mode is available via `html.light` on the root element, toggled by the user via `useTheme()` hook. It is a usability concession, not a brand expression — the glass aesthetic is preserved using white-tinted surfaces rather than dark ones.

**Key light-mode palette shifts:**
- Canvas: `#ecedf8` (cool periwinkle tint, not warm/cream)
- Surface: `rgba(255,255,255,0.55)`, elevated: `rgba(255,255,255,0.72)`
- Glass bg: `rgba(255,255,255,0.52)` — still translucent
- Text: `rgba(15,15,35,0.92)` for ink, same opacity ladder toward dark
- Hairlines: `rgba(0,0,0,0.08)` / `rgba(0,0,0,0.14)`
- Shadows: much lighter (`0 4px 24px rgba(0,0,0,0.10)`)
- Phosphor Violet → `#6e5dd4`; Red → `#e05050`; Green → `#0f9b6c`

Design dark-first. When adding new components, ensure light mode tokens are set — never leave a component that only works in dark.

## 8. Feature-Specific Patterns

### Expense Dashboard

Filter controls (year/month/bike) sit below the page header. Main data card shows total spend. Two visualization components below:
- **ExpenseCategoryBreakdown**: Horizontal bar chart per category (fuel/maintenance/other).
- **ExpenseTrendChart**: Monthly trend line/bar chart, last N months.
- Uses `--accent-amber` for fuel, `--purple` for maintenance, `--steel` for other.
- Empty state: no expenses logged yet → show prompt to add first entry.

### Shock Settings

Technical settings page with numeric slider/stepper inputs for preload, compression, rebound — organized by ride mode (street / heavy load). Inline SVG icons for spring, compression arrow, rebound arrow. Preset system: named configurations saved and recalled. Uses `.card` for each setting group with section labels at `--slate` weight.

## 9. Do's and Don'ts

### Do:
- **Do** use glass surfaces (`rgba(255,255,255,0.06–0.11)` + `backdrop-filter`) — never flat/opaque card fills.
- **Do** keep Phosphor Violet to ≤10% of any screen. Its scarcity is the signal.
- **Do** use `--jelly-ease` for interactive state changes — it's what makes the UI feel physical.
- **Do** size all touch targets at ≥44px height. This runs on mobile in bad lighting.
- **Do** use `font-variant-numeric: tabular-nums` for any mileage, date, or numeric column.
- **Do** keep motion under 380ms. Users are in a task; they're not watching an animation.
- **Do** use hairline borders (`rgba(255,255,255,0.10–0.18)`) as the primary elevation signal.
- **Do** pair destructive buttons with a ConfirmDialog — always two interactions, never one.
- **Do** use `ReactDOM.createPortal` for any modal/overlay rendered inside nav or overflow-hidden parents.
- **Do** set `html[data-nav-dir="back"]` before calling `navigate()` for back transitions.

### Don't:
- **Don't** use flat opaque fills for cards or panels — glass blur is non-negotiable.
- **Don't** use generic SaaS dashboard patterns — no Notion-style sidebar, no identical card grids.
- **Don't** use bloated OEM car-app chrome — no skeuomorphic widgets, no heavy nav gradients.
- **Don't** add over-animated transitions — no bounce easing, no page-load choreography.
- **Don't** use plain white backgrounds — even in light mode the canvas has periwinkle tint.
- **Don't** use display or decorative fonts. Inter is the entire typographic vocabulary.
- **Don't** use full-opacity white text. Always `rgba(255,255,255,0.92)` or lower.
- **Don't** use color alone to convey state — pair color with icon or text label.
- **Don't** use Modal as a first thought for settings. Accordion expansion is preferred over stacked modals.
