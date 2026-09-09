import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isDigitalGoodsSupported,
  getPlayProductDetails,
  purchasePlaySubscription,
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
});
