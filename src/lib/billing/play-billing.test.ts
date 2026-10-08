import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isDigitalGoodsSupported,
  getPlayProductDetails,
  purchasePlaySubscription,
  restorePlaySubscription,
  PLAY_SKUS,
} from "./play-billing";

describe("play-billing", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = {} as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete (globalThis as any).window;
  });

  it("detects when Digital Goods API is unsupported", () => {
    delete (globalThis.window as any).getDigitalGoodsService;
    expect(isDigitalGoodsSupported()).toBe(false);
  });

  it("detects when Digital Goods API is supported", () => {
    (globalThis.window as any).getDigitalGoodsService = vi.fn();
    expect(isDigitalGoodsSupported()).toBe(true);
  });

  it("fetches product details from DigitalGoodsService", async () => {
    const mockDetails = [
      {
        itemId: PLAY_SKUS.monthly,
        title: "Debate Master Premium Monthly",
        description: "Unlimited debates and neural voices",
        price: { currency: "USD", value: "9.99" },
      },
    ];

    const mockService = {
      getDetails: vi.fn().mockResolvedValue(mockDetails),
      listPurchases: vi.fn(),
      acknowledge: vi.fn(),
    };

    (globalThis.window as any).getDigitalGoodsService = vi.fn().mockResolvedValue(mockService);

    const details = await getPlayProductDetails([PLAY_SKUS.monthly]);
    expect(details).toEqual(mockDetails);
    expect(mockService.getDetails).toHaveBeenCalledWith([PLAY_SKUS.monthly]);
  });

  it("returns error if PaymentRequest is unavailable", async () => {
    delete (globalThis.window as any).PaymentRequest;
    const res = await purchasePlaySubscription(PLAY_SKUS.monthly);
    expect(res.success).toBe(false);
    expect(res.error).toContain("PaymentRequest API is not supported");
  });

  it("handles user cancellation gracefully (AbortError)", async () => {
    const abortError = new Error("User cancelled");
    abortError.name = "AbortError";

    (globalThis.window as any).PaymentRequest = vi.fn().mockImplementation(() => ({
      show: vi.fn().mockRejectedValue(abortError),
    }));

    const res = await purchasePlaySubscription(PLAY_SKUS.monthly);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Payment was cancelled.");
  });

  it("completes payment when backend verification succeeds", async () => {
    const mockComplete = vi.fn().mockResolvedValue(undefined);

    (globalThis.window as any).PaymentRequest = vi.fn().mockImplementation(() => ({
      show: vi.fn().mockResolvedValue({
        details: { purchaseToken: "test-token-123" },
        complete: mockComplete,
      }),
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as Response);

    const res = await purchasePlaySubscription(PLAY_SKUS.monthly);
    expect(res.success).toBe(true);
    expect(mockComplete).toHaveBeenCalledWith("success");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/billing/play/verify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          sku: PLAY_SKUS.monthly,
          purchaseToken: "test-token-123",
        }),
      })
    );
  });

  it("fails payment when backend verification fails", async () => {
    const mockComplete = vi.fn().mockResolvedValue(undefined);

    (globalThis.window as any).PaymentRequest = vi.fn().mockImplementation(() => ({
      show: vi.fn().mockResolvedValue({
        details: { purchaseToken: "invalid-token" },
        complete: mockComplete,
      }),
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "Invalid purchase token" }),
    } as unknown as Response);

    const res = await purchasePlaySubscription(PLAY_SKUS.monthly);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Invalid purchase token");
    expect(mockComplete).toHaveBeenCalledWith("fail");
  });

  it.each([PLAY_SKUS.monthly, PLAY_SKUS.yearly])(
    "restores an existing %s purchase through server verification without checkout",
    async (sku) => {
      const checkout = vi.fn();
      const listPurchases = vi.fn().mockResolvedValue([
        { itemId: sku, purchaseToken: "existing-purchase" },
      ]);
      (globalThis.window as any).PaymentRequest = checkout;
      (globalThis.window as any).getDigitalGoodsService = vi.fn().mockResolvedValue({ listPurchases });
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      expect(await restorePlaySubscription()).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/billing/play/verify",
        expect.objectContaining({ body: JSON.stringify({ sku, purchaseToken: "existing-purchase" }) })
      );
      expect(checkout).not.toHaveBeenCalled();
    }
  );

  it("does not grant Premium when an existing purchase cannot be verified", async () => {
    (globalThis.window as any).getDigitalGoodsService = vi.fn().mockResolvedValue({
      listPurchases: vi.fn().mockResolvedValue([
        { itemId: PLAY_SKUS.monthly, purchaseToken: "existing-purchase" },
      ]),
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "This purchase belongs to another account." }),
    });

    expect(await restorePlaySubscription()).toEqual({
      success: false,
      error: "This purchase belongs to another account.",
    });
  });

  it("ignores unrelated purchases and subscriptions without tokens", async () => {
    (globalThis.window as any).getDigitalGoodsService = vi.fn().mockResolvedValue({
      listPurchases: vi.fn().mockResolvedValue([
        { itemId: "unrelated-product", purchaseToken: "other-purchase" },
        { itemId: PLAY_SKUS.monthly, purchaseToken: "" },
      ]),
    });
    global.fetch = vi.fn();

    expect(await restorePlaySubscription()).toMatchObject({ success: false, error: expect.stringContaining("No current Premium purchase") });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reports restoration is unavailable outside the Play app", async () => {
    global.fetch = vi.fn();
    expect(await restorePlaySubscription()).toMatchObject({ success: false, error: expect.stringContaining("Open the Google Play app version") });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("handles a failed Play purchase lookup without starting checkout", async () => {
    const checkout = vi.fn();
    (globalThis.window as any).PaymentRequest = checkout;
    (globalThis.window as any).getDigitalGoodsService = vi.fn().mockResolvedValue({
      listPurchases: vi.fn().mockRejectedValue(new Error("Service unavailable")),
    });
    global.fetch = vi.fn();

    expect(await restorePlaySubscription()).toMatchObject({ success: false, error: expect.stringContaining("Unable to restore") });
    expect(checkout).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
