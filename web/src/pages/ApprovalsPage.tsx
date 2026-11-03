import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Inbox,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, relativeTime } from '../lib/format';
import type { Approvals, ApprovalExtension, Task } from '../lib/types';
import { useApi } from '../hooks/useApi';
import { ExtensionDecisionDialog } from '../components/dialogs';
import { TaskRow } from '../components/tasks';
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatCard,
  TabBar,
} from '../components/ui';

type Category =
  | 'creation'
  | 'manager'
  | 'senior'
  | 'returned'
  | 'ratings'
  | 'rework'
  | 'submissions'
  | 'groups';

interface QueueItem {
  task: Task;
  category: Category;
  label: string;
}

const CATEGORY_META: Record<Category, { label: string; badge: string }> = {
  creation: { label: 'Activation approval', badge: 'badge-amber' },
  manager: { label: 'Manager review', badge: 'badge-amber' },
  senior: { label: 'Senior review', badge: 'badge-violet' },
  returned: { label: 'Returned to manager', badge: 'badge-rose' },
  ratings: { label: 'Rating due', badge: 'badge-teal' },
  rework: { label: 'Needs rework', badge: 'badge-rose' },
  submissions: { label: 'In approval', badge: 'badge-blue' },
  groups: { label: 'Group ready to submit', badge: 'badge-indigo' },
};

