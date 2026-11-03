import type { Priority, Role, TaskStatus } from './types';

export const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  SENIOR_MANAGER: 'Senior Manager',
  ADMIN: 'System Administrator',
};

export const ROLE_SHORT: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  SENIOR_MANAGER: 'Senior Mgr',
  ADMIN: 'Admin',
};

export const ROLE_BADGE: Record<Role, string> = {
  EMPLOYEE: 'badge-slate',
  MANAGER: 'badge-indigo',
  SENIOR_MANAGER: 'badge-violet',
  ADMIN: 'badge-rose',
};

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'SENIOR_MANAGER', label: 'Senior Manager' },
  { value: 'ADMIN', label: 'System Administrator' },
];

export interface StatusMeta {
  label: string;
  short: string;
  badge: string;
  description: string;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  PENDING_CREATION_APPROVAL: {
    label: 'Awaiting activation',
    short: 'Activation',
    badge: 'badge-amber',
    description: 'Self-created task waiting for mandatory manager activation approval.',
  },
  CREATION_REJECTED: {
    label: 'Activation rejected',
    short: 'Rejected',
    badge: 'badge-rose',
    description: 'The manager rejected activation. Only the creator can revise and resubmit.',
  },
  ACTIVE: {
    label: 'Active',
    short: 'Active',
    badge: 'badge-blue',
    description: 'Approved and ready to start.',
  },
  IN_PROGRESS: {
    label: 'In progress',
    short: 'In progress',
    badge: 'badge-indigo',
    description: 'Work is underway.',
  },
  PENDING_MANAGER_REVIEW: {
    label: 'Manager review',
    short: 'Manager',
    badge: 'badge-amber',
    description: 'First-level completion review is required from the assigned manager.',
  },
  PENDING_SENIOR_REVIEW: {
    label: 'Senior review',
    short: 'Senior',
    badge: 'badge-violet',
    description: 'Manager approved. Final approval is required from the senior manager.',
  },
  RETURNED_TO_MANAGER: {
    label: 'Returned to manager',
    short: 'With manager',
    badge: 'badge-amber',
    description: 'The senior manager returned this. The manager must request corrections or resubmit.',
  },
  REWORK: {
    label: 'Needs rework',
    short: 'Rework',
    badge: 'badge-rose',
    description: 'Changes were requested. The assignee must revise and resubmit.',
  },
  COMPLETED: {
    label: 'Completed',
    short: 'Completed',
    badge: 'badge-green',
    description: 'Both approval levels are complete and independent ratings are due.',
  },
  CANCELLED: {
    label: 'Cancelled',
    short: 'Cancelled',
    badge: 'badge-slate',
    description: 'This task was closed without completion.',
  },
};

export const STATUS_ORDER: TaskStatus[] = [
  'PENDING_CREATION_APPROVAL',
  'CREATION_REJECTED',
  'ACTIVE',
  'IN_PROGRESS',
  'PENDING_MANAGER_REVIEW',
  'PENDING_SENIOR_REVIEW',
  'RETURNED_TO_MANAGER',
  'REWORK',
  'COMPLETED',
  'CANCELLED',
];

export const BOARD_COLUMNS: {
  key: string;
  label: string;
  statuses: TaskStatus[];
}[] = [
  { key: 'active', label: 'Active work', statuses: ['ACTIVE', 'IN_PROGRESS'] },
  {
    key: 'review',
    label: 'In approval',
    statuses: [
      'PENDING_CREATION_APPROVAL',
      'PENDING_MANAGER_REVIEW',
      'PENDING_SENIOR_REVIEW',
      'RETURNED_TO_MANAGER',
    ],
  },
  { key: 'changes', label: 'Needs changes', statuses: ['REWORK', 'CREATION_REJECTED'] },
  { key: 'done', label: 'Completed', statuses: ['COMPLETED'] },
];

export const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  CRITICAL: { label: 'Critical', badge: 'badge-rose' },
  HIGH: { label: 'High', badge: 'badge-amber' },
  MEDIUM: { label: 'Medium', badge: 'badge-blue' },
  LOW: { label: 'Low', badge: 'badge-slate' },
};

