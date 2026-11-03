import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Inbox,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { ROLE_LABELS } from '../lib/constants';
import { formatDate, formatPercent, relativeTime } from '../lib/format';
import type { Dashboard } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { ActivityFeed, TaskRow } from '../components/tasks';
import { TaskCreateModal } from '../components/TaskCreateModal';
import {
  Avatar,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  Progress,
  SectionCard,
  StatCard,
} from '../components/ui';
import { useState } from 'react';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dashboard = useApi<Dashboard>(() => api.dashboard(), []);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    document.title = 'Dashboard · Meridian';
  }, []);

  if (!user) return null;
  if (dashboard.loading && !dashboard.data) return <LoadingBlock label="Building your workspace…" />;
  if (dashboard.error) return <ErrorBlock message={dashboard.error} onRetry={dashboard.reload} />;
  if (!dashboard.data) return null;

  const data = dashboard.data;
  const { stats } = data;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user.fullName.split(' ')[0];
  const scopeLabel =
    user.role === 'ADMIN'
      ? 'organisation-wide'
      : user.role === 'SENIOR_MANAGER'
        ? `${user.departmentName || 'department'} scope`
        : user.role === 'MANAGER'
          ? 'your reporting team'
          : 'your workspace';

  function openTask(id: string) {
    navigate(`/tasks/${id}`);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={
          <>
            <Sparkles size={13} /> {greeting}
          </>
        }
        title={`${firstName}, here’s what needs you`}
        subtitle={`Live view of ${scopeLabel}. Approval gates, due dates and AI risk are calculated by the API from only the data you’re allowed to see.`}
        actions={
          <>
            {user.role !== 'ADMIN' && (
              <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                <ListChecks size={15} /> New task
              </button>
            )}
            <button className="btn btn-subtle" onClick={() => navigate('/approvals')}>
              <Inbox size={15} /> Action Center
              {data.approvals.total > 0 && (
                <span className="badge badge-rose" style={{ marginLeft: 2 }}>
                  {data.approvals.total}
                </span>
              )}
            </button>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard
          icon={<ListChecks size={15} />}
          label={user.role === 'EMPLOYEE' ? 'My open tasks' : 'Open in scope'}
          value={stats.openTasks}
          foot={
            user.role !== 'EMPLOYEE' ? (
              <span>{stats.teamOpen} held by your team</span>
            ) : (
              <span>Across standard and group work</span>
            )
          }
        />
        <StatCard
          icon={<Inbox size={15} />}
          label="Awaiting your action"
          value={stats.awaitingAction}
          tone="amber"
          foot={
            data.approvals.total > 0 ? (
              <span>{data.approvals.total} total approval items</span>
            ) : (
              <span>Nothing blocking your queue</span>
            )
          }
        />
        <StatCard
          icon={<AlertTriangle size={15} />}
          label="Overdue"
          value={stats.overdue}
          tone="rose"
          foot={<span>{stats.ratingDue} ratings still due</span>}
        />
        <StatCard
          icon={<CheckCircle2 size={15} />}
          label="Completed this month"
          value={stats.completedThisMonth}
          tone="teal"
          foot={
            <span>
              <TrendingUp size={12} /> {formatPercent(stats.completionRate)} completion rate
            </span>
          }
        />
      </div>

      <div className="grid grid-main-side">
        <div className="col" style={{ gap: 18 }}>
          <section className="insight-hero">
            <div className="row between wrap" style={{ gap: 12 }}>
              <span className="insight-tag">
                <Sparkles size={11} /> AI brief · {data.insights.source === 'llm' ? 'live model' : 'built-in analysis'}
              </span>
              <span className="muted tiny" style={{ color: '#93a1c4' }}>
                Generated {relativeTime(data.insights.generatedAt)} from {data.insights.scopeLabel}
              </span>
            </div>
            <h2 style={{ marginTop: 14 }}>Your delivery picture</h2>
            <p>{data.insights.summary}</p>
            <div className="row wrap" style={{ gap: 18, marginTop: 18, fontSize: 12.5 }}>
              <span>
                <strong style={{ color: '#fff' }}>{data.insights.totals.open}</strong> open
              </span>
              <span>
                <strong style={{ color: '#fda4af' }}>{data.insights.totals.overdue}</strong> overdue
              </span>
              <span>
                <strong style={{ color: '#fcd34d' }}>{data.insights.totals.dueSoon}</strong> due soon
              </span>
              <span>
                <strong style={{ color: '#fff' }}>{data.insights.totals.pendingApprovals}</strong>{' '}
                approvals pending
              </span>
            </div>
            <div className="row mt-3" style={{ gap: 10 }}>
              <button className="btn btn-subtle btn-sm" onClick={() => navigate('/insights')}>
                Open full insights <ArrowRight size={13} />
              </button>
            </div>
          </section>

          <SectionCard
            title="Your action queue"
            subtitle={
              data.actions.length
                ? 'Work that is waiting on your decision or delivery'
                : 'Nothing is waiting on you right now'
            }
            icon={<Inbox size={16} />}
            actions={
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/approvals')}>
                Action Center <ArrowRight size={13} />
              </button>
            }
            bodyClass="tight"
          >
            {data.actions.length === 0 ? (
              <EmptyState
                title="Action queue is clear"
                description="New approvals, rework requests and extension decisions will appear here automatically."
                icon={<CheckCircle2 size={20} />}
              />
            ) : (
              <div className="task-list">
                {data.actions.map((action) => (
                  <div
                    key={`${action.type}-${action.task.id}`}
                    className="task-row needs-action"
                    onClick={() => openTask(action.task.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') openTask(action.task.id);
                    }}
                  >
                    <div className="task-main">
                      <div className="task-title">{action.task.title}</div>
                      <div className="task-meta">
                        <span className="badge badge-amber">{action.label}</span>
                        <span className="row" style={{ gap: 5 }}>
                          <Avatar
                            name={action.task.assigneeName}
                            color={action.task.assigneeColor}
                            size={18}
                          />
                          {action.task.assigneeName}
                        </span>
                        {action.task.dueDate && <span>Due {formatDate(action.task.dueDate, false)}</span>}
                        <span className="priority">{action.urgency}</span>
                      </div>
                    </div>
                    <div className="task-side">
                      <span className="task-action-label">
                        <ArrowRight size={12} /> Open
                      </span>
                    </div>
                  </div>
                ))}
                {data.actionOverflow > 0 && (
                  <div style={{ padding: '12px 18px' }} className="muted small">
                    +{data.actionOverflow} more in the Action Center
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Focus"
            subtitle="Nearest due dates among work assigned to you or your team"
            icon={<Target size={16} />}
            actions={
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks')}>
                All tasks <ArrowRight size={13} />
              </button>
            }
            bodyClass="tight"
          >
            {data.focus.length === 0 ? (
              <EmptyState
                title="No tasks in flight"
                description="Create a task or wait for one to be assigned."
                icon={<ListChecks size={20} />}
              />
            ) : (
              <div className="task-list">
                {data.focus.map((task) => (
                  <TaskRow key={task.id} task={task} onClick={() => openTask(task.id)} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="col" style={{ gap: 18 }}>
          <SectionCard title="Queue breakdown" icon={<BarChart3 size={16} />}>
            <div className="col" style={{ gap: 11 }}>
              {[
                { label: 'Activation approvals', value: data.approvals.creation, tone: 'amber' },
                { label: 'Manager reviews', value: data.approvals.manager, tone: 'amber' },
                { label: 'Senior reviews', value: data.approvals.senior, tone: 'violet' },
                { label: 'Returned to manager', value: data.approvals.returned, tone: 'rose' },
                { label: 'Extension decisions', value: data.approvals.extensions, tone: 'blue' },
                { label: 'Ratings due', value: data.approvals.ratings, tone: 'teal' },
              ].map((row) => (
                <div key={row.label} className="row between small">
                  <span className="muted">{row.label}</span>
                  <span className="strong">{row.value}</span>
                </div>
              ))}
              <div className="divider" />
              <div className="row between">
                <span className="small strong">Total</span>
                <span className="badge badge-indigo">{data.approvals.total}</span>
              </div>
            </div>
          </SectionCard>

          {data.teamPreview && (
            <SectionCard
              title="Team pulse"
              subtitle={data.teamPreview.scopeLabel}
              icon={<Users size={16} />}
              actions={
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/team')}>
                  Team <ArrowRight size={13} />
                </button>
              }
              bodyClass="tight"
            >
              <div className="col" style={{ gap: 12 }}>
                {data.teamPreview.members.slice(0, 4).map((member) => (
                  <div key={member.id} className="row" style={{ gap: 10 }}>
                    <Avatar name={member.fullName} color={member.avatarColor} size={30} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="person-name">{member.fullName}</div>
                      <div className="person-meta">
                        {member.openTasks} open · {member.overdue} overdue
                      </div>
                    </div>
                    <div style={{ width: 74 }}>
                      <Progress
                        value={member.completionRate}
                        tone={member.overdue > 0 ? 'amber' : 'green'}
                      />
                    </div>
                  </div>
                ))}
                <div className="divider" />
                <div className="row between small muted">
                  <span>{data.teamPreview.summary.people} {data.teamPreview.summary.people === 1 ? 'person' : 'people'}</span>
                  <span>{formatPercent(data.teamPreview.summary.avgCompletionRate)} avg completion</span>
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Recent activity" icon={<Clock size={16} />} bodyClass="tight">
            <ActivityFeed events={data.activity.slice(0, 8)} />
          </SectionCard>

          <SectionCard title="Your scope" icon={<Target size={16} />}>
            <div className="meta-list">
              <div>
                <div className="meta-row-label">Signed in as</div>
                <div className="meta-row-value">{user.fullName}</div>
              </div>
              <div>
                <div className="meta-row-label">Role</div>
                <div className="meta-row-value">{ROLE_LABELS[user.role]}</div>
              </div>
              <div>
                <div className="meta-row-label">Visibility</div>
                <div className="meta-row-value" style={{ textTransform: 'capitalize' }}>
                  {scopeLabel}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <TaskCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(task) => navigate(`/tasks/${task.id}`)}
      />
    </div>
  );
}
