# Google Play production release candidate 1.0.6

Prepared October 12, 2026 on `release/google-play-1.0.6`, based on main
`d3c444a`. This candidate includes billing fixes independently of the unfinished
Phase 1 learning rollout.

## Android artifact

- Package: `app.debatemaster.twa`; version 1.0.6, code 8.
- Production host: `https://debate-master-psi.vercel.app`, start path `/debate`.
- Target/compile SDK 36; minimum SDK 23; Play Billing 8.3.0.
- Signed using the existing upload key; `jarsigner -verify` passed.
- Local artifact: `twa/debate-master-production-v1.0.6-code8.aab` (ignored by Git).
- SHA-256: `bd9490bd5a2445083617d62b3c258444ae508972a222745d8a018951dcca603b`.

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
- [ ] Verify and backfill the existing production Stripe subscription from Stripe,
  using `scripts/backfill-stripe-entitlements.mjs` (dry run before `--apply`).
- [ ] Release branch Preview desktop/mobile smoke checks.
- [ ] Review and merge candidate, then verify the new production deployment.
- [ ] Create a separate authenticated production Pub/Sub push subscription on
  `projects/gen-lang-client-0426942212/topics/play-billing-notifications`.
  Endpoint and audience: `https://debate-master-psi.vercel.app/api/webhooks/google-play`.
  Push identity: `ais-gemini-key-b55185a80f0a48d@611102270579.iam.gserviceaccount.com`.
  Keep the existing staging subscription; keep wrapped message delivery.
  Enable this connection only after the new webhook is deployed.
- [ ] Send a Play Console test notification and verify authenticated HTTP 200;
  unauthenticated requests must return 401.
- [ ] Upload code 8 to Internal testing, verify production-host purchase/restore
  with a license tester, then approve the Production Play rollout.

Do not publish the AAB before the production application and notification path
are ready: the Android package opens the live production site.
