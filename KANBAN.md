# FusionSync — QA Kanban

Local board for the functional WBS from the hosted run-through (2026-07-01).
Source: `.handoff/wbs-device-qa-web.md` · Evidence: `qa-screenshots/`

**How to use:** move a card's heading between the column sections below as it progresses
(`Backlog → To Do → In Progress → Review → Done`). Update the `Status:` line and tick
acceptance boxes. Severity: 🔴 blocker · 🟠 medium · 🟡 low.

**Board at a glance**

| Column | Cards |
|--------|-------|
| Backlog | W-5, W-6, W-7 |
| To Do | W-1, W-2, W-3, W-4 |
| In Progress | — |
| Review | — |
| Done | — |

---

## 🟢 To Do

### W-1 · 🔴 Service-role key exposed in deployed bundle
- **Status:** To Do — do first (live, exploitable)
- **Area:** whole app · build/config · `.env`, `supabase/adminClient.js`, `src/services/*`
- **Evidence:** deployed `/assets/index-*.js` decodes to 2 JWTs incl. `role=service_role` (ref `mqhxypxxtdevzxcrsoqz`). Full RLS bypass readable by anyone.
- **Acceptance:**
  - [ ] Rotate the leaked `service_role` key in Supabase dashboard
  - [ ] Remove `VITE_SUPABASE_SERVICE_ROLE_KEY` from build/Vercel env
  - [ ] Delete client `adminClient` + `adminClient` branches in services
  - [ ] Route privileged writes through Edge Functions (pattern: `create-user`)
  - [ ] Re-fetch deployed bundle → 0 `service_role` JWTs

### W-2 · 🟠 Helpee dashboard KPIs slow (~5s spinner)
- **Status:** To Do
- **Area:** `src/pages/helpee/HelpeeHome.jsx` · `src/services/dashboardService.js` (`getHelpeeDashboard`)
- **Evidence:** Account Balance / Overview cards spun ~5s while job list rendered; client-side invoice math over N jobs+invoices.
- **Acceptance:**
  - [ ] Helpee dashboard first paint < 1.5s on pilot dataset
  - [ ] Move aggregation to a DB RPC/view (reuse existing `invoice_balances` view)
  - [ ] Show skeletons, not full-card spinners

### W-3 · 🟠 Job detail full-screen spinner (~2s)
- **Status:** To Do
- **Area:** `src/pages/admin/JobForm.jsx` · `src/services/jobService.js` (`getJobById`)
- **Evidence:** `/admin/jobs/:id` blank+spinner ~2s (6 serial `Promise.all` sub-queries).
- **Acceptance:**
  - [ ] Job detail interactive < 1.5s
  - [ ] Single RPC or embedded select, or progressive render

### W-4 · 🟠 No testIDs / split-text labels (testability)
- **Status:** To Do (unblocks Playwright graduation)
- **Area:** nav cards, table rows, action buttons across pages
- **Evidence:** buttons split label into 2 text nodes; no `data-testid` → text selectors fail.
- **Acceptance:**
  - [ ] `data-testid` on nav cards (`nav-manage-users`, …)
  - [ ] `job-row-{jobId}`, `job-status-btn-{status}`, `helpee-create-job`
  - [ ] role/text selectors resolve without coordinates

---

## 📋 Backlog

### W-5 · 🟡 "Amount Spent" semantics misleading
- **Status:** Backlog
- **Area:** `src/services/dashboardService.js` (`getHelpeeDashboard`) · helpee home
- **Evidence:** shows "Amount Spent 18,434.00" but every invoice `amount_paid = 0`; "spent" derived from job status, not payment.
- **Acceptance:**
  - [ ] Rename to "Invoiced (completed)" OR compute from `amount_paid`
  - [ ] Client is not told they spent money nobody collected

### W-6 · 🟡 Helpee create-job shows staffing fields
- **Status:** Backlog
- **Area:** `src/pages/admin/JobForm.jsx` (helpee mode)
- **Evidence:** Helper(s)/Supervisor fields shown to helpee though server ignores them for creator role `helpee`.
- **Acceptance:**
  - [ ] Helpee create form hides Helper/Supervisor staffing fields

### W-7 · 🟡 Stock browser tab title / branding
- **Status:** Backlog
- **Area:** `index.html`
- **Evidence:** tab title is "Vite + React" on the live app.
- **Acceptance:**
  - [ ] `<title>FusionSync</title>` + real favicon

---

## 🔧 In Progress
_(none)_

## 👀 Review
_(none)_

## ✅ Done
_(none)_

---

_Excluded: W-8 (post-login `get url` timing) — verified not a bug (SPA async redirect)._
