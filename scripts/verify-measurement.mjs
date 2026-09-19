// Live migration-015 smoke test. Uses only disposable users/rows; never reads
// learner records. Admin creates/deletes fixtures; assertions use user JWTs.
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !adminKey) throw new Error('Supabase URL, anon key and service-role key are required');
const client = key => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(adminKey);
const anon = client(anonKey);
const report = { checkedAt: new Date().toISOString(), target: new URL(url).hostname, scope: 'Live Supabase API using disposable authenticated identities; not a deployed-app or AI quality test', checks: [], cleanup: [], passed: false };
const users = [];
const sessions = [];
const check = (name, condition) => { report.checks.push({ name, passed: !!condition }); if (!condition) throw new Error(name); };
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || 'request failed'}`); return result.data; };
async function identity() {
  const email = `measurement-${randomUUID()}@example.invalid`;
  const password = randomUUID() + randomUUID();
  const created = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'Create fixture identity');
  users.push(created.user.id);
  const db = client(anonKey);
  must(await db.auth.signInWithPassword({ email, password }), 'Authenticate fixture');
  return { db, id: created.user.id };
}
async function events(db, id) { return must(await db.from('lifecycle_events').select('*').eq('session_id', id), 'Read fixture events'); }
try {
  // Validate schema accessibility before creating any fixtures.
  must(await admin.from('lifecycle_events').select('id').limit(0), 'Migration 015 table');
  const owner = await identity();
  const stranger = await identity();
  const id = randomUUID();
  sessions.push(id);
  must(await owner.db.from('debates').insert({ id, user_id: owner.id, config: { mode: 'ai', topic: 'Synthetic measurement fixture', motion: 'Synthetic measurement fixture', userSide: 'pro', personaId: 'the-academic', difficulty: 'beginner', rebuttalCycles: 1, crossExamEnabled: false } }), 'Insert fixture debate');
  const initial = await events(owner.db, id);
  check('Insert emits one owned start event', initial.length === 1 && initial[0].event_name === 'debate_started' && initial[0].user_id === owner.id);
  check('No coaching view before feedback', !!(await owner.db.rpc('record_coaching_view', { p_session_id: id })).error);
  must(await owner.db.from('debates').update({ current_stage: 'feedback' }).eq('id', id), 'Complete fixture debate');
  must(await owner.db.from('debates').update({ current_stage: 'complete', feedback: { version: 2, summary: 'Synthetic DB test, not a scored evaluation' } }).eq('id', id), 'Persist fixture feedback');
  const retries = await Promise.all(Array.from({ length: 6 }, () => owner.db.rpc('record_coaching_view', { p_session_id: id })));
  retries.forEach(r => must(r, 'Concurrent coaching view'));
  must(await owner.db.from('debates').update({ current_stage: 'complete' }).eq('id', id), 'Retry completion');
  const rows = await events(owner.db, id);
  check('Exactly one of each lifecycle event after concurrent retries', rows.length === 4 && ['debate_started', 'debate_completed', 'coaching_generated', 'coaching_viewed'].every(name => rows.filter(row => row.event_name === name).length === 1));
  check('Events have IDs, database timestamps, ownership, and no free text', rows.every(row => row.id && !Number.isNaN(Date.parse(row.occurred_at)) && row.user_id === owner.id && row.loop_id === null && Object.keys(row).sort().join(',') === 'event_name,id,loop_id,occurred_at,session_id,user_id'));
  check('Other user cannot read session events', (await events(stranger.db, id)).length === 0);
  check('Other user cannot record coaching view', !!(await stranger.db.rpc('record_coaching_view', { p_session_id: id })).error);
  check('Anonymous cannot record coaching view', !!(await anon.rpc('record_coaching_view', { p_session_id: id })).error);
  check('Anonymous cannot read events', !!(await anon.from('lifecycle_events').select('id').eq('session_id', id)).error);
  check('Owner cannot insert fabricated analytics events', !!(await owner.db.from('lifecycle_events').insert({ user_id: owner.id, session_id: id, event_name: 'coaching_viewed' })).error);
  check('Owner cannot alter analytics timestamps', !!(await owner.db.from('lifecycle_events').update({ occurred_at: '2000-01-01T00:00:00Z' }).eq('session_id', id)).error);
  check('Owner cannot delete analytics events', !!(await owner.db.from('lifecycle_events').delete().eq('session_id', id)).error);
  must(await owner.db.from('debates').delete().eq('id', id), 'Delete fixture debate');
  check('Session deletion cascades to lifecycle events', (await events(admin, id)).length === 0);
  report.passed = true;
} catch (error) {
  // No provider response bodies, JWTs, credentials or real learner data in output.
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  for (const id of sessions) {
    const result = await admin.from('debates').delete().eq('id', id);
    report.cleanup.push({ kind: 'fixture debate', passed: !result.error });
  }
  for (const id of users.reverse()) {
    const result = await admin.auth.admin.deleteUser(id);
    report.cleanup.push({ kind: 'fixture identity', passed: !result.error });
    if (result.error) console.error(`Cleanup required for fixture user ${id}`);
  }
  if (report.cleanup.some(item => !item.passed)) { report.passed = false; process.exitCode = 1; }
  const output = JSON.stringify(report, null, 2) + '\n';
  if (process.argv[2]) writeFileSync(process.argv[2], output);
  console.log(output);
}
