import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  Layers,
  Lock,
  MessageSquare,
  Pencil,
  RotateCcw,
  Send,
  ShieldCheck,
  Star,
  UserRound,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  EXTENSION_STATUS_META,
  ROLE_LABELS,
  STATUS_META,
} from '../lib/constants';
import { formatDate, formatDateLong, formatDateTime, formatHours, relativeTime } from '../lib/format';
import type { TaskDetail } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useApi, useAsyncAction } from '../hooks/useApi';
import {
  ActionDialog,
  EditTaskDialog,
  ExtensionDecisionDialog,
  ExtensionRequestDialog,
  RatingDialog,
} from '../components/dialogs';
import { Timeline } from '../components/tasks';
import {
  Avatar,
  DueDate,
  ErrorBlock,
  LoadingBlock,
  MetaRow,
  Progress,
  SectionCard,
  Stars,
  StatusBadge,
} from '../components/ui';
import type { TaskActionName } from '../lib/constants';

type DialogState =
  | { kind: 'action'; action: TaskActionName }
  | { kind: 'extension' }
  | { kind: 'decision'; decision: 'approve' | 'reject' }
  | { kind: 'rating'; role: 'MANAGER' | 'SENIOR_MANAGER' }
  | { kind: 'edit' }
  | null;

function ChainStep({
  index,
  label,
  sub,
  state,
}: {
  index: number;
  label: string;
  sub: string;
  state: 'done' | 'current' | 'pending' | 'blocked';
}) {
  return (
    <div className={`chain-step ${state === 'done' ? 'done' : state === 'current' ? 'current' : ''}`}>
      <span className="chain-dot">
        {state === 'done' ? <CheckCircle2 size={13} /> : state === 'blocked' ? <Lock size={11} /> : index}
      </span>
      <div>
        <div className="chain-label">{label}</div>
        <div className="chain-sub">{sub}</div>
      </div>
    </div>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const task = useApi<TaskDetail>(() => api.tasks.get(id as string).then((result) => result.task), [id]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [comment, setComment] = useState('');
  const commentAction = useAsyncAction();

  useEffect(() => {
    if (task.data) document.title = `${task.data.title} · Meridian`;
  }, [task.data]);

  if (task.loading && !task.data) return <LoadingBlock label="Opening task…" />;
  if (task.error) return <ErrorBlock message={task.error} onRetry={task.reload} />;
  if (!task.data || !user) return null;

  const detail = task.data;
  const perms = detail.permissions;
  const isGroup = detail.taskKind === 'GROUP';
  const isPart = detail.taskKind === 'GROUP_PART';
  const pending = detail.pendingExtension;
  const canDecideExtension =
    pending &&
    ((pending.status === 'PENDING_MANAGER' && user.id === detail.managerId) ||
      (pending.status === 'PENDING_SENIOR' && user.id === detail.seniorManagerId));

  const requiresActivation = detail.createdBy === detail.assigneeId;
  const activationDone = !['PENDING_CREATION_APPROVAL', 'CREATION_REJECTED'].includes(detail.status);
  const managerApproved = ['PENDING_SENIOR_REVIEW', 'COMPLETED', 'RETURNED_TO_MANAGER'].includes(
    detail.status,
  );
  const seniorApproved = detail.status === 'COMPLETED';
  const ratingsDone = detail.ratings.length >= 2;

  const activationState: 'done' | 'current' | 'pending' | 'blocked' = !requiresActivation
    ? 'done'
    : activationDone
      ? 'done'
      : 'current';
  const managerState: 'done' | 'current' | 'pending' | 'blocked' = managerApproved
    ? 'done'
    : detail.status === 'PENDING_MANAGER_REVIEW' || detail.status === 'RETURNED_TO_MANAGER'
      ? 'current'
      : activationDone
        ? 'pending'
        : 'blocked';
  const seniorState: 'done' | 'current' | 'pending' | 'blocked' = seniorApproved
    ? 'done'
    : detail.status === 'PENDING_SENIOR_REVIEW'
      ? 'current'
      : managerApproved
        ? 'pending'
        : 'blocked';
  const ratingState: 'done' | 'current' | 'pending' | 'blocked' = ratingsDone
    ? 'done'
    : detail.status === 'COMPLETED'
      ? 'current'
      : 'blocked';

  function refresh(message?: string) {
    if (message) toast.success(message);
    void task.reload();
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    const body = comment.trim();
    if (!body) return;
    await commentAction.run(() => api.tasks.comment(detail.id, body), {
      onSuccess: () => {
        setComment('');
        toast.success('Comment added to the audit trail.');
        void task.reload();
      },
    });
  }

  const primaryActions: { action: TaskActionName; label: string; className: string }[] = [];
  if (perms.canStart) primaryActions.push({ action: 'start', label: 'Start work', className: 'btn-primary' });
  if (perms.canApproveCreation) {
    primaryActions.push({
      action: 'approve_creation',
      label: 'Approve activation',
      className: 'btn-success',
    });
    primaryActions.push({
      action: 'reject_creation',
      label: 'Reject activation',
      className: 'btn-danger-ghost',
    });
  }
  if (perms.canSubmitCreation)
    primaryActions.push({
      action: 'resubmit_creation',
      label: 'Resubmit for activation',
      className: 'btn-primary',
    });
  if (perms.canSubmit)
    primaryActions.push({
      action: 'submit_completion',
      label: 'Submit for completion',
      className: 'btn-primary',
    });
  if (perms.canManagerReview) {
    primaryActions.push({
      action: 'manager_approve',
      label: 'Approve & send to senior',
      className: 'btn-primary',
    });
    primaryActions.push({
      action: 'manager_reject',
      label: 'Return for rework',
      className: 'btn-danger-ghost',
    });
  }
  if (perms.canSeniorReview) {
    primaryActions.push({
      action: 'senior_approve',
      label: 'Final approval',
      className: 'btn-success',
    });
    primaryActions.push({
      action: 'senior_reject',
      label: 'Return to manager',
      className: 'btn-danger-ghost',
    });
  }
  if (perms.canDecideReturn) {
    primaryActions.push({
      action: 'request_corrections',
      label: 'Request corrections',
      className: 'btn-danger-ghost',
    });
    primaryActions.push({
      action: 'resubmit_to_senior',
      label: 'Resubmit to senior',
      className: 'btn-subtle',
    });
  }

  return (
    <div className="page">
      <div className="detail-head">
        <button className="back-link" onClick={() => navigate('/tasks')}>
          <ArrowLeft size={14} /> Back to tasks
        </button>
        <div className="detail-title-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="detail-title">{detail.title}</h1>
            <div className="detail-badges">
              <StatusBadge status={detail.status} />
              <span className={`priority ${detail.priority}`}>{detail.priority}</span>
              {isGroup && (
                <span className="badge badge-violet">
                  <Users size={11} /> Group mode {detail.groupMode}
                </span>
              )}
              {isPart && (
                <span className="badge badge-slate">
                  <Layers size={11} /> Contribution
                </span>
              )}
              {detail.source === 'SELF' && <span className="badge badge-teal">Self-created</span>}
              {detail.pendingExtensionCount > 0 && (
                <span className="badge badge-amber">
                  <Clock size={11} /> Extension pending
                </span>
              )}
            </div>
            <div className="detail-meta">
              <span className="detail-meta-item">
                <Avatar name={detail.assigneeName} color={detail.assigneeColor} size={24} />
                <span>
                  <strong>{detail.assigneeName}</strong> · {detail.assigneeTitle}
                </span>
              </span>
              <span className="detail-meta-item">
                <CalendarDays size={13} />
                <DueDate date={detail.dueDate} withIcon={false} />
              </span>
              <span className="detail-meta-item">
                <AlertTriangle size={13} />
                Priority <strong>{detail.priority}</strong>
              </span>
              <span className="detail-meta-item">
                <Clock size={13} />
                Updated {relativeTime(detail.updatedAt)}
              </span>
            </div>
          </div>
        </div>

        {perms.readOnly && (
          <div className="locked-panel">
            <ShieldCheck size={18} />
            <div>
              <strong>Read-only administrator view.</strong> Administrators manage users,
              departments and AI settings but cannot create, approve, rate or alter tasks.
            </div>
          </div>
        )}

        {(primaryActions.length > 0 ||
          perms.canRequestExtension ||
          perms.canRateManager ||
          perms.canRateSenior ||
          perms.canEdit ||
          perms.canCancel) && (
          <div className="action-bar">
            <span className="bar-label">Available to you</span>
            {primaryActions.map((entry) => (
              <button
                key={entry.action}
                className={`btn btn-sm ${entry.className}`}
                onClick={() => setDialog({ kind: 'action', action: entry.action })}
                disabled={
                  entry.action === 'submit_completion' &&
                  (!perms.groupReady || !perms.canSubmit)
                }
                title={!perms.groupReady ? perms.groupReadinessReason || undefined : undefined}
              >
                {entry.action.includes('start') ? <Clock size={13} /> : null}
                {entry.action.includes('approve') ? <CheckCircle2 size={13} /> : null}
                {entry.action.includes('reject') || entry.action.includes('correction')
                  ? <AlertTriangle size={13} />
                  : null}
                {entry.action.includes('resubmit') ? <RotateCcw size={13} /> : null}
                {entry.action === 'submit_completion' ? <Send size={13} /> : null}
                {entry.label}
              </button>
            ))}
            {perms.canRequestExtension && (
              <button
                className="btn btn-sm btn-subtle"
                onClick={() => setDialog({ kind: 'extension' })}
              >
                <CalendarClock size={13} /> Request extension
              </button>
            )}
            {perms.canRateManager && (
              <button
                className="btn btn-sm btn-subtle"
                onClick={() => setDialog({ kind: 'rating', role: 'MANAGER' })}
              >
                <Star size={13} /> Rate as manager
              </button>
            )}
            {perms.canRateSenior && (
              <button
                className="btn btn-sm btn-subtle"
                onClick={() => setDialog({ kind: 'rating', role: 'SENIOR_MANAGER' })}
              >
                <Star size={13} /> Rate as senior manager
              </button>
            )}
            {perms.canEdit && (
              <button className="btn btn-sm btn-ghost" onClick={() => setDialog({ kind: 'edit' })}>
                <Pencil size={13} /> Edit
              </button>
            )}
            {perms.canCancel && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setDialog({ kind: 'action', action: 'cancel' })}
              >
                <Ban size={13} /> Cancel
              </button>
            )}
          </div>
        )}

        {!perms.groupReady && perms.groupReadinessReason && (
          <div className="locked-panel">
            <Lock size={17} />
            <div>
              <strong>Group submission locked.</strong> {perms.groupReadinessReason}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-main-side">
        <div className="col" style={{ gap: 18 }}>
          <SectionCard title="Task brief" icon={<FileText size={16} />}>
            <p className="prose">
              {detail.description || 'No description was provided for this task.'}
            </p>
            {detail.tags.length > 0 && (
              <div className="pill-row mt-3">
                {detail.tags.map((tag) => (
                  <span className="chip" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </SectionCard>

          {isGroup && (
            <SectionCard
              title={`Group contributions · mode ${detail.groupMode}`}
              icon={<Users size={16} />}
              subtitle={
                detail.groupMode === 'A'
                  ? 'Every member contribution requires the full two-tier approval before the leader can submit the consolidated task.'
                  : 'Only the leader’s consolidated submission is mandatory. Member contributions are tracked for visibility.'
              }
            >
              {detail.groupReadiness && (
                <div className="mb-3">
                  <Progress
                    value={
                      detail.groupReadiness.totalParts
                        ? (detail.groupReadiness.completedParts / detail.groupReadiness.totalParts) * 100
                        : 0
                    }
                    tone={detail.groupReadiness.ready ? 'green' : 'amber'}
                    label={
                      detail.groupMode === 'A'
                        ? `Mandatory contributions approved: ${detail.groupReadiness.completedMandatory}/${detail.groupReadiness.mandatoryCount}`
                        : `Tracked contributions approved: ${detail.groupReadiness.completedParts}/${detail.groupReadiness.totalParts}`
                    }
                  />
                  {detail.groupMode === 'A' && (
                    <p className="hint mt-2">
                      Consolidated submission is {detail.groupReadiness.ready ? 'unlocked' : 'locked'}.
                    </p>
                  )}
                </div>
              )}
              {detail.members.length === 0 ? (
                <p className="muted small">
                  Individual contribution tasks are generated when the group is activated.
                </p>
              ) : (
                <div className="col" style={{ gap: 0 }}>
                  {detail.members.map((member) => {
                    const part = detail.parts.find((entry) => entry.id === member.partId);
                    return (
                      <div
                        key={member.userId}
                        className="row"
                        style={{
                          padding: '11px 0',
                          borderBottom: '1px dashed var(--line)',
                          gap: 11,
                        }}
                      >
                        <Avatar name={member.fullName} color={member.avatarColor} size={31} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="person-name">
                            {member.fullName}
                            {member.isLeader && (
                              <span className="badge badge-indigo" style={{ marginLeft: 7 }}>
                                Leader
                              </span>
                            )}
                          </div>
                          <div className="person-meta">{member.title}</div>
                        </div>
                        {part ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => navigate(`/tasks/${part.id}`)}
                          >
                            {STATUS_META[part.status].short}
                            <ArrowRight size={12} />
                          </button>
                        ) : (
                          <span className="badge badge-slate">Not generated</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}

          {detail.parts.length > 0 && (
            <SectionCard
              title="Individual contributions"
              subtitle="These are separate tasks with their own independent audit trails."
              icon={<Layers size={16} />}
              bodyClass="tight"
            >
              <div className="task-list">
                {detail.parts.map((part) => (
                  <div
                    key={part.id}
                    className="task-row"
                    onClick={() => navigate(`/tasks/${part.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') navigate(`/tasks/${part.id}`);
                    }}
                  >
                    <div className="task-main">
                      <div className="task-title">{part.title}</div>
                      <div className="task-meta">
                        <StatusBadge status={part.status} />
                        <span className="row" style={{ gap: 5 }}>
                          <Avatar name={part.assigneeName} color={part.assigneeColor} size={18} />
                          {part.assigneeName}
                        </span>
                        {!part.hasManagerRating && part.status === 'COMPLETED' && (
                          <span className="chip">Rating due</span>
                        )}
                      </div>
                    </div>
                    <div className="task-side">
                      <DueDate date={part.dueDate} />
                      <ArrowRight size={13} className="muted" />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {detail.parent && (
            <SectionCard title="Parent group task" icon={<Users size={16} />}>
              <Link className="row" to={`/tasks/${detail.parent.id}`} style={{ gap: 11 }}>
                <span className="meta-row-icon">
                  <Users size={14} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="strong">{detail.parent.title}</div>
                  <div className="muted tiny">
                    Led by {detail.parent.assigneeName} · {STATUS_META[detail.parent.status].label}
                  </div>
                </div>
                <ArrowRight size={14} className="muted" style={{ marginLeft: 'auto' }} />
              </Link>
            </SectionCard>
          )}

          <SectionCard
            title="Ratings"
            subtitle="Manager and senior manager ratings are independent records with their own remarks."
            icon={<Star size={16} />}
          >
            {(['MANAGER', 'SENIOR_MANAGER'] as const).map((role) => {
              const rating = detail.ratings.find((entry) => entry.raterRole === role);
              const due =
                detail.status === 'COMPLETED' &&
                ((role === 'MANAGER' && !detail.hasManagerRating) ||
                  (role === 'SENIOR_MANAGER' && !detail.hasSeniorRating));
              return (
                <div className="rating-block" key={role}>
                  <div className="rating-head">
                    <span className={`badge ${role === 'MANAGER' ? 'badge-indigo' : 'badge-violet'}`}>
                      {role === 'MANAGER' ? 'Manager rating' : 'Senior manager rating'}
                    </span>
                    {rating ? (
                      <>
                        <Stars score={rating.score} />
                        <span className="muted tiny">
                          {rating.raterName} · {formatDateTime(rating.createdAt)}
                        </span>
                      </>
                    ) : (
                      <span className={`badge ${due ? 'badge-amber' : 'badge-slate'}`}>
                        {due ? 'Due now' : 'Not yet available'}
                      </span>
                    )}
                  </div>
                  {rating ? (
                    <div className="rating-text">{rating.remarks}</div>
                  ) : (
                    <div className="muted small" style={{ marginTop: 7 }}>
                      {due
                        ? 'This rating is due. It will be stored separately from the other approval level.'
                        : 'Ratings unlock after final senior manager approval.'}
                    </div>
                  )}
                </div>
              );
            })}
          </SectionCard>

          <SectionCard
            title="Due-date extension history"
            subtitle="Due dates only move through two-level approval."
            icon={<CalendarClock size={16} />}
            actions={
              perms.canRequestExtension ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDialog({ kind: 'extension' })}
                >
                  Request
                </button>
              ) : null
            }
          >
            {detail.extensions.length === 0 ? (
              <p className="muted small">
                No extension has been requested. The original due date of{' '}
                {formatDateLong(detail.dueDate)} is unchanged.
              </p>
            ) : (
              <>
                {detail.extensions.map((extension) => {
                  const meta = EXTENSION_STATUS_META[extension.status] || {
                    label: extension.status,
                    badge: 'badge-slate',
                  };
                  return (
                    <div className="ext-row" key={extension.id}>
                      <div className="row between wrap">
                        <div className="ext-dates">
                          <span>{formatDate(extension.currentDueDate)}</span>
                          <span className="muted">→</span>
                          <span style={{ color: 'var(--accent)' }}>
                            {formatDate(extension.requestedDueDate)}
                          </span>
                        </div>
                        <span className={`badge ${meta.badge}`}>{meta.label}</span>
                      </div>
                      <div className="ext-reason">
                        <strong>{extension.requesterName}</strong> · {extension.reason}
                      </div>
                      {extension.managerComment && (
                        <div className="ext-reason">
                          <strong>Manager:</strong> {extension.managerComment}
                        </div>
                      )}
                      {extension.seniorComment && (
                        <div className="ext-reason">
                          <strong>Senior manager:</strong> {extension.seniorComment}
                        </div>
                      )}
                      <div className="muted tiny mt-2">
                        Requested {relativeTime(extension.createdAt)}
                        {extension.decidedByName
                          ? ` · decided by ${extension.decidedByName} ${relativeTime(extension.decidedAt)}`
                          : ''}
                      </div>
                      {pending?.id === extension.id && canDecideExtension && (
                        <div className="row mt-2">
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => setDialog({ kind: 'decision', decision: 'approve' })}
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                          <button
                            className="btn btn-sm btn-danger-ghost"
                            onClick={() => setDialog({ kind: 'decision', decision: 'reject' })}
                          >
                            <Ban size={13} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </SectionCard>

          <SectionCard title="Activity trail" icon={<Clock size={16} />}>
            <Timeline events={detail.events} />
          </SectionCard>

          <SectionCard
            title="Comments"
            subtitle="Visible to everyone with access to this task and preserved permanently."
            icon={<MessageSquare size={16} />}
          >
            {detail.comments.length === 0 ? (
              <p className="muted small">No comments yet. Add context for the approval chain.</p>
            ) : (
              detail.comments.map((entry) => (
                <div className="comment" key={entry.id}>
                  <Avatar name={entry.authorName} color={entry.authorColor} size={31} />
                  <div className="comment-body">
                    <div className="comment-head">
                      <span className="comment-name">{entry.authorName}</span>
                      <span className="badge badge-slate" style={{ height: 19 }}>
                        {ROLE_LABELS[entry.authorRole]}
                      </span>
                      <span className="comment-time">{relativeTime(entry.createdAt)}</span>
                    </div>
                    <div className="comment-text">{entry.body}</div>
                  </div>
                </div>
              ))
            )}
            {perms.canComment && (
              <form className="comment-form" onSubmit={submitComment}>
                <Avatar name={user.fullName} color={user.avatarColor} size={31} />
                <div style={{ flex: 1 }}>
                  <textarea
                    className="textarea"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Add a comment to the permanent audit trail…"
                    maxLength={2000}
                    style={{ minHeight: 46 }}
                  />
                  {commentAction.error && (
                    <div className="form-error mt-2">{commentAction.error}</div>
                  )}
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={!comment.trim() || commentAction.busy}
                >
                  {commentAction.busy ? <span className="spinner" /> : <Send size={13} />}
                  Comment
                </button>
              </form>
            )}
          </SectionCard>
        </div>

        <div className="col" style={{ gap: 18 }}>
          <SectionCard title="Approval chain" icon={<ShieldCheck size={16} />}>
            <div className="chain">
              <ChainStep
                index={1}
                label="Activation"
                sub={
                  requiresActivation
                    ? activationDone
                      ? 'Approved by manager'
                      : 'Mandatory manager gate'
                    : 'Direct assignment — no activation gate'
                }
                state={activationState}
              />
              <ChainStep
                index={2}
                label="Manager review"
                sub={
                  managerApproved
                    ? 'Completion approved by manager'
                    : detail.status === 'RETURNED_TO_MANAGER'
                      ? 'Senior manager returned this — decide next step'
                      : 'First completion approval'
                }
                state={managerState}
              />
              <ChainStep
                index={3}
                label="Senior manager review"
                sub={
                  seniorApproved
                    ? 'Final approval recorded'
                    : detail.status === 'RETURNED_TO_MANAGER'
                      ? 'Awaiting manager decision'
                      : 'Final completion approval'
                }
                state={seniorState}
              />
              <ChainStep
                index={4}
                label="Independent ratings"
                sub={
                  ratingsDone
                    ? 'Both ratings recorded'
                    : detail.status === 'COMPLETED'
                      ? 'Ratings are due'
                      : 'Unlocks after completion'
                }
                state={ratingState}
              />
            </div>
          </SectionCard>

          {detail.dueRisk && (
            <SectionCard title="Due-date risk" icon={<AlertTriangle size={16} />}>
              <div className="row between" style={{ marginBottom: 9 }}>
                <span className="muted small">Risk score</span>
                <span className={`badge ${detail.dueRisk.level === 'CRITICAL' ? 'badge-rose' : detail.dueRisk.level === 'HIGH' ? 'badge-amber' : 'badge-green'}`}>
                  {detail.dueRisk.level} · {detail.dueRisk.score}
                </span>
              </div>
              <Progress
                value={detail.dueRisk.score}
                tone={detail.dueRisk.level === 'CRITICAL' ? 'rose' : detail.dueRisk.level === 'HIGH' ? 'amber' : 'green'}
              />
              <div className="col mt-3" style={{ gap: 6 }}>
                {detail.dueRisk.reasons.map((reason) => (
                  <div className="muted small row" key={reason} style={{ gap: 7 }}>
                    <span className="priority"></span>
                    {reason}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard title="People & dates" icon={<UserRound size={16} />}>
            <div className="meta-list">
              <MetaRow
                icon={<UserRound size={14} />}
                label="Assignee"
                value={
                  <span className="row" style={{ gap: 7 }}>
                    <Avatar name={detail.assigneeName} color={detail.assigneeColor} size={21} />
                    {detail.assigneeName}
                  </span>
                }
              />
              <MetaRow
                icon={<UserRound size={14} />}
                label="Created by"
                value={
                  <span className="row" style={{ gap: 7 }}>
                    <Avatar name={detail.creatorName} color={detail.creatorColor} size={21} />
                    {detail.creatorName} · {ROLE_LABELS[detail.creatorRole]}
                  </span>
                }
              />
              <MetaRow
                icon={<ShieldCheck size={14} />}
                label="Level 1 approver"
                value={detail.managerName}
              />
              <MetaRow
                icon={<ShieldCheck size={14} />}
                label="Level 2 approver"
                value={detail.seniorManagerName}
              />
              <MetaRow icon={<Users size={14} />} label="Department" value={detail.departmentName} />
              <MetaRow
                icon={<CalendarDays size={14} />}
                label="Due date"
                value={
                  <>
                    {formatDateLong(detail.dueDate)}{' '}
                    {detail.originalDueDate && detail.originalDueDate !== detail.dueDate && (
                      <span className="muted tiny"> (original {formatDate(detail.originalDueDate)})</span>
                    )}
                  </>
                }
              />
              {detail.startDate && (
                <MetaRow
                  icon={<CalendarDays size={14} />}
                  label="Start date"
                  value={formatDateLong(detail.startDate)}
                />
              )}
              <MetaRow
                icon={<Clock size={14} />}
                label="Effort"
                value={formatHours(detail.effortHours)}
              />
              <MetaRow
                icon={<Flag size={14} />}
                label="Created"
                value={formatDateTime(detail.createdAt)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Policy guardrails" icon={<Lock size={16} />} bodyClass="tight">
            <div className="col" style={{ gap: 0 }}>
              {[
                'Activation approval cannot be skipped or self-approved.',
                'Manager and senior manager must both approve completion.',
                'Senior rejection always returns to the manager.',
                'Due dates only move through two-level extension approval.',
                'Manager and senior ratings are stored separately.',
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
        </div>
      </div>

      <ActionDialog
        open={dialog?.kind === 'action'}
        onClose={() => setDialog(null)}
        task={detail}
        action={dialog?.kind === 'action' ? dialog.action : 'start'}
        onDone={() => {
          task.reload();
        }}
      />
      <ExtensionRequestDialog
        open={dialog?.kind === 'extension'}
        onClose={() => setDialog(null)}
        task={detail}
        onDone={() => task.reload()}
      />
      {pending && canDecideExtension && (
        <ExtensionDecisionDialog
          open={dialog?.kind === 'decision'}
          onClose={() => setDialog(null)}
          extension={{ ...pending, taskTitle: detail.title }}
          decision={dialog?.kind === 'decision' ? dialog.decision : 'approve'}
          onDone={() => {
            task.reload();
          }}
        />
      )}
      <RatingDialog
        open={dialog?.kind === 'rating'}
        onClose={() => setDialog(null)}
        task={detail}
        role={dialog?.kind === 'rating' ? dialog.role : 'MANAGER'}
        onDone={() => task.reload()}
      />
      <EditTaskDialog
        open={dialog?.kind === 'edit'}
        onClose={() => setDialog(null)}
        task={detail}
        onDone={() => task.reload()}
      />
    </div>
  );
}
