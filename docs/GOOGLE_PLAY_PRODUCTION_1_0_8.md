# Google Play production routing fix 1.0.8

## Proven cause

The Google Play signed universal APK `/Users/joelguzman/Downloads/10.apk`
is package `app.debatemaster.twa`, version 1.0.7, code 10. Its default resource
values point to production, but 49 language configurations, including `en`
and `es`, override `hostName` with the staging domain. Localized `launchUrl`,
`assetStatements`, `webManifestUrl` and `fullScopeUrl` also contain staging values.
This explains the phone's staging supported address, prior debates and billing
records despite the updated version. Supabase table-count differences are unrelated.

APK SHA-256: `4e29ffe28428413f05c8c77d8bd6fcd9e8abcf7d744b98011c896566fc96268d`.

The uploaded local AAB has no staging resources. The localized overrides are
present in Play's downloaded APK. Play's automatic app-string translations can
inject resources after upload; inspect its stored technical-string translations
as part of the release gate.

## Fix

- Version 1.0.8, code 11; existing upload key and package.
- Default launch URL, manage-space URL, web manifest URL and HTTPS supported
  domain are literal Android manifest values, independent of localized resources.
- Technical resource names are replaced with fresh `dmProduction*` names.
- The asset-link statement is renamed and marked `translatable="false"`.
- The build verifies literal routing plus all resource configurations before
  and after signing. `scripts/verify-play-apk.py` additionally checks Play's
  generated APK after translation/protection enhancements, before phone testing.

## Release gate

1. In Play Console, review automatic App strings translations. Exclude technical
   strings such as URLs, hostnames and asset-link statements from translation.
2. Upload `debate-master-production-v1.0.8-code11.aab` to Internal testing.
3. Download Play's signed universal APK for code 11 and run:
   `python3 scripts/verify-play-apk.py /path/to/11.apk twa/twa-manifest.json`.
4. Once it passes, install/update through Play. Confirm version 1.0.8 and
   supported address `debate-master-psi.vercel.app`.
5. Complete production account purchase/restore, two processed renewals, and
   eventual expiration checks before Production Play rollout.

Code 10's clean local build passed, but its Play-generated APK fails the new
APK verifier because translated overrides route to staging. No production
purchase or renewal success is claimed from that build.

## Build verification

The clean code 11 build, existing upload-key signing, and compiled pre/post-signing
checks passed. SHA-256:
`3ace3d44c2ff750cc1c3d781d67124969fa65196913c67478267dc61976b9a80`.

The signed AAB is available in the shared project `twa` directory. Play-generated
code 11 APK inspection and native production purchase/renewal tests remain pending.

The local release APK also passed `verify-play-apk.py`; the downloaded Play code
10 APK was rejected specifically for localized launch URL overrides.

## Play-generated code 11 APK verified — October 13, 2026

The downloaded `/Users/joelguzman/Downloads/11.apk` passes the APK verifier:
package `app.debatemaster.twa`, version 1.0.8, code 11, literal production
launch URL and supported domain, and no staging domains in any resource
configuration. `apksigner verify --print-certs` passes; its Google Play app
signing certificate SHA-256 is
`AFC53FC8B9D4DD9659A3B9F77E645E43C2A065629750A7EE6BF7C16481D949B2`.

APK SHA-256: `078b0779f5411afb89090397552c844c6ec4767d072f5cdf711aa08789d32e5e`.

The post-Play artifact gate is complete. Phone installation, production billing
ownership, restore, renewals and expiration verification remain pending.

## Native production purchase verified — October 13, 2026

The user confirms installed version 1.0.8, supported production address and
Free Starter before checkout. The license-test monthly purchase for
`jolman009@gmail.com` returned HTTP 200 from production verification at
04:42:51 CDT. Production `billing_subscriptions` records `premium_monthly`,
provider environment `live`, active status and acknowledgement at 04:42:52 CDT.
The profile is active and its initial period end is 04:47:42 CDT. The user
confirms Premium in both header and Pricing.

At 04:44 CDT there were no renewal events yet, as expected before the first
renewal. Two processed renewals, UI persistence, Restore and expiration
remain pending. No purchase tokens or credentials are included in this record.

## Production renewal validation — October 13, 2026

At 04:59 CDT, the production monthly subscription had three processed
`subscription_notification:2` events, at 04:47:48, 04:52:48 and 04:57:48 CDT.
Each event was processed on its first attempt. Vercel recorded HTTP 200 for
all three production webhook requests. The subscription and profile remained
active, with the current period end advanced from 04:47:42 to 05:02:42 CDT.
The user refreshed the phone app and confirmed Premium remained visible.

Purchase, acknowledgement, three automatic renewals and UI persistence pass.
Restore and eventual expiration remain pending. The Premium Pricing UI is being
updated to expose the existing Restore handler while the subscription is active.
