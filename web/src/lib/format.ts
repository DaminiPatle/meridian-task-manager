const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Parse a YYYY-MM-DD date as local midday so time zones cannot shift the day. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysISO(value: string, days: number): string {
  const d = parseDateOnly(value) || new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(value: string | null | undefined, withYear = true): string {
  if (!value) return '—';
  const d = parseDateOnly(value);
  if (!d) return '—';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${withYear ? `, ${d.getFullYear()}` : ''}`;
}

export function formatDateLong(value: string | null | undefined): string {
  if (!value) return '—';
  const d = parseDateOnly(value);
  if (!d) return '—';
  return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${time}`;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return formatDate(String(value).slice(0, 10));
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysUntil(value: string | null | undefined): number | null {
  const d = parseDateOnly(value);
  if (!d) return null;
  const today = startOfDay(new Date());
  return Math.round((startOfDay(d).getTime() - today.getTime()) / 86400000);
}

export function dueLabel(value: string | null | undefined): string {
  const days = daysUntil(value);
  if (days === null) return 'No due date';
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return '1 day overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 14) return `Due in ${days} days`;
  return `Due ${formatDate(value, false)}`;
}

export function dueClass(value: string | null | undefined): string {
  const days = daysUntil(value);
  if (days === null) return '';
  if (days < 0) return 'overdue';
  if (days <= 2) return 'soon';
  return '';
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function firstName(name: string | null | undefined): string {
  if (!name) return '';
  return String(name).trim().split(/\s+/)[0] || '';
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : pluralForm || `${singular}s`}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}h`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value)}%`;
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value * 10) / 10}`;
}

export function formatCompact(value: number): string {
  if (value < 1000) return String(value);
  return `${Math.round(value / 100) / 10}k`;
}

export function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export function monthLabel(value: string | null | undefined): string {
  const d = parseDateOnly(value);
  if (!d) return '';
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
