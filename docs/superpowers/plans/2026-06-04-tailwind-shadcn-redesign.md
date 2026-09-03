# Tailwind + shadcn Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate My Bike's frontend from custom Jelly Glass CSS to Tailwind CSS v4 + shadcn/ui, achieving Direction C (Dark Formal — subtle glass, 8px radius, structured).

**Architecture:** Incremental migration — Tailwind v4 installed alongside existing `index.css`; shadcn components replace `.btn`/`.card`/`.modal`/`.auth-input` class by class; `index.css` shrinks per phase until only custom component CSS remains. All 8 pages migrate in Phase 2 using components built in Phase 1.

**Tech Stack:** Vite 8 + React 19 + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui (Tailwind v4 compatible), Radix UI primitives, `class-variance-authority`, `clsx`, `tailwind-merge`

---

## File Map

**Create:**
- `frontend/src/lib/utils.ts` — `cn()` utility (shadcn standard)
- `frontend/src/components/ui/button.tsx` — shadcn Button (customized)
- `frontend/src/components/ui/input.tsx` — shadcn Input (customized)
- `frontend/src/components/ui/label.tsx` — shadcn Label
- `frontend/src/components/ui/card.tsx` — shadcn Card (customized)
- `frontend/src/components/ui/badge.tsx` — shadcn Badge (customized)
- `frontend/src/components/ui/dialog.tsx` — shadcn Dialog (replaces .modal)
- `frontend/src/components/ui/sheet.tsx` — shadcn Sheet (mobile bottom sheet)
- `frontend/src/components/ui/alert-dialog.tsx` — shadcn AlertDialog
- `frontend/src/components/ui/select.tsx` — shadcn Select (Radix)
- `frontend/src/components/ui/separator.tsx` — shadcn Separator
- `frontend/src/components/ui/tabs.tsx` — shadcn Tabs
- `frontend/components.json` — shadcn config

**Modify:**
- `frontend/vite.config.ts` — add Tailwind v4 plugin + `@` path alias
- `frontend/tsconfig.app.json` — add `baseUrl` + `paths` for `@` alias
- `frontend/package.json` — add dependencies
- `frontend/src/index.css` — replace Jelly Glass system with Tailwind + Direction C tokens
- `frontend/src/components/ui/ConfirmDialog.tsx` — rewrite internals using AlertDialog
- `frontend/src/components/ui/StatusBadge.tsx` — rewrite using shadcn Badge
- `frontend/src/components/ui/BottomNav.tsx` — rewrite classes with Tailwind
- `frontend/src/components/ui/AvatarMenu.tsx` — rewrite classes with Tailwind
- `frontend/src/pages/AuthPage.tsx` — replace .auth-* + .btn with shadcn
- `frontend/src/pages/AccountPage.tsx` — replace .acct-* + .modal + .btn
- `frontend/src/pages/GaragePage.tsx` — replace .card + .btn + layout
- `frontend/src/pages/BikePage.tsx` — replace .card + .modal + .btn
- `frontend/src/pages/ServiceRemindersPage.tsx` — replace .card + .badge + .btn
- `frontend/src/pages/ExpenseDashboardPage.tsx` — replace .card + .btn + layout
- `frontend/src/pages/SettingsPage.tsx` — replace .card + .btn + Select
- `frontend/src/pages/ShockSettingsPage.tsx` — replace .card + .btn + inputs

---

## Phase 0: Setup

### Task 1: Install Tailwind v4 + Dependencies

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Install packages**

Run inside `frontend/`:
```bash
npm install tailwindcss @tailwindcss/vite
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate
```

Expected: no errors. `package.json` gains 5 new entries in `dependencies`/`devDependencies`.

- [ ] **Step 2: Update `vite.config.ts`**

Replace entire file:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Add TypeScript path alias**

In `frontend/tsconfig.app.json`, add inside `"compilerOptions"`:
```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

- [ ] **Step 4: Verify build works**

Run from `frontend/`:
```bash
npm run build
```
Expected: build succeeds, no TypeScript errors. App is unchanged visually.

- [ ] **Step 5: Commit**
```bash
git add frontend/vite.config.ts frontend/tsconfig.app.json frontend/package.json frontend/package-lock.json
git commit -m "feat: install Tailwind v4 + shadcn dependencies, add @ path alias"
```

---

### Task 2: Configure Design Tokens in `index.css`

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Replace the opening of `index.css`**

Find the first line (`/* ─── Jelly Glass Design System ──...`).
Replace everything from line 1 through the end of the `:root { ... }` block (approximately line 85, before `.btn` starts) with:

```css
@import "tailwindcss";
@import "tailwindcss-animate";

/* Dark is default. html.light enables light mode. */
@custom-variant dark (&:not(.light));

/* ── Tailwind v4: map CSS vars → utility classes ── */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
}

