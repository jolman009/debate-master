# Google Play production replacement 1.0.7

Prepared October 13, 2026 to resolve the installed application's staging target.

## Evidence

- The phone reports version 1.0.6 with supported address
  `debate-master-git-staging-joel-guzmans-projects-f8aa100e.vercel.app`.
- A fresh launch/refresh at 03:44 CDT produced staging `/debate` and `/pricing`
  requests. The account's purchases and renewals were recorded in staging.
- The account `jolman009@gmail.com` showed Free and no prior debates on the
  production site; its production billing ledger had no Google Play subscription.
- The local 1.0.6 code 9 bundle has production compiled `hostName`, `launchUrl`,
  default URL metadata and HTTPS intent-filter references. Its SHA-256 remains
  `208c3e236a48d69230b0f3ed925e8d3c3351c40f7dce9f13ae216086ad405fbe`.
  The user identifies it as the file uploaded to Internal testing. A downloaded
  Play artifact and the installed phone package have not been compared, so the
  exact cause of their discrepancy remains unconfirmed.

## Replacement

- Version name 1.0.7; version code 10; package `app.debatemaster.twa`.
- Production supported domain `debate-master-psi.vercel.app`.
- Default launch URL `https://debate-master-psi.vercel.app/debate`.
- Minimum SDK 24; target/compile SDK 36; existing upload key.
- The build runs Gradle `clean bundleRelease --rerun-tasks`.
- `scripts/verify-production-twa.py` reads the AAPT2 protobuf manifest and
  resource table from the actual bundle, resolves launch and supported-domain
  references, and checks package, versions, SDKs and mixed deployment domains.
  Verification runs before and after signing.

## Internal testing gate

1. Upload only `twa/debate-master-production-v1.0.7-code10.aab` to Internal testing.
2. Confirm Play lists version code 10 before rolling out to Internal testers.
3. Install/update through Google Play as the opted-in license tester.
4. In Android App info, confirm version 1.0.7 and supported address
   `debate-master-psi.vercel.app` before purchasing.
5. Sign in as `jolman009@gmail.com`. Confirm its starting state matches production.
6. Use the always-approves test instrument, then verify the production ownership
   record, acknowledgement, Premium UI, two processed renewals, and eventual expiry.
7. Restore testing remains pending: the current Premium Pricing UI hides Restore.

This replacement is prepared for Internal testing. Production Play rollout
remains gated on native purchase, restore and renewal verification.

## Build result

Clean Gradle build and upload-key signature verification passed. Both pre-signing
and signed-bundle checks passed. A deliberately changed compiled domain was
rejected by the verifier.

Artifact SHA-256: `d73c7b530f3acc6b45e8ea118e82db4a4ecead086588e53843d0c34916b5caec`.

User-facing local artifact:
`/Users/joelguzman/Vibe-Code/debate_master/twa/debate-master-production-v1.0.7-code10.aab`.

## Superseded

Play's downloaded code 10 APK was later found to contain staging overrides for
49 languages, including English. See `GOOGLE_PLAY_PRODUCTION_1_0_8.md` for the
proven cause and translation-independent code 11 fix.
