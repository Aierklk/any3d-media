/**
 * Extract key frames from the captured frame sequence for use as
 * card screenshots. Picks frames at specific timestamps that align
 * with the card content plan in specs.ts.
 */

import { copyFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/**
 * Frame indices to extract, mapped to their semantic role.
 * These correspond to the shot timeline in video-targets.ts.
 */
const FRAME_MAP: Record<string, number> = {
  "000100.jpg": 100,
  "000300.jpg": 300,
  "000500.jpg": 500,
  "000700.jpg": 700,
};

export async function extractCardFrames(targetId: string): Promise<void> {
  const framesDir = join(ROOT, "tmp", targetId, "frames");
  const cardFramesDir = join(ROOT, "tmp", targetId, "card", "frames");
  await mkdir(cardFramesDir, { recursive: true });

  if (!existsSync(framesDir)) {
    console.warn(`[extract-frames] Frames dir not found: ${framesDir}`);
    console.warn("[extract-frames] Run capture first.");
    return;
  }

  for (const [filename, frameIdx] of Object.entries(FRAME_MAP)) {
    const srcFrame = String(frameIdx).padStart(6, "0") + ".jpg";
    const srcPath = join(framesDir, srcFrame);
    const dstPath = join(cardFramesDir, filename);

    if (existsSync(srcPath)) {
      await copyFile(srcPath, dstPath);
      console.log(`[extract-frames] ${srcFrame} -> card/frames/${filename}`);
    } else {
      console.warn(`[extract-frames] Frame ${srcFrame} not found, skipping.`);
    }
  }

  console.log(`[extract-frames] Done.`);
}

const targetId = process.argv[2] ?? "model-compression";
extractCardFrames(targetId).catch((e) => {
  console.error(e);
  process.exit(1);
});
