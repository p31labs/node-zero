/**
 * Generate PWA PNG icons from p31-icon.svg
 * Run from pwa/icons: node generate-icons.js
 * Requires: npm install sharp
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const svgPath = path.join(__dirname, "p31-icon.svg");
if (!fs.existsSync(svgPath)) {
  console.error("p31-icon.svg not found");
  process.exit(1);
}

async function main() {
  const dir = __dirname;
  const black = { r: 0, g: 0, b: 0, alpha: 1 };

  // Standard: resize to 192 and 512
  await sharp(svgPath).resize(192, 192).toFile(path.join(dir, "p31-192.png"));
  console.log("p31-192.png");
  await sharp(svgPath).resize(512, 512).toFile(path.join(dir, "p31-512.png"));
  console.log("p31-512.png");

  // Maskable: smaller icon centered on black (safe zone)
  await sharp(svgPath)
    .resize(384, 384)
    .extend({ top: 64, bottom: 64, left: 64, right: 64, background: black })
    .toFile(path.join(dir, "p31-maskable-512.png"));
  console.log("p31-maskable-512.png");
  await sharp(svgPath)
    .resize(144, 144)
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: black })
    .toFile(path.join(dir, "p31-maskable-192.png"));
  console.log("p31-maskable-192.png");

  console.log("Done. Four PNGs in pwa/icons/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
