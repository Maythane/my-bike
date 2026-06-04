---
target: frontend/src/pages/ExpenseDashboardPage.tsx
total_score: 18
p0_count: 0
p1_count: 3
timestamp: 2026-06-02T15-55-31Z
slug: frontend-src-pages-expensedashboardpage-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | "กำลังโหลด…" bare text; no error state when queries fail |
| 2 | Match System / Real World | 3 | Thai throughout, real ownership categories — "‹ 2025" year nav slightly cryptic |
| 3 | User Control and Freedom | 2 | Month toggle-to-deselect discoverable by accident only; no reset-all |
| 4 | Consistency and Standards | 2 | Custom expense-modal bypasses design system; 3 chip size variants |
| 5 | Error Prevention | 2 | Future months disabled, canSave works — no message if amount is 0 |
| 6 | Recognition Rather Than Recall | 2 | Chart legend at 10px illegible; month toggle behavior invisible |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts; no quick-add from chart; no bulk actions |
| 8 | Aesthetic and Minimalist Design | 2 | 15+ filter controls above fold; two uppercase section eyebrows |
| 9 | Error Recovery | 1 | API failures silently produce blank screen; modal save no error path |
| 10 | Help and Documentation | 1 | No hint month tapping deselects; no tooltip on บาท/กม. |
| **Total** | | **18/40** | **Poor** |

## Anti-Patterns Verdict
Mostly passes. Custom stacked bar chart and category breakdown are lean and on-brand. Two uppercase section headers ("แนวโน้ม 6 เดือน" / "หมวดหมู่") are the eyebrow pattern. KPI card is close to hero-metric but contextually justified. Detector: 0 findings on expense files.

## Priority Issues

**[P1] All filter controls below 44px touch targets** — month chips ~17px, year nav ~17px, bike chips ~20px. Primary navigation on a mobile-first app.

**[P1] No error state for API failures** — failed queries silently render "no data" message, misleading users into thinking their data is gone.

**[P1] ExpenseModal bypasses design system** — custom backdrop/modal classes, no createPortal, borrows reminder-interval-input class, missing glass treatment and enter animations.

**[P2] 15+ filter controls above fold** — high cognitive load before any data visible; 4 of 8 cognitive load checklist items fail.

**[P2] Empty state is bare text paragraph** — no icon, no CTA, inconsistent with every other zero-data state in the app.

## Persona Red Flags
- **Casey**: "เพิ่ม" button top-right (hardest thumb zone); month chips at 17px fail one-handed; no state persistence across interruptions.
- **Sam**: Trend chart is pure visual with zero ARIA; category percentages not in DOM as text; expense-modal has no role="dialog" or aria-modal.
- **Arthit (solo rider)**: Retroactive entry requires navigating to previous month (2 taps + chip); notes textarea oversized; no success flash after save.

## Minor Observations
- CATEGORY_COLORS uses hardcoded hex (#f59e0b, #64748b, #38bdf8, #f472b6, #94a3b8) — no tokens, breaks light mode.
- ExpenseTrendChart uses #f59e0b44 (invalid 8-digit hex) for dimmed bar segments.
- Month labels in chart at fontSize: 9 — below 11px minimum.
- "แนวโน้ม 6 เดือน" hardcoded when chart renders variable month count.
- isCurrent detection (last bucket = current) is wrong when month-filtered.
- "เพิ่ม" button label too vague; "เพิ่มค่าใช้จ่าย" is clearer.
