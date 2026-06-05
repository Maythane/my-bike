@AGENTS.md

---

## Design System — Direction C (Dark Formal)

Dark mode default · light mode ผ่าน `html.light`

### Tools
Tailwind CSS v4 · shadcn/ui · CSS variables via `@theme inline` ใน `index.css`

### shadcn Components (`src/components/ui/`)
`Button` (variants: default/secondary/ghost/destructive/jelly/outline, sizes: default/sm/lg/icon)
`Input` · `Label` · `Card` (+ CardHeader/CardTitle/CardContent/CardFooter) · `Badge` (ok/warn/overdue/default)
`Dialog` (+ DialogContent/Header/Title/Footer/Description) · `AlertDialog` · `Sheet`
`Select` (+ SelectTrigger/Value/Content/Item) · `Separator` · `Tabs` (+ TabsList/Trigger/Content)

### Custom Components (NOT shadcn, keep CSS)
FAB · SwipeReveal · SkeletonCard · StatusBadge · BottomNav · AvatarMenu · ImageCropper

### Key CSS Tokens (in `index.css` `:root`)
`--background` `--card` `--border` `--primary` `--muted-foreground`
`--glass-bg` `--glass-border` (subtle glass — nav + modals only)
`--success` `--warning` `--destructive`
`--radius` = 0.5rem (8px) · `--radius-sm` = 6px · `--radius-lg` = 12px
`--purple` `--purple-bg` `--purple-border` `--purple-hover` (accent tints)
`--canvas` `--surface` `--elevated` · `--ink` `--slate` `--steel`
`--hairline` `--hairline-strong` · `--r` `--r-md` `--r-lg` `--r-full`
`--shadow-card` `--shadow-modal` · `--jelly-ease` `--spring`

### Adapting External Code
| ต้นฉบับ | แปลงเป็น |
|--------|---------|
| `<Button variant="outline">` | `<Button variant="ghost">` |
| `<Button variant="destructive">` | `<Button variant="destructive">` |
| `<Input>` | `<Input>` (ตรงๆ) |
| `<Dialog>` / `<DialogContent>` | `<Dialog>` + `<DialogContent>` (ตรงๆ) |
| lucide icons | Inline `<svg>` |
| `Link` from next | `<a>` หรือ `useNavigate()` |
| `"use client"` | ลบออก (ไม่ใช้ Next.js) |
| `@/components/ui/...` | shadcn components ตรงๆ หรือ native elements |