/* ── Direction C: Dark Formal tokens ── */
:root {
  /* shadcn-compatible variable names */
  --background:            oklch(0.09 0 0);        /* #0d0d0d */
  --foreground:            oklch(0.96 0 0);
  --card:                  oklch(0.11 0 0);        /* #141414 */
  --card-foreground:       oklch(0.96 0 0);
  --popover:               oklch(0.13 0 0);        /* #1a1a1a */
  --popover-foreground:    oklch(0.96 0 0);
  --primary:               oklch(0.60 0.22 293);   /* #8b5cf6 */
  --primary-foreground:    oklch(0.98 0 0);
  --secondary:             oklch(0.13 0 0);
  --secondary-foreground:  oklch(0.96 0 0);
  --muted:                 oklch(0.15 0 0);        /* #1f1f1f */
  --muted-foreground:      oklch(0.64 0 0);
  --accent:                oklch(0.60 0.22 293);
  --accent-foreground:     oklch(0.98 0 0);
  --destructive:           oklch(0.65 0.22 25);    /* #f87171 */
  --border:                oklch(0.18 0 0);        /* border hairline */
  --input:                 oklch(0.15 0 0);
  --ring:                  oklch(0.60 0.22 293);
  --radius:                0.5rem;                  /* 8px */

  /* App-specific (glass + status) */
  --glass-bg:     rgba(255, 255, 255, 0.08);
  --glass-border: rgba(255, 255, 255, 0.12);
  --success:      oklch(0.73 0.20 148);            /* #4ade80 */
  --warning:      oklch(0.85 0.17 84);             /* #fbbf24 */

  /* Legacy aliases — kept during migration, removed in Phase 3 */
  --canvas:       oklch(0.09 0 0);
  --surface:      rgba(255, 255, 255, 0.08);
  --glass-bg-old: rgba(255, 255, 255, 0.07);
  --purple:       oklch(0.60 0.22 293);
  --ink:          rgba(255, 255, 255, 0.92);
  --slate:        rgba(255, 255, 255, 0.55);
  --steel:        rgba(255, 255, 255, 0.35);
  --hairline:     rgba(255, 255, 255, 0.10);
  --hairline-strong: rgba(255, 255, 255, 0.18);
  --r:            6px;
  --r-md:         8px;
  --r-lg:         12px;
  --r-full:       9999px;
  --shadow-card:  0 8px 32px rgba(0, 0, 0, 0.40);
  --shadow-modal: 0 24px 64px rgba(0, 0, 0, 0.65);
  --jelly-ease:   cubic-bezier(0.34, 1.56, 0.64, 1);
  --spring:       0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ── Light mode overrides ── */
html.light {
  --background:            oklch(0.98 0 0);
  --foreground:            oklch(0.09 0 0);
  --card:                  oklch(1 0 0);
  --card-foreground:       oklch(0.09 0 0);
  --popover:               oklch(1 0 0);
  --popover-foreground:    oklch(0.09 0 0);
  --primary:               oklch(0.53 0.24 293);
  --primary-foreground:    oklch(0.98 0 0);
  --secondary:             oklch(0.95 0 0);
  --secondary-foreground:  oklch(0.09 0 0);
  --muted:                 oklch(0.95 0 0);
  --muted-foreground:      oklch(0.45 0 0);
  --accent:                oklch(0.53 0.24 293);
  --accent-foreground:     oklch(0.98 0 0);
  --destructive:           oklch(0.58 0.22 25);
  --border:                oklch(0.90 0 0);
  --input:                 oklch(0.95 0 0);
  --ring:                  oklch(0.53 0.24 293);
  --glass-bg:    rgba(255, 255, 255, 0.55);
  --glass-border: rgba(0, 0, 0, 0.08);
  --success:     oklch(0.55 0.17 145);
  --warning:     oklch(0.65 0.15 84);
  /* Legacy */
  --canvas:      oklch(0.94 0.005 240);
  --ink:         rgba(15, 15, 35, 0.92);
  --slate:       rgba(15, 15, 35, 0.55);
  --steel:       rgba(15, 15, 35, 0.35);
  --hairline:    rgba(0, 0, 0, 0.08);
}
```

Keep everything below this block (`.btn`, `.card`, `.modal`, etc.) — those remain until Phase 1.

- [ ] **Step 2: Add global base styles below the token block**

After the `html.light { }` block, before `.btn`, add:

```css
/* ── Base ── */
@layer base {
  * { border-color: var(--border); }
  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
}
```

- [ ] **Step 3: Create `src/lib/utils.ts`**
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Verify build + visual**

```bash
npm run build
```
Expected: build passes. Open `http://localhost:8764` in dev mode — app looks identical to before (Tailwind coexists with old CSS, base styles are neutral).

- [ ] **Step 5: Commit**
```bash
git add frontend/src/index.css frontend/src/lib/utils.ts
git commit -m "feat: add Direction C design tokens + Tailwind v4 @theme config"
```

---

### Task 3: Init shadcn

**Files:**
- Create: `frontend/components.json`
- Modify: `frontend/src/index.css` (shadcn may add variables — review and keep our tokens)

- [ ] **Step 1: Run shadcn init**

From `frontend/`:
```bash
npx shadcn@latest init
```

Answer the prompts:
- Which style? → **Default**
- Base color? → **Zinc**
- CSS variables? → **Yes**

- [ ] **Step 2: Review `components.json`**

shadcn creates `frontend/components.json`. Verify it contains:
```json
{
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 3: Fix `index.css` if shadcn overwrote tokens**

shadcn init may have added its own `:root` / `.dark` block. If so:
- Delete the shadcn-generated `:root` and `.dark` blocks (ours are in `:root` / `html.light` from Task 2)
- Keep the `@import "tailwindcss"` and `@theme inline` block if shadcn regenerated them, but replace with our version from Task 2 if different
- Keep the `@custom-variant dark (&:not(.light));` line

- [ ] **Step 4: Verify build**
```bash
npm run build
```
Expected: passes, no errors.

- [ ] **Step 5: Commit**
```bash
git add frontend/components.json frontend/src/index.css
git commit -m "feat: init shadcn/ui with Tailwind v4 + Direction C tokens"
```

---

## Phase 1: Shared Components

### Task 4: Install All shadcn Components

**Files:**
- Create: all `frontend/src/components/ui/*.tsx` listed in File Map

- [ ] **Step 1: Install components**

From `frontend/`:
```bash
npx shadcn@latest add button input label card badge dialog alert-dialog select sheet separator tabs
```

Expected: `src/components/ui/` gains: `button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `select.tsx`, `sheet.tsx`, `separator.tsx`, `tabs.tsx`

- [ ] **Step 2: Verify build**
```bash
npm run build
```
Expected: passes.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/ui/
git commit -m "feat: add shadcn ui components (button, input, card, dialog, etc.)"
```

---

### Task 5: Customize Button + Migrate All Usages

**Files:**
- Modify: `frontend/src/components/ui/button.tsx`
- Modify: all files using `.btn*` classes (grep to find them)

- [ ] **Step 1: Find all `.btn` usages**
```bash
grep -rn 'className=".*btn' frontend/src --include="*.tsx" | grep -v "node_modules"
```
Note every file returned.

- [ ] **Step 2: Replace `button.tsx` content**

Full replacement for `frontend/src/components/ui/button.tsx`:
```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--radius-sm)] text-sm font-semibold",
    "transition-all duration-[220ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    "disabled:pointer-events-none disabled:opacity-40",
    "active:scale-[0.94] active:translate-y-px",
    "@media (hover: hover) { hover:scale-[1.02] }",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        secondary:
          "bg-white/[0.08] text-foreground border border-white/[0.13] backdrop-blur-sm hover:bg-white/[0.12]",
        ghost:
          "text-muted-foreground hover:bg-white/[0.08] hover:text-foreground",
        destructive:
          "bg-destructive/70 text-white border border-destructive/30 backdrop-blur-sm hover:bg-destructive/80",
        outline:
          "border border-border bg-transparent hover:bg-muted text-foreground",
        jelly:
          "bg-emerald-600/75 text-emerald-50 border border-emerald-400/40 backdrop-blur-sm hover:bg-emerald-600/85",
      },
      size: {
        default: "h-9 px-5 py-2",
        sm: "h-7 px-3.5 py-1.5 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 3: Migrate `.btn` classes across all pages/components**

Replacement mapping — apply to every file found in Step 1:

| Old className | New JSX |
|---|---|
| `className="btn btn-primary"` | `<Button variant="default">` |
| `className="btn btn-secondary"` | `<Button variant="secondary">` |
| `className="btn btn-ghost"` | `<Button variant="ghost">` |
| `className="btn btn-danger"` | `<Button variant="destructive">` |
| `className="btn btn-jelly"` | `<Button variant="jelly">` |
| `className="btn btn-primary btn-sm"` | `<Button variant="default" size="sm">` |
| `className="btn btn-ghost btn-sm"` | `<Button variant="ghost" size="sm">` |

Add import to each file that uses Button:
```tsx
import { Button } from "@/components/ui/button";
```

Remove `<button>` elements — replace with `<Button>`. Keep `onClick`, `disabled`, `type`, `autoFocus` props unchanged.

- [ ] **Step 4: Delete `.btn` blocks from `index.css`**

Remove all CSS blocks starting with `.btn` through the end of `.btn-sm { ... }` (and their `html.light` overrides). These are no longer needed.

- [ ] **Step 5: Verify build + visual**
```bash
npm run build
```
Open the app. All buttons should render with Direction C styling (violet primary, dark secondary/ghost). Check AuthPage login button, ConfirmDialog buttons.

- [ ] **Step 6: Migrate `AvatarMenu.tsx` button classes**
```bash
grep -n 'className=.*btn' frontend/src/components/ui/AvatarMenu.tsx
```
Replace any `className="btn btn-ghost"` with `<Button variant="ghost">` and `className="btn btn-secondary"` with `<Button variant="secondary">`. Add `import { Button } from "@/components/ui/button"` at top of file.

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "feat: migrate .btn* classes to shadcn Button component"
```

---

### Task 6: Customize Input + Label + Migrate Usages

**Files:**
- Modify: `frontend/src/components/ui/input.tsx`
- Modify: `frontend/src/components/ui/label.tsx`
- Modify: all files using `.auth-input`, `.auth-field`, `.auth-error`, `.auth-success`

- [ ] **Step 1: Replace `input.tsx` content**
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-[var(--radius-sm)]",
        "border border-border bg-input px-3.5 py-2.5",
        "text-sm text-foreground placeholder:text-muted-foreground/60",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "focus-visible:border-primary focus-visible:bg-white/[0.10]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 2: Replace `label.tsx` content**
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-xs font-semibold text-muted-foreground",
        "leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Label.displayName = "Label";

export { Label };
```

- [ ] **Step 3: Find all input/field usages**
```bash
grep -rn 'auth-input\|auth-field\|auth-error\|auth-success\|auth-card' frontend/src --include="*.tsx"
```

- [ ] **Step 4: Replace in each file found**

Pattern replacements:
```tsx
// Old
<input className="auth-input" ... />
// New
<Input ... />   // import { Input } from "@/components/ui/input"

// Old
<div className="auth-field">
  <label>...</label>
  <input className="auth-input" ... />
</div>
// New
<div className="flex flex-col gap-1.5">
  <Label htmlFor="...">...</Label>
  <Input id="..." ... />
</div>

// Old
<div className="auth-error">message</div>
// New
<p className="text-xs text-destructive mt-1">message</p>

// Old
<div className="auth-success">message</div>
// New
<p className="text-xs text-[oklch(0.73_0.20_148)] mt-1">message</p>

// Old
<div className="auth-card">
// New
<div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-lg backdrop-blur-sm">
```

- [ ] **Step 5: Delete from `index.css`**

Remove: `.auth-input`, `.auth-field`, `.auth-error`, `.auth-success`, `.auth-card`, `.auth-link` blocks and their `html.light` overrides.

- [ ] **Step 6: Verify build**
```bash
npm run build
```

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "feat: migrate auth inputs to shadcn Input + Label"
```

---

### Task 7: Customize Card + Badge + Migrate Usages

**Files:**
- Modify: `frontend/src/components/ui/card.tsx`
- Modify: `frontend/src/components/ui/badge.tsx`
- Modify: `frontend/src/components/ui/StatusBadge.tsx`
- Modify: all files using `.card`, `.card-surface`

- [ ] **Step 1: Replace `card.tsx` content**
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius-md)] border border-border bg-card text-card-foreground",
        "shadow-[0_8px_32px_rgba(0,0,0,0.40)]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 p-5 pb-3", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.ComponentProps<"p">>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm font-bold leading-tight tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-5 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
```

- [ ] **Step 2: Replace `badge.tsx` content**
```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary border border-primary/30",
        ok:      "bg-[oklch(0.73_0.20_148)]/10 text-[oklch(0.73_0.20_148)] border border-[oklch(0.73_0.20_148)]/25",
        warn:    "bg-[oklch(0.85_0.17_84)]/10 text-[oklch(0.85_0.17_84)] border border-[oklch(0.85_0.17_84)]/25",
        overdue: "bg-destructive/10 text-destructive border border-destructive/25",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 3: Rewrite `StatusBadge.tsx`**

Replace entire file:
```tsx
import { Badge } from "@/components/ui/badge";

type Status = "ok" | "warn" | "overdue";

interface Props {
  status: Status;
  label?: string;
}

const LABELS: Record<Status, string> = {
  ok: "ปกติ",
  warn: "ใกล้ครบ",
  overdue: "เกินกำหนด",
};

export default function StatusBadge({ status, label }: Props) {
  return <Badge variant={status}>{label ?? LABELS[status]}</Badge>;
}
```

- [ ] **Step 4: Replace `.card` usages**
```bash
grep -rn 'className="card\|className="card-surface' frontend/src --include="*.tsx"
```

For each:
```tsx
// Old
<div className="card">...</div>
// New
<Card>...</Card>   // import { Card } from "@/components/ui/card"

// Old
<div className="card-surface">...</div>
// New
<div className="rounded-[var(--radius-md)] border border-border/60 bg-white/[0.04] p-4">...</div>
```

- [ ] **Step 5: Delete from `index.css`**

Remove: `.card`, `.card-surface` blocks and their `html.light` overrides.

- [ ] **Step 6: Verify**
```bash
npm run build
```

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "feat: migrate .card + badge patterns to shadcn Card + Badge"
```

---

### Task 8: Customize Dialog + Sheet (Replace `.modal` System)

**Files:**
- Modify: `frontend/src/components/ui/dialog.tsx`
- Modify: `frontend/src/components/ui/sheet.tsx`
- Modify: all files using `.modal-overlay`, `.modal`, `.modal-plain`, `.modal-form`

- [ ] **Step 1: Replace `dialog.tsx`**

Full replacement:
```tsx
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/55 backdrop-blur-[6px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        /* Desktop: centered modal */
        "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
        "w-full max-w-[480px] max-h-[85dvh] overflow-y-auto",
        "rounded-[var(--radius-lg)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] backdrop-blur-[8px]",
        "shadow-[0_24px_64px_rgba(0,0,0,0.65)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "duration-200",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 px-6 pt-6 pb-4 border-b border-border", className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center justify-end gap-2 px-6 py-4 border-t border-border", className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[15px] font-bold leading-tight tracking-tight text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger,
  DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
};
```

- [ ] **Step 2: Find all `.modal` usages**
```bash
grep -rn 'className="modal\|modal-overlay\|modal-plain\|modal-form\|modal-header\|modal-body\|modal-footer' frontend/src --include="*.tsx"
```

- [ ] **Step 3: Migrate modal markup pattern**

For each modal found, convert from this:
```tsx
{createPortal(
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header"><h2>Title</h2></div>
      <div className="modal-body">...</div>
      <div className="modal-footer">...</div>
    </div>
  </div>,
  document.body
)}
```

To this (Dialog handles portal internally — remove `createPortal`):
```tsx
<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    <div className="px-6 py-4">...</div>
    <DialogFooter>
      <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
      <Button onClick={onSave}>บันทึก</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Note: `open` prop must be added to modals that were previously always-mounted. Pass the visibility state as `open={isOpen}` and use `onOpenChange` to close.

