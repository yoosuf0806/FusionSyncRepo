# FusionSync — Design System (`design.md`)

Source of truth for the FusionSync UI. Built on **Tailwind CSS 3** + **shadcn/ui** (new-york, JSX). Tokens live in `src/index.css` (`:root` CSS variables) and `tailwind.config.js`. Primitives in `src/components/ui/*`.

> Method: each screen was audited with **design-reality-check** (does this serve the *real* person using it, or a convenient proxy?) and improved with **design-psychology** (Nielsen heuristics, Fitts, Hick, Miller, Norman, Krug). The guiding question on every screen: **"what does this actually do for the person using it?"**

---

## 1. Visual theme & atmosphere

**Calm, professional, operational.** FusionSync is a field-services operations tool used daily by four very different operators — from an office admin to a low-literacy cleaner tapping "check in" on a phone in the field. The design is therefore **quiet, high-contrast, and unambiguous**: generous whitespace, one clear primary action per screen, large tap targets, and content on flat white cards over a barely-tinted background — not the previous "floating white pills on saturated mint" look.

Adjectives: *airy, legible, grounded, trustworthy.* Density is low on worker screens (one big decision) and medium on admin tables (scannable rows).

Away from → toward:
- Heavy drop-shadows + saturated mint field → **hairline borders + near-white surface**
- Pill-everything (inputs, titles, buttons all `rounded-full`) → **consistent `rounded-lg` (0.75rem); pills reserved for badges/filters**
- Centered text in inputs, split two-word labels → **left-aligned labels above fields, whole-word labels**
- Green-on-green low contrast → **AA-contrast green primary on white**

---

## 2. Color palette & roles

Defined as HSL CSS variables (`src/index.css`), consumed via Tailwind semantic tokens.

| Token | HSL | Hex ≈ | Role |
|-------|-----|-------|------|
| `--background` | `150 30% 98%` | `#F7FBF8` | Soft Mist Green — app canvas |
| `--foreground` | `222 22% 18%` | `#242B37` | Ink Slate — primary text |
| `--card` | `0 0% 100%` | `#FFFFFF` | Pure White — cards, inputs, surfaces |
| `--primary` | `142 58% 33%` | `#248541` | **Field Green** — primary actions, active nav, links |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | text on green |
| `--secondary` / `--muted` | `150 16% 95%` | `#EEF3F0` | Pale Sage — subtle fills, muted rows |
| `--muted-foreground` | `220 9% 46%` | `#6B7280` | Cool Grey — secondary text, labels |
| `--accent` | `142 40% 93%` | `#E4F2E9` | Mint Wash — hover/selection tints |
| `--destructive` | `0 72% 51%` | `#DC2626` | Alert Red — delete, errors |
| `--warning` | `38 92% 48%` | `#F59E0B` | Amber — expired/attention flags |
| `--border` / `--input` | `150 12% 90%` | `#DFE7E2` | Whisper Line — 1px borders |
| `--ring` | `142 58% 33%` | `#248541` | focus ring (green, 40% alpha) |
| Sidebar | — | `#1F5B34` | Forest — persistent app-shell rail |

Semantic status colors (badges): `success`=green, `warning`=amber, `destructive`=red, `muted`=grey. **Why semantic, not literal:** job statuses, payment states, and attendance states all map to a small fixed set of meanings — one badge system keeps them learnable (Nielsen: consistency & standards).

---

## 3. Typography

- **Family:** Inter (400/500/600/700/800), system-ui fallback. `antialiased`, `cv11`/`ss01` features.
- **Scale (Major-ish):** page H1 `text-2xl/700`, card title `text-lg/600`, body `text-sm`, labels `text-sm/500`, meta `text-xs`, section eyebrows `text-xs uppercase tracking-wide text-muted-foreground`.
- **Hierarchy rule:** exactly one H1 per screen (the header title). Numbers on stat cards are the loudest element (`text-2xl/3xl bold`) — the dashboard exists to surface *numbers*, so they win the visual weight (design-psychology: visual hierarchy follows information priority).
- **Letter-spacing:** tight (`tracking-tight`) on headings; wide (`tracking-wide`) on uppercase eyebrows only.

---

## 4. Component stylings

Primitives (`src/components/ui/`): `button, card, input, textarea, label, select, table, dialog, badge, tabs, dropdown-menu, avatar, skeleton, sheet, alert, separator, sonner`.

