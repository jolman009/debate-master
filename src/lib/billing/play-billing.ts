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
  listPurchases(): Promise<
    Array<{
      itemId: string;
      purchaseToken: string;
      acknowledged: boolean;
      purchaseTime: number;
    }>
  >;
  acknowledge(purchaseToken: string, purchaseType: "repeatable" | "onetime"): Promise<void>;
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
  const response = await fetch("/api/billing/play/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku, purchaseToken }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return {
      success: false,
      error: body.error || "Subscription verification failed on the server. Please contact support.",
    };
  }

  return { success: true };
}

/** Reverify an existing Play subscription without opening another checkout. */
export async function restorePlaySubscription(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const service = await getPlayBillingService();
    if (!service) {
      return { success: false, error: "Open the Google Play app version of Debate Master to restore your purchase." };
    }

    const purchases = await service.listPurchases();
    const subscriptions = purchases.filter(
      (purchase) =>
        (purchase.itemId === PLAY_SKUS.monthly || purchase.itemId === PLAY_SKUS.yearly) &&
        purchase.purchaseToken
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
  } catch {
    return { success: false, error: "Unable to restore your Google Play purchase. Please try again." };
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
