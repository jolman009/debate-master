// Real production inference on synthetic practice only. One isolated account,
// at most three streamed AI turns and two feedback requests; always cleans up.
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
nextEnv.loadEnvConfig(process.cwd());
const target = new URL(process.argv[2]);
if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname))) throw new Error('HTTPS or local loopback target required');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const report = { checkedAt: new Date().toISOString(), target: target.origin, scope: 'One synthetic scripted debate through the specified app origin with real model inference, then authenticated browser coaching inspection. Local origins are not deployment evidence. Not human calibration or a population latency baseline.', checks: [], requests: [], cleanup: false, passed: false };
const cookies = new Map();
let userId, browser;
const check = (name, passed, extra = {}) => report.checks.push({ name, passed: !!passed, ...extra });
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.code || result.error.status || 'request failed'}`); return result.data; };
async function post(path, body = {}, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  const start = Date.now();
  const r = await fetch(new URL(path, target.origin), { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(90000) });
  const text = await r.text();
  report.requests.push({ action: path.replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, ':session'), status: r.status, latencyMs: Date.now() - start });
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  return { status: r.status, data, text };
}
const config = { mode: 'ai', topic: 'Public libraries', motion: 'Cities should extend public library opening hours', userSide: 'pro', personaId: 'the-academic', difficulty: 'beginner', rebuttalCycles: 1, crossExamEnabled: false };
try {
  const email = `measurement-ai-${randomUUID()}@example.invalid`;
  const password = randomUUID() + randomUUID();
  userId = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'Create synthetic test account').user.id;
  const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: values => values.forEach(({ name, value }) => cookies.set(name, value)) } });
  must(await db.auth.signInWithPassword({ email, password }), 'Authenticate');
  const billing = await post('/api/billing/checkout', {}, false);
  report.billingAvailability = { anonymousCheckoutStatus: billing.status, disabled: billing.status === 503 && billing.data?.error === 'Billing is not enabled.' };
  const created = await post('/api/debate', config);
  const id = created.data?.debateId;
  check('Deployed debate creation succeeds', created.status === 200 && id);
  if (!id) throw new Error(`Cannot create debate: HTTP ${created.status}`);
  const before = await post(`/api/debate/${id}/feedback`);
  check('Unplayed debate cannot generate coaching', before.status === 400 || before.status === 409, { status: before.status });
  const submissions = [
    'Cities should pilot later library hours two evenings a week. People working daytime shifts need quiet study space and internet access after work. Extending existing buildings is a targeted way to provide that access, but staffing costs must be measured. I propose a three-month pilot with attendance, cost per visit, and user surveys before expansion. I do not have reliable local attendance estimates yet.',
    'The strongest objection is that staffing and security costs may outweigh low evening attendance. My proposal is a limited pilot at one well-connected branch, not an immediate citywide mandate. Compare evening visits and cost per visitor against current hours, and publish results. If demand is weak, stop. Digital services are useful but cannot replace a quiet workspace for residents in crowded homes.',
    'The choice is a reversible pilot versus assuming demand is absent. Access for shift workers provides a plausible benefit, while a spending cap and predefined review limit costs. My case does not establish that every branch should stay open late. It supports testing one branch for three months and expanding only if measured usage justifies staffing and security costs.',
  ];
  for (let i = 0; i < submissions.length; i++) {
    const r = await post(`/api/debate/${id}/turn`, { content: submissions[i] });
    const frames = r.text.split('\n').filter(line => line.startsWith('data: ')).map(line => { try { return JSON.parse(line.slice(6)); } catch { return {}; } });
    const ok = r.status === 200 && frames.some(f => typeof f.text === 'string' && f.text.length > 0) && frames.some(f => f.done) && !frames.some(f => f.error);
    const state = must(await db.from('debates').select('current_stage').eq('id', id).single(), 'Inspect turn state');
    check(`Real AI streamed turn ${i + 1} completes`, ok, { status: r.status, frameCount: frames.length, textFrames: frames.filter(f => f.text).length, doneFrames: frames.filter(f => f.done).length, streamErrors: frames.filter(f => f.error).map(f => f.error), persistedStage: state.current_stage });
    if (!ok && state.current_stage !== 'feedback') throw new Error(`Streamed turn ${i + 1} failed; stopped to avoid duplicate inference`);
  }
  const evaluated = await post(`/api/debate/${id}/feedback`);
  const feedback = evaluated.data?.feedback;
  check('Real coaching evaluation succeeds', evaluated.status === 200 && feedback, { status: evaluated.status });
  if (!feedback) throw new Error('No generated feedback; remaining evaluation checks blocked');
  const row = must(await db.from('debates').select('feedback,assessment_status,current_stage').eq('id', id).single(), 'Read generated evaluation');
  const turns = must(await db.from('debate_turns').select('id,content,stage,role').eq('debate_id', id), 'Read synthetic transcript');
  check('All six transcript turns persisted', turns.length === 6);
  const assessment = feedback.assessment;
  report.assessment = assessment ?? null;
  check('Rubric/model/prompt/format/difficulty provenance persisted', assessment?.status === 'valid' && assessment.rubricVersion && assessment.promptVersion && assessment.model && assessment.sessionFormat === 'ai:1:false' && assessment.difficulty === 'beginner' && row.assessment_status === 'valid');
  check('Evaluation records token counts and latency', assessment?.inputTokens > 0 && assessment?.outputTokens > 0 && assessment?.latencyMs > 0);
  const refs = [feedback.strongestMoment, feedback.priorityImprovement, ...Object.values(feedback.rubric ?? {})].flatMap(item => item?.evidence ?? []);
  check('Every generated transcript reference resolves exactly', refs.length > 0 && refs.every(ref => turns.some(t => t.id === ref.turnId && t.content.includes(ref.excerpt) && t.stage === ref.stage && t.role === ref.speakerRole)), { referenceCount: refs.length });
  // Only retry current provenance-aware endpoint; an older endpoint may regenerate.
  if (assessment) {
    const retry = await post(`/api/debate/${id}/feedback`);
    check('Feedback retry returns the persisted evaluation unchanged', retry.status === 200 && JSON.stringify(retry.data.feedback) === JSON.stringify(feedback));
  } else report.retrySkipped = 'Deployed feedback has no provenance; retry might trigger unnecessary inference';
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([...cookies].map(([name, value]) => ({ name, value, domain: target.hostname, path: '/', secure: target.protocol === 'https:', sameSite: 'Lax' })));
  const page = await context.newPage();
  const measurementRequests = [];
  page.on('response', r => { if (new URL(r.url()).pathname === '/api/measurement') measurementRequests.push(r.status()); });
  await page.goto(new URL(`/debate/${id}`, target.origin).href, { waitUntil: 'networkidle', timeout: 45000 });
  check('Authenticated browser displays coaching', await page.getByRole('heading', { name: 'Coaching Notes', exact: true }).isVisible());
  const displayed = await page.locator('blockquote').allTextContents();
  check('Displayed transcript excerpts resolve to generated references', displayed.length > 0 && displayed.every(text => refs.some(ref => text.includes(ref.excerpt))), { displayedReferenceCount: displayed.length });
  await page.reload({ waitUntil: 'networkidle' });
  report.browserMeasurementStatuses = measurementRequests;
  check('Browser posts coaching-view events successfully', measurementRequests.some(status => status === 204));
  const events = must(await db.from('lifecycle_events').select('event_name').eq('session_id', id), 'Read lifecycle');
  report.lifecycleCounts = Object.fromEntries(['debate_started', 'debate_completed', 'coaching_generated', 'coaching_viewed'].map(name => [name, events.filter(event => event.event_name === name).length]));
  check('Exactly one lifecycle event per action after browser reload', Object.values(report.lifecycleCounts).every(count => count === 1));
  // Negative entitlement check on this disposable account only. No real token.
  const play = await post('/api/billing/play/verify', { sku: 'phase0-invalid-sku', purchaseToken: 'phase0-invalid-token' });
  check('Invalid Play purchase cannot grant entitlement', play.status >= 400 && play.data?.active !== true, { status: play.status, testMode: play.data?.testMode ?? false });
  report.passed = report.checks.every(c => c.passed);
} catch (error) {
  report.failure = error.message;
} finally {
  if (browser) await browser.close();
  if (userId) {
    const debates = await admin.from('debates').delete().eq('user_id', userId);
    const user = await admin.auth.admin.deleteUser(userId);
    report.cleanup = !debates.error && !user.error;
    if (!report.cleanup) console.error(`Cleanup required for synthetic test identity ${userId}`);
  } else report.cleanup = true;
  report.passed = report.passed && report.cleanup;
  const output = JSON.stringify(report, null, 2) + '\n';
  if (process.argv[3]) writeFileSync(process.argv[3], output);
  console.log(output);
  if (!report.passed) process.exitCode = 1;
}