- **Buttons** (`<Button>`): `rounded-lg`, `h-11` default (≥44px — Fitts/touch), `font-semibold`, subtle shadow, `active:scale-[0.98]` press feedback. Variants: `default` (green), `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes: `sm/default/lg/icon`. **One primary per view**; everything else outline/ghost (Hick: reduce competing choices).
- **Cards** (`<Card>`): white, `rounded-xl`, 1px border, `shadow-card` (whisper). Header/Title/Content/Footer sub-parts. Replace the old heavy `shadow-hh`.
- **Inputs/Select/Textarea:** white, 1px `--input` border, `h-11`, `rounded-lg`, green focus ring. Labels sit **above** the field (stacked `FormRow`), left-aligned — scannable on mobile, no cramped side-by-side pills.
- **Table** (`<Table>`): borderless rows with hover tint, uppercase muted headers; horizontal scroll on small screens.
- **Badge:** pill, tinted-soft (`bg-*/10 text-*`) — status at a glance without shouting.
- **Dialog/Sheet:** blurred slate overlay, `rounded-xl` panel; Sheet is the mobile nav drawer.
- **Alert:** inline, variant-tinted; used for errors (`ErrorBanner`) and success confirmations.
- **Toaster (sonner):** top-center, for transient success/failure.

---

## 5. Layout principles

- **App shell** (`MainLayout`): persistent 256px Forest sidebar on desktop (brand + icon nav + Sign Out); collapses to a hamburger→`Sheet` drawer on mobile. Sticky blurred header carries the page title, notification bell (+unread badge), and an avatar dropdown (Profile / Sign Out). Content is centered, `max-w-6xl`, padded `p-4 → lg:p-8`.
- **Auth shell** (`AuthLayout`): centered `max-w-md` card with brand lockup and soft green glow. One column, one job.
- **Spacing:** 4px base; card padding `p-5`; vertical rhythm `gap-4/6`. **Whitespace is a feature** — worker screens deliberately hold one card so the primary action can't be missed (Krug: "don't make me think").
- **Grid:** stat cards in responsive `grid` (2→5 cols); tables scroll rather than squash.
- **Touch:** all interactive targets ≥44px; primary field actions (check-in/out) are full-width, thumb-reachable.

---

## 6. Per-screen audit (design-reality-check → fix)

Legend: ✅ hand-tuned & verified · 🟢 auto-lifted by shared shell + tokens (no bespoke markup needing rework) · ⏳ pending.

| Screen | Reality-check finding (proxy → real person) | Fix | Status |
|--------|---------------------------------------------|-----|--------|
| **Login** | Green-on-green pills, centered text, "Login" title told the user nothing | Card, labeled inputs, "Welcome back", clear CTA, forgot-link | ✅ |
| **Forgot / Reset** | White text on green — broke when shell changed; success buried | shadcn inputs + success `Alert` | ✅ |
| **Change Password** | Split-label form, ad-hoc success div | Card + stacked labels + success Alert | ✅ |
| **App shell (all screens)** | Nav hidden behind a hamburger even on desktop; title in a floating pill; no identity | Persistent sidebar w/ icon nav, avatar menu, role label | ✅ |
| **Admin Home** | Stat *numbers* (the reason to visit) were visually equal to labels | Stat numbers dominant; quick-actions as clear cards | ✅/⏳ |
| **Manage Users/Jobs (lists)** | Div-pill "tables", split-word labels, weak scan lines | Modernized table rows + search + filter chips | 🟢→⏳ |
| **Job detail (JobForm)** | Everything same weight; workflow stage + actions lost in a wall of fields | Grouped Cards; status badge; primary action clarity | 🟢→⏳ |
| **Attendance** | Dense table; GPS/flags low-contrast | Table + status/location badges | 🟢→⏳ |
| **My Day (helper/supervisor)** | Best-designed already; check-in card is the moment that matters | Preserve; strengthen ACTIVE-NOW card + big CHECK IN/OUT | 🟢→⏳ |
| **Helpee Home** | KPI cards spin ~5s; "Amount Spent" misleading | Card grid; (perf + label fixes tracked in `KANBAN.md`) | 🟢→⏳ |
| **Notifications** | Works; unread affordance ok | Feed list refinement | 🟢 |

**Global wins already shipped** (shared layer): every screen inherits the new shell, tokens, buttons, inputs, cards, tables, empty states, spinners, and dialogs — so the whole app moved from "floating pills on mint" to a coherent system in one move, before any per-screen edit.

---

## 7. How to extend

1. Reach for a `src/components/ui/*` primitive first; compose, don't restyle.
2. Use semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`) — never raw hex.
3. One primary `<Button>` per view; everything else `outline`/`ghost`.
4. New status? add a `Badge` variant, don't invent ad-hoc colors.
5. Before shipping a screen, ask the reality-check question: *what does this do for the person actually using it?*
