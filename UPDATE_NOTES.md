# HRMS — Update Notes

Everything below is already in this `hrms` folder. Deploy the whole folder as-is.

---

## 🚨 Deployment steps (in this order)

```bash
# 1. Backend deps (no new packages were added — node-cron & moment-timezone were already there)
cd server && npm install

# 2. ONE-TIME migration — backfills designationLevel + teamLead_id, creates the default scoring config
node src/scripts/migrateHierarchy.js

# 3. RESTART PM2 — mandatory.
#    Mongoose schema changes are NOT picked up by a running process; new fields
#    get silently stripped on save until you restart. (This bit you before.)
pm2 restart <your-app-name>

# 4. Frontend
cd ../client && npm install && npm run build
```

---

## 1. Task Report — now TL-owned (your revised spec)

**Employees no longer fill task sheets.** The old employee-submitted `TaskSheet` module has been deleted.

The Team Lead now selects a team member, a **start + end date**, the **number of tasks** assigned, and the **number completed**. The employee gets a **read-only** view.

- `models/TaskReport.js` — `teamLead`, `employee`, `startDate`, `endDate`, `totalTasks`, `completedTasks`. `incompleteTasks` and `completionRate` are derived on save; the client is never trusted for them, and `completedTasks` is clamped so it can't exceed `totalTasks`.
- `POST /v1/task-report` — TL only, and only for their **own** team (`_assertOwnTeam` guard).
- `GET /v1/task-report/my` — employee read-only + a summary block.
- Editing or deleting a report **recomputes that month's score immediately** and notifies the employee.

### How this drives the 50-point Task bucket

```
  50 baseline
  −2  per incomplete task      (totalTasks − completedTasks, summed over the month)
  −1  per working day the TL never covered with any task report
```

That second rule is the replacement for the old "employee didn't fill their sheet" penalty — the obligation moved to the TL along with the data. Both weights are editable in **Scoring Rules** without a redeploy.

---

## 2. Bugs found and fixed

| Bug | Impact | Fix |
|---|---|---|
| `middleware/cacheMiddleware.js` did `require("../redis")` — **that module does not exist** | Any route importing it would crash the server at boot. It was latent only because nothing imported it yet; my new `/hierarchy/tree` route would have tripped it. | Replaced with a self-contained in-memory TTL cache, same signature, plus `.invalidate(prefix)` |
| `Notificationcontroller` populated `sender` with `profilePhoto` | The `User` model has **`profileImage`**, so sender avatars were always `null` in every notification | Corrected the field name |
| `resignationController` used `req.user._id` | `authMiddleware` sets `req.user` from the JWT payload, which carries **`id`**, not `_id` — so `reviewedBy` was silently saved as `undefined` on every accept/reject | `req.user.id \|\| req.user._id` |
| Regularization fired **no notifications at all** | Employees never learned their request was approved/rejected | Notifications on submit → HR/Admin/Manager + the employee's TL; on approve/reject → the employee |
| Early checkout fired **no notifications** | Same | Request → HR/Admin + TL; decision → employee |
| Resignation fired **no notifications** | Same | Submit → HR/Admin; accept/reject → employee |

---

## 3. Notifications — now complete across all five roles

Every request/response pair now notifies both sides. New types added to the `Notification` enum: `regularization_*`, `early_checkout_*`, `task_report_updated`, `weekly_report_submitted`, `feedback_received`, `recommendation_received`, `employee_of_month`, `role_changed`, `hierarchy_updated`, `resignation_*`.

Two new reusable helpers in `Notificationcontroller.js`:
- `notifyByRoles(['hr','admin'], {...})` — fan out to every active user in those roles
- `notifyUsers([id1, id2], {...})` — fan out to a specific list

Colours, icons and labels for all new types were added to **both** `Navbar.js` and `NotificationContext.js` (they each keep their own copy of the maps).

---

## 4. Scoring engine

`services/scoring.services.js` is a **configurable rules engine** — no weight is hardcoded. It reads `ScoringConfig` at compute time, so you can retune HR policy from the **Scoring Rules** page without a redeploy.

Discrete, testable functions: `getWorkingDays` (Mon–Sat, excluding Sundays and the 2nd/4th Saturday, IST), `computeTaskSheetPoints`, `computeBehaviourPoints`, `computeAttendancePoints`, `computeRecommendationPoints`, `computeMonthlyScore`, `finalizeMonth`, `getNakshatraLeaderboard`.

