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
- [ ] Review and merge candidate, then verify the new production deployment.
- [ ] Create a separate authenticated production Pub/Sub push subscription on
  `projects/gen-lang-client-0426942212/topics/play-billing-notifications`.
  Endpoint and audience: `https://debate-master-psi.vercel.app/api/webhooks/google-play`.
  Push identity: `ais-gemini-key-b55185a80f0a48d@611102270579.iam.gserviceaccount.com`.
  Keep the existing staging subscription; keep wrapped message delivery.
  Enable this connection only after the new webhook is deployed.
- [ ] Send a Play Console test notification and verify authenticated HTTP 200;
  unauthenticated requests must return 401.
- [ ] Upload code 9 to Internal testing, verify production-host purchase/restore
  with a license tester, then approve the Production Play rollout.

Do not publish the AAB before the production application and notification path
are ready: the Android package opens the live production site.

Draft review: https://github.com/jolman009/debate-master/pull/13.
Candidate commit: `f8ad649b888340d3563a787d95c014a3e6cd6c6f`.

The final unauthenticated Preview webhook and production asset-links HTTP
checks were not executed because automatic approval review reached its usage
limit. This was a review availability failure, not a finding that the checks
were unsafe. Resume these checks before closing the deployment gate.