- [ ] **Step 4: Delete from `index.css`**

Remove: `.modal-overlay`, `.modal`, `.modal-plain`, `.modal-form`, `.modal-box`, `.modal-header`, `.modal-body`, `.modal-footer`, `.drag-handle` blocks and their responsive overrides.

- [ ] **Step 5: Verify**
```bash
npm run build
```
Open app and test opening/closing a modal.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat: migrate .modal system to shadcn Dialog + remove createPortal"
```

---

### Task 9: Update AlertDialog + `ConfirmDialog`

**Files:**
- Modify: `frontend/src/components/ui/ConfirmDialog.tsx`
- No change to `frontend/src/hooks/useConfirm.ts` (interface preserved)

- [ ] **Step 1: Replace `ConfirmDialog.tsx` content**

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const WarningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);

interface Props {
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "ยืนยัน",
  onConfirm,
  onCancel,
  danger = true,
}: Props) {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          {danger && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/12 text-destructive mb-2">
              <WarningIcon />
            </div>
          )}
          <AlertDialogTitle>{title ?? "ยืนยัน"}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            autoFocus
            className={cn(danger && "bg-destructive/70 text-white border-destructive/30 hover:bg-destructive/80")}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Delete from `index.css`**

Remove: `.confirm-dialog`, `.confirm-dialog-body`, `.confirm-dialog-icon`, `.confirm-dialog-text`, `.confirm-dialog-title`, `.confirm-dialog-message`, `.confirm-dialog-footer` blocks.

- [ ] **Step 3: Verify**
```bash
npm run build
```
Test a delete action in the app — confirm dialog should appear using shadcn AlertDialog styling.

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "feat: migrate ConfirmDialog to shadcn AlertDialog"
```

