import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'meridian.db');

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  senior_manager_id TEXT,
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('EMPLOYEE','MANAGER','SENIOR_MANAGER','ADMIN')),
  title TEXT DEFAULT '',
  manager_id TEXT REFERENCES users(id),
  department_id TEXT REFERENCES departments(id),
  avatar_color TEXT DEFAULT '#6366f1',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  task_kind TEXT NOT NULL CHECK (task_kind IN ('STANDARD','GROUP','GROUP_PART')),
  group_mode TEXT CHECK (group_mode IN ('A','B')),
  parent_task_id TEXT REFERENCES tasks(id),
  status TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  created_by TEXT NOT NULL REFERENCES users(id),
  assignee_id TEXT NOT NULL REFERENCES users(id),
  department_id TEXT NOT NULL REFERENCES departments(id),
  manager_id TEXT NOT NULL REFERENCES users(id),
  senior_manager_id TEXT NOT NULL REFERENCES users(id),
  start_date TEXT,
  due_date TEXT,
  original_due_date TEXT,
  completed_at TEXT,
  effort_hours REAL,
  tags TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  is_leader INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL,
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  comment TEXT DEFAULT '',
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extension_requests (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES users(id),
  current_due_date TEXT NOT NULL,
  requested_due_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING_MANAGER','PENDING_SENIOR','APPROVED','REJECTED','CANCELLED')),
  manager_comment TEXT DEFAULT '',
  senior_comment TEXT DEFAULT '',
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  rater_id TEXT NOT NULL REFERENCES users(id),
  rater_role TEXT NOT NULL CHECK (rater_role IN ('MANAGER','SENIOR_MANAGER')),
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  remarks TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (task_id, rater_role)
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  meeting_date TEXT NOT NULL,
  department_id TEXT NOT NULL REFERENCES departments(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  participants TEXT NOT NULL DEFAULT '[]',
  transcript TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  decisions TEXT DEFAULT '[]',
  action_items TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PROCESSED')),
  processed_at TEXT,
  ai_source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  meeting_id TEXT REFERENCES meetings(id) ON DELETE CASCADE,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_manager ON tasks(manager_id);
CREATE INDEX IF NOT EXISTS idx_tasks_senior ON tasks(senior_manager_id);
CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_events_task ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_meetings_department ON meetings(department_id);
`;

export function openDatabase(dbPath = process.env.DB_PATH || DEFAULT_DB_PATH) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    try {
      db.exec('PRAGMA journal_mode = WAL;');
    } catch {
      // WAL is not available on every filesystem; safe to continue.
    }
  }
  db.exec(SCHEMA);
  return db;
}

export function isEmptyDatabase(db) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  return Number(row.count) === 0;
}
