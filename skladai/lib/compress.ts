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

export async function compressImageSmall(base64: string): Promise<string> {
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
