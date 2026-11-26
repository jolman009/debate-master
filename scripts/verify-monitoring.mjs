// Sends one clearly identified synthetic event; never includes request bodies,
// learner records, credentials, or user identifiers. Reads project/alert metadata
// only if the existing build token permits it. Does not create alerts or access.
import nextEnv from '@next/env';
import * as Sentry from '@sentry/node';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
nextEnv.loadEnvConfig(process.cwd());
let token = process.env.SENTRY_AUTH_TOKEN;
if (!token) {
  try {
    const line = readFileSync('.env.sentry-build-plugin', 'utf8').split('\n').find(line => line.startsWith('SENTRY_AUTH_TOKEN='));
    token = line?.slice('SENTRY_AUTH_TOKEN='.length).trim().replace(/^(["'])(.*)\1$/, '$2');
  } catch { /* Auth metadata check will report unavailable. */ }
}
const report = { checkedAt: new Date().toISOString(), project: 'literatipro/debate-master', scope: 'Synthetic SDK transport and existing Sentry read permissions, separate from deployed route instrumentation and human alert acknowledgment', checks: [], passed: false };
const check = (name, passed, extra = {}) => report.checks.push({ name, passed: !!passed, ...extra });
const statusCodes = [];
try {
  if (!process.env.SENTRY_DSN) throw new Error('SENTRY_DSN missing');
  Sentry.init({
    dsn: process.env.SENTRY_DSN, environment: 'phase0-verification', defaultIntegrations: false,
    sendDefaultPii: false, sampleRate: 1,
    transport: options => {
      const transport = Sentry.makeNodeTransport(options);
      return { ...transport, send: async envelope => { const result = await transport.send(envelope); statusCodes.push(result.statusCode); return result; } };
    },
  });
  const marker = `Phase0Verification-${randomUUID()}`;
  const eventId = Sentry.captureMessage(marker, { level: 'info', tags: { phase0_verification: 'synthetic' } });
  await Sentry.flush(10000);
  report.eventId = eventId;
  check('Sentry ingest accepts the synthetic event', statusCodes.some(code => code >= 200 && code < 300), { statusCodes });
  if (token) {
    async function read(path) {
      const response = await fetch(`https://sentry.io/api/0/projects/literatipro/debate-master/${path}`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      const data = response.ok ? await response.json() : null;
      return { status: response.status, data };
    }
    const event = await read(`events/${eventId}/`);
    check('Stored event is retrievable from Sentry', event.status === 200, { status: event.status });
    const rules = await read('rules/');
    const configured = rules.data?.filter(rule => rule.status === 'active' && rule.actions?.length > 0) ?? [];
    check('Existing active notification rules can be verified', rules.status === 200 && configured.length > 0, { status: rules.status, activeRuleCount: configured.length });
    const project = await read('');
    report.alertOwnership = { metadataStatus: project.status, assignedTeamCount: project.data?.teams?.length ?? null, humanAcknowledgment: 'not verified' };
  } else report.apiReadAccess = 'No existing API token available';
  report.passed = report.checks.length >= 3 && report.checks.every(check => check.passed);
} catch (error) { report.failure = error.message; }
await Sentry.close(1000);
const output = JSON.stringify(report, null, 2) + '\n';
if (process.argv[2]) writeFileSync(process.argv[2], output);
console.log(output);
if (!report.passed) process.exitCode = 1;
