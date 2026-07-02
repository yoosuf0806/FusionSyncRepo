# UI Redesign — Implementation Notes

**Goal:** re-skin every FusionSync screen on a coherent Tailwind + shadcn/ui design system, documented in `design.md`, audited with design-reality-check, improved with design-psychology, verified per operator happy path on a local dev server. Presentation only — no service/route/auth/form logic changed.

## What shipped
- **shadcn/ui foundation** (JSX, new-york): deps, `components.json`, `@/` alias (`vite.config.js` + `jsconfig.json`), `src/lib/utils.js` (`cn`), merged Tailwind theme, CSS-variable tokens in `src/index.css`.
- **17 primitives** in `src/components/ui/*`: button, card, input, textarea, label, select, table, dialog, badge, tabs, dropdown-menu, avatar, skeleton, sheet, alert, separator, sonner.
- **App shell** (`MainLayout`): persistent branded sidebar + icon nav + Sheet drawer (mobile) + header (title, notification bell w/ unread badge, avatar dropdown). `AuthLayout`: centered brand card.
- **Shared components** rebuilt on shadcn, same props/API: `ErrorBanner`(→Alert), `EmptyState`, `LoadingSpinner`, `SearchInput`, `ConfirmModal`(→Dialog), `FormRow`(→stacked), `PageHeader`.
- **Modernized `hh-*` tokens/classes** in `index.css` so every page using them lifted automatically (calmer surface, hairline borders, consistent `rounded-lg`, softer shadows).
- **`design.md`** — full design system + per-screen audit.
- **Hand-tuned screens:** Login, Forgot/Reset/ChangePassword, AdminHome dashboard (StatCard/NavCard → clean shadcn cards; also powers Supervisor + Helper dashboards), ManageJobs (grid-of-divs → real `<Table>` + status Badges + Dialog).

## Verified (local dev, agent-browser, screenshots in `qa-screenshots/redesign/`)
- Login (`00`), Admin home v2 (`02`), Manage Jobs table (`03`), Job detail form (`04`), Attendance (`05`), Manage Users (`audit-…`), Helper My Day (`20`), Helpee home (`30`).
- Logins succeed for Admin / Helper / Helpee; role routing + data load intact; `npm run build` passes (exit 0).

## Key decisions
- **Shared-layer-first strategy:** rebuilt the shell + shared components + tokens before per-screen work, so ~all screens improved at once. Complex screens (JobForm/attendance) auto-lifted to a clean result with **no per-screen edits** — verified by screenshot.
- **Behavior preserved:** only JSX/classNames changed. All handlers, state, service calls, route params untouched. `LoginPage`'s username-lookup logic (incl. the `adminClient`) left as-is.
- **Config → ESM:** `vite.config.js` uses `import.meta.url` (not `__dirname`); `tailwind.config.js` imports `tailwindcss-animate` (not `require`).
- **Lint:** the repo was **not** lint-clean before this work (pre-existing `react/prop-types` + `no-unused-vars` on original files; lint is not a CI gate — build/deploy don't run it). shadcn components omit PropTypes by convention. I cleaned only my own new errors (unused `Badge` import, `FormRow` param, ESM config). Did not add PropTypes across the app (out of scope, non-idiomatic for shadcn).

## Full-scope completion (round 2 — "leave no leaf unturned")
Every remaining screen was hand-tuned to shadcn (presentation only; all logic preserved) and build-verified:
- **Lists → real `<Table>`:** ManageUsers (role badges + blocked-delete Dialog), HelpeeHome (Table + balance/overview StatCards + create Dialog), ManageJobSpecs, ManageDepartments, SearchUsers (list + card grid + Avatars).
- **Forms → Card + shadcn Input/Select/Button:** UserForm (shadcn Selects for type/department, job-type checkboxes, reset-password warning card), JobSpecForm, DepartmentForm (user-picker Dialog + Table), ManageSetup.
- **Shared:** ProfilePage (avatar header + detail card), JobRemark (star-rating Card), Notifications (Card feed, unread affordance, Load more).
- **MyDay:** shadcn Tabs + Dialog leave form + Card check-in/out; low-literacy big-button design kept, colors tokenized.
- **UserSelection** (unrouted/legacy): made consistent so it can't render white-on-white.

Screenshot-verified (in `qa-screenshots/redesign/`): helpee home v2 (`31`), admin ManageUsers/Departments/Setup/UserForm/JobSpecs (`40-*`), plus round-1 shots.

## Round 3 — JobForm + ManageAttendance fully rewritten (no leaf unturned)
Both large stateful screens were fully rewritten to shadcn, embracing breaking presentation changes while preserving every live handler:
- **JobForm** (`src/pages/admin/JobForm.jsx`, was 1513 lines): Card-grouped sections, shadcn Input/Select/Textarea, all 4 modals → shadcn `Dialog` (UserPicker, Invoice, JobMessage, conflict, add-worker chooser, replacement flow), workflow stepper, worker-status → `Badge`. **Advance-status now marks only the *next* valid transition as primary (✓)**, the rest outline (Hick's law). **Zero-debt cleanup:** deleted the large block of *dead* attendance code (the attendance table was already moved to Manage Attendance) — `handleSubmitRow/ApproveRow/RejectRow`, `RejectModal`, scaffold effect, `ATT_STATUS_*`, `attSlice`, `monthlyTotal`, and the now-unused service imports. Verified: JOB-074 detail renders with all data (associations, invoice 900/Draft, stage, next-action-primary) — screenshot `42`.
- **ManageAttendance** (`src/pages/admin/ManageAttendance.jsx`): shadcn `Tabs` (Attendance/Leave/On Leave/Replacements), records → `Table` + status `Badge`s (Completed/Checked-In/location flags), correction + replacement + leave-review flows → `Dialog`/`Card`. Verified: table renders (screenshot `43`); **correction Dialog opens with pre-filled datetime inputs** (`44`) — wiring confirmed (not submitted, no prod write).
- Both build clean and have **zero real lint errors** (only the app-wide pre-existing `react/prop-types` convention remains).

Every screen in the app is now hand-carpented on the shadcn design system. No auto-lift-only leaves remain.

## Not in scope (flagged, unaddressed by this UI work)
- **W-1 security incident** (service_role key shipped in the client bundle) is unchanged. `LoginPage` and services still instantiate the client-side `adminClient`. See `KANBAN.md` / `.understanding` / memory. This redesign does not touch it.
