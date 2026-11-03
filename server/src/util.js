import { randomUUID } from 'node:crypto';

export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function now() {
  return new Date().toISOString();
}

export function newId(prefix = '') {
  return `${prefix}${randomUUID()}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysFromNow(days) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function stringifyJson(value) {
  return JSON.stringify(value ?? null);
}

export function assert(condition, status, message) {
  if (!condition) throw new AppError(status, message);
}

export function daysBetween(a, b) {
  if (!a || !b) return null;
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round(((end - start) / 86400000) * 10) / 10;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function average(values) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function round(n, places = 1) {
  if (n == null || !Number.isFinite(n)) return null;
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError(400, issue?.message || 'Invalid request', result.error.issues);
  }
  return result.data;
}

export function userSafe(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName ?? row.full_name,
    role: row.role,
    title: row.title,
    departmentId: row.departmentId ?? row.department_id,
    departmentName: row.departmentName ?? row.department_name,
    managerId: row.managerId ?? row.manager_id,
    managerName: row.managerName ?? row.manager_name,
    avatarColor: row.avatarColor ?? row.avatar_color,
    isActive: row.isActive ?? row.is_active,
  };
}

export function dateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

export function statusGroup(status) {
  if (status === 'COMPLETED') return 'completed';
  if (['PENDING_CREATION_APPROVAL', 'PENDING_MANAGER_REVIEW', 'PENDING_SENIOR_REVIEW', 'RETURNED_TO_MANAGER'].includes(status)) {
    return 'review';
  }
  if (status === 'CREATION_REJECTED' || status === 'REWORK') return 'changes';
  return 'open';
}
