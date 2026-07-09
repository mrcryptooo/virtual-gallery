/**
 * Writes the synthetic equirect master (doc 12 M0.5) as a PNG.
 *
 * Usage: node scripts/make-synthetic-master.ts <outFile> [width=16384]
 */
import sharp from 'sharp';
import { generateSyntheticEquirect } from './pipeline/synthetic.ts';

const [, , outFile, widthArg] = process.argv;
if (outFile === undefined) {
  console.error('Usage: node scripts/make-synthetic-master.ts <outFile> [width=16384]');
  process.exit(1);
}

const width = widthArg !== undefined ? Number(widthArg) : 16384;
const started = Date.now();
const { data, height } = { ...generateSyntheticEquirect(width), height: width / 2 };

await sharp(data, { raw: { width, height, channels: 3 } })
  .png({ compressionLevel: 6 })
  .toFile(outFile);

console.log(
  `[pipeline] synthetic master ${String(width)}×${String(height)} → ${outFile} in ${String(
    Date.now() - started,
  )} ms`,
);
