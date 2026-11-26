// Operator-only, one-time recovery for an exhausted learning evaluation.
// Explicit staging credentials are required; .env.local is intentionally ignored.
import { createClient } from '@supabase/supabase-js';

const [project, responseId, operatorReference, reasonCode] = process.argv.slice(2);
const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const reasons = new Set(['provider_unavailable', 'provider_timeout', 'platform_incident']);

if (process.argv.includes('--help')) {
  console.log('Set STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY.\nnode scripts/grant-learning-evaluation-recovery.mjs <staging-project-ref> <response-id> <operator-reference> <reason-code>');
  process.exit(0);
}
if (!project || !url || !key) throw new Error('Explicit staging URL, service-role key and project reference required; .env.local is not loaded.');
if (project === 'brbojvglxluvaigoxdji' || url !== `https://${project}.supabase.co`) throw new Error('Refusing production or a mismatched staging URL.');
if (!uuid.test(responseId || '')) throw new Error('A valid response UUID is required.');
if (!operatorReference || operatorReference.trim().length > 200) throw new Error('A short operator reference is required.');
if (!reasons.has(reasonCode)) throw new Error(`Reason must be one of: ${[...reasons].join(', ')}.`);

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await db.rpc('grant_learning_evaluation_recovery', {
  p_response_id: responseId,
  p_operator_reference: operatorReference.trim(),
  p_reason_code: reasonCode,
});
if (error) throw new Error(`Recovery grant failed: ${error.code || error.status || 'unknown'}`);
console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  target: new URL(url).hostname,
  responseId: data.responseId,
  granted: data.granted,
  attempts: data.attempts,
  attemptLimit: data.attemptLimit,
  reasonCode,
}, null, 2));
