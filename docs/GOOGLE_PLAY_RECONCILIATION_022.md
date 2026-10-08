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

## Recover a purchase after verification fails

If Google Play reports an active order but Debate Master remains Free, do not
start another checkout. The error `Google Play verification is not configured.`
means the server cannot load service-account credentials; that request stops
before acknowledging the purchase or saving an entitlement.

1. Configure the server credentials and Play Console permissions described in
   [the Android setup guide](android-twa.md#4-configure-server-verification-google-cloud-service-account).
   For staging, set the credentials in Vercel Preview and redeploy.
2. Deploy the application change that adds **Restore Google Play purchase**.
3. Open Pricing in the Play-installed app using the purchasing Google account
   and the intended Debate Master account, then select the restore action.
4. The app obtains existing monthly or yearly purchase tokens through
   `DigitalGoodsService.listPurchases()` and submits them to the same server
   verification and ownership RPC used by checkout. It never starts a payment
   sheet or grants access from the client purchase list alone.
5. Confirm Premium appears after the redirect and that staging contains the
   verified subscription owned by the signed-in user. Do not record tokens or
   service-account keys in test evidence.

Google may refund unacknowledged license-test purchases quickly. If the original
order has since been refunded, verify that status before making a fresh test
purchase. A local implementation or passing unit tests do not establish live
purchase recovery; the Android restore and database checks remain necessary.

The signed-in Android profile menu includes Pricing, which selects native Play
Billing in the TWA. Restore distinguishes connection to Play, purchase lookup,
network access to verification, and an unsuccessful server response. Native
failures include only recognized browser/Play error codes, never raw tokens or
provider payloads. A successful HTTP response alone is insufficient: verification
must explicitly return `success: true` and `active: true`.

If a restore error says `purchase lookup failed`, check the code displayed in
parentheses before changing server credentials. A failed native lookup has no
purchase token to send to the server. These messages diagnose the stage; they do
not establish that live recovery has succeeded.
