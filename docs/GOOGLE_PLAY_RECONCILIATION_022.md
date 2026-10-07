# Google Play reconciliation migration 022

Migration 022 connects the Google Play routes to the ownership tables introduced
by migration 016. It must be applied before deploying the matching application
code because both routes call its service-role-only RPCs.

## Staging order

1. Confirm migration 016 is present in the staging project.
2. Set `GOOGLE_PLAY_ENVIRONMENT=test` and confirm `ANDROID_PACKAGE_NAME` matches
   the Play application ID. Keep service-account credentials server-only.
3. Apply `supabase/migrations/022_google_play_reconciliation.sql` to staging.
4. Run `supabase/tests/google_play_reconciliation.sql` as `postgres`. The suite
   creates synthetic users inside a transaction and rolls everything back.
5. Deploy the application code from the same commit.
6. Make a Play license-test purchase while signed in. Confirm one
   `billing_subscriptions` row owns the purchase token and the profile cache is active.
7. Redeliver the same RTDN message and confirm one `billing_events` row exists and
   the RPC reports `duplicate`.
8. Exercise cancellation/expiry. Confirm access remains through the verified period
   end, then becomes free unless another verified subscription remains active.

The migration does not trust or backfill existing profile status. It preserves
premium only from active, verified rows in `billing_subscriptions`. Stripe remains
on its legacy profile handler until its separate reconciliation work is resumed.

The RTDN route validates the package name and re-fetches current subscription state
from the Google Play Publisher API before changing access. Pub/Sub push identity
authentication remains required before the production payment gate can close.
