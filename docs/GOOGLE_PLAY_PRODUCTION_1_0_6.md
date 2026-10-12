# Google Play production release candidate 1.0.6

Prepared October 12, 2026 on `release/google-play-1.0.6`, based on main
`d3c444a`. This candidate includes billing fixes independently of the unfinished
Phase 1 learning rollout.

## Android artifact

- Package: `app.debatemaster.twa`; version 1.0.6, code 9.
- Production host: `https://debate-master-psi.vercel.app`, start path `/debate`.
- Target/compile SDK 36; minimum SDK 24; Play Billing 8.3.0.
- Signed using the existing upload key; `jarsigner -verify` passed.
- Local artifact: `twa/debate-master-production-v1.0.6-code9.aab` (ignored by Git).
- SHA-256: `208c3e236a48d69230b0f3ed925e8d3c3351c40f7dce9f13ae216086ad405fbe`.

Code 9 replaces the uploaded code 8 bundle, which Google Play rejected because
automatic protection requires minimum SDK 24. The production build script reads
the manifest's minimum SDK and refuses values below 24. Android 7.0 is now the
oldest supported Android version.
The code 9 Gradle release build and `jarsigner -verify` both passed; the merged
release manifest confirms `minSdkVersion="24"`, `targetSdkVersion="36"`,
`versionCode="9"` and `versionName="1.0.6"`.

Rebuild using `npm run build:twa:production` with
`BUBBLEWRAP_KEYSTORE_PASSWORD` and `BUBBLEWRAP_KEY_PASSWORD` supplied through the
environment, the existing `twa/signing.keystore`, and the Bubblewrap JDK/SDK.
The script never creates a replacement signing key.

## Included behavior

- Native Google Play subscription purchase and restore, verified server-side.
- Immutable ownership and durable Google Play notification reconciliation.
- Authenticated Pub/Sub push identity and exact audience checks.
- Premium badge in the header, Pricing in the Android navigation menu.
- Stripe ownership checks and verified Stripe ledger records before combined
  entitlement refresh, so an expired Play subscription does not remove valid
  Stripe access.
- Next.js 15.5.27 security update with asynchronous server API adaptations.

## Validation and rollout

- [x] Production service-account credential and Play environment/authentication
  variable names verified present; credential contents never printed.
- [x] Production migration 022 applied; user reports SQL suite completed without
  errors (blank result). All three billing RPCs independently verified present.
- [x] Signed AAB built; merged manifest confirms target SDK and billing version.
- [x] Existing 216 application tests pass; three additional Stripe ledger tests pass.
- [x] Production build, lint and TypeScript checks pass after Stripe ledger change.
- [x] Runtime npm audit: zero vulnerabilities after patched PostCSS override.
  This is the runtime audit, not a claim about development dependencies.
- [x] Verify the legacy production Stripe customer: the signed-in live Stripe
  Dashboard shows no subscriptions, payments, invoices or active entitlements
  for `cus_Unh0dyr7u2Oijn`. The legacy profile has an active flag with a null
  expiry; this is not evidence of a paid Stripe subscription. No subscription
  backfill or profile change was made. The provider-verified backfill script
  remains available if actual subscriptions are identified later.
- [x] Release Preview `f8ad649` is Ready at
  `https://debate-master-gc9cjqxq6-joel-guzmans-projects-f8aa100e.vercel.app`.
  Signed-out desktop Pricing, annual toggle ($69.99 annually), mobile Pricing
  layout (390 × 844) and mobile sign-in page passed browser checks. Authenticated
  and native production-host purchase/restore checks remain in the Internal
  testing gate below.
- [x] PR #13 merged into main as `dd44106ee367c67bb119b1d58042d8da7856c5ed`.
  CI run 51 and Vercel Preview passed for SDK 24 commit `ed9480c`.
  Vercel production deployment `dpl_CUrVY5DNbKgyFrwjiYFMe6U9PFLc` is Ready,
  built from the exact merge commit. The registered Android host
  `debate-master-psi.vercel.app` independently maps to that deployment.
- [x] Final production endpoint checks: unsigned and invalid-bearer Google Play
  push requests both return HTTP 401; unsigned purchase verification returns
  HTTP 401; asset links serve the correct package and both signing fingerprints.
  The deployed production Pricing page renders successfully.
- [x] Created a separate authenticated production Pub/Sub push subscription on
  `projects/gen-lang-client-0426942212/topics/play-billing-notifications`.
  Endpoint and audience: `https://debate-master-psi.vercel.app/api/webhooks/google-play`.
  Push identity: `ais-gemini-key-b55185a80f0a48d@611102270579.iam.gserviceaccount.com`.
  Keep the existing staging subscription; keep wrapped message delivery.
  Subscription `play-billing-notifications-production` is active. Saved settings
  confirm the production endpoint, exact audience and service-account identity.
  Authentication is enabled, payload unwrapping disabled, exponential retry
  backoff is 10–600 seconds and there is no inactivity expiration.
- [x] Sent a Play Console test notification. Production Vercel logs confirm
  POST `/api/webhooks/google-play` returned HTTP 200 on the registered Android
  host at 2026-10-12T12:30:59.165Z (07:30:59 CDT), deployment
  `dpl_CUrVY5DNbKgyFrwjiYFMe6U9PFLc`. The handler logged
  `[Google Play RTDN] Received test notification from Google Play Console.`
  Unsigned and invalid-bearer requests previously returned HTTP 401.
  This verifies authenticated notification delivery, not a subscription renewal.
- [ ] Upload code 9 to Internal testing, verify production-host purchase/restore
  with a license tester, then approve the Production Play rollout.

Do not publish the AAB before the production application and notification path
are ready: the Android package opens the live production site.

Merged review: https://github.com/jolman009/debate-master/pull/13.
Release head: `ed9480ca3d1e45c9ba13963cdf91bc9517946a26`.
Production merge: `dd44106ee367c67bb119b1d58042d8da7856c5ed`.

Production endpoint checks and authenticated test notification delivery are complete.
Native purchase, restore and renewal validation on the production-host Internal
testing bundle remain the final release gate.
