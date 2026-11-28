// G1-3.6 staging-only verification: failed/invalid evaluations, lease expiry, duplicate clicks
// and bounded retries, against the real learning RPCs (migrations 018 and 021). No AI/provider calls.
// A failed or invalid evaluation must never count as completion.
//
//   STAGING_SUPABASE_URL=https://<ref>.supabase.co STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/verify-learning-failures.mjs <staging-project-ref> [report.json]
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const project = process.argv[2];
const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (process.argv.includes('--help')) {
  console.log('Set STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY.\nnode scripts/verify-learning-failures.mjs <staging-project-ref> [report.json]');
  process.exit(0);
}
if (!project || !url || !key) throw new Error('Explicit staging URL, service-role key and project reference required; .env.local is not loaded.');
if (project === 'brbojvglxluvaigoxdji' || url !== `https://${project}.supabase.co`) throw new Error('Refusing production or a mismatched staging URL.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const report = { checkedAt: new Date().toISOString(), target: new URL(url).hostname, scope: 'Synthetic failure, lease and retry-limit paths; no inference', checks: [], cleanup: [], passed: false };
let user;
const debate = randomUUID();
const turn = randomUUID();
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || 'failed'}`); return result.data; };
const check = (name, condition) => { report.checks.push({ name, passed: !!condition }); if (!condition) throw new Error(name); };
const repeat = (p, n = 8) => Array.from({ length: n }, () => p);
async function parallel(name, parameters) {
  const all = await Promise.allSettled(parameters.map(p => db.rpc(name, p)));
  check(`${name}: every HTTP request returned`, all.every(r => r.status === 'fulfilled'));
  return all.map(r => r.value);
}
async function rows(table) { return must(await db.from(table).select('*').eq('user_id', user), `Read ${table}`); }
async function one(table, column, value) { return must(await db.from(table).select('*').eq(column, value).single(), `Read ${table}`); }
const content = 'Synthetic answer for failure-path verification';
let drill;
const submit = () => db.rpc('learning_submit', { p_user_id: user, p_session_id: drill, p_request_id: randomUUID(), p_kind: 'initial', p_content: content, p_revision: 0 });
const finish = (response, token, outcome) => db.rpc('learning_finish', { p_user_id: user, p_response_id: response, p_token: token, p_outcome: outcome, p_assessment: null, p_usage: { synthetic: true } });
const expireLease = async id => must(await db.from('learning_responses').update({ lease_until: new Date(Date.now() - 1000).toISOString() }).eq('id', id), 'Expire lease');
async function noCompletion(label) {
  const events = (await rows('learning_events')).map(e => e.event_name);
  const runtime = await one('learning_runtime', 'session_id', drill);
  const response = await one('learning_responses', 'session_id', drill);
  check(`${label}: no completion events`, !events.some(e => ['drill_completed', 'reassessment_completed', 'cycle_completed'].includes(e)));
  check(`${label}: no assessment stored`, response.assessment === null);
  check(`${label}: session not coached or completed`, !['coached', 'completed'].includes(runtime.state));
  return { runtime, response };
}
try {
  must(await db.from('learning_evaluation_recoveries').select('response_id').limit(0), 'Migration 021');
  user = must(await db.auth.admin.createUser({ email: `learning-failures-${randomUUID()}@example.invalid`, password: randomUUID() + randomUUID(), email_confirm: true }), 'Create fixture identity').user.id;
  must(await db.from('debates').insert({ id: debate, user_id: user, config: { mode: 'ai', difficulty: 'beginner' }, current_stage: 'complete', feedback: { summary: 'Synthetic failure fixture, not measured coaching' }, assessment_status: 'valid' }), 'Create fixture debate');
  must(await db.from('debate_turns').insert({ id: turn, debate_id: debate, stage: 'opening_user', role: 'user', content: 'Synthetic failure fixture' }), 'Create fixture turn');
  const exercise = { kind: 'drill', templateVersion: 'counterargument-response-v1', competency: 'rebuttalQuality', context: 'Synthetic database fixture' };
  must(await db.rpc('learning_open', { p_user_id: user, p_origin_debate_id: debate, p_cited_turn_id: turn, p_request_id: randomUUID(), p_exercise: exercise, p_reassessment: { ...exercise, kind: 'reassessment' } }), 'Open cycle');
  drill = (await rows('learning_runtime'))[0].session_id;

  // Attempt 1: eight duplicate clicks give one claim; the provider "fails"; eight duplicate finishes commit once.
  const clicks = (await Promise.all(repeat(null).map(submit))).map(r => must(r, 'Submit'));
  check('Duplicate clicks: one evaluation claim', clicks.filter(r => r.claimed).length === 1);
  check('Duplicate clicks: one response row', clicks.every(r => r.response.id === clicks[0].response.id));
  const a1 = clicks.find(r => r.claimed).response;
  const responseId = a1.id;
  check('Attempt 1 counted once', a1.attempts === 1);
  const failedCommits = (await parallel('learning_finish', repeat({ p_user_id: user, p_response_id: responseId, p_token: a1.lease_token, p_outcome: 'failed', p_assessment: null, p_usage: { synthetic: true } }))).map(r => must(r, 'Finish failed'));
  check('Failed outcome commits exactly once', failedCommits.filter(Boolean).length === 1);
  const afterFailed = await noCompletion('After failed evaluation');
  check('Failed evaluation marks response failed and session failed', afterFailed.response.status === 'failed' && afterFailed.runtime.state === 'failed');

  // Attempt 2: a retry reclaims the same response; a click during the lease is not a new attempt.
  const retry = must(await submit(), 'Retry submit');
  check('Retry after failure reclaims the same response', retry.claimed && retry.response.id === responseId && retry.response.attempts === 2);
  const a2 = retry.response;
  const duringLease = must(await submit(), 'Click during lease');
  check('Click during an active lease does not start another attempt', !duringLease.claimed && duringLease.response.attempts === 2);

  // Lease expiry: the stuck attempt 2 is expired by the next claim, and its late result is fenced out.
  await expireLease(responseId);
  const reclaim = must(await submit(), 'Reclaim after lease expiry');
  check('Expired lease is reclaimed as attempt 3', reclaim.claimed && reclaim.response.attempts === 3);
  const a3 = reclaim.response;
  check('Expired attempt is marked expired', (await one('learning_evaluations', 'id', a2.lease_token)).outcome === 'expired');
  check('Late result from the expired attempt is rejected', must(await finish(responseId, a2.lease_token, 'failed'), 'Late finish') === false);
  check('Late result keeps the expired label', (await one('learning_evaluations', 'id', a2.lease_token)).outcome === 'expired');

  // Attempt 3: the coach output is unusable ("invalid").
  check('Invalid outcome commits', must(await finish(responseId, a3.lease_token, 'invalid'), 'Finish invalid') === true);
  const afterInvalid = await noCompletion('After invalid evaluation');
  check('Invalid evaluation marks response invalid and session failed', afterInvalid.response.status === 'invalid' && afterInvalid.runtime.state === 'failed');

  // Bounded retries: a fourth attempt is refused without creating another evaluation.
  const blocked = await submit();
  check('Fourth attempt refused with the retry-limit error', blocked.error?.code === '54000');
  check('Refused attempt adds no evaluation', (await rows('learning_evaluations')).length === 3);
  const changed = await db.rpc('learning_submit', { p_user_id: user, p_session_id: drill, p_request_id: randomUUID(), p_kind: 'initial', p_content: content + ' edited', p_revision: 0 });
  check('A different answer cannot bypass the limit', changed.error?.code === '22023');

  // Operator recovery grants exactly one more attempt, once.
  const grant = must(await db.rpc('grant_learning_evaluation_recovery', { p_response_id: responseId, p_operator_reference: 'g1-3.6-synthetic', p_reason_code: 'provider_unavailable' }), 'Grant recovery');
  check('Recovery raises the limit to 4', grant.granted === true && grant.attemptLimit === 4);
  const regrant = must(await db.rpc('grant_learning_evaluation_recovery', { p_response_id: responseId, p_operator_reference: 'g1-3.6-synthetic', p_reason_code: 'provider_unavailable' }), 'Repeat grant');
  check('Repeat recovery grants nothing extra', regrant.granted === false && regrant.attemptLimit === 4);
  const recovered = must(await submit(), 'Recovery attempt');
  check('Recovery attempt is attempt 4', recovered.claimed && recovered.response.attempts === 4);

  // A result that arrives after its own lease ended is fenced out, then the hard limit holds.
  await expireLease(responseId);
  check('Result after lease expiry is rejected', must(await finish(responseId, recovered.response.lease_token, 'failed'), 'Finish after expiry') === false);
  check('Fifth attempt refused even after recovery', (await submit()).error?.code === '54000');

  await noCompletion('End of run');
  const events = (await rows('learning_events')).map(e => e.event_name);
  check('One response_submitted event across all retries', events.filter(e => e === 'response_submitted').length === 1);
  check('Four evaluation attempts recorded, all with usage', (await rows('learning_evaluations')).filter(e => e.usage).length === 4);
  check('Retries consume no extra allowance', (await rows('learning_allowances')).length === 1);
  report.passed = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  const cleanup = async (name, task) => { try { await task(); report.cleanup.push({ name, passed: true }); } catch { report.cleanup.push({ name, passed: false }); } };
  if (user) {
    await cleanup('Remove fixture debate', async () => must(await db.from('debates').delete().eq('user_id', user).eq('id', debate), 'Delete debate'));
    await cleanup('Verify dependent runtime cleanup', async () => {
      for (const table of ['learning_cycles','learning_sessions','learning_runtime','learning_responses','learning_evaluations','learning_evaluation_recoveries','learning_events','lifecycle_events']) if ((await rows(table)).length) throw new Error('Fixture remains');
    });
    await cleanup('Remove fixture identity', async () => must(await db.auth.admin.deleteUser(user), 'Delete user'));
    await cleanup('Verify allowance cleanup', async () => { if ((await rows('learning_allowances')).length) throw new Error('Allowance remains'); });
  }
  if (report.cleanup.some(r => !r.passed)) { report.passed = false; process.exitCode = 1; report.cleanupRequired = { user, debate }; }
  const output = JSON.stringify(report, null, 2) + '\n';
  if (process.argv[3]) writeFileSync(process.argv[3], output);
  console.log(output);
}
