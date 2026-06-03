# BikeCard Tap + Hero Morph Transition

**Date:** 2026-05-20  
**Scope:** `frontend/src/components/bikes/BikeCard.tsx`, `frontend/src/pages/BikePage.tsx`

---

## Goal

Add two missing animations to the GaragePage → BikePage navigation:

1. **Press feedback** — visual tap response on the card before navigation
2. **Hero morph** — shared-element transition that morphs the bike hero from card size to page hero size

---

## 1. Press Feedback (BikeCard.tsx)

### State

Add `pressing: boolean` state to `BikeCard`.

### Event handlers

Attach to the **hero div** (`onClick={goToBike}`, has `viewTransitionName`) and the **stats div** (`onClick={goToBike}`, `.garage-card-stats`):

| Event | Action |
|---|---|
| `onPointerDown` | `setPressing(true)` |
| `onPointerLeave` (when no button held) | `setPressing(false)` |
| `onPointerCancel` | `setPressing(false)` |

Do **not** attach `onPointerUp` — `goToBike()` owns the reset flow.

### Visual

```
transform: pressing ? 'scale(0.975)' : 'none'
transition: pressing ? 'none' : 'transform 0.2s ease'
```

Transition is disabled while pressing so scale snaps instantly; re-enabled on release for smooth spring back.

### Modified goToBike()

```
1. Set pressing(true) (ensures feedback even on fast fast tap)
2. Wait 80ms  ← user sees the press
3. setPressing(false)
4. cardRef.current: transition = "none", transform = "none"  ← clean VT snapshot
5. navigate(`/bikes/${bike.id}`, { viewTransition: true })
```

### Scope

The `+ บันทึกรายการ` button area sits below the stats row in a separate `<div>` — it is **not** a child of either event target, so it is unaffected.

---

## 2. Hero Morph Transition

### Current state

| Element | `viewTransitionName` |
|---|---|
| BikeCard hero div | `bike-hero-${bike.id}` (always) |
| BikePage hero (with photo) | `bike-hero-${bid}` ✅ |
| BikePage hero (no photo) | ❌ missing |

### Fix

Add `viewTransitionName: \`bike-hero-${bid}\`` to the no-photo placeholder `<button>` in `BikePage.tsx` (the 📷 "เพิ่มรูปรถ" button).

### CSS

No new CSS required. The existing rule already handles all named transitions:

```css
::view-transition-group(*) {
  animation-duration: 380ms;
  animation-timing-function: var(--jelly-ease);
}
```

The browser:
- Excludes the named `bike-hero-*` element from the root fade/slide
- Morphs its position + size independently with jelly-ease

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/bikes/BikeCard.tsx` | Add `pressing` state, event handlers, goToBike delay |
| `frontend/src/pages/BikePage.tsx` | Add `viewTransitionName` to no-photo placeholder |
| `frontend/src/index.css` | No change needed |

---

## Non-goals

- No changes to back-navigation animation (already handled by `data-nav-dir="back"`)
- No changes to the "+" button behavior
- No new libraries
