import { AppError, parseJson } from './util.js';
import {
  allUsers,
  departmentUsers,
  directReports,
  isDirectReportOf,
} from './repo.js';

export function taskScopeSql(user, alias = 't') {
  const groupClause = `EXISTS (
    SELECT 1 FROM group_members gm
    JOIN tasks gp ON gp.id = gm.task_id
    WHERE gm.user_id = ? AND (gp.id = ${alias}.id OR gp.id = ${alias}.parent_task_id)
  )`;

  if (user.role === 'ADMIN') {
    return { sql: '1 = 1', params: [] };
  }

  if (user.role === 'SENIOR_MANAGER') {
    return {
      sql: `(${alias}.department_id = ? OR ${alias}.assignee_id = ? OR ${alias}.created_by = ?
        OR ${alias}.senior_manager_id = ? OR ${alias}.manager_id = ? OR ${groupClause})`,
      params: [user.department_id, user.id, user.id, user.id, user.id, user.id],
    };
  }

  if (user.role === 'MANAGER') {
    return {
      sql: `(${alias}.manager_id = ? OR ${alias}.assignee_id = ? OR ${alias}.created_by = ?
        OR ${alias}.senior_manager_id = ? OR ${groupClause})`,
      params: [user.id, user.id, user.id, user.id, user.id],
    };
  }

  return {
    sql: `(${alias}.assignee_id = ? OR ${alias}.created_by = ? OR ${groupClause})`,
    params: [user.id, user.id, user.id],
  };
}

export function canViewTask(db, user, taskId) {
  if (!taskId) return false;
  const scope = taskScopeSql(user, 't');
  const row = db
    .prepare(`SELECT 1 AS ok FROM tasks t WHERE t.id = ? AND (${scope.sql})`)
    .get(taskId, ...scope.params);
  return Boolean(row);
}

export function isVisibleUser(user, target) {
  if (!target) return false;
  if (user.role === 'ADMIN') return true;
  if (target.id === user.id) return true;
  if (user.role === 'SENIOR_MANAGER') return target.department_id === user.department_id;
  if (user.role === 'MANAGER') {
    return target.manager_id === user.id || target.id === user.manager_id;
  }
  return target.manager_id === user.manager_id || target.id === user.manager_id;
}

export function visibleUsers(db, user) {
  if (user.role === 'ADMIN') return allUsers(db);
  if (user.role === 'SENIOR_MANAGER') return departmentUsers(db, user.department_id);
  if (user.role === 'MANAGER') {
    const self = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const reports = directReports(db, user.id);
    const manager = user.manager_id ? db.prepare('SELECT * FROM users WHERE id = ?').get(user.manager_id) : null;
    const seen = new Set();
    return [self, ...reports, manager].filter((u) => u && !seen.has(u.id) && seen.add(u.id));
  }
  return departmentUsers(db, user.department_id).filter(
    (u) => u.manager_id === user.manager_id || u.id === user.manager_id || u.id === user.id,
  );
}

export function assignableUsers(db, user) {
  if (user.role === 'EMPLOYEE') {
    return [user];
  }
  if (user.role === 'MANAGER') {
    return [user, ...directReports(db, user.id)];
  }
  if (user.role === 'SENIOR_MANAGER') {
    return departmentUsers(db, user.department_id).filter(
      (u) => ['EMPLOYEE', 'MANAGER'].includes(u.role),
    );
  }
  return [];
}

export function groupCandidates(db, user) {
  if (user.role === 'EMPLOYEE') {
    return departmentUsers(db, user.department_id).filter(
      (u) => u.role === 'EMPLOYEE' && u.manager_id === user.manager_id,
    );
  }
  if (user.role === 'MANAGER') {
    return [user, ...directReports(db, user.id)];
  }
  if (user.role === 'SENIOR_MANAGER') {
    return departmentUsers(db, user.department_id).filter(
      (u) => ['EMPLOYEE', 'MANAGER'].includes(u.role),
    );
  }
  return [];
}

export function canCreateTaskFor(user, assignee) {
  if (!assignee) return false;
  if (user.role === 'ADMIN') return false;
  if (user.role === 'EMPLOYEE') return assignee.id === user.id;
  if (user.role === 'MANAGER') {
    return assignee.id === user.id || assignee.manager_id === user.id;
  }
  if (user.role === 'SENIOR_MANAGER') {
    return assignee.department_id === user.department_id && ['EMPLOYEE', 'MANAGER'].includes(assignee.role);
  }
  return false;
}

export function assertCanViewTask(db, user, taskId) {
  if (!canViewTask(db, user, taskId)) {
    throw new AppError(403, 'You do not have access to this task');
  }
}

export function meetingParticipants(meeting) {
  return parseJson(meeting.participants, []);
}

export function canViewMeeting(db, user, meeting) {
  if (!meeting) return false;
  if (user.role === 'ADMIN') return true;
  if (meeting.created_by === user.id) return true;
  const participants = meetingParticipants(meeting);
  if (participants.includes(user.id)) return true;
  if (user.role === 'SENIOR_MANAGER' && meeting.department_id === user.department_id) return true;
  if (user.role === 'MANAGER') {
    if (isDirectReportOf(db, meeting.created_by, user.id)) return true;
    return participants.some((id) => isDirectReportOf(db, id, user.id));
  }
  return false;
}

export function canViewTranscript(db, user, meeting) {
  if (!meeting) return false;
  if (user.role === 'ADMIN') return true;
  if (meeting.created_by === user.id) return true;
  if (user.role === 'SENIOR_MANAGER' && meeting.department_id === user.department_id) return true;
  if (user.role === 'MANAGER') {
    if (isDirectReportOf(db, meeting.created_by, user.id)) return true;
    return meetingParticipants(meeting).some((id) => isDirectReportOf(db, id, user.id));
  }
  return false;
}

export function canProcessMeeting(db, user, meeting) {
  if (!meeting.transcript) return false;
  return canViewTranscript(db, user, meeting);
}

export function canCreateMeetingWith(db, user, participantIds) {
  const visible = new Set(visibleUsers(db, user).map((u) => u.id));
  return participantIds.every((id) => visible.has(id));
}
