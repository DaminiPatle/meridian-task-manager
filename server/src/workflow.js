import {
  AppError,
  addDays,
  assert,
  average,
  clamp,
  dateOnly,
  daysBetween,
  newId,
  now,
  parseJson,
  round,
  statusGroup,
  stringifyJson,
  today,
  userSafe,
} from './util.js';
import {
  canCreateTaskFor,
  canViewTask,
  groupCandidates,
  taskScopeSql,
} from './rbac.js';
import {
  departmentById,
  groupMembers,
  isGroupMemberOf,
  seniorManagers,
  userById,
} from './repo.js';
import { notify } from './notify.js';

export const STATUS = {
  PENDING_CREATION_APPROVAL: 'PENDING_CREATION_APPROVAL',
  CREATION_REJECTED: 'CREATION_REJECTED',
  ACTIVE: 'ACTIVE',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_MANAGER_REVIEW: 'PENDING_MANAGER_REVIEW',
  PENDING_SENIOR_REVIEW: 'PENDING_SENIOR_REVIEW',
  RETURNED_TO_MANAGER: 'RETURNED_TO_MANAGER',
  REWORK: 'REWORK',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const ALL_STATUSES = Object.values(STATUS);
export const OPEN_STATUSES = [
  STATUS.PENDING_CREATION_APPROVAL,
  STATUS.CREATION_REJECTED,
  STATUS.ACTIVE,
  STATUS.IN_PROGRESS,
  STATUS.PENDING_MANAGER_REVIEW,
  STATUS.PENDING_SENIOR_REVIEW,
  STATUS.RETURNED_TO_MANAGER,
  STATUS.REWORK,
];
const WORKABLE_STATUSES = [STATUS.ACTIVE, STATUS.IN_PROGRESS, STATUS.REWORK];

const USER_JOINS = `
  JOIN users ua ON ua.id = t.assignee_id
  JOIN users uc ON uc.id = t.created_by
  JOIN users um ON um.id = t.manager_id
  JOIN users us ON us.id = t.senior_manager_id
  LEFT JOIN departments d ON d.id = t.department_id
`;

const TASK_SELECT = `
  SELECT t.id, t.title, t.description, t.task_kind AS taskKind, t.group_mode AS groupMode,
    t.parent_task_id AS parentTaskId, t.status, t.priority,
    t.created_by AS createdBy, t.assignee_id AS assigneeId, t.department_id AS departmentId,
    t.manager_id AS managerId, t.senior_manager_id AS seniorManagerId,
    t.start_date AS startDate, t.due_date AS dueDate, t.original_due_date AS originalDueDate,
    t.completed_at AS completedAt, t.effort_hours AS effortHours, t.tags,
    t.created_at AS createdAt, t.updated_at AS updatedAt,
    ua.full_name AS assigneeName, ua.avatar_color AS assigneeColor, ua.role AS assigneeRole,
    ua.title AS assigneeTitle,
    uc.full_name AS creatorName, uc.avatar_color AS creatorColor, uc.role AS creatorRole,
    um.full_name AS managerName, um.avatar_color AS managerColor,
    us.full_name AS seniorManagerName, us.avatar_color AS seniorManagerColor,
    d.name AS departmentName,
    (SELECT COUNT(*) FROM tasks p WHERE p.parent_task_id = t.id) AS partCount,
    (SELECT COUNT(*) FROM tasks p WHERE p.parent_task_id = t.id AND p.status = 'COMPLETED') AS partCompleted,
    (SELECT COUNT(*) FROM extension_requests e WHERE e.task_id = t.id AND e.status IN ('PENDING_MANAGER','PENDING_SENIOR')) AS pendingExtensionCount,
    (SELECT e.id FROM extension_requests e WHERE e.task_id = t.id AND e.status IN ('PENDING_MANAGER','PENDING_SENIOR') ORDER BY e.created_at DESC LIMIT 1) AS pendingExtensionId,
    (SELECT e.status FROM extension_requests e WHERE e.task_id = t.id AND e.status IN ('PENDING_MANAGER','PENDING_SENIOR') ORDER BY e.created_at DESC LIMIT 1) AS pendingExtensionStatus,
    (SELECT COUNT(*) FROM ratings r WHERE r.task_id = t.id AND r.rater_role = 'MANAGER') AS hasManagerRating,
    (SELECT COUNT(*) FROM ratings r WHERE r.task_id = t.id AND r.rater_role = 'SENIOR_MANAGER') AS hasSeniorRating
  FROM tasks t
  ${USER_JOINS}
`;

export function getTaskRow(db, id) {
  return db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id);
}

