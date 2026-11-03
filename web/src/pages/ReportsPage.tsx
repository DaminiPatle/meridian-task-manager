import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  Download,
  Inbox,
  Printer,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { addDaysISO, formatDate, formatPercent, formatScore, todayISO } from '../lib/format';
import type { Metrics, Report, ReportPerson, ReportTeamRow } from '../lib/types';
import { useApi } from '../hooks/useApi';
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  Progress,
  SectionCard,
  TabBar,
} from '../components/ui';

function metricTone(value: number) {
  if (value >= 85) return 'green';
  if (value >= 60) return 'amber';
  return 'rose';
}

function MetricPanel({
  title,
  icon,
  metrics,
  tone,
  description,
}: {
  title: string;
  icon: React.ReactNode;
  metrics: Metrics;
  tone: 'assigned' | 'self' | 'combined';
  description: string;
}) {
  return (
    <div className={`metric-panel ${tone}`}>
      <div className="metric-panel-head">
        <span className="metric-panel-icon">{icon}</span>
        {title}
      </div>
      <div className="metric-big">
        {metrics.total}
        <small>tasks</small>
      </div>
      <div className="metric-sub">{description}</div>
      <div className="metric-rows">
        <div className="metric-line">
          <span>Completed</span>
          <strong>
            {metrics.completed} · {formatPercent(metrics.completionRate)}
          </strong>
        </div>
        <div className="metric-line">
          <span>Open</span>
          <strong>{metrics.open}</strong>
        </div>
        <div className="metric-line">
          <span>Overdue</span>
          <strong style={{ color: metrics.overdue > 0 ? 'var(--rose)' : undefined }}>
            {metrics.overdue}
          </strong>
        </div>
        <div className="metric-line">
          <span>On-time completion</span>
          <strong>
            {metrics.onTimeCompleted} · {formatPercent(metrics.onTimeRate)}
          </strong>
        </div>
        <div className="metric-line">
          <span>Avg cycle time</span>
          <strong>{metrics.avgCycleDays === null ? '—' : `${metrics.avgCycleDays}d`}</strong>
        </div>
        <div className="metric-line">
          <span>Avg effort</span>
          <strong>{metrics.avgEffortHours === null ? '—' : `${metrics.avgEffortHours}h`}</strong>
        </div>
        <div className="divider" />
        <div className="metric-line">
          <span>Manager rating</span>
          <strong>
            <Star size={11} style={{ color: '#f59e0b', marginRight: 3 }} />
            {formatScore(metrics.managerRating)} ({metrics.managerRatingCount})
          </strong>
        </div>
        <div className="metric-line">
          <span>Senior rating</span>
          <strong>
            <Star size={11} style={{ color: '#8b5cf6', marginRight: 3 }} />
            {formatScore(metrics.seniorRating)} ({metrics.seniorRatingCount})
          </strong>
        </div>
      </div>
    </div>
  );
}

