export type Role = 'EMPLOYEE' | 'MANAGER' | 'SENIOR_MANAGER' | 'ADMIN';

export type TaskStatus =
  | 'PENDING_CREATION_APPROVAL'
  | 'CREATION_REJECTED'
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'PENDING_MANAGER_REVIEW'
  | 'PENDING_SENIOR_REVIEW'
  | 'RETURNED_TO_MANAGER'
  | 'REWORK'
  | 'COMPLETED'
  | 'CANCELLED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type GroupMode = 'A' | 'B';
export type TaskKind = 'STANDARD' | 'GROUP' | 'GROUP_PART';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  title: string;
  departmentId: string | null;
  departmentName: string | null;
  managerId: string | null;
  managerName: string | null;
  avatarColor: string;
  isActive: boolean;
}

export interface DueRisk {
  daysLeft: number;
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  taskKind: TaskKind;
  groupMode: GroupMode | null;
  parentTaskId: string | null;
  status: TaskStatus;
  statusGroup: 'open' | 'review' | 'changes' | 'completed';
  priority: Priority;
  createdBy: string;
  creatorName: string;
  creatorColor: string;
  creatorRole: Role;
  assigneeId: string;
  assigneeName: string;
  assigneeColor: string;
  assigneeRole: Role;
  assigneeTitle: string;
  departmentId: string;
  departmentName: string;
  managerId: string;
  managerName: string;
  managerColor: string;
  seniorManagerId: string;
  seniorManagerName: string;
  seniorManagerColor: string;
  startDate: string | null;
  dueDate: string | null;
  originalDueDate: string | null;
  completedAt: string | null;
  effortHours: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  partCount: number;
  partCompleted: number;
  groupProgress: number | null;
  pendingExtensionCount: number;
  pendingExtensionId: string | null;
  pendingExtensionStatus: string | null;
  hasManagerRating: boolean;
  hasSeniorRating: boolean;
  source: 'SELF' | 'ASSIGNED';
  needsMyAction?: boolean;
  myActionLabel?: string | null;
  dueRisk?: DueRisk | null;
}

export interface GroupMember {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
  title: string;
  avatarColor: string;
  isLeader: boolean;
  partId: string | null;
  partStatus: TaskStatus | null;
}

export interface Rating {
  id: string;
  taskId: string;
  raterId: string;
  raterName: string;
  raterColor: string;
  raterTitle: string;
  raterRole: 'MANAGER' | 'SENIOR_MANAGER';
  score: number;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface Extension {
  id: string;
  taskId: string;
  requestedBy: string;
  requesterName: string;
  requesterColor: string;
  currentDueDate: string;
  requestedDueDate: string;
  reason: string;
  status: 'PENDING_MANAGER' | 'PENDING_SENIOR' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  managerComment: string;
  seniorComment: string;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
  taskTitle?: string;
  taskStatus?: string;
  taskDueDate?: string;
  taskAssigneeId?: string;
  taskManagerId?: string;
  taskSeniorManagerId?: string;
}

export interface TaskEvent {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string;
  actorColor: string;
  actorRole: Role | null;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  comment: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  authorRole: Role;
  body: string;
  createdAt: string;
}

export interface TaskPermissions {
  canStart: boolean;
  canSubmit: boolean;
  canSubmitCreation: boolean;
  canApproveCreation: boolean;
  canManagerReview: boolean;
  canSeniorReview: boolean;
  canDecideReturn: boolean;
  canRequestExtension: boolean;
  canEdit: boolean;
  canCancel: boolean;
  canRateManager: boolean;
  canRateSenior: boolean;
  canComment: boolean;
  isAssignee: boolean;
  isManager: boolean;
  isSenior: boolean;
  isCreator: boolean;
  isGroupMember: boolean;
  isAdmin: boolean;
  readOnly: boolean;
  groupReady: boolean;
  groupReadinessReason: string | null;
}

export interface GroupReadiness {
  mode: GroupMode;
  mandatoryCount: number;
  completedMandatory: number;
  totalParts: number;
  completedParts: number;
  ready: boolean;
  reason: string | null;
}

export interface TaskDetail extends Task {
  parts: Task[];
  members: GroupMember[];
  parent: {
    id: string;
    title: string;
    status: TaskStatus;
    groupMode: GroupMode | null;
    assigneeId: string;
    assigneeName: string;
  } | null;
  ratings: Rating[];
  extensions: Extension[];
  pendingExtension: Extension | null;
  events: TaskEvent[];
  comments: TaskComment[];
  permissions: TaskPermissions;
  groupReadiness: GroupReadiness | null;
}

export interface Directory {
  canCreateTasks: boolean;
  assignable: User[];
  groupCandidates: User[];
  users: User[];
}

export interface Approvals {
  creation: Task[];
  managerReviews: Task[];
  seniorReviews: Task[];
  returned: Task[];
  mySubmissions: Task[];
  ratingsDue: Task[];
  needsRework: Task[];
  readyGroups: Task[];
  extensions: ApprovalExtension[];
  total: number;
}

export interface ApprovalExtension extends Extension {
  task: Task;
}

export interface Metrics {
  total: number;
  completed: number;
  open: number;
  overdue: number;
  completionRate: number;
  onTimeRate: number;
  onTimeCompleted: number;
  avgCycleDays: number | null;
  avgEffortHours: number | null;
  managerRating: number | null;
  managerRatingCount: number;
  seniorRating: number | null;
  seniorRatingCount: number;
  ratingGap: number;
}

export interface ReportPerson {
  id: string;
  fullName: string;
  role: Role;
  title: string;
  avatarColor: string;
}

export interface ReportTeamRow {
  user: ReportPerson & { departmentName?: string | null };
  assigned: Metrics;
  selfCreated: Metrics;
  combined: Metrics;
}

export interface RatingDistribution {
  average: number | null;
  count: number;
  distribution: { score: number; count: number }[];
}

export interface Report {
  target: { id: string; fullName: string; role: Role };
  scopeLabel: string;
  period: { from: string; to: string };
  subjects: ReportPerson[];
  assigned: Metrics;
  selfCreated: Metrics;
  combined: Metrics;
  ratings: { manager: RatingDistribution; senior: RatingDistribution };
  statusBreakdown: { status: TaskStatus; count: number }[];
  team: ReportTeamRow[];
}

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  title: string;
  avatarColor: string;
  departmentName: string | null;
  managerName: string | null;
  managerId: string | null;
  isSelf: boolean;
  openTasks: number;
  overdue: number;
  completed: number;
  total: number;
  completionRate: number;
  effortHours: number;
  avgManagerRating: number | null;
  avgSeniorRating: number | null;
  ratingCount: number;
  currentFocus: { id: string; title: string; status: TaskStatus; dueDate: string | null }[];
}

