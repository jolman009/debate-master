# Google Play production release 1.0.8 — validation complete

Verified October 13, 2026 with license tester `jolman009@gmail.com` on the
Google Play Internal testing track. Native Google Play billing validation is
complete. Production Play rollout has not been performed by this agent.

## Release artifact

- Package: `app.debatemaster.twa`; version 1.0.8, code 11.
- Supported domain: `debate-master-psi.vercel.app`.
- Launch URL: `https://debate-master-psi.vercel.app/debate`.
- Minimum SDK 24; target/compile SDK 36; existing upload signing key.
- Signed AAB: `twa/debate-master-production-v1.0.8-code11.aab`.
- AAB SHA-256: `3ace3d44c2ff750cc1c3d781d67124969fa65196913c67478267dc61976b9a80`.
- Downloaded Play APK: `/Users/joelguzman/Downloads/11.apk`.
- Play APK SHA-256: `078b0779f5411afb89090397552c844c6ec4767d072f5cdf711aa08789d32e5e`.
- Play app signing certificate SHA-256:
  `AFC53FC8B9D4DD9659A3B9F77E645E43C2A065629750A7EE6BF7C16481D949B2`.

## Proven cause and resulting fix

Play's downloaded code 10 APK contained staging overrides for 49 language
configurations, including English and Spanish. Default resources pointed to
production, but localized `hostName`, `launchUrl`, `assetStatements`,
`webManifestUrl` and `fullScopeUrl` pointed to staging. This caused updated
phone installations to open staging, show staged debates, and record test
purchases there. Supabase table-count differences were unrelated.

Code 10 APK SHA-256:
`4e29ffe28428413f05c8c77d8bd6fcd9e8abcf7d744b98011c896566fc96268d`.

Code 11 uses literal manifest values for the launch URL, supported HTTPS domain,
manage-space URL and web manifest URL. Technical resources have fresh
`dmProduction*` names; the asset-link statement is non-translatable. Routing
therefore remains independent of language-specific resource overrides.

The build runs Gradle `clean bundleRelease --rerun-tasks` and checks compiled
routing before and after signing. `scripts/verify-production-twa.py` checks
AAB manifest/resource references; `scripts/verify-play-apk.py` checks the APK
Google Play generates after enhancements. The latter rejects the faulty code
10 APK and passes both the local code 11 APK and Google's signed code 11 APK.
Google's code 11 APK has literal production routing and no staging domains in
any resource configuration; signature verification passes.

## Application deployment

Main commit `bfa2a52aa1689bec1c74ef32fa1deb96df3389bc` includes the Android
routing fix and exposes the existing Restore handler to active Premium members
in the Android Pricing view when Google Play billing is available. The
production build, lint and type checks pass, together with all 23 existing
purchase/restore tests.

Production deployment `dpl_A9FpCwKwVFCN6BPLouT8kR6vFrL4` is Ready and serves
`debate-master-psi.vercel.app`. Public Pricing returns HTTP 200, its deployed
bundle includes the Premium Restore control, and unsigned Google Play webhook
requests continue to return HTTP 401.

## Completed Internal testing checks

- [x] Phone reports version 1.0.8 and the production supported address.
- [x] Production sign-in initially shows Free Starter without staged debate history.
- [x] License-test monthly checkout grants Premium in the header and Pricing.
- [x] Production ownership record uses `premium_monthly`, environment `live`,
  active status and acknowledgement at 04:42:52 CDT. Purchase verification
  returned HTTP 200 at 04:42:51 CDT.
- [x] Six renewal events (`subscription_notification:2`) processed successfully:
  04:47:48, 04:52:48, 04:57:48, 05:02:48, 05:07:48 and 05:12:48 CDT.
  The first three were independently matched to HTTP 200 production webhook logs.
  Renewals advanced the current entitlement period; Premium persisted
  after the user reopened and refreshed the phone app.
- [x] Native Restore returned HTTP 200 at 05:07:07 CDT and Premium remained visible.
- [x] Final test period ended at 05:17:43 CDT. Cancellation notification processed
  at 05:17:45 and expiration notification at 05:17:46 CDT. Production subscription
  and profile became canceled, and the profile period end was cleared.
- [x] After expiry, the user refreshed and confirmed Free Starter and removal of
  the Premium header badge.

No purchase tokens, credentials or card information are recorded here. These
results verify the license-test lifecycle on production infrastructure; they do
not represent an actual charged subscription purchase.

## Remaining release action

- [ ] Approve and promote the existing 1.0.8 code 11 release to the Production
  track in Google Play Console, choosing the rollout scope there.

Use the already-tested code 11 AAB. Code 9 and code 10 are superseded. The
production web application, notification delivery and billing lifecycle checks
required for this release are complete. Unfinished Phase 1 learning features
remain outside this focused release.
