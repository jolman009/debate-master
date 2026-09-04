# Shipping Debate Master on Google Play (Android TWA)

The app is packaged as a **Trusted Web Activity** — a thin Android shell that
runs the live PWA in Chrome, with no URL bar once domain ownership is verified.
There is no second codebase: the Play app *is* this site.

The code groundwork is done. What remains is a Play Console app + one
Bubblewrap run + two env vars.

---

## ⚠️ Read first: Play billing policy

Google Play requires apps distributed on Play to sell in-app digital goods
through **Play Billing**, and forbids steering users to an outside payment
method. Debate Master sells Premium via **Stripe**.

**Our posture: the Play app is free-to-use and sells nothing.** Every purchase
and steering surface is hidden when running inside the TWA:

| Surface | On the web | In the Play app |
|---|---|---|
| Header "Pricing" nav | shown | hidden |
| Landing "See Pricing" / "View plans" | shown | hidden |
| `/pricing` upgrade + billing-portal buttons | shown | hidden (info only) |
| Setup wizard "View plans →" (free cap hit) | shown | hidden |
| Premium perks for existing subscribers | work | **work** |

Honouring a subscription bought on the web is allowed; *selling* or *pointing
at the web checkout* is not. That's the line this implementation walks.

**Verify current policy before you publish.** This area (anti-steering,
user-choice billing, the Epic v. Google remedies) has been in flux. If you later
want to sell inside the app, the path is the Digital Goods API + Play Billing —
effectively a second billing integration alongside Stripe (Play Console
products, purchase flow, and Real-Time Developer Notifications → webhook →
`profiles.subscription_status`), plus Google's cut.

### How detection works

Only a Play-installed TWA supplies an `android-app://` referrer on launch.

1. `middleware.ts` reads the launch `Referer`, and latches `dm_twa=1` onto **the
   request** (so the first paint is already correct) and onto the response (so
   later navigations stay correct).
2. Server components call `isTwa()` (`src/lib/platform/twa-server.ts`).
3. `TwaDetect` (root layout) is a client backstop that sets the cookie from
   `document.referrer` if the header was ever missing.

**Do not gate on `display-mode: standalone`.** An installed PWA on the open web
is standalone too, but is *not* distributed through Play and *must* keep its
upgrade path — gating on it would silently cost real revenue.

---

## Setup

### 1. Create the Play app
Play Console → **Create app**. Note the package name you intend to use, e.g.
`app.debatemaster.twa` (immutable once published — choose carefully).

### 2. Generate + build the TWA

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://<your-domain>/manifest.webmanifest
# accept the defaults; set the package name to match step 1
bubblewrap build          # produces app-release-bundle.aab + signing key
```

Bubblewrap reads `start_url`, `scope`, icons, and colours straight from
`src/app/manifest.ts` — no duplication.

> Keep the generated keystore + password safe and out of git. Losing the upload
> key is recoverable via Play support; losing it *and* not using Play App
> Signing is not.

### 3. Upload + collect fingerprints
Upload the `.aab` to an internal testing track. Then Play Console → **Setup →
App integrity** gives you two SHA-256 fingerprints:

- the **Play App Signing** certificate (what real users get — Google re-signs), and
- your **upload** certificate (what you build locally).

### 4. Set the env vars (Vercel → Settings → Environment Variables)

```
ANDROID_PACKAGE_NAME      = app.debatemaster.twa
ANDROID_CERT_FINGERPRINTS = <play-signing-sha256>,<upload-sha256>
```

Redeploy. **List both fingerprints** — shipping only one is the classic reason
verification passes in local testing and fails in production (or vice versa).

### 5. Verify the asset links

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
