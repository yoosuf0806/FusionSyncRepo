# Web QA — FusionSync hosted run-through (agent-as-first-tester)

- **Target:** https://fusionsyncvercel.vercel.app
- **Tool:** agent-browser 0.27.0 (Chrome for Testing 150), viewport 1440×900 @2x
- **Date:** 2026-07-01
- **Roles exercised (all 6 logged in + verified):** Admin1, Supervisor cleaning 1, Supervisor Security 2, Cleaning Helper A, Security Helper A, Helpee A
- **Verification discipline:** each consequential step confirmed against something the UI can't fake — settled URL, auth `token` POST=200, live DB row counts (via service key, read-only), and content-present waits (not spinner frames).
- **Screenshots:** `qa-screenshots/` (16 PNGs, indexed at bottom).

## Verdict
The app **works end-to-end across every role** — auth, role routing, the 7-stage job workflow, department scoping, GPS attendance, notifications, invoicing dashboards, and empty states all render on live data that matches the backend exactly. **One critical security incident** (below) overshadows all functional findings.

---

## WBS — issues, most severe first

| ID | Flow · step | Severity | Evidence (observed) | Expected | Acceptance criteria |
|----|-------------|----------|---------------------|----------|---------------------|
| W-1 | Whole app · JS bundle | **BLOCKER / security** | Deployed `/(/assets/index-B4Mqhwb-.js)` contains **2 JWTs decoded live: `role=service_role` (ref mqhxypxxtdevzxcrsoqz, tail …2GTzF9kG-1DQ) and `role=anon`**. The service_role key = full RLS bypass. Anyone can `curl` the public JS, extract it, and read all PII / modify/delete the entire DB. Matches `.env` line 5 (`VITE_SUPABASE_SERVICE_ROLE_KEY`). | service_role key never leaves the server; browser holds only the anon key | (1) rotate the leaked key in Supabase immediately; (2) remove `VITE_SUPABASE_SERVICE_ROLE_KEY` from build env; (3) delete client `supabase/adminClient.js` + `adminClient` branches in services; (4) move privileged writes behind Edge Functions (pattern already exists: `create-user`); (5) re-fetch bundle → 0 service_role JWTs |
| W-2 | Helpee home · Account Balance + Overview KPIs | medium | KPI cards showed spinners ~5s while the job list already rendered; resolved to Amount Spent 18,434.00 / Payable 11,164.67 / Ongoing 9 / Completed 10 / PaymentConfirmed 10 (`getHelpeeDashboard` runs invoice math client-side over N jobs+invoices) | KPIs render in <1.5s or show skeletons, not a full-card spinner | helpee dashboard first paint < 1.5s on the pilot dataset; move aggregation to a DB RPC/view (an `invoice_balances` view already exists) |
| W-3 | Admin/any · job detail open | medium | `/admin/jobs/:id` showed a full-screen spinner ~2s before content (6 sequential `Promise.all` sub-queries in `getJobById`) — a full-page screenshot at t≈2s captured only the spinner | detail content within ~1s or progressive render | job detail interactive < 1.5s; consider a single RPC or embedded select |
| W-4 | All lists/buttons · selectors | medium (testability) | Buttons split label into 2 text nodes ("Manage"+"Users"); no `data-testid` anywhere → `find text` fails, forced ref/CSS fallbacks. Blocks robust Playwright/Maestro graduation | stable `data-testid` on nav cards, table rows, action buttons | add testIDs (`nav-manage-users`, `job-row-{jobId}`, `job-status-btn-{status}`, `helpee-create-job`); text/role selectors resolve without coordinates |
| W-5 | Helpee · "Amount Spent" semantics | low/medium | Client sees "Amount Spent 18,434.00" but **every invoice has `amount_paid = 0`** (verified in DB). "Spent" is derived from job *status* (payment_confirmed/closed), not actual payment | label reflects reality, or the metric tracks real payments | rename to "Invoiced (completed)" OR compute from `amount_paid`; don't tell a client they spent money nobody has collected |
| W-6 | Helpee · create-job form | low | Form exposes **Helper(s)** and **Supervisor** assignment fields to a helpee, who cannot staff jobs (server ignores them for creator role `helpee`) | hide staffing fields for helpee creators | helpee create form shows only helpee-relevant fields |
| W-7 | Global · browser tab / branding | low | Tab title is stock **"Vite + React"** (`index.html`) on the live app | product title + favicon | `<title>FusionSync</title>` + real favicon |
| W-8 | Login → home · redirect timing | low (not a bug) | After helpee login, `get url` briefly returned `/login` before settling to `/helpee/home` (SPA async auth redirect) | n/a — cosmetic timing only | none required; note for test stability (assert on content, not immediate URL) |

