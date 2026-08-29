import { describe, it, expect } from "vitest";
import { compressAvatarImage } from "./image";

describe("compressAvatarImage", () => {
  it("rejects non-image files", async () => {
    const file = new File(["dummy text"], "test.txt", { type: "text/plain" });
    await expect(compressAvatarImage(file)).rejects.toThrow(
      "Please select an image file (JPEG, PNG, WebP, etc.)."
    );
  });

  it("rejects oversized images (>10MB)", async () => {
    const largeBlob = new Uint8Array(11 * 1024 * 1024);
    const file = new File([largeBlob], "huge.png", { type: "image/png" });
    await expect(compressAvatarImage(file)).rejects.toThrow(
      "Image file must be under 10MB."
    );
  });
});
