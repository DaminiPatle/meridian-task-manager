import { userSafe } from './util.js';

export function userById(db, id) {
  if (!id) return null;
  return db
    .prepare(
      `SELECT u.*, d.name AS department_name, m.full_name AS manager_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN users m ON m.id = u.manager_id
       WHERE u.id = ?`,
    )
    .get(id);
}

export function userByEmail(db, email) {
  return db
    .prepare(
      `SELECT u.*, d.name AS department_name, m.full_name AS manager_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN users m ON m.id = u.manager_id
       WHERE lower(u.email) = lower(?)`,
    )
    .get(email);
}

export function publicUser(db, id) {
  const row = typeof id === 'string' ? userById(db, id) : id;
  if (!row) return null;
  return userSafe(row);
}

export function departmentById(db, id) {
  return db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
}

export function allDepartments(db) {
  return db
    .prepare(
      `SELECT d.*, u.full_name AS senior_manager_name, u.avatar_color AS senior_manager_color
       FROM departments d LEFT JOIN users u ON u.id = d.senior_manager_id
       ORDER BY d.name`,
    )
    .all();
}

export function allUsers(db) {
  return db
    .prepare(
      `SELECT u.*, d.name AS department_name, m.full_name AS manager_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN users m ON m.id = u.manager_id
       ORDER BY u.full_name`,
    )
    .all();
}

export function directReports(db, managerId) {
  return db
    .prepare(
      `SELECT u.*, d.name AS department_name, m.full_name AS manager_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN users m ON m.id = u.manager_id
       WHERE u.manager_id = ? AND u.is_active = 1
       ORDER BY u.full_name`,
    )
    .all(managerId);
}

export function departmentUsers(db, departmentId) {
  return db
    .prepare(
      `SELECT u.*, d.name AS department_name, m.full_name AS manager_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN users m ON m.id = u.manager_id
       WHERE u.department_id = ? AND u.is_active = 1
       ORDER BY CASE u.role WHEN 'SENIOR_MANAGER' THEN 1 WHEN 'MANAGER' THEN 2 ELSE 3 END, u.full_name`,
    )
    .all(departmentId);
}

export function seniorManagers(db, excludeIds = []) {
  const rows = db
    .prepare(
      `SELECT u.*, d.name AS department_name FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.role = 'SENIOR_MANAGER' AND u.is_active = 1
       ORDER BY u.full_name`,
    )
    .all();
  return rows.filter((u) => !excludeIds.includes(u.id));
}

export function isDirectReportOf(db, employeeId, managerId) {
  const row = db.prepare('SELECT manager_id FROM users WHERE id = ?').get(employeeId);
  return row?.manager_id === managerId;
}

export function groupMemberIds(db, groupTaskId) {
  return db
    .prepare('SELECT user_id FROM group_members WHERE task_id = ?')
    .all(groupTaskId)
    .map((r) => r.user_id);
}

export function groupMembers(db, groupTaskId) {
  return db
    .prepare(
      `SELECT gm.*, u.full_name, u.email, u.role, u.title, u.avatar_color, u.manager_id
       FROM group_members gm JOIN users u ON u.id = gm.user_id
       WHERE gm.task_id = ?
       ORDER BY gm.is_leader DESC, u.full_name`,
    )
    .all(groupTaskId);
}

export function isGroupMemberOf(db, userId, groupTaskId) {
  const row = db
    .prepare('SELECT 1 AS ok FROM group_members WHERE task_id = ? AND user_id = ?')
    .get(groupTaskId, userId);
  return Boolean(row);
}
