import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db.js';
import { seedDemo } from '../src/seed.js';
import { createApp } from '../src/app.js';
import { addDays, today } from '../src/util.js';

const db = openDatabase(':memory:');
seedDemo(db);
const app = createApp(db);
const server = app.listen(0);
const base = await new Promise((resolve) => {
  server.on('listening', () => resolve(`http://127.0.0.1:${server.address().port}`));
});

const tokens = {};

async function login(email) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  return body.token;
}

async function req(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

function due(days = 10) {
  return addDays(today(), days);
}

async function action(taskId, token, name, comment) {
  return req(`/api/tasks/${taskId}/actions`, {
    token,
    method: 'POST',
    body: { action: name, comment },
  });
}

const state = {};

test('Meridian acceptance workflow', async (t) => {
  await t.test('demo accounts authenticate', async () => {
    const emails = {
      elena: 'elena.rossi@meridian.io',
      marcus: 'marcus.lee@meridian.io',
      aisha: 'aisha.khan@meridian.io',
      tom: 'tom.becker@meridian.io',
      james: 'james.rivera@meridian.io',
      grace: 'grace.kim@meridian.io',
      sarah: 'sarah.chen@meridian.io',
      david: 'david.okafor@meridian.io',
      priya: 'priya.nair@meridian.io',
      maya: 'maya.patel@meridian.io',
    };
    for (const [key, email] of Object.entries(emails)) {
      tokens[key] = await login(email);
      assert.ok(tokens[key]);
    }
  });

  await t.test('employee self-created task requires manager activation and blocks self-approval', async () => {
    const me = await req('/api/auth/me', { token: tokens.elena });
    state.elenaId = me.body.user.id;
    const created = await req('/api/tasks', {
      token: tokens.elena,
      method: 'POST',
      body: { title: 'Acceptance: employee self task', assigneeId: state.elenaId, dueDate: due(9) },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    state.selfTaskId = created.body.task.id;
    const task = (await req(`/api/tasks/${state.selfTaskId}`, { token: tokens.elena })).body.task;
    assert.equal(task.status, 'PENDING_CREATION_APPROVAL');
    assert.equal(task.managerName, 'James Rivera');
    assert.equal(task.seniorManagerName, 'Sarah Chen');

    const selfApprove = await action(state.selfTaskId, tokens.elena, 'approve_creation');
    assert.equal(selfApprove.status, 403);

    const wrongManager = await action(state.selfTaskId, tokens.grace, 'approve_creation');
    assert.equal(wrongManager.status, 403);

    const approved = await action(state.selfTaskId, tokens.james, 'approve_creation');
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.task.status, 'ACTIVE');

    const outsider = await req(`/api/tasks/${state.selfTaskId}`, { token: tokens.grace });
    assert.equal(outsider.status, 403);
  });

  await t.test('completion requires manager then senior; senior rejection returns to manager', async () => {
    const submit = await action(state.selfTaskId, tokens.elena, 'submit_completion', 'Done.');
    assert.equal(submit.status, 200);
    assert.equal(submit.body.task.status, 'PENDING_MANAGER_REVIEW');

    const seniorSkip = await action(state.selfTaskId, tokens.sarah, 'senior_approve');
    assert.equal(seniorSkip.status, 409);

    const managerApprove = await action(state.selfTaskId, tokens.james, 'manager_approve', 'Looks good.');
    assert.equal(managerApprove.status, 200);
    assert.equal(managerApprove.body.task.status, 'PENDING_SENIOR_REVIEW');

    const seniorReject = await action(
      state.selfTaskId,
      tokens.sarah,
      'senior_reject',
      'Please attach the final metrics.',
    );
    assert.equal(seniorReject.status, 200);
    assert.equal(seniorReject.body.task.status, 'RETURNED_TO_MANAGER');

    const employeeCannotAct = await action(state.selfTaskId, tokens.elena, 'submit_completion');
    assert.equal(employeeCannotAct.status, 409);

    const corrections = await action(
      state.selfTaskId,
      tokens.james,
      'request_corrections',
      'Add the metrics Sarah asked for.',
    );
    assert.equal(corrections.status, 200);
    assert.equal(corrections.body.task.status, 'REWORK');

    await action(state.selfTaskId, tokens.elena, 'submit_completion', 'Metrics attached.');
    await action(state.selfTaskId, tokens.james, 'manager_approve', 'Metrics verified.');
    const final = await action(state.selfTaskId, tokens.sarah, 'senior_approve', 'Approved.');
    assert.equal(final.status, 200);
    assert.equal(final.body.task.status, 'COMPLETED');
    assert.ok(final.body.task.completedAt);

    const history = final.body.task.events.map((e) => e.action);
    assert.ok(history.includes('senior_reject'));
    assert.ok(history.includes('request_corrections'));
    assert.ok(history.includes('senior_approve'));

    const beforeRatings = final.body.task.ratings;
    assert.equal(beforeRatings.length, 0);
    const managerRating = await req(`/api/tasks/${state.selfTaskId}/ratings`, {
      token: tokens.james,
      method: 'POST',
      body: { score: 4, remarks: 'Strong execution with a clear write-up.' },
    });
    assert.equal(managerRating.status, 200, JSON.stringify(managerRating.body));
    const seniorRating = await req(`/api/tasks/${state.selfTaskId}/ratings`, {
      token: tokens.sarah,
      method: 'POST',
      body: { score: 5, remarks: 'Final quality exceeded the bar.' },
    });
    assert.equal(seniorRating.status, 200);
    const rated = (await req(`/api/tasks/${state.selfTaskId}`, { token: tokens.james })).body.task;
    assert.equal(rated.ratings.length, 2);
    assert.deepEqual(
      rated.ratings.map((r) => r.raterRole).sort(),
      ['MANAGER', 'SENIOR_MANAGER'],
    );
  });

  await t.test('timeline extension only changes the due date after both approvals', async () => {
    const created = await req('/api/tasks', {
      token: tokens.elena,
      method: 'POST',
      body: { title: 'Acceptance: extension flow', assigneeId: state.elenaId, dueDate: due(8) },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.task.id;
    const originalDue = created.body.task.dueDate;
    await action(id, tokens.james, 'approve_creation');

    const requestedDue = addDays(originalDue, 12);
    const ext = await req(`/api/tasks/${id}/extensions`, {
      token: tokens.elena,
      method: 'POST',
      body: { requestedDueDate: requestedDue, reason: 'Vendor dependency slipped by one week.' },
    });
    assert.equal(ext.status, 201, JSON.stringify(ext.body));
    const extId = ext.body.extension.id;

    const managerDecision = await req(`/api/extensions/${extId}/decision`, {
      token: tokens.james,
      method: 'POST',
      body: { decision: 'approve', comment: 'Dependency confirmed.' },
    });
    assert.equal(managerDecision.status, 200);
    assert.equal(managerDecision.body.extension.status, 'PENDING_SENIOR');

    const stillOriginal = (await req(`/api/tasks/${id}`, { token: tokens.elena })).body.task;
    assert.equal(stillOriginal.dueDate, originalDue);

    const employeeCannotDecide = await req(`/api/extensions/${extId}/decision`, {
      token: tokens.elena,
      method: 'POST',
      body: { decision: 'approve' },
    });
    assert.equal(employeeCannotDecide.status, 403);

    const finalDecision = await req(`/api/extensions/${extId}/decision`, {
      token: tokens.sarah,
      method: 'POST',
      body: { decision: 'approve', comment: 'Final approval granted.' },
    });
    assert.equal(finalDecision.status, 200);
    assert.equal(finalDecision.body.extension.status, 'APPROVED');

    const updated = (await req(`/api/tasks/${id}`, { token: tokens.elena })).body.task;
    assert.equal(updated.dueDate, requestedDue);
    assert.equal(updated.originalDueDate, originalDue);

    const directEdit = await req(`/api/tasks/${id}`, {
      token: tokens.elena,
      method: 'PATCH',
      body: { dueDate: due(30) },
    });
    assert.ok([400, 403].includes(directEdit.status));
  });

  await t.test('group mode A isolates parts and requires both tracks to complete', async () => {
    const directory = await req('/api/users/directory', { token: tokens.james });
    const byName = Object.fromEntries(directory.body.users.map((u) => [u.fullName, u.id]));
    const marcusId = byName['Marcus Lee'];
    const aishaId = byName['Aisha Khan'];
    assert.ok(marcusId && aishaId);

    const updated = await req('/api/tasks', {
      token: tokens.james,
      method: 'POST',
      body: {
        title: 'Acceptance: group mode A (full)',
        assigneeId: state.elenaId,
        leaderId: state.elenaId,
        members: [state.elenaId, marcusId, aishaId],
        taskKind: 'GROUP',
        groupMode: 'A',
        dueDate: due(15),
      },
    });
    assert.equal(updated.status, 201, JSON.stringify(updated.body));
    const fullGroupId = updated.body.task.id;
    let group = (await req(`/api/tasks/${fullGroupId}`, { token: tokens.elena })).body.task;
    assert.equal(group.parts.length, 3);
    assert.equal(group.groupReadiness.ready, false);

    const premature = await action(fullGroupId, tokens.elena, 'submit_completion');
    assert.equal(premature.status, 409);

    const memberTokens = { elena: tokens.elena, marcus: tokens.marcus, aisha: tokens.aisha };
    for (const part of group.parts) {
      const memberKey = Object.entries({ elena: state.elenaId, marcus: marcusId, aisha: aishaId }).find(
        ([, id]) => id === part.assigneeId,
      )[0];
      const submitted = await action(part.id, memberTokens[memberKey], 'submit_completion', 'Part done.');
      assert.equal(submitted.status, 200, `${memberKey}: ${JSON.stringify(submitted.body)}`);
      const manager = await action(part.id, tokens.james, 'manager_approve', 'Part reviewed.');
      assert.equal(manager.status, 200);
      const senior = await action(part.id, tokens.sarah, 'senior_approve', 'Part approved.');
      assert.equal(senior.status, 200);
    }

    group = (await req(`/api/tasks/${fullGroupId}`, { token: tokens.elena })).body.task;
    assert.equal(group.groupReadiness.ready, true);
    assert.equal(group.parts.every((p) => p.status === 'COMPLETED'), true);

    const submitGroup = await action(fullGroupId, tokens.elena, 'submit_completion', 'Consolidated project ready.');
    assert.equal(submitGroup.status, 200);
    await action(fullGroupId, tokens.james, 'manager_approve', 'Group delivery reviewed.');
    const final = await action(fullGroupId, tokens.sarah, 'senior_approve', 'Group delivery approved.');
    assert.equal(final.body.task.status, 'COMPLETED');

    const partDetail = (
      await req(`/api/tasks/${group.parts[0].id}`, { token: tokens.james })
    ).body.task;
    const partActions = partDetail.events.map((e) => e.action);
    assert.ok(partActions.includes('submit_completion'));
    assert.ok(!partActions.includes('group_parts_created'));
    const groupActions = final.body.task.events.map((e) => e.action);
    assert.ok(groupActions.includes('group_parts_created'));
    assert.ok(groupActions.includes('senior_approve'));
    state.groupPartId = group.parts[0].id;
  });

  await t.test('group mode B allows leader-only final submission while parts remain tracked', async () => {
    const directory = await req('/api/users/directory', { token: tokens.james });
    const byName = Object.fromEntries(directory.body.users.map((u) => [u.fullName, u.id]));
    const marcusId = byName['Marcus Lee'];
    const tomId = byName['Tom Becker'];
    const created = await req('/api/tasks', {
      token: tokens.james,
      method: 'POST',
      body: {
        title: 'Acceptance: group mode B',
        assigneeId: marcusId,
        leaderId: marcusId,
        members: [marcusId, tomId],
        taskKind: 'GROUP',
        groupMode: 'B',
        dueDate: due(9),
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.task.id;
    const group = (await req(`/api/tasks/${id}`, { token: tokens.marcus })).body.task;
    assert.equal(group.parts.length, 2);
    assert.equal(group.groupReadiness.ready, true);

    const submit = await action(id, tokens.marcus, 'submit_completion', 'Leader consolidated submission.');
    assert.equal(submit.status, 200, JSON.stringify(submit.body));
    await action(id, tokens.james, 'manager_approve');
    const final = await action(id, tokens.sarah, 'senior_approve');
    assert.equal(final.body.task.status, 'COMPLETED');
    const parts = final.body.task.parts;
    assert.ok(parts.some((p) => p.status !== 'COMPLETED'));
  });

  await t.test('reports split assigned and self-created work and respect team scope', async () => {
    const report = await req(`/api/reports?userId=${state.elenaId}`, { token: tokens.elena });
    assert.equal(report.status, 200);
    assert.ok(report.body.assigned.total > 0);
    assert.ok(report.body.selfCreated.total > 0);
    assert.equal(
      report.body.assigned.total + report.body.selfCreated.total,
      report.body.combined.total,
    );
    assert.ok(report.body.team.length === 1);
    assert.equal(report.body.team[0].user.id, state.elenaId);

    const managerReport = await req(`/api/reports?userId=${state.elenaId}`, { token: tokens.james });
    assert.equal(managerReport.status, 200);

    const crossTeam = await req(`/api/reports?userId=${state.elenaId}`, { token: tokens.grace });
    assert.equal(crossTeam.status, 403);

    const employeeOther = await req(`/api/reports?userId=${state.elenaId}`, { token: tokens.marcus });
    assert.equal(employeeOther.status, 403);

    const team = await req('/api/reports/team', { token: tokens.james });
    assert.equal(team.status, 200);
    assert.ok(team.body.members.every((m) => m.role === 'EMPLOYEE'));
  });

  await t.test('meeting transcripts are role- and team-restricted', async () => {
    const created = await req('/api/meetings', {
      token: tokens.james,
      method: 'POST',
      body: {
        title: 'Acceptance: secure transcript',
        meetingDate: today(),
        participantIds: [state.elenaId],
        transcript:
          'James Rivera: We reviewed the rollout. Elena Rossi will draft the checklist by Friday. Agreed — we will keep the current auth path stable. Marcus Lee will publish the dashboard by Monday.',
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.meeting.id;

    const employeeView = await req(`/api/meetings/${id}`, { token: tokens.elena });
    assert.equal(employeeView.status, 200);
    assert.equal(employeeView.body.meeting.transcript, null);
    assert.equal(employeeView.body.meeting.transcriptRestricted, true);

    const managerView = await req(`/api/meetings/${id}`, { token: tokens.james });
    assert.equal(managerView.status, 200);
    assert.ok(managerView.body.meeting.transcript.length > 20);

    const otherManager = await req(`/api/meetings/${id}`, { token: tokens.grace });
    assert.equal(otherManager.status, 403);

    const seniorView = await req(`/api/meetings/${id}`, { token: tokens.sarah });
    assert.equal(seniorView.status, 200);
    assert.ok(seniorView.body.meeting.transcript.length > 20);

    const employeeProcess = await req(`/api/meetings/${id}/process`, {
      token: tokens.elena,
      method: 'POST',
    });
    assert.equal(employeeProcess.status, 403);

    const processed = await req(`/api/meetings/${id}/process`, {
      token: tokens.james,
      method: 'POST',
    });
    assert.equal(processed.status, 200, JSON.stringify(processed.body));
    assert.equal(processed.body.meeting.status, 'PROCESSED');
    assert.ok(processed.body.meeting.summary.length > 10);
    assert.ok(processed.body.meeting.actionItems.length > 0);

    const action = await req(`/api/meetings/${id}/action-items/0/create-task`, {
      token: tokens.james,
      method: 'POST',
      body: { assigneeId: state.elenaId, dueDate: due(5) },
    });
    assert.equal(action.status, 201, JSON.stringify(action.body));
    assert.ok(action.body.task.title.length > 0);
  });

  await t.test('administrators manage the platform but cannot join the approval chain', async () => {
    const overview = await req('/api/admin/overview', { token: tokens.maya });
    assert.equal(overview.status, 200);
    assert.equal(overview.body.guardrails.selfApprovalBlocked, true);
    assert.equal(overview.body.guardrails.twoTierCompletion, true);
    assert.equal(overview.body.guardrails.locked, true);

    const users = await req('/api/admin/users', { token: tokens.maya });
    assert.equal(users.status, 200);
    assert.ok(users.body.users.length >= 13);
    assert.ok(users.body.users.every((u) => !('password_hash' in u) && !('passwordHash' in u)));

    const createAsAdmin = await req('/api/tasks', {
      token: tokens.maya,
      method: 'POST',
      body: { title: 'Admin should not create', assigneeId: state.elenaId, dueDate: due(4) },
    });
    assert.equal(createAsAdmin.status, 403);

    const approveAsAdmin = await action('tsk_latency', tokens.maya, 'senior_approve');
    assert.equal(approveAsAdmin.status, 403);

    const ai = await req('/api/admin/settings/ai', { token: tokens.maya });
    assert.equal(ai.status, 200);
    assert.equal(ai.body.ai.hasKey, false);

    const badAi = await req('/api/admin/settings/ai', {
      token: tokens.maya,
      method: 'PUT',
      body: { enabled: true },
    });
    assert.equal(badAi.status, 400);

    const nonAdmin = await req('/api/admin/overview', { token: tokens.james });
    assert.equal(nonAdmin.status, 403);
  });

  await t.test('managers cannot read tasks outside their reporting team', async () => {
    const graceTasks = await req('/api/tasks', { token: tokens.grace });
    assert.equal(graceTasks.status, 200);
    assert.ok(graceTasks.body.tasks.every((task) => task.title !== 'Acceptance: employee self task'));
    assert.ok(graceTasks.body.tasks.every((task) => task.title !== 'Customer portal redesign'));

    const direct = await req(`/api/tasks/${state.selfTaskId}`, { token: tokens.grace });
    assert.equal(direct.status, 403);
  });

  await t.test('AI insights stay inside the authorized scope', async () => {
    const employee = await req('/api/ai/insights', { token: tokens.elena });
    assert.equal(employee.status, 200);
    assert.equal(employee.body.insights.workload.length, 1);
    assert.equal(employee.body.insights.workload[0].userId, state.elenaId);

    const manager = await req('/api/ai/insights', { token: tokens.grace });
    assert.equal(manager.status, 200);
    assert.ok(manager.body.insights.workload.length >= 2);
    assert.ok(manager.body.insights.workload.every((w) => w.name !== 'Elena Rossi'));
  });
});

after(() => {
  server.close();
  db.close();
});
