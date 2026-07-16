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

### 6. Store listing
Needs: privacy policy URL, content rating questionnaire, Data Safety form
(declare: account/email via Supabase auth, user-generated debate content;
payments happen on the web, not in-app), screenshots, feature graphic.

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
- **Persona filenames** use real people's names (`ben-shapiro.png`). App stores
  have a formal IP-complaint process; worth renaming before a public launch.
- **Realtime/WebSockets, Supabase cookie auth, and browser TTS** all work in a
  TWA — it's Chrome. Nothing extra needed.
- **Testing the gating locally:**

  ```bash
  curl -s -H "Referer: android-app://app.debatemaster.twa" http://localhost:3000/ | grep -c "See Pricing"   # 0
  curl -s http://localhost:3000/ | grep -c "See Pricing"                                                     # 1
  ```
