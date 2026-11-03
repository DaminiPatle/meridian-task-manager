import { AppError, addDays, average, daysBetween, round, today } from './util.js';
import { departmentUsers, directReports, userById } from './repo.js';
import { listTasks } from './workflow.js';

function subjectSet(db, viewer, targetUserId) {
  if (targetUserId === 'all' || targetUserId == null) {
    if (viewer.role === 'ADMIN') {
      const users = db
        .prepare("SELECT * FROM users WHERE is_active = 1 ORDER BY full_name")
        .all();
      return { label: 'Organisation', users, target: { id: 'all', fullName: 'Organisation', role: 'ADMIN' } };
    }
    if (viewer.role === 'SENIOR_MANAGER') {
      const users = departmentUsers(db, viewer.department_id);
      return {
        label: `${viewer.department_name || 'Department'} team`,
        users,
        target: { id: 'all', fullName: `${viewer.department_name} team`, role: viewer.role },
      };
    }
    if (viewer.role === 'MANAGER') {
      const users = [userById(db, viewer.id), ...directReports(db, viewer.id)];
      return {
        label: `${viewer.full_name}’s team`,
        users,
        target: { id: 'all', fullName: `${viewer.full_name}’s team`, role: viewer.role },
      };
    }
    const self = userById(db, viewer.id);
    return {
      label: viewer.full_name,
      users: [self],
      target: { id: viewer.id, fullName: viewer.full_name, role: viewer.role },
    };
  }

  const target = userById(db, targetUserId);
  if (!target) throw new AppError(404, 'User not found');
  if (viewer.role === 'EMPLOYEE' && target.id !== viewer.id) {
    throw new AppError(403, 'Employees can only view their own reports');
  }
  if (viewer.role === 'MANAGER') {
    if (target.id !== viewer.id && target.manager_id !== viewer.id) {
      throw new AppError(403, 'Managers can only report on themselves and their direct reports');
    }
  }
  if (viewer.role === 'SENIOR_MANAGER') {
    if (target.department_id !== viewer.department_id) {
      throw new AppError(403, 'Senior managers can only report on their own department');
    }
  }
  return {
    label: target.full_name,
    users: [target],
    target: { id: target.id, fullName: target.full_name, role: target.role },
  };
}

function membershipSql(ids) {
  return ids.map(() => '?').join(',');
}

function ratingsFor(db, taskIds) {
  if (!taskIds.length) return [];
  return db
    .prepare(
      `SELECT r.*, t.assignee_id FROM ratings r JOIN tasks t ON t.id = r.task_id
       WHERE r.task_id IN (${taskIds.map(() => '?').join(',')})`,
    )
    .all(...taskIds);
}

function emptyMetrics() {
  return {
    total: 0,
    completed: 0,
    open: 0,
    overdue: 0,
    completionRate: 0,
    onTimeRate: 0,
    onTimeCompleted: 0,
    avgCycleDays: null,
    avgEffortHours: null,
    managerRating: null,
    managerRatingCount: 0,
    seniorRating: null,
    seniorRatingCount: 0,
    ratingGap: 0,
  };
}

function metricsFor(tasks, ratingRows) {
  if (!tasks.length) return emptyMetrics();
  const completed = tasks.filter((t) => t.status === 'COMPLETED');
  const open = tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status));
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today());
  const onTime = completed.filter((t) => t.dueDate && t.completedAt && String(t.completedAt).slice(0, 10) <= t.dueDate);
  const managerRatings = ratingRows.filter((r) => r.rater_role === 'MANAGER');
  const seniorRatings = ratingRows.filter((r) => r.rater_role === 'SENIOR_MANAGER');
  const ratedTaskIds = new Set(ratingRows.map((r) => r.task_id));
  return {
    total: tasks.length,
    completed: completed.length,
    open: open.length,
    overdue: overdue.length,
    completionRate: tasks.length ? round((completed.length / tasks.length) * 100, 0) : 0,
    onTimeRate: completed.length ? round((onTime.length / completed.length) * 100, 0) : 0,
    onTimeCompleted: onTime.length,
    avgCycleDays: average(
      completed.map((t) => daysBetween(t.createdAt, t.completedAt)).filter((n) => n != null && n >= 0),
    ),
    avgEffortHours: average(tasks.map((t) => Number(t.effortHours)).filter((n) => Number.isFinite(n) && n > 0)),
    managerRating: average(managerRatings.map((r) => r.score)),
    managerRatingCount: managerRatings.length,
    seniorRating: average(seniorRatings.map((r) => r.score)),
    seniorRatingCount: seniorRatings.length,
    ratingGap: completed.filter((t) => !ratedTaskIds.has(t.id)).length,
  };
}

