"use client";

const TARGET_BYTES = 700 * 1024;

/**
 * Shrink a photo in the browser before upload. Photos are stored in the
 * database, where one record holds at most 1 MB, so this steps the size and
 * quality down until the JPEG fits comfortably.
 */
export async function resizeImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return file;
    let best: Blob | null = null;
    for (const [maxSide, quality] of [[1400, 0.84], [1200, 0.8], [1000, 0.76], [800, 0.72], [640, 0.68]] as const) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      // JPEG has no transparency: paint white behind transparent PNGs.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      best = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (best && best.size <= TARGET_BYTES) break;
    }
    bitmap.close();
    if (!best) return file;
    return new File([best], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // The browser could not decode it: let the server decide.
    return file;
  }
}
