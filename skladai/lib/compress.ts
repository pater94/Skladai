import imageCompression from "browser-image-compression";

export async function compressImage(file: File, maxDim: number = 1200): Promise<string> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: maxDim,
    maxSizeMB: 1.5,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.8,
    exifOrientation: undefined, // auto-fix EXIF rotation
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Cannot read compressed file"));
    reader.readAsDataURL(compressed);
  });
}

// Smaller compression for retry after timeout
export async function compressImageSmall(base64: string): Promise<string> {
  // Convert base64 to File for browser-image-compression
  const res = await fetch(base64);
  const blob = await res.blob();
  const file = new File([blob], "retry.jpg", { type: blob.type || "image/jpeg" });

  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 800,
    maxSizeMB: 0.5,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.7,
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Cannot read compressed file"));
    reader.readAsDataURL(compressed);
  });
}
