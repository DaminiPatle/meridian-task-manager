import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Search,
  Star,
  Target,
  UserRound,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatHours, formatPercent, formatScore } from '../lib/format';
import type { TeamOverview, TeamMember } from '../lib/types';
import { useApi } from '../hooks/useApi';
import {
  Avatar,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  Progress,
  StatCard,
  StatusBadge,
} from '../components/ui';

function MemberCard({
  member,
  onOpen,
  onReport,
}: {
  member: TeamMember;
  onOpen: () => void;
  onReport: () => void;
}) {
  return (
    <div className="team-card">
      <div className="team-card-head">
        <Avatar name={member.fullName} color={member.avatarColor} size={40} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="person-name" style={{ fontSize: 14 }}>
            {member.fullName}
            {member.isSelf && (
              <span className="badge badge-indigo" style={{ marginLeft: 7, height: 19 }}>
                You
              </span>
            )}
          </div>
          <div className="person-meta">{member.title}</div>
          <div className="person-meta">{member.departmentName || 'No department'}</div>
        </div>
        {member.overdue > 0 && (
          <span className="badge badge-rose">
            <AlertTriangle size={10} /> {member.overdue}
          </span>
        )}
      </div>

      <div className="team-card-stats">
        <div className="team-stat">
          <b>{member.openTasks}</b>
          <span>Open</span>
        </div>
        <div className="team-stat">
          <b>{member.completed}</b>
          <span>Done</span>
        </div>
        <div className="team-stat">
          <b>{member.overdue}</b>
          <span>Late</span>
        </div>
      </div>

      <div>
        <Progress
          value={member.completionRate}
          tone={member.overdue > 0 ? 'amber' : 'green'}
          label={<span>Completion rate</span>}
        />
      </div>

      <div className="row between small">
        <span className="muted">Manager rating</span>
        <span className="strong row" style={{ gap: 5 }}>
          <Star size={12} style={{ color: '#f59e0b' }} />
          {formatScore(member.avgManagerRating)}
          {member.ratingCount > 0 && <span className="muted tiny">({member.ratingCount})</span>}
        </span>
      </div>
      <div className="row between small">
        <span className="muted">Senior rating</span>
        <span className="strong row" style={{ gap: 5 }}>
          <Star size={12} style={{ color: '#8b5cf6' }} />
          {formatScore(member.avgSeniorRating)}
        </span>
      </div>
      <div className="row between small">
        <span className="muted">Logged effort</span>
        <span className="strong">{formatHours(member.effortHours)}</span>
      </div>

      <div className="divider" />
      <div>
        <div className="section-title" style={{ marginBottom: 4 }}>
          <Target size={13} /> Current focus
        </div>
        {member.currentFocus.length === 0 ? (
          <div className="muted tiny">No active tasks.</div>
        ) : (
          member.currentFocus.slice(0, 3).map((task) => (
            <div className="focus-task" key={task.id}>
              <span className="priority"></span>
              <span>{task.title}</span>
              <span style={{ marginLeft: 'auto' }}>
                <StatusBadge status={task.status} />
              </span>
            </div>
          ))
        )}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 2 }}>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={onOpen}>
          <Users size={13} /> View tasks
        </button>
        <button className="btn btn-subtle btn-sm" style={{ flex: 1 }} onClick={onReport}>
          <BarChart3 size={13} /> Report
        </button>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const navigate = useNavigate();
  const team = useApi<TeamOverview>(() => api.team(), []);
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.title = 'Team · Meridian';
  }, []);

  const members = team.data?.members || [];
  const filtered = useMemo(
    () =>
      members.filter((member) =>
        query.trim()
          ? member.fullName.toLowerCase().includes(query.trim().toLowerCase()) ||
            member.title.toLowerCase().includes(query.trim().toLowerCase())
          : true,
      ),
    [members, query],
  );

  if (team.loading && !team.data) return <LoadingBlock label="Loading your team…" />;
  if (team.error) return <ErrorBlock message={team.error} onRetry={team.reload} />;
  if (!team.data) return null;

  const { summary } = team.data;

  return (
    <div className="page">
      <PageHeader
        eyebrow={
          <>
            <Users size={13} /> Team oversight
          </>
        }
        title="Team"
        subtitle={`${team.data.scopeLabel}. Only people inside your permitted reporting scope are listed here — enforced by the API.`}
        actions={
          <button className="btn btn-subtle" onClick={() => navigate('/reports')}>
            <BarChart3 size={15} /> Open reports
          </button>
        }
      />

      <div className="stat-grid">
        <StatCard
          icon={<Users size={15} />}
          label="People in scope"
          value={summary.people}
          foot={<span>Direct and indirect visibility</span>}
        />
        <StatCard
          icon={<UserRound size={15} />}
          label="Open tasks"
          value={summary.open}
          tone="blue"
          foot={<span>Across the visible team</span>}
        />
        <StatCard
          icon={<AlertTriangle size={15} />}
          label="Overdue work"
          value={summary.overdue}
          tone="rose"
          foot={<span>Needs intervention</span>}
        />
        <StatCard
          icon={<Star size={15} />}
          label="Average completion"
          value={formatPercent(summary.avgCompletionRate)}
          tone="teal"
          foot={<span>{summary.completed} tasks completed</span>}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Team members</h3>
          <div className="badge badge-slate">{filtered.length} shown</div>
          <div className="card-head-actions">
            <div className="search-box" style={{ minWidth: 220 }}>
              <Search size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people…"
              />
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No people match this search"
            description="Try a different name or clear the search to see the full scope."
            icon={<Users size={20} />}
            action={
              <button className="btn btn-subtle btn-sm" onClick={() => setQuery('')}>
                Clear search
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-3">
          {filtered.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onOpen={() => navigate(`/tasks?assigneeId=${member.id}`)}
              onReport={() => navigate(`/reports?userId=${member.id}`)}
            />
          ))}
        </div>
      )}

      <div className="form-note">
        <strong>Role scope:</strong> employees never appear in team oversight. Managers see their
        direct reports, senior managers see their department, and administrators see the whole
        organisation for platform administration only.
      </div>
    </div>
  );
}
