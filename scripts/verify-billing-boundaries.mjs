// Live free-quota concurrency and billing boundary checks on disposable data.
// No inference, checkout sessions, charges, or real purchase tokens.
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
nextEnv.loadEnvConfig(process.cwd());
const target = new URL(process.argv[2]);
if (target.protocol !== 'https:') throw new Error('An HTTPS deployed app URL is required');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const report = { checkedAt: new Date().toISOString(), target: target.origin, scope: 'Deployed free-account API quota concurrency and billing auth boundaries; does not verify payments or webhook reconciliation', checks: [], cleanup: false, passed: false };
let userId;
const cookies = new Map();
const check = (name, passed, details) => report.checks.push({ name, passed, ...details });
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || 'request failed'}`); return result.data; };
async function post(path, authenticated = false, body = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  return fetch(new URL(path, target.origin), { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15000) });
}
try {
  const email = `measurement-http-${randomUUID()}@example.invalid`;
  const password = randomUUID() + randomUUID();
  userId = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'Create fixture').user.id;
  const session = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: values => values.forEach(({ name, value }) => cookies.set(name, value)) },
  });
  must(await session.auth.signInWithPassword({ email, password }), 'Authenticate fixture');
  const config = { mode: 'ai', topic: 'Synthetic quota fixture', motion: 'Synthetic quota fixture', userSide: 'pro', personaId: 'the-academic', difficulty: 'beginner', rebuttalCycles: 1, crossExamEnabled: false };
  const requests = await Promise.all(Array.from({ length: 4 }, () => post('/api/debate', true, config)));
  const statuses = requests.map(r => r.status).sort();
  const { count, error } = await admin.from('debates').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  check('Concurrent free-account API creation allows three debates and rejects the fourth', !error && count === 3 && statuses.join(',') === '200,200,200,403', { statuses, storedDebates: count });
  const denied = await post('/api/debate', true, config);
  check('Subsequent request stays blocked at the monthly cap', denied.status === 403, { status: denied.status });
  const checkout = await post('/api/billing/checkout');
  check('Checkout requires authentication with billing enabled', checkout.status === 401, { status: checkout.status });
  const webhook = await post('/api/webhooks/stripe');
  check('Unsigned Stripe webhook is rejected', webhook.status === 400, { status: webhook.status });
  const play = await post('/api/billing/play/verify');
  check('Play verification requires authentication', play.status === 401, { status: play.status });
  report.passed = report.checks.every(c => c.passed);
} catch (error) {
  report.failure = error.message;
} finally {
  if (userId) {
    const deleted = await admin.from('debates').delete().eq('user_id', userId);
    const user = await admin.auth.admin.deleteUser(userId);
    report.cleanup = !deleted.error && !user.error;
  }
  else report.cleanup = true;
  if (!report.cleanup) console.error(`Cleanup required for fixture user ${userId}`);
  report.passed = report.passed && report.cleanup;
  const output = JSON.stringify(report, null, 2) + '\n';
  if (process.argv[3]) writeFileSync(process.argv[3], output);
  console.log(output);
  if (!report.passed) process.exitCode = 1;
}
