import imageCompression from "browser-image-compression";

export async function compressImage(file: File, maxDim: number = 1200): Promise<string> {
  try {
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: maxDim,
      maxSizeMB: 1.5,
      useWebWorker: typeof window !== "undefined" && !!window.Worker,
      initialQuality: 0.8,
    });

    return await fileToDataURL(compressed);
  } catch {
    // Fallback: if library fails, use canvas directly
    return canvasCompress(file, maxDim, 0.8);
  }
}

const DUAL_SEP = "|||SECOND|||";

async function compressSingleBase64Small(base64: string): Promise<string> {
  try {
    const res = await fetch(base64);
    const blob = await res.blob();
    const file = new File([blob], "retry.jpg", { type: blob.type || "image/jpeg" });

    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 800,
      maxSizeMB: 0.5,
      useWebWorker: typeof window !== "undefined" && !!window.Worker,
      initialQuality: 0.7,
    });

    return await fileToDataURL(compressed);
  } catch {
    // Fallback: canvas
    return canvasCompressFromBase64(base64, 800, 0.7);
  }
}

// Handles both single base64 strings and DUAL_SEP-combined two-photo strings
// used by the 2-photo cosmetics / suplement flow. Previously this function
// treated the combined string as a single data URL and silently corrupted the
// second image, which broke the entire retry-with-smaller-image fallback and
// was a root cause of the "analiza bez końca" hang.
export async function compressImageSmall(base64: string): Promise<string> {
  if (base64.includes(DUAL_SEP)) {
    const [a, b] = base64.split(DUAL_SEP);
    const [smallA, smallB] = await Promise.all([
      compressSingleBase64Small(a),
      compressSingleBase64Small(b),
    ]);
    return smallA + DUAL_SEP + smallB;
  }
  return compressSingleBase64Small(base64);
}

// Clamp a single base64 data URL's payload size by re-encoding via canvas
// when it exceeds `maxKB`. Used to protect the 4.5MB Vercel request body
// limit for 2-photo scans where the native Capacitor camera can emit
// larger-than-expected JPEGs. Safe no-op when already under the limit.
export async function clampBase64Size(base64: string, maxKB: number): Promise<string> {
  try {
    // Rough payload byte estimate from the base64 string length
    const commaIdx = base64.indexOf(",");
    const b64Len = commaIdx >= 0 ? base64.length - commaIdx - 1 : base64.length;
    const approxBytes = Math.floor(b64Len * 0.75);
    if (approxBytes <= maxKB * 1024) return base64;

    // Re-encode via canvas at progressively lower quality until under cap
    const img = await loadImage(base64);
    const targetDim = Math.min(Math.max(img.width, img.height), 1100);
    let quality = 0.82;
    for (let attempt = 0; attempt < 5; attempt++) {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > targetDim) { h = (h * targetDim) / w; w = targetDim; }
      if (h > targetDim) { w = (w * targetDim) / h; h = targetDim; }
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL("image/jpeg", quality);
      const outCommaIdx = out.indexOf(",");
      const outLen = outCommaIdx >= 0 ? out.length - outCommaIdx - 1 : out.length;
      const outBytes = Math.floor(outLen * 0.75);
      if (outBytes <= maxKB * 1024) return out;
      quality = Math.max(0.45, quality - 0.12);
    }
    // Final fallback: worst-case 0.4 quality, even smaller max dim
    return canvasCompressFromBase64(base64, 900, 0.4);
  } catch {
    // If clamp fails we return the original string — analyze route will
    // either accept it or return 413, which triggers the retry path.
    return base64;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

// Helper: File/Blob → data URL
function fileToDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Cannot read file"));
    reader.readAsDataURL(file);
  });
}

// Fallback: canvas-based compression (works everywhere)
function canvasCompress(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxDim) { h = (h * maxDim) / w; w = maxDim; }
        if (h > maxDim) { w = (w * maxDim) / h; h = maxDim; }
        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Cannot load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Cannot read file"));
    reader.readAsDataURL(file);
  });
}

function canvasCompressFromBase64(base64: string, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxDim) { h = (h * maxDim) / w; w = maxDim; }
      if (h > maxDim) { w = (w * maxDim) / h; h = maxDim; }
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Cannot resize"));
    img.src = base64;
  });
}