function distributionFor(ratingRows) {
  const build = (role) => {
    const scores = ratingRows.filter((r) => r.rater_role === role).map((r) => r.score);
    return {
      average: average(scores),
      count: scores.length,
      distribution: [1, 2, 3, 4, 5].map((s) => ({ score: s, count: scores.filter((x) => x === s).length })),
    };
  };
  return { manager: build('MANAGER'), senior: build('SENIOR_MANAGER') };
}

export function buildReport(db, viewer, { targetUserId, from, to } = {}) {
  const subjects = subjectSet(db, viewer, targetUserId);
  const fromDate = from || addDays(today(), -90);
  const toDate = to || today();
  const subjectIds = subjects.users.map((u) => u.id);
  if (!subjectIds.length) throw new AppError(404, 'No users in this reporting scope');

  const allTasks = listTasks(db, viewer, {});
  const tasks = allTasks.filter(
    (t) =>
      subjectIds.includes(t.assigneeId) &&
      String(t.createdAt).slice(0, 10) >= fromDate &&
      String(t.createdAt).slice(0, 10) <= toDate,
  );

  const ratingRows = ratingsFor(db, tasks.map((t) => t.id));
  const ratingByTask = new Map();
  for (const r of ratingRows) {
    if (!ratingByTask.has(r.task_id)) ratingByTask.set(r.task_id, []);
    ratingByTask.get(r.task_id).push(r);
  }

  const assigned = tasks.filter((t) => t.createdBy !== t.assigneeId);
  const selfCreated = tasks.filter((t) => t.createdBy === t.assigneeId);

  const statusCounts = {};
  for (const t of tasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  }
  const statusBreakdown = Object.entries(statusCounts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const teamRows = subjects.users
    .map((u) => {
      const own = tasks.filter((t) => t.assigneeId === u.id);
      const ownRatings = own.flatMap((t) => ratingByTask.get(t.id) || []);
      return {
        user: {
          id: u.id,
          fullName: u.full_name,
          role: u.role,
          title: u.title,
          avatarColor: u.avatar_color,
          departmentName: u.department_name,
        },
        assigned: metricsFor(
          own.filter((t) => t.createdBy !== t.assigneeId),
          ownRatings.filter((r) => own.find((t) => t.id === r.task_id && t.createdBy !== t.assigneeId)),
        ),
        selfCreated: metricsFor(
          own.filter((t) => t.createdBy === t.assigneeId),
          ownRatings.filter((r) => own.find((t) => t.id === r.task_id && t.createdBy === t.assigneeId)),
        ),
        combined: metricsFor(own, ownRatings),
      };
    })
    .filter((row) => row.combined.total > 0 || subjects.users.length === 1)
    .sort((a, b) => b.combined.total - a.combined.total);

  return {
    target: subjects.target,
    scopeLabel: subjects.label,
    period: { from: fromDate, to: toDate },
    subjects: subjects.users.map((u) => ({
      id: u.id,
      fullName: u.full_name,
      role: u.role,
      title: u.title,
      avatarColor: u.avatar_color,
    })),
    assigned: metricsFor(assigned, ratingRows.filter((r) => assigned.some((t) => t.id === r.task_id))),
    selfCreated: metricsFor(
      selfCreated,
      ratingRows.filter((r) => selfCreated.some((t) => t.id === r.task_id)),
    ),
    combined: metricsFor(tasks, ratingRows),
    ratings: distributionFor(ratingRows),
    statusBreakdown,
    team: teamRows,
  };
}

export function peopleInScope(db, user) {
  if (user.role === 'ADMIN') {
    return db.prepare('SELECT * FROM users WHERE is_active = 1 ORDER BY full_name').all();
  }
  if (user.role === 'SENIOR_MANAGER') return departmentUsers(db, user.department_id);
  if (user.role === 'MANAGER') {
    const byId = new Map();
    for (const person of [userById(db, user.id), ...directReports(db, user.id)]) {
      if (person) byId.set(person.id, person);
    }
    return [...byId.values()];
  }
  return [userById(db, user.id)];
}

export function buildTeam(db, viewer) {  let members = [];
  if (viewer.role === 'MANAGER') {
    members = directReports(db, viewer.id);
  } else if (viewer.role === 'SENIOR_MANAGER') {
    members = departmentUsers(db, viewer.department_id).filter((u) => u.id !== viewer.id);
  } else if (viewer.role === 'ADMIN') {
    members = db
      .prepare(
        `SELECT u.*, d.name AS department_name, m.full_name AS manager_name
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN users m ON m.id = u.manager_id
         WHERE u.is_active = 1 ORDER BY u.full_name`,
      )
      .all();
  } else {
    throw new AppError(403, 'Team oversight is available to managers and senior managers');
  }

  const tasks = listTasks(db, viewer, {});
  const memberIds = members.map((m) => m.id);
  const taskIds = tasks.filter((t) => memberIds.includes(t.assigneeId)).map((t) => t.id);
  const ratingRows = ratingsFor(db, taskIds);
  const ratingMap = new Map();
  for (const r of ratingRows) {
    if (!ratingMap.has(r.task_id)) ratingMap.set(r.task_id, []);
    ratingMap.get(r.task_id).push(r);
  }

  const rows = members.map((m) => {
    const own = tasks.filter((t) => t.assigneeId === m.id);
    const open = own.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status));
    const completed = own.filter((t) => t.status === 'COMPLETED');
    const overdue = open.filter((t) => t.dueDate && t.dueDate < today());
    const ratings = own.flatMap((t) => ratingMap.get(t.id) || []);
    const total = own.filter((t) => t.status !== 'CANCELLED').length;
    return {
      id: m.id,
      fullName: m.full_name,
      email: m.email,
      role: m.role,
      title: m.title,
      avatarColor: m.avatar_color,
      departmentName: m.department_name,
      managerName: m.manager_name,
      managerId: m.manager_id,
      isSelf: m.id === viewer.id,
      openTasks: open.length,
      overdue: overdue.length,
      completed: completed.length,
      total,
      completionRate: total ? round((completed.length / total) * 100, 0) : 0,
      effortHours: round(open.reduce((sum, t) => sum + (Number(t.effortHours) || 0), 0), 1),
      avgManagerRating: average(
        ratings.filter((r) => r.rater_role === 'MANAGER').map((r) => r.score),
      ),
      avgSeniorRating: average(
        ratings.filter((r) => r.rater_role === 'SENIOR_MANAGER').map((r) => r.score),
      ),
      ratingCount: ratings.length,
      currentFocus: open
        .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
        .slice(0, 3)
        .map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.dueDate })),
    };
  });

  return {
    scopeLabel:
      viewer.role === 'ADMIN'
        ? 'Organisation'
        : viewer.role === 'SENIOR_MANAGER'
          ? `${viewer.department_name} department`
          : `${viewer.full_name}’s team`,
    members: rows.sort((a, b) => b.openTasks - a.openTasks || a.fullName.localeCompare(b.fullName)),
    summary: {
      people: rows.length,
      open: rows.reduce((sum, r) => sum + r.openTasks, 0),
      overdue: rows.reduce((sum, r) => sum + r.overdue, 0),
      completed: rows.reduce((sum, r) => sum + r.completed, 0),
      avgCompletionRate: average(rows.map((r) => r.completionRate)) || 0,
    },
  };
}