---

## Phase 2: Pages

> **Pattern note:** Each page migration follows the same steps: (1) grep for old CSS classes, (2) replace with shadcn components + Tailwind utilities, (3) remove page-specific CSS from `index.css`, (4) build + verify, (5) commit.

### Task 10: Migrate AuthPage

**Files:**
- Modify: `frontend/src/pages/AuthPage.tsx` (16.3K — read in full before editing)

- [ ] **Step 1: Read the file**
```bash
cat -n frontend/src/pages/AuthPage.tsx
```

- [ ] **Step 2: Update imports at top of file**
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

- [ ] **Step 3: Apply class replacements**

| Old | New |
|---|---|
| `className="auth-card"` | `className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[8px] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.65)]"` |
| `<input className="auth-input"` | `<Input` |
| `<label` (unstyled) | `<Label` |
| `<button className="btn btn-primary"` | `<Button variant="default"` |
| `<button className="btn btn-ghost"` | `<Button variant="ghost"` |
| `<div className="auth-field">` | `<div className="flex flex-col gap-1.5">` |
| `<div className="auth-error">` | `<p className="text-xs text-destructive mt-1">` |
| `<div className="auth-success">` | `<p className="text-xs text-[oklch(0.73_0.20_148)] mt-1">` |
| `<a className="auth-link"` | `<a className="text-sm text-primary hover:text-primary/80 underline-offset-4 hover:underline"` |