export const EVENT_LABELS: Record<string, string> = {
  created: 'created the task',
  assigned: 'assigned the task',
  updated: 'updated task details',
  start: 'started work',
  approve_creation: 'approved activation',
  reject_creation: 'rejected activation',
  resubmit_creation: 'resubmitted for activation',
  submit_completion: 'submitted for completion review',
  manager_approve: 'approved at manager level',
  manager_reject: 'returned for rework',
  senior_approve: 'gave final approval',
  senior_reject: 'returned the submission to the manager',
  request_corrections: 'requested corrections',
  resubmit_to_senior: 'resubmitted to the senior manager',
  cancel: 'cancelled the task',
  extension_requested: 'requested a timeline extension',
  extension_manager_approved: 'approved the extension at manager level',
  extension_approved: 'approved the timeline extension',
  extension_rejected: 'rejected the timeline extension',
  group_parts_created: 'generated individual contribution tasks',
  rating_submitted: 'submitted an independent rating',
  rating_updated: 'updated an independent rating',
};

export const EXTENSION_STATUS_META: Record<
  string,
  { label: string; badge: string }
> = {
  PENDING_MANAGER: { label: 'Awaiting manager', badge: 'badge-amber' },
  PENDING_SENIOR: { label: 'Awaiting senior manager', badge: 'badge-violet' },
  APPROVED: { label: 'Approved', badge: 'badge-green' },
  REJECTED: { label: 'Rejected', badge: 'badge-rose' },
  CANCELLED: { label: 'Cancelled', badge: 'badge-slate' },
};

export const AI_SOURCE_LABELS: Record<string, string> = {
  llm: 'Live AI',
  heuristic: 'Built-in analysis',
  'heuristic-fallback': 'Built-in fallback',
};

export type TaskActionName =
  | 'start'
  | 'approve_creation'
  | 'reject_creation'
  | 'resubmit_creation'
  | 'submit_completion'
  | 'manager_approve'
  | 'manager_reject'
  | 'senior_approve'
  | 'senior_reject'
  | 'request_corrections'
  | 'resubmit_to_senior'
  | 'cancel';

export interface ActionConfig {
  action: TaskActionName;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'danger' | 'success';
  commentRequired: boolean;
  commentLabel: string;
  commentPlaceholder: string;
  successMessage: string;
}

const quote = (title: string) => `“${title}”`;

