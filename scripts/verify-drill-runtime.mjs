// Staging-only concurrency verification for migration 018. No AI/provider calls.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const project = process.argv[2];
const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (process.argv.includes('--help')) {
  console.log('Set STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY.\nnode scripts/verify-drill-runtime.mjs <staging-project-ref> [report.json]');
  process.exit(0);
}
if (!project || !url || !key) throw new Error('Explicit staging URL, service-role key and project reference required; .env.local is not loaded.');
if (project === 'brbojvglxluvaigoxdji' || url !== `https://${project}.supabase.co`) throw new Error('Refusing production or a mismatched staging URL.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const report = { checkedAt: new Date().toISOString(), target: new URL(url).hostname, scope: 'Synthetic runtime/allowance concurrency; no inference or payment verification', checks: [], cleanup: [], passed: false };
let user;
const debates = [randomUUID(), randomUUID()];
const turns = [randomUUID(), randomUUID()];
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || 'failed'}`); return result.data; };
const check = (name, condition) => { report.checks.push({ name, passed: !!condition }); if (!condition) throw new Error(name); };
async function parallel(name, parameters) {
  const all = await Promise.allSettled(parameters.map(p => db.rpc(name, p)));
  check(`${name}: every HTTP request returned`, all.every(r => r.status === 'fulfilled'));
  return all.map(r => r.value);
}
const repeat = p => Array.from({ length: 8 }, () => p);
async function rows(table) { return must(await db.from(table).select('*').eq('user_id', user), `Read ${table}`); }
try {
  must(await db.from('learning_runtime').select('session_id').limit(0), 'Migration 018');
  user = must(await db.auth.admin.createUser({ email: `drill-runtime-${randomUUID()}@example.invalid`, password: randomUUID() + randomUUID(), email_confirm: true }), 'Create fixture identity').user.id;
  for (let i = 0; i < 2; i++) {
    must(await db.from('debates').insert({ id: debates[i], user_id: user, config: { mode: 'ai', difficulty: 'beginner' }, current_stage: 'complete', feedback: { summary: 'Synthetic runtime fixture, not measured coaching' }, assessment_status: 'valid' }), 'Create fixture debate');
    must(await db.from('debate_turns').insert({ id: turns[i], debate_id: debates[i], stage: 'opening_user', role: 'user', content: 'Synthetic runtime fixture' }), 'Create fixture turn');
  }
  const exercise = { kind: 'drill', templateVersion: 'counterargument-response-v1', competency: 'rebuttalQuality', context: 'Synthetic database fixture' };
  const open = debates.map((id, i) => ({ p_user_id: user, p_origin_debate_id: id, p_cited_turn_id: turns[i], p_request_id: randomUUID(), p_exercise: exercise, p_reassessment: { ...exercise, kind: 'reassessment' } }));
  const opening = await parallel('learning_open', Array.from({ length: 8 }, (_, i) => open[i % 2]));
  const wins = opening.filter(r => !r.error);
  check('One source wins the lifetime free reservation; other source denied', wins.length === 4 && opening.filter(r => r.error).every(r => r.error.code === 'P0001'));
  const loop = wins[0].data;
  check('All successful opens return the same cycle', wins.every(r => r.data === loop));
  check('Exactly one cycle and one allowance', (await rows('learning_cycles')).length === 1 && (await rows('learning_allowances')).length === 1);
  const runtime = await rows('learning_runtime');
  check('Exactly one drill runtime', runtime.length === 1);
  const drill = runtime[0].session_id;
  const viewed = await parallel('learning_view', repeat({ p_user_id: user, p_session_id: drill }));
  viewed.forEach(r => must(r, 'View drill'));
  async function answer(session, kind, revision) {
    const content = `Synthetic ${kind} answer`;
    const submitted = await parallel('learning_submit', repeat({ p_user_id: user, p_session_id: session, p_request_id: randomUUID(), p_kind: kind, p_content: content, p_revision: revision }));
    const data = submitted.map(r => must(r, 'Submit response'));
    check(`${kind}: one evaluation claim across eight retries`, data.filter(r => r.claimed).length === 1);
    check(`${kind}: one response ID`, data.every(r => r.response.id === data[0].response.id));
    const response = data.find(r => r.claimed).response;
    const finished = await parallel('learning_finish', repeat({
      p_user_id: user, p_response_id: response.id, p_token: response.lease_token,
      p_outcome: 'valid', p_assessment: { status: 'valid', score: 6, rationale: 'Synthetic fixture, not AI feedback' }, p_usage: { synthetic: true },
    }));
    check(`${kind}: exactly one completion commit`, finished.map(r => must(r, 'Finish response')).filter(Boolean).length === 1);
  }
  await answer(drill, 'initial', 0);
  await answer(drill, 'revision', 1);
  const retests = await parallel('learning_reassess', repeat({ p_user_id: user, p_loop_id: loop, p_request_id: randomUUID() }));
  const retest = must(retests[0], 'Reassessment');
  check('Reassessment retries return one session', retests.every(r => !r.error && r.data === retest));
  await answer(retest, 'reassessment', 0);
  const events = await rows('learning_events');
  check('One drill start and one completed cycle', events.filter(e => e.event_name === 'drill_started').length === 1 && events.filter(e => e.event_name === 'cycle_completed').length === 1);
  check('Exactly three submitted responses', (await rows('learning_responses')).length === 3 && events.filter(e => e.event_name === 'response_submitted').length === 3);
  check('No extra allowance consumed by revision or reassessment', (await rows('learning_allowances')).length === 1);
  report.passed = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  const cleanup = async (name, task) => { try { await task(); report.cleanup.push({ name, passed: true }); } catch { report.cleanup.push({ name, passed: false }); } };
  if (user) {
    await cleanup('Remove fixture debates', async () => must(await db.from('debates').delete().eq('user_id', user).in('id', debates), 'Delete debates'));
    await cleanup('Verify dependent runtime cleanup', async () => {
      for (const table of ['learning_cycles','learning_sessions','learning_runtime','learning_responses','learning_evaluations','learning_events','lifecycle_events']) if ((await rows(table)).length) throw new Error('Fixture remains');
    });
    await cleanup('Remove fixture identity', async () => must(await db.auth.admin.deleteUser(user), 'Delete user'));
    await cleanup('Verify allowance cleanup', async () => { if ((await rows('learning_allowances')).length) throw new Error('Allowance remains'); });
  }
  if (report.cleanup.some(r => !r.passed)) { report.passed = false; process.exitCode = 1; report.cleanupRequired = { user, debates }; }
  const output = JSON.stringify(report, null, 2) + '\n';
  if (process.argv[3]) writeFileSync(process.argv[3], output);
  console.log(output);
}