- [ ] **Step 4: Remove AuthPage-specific CSS from `index.css`**

Remove any `.auth-*` rules still remaining.

- [ ] **Step 5: Verify + visual check**
```bash
npm run build
```
Navigate to `/login` — login form should render with Direction C Input + Button styling.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/pages/AuthPage.tsx frontend/src/index.css
git commit -m "feat: migrate AuthPage to shadcn Input + Button"
```

---

### Task 11: Migrate AccountPage

**Files:**
- Modify: `frontend/src/pages/AccountPage.tsx` (22.1K — read lines 1–100 first to understand structure)

- [ ] **Step 1: Read structure**
```bash
sed -n '1,100p' frontend/src/pages/AccountPage.tsx
```

- [ ] **Step 2: Update imports**
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
```

- [ ] **Step 3: Apply class replacements**

| Old | New |
|---|---|
| `.acct-section` wrapper | `<Card className="mb-3">` |
| `.acct-section` title | `<CardHeader><CardTitle>` |
| `.acct-section-row` | `<CardContent className="flex items-center justify-between py-3 border-t border-border first:border-t-0">` |
| `.acct-modal` | `<Dialog>` / `<DialogContent>` |
| `.acct-profile-edit` | Tailwind layout: `"flex flex-col items-center gap-4 py-6"` |
| `.btn*` | `<Button variant="...">` |
| `<input className="auth-input"` | `<Input` |