export function buildActionConfig(action: TaskActionName, taskTitle: string): ActionConfig {
  const title = quote(taskTitle);
  switch (action) {
    case 'start':
      return {
        action,
        title: 'Start work',
        description: `${title} will move into progress. Your manager can see that work has started.`,
        confirmLabel: 'Start task',
        tone: 'primary',
        commentRequired: false,
        commentLabel: 'Note (optional)',
        commentPlaceholder: 'Anything your team should know before you begin?',
        successMessage: 'Work started.',
      };
    case 'approve_creation':
      return {
        action,
        title: 'Approve task activation',
        description: `Approving activates ${title} immediately. Self-created employee tasks cannot bypass this mandatory manager gate.`,
        confirmLabel: 'Approve activation',
        tone: 'success',
        commentRequired: false,
        commentLabel: 'Note (optional)',
        commentPlaceholder: 'Add context for the audit trail…',
        successMessage: 'Task activated.',
      };
    case 'reject_creation':
      return {
        action,
        title: 'Reject activation',
        description: `The task will be returned to its creator with your feedback. Only the creator can revise and resubmit.`,
        confirmLabel: 'Reject task',
        tone: 'danger',
        commentRequired: true,
        commentLabel: 'Reason for rejection',
        commentPlaceholder: 'Explain what needs to change before this task can be activated…',
        successMessage: 'Activation rejected.',
      };
    case 'resubmit_creation':
      return {
        action,
        title: 'Resubmit for activation',
        description: `Send ${title} back to your manager for activation approval. Your revision history is preserved.`,
        confirmLabel: 'Resubmit task',
        tone: 'primary',
        commentRequired: false,
        commentLabel: 'What changed? (optional)',
        commentPlaceholder: 'Summarise the changes you made…',
        successMessage: 'Resubmitted for activation.',
      };
    case 'submit_completion':
      return {
        action,
        title: 'Submit for completion',
        description: `This starts the mandatory two-tier review: manager first, then senior manager. Both levels must approve before ${title} is complete.`,
        confirmLabel: 'Submit for review',
        tone: 'primary',
        commentRequired: false,
        commentLabel: 'Submission note (optional)',
        commentPlaceholder: 'Summarise the delivered work, links or evidence…',
        successMessage: 'Submitted for manager review.',
      };
    case 'manager_approve':
      return {
        action,
        title: 'Approve at manager level',
        description: `Your approval moves ${title} to the senior manager for final approval. The two-tier requirement cannot be skipped.`,
        confirmLabel: 'Approve & send to senior',
        tone: 'primary',
        commentRequired: false,
        commentLabel: 'Review note (optional)',
        commentPlaceholder: 'Share your assessment with the senior manager…',
        successMessage: 'Sent to the senior manager for final approval.',
      };
    case 'manager_reject':
      return {
        action,
        title: 'Return for rework',
        description: `The assignee will be asked to revise and resubmit. Every comment and status change remains in the audit trail.`,
        confirmLabel: 'Return for rework',
        tone: 'danger',
        commentRequired: true,
        commentLabel: 'What needs to change?',
        commentPlaceholder: 'Give the assignee specific, actionable feedback…',
        successMessage: 'Returned to the assignee for rework.',
      };
    case 'senior_approve':
      return {
        action,
        title: 'Final approval',
        description: `This completes ${title} and unlocks independent manager and senior manager ratings.`,
        confirmLabel: 'Approve completion',
        tone: 'success',
        commentRequired: false,
        commentLabel: 'Final note (optional)',
        commentPlaceholder: 'Record your final assessment…',
        successMessage: 'Task completed.',
      };
    case 'senior_reject':
      return {
        action,
        title: 'Return to manager',
        description: `Per policy, this routes back to the manager — not the employee. The manager will decide whether to request corrections or resubmit.`,
        confirmLabel: 'Return to manager',
        tone: 'danger',
        commentRequired: true,
        commentLabel: 'Why are you returning this?',
        commentPlaceholder: 'Explain what the manager must resolve…',
        successMessage: 'Returned to the manager.',
      };
    case 'request_corrections':
      return {
        action,
        title: 'Request corrections',
        description: `The task returns to the assignee for rework with your notes. This decision is recorded for the senior manager to see.`,
        confirmLabel: 'Request corrections',
        tone: 'danger',
        commentRequired: true,
        commentLabel: 'Corrections required',
        commentPlaceholder: 'Tell the assignee exactly what to fix…',
        successMessage: 'Corrections requested from the assignee.',
      };
    case 'resubmit_to_senior':
      return {
        action,
        title: 'Resubmit to senior manager',
        description: `Resubmit the same work without employee changes. Your note is preserved in the audit trail.`,
        confirmLabel: 'Resubmit for final approval',
        tone: 'primary',
        commentRequired: false,
        commentLabel: 'Note for the senior manager (optional)',
        commentPlaceholder: 'Explain why no employee changes were needed…',
        successMessage: 'Resubmitted to the senior manager.',
      };
    case 'cancel':
      return {
        action,
        title: 'Cancel task',
        description: `The task will be closed without completion. This action is recorded in the audit trail.`,
        confirmLabel: 'Cancel task',
        tone: 'danger',
        commentRequired: true,
        commentLabel: 'Reason for cancellation',
        commentPlaceholder: 'Explain why this task is being cancelled…',
        successMessage: 'Task cancelled.',
      };
    default:
      return {
        action: 'start',
        title: 'Update task',
        description: '',
        confirmLabel: 'Confirm',
        tone: 'primary',
        commentRequired: false,
        commentLabel: 'Comment',
        commentPlaceholder: '',
        successMessage: 'Updated.',
      };
  }
}

export const DEMO_ACCOUNTS = [
  { label: 'Employee', name: 'Elena Rossi', email: 'elena.rossi@meridian.io' },
  { label: 'Manager', name: 'James Rivera', email: 'james.rivera@meridian.io' },
  { label: 'Senior Manager', name: 'Sarah Chen', email: 'sarah.chen@meridian.io' },
  { label: 'Administrator', name: 'Maya Patel', email: 'maya.patel@meridian.io' },
];

export const DEMO_PASSWORD = 'demo1234';
