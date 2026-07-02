# FusionSync — Understanding & Visual Plan

> Bidirectional deep dive. Top-down (architecture → code) + bottom-up (the `job` primitive → callers → UI). Evidence-grounded with `file:line`. Confidence noted per section.

## Primitive (one line)
A **Job** is a scheduled unit of field service work whose lifecycle is a strictly forward-only 7-state machine, wired to four role-scoped human participants (helpee/supervisor/helper/admin) via a `job_associated_users` join, with attendance, invoicing, remarks, and notifications all hanging off that spine. `src/constants/jobStatuses.js:36` · `schema.sql:106` · `src/services/jobService.js`

## Map at a glance
- **What it is:** A multi-tenant-ish **field-services workforce operations platform** — a business (e.g. cleaning/maintenance/home-help agency) dispatches workers ("helpers") to clients ("helpees"), coordinated by "supervisors" and configured by "admins". Name in `package.json:2` = *FusionSync*.
- **Stack:** React 18 SPA (Vite) + React Router 7 + Tailwind, backed **entirely by Supabase** (Postgres + Auth + Storage + one Edge Function). No custom backend server — the DB *is* the backend. `package.json:13-20` · `supabase/client.js`
- **The DB is the brain:** business logic lives in **Postgres triggers + RLS policies + `SECURITY DEFINER` functions**, not just the client. Assignment, status-change notifications, attendance-row generation, ID generation, and status-history logging are all DB-side automations. `schema.sql:264-547`
- **Four roles, one app, role-prefixed routes:** `/admin/*`, `/supervisor/*`, `/helper/*`, `/helpee/*` — same components reused across prefixes, gated by `<RoleRoute>`. `src/App.jsx:36-176`
- **39 migrations of evolution** over `schema.sql` base — attendance grew from manual `in_time/out_time` into GPS check-in/out + approval workflow + multi-helper + worker-replacement + schedule-based invoicing. `supabase/migrations/` (chronological story).

---

