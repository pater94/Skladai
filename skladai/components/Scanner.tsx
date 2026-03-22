"use client";

import { useRef, useState, useCallback } from "react";
import { compressImage } from "@/lib/compress";

interface ScannerProps {
  onScan: (base64: string) => void;
  isLoading: boolean;
}

export default function Scanner({ onScan, isLoading }: ScannerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      try {
        const compressed = await compressImage(file);
        setPreview(compressed);
        onScan(compressed);
      } catch (err) {
        console.error("Compression error:", err);
      }
    },
    [onScan]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-green-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-[#2E7D32] animate-spin" />
          <span className="absolute inset-0 flex items-center justify-center text-3xl">
            🔬
          </span>
        </div>
        <p className="text-lg font-semibold text-gray-700 animate-pulse">
          Analizuję skład...
        </p>
        <p className="text-sm text-gray-400">To może potrwać kilka sekund</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {preview && (
        <img
          src={preview}
          alt="Podgląd"
          className="mx-auto max-h-48 rounded-xl object-contain"
        />
      )}

      {/* Camera button */}
      <button
        type="button"
        onClick={() => cameraInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-3 py-5 bg-[#2E7D32] text-white font-semibold rounded-2xl active:bg-[#256829] transition-colors text-lg"
      >
        <span className="text-2xl">📸</span>
        Zrób zdjęcie etykiety
      </button>

      {/* Gallery button */}
      <button
        type="button"
        onClick={() => galleryInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-3 py-4 bg-white text-gray-700 font-medium rounded-2xl border-2 border-gray-200 active:bg-gray-50 transition-colors"
      >
        <span className="text-xl">🖼️</span>
        Wybierz z galerii
      </button>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onInputChange}
        style={{ position: "absolute", left: "-9999px", opacity: 0 }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={onInputChange}
        style={{ position: "absolute", left: "-9999px", opacity: 0 }}
      />
    </div>
  );
}
