// CLIENT-SIDE: Google Play Billing integration via the W3C Digital Goods API
// and the Payment Request API for Android Trusted Web Activities (TWA).

export const PLAY_SKUS = {
  monthly: "premium_monthly",
  yearly: "premium_yearly",
} as const;

export type PlaySkuInterval = keyof typeof PLAY_SKUS;

export interface PlayItemDetails {
  itemId: string;
  title: string;
  description: string;
  price: {
    currency: string;
    value: string;
  };
  subscriptionPeriod?: string;
  freeTrialPeriod?: string;
}

export interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<PlayItemDetails[]>;
  listPurchases(): Promise<Array<{ itemId: string; purchaseToken: string }>>;
}

declare global {
  interface Window {
    getDigitalGoodsService?: (serviceProvider: string) => Promise<DigitalGoodsService>;
  }
}

/**
 * Returns true if the W3C Digital Goods API is available in the current browser/TWA.
 */
export function isDigitalGoodsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.getDigitalGoodsService === "function"
  );
}

/**
 * Connects to the Google Play Billing service inside the TWA.
 */
export async function getPlayBillingService(): Promise<DigitalGoodsService | null> {
  if (!isDigitalGoodsSupported() || !window.getDigitalGoodsService) {
    return null;
  }
  try {
    return await window.getDigitalGoodsService("https://play.google.com/billing");
  } catch (err) {
    console.warn("DigitalGoodsService ('https://play.google.com/billing') unavailable:", err);
    return null;
  }
}

/**
 * Fetches item details (live prices, currency, title) directly from the Google Play Store.
 */
export async function getPlayProductDetails(
  itemIds: string[] = [PLAY_SKUS.monthly, PLAY_SKUS.yearly]
): Promise<PlayItemDetails[]> {
  const service = await getPlayBillingService();
  if (!service) return [];
  try {
    return await service.getDetails(itemIds);
  } catch (err) {
    console.error("Failed to query Play product details:", err);
    return [];
  }
}

async function verifyPlayPurchase(
  sku: string,
  purchaseToken: string
): Promise<{ success: boolean; error?: string }> {
  let response: Response;
  try {
    response = await fetch("/api/billing/play/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, purchaseToken }),
    });
  } catch {
    return {
      success: false,
      error: "Could not reach the subscription verification server. Check your connection and try Restore again.",
    };
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      success: false,
      error: typeof body?.error === "string" ? body.error : `Subscription verification failed on the server (HTTP ${response.status}). Please contact support.`,
    };
  }

  if (body?.success !== true || body?.active !== true) {
    return {
      success: false,
      error: "The verification server did not confirm an active subscription. Reopen the app, sign in, and try Restore again.",
    };
  }
  return { success: true };
}

function playLookupError(error: unknown, stage: "connection" | "purchase lookup"): string {
  // Browser/Play errors can contain arbitrary text. Only show known codes;
  // never put a purchase token or provider payload into the support message.
  const knownCodes = ["error", "clientAppUnavailable", "clientAppError", "itemUnavailable", "itemNotOwned", "unsupported context", "unsupported payment method"];
  const knownNames = ["OperationError", "NotAllowedError", "InvalidStateError", "NotSupportedError", "TypeError", "AbortError"];
  const candidate = error as { name?: unknown; message?: unknown } | null;
  const code = typeof candidate?.message === "string" && knownCodes.includes(candidate.message)
    ? candidate.message
    : typeof candidate?.name === "string" && knownNames.includes(candidate.name)
      ? candidate.name
      : "unknown";
  return `Google Play ${stage} failed (${code}). Update Chrome and Google Play, then close and reopen the Play-installed Debate Master app and try Restore again.`;
}

/** Reverify an existing Play subscription without opening another checkout. */
export async function restorePlaySubscription(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isDigitalGoodsSupported() || !window.getDigitalGoodsService) {
    return { success: false, error: "Open the Google Play app version of Debate Master to restore your purchase." };
  }

  let stage: "connection" | "purchase lookup" = "connection";
  try {
    const service = await window.getDigitalGoodsService("https://play.google.com/billing");

    stage = "purchase lookup";
    const purchases = await service.listPurchases();
    if (!Array.isArray(purchases)) {
      return { success: false, error: "Google Play returned an invalid purchase list. Update Chrome and Google Play, then reopen the app and try Restore again." };
    }
    const subscriptions = purchases.filter(
      (purchase) =>
        purchase &&
        (purchase.itemId === PLAY_SKUS.monthly || purchase.itemId === PLAY_SKUS.yearly) &&
        typeof purchase.purchaseToken === "string" && purchase.purchaseToken.length > 0
    );
    if (!subscriptions.length) {
      return {
        success: false,
        error: "No current Premium purchase was found. Check that Google Play is using the account that made the purchase.",
      };
    }

    let result: { success: boolean; error?: string } = { success: false };
    for (const purchase of subscriptions) {
      result = await verifyPlayPurchase(purchase.itemId, purchase.purchaseToken);
      if (result.success) return result;
    }
    return result;
  } catch (error) {
    return { success: false, error: playLookupError(error, stage) };
  }
}

/**
 * Initiates the native Google Play purchase flow using the Payment Request API.
 * Upon receiving the purchaseToken, it sends it to the backend verification endpoint
 * before completing the payment sheet.
 */
export async function purchasePlaySubscription(sku: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (typeof window === "undefined" || !("PaymentRequest" in window)) {
    return {
      success: false,
      error: "PaymentRequest API is not supported on this device.",
    };
  }

  const paymentMethodData: PaymentMethodData[] = [
    {
      supportedMethods: "https://play.google.com/billing",
      data: { sku },
    },
  ];

  try {
    const PaymentReq = window.PaymentRequest;
    const request = new PaymentReq(paymentMethodData, {
      total: { label: "Total", amount: { currency: "USD", value: "0" } },
    });
    const paymentResponse = await request.show();

    const details = paymentResponse.details as {
      purchaseToken?: string;
      [key: string]: unknown;
    };

    const purchaseToken = details?.purchaseToken;

    if (!purchaseToken) {
      await paymentResponse.complete("fail");
      return {
        success: false,
        error: "No purchase token returned by Google Play.",
      };
    }

    // Verify token with backend
    const verification = await verifyPlayPurchase(sku, purchaseToken);
    if (!verification.success) {
      await paymentResponse.complete("fail");
      return verification;
    }

    await paymentResponse.complete("success");
    return { success: true };
  } catch (err: unknown) {
    const error = err as Error;
    // AbortError indicates user dismissed the payment sheet
    if (error.name === "AbortError") {
      return { success: false, error: "Payment was cancelled." };
    }
    return {
      success: false,
      error: error.message || "An unexpected error occurred during Google Play checkout.",
    };
  }
}
