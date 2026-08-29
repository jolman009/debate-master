/**
 * Resizes and compresses an image file to a compact base64 data URL suitable for avatars.
 */
export async function compressAvatarImage(
  file: File,
  maxDimension = 160,
  quality = 0.8
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file (JPEG, PNG, WebP, etc.).");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image file must be under 10MB.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Failed to process image data."));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const width = img.width;
          const height = img.height;

          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = (height - minDim) / 2;

          const targetSize = Math.min(maxDimension, minDim);
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return reject(new Error("Failed to create canvas context."));
          }

          ctx.drawImage(
            img,
            startX,
            startY,
            minDim,
            minDim,
            0,
            0,
            targetSize,
            targetSize
          );

          let dataUrl = canvas.toDataURL("image/webp", quality);
          if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
