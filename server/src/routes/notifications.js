import express from 'express';
import { unreadCount } from '../notify.js';

export function notificationRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const items = db
      .prepare(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40`,
      )
      .all(req.user.id)
      .map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        taskId: n.task_id,
        meetingId: n.meeting_id,
        isRead: Boolean(n.is_read),
        createdAt: n.created_at,
      }));
    res.json({ items, unread: unreadCount(db, req.user.id) });
  });

  router.post('/read-all', (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true, unread: 0 });
  });

  router.post('/:id/read', (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.user.id,
    );
    res.json({ ok: true, unread: unreadCount(db, req.user.id) });
  });

  return router;
}
