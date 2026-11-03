import express from 'express';
import { z } from 'zod';
import { AppError, newId, now, validate } from '../util.js';
import { hashPassword } from '../auth.js';
import { allDepartments, allUsers, userByEmail, userById } from '../repo.js';
import { publicAiSettings, getAiSettings, saveAiSettings, assertAiKey } from '../ai.js';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e', '#84cc16'];

function adminUser(row, db) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    title: row.title,
    managerId: row.manager_id,
    managerName: row.manager_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    avatarColor: row.avatar_color,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    openTasks: Number(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM tasks WHERE assignee_id = ? AND status NOT IN ('COMPLETED','CANCELLED')",
        )
        .get(row.id).count,
    ),
    directReports: Number(
      db.prepare('SELECT COUNT(*) AS count FROM users WHERE manager_id = ? AND is_active = 1').get(row.id).count,
    ),
  };
}

function validateUserState(db, { role, managerId, departmentId, userId }) {
  if (role === 'ADMIN' || role === 'SENIOR_MANAGER') {
    if (managerId) throw new AppError(400, `${role === 'ADMIN' ? 'Administrators' : 'Senior managers'} cannot have a manager in the workflow chain`);
  } else {
    if (!managerId) throw new AppError(400, 'A manager is required for this role');
    if (managerId === userId) throw new AppError(400, 'A user cannot be their own manager');
    const manager = userById(db, managerId);
    if (!manager || !manager.is_active) throw new AppError(422, 'Selected manager is not available');
    if (departmentId && manager.department_id && manager.department_id !== departmentId) {
      throw new AppError(422, 'Manager and direct report must belong to the same department');
    }
    if (role === 'MANAGER' && manager.role !== 'SENIOR_MANAGER') {
      throw new AppError(422, 'Managers must report to a senior manager');
    }
    if (role === 'EMPLOYEE' && !['MANAGER', 'SENIOR_MANAGER'].includes(manager.role)) {
      throw new AppError(422, 'Employees must report to a manager or senior manager');
    }
  }
  if (role !== 'ADMIN' && departmentId) {
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(departmentId);
    if (!dept) throw new AppError(422, 'Department not found');
  }
  if (role === 'EMPLOYEE' || role === 'MANAGER') {
    if (!departmentId) throw new AppError(400, 'A department is required for this role');
  }
}

