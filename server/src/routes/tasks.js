import express from 'express';
import { z } from 'zod';
import { validate } from '../util.js';
import {
  addComment,
  addRating,
  applyTaskAction,
  createTask,
  decideExtension,
  getTaskDetail,
  listTasks,
  requestExtension,
  updateTask,
} from '../workflow.js';

const createSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(5000).optional(),
  assigneeId: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  effortHours: z.union([z.number(), z.string()]).optional().nullable(),
  tags: z.array(z.string().max(24)).max(8).optional(),
  taskKind: z.enum(['STANDARD', 'GROUP']).optional(),
  groupMode: z.enum(['A', 'B']).optional(),
  leaderId: z.string().optional(),
  members: z.array(z.string()).max(40).optional(),
});

const updateSchema = z
  .object({
    title: z.string().min(3).max(140).optional(),
    description: z.string().max(5000).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    effortHours: z.union([z.number(), z.string()]).optional().nullable(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    tags: z.array(z.string().max(24)).max(8).optional(),
    dueDate: z.string().optional(),
  })
  .strict();

const actionSchema = z.object({
  action: z.enum([
    'start',
    'approve_creation',
    'reject_creation',
    'resubmit_creation',
    'submit_completion',
    'manager_approve',
    'manager_reject',
    'senior_approve',
    'senior_reject',
    'request_corrections',
    'resubmit_to_senior',
    'cancel',
  ]),
  comment: z.string().max(3000).optional(),
});

const commentSchema = z.object({ body: z.string().min(1).max(2000) });

const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
  remarks: z.string().min(3).max(2000),
});

const extensionSchema = z.object({
  requestedDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(5).max(2000),
});

export function taskRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const tasks = listTasks(db, req.user, {
      scope: req.query.scope,
      status: req.query.status,
      priority: req.query.priority,
      taskKind: req.query.taskKind,
      q: req.query.q,
      due: req.query.due,
      assigneeId: req.query.assigneeId,
      parentTaskId: req.query.parentTaskId,
      approverId: req.query.approverId,
      approverField: req.query.approverField,
    });
    res.json({ tasks });
  });

  router.post('/', (req, res) => {
    const payload = validate(createSchema, req.body);
    const task = createTask(db, req.user, payload);
    res.status(201).json({ task });
  });

  router.get('/:id', (req, res) => {
    res.json({ task: getTaskDetail(db, req.user, req.params.id) });
  });

  router.patch('/:id', (req, res) => {
    const payload = validate(updateSchema, req.body);
    res.json({ task: updateTask(db, req.user, req.params.id, payload) });
  });

  router.post('/:id/actions', (req, res) => {
    const payload = validate(actionSchema, req.body);
    res.json({ task: applyTaskAction(db, req.user, req.params.id, payload) });
  });

  router.post('/:id/comments', (req, res) => {
    const payload = validate(commentSchema, req.body);
    const comment = addComment(db, req.user, req.params.id, payload.body);
    res.status(201).json({ comment });
  });

  router.post('/:id/ratings', (req, res) => {
    const payload = validate(ratingSchema, req.body);
    const ratings = addRating(db, req.user, req.params.id, payload);
    res.json({ ratings });
  });

  router.post('/:id/extensions', (req, res) => {
    const payload = validate(extensionSchema, req.body);
    const extension = requestExtension(db, req.user, req.params.id, payload);
    res.status(201).json({ extension });
  });

  return router;
}

export function extensionRoutes(db) {
  const router = express.Router();
  router.post('/:id/decision', (req, res) => {
    const schema = z.object({
      decision: z.enum(['approve', 'reject']),
      comment: z.string().max(2000).optional(),
    });
    const payload = validate(schema, req.body);
    res.json({ extension: decideExtension(db, req.user, req.params.id, payload) });
  });
  return router;
}