- [ ] **Step 4: Remove `.acct-*` from `index.css`**

- [ ] **Step 5: Verify**
```bash
npm run build
```

- [ ] **Step 6: Commit**
```bash
git add frontend/src/pages/AccountPage.tsx frontend/src/index.css
git commit -m "feat: migrate AccountPage to shadcn Card + Dialog"
```

---

### Task 12: Migrate GaragePage

**Files:**
- Modify: `frontend/src/pages/GaragePage.tsx` (28.5K — read in sections: 1–100, then 100–200, etc.)

- [ ] **Step 1: Read structure (lines 1–100)**
```bash
sed -n '1,100p' frontend/src/pages/GaragePage.tsx
```

- [ ] **Step 2: Update imports**
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
```

- [ ] **Step 3: Apply class replacements**

| Old | New |
|---|---|
| `<div className="card"` | `<Card` |
| `<div className="card-surface"` | `<div className="rounded-[var(--radius-md)] border border-border/60 bg-white/[0.04] p-4"` |
| status pill divs | `<Badge variant="ok|warn|overdue">` |
| `<button className="btn btn-primary"` | `<Button variant="default"` |
| `<button className="btn btn-ghost"` | `<Button variant="ghost"` |
| `.modal-overlay`/`.modal` sections | `<Dialog>` |
| Any remaining `var(--purple)` inline styles | `var(--primary)` |
| Any remaining `var(--canvas)` inline styles | `var(--background)` |

- [ ] **Step 4: Keep FAB custom**

The FAB (floating action button with radial expansion) uses inline styles and state — keep it as-is but replace any `.btn` classes inside it with `<Button>`.

- [ ] **Step 5: Remove GaragePage-specific CSS from `index.css`** (if any page-specific classes exist)

- [ ] **Step 6: Verify**
```bash
npm run build
```

- [ ] **Step 7: Commit**
```bash
git add frontend/src/pages/GaragePage.tsx frontend/src/index.css
git commit -m "feat: migrate GaragePage to shadcn Card + Button + Badge"
```

---

### Task 13: Migrate BikePage

**Files:**
- Modify: `frontend/src/pages/BikePage.tsx` (25.2K)

- [ ] **Step 1: Read lines 1–100**
```bash
sed -n '1,100p' frontend/src/pages/BikePage.tsx
```

- [ ] **Step 2: Imports**
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
```

- [ ] **Step 3: Apply class replacements** (see Quick Reference table at bottom of this plan)

Core replacements: `className="card"` → `<Card>`, `className="btn btn-primary"` → `<Button variant="default">`, `.modal-overlay`+`.modal` → `<Dialog><DialogContent>`.

