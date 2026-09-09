# Shipping Debate Master on Google Play (Android TWA)

The app is packaged as a **Trusted Web Activity** — a thin Android shell that
runs the live PWA in Chrome, with no URL bar once domain ownership is verified.
There is no second codebase: the Play app *is* this site.

The code groundwork is done. What remains is a Play Console app + one
Bubblewrap run + two env vars.

---

## 💳 In-App Subscriptions & Play Billing

Debate Master integrates **Google Play Billing** for users on Android via the **W3C Digital Goods API** (`window.getDigitalGoodsService`), while retaining **Stripe** on the web.

### How it works:
1. **On the Web**: Users upgrade via Stripe Checkout at standard card processing rates.
2. **In the Play App (TWA)**: The app detects the Android TWA shell and uses the Digital Goods API to present native **"Subscribe with Google Play"** buttons. All Stripe checkout / steering links are hidden to comply with Google Play Policy.
3. **Unified Supabase Perks**: Both billing providers sync to the user's Supabase `profiles.subscription_status` (`active`) and period end date. A subscription purchased anywhere grants full Premium Pro benefits (ElevenLabs neural voices, 4D rubric coaching, unlimited debates) across all platforms.

---

## Setup & Release Workflow

### 1. Build the Billing-Enabled App Bundle (AAB)

Run the automated build script:

```bash
npm run build:twa
```

This compiles the Android project inside `twa/`, injecting:
- `<uses-permission android:name="com.android.vending.BILLING" />`
- `com.google.androidbrowserhelper:billing`
- Upload signing key (`twa/android.keystore`)

**Outputs:**
- **`twa/app-release-bundle.aab`**: The signed Android App Bundle to upload to Google Play Console.
- **`twa/app-release-signed.apk`**: Direct installable APK for local testing on a physical device or emulator.

> ⚠️ **Important:** Keep `twa/android.keystore` safe. It is excluded from git by default.

### 2. Upload to Google Play to Unlock Subscriptions

1. Open **Google Play Console** → Select your app (**Debate Master**).
2. Go to **Testing → Internal testing** (or Closed testing).
3. Click **Create new release** and upload `twa/app-release-bundle.aab`.
4. Save and roll out the release to internal testers.
5. **Result:** Because the AAB contains the `com.android.vending.BILLING` permission, Google Play Console will immediately unlock the **Monetize → Products → Subscriptions** section!

### 3. Create Subscription Products in Play Console

In Google Play Console → **Monetize with Play → Products → Subscriptions**:
1. Create product:
   - **Product ID**: `premium_monthly`
   - **Base Plan ID**: `monthly`
   - **Type**: Auto-renewing
   - **Price**: $9.99 / month (or equivalent in local currencies)
2. (Optional) Create annual product:
   - **Product ID**: `premium_yearly`
   - **Base Plan ID**: `annual`
   - **Price**: $69.99 / year (save 40%)

### 4. Configure Server Verification (Google Cloud Service Account)

To verify purchases and prevent fraudulent or refunded subscriptions from staying active:

1. In **Google Cloud Console** (for your Play Console project):
   - Go to **IAM & Admin → Service Accounts** → Create Service Account.
   - Grant role: **Google Play Developer Admin** or **Service Account User**.
   - Create and download a JSON key.
2. In **Google Play Console** → **Users and permissions** → Invite the service account email and grant permissions:
   - *View app information and download bulk reports*
   - *Manage orders and subscriptions*
3. In **Vercel** (or `.env.local`):
   - Set `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` to the full JSON string of the downloaded service account key (or set `GOOGLE_PLAY_CLIENT_EMAIL` and `GOOGLE_PLAY_PRIVATE_KEY`).

### 5. Set Real-Time Developer Notifications (RTDN via Pub/Sub)

1. In Google Cloud Console, create a Cloud Pub/Sub Topic: `play-subs-notifications`.
2. In Google Play Console → **Monetization setup** → Paste topic name: `projects/<your-gcp-project>/topics/play-subs-notifications`.
3. In Pub/Sub, create a **Push Subscription** targeting:
   `https://<your-domain>/api/webhooks/google-play`

### 6. Collect Certificate Fingerprints & Set Env Vars

Play Console → **Setup → App integrity** gives you two SHA-256 fingerprints:
- The **Play App Signing** certificate (assigned by Google upon first upload).
- Your **Upload** certificate (`70:32:20:E8:1B:35:0E:37:2A:1C:24:44:29:0D:F1:71:2C:2A:C6:D0:14:2D:DC:54:00:B0:75:06:93:E4:E5:DA`).

In **Vercel → Settings → Environment Variables**:

```
ANDROID_PACKAGE_NAME      = app.debatemaster.twa
ANDROID_CERT_FINGERPRINTS = <play-signing-sha256>,70:32:20:E8:1B:35:0E:37:2A:1C:24:44:29:0D:F1:71:2C:2A:C6:D0:14:2D:DC:54:00:B0:75:06:93:E4:E5:DA
```

Redeploy. Then verify asset links:

```bash
curl https://<your-domain>/.well-known/assetlinks.json
```

Expect a JSON array with your package name and both fingerprints. (It returns
**404 until the env vars are set** — deliberate: an empty statement list would
read as a *failed* verification rather than an absent one.)

Then install the app from the internal track. **No URL bar = verified.** A URL
bar means the asset-link check failed — re-check the domain, package name, and
fingerprints.

### 6. Store Listing & Metadata Copy

Play Console requires concise copy and visual assets:

