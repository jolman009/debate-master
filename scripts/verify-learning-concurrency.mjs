// Staging-only HTTP concurrency smoke test. Does not load .env.local.
// All data is synthetic and removed in finally. No inference or billing calls.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const usage = 'STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY are required.\nUsage: node scripts/verify-learning-concurrency.mjs <staging-project-ref> [report.json]';
if (process.argv.includes('--help')) {
  console.log(usage);
  process.exit(0);
}
const project = process.argv[2];
const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (!project || !url || !key) throw new Error(usage);
const target = new URL(url);
if (target.origin !== `https://${project}.supabase.co` || target.pathname !== '/' || target.search || target.hash || target.username || target.password) {
  throw new Error('Staging URL must match the explicitly supplied project reference.');
}
if (project === 'brbojvglxluvaigoxdji') throw new Error('Refusing the known production project. Use staging.');
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const report = {
  checkedAt: new Date().toISOString(), target: target.hostname,
  scope: 'Parallel HTTP RPC requests against synthetic staging fixtures; no learner data, inference or entitlement test',
  rounds: 3, parallelRequests: 8, checks: [], cleanup: [], passed: false,
};
let userId;
const debateId = randomUUID();
const turnId = randomUUID();
function check(name, condition) {
  report.checks.push({ name, passed: Boolean(condition) });
  if (!condition) throw new Error(name);
}
function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || 'request failed'}`);
  return result.data;
}
function row(data) { return Array.isArray(data) ? data[0] : data; }
async function burst(rpc, args) {
  // Wait for EVERY request before checking or cleaning up, including failures.
  const outcomes = await Promise.allSettled(Array.from({ length: report.parallelRequests }, () => admin.rpc(rpc, args)));
  check(`${rpc}: all parallel requests settled successfully`, outcomes.every(r => r.status === 'fulfilled' && !r.value.error));
  const records = outcomes.map(r => row(r.value.data));
  check(`${rpc}: all retries return the same ID`, records.every(r => r?.id && r.id === records[0].id));
  return records[0];
}
async function count(table, filters) {
  let query = admin.from(table).select('id', { count: 'exact', head: true });
  for (const [field, value] of Object.entries(filters)) query = query.eq(field, value);
  const result = await query;
  must(result, `Count ${table}`);
  return result.count;
}

try {
  must(await admin.from('learning_sessions').select('id').limit(0), 'Migration 017 schema');
  const identity = must(await admin.auth.admin.createUser({
    email: `learning-concurrency-${randomUUID()}@example.invalid`,
    password: randomUUID() + randomUUID(), email_confirm: true,
  }), 'Create fixture identity');
  userId = identity.user.id;
  // Deliberately synthetic evaluation: tests linkage, not educational validity.
  must(await admin.from('debates').insert({
    id: debateId, user_id: userId,
    config: { mode: 'ai', topic: 'Synthetic concurrency fixture', motion: 'Synthetic concurrency fixture', userSide: 'pro', personaId: 'the-academic', difficulty: 'beginner', rebuttalCycles: 1, crossExamEnabled: false },
    current_stage: 'complete', assessment_status: 'valid',
    feedback: { version: 2, summary: 'Synthetic linkage fixture; not an AI evaluation' },
  }), 'Create fixture debate');
  must(await admin.from('debate_turns').insert({ id: turnId, debate_id: debateId, stage: 'opening_user', role: 'user', content: 'Synthetic concurrency fixture' }), 'Create fixture turn');

  for (let round = 1; round <= report.rounds; round++) {
    const cycle = await burst('create_learning_cycle', {
      p_user_id: userId, p_origin_debate_id: debateId, p_cited_turn_id: turnId,
      p_target_competency: 'argumentStrength', p_request_id: randomUUID(),
    });
    check(`Round ${round}: exactly one cycle for request`, await count('learning_cycles', { user_id: userId, request_id: cycle.request_id }) === 1);
    const root = must(await admin.from('learning_sessions').select('*').eq('loop_id', cycle.id).eq('session_type', 'debate').single(), 'Read one source session');
    const drillArgs = {
      p_user_id: userId, p_loop_id: cycle.id, p_parent_session_id: root.id,
      p_session_type: 'drill', p_exercise_template_version: 'synthetic-warrant-1', p_request_id: randomUUID(),
    };
    const drill = await burst('create_learning_attempt', drillArgs);
    const reassessment = await burst('create_learning_attempt', {
      ...drillArgs, p_parent_session_id: drill.id, p_session_type: 'reassessment',
      p_exercise_template_version: 'synthetic-retest-1', p_request_id: randomUUID(),
    });
    check(`Round ${round}: correct parent links`, drill.parent_session_id === root.id && reassessment.parent_session_id === drill.id);
    check(`Round ${round}: exactly one session of each type`,
      (await Promise.all(['debate', 'drill', 'reassessment'].map(session_type => count('learning_sessions', { loop_id: cycle.id, session_type })))).every(n => n === 1));

    // Race conflicting payloads using one NEW request ID. Whichever acquires
    // the lock first wins; the other version must get SQLSTATE 22023.
    const conflictId = randomUUID();
    const versions = Array.from({ length: report.parallelRequests }, (_, i) => i % 2 ? 'synthetic-a' : 'synthetic-b');
    const conflicts = await Promise.allSettled(versions.map(version => admin.rpc('create_learning_attempt', {
      ...drillArgs, p_request_id: conflictId, p_exercise_template_version: version,
    })));
    check(`Round ${round}: conflicting requests all returned`, conflicts.every(r => r.status === 'fulfilled'));
    const results = conflicts.map(r => r.value);
    const winners = results.filter(r => !r.error).map(r => row(r.data));
    const winningVersion = winners[0]?.exercise_template_version;
    check(`Round ${round}: one payload wins; conflicting payload is rejected`,
      winners.length === report.parallelRequests / 2 && winners.every(r => r?.id && r.id === winners[0].id) &&
      results.every((r, i) => versions[i] === winningVersion ? !r.error : r.error?.code === '22023'));
    check(`Round ${round}: conflict race persisted one record`, await count('learning_sessions', { user_id: userId, request_id: conflictId }) === 1);
  }
  report.passed = true;
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  // Every operation is scoped to IDs created in this run. Attempt all cleanup
  // steps even if one fails, and never report a pass with leftover fixtures.
  async function cleanup(name, action) {
    try { await action(); report.cleanup.push({ name, passed: true }); }
    catch { report.cleanup.push({ name, passed: false }); }
  }
  if (userId) {
    await cleanup('Delete fixture debate', async () => must(await admin.from('debates').delete().eq('id', debateId).eq('user_id', userId), 'Delete fixture debate'));
    await cleanup('Verify dependent records removed', async () => {
      for (const table of ['debate_turns', 'lifecycle_events', 'learning_cycles', 'learning_sessions']) {
        const filters = table === 'debate_turns' ? { debate_id: debateId } : { user_id: userId };
        if (await count(table, filters) !== 0) throw new Error('Fixture rows remain');
      }
    });
    await cleanup('Delete fixture identity', async () => must(await admin.auth.admin.deleteUser(userId), 'Delete fixture identity'));
  }
  if (report.cleanup.some(c => !c.passed)) {
    report.passed = false;
    process.exitCode = 1;
    report.cleanupRequired = { userId, debateId };
  }
  const output = JSON.stringify(report, null, 2) + '\n';
  if (process.argv[3]) writeFileSync(process.argv[3], output);
  console.log(output);
}
