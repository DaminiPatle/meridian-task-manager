import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lock,
  MessagesSquare,
  Plus,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { AI_SOURCE_LABELS, ROLE_LABELS } from '../lib/constants';
import { addDaysISO, formatDate, formatDateLong, relativeTime, todayISO } from '../lib/format';
import type { Directory, Meeting, MeetingActionItem, Priority } from '../lib/types';
import { useApi, useAsyncAction } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import {
  Avatar,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  MetaRow,
  Modal,
  SectionCard,
} from '../components/ui';

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const meeting = useApi<Meeting>(
    () => api.meetings.get(id as string).then((result) => result.meeting),
    [id],
  );
  const directory = useApi<Directory>(() => api.directory(), []);
  const processAction = useAsyncAction();
  const createAction = useAsyncAction();

  const [createIndex, setCreateIndex] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), 7));
  const [priority, setPriority] = useState<Priority>('MEDIUM');

  useEffect(() => {
    if (meeting.data) document.title = `${meeting.data.title} · Meridian`;
  }, [meeting.data]);

  useEffect(() => {
    if (createIndex === null) return;
    const item = meeting.data?.actionItems[createIndex];
    const assignable = directory.data?.assignable || [];
    const owner = item?.ownerId && assignable.find((person) => person.id === item.ownerId);
    setAssigneeId(owner?.id || assignable[0]?.id || '');
    setDueDate(item?.dueDate || addDaysISO(todayISO(), 7));
    setPriority('MEDIUM');
    createAction.reset();
  }, [createIndex, meeting.data, directory.data, createAction]);

  if (meeting.loading && !meeting.data) return <LoadingBlock label="Opening meeting…" />;
  if (meeting.error) return <ErrorBlock message={meeting.error} onRetry={meeting.reload} />;
  if (!meeting.data) return null;

  const data = meeting.data;
  const canCreateTasks = data.permissions.canCreateTasks;
  const activeItem = createIndex === null ? null : data.actionItems[createIndex];

  function runProcess() {
    void processAction.run(() => api.meetings.process(data.id), {
      onSuccess: () => {
        toast.success('AI extraction complete. Summary, decisions and action items updated.');
        void meeting.reload();
      },
    });
  }

  function openCreate(index: number) {
    setCreateIndex(index);
  }

  function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    if (createIndex === null) return;
    void createAction.run(
      () =>
        api.meetings.createTaskFromAction(data.id, createIndex, {
          assigneeId: assigneeId || undefined,
          dueDate: dueDate || undefined,
          priority,
        }),
      {
        onSuccess: (result) => {
          const task = (result as { task: { id: string } }).task;
          toast.success('Action item converted into a governed task.');
          setCreateIndex(null);
          navigate(`/tasks/${task.id}`);
        },
      },
    );
  }

  return (
    <div className="page">
      <div className="detail-head">
        <button className="back-link" onClick={() => navigate('/meetings')}>
          <ArrowLeft size={14} /> Back to meetings
        </button>
        <div className="detail-title-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="page-eyebrow">
              <MessagesSquare size={13} /> {data.departmentName}
            </div>
            <h1 className="detail-title">{data.title}</h1>
            <div className="detail-badges">
              {data.status === 'PROCESSED' ? (
                <span className="badge badge-green">
                  <CheckCircle2 size={11} /> Processed
                </span>
              ) : (
                <span className="badge badge-amber">Draft</span>
              )}
              {data.aiSource && (
                <span className="badge badge-indigo">
                  <Sparkles size={11} /> {AI_SOURCE_LABELS[data.aiSource] || data.aiSource}
                </span>
              )}
              {data.transcriptRestricted && (
                <span className="badge badge-amber">
                  <Lock size={11} /> Transcript restricted
                </span>
              )}
            </div>
            <div className="detail-meta">
              <span className="detail-meta-item">
                <CalendarDays size={13} />
                <strong>{formatDateLong(data.meetingDate)}</strong>
              </span>
              <span className="detail-meta-item">
                <Avatar name={data.creatorName} color={data.creatorColor} size={22} />
                <span>
                  Created by <strong>{data.creatorName}</strong> · {ROLE_LABELS[data.creatorRole]}
                </span>
              </span>
              <span className="detail-meta-item">
                <Users size={13} />
                <strong>{data.participants.length}</strong> participants
              </span>
              {data.processedAt && (
                <span className="detail-meta-item">
                  <Sparkles size={13} />
                  Processed {relativeTime(data.processedAt)}
                </span>
              )}
            </div>
          </div>
          <div className="page-actions">
            {data.permissions.canProcess && (
              <button
                className="btn btn-primary"
                onClick={runProcess}
                disabled={processAction.busy}
              >
                {processAction.busy ? <span className="spinner" /> : <Sparkles size={15} />}
                {data.status === 'PROCESSED' ? 'Re-run AI extraction' : 'Run AI extraction'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-main-side">
        <div className="col" style={{ gap: 18 }}>
          {processAction.error && <div className="form-error">{processAction.error}</div>}

          <SectionCard
            title="Meeting summary"
            subtitle="Derived output — available to everyone who can view the meeting."
            icon={<Sparkles size={16} />}
          >
            {data.summary ? (
              <p className="prose">{data.summary}</p>
            ) : (
              <EmptyState
                title="Not processed yet"
                description={
                  data.hasTranscript
                    ? 'Run AI extraction to generate a summary, decisions and action items.'
                    : 'This meeting has no transcript yet. Create a new meeting with a transcript to enable extraction.'
                }
                icon={<Sparkles size={19} />}
                action={
                  data.permissions.canProcess ? (
                    <button className="btn btn-subtle btn-sm" onClick={runProcess}>
                      <Sparkles size={13} /> Run extraction
                    </button>
                  ) : undefined
                }
              />
            )}
          </SectionCard>

          <SectionCard
            title="Decisions"
            subtitle="Extracted from the transcript and stored as structured meeting output."
            icon={<CheckCircle2 size={16} />}
          >
            {data.decisions.length === 0 ? (
              <p className="muted small">
                No decisions have been extracted. {data.status === 'DRAFT' ? 'Process the transcript to populate this section.' : ''}
              </p>
            ) : (
              data.decisions.map((decision, index) => (
                <div className="decision" key={`${index}-${decision.slice(0, 12)}`}>
                  <span className="decision-num">{index + 1}</span>
                  <span>{decision}</span>
                </div>
              ))
            )}
          </SectionCard>

          <SectionCard
            title="Action items"
            subtitle="Commitments with owners, due dates and one-click conversion into governed tasks."
            icon={<ClipboardList size={16} />}
          >
            {data.actionItems.length === 0 ? (
              <p className="muted small">No action items have been extracted yet.</p>
            ) : (
              data.actionItems.map((item, index) => (
                <ActionRow
                  key={`${index}-${item.text.slice(0, 16)}`}
                  item={item}
                  canCreate={canCreateTasks}
                  onCreate={() => openCreate(index)}
                  onOpenTask={(taskId) => navigate(`/tasks/${taskId}`)}
                />
              ))
            )}
          </SectionCard>

          <SectionCard
            title="Raw transcript"
            subtitle="Strictly protected by role and team. Only permitted viewers can read the original text."
            icon={<FileText size={16} />}
          >
            {data.transcriptRestricted ? (
              <div className="locked-panel">
                <Lock size={18} />
                <div>
                  <strong>Transcript restricted.</strong> You can use the derived summary, decisions
                  and action items, but the raw transcript is not available to your role and team
                  scope.
                </div>
              </div>
            ) : data.transcript ? (
              <>
                <div className="transcript">{data.transcript}</div>
                <div className="row between mt-2">
                  <span className="muted tiny">
                    {data.transcriptChars.toLocaleString()} characters · captured{' '}
                    {formatDate(data.meetingDate)}
                  </span>
                  {data.permissions.canProcess && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={runProcess}
                      disabled={processAction.busy}
                    >
                      <RotateCcw size={13} /> Re-extract
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="transcript-empty">
                No transcript has been captured for this meeting. Create a new meeting and paste the
                transcript to enable AI extraction.
              </div>
            )}
          </SectionCard>
        </div>

        <div className="col" style={{ gap: 18 }}>
          <SectionCard title="Meeting details" icon={<CalendarDays size={16} />}>
            <div className="meta-list">
              <MetaRow
                icon={<CalendarDays size={14} />}
                label="Meeting date"
                value={formatDateLong(data.meetingDate)}
              />
              <MetaRow icon={<Users size={14} />} label="Department" value={data.departmentName} />
              <MetaRow
                icon={<MessagesSquare size={14} />}
                label="Status"
                value={data.status === 'PROCESSED' ? 'Processed' : 'Draft'}
              />
              <MetaRow
                icon={<FileText size={14} />}
                label="Transcript"
                value={
                  data.hasTranscript
                    ? `${data.transcriptChars.toLocaleString()} characters`
                    : 'Not captured'
                }
              />
              <MetaRow
                icon={<Sparkles size={14} />}
                label="AI source"
                value={data.aiSource ? AI_SOURCE_LABELS[data.aiSource] || data.aiSource : 'Not run'}
              />
              <MetaRow
                icon={<CheckCircle2 size={14} />}
                label="Output counts"
                value={`${data.decisions.length} decisions · ${data.actionItems.length} actions`}
              />
            </div>
          </SectionCard>

          <SectionCard title="Participants" icon={<Users size={16} />}>
            {data.participants.length === 0 ? (
              <p className="muted small">No participants recorded.</p>
            ) : (
              <div className="col" style={{ gap: 11 }}>
                {data.participants.map((person) => (
                  <div className="row" key={person.id} style={{ gap: 9 }}>
                    <Avatar name={person.fullName} color={person.avatarColor} size={29} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="person-name">{person.fullName}</div>
                      <div className="person-meta">
                        {person.title} · {ROLE_LABELS[person.role]}
                      </div>
                    </div>
                    {person.id === data.createdBy && (
                      <span className="chip" style={{ height: 19 }}>
                        Organiser
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Privacy guardrails" icon={<Lock size={16} />} bodyClass="tight">
            <div className="col" style={{ gap: 0 }}>
              {[
                'Raw transcripts are never included in list responses.',
                'Employee participants receive derived outputs only.',
                'Managers can read transcripts for their direct reports.',
                'Senior managers can read transcripts in their department.',
                'Administrators can read all transcripts for platform oversight.',
              ].map((text) => (
                <div className="guardrail" key={text}>
                  <span className="guardrail-check">
                    <CheckCircle2 size={12} />
                  </span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {canCreateTasks && (
            <div className="form-note">
              <strong>Turn commitments into work.</strong> Converting an action item creates a real
              task with the same approval chain, due-date policy and audit trail as any other task.
            </div>
          )}
        </div>
      </div>

      <Modal
        open={createIndex !== null}
        onClose={() => setCreateIndex(null)}
        title="Create task from action item"
        subtitle={activeItem?.text}
        icon={<Plus size={18} />}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCreateIndex(null)}>
              Cancel
            </button>
            <button
              type="submit"
              form="meeting-task-form"
              className="btn btn-primary"
              disabled={createAction.busy || !assigneeId}
            >
              {createAction.busy ? <span className="spinner" /> : <Plus size={15} />}
              Create task
            </button>
          </>
        }
      >
        <form id="meeting-task-form" onSubmit={submitCreate} className="col" style={{ gap: 16 }}>
          {createAction.error && <div className="form-error">{createAction.error}</div>}
          <div className="form-note">
            The task inherits the meeting context in its description. Activation and completion
            approvals apply exactly as normal.
          </div>
          <div className="field">
            <label htmlFor="meeting-task-assignee">Assignee</label>
            <select
              id="meeting-task-assignee"
              className="select"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              required
            >
              {(directory.data?.assignable || []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName} — {person.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="meeting-task-due">Due date</label>
            <input
              id="meeting-task-due"
              type="date"
              className="input"
              value={dueDate}
              min={todayISO()}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="meeting-task-priority">Priority</label>
            <select
              id="meeting-task-priority"
              className="select"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ActionRow({
  item,
  canCreate,
  onCreate,
  onOpenTask,
}: {
  item: MeetingActionItem;
  canCreate: boolean;
  onCreate: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <div className={`action-item ${item.done ? 'done' : ''}`}>
      <span className="action-check">
        <CheckCircle2 size={12} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="action-text">{item.text}</div>
        <div className="action-meta">
          {item.owner ? (
            <span className="row" style={{ gap: 5 }}>
              <Avatar name={item.owner.fullName} color={item.owner.avatarColor} size={18} />
              {item.owner.fullName}
            </span>
          ) : (
            <span>Unassigned</span>
          )}
          {item.dueDate && <span>Due {formatDate(item.dueDate)}</span>}
          {item.done && <span className="badge badge-green" style={{ height: 18 }}>Done</span>}
        </div>
      </div>
      {item.taskId ? (
        <button className="btn btn-ghost btn-sm" onClick={() => onOpenTask(item.taskId as string)}>
          Open task <ArrowRight size={12} />
        </button>
      ) : canCreate ? (
        <button className="btn btn-subtle btn-sm" onClick={onCreate}>
          <Plus size={12} /> Create task
        </button>
      ) : (
        <span className="chip">No task yet</span>
      )}
    </div>
  );
}
