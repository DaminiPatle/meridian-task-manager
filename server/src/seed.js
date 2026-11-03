import { addDays, newId, now, stringifyJson, today } from './util.js';
import { hashPassword } from './auth.js';

const PASSWORD = 'demo1234';

function ago(days, hours = 0) {
  return new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();
}

function dateOffset(days) {
  return addDays(today(), days);
}

export function resetDatabase(db) {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM notifications;
    DELETE FROM task_events;
    DELETE FROM task_comments;
    DELETE FROM extension_requests;
    DELETE FROM ratings;
    DELETE FROM group_members;
    DELETE FROM tasks;
    DELETE FROM meetings;
    DELETE FROM users;
    DELETE FROM departments;
    DELETE FROM settings;
    PRAGMA foreign_keys = ON;
  `);
}

export function seedDemo(db, { force = false } = {}) {
  const count = Number(db.prepare('SELECT COUNT(*) AS c FROM users').get().c);
  if (count > 0 && !force) return { seeded: false };
  if (count > 0) resetDatabase(db);

  const ts = now();
  const hash = hashPassword(PASSWORD);

  const departments = [
    ['dep_eng', 'Engineering', 'Product and platform engineering', 'usr_sarah'],
    ['dep_prod', 'Product', 'Product design, research and analytics', 'usr_david'],
  ];
  for (const [id, name, description] of departments) {
    db.prepare(
      'INSERT INTO departments (id, name, senior_manager_id, description, created_at) VALUES (?, ?, NULL, ?, ?)',
    ).run(id, name, description, ts);
  }

  const users = [
    ['usr_maya', 'maya.patel@meridian.io', 'Maya Patel', 'ADMIN', 'System Administrator', null, null, '#f43f5e'],
    ['usr_sarah', 'sarah.chen@meridian.io', 'Sarah Chen', 'SENIOR_MANAGER', 'VP of Engineering', null, 'dep_eng', '#8b5cf6'],
    ['usr_david', 'david.okafor@meridian.io', 'David Okafor', 'SENIOR_MANAGER', 'VP of Product', null, 'dep_prod', '#06b6d4'],
    ['usr_james', 'james.rivera@meridian.io', 'James Rivera', 'MANAGER', 'Engineering Manager', 'usr_sarah', 'dep_eng', '#6366f1'],
    ['usr_grace', 'grace.kim@meridian.io', 'Grace Kim', 'MANAGER', 'Platform Manager', 'usr_sarah', 'dep_eng', '#ec4899'],
    ['usr_priya', 'priya.nair@meridian.io', 'Priya Nair', 'MANAGER', 'Product Manager', 'usr_david', 'dep_prod', '#f59e0b'],
    ['usr_elena', 'elena.rossi@meridian.io', 'Elena Rossi', 'EMPLOYEE', 'Senior Software Engineer', 'usr_james', 'dep_eng', '#10b981'],
    ['usr_marcus', 'marcus.lee@meridian.io', 'Marcus Lee', 'EMPLOYEE', 'Frontend Engineer', 'usr_james', 'dep_eng', '#f97316'],
    ['usr_aisha', 'aisha.khan@meridian.io', 'Aisha Khan', 'EMPLOYEE', 'QA Engineer', 'usr_james', 'dep_eng', '#14b8a6'],
    ['usr_tom', 'tom.becker@meridian.io', 'Tom Becker', 'EMPLOYEE', 'Backend Engineer', 'usr_james', 'dep_eng', '#a855f7'],
    ['usr_leo', 'leo.martins@meridian.io', 'Leo Martins', 'EMPLOYEE', 'Site Reliability Engineer', 'usr_grace', 'dep_eng', '#84cc16'],
    ['usr_nina', 'nina.alvarez@meridian.io', 'Nina Alvarez', 'EMPLOYEE', 'Product Designer', 'usr_priya', 'dep_prod', '#ec4899'],
    ['usr_omar', 'omar.haddad@meridian.io', 'Omar Haddad', 'EMPLOYEE', 'Product Analyst', 'usr_priya', 'dep_prod', '#0891b2'],
  ];

  for (const [id, email, name, role, title, managerId, departmentId, color] of users) {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, role, title, manager_id, department_id, avatar_color, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(id, email, hash, name, role, title, managerId, departmentId, color, ago(120));
  }
  db.prepare('UPDATE departments SET senior_manager_id = ? WHERE id = ?').run('usr_sarah', 'dep_eng');
  db.prepare('UPDATE departments SET senior_manager_id = ? WHERE id = ?').run('usr_david', 'dep_prod');

  function event(taskId, actorId, action, from, to, at, comment = '', metadata = {}) {
    db.prepare(
      `INSERT INTO task_events (id, task_id, actor_id, action, from_status, to_status, comment, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId('evt_'), taskId, actorId, action, from, to, comment, stringifyJson(metadata), at);
  }

  function task(data) {
    const {
      id,
      title,
      description = '',
      taskKind = 'STANDARD',
      groupMode = null,
      parentTaskId = null,
      status,
      priority = 'MEDIUM',
      createdBy,
      assigneeId,
      departmentId,
      managerId,
      seniorManagerId,
      dueDate,
      startDate = null,
      completedAt = null,
      effortHours = null,
      createdAt,
      tags = [],
    } = data;
    db.prepare(
      `INSERT INTO tasks (id, title, description, task_kind, group_mode, parent_task_id, status, priority,
        created_by, assignee_id, department_id, manager_id, senior_manager_id, start_date, due_date,
        original_due_date, completed_at, effort_hours, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      title,
      description,
      taskKind,
      groupMode,
      parentTaskId,
      status,
      priority,
      createdBy,
      assigneeId,
      departmentId,
      managerId,
      seniorManagerId,
      startDate,
      dueDate,
      dueDate,
      completedAt,
      effortHours,
      stringifyJson(tags),
      createdAt,
      completedAt || createdAt,
    );
  }

  function member(taskId, userId, isLeader = false) {
    db.prepare('INSERT INTO group_members (task_id, user_id, is_leader, added_at) VALUES (?, ?, ?, ?)').run(
      taskId,
      userId,
      isLeader ? 1 : 0,
      ago(8),
    );
  }

  function rating(taskId, raterId, role, score, remarks, at) {
    db.prepare(
      `INSERT INTO ratings (id, task_id, rater_id, rater_role, score, remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId('rat_'), taskId, raterId, role, score, remarks, at, at);
    event(taskId, raterId, 'rating_submitted', 'COMPLETED', 'COMPLETED', at, remarks, { score, raterRole: role });
  }

  function comment(taskId, authorId, body, at) {
    db.prepare(
      'INSERT INTO task_comments (id, task_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(newId('cmt_'), taskId, authorId, body, at);
  }

  const J = 'usr_james';
  const S = 'usr_sarah';
  const E = 'usr_elena';
  const M = 'usr_marcus';
  const A = 'usr_aisha';
  const T = 'usr_tom';
  const G = 'usr_grace';
  const L = 'usr_leo';
  const P = 'usr_priya';
  const D = 'usr_david';
  const N = 'usr_nina';
  const O = 'usr_omar';

  // ---------------------------------------------------------------- Engineering
  task({
    id: 'tsk_sso',
    title: 'Single sign-on rollout',
    description:
      'Prepare the production rollout for SSO across the customer portal. Include fallback handling, rollout gates and a staged migration plan for enterprise accounts.',
    priority: 'HIGH',
    status: 'ACTIVE',
    createdBy: J,
    assigneeId: M,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(5),
    effortHours: 16,
    createdAt: ago(4),
    tags: ['sso', 'portal'],
  });
  event('tsk_sso', J, 'created', null, 'ACTIVE', ago(4), '', { taskKind: 'STANDARD' });
  event('tsk_sso', J, 'assigned', 'ACTIVE', 'ACTIVE', ago(4), 'Assigned to Marcus for implementation.');

  task({
    id: 'tsk_latency',
    title: 'Checkout API latency audit',
    description:
      'Profile the checkout API under peak load and document the top bottlenecks. Include cold-start behaviour, p95 targets and remediation recommendations.',
    priority: 'HIGH',
    status: 'PENDING_SENIOR_REVIEW',
    createdBy: J,
    assigneeId: M,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(2),
    effortHours: 12,
    createdAt: ago(7),
    tags: ['performance', 'checkout'],
  });
  event('tsk_latency', J, 'created', null, 'ACTIVE', ago(7));
  event('tsk_latency', M, 'submit_completion', 'ACTIVE', 'PENDING_MANAGER_REVIEW', ago(1.2), 'Audit complete, appendix attached.');
  event('tsk_latency', J, 'manager_approve', 'PENDING_MANAGER_REVIEW', 'PENDING_SENIOR_REVIEW', ago(0.8), 'Findings look solid. Sending to final review.');
  comment('tsk_latency', M, 'Benchmarks include warm-cache and cold-start paths. The p95 outlier is isolated to token refresh.', ago(1.1));
  comment('tsk_latency', J, 'Please keep the cold-start graph in the final appendix — useful for the Q4 capacity plan.', ago(0.9));

  task({
    id: 'tsk_regression',
    title: 'Release 4.8 regression suite',
    description: 'Complete the regression suite for release 4.8 and attach the pass/fail matrix.',
    priority: 'HIGH',
    status: 'PENDING_MANAGER_REVIEW',
    createdBy: J,
    assigneeId: A,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(1),
    effortHours: 10,
    createdAt: ago(6),
    tags: ['qa', 'release'],
  });
  event('tsk_regression', J, 'created', null, 'ACTIVE', ago(6));
  event('tsk_regression', A, 'submit_completion', 'ACTIVE', 'PENDING_MANAGER_REVIEW', ago(0.5), 'All 82 cases executed; two known flaky tests documented.');

  task({
    id: 'tsk_tokens',
    title: 'Design token migration',
    description:
      'Migrate the remaining legacy colour and spacing values to the shared design-token package, then update the component documentation.',
    priority: 'MEDIUM',
    status: 'PENDING_CREATION_APPROVAL',
    createdBy: E,
    assigneeId: E,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(10),
    effortHours: 14,
    createdAt: ago(0.3),
    tags: ['design-system'],
  });
  event('tsk_tokens', E, 'created', null, 'PENDING_CREATION_APPROVAL', ago(0.3), '', {
    requiresCreationApproval: true,
  });

  task({
    id: 'tsk_sw',
    title: 'Service worker caching fix',
    description: 'Resolve stale-asset caching for returning users and add an invalidation test.',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    createdBy: J,
    assigneeId: T,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(-2),
    completedAt: ago(0.25),
    effortHours: 6,
    createdAt: ago(8),
    tags: ['frontend'],
  });
  event('tsk_sw', J, 'created', null, 'ACTIVE', ago(8));
  event('tsk_sw', T, 'submit_completion', 'ACTIVE', 'PENDING_MANAGER_REVIEW', ago(4));
  event('tsk_sw', J, 'manager_approve', 'PENDING_MANAGER_REVIEW', 'PENDING_SENIOR_REVIEW', ago(3.5));
  event('tsk_sw', S, 'senior_approve', 'PENDING_SENIOR_REVIEW', 'COMPLETED', ago(0.25), 'Clean fix and good regression coverage.');
  rating('tsk_sw', J, 'MANAGER', 4, 'Fast turnaround and a clear rollback path.', ago(0.2));
  rating('tsk_sw', S, 'SENIOR_MANAGER', 5, 'Excellent incident follow-through; documentation was ready for audit.', ago(0.15));
  comment('tsk_sw', S, 'Strong recovery work under incident pressure.', ago(0.12));

  task({
    id: 'tsk_index',
    title: 'Database index cleanup',
    description: 'Remove redundant indexes and validate query plans after the cleanup.',
    priority: 'LOW',
    status: 'ACTIVE',
    createdBy: J,
    assigneeId: T,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(-4),
    effortHours: 8,
    createdAt: ago(12),
    tags: ['database'],
  });
  event('tsk_index', J, 'created', null, 'ACTIVE', ago(12));

  task({
    id: 'tsk_runbook',
    title: 'On-call runbook refresh',
    description: 'Update the incident runbook with the new escalation tree and recovery steps.',
    priority: 'MEDIUM',
    status: 'RETURNED_TO_MANAGER',
    createdBy: J,
    assigneeId: E,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(3),
    effortHours: 5,
    createdAt: ago(6),
    tags: ['on-call'],
  });
  event('tsk_runbook', J, 'created', null, 'ACTIVE', ago(6));
  event('tsk_runbook', E, 'submit_completion', 'ACTIVE', 'PENDING_MANAGER_REVIEW', ago(1.5), 'Runbook updated with new escalation contacts.');
  event('tsk_runbook', J, 'manager_approve', 'PENDING_MANAGER_REVIEW', 'PENDING_SENIOR_REVIEW', ago(1.2));
  event(
    'tsk_runbook',
    S,
    'senior_reject',
    'PENDING_SENIOR_REVIEW',
    'RETURNED_TO_MANAGER',
    ago(0.8),
    'Please attach incident metrics and a rollback plan before final approval.',
  );
  comment('tsk_runbook', S, 'Returning to James: the runbook still lacks rollback validation for the database failover path.', ago(0.8));
  comment('tsk_runbook', J, 'Understood. I’ll gather the metrics from Elena and decide whether to resubmit or send it back with corrections.', ago(0.6));

  task({
    id: 'tsk_a11y',
    title: 'Accessibility remediation',
    description: 'Resolve WCAG 2.2 AA findings across the account settings and billing surfaces.',
    priority: 'HIGH',
    status: 'REWORK',
    createdBy: A,
    assigneeId: A,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(2),
    effortHours: 9,
    createdAt: ago(9),
    tags: ['accessibility'],
  });
  event('tsk_a11y', A, 'created', null, 'PENDING_CREATION_APPROVAL', ago(9), '', { requiresCreationApproval: true });
  event('tsk_a11y', J, 'approve_creation', 'PENDING_CREATION_APPROVAL', 'ACTIVE', ago(8.6));
  event('tsk_a11y', A, 'submit_completion', 'ACTIVE', 'PENDING_MANAGER_REVIEW', ago(2), 'Contrast fixes complete for settings.');
  event(
    'tsk_a11y',
    J,
    'manager_reject',
    'PENDING_MANAGER_REVIEW',
    'REWORK',
    ago(1.5),
    'Contrast fixes are missing from the settings modal. Please address and resubmit.',
  );

  task({
    id: 'tsk_arch',
    title: 'Quarterly architecture review',
    description: 'Prepare the architecture review pack covering service boundaries, reliability and cost.',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    createdBy: J,
    assigneeId: E,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(6),
    startDate: dateOffset(-8),
    effortHours: 20,
    createdAt: ago(10),
    tags: ['architecture', 'q4'],
  });
  event('tsk_arch', J, 'created', null, 'ACTIVE', ago(10));
  event('tsk_arch', E, 'start', 'ACTIVE', 'IN_PROGRESS', ago(8));
  db.prepare(
    `INSERT INTO extension_requests (id, task_id, requested_by, current_due_date, requested_due_date, reason, status, created_at)
     VALUES ('ext_arch', 'tsk_arch', ?, ?, ?, ?, 'PENDING_MANAGER', ?)`,
  ).run(
    E,
    dateOffset(6),
    dateOffset(12),
    'Dependent on the vendor security review, which slipped by one week.',
    ago(1),
  );
  event('tsk_arch', E, 'extension_requested', 'IN_PROGRESS', 'IN_PROGRESS', ago(1), 'Dependent on the vendor security review, which slipped by one week.', {
    extensionId: 'ext_arch',
    currentDueDate: dateOffset(6),
    requestedDueDate: dateOffset(12),
  });

  // Group Mode A
  task({
    id: 'tsk_group_a',
    title: 'Customer portal redesign',
    description:
      'Cross-functional redesign of the customer portal. Mode A: every member submits an individual contribution and the group leader submits the consolidated project. Both tracks require manager and senior manager approval.',
    taskKind: 'GROUP',
    groupMode: 'A',
    priority: 'HIGH',
    status: 'ACTIVE',
    createdBy: J,
    assigneeId: E,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(12),
    effortHours: 40,
    createdAt: ago(8),
    tags: ['group', 'portal', 'design'],
  });
  member('tsk_group_a', E, true);
  member('tsk_group_a', M, false);
  member('tsk_group_a', A, false);
  event('tsk_group_a', J, 'created', null, 'ACTIVE', ago(8), '', { taskKind: 'GROUP', groupMode: 'A' });
  event('tsk_group_a', J, 'group_parts_created', 'ACTIVE', 'ACTIVE', ago(8), '', { count: 3 });
  comment('tsk_group_a', E, 'Consolidated draft is in Figma. Waiting on Aisha’s QA notes and Marcus’s component handoff.', ago(1.2));

  task({
    id: 'tsk_group_a_elena',
    title: 'Customer portal redesign — Elena Rossi',
    description: 'Individual contribution for the group task “Customer portal redesign”.',
    taskKind: 'GROUP_PART',
    parentTaskId: 'tsk_group_a',
    priority: 'HIGH',
    status: 'COMPLETED',
    createdBy: J,
    assigneeId: E,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(12),
    completedAt: ago(2),
    createdAt: ago(8),
    tags: [],
  });
  event('tsk_group_a_elena', J, 'created', null, 'ACTIVE', ago(8), '', { generatedFromGroup: 'tsk_group_a' });
  event('tsk_group_a_elena', E, 'submit_completion', 'ACTIVE', 'PENDING_MANAGER_REVIEW', ago(3), 'Interaction spec and responsive layouts complete.');
  event('tsk_group_a_elena', J, 'manager_approve', 'PENDING_MANAGER_REVIEW', 'PENDING_SENIOR_REVIEW', ago(2.6));
  event('tsk_group_a_elena', S, 'senior_approve', 'PENDING_SENIOR_REVIEW', 'COMPLETED', ago(2));
  rating('tsk_group_a_elena', J, 'MANAGER', 4, 'Thorough interaction spec and helpful edge-case coverage.', ago(1.8));
  rating('tsk_group_a_elena', S, 'SENIOR_MANAGER', 4, 'Strong systems thinking; the handoff notes were especially clear.', ago(1.7));

  task({
    id: 'tsk_group_a_marcus',
    title: 'Customer portal redesign — Marcus Lee',
    description: 'Individual contribution for the group task “Customer portal redesign”.',
    taskKind: 'GROUP_PART',
    parentTaskId: 'tsk_group_a',
    priority: 'HIGH',
    status: 'PENDING_SENIOR_REVIEW',
    createdBy: J,
    assigneeId: M,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(12),
    createdAt: ago(8),
    tags: [],
  });
  event('tsk_group_a_marcus', J, 'created', null, 'ACTIVE', ago(8), '', { generatedFromGroup: 'tsk_group_a' });
  event('tsk_group_a_marcus', M, 'submit_completion', 'ACTIVE', 'PENDING_MANAGER_REVIEW', ago(1.4), 'Component library and responsive states complete.');
  event('tsk_group_a_marcus', J, 'manager_approve', 'PENDING_MANAGER_REVIEW', 'PENDING_SENIOR_REVIEW', ago(1));

  task({
    id: 'tsk_group_a_aisha',
    title: 'Customer portal redesign — Aisha Khan',
    description: 'Individual contribution for the group task “Customer portal redesign”.',
    taskKind: 'GROUP_PART',
    parentTaskId: 'tsk_group_a',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    createdBy: J,
    assigneeId: A,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(12),
    startDate: dateOffset(-2),
    createdAt: ago(8),
    tags: [],
  });
  event('tsk_group_a_aisha', J, 'created', null, 'ACTIVE', ago(8), '', { generatedFromGroup: 'tsk_group_a' });
  event('tsk_group_a_aisha', A, 'start', 'ACTIVE', 'IN_PROGRESS', ago(2));

  // Group Mode B
  task({
    id: 'tsk_group_b',
    title: 'Hackathon demo build',
    description:
      'Build the internal hackathon demo. Mode B: only the group leader submits the consolidated work; member contributions are tracked but are not mandatory for completion.',
    taskKind: 'GROUP',
    groupMode: 'B',
    priority: 'MEDIUM',
    status: 'ACTIVE',
    createdBy: J,
    assigneeId: M,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(9),
    effortHours: 24,
    createdAt: ago(5),
    tags: ['group', 'hackathon'],
  });
  member('tsk_group_b', M, true);
  member('tsk_group_b', T, false);
  event('tsk_group_b', J, 'created', null, 'ACTIVE', ago(5), '', { taskKind: 'GROUP', groupMode: 'B' });
  event('tsk_group_b', J, 'group_parts_created', 'ACTIVE', 'ACTIVE', ago(5), '', { count: 2 });

  task({
    id: 'tsk_group_b_marcus',
    title: 'Hackathon demo build — Marcus Lee',
    description: 'Tracked contribution for the group task “Hackathon demo build”. Not mandatory for Mode B completion.',
    taskKind: 'GROUP_PART',
    parentTaskId: 'tsk_group_b',
    priority: 'MEDIUM',
    status: 'ACTIVE',
    createdBy: J,
    assigneeId: M,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(9),
    createdAt: ago(5),
  });
  event('tsk_group_b_marcus', J, 'created', null, 'ACTIVE', ago(5), '', { generatedFromGroup: 'tsk_group_b' });

  task({
    id: 'tsk_group_b_tom',
    title: 'Hackathon demo build — Tom Becker',
    description: 'Tracked contribution for the group task “Hackathon demo build”. Not mandatory for Mode B completion.',
    taskKind: 'GROUP_PART',
    parentTaskId: 'tsk_group_b',
    priority: 'MEDIUM',
    status: 'REWORK',
    createdBy: J,
    assigneeId: T,
    departmentId: 'dep_eng',
    managerId: J,
    seniorManagerId: S,
    dueDate: dateOffset(9),
    createdAt: ago(5),
  });
  event('tsk_group_b_tom', J, 'created', null, 'ACTIVE', ago(5), '', { generatedFromGroup: 'tsk_group_b' });
  event('tsk_group_b_tom', T, 'submit_completion', 'ACTIVE', 'PENDING_MANAGER_REVIEW', ago(2));
  event('tsk_group_b_tom', J, 'manager_reject', 'PENDING_MANAGER_REVIEW', 'REWORK', ago(1.5), 'Demo flow needs a fallback state when the model is offline.');

  // Grace's team
  task({
    id: 'tsk_ci',
    title: 'Security patch verification',
    description: 'Validate the platform security patch across staging and production canaries.',
    priority: 'HIGH',
    status: 'PENDING_MANAGER_REVIEW',
    createdBy: G,
    assigneeId: L,
    departmentId: 'dep_eng',
    managerId: G,
    seniorManagerId: S,
    dueDate: dateOffset(2),
    effortHours: 8,
    createdAt: ago(5),
    tags: ['security', 'platform'],
  });
  event('tsk_ci', G, 'created', null, 'ACTIVE', ago(5));
  event('tsk_ci', L, 'submit_completion', 'ACTIVE', 'PENDING_MANAGER_REVIEW', ago(0.7), 'Canary verification passed with one known logging warning.');

  task({
    id: 'tsk_ci_cost',
    title: 'CI cost reduction',
    description: 'Identify the highest-cost CI workflows and propose a reduction plan.',
    priority: 'LOW',
    status: 'CREATION_REJECTED',
    createdBy: L,
    assigneeId: L,
    departmentId: 'dep_eng',
    managerId: G,
    seniorManagerId: S,
    dueDate: dateOffset(14),
    effortHours: 6,
    createdAt: ago(1.5),
    tags: ['ci', 'cost'],
  });
  event('tsk_ci_cost', L, 'created', null, 'PENDING_CREATION_APPROVAL', ago(1.5), '', { requiresCreationApproval: true });
  event(
    'tsk_ci_cost',
    G,
    'reject_creation',
    'PENDING_CREATION_APPROVAL',
    'CREATION_REJECTED',
    ago(1),
    'Please quantify the expected savings and link the billing dashboard before I can activate this.',
  );

  // ---------------------------------------------------------------- Product
  task({
    id: 'tsk_onboard',
    title: 'Mobile onboarding concept',
    description: 'Create the mobile onboarding concept and validate the first-run experience with five users.',
    priority: 'HIGH',
    status: 'PENDING_MANAGER_REVIEW',
    createdBy: P,
    assigneeId: N,
    departmentId: 'dep_prod',
    managerId: P,
    seniorManagerId: D,
    dueDate: dateOffset(3),
    effortHours: 12,
    createdAt: ago(6),
    tags: ['mobile', 'onboarding'],
  });
  event('tsk_onboard', P, 'created', null, 'ACTIVE', ago(6));
  event('tsk_onboard', N, 'submit_completion', 'ACTIVE', 'PENDING_MANAGER_REVIEW', ago(1), 'Concept and five user interviews attached.');

  task({
    id: 'tsk_funnel',
    title: 'Activation funnel analysis',
    description: 'Refresh the activation funnel analysis with the latest cohort data.',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    createdBy: P,
    assigneeId: O,
    departmentId: 'dep_prod',
    managerId: P,
    seniorManagerId: D,
    dueDate: dateOffset(4),
    effortHours: 10,
    createdAt: ago(8),
    startDate: dateOffset(-6),
    tags: ['analytics'],
  });
  event('tsk_funnel', P, 'created', null, 'ACTIVE', ago(8));
  event('tsk_funnel', O, 'start', 'ACTIVE', 'IN_PROGRESS', ago(6));

  task({
    id: 'tsk_pricing',
    title: 'Pricing page experiment',
    description: 'Design the pricing page experiment and define the primary success metric.',
    priority: 'MEDIUM',
    status: 'PENDING_CREATION_APPROVAL',
    createdBy: N,
    assigneeId: N,
    departmentId: 'dep_prod',
    managerId: P,
    seniorManagerId: D,
    dueDate: dateOffset(11),
    effortHours: 8,
    createdAt: ago(0.5),
    tags: ['experiment', 'pricing'],
  });
  event('tsk_pricing', N, 'created', null, 'PENDING_CREATION_APPROVAL', ago(0.5), '', { requiresCreationApproval: true });

  const completedTasks = [
    {
      id: 'tsk_auth_legacy',
      title: 'Legacy auth cleanup',
      description: 'Remove deprecated authentication endpoints and update integration docs.',
      assignee: T,
      createdBy: J,
      dept: 'dep_eng',
      manager: J,
      senior: S,
      created: 35,
      due: -24,
      completed: 25,
      effort: 12,
      managerScore: 4,
      seniorScore: 3,
      managerRemark: 'Careful cleanup with a clear migration note.',
      seniorRemark: 'Good outcome, but the rollout communication arrived late.',
    },
    {
      id: 'tsk_persona',
      title: 'Persona refresh',
      description: 'Refresh the core buyer personas using the latest research interviews.',
      assignee: N,
      createdBy: P,
      dept: 'dep_prod',
      manager: P,
      senior: D,
      created: 15,
      due: -9,
      completed: 10,
      effort: 6,
      managerScore: 4,
      seniorScore: 5,
      managerRemark: 'Clear synthesis and useful sales enablement notes.',
      seniorRemark: 'Exceptional insight quality; already influencing the roadmap.',
    },
    {
      id: 'tsk_design_qa',
      title: 'Design QA checklist',
      description: 'Create a reusable design QA checklist for the product team.',
      assignee: N,
      createdBy: P,
      dept: 'dep_prod',
      manager: P,
      senior: D,
      created: 20,
      due: -10,
      completed: 12,
      effort: 4,
      ratings: false,
    },
    {
      id: 'tsk_editor',
      title: 'Editor performance notes',
      description: 'Document the editor performance findings and propose the next optimisation step.',
      assignee: E,
      createdBy: E,
      dept: 'dep_eng',
      manager: J,
      senior: S,
      created: 20,
      due: -11,
      completed: 12,
      effort: 5,
      managerScore: 5,
      seniorScore: 4,
      managerRemark: 'Self-directed and unusually well evidenced.',
      seniorRemark: 'Strong analysis; keep the scope tight for the follow-up.',
    },
    {
      id: 'tsk_qa_auto',
      title: 'QA checklist automation',
      description: 'Automate the release checklist and surface failures in the release channel.',
      assignee: A,
      createdBy: A,
      dept: 'dep_eng',
      manager: J,
      senior: S,
      created: 25,
      due: -17,
      completed: 18,
      effort: 7,
      managerScore: 4,
      seniorScore: 4,
      managerRemark: 'Reliable automation that removed a manual release step.',
      seniorRemark: 'Solid, practical improvement. Good documentation.',
    },
  ];

  for (const item of completedTasks) {
    task({
      id: item.id,
      title: item.title,
      description: item.description,
      priority: 'MEDIUM',
      status: 'COMPLETED',
      createdBy: item.createdBy,
      assigneeId: item.assignee,
      departmentId: item.dept,
      managerId: item.manager,
      seniorManagerId: item.senior,
      dueDate: dateOffset(item.due),
      completedAt: ago(item.completed),
      effortHours: item.effort,
      createdAt: ago(item.created),
      tags: [],
    });
    const createdStatus = item.createdBy === item.assignee ? 'PENDING_CREATION_APPROVAL' : 'ACTIVE';
    event(item.id, item.createdBy, 'created', null, createdStatus, ago(item.created), '', {
      requiresCreationApproval: createdStatus === 'PENDING_CREATION_APPROVAL',
    });
    if (createdStatus === 'PENDING_CREATION_APPROVAL') {
      event(item.id, item.manager, 'approve_creation', 'PENDING_CREATION_APPROVAL', 'ACTIVE', ago(item.created - 0.5));
    }
    event(item.id, item.assignee, 'submit_completion', 'ACTIVE', 'PENDING_MANAGER_REVIEW', ago(item.completed + 2));
    event(item.id, item.manager, 'manager_approve', 'PENDING_MANAGER_REVIEW', 'PENDING_SENIOR_REVIEW', ago(item.completed + 1));
    event(item.id, item.senior, 'senior_approve', 'PENDING_SENIOR_REVIEW', 'COMPLETED', ago(item.completed));
    if (item.ratings !== false) {
      rating(item.id, item.manager, 'MANAGER', item.managerScore, item.managerRemark, ago(item.completed - 1));
      rating(item.id, item.senior, 'SENIOR_MANAGER', item.seniorScore, item.seniorRemark, ago(item.completed - 1.2));
    }
  }

  // ---------------------------------------------------------------- Meetings
  function meeting(data) {
    db.prepare(
      `INSERT INTO meetings (id, title, meeting_date, department_id, created_by, participants, transcript,
        summary, decisions, action_items, status, processed_at, ai_source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      data.id,
      data.title,
      data.meetingDate,
      data.departmentId,
      data.createdBy,
      stringifyJson(data.participants),
      data.transcript,
      data.summary || '',
      stringifyJson(data.decisions || []),
      stringifyJson(data.actionItems || []),
      data.status || 'DRAFT',
      data.processedAt || null,
      data.aiSource || null,
      data.createdAt,
      data.createdAt,
    );
  }

  meeting({
    id: 'mtg_sprint_sync',
    title: 'Engineering sprint sync',
    meetingDate: dateOffset(-2),
    departmentId: 'dep_eng',
    createdBy: J,
    participants: [J, E, M, A],
    createdAt: ago(2, 2),
    status: 'PROCESSED',
    processedAt: ago(2, 1),
    aiSource: 'heuristic',
    transcript: `James Rivera: We need to lock the SSO rollout plan before the next sprint starts. The customer portal is the critical path.
Elena Rossi: The migration checklist is nearly complete. I still need sign-off on the rollback section from security.
Marcus Lee: I will publish the latency dashboard by Friday so the team can see the p95 trend before rollout.
Aisha Khan: I will expand the regression suite to cover Safari by end of week. The current suite only covers Chromium and Firefox.
James Rivera: Agreed — we will move the SSO rollout to the next sprint and keep the current auth path stable until the checklist is signed off.
Elena Rossi: That works. I will share the updated checklist with James and Sarah by Tuesday.
Marcus Lee: The latency audit is close. The remaining outlier is in token refresh during cold start.
James Rivera: Good. Also note the on-call runbook is back with me after Sarah's review. I need incident metrics before we resubmit.
Aisha Khan: I can pull the incident timeline from the monitoring export and send it to Elena today.`,
    summary:
      'The team agreed to move the SSO rollout to the next sprint while the rollback checklist is signed off. Regression coverage will expand to Safari, and the latency dashboard will be published before rollout. The on-call runbook remains with James pending incident metrics.',
    decisions: [
      'Move the SSO rollout to the next sprint and keep the current auth path stable until the rollback checklist is signed off.',
      'Expand regression coverage to Safari before the next release candidate.',
    ],
    actionItems: [
      {
        text: 'Publish the latency dashboard with p95 trends by Friday.',
        ownerId: M,
        ownerName: 'Marcus Lee',
        dueDate: dateOffset(3),
        done: false,
        taskId: null,
      },
      {
        text: 'Share the updated SSO migration checklist with James and Sarah by Tuesday.',
        ownerId: E,
        ownerName: 'Elena Rossi',
        dueDate: dateOffset(4),
        done: false,
        taskId: null,
      },
      {
        text: 'Pull the incident timeline and send it to Elena today.',
        ownerId: A,
        ownerName: 'Aisha Khan',
        dueDate: dateOffset(0),
        done: false,
        taskId: null,
      },
    ],
  });

  meeting({
    id: 'mtg_roadmap',
    title: 'Product roadmap working session',
    meetingDate: dateOffset(-1),
    departmentId: 'dep_prod',
    createdBy: P,
    participants: [P, N, O],
    createdAt: ago(1, 3),
    transcript: `Priya Nair: The goal today is to finalise the next product cycle and agree what we are not doing.
Nina Alvarez: I will have the mobile onboarding concept ready for review by Wednesday. The first-run flow is the biggest opportunity in the research.
Omar Haddad: The activation funnel analysis needs two more data pulls. I will finish it by Monday and share the updated cohort view.
Priya Nair: Decided: we will prioritise mobile onboarding in the next cycle and move the pricing page experiment to the following cycle.
Nina Alvarez: Agreed. I will also prepare a short research readout for the sales team by end of week.
Omar Haddad: I will check whether the new cohort definitions change the completion baseline.
Priya Nair: Good. Please keep the pricing experiment scoped so we can pick it up without rework.`,
    status: 'DRAFT',
  });

  meeting({
    id: 'mtg_leadership',
    title: 'Engineering leadership review',
    meetingDate: dateOffset(-5),
    departmentId: 'dep_eng',
    createdBy: S,
    participants: [S, J, G],
    createdAt: ago(5, 4),
    status: 'PROCESSED',
    processedAt: ago(5, 3),
    aiSource: 'heuristic',
    transcript: `Sarah Chen: We are reviewing delivery risk across the department and the security patch timeline.
James Rivera: The latency audit will be closed this week. Marcus has the final numbers and the appendix is in review.
Grace Kim: I will move one platform engineer to the security patch by Monday so we can verify the production canary sooner.
Sarah Chen: Agreed — we will freeze non-critical migrations until the patch is verified.
James Rivera: The customer portal redesign is healthy, but the group contributions are at different stages. I am tracking the consolidated submission separately.
Grace Kim: The CI cost proposal from Leo was returned for more detail. I will ask for a quantified savings estimate before reactivating it.
Sarah Chen: Good. Let's keep the approval trail clean and avoid bypassing the two-level review for any of these.`,
    summary:
      'Leadership reviewed delivery risk across engineering. The latency audit is closing this week, the security patch will receive an extra platform engineer, and non-critical migrations are frozen until verification. Group work and returned proposals remain in their required approval paths.',
    decisions: [
      'Freeze non-critical migrations until the security patch is verified.',
      'Add one platform engineer to the security patch verification effort.',
    ],
    actionItems: [
      {
        text: 'Verify the production security canary after the patch is deployed.',
        ownerId: G,
        ownerName: 'Grace Kim',
        dueDate: dateOffset(5),
        done: false,
        taskId: null,
      },
      {
        text: 'Close the latency audit and attach the final appendix.',
        ownerId: J,
        ownerName: 'James Rivera',
        dueDate: dateOffset(2),
        done: false,
        taskId: null,
      },
    ],
  });

  // ---------------------------------------------------------------- Notifications
  function notification(userId, type, title, body, taskId = null, daysAgo = 0.2, isRead = 0) {
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, task_id, meeting_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ).run(newId('ntf_'), userId, type, title, body, taskId, isRead, ago(daysAgo));
  }

  notification(J, 'APPROVAL_REQUEST', 'Completion submitted for your review', 'Aisha Khan submitted “Release 4.8 regression suite” for first-level approval.', 'tsk_regression', 0.5);
  notification(J, 'APPROVAL_REQUEST', 'New self-created task needs your approval', 'Elena Rossi submitted “Design token migration” for activation approval.', 'tsk_tokens', 0.3);
  notification(J, 'RETURNED_TO_MANAGER', 'Senior manager returned a submission', '“On-call runbook refresh” was returned to you. Decide whether to request corrections or resubmit.', 'tsk_runbook', 0.8);
  notification(J, 'EXTENSION_REQUEST', 'Timeline extension requested', 'Elena Rossi requested a new due date for “Quarterly architecture review”.', 'tsk_arch', 1);
  notification(S, 'APPROVAL_REQUEST', 'Final approval required', '“Checkout API latency audit” passed manager review and needs your final approval.', 'tsk_latency', 0.8);
  notification(S, 'APPROVAL_REQUEST', 'Final approval required', '“Customer portal redesign — Marcus Lee” is awaiting your final approval.', 'tsk_group_a_marcus', 1);
  notification(G, 'APPROVAL_REQUEST', 'Completion submitted for your review', 'Leo Martins submitted “Security patch verification”.', 'tsk_ci', 0.7);
  notification(P, 'APPROVAL_REQUEST', 'Completion submitted for your review', 'Nina Alvarez submitted “Mobile onboarding concept”.', 'tsk_onboard', 1);
  notification(P, 'APPROVAL_REQUEST', 'New self-created task needs your approval', 'Nina Alvarez submitted “Pricing page experiment” for activation approval.', 'tsk_pricing', 0.5);
  notification(A, 'REWORK_REQUESTED', 'Changes requested on your submission', 'James Rivera returned “Accessibility remediation” for rework.', 'tsk_a11y', 1.5);
  notification(L, 'TASK_REJECTED', 'Task activation rejected', 'Grace Kim returned “CI cost reduction”: please quantify the expected savings.', 'tsk_ci_cost', 1);
  notification(E, 'GROUP_UPDATE', 'Group progress update', 'Elena, your contribution to “Customer portal redesign” is complete. One of three contributions still needs final approval.', 'tsk_group_a', 1.6);
  notification(E, 'RATING_RECEIVED', 'New manager rating', 'James Rivera rated “Editor performance notes” 5/5.', 'tsk_editor', 11);
  notification(M, 'TASK_ASSIGNED', 'A new task was assigned to you', 'James Rivera assigned “Single sign-on rollout”.', 'tsk_sso', 4, 1);
  notification(M, 'APPROVAL_REQUEST', 'Submission passed manager review', 'Your contribution to “Customer portal redesign” is awaiting senior manager approval.', 'tsk_group_a_marcus', 1);
  notification(T, 'STATUS_UPDATE', 'Overdue task reminder', '“Database index cleanup” is past its due date. Please update the plan or request an extension.', 'tsk_index', 0.1);
  notification('usr_maya', 'SYSTEM', 'Welcome to Meridian', 'The demo workspace is ready. Demo password for every account: demo1234.', null, 10, 1);

  // Guardrail setting mirror (visible to admins in addition to the hard-coded guardrails).
  db.prepare(
    `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('ai', ?, ?, ?)`,
  ).run(
    stringifyJson({
      enabled: false,
      provider: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: '',
      temperature: 0.2,
    }),
    'usr_maya',
    ago(10),
  );

  return { seeded: true, users: users.length, tasks: 26 };
}
