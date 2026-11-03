# Meridian

Meridian is an AI-assisted task manager built around a simple rule: **work moves through real approvals, not around them.** Every task, rating, extension and transcript is governed by server-enforced roles, team scope and multi-level approval chains.

The repository is a monorepo with a Node/Express/SQLite API and a React/Vite single-page app.

```
.
├─ server/          Express 5 + node:sqlite API (no native dependencies)
├─ web/             React 19 + Vite + TypeScript client
├─ scripts/dev.js   Runs API and web together
└─ package.json     Workspace scripts
```

## Documentation

- **`USER_GUIDE.md`** — first-time user guide: task lifecycle, approvals, roles and a 3-minute demo script.
- **`docs/meridian-user-guide.pdf`** — ready-to-share PDF version of the guide.
- **`docs/user-guide.html`** — styled, printable source page for the PDF.
- **`DESIGN.md`** — product and design decisions.
- **`DEPLOY.md`** — hosting options (Render, Railway, Vercel).

Regenerate the printable guide after editing `USER_GUIDE.md`:

```bash
npm run docs
```

## Quick start

```bash
npm install
npm run seed      # demo workspace; add -- --force to reseed an existing DB
npm run dev       # API on :4000 and web on :5173
```

Open <http://localhost:5173> and sign in with any demo account. Every account uses the password **`demo1234`**.

| Role | Demo account |
| --- | --- |
| Employee | `elena.rossi@meridian.io` |
| Manager | `james.rivera@meridian.io` |
| Senior Manager | `sarah.chen@meridian.io` |
| System Administrator | `maya.patel@meridian.io` |

Individual scripts:

```bash
npm run dev:server   # API only  (http://localhost:4000)
npm run dev:web      # Vite only (http://localhost:5173, proxies /api)
npm run build        # production build of the web app
npm test             # backend acceptance tests (12 scenarios)
npm start            # production API server
```

The API stores data in `server/data/meridian.db` (created on first run). Deleting that file recreates a fresh demo workspace on the next server start.

## What the product does

### Tasks and approvals

- Any employee may create a task **for themselves**. It enters `PENDING_CREATION_APPROVAL` and cannot start until their manager approves activation.
- Managers may assign tasks within their reporting team; the activation gate only applies to self-created work.
- Completion is always two-tier: **manager first, then senior manager**. Neither level can be skipped.
- A senior manager rejection routes back to the **manager**, never directly to the employee. The manager then chooses to request corrections (returns to assignee) or resubmit to the senior manager.
- Every status change, comment and decision is appended to a permanent per-task audit trail.
- Due dates are immutable except through a **two-level extension approval** (manager, then senior manager). Assignees request; approvers decide.
- Manager and senior manager ratings are **separate records** (1–5 plus remarks), stored independently from the approval events.

### Group tasks

Groups are supported in two modes, each with isolated audit trails:

- **Mode A — full contribution:** every member gets an individual contribution task that must pass its own two-tier completion approval. The leader's consolidated submission is also mandatory; it stays locked until every mandatory contribution is complete.
- **Mode B — leader consolidated:** only the leader's consolidated submission is mandatory. Member contributions are generated and tracked for visibility but do not block completion.

The group leader is always the task assignee. Members must belong to the leader's team scope; the backend rejects out-of-scope members. Group parts inherit the group's approval chain snapshot.

### Roles and privacy

| Capability | Employee | Manager | Senior Manager | Administrator |
| --- | --- | --- | --- | --- |
| Own tasks | ✓ | ✓ | ✓ | read-only |
| Assign to others | — | reporting team | department | — |
| Activate self-created work | — | level 1 | level 2 for own line | — |
| Completion review | — | level 1 | level 2 | — |
| Team oversight | — | direct reports | department | all |
| Reports | own | own + reports | department | organisation |
| Meetings | own/participant | own + reports' | department | all |
| Raw transcripts | own created | creator/participant's manager | department | all |
| User/department/AI admin | — | — | — | ✓ |
| Create/approve/rate tasks | ✓ | ✓ | ✓ | **never** |

Employees are explicitly excluded from team oversight. Managers only see their direct reports (plus themselves and their own manager for context). Senior managers see their department. Administrators see everything for platform oversight but are read-only for the workflow itself. A direct report must share their manager's department; the administration API rejects cross-department reporting lines so approval chains never cross team boundaries.

### Reports

Reports never blend the two sources of work:

- **Tasks assigned by manager** — creator ≠ assignee.
- **Tasks created by employee** — self-authored work (including activation-gated tasks).
- **Combined total** — a sum shown alongside, never instead of, the two source views.

Per-person breakdowns, status distribution, independent manager/senior rating distributions and CSV export are included.

### Meetings and AI

Meetings capture a transcript, then extract a summary, decisions and action items. Action items can be converted into governed tasks with one click.

Raw transcripts are protected server-side:

- Administrators, the creator, the department senior manager, and managers of the creator or any participant may read the raw text.
- Employee participants receive only the derived summary, decisions and action items.

AI is optional. Configure an OpenAI-compatible endpoint in **Administration → AI settings**. When AI is disabled or the endpoint fails, Meridian falls back to a deterministic heuristic extractor and built-in workload analysis. AI insights are computed only from the viewer's authorised scope and are labelled by source in the UI.

## Backend

- Node 24, Express 5, Zod validation, `node:sqlite` (built in, no native build step).
- Scrypt-hashed passwords and HMAC-signed bearer tokens.
- In-memory login rate limiting.
- Authoritative permissions: every route resolves the actor's role and scope before touching data. UI permission flags are presentation only.
- Acceptance tests exercise activation, self-approval blocking, two-tier completion, senior rejection routing, both group modes, split reports, transcript restrictions, admin boundaries, manager isolation and AI scoping.

Run `npm test` to execute them.

## Frontend

- React 19, Vite, TypeScript, React Router 7, lucide-react.
- Hand-written CSS design system (`web/src/styles.css`), no utility framework.
- Role-aware navigation, protected routes, action-specific dialogs, optimistic-free refresh-after-mutation flows.
- The frontend calls `/api` relative to its own origin; Vite proxies to `:4000` in development.

## Notes

- All data and accounts are fictional demo data.
- Passwords are never returned by the API; AI keys are stored server-side and only a masked hint is exposed.
- The administrator role exists to manage the platform, not to participate in task workflows. This is enforced in the API, not just the UI.
