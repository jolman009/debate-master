// SERVER-ONLY: Google Play Developer API verification and token acknowledgment.
// Uses Google Cloud Service Account with standard RS256 JWT assertion.

import crypto from "crypto";
import { reportError } from "@/lib/observability";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  token: string;
  expiresAt: number; // Unix timestamp ms
}

let cachedAccessToken: CachedToken | null = null;

function getServiceAccount(): ServiceAccountCredentials | null {
  const rawKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;
  if (rawKey) {
    try {
      const parsed = JSON.parse(rawKey);
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key,
        };
      }
    } catch {
      console.warn("Invalid JSON in GOOGLE_PLAY_SERVICE_ACCOUNT_KEY");
    }
  }

  const client_email = process.env.GOOGLE_PLAY_CLIENT_EMAIL;
  let private_key = process.env.GOOGLE_PLAY_PRIVATE_KEY;

  if (client_email && private_key) {
    // Replace escaped newlines if passed in env
    private_key = private_key.replace(/\\n/g, "\n");
    return { client_email, private_key };
  }

  return null;
}

export function isGooglePlayConfigured(): boolean {
  return getServiceAccount() !== null;
}

/**
 * Exchanges a signed JWT assertion for a Google OAuth2 access token
 * with scope 'https://www.googleapis.com/auth/androidpublisher'.
 */
export async function getGooglePlayAccessToken(): Promise<string | null> {
  const creds = getServiceAccount();
  if (!creds) return null;

  const now = Math.floor(Date.now() / 1000);

  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60000) {
    return cachedAccessToken.token;
  }

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const base64Url = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const encodedHeader = base64Url(header);
  const encodedPayload = base64Url(payload);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  const signature = signer
    .sign(creds.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const assertion = `${unsignedToken}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    reportError(new Error(`Failed to obtain Google access token: ${text}`), {
      route: "google-play-server",
    });
    return null;
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

export interface VerifySubscriptionResult {
  valid: boolean;
  active: boolean;
  periodEnd: string | null;
  orderId?: string;
  error?: string;
}

/**
 * Validates and acknowledges a subscription purchase token with the Google Play Developer API.
 */
export async function verifyAndAcknowledgePlaySubscription(input: {
  subscriptionId: string;
  purchaseToken: string;
  packageName?: string;
}): Promise<VerifySubscriptionResult> {
  const packageName =
    input.packageName ||
    process.env.ANDROID_PACKAGE_NAME ||
    "app.debatemaster.twa";

  const token = await getGooglePlayAccessToken();
  if (!token) {
    return {
      valid: false,
      active: false,
      periodEnd: null,
      error: "Google Play API credentials are not configured.",
    };
  }

  // 1. Fetch subscription details via Google Play Android Publisher API
  const getUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${input.subscriptionId}/tokens/${input.purchaseToken}`;

  const res = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    return {
      valid: false,
      active: false,
      periodEnd: null,
      error: `Google Play token verification failed (${res.status}): ${errText}`,
    };
  }

  const sub = (await res.json()) as {
    expiryTimeMillis?: string;
    startTimeMillis?: string;
    paymentState?: number;
    acknowledgementState?: number; // 0 = unacknowledged, 1 = acknowledged
    orderId?: string;
    cancelReason?: number;
  };

  const expiryMs = sub.expiryTimeMillis ? parseInt(sub.expiryTimeMillis, 10) : 0;
  const nowMs = Date.now();
  const isActive = expiryMs > nowMs && (sub.paymentState === 1 || sub.paymentState === 2);
  const periodEndIso = expiryMs > 0 ? new Date(expiryMs).toISOString() : null;

  // 2. Acknowledge the subscription if not yet acknowledged
  if (sub.acknowledgementState === 0) {
    const ackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${input.subscriptionId}/tokens/${input.purchaseToken}:acknowledge`;
    const ackRes = await fetch(ackUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ developerPayload: "debatemaster_ack" }),
    });

    if (!ackRes.ok) {
      console.warn("Failed to acknowledge subscription:", await ackRes.text());
    }
  }

  return {
    valid: true,
    active: isActive,
    periodEnd: periodEndIso,
    orderId: sub.orderId,
  };
}
