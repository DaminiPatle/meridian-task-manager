import type {
  AdminOverview,
  AdminUser,
  AiSettings,
  Approvals,
  Dashboard,
  Department,
  Directory,
  Extension,
  Insights,
  Meeting,
  Notification,
  Rating,
  Report,
  Task,
  TaskComment,
  TaskDetail,
  TeamOverview,
  User,
} from './types';

const TOKEN_KEY = 'meridian.token';
// In local dev this stays "/api" and Vite proxies it to localhost:4000.
// In production (Vercel) set VITE_API_URL to the deployed API, e.g.
// https://meridian-api.up.railway.app/api
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined> = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiError(0, 'Cannot reach the Meridian server. Check that the API is running.');
  }

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
      window.dispatchEvent(new CustomEvent('meridian:unauthorized'));
    }
    const message =
      payload?.error ||
      (response.status === 403
        ? 'You do not have permission to perform this action'
        : `Request failed (${response.status})`);
    throw new ApiError(response.status, message, payload?.details);
  }

  return payload as T;
}

export const api = {
  auth: {
    async login(email: string, password: string) {
      return request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
    },
    async me() {
      return request<{ user: User }>('/auth/me');
    },
    async changePassword(currentPassword: string, newPassword: string) {
      return request<{ ok: boolean }>('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
    },
  },

  directory() {
    return request<Directory>('/users/directory');
  },

  dashboard() {
    return request<Dashboard>('/dashboard');
  },

  tasks: {
    list(params: Record<string, string | number | boolean | null | undefined> = {}) {
      return request<{ tasks: Task[] }>(`/tasks${buildQuery(params)}`);
    },
    get(id: string) {
      return request<{ task: TaskDetail }>(`/tasks/${id}`);
    },
    create(body: unknown) {
      return request<{ task: TaskDetail }>('/tasks', { method: 'POST', body });
    },
    update(id: string, body: unknown) {
      return request<{ task: TaskDetail }>(`/tasks/${id}`, { method: 'PATCH', body });
    },
    action(id: string, action: string, comment?: string) {
      return request<{ task: TaskDetail }>(`/tasks/${id}/actions`, {
        method: 'POST',
        body: { action, comment },
      });
    },
    comment(id: string, body: string) {
      return request<{ comment: TaskComment }>(`/tasks/${id}/comments`, {
        method: 'POST',
        body: { body },
      });
    },
    rate(id: string, score: number, remarks: string) {
      return request<{ ratings: Rating[] }>(`/tasks/${id}/ratings`, {
        method: 'POST',
        body: { score, remarks },
      });
    },
    requestExtension(id: string, requestedDueDate: string, reason: string) {
      return request<{ extension: Extension }>(`/tasks/${id}/extensions`, {
        method: 'POST',
        body: { requestedDueDate, reason },
      });
    },
  },

  extensions: {
    decide(id: string, decision: 'approve' | 'reject', comment?: string) {
      return request<{ extension: Extension }>(`/extensions/${id}/decision`, {
        method: 'POST',
        body: { decision, comment },
      });
    },
  },

  approvals() {
    return request<Approvals>('/approvals');
  },

  reports: {
    get(params: { userId?: string; from?: string; to?: string } = {}) {
      return request<Report>(`/reports${buildQuery(params)}`);
    },
    team() {
      return request<TeamOverview>('/reports/team');
    },
  },

  team() {
    return request<TeamOverview>('/users/team');
  },

  meetings: {
    list() {
      return request<{ meetings: Meeting[] }>('/meetings');
    },
    get(id: string) {
      return request<{ meeting: Meeting }>(`/meetings/${id}`);
    },
    create(body: {
      title: string;
      meetingDate: string;
      participantIds?: string[];
      transcript?: string;
    }) {
      return request<{ meeting: Meeting }>('/meetings', { method: 'POST', body });
    },
    process(id: string) {
      return request<{ meeting: Meeting }>(`/meetings/${id}/process`, { method: 'POST' });
    },
    createTaskFromAction(
      id: string,
      index: number,
      body: { assigneeId?: string; dueDate?: string; priority?: string } = {},
    ) {
      return request<{ task: TaskDetail; meetingId: string; index: number }>(
        `/meetings/${id}/action-items/${index}/create-task`,
        { method: 'POST', body },
      );
    },
  },

  insights() {
    return request<{ insights: Insights }>('/ai/insights');
  },

  notifications: {
    list() {
      return request<{ items: Notification[]; unread: number }>('/notifications');
    },
    readAll() {
      return request<{ ok: boolean; unread: number }>('/notifications/read-all', { method: 'POST' });
    },
    read(id: string) {
      return request<{ ok: boolean; unread: number }>(`/notifications/${id}/read`, {
        method: 'POST',
      });
    },
  },

  admin: {
    overview() {
      return request<AdminOverview>('/admin/overview');
    },
    users() {
      return request<{ users: AdminUser[]; departments: Department[] }>('/admin/users');
    },
    createUser(body: unknown) {
      return request<{ user: AdminUser }>('/admin/users', { method: 'POST', body });
    },
    updateUser(id: string, body: unknown) {
      return request<{ user: AdminUser }>(`/admin/users/${id}`, { method: 'PATCH', body });
    },
    resetPassword(id: string, newPassword: string) {
      return request<{ ok: boolean }>(`/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: { newPassword },
      });
    },
    departments() {
      return request<{ departments: Department[] }>('/admin/departments');
    },
    createDepartment(body: unknown) {
      return request<{ department: Department }>('/admin/departments', { method: 'POST', body });
    },
    updateDepartment(id: string, body: unknown) {
      return request<{ department: Department }>(`/admin/departments/${id}`, {
        method: 'PATCH',
        body,
      });
    },
    aiSettings() {
      return request<{ ai: AiSettings }>('/admin/settings/ai');
    },
    saveAiSettings(body: unknown) {
      return request<{ ai: AiSettings }>('/admin/settings/ai', { method: 'PUT', body });
    },
  },
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