export function adminRoutes(db) {
  const router = express.Router();

  router.use((req, _res, next) => {
    if (req.user.role !== 'ADMIN') {
      return next(new AppError(403, 'System administration requires the administrator role'));
    }
    next();
  });

  router.get('/overview', (_req, res) => {
    const counts = {
      users: Number(db.prepare('SELECT COUNT(*) AS c FROM users').get().c),
      activeUsers: Number(db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_active = 1').get().c),
      departments: Number(db.prepare('SELECT COUNT(*) AS c FROM departments').get().c),
      tasks: Number(db.prepare('SELECT COUNT(*) AS c FROM tasks').get().c),
      openTasks: Number(
        db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status NOT IN ('COMPLETED','CANCELLED')").get().c,
      ),
      meetings: Number(db.prepare('SELECT COUNT(*) AS c FROM meetings').get().c),
      pendingApprovals: Number(
        db
          .prepare(
            "SELECT COUNT(*) AS c FROM tasks WHERE status IN ('PENDING_CREATION_APPROVAL','PENDING_MANAGER_REVIEW','PENDING_SENIOR_REVIEW','RETURNED_TO_MANAGER')",
          )
          .get().c,
      ),
    };
    const aiRow = db.prepare("SELECT updated_at, updated_by FROM settings WHERE key = 'ai'").get();
    const aiUpdatedBy = aiRow?.updated_by ? userById(db, aiRow.updated_by)?.full_name : null;
    res.json({
      counts,
      departments: allDepartments(db),
      ai: {
        ...publicAiSettings(db),
        lastUpdated: aiRow?.updated_at || null,
        lastUpdatedBy: aiUpdatedBy || null,
      },
      guardrails: {
        mandatoryCreationApproval: true,
        selfApprovalBlocked: true,
        twoTierCompletion: true,
        seniorRejectionRoutesToManager: true,
        extensionsRequireTwoLevels: true,
        independentRatings: true,
        locked: true,
      },
    });
  });

  router.get('/users', (_req, res) => {
    const users = allUsers(db).map((u) => adminUser(u, db));
    res.json({ users, departments: allDepartments(db) });
  });

  router.post('/users', (req, res) => {
    const schema = z.object({
      fullName: z.string().min(2).max(120),
      email: z.string().email(),
      role: z.enum(['EMPLOYEE', 'MANAGER', 'SENIOR_MANAGER', 'ADMIN']),
      title: z.string().max(120).optional(),
      managerId: z.string().nullable().optional(),
      departmentId: z.string().nullable().optional(),
      password: z.string().min(8).max(200).optional(),
      avatarColor: z.string().max(20).optional(),
    });
    const payload = validate(schema, req.body);
    if (userByEmail(db, payload.email)) throw new AppError(409, 'A user with that email already exists');
    validateUserState(db, {
      role: payload.role,
      managerId: payload.managerId || null,
      departmentId: payload.departmentId || null,
    });
    const id = newId('usr_');
    const timestamp = now();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, role, title, manager_id, department_id, avatar_color, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(
      id,
      payload.email.trim().toLowerCase(),
      hashPassword(payload.password || 'demo1234'),
      payload.fullName.trim(),
      payload.role,
      payload.title || '',
      payload.managerId || null,
      payload.departmentId || null,
      payload.avatarColor || COLORS[Math.floor(Math.random() * COLORS.length)],
      timestamp,
    );
    if (payload.role === 'SENIOR_MANAGER' && payload.departmentId) {
      const dept = db.prepare('SELECT senior_manager_id FROM departments WHERE id = ?').get(payload.departmentId);
      if (!dept.senior_manager_id) {
        db.prepare('UPDATE departments SET senior_manager_id = ? WHERE id = ?').run(id, payload.departmentId);
      }
    }
    res.status(201).json({ user: adminUser(userById(db, id), db) });
  });

  router.patch('/users/:id', (req, res) => {
    const target = userById(db, req.params.id);
    if (!target) throw new AppError(404, 'User not found');
    const schema = z
      .object({
        fullName: z.string().min(2).max(120).optional(),
        email: z.string().email().optional(),
        role: z.enum(['EMPLOYEE', 'MANAGER', 'SENIOR_MANAGER', 'ADMIN']).optional(),
        title: z.string().max(120).optional(),
        managerId: z.string().nullable().optional(),
        departmentId: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        avatarColor: z.string().max(20).optional(),
      })
      .strict();
    const payload = validate(schema, req.body);
    const next = {
      role: payload.role ?? target.role,
      managerId: payload.managerId !== undefined ? payload.managerId : target.manager_id,
      departmentId: payload.departmentId !== undefined ? payload.departmentId : target.department_id,
      isActive: payload.isActive !== undefined ? payload.isActive : Boolean(target.is_active),
    };
    if (target.id === req.user.id && (next.role !== 'ADMIN' || !next.isActive)) {
      throw new AppError(409, 'You cannot remove your own administrator access or deactivate yourself');
    }
    if (target.role === 'ADMIN' && next.role !== 'ADMIN') {
      const admins = Number(
        db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'ADMIN' AND is_active = 1").get().c,
      );
      if (admins <= 1) throw new AppError(409, 'The last active administrator cannot be demoted');
    }
    if (next.isActive === false) {
      const open = Number(
        db
          .prepare(
            "SELECT COUNT(*) AS c FROM tasks WHERE assignee_id = ? AND status NOT IN ('COMPLETED','CANCELLED')",
          )
          .get(target.id).c,
      );
      if (open > 0) throw new AppError(409, 'Reassign or complete this user’s open tasks before deactivating them');
      const reports = Number(
        db.prepare('SELECT COUNT(*) AS c FROM users WHERE manager_id = ? AND is_active = 1').get(target.id).c,
      );
      if (reports > 0) throw new AppError(409, 'Move this manager’s direct reports before deactivating them');
      const depts = Number(
        db.prepare('SELECT COUNT(*) AS c FROM departments WHERE senior_manager_id = ?').get(target.id).c,
      );
      if (depts > 0) throw new AppError(409, 'Assign another senior manager to the department before deactivating this user');
    }
    if (next.role !== 'MANAGER' && target.role === 'MANAGER') {
      const reports = Number(
        db.prepare('SELECT COUNT(*) AS c FROM users WHERE manager_id = ? AND is_active = 1').get(target.id).c,
      );
      if (reports > 0) throw new AppError(409, 'Move this manager’s direct reports before changing their role');
    }
    validateUserState(db, { ...next, userId: target.id });
    if (payload.email) {
      const existing = userByEmail(db, payload.email);
      if (existing && existing.id !== target.id) throw new AppError(409, 'A user with that email already exists');
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `UPDATE users SET full_name = ?, email = ?, role = ?, title = ?, manager_id = ?, department_id = ?,
          is_active = ?, avatar_color = ? WHERE id = ?`,
      ).run(
        payload.fullName?.trim() ?? target.full_name,
        (payload.email || target.email).trim().toLowerCase(),
        next.role,
        payload.title ?? target.title,
        next.role === 'ADMIN' || next.role === 'SENIOR_MANAGER' ? null : next.managerId,
        next.departmentId,
        next.isActive ? 1 : 0,
        payload.avatarColor || target.avatar_color,
        target.id,
      );
      if (target.role === 'SENIOR_MANAGER' && next.role !== 'SENIOR_MANAGER') {
        db.prepare('UPDATE departments SET senior_manager_id = NULL WHERE senior_manager_id = ?').run(target.id);
      }
      if (next.role === 'SENIOR_MANAGER' && next.departmentId) {
        const dept = db
          .prepare('SELECT senior_manager_id FROM departments WHERE id = ?')
          .get(next.departmentId);
        if (!dept.senior_manager_id) {
          db.prepare('UPDATE departments SET senior_manager_id = ? WHERE id = ?').run(target.id, next.departmentId);
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    res.json({ user: adminUser(userById(db, target.id), db) });
  });

  router.post('/users/:id/reset-password', (req, res) => {
    const target = userById(db, req.params.id);
    if (!target) throw new AppError(404, 'User not found');
    const payload = validate(
      z.object({ newPassword: z.string().min(8).max(200) }),
      req.body,
    );
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      hashPassword(payload.newPassword),
      target.id,
    );
    res.json({ ok: true });
  });

  router.get('/departments', (_req, res) => {
    res.json({ departments: allDepartments(db) });
  });

  router.post('/departments', (req, res) => {
    const schema = z.object({
      name: z.string().min(2).max(80),
      description: z.string().max(500).optional(),
      seniorManagerId: z.string().nullable().optional(),
    });
    const payload = validate(schema, req.body);
    if (db.prepare('SELECT 1 FROM departments WHERE lower(name) = lower(?)').get(payload.name)) {
      throw new AppError(409, 'A department with that name already exists');
    }
    if (payload.seniorManagerId) {
      const senior = userById(db, payload.seniorManagerId);
      if (!senior || senior.role !== 'SENIOR_MANAGER') {
        throw new AppError(422, 'Select an active senior manager');
      }
    }
    const id = newId('dep_');
    db.prepare(
      'INSERT INTO departments (id, name, senior_manager_id, description, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, payload.name.trim(), payload.seniorManagerId || null, payload.description || '', now());
    res.status(201).json({
      department: allDepartments(db).find((d) => d.id === id),
    });
  });

  router.patch('/departments/:id', (req, res) => {
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
    if (!dept) throw new AppError(404, 'Department not found');
    const schema = z
      .object({
        name: z.string().min(2).max(80).optional(),
        description: z.string().max(500).optional(),
        seniorManagerId: z.string().nullable().optional(),
      })
      .strict();
    const payload = validate(schema, req.body);
    if (payload.seniorManagerId) {
      const senior = userById(db, payload.seniorManagerId);
      if (!senior || senior.role !== 'SENIOR_MANAGER' || !senior.is_active) {
        throw new AppError(422, 'Select an active senior manager');
      }
    }
    if (payload.name) {
      const dup = db
        .prepare('SELECT 1 FROM departments WHERE lower(name) = lower(?) AND id <> ?')
        .get(payload.name, dept.id);
      if (dup) throw new AppError(409, 'A department with that name already exists');
    }
    db.prepare('UPDATE departments SET name = ?, description = ?, senior_manager_id = ? WHERE id = ?').run(
      payload.name?.trim() ?? dept.name,
      payload.description ?? dept.description,
      payload.seniorManagerId !== undefined ? payload.seniorManagerId : dept.senior_manager_id,
      dept.id,
    );
    res.json({ department: allDepartments(db).find((d) => d.id === dept.id) });
  });

  router.get('/settings/ai', (_req, res) => {
    res.json({ ai: publicAiSettings(db) });
  });

  router.put('/settings/ai', (req, res) => {
    const schema = z.object({
      enabled: z.boolean(),
      provider: z.enum(['openai-compatible']).optional(),
      baseUrl: z.string().url().or(z.literal('')).optional(),
      model: z.string().min(1).max(120).optional(),
      temperature: z.number().min(0).max(1).optional(),
      apiKey: z.string().max(500).optional(),
    });
    const payload = validate(schema, req.body);
    assertAiKey(payload.apiKey && payload.apiKey !== 'CLEAR' ? payload.apiKey : null);
    const existing = getAiSettings(db);
    let apiKey = existing.apiKey;
    if (payload.apiKey === 'CLEAR') apiKey = '';
    else if (payload.apiKey) apiKey = payload.apiKey.trim();
    if (payload.enabled && !apiKey) {
      throw new AppError(400, 'Add an API key before enabling live AI features');
    }
    saveAiSettings(
      db,
      {
        ...existing,
        ...payload,
        apiKey,
        provider: payload.provider || existing.provider,
      },
      req.user.id,
    );
    res.json({ ai: publicAiSettings(db) });
  });

  return router;
}
