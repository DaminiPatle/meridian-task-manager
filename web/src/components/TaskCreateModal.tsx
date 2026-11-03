import { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Info, Plus, Users } from 'lucide-react';
import { api } from '../lib/api';
import { addDaysISO, todayISO } from '../lib/format';
import type { Directory, Priority, TaskDetail } from '../lib/types';
import { useAsyncAction, useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar, Modal } from './ui';

const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (task: TaskDetail) => void;
  presetAssigneeId?: string | null;
}

export function TaskCreateModal({ open, onClose, onCreated, presetAssigneeId }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const directory = useApi<Directory>(() => api.directory(), [open]);
  const { busy, error, run, reset } = useAsyncAction();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), 7));
  const [startDate, setStartDate] = useState('');
  const [effortHours, setEffortHours] = useState('');
  const [tags, setTags] = useState('');
  const [taskKind, setTaskKind] = useState<'STANDARD' | 'GROUP'>('STANDARD');
  const [groupMode, setGroupMode] = useState<'A' | 'B'>('A');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  const assignable = directory.data?.assignable || [];

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setDueDate(addDaysISO(todayISO(), 7));
    setStartDate('');
    setEffortHours('');
    setTags('');
    setTaskKind('STANDARD');
    setGroupMode('A');
    setMemberIds([]);
    setMemberSearch('');
    reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open || assignable.length === 0) return;
    const preset = presetAssigneeId && assignable.find((u) => u.id === presetAssigneeId);
    const firstOther = assignable.find((u) => u.id !== user?.id);
    const nextId = preset ? preset.id : firstOther?.id || assignable[0].id;
    setAssigneeId((current) =>
      current && assignable.some((u) => u.id === current) ? current : nextId,
    );
  }, [open, assignable, presetAssigneeId, user?.id]);

  const assignee = assignable.find((u) => u.id === assigneeId) || null;

  /** Mirror of the backend team-link rule so members are valid before submission. */
  const groupCandidates = useMemo(() => {
    if (!assignee) return [];
    const pool = directory.data?.groupCandidates || [];
    return pool.filter(
      (candidate) =>
        candidate.id === assignee.id ||
        candidate.managerId === assignee.managerId ||
        (assignee.role === 'MANAGER' && candidate.managerId === assignee.id),
    );
  }, [assignee, directory.data]);

  // The leader is always the task assignee and must be part of the group.
  useEffect(() => {
    if (taskKind !== 'GROUP' || !assigneeId) return;
    setMemberIds((current) => {
      const leaderIncluded = current.includes(assigneeId);
      return leaderIncluded ? current : [assigneeId, ...current];
    });
  }, [taskKind, assigneeId]);

  const filteredCandidates = groupCandidates.filter((candidate) =>
    memberSearch.trim()
      ? candidate.fullName.toLowerCase().includes(memberSearch.trim().toLowerCase()) ||
        candidate.email.toLowerCase().includes(memberSearch.trim().toLowerCase())
      : true,
  );

  const selfCreated = Boolean(user && assigneeId === user.id);

  const groupValid =
    taskKind !== 'GROUP' || (memberIds.includes(assigneeId) && memberIds.length >= 2);

  const valid =
    title.trim().length >= 3 &&
    Boolean(assigneeId) &&
    Boolean(dueDate) &&
    dueDate >= todayISO() &&
    groupValid;

  function toggleMember(id: string) {
    if (id === assigneeId) return;
    setMemberIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      assigneeId,
      priority,
      dueDate,
      startDate: startDate || null,
      effortHours: effortHours === '' ? null : Number(effortHours),
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 8),
      taskKind,
    };
    if (taskKind === 'GROUP') {
      payload.groupMode = groupMode;
      payload.leaderId = assigneeId;
      payload.members = memberIds;
    }

    void run(() => api.tasks.create(payload), {
      onSuccess: (result) => {
        const task = (result as { task: TaskDetail }).task;
        toast.success(
          task.status === 'PENDING_CREATION_APPROVAL'
            ? 'Task submitted — your manager must approve activation.'
            : 'Task created.',
        );
        onClose();
        onCreated?.(task);
      },
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a task"
      subtitle="Approval chains are resolved automatically from the assignee's reporting line."
      icon={<FolderPlus size={18} />}
      size="wide"
      footer={
        <>
          <span className="left muted tiny">
            {taskKind === 'GROUP'
              ? groupMode === 'A'
                ? 'Mode A: every member contribution needs full approval.'
                : 'Mode B: only the leader submission is mandatory.'
              : 'Two-tier completion approval applies to every task.'}
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-task-form"
            className="btn btn-primary"
            disabled={!valid || busy || directory.loading}
          >
            {busy ? <span className="spinner" /> : <Plus size={15} />}
            {selfCreated ? 'Submit for activation' : 'Create task'}
          </button>
        </>
      }
    >
      <form id="create-task-form" onSubmit={submit} className="form-grid">
        {error && <div className="form-error span-2">{error}</div>}
        {directory.error && <div className="form-error span-2">{directory.error}</div>}

        <div className="field span-2">
          <label htmlFor="create-title">Title</label>
          <input
            id="create-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs to be delivered?"
            maxLength={140}
            autoFocus
            required
          />
        </div>

        <div className="field span-2">
          <label htmlFor="create-description">Description</label>
          <textarea
            id="create-description"
            className="textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Context, scope and definition of done…"
            maxLength={5000}
            style={{ minHeight: 82 }}
          />
        </div>

        <div className="field">
          <label htmlFor="create-assignee">Assignee</label>
          <select
            id="create-assignee"
            className="select"
            value={assigneeId}
            onChange={(event) => {
              const nextId = event.target.value;
              setAssigneeId(nextId);
              setMemberIds((current) => current.filter((id) => id !== assigneeId));
            }}
            required
          >
            {assignable.length === 0 && <option value="">No assignable people</option>}
            {assignable.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName} — {person.title}
              </option>
            ))}
          </select>
          <span className="hint">Employees can only create tasks for themselves.</span>
        </div>

        <div className="field">
          <label htmlFor="create-priority">Priority</label>
          <select
            id="create-priority"
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
          <label htmlFor="create-due">Due date</label>
          <input
            id="create-due"
            type="date"
            className="input"
            value={dueDate}
            min={todayISO()}
            onChange={(event) => setDueDate(event.target.value)}
            required
          />
          <span className="hint">Only the two-level extension workflow can move this later.</span>
        </div>

        <div className="field">
          <label htmlFor="create-start">Start date (optional)</label>
          <input
            id="create-start"
            type="date"
            className="input"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="create-effort">Effort estimate (hours)</label>
          <input
            id="create-effort"
            type="number"
            className="input"
            min={0}
            max={1000}
            step="0.5"
            value={effortHours}
            onChange={(event) => setEffortHours(event.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="field">
          <label htmlFor="create-tags">Tags</label>
          <input
            id="create-tags"
            className="input"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="comma, separated, up to 8"
          />
        </div>

        {selfCreated && (
          <div className="form-note span-2">
            <strong>Self-created task.</strong> Because you are assigning this to yourself, your
            manager must approve activation before work can start. Self-approval is not possible.
          </div>
        )}

        <div className="field span-2">
          <label>Task type</label>
          <div className="tabs" style={{ alignSelf: 'flex-start' }}>
            <button
              type="button"
              className={`tab ${taskKind === 'STANDARD' ? 'active' : ''}`}
              onClick={() => setTaskKind('STANDARD')}
            >
              Standard task
            </button>
            <button
              type="button"
              className={`tab ${taskKind === 'GROUP' ? 'active' : ''}`}
              onClick={() => setTaskKind('GROUP')}
            >
              <Users size={13} /> Group task
            </button>
          </div>
        </div>

        {taskKind === 'GROUP' && (
          <>
            <div className="field span-2">
              <label>Group mode</label>
              <div className="grid grid-2" style={{ gap: 10 }}>
                <button
                  type="button"
                  className={`card card-pad ${groupMode === 'A' ? 'active-mode' : ''}`}
                  onClick={() => setGroupMode('A')}
                  style={{
                    textAlign: 'left',
                    borderColor: groupMode === 'A' ? 'var(--accent)' : undefined,
                    boxShadow: groupMode === 'A' ? '0 0 0 3px rgba(99,102,241,.12)' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <div className="row between">
                    <strong className="small">Mode A — Full contribution</strong>
                    {groupMode === 'A' && <span className="badge badge-indigo">Selected</span>}
                  </div>
                  <p className="hint" style={{ marginTop: 6 }}>
                    Every member submits an individual contribution that goes through the full
                    two-tier approval. The leader's consolidated submission is also required.
                  </p>
                </button>
                <button
                  type="button"
                  className={`card card-pad ${groupMode === 'B' ? 'active-mode' : ''}`}
                  onClick={() => setGroupMode('B')}
                  style={{
                    textAlign: 'left',
                    borderColor: groupMode === 'B' ? 'var(--accent)' : undefined,
                    boxShadow: groupMode === 'B' ? '0 0 0 3px rgba(99,102,241,.12)' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <div className="row between">
                    <strong className="small">Mode B — Leader consolidated</strong>
                    {groupMode === 'B' && <span className="badge badge-indigo">Selected</span>}
                  </div>
                  <p className="hint" style={{ marginTop: 6 }}>
                    Only the leader's consolidated submission is mandatory. Member parts are
                    tracked for visibility but do not block completion.
                  </p>
                </button>
              </div>
            </div>

            <div className="field span-2">
              <label>
                Group members
                <span className="muted tiny" style={{ fontWeight: 500 }}>
                  {memberIds.length} selected · leader included automatically
                </span>
              </label>
              <div className="row" style={{ marginBottom: 4 }}>
                <input
                  className="input"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Find a teammate…"
                  style={{ height: 34 }}
                />
              </div>
              <div
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: 8,
                  maxHeight: 220,
                  overflowY: 'auto',
                  background: 'var(--surface-soft)',
                }}
              >
                {filteredCandidates.length === 0 && (
                  <div className="muted small" style={{ padding: 10 }}>
                    No eligible teammates for this assignee.
                  </div>
                )}
                {filteredCandidates.map((candidate) => {
                  const isLeader = candidate.id === assigneeId;
                  const checked = memberIds.includes(candidate.id);
                  return (
                    <label
                      key={candidate.id}
                      className="row"
                      style={{
                        padding: '7px 8px',
                        borderRadius: 8,
                        cursor: isLeader ? 'default' : 'pointer',
                        background: checked ? '#fff' : 'transparent',
                        border: checked ? '1px solid var(--line)' : '1px solid transparent',
                        marginBottom: 4,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isLeader}
                        onChange={() => toggleMember(candidate.id)}
                      />
                      <Avatar name={candidate.fullName} color={candidate.avatarColor} size={27} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="person-name">
                          {candidate.fullName}
                          {isLeader && <span className="badge badge-indigo" style={{ marginLeft: 7 }}>Leader</span>}
                        </div>
                        <div className="person-meta">{candidate.title}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {!groupValid && (
                <span className="hint" style={{ color: 'var(--rose)' }}>
                  A group needs the leader and at least one other member.
                </span>
              )}
            </div>
          </>
        )}

        <div className="form-note span-2">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Info size={15} style={{ flex: '0 0 auto', marginTop: 2 }} />
            <span>
              Completion requires <strong>manager then senior manager</strong> approval. Due dates
              can only change through the two-level extension approval workflow.
              {taskKind === 'GROUP' && groupMode === 'A' && (
                <> Group completion stays locked until every member contribution is fully approved.</>
              )}
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
