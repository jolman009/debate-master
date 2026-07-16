// Trusted Web Activity (Android / Play Store) detection.
//
// WHY THIS EXISTS: Google Play's payments policy requires apps distributed on
// Play to sell in-app digital goods through Play Billing, and forbids steering
// users to an outside payment method. Debate Master sells Premium via Stripe,
// so every purchase/steering surface is hidden while running inside the TWA
// shell. The app ships on Play as free-to-use; people who subscribed on the
// web still get their Premium perks here (that's allowed — what isn't allowed
// is selling or pointing at the web checkout).
//
// CRITICAL DISTINCTION: a TWA is not the same as an "installed PWA". An
// installed PWA on the open web (display-mode: standalone) is NOT distributed
// through Play and is NOT subject to its policy. Gating on display-mode would
// hide the upgrade path from ordinary web users and cost real revenue. The
// ONLY signal we trust is the android-app:// referrer that a Play-installed
// TWA shell supplies when it launches the site.

export const TWA_COOKIE = "dm_twa";
export const TWA_REFERRER_PREFIX = "android-app://";

/**
 * True when a referrer identifies an Android app shell (i.e. our TWA launched
 * this navigation). Works for both the `Referer` header (server/middleware)
 * and `document.referrer` (client).
 */
export function isTwaReferrer(referrer: string | null | undefined): boolean {
  if (!referrer) return false;
  return referrer.trim().toLowerCase().startsWith(TWA_REFERRER_PREFIX);
}
