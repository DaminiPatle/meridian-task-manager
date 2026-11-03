import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Columns3,
  List,
  ListChecks,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  BOARD_COLUMNS,
  PRIORITY_META,
  STATUS_META,
  STATUS_ORDER,
} from '../lib/constants';
import { dueClass, dueLabel } from '../lib/format';
import type { Priority, Task, TaskKind } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { TaskRow } from '../components/tasks';
import {
  DueDate,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  TabBar,
} from '../components/ui';

const SCOPES = [
  { key: 'all', label: 'All in scope' },
  { key: 'mine', label: 'My tasks' },
  { key: 'created', label: 'Created by me' },
];

export default function TasksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');

  const scope = searchParams.get('scope') || 'all';
  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const kind = searchParams.get('kind') || '';
  const due = searchParams.get('due') || '';
  const query = searchParams.get('q') || '';
  const assigneeId = searchParams.get('assigneeId') || '';

  const filters = useMemo(
    () => ({
      scope: scope === 'all' ? undefined : scope,
      status: status || undefined,
      priority: priority || undefined,
      taskKind: kind || undefined,
      due: due || undefined,
      q: query || undefined,
      assigneeId: assigneeId || undefined,
    }),
    [scope, status, priority, kind, due, query, assigneeId],
  );

  const tasks = useApi(() => api.tasks.list(filters), [
    scope,
    status,
    priority,
    kind,
    due,
    query,
    assigneeId,
  ]);

  useEffect(() => {
    document.title = 'Tasks · Meridian';
  }, []);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      if (user?.role === 'ADMIN') {
        const next = new URLSearchParams(searchParams);
        next.delete('new');
        setSearchParams(next, { replace: true });
      } else {
        setCreateOpen(true);
      }
    }
  }, [searchParams, setSearchParams, user?.role]);

  function patchParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  }

  const list = tasks.data?.tasks || [];
  const counts = useMemo(() => {
    return {
      total: list.length,
      action: list.filter((task) => task.needsMyAction).length,
      overdue: list.filter((task) => (task.dueRisk?.daysLeft ?? 1) < 0).length,
      completed: list.filter((task) => task.status === 'COMPLETED').length,
    };
  }, [list]);

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const column of BOARD_COLUMNS) map[column.key] = [];
    for (const task of list) {
      const column = BOARD_COLUMNS.find((entry) => entry.statuses.includes(task.status));
      if (column) map[column.key].push(task);
    }
    return map;
  }, [list]);

  function closeCreate() {
    setCreateOpen(false);
    if (searchParams.get('new')) patchParams({ new: null });
  }

  if (!user) return null;

  const scopes = [...SCOPES];
  if (user.role === 'MANAGER' || user.role === 'SENIOR_MANAGER') {
    scopes.push({ key: 'team', label: 'My team' });
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={
          <>
            <ListChecks size={13} /> Task workspace
          </>
        }
        title="Tasks"
        subtitle="Every task you can see, governed by the same approval chain. Filter by ownership and status without losing sight of what needs you."
        actions={
          user.role !== 'ADMIN' ? (
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={15} /> New task
            </button>
          ) : (
            <span className="badge badge-slate">Read-only administration view</span>
          )
        }
      />

      <div className="card">
        <div className="card-head" style={{ minHeight: 56 }}>
          <TabBar
            items={scopes.map((entry) => ({ key: entry.key, label: entry.label }))}
            value={scope}
            onChange={(key) => patchParams({ scope: key === 'all' ? null : key })}
          />
          <div className="card-head-actions">
            <div className="tabs">
              <button
                className={`tab ${view === 'list' ? 'active' : ''}`}
                onClick={() => setView('list')}
              >
                <List size={13} /> List
              </button>
              <button
                className={`tab ${view === 'board' ? 'active' : ''}`}
                onClick={() => setView('board')}
              >
                <Columns3 size={13} /> Board
              </button>
            </div>
          </div>
        </div>

        <div className="card-body tight">
          <div className="toolbar">
            <form
              className="search-box"
              onSubmit={(event) => {
                event.preventDefault();
                patchParams({ q: searchInput.trim() || null });
              }}
            >
              <Search size={14} />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onBlur={() => {
                  if (searchInput.trim() !== query) patchParams({ q: searchInput.trim() || null });
                }}
                placeholder="Search title or description…"
              />
            </form>
            <select
              className="select"
              value={status}
              onChange={(event) => patchParams({ status: event.target.value || null })}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {STATUS_ORDER.map((entry) => (
                <option key={entry} value={entry}>
                  {STATUS_META[entry].label}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={priority}
              onChange={(event) => patchParams({ priority: event.target.value || null })}
              aria-label="Filter by priority"
            >
              <option value="">All priorities</option>
              {(Object.keys(PRIORITY_META) as Priority[]).map((entry) => (
                <option key={entry} value={entry}>
                  {PRIORITY_META[entry].label}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={kind}
              onChange={(event) => patchParams({ kind: event.target.value || null })}
              aria-label="Filter by task type"
            >
              <option value="">All task types</option>
              <option value="GROUP">Group tasks</option>
              <option value="STANDARD">Standard tasks</option>
            </select>
            <select
              className="select"
              value={due}
              onChange={(event) => patchParams({ due: event.target.value || null })}
              aria-label="Filter by due date"
            >
              <option value="">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="soon">Due in 3 days</option>
            </select>
            {(scope !== 'all' || status || priority || kind || due || query || assigneeId) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSearchInput('');
                  setSearchParams({}, { replace: true });
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="row wrap mt-3" style={{ gap: 8 }}>
            <span className="chip">{counts.total} tasks</span>
            <span className={`chip ${counts.action ? 'badge-amber' : ''}`}>
              <AlertTriangle size={11} /> {counts.action} need you
            </span>
            <span className="chip">{counts.overdue} overdue</span>
            <span className="chip">
              <CheckCircle2 size={11} /> {counts.completed} completed
            </span>
            {kind === 'GROUP' && (
              <span className="chip">
                <Users size={11} /> Group contributions included
              </span>
            )}
          </div>
        </div>
      </div>

      {tasks.loading && !tasks.data ? (
        <LoadingBlock label="Loading tasks…" />
      ) : tasks.error ? (
        <ErrorBlock message={tasks.error} onRetry={tasks.reload} />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No tasks match these filters"
            description="Try widening the scope or clearing filters. New work will appear here as soon as it is created."
            icon={<ListChecks size={20} />}
            action={
              <button className="btn btn-subtle btn-sm" onClick={() => setSearchParams({}, { replace: true })}>
                Clear all filters
              </button>
            }
          />
        </div>
      ) : view === 'list' ? (
        <div className="card">
          <div className="task-list">
            {list.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                showCreator={scope === 'created' || user.role !== 'EMPLOYEE'}
                onClick={() => navigate(`/tasks/${task.id}`)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="board">
          {BOARD_COLUMNS.map((column) => (
            <div className="board-col" key={column.key}>
              <div className="board-col-head">
                {column.label}
                <span className="count">{grouped[column.key].length}</span>
              </div>
              {grouped[column.key].length === 0 && (
                <div className="board-empty">Nothing here</div>
              )}
              {grouped[column.key].map((task) => (
                <div
                  className="board-card"
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') navigate(`/tasks/${task.id}`);
                  }}
                >
                  <div className="board-card-title">{task.title}</div>
                  <div className="board-card-meta">
                    <span className={`priority ${task.priority}`}>
                      {PRIORITY_META[task.priority].label}
                    </span>
                    {task.taskKind === 'GROUP' && (
                      <span className="badge badge-violet" style={{ height: 19 }}>
                        <Users size={9} /> {task.groupMode}
                      </span>
                    )}
                    {task.taskKind === 'GROUP_PART' && (
                      <span className="chip" style={{ height: 19 }}>
                        Contribution
                      </span>
                    )}
                  </div>
                  <div className="board-card-meta">
                    <span className="person-meta">{task.assigneeName}</span>
                  </div>
                  <div className="board-card-meta">
                    <span className={`due-pill ${dueClass(task.dueDate)}`}>
                      {dueLabel(task.dueDate)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <TaskCreateModal
        open={createOpen}
        onClose={closeCreate}
        onCreated={(task) => navigate(`/tasks/${task.id}`)}
      />
    </div>
  );
}
