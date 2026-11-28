// G1-3.7 staging-only verification: owner isolation and deletion cleanup for practice cycles.
// Two disposable accounts. Isolation is asserted with real user sign-ins (row security) and with
// cross-owner calls to the learning functions. Deletion follows the app's own order: the owner
// deletes the debate, then the account is deleted. No AI/provider calls.
//
//   STAGING_SUPABASE_URL=https://<ref>.supabase.co STAGING_SUPABASE_ANON_KEY=... STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/verify-learning-isolation.mjs <staging-project-ref> [report.json]
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const project = process.argv[2];
const url = process.env.STAGING_SUPABASE_URL;
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY;
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (process.argv.includes('--help')) {
  console.log('Set STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY and STAGING_SUPABASE_SERVICE_ROLE_KEY.\nnode scripts/verify-learning-isolation.mjs <staging-project-ref> [report.json]');
  process.exit(0);
}
if (!project || !url || !key || !anonKey) throw new Error('Explicit staging URL, anon key, service-role key and project reference required; .env.local is not loaded.');
if (project === 'brbojvglxluvaigoxdji' || url !== `https://${project}.supabase.co`) throw new Error('Refusing production or a mismatched staging URL.');
const client = k => createClient(url, k, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(key);
const report = { checkedAt: new Date().toISOString(), target: new URL(url).hostname, scope: 'Synthetic owner isolation and deletion cleanup; no inference', checks: [], cleanup: [], passed: false };
const users = [];
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || 'failed'}`); return result.data; };
const check = (name, condition) => { report.checks.push({ name, passed: !!condition }); if (!condition) throw new Error(name); };
const LEARNING = ['learning_cycles', 'learning_sessions', 'learning_allowances', 'learning_runtime', 'learning_responses', 'learning_evaluations', 'learning_events', 'learning_evaluation_recoveries'];
const MEASUREMENT = ['learning_recommendation_outcomes', 'coaching_usefulness'];
const OWNER_READABLE = ['learning_cycles', 'learning_sessions', 'learning_allowances', 'learning_runtime', 'learning_responses', 'learning_evaluations', 'learning_events'];
async function identity(label) {
  const email = `learning-isolation-${label}-${randomUUID()}@example.invalid`;
  const password = randomUUID() + randomUUID();
  const id = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'Create fixture identity').user.id;
  users.push(id);
  const db = client(anonKey);
  must(await db.auth.signInWithPassword({ email, password }), 'Sign in fixture');
  return { id, db };
}
async function fixtureDebate(owner) {
  const debate = randomUUID(), turn = randomUUID();
  must(await admin.from('debates').insert({ id: debate, user_id: owner, config: { mode: 'ai', difficulty: 'beginner' }, current_stage: 'complete', feedback: { summary: 'Synthetic isolation fixture, not measured coaching' }, assessment_status: 'valid' }), 'Create fixture debate');
  must(await admin.from('debate_turns').insert({ id: turn, debate_id: debate, stage: 'opening_user', role: 'user', content: 'Synthetic isolation fixture' }), 'Create fixture turn');
  return { debate, turn };
}
const adminRows = async (table, user) => must(await admin.from(table).select('*').eq('user_id', user), `Read ${table}`);
// A denied read (no grant) and an empty read (row security) both mean "cannot see it".
const visible = async (db, table, column, value) => { const r = await db.from(table).select('*').eq(column, value); return r.error ? 0 : r.data.length; };
try {
  must(await admin.from('learning_evaluation_recoveries').select('response_id').limit(0), 'Migration 021');
  const owner = await identity('owner');
  const stranger = await identity('stranger');
  const { debate, turn } = await fixtureDebate(owner.id);
  const strangerFixture = await fixtureDebate(stranger.id);

  // Owner completes the first drill answer, as the app's server would.
  const exercise = { kind: 'drill', templateVersion: 'counterargument-response-v1', competency: 'rebuttalQuality', context: 'Synthetic database fixture' };
  const loop = must(await admin.rpc('learning_open', { p_user_id: owner.id, p_origin_debate_id: debate, p_cited_turn_id: turn, p_request_id: randomUUID(), p_exercise: exercise, p_reassessment: { ...exercise, kind: 'reassessment' } }), 'Open cycle');
  const session = (await adminRows('learning_runtime', owner.id))[0].session_id;
  const claim = must(await admin.rpc('learning_submit', { p_user_id: owner.id, p_session_id: session, p_request_id: randomUUID(), p_kind: 'initial', p_content: 'Synthetic owner answer', p_revision: 0 }), 'Submit');
  const response = claim.response;
  check('Owner fixture answer graded', must(await admin.rpc('learning_finish', { p_user_id: owner.id, p_response_id: response.id, p_token: response.lease_token, p_outcome: 'valid', p_assessment: { status: 'valid', score: 6, rationale: 'Synthetic fixture, not AI feedback' }, p_usage: { synthetic: true } }), 'Finish') === true);
  must(await admin.rpc('learning_view', { p_user_id: owner.id, p_session_id: session, p_response_id: response.id }), 'View coaching');
  must(await admin.from('learning_recommendation_outcomes').insert({ user_id: owner.id, debate_id: debate, reason: 'ineligible_source' }), 'Create outcome row');
  must(await admin.from('coaching_usefulness').insert({ user_id: owner.id, debate_id: debate, rating: 'helpful' }), 'Create usefulness row');
  const before = (await adminRows('learning_runtime', owner.id))[0];

  // 1. Signed-in reads: the owner sees their own rows; a stranger and a signed-out visitor see none.
  for (const table of OWNER_READABLE) check(`Owner can read own ${table}`, await visible(owner.db, table, 'user_id', owner.id) > 0);
  const anon = client(anonKey);
  for (const table of [...LEARNING, ...MEASUREMENT, 'debates', 'lifecycle_events']) {
    check(`Stranger cannot read owner ${table}`, await visible(stranger.db, table, 'user_id', owner.id) === 0);
    check(`Signed-out visitor cannot read owner ${table}`, await visible(anon, table, 'user_id', owner.id) === 0);
  }
  check('Stranger cannot read owner debate turns', await visible(stranger.db, 'debate_turns', 'debate_id', debate) === 0);

  // 2. Signed-in writes: a stranger cannot change or delete the owner's rows.
  const tamper = await stranger.db.from('learning_responses').update({ content: 'tampered' }).eq('id', response.id).select();
  check('Stranger cannot edit owner answer', !!tamper.error || tamper.data.length === 0);
  const draftTamper = await stranger.db.from('learning_runtime').update({ draft: 'tampered' }).eq('session_id', session).select();
  check('Stranger cannot edit owner draft', !!draftTamper.error || draftTamper.data.length === 0);
  const deleteTamper = await stranger.db.from('debates').delete().eq('id', debate).select();
  check('Stranger cannot delete owner debate', !!deleteTamper.error || deleteTamper.data.length === 0);
  check('Owner answer unchanged', (await admin.from('learning_responses').select('content').eq('id', response.id).single()).data?.content === 'Synthetic owner answer');

  // 3. Learning functions are server-only: a signed-in user cannot call them, even naming the owner.
  for (const [db, who] of [[stranger.db, 'Stranger'], [owner.db, 'Owner'], [anon, 'Signed-out visitor']]) {
    check(`${who} cannot call learning_view directly`, !!(await db.rpc('learning_view', { p_user_id: owner.id, p_session_id: session })).error);
    check(`${who} cannot call learning_submit directly`, !!(await db.rpc('learning_submit', { p_user_id: owner.id, p_session_id: session, p_request_id: randomUUID(), p_kind: 'revision', p_content: 'x', p_revision: before.draft_revision })).error);
  }

  // 4. Server-side, a request on behalf of the stranger cannot touch the owner's cycle.
  const as = (fn, p) => admin.rpc(fn, { p_user_id: stranger.id, ...p });
  check('Cross-owner view refused', (await as('learning_view', { p_session_id: session })).error?.code === '42501');
  check('Cross-owner coaching view refused', (await as('learning_view', { p_session_id: session, p_response_id: response.id })).error?.code === '42501');
  check('Cross-owner draft save refused', !!(await as('learning_save_draft', { p_session_id: session, p_content: 'tampered', p_revision: before.draft_revision })).error);
  check('Cross-owner submit refused', (await as('learning_submit', { p_session_id: session, p_request_id: randomUUID(), p_kind: 'revision', p_content: 'tampered', p_revision: before.draft_revision })).error?.code === '42501');
  check('Cross-owner finish refused', (await as('learning_finish', { p_response_id: response.id, p_token: response.lease_token, p_outcome: 'failed', p_assessment: null, p_usage: null })).error?.code === '42501');
  check('Cross-owner reassessment refused', !!(await as('learning_reassess', { p_loop_id: loop, p_request_id: randomUUID() })).error);
  const after = (await adminRows('learning_runtime', owner.id))[0];
  check('Owner session unchanged by cross-owner attempts', after.draft === before.draft && after.draft_revision === before.draft_revision && after.state === before.state);
  check('Stranger gained no learning rows', (await Promise.all(LEARNING.map(t => adminRows(t, stranger.id)))).every(r => r.length === 0));

  // 5. The owner deletes the debate (the app's account deletion does this first).
  const deleted = must(await owner.db.from('debates').delete().eq('id', debate).select(), 'Owner deletes debate');
  check('Owner can delete own debate', deleted.length === 1);
  for (const table of [...LEARNING.filter(t => t !== 'learning_allowances'), ...MEASUREMENT, 'lifecycle_events']) check(`Debate deletion removes owner ${table}`, (await adminRows(table, owner.id)).length === 0);
  check('Debate deletion removes debate turns', (await admin.from('debate_turns').select('id').eq('debate_id', debate)).data?.length === 0);
  const allowance = await adminRows('learning_allowances', owner.id);
  check('Free-cycle allowance stays used (not refunded by deleting the debate), unlinked from content', allowance.length === 1 && allowance[0].loop_id === null);
  check('Stranger debate untouched', (await adminRows('debates', stranger.id)).some(d => d.id === strangerFixture.debate));

  // 6. Account deletion removes everything left.
  must(await admin.auth.admin.deleteUser(owner.id), 'Delete owner account');
  users.splice(users.indexOf(owner.id), 1);
  for (const table of [...LEARNING, ...MEASUREMENT, 'debates', 'lifecycle_events']) check(`Account deletion leaves no owner ${table}`, (await adminRows(table, owner.id)).length === 0);
  report.passed = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  for (const id of [...users]) {
    try {
      must(await admin.from('debates').delete().eq('user_id', id), 'Delete debates');
      must(await admin.auth.admin.deleteUser(id), 'Delete user');
      const left = await Promise.all(['learning_allowances', 'debates'].map(t => adminRows(t, id)));
      if (left.some(r => r.length)) throw new Error('Fixture remains');
      report.cleanup.push({ name: 'Remove fixture identity and data', passed: true });
    } catch { report.cleanup.push({ name: 'Remove fixture identity and data', passed: false }); report.cleanupRequired = [...(report.cleanupRequired ?? []), id]; }
  }
  if (report.cleanup.some(r => !r.passed)) { report.passed = false; process.exitCode = 1; }
  const output = JSON.stringify(report, null, 2) + '\n';
  if (process.argv[3]) writeFileSync(process.argv[3], output);
  console.log(output);
}
