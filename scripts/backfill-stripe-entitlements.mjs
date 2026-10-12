import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Dry run by default. Credentials are loaded locally and never printed.
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (new URL(url).hostname !== 'brbojvglxluvaigoxdji.supabase.co') throw new Error('Expected production Supabase');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const apply = process.argv.includes('--apply');
const { data: profiles, error } = await db.from('profiles').select('user_id,stripe_customer_id').not('stripe_customer_id', 'is', null);
if (error) throw new Error('Unable to read Stripe owners');
let verified = 0;
for (const profile of profiles) {
  const subscriptions = stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'all', limit: 100 });
  for await (const subscription of subscriptions) {
    if (!subscription.livemode) throw new Error('Refusing test-mode Stripe state in production');
    const product = subscription.items.data[0]?.price.id;
    if (!product || !Number.isFinite(subscription.current_period_end)) throw new Error('Incomplete provider subscription');
    verified++;
    if (!apply) continue;
    const now = new Date().toISOString();
    const { error: saveError } = await db.from('billing_subscriptions').upsert({
      user_id: profile.user_id, provider: 'stripe', provider_environment: 'live',
      provider_subscription_id: subscription.id, provider_customer_id: profile.stripe_customer_id,
      product_id: product, status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end, provider_updated_at: now, verified_at: now,
    }, { onConflict: 'provider,provider_environment,provider_subscription_id' });
    if (saveError) throw new Error('Unable to store verified Stripe ownership');
  }
  // Do not refresh customers with no verified subscription rows.
  if (apply) {
    const { count, error: countError } = await db.from('billing_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', profile.user_id).eq('provider', 'stripe');
    if (countError) throw new Error('Unable to verify stored Stripe state');
    if (count) {
      const { error: refreshError } = await db.rpc('refresh_billing_entitlement', { p_user_id: profile.user_id });
      if (refreshError) throw new Error('Unable to refresh combined entitlement');
    }
  }
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', customers: profiles.length, verifiedSubscriptions: verified }));
