import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Inbox, Star, X } from 'lucide-react';
import { PRIORITY_META, ROLE_BADGE, ROLE_LABELS, STATUS_META } from '../lib/constants';
import { dueClass, dueLabel, formatDate, initials, plural } from '../lib/format';
import type { Priority, Role, TaskStatus } from '../lib/types';

/* ------------------------------------------------------------------ Avatar */
export function Avatar({
  name,
  color,
  size = 30,
  title,
}: {
  name: string;
  color?: string | null;
  size?: number;
  title?: string;
}) {
  return (
    <span
      className="avatar"
      title={title || name}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.36)),
        background: color || '#6366f1',
      }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = 26,
}: {
  people: { name: string; color?: string | null; id?: string }[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const remaining = people.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((person, index) => (
        <Avatar
          key={`${person.id || person.name}-${index}`}
          name={person.name}
          color={person.color}
          size={size}
        />
      ))}
      {remaining > 0 && (
        <span
          className="avatar-stack-more"
          style={{ width: size, height: size }}
          title={`${remaining} more`}
        >
          +{remaining}
        </span>
      )}
    </span>
  );
}

export function Person({
  name,
  color,
  meta,
  size = 30,
  className = '',
}: {
  name: string;
  color?: string | null;
  meta?: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`person ${className}`}>
      <Avatar name={name} color={color} size={size} />
      <span style={{ minWidth: 0 }}>
        <span className="person-name" style={{ display: 'block' }}>
          {name}
        </span>
        {meta && <span className="person-meta" style={{ display: 'block' }}>{meta}</span>}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ Badges */
export function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status] || {
    label: status,
    badge: 'badge-slate',
    description: '',
    short: status,
  };
  return (
    <span className={`badge ${meta.badge}`} title={meta.description}>
      <span className="dot" />
      {meta.label}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority] || { label: priority, badge: 'badge-slate' };
  return <span className={`priority ${priority}`}>{meta.label}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority] || { label: priority, badge: 'badge-slate' };
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge ${ROLE_BADGE[role] || 'badge-slate'}`}>{ROLE_LABELS[role] || role}</span>;
}

export function DueDate({
  date,
  withIcon = true,
}: {
  date: string | null | undefined;
  withIcon?: boolean;
}) {
  return (
    <span className={`due-pill ${dueClass(date)}`} title={date ? formatDate(date) : undefined}>
      {withIcon && <CalendarDays size={12.5} />}
      {dueLabel(date)}
    </span>
  );
}

/* ------------------------------------------------------------------ Progress */
export function Progress({
  value,
  tone,
  label,
}: {
  value: number;
  tone?: 'green' | 'amber' | 'rose' | 'slate';
  label?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div className={`progress ${tone || ''}`} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Page header */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="page-head-main">
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Stat card */
export function StatCard({
  label,
  value,
  icon,
  tone,
  foot,
  small,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'amber' | 'rose' | 'teal' | 'blue';
  foot?: ReactNode;
  small?: ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        {icon && <span className={`stat-icon ${tone || ''}`}>{icon}</span>}
        {label}
      </div>
      <div className="stat-value">
        {value}
        {small && <small>{small}</small>}
      </div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Tabs */
export function TabBar({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string; count?: number; alert?: boolean }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="tabs">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`tab ${value === item.key ? 'active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={`count ${item.alert && item.count > 0 ? 'alert' : ''}`}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Modal */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  tone,
  size,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  tone?: 'rose' | 'green' | 'amber';
  size?: 'wide' | 'narrow';
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`modal ${size || ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          {icon && <div className={`modal-icon ${tone || ''}`}>{icon}</div>}
          <div style={{ minWidth: 0 }}>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ Empty / error */
export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon || <Inbox size={20} />}</div>
      <h4>{title}</h4>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <span className="spinner dark" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card card-pad">
      <div className="empty">
        <div className="empty-icon" style={{ color: 'var(--rose)', background: 'var(--rose-soft)' }}>
          <X size={20} />
        </div>
        <h4>Something went wrong</h4>
        <p>{message}</p>
        {onRetry && (
          <button className="btn btn-subtle btn-sm mt-2" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 99 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton" style={{ height: 11, width: `${55 + (index % 3) * 12}%` }} />
            <div className="skeleton" style={{ height: 9, width: '32%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Stars */
export function Stars({ score, size = 13 }: { score: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={size}
          fill={value <= score ? 'currentColor' : 'none'}
          className={value <= score ? '' : 'star-off'}
          strokeWidth={2}
        />
      ))}
    </span>
  );
}

export function ScoreInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="score-input">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          className={score <= value ? 'on' : ''}
          onClick={() => onChange(score)}
          aria-label={`Rate ${score} out of 5`}
        >
          <Star size={26} fill={score <= value ? 'currentColor' : 'none'} strokeWidth={1.8} />
        </button>
      ))}
      <span className="muted small" style={{ marginLeft: 8 }}>
        {value > 0 ? `${value} / 5` : 'Select a score'}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ misc */
export function SectionCard({
  title,
  subtitle,
  icon,
  actions,
  children,
  footer,
  bodyClass = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  bodyClass?: string;
}) {
  return (
    <section className="card">
      <div className="card-head">
        {icon}
        <div style={{ minWidth: 0 }}>
          <h3>{title}</h3>
          {subtitle && <div className="card-head-sub">{subtitle}</div>}
        </div>
        {actions && <div className="card-head-actions">{actions}</div>}
      </div>
      <div className={`card-body ${bodyClass}`}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  );
}

export function MetaRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="meta-row">
      <span className="meta-row-icon">{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div className="meta-row-label">{label}</div>
        <div className="meta-row-value">{value}</div>
      </div>
    </div>
  );
}

export function CountPill({ count, label }: { count: number; label?: string }) {
  return (
    <span className="chip">
      {count} {label || plural(count, 'item')}
    </span>
  );
}
