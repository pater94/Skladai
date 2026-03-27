export async function compressImage(file: File, maxDim: number = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        }
        if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);

        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Cannot get canvas context")); return; }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Try PNG first (sharper text), fall back to JPEG if too large
        const png = canvas.toDataURL("image/png");
        if (png.length < 3_000_000) {
          resolve(png);
        } else {
          const jpeg = canvas.toDataURL("image/jpeg", 0.90);
          resolve(jpeg);
        }
      };
      img.onerror = () => reject(new Error("Cannot load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Cannot read file"));
    reader.readAsDataURL(file);
  });
}

// Smaller compression for retry after timeout
export async function compressImageSmall(base64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 800;
      let w = img.width;
      let h = img.height;
      if (w > MAX) { h = (h * MAX) / w; w = MAX; }
      if (h > MAX) { w = (w * MAX) / h; h = MAX; }
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => reject(new Error("Cannot resize"));
    img.src = base64;
  });
}
