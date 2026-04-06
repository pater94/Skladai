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

/** Check if running inside a native Capacitor shell AND Camera plugin is registered.
 *  If Camera plugin isn't available (e.g. old iOS binary built before plugin was added),
 *  we return false so the caller falls back to <input type="file"> which works in WKWebView. */
export function isNative(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  if (!Capacitor.isPluginAvailable("Camera")) {
    console.warn("[NativeCamera] Native platform detected but Camera plugin NOT available — falling back to file input. iOS app needs rebuild with `npx cap sync ios`.");
    return false;
  }
  return true;
}

/** Check if Camera plugin is available */
export function hasCameraPlugin(): boolean {
  return Capacitor.isPluginAvailable("Camera");
}

/** Check if running inside Capacitor (regardless of plugin availability) */
export function isCapacitorShell(): boolean {
  return Capacitor.isNativePlatform();
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
 * Returns null on user cancel, throws on real errors (so caller can show feedback)
 */
export async function takePhotoForMode(
  mode: string,
  source: "camera" | "gallery" = "camera"
): Promise<string | null> {
  const isLabelMode = mode === "cosmetics" || mode === "suplement";
  const maxDim = isLabelMode ? 1200 : 2000;
  const quality = isLabelMode ? 85 : 80;

  if (!hasCameraPlugin()) {
    throw new Error("Camera plugin not available — rebuild iOS app");
  }

  try {
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
    const msg = err instanceof Error ? err.message : String(err);
    // User cancelled — return null silently
    if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user denied")) {
      console.log("[NativeCamera] User cancelled");
      return null;
    }
    // Real error — log and rethrow so UI can show feedback
    console.error("[NativeCamera] takePhotoForMode failed:", err);
    throw err;
  }
}