### Missing-testID rows (roll-up of W-4, needed for Phase-3 codification)
- Nav quick-action cards (`Manage Users/Jobs/Attendance/...`) — split text, no testID.
- Job table rows / "View/Edit" buttons — index by `job_id`.
- Workflow transition buttons (`Job Started/Finished/Payment Confirmed/Job Close`) — index by target status.
- Login inputs work via `placeholder` (Username/Password) + role button (Login) — acceptable, but add testIDs for durability.

---

## What passed (verified, not just screenshotted)
- **Auth + role routing:** all 6 users → correct role home (`/admin/home`, `/supervisor/my-day`, `/helper/my-day`, `/helpee/home`); auth `token` POST=200; logout clears session → `/login`. (00,01,10,13,20,21,30)
- **Admin dashboard = backend truth:** Total Users 12 / Jobs 30 / Pending 11 / Completed 10 / Replacements 6 — exact match to direct DB counts. (01)
- **Job workflow spine:** job detail shows the 7-stage bar with Request→Supervisor→Helper done, rest pending, "Current: Helper Assigned", forward-only transition buttons, associated users, invoice (900/Draft). (04)
- **Department scoping (differential test):** cleaning supervisor sees JOB-074→070; security supervisor sees JOB-068→002 — **zero overlap**. (12 vs 14)
- **Attendance-as-truth:** GPS "View" vs "Not captured" ⚑ flag, computed hours, `completed`/`checked in` states, "Correct" action; worker "My Day" shows ACTIVE-NOW check-in card (JOB-074, checked in 12:24) with CHECK OUT. (05,20)
- **Expired-job guard:** open-past-schedule jobs badge "JOB NOT CLOSED, EXPIRED". (12)
- **Notifications:** dated feed, unread/read states, "Mark all as read", "Load more"; reflects assignment/status/leave/replacement triggers. (23)
- **Empty states:** clean "No jobs assigned for today" for idle supervisor/helper. (13,21)

> **Note (business, not a bug):** LKR 29,598.67 invoiced, **LKR 0.00 collected** — the attendance→invoice chain works; the invoice→paid link is not exercised in the pilot. Ties to the `build-for-one` thesis (close the payment link).

## Not done deliberately
- Did **not** click **CHECK OUT** (helper) or **Create Job** (helpee) / status transitions — these write to the **live pilot's production data**. Read/entry paths verified; mutations withheld pending authorization.

## Screenshot index (local: `qa-screenshots/`)
`00-login` · `01-admin-home` · `02-admin-manage-users` · `03-admin-manage-jobs` · `04-admin-job-detail` · `05-admin-attendance` · `06-admin-profile` · `10-supcleaning-home` · `12-supcleaning-jobs` · `13-supsecurity-home` · `14-supsecurity-jobs` · `20-cleaninghelper-myday` · `21-securityhelper-myday` · `23-securityhelper-notifications` · `30-helpee-home` · `31-helpee-create-job`

## Phase-3 note (Maestro/Playwright graduation)
Green flows ready to codify once W-4 testIDs land: **login-per-role**, **admin dashboard KPIs**, **dept-scoped job list**, **notifications**. Web replay target = Playwright (agent-browser is discovery tooling); Maestro is mobile-only, so it does not apply to this web app.