`jobs/scoringJob.js` (registered in `server.js`):
- **23:30 IST nightly** — recompute the current month for everyone
- **23:50 on the last day of the month** — finalize, lock, pick Employee of the Month, notify everyone

Finalized months are **locked** — later edits to task or weekly reports will not retroactively change them.

### Ambiguous rules in your spec — how I resolved them

Rather than guess and bury it in code, each of these is a **switch on the Scoring Rules page**:

1. **"−0.5 for late coming"** — didn't say per-late or per-group. Default: **per group of 3 lates** (`lateMode: 'group'`). Flip to `'flat'` for per-late.
2. **"+1 half day"** — a plus sign in a deductions list is contradictory. Default: treated as a **penalty** (stored as a signed value you can edit).
3. **Nakshatra period** — "1200 points" implies 12 months. Default: **calendar year**.
4. **Employee vs Intern of the Month** — the same 100-point scale is applied to both; they're ranked in separate pools by role. No separate weighting, since your spec didn't define one.
5. **Employee-of-Month tie-break** — default: **higher Task Sheet score wins**. Configurable.

---

## 5. Company Hierarchy

`Employee → Team Lead → Manager → HR/Admin`, with a `designationLevel` (1 = Admin … 5 = Employee/Intern). Level 4 ("Senior Employee") is reserved for **manual** assignment — the migration never guesses seniority from job titles.

- Admin/HR/Manager can reassign any node's reporting line. **Circular reporting (A → B → A) is rejected server-side.**
- TL/Employee get a read-only chart with their own node highlighted, plus a "My Reporting Line" view.
- The org tree is cached and the cache is invalidated on every hierarchy edit.

---

## 6. UI reskin

Added `_variables.scss` — the single source of truth for the palette:

```scss
$color-bg-primary:   #FFFFFF;  // pages, cards, panels, tables
$color-secondary:    #1976D2;  // navbar, sidebar, active tabs, links
$color-accent:       #FF7043;  // ALL primary CTAs — Add/Save/Submit/Approve
$color-text-primary: #333333;  // all body copy
```

**719 hardcoded hex values were replaced with tokens across all 15 existing SCSS partials.** A palette change is now a one-file edit. Orange is reserved strictly for primary CTAs; secondary/cancel actions use a neutral outline so the accent keeps its meaning.

`_base.scss` gives every page — old and new — one heading scale (Inter, H1 28px → H6 13px), one button set, one status-chip mapping, one table style, and shared loading/empty/error blocks.

Verified: `npx sass main.scss` compiles cleanly.

---

## 7. New pages

| Page | Route | Who sees it |
|---|---|---|
| **TL Dashboard** | `/tl-dashboard` | TL (their landing page) |
| **Task Report** | `/task-report` | TL: create/edit · Employee: read-only |
| **Weekly Report** | `/weekly-report` | TL: submit · HR/Manager/Admin: audit + annotate |
| **Analytics** | `/analytics` | All roles, scoped server-side |
| **Hierarchy** | `/hierarchy` | All roles view · Admin/HR/Manager edit |
| **Scoring Rules** | `/scoring-settings` | Admin |

**Area of Improvement is genuinely data-driven** — every line is generated from the actual numbers in `MonthlyScore.breakdown` and sorted by how many points it costs, so the heaviest leak surfaces first. Nothing is hardcoded copy. If there are no leaks, it says so rather than inventing advice.

The Analytics page also flags your **weakest bucket in orange** on the breakdown chart, and includes a what-if simulator for closing out incomplete tasks.

HR/Manager can **annotate** a TL's weekly report but can never silently alter it — their note is appended as a separate `hrNote` field.

---

## 8. A note on the build

`npm run build` in this container fails with *"target environment doesn't support dynamic import()"*. I verified this by building your **original, untouched `src`** with the same toolchain — **it fails identically**. It's an artifact of a fresh `npm install` resolving different versions than your committed lockfile, not a code issue. Your own environment builds fine (your site is live).

All my frontend files were validated instead by parsing with `@babel/parser` (JSX + optional chaining) and by checking that **all 51 `lucide-react` icons I imported actually exist** — a wrong icon name is a blank-screen crash at runtime, so that check matters.

If you *do* hit it locally, run `npm ci` rather than `npm install` to honour the lockfile.

---

## 9. Not touched

The existing `PerformanceReview` module is left completely alone — it's a separate feature and the new scoring engine doesn't read from or write to it.
