// Digital Asset Links for the Android TWA.
//
// Served at /.well-known/assetlinks.json via a rewrite (see next.config.mjs).
// Chrome fetches this to verify that this domain and the Android app are the
// same publisher. Without a passing check the TWA still runs, but shows a
// browser URL bar — which looks broken and fails Play review expectations.
//
// Driven by env vars so the fingerprint can be set in Vercel once the Play app
// exists, with no code change:
//   ANDROID_PACKAGE_NAME       e.g. app.debatemaster.twa
//   ANDROID_CERT_FINGERPRINTS  comma-separated SHA-256 fingerprints
//
// NOTE: list BOTH fingerprints — the Play App Signing certificate (Play
// Console → Setup → App integrity) and your local upload/debug certificate.
// Play re-signs your bundle, so the cert users actually get is Google's; the
// upload cert is what you test with locally. Shipping only one is the usual
// reason verification passes in testing and fails in production (or vice versa).
//
// These values are public by design (they're published for anyone to fetch) —
// they are not secrets.

export const dynamic = "force-dynamic";

interface AssetLink {
  relation: string[];
  target: {
    namespace: string;
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

export async function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
  const fingerprints = (process.env.ANDROID_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  // Not configured yet: behave as if the file doesn't exist, rather than
  // publishing an empty statement list that Chrome would treat as a failure.
  if (!packageName || fingerprints.length === 0) {
    return new Response("Not configured", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const statements: AssetLink[] = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return new Response(JSON.stringify(statements, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
