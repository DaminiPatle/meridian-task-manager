import { newId, now } from './util.js';

export function notify(db, { userId, type, title, body = '', taskId = null, meetingId = null }) {
  if (!userId) return;
  const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(userId);
  if (!user || !user.is_active) return;
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, task_id, meeting_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(newId('ntf_'), userId, type, title, body, taskId, meetingId, now());
}

export function unreadCount(db, userId) {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(userId);
  return Number(row.count);
}
