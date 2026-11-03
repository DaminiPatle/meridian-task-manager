import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarPlus,
  CheckCircle2,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Star,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { buildActionConfig, type TaskActionName } from '../lib/constants';
import {
  addDaysISO,
  formatDate,
  formatDateLong,
  toDateInput,
  todayISO,
} from '../lib/format';
import type { Extension, Priority, TaskDetail } from '../lib/types';
import { useAsyncAction } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { Modal, ScoreInput } from './ui';

function actionIcon(action: TaskActionName) {
  if (action === 'start') return <Play size={18} />;
  if (action === 'cancel') return <Ban size={18} />;
  if (action.includes('reject')) return <XCircle size={18} />;
  if (action.includes('approve')) return <CheckCircle2 size={18} />;
  if (action.includes('resubmit')) return <RotateCcw size={18} />;
  return <Send size={18} />;
}

const TONE_CLASS: Record<string, string> = {
  primary: 'btn-primary',
  danger: 'btn-danger',
  success: 'btn-success',
};

/* --------------------------------------------------------- Task action modal */
export function ActionDialog({
  open,
  onClose,
  task,
  action,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  task: { id: string; title: string };
  action: TaskActionName;
  onDone?: () => void;
}) {
  const config = useMemo(() => buildActionConfig(action, task.title), [action, task.title]);
  const [comment, setComment] = useState('');
  const { busy, error, run, reset } = useAsyncAction();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setComment('');
      reset();
    }
  }, [open, action, task.id, reset]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (config.commentRequired && comment.trim().length < 3) return;
    void run(
      () => api.tasks.action(task.id, action, comment.trim() || undefined),
      {
        onSuccess: () => {
          toast.success(config.successMessage);
          onClose();
          onDone?.();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={config.title}
      subtitle={task.title}
      icon={actionIcon(action)}
      tone={config.tone === 'danger' ? 'rose' : config.tone === 'success' ? 'green' : 'amber'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="task-action-form"
            className={`btn ${TONE_CLASS[config.tone]}`}
            disabled={busy || (config.commentRequired && comment.trim().length < 3)}
          >
            {busy ? <span className="spinner" /> : null}
            {config.confirmLabel}
          </button>
        </>
      }
    >
      <form id="task-action-form" onSubmit={submit} className="col" style={{ gap: 16 }}>
        {error && <div className="form-error">{error}</div>}
        <p className="small" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          {config.description}
        </p>
        <div className="field">
          <label htmlFor="action-comment">
            {config.commentLabel}
            {config.commentRequired && <span style={{ color: 'var(--rose)' }}>*</span>}
          </label>
          <textarea
            id="action-comment"
            className="textarea"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={config.commentPlaceholder}
            maxLength={3000}
            style={{ minHeight: 104 }}
          />
          <span className="hint">
            Comments are permanently recorded in the task audit trail and visible to both approval
            levels.
          </span>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------ Extension request */
export function ExtensionRequestDialog({
  open,
  onClose,
  task,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  task: TaskDetail;
  onDone?: () => void;
}) {
  const toast = useToast();
  const { busy, error, run, reset } = useAsyncAction();
  const [requestedDueDate, setRequestedDueDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setRequestedDueDate(addDaysISO(task.dueDate || todayISO(), 7));
      setReason('');
      reset();
    }
  }, [open, task.dueDate, reset]);

  const minimum = task.dueDate ? addDaysISO(task.dueDate, 1) : todayISO();
  const valid =
    Boolean(requestedDueDate) &&
    Boolean(task.dueDate && requestedDueDate > task.dueDate) &&
    reason.trim().length >= 5;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    void run(() => api.tasks.requestExtension(task.id, requestedDueDate, reason.trim()), {
      onSuccess: () => {
        toast.success('Extension request submitted for manager approval.');
        onClose();
        onDone?.();
      },
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request a timeline extension"
      subtitle="Due dates only change after manager and senior manager approval."
      icon={<CalendarPlus size={18} />}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="extension-form" className="btn btn-primary" disabled={!valid || busy}>
            {busy ? <span className="spinner" /> : null}
            Submit request
          </button>
        </>
      }
    >
      <form id="extension-form" onSubmit={submit} className="col" style={{ gap: 16 }}>
        {error && <div className="form-error">{error}</div>}
        <div className="form-note">
          Current due date: <strong>{formatDateLong(task.dueDate)}</strong>. The new date applies only
          after both approval levels approve this request.
        </div>
        <div className="field">
          <label htmlFor="extension-date">Requested due date</label>
          <input
            id="extension-date"
            type="date"
            className="input"
            value={requestedDueDate}
            min={minimum}
            onChange={(event) => setRequestedDueDate(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="extension-reason">Reason for the extension</label>
          <textarea
            id="extension-reason"
            className="textarea"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain the dependency, scope change or blocker behind this request…"
            maxLength={2000}
            required
          />
          <span className="hint">Minimum 5 characters. This reason is shared with both approvers.</span>
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------- Extension decision */
export function ExtensionDecisionDialog({
  open,
  onClose,
  extension,
  decision,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  extension: Extension & { taskTitle?: string };
  decision: 'approve' | 'reject';
  onDone?: () => void;
}) {
  const toast = useToast();
  const { busy, error, run, reset } = useAsyncAction();
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      setComment('');
      reset();
    }
  }, [open, extension.id, decision, reset]);

  const rejecting = decision === 'reject';

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rejecting && comment.trim().length < 3) return;
    void run(() => api.extensions.decide(extension.id, decision, comment.trim() || undefined), {
      onSuccess: () => {
        toast.success(
          rejecting
            ? 'Extension rejected. The original due date is unchanged.'
            : 'Extension decision recorded.',
        );
        onClose();
        onDone?.();
      },
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rejecting ? 'Reject extension request' : 'Approve extension request'}
      subtitle={extension.taskTitle || 'Timeline extension'}
      icon={rejecting ? <XCircle size={18} /> : <CalendarPlus size={18} />}
      tone={rejecting ? 'rose' : 'green'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="extension-decision-form"
            className={`btn ${rejecting ? 'btn-danger' : 'btn-success'}`}
            disabled={busy || (rejecting && comment.trim().length < 3)}
          >
            {busy ? <span className="spinner" /> : null}
            {rejecting ? 'Reject extension' : 'Approve extension'}
          </button>
        </>
      }
    >
      <form id="extension-decision-form" onSubmit={submit} className="col" style={{ gap: 16 }}>
        {error && <div className="form-error">{error}</div>}
        <div className="ext-row">
          <div className="ext-dates">
            <span>{formatDate(extension.currentDueDate)}</span>
            <span className="muted">→</span>
            <span style={{ color: 'var(--accent)' }}>{formatDate(extension.requestedDueDate)}</span>
          </div>
          <div className="ext-reason">{extension.reason}</div>
        </div>
        <div className="field">
          <label htmlFor="extension-decision-comment">
            {rejecting ? 'Reason for rejection' : 'Decision note (optional)'}
            {rejecting && <span style={{ color: 'var(--rose)' }}>*</span>}
          </label>
          <textarea
            id="extension-decision-comment"
            className="textarea"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={
              rejecting
                ? 'Explain why the original due date must stand…'
                : 'Add context for the audit trail…'
            }
            maxLength={2000}
            style={{ minHeight: 88 }}
          />
        </div>
        {!rejecting && (
          <div className="form-note">
            {extension.status === 'PENDING_MANAGER'
              ? 'Your approval sends this request to the senior manager for the final decision.'
              : 'This is the final approval. The new due date takes effect immediately.'}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------- Rating modal */
export function RatingDialog({
  open,
  onClose,
  task,
  role,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  task: { id: string; title: string };
  role: 'MANAGER' | 'SENIOR_MANAGER';
  onDone?: () => void;
}) {
  const toast = useToast();
  const { busy, error, run, reset } = useAsyncAction();
  const [score, setScore] = useState(0);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (open) {
      setScore(0);
      setRemarks('');
      reset();
    }
  }, [open, task.id, reset]);

  const label = role === 'MANAGER' ? 'Manager' : 'Senior manager';
  const valid = score >= 1 && remarks.trim().length >= 3;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    void run(() => api.tasks.rate(task.id, score, remarks.trim()), {
      onSuccess: () => {
        toast.success(`${label} rating recorded independently.`);
        onClose();
        onDone?.();
      },
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${label} rating`}
      subtitle={task.title}
      icon={<Star size={18} />}
      tone="amber"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="rating-form" className="btn btn-primary" disabled={!valid || busy}>
            {busy ? <span className="spinner" /> : null}
            Submit rating
          </button>
        </>
      }
    >
      <form id="rating-form" onSubmit={submit} className="col" style={{ gap: 16 }}>
        {error && <div className="form-error">{error}</div>}
        <div className="form-note">
          Manager and senior manager ratings are stored as separate, independent records. Your rating
          is visible to the assignee.
        </div>
        <div className="field">
          <label>Score (1–5)</label>
          <ScoreInput value={score} onChange={setScore} />
        </div>
        <div className="field">
          <label htmlFor="rating-remarks">Remarks</label>
          <textarea
            id="rating-remarks"
            className="textarea"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Summarise the quality of delivery, collaboration and impact…"
            maxLength={2000}
            required
          />
          <span className="hint">Minimum 3 characters. Stored with your name and timestamp.</span>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------- Edit task */
const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function EditTaskDialog({
  open,
  onClose,
  task,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  task: TaskDetail;
  onDone?: () => void;
}) {
  const toast = useToast();
  const { busy, error, run, reset } = useAsyncAction();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [effortHours, setEffortHours] = useState(
    task.effortHours === null || task.effortHours === undefined ? '' : String(task.effortHours),
  );
  const [startDate, setStartDate] = useState(toDateInput(task.startDate));
  const [tags, setTags] = useState(task.tags.join(', '));

  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setEffortHours(
        task.effortHours === null || task.effortHours === undefined ? '' : String(task.effortHours),
      );
      setStartDate(toDateInput(task.startDate));
      setTags(task.tags.join(', '));
      reset();
    }
  }, [open, task, reset]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void run(
      () =>
        api.tasks.update(task.id, {
          title: title.trim(),
          description: description.trim(),
          priority,
          effortHours: effortHours === '' ? null : Number(effortHours),
          startDate: startDate || null,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 8),
        }),
      {
        onSuccess: () => {
          toast.success('Task details updated.');
          onClose();
          onDone?.();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit task"
      subtitle="Due dates are locked to the extension workflow."
      icon={<Pencil size={18} />}
      size="wide"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-task-form"
            className="btn btn-primary"
            disabled={busy || title.trim().length < 3}
          >
            {busy ? <span className="spinner" /> : null}
            Save changes
          </button>
        </>
      }
    >
      <form id="edit-task-form" onSubmit={submit} className="form-grid">
        {error && (
          <div className="form-error span-2">{error}</div>
        )}
        <div className="field span-2">
          <label htmlFor="edit-title">Title</label>
          <input
            id="edit-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={140}
            required
          />
        </div>
        <div className="field span-2">
          <label htmlFor="edit-description">Description</label>
          <textarea
            id="edit-description"
            className="textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={5000}
          />
        </div>
        <div className="field">
          <label htmlFor="edit-priority">Priority</label>
          <select
            id="edit-priority"
            className="select"
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0) + option.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="edit-effort">Effort (hours)</label>
          <input
            id="edit-effort"
            type="number"
            className="input"
            min={0}
            max={1000}
            step="0.5"
            value={effortHours}
            onChange={(event) => setEffortHours(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="edit-start">Start date</label>
          <input
            id="edit-start"
            type="date"
            className="input"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Due date</label>
          <input className="input" value={formatDate(task.dueDate)} disabled readOnly />
          <span className="hint">Locked — the two-level extension workflow is the only way to change it.</span>
        </div>
        <div className="field span-2">
          <label htmlFor="edit-tags">Tags</label>
          <input
            id="edit-tags"
            className="input"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Comma-separated, up to 8 tags"
          />
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------- Delete confirm */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  busy = false,
  tone = 'danger',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  tone?: 'danger' | 'primary';
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={<Ban size={18} />}
      tone="rose"
      size="narrow"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <span className="spinner" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="small" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        {description}
      </p>
    </Modal>
  );
}
