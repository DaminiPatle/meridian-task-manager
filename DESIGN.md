# Meridian — design notes

This document explains how the product rules are modelled and where each guarantee is enforced. The short version: **the API is authoritative; the UI only reflects what the API allows.**

## 1. Architecture

```
Browser (React 19 + Vite, :5173)
   │  fetch /api/*  (relative; Vite proxies to :4000)
   ▼
Express 5 API (:4000)
   ├─ auth.js         scrypt passwords, HMAC bearer tokens, login rate limit
   ├─ rbac.js         visibility scopes and capability checks
   ├─ workflow.js     task lifecycle, approval chains, groups, extensions, ratings
   ├─ reports.js      split reporting and team overview
   ├─ ai.js           optional LLM + deterministic fallback
   ├─ routes/*.js     Zod-validated HTTP surface
   └─ node:sqlite     embedded database, no native dependency
```

There is no ORM and no migration framework. `db.js` creates the schema idempotently; `seed.js` builds a demo organisation of 13 people, 26 tasks and 3 meetings.

### Why SQLite via `node:sqlite`

The runtime is Node 24, which ships SQLite as a built-in module. This keeps the project dependency-light and removes the native compilation step that `better-sqlite3` or Prisma would require on a reviewer's machine. All SQL is explicit and readable.

### Why hand-written CSS

The interface is a product-specific design system (surfaces, badges, workflow chain, boards, tables, timeline) rather than a utility-class page. Keeping it in one `styles.css` makes the visual logic auditable and avoids a build-time Tailwind dependency.

## 2. Task lifecycle

```
                     ┌──────────────────────────────┐
 self-created        │  PENDING_CREATION_APPROVAL   │
 ───────────────────▶│                              │
                     └──────────────┬───────────────┘
                        manager     │      manager
                        approves    │      rejects
                                    ▼             ▼
                                  ACTIVE     CREATION_REJECTED
                                    │             │
                         start work │             │ creator revises
                                    ▼             │ and resubmits
                                IN_PROGRESS ◀─────┘
                                    │
                        submit completion
                                    ▼
                        PENDING_MANAGER_REVIEW
                           │              │
                  manager  │              │ manager
                  approves │              │ returns for rework
                           ▼              ▼
                  PENDING_SENIOR_REVIEW  REWORK
                     │          │           │
            senior   │          │ senior    │ assignee resubmits
            approves │          │ rejects   │
                     ▼          ▼           │
                 COMPLETED   RETURNED_TO_MANAGER
                                  │      │
                       manager    │      │ manager
                       requests   │      │ resubmits
                       corrections│      │
                                  ▼      ▼
                                REWORK  PENDING_SENIOR_REVIEW
```

Key invariants:

1. Directly assigned tasks skip the activation gate (creator ≠ assignee). Self-created tasks always require manager activation.
2. The actor can never approve their own task. This is checked in the workflow engine, not in the UI.
3. `COMPLETED` is only reachable through `manager_approve` **then** `senior_approve`.
4. `senior_reject` always transitions to `RETURNED_TO_MANAGER`. The employee cannot be the direct recipient.
5. Cancellation is allowed only in non-terminal states and always requires a reason.
6. Every transition appends an immutable event (`task_events`) with actor, from/to status, comment and metadata.

The approval chain is **snapshotted at creation** (`manager_id`, `senior_manager_id`):

- If the assignee is an employee, level 1 is their manager and level 2 is that manager's senior manager.
- If the assignee is a manager, level 1 is their own manager when valid, otherwise another senior manager in the department; level 2 is a distinct senior manager.
- A senior manager's own task falls back to another senior manager for level 2.
- The chain must contain two distinct people, and neither can be the assignee.

## 3. Permissions model

`rbac.js` produces SQL scope fragments for reads and capability predicates for writes. `workflow.js` composes those with task state to produce a per-task `permissions` object returned to the client:

```
canStart, canSubmit, canSubmitCreation, canApproveCreation,
canManagerReview, canSeniorReview, canDecideReturn,
canRequestExtension, canEdit, canCancel,
canRateManager, canRateSenior, canComment,
isAssignee, isManager, isSenior, isCreator, isGroupMember,
isAdmin, readOnly, groupReady, groupReadinessReason
```

The client uses these flags only to decide which buttons to render. Every mutation re-checks the same conditions server-side; a forged request fails with 403/409.

### Visibility scopes

| Viewer | Tasks | People | Reports | Meetings | Transcripts |
| --- | --- | --- | --- | --- | --- |
| Employee | own tasks + group parts they participate in | self + team context | self | own/participant | own created only |
| Manager | self + direct reports + approval items | self + direct reports + own manager | self + reports | own/participant + reports' | creator/participant's manager |
| Senior | department | department | department | department | department |
| Admin | all (read-only) | all | all | all | all |

Approval items are attached to the viewer even when the task sits outside their normal read scope (for example, a manager approving a self-created task assigned to them). The workflow queries approval queues by actor id rather than by visibility scope.

Reporting lines are validated by the admin API: an employee or manager must share their manager's department, so approval chains cannot silently cross team boundaries. The user form mirrors that rule by listing only eligible approvers from the selected department.

## 4. Group tasks

