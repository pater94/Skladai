/**
 * Native Camera Wrapper for Capacitor
 *
 * Detects if running inside Capacitor (native app) and uses native Camera API.
 * Falls back to standard file input on web.
 *
 * Usage:
 *   import { isNative, takePhoto, pickFromGallery } from "@/lib/native-camera";
 *
 *   if (isNative()) {
 *     const base64 = await takePhoto();
 *     // base64 is ready for scanning
 *   }
 */

import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

/** Check if running inside a native Capacitor shell */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Check if Camera plugin is available */
export function hasCameraPlugin(): boolean {
  return Capacitor.isPluginAvailable("Camera");
}

/**
 * Take a photo using the native camera
 * Returns a base64 data URL string (same format as compressImage output)
 */
export async function takePhoto(quality: number = 80): Promise<string | null> {
  try {
    if (!hasCameraPlugin()) return null;

    const image = await Camera.getPhoto({
      quality,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true,
      width: 2000,
      height: 2000,
    });

    if (!image.base64String) return null;

    // Convert to data URL format (matches existing pipeline)
    const mimeType = image.format === "png" ? "image/png" : "image/jpeg";
    return `data:${mimeType};base64,${image.base64String}`;
  } catch (err) {
    // User cancelled or permission denied
    console.warn("[NativeCamera] takePhoto cancelled/failed:", err);
    return null;
  }
}

/**
 * Pick a photo from the device gallery
 * Returns a base64 data URL string
 */
export async function pickFromGallery(quality: number = 80): Promise<string | null> {
  try {
    if (!hasCameraPlugin()) return null;

    const image = await Camera.getPhoto({
      quality,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      correctOrientation: true,
      width: 2000,
      height: 2000,
    });

    if (!image.base64String) return null;

    const mimeType = image.format === "png" ? "image/png" : "image/jpeg";
    return `data:${mimeType};base64,${image.base64String}`;
  } catch (err) {
    console.warn("[NativeCamera] pickFromGallery cancelled/failed:", err);
    return null;
  }
}

/**
 * Take photo with mode-specific settings
 * Cosmetics and supplements use smaller resolution for faster OCR
 */
export async function takePhotoForMode(
  mode: string,
  source: "camera" | "gallery" = "camera"
): Promise<string | null> {
  const isLabelMode = mode === "cosmetics" || mode === "suplement";
  const maxDim = isLabelMode ? 1200 : 2000;
  const quality = isLabelMode ? 85 : 80;

  try {
    if (!hasCameraPlugin()) return null;

    const image = await Camera.getPhoto({
      quality,
      resultType: CameraResultType.Base64,
      source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
      correctOrientation: true,
      width: maxDim,
      height: maxDim,
    });

    if (!image.base64String) return null;

    const mimeType = image.format === "png" ? "image/png" : "image/jpeg";
    return `data:${mimeType};base64,${image.base64String}`;
  } catch (err) {
    console.warn("[NativeCamera] takePhotoForMode cancelled/failed:", err);
    return null;
  }
}