Additional patterns for BikePage:
```tsx
// Old: image upload button area
<label className="btn btn-secondary" htmlFor="bike-image">...</label>
// New:
<Label htmlFor="bike-image" className="cursor-pointer">
  <Button variant="secondary" asChild><span>...</span></Button>
</Label>
```

- [ ] **Step 4: Build + verify + commit**
```bash
npm run build
git add frontend/src/pages/BikePage.tsx frontend/src/index.css
git commit -m "feat: migrate BikePage to shadcn components"
```

---

### Task 14: Migrate ServiceRemindersPage

**Files:**
- Modify: `frontend/src/pages/ServiceRemindersPage.tsx` (14.9K)

- [ ] **Step 1: Read lines 1–80**
```bash
sed -n '1,80p' frontend/src/pages/ServiceRemindersPage.tsx
```

- [ ] **Step 2: Imports**
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

- [ ] **Step 3: Replace StatusBadge if used inline**

If the page renders status pills inline (not via `StatusBadge` component):
```tsx
// Old
<span className="badge-ok">ปกติ</span>
// New
<Badge variant="ok">ปกติ</Badge>
```

- [ ] **Step 4: Apply standard replacements (`.card` → `<Card>`, `.btn*` → `<Button>`, modals → `<Dialog>`)**

- [ ] **Step 5: Build + verify + commit**
```bash
npm run build
git add frontend/src/pages/ServiceRemindersPage.tsx frontend/src/index.css
git commit -m "feat: migrate ServiceRemindersPage to shadcn components"
```

---

### Task 15: Migrate ExpenseDashboardPage

**Files:**
- Modify: `frontend/src/pages/ExpenseDashboardPage.tsx` (11.7K)

- [ ] **Step 1: Read lines 1–80**
```bash
sed -n '1,80p' frontend/src/pages/ExpenseDashboardPage.tsx
```

- [ ] **Step 2: Imports**
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
```

- [ ] **Step 3: Apply standard replacements**

If filter tabs use custom markup, replace with `<Tabs>`:
```tsx
// Old — custom filter buttons
<div className="...filter-group">
  <button className={activeTab === 'fuel' ? 'active' : ''}>เชื้อเพลิง</button>
</div>
// New
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className="bg-card border border-border">
    <TabsTrigger value="fuel">เชื้อเพลิง</TabsTrigger>
    <TabsTrigger value="maintenance">บำรุงรักษา</TabsTrigger>
  </TabsList>
</Tabs>
```

Chart wrapper cards: replace `.card` with `<Card>`.

- [ ] **Step 4: Build + verify + commit**
```bash
npm run build
git add frontend/src/pages/ExpenseDashboardPage.tsx frontend/src/index.css
git commit -m "feat: migrate ExpenseDashboardPage to shadcn Card + Tabs"
```

---

### Task 16: Migrate SettingsPage

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx` (8.6K)

- [ ] **Step 1: Read the file**
```bash
cat -n frontend/src/pages/SettingsPage.tsx
```

- [ ] **Step 2: Imports**
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
```

- [ ] **Step 3: Replace native `<select>` elements**
```tsx
// Old
<select className="auth-input" value={val} onChange={(e) => setVal(e.target.value)}>
  <option value="th">ไทย</option>
</select>
// New
<Select value={val} onValueChange={setVal}>
  <SelectTrigger className="h-10 bg-input border-border">
    <SelectValue />
  </SelectTrigger>
  <SelectContent className="bg-popover border-border">
    <SelectItem value="th">ไทย</SelectItem>
  </SelectContent>
</Select>
```

- [ ] **Step 4: Apply `.card` → `<Card>` replacements for setting groups**

- [ ] **Step 5: Build + verify + commit**
```bash
npm run build
git add frontend/src/pages/SettingsPage.tsx frontend/src/index.css
git commit -m "feat: migrate SettingsPage to shadcn Card + Select"
```

---

### Task 17: Migrate ShockSettingsPage

**Files:**
- Modify: `frontend/src/pages/ShockSettingsPage.tsx` (39.8K — largest file, read in 100-line windows)

- [ ] **Step 1: Read structure in sections**
```bash
sed -n '1,100p' frontend/src/pages/ShockSettingsPage.tsx
sed -n '100,200p' frontend/src/pages/ShockSettingsPage.tsx
```

- [ ] **Step 2: Imports**
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
```

- [ ] **Step 3: Apply standard replacements**

This page likely has numeric stepper inputs and group cards. Apply:
- `.card` → `<Card>`
- `.btn*` → `<Button variant="...">`
- `<input type="number" className="auth-input"` → `<Input type="number"`
- `.modal` sections → `<Dialog>`

Keep custom slider/stepper logic — only change styling wrappers, not logic.

- [ ] **Step 4: Update `BottomNav.tsx` with Tailwind**

