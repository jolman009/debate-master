// Bounded live route test. Uses an isolated account and a nonexistent debate;
// no Gemini calls, billing changes, real learner records, or outbound emails.
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
nextEnv.loadEnvConfig(process.cwd());
const target = new URL(process.argv[2]);
if (target.protocol !== 'https:') throw new Error('An HTTPS deployed app URL is required');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const report = { checkedAt: new Date().toISOString(), target: target.origin, scope: 'Deployed HTTP auth boundary and real AI rate limit; nonexistent debate prevents inference', checks: [], cleanup: false, passed: false };
let userId;
const cookies = new Map();
const check = (name, passed, details) => report.checks.push({ name, passed, ...details });
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || 'request failed'}`); return result.data; };
async function post(path, authenticated = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  return fetch(new URL(path, target.origin), { method: 'POST', headers, body: '{}', redirect: 'error', signal: AbortSignal.timeout(15000) });
}
try {
  const response = await post('/api/measurement');
  check('Measurement endpoint rejects anonymous callers', response.status === 401, { status: response.status });
  const email = `measurement-http-${randomUUID()}@example.invalid`;
  const password = randomUUID() + randomUUID();
  userId = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'Create fixture').user.id;
  const session = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: values => values.forEach(({ name, value }) => cookies.set(name, value)) },
  });
  must(await session.auth.signInWithPassword({ email, password }), 'Authenticate fixture');
  const statuses = [];
  let retryAfter = null;
  const path = `/api/debate/${randomUUID()}/feedback`;
  for (let attempt = 0; attempt < 21; attempt++) {
    const r = await post(path, true);
    statuses.push(r.status);
    if (r.status === 429) { retryAfter = Number(r.headers.get('retry-after')); break; }
    if (r.status !== 404) break; // Stop on unexpected auth/server behavior.
  }
  check('Authenticated feedback path reaches owned debate lookup', statuses[0] === 404, { firstStatus: statuses[0] });
  check('AI limiter returns 429 with Retry-After within 21 calls', statuses.includes(429) && retryAfter > 0, { statuses, retryAfter });
  report.passed = report.checks.every(c => c.passed);
} catch (error) {
  report.failure = error.message;
} finally {
  if (userId) report.cleanup = !(await admin.auth.admin.deleteUser(userId)).error;
  else report.cleanup = true;
  if (!report.cleanup) console.error(`Cleanup required for fixture user ${userId}`);
  report.passed = report.passed && report.cleanup;
  const output = JSON.stringify(report, null, 2) + '\n';
  if (process.argv[3]) writeFileSync(process.argv[3], output);
  console.log(output);
  if (!report.passed) process.exitCode = 1;
}