function RatingBars({
  title,
  data,
  color,
}: {
  title: string;
  data: Report['ratings']['manager'];
  color: string;
}) {
  return (
    <div>
      <div className="row between mb-2">
        <span className="small strong">{title}</span>
        <span className="badge badge-slate">
          {formatScore(data.average)} avg · {data.count} ratings
        </span>
      </div>
      {[5, 4, 3, 2, 1].map((score) => {
        const row = data.distribution.find((entry) => entry.score === score);
        const count = row?.count || 0;
        const percent = data.count ? (count / data.count) * 100 : 0;
        return (
          <div className="dist-row" key={score}>
            <span className="dist-label">{score}★</span>
            <div className="dist-track">
              <div className="dist-fill" style={{ width: `${percent}%`, background: color }} />
            </div>
            <span className="dist-count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function toCsv(rows: ReportTeamRow[]) {
  const header = [
    'Person',
    'Role',
    'Assigned total',
    'Assigned completed',
    'Self-created total',
    'Self-created completed',
    'Combined total',
    'Combined completed',
    'Combined completion %',
    'Combined overdue',
    'Manager rating',
    'Senior rating',
  ];
  const lines = rows.map((row) => [
    row.user.fullName,
    row.user.role,
    row.assigned.total,
    row.assigned.completed,
    row.selfCreated.total,
    row.selfCreated.completed,
    row.combined.total,
    row.combined.completed,
    row.combined.completionRate,
    row.combined.overdue,
    row.combined.managerRating ?? '',
    row.combined.seniorRating ?? '',
  ]);
  return [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get('from') || addDaysISO(todayISO(), -90));
  const [to, setTo] = useState(searchParams.get('to') || todayISO());
  const [target, setTarget] = useState(searchParams.get('userId') || 'all');
  const [tab, setTab] = useState<'overview' | 'breakdown'>('overview');
  const [options, setOptions] = useState<ReportPerson[]>([]);

  const report = useApi<Report>(
    () => api.reports.get({ userId: target === 'all' ? undefined : target, from, to }),
    [target, from, to],
  );

  useEffect(() => {
    document.title = 'Reports · Meridian';
  }, []);

  useEffect(() => {
    if (!report.data) return;
    setOptions((current) => {
      const merged = new Map(current.map((person) => [person.id, person]));
      for (const subject of report.data.subjects) merged.set(subject.id, subject);
      return [...merged.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
    });
  }, [report.data]);

  function applyTarget(nextTarget: string) {
    setTarget(nextTarget);
    const next = new URLSearchParams(searchParams);
    if (nextTarget === 'all') next.delete('userId');
    else next.set('userId', nextTarget);
    setSearchParams(next, { replace: true });
  }

  const teamRows = report.data?.team || [];
  const statusRows = useMemo(() => {
    if (!report.data) return [];
    return report.data.statusBreakdown;
  }, [report.data]);

  if (report.loading && !report.data) return <LoadingBlock label="Calculating split reports…" />;
  if (report.error) return <ErrorBlock message={report.error} onRetry={report.reload} />;
  if (!report.data) return null;

  const data = report.data;

  function download() {
    const blob = new Blob([toCsv(teamRows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meridian-report-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={
          <>
            <BarChart3 size={13} /> Performance reporting
          </>
        }
        title="Reports"
        subtitle={`Assigned work and employee-created work are reported separately, then combined. ${data.scopeLabel}.`}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
            <button className="btn btn-subtle" onClick={download} disabled={teamRows.length === 0}>
              <Download size={15} /> Export CSV
            </button>
          </>
        }
      />

      <div className="card card-pad">
        <div className="toolbar">
          <div className="field" style={{ minWidth: 230 }}>
            <label htmlFor="report-target">Person or scope</label>
            <select
              id="report-target"
              className="select"
              value={target}
              onChange={(event) => applyTarget(event.target.value)}
            >
              <option value="all">Everyone in my scope</option>
              {options.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="report-from">From</label>
            <input
              id="report-from"
              type="date"
              className="input"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="report-to">To</label>
            <input
              id="report-to"
              type="date"
              className="input"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="field" style={{ marginLeft: 'auto', justifyContent: 'flex-end' }}>
            <span className="hint">
              {formatDate(data.period.from)} → {formatDate(data.period.to)}
            </span>
            <span className="badge badge-indigo">{data.target?.fullName || 'All visible people'}</span>
          </div>
        </div>
      </div>

      <div className="metric-compare">
        <MetricPanel
          title="Tasks assigned by manager"
          icon={<Inbox size={14} />}
          metrics={data.assigned}
          tone="assigned"
          description="Work delegated through the manager chain."
        />
        <MetricPanel
          title="Tasks created by employee"
          icon={<Users size={14} />}
          metrics={data.selfCreated}
          tone="self"
          description="Self-authored work, including mandatory activation approvals."
        />
        <MetricPanel
          title="Combined total"
          icon={<BarChart3 size={14} />}
          metrics={data.combined}
          tone="combined"
          description="The full delivery picture — never merged into the two source views."
        />
      </div>

      <div className="card">
        <div className="card-head" style={{ minHeight: 56 }}>
          <TabBar
            items={[
              { key: 'overview', label: 'Overview' },
              { key: 'breakdown', label: 'Team & status breakdown' },
            ]}
            value={tab}
            onChange={(key) => setTab(key as 'overview' | 'breakdown')}
          />
          <div className="card-head-actions">
            <span className="chip">{teamRows.length} {teamRows.length === 1 ? 'person' : 'people'}</span>
          </div>
        </div>
      </div>

      {tab === 'overview' ? (
        <div className="grid grid-2">
          <SectionCard
            title="Completion performance"
            subtitle="Combined scope, with assigned and self-created separation preserved"
            icon={<TrendingUp size={16} />}
          >
            <div className="col" style={{ gap: 16 }}>
              {[
                { label: 'Assigned by manager', metrics: data.assigned, tone: 'green' as const },
                { label: 'Created by employee', metrics: data.selfCreated, tone: 'amber' as const },
                { label: 'Combined', metrics: data.combined, tone: 'green' as const },
              ].map((row) => (
                <div key={row.label}>
                  <Progress
                    value={row.metrics.completionRate}
                    tone={metricTone(row.metrics.completionRate) as 'green' | 'amber' | 'rose'}
                    label={
                      <span>
                        {row.label} · {row.metrics.completed}/{row.metrics.total} completed
                      </span>
                    }
                  />
                </div>
              ))}
              <div className="divider" />
              <div className="row between small">
                <span className="muted">On-time rate (combined)</span>
                <span className="strong">{formatPercent(data.combined.onTimeRate)}</span>
              </div>
              <div className="row between small">
                <span className="muted">Average cycle time</span>
                <span className="strong">
                  {data.combined.avgCycleDays === null ? '—' : `${data.combined.avgCycleDays} days`}
                </span>
              </div>
              <div className="row between small">
                <span className="muted">Manager vs senior rating gap</span>
                <span className="strong">{formatScore(data.combined.ratingGap)}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Independent rating distribution"
            subtitle="Separate records — no blended score"
            icon={<Star size={16} />}
          >
            <div className="col" style={{ gap: 18 }}>
              <RatingBars
                title="Manager ratings"
                data={data.ratings.manager}
                color="linear-gradient(90deg,#6366f1,#8b5cf6)"
              />
              <RatingBars
                title="Senior manager ratings"
                data={data.ratings.senior}
                color="linear-gradient(90deg,#0d9488,#34d399)"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Status distribution"
            subtitle="Combined tasks in the selected period"
            icon={<CheckCircle2 size={16} />}
          >
            {statusRows.length === 0 ? (
              <EmptyState title="No tasks in this period" icon={<Inbox size={19} />} />
            ) : (
              <div>
                {statusRows.map((row) => {
                  const percent = data.combined.total ? (row.count / data.combined.total) * 100 : 0;
                  return (
                    <div className="dist-row" key={row.status}>
                      <span
                        className="dist-label"
                        style={{ width: 120, textAlign: 'left', fontSize: 11 }}
                      >
                        {row.status.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <div className="dist-track">
                        <div className="dist-fill" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="dist-count">{row.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Period summary"
            subtitle={`${formatDate(data.period.from)} to ${formatDate(data.period.to)}`}
            icon={<BarChart3 size={16} />}
          >
            <div className="meta-list">
              <div className="metric-line">
                <span>Tasks in scope</span>
                <strong>{data.combined.total}</strong>
              </div>
              <div className="metric-line">
                <span>Completed</span>
                <strong>{data.combined.completed}</strong>
              </div>
              <div className="metric-line">
                <span>Still open</span>
                <strong>{data.combined.open}</strong>
              </div>
              <div className="metric-line">
                <span>Overdue</span>
                <strong style={{ color: data.combined.overdue ? 'var(--rose)' : undefined }}>
                  {data.combined.overdue}
                </strong>
              </div>
              <div className="metric-line">
                <span>People included</span>
                <strong>{data.subjects.length}</strong>
              </div>
              <div className="divider" />
              <p className="hint">
                “Tasks assigned by manager” counts work where the creator is not the assignee.
                “Tasks created by employee” counts self-authored work. The combined panel is a sum
                only — both source views remain intact in the API response and CSV export.
              </p>
            </div>
          </SectionCard>
        </div>
      ) : (
        <SectionCard
          title="Per-person split"
          subtitle="Assigned, self-created and combined metrics for each visible person"
          icon={<Users size={16} />}
          bodyClass="tight"
        >
          {teamRows.length === 0 ? (
            <EmptyState
              title="No people with tasks in this period"
              description="Adjust the date range or scope to include more work."
              icon={<Users size={20} />}
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th className="num">Assigned</th>
                    <th className="num">Completed</th>
                    <th className="num">Self-created</th>
                    <th className="num">Completed</th>
                    <th className="num">Combined</th>
                    <th className="num">Completion</th>
                    <th className="num">Overdue</th>
                    <th className="num">Mgr rating</th>
                    <th className="num">Snr rating</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRows.map((row) => (
                    <tr key={row.user.id}>
                      <td>
                        <div className="strong">{row.user.fullName}</div>
                        <div className="muted tiny">{row.user.title}</div>
                      </td>
                      <td className="num">{row.assigned.total}</td>
                      <td className="num muted">{row.assigned.completed}</td>
                      <td className="num">{row.selfCreated.total}</td>
                      <td className="num muted">{row.selfCreated.completed}</td>
                      <td className="num strong">{row.combined.total}</td>
                      <td className="num">{formatPercent(row.combined.completionRate)}</td>
                      <td
                        className="num"
                        style={{ color: row.combined.overdue ? 'var(--rose)' : undefined }}
                      >
                        {row.combined.overdue}
                      </td>
                      <td className="num">{formatScore(row.combined.managerRating)}</td>
                      <td className="num">{formatScore(row.combined.seniorRating)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
