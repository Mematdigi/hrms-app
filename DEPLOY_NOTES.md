# HRMS — Advanced Feature Build: Deploy Notes & Change Summary

## ⚠️ Deploy checklist (in order)

1. `cd server && npm install` (no new backend deps required — node-cron/moment-timezone already present; `ioredis` is optional, see Caching below).
2. Run the one-time migration: `node src/migrations/backfillHierarchy.js`
   (backfills `designationLevel`, `teamLead_id`, `employmentType` on existing users so the org chart isn't empty).
3. **RESTART PM2: `pm2 restart <app-name>`** — new Mongoose fields (`teamLead_id`, `designationLevel`, `employmentType`, new Notification types) get **silently stripped** by the running process if you skip this. This has bitten us before.
4. Rebuild the client: `cd client && npm install && npm run build` (the shipped `client/build` is stale relative to these changes).
5. From the Hierarchy page (as admin/HR), assign Team Leads to employees and promote TL users via Role Management (new `Team Lead` role option).
6. Optionally hit `POST /v1/scoring/recalculate` (admin) to compute the current month immediately instead of waiting for the nightly cron.

## New modules

| Area | Endpoints | Pages |
|---|---|---|
| TL role | role enum + RBAC everywhere | TL Dashboard (`/tl-dashboard`), TL nav menu |
| Hierarchy | `/v1/hierarchy/tree` (cached), `/my-branch`, `/team`, `PUT /:userId` (circular-reporting validated) | `/hierarchy` (org chart, editable for admin/hr/manager) |
| Task Sheets | `/v1/task-sheet` (submit/my/all/review) | `/task-sheet` |
| TL Weekly Report | `/v1/weekly-report` (submit w/ 3-day edit window, HR annotate-only audit) | `/weekly-report` |
| Feedback & Recommendations | `/v1/feedback`, `/v1/feedback/recommendation` | logged from Weekly Report + API |
| Scoring engine | `/v1/scoring/me|team|company|nakshatra-leaderboard|config|recalculate|finalize` | `/analytics` |

## Scoring engine

- **Configurable rules engine** — every point weight lives in the `ScoringConfig` singleton (`GET/PUT /v1/scoring/config`, HR/Admin). No redeploy needed to re-tune.
- Nightly cron (`00:30 IST`) recomputes the current month for all active employees; month-end cron (1st, `01:00 IST`) **locks** last month and auto-selects Employee **and** Intern of the Month (tie-break: fewest negative feedback, configurable), then notifies everyone.
- Analytics reads **only** the cached `MonthlyScore` docs — never recomputes in the request path.
- Nakshatra Award = cumulative monthly totals over the award period (default calendar year, 12 × 100 = 1200 target) + bonuses (EOM +20, weekend client meeting +10 each).
- The existing `PerformanceReview` (star-rating) module is untouched — the point engine is additive.

## Notifications — now covering every request/response flow

Previously only leave + payslip + birthday flows created notifications. Added:

- **Regularization**: submit → HR/Admin/Manager; approve/reject → employee *(was completely missing)*
- **Early checkout**: request → HR/Admin/Manager; approve/reject → employee *(was completely missing)*
- **Task sheet**: submit → the employee's TL
- **Weekly report**: submit → the employee + HR/Manager
- **Feedback / recommendation**: → the employee
- **Employee/Intern of the Month**: → everyone
- **Hierarchy change**: → the affected employee

New helpers in `Notificationcontroller.js`: `notifyRoles(roles, payload)` and `notifyUsers(ids, payload)`. The bell/toast UI (`NotificationContext.js`) has colors/icons/labels for all new types.

## Bugs found & fixed in existing code

1. **`employeeId` increment (authController.register)** — `employeeId` is a String, so `.sort({ employeeId: -1 })` sorted lexicographically ("9" > "10" > "100") → wrong/duplicate IDs past digit boundaries. Now computed via numeric aggregation.
2. **`cacheMiddleware` crash** — it required `../redis`, which didn't exist; importing it anywhere would crash the server. Added `src/redis.js`: uses real Redis when `REDIS_URL` is set + `ioredis` installed, otherwise a same-interface in-memory TTL cache.
3. **Toasts never displayed** — `react-hot-toast`/`react-toastify` were called but no `<Toaster/>`/`<ToastContainer/>` was mounted. Both mounted once in `App.js` (this also fixes Login page error toasts).
4. **Unprotected route** — `/EmployeeDetails/:id` had no token guard in `App.js`. Guarded.
5. **Notification sender populate** — populated `profilePhoto`, but the User field is `profileImage`. Fixed.
6. **`User.updatedAt` never updated** — added to the pre-save hook.

## UI / design system

- New `client/src/assets/scss/_variables.scss` (imported **first** in `main.scss`): `$color-bg-primary #FFFFFF`, `$color-secondary #1976D2` (+ `#3F51B5` alt), `$color-accent #FF7043` (+ `#FFA726` light), `$color-text-primary #333333`, one consistent status-chip mapping, Inter base font, H1–H6 scale, shared mixins (`btn-primary-accent`, `btn-secondary-outline`, `card`, `status-chip`).
- All 5 new pages are fully token-based; existing partials received a consistency pass (grey page backgrounds → white token, known blue/orange hexes → variables). Continue migrating remaining per-page hexes to `$color-*` opportunistically.

## Caching

`GET /v1/hierarchy/tree` uses `cacheMiddleware` (5 min TTL) and is invalidated on hierarchy edits. To use real Redis: `npm i ioredis` and set `REDIS_URL` in `.env`; otherwise the in-memory fallback is automatic (fine for a single PM2 instance).

## Open questions to confirm (defaults are live in ScoringConfig, changeable from the UI)

1. "Late coming −0.5 (3 day)" → implemented as **−0.5 per group of 3 lates** (`latePenaltyGroupSize: 3`; set to 1 for per-instance).
2. "Half day (unpaid): +1" → implemented **as written (+1)**, but stored as a signed config value (`halfDayPoints`) — flip to −1 if it should be a deduction.
3. Nakshatra period → default **calendar year**; set `nakshatraPeriodStart/End` in config for any other window.
4. Intern scoring → same rule set, but a **separate Intern of the Month** award is selected (`separateInternAward: true`).