`BottomNav.tsx` is used on all pages. Rewrite with Tailwind utilities:
```tsx
// Wrap in:
<nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[8px] safe-area-pb">
  <div className="flex items-center justify-around px-2 py-2">
    {/* Each nav item: */}
    <button className={cn("flex flex-col items-center gap-0.5 px-4 py-2 rounded-[var(--radius-sm)] transition-colors",
      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
    )}>
```

- [ ] **Step 5: Build + verify + commit**
```bash
npm run build
git add frontend/src/pages/ShockSettingsPage.tsx frontend/src/components/ui/BottomNav.tsx frontend/src/index.css
git commit -m "feat: migrate ShockSettingsPage + BottomNav to Tailwind/shadcn"
```

---

## Phase 3: Cleanup

### Task 18: Remove Legacy CSS + Update Docs

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/CLAUDE.md` (project design system table)
- Delete: `frontend/visual-directions.html`

- [ ] **Step 1: Audit remaining legacy CSS**
```bash
grep -n '\.btn\|\.card\|\.modal\|\.auth-\|\.acct-\|\.confirm-dialog\|var(--canvas)\|var(--purple)\|var(--glass-bg-old)' frontend/src/index.css
```
Expected: zero matches (all migrated). If any remain, trace which component still uses them and migrate.

- [ ] **Step 2: Remove legacy alias variables from `:root`**

In `index.css`, remove the "Legacy aliases" comment block (canvas, purple, glass-bg-old, r, r-md, etc.) — these were kept during migration and are no longer referenced.

Keep: `--glass-bg`, `--glass-border`, `--success`, `--warning`, `--jelly-ease`, `--spring` (still used by custom components FAB, SwipeReveal, View Transitions).

- [ ] **Step 3: Verify nothing broke**
```bash
grep -rn 'var(--canvas)\|var(--purple)\|var(--glass-bg-old)\|var(--r)\b\|var(--r-md)\|var(--r-lg)\|var(--r-full)' frontend/src --include="*.tsx"
```
Expected: zero matches.

- [ ] **Step 4: Update `CLAUDE.md` design system section**

In `CLAUDE.md`, replace the "Design System — Jelly Glass" section with:

```markdown
## Design System — Direction C (Dark Formal)

Dark mode default · light mode ผ่าน `html.light`

### Tools
Tailwind CSS v4 · shadcn/ui · CSS variables via `@theme inline` ใน `index.css`

### shadcn Components (in `src/components/ui/`)
Button · Input · Label · Card · Badge · Dialog · AlertDialog · Sheet · Select · Separator · Tabs

### Button variants
`default` (violet primary) · `secondary` · `ghost` · `destructive` · `jelly` (green confirm) · `outline`
Size: `default` · `sm` · `lg` · `icon`

### Custom Components (NOT shadcn)
FAB · SwipeReveal · SkeletonCard · StatusBadge · BottomNav · AvatarMenu · ImageCropper

### Key Tokens (in `index.css` `:root`)
`--background` `--card` `--border` `--primary` `--muted-foreground`
`--glass-bg` `--glass-border` (subtle glass — nav + modals only)
`--success` `--warning` `--destructive`
`--radius` = 0.5rem (8px)
```

- [ ] **Step 5: Delete brainstorm artifact**
```bash
rm /Users/mark/my-work-space/My-Project/My-bike/visual-directions.html
```

- [ ] **Step 6: Final build**
```bash
cd frontend && npm run build
```
Expected: clean build, no TypeScript errors.

- [ ] **Step 7: Final commit**
```bash
git add -A
git commit -m "chore: remove legacy Jelly Glass CSS, update CLAUDE.md design system docs"
```

---

## Quick Reference: Class Mapping

| Old `.class` | New |
|---|---|
| `btn btn-primary` | `<Button variant="default">` |
| `btn btn-secondary` | `<Button variant="secondary">` |
| `btn btn-ghost` | `<Button variant="ghost">` |
| `btn btn-danger` | `<Button variant="destructive">` |
| `btn btn-jelly` | `<Button variant="jelly">` |
| `btn btn-sm` | `size="sm"` on Button |
| `auth-input` | `<Input>` |
| `auth-field` | `flex flex-col gap-1.5` |
| `auth-error` | `text-xs text-destructive mt-1` |
| `auth-card` | `rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[8px] p-6` |
| `card` | `<Card>` |
| `card-surface` | `rounded-[var(--radius-md)] border border-border/60 bg-white/[0.04] p-4` |
| `modal-overlay` + `modal` | `<Dialog>` + `<DialogContent>` |
| `confirm-dialog` | `<AlertDialog>` via ConfirmDialog |
| `acct-section` | `<Card className="mb-3">` |
| `acct-section-row` | `flex items-center justify-between py-3 border-t border-border` |
| status pill | `<Badge variant="ok|warn|overdue">` |
