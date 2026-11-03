import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { AI_SOURCE_LABELS, ROLE_LABELS, STATUS_META } from '../lib/constants';
import { formatDate, formatScore, relativeTime } from '../lib/format';
import type { Insights } from '../lib/types';
import { useApi } from '../hooks/useApi';
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

const LEVEL_BADGE: Record<string, string> = {
  LOW: 'badge-green',
  MEDIUM: 'badge-blue',
  HIGH: 'badge-amber',
  CRITICAL: 'badge-rose',
};

export default function InsightsPage() {
  const navigate = useNavigate();
  const result = useApi<{ insights: Insights }>(() => api.insights(), []);

  useEffect(() => {
    document.title = 'AI Insights · Meridian';
  }, []);

  if (result.loading && !result.data) return <LoadingBlock label="Analysing permitted scope…" />;
  if (result.error) return <ErrorBlock message={result.error} onRetry={result.reload} />;
  if (!result.data) return null;

  const insights = result.data.insights;

  return (
    <div className="page">
      <PageHeader
        eyebrow={
          <>
            <Sparkles size={13} /> Scoped intelligence
          </>
        }
        title="AI Insights"
        subtitle="Workload and due-date risk are computed from only the tasks and people you are authorised to see. No cross-team inference is possible."
        actions={
          <button className="btn btn-subtle" onClick={() => result.reload()} disabled={result.loading}>
            <RefreshCw size={15} /> {result.loading ? 'Refreshing…' : 'Refresh analysis'}
          </button>
        }
      />

      <section className="insight-hero">
        <div className="row between wrap" style={{ gap: 12 }}>
          <span className="insight-tag">
            <Brain size={11} /> {AI_SOURCE_LABELS[insights.source] || insights.source || 'Analysis'}
          </span>
          <span className="muted tiny" style={{ color: '#93a1c4' }}>
            {insights.scopeLabel} · generated {relativeTime(insights.generatedAt)}
          </span>
        </div>
        <h2 style={{ marginTop: 14 }}>What the workload picture says</h2>
        <p>{insights.summary}</p>
        <div className="row wrap" style={{ gap: 22, marginTop: 20, fontSize: 12.5 }}>
          <span>
            <strong style={{ color: '#fff' }}>{insights.totals.open}</strong> open
          </span>
          <span>
            <strong style={{ color: '#fda4af' }}>{insights.totals.overdue}</strong> overdue
          </span>
          <span>
            <strong style={{ color: '#fcd34d' }}>{insights.totals.dueSoon}</strong> due soon
          </span>
          <span>
            <strong style={{ color: '#fff' }}>{insights.totals.pendingApprovals}</strong> approvals
          </span>
          <span>
            <strong style={{ color: '#fff' }}>{insights.totals.people}</strong>{' '}
            {insights.totals.people === 1 ? 'person' : 'people'}
          </span>
        </div>
      </section>

      <div className="stat-grid">
        <StatCard
          icon={<Users size={15} />}
          label="Open work"
          value={insights.totals.open}
          foot={<span>{insights.totals.people} {insights.totals.people === 1 ? 'person' : 'people'} in scope</span>}
        />
        <StatCard
          icon={<AlertTriangle size={15} />}
          label="Overdue"
          value={insights.totals.overdue}
          tone="rose"
          foot={<span>Risk-ranked below</span>}
        />
        <StatCard
          icon={<Clock size={15} />}
          label="Due soon"
          value={insights.totals.dueSoon}
          tone="amber"
          foot={<span>Within the next 3 days</span>}
        />
        <StatCard
          icon={<CheckCircle2 size={15} />}
          label="Pending approvals"
          value={insights.totals.pendingApprovals}
          tone="teal"
          foot={<span>{insights.totals.completedThisMonth} completed this month</span>}
        />
      </div>

      <div className="grid grid-main-side">
        <div className="col" style={{ gap: 18 }}>
          <SectionCard
            title="Workload by person"
            subtitle="Open tasks, due pressure and effort estimate rolled into a single risk score"
            icon={<Users size={16} />}
            bodyClass="tight"
          >
            {insights.workload.length === 0 ? (
              <EmptyState
                title="No workload in scope"
                description="There are no open tasks assigned to people you can see."
                icon={<Users size={20} />}
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th className="num">Open</th>
                      <th className="num">Overdue</th>
                      <th className="num">Due soon</th>
                      <th className="num">Effort</th>
                      <th style={{ width: 160 }}>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.workload.map((entry) => (
                      <tr key={entry.userId}>
                        <td>
                          <div className="row" style={{ gap: 9 }}>
                            <Avatar name={entry.name} color={entry.avatarColor} size={28} />
                            <div>
                              <div className="strong">{entry.name}</div>
                              <div className="muted tiny">
                                {entry.title} · {ROLE_LABELS[entry.role]}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="num">{entry.openTasks}</td>
                        <td
                          className="num"
                          style={{ color: entry.overdue ? 'var(--rose)' : undefined }}
                        >
                          {entry.overdue}
                        </td>
                        <td className="num">{entry.dueSoon}</td>
                        <td className="num">{entry.effortHours}h</td>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <span className={`badge ${LEVEL_BADGE[entry.riskLevel]}`}>
                              {entry.riskLevel}
                            </span>
                            <div className="risk-meter" style={{ flex: 1, minWidth: 60 }}>
                              <div className="track">
                                <div
                                  className={`fill ${entry.riskLevel}`}
                                  style={{ width: `${Math.min(100, entry.riskScore)}%` }}
                                />
                              </div>
                              <span className="muted tiny">{entry.riskScore}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Due-date risk ranking"
            subtitle="Highest-risk work first, with the reasons behind each score"
            icon={<AlertTriangle size={16} />}
            bodyClass="tight"
          >
            {insights.risks.length === 0 ? (
              <EmptyState
                title="No at-risk deadlines"
                description="No overdue or near-due work was detected in your permitted scope."
                icon={<CheckCircle2 size={20} />}
              />
            ) : (
              <div style={{ padding: '4px 18px' }}>
                {insights.risks.map((risk, index) => (
                  <div className="risk-item" key={risk.taskId}>
                    <span className="risk-rank">{index + 1}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <button
                        className="btn-link strong"
                        style={{ fontSize: 13, textAlign: 'left' }}
                        onClick={() => navigate(`/tasks/${risk.taskId}`)}
                      >
                        {risk.title}
                      </button>
                      <div className="row wrap" style={{ gap: 12, marginTop: 4 }}>
                        <span className="row" style={{ gap: 5 }}>
                          <Avatar
                            name={risk.assigneeName}
                            color={risk.assigneeColor}
                            size={17}
                          />
                          <span className="person-meta">{risk.assigneeName}</span>
                        </span>
                        <span className="person-meta">{STATUS_META[risk.status].label}</span>
                        <span className="person-meta">
                          {risk.dueDate ? `Due ${formatDate(risk.dueDate)}` : 'No due date'}
                        </span>
                      </div>
                      <div className="pill-row mt-2">
                        {risk.reasons.map((reason) => (
                          <span className="chip" key={reason}>
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className={`badge ${LEVEL_BADGE[risk.riskLevel]}`}>
                      {risk.riskLevel} · {risk.riskScore}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="col" style={{ gap: 18 }}>
          <SectionCard title="Suggested interventions" icon={<Lightbulb size={16} />}>
            {insights.suggestions.length === 0 ? (
              <p className="muted small">
                No intervention is suggested for the current scope. Keep monitoring due dates.
              </p>
            ) : (
              insights.suggestions.map((suggestion, index) => (
                <div className="suggestion" key={`${index}-${suggestion.slice(0, 12)}`}>
                  <span className="suggestion-icon">
                    <Sparkles size={14} />
                  </span>
                  <span>{suggestion}</span>
                </div>
              ))
            )}
          </SectionCard>

          <SectionCard title="How this is scoped" icon={<ShieldCheck size={16} />} bodyClass="tight">
            <div className="col" style={{ gap: 0 }}>
              {[
                'Employees analyse only their own work.',
                'Managers analyse themselves and their direct reports.',
                'Senior managers analyse their department.',
                'Administrators analyse the whole organisation.',
                'The analysis never crosses these boundaries, even when AI is enabled.',
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

          <SectionCard title="Applied model" icon={<Brain size={16} />}>
            <div className="meta-list">
              <div>
                <div className="meta-row-label">Source</div>
                <div className="meta-row-value">
                  {AI_SOURCE_LABELS[insights.source] || insights.source || 'Built-in analysis'}
                </div>
              </div>
              <div>
                <div className="meta-row-label">Scope</div>
                <div className="meta-row-value">{insights.scopeLabel}</div>
              </div>
              <div>
                <div className="meta-row-label">Generated</div>
                <div className="meta-row-value">{relativeTime(insights.generatedAt)}</div>
              </div>
              <div>
                <div className="meta-row-label">Risk signals</div>
                <div className="meta-row-value">
                  Overdue days, due proximity, priority, status and effort
                </div>
              </div>
            </div>
          </SectionCard>

          <button className="btn btn-subtle btn-block" onClick={() => navigate('/tasks?due=overdue')}>
            <ArrowRight size={14} /> Open overdue tasks
          </button>
        </div>
      </div>
    </div>
  );
}