- **App Name** (max 30 chars): `Debate Master: AI Rhetoric`
- **Short Description** (max 80 chars): `Sharpen your rhetoric and critical thinking in structured, turn-based AI debates.`
- **Full Description** (Markdown/text format):
  ```text
  Step into the intellectual arena with Debate Master. 

  Sharpen your critical thinking, argumentation, and public speaking skills against specialized AI personas in formal, turn-based debate sparring matches.

  KEY FEATURES:
  • Structured Match Formats: Progress through opening statements, direct rebuttals, cross-examination, and closing summaries.
  • Diverse AI Personas: Spar against distinct philosophical and rhetorical minds, from strict logicians to persuasive pragmatists.
  • Objective AI Rubric Scoring: Receive impartial, multi-dimensional feedback evaluating evidence, logic, clarity, and rebuttal effectiveness.
  • Custom Persona Studio: Design custom intellectual sparring partners with custom argumentative styles and philosophies.
  • Global Community Leaderboard: Climb the ranks and track your win rate, argument scores, and debating streaks.
  • Audio & Speech Mode: Engage via browser/neural voice readouts for authentic spoken delivery.

  Debate Master is free to download and use. Master the art of argument today.
  ```

- **Visual Assets**:
  - **App Icon**: `public/brand/app-icon-dark-1024.png` (1024x1024 PNG)
  - **Feature Graphic**: `public/brand/google-play-feature-graphic-1024x500.png` (1024x500 PNG)
- **Policy & Support Links**:
  - **Privacy Policy URL**: `https://<your-domain>/privacy`
  - **Account Deletion URL**: `https://<your-domain>/privacy#account-deletion` (Direct in-app route: `/profile`)
  - **Support / Feedback URL**: `https://<your-domain>/feedback`
  - **Categories**: Education, Productivity
  - **Content Rating**: Everyone / Teen (no unmoderated UGC, debate motion filtering)

---

## Notes & gotchas

- **Minimum functionality (policy 4.4):** Play rejects thin website wrappers.
  We're fine — offline support, standalone display, real app behaviour — but the
  listing should lead with the debate experience, not read like a bookmark.
- **`start_url` is `/debate`** so tapping the icon lands in the dashboard, not
  the marketing page. `scope` is `/` so invite links (`/debate/join/…`) and auth
  callbacks open *inside* the app instead of bouncing to a browser.
- **Custom domain:** a `*.vercel.app` subdomain works for asset links, but a
  branded domain reads better in the store and in the (brief) launch splash.
- **Original persona assets:** All built-in AI debaters use original intellectual archetypes and custom illustration assets (`consequentialist.png`, `logician.png`, etc.), ensuring full compliance with app store right-of-publicity and trademark guidelines.
- **Realtime/WebSockets, Supabase cookie auth, and browser TTS** all work in a
  TWA — it's Chrome. Nothing extra needed.
- **Testing the gating locally:**

  ```bash
  curl -s -H "Referer: android-app://app.debatemaster.twa" http://localhost:3000/ | grep -c "See Pricing"   # 0
  curl -s http://localhost:3000/ | grep -c "See Pricing"                                                     # 1
  ```

---

## Troubleshooting Bubblewrap

### `NGHTTP2_PROTOCOL_ERROR` at ~95% while "building the JDK17 binaries"

This is Bubblewrap's **bundled downloader** failing to fetch the JDK/Android
SDK — it is *not* about your app or the manifest. The usual trigger is a very
new Node.js (e.g. Node 24) whose HTTP/2 client the downloader wasn't tested
against; the stream dies near the end of the transfer.

**Fix: skip the download entirely by pointing Bubblewrap at tools you already
have.** JDK 17 (Microsoft OpenJDK / Temurin) and the Android SDK ship with
Android Studio. Note that a newer JDK (21) will NOT substitute — Bubblewrap
pins to **17**.

PowerShell (this is a Windows box — `rm -rf` is bash and will error with
"A parameter cannot be found that matches parameter name 'rf'"):

```powershell
# 1. Remove the corrupt partial download, or Bubblewrap reuses it and re-fails
Remove-Item -Recurse -Force "$env:USERPROFILE\.bubblewrap\jdk" -ErrorAction SilentlyContinue

# 2. Point Bubblewrap at existing tools (adjust versions to what's installed)
bubblewrap updateConfig --jdkPath "C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"
bubblewrap updateConfig --androidSdkPath "$env:LOCALAPPDATA\Android\Sdk"

# 3. Confirm
bubblewrap doctor
```

Find installed JDKs under `C:\Program Files\Microsoft\` or
`C:\Program Files\Eclipse Adoptium\`; the Android Studio SDK lives at
`%LOCALAPPDATA%\Android\Sdk` (must contain `cmdline-tools`, `platform-tools`,
`platforms`, `build-tools`, and `licenses`).

If JDK 17 isn't present: `winget install Microsoft.OpenJDK.17`.

### Fallbacks if you don't have the local toolchain

- **Run Bubblewrap under Node 20** (`nvm`/`fnm`), which its downloader supports.
  Your app's own dev/build can stay on any Node — this only needs to hold for
  the packaging run.
- **[pwabuilder.com](https://www.pwabuilder.com)** → paste the URL →
  *Package for stores* → Android. Runs Bubblewrap server-side and returns a
  signed `.aab` + keystore + assetlinks values. Save the keystore; it gives the
  **upload** cert fingerprint only — you still need Play's **App Signing**
  fingerprint after the first upload (both go in `ANDROID_CERT_FINGERPRINTS`).