export interface TeamOverview {
  scopeLabel: string;
  members: TeamMember[];
  summary: {
    people: number;
    open: number;
    overdue: number;
    completed: number;
    avgCompletionRate: number;
  };
}

export interface WorkloadEntry {
  userId: string;
  name: string;
  role: Role;
  title: string;
  avatarColor: string;
  openTasks: number;
  overdue: number;
  dueSoon: number;
  effortHours: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RiskEntry {
  taskId: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  assigneeColor: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  daysLeft: number | null;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
}

export interface Insights {
  generatedAt: string;
  scopeLabel: string;
  source: string;
  summary: string;
  totals: {
    open: number;
    overdue: number;
    dueSoon: number;
    pendingApprovals: number;
    completedThisMonth: number;
    people: number;
  };
  workload: WorkloadEntry[];
  risks: RiskEntry[];
  suggestions: string[];
}

export interface DashboardAction {
  type: string;
  label: string;
  task: Task;
  urgency: string;
  extension?: ApprovalExtension;
}

export interface ActivityEntry {
  id: string;
  action: string;
  comment: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  createdAt: string;
  taskId: string;
  taskTitle: string;
  taskKind: TaskKind;
  actorName: string;
  actorColor: string;
  actorRole: Role | null;
}

export interface Dashboard {
  generatedAt: string;
  stats: {
    openTasks: number;
    teamOpen: number;
    awaitingAction: number;
    overdue: number;
    completedThisMonth: number;
    ratingDue: number;
    people: number;
    completionRate: number;
  };
  actions: DashboardAction[];
  actionOverflow: number;
  focus: Task[];
  activity: ActivityEntry[];
  insights: Insights;
  teamPreview: TeamOverview | null;
  approvals: {
    total: number;
    creation: number;
    manager: number;
    senior: number;
    returned: number;
    extensions: number;
    ratings: number;
  };
}

export interface MeetingParticipant {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  title: string;
  avatarColor: string;
}

export interface MeetingActionItem {
  text: string;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: string | null;
  done: boolean;
  taskId: string | null;
  owner?: MeetingParticipant | null;
}

export interface Meeting {
  id: string;
  title: string;
  meetingDate: string;
  departmentId: string;
  departmentName: string;
  createdBy: string;
  creatorName: string;
  creatorColor: string;
  creatorRole: Role;
  participants: MeetingParticipant[];
  participantIds: string[];
  summary: string;
  decisions: string[];
  actionItems: MeetingActionItem[];
  status: 'DRAFT' | 'PROCESSED';
  processedAt: string | null;
  aiSource: string | null;
  createdAt: string;
  updatedAt: string;
  hasTranscript: boolean;
  transcriptChars: number;
  transcript: string | null;
  transcriptRestricted: boolean;
  permissions: {
    canViewTranscript: boolean;
    canProcess: boolean;
    canCreateTasks: boolean;
    isCreator: boolean;
  };
  decisionCount?: number;
  actionCount?: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  taskId: string | null;
  meetingId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  senior_manager_id: string | null;
  senior_manager_name: string | null;
  senior_manager_color: string | null;
  description: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  title: string;
  managerId: string | null;
  managerName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  avatarColor: string;
  isActive: boolean;
  createdAt: string;
  openTasks: number;
  directReports: number;
}

export interface AiSettings {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  temperature: number;
  hasKey: boolean;
  keyHint: string;
}

export interface AdminOverview {
  counts: {
    users: number;
    activeUsers: number;
    departments: number;
    tasks: number;
    openTasks: number;
    meetings: number;
    pendingApprovals: number;
  };
  departments: Department[];
  ai: AiSettings & { lastUpdated: string | null; lastUpdatedBy: string | null };
  guardrails: Record<string, boolean>;
}