A group task is a `GROUP` row plus one `GROUP_PART` row per member. The leader is the group assignee; parts are separate tasks with their own chain, events, comments, ratings and extensions.

- **Membership rule:** every member must be the leader, report to the same manager, or (when the leader is a manager) report to the leader. Out-of-scope members are rejected at creation.
- **Mode A:** every part is mandatory. The consolidated submission is locked until all mandatory parts reach `COMPLETED` (`groupReady`). The readiness reason is returned to the UI and enforced on `submit_completion`.
- **Mode B:** only the leader's submission is mandatory. Parts are tracked and displayed but do not gate the group.
- **Audit isolation:** each part has its own event trail. The parent's trail records generation, activation and its own approvals. A part's rating does not write to the parent.

`group_readiness` is computed on read and re-checked on the write path; it is never trusted from the client.

## 5. Due-date extensions

- Only the assignee may request an extension (`requestExtension`).
- The requested date must be after the current due date and in the future.
- State machine: `PENDING_MANAGER → PENDING_SENIOR → APPROVED`.
- Either level may reject; a rejection ends the request and leaves the due date unchanged.
- On final approval the task's `due_date` changes and `original_due_date` preserves the first value.
- Approval is recorded as an extension event and a notification; a pending request blocks a second request.
- The UI never edits `dueDate` directly — the edit dialog omits it.

## 6. Ratings

Ratings are rows in `task_ratings` keyed by `(task_id, rater_role)`, with their own score, remarks, author and timestamps. They are created only after `COMPLETED`, only by the snapshotted manager (role `MANAGER`) or senior manager (role `SENIOR_MANAGER`), and only by the actor whose id matches that chain slot. Re-submitting updates the same role record and appends a `rating_updated` event; the other role's record is untouched. Reports aggregate the two distributions independently.

## 7. Split reporting

`reports.js` classifies each task by `created_by === assignee_id`:

- `assigned` — delegated work.
- `selfCreated` — self-authored work.
- `combined` — union of both.

Each bucket computes total, completed, open, overdue, completion rate, on-time rate, average cycle days, average effort and independent rating averages. The API always returns all three; the UI renders three distinct panels and the CSV exports the columns separately. Scope is resolved with `subjectSet`, so a manager can never request a subject outside their team even by passing `userId`.

## 8. Meetings and transcripts

Meetings have a creator, a department and participants. `canViewMeeting` governs list/detail visibility. `canViewTranscript` is narrower:

```
admin
creator
department senior manager
manager of the creator
manager of any participant
```

Employee participants can see the meeting, summary, decisions and action items, but `transcript` is returned as `null` with `transcriptRestricted: true`. List responses never include the transcript at all.

Processing is gated by `canProcessMeeting` (creator, relevant manager/senior, admin). Action-item → task conversion calls the same `createTask` engine, so the resulting task inherits the normal activation, completion and extension rules.

## 9. AI design

`ai.js` exposes a settings record with a masked public shape (`hasKey`, `keyHint`). Raw keys never leave the server.

- **Extraction:** with live AI enabled, a strict JSON prompt returns summary/decisions/action items; the response is validated and normalised. On any failure (network, timeout, malformed JSON) the heuristic extractor runs and the meeting is labelled `heuristic-fallback`.
- **Insights:** workload and due-date risk are computed from the scoped task set. The LLM receives only that scoped aggregate and may phrase the summary; it cannot see or mutate other teams' data. Without AI, a deterministic narrative is generated.
- **No workflow authority:** AI never transitions a task, assigns an approver or writes a rating.

## 10. Frontend structure

```
web/src/
├─ pages/         Login, Dashboard, Tasks, TaskDetail, Approvals,
│                 Team, Reports, Meetings, MeetingDetail, Insights, Admin
├─ components/    ui.tsx (kit), Layout, dialogs, TaskCreateModal, tasks
├─ context/       AuthContext (token + current user), ToastContext
├─ hooks/         useApi (load/reload), useAsyncAction (mutation state)
└─ lib/           api client, typed response shapes, formatting, constants
```

- `useAsyncAction` reports errors inline and accepts an `onSuccess(value)` callback; mutations always reload from the API rather than mutating local state.
- Route guards mirror the API (`/team` for manager+, `/admin` for admin) but are UX only. A direct API call still fails at the server.
- The task detail page exposes only the actions in `task.permissions`, with the approval chain rendered as a four-step visual (activation, manager, senior, ratings).
- The create-task dialog mirrors the backend team-link rule before submission so members are valid up front; the server remains the final validator.

## 11. Testing strategy

`server/tests/workflow.test.js` (run with `npm test`) drives the HTTP API against an isolated database. It asserts:

1. Demo authentication.
2. Self-created activation gate and blocked self-approval.
3. Two-tier completion and senior → manager rejection routing.
4. Two-level extension approval and unchanged dates on rejection.
5. Both group modes, including part isolation.
6. Split report totals and team scoping.
7. Transcript restrictions by role and team.
8. Administrator boundaries (cannot join workflow).
9. Manager isolation from other teams.
10. AI insight scope containment.

Frontend verification uses the production build plus the Vite dev server against the live API, exercising each role and the primary flows.
