/**
 * Text-to-speech narration pipeline using edge-tts-node (free, no API key).
 * Produces narration.mp3 and narration-timing.json with per-segment
 * timestamps that feed directly into the caption builder.
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from "edge-tts-node";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getTarget } from "../config/video-targets.js";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const VOICE = "zh-CN-YunyangNeural";

export interface NarrationTiming {
  segments: Array<{
    text: string;
    start: number;
    end: number;
    duration: number;
  }>;
  totalDuration: number;
  audioPath: string;
}

export async function generateNarration(targetId: string): Promise<NarrationTiming> {
  const target = getTarget(targetId);
  const outDir = join(ROOT, "tmp", target.id);
  await mkdir(outDir, { recursive: true });

  const segments = target.narration;
  const timing: NarrationTiming["segments"] = [];
  let cursor = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    console.log(`[tts] Segment ${i + 1}/${segments.length}: "${seg.text.slice(0, 30)}..."`);

    const tts = new MsEdgeTTS({});
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const partPath = join(outDir, `seg-${i}.mp3`);
    await tts.toFile(partPath, seg.text, { rate: "+8%" });
    tts.close();

    const dur = getAudioDurationSeconds(partPath);
    timing.push({
      text: seg.text,
      start: cursor,
      end: cursor + dur,
      duration: dur,
    });
    cursor += dur + 0.3;
  }

  const parts: Buffer[] = [];
  for (let i = 0; i < segments.length; i++) {
    parts.push(await readFile(join(outDir, `seg-${i}.mp3`)));
  }
  const audioPath = join(outDir, "narration.mp3");
  await writeFile(audioPath, Buffer.concat(parts));

  const result: NarrationTiming = {
    segments: timing,
    totalDuration: cursor,
    audioPath,
  };

  await writeFile(join(outDir, "narration-timing.json"), JSON.stringify(result, null, 2));
  console.log(`[tts] Done. ${timing.length} segments, ${cursor.toFixed(1)}s total.`);
  return result;
}

function getAudioDurationSeconds(filePath: string): number {
  const ffprobe = findFfprobe();
  if (ffprobe) {
    const out = spawnSync(ffprobe, ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", filePath], {
      encoding: "utf-8",
    });
    const val = parseFloat(out.stdout.trim());
    if (!isNaN(val)) return val;
  }
  const stat = spawnSync("node", ["-e", `console.log(require('fs').statSync('${filePath}').size)`], {
    encoding: "utf-8",
  });
  const bytes = parseInt(stat.stdout.trim());
  return bytes / 6000;
}

function findFfprobe(): string | null {
  try {
    const candidate = require.resolve("ffprobe-static/bin");
    if (existsSync(candidate)) return candidate;
  } catch {}
  return null;
}

const targetId = process.argv[2] ?? "model-compression";
generateNarration(targetId).catch((e) => {
  console.error(e);
  process.exit(1);
});
