/*
 * Asset pipeline for the landing-page house toggle.
 *
 * The source renders already have transparent backgrounds, so this just trims
 * the empty margins and normalizes them to a consistent square canvas so they
 * sit evenly in the toggle.
 *
 * Run: node scripts/process-house-icons.mjs
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ASSETS =
  '/Users/lassor/.cursor/projects/Users-lassor-Developer-guesthouse/assets';
const OUT = path.join(process.cwd(), 'public/houses');

const SOURCES = [
  {
    out: 'beach.png',
    file: 'make-it-more-like-a-surf-shack-with-a-surfboard-le-7bb24e33-28af-4d7a-abf4-fa04cec892ca.png',
  },
  {
    out: 'mountain.png',
    file: 'make-it-a-blue-glass-front-and-add-skis-and-or-sno-e7dff23e-4061-416a-aced-b9bc5c6393be.png',
  },
  {
    out: 'country.png',
    file: 'soft-matte-clay-3d-rendered-icon--gentle-golden-ho-25aa788f-e6cc-4964-944a-f3fc2b490f35.png',
  },
];

async function processImage({ file, out }) {
  const input = path.join(ASSETS, file);
  const buffer = await sharp(input)
    .ensureAlpha()
    .trim()
    .resize(320, 320, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await writeFile(path.join(OUT, out), buffer);
  console.log(`wrote ${out}`);
}

await mkdir(OUT, { recursive: true });
for (const src of SOURCES) await processImage(src);
console.log('done');
