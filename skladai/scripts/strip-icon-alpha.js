/**
 * Strips alpha channel from iOS app icons.
 * Apple App Store rejects uploads with transparent app icons.
 * Reads each PNG, composites over solid bg (#0a0f0d), writes as color type 2 (RGB).
 */
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const ICON_DIR = path.join(
  __dirname,
  "..",
  "ios",
  "App",
  "App",
  "Assets.xcassets",
  "AppIcon.appiconset"
);

// Background color to composite alpha against (app theme dark green)
const BG = { r: 0x0a, g: 0x0f, b: 0x0d };

function stripAlpha(filePath) {
  const buf = fs.readFileSync(filePath);
  const src = PNG.sync.read(buf);

  const dst = new PNG({
    width: src.width,
    height: src.height,
    colorType: 2, // RGB, no alpha
    inputColorType: 2,
    bitDepth: 8,
  });

  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (src.width * y + x) << 2;
      const a = src.data[i + 3] / 255;
      const r = Math.round(src.data[i] * a + BG.r * (1 - a));
      const g = Math.round(src.data[i + 1] * a + BG.g * (1 - a));
      const b = Math.round(src.data[i + 2] * a + BG.b * (1 - a));
      dst.data[i] = r;
      dst.data[i + 1] = g;
      dst.data[i + 2] = b;
      dst.data[i + 3] = 255;
    }
  }

  const out = PNG.sync.write(dst, { colorType: 2 });
  fs.writeFileSync(filePath, out);

  // Verify
  const verify = PNG.sync.read(fs.readFileSync(filePath));
  return { width: verify.width, height: verify.height };
}

const files = fs
  .readdirSync(ICON_DIR)
  .filter((f) => f.endsWith(".png"));

console.log(`Stripping alpha from ${files.length} icons in ${ICON_DIR}`);
for (const f of files) {
  const p = path.join(ICON_DIR, f);
  const { width, height } = stripAlpha(p);
  // Read back raw header to confirm color type
  const raw = fs.readFileSync(p);
  const colorType = raw[25]; // IHDR color type byte
  console.log(`  ${f} ${width}x${height} colorType=${colorType}`);
}
console.log("Done.");