export default function ApprovalsPage() {
  const navigate = useNavigate();
  const approvals = useApi<Approvals>(() => api.approvals(), []);
  const [tab, setTab] = useState('all');
  const [decision, setDecision] = useState<{
    extension: ApprovalExtension;
    decision: 'approve' | 'reject';
  } | null>(null);

  useEffect(() => {
    document.title = 'Action Center · Meridian';
  }, []);

  const data = approvals.data;

  const items = useMemo<QueueItem[]>(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const output: QueueItem[] = [];
    const push = (tasks: Task[], category: Category) => {
      for (const task of tasks) {
        const key = `${category}-${task.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        output.push({ task, category, label: CATEGORY_META[category].label });
      }
    };
    push(data.creation, 'creation');
    push(data.managerReviews, 'manager');
    push(data.seniorReviews, 'senior');
    push(data.returned, 'returned');
    push(data.readyGroups, 'groups');
    push(data.needsRework, 'rework');
    push(data.ratingsDue, 'ratings');
    push(data.mySubmissions, 'submissions');
    return output;
  }, [data]);

  if (approvals.loading && !data) return <LoadingBlock label="Assembling your action queue…" />;
  if (approvals.error) return <ErrorBlock message={approvals.error} onRetry={approvals.reload} />;
  if (!data) return null;

  const counts = {
    all: items.length + data.extensions.length,
    activation: data.creation.length,
    manager: data.managerReviews.length + data.returned.length,
    senior: data.seniorReviews.length,
    extensions: data.extensions.length,
    ratings: data.ratingsDue.length,
    rework: data.needsRework.length,
    submissions: data.mySubmissions.length,
    groups: data.readyGroups.length,
  };

  const visibleTasks = items.filter((item) => {
    if (tab === 'all') return true;
    if (tab === 'activation') return item.category === 'creation';
    if (tab === 'manager') return item.category === 'manager' || item.category === 'returned';
    if (tab === 'senior') return item.category === 'senior';
    if (tab === 'ratings') return item.category === 'ratings';
    if (tab === 'rework') return item.category === 'rework';
    if (tab === 'groups') return item.category === 'groups';
    return true;
  });

  const visibleExtensions = tab === 'all' || tab === 'extensions' ? data.extensions : [];

  return (
    <div className="page">
      <PageHeader
        eyebrow={
          <>
            <Inbox size={13} /> Your queue
          </>
        }
        title="Action Center"
        subtitle="Everything that depends on your decision, in the order the workflow generated it. The API decides what you can action — not the interface."
      />

      <div className="stat-grid">
        <StatCard
          icon={<Inbox size={15} />}
          label="Total action items"
          value={data.total}
          tone="amber"
          foot={<span>Across approvals, extensions and ratings</span>}
        />
        <StatCard
          icon={<ShieldCheck size={15} />}
          label="Completion reviews"
          value={data.managerReviews.length + data.seniorReviews.length}
          foot={<span>{data.returned.length} returned to manager</span>}
        />
        <StatCard
          icon={<CalendarClock size={15} />}
          label="Extension decisions"
          value={data.extensions.length}
          tone="rose"
          foot={<span>Two-level due-date control</span>}
        />
        <StatCard
          icon={<Star size={15} />}
          label="Ratings due"
          value={data.ratingsDue.length}
          tone="teal"
          foot={<span>Independent per approval level</span>}
        />
      </div>

      <div className="card">
        <div className="card-head" style={{ minHeight: 56 }}>
          <TabBar
            items={[
              { key: 'all', label: 'Everything', count: counts.all },
              { key: 'activation', label: 'Activation', count: counts.activation },
              { key: 'manager', label: 'Manager', count: counts.manager },
              { key: 'senior', label: 'Senior', count: counts.senior },
              { key: 'extensions', label: 'Extensions', count: counts.extensions },
              { key: 'ratings', label: 'Ratings', count: counts.ratings },
              { key: 'rework', label: 'Rework', count: counts.rework },
              { key: 'groups', label: 'Groups ready', count: counts.groups },
              { key: 'submissions', label: 'My submissions', count: counts.submissions },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div className="card-head-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => approvals.reload()}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-main-side">
        <div className="col" style={{ gap: 18 }}>
          <SectionCard
            title="Pending decisions"
            subtitle="Activation, completion review and rework items"
            icon={<CheckCircle2 size={16} />}
            bodyClass="tight"
          >
            {visibleTasks.length === 0 ? (
              <EmptyState
                title="Nothing in this queue"
                description="When work enters an approval stage that needs you, it appears here automatically."
                icon={<CheckCircle2 size={20} />}
              />
            ) : (
              <div className="task-list">
                {visibleTasks.map((item) => (
                  <div key={`${item.category}-${item.task.id}`}>
                    {tab === 'all' && (
                      <div
                        style={{
                          padding: '9px 18px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span className={`badge ${CATEGORY_META[item.category].badge}`}>
                          {item.label}
                        </span>
                      </div>
                    )}
                    <TaskRow task={item.task} onClick={() => navigate(`/tasks/${item.task.id}`)} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {visibleExtensions.length > 0 && (
            <SectionCard
              title="Timeline extension requests"
              subtitle="Due dates only change after manager and senior manager approval."
              icon={<CalendarClock size={16} />}
              bodyClass="tight"
            >
              {visibleExtensions.map((extension) => (
                <div
                  key={extension.id}
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <div className="row between wrap" style={{ gap: 10 }}>
                    <button
                      className="btn-link strong"
                      style={{ fontSize: 13.5 }}
                      onClick={() => navigate(`/tasks/${extension.taskId}`)}
                    >
                      {extension.task.title}
                    </button>
                    <span
                      className={`badge ${
                        extension.status === 'PENDING_SENIOR' ? 'badge-violet' : 'badge-amber'
                      }`}
                    >
                      {extension.status === 'PENDING_SENIOR'
                        ? 'Awaiting senior manager'
                        : 'Awaiting manager'}
                    </span>
                  </div>
                  <div className="ext-dates mt-2">
                    <span className="muted">{extension.task.assigneeName}</span>
                    <span>{formatDate(extension.currentDueDate)}</span>
                    <span className="muted">→</span>
                    <span style={{ color: 'var(--accent)' }}>
                      {formatDate(extension.requestedDueDate)}
                    </span>
                  </div>
                  <div className="ext-reason">{extension.reason}</div>
                  <div className="row mt-2" style={{ gap: 8 }}>
                    <span className="muted tiny">Requested {relativeTime(extension.createdAt)}</span>
                    <div style={{ marginLeft: 'auto' }} className="row">
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => setDecision({ extension, decision: 'approve' })}
                      >
                        <CheckCircle2 size={13} /> Approve
                      </button>
                      <button
                        className="btn btn-sm btn-danger-ghost"
                        onClick={() => setDecision({ extension, decision: 'reject' })}
                      >
                        <AlertTriangle size={13} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </SectionCard>
          )}
        </div>

        <div className="col" style={{ gap: 18 }}>
          <SectionCard title="How this queue works" icon={<ShieldCheck size={16} />}>
            <div className="col" style={{ gap: 0 }}>
              {[
                {
                  title: 'Activation gate',
                  body: 'Self-created tasks wait for the manager. The creator can never approve their own task.',
                },
                {
                  title: 'Two-tier completion',
                  body: 'Manager approval moves the task to the senior manager. Both levels are required.',
                },
                {
                  title: 'Senior rejection routing',
                  body: 'A senior rejection returns to the manager, who chooses corrections or resubmission.',
                },
                {
                  title: 'Controlled due dates',
                  body: 'Extensions require manager then senior manager approval before the date changes.',
                },
                {
                  title: 'Independent ratings',
                  body: 'Manager and senior manager rate separately after completion; neither overwrites the other.',
                },
              ].map((entry) => (
                <div className="guardrail" key={entry.title}>
                  <span className="guardrail-check">
                    <CheckCircle2 size={12} />
                  </span>
                  <span>
                    <strong>{entry.title}.</strong> {entry.body}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Queue snapshot" icon={<Clock size={16} />}>
            <div className="col" style={{ gap: 10 }}>
              {[
                { label: 'Activation approvals', value: data.creation.length },
                { label: 'Manager completion reviews', value: data.managerReviews.length },
                { label: 'Senior completion reviews', value: data.seniorReviews.length },
                { label: 'Returned to manager', value: data.returned.length },
                { label: 'Group submissions ready', value: data.readyGroups.length },
                { label: 'Rework outstanding', value: data.needsRework.length },
                { label: 'Ratings due', value: data.ratingsDue.length },
                { label: 'Submissions in approval', value: data.mySubmissions.length },
              ].map((row) => (
                <div key={row.label} className="row between small">
                  <span className="muted">{row.label}</span>
                  <span className="strong">{row.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Shortcuts" icon={<ArrowRight size={16} />}>
            <div className="col" style={{ gap: 8 }}>
              <button className="btn btn-subtle btn-block" onClick={() => navigate('/tasks?due=overdue')}>
                <AlertTriangle size={14} /> Review overdue work
              </button>
              <button className="btn btn-subtle btn-block" onClick={() => navigate('/tasks?kind=GROUP')}>
                <Users size={14} /> Group tasks
              </button>
              <button className="btn btn-subtle btn-block" onClick={() => navigate('/insights')}>
                <Star size={14} /> AI workload insight
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      {decision && (
        <ExtensionDecisionDialog
          open
          onClose={() => setDecision(null)}
          extension={{ ...decision.extension, taskTitle: decision.extension.task.title }}
          decision={decision.decision}
          onDone={() => {
            setDecision(null);
            void approvals.reload();
          }}
        />
      )}
    </div>
  );
}