export function addEvent(db, taskId, actorId, action, fromStatus, toStatus, comment = '', metadata = {}) {
  db.prepare(
    `INSERT INTO task_events (id, task_id, actor_id, action, from_status, to_status, comment, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId('evt_'),
    taskId,
    actorId,
    action,
    fromStatus || null,
    toStatus || null,
    comment || '',
    stringifyJson(metadata),
    now(),
  );
}

function requireComment(comment, action) {
  assert(comment && comment.trim().length >= 3, 400, `A comment is required when you ${action}`);
  return comment.trim();
}

function resolveApprovalChain(db, assignee) {
  assert(
    assignee && ['EMPLOYEE', 'MANAGER'].includes(assignee.role),
    422,
    'Workflow tasks can only be owned by employees and managers',
  );
  assert(assignee.is_active, 422, 'The assignee is not active');
  const department = departmentById(db, assignee.department_id);
  assert(department, 422, 'The assignee must belong to a department');

  const first = userById(db, assignee.manager_id);
  assert(first && first.is_active, 422, 'The assignee must have an active manager before work can be assigned');
  assert(
    ['MANAGER', 'SENIOR_MANAGER'].includes(first.role),
    422,
    'The first-level approver must be a manager or senior manager',
  );
  assert(first.id !== assignee.id, 422, 'A user cannot be their own first-level approver');

  let second = userById(db, department.senior_manager_id);
  const excluded = [first.id, assignee.id];
  if (!second || excluded.includes(second.id) || !second.is_active) {
    second = seniorManagers(db, excluded)[0] || null;
  }
  assert(
    second,
    422,
    'A distinct senior manager is required to complete the two-tier approval chain',
  );
  assert(second.id !== first.id, 422, 'The two approval levels must be different people');
  assert(second.id !== assignee.id, 422, 'A user cannot be their own final approver');

  return { managerId: first.id, seniorManagerId: second.id, departmentId: department.id };
}

export function createTask(db, actor, input) {
  assert(actor.role !== 'ADMIN', 403, 'Administrators manage the platform and cannot create workflow tasks');
  const assignee = userById(db, input.assigneeId);
  assert(assignee, 422, 'Assignee not found');
  assert(canCreateTaskFor(actor, assignee), 403, 'You cannot assign a task to this person');
  assert(
    !input.dueDate || String(input.dueDate).slice(0, 10) >= today(),
    400,
    'A new task cannot be given a due date in the past',
  );

  const title = String(input.title || '').trim();
  assert(title.length >= 3 && title.length <= 140, 400, 'Title must be between 3 and 140 characters');
  const description = String(input.description || '').trim();
  assert(description.length <= 5000, 400, 'Description is too long');
  const priority = input.priority || 'MEDIUM';
  assert(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority), 400, 'Invalid priority');
  const taskKind = input.taskKind === 'GROUP' ? 'GROUP' : 'STANDARD';
  const effortHours =
    input.effortHours == null || input.effortHours === '' ? null : Number(input.effortHours);
  assert(
    effortHours == null || (Number.isFinite(effortHours) && effortHours >= 0 && effortHours <= 1000),
    400,
    'Effort hours must be between 0 and 1000',
  );

  let members = [];
  let groupMode = null;
  if (taskKind === 'GROUP') {
    groupMode = input.groupMode;
    assert(['A', 'B'].includes(groupMode), 400, 'Group tasks must use mode A or mode B');
    assert(Array.isArray(input.members) && input.members.length >= 2, 400, 'A group needs at least two members');
    const ids = input.members.map((m) => (typeof m === 'string' ? m : m.userId));
    assert(new Set(ids).size === ids.length, 400, 'Group members must be unique');
    const leaderId = input.leaderId || assignee.id;
    assert(leaderId === assignee.id, 400, 'The group leader must be the task assignee');
    const allowed = new Set(groupCandidates(db, actor).map((u) => u.id));
    for (const id of ids) {
      const member = userById(db, id);
      assert(member && member.is_active, 422, 'A selected group member is unavailable');
      assert(allowed.has(id), 403, 'Group members must be within your team and scope');
      assert(member.department_id === assignee.department_id, 422, 'Group members must share the leader’s department');
      const validTeamLink =
        member.id === assignee.id ||
        member.manager_id === assignee.manager_id ||
        (assignee.role === 'MANAGER' && member.manager_id === assignee.id);
      assert(validTeamLink, 422, 'Group members must belong to the leader’s reporting team');
    }
    members = ids.map((id) => ({ userId: id, isLeader: id === leaderId }));
    assert(members.some((m) => m.isLeader), 400, 'A group leader is required');
  }

  const chain = resolveApprovalChain(db, assignee);
  const requiresCreationApproval = actor.id === assignee.id;
  const status = requiresCreationApproval ? STATUS.PENDING_CREATION_APPROVAL : STATUS.ACTIVE;
  const timestamp = now();
  const id = newId('tsk_');
  const dueDate = input.dueDate ? String(input.dueDate).slice(0, 10) : addDays(today(), 7);

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `INSERT INTO tasks (id, title, description, task_kind, group_mode, parent_task_id, status, priority,
        created_by, assignee_id, department_id, manager_id, senior_manager_id, start_date, due_date,
        original_due_date, completed_at, effort_hours, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
    ).run(
      id,
      title,
      description,
      taskKind,
      groupMode,
      status,
      priority,
      actor.id,
      assignee.id,
      chain.departmentId,
      chain.managerId,
      chain.seniorManagerId,
      input.startDate ? String(input.startDate).slice(0, 10) : null,
      dueDate,
      dueDate,
      effortHours,
      stringifyJson(Array.isArray(input.tags) ? input.tags.slice(0, 8) : []),
      timestamp,
      timestamp,
    );

    for (const member of members) {
      db.prepare(
        'INSERT INTO group_members (task_id, user_id, is_leader, added_at) VALUES (?, ?, ?, ?)',
      ).run(id, member.userId, member.isLeader ? 1 : 0, timestamp);
    }

    addEvent(db, id, actor.id, 'created', null, status, '', {
      requiresCreationApproval,
      taskKind,
      groupMode,
      leaderId: taskKind === 'GROUP' ? assignee.id : null,
    });

    if (requiresCreationApproval) {
      notify(db, {
        userId: chain.managerId,
        type: 'APPROVAL_REQUEST',
        title: 'New self-created task needs your approval',
        body: `${actor.full_name} submitted “${title}” for activation approval.`,
        taskId: id,
      });
    }

    if (status === STATUS.ACTIVE) {
      if (taskKind === 'GROUP') {
        ensureGroupParts(db, getTaskRow(db, id), actor.id);
      }
      if (actor.id !== assignee.id) {
        notify(db, {
          userId: assignee.id,
          type: 'TASK_ASSIGNED',
          title: 'A new task was assigned to you',
          body: `${actor.full_name} assigned “${title}”.`,
          taskId: id,
        });
      }
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getTaskDetail(db, actor, id);
}

export function ensureGroupParts(db, group, actorId = null) {
  if (!group || group.taskKind !== 'GROUP') return 0;
  if (![STATUS.ACTIVE, STATUS.IN_PROGRESS, STATUS.REWORK].includes(group.status)) return 0;
  const members = groupMembers(db, group.id);
  const existing = db
    .prepare('SELECT assignee_id FROM tasks WHERE parent_task_id = ?')
    .all(group.id)
    .map((r) => r.assignee_id);
  let created = 0;
  for (const member of members) {
    if (existing.includes(member.user_id)) continue;
    const memberUser = userById(db, member.user_id);
    if (!memberUser) continue;
    const partId = newId('tsk_');
    const timestamp = now();
    db.prepare(
      `INSERT INTO tasks (id, title, description, task_kind, group_mode, parent_task_id, status, priority,
        created_by, assignee_id, department_id, manager_id, senior_manager_id, start_date, due_date,
        original_due_date, completed_at, effort_hours, tags, created_at, updated_at)
       VALUES (?, ?, ?, 'GROUP_PART', NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, '[]', ?, ?)`,
    ).run(
      partId,
      `${group.title} — ${memberUser.full_name}`,
      `Individual contribution for the group task “${group.title}”.${group.groupMode === 'B' ? ' This contribution is tracked but is not mandatory for group completion.' : ''}`,
      group.id,
      STATUS.ACTIVE,
      group.priority,
      group.createdBy,
      member.user_id,
      group.departmentId,
      group.managerId,
      group.seniorManagerId,
      group.dueDate,
      group.dueDate,
      timestamp,
      timestamp,
    );
    addEvent(db, partId, group.createdBy, 'created', null, STATUS.ACTIVE, '', {
      generatedFromGroup: group.id,
      member: memberUser.full_name,
    });
    notify(db, {
      userId: member.user_id,
      type: 'GROUP_UPDATE',
      title: member.is_leader ? 'You lead a new group task' : 'You were added to a group task',
      body: `Your contribution task for “${group.title}” is ready.`,
      taskId: group.id,
    });
    existing.push(member.user_id);
    created += 1;
  }
  if (created > 0) {
    addEvent(db, group.id, actorId || group.createdBy, 'group_parts_created', group.status, group.status, '', {
      count: created,
    });
  }
  return created;
}

export function groupReadiness(db, task) {
  if (task.taskKind !== 'GROUP') return null;
  const parts = db
    .prepare('SELECT status FROM tasks WHERE parent_task_id = ?')
    .all(task.id);
  const mandatory = task.groupMode === 'A' ? parts : [];
  const completed = mandatory.filter((p) => p.status === STATUS.COMPLETED).length;
  return {
    mode: task.groupMode,
    mandatoryCount: mandatory.length,
    completedMandatory: completed,
    totalParts: parts.length,
    completedParts: parts.filter((p) => p.status === STATUS.COMPLETED).length,
    ready: task.groupMode === 'B' ? true : mandatory.length > 0 && completed === mandatory.length,
    reason:
      task.groupMode === 'A' && completed !== mandatory.length
        ? `All ${mandatory.length} individual contributions must complete before the consolidated submission can start.`
        : null,
  };
}

function assertStatus(task, statuses, message) {
  const list = Array.isArray(statuses) ? statuses : [statuses];
  if (!list.includes(task.status)) {
    throw new AppError(409, message || `This action is not available while the task is ${task.status}`);
  }
}

function assertLevelActor(task, actor, level) {
  assert(actor.id !== task.assigneeId, 403, 'You cannot approve or review a task assigned to you');
  if (level === 'manager') {
    assert(task.managerId === actor.id, 403, 'Only the assigned first-level manager can perform this action');
  }
  if (level === 'senior') {
    assert(task.seniorManagerId === actor.id, 403, 'Only the assigned senior manager can perform this action');
  }
}

function notifyGroupMembers(db, task, title, body) {
  if (task.taskKind === 'GROUP') {
    for (const member of groupMembers(db, task.id)) {
      notify(db, { userId: member.user_id, type: 'GROUP_UPDATE', title, body, taskId: task.id });
    }
  }
}

export function updateTask(db, actor, taskId, input) {
  const row = getTaskRow(db, taskId);
  assert(row, 404, 'Task not found');
  assert(canViewTask(db, actor, taskId), 403, 'You do not have access to this task');
  assert(
    [STATUS.ACTIVE, STATUS.IN_PROGRESS, STATUS.REWORK, STATUS.CREATION_REJECTED].includes(row.status),
    409,
    'This task can no longer be edited',
  );
  const allowed =
    actor.id === row.createdBy || actor.id === row.assigneeId || actor.id === row.managerId;
  assert(allowed, 403, 'You are not allowed to edit this task');
  assert(input.dueDate === undefined, 403, 'Due dates can only be changed through the extension workflow');

  const updates = [];
  const values = [];
  if (input.title !== undefined) {
    const title = String(input.title).trim();
    assert(title.length >= 3 && title.length <= 140, 400, 'Title must be between 3 and 140 characters');
    updates.push('title = ?');
    values.push(title);
  }
  if (input.description !== undefined) {
    const description = String(input.description).trim();
    assert(description.length <= 5000, 400, 'Description is too long');
    updates.push('description = ?');
    values.push(description);
  }
  if (input.priority !== undefined) {
    assert(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(input.priority), 400, 'Invalid priority');
    updates.push('priority = ?');
    values.push(input.priority);
  }
  if (input.effortHours !== undefined) {
    const hours = input.effortHours == null || input.effortHours === '' ? null : Number(input.effortHours);
    assert(hours == null || (Number.isFinite(hours) && hours >= 0 && hours <= 1000), 400, 'Invalid effort hours');
    updates.push('effort_hours = ?');
    values.push(hours);
  }
  if (input.startDate !== undefined) {
    updates.push('start_date = ?');
    values.push(input.startDate ? String(input.startDate).slice(0, 10) : null);
  }
  if (input.tags !== undefined) {
    assert(Array.isArray(input.tags), 400, 'Tags must be a list');
    updates.push('tags = ?');
    values.push(stringifyJson(input.tags.slice(0, 8)));
  }
  assert(updates.length > 0, 400, 'No changes supplied');

  updates.push('updated_at = ?');
  values.push(now(), taskId);
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  addEvent(db, taskId, actor.id, 'updated', row.status, row.status, '', {
    fields: Object.keys(input).filter((k) => k !== 'dueDate'),
  });
  return getTaskDetail(db, actor, taskId);
}

export function applyTaskAction(db, actor, taskId, { action, comment = '' }) {
  const row = getTaskRow(db, taskId);
  assert(row, 404, 'Task not found');
  assert(canViewTask(db, actor, taskId), 403, 'You do not have access to this task');
  const actorIsAssignee = actor.id === row.assigneeId;
  let nextStatus = row.status;
  let eventAction = action;
  let eventComment = comment || '';

  switch (action) {
    case 'start': {
      assert(actorIsAssignee, 403, 'Only the assignee can start this task');
      assertStatus(row, STATUS.ACTIVE, 'Only active tasks can be started');
      nextStatus = STATUS.IN_PROGRESS;
      break;
    }

    case 'approve_creation': {
      assertStatus(row, STATUS.PENDING_CREATION_APPROVAL, 'This task is not awaiting activation approval');
      assertLevelActor(row, actor, 'manager');
      nextStatus = STATUS.ACTIVE;
      break;
    }

    case 'reject_creation': {
      assertStatus(row, STATUS.PENDING_CREATION_APPROVAL, 'This task is not awaiting activation approval');
      assertLevelActor(row, actor, 'manager');
      eventComment = requireComment(comment, 'reject a task');
      nextStatus = STATUS.CREATION_REJECTED;
      break;
    }

    case 'resubmit_creation': {
      assert(actor.id === row.createdBy, 403, 'Only the creator can resubmit this task');
      assertStatus(row, STATUS.CREATION_REJECTED, 'This task is not awaiting a resubmission');
      nextStatus = STATUS.PENDING_CREATION_APPROVAL;
      break;
    }

    case 'submit_completion': {
      assert(actorIsAssignee, 403, 'Only the assignee can submit this task');
      assertStatus(row, WORKABLE_STATUSES, 'This task cannot be submitted from its current state');
      if (row.taskKind === 'GROUP') {
        ensureGroupParts(db, row, actor.id);
        const readiness = groupReadiness(db, getTaskRow(db, taskId));
        if (!readiness.ready) {
          throw new AppError(409, readiness.reason || 'The group is not ready for consolidated submission', readiness);
        }
      }
      nextStatus = STATUS.PENDING_MANAGER_REVIEW;
      break;
    }

    case 'manager_approve': {
      assertStatus(row, STATUS.PENDING_MANAGER_REVIEW, 'This task is not awaiting manager review');
      assertLevelActor(row, actor, 'manager');
      nextStatus = STATUS.PENDING_SENIOR_REVIEW;
      break;
    }

    case 'manager_reject': {
      assertStatus(row, STATUS.PENDING_MANAGER_REVIEW, 'This task is not awaiting manager review');
      assertLevelActor(row, actor, 'manager');
      eventComment = requireComment(comment, 'reject a submission');
      nextStatus = STATUS.REWORK;
      break;
    }

    case 'senior_approve': {
      assertStatus(row, STATUS.PENDING_SENIOR_REVIEW, 'This task is not awaiting final approval');
      assertLevelActor(row, actor, 'senior');
      nextStatus = STATUS.COMPLETED;
      break;
    }

    case 'senior_reject': {
      assertStatus(row, STATUS.PENDING_SENIOR_REVIEW, 'This task is not awaiting final approval');
      assertLevelActor(row, actor, 'senior');
      eventComment = requireComment(comment, 'return a task to the manager');
      nextStatus = STATUS.RETURNED_TO_MANAGER;
      break;
    }

    case 'request_corrections': {
      assertStatus(row, STATUS.RETURNED_TO_MANAGER, 'This task is not awaiting a manager decision');
      assertLevelActor(row, actor, 'manager');
      eventComment = requireComment(comment, 'request corrections');
      nextStatus = STATUS.REWORK;
      break;
    }

    case 'resubmit_to_senior': {
      assertStatus(row, STATUS.RETURNED_TO_MANAGER, 'This task is not awaiting a manager decision');
      assertLevelActor(row, actor, 'manager');
      eventComment = comment?.trim() || 'Manager chose to resubmit the same work to the senior manager.';
      nextStatus = STATUS.PENDING_SENIOR_REVIEW;
      break;
    }

    case 'cancel': {
      assert(row.status !== STATUS.COMPLETED && row.status !== STATUS.CANCELLED, 409, 'This task is already closed');
      assert(
        actor.id === row.createdBy || actor.id === row.managerId,
        403,
        'Only the creator or the assigned manager can cancel this task',
      );
      eventComment = requireComment(comment, 'cancel a task');
      nextStatus = STATUS.CANCELLED;
      break;
    }

    default:
      throw new AppError(400, 'Unknown task action');
  }

  const timestamp = now();
  db.exec('BEGIN IMMEDIATE');
  try {
    const fields = ['status = ?', 'updated_at = ?'];
    const values = [nextStatus, timestamp];
    if (nextStatus === STATUS.COMPLETED) {
      fields.push('completed_at = ?');
      values.push(timestamp);
    }
    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values, taskId);
    addEvent(db, taskId, actor.id, eventAction, row.status, nextStatus, eventComment, {});
    sendTransitionNotifications(db, { ...row, status: nextStatus }, actor, eventAction, eventComment);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getTaskDetail(db, actor, taskId);
}

function sendTransitionNotifications(db, task, actor, action, comment) {
  const link = { taskId: task.id };
  const title = task.title;
  switch (action) {
    case 'start':
      notify(db, {
        userId: task.managerId,
        type: 'STATUS_UPDATE',
        title: 'Work has started',
        body: `${task.assigneeName} started “${title}”.`,
        ...link,
      });
      break;
    case 'approve_creation':
      notify(db, {
        userId: task.assigneeId,
        type: 'TASK_APPROVED',
        title: 'Task activated',
        body: `“${title}” was approved by ${actor.full_name} and is now active.`,
        ...link,
      });
      if (task.taskKind === 'GROUP') notifyGroupMembers(db, task, 'Group task activated', `“${title}” is now active.`);
      break;
    case 'reject_creation':
      notify(db, {
        userId: task.createdBy,
        type: 'TASK_REJECTED',
        title: 'Task activation rejected',
        body: `${actor.full_name} returned “${title}”: ${comment}`,
        ...link,
      });
      break;
    case 'resubmit_creation':
      notify(db, {
        userId: task.managerId,
        type: 'APPROVAL_REQUEST',
        title: 'Revised task needs activation approval',
        body: `“${title}” was resubmitted by ${actor.full_name}.`,
        ...link,
      });
      break;
    case 'submit_completion':
      notify(db, {
        userId: task.managerId,
        type: 'APPROVAL_REQUEST',
        title: 'Completion submitted for your review',
        body: `${actor.full_name} submitted “${title}” for first-level approval.`,
        ...link,
      });
      break;
    case 'manager_approve':
      notify(db, {
        userId: task.seniorManagerId,
        type: 'APPROVAL_REQUEST',
        title: 'Final approval required',
        body: `“${title}” passed manager review and now needs your final approval.`,
        ...link,
      });
      notify(db, {
        userId: task.assigneeId,
        type: 'STATUS_UPDATE',
        title: 'Manager approved your submission',
        body: `“${title}” is now awaiting senior manager approval.`,
        ...link,
      });
      break;
    case 'manager_reject':
      notify(db, {
        userId: task.assigneeId,
        type: 'REWORK_REQUESTED',
        title: 'Changes requested on your submission',
        body: `${actor.full_name} returned “${title}” for rework: ${comment}`,
        ...link,
      });
      break;
    case 'senior_approve':
      notify(db, {
        userId: task.assigneeId,
        type: 'TASK_COMPLETED',
        title: 'Task completed',
        body: `“${title}” received final approval from ${actor.full_name}.`,
        ...link,
      });
      notify(db, {
        userId: task.managerId,
        type: 'TASK_COMPLETED',
        title: 'Final approval recorded',
        body: `“${title}” is complete. Your independent rating is now due.`,
        ...link,
      });
      if (task.pendingExtensionId) {
        // Defensive: completion closes any stale extension review.
        db.prepare("UPDATE extension_requests SET status = 'CANCELLED' WHERE task_id = ? AND status IN ('PENDING_MANAGER','PENDING_SENIOR')").run(task.id);
      }
      break;
    case 'senior_reject':
      notify(db, {
        userId: task.managerId,
        type: 'RETURNED_TO_MANAGER',
        title: 'Senior manager returned a submission',
        body: `“${title}” was returned to you: ${comment}. Decide whether to request corrections or resubmit.`,
        ...link,
      });
      break;
    case 'request_corrections':
      notify(db, {
        userId: task.assigneeId,
        type: 'REWORK_REQUESTED',
        title: 'Corrections requested',
        body: `${actor.full_name} asked for corrections on “${title}”: ${comment}`,
        ...link,
      });
      break;
    case 'resubmit_to_senior':
      notify(db, {
        userId: task.seniorManagerId,
        type: 'APPROVAL_REQUEST',
        title: 'Submission resubmitted for final approval',
        body: `${actor.full_name} resubmitted “${title}” without requesting employee changes.`,
        ...link,
      });
      break;
    case 'cancel':
      notify(db, {
        userId: task.assigneeId,
        type: 'STATUS_UPDATE',
        title: 'Task cancelled',
        body: `“${title}” was cancelled by ${actor.full_name}: ${comment}`,
        ...link,
      });
      break;
    default:
      break;
  }
}

export function requestExtension(db, actor, taskId, { requestedDueDate, reason }) {
  const row = getTaskRow(db, taskId);
  assert(row, 404, 'Task not found');
  assert(canViewTask(db, actor, taskId), 403, 'You do not have access to this task');
  assert(actor.id === row.assigneeId, 403, 'Only the task assignee can request an extension');
  assert(WORKABLE_STATUSES.includes(row.status), 409, 'Extensions can only be requested while you are working on the task');
  assert(row.dueDate, 409, 'This task does not have a due date');
  const requested = dateOnly(requestedDueDate);
  assert(requested && requested > row.dueDate, 400, 'The requested date must be later than the current due date');
  assert(reason && reason.trim().length >= 5, 400, 'Please provide a reason for the extension');
  const pending = db
    .prepare("SELECT 1 FROM extension_requests WHERE task_id = ? AND status IN ('PENDING_MANAGER','PENDING_SENIOR')")
    .get(taskId);
  assert(!pending, 409, 'An extension request is already in review for this task');

  const id = newId('ext_');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `INSERT INTO extension_requests (id, task_id, requested_by, current_due_date, requested_due_date, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING_MANAGER', ?)`,
    ).run(id, taskId, actor.id, row.dueDate, requested, reason.trim(), now());
    addEvent(db, taskId, actor.id, 'extension_requested', row.status, row.status, reason.trim(), {
      extensionId: id,
      currentDueDate: row.dueDate,
      requestedDueDate: requested,
    });
    notify(db, {
      userId: row.managerId,
      type: 'EXTENSION_REQUEST',
      title: 'Timeline extension requested',
      body: `${actor.full_name} requested ${requested} for “${row.title}”.`,
      taskId,
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getExtension(db, id);
}

export function getExtension(db, id) {
  return db
    .prepare(
      `SELECT e.*, requester.full_name AS requesterName, requester.avatar_color AS requesterColor,
        decider.full_name AS decidedByName, t.title AS taskTitle, t.status AS taskStatus,
        t.due_date AS taskDueDate, t.assignee_id AS taskAssigneeId, t.manager_id AS taskManagerId,
        t.senior_manager_id AS taskSeniorManagerId
       FROM extension_requests e
       JOIN tasks t ON t.id = e.task_id
       JOIN users requester ON requester.id = e.requested_by
       LEFT JOIN users decider ON decider.id = e.decided_by
       WHERE e.id = ?`,
    )
    .get(id);
}

export function decideExtension(db, actor, extensionId, { decision, comment = '' }) {
  const ext = getExtension(db, extensionId);
  assert(ext, 404, 'Extension request not found');
  const task = getTaskRow(db, ext.task_id);
  assert(canViewTask(db, actor, ext.task_id), 403, 'You do not have access to this task');
  assert(actor.id !== ext.taskAssigneeId, 403, 'You cannot decide on your own extension request');
  assert(['approve', 'reject'].includes(decision), 400, 'Decision must be approve or reject');
  const trimmed = comment?.trim() || '';
  if (decision === 'reject') assert(trimmed.length >= 3, 400, 'A comment is required to reject an extension');

  let next = ext.status;
  if (ext.status === 'PENDING_MANAGER') {
    assert(actor.id === ext.taskManagerId, 403, 'Only the first-level manager can decide this extension');
    next = decision === 'approve' ? 'PENDING_SENIOR' : 'REJECTED';
  } else if (ext.status === 'PENDING_SENIOR') {
    assert(actor.id === ext.taskSeniorManagerId, 403, 'Only the senior manager can make the final extension decision');
    next = decision === 'approve' ? 'APPROVED' : 'REJECTED';
  } else {
    throw new AppError(409, 'This extension request has already been decided');
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const columns = [`status = ?`];
    const values = [next];
    if (ext.status === 'PENDING_MANAGER') {
      columns.push('manager_comment = ?');
      values.push(trimmed);
    } else {
      columns.push('senior_comment = ?');
      values.push(trimmed);
    }
    if (['APPROVED', 'REJECTED'].includes(next)) {
      columns.push('decided_by = ?', 'decided_at = ?');
      values.push(actor.id, now());
    }
    db.prepare(`UPDATE extension_requests SET ${columns.join(', ')} WHERE id = ?`).run(...values, ext.id);

    if (next === 'APPROVED') {
      db.prepare('UPDATE tasks SET due_date = ?, updated_at = ? WHERE id = ?').run(
        ext.requested_due_date,
        now(),
        ext.task_id,
      );
      addEvent(db, ext.task_id, actor.id, 'extension_approved', task.status, task.status, trimmed, {
        extensionId: ext.id,
        previousDueDate: ext.current_due_date,
        newDueDate: ext.requested_due_date,
      });
      notify(db, {
        userId: ext.requested_by,
        type: 'EXTENSION_DECISION',
        title: 'Extension approved',
        body: `The due date for “${task.title}” is now ${ext.requested_due_date}.`,
        taskId: ext.task_id,
      });
    } else if (next === 'PENDING_SENIOR') {
      addEvent(db, ext.task_id, actor.id, 'extension_manager_approved', task.status, task.status, trimmed, {
        extensionId: ext.id,
        requestedDueDate: ext.requested_due_date,
      });
      notify(db, {
        userId: ext.taskSeniorManagerId,
        type: 'EXTENSION_REQUEST',
        title: 'Extension needs final approval',
        body: `${actor.full_name} approved the extension for “${task.title}”. Final approval is required.`,
        taskId: ext.task_id,
      });
    } else {
      addEvent(db, ext.task_id, actor.id, 'extension_rejected', task.status, task.status, trimmed, {
        extensionId: ext.id,
      });
      notify(db, {
        userId: ext.requested_by,
        type: 'EXTENSION_DECISION',
        title: 'Extension rejected',
        body: `Your extension request for “${task.title}” was rejected: ${trimmed}`,
        taskId: ext.task_id,
      });
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getExtension(db, extensionId);
}

export function addComment(db, actor, taskId, body) {
  const row = getTaskRow(db, taskId);
  assert(row, 404, 'Task not found');
  assert(canViewTask(db, actor, taskId), 403, 'You do not have access to this task');
  const text = String(body || '').trim();
  assert(text.length >= 1 && text.length <= 2000, 400, 'Comment must be between 1 and 2000 characters');
  const id = newId('cmt_');
  db.prepare(
    'INSERT INTO task_comments (id, task_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, taskId, actor.id, text, now());
  const recipients = new Set([row.assigneeId, row.managerId]);
  if (row.taskKind === 'GROUP') {
    for (const m of groupMembers(db, row.id)) recipients.add(m.user_id);
  }
  recipients.delete(actor.id);
  for (const userId of recipients) {
    notify(db, {
      userId,
      type: 'COMMENT',
      title: 'New comment on a task',
      body: `${actor.full_name} commented on “${row.title}”.`,
      taskId,
    });
  }
  return db
    .prepare(
      `SELECT c.*, u.full_name AS authorName, u.avatar_color AS authorColor, u.role AS authorRole
       FROM task_comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`,
    )
    .get(id);
}

export function addRating(db, actor, taskId, { score, remarks }) {
  const row = getTaskRow(db, taskId);
  assert(row, 404, 'Task not found');
  assert(canViewTask(db, actor, taskId), 403, 'You do not have access to this task');
  assert(row.status === STATUS.COMPLETED, 409, 'Ratings are only available after a task is completed');
  assert(actor.id !== row.assigneeId, 403, 'You cannot rate your own task');
  const numeric = Number(score);
  assert(Number.isInteger(numeric) && numeric >= 1 && numeric <= 5, 400, 'Rating must be a whole number from 1 to 5');
  const text = String(remarks || '').trim();
  assert(text.length >= 3 && text.length <= 2000, 400, 'Remarks must be between 3 and 2000 characters');

  let raterRole = null;
  if (actor.id === row.managerId) raterRole = 'MANAGER';
  else if (actor.id === row.seniorManagerId) raterRole = 'SENIOR_MANAGER';
  assert(raterRole, 403, 'Only the assigned manager or senior manager can rate this task');

  const existing = db
    .prepare('SELECT * FROM ratings WHERE task_id = ? AND rater_role = ?')
    .get(taskId, raterRole);
  const timestamp = now();
  if (existing) {
    db.prepare('UPDATE ratings SET score = ?, remarks = ?, updated_at = ?, rater_id = ? WHERE id = ?').run(
      numeric,
      text,
      timestamp,
      actor.id,
      existing.id,
    );
    addEvent(db, taskId, actor.id, 'rating_updated', row.status, row.status, text, {
      score: numeric,
      raterRole,
    });
  } else {
    db.prepare(
      `INSERT INTO ratings (id, task_id, rater_id, rater_role, score, remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId('rat_'), taskId, actor.id, raterRole, numeric, text, timestamp, timestamp);
    addEvent(db, taskId, actor.id, 'rating_submitted', row.status, row.status, text, {
      score: numeric,
      raterRole,
    });
  }
  notify(db, {
    userId: row.assigneeId,
    type: 'RATING_RECEIVED',
    title: `New ${raterRole === 'MANAGER' ? 'manager' : 'senior manager'} rating`,
    body: `${actor.full_name} rated “${row.title}” ${numeric}/5.`,
    taskId,
  });
  return getRatings(db, taskId);
}

export function getRatings(db, taskId) {
  return db
    .prepare(
      `SELECT r.*, u.full_name AS raterName, u.avatar_color AS raterColor, u.title AS raterTitle
       FROM ratings r JOIN users u ON u.id = r.rater_id
       WHERE r.task_id = ? ORDER BY CASE r.rater_role WHEN 'MANAGER' THEN 1 ELSE 2 END`,
    )
    .all(taskId)
    .map((r) => ({
      id: r.id,
      taskId: r.task_id,
      raterId: r.rater_id,
      raterName: r.raterName,
      raterColor: r.raterColor,
      raterTitle: r.raterTitle,
      raterRole: r.rater_role,
      score: r.score,
      remarks: r.remarks,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
}

function mapTaskRow(row) {
  if (!row) return null;
  const partCount = Number(row.partCount || 0);
  const partCompleted = Number(row.partCompleted || 0);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    taskKind: row.taskKind,
    groupMode: row.groupMode,
    parentTaskId: row.parentTaskId,
    status: row.status,
    statusGroup: statusGroup(row.status),
    priority: row.priority,
    createdBy: row.createdBy,
    creatorName: row.creatorName,
    creatorColor: row.creatorColor,
    creatorRole: row.creatorRole,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeName,
    assigneeColor: row.assigneeColor,
    assigneeRole: row.assigneeRole,
    assigneeTitle: row.assigneeTitle,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    managerId: row.managerId,
    managerName: row.managerName,
    managerColor: row.managerColor,
    seniorManagerId: row.seniorManagerId,
    seniorManagerName: row.seniorManagerName,
    seniorManagerColor: row.seniorManagerColor,
    startDate: row.startDate,
    dueDate: row.dueDate,
    originalDueDate: row.originalDueDate,
    completedAt: row.completedAt,
    effortHours: row.effortHours,
    tags: parseJson(row.tags, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    partCount,
    partCompleted,
    groupProgress: partCount > 0 ? Math.round((partCompleted / partCount) * 100) : null,
    pendingExtensionCount: Number(row.pendingExtensionCount || 0),
    pendingExtensionId: row.pendingExtensionId,
    pendingExtensionStatus: row.pendingExtensionStatus,
    hasManagerRating: Number(row.hasManagerRating || 0) > 0,
    hasSeniorRating: Number(row.hasSeniorRating || 0) > 0,
    source: row.createdBy === row.assigneeId ? 'SELF' : 'ASSIGNED',
  };
}

function quickAction(task, user) {
  if (task.status === STATUS.PENDING_CREATION_APPROVAL && task.managerId === user.id) return 'Approve activation';
  if (task.status === STATUS.PENDING_MANAGER_REVIEW && task.managerId === user.id) return 'Review completion';
  if (task.status === STATUS.PENDING_SENIOR_REVIEW && task.seniorManagerId === user.id) return 'Final approval';
  if (task.status === STATUS.RETURNED_TO_MANAGER && task.managerId === user.id) return 'Decide next step';
  if (task.status === STATUS.CREATION_REJECTED && task.assigneeId === user.id) return 'Revise and resubmit';
  if (task.status === STATUS.REWORK && task.assigneeId === user.id) return 'Submit rework';
  if (task.pendingExtensionStatus === 'PENDING_MANAGER' && task.managerId === user.id) return 'Extension review';
  if (task.pendingExtensionStatus === 'PENDING_SENIOR' && task.seniorManagerId === user.id) return 'Extension final approval';
  if (task.status === STATUS.ACTIVE && task.assigneeId === user.id) return 'Start work';
  return null;
}

export function listTasks(db, user, filters = {}) {
  const scope = taskScopeSql(user, 't');
  const where = [scope.sql];
  const params = [...scope.params];

  if (filters.scope === 'mine') {
    where.push('t.assignee_id = ?');
    params.push(user.id);
  } else if (filters.scope === 'created') {
    where.push('t.created_by = ?');
    params.push(user.id);
  } else if (filters.scope === 'team') {
    if (user.role === 'MANAGER') {
      where.push('t.manager_id = ?');
      params.push(user.id);
    } else if (user.role === 'SENIOR_MANAGER') {
      where.push('t.department_id = ?');
      params.push(user.department_id);
    }
  }

  if (filters.assigneeId) {
    where.push('t.assignee_id = ?');
    params.push(filters.assigneeId);
  }
  if (filters.approverId && filters.approverField === 'manager') {
    where.push('t.manager_id = ?');
    params.push(filters.approverId);
  }
  if (filters.approverId && filters.approverField === 'senior') {
    where.push('t.senior_manager_id = ?');
    params.push(filters.approverId);
  }
  if (filters.taskKind) {
    if (filters.taskKind === 'GROUP') where.push("t.task_kind IN ('GROUP','GROUP_PART')");
    else {
      where.push('t.task_kind = ?');
      params.push(filters.taskKind);
    }
  }
  if (filters.parentTaskId) {
    where.push('t.parent_task_id = ?');
    params.push(filters.parentTaskId);
  }
  if (filters.status) {
    const statuses = String(filters.status)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => ALL_STATUSES.includes(s));
    if (statuses.length) {
      where.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
  }
  if (filters.priority) {
    where.push('t.priority = ?');
    params.push(filters.priority);
  }
  if (filters.q) {
    where.push('(lower(t.title) LIKE ? OR lower(t.description) LIKE ?)');
    const like = `%${String(filters.q).toLowerCase()}%`;
    params.push(like, like);
  }
  if (filters.due === 'overdue') {
    where.push("t.due_date IS NOT NULL AND t.due_date < date('now') AND t.status NOT IN ('COMPLETED','CANCELLED')");
  } else if (filters.due === 'soon') {
    where.push("t.due_date IS NOT NULL AND t.due_date >= date('now') AND t.due_date <= date('now','+3 day') AND t.status NOT IN ('COMPLETED','CANCELLED')");
  }

  const rows = db
    .prepare(
      `${TASK_SELECT} WHERE ${where.join(' AND ')}
       ORDER BY
         CASE WHEN t.status IN ('PENDING_CREATION_APPROVAL','PENDING_MANAGER_REVIEW','PENDING_SENIOR_REVIEW','RETURNED_TO_MANAGER','REWORK','CREATION_REJECTED') THEN 0 ELSE 1 END,
         CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
         t.due_date ASC, t.updated_at DESC
       LIMIT 400`,
    )
    .all(...params);

  return rows.map((row) => {
    const task = mapTaskRow(row);
    const actionLabel = quickAction(task, user);
    return {
      ...task,
      needsMyAction: Boolean(actionLabel),
      myActionLabel: actionLabel,
      dueRisk: computeDueRisk(task),
    };
  });
}

export function computeDueRisk(task) {
  if (!task.dueDate || [STATUS.COMPLETED, STATUS.CANCELLED].includes(task.status)) return null;
  const diff = Math.ceil(
    (new Date(`${task.dueDate}T23:59:59Z`).getTime() - Date.now()) / 86400000,
  );
  let score = 10;
  const reasons = [];
  if (diff < 0) {
    score = 90 + Math.min(10, Math.abs(diff));
    reasons.push(`Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`);
  } else if (diff === 0) {
    score = 82;
    reasons.push('Due today');
  } else if (diff === 1) {
    score = 72;
    reasons.push('Due tomorrow');
  } else if (diff <= 3) {
    score = 58;
    reasons.push(`Due in ${diff} days`);
  } else if (diff <= 7) {
    score = 38;
    reasons.push(`Due in ${diff} days`);
  } else {
    score = 16;
    reasons.push(`Due in ${diff} days`);
  }
  if (task.priority === 'CRITICAL') {
    score += 14;
    reasons.push('Critical priority');
  } else if (task.priority === 'HIGH') score += 8;
  if (task.status === STATUS.REWORK) {
    score += 8;
    reasons.push('Rework in progress');
  }
  if (task.status === STATUS.RETURNED_TO_MANAGER) {
    score += 10;
    reasons.push('Awaiting manager decision');
  }
  const level = score >= 75 ? 'CRITICAL' : score >= 55 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
  return { daysLeft: diff, score: clamp(Math.round(score), 0, 100), level, reasons };
}

export function computePermissions(db, user, task, extras = {}) {
  const parts = extras.parts || [];
  const ratings = extras.ratings || [];
  const pendingExtension = extras.pendingExtension || null;
  const isAssignee = user.id === task.assigneeId;
  const isManager = user.id === task.managerId;
  const isSenior = user.id === task.seniorManagerId;
  const isCreator = user.id === task.createdBy;
  const readiness = task.taskKind === 'GROUP' ? groupReadiness(db, task) : null;
  const isGroupMember =
    task.taskKind === 'GROUP'
      ? isGroupMemberOf(db, user.id, task.id)
      : task.parentTaskId
        ? isGroupMemberOf(db, user.id, task.parentTaskId)
        : false;
  const activeWork = WORKABLE_STATUSES.includes(task.status);
  const hasManagerRating = ratings.some((r) => r.raterRole === 'MANAGER') || task.hasManagerRating;
  const hasSeniorRating = ratings.some((r) => r.raterRole === 'SENIOR_MANAGER') || task.hasSeniorRating;

  return {
    canStart: isAssignee && task.status === STATUS.ACTIVE,
    canSubmit: isAssignee && activeWork && (!readiness || readiness.ready),
    canSubmitCreation: (isCreator || isAssignee) && task.status === STATUS.CREATION_REJECTED,
    canApproveCreation: isManager && task.status === STATUS.PENDING_CREATION_APPROVAL,
    canManagerReview: isManager && task.status === STATUS.PENDING_MANAGER_REVIEW,
    canSeniorReview: isSenior && task.status === STATUS.PENDING_SENIOR_REVIEW,
    canDecideReturn: isManager && task.status === STATUS.RETURNED_TO_MANAGER,
    canRequestExtension: isAssignee && activeWork && !pendingExtension,
    canEdit:
      (isCreator || isAssignee || isManager) &&
      [STATUS.ACTIVE, STATUS.IN_PROGRESS, STATUS.REWORK, STATUS.CREATION_REJECTED].includes(task.status),
    canCancel:
      (isCreator || isManager) && ![STATUS.COMPLETED, STATUS.CANCELLED].includes(task.status),
    canRateManager:
      isManager && task.status === STATUS.COMPLETED && !hasManagerRating,
    canRateSenior:
      isSenior && task.status === STATUS.COMPLETED && !hasSeniorRating,
    canComment: true,
    isAssignee,
    isManager,
    isSenior,
    isCreator,
    isGroupMember,
    isAdmin: user.role === 'ADMIN',
    readOnly: user.role === 'ADMIN' && user.id !== task.assigneeId && user.id !== task.managerId && user.id !== task.seniorManagerId,
    groupReady: readiness?.ready ?? true,
    groupReadinessReason: readiness?.reason ?? null,
  };
}

export function getTaskDetail(db, user, taskId) {
  const row = getTaskRow(db, taskId);
  assert(row, 404, 'Task not found');
  assert(canViewTask(db, user, taskId), 403, 'You do not have access to this task');
  const task = mapTaskRow(row);

  const parts = db
    .prepare(`${TASK_SELECT} WHERE t.parent_task_id = ? ORDER BY ua.full_name`)
    .all(taskId)
    .map((r) => {
      const part = mapTaskRow(r);
      return {
        ...part,
        needsMyAction: Boolean(quickAction(part, user)),
        myActionLabel: quickAction(part, user),
        dueRisk: computeDueRisk(part),
      };
    });

  const ratings = getRatings(db, taskId);
  const extensions = db
    .prepare(
      `SELECT e.*, requester.full_name AS requesterName, requester.avatar_color AS requesterColor,
        decider.full_name AS decidedByName
       FROM extension_requests e
       JOIN users requester ON requester.id = e.requested_by
       LEFT JOIN users decider ON decider.id = e.decided_by
       WHERE e.task_id = ? ORDER BY e.created_at DESC`,
    )
    .all(taskId)
    .map((e) => ({
      id: e.id,
      taskId: e.task_id,
      requestedBy: e.requested_by,
      requesterName: e.requesterName,
      requesterColor: e.requesterColor,
      currentDueDate: e.current_due_date,
      requestedDueDate: e.requested_due_date,
      reason: e.reason,
      status: e.status,
      managerComment: e.manager_comment,
      seniorComment: e.senior_comment,
      decidedByName: e.decidedByName,
      decidedAt: e.decided_at,
      createdAt: e.created_at,
    }));

  const pendingExtension =
    extensions.find((e) => ['PENDING_MANAGER', 'PENDING_SENIOR'].includes(e.status)) || null;

  const events = db
    .prepare(
      `SELECT e.*, u.full_name AS actorName, u.avatar_color AS actorColor, u.role AS actorRole
       FROM task_events e LEFT JOIN users u ON u.id = e.actor_id
       WHERE e.task_id = ? ORDER BY e.created_at ASC`,
    )
    .all(taskId)
    .map((e) => ({
      id: e.id,
      action: e.action,
      actorId: e.actor_id,
      actorName: e.actorName || 'System',
      actorColor: e.actorColor || '#94a3b8',
      actorRole: e.actorRole,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      comment: e.comment,
      metadata: parseJson(e.metadata, {}),
      createdAt: e.created_at,
    }));

  const comments = db
    .prepare(
      `SELECT c.*, u.full_name AS authorName, u.avatar_color AS authorColor, u.role AS authorRole
       FROM task_comments c JOIN users u ON u.id = c.author_id
       WHERE c.task_id = ? ORDER BY c.created_at ASC`,
    )
    .all(taskId)
    .map((c) => ({
      id: c.id,
      authorId: c.author_id,
      authorName: c.authorName,
      authorColor: c.authorColor,
      authorRole: c.authorRole,
      body: c.body,
      createdAt: c.created_at,
    }));

  let members = [];
  let parent = null;
  if (task.taskKind === 'GROUP') {
    const partByUser = new Map(parts.map((p) => [p.assigneeId, p]));
    members = groupMembers(db, taskId).map((m) => {
      const part = partByUser.get(m.user_id);
      return {
        userId: m.user_id,
        fullName: m.full_name,
        email: m.email,
        role: m.role,
        title: m.title,
        avatarColor: m.avatar_color,
        isLeader: Boolean(m.is_leader),
        partId: part?.id || null,
        partStatus: part?.status || null,
      };
    });
  }
  if (task.parentTaskId) {
    const parentRow = getTaskRow(db, task.parentTaskId);
    if (parentRow) {
      parent = {
        id: parentRow.id,
        title: parentRow.title,
        status: parentRow.status,
        groupMode: parentRow.groupMode,
        assigneeId: parentRow.assigneeId,
        assigneeName: parentRow.assigneeName,
      };
    }
  }

  const permissions = computePermissions(db, user, task, { parts, ratings, pendingExtension });
  const readiness = groupReadiness(db, task);

  return {
    ...task,
    parts,
    members,
    parent,
    ratings,
    extensions,
    pendingExtension,
    events,
    comments,
    permissions,
    groupReadiness: readiness,
    dueRisk: computeDueRisk(task),
    needsMyAction: Boolean(quickAction(task, user)),
    myActionLabel: quickAction(task, user),
  };
}

export function buildApprovals(db, user) {
  const byIds = (rows) => {
    const map = new Map(rows.map((r) => [r.id, r]));
    return map;
  };

  const all = listTasks(db, user, {});
  const index = byIds(all);
  const pick = (predicate) => all.filter(predicate);

  const creation = pick(
    (t) => t.status === STATUS.PENDING_CREATION_APPROVAL && t.managerId === user.id,
  );
  const managerReviews = pick(
    (t) => t.status === STATUS.PENDING_MANAGER_REVIEW && t.managerId === user.id,
  );
  const seniorReviews = pick(
    (t) => t.status === STATUS.PENDING_SENIOR_REVIEW && t.seniorManagerId === user.id,
  );
  const returned = pick(
    (t) => t.status === STATUS.RETURNED_TO_MANAGER && t.managerId === user.id,
  );
  const mySubmissions = pick(
    (t) =>
      t.assigneeId === user.id &&
      [
        STATUS.PENDING_CREATION_APPROVAL,
        STATUS.PENDING_MANAGER_REVIEW,
        STATUS.PENDING_SENIOR_REVIEW,
        STATUS.RETURNED_TO_MANAGER,
      ].includes(t.status),
  );
  const ratingsDue = pick(
    (t) =>
      t.status === STATUS.COMPLETED &&
      ((t.managerId === user.id && !t.hasManagerRating) ||
        (t.seniorManagerId === user.id && !t.hasSeniorRating)),
  );
  const needsRework = pick(
    (t) =>
      t.assigneeId === user.id &&
      [STATUS.REWORK, STATUS.CREATION_REJECTED].includes(t.status),
  );
  const readyGroups = pick(
    (t) =>
      t.assigneeId === user.id &&
      t.taskKind === 'GROUP' &&
      t.groupMode === 'A' &&
      t.status === STATUS.ACTIVE &&
      t.partCount > 0 &&
      t.partCompleted === t.partCount,
  );

  const extRows = db
    .prepare(
      `SELECT e.*, requester.full_name AS requesterName, requester.avatar_color AS requesterColor,
        t.title AS taskTitle, t.manager_id AS managerId, t.senior_manager_id AS seniorManagerId,
        t.assignee_id AS assigneeId
       FROM extension_requests e
       JOIN tasks t ON t.id = e.task_id
       JOIN users requester ON requester.id = e.requested_by
       WHERE e.status IN ('PENDING_MANAGER','PENDING_SENIOR')
         AND ((e.status = 'PENDING_MANAGER' AND t.manager_id = ?)
           OR (e.status = 'PENDING_SENIOR' AND t.senior_manager_id = ?))
       ORDER BY e.created_at DESC`,
    )
    .all(user.id, user.id);

  const extensions = extRows
    .map((e) => {
      const task = index.get(e.task_id) || listTasks(db, user, {}).find((t) => t.id === e.task_id);
      if (!task) return null;
      return {
        id: e.id,
        taskId: e.task_id,
        status: e.status,
        requestedBy: e.requested_by,
        requesterName: e.requesterName,
        requesterColor: e.requesterColor,
        currentDueDate: e.current_due_date,
        requestedDueDate: e.requested_due_date,
        reason: e.reason,
        managerComment: e.manager_comment,
        createdAt: e.created_at,
        task,
      };
    })
    .filter(Boolean);

  return {
    creation,
    managerReviews,
    seniorReviews,
    returned,
    mySubmissions,
    ratingsDue,
    needsRework,
    readyGroups,
    extensions,
    total:
      creation.length +
      managerReviews.length +
      seniorReviews.length +
      returned.length +
      extensions.length +
      ratingsDue.length +
      needsRework.length +
      readyGroups.length,
  };
}

export function canViewTaskForUser(db, user, taskId) {
  return canViewTask(db, user, taskId);
}

export function averageRatings(ratings) {
  return {
    manager: average(ratings.filter((r) => r.raterRole === 'MANAGER').map((r) => r.score)),
    senior: average(ratings.filter((r) => r.raterRole === 'SENIOR_MANAGER').map((r) => r.score)),
  };
}