## 1. Architecture (top-down)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER (React 18 SPA, Vite build → Vercel static host)                  │
│                                                                           │
│  App.jsx ── BrowserRouter ── <AuthProvider> ── <Routes>                   │
│    │           │                                                          │
│    │           └── AuthContext: session, user(DB profile), role, loading  │
│    │                            src/contexts/AuthContext.jsx               │
│    │                                                                       │
│  Route guards:  <ProtectedRoute> (any auth)  ·  <RoleRoute allowedRoles>   │
│                 src/components/ProtectedRoute.jsx · RoleRoute.jsx          │
│    │                                                                       │
│  ┌──────────────── PAGES (by role prefix) ────────────────────────────┐   │
│  │ admin/*   ManageUsers UserForm ManageJobs JobForm ManageJobSpecs    │   │
│  │           JobSpecForm ManageDepartments ManageSetup ManageAttendance │   │
│  │           SearchUsers AdminHome                                      │   │
│  │ helper/*  MyDay (check-in/out)   helpee/* HelpeeHome                 │   │
│  │ supervisor/* reuses MyDay/ManageJobs/ManageUsers/…                   │   │
│  │ shared/*  ProfilePage Notifications JobRemark ChangePassword …       │   │
│  └─────────────────────────────────────────────────────────────────────┘  │
│    │                                                                       │
│  ┌──────────────── SERVICE LAYER (src/services/*.js) ─────────────────┐    │
│  │ jobService(1545L!) userService leaveService dashboardService        │    │
│  │ departmentService jobSpecService notificationService authService    │    │
│  │ businessService                                                     │    │
│  │  ── all import the supabase client and speak PostgREST directly ──  │    │
│  └────────────────────────────────────────────────────────────────────┘   │
│    │                          │                                            │
│  supabase (anon key)   adminClient (SERVICE ROLE key)  ⚠ see §Coupling     │
│    supabase/client.js        supabase/adminClient.js                       │
└────┼──────────────────────────┼───────────────────────────────────────────┘
     │  PostgREST / GoTrue / Storage / RPC
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SUPABASE (Postgres 15)                                                    │
│                                                                           │
│  14 core tables (schema.sql) + leave_requests, worker_replacements,       │
│  job_replacement_flags, job_messages, department_users, job_spec_questions │
│                                                                           │
│  ENGINE = triggers + SECURITY DEFINER functions:                          │
│    trg_generate_*        → human-readable IDs (USR-, JOB-, INV- …)         │
│    trg_auto_attendance   → auto-create 1 attendance row per recurring day  │
│    trg_log_status_change → append-only job_status_history                  │
│    trg_notify_status_change → fan-out in-app notifications on status flip  │
│    trg_notify_on_assignment → notify user when added to job_associated_users│
│    RLS policies (per-table, per-role) enforce who sees/edits what          │
│    RPC: calc_invoice_amount_from_job (schedule → money)                    │
│                                                                           │
│  Auth: auth.users ←1:1→ public.users.auth_user_id                         │
│  Storage buckets: profile-images, job-attachments, invoice-attachments     │
│  Edge Function: create-user (admin/supervisor-gated auth user creation)   │
└─────────────────────────────────────────────────────────────────────────┘
```
Confidence: **high** (every layer cited).

---

## 2. Domain data model (entity relationships)

```
  departments ──1:N── users ──┐
      │                       │ (auth_user_id 1:1 auth.users)
      │                       │
      │                  job_associated_users ──N:1── jobs ──N:1── job_specifications
      │                  (role: helpee/                │              │
      │                   helper/supervisor)           │           job_spec_questions
      └──────────N:1── jobs                            │              │
                                                       ├── job_question_answers
   jobs ──1:1── invoices                               ├── job_attendance (per day/helper)
   jobs ──1:N── job_status_history (append-only)       ├── job_remarks (helpee rating 1-5)
   jobs ──1:N── job_messages (helper↔supervisor↔admin) ├── worker_replacements
   jobs ──1:N── notifications (related_job_id)         └── job_replacement_flags
   users ──1:N── leave_requests
   business_setup (SINGLETON — trigger-enforced, one row)  schema.sql:457
```
Key invariants:
- `job_associated_users` is **the participant spine** — helper/helpee lists, notifications, availability, replacement all resolve through it. `UNIQUE(job_id,user_id)`. `schema.sql:142`
- `users.department_id` scopes supervisors: a supervisor only sees jobs/users in their department. `jobService.js:69`, `getUnassignedJobsForSupervisor:897`
- `invoices.amount_payable` is **DERIVED, never stored** (`amount − amount_paid`). `jobService.js:14-36`
- `business_setup` is a singleton by DB trigger. `schema.sql:457-466`

Confidence: **high**.

---

## 3. The Job lifecycle (the core state machine)

```
   request_raised ──▶ manager_assigned ──▶ helper_assigned ──▶ job_started
        │(helpee raises)   │(supervisor          │(worker             │(work
        │                  │ self/auto-assigned)  │ attached)          │ begins)
        ▼                  ▼                      ▼                    ▼
   ══════════════════════════════════════════════════════════════════════════▶
   job_started ──▶ job_finished ──▶ payment_confirmed ──▶ job_closed (TERMINAL)

   RULE: forward-only. canTransitionTo() rejects any newIdx <= curIdx,
         and rejects everything once job_closed.   jobStatuses.js:50-55
   Enforced BOTH client-side (STATUS_ORDER) AND server-side
         (migration 20260407000000_job_status_forward_only.sql).
```
**Initial status depends on WHO creates the job** — the single most important business rule (`jobService.js:200-294`):

| Creator | Initial status | Side effects |
|---------|----------------|--------------|
| **helpee** | `request_raised` | If exactly 1 active supervisor → auto-assign + bump to `manager_assigned`; if 2+ → notify all supervisors + admins, wait for self-assign. `jobService.js:304-352` |
| **supervisor** | `manager_assigned` (or `helper_assigned` if helpers picked) | creator auto-added as supervisor; helpee + helpers attached |
| **admin** | `manager_assigned` (or `helper_assigned`) | all participants attached; other admins notified |

Every status flip → DB triggers log history (`job_status_history`) **and** notify all participants + requester. `schema.sql:368-423`

Confidence: **high**.

---

## 4. Role → capability matrix (who can do what)

| Capability | admin | supervisor | helper | helpee |
|------------|:---:|:---:|:---:|:---:|
| Home route | `/admin/home` | `/supervisor/my-day` | `/helper/my-day` | `/helpee/home` |
| Manage users / depts / job-specs / business setup | ✅ | partial (users, specs; dept-scoped) | ❌ | ❌ |
| Create job | ✅ (full) | ✅ (dept, on behalf) | ❌ | ✅ (own request) |
| See all jobs | ✅ | dept-scoped | only assigned | only own |
| Assign supervisor/helpers | ✅ | ✅ | ❌ | ❌ |
| Check in/out (GPS) | — | ✅ | ✅ | ❌ |
| Approve/correct attendance | ✅ (all) | ✅ (workers only, not self/other sups) | ❌ | ❌ |
| Invoice CRUD | ✅ | ✅ | ❌ | read own |
| Rate / remark job | ❌ | read | read | ✅ (own, 1-5) |
| Apply for leave | — | ✅ | ✅ | ❌ |
| Approve leave / assign replacement | ✅ | ✅ | ❌ | ❌ |
Source: `src/App.jsx` route guards + `schema.sql:568-911` RLS policies + `roles.js`.
Confidence: **high** (dual-sourced: routes + RLS).

---

## 5. Feature subsystems (bottom-up, by service)

| Service | LOC | Owns |
|---------|----:|------|
| `jobService.js` | 1545 | Job CRUD, participant wiring, **attendance & GPS check-in/out**, invoicing, remarks, **worker availability/conflict detection** (`checkWorkerAvailability:1010`), **replacement** (`createWorkerReplacement:1145`), schedule math (`isJobScheduledOnDate`, `isJobExpired`) |
| `userService.js` | 299 | User CRUD (via `create-user` edge fn), per-user job-types, active-job guard before delete |
| `leaveService.js` | 340 | Leave apply/review, users-on-leave, **cascade → replacement flags** |
| `dashboardService.js` | 168 | Per-role KPI aggregation (4 dashboards) |
| `departmentService.js` | 130 | Department CRUD + member management |
| `jobSpecService.js` | 119 | Job types + dynamic per-type questions |
| `notificationService.js` | 50 | In-app notifications + **realtime subscribe** (`subscribeToNotifications:41`) |
| `authService.js` | 45 | Login (email or username), password reset |
| `businessService.js` | 40 | Singleton business config |

Two subsystems stand out as the "hard" differentiators:
- **Attendance-as-truth:** GPS-stamped check-in/out with `location_missing` never blocking a low-literacy worker (`captureLocation:769` — "must not be stuck on a popup"), approval workflow, admin correction with `corrected_from` audit snapshot (`correctAttendanceRecord:843`).
- **Availability & continuity engine:** conflict detection across jobs + leave (`checkWorkerAvailability`), same-department role-consistent replacement, leave→replacement cascade. This is scheduling-grade logic.

Confidence: **high**.

---

## 6. Top-down ↔ bottom-up reconciliation

**Agreements (high confidence):**
- The `job` + `job_associated_users` spine is confirmed from both the route/component tree (top) and every service query (bottom). Notifications, dashboards, availability all funnel through it.
- Forward-only status is enforced in *both* `jobStatuses.js:50` (client) and migration `20260407` (server) — defense in depth, consistent.

**Divergences / things to know:**
1. **`schema.sql` is the seed, not the current truth.** The base file defines 14 tables with a *simpler* `job_attendance` (`in_time/out_time`, `UNIQUE(job_id,attendance_date)`) and `jobs` without `job_date/job_end_time/pricing_structure/job_days`. The **39 migrations** are the real schema (multi-helper attendance keyed `(job_id,attendance_date,helper_id)`, GPS columns, `att_status`, worker_replacements, etc.). Anyone reasoning from `schema.sql` alone will be wrong about attendance & scheduling. `schema.sql:169` vs `migrations/20260417000000_multi_helper_attendance.sql`, `20260422000000_checkin_checkout_attendance.sql`.
2. **`ROUTES` constant is partly stale.** `src/constants/routes.js` still lists `/login/admin` etc. as canonical, but `App.jsx:52-55` redirects all of them to unified `/login`. Legacy, harmless, but misleading. `jobPaths.js` helpers are the live source of truth for navigation.
3. **Naming skew:** UI says "Supervisor" but the DB status is `manager_assigned` and code comments say "manager". Same concept, three labels. `jobStatuses.js:13`.

**Gaps / open questions (not invented):**
- No automated tests present anywhere (no `*.test.*`, no test runner in `package.json`). Verification is manual. → see open items.
- `job_messages`, `leave_requests`, `worker_replacements`, `job_replacement_flags` exist only in migrations — not consolidated into `schema.sql`. A fresh `schema.sql`-only bootstrap would be incomplete.

---

## 7. Coupling hotspots (where change hurts)

1. **⚠️ SECURITY: service-role key in the browser bundle.** `jobService.js:6`, `dashboardService.js:4`, `supabase/adminClient.js` read `VITE_SUPABASE_SERVICE_ROLE_KEY` — a `VITE_` var is **compiled into client JS and shipped to every browser**. If this env var is set in production, the service-role key (full RLS bypass, god-mode over the DB) is publicly exposed. The `create-user` Edge Function (`supabase/functions/create-user/index.ts`) is the *correct* pattern (key stays server-side, caller gated to admin/supervisor). The client-side `adminClient` is the dangerous anti-pattern. **This is the single highest-severity finding.** Confidence: **high** (code is explicit; whether the var is actually set in prod is the only unknown — `deploy.txt`/`.env` would tell).
2. **`jobService.js` is a 1545-line god-module.** Jobs, attendance, GPS, invoicing, availability, replacement all in one file. High-churn, high-blast-radius; the natural seam is to split attendance + availability/replacement out.
3. **DB triggers are invisible from the client.** `createJob` relies on `trg_notify_on_assignment` firing on every `job_associated_users` insert (`jobService.js:247`). Anyone editing insert logic without knowing the trigger will double- or zero-notify.
4. **Two clients, RLS-dependent correctness.** Every service picks `adminClient || supabase`; if the service key is absent (the intended-safe config), several flows silently degrade (auto-assign supervisor requires `adminClient`, `jobService.js:311`). Behavior differs by deployment config — a correctness landmine.
5. **Schedule math duplicated** between client (`isJobScheduledOnDate`, `checkWorkerAvailability`) and DB (`calc_invoice_amount_from_job`, `auto_create_attendance_rows`). Two sources of "when does this job run" that must agree.

---

## 8. Open questions — RESOLVED via live DB inspection (2026-07-01)
Connected to project `mqhxypxxtdevzxcrsoqz` with the `.env` `service_role` key (read-only queries).
| # | Question | Answer |
|---|----------|--------|
| 1 | Is `VITE_SUPABASE_SERVICE_ROLE_KEY` set? | **YES — CONFIRMED LIVE.** `.env` line 5 holds a valid `service_role` JWT (exp 2090). It returns HTTP 200 and bypasses RLS: I read every user's email/phone + all 551 notification bodies with it. Any `vite build` from this `.env` ships god-mode DB access in the browser bundle. **CRITICAL, active.** |
| 2 | Is `schema.sql` the truth? | **No.** Live DB has **20 tables + `invoice_balances` view** (schema.sql defines 14). Live `job_attendance` = 33 columns (GPS, correction audit, `att_status`, `rate_for_day`, `total_hours`); live `business_setup` is missing `customer_basis` that schema.sql declares. **Migrations = truth; `schema.sql` is stale.** |
| 3 | Any test harness? | Confirmed none — manual QA only. |

### Live state snapshot (pilot in active use)
- **Business:** Sri Lankan services agency (LKR, Colombo). Departments: **Cleaning**, **Security**. Catalog still placeholder ("Test Job Type1", "Test Location") → pilot/staging with real ops data.
- **People:** 13 users — 5 helper, 4 supervisor, 2 admin, 2 helpee (12 active, 1 disabled). Auth linkage healthy (0 users without `auth_user_id`).
- **Jobs:** 30 (17 recurring / 13 one-time). Status spread across the whole lifecycle incl. 8 `job_closed`, 2 `payment_confirmed` — the flow is exercised end to end.
- **Attendance-as-truth WORKS:** 17 rows, GPS captured on 14/17 (3 `location_missing` → flagged, not blocked, exactly as designed), 11 completed check-in→out cycles, 2 open check-ins (the "forgot to checkout" case the correction tool exists for).
- **⚠️ Billing chain BREAKS at payment:** LKR 29,598 invoiced, **LKR 0.00 paid**; 14 invoices unpaid, 8 still `draft`. The attendance→invoice link works; the invoice→**paid** link is not closing in practice. Direct evidence for the build-for-one priority.
- **Noise / debt signals:** 447 of 551 notifications unread (fatigue — ~42 notifications/user in a tiny pilot), 6 open unfilled replacement flags (continuity gaps not closed), 5 jobs still missing `department_id` despite the backfill migrations.

## Key files (ranked)
| File | Role | Confidence |
|------|------|:---:|
| `src/services/jobService.js` | Core domain engine (1545L) | high |
| `schema.sql` + `supabase/migrations/*` | Data model + DB automation (real truth = migrations) | high |
| `src/App.jsx` | Route map = feature map, role gating | high |
| `src/constants/jobStatuses.js` | The state machine | high |
| `src/contexts/AuthContext.jsx` | Identity → role → routing | high |
| `src/services/dashboardService.js` | Per-role KPI shape | high |
| `supabase/functions/create-user/index.ts` | The one correct privileged pattern | high |

## Suggested next command
`build-for-one` (requested next) → then, if acting: fix the service-role-key exposure (§7.1) as the first zero-debt move.
