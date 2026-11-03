import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ServerCog,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { ROLE_BADGE, ROLE_LABELS, ROLE_OPTIONS } from '../lib/constants';
import { formatDate, relativeTime } from '../lib/format';
import type {
  AdminOverview,
  AdminUser,
  AiSettings,
  Department,
  Role,
} from '../lib/types';
import { useApi, useAsyncAction } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/dialogs';
import {
  Avatar,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Modal,
  PageHeader,
  SectionCard,
  StatCard,
  TabBar,
} from '../components/ui';

type AdminTab = 'overview' | 'users' | 'departments' | 'ai';

const GUARDRAIL_COPY: Record<string, string> = {
  mandatoryCreationApproval:
    'Self-created tasks always require manager activation approval before work can start.',
  selfApprovalBlocked: 'A task creator can never approve their own task, at any level.',
  twoTierCompletion:
    'Completion requires the assigned manager first, then the senior manager, with both decisions stored.',
  seniorRejectionRoutesToManager:
    'A senior manager rejection routes to the manager, never directly to the employee.',
  extensionsRequireTwoLevels:
    'Due dates only move after manager and senior manager both approve an extension.',
  independentRatings:
    'Manager and senior manager ratings are stored as separate records with their own remarks.',
  locked: 'These policy rules are enforced by the API and cannot be toggled from the interface.',
};

