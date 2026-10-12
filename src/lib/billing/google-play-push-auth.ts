import { OAuth2Client } from "google-auth-library";

const verifier = new OAuth2Client();

/** Authenticate Google's Pub/Sub push identity before reading purchase data. */
export async function authenticateGooglePlayPush(req: Request): Promise<Response | null> {
  const audience = process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE;
  const email = process.env.GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT;
  if (!audience || !email) {
    return new Response("Push authentication is not configured", { status: 503 });
  }

  const bearer = req.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i);
  if (!bearer) return new Response("Unauthorized", { status: 401 });

  try {
    // The Google library validates the signature, issuer, expiry, and audience.
    const ticket = await verifier.verifyIdToken({ idToken: bearer[1], audience });
    const claims = ticket.getPayload();
    if (claims?.email !== email || claims.email_verified !== true) {
      return new Response("Unauthorized", { status: 401 });
    }
    return null;
  } catch {
    // Never expose or log the bearer token or the provider's error payload.
    return new Response("Unauthorized", { status: 401 });
  }
}
