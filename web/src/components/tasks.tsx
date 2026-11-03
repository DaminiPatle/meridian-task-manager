import { AlertTriangle, CheckCircle2, Circle, Clock, Users } from 'lucide-react';
import { EVENT_LABELS } from '../lib/constants';
import { formatDateTime } from '../lib/format';
import type { Task, TaskEvent } from '../lib/types';
import { Avatar, DueDate, PriorityTag, StatusBadge, Stars } from './ui';

export function TaskRow({
  task,
  onClick,
  showAssignee = true,
  showCreator = false,
}: {
  task: Task;
  onClick: () => void;
  showAssignee?: boolean;
  showCreator?: boolean;
}) {
  const isPart = task.taskKind === 'GROUP_PART';
  return (
    <div
      className={`task-row ${task.needsMyAction ? 'needs-action' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick();
      }}
    >
      <div className="task-main">
        <div className="task-title">
          {task.title}
          {task.taskKind === 'GROUP' && (
            <span className="badge badge-violet">
              <Users size={10} /> Group {task.groupMode}
            </span>
          )}
          {isPart && (
            <span className="badge badge-slate">
              <Users size={10} /> Contribution
            </span>
          )}
          {task.pendingExtensionCount > 0 && (
            <span className="badge badge-amber" title="A due-date extension is in flight">
              <Clock size={10} /> Extension
            </span>
          )}
        </div>
        <div className="task-meta">
          <StatusBadge status={task.status} />
          <PriorityTag priority={task.priority} />
          {showAssignee && (
            <span className="row" style={{ gap: 6 }}>
              <Avatar name={task.assigneeName} color={task.assigneeColor} size={19} />
              <span>{task.assigneeName}</span>
            </span>
          )}
          {showCreator && task.createdBy !== task.assigneeId && (
            <span>Created by {task.creatorName}</span>
          )}
          {task.taskKind === 'GROUP' && task.partCount > 0 && (
            <span>
              {task.partCompleted}/{task.partCount} contributions done
            </span>
          )}
          {task.hasManagerRating && task.hasSeniorRating && (
            <span className="badge badge-green" style={{ height: 20 }}>
              <CheckCircle2 size={10} /> Rated
            </span>
          )}
        </div>
      </div>
      <div className="task-side">
        <DueDate date={task.dueDate} />
        {task.myActionLabel && (
          <span className="task-action-label">
            <AlertTriangle size={12} />
            {task.myActionLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function RatingSummary({ task }: { task: Task }) {
  return (
    <span className="pill-row">
      {task.hasManagerRating ? (
        <span className="chip" title="Manager rating recorded">
          Manager rated
        </span>
      ) : (
        <span className="chip">Manager rating due</span>
      )}
      {task.hasSeniorRating ? (
        <span className="chip" title="Senior manager rating recorded">
          Senior rated
        </span>
      ) : (
        <span className="chip">Senior rating due</span>
      )}
    </span>
  );
}

export function EventIcon({ action }: { action: string }) {
  if (action.includes('approve') || action === 'senior_approve')
    return <CheckCircle2 size={14} />;
  if (action.includes('reject') || action.includes('correction') || action === 'cancel')
    return <AlertTriangle size={14} />;
  if (action.startsWith('extension')) return <Clock size={14} />;
  if (action === 'rating_submitted' || action === 'rating_updated') return <Stars score={1} size={12} />;
  return <Circle size={13} />;
}

export function Timeline({ events }: { events: TaskEvent[] }) {
  if (events.length === 0) {
    return <p className="muted small">No activity has been recorded yet.</p>;
  }
  return (
    <div className="timeline">
      {events.map((event) => (
        <div className="timeline-item" key={event.id}>
          <Avatar
            name={event.actorName}
            color={event.actorColor}
            size={27}
            title={`${event.actorName}${event.actorRole ? ` · ${event.actorRole}` : ''}`}
          />
          <div className="timeline-body">
            <div className="timeline-head">
              <strong>{event.actorName}</strong>
              <span className="timeline-action">
                {EVENT_LABELS[event.action] || event.action.replace(/_/g, ' ')}
              </span>
              <span className="timeline-time">{formatDateTime(event.createdAt)}</span>
            </div>
            {event.comment && <div className="timeline-comment">{event.comment}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed({
  events,
}: {
  events: {
    id: string;
    action: string;
    comment: string;
    createdAt: string;
    taskId: string;
    taskTitle: string;
    actorName: string;
    actorColor: string;
  }[];
}) {
  if (events.length === 0) {
    return <p className="muted small">No recent activity in your scope.</p>;
  }
  return (
    <div className="feed">
      {events.map((event) => (
        <div className="feed-item" key={event.id}>
          <span className="feed-icon">
            <EventIcon action={event.action} />
          </span>
          <div className="feed-content">
            <strong>{event.actorName}</strong>{' '}
            {EVENT_LABELS[event.action] || event.action.replace(/_/g, ' ')}{' '}
            <strong>{event.taskTitle}</strong>
            {event.comment && <div className="muted tiny mt-2">“{event.comment}”</div>}
            <div className="feed-time">{formatDateTime(event.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