const DEPARTMENT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export default function AdminPage() {
  const { user } = useAuth();
  const toast = useToast();
  const overview = useApi<AdminOverview>(() => api.admin.overview(), []);
  const usersApi = useApi(() => api.admin.users(), []);
  const { busy, error, run, reset } = useAsyncAction();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [userModal, setUserModal] = useState<
    { mode: 'create' } | { mode: 'edit'; user: AdminUser } | null
  >(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [deptModal, setDeptModal] = useState<
    { mode: 'create' } | { mode: 'edit'; department: Department } | null
  >(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    action: () => void;
  } | null>(null);

  useEffect(() => {
    document.title = 'Administration · Meridian';
  }, []);

  const users = usersApi.data?.users || [];
  const departments = usersApi.data?.departments || overview.data?.departments || [];

  const filteredUsers = useMemo(
    () =>
      users.filter((entry) => {
        if (roleFilter && entry.role !== roleFilter) return false;
        if (!query.trim()) return true;
        const needle = query.trim().toLowerCase();
        return (
          entry.fullName.toLowerCase().includes(needle) ||
          entry.email.toLowerCase().includes(needle) ||
          entry.title.toLowerCase().includes(needle) ||
          (entry.departmentName || '').toLowerCase().includes(needle)
        );
      }),
    [users, query, roleFilter],
  );

  const seniors = users.filter((entry) => entry.role === 'SENIOR_MANAGER' && entry.isActive);

  function refreshAll(message?: string) {
    if (message) toast.success(message);
    void overview.reload();
    void usersApi.reload();
  }

  function toggleActive(target: AdminUser) {
    const activating = !target.isActive;
    setConfirm({
      title: activating ? 'Reactivate user' : 'Deactivate user',
      description: activating
        ? `${target.fullName} will be able to sign in and receive tasks again.`
        : `${target.fullName} will lose access immediately. The API blocks deactivation while they hold open tasks, active direct reports or a department stewardship.`,
      confirmLabel: activating ? 'Reactivate' : 'Deactivate',
      action: () => {
        void run(() => api.admin.updateUser(target.id, { isActive: activating }), {
          onSuccess: () => {
            setConfirm(null);
            refreshAll(activating ? 'User reactivated.' : 'User deactivated.');
          },
        });
      },
    });
  }

  if (overview.loading && !overview.data) return <LoadingBlock label="Loading administration…" />;
  if (overview.error) return <ErrorBlock message={overview.error} onRetry={overview.reload} />;
  if (!overview.data || !user) return null;

  const data = overview.data;
  const counts = data.counts;

  return (
    <div className="page">
      <PageHeader
        eyebrow={
          <>
            <Settings2 size={13} /> System administration
          </>
        }
        title="Administration"
        subtitle="Manage people, departments and AI configuration. Administrators are read-only for tasks: they cannot create, approve, rate or alter workflow items."
        actions={
          <span className="badge badge-rose">
            <ShieldCheck size={11} /> Platform controls
          </span>
        }
      />

      <div className="card">
        <div className="card-head" style={{ minHeight: 56 }}>
          <TabBar
            items={[
              { key: 'overview', label: 'Overview' },
              { key: 'users', label: 'Users', count: counts.users },
              { key: 'departments', label: 'Departments', count: counts.departments },
              { key: 'ai', label: 'AI settings' },
            ]}
            value={tab}
            onChange={(key) => setTab(key as AdminTab)}
          />
          <div className="card-head-actions">
            <span className="chip">{counts.activeUsers} active users</span>
          </div>
        </div>
      </div>

      {tab === 'overview' && (
        <>
          <div className="stat-grid">
            <StatCard
              icon={<Users size={15} />}
              label="People"
              value={counts.users}
              foot={<span>{counts.activeUsers} active · {counts.users - counts.activeUsers} inactive</span>}
            />
            <StatCard
              icon={<Building2 size={15} />}
              label="Departments"
              value={counts.departments}
              tone="blue"
              foot={<span>Each with an assigned senior manager</span>}
            />
            <StatCard
              icon={<ServerCog size={15} />}
              label="Tasks"
              value={counts.tasks}
              tone="amber"
              foot={<span>{counts.openTasks} still open</span>}
            />
            <StatCard
              icon={<ShieldCheck size={15} />}
              label="Pending approvals"
              value={counts.pendingApprovals}
              tone="rose"
              foot={<span>{counts.meetings} meetings captured</span>}
            />
          </div>

          <div className="grid grid-main-side">
            <div className="col" style={{ gap: 18 }}>
              <SectionCard
                title="Enforced workflow guardrails"
                subtitle="Server-side rules that shape every task, approval and rating"
                icon={<ShieldCheck size={16} />}
                bodyClass="tight"
              >
                <div className="col" style={{ gap: 0 }}>
                  {Object.entries(data.guardrails)
                    .filter(([key]) => key !== 'locked')
                    .map(([key, value]) => (
                      <div className="guardrail" key={key}>
                        <span className="guardrail-check">
                          {value ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        </span>
                        <span>
                          <strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}.</strong>{' '}
                          {GUARDRAIL_COPY[key] || 'Enforced by the API.'}
                        </span>
                      </div>
                    ))}
                  <div className="guardrail">
                    <span className="guardrail-check">
                      <Ban size={12} />
                    </span>
                    <span>{GUARDRAIL_COPY.locked}</span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Departments"
                subtitle="Senior manager ownership across the organisation"
                icon={<Building2 size={16} />}
                bodyClass="tight"
              >
                {departments.length === 0 ? (
                  <EmptyState
                    title="No departments yet"
                    description="Create a department and assign its senior manager."
                    icon={<Building2 size={20} />}
                  />
                ) : (
                  <div className="col" style={{ gap: 0 }}>
                    {departments.map((department) => (
                      <div
                        key={department.id}
                        className="row"
                        style={{
                          padding: '12px 18px',
                          borderBottom: '1px solid var(--line)',
                          gap: 11,
                        }}
                      >
                        <span
                          className="stat-icon"
                          style={{
                            background: `${DEPARTMENT_COLORS[0]}18`,
                            color: DEPARTMENT_COLORS[0],
                          }}
                        >
                          <Building2 size={15} />
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="person-name">{department.name}</div>
                          <div className="person-meta">
                            {department.description || 'No description'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="person-name">
                            {department.senior_manager_name || 'Unassigned'}
                          </div>
                          <div className="person-meta">Senior manager</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            <div className="col" style={{ gap: 18 }}>
              <SectionCard title="AI configuration" icon={<Sparkles size={16} />}>
                <div className="meta-list">
                  <div>
                    <div className="meta-row-label">Status</div>
                    <div className="meta-row-value">
                      <span className={`badge ${data.ai.enabled ? 'badge-green' : 'badge-slate'}`}>
                        {data.ai.enabled ? 'Live AI enabled' : 'Built-in analysis only'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="meta-row-label">Model</div>
                    <div className="meta-row-value">{data.ai.model}</div>
                  </div>
                  <div>
                    <div className="meta-row-label">Endpoint</div>
                    <div className="meta-row-value" style={{ wordBreak: 'break-all' }}>
                      {data.ai.baseUrl || 'Not configured'}
                    </div>
                  </div>
                  <div>
                    <div className="meta-row-label">API key</div>
                    <div className="meta-row-value">
                      {data.ai.hasKey ? data.ai.keyHint : 'No key stored'}
                    </div>
                  </div>
                  <div>
                    <div className="meta-row-label">Last updated</div>
                    <div className="meta-row-value">
                      {data.ai.lastUpdated
                        ? `${relativeTime(data.ai.lastUpdated)}${
                            data.ai.lastUpdatedBy ? ` by ${data.ai.lastUpdatedBy}` : ''
                          }`
                        : 'Never'}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-subtle btn-block mt-3"
                  onClick={() => setTab('ai')}
                >
                  <Sparkles size={14} /> Configure AI
                </button>
              </SectionCard>

              <SectionCard title="Administrator boundaries" icon={<ShieldCheck size={16} />} bodyClass="tight">
                <div className="col" style={{ gap: 0 }}>
                  {[
                    'Create and manage user accounts, roles and reporting lines.',
                    'Maintain departments and assign senior manager ownership.',
                    'Configure the optional OpenAI-compatible AI endpoint.',
                    'Read every task and transcript for platform oversight.',
                    'Never create, approve, rate, edit or cancel workflow tasks.',
                  ].map((text, index) => (
                    <div className="guardrail" key={text}>
                      <span className="guardrail-check">
                        {index === 4 ? <Ban size={12} /> : <CheckCircle2 size={12} />}
                      </span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        </>
      )}

      {tab === 'users' && (
        <>
          <div className="card">
            <div className="card-head">
              <h3>People directory</h3>
              <div className="badge badge-slate">{filteredUsers.length} shown</div>
              <div className="card-head-actions">
                <div className="search-box" style={{ minWidth: 220 }}>
                  <Search size={14} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search people…"
                  />
                </div>
                <select
                  className="select"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as Role | '')}
                  aria-label="Filter by role"
                >
                  <option value="">All roles</option>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    reset();
                    setUserModal({ mode: 'create' });
                  }}
                >
                  <UserPlus size={14} /> New user
                </button>
              </div>
            </div>
          </div>

          {usersApi.loading && !usersApi.data ? (
            <LoadingBlock label="Loading users…" />
          ) : usersApi.error ? (
            <ErrorBlock message={usersApi.error} onRetry={usersApi.reload} />
          ) : filteredUsers.length === 0 ? (
            <div className="card">
              <EmptyState
                title="No users match this filter"
                description="Try a different search or role filter."
                icon={<Users size={20} />}
              />
            </div>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Role</th>
                      <th>Manager</th>
                      <th>Department</th>
                      <th className="num">Open</th>
                      <th className="num">Reports</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <div className="row" style={{ gap: 9 }}>
                            <Avatar name={entry.fullName} color={entry.avatarColor} size={30} />
                            <div>
                              <div className="strong">
                                {entry.fullName}
                                {entry.id === user.id && (
                                  <span className="badge badge-indigo" style={{ marginLeft: 7, height: 18 }}>
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="muted tiny">{entry.email}</div>
                              <div className="muted tiny">{entry.title}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${ROLE_BADGE[entry.role]}`}>
                            {ROLE_LABELS[entry.role]}
                          </span>
                        </td>
                        <td>{entry.managerName || <span className="muted">—</span>}</td>
                        <td>{entry.departmentName || <span className="muted">—</span>}</td>
                        <td className="num">{entry.openTasks}</td>
                        <td className="num">{entry.directReports}</td>
                        <td>
                          <span className={`badge ${entry.isActive ? 'badge-green' : 'badge-slate'}`}>
                            {entry.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => {
                                reset();
                                setUserModal({ mode: 'edit', user: entry });
                              }}
                              title="Edit user"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => setResetTarget(entry)}
                              title="Reset password"
                            >
                              <KeyRound size={12} />
                            </button>
                            {entry.id !== user.id && (
                              <button
                                className={`btn btn-xs ${
                                  entry.isActive ? 'btn-danger-ghost' : 'btn-success'
                                }`}
                                onClick={() => toggleActive(entry)}
                              >
                                {entry.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'departments' && (
        <>
          <div className="card">
            <div className="card-head">
              <h3>Departments</h3>
              <div className="badge badge-slate">{departments.length}</div>
              <div className="card-head-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    reset();
                    setDeptModal({ mode: 'create' });
                  }}
                >
                  <Plus size={14} /> New department
                </button>
              </div>
            </div>
          </div>

          {departments.length === 0 ? (
            <div className="card">
              <EmptyState
                title="No departments"
                description="Create the first department and assign a senior manager."
                icon={<Building2 size={20} />}
              />
            </div>
          ) : (
            <div className="grid grid-3">
              {departments.map((department) => {
                const members = users.filter(
                  (entry) => entry.departmentId === department.id && entry.isActive,
                );
                return (
                  <div className="team-card" key={department.id}>
                    <div className="team-card-head">
                      <span
                        className="stat-icon"
                        style={{
                          background: `${DEPARTMENT_COLORS[0]}18`,
                          color: DEPARTMENT_COLORS[0],
                          width: 40,
                          height: 40,
                        }}
                      >
                        <Building2 size={18} />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="person-name" style={{ fontSize: 14 }}>
                          {department.name}
                        </div>
                        <div className="person-meta">{members.length} active people</div>
                      </div>
                    </div>
                    <p className="hint" style={{ minHeight: 34 }}>
                      {department.description || 'No description provided.'}
                    </p>
                    <div className="row between small">
                      <span className="muted">Senior manager</span>
                      <span className="strong">
                        {department.senior_manager_name || 'Unassigned'}
                      </span>
                    </div>
                    <div className="row between small">
                      <span className="muted">Created</span>
                      <span className="strong">{formatDate(department.created_at)}</span>
                    </div>
                    <div className="divider" />
                    <button
                      className="btn btn-subtle btn-sm btn-block"
                      onClick={() => {
                        reset();
                        setDeptModal({ mode: 'edit', department });
                      }}
                    >
                      <Pencil size={13} /> Edit department
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'ai' && (
        <AiSettingsPanel
          settings={data.ai}
          onSaved={(updated) => {
            toast.success(
              updated.enabled
                ? 'AI configuration saved. Live extraction is enabled.'
                : 'AI configuration saved. Built-in analysis will be used.',
            );
            void overview.reload();
          }}
        />
      )}

      <UserFormModal
        open={userModal !== null}
        onClose={() => setUserModal(null)}
        editing={userModal?.mode === 'edit' ? userModal.user : null}
        users={users}
        departments={departments}
        onSaved={(message) => {
          setUserModal(null);
          refreshAll(message);
        }}
      />

      <ResetPasswordModal
        open={resetTarget !== null}
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onSaved={() => {
          toast.success('Password reset. Share the new password securely.');
          setResetTarget(null);
        }}
      />

      <DepartmentFormModal
        open={deptModal !== null}
        onClose={() => setDeptModal(null)}
        editing={deptModal?.mode === 'edit' ? deptModal.department : null}
        seniors={seniors}
        onSaved={(message) => {
          setDeptModal(null);
          refreshAll(message);
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.action()}
        title={confirm?.title || ''}
        description={confirm?.description || ''}
        confirmLabel={confirm?.confirmLabel || 'Confirm'}
        busy={busy}
        tone={confirm?.confirmLabel === 'Reactivate' ? 'primary' : 'danger'}
      />

      {error && <div className="form-error">{error}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ AI panel */

function AiSettingsPanel({
  settings,
  onSaved,
}: {
  settings: AiSettings;
  onSaved: (updated: AiSettings) => void;
}) {
  const toast = useToast();
  const { busy, error, run, reset } = useAsyncAction();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [temperature, setTemperature] = useState(String(settings.temperature));
  const [apiKey, setApiKey] = useState('');
  const [pendingClear, setPendingClear] = useState(false);

  useEffect(() => {
    setEnabled(settings.enabled);
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
    setTemperature(String(settings.temperature));
    setApiKey('');
    setPendingClear(false);
    reset();
  }, [settings, reset]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    void run(
      () =>
        api.admin.saveAiSettings({
          enabled,
          provider: 'openai-compatible',
          baseUrl: baseUrl.trim(),
          model: model.trim(),
          temperature: Number(temperature),
          ...(pendingClear
            ? { apiKey: 'CLEAR' }
            : apiKey.trim()
              ? { apiKey: apiKey.trim() }
              : {}),
        }),
      {
        onSuccess: (result) => {
          const updated = (result as { ai: AiSettings }).ai;
          setApiKey('');
          setPendingClear(false);
          onSaved(updated);
        },
      },
    );
  }

  function clearKey() {
    if (!settings.hasKey && !pendingClear) {
      toast.info('There is no stored API key to remove.');
      return;
    }
    setPendingClear(true);
    toast.info('Save the form to remove the stored key.');
  }

  const keyStatus = pendingClear
    ? 'Key will be removed when you save'
    : apiKey.trim()
      ? 'New key will replace the stored one on save'
      : settings.hasKey
        ? `Stored: ${settings.keyHint}`
        : 'No key stored';

  return (
    <div className="grid grid-main-side">
      <SectionCard
        title="AI provider"
        subtitle="Optional. When disabled or unreachable, Meridian uses its deterministic built-in analysis."
        icon={<Sparkles size={16} />}
      >
        <form className="col" style={{ gap: 16 }} onSubmit={save}>
          {error && <div className="form-error">{error}</div>}

          <label
            className="row"
            style={{
              gap: 10,
              padding: '12px 14px',
              border: '1px solid var(--line)',
              borderRadius: 10,
              background: 'var(--surface-soft)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <span>
              <span className="strong">Enable live AI features</span>
              <span className="hint" style={{ display: 'block' }}>
                Meeting extraction and insight summaries call your OpenAI-compatible endpoint.
                Requires a stored API key.
              </span>
            </span>
          </label>

          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="ai-base-url">Base URL</label>
              <input
                id="ai-base-url"
                className="input"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="field">
              <label htmlFor="ai-model">Model</label>
              <input
                id="ai-model"
                className="input"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-4o-mini"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ai-temperature">Temperature</label>
              <input
                id="ai-temperature"
                type="number"
                className="input"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(event) => setTemperature(event.target.value)}
              />
              <span className="hint">0 is deterministic, 1 is most creative.</span>
            </div>
            <div className="field span-2">
              <label htmlFor="ai-key">API key</label>
              <input
                id="ai-key"
                type="password"
                className="input"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  if (event.target.value) setPendingClear(false);
                }}
                placeholder={settings.hasKey ? 'Leave blank to keep the stored key' : 'sk-…'}
                autoComplete="new-password"
              />
              <div className="row between" style={{ marginTop: 4 }}>
                <span className="hint">{keyStatus}</span>
                <button type="button" className="btn btn-ghost btn-xs" onClick={clearKey}>
                  <Ban size={11} /> Remove stored key
                </button>
              </div>
            </div>
          </div>

          <div className="form-note">
            Keys are stored server-side and never returned by the API. Only the masked hint above is
            ever sent to the browser.
          </div>

          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <span className="spinner" /> : <Settings2 size={14} />}
              Save AI settings
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="col" style={{ gap: 18 }}>
        <SectionCard title="How AI is used" icon={<Sparkles size={16} />} bodyClass="tight">
          <div className="col" style={{ gap: 0 }}>
            {[
              'Meeting transcripts become a summary, decisions and owned action items.',
              'Insights rank workload and due-date risk using only the viewer’s authorised scope.',
              'Every AI request is scoped by the API before any data leaves the server.',
              'AI never approves, rates, assigns or changes a task.',
              'If the endpoint fails, the built-in analysis keeps the product fully usable.',
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

        <SectionCard title="Fallback behaviour" icon={<ServerCog size={16} />}>
          <p className="small muted" style={{ lineHeight: 1.6 }}>
            With AI disabled, meeting extraction derives decisions and action items from the
            transcript with a deterministic heuristic, and insights are computed from the task
            graph. The interface labels the source so nobody mistakes built-in analysis for a live
            model response.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ User form */

function UserFormModal({
  open,
  onClose,
  editing,
  users,
  departments,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: AdminUser | null;
  users: AdminUser[];
  departments: Department[];
  onSaved: (message: string) => void;
}) {
  const toast = useToast();
  const { busy, error, run, reset } = useAsyncAction();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [title, setTitle] = useState('');
  const [managerId, setManagerId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [password, setPassword] = useState('');
  const [avatarColor, setAvatarColor] = useState(DEPARTMENT_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    reset();
    if (editing) {
      setFullName(editing.fullName);
      setEmail(editing.email);
      setRole(editing.role);
      setTitle(editing.title);
      setManagerId(editing.managerId || '');
      setDepartmentId(editing.departmentId || '');
      setAvatarColor(editing.avatarColor || DEPARTMENT_COLORS[0]);
    } else {
      setFullName('');
      setEmail('');
      setRole('EMPLOYEE');
      setTitle('');
      setManagerId('');
      setDepartmentId(departments[0]?.id || '');
      setAvatarColor(DEPARTMENT_COLORS[Math.floor(Math.random() * DEPARTMENT_COLORS.length)]);
    }
    setPassword('');
  }, [open, editing, departments, reset]);

  useEffect(() => {
    if (!open) return;
    const valid = users.filter(
      (entry) =>
        entry.isActive &&
        entry.id !== editing?.id &&
        (!departmentId || entry.departmentId === departmentId) &&
        (role === 'MANAGER'
          ? entry.role === 'SENIOR_MANAGER'
          : role === 'EMPLOYEE'
            ? entry.role === 'MANAGER' || entry.role === 'SENIOR_MANAGER'
            : false),
    );
    setManagerId((current) => {
      if (role === 'SENIOR_MANAGER' || role === 'ADMIN') return '';
      if (current && valid.some((entry) => entry.id === current)) return current;
      return valid[0]?.id || '';
    });
  }, [open, role, users, editing?.id, departmentId]);

  const managerCandidates = users.filter(
    (entry) =>
      entry.isActive &&
      entry.id !== editing?.id &&
      (!departmentId || entry.departmentId === departmentId) &&
      (role === 'MANAGER'
        ? entry.role === 'SENIOR_MANAGER'
        : role === 'EMPLOYEE'
          ? entry.role === 'MANAGER' || entry.role === 'SENIOR_MANAGER'
          : false),
  );

  const requiresManager = role === 'EMPLOYEE' || role === 'MANAGER';
  const requiresDepartment = role === 'EMPLOYEE' || role === 'MANAGER';

  const valid =
    fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    (!requiresManager || Boolean(managerId)) &&
    (!requiresDepartment || Boolean(departmentId));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const payload: Record<string, unknown> = {
      fullName: fullName.trim(),
      email: email.trim(),
      role,
      title: title.trim(),
      managerId: requiresManager ? managerId : null,
      departmentId: role === 'ADMIN' ? null : departmentId || null,
      avatarColor,
    };
    if (!editing) {
      if (password) payload.password = password;
    }
    void run(
      () =>
        editing
          ? api.admin.updateUser(editing.id, payload)
          : api.admin.createUser(payload),
      {
        onSuccess: () => {
          toast.success(editing ? 'User updated.' : 'User created.');
          onSaved(editing ? 'User updated.' : 'User created.');
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit user' : 'Create user'}
      subtitle={
        editing
          ? 'Reporting lines decide the approval chain every new task will use.'
          : 'Reporting lines decide the approval chain every new task will use.'
      }
      icon={editing ? <Pencil size={18} /> : <UserPlus size={18} />}
      size="wide"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="admin-user-form"
            className="btn btn-primary"
            disabled={!valid || busy}
          >
            {busy ? <span className="spinner" /> : editing ? <Pencil size={14} /> : <Plus size={14} />}
            {editing ? 'Save changes' : 'Create user'}
          </button>
        </>
      }
    >
      <form id="admin-user-form" className="form-grid" onSubmit={submit}>
        {error && <div className="form-error span-2">{error}</div>}
        <div className="field">
          <label htmlFor="admin-full-name">Full name</label>
          <input
            id="admin-full-name"
            className="input"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={120}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="admin-email">Work email</label>
          <input
            id="admin-email"
            type="email"
            className="input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="admin-role">Role</label>
          <select
            id="admin-role"
            className="select"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="admin-title">Job title</label>
          <input
            id="admin-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="e.g. Product Designer"
          />
        </div>
        <div className="field">
          <label htmlFor="admin-department">Department</label>
          <select
            id="admin-department"
            className="select"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            disabled={role === 'ADMIN'}
            required={requiresDepartment}
          >
            <option value="">{requiresDepartment ? 'Select a department' : 'No department'}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <span className="hint">
            {role === 'ADMIN'
              ? 'Administrators are organisation-wide and do not belong to a department.'
              : 'Employees and managers must belong to a department.'}
          </span>
        </div>
        <div className="field">
          <label htmlFor="admin-manager">
            {role === 'MANAGER' ? 'Reports to (senior manager)' : 'Reports to'}
          </label>
          <select
            id="admin-manager"
            className="select"
            value={managerId}
            onChange={(event) => setManagerId(event.target.value)}
            disabled={!requiresManager}
            required={requiresManager}
          >
            {!requiresManager && <option value="">Not applicable</option>}
            {requiresManager && managerCandidates.length === 0 && (
              <option value="">No eligible approver available</option>
            )}
            {managerCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.fullName} — {ROLE_LABELS[candidate.role]}
              </option>
            ))}
          </select>
          <span className="hint">
            {role === 'MANAGER'
              ? 'Managers must report to a senior manager, who becomes level-two approver.'
              : role === 'EMPLOYEE'
                ? 'Employees can report to a manager or senior manager.'
                : 'Senior managers and administrators sit at the top of the approval chain.'}
          </span>
        </div>
        {!editing && (
          <div className="field">
            <label htmlFor="admin-password">Initial password (optional)</label>
            <input
              id="admin-password"
              type="text"
              className="input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Defaults to demo1234"
              minLength={8}
              maxLength={200}
            />
          </div>
        )}
        <div className="field">
          <label>Avatar colour</label>
          <div className="row wrap" style={{ gap: 7 }}>
            {DEPARTMENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAvatarColor(color)}
                aria-label={`Use colour ${color}`}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: color,
                  border: avatarColor === color ? '2px solid #111827' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Reset password */

function ResetPasswordModal({
  open,
  target,
  onClose,
  onSaved,
}: {
  open: boolean;
  target: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { busy, error, run, reset } = useAsyncAction();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setConfirm('');
    reset();
  }, [open, reset]);

  const valid = password.length >= 8 && password === confirm;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || !target) return;
    void run(() => api.admin.resetPassword(target.id, password), {
      onSuccess: () => onSaved(),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset password"
      subtitle={target ? `Set a new password for ${target.fullName}.` : undefined}
      icon={<KeyRound size={18} />}
      size="narrow"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="reset-password-form" className="btn btn-primary" disabled={!valid || busy}>
            {busy ? <span className="spinner" /> : <KeyRound size={14} />}
            Reset password
          </button>
        </>
      }
    >
      <form id="reset-password-form" className="col" style={{ gap: 14 }} onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label htmlFor="reset-new">New password</label>
          <input
            id="reset-new"
            type="password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={200}
            required
            autoFocus
            autoComplete="new-password"
          />
          <span className="hint">At least 8 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="reset-confirm">Confirm password</label>
          <input
            id="reset-confirm"
            type="password"
            className="input"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            minLength={8}
            maxLength={200}
            required
            autoComplete="new-password"
          />
          {confirm && password !== confirm && (
            <span className="hint" style={{ color: 'var(--rose)' }}>
              Passwords do not match.
            </span>
          )}
        </div>
        <div className="form-note">
          The new password takes effect immediately. Existing sessions remain signed in until they
          refresh.
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Department form */

function DepartmentFormModal({
  open,
  onClose,
  editing,
  seniors,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Department | null;
  seniors: AdminUser[];
  onSaved: (message: string) => void;
}) {
  const toast = useToast();
  const { busy, error, run, reset } = useAsyncAction();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [seniorManagerId, setSeniorManagerId] = useState('');

  useEffect(() => {
    if (!open) return;
    reset();
    setName(editing?.name || '');
    setDescription(editing?.description || '');
    setSeniorManagerId(editing?.senior_manager_id || '');
  }, [open, editing, reset]);

  const valid = name.trim().length >= 2;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const payload = {
      name: name.trim(),
      description: description.trim(),
      seniorManagerId: seniorManagerId || null,
    };
    void run(
      () =>
        editing
          ? api.admin.updateDepartment(editing.id, payload)
          : api.admin.createDepartment(payload),
      {
        onSuccess: () => {
          toast.success(editing ? 'Department updated.' : 'Department created.');
          onSaved(editing ? 'Department updated.' : 'Department created.');
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit department' : 'Create department'}
      subtitle="The senior manager owns department visibility and final completion approvals."
      icon={<Building2 size={18} />}
      size="narrow"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="department-form"
            className="btn btn-primary"
            disabled={!valid || busy}
          >
            {busy ? <span className="spinner" /> : <Building2 size={14} />}
            {editing ? 'Save changes' : 'Create department'}
          </button>
        </>
      }
    >
      <form id="department-form" className="col" style={{ gap: 14 }} onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label htmlFor="dept-name">Name</label>
          <input
            id="dept-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="dept-description">Description</label>
          <textarea
            id="dept-description"
            className="textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            style={{ minHeight: 74 }}
            placeholder="What this department owns…"
          />
        </div>
        <div className="field">
          <label htmlFor="dept-senior">Senior manager</label>
          <select
            id="dept-senior"
            className="select"
            value={seniorManagerId}
            onChange={(event) => setSeniorManagerId(event.target.value)}
          >
            <option value="">Unassigned</option>
            {seniors.map((senior) => (
              <option key={senior.id} value={senior.id}>
                {senior.fullName}
              </option>
            ))}
          </select>
          <span className="hint">
            Only active senior managers can own a department. Leaving this blank is allowed, but the
            department cannot supply a level-two approver until it is assigned.
          </span>
        </div>
      </form>
    </Modal>
  );
}
