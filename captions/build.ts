/**
 * Caption builder: converts narration timing JSON into @remotion/captions
 * format. Since we generated the TTS ourselves, we know the exact text
 * and timing - no speech recognition needed.
 *
 * Each narration segment is split into ~8-char caption cues (good for
 * portrait video readability) and evenly distributed across the segment's
 * audio duration.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

interface NarrationSegment {
  text: string;
  start: number;
  end: number;
  duration: number;
}
interface NarrationTiming {
  segments: NarrationSegment[];
}

interface CaptionCue {
  text: string;
  startMs: number;
  endMs: number;
}

const CUE_MAX_CHARS = 12;

export async function buildCaptions(targetId: string): Promise<{ cues: CaptionCue[]; outPath: string }> {
  const timingPath = join(ROOT, "tmp", targetId, "narration-timing.json");
  const raw = await readFile(timingPath, "utf-8");
  const timing: NarrationTiming = JSON.parse(raw);

  const cues: CaptionCue[] = [];

  for (const seg of timing.segments) {
    const chunks = splitIntoCues(seg.text, CUE_MAX_CHARS);
    const perCue = seg.duration / chunks.length;
    chunks.forEach((chunk, i) => {
      cues.push({
        text: chunk,
        startMs: Math.round((seg.start + i * perCue) * 1000),
        endMs: Math.round((seg.start + (i + 1) * perCue) * 1000),
      });
    });
  }

  const outDir = join(ROOT, "tmp", targetId);
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "captions.json");
  await writeFile(outPath, JSON.stringify(cues, null, 2));
  console.log(`[captions] Done. ${cues.length} cues written to ${outPath}`);
  return { cues, outPath };
}

function splitIntoCues(text: string, maxChars: number): string[] {
  const result: string[] = [];
  let current = "";
  for (const char of text) {
    current += char;
    if (char === "，" || char === "。" || char === "、" || char === "；" || char === ",") {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else if (current.length >= maxChars) {
      result.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

const targetId = process.argv[2] ?? "model-compression";
buildCaptions(targetId).catch((e) => {
  console.error(e);
  process.exit(1);
});
