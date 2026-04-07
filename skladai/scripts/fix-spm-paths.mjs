#!/usr/bin/env node
/**
 * Normalize Swift Package Manager paths in ios/App/CapApp-SPM/Package.swift.
 *
 * Why this exists:
 *   When `npx cap sync ios` runs on Windows, the Capacitor CLI emits
 *   relative SPM paths using the host OS separator — i.e. backslashes:
 *       path: "..\..\..\node_modules\@capacitor\app"
 *   Swift parses `\..` / `\@` as invalid escape sequences and xcodebuild
 *   refuses to resolve packages on macOS CI (exit 74).
 *
 * Fix:
 *   Rewrite every SPM `path: "..."` literal to use POSIX forward slashes,
 *   which Swift accepts on every platform.
 *
 * Usage:
 *   node scripts/fix-spm-paths.mjs
 *   (also runs automatically after `npm run cap:sync` / `build:ios`)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "..", "ios", "App", "CapApp-SPM", "Package.swift");

if (!existsSync(pkgPath)) {
  // No iOS project (or already cleaned). Nothing to do — don't fail builds.
  process.exit(0);
}

const original = readFileSync(pkgPath, "utf8");

// Replace backslashes only inside `path: "..."` literals to avoid touching
// anything else in the file.
const fixed = original.replace(
  /path:\s*"([^"]*)"/g,
  (_match, p) => `path: "${p.replace(/\\/g, "/")}"`
);

if (fixed === original) {
  console.log("[fix-spm-paths] Package.swift already uses POSIX paths — nothing to do.");
  process.exit(0);
}

writeFileSync(pkgPath, fixed);
console.log("[fix-spm-paths] Normalized backslash paths to forward slashes in Package.swift.");
