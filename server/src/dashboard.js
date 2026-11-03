import { taskScopeSql } from './rbac.js';
import { buildApprovals, listTasks } from './workflow.js';
import { buildTeam, peopleInScope } from './reports.js';
import { computeInsights } from './ai.js';
import { today } from './util.js';

function scopeLabel(user) {
  if (user.role === 'ADMIN') return 'Organisation';
  if (user.role === 'SENIOR_MANAGER') return `${user.department_name} department`;
  if (user.role === 'MANAGER') return `${user.full_name}’s team`;
  return 'Your workspace';
}

export async function buildDashboard(db, user) {
  const approvals = buildApprovals(db, user);
  const tasks = listTasks(db, user, {});
  const people = peopleInScope(db, user);
  const open = tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status));
  const mine = tasks.filter((t) => t.assigneeId === user.id);
  const myOpen = mine.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status));
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today());
  const completedThisMonth = tasks.filter(
    (t) => t.status === 'COMPLETED' && String(t.completedAt || '').slice(0, 7) === today().slice(0, 7),
  );

  const actions = [];
  const push = (type, label, task, extra = {}) => {
    actions.push({
      type,
      label,
      task,
      urgency: task?.dueRisk?.level || (type === 'extension' ? 'HIGH' : 'MEDIUM'),
      ...extra,
    });
  };
  for (const t of approvals.creation) push('activation', 'Approve task activation', t);
  for (const t of approvals.managerReviews) push('review', 'Review completion', t);
  for (const t of approvals.seniorReviews) push('final', 'Give final approval', t);
  for (const t of approvals.returned) push('decision', 'Decide on returned submission', t);
  for (const t of approvals.ratingsDue) push('rating', 'Submit your independent rating', t);
  for (const t of approvals.needsRework) push('rework', 'Revise and resubmit', t);
  for (const t of approvals.readyGroups) push('group_submit', 'Submit consolidated project', t);
  for (const ext of approvals.extensions) {
    push(
      ext.status === 'PENDING_SENIOR' ? 'extension_final' : 'extension',
      ext.status === 'PENDING_SENIOR' ? 'Final extension approval' : 'Review extension request',
      ext.task,
      { extension: ext },
    );
  }
  actions.sort((a, b) => {
    const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (rank[a.urgency] ?? 4) - (rank[b.urgency] ?? 4);
  });

  const focus = (user.role === 'ADMIN' ? open : myOpen)
    .slice()
    .sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')))
    .slice(0, 5);

  const scope = taskScopeSql(user, 't');
  const activityRows = db
    .prepare(
      `SELECT e.id, e.action, e.comment, e.from_status, e.to_status, e.created_at,
        t.id AS taskId, t.title AS taskTitle, t.task_kind AS taskKind,
        u.full_name AS actorName, u.avatar_color AS actorColor, u.role AS actorRole
       FROM task_events e
       JOIN tasks t ON t.id = e.task_id
       LEFT JOIN users u ON u.id = e.actor_id
       WHERE (${scope.sql})
       ORDER BY e.created_at DESC LIMIT 10`,
    )
    .all(...scope.params)
    .map((e) => ({
      id: e.id,
      action: e.action,
      comment: e.comment,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      createdAt: e.created_at,
      taskId: e.taskId,
      taskTitle: e.taskTitle,
      taskKind: e.taskKind,
      actorName: e.actorName || 'System',
      actorColor: e.actorColor || '#94a3b8',
      actorRole: e.actorRole,
    }));

  let teamPreview = null;
  if (['MANAGER', 'SENIOR_MANAGER', 'ADMIN'].includes(user.role)) {
    const team = buildTeam(db, user);
    teamPreview = { ...team, members: team.members.slice(0, 5) };
  }

  const insights = await computeInsights(db, scopeLabel(user), tasks, people);

  const ratingDueCount = approvals.ratingsDue.length;

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      openTasks: user.role === 'ADMIN' ? open.length : myOpen.length,
      teamOpen: open.length,
      awaitingAction: approvals.total,
      overdue: overdue.length,
      completedThisMonth: completedThisMonth.length,
      ratingDue: ratingDueCount,
      people: people.length,
      completionRate: tasks.length
        ? Math.round(
            (tasks.filter((t) => t.status === 'COMPLETED').length /
              tasks.filter((t) => t.status !== 'CANCELLED').length) *
              100,
          )
        : 0,
    },
    actions: actions.slice(0, 8),
    actionOverflow: Math.max(0, actions.length - 8),
    focus,
    activity: activityRows,
    insights,
    teamPreview,
    approvals: {
      total: approvals.total,
      creation: approvals.creation.length,
      manager: approvals.managerReviews.length,
      senior: approvals.seniorReviews.length,
      returned: approvals.returned.length,
      extensions: approvals.extensions.length,
      ratings: approvals.ratingsDue.length,
    },
  };
}
