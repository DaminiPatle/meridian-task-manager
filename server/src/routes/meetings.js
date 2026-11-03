import express from 'express';
import { z } from 'zod';
import { AppError, newId, now, parseJson, stringifyJson, validate } from '../util.js';
import { canCreateMeetingWith, canProcessMeeting, canViewMeeting, canViewTranscript } from '../rbac.js';
import { userById } from '../repo.js';
import { processMeeting } from '../ai.js';
import { createTask } from '../workflow.js';

function miniUser(db, id) {
  const u = userById(db, id);
  if (!u) return null;
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    role: u.role,
    title: u.title,
    avatarColor: u.avatar_color,
  };
}

function hydrate(db, row, user, { includeTranscript = false } = {}) {
  const participantIds = parseJson(row.participants, []);
  const participants = participantIds.map((id) => miniUser(db, id)).filter(Boolean);
  const transcriptAllowed = includeTranscript && canViewTranscript(db, user, row);
  const actionItems = parseJson(row.action_items, []).map((item) => ({
    ...item,
    owner: item.ownerId ? miniUser(db, item.ownerId) : null,
  }));
  return {
    id: row.id,
    title: row.title,
    meetingDate: row.meeting_date,
    departmentId: row.department_id,
    departmentName: row.departmentName,
    createdBy: row.created_by,
    creatorName: row.creatorName,
    creatorColor: row.creatorColor,
    creatorRole: row.creatorRole,
    participants,
    participantIds,
    summary: row.summary,
    decisions: parseJson(row.decisions, []),
    actionItems,
    status: row.status,
    processedAt: row.processed_at,
    aiSource: row.ai_source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasTranscript: Boolean(row.transcript),
    transcriptChars: row.transcript ? row.transcript.length : 0,
    transcript: transcriptAllowed ? row.transcript : null,
    transcriptRestricted: Boolean(row.transcript) && !transcriptAllowed,
    permissions: {
      canViewTranscript: transcriptAllowed,
      canProcess: canProcessMeeting(db, user, row),
      canCreateTasks: user.role !== 'ADMIN',
      isCreator: row.created_by === user.id,
    },
  };
}

const MEETING_SELECT = `
  SELECT m.*, d.name AS departmentName, u.full_name AS creatorName,
    u.avatar_color AS creatorColor, u.role AS creatorRole
  FROM meetings m
  JOIN departments d ON d.id = m.department_id
  JOIN users u ON u.id = m.created_by
`;

export function meetingRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const rows = db.prepare(`${MEETING_SELECT} ORDER BY m.meeting_date DESC, m.created_at DESC`).all();
    const meetings = rows
      .filter((row) => canViewMeeting(db, req.user, row))
      .map((row) => {
        const meeting = hydrate(db, row, req.user);
        return {
          ...meeting,
          transcript: undefined,
          decisionCount: meeting.decisions.length,
          actionCount: meeting.actionItems.length,
        };
      });
    res.json({ meetings });
  });

  router.post('/', (req, res) => {
    const schema = z.object({
      title: z.string().min(3).max(160),
      meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      participantIds: z.array(z.string()).max(60).optional(),
      transcript: z.string().max(80000).optional(),
    });
    const payload = validate(schema, req.body);
    const participants = [...new Set([req.user.id, ...(payload.participantIds || [])])];
    if (!canCreateMeetingWith(db, req.user, participants)) {
      throw new AppError(403, 'Meetings can only include people within your authorized team scope');
    }
    let departmentId = req.user.department_id;
    if (!departmentId) {
      const first = userById(db, participants.find((id) => id !== req.user.id));
      departmentId = first?.department_id;
    }
    if (!departmentId) {
      throw new AppError(422, 'A meeting must belong to a department. Add a participant from a department.');
    }
    const timestamp = now();
    const id = newId('mtg_');
    db.prepare(
      `INSERT INTO meetings (id, title, meeting_date, department_id, created_by, participants, transcript,
        summary, decisions, action_items, status, processed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', '[]', '[]', 'DRAFT', NULL, ?, ?)`,
    ).run(
      id,
      payload.title.trim(),
      payload.meetingDate,
      departmentId,
      req.user.id,
      stringifyJson(participants),
      payload.transcript?.trim() || '',
      timestamp,
      timestamp,
    );
    const row = db.prepare(`${MEETING_SELECT} WHERE m.id = ?`).get(id);
    res.status(201).json({ meeting: hydrate(db, row, req.user, { includeTranscript: true }) });
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare(`${MEETING_SELECT} WHERE m.id = ?`).get(req.params.id);
    if (!row) throw new AppError(404, 'Meeting not found');
    if (!canViewMeeting(db, req.user, row)) throw new AppError(403, 'You do not have access to this meeting');
    res.json({ meeting: hydrate(db, row, req.user, { includeTranscript: true }) });
  });

  router.post('/:id/process', async (req, res) => {
    const row = db.prepare(`${MEETING_SELECT} WHERE m.id = ?`).get(req.params.id);
    if (!row) throw new AppError(404, 'Meeting not found');
    if (!canViewMeeting(db, req.user, row)) throw new AppError(403, 'You do not have access to this meeting');
    if (!canProcessMeeting(db, req.user, row)) {
      throw new AppError(403, 'You do not have permission to process this transcript');
    }
    if (!row.transcript) throw new AppError(409, 'Add a transcript before running AI processing');
    const participantIds = parseJson(row.participants, []);
    const participants = participantIds.map((id) => miniUser(db, id)).filter(Boolean);
    const result = await processMeeting(db, row, participants);
    db.prepare(
      `UPDATE meetings SET summary = ?, decisions = ?, action_items = ?, status = 'PROCESSED',
        processed_at = ?, ai_source = ?, updated_at = ? WHERE id = ?`,
    ).run(
      result.summary,
      stringifyJson(result.decisions),
      stringifyJson(result.actionItems),
      now(),
      result.source,
      now(),
      row.id,
    );
    const updated = db.prepare(`${MEETING_SELECT} WHERE m.id = ?`).get(row.id);
    res.json({ meeting: hydrate(db, updated, req.user, { includeTranscript: true }) });
  });

  router.post('/:id/action-items/:index/create-task', (req, res) => {
    const row = db.prepare(`${MEETING_SELECT} WHERE m.id = ?`).get(req.params.id);
    if (!row) throw new AppError(404, 'Meeting not found');
    if (!canViewMeeting(db, req.user, row)) throw new AppError(403, 'You do not have access to this meeting');
    const index = Number(req.params.index);
    const items = parseJson(row.action_items, []);
    const item = items[index];
    if (!item) throw new AppError(404, 'Action item not found');
    if (item.taskId) throw new AppError(409, 'A task has already been created for this action item');
    const schema = z.object({
      assigneeId: z.string().optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    });
    const payload = validate(schema, req.body || {});
    const assigneeId = payload.assigneeId || item.ownerId || req.user.id;
    const task = createTask(db, req.user, {
      title: String(item.text).slice(0, 140),
      description: `Created from the meeting “${row.title}” on ${row.meeting_date}.\n\n${item.text}`,
      assigneeId,
      dueDate: payload.dueDate || item.dueDate || undefined,
      priority: payload.priority || 'MEDIUM',
      tags: ['meeting-action'],
    });
    items[index] = { ...item, taskId: task.id, done: false };
    db.prepare('UPDATE meetings SET action_items = ?, updated_at = ? WHERE id = ?').run(
      stringifyJson(items),
      now(),
      row.id,
    );
    res.status(201).json({ task, meetingId: row.id, index });
  });

  return router;
}
