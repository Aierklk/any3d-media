/**
 * Visual QA using glm-5v-turbo (OpenAI-compatible API).
 *
 * After rendering, this module extracts key frames from the output video
 * and sends them to the vision model with a structured prompt. The model
 * returns a JSON verdict per frame: is the focal element visible, is the
 * text readable, are there rendering artifacts.
 *
 * Results go into qa-report.json. If any frame fails, the pipeline can
 * be re-run with adjusted shot regions.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

interface QAVerdict {
  frame: number;
  timestamp: string;
  focalElementPresent: boolean;
  textReadable: boolean;
  artifacts: string[];
  suggestion: string;
}

const QA_FRAMES = [
  { frame: 15, label: "cover" },
  { frame: 100, label: "upload-zone" },
  { frame: 300, label: "settings" },
  { frame: 450, label: "compress" },
  { frame: 600, label: "preview" },
  { frame: 850, label: "outro" },
];

const PROMPT = `你是一个视频质检助手。我会给你竖屏宣传视频的关键帧截图。
请判断：1) 画面焦点区域是否清晰可见 2) 字幕文字是否完整可读 3) 是否有渲染异常（黑屏/撕裂/元素重叠）
返回 JSON 格式：
{"focalElementPresent": true/false, "textReadable": true/false, "artifacts": ["问题列表"], "suggestion": "改进建议或OK"}`;

export async function runVisualQA(targetId: string, videoPath: string): Promise<void> {
  const apiKey = process.env.QA_VISION_API_KEY;
  if (!apiKey) {
    console.warn("[qa] QA_VISION_API_KEY not set, skipping visual QA.");
    return;
  }

  const baseUrl = process.env.QA_VISION_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4";
  const model = process.env.QA_VISION_MODEL ?? "glm-5v-turbo";

  const qaDir = join(ROOT, "tmp", targetId, "qa-frames");
  await mkdir(qaDir, { recursive: true });

  const verdicts: QAVerdict[] = [];

  for (const { frame, label } of QA_FRAMES) {
    const ts = (frame / 30).toFixed(1);
    const imgPath = join(qaDir, `${label}.jpg`);
    const ffmpegOk = extractFrame(videoPath, frame, imgPath);
    if (!ffmpegOk) continue;

    const imgBase64 = await readFile(imgPath, { encoding: "base64" });
    const dataUrl = `data:image/jpeg;base64,${imgBase64}`;

    console.log(`[qa] Checking frame ${frame} (${label})...`);
    const verdict = await askVisionModel(baseUrl, apiKey, model, dataUrl, label);
    verdicts.push({ frame, timestamp: `${ts}s`, ...verdict });
  }

  const reportPath = join(ROOT, "tmp", targetId, "qa-report.json");
  await writeFile(reportPath, JSON.stringify(verdicts, null, 2));

  const failed = verdicts.filter((v) => !v.focalElementPresent || !v.textReadable || v.artifacts.length > 0);
  if (failed.length > 0) {
    console.log(`[qa] ${failed.length}/${verdicts.length} frames need attention:`);
    for (const f of failed) {
      console.log(`  - Frame ${f.frame} (${f.timestamp}): ${f.suggestion}`);
    }
  } else {
    console.log(`[qa] All ${verdicts.length} frames passed.`);
  }
}

function extractFrame(videoPath: string, frame: number, outPath: string): boolean {
  const ts = (frame / 30).toFixed(2);
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.warn("[qa] ffmpeg not found, cannot extract frames.");
    return false;
  }
  const r = spawnSync(ffmpeg, ["-y", "-ss", ts, "-i", videoPath, "-frames:v", "1", "-q:v", "2", outPath], {
    encoding: "utf-8",
  });
  return r.status === 0 && existsSync(outPath);
}

async function askVisionModel(
  baseUrl: string,
  apiKey: string,
  model: string,
  dataUrl: string,
  label: string,
): Promise<Omit<QAVerdict, "frame" | "timestamp">> {
  const body = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `${PROMPT}\n\n这一帧的预期焦点是：${label}` },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0.2,
  };

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Vision API error ${resp.status}: ${txt}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  return parseVerdict(content);
}

function parseVerdict(content: string): Omit<QAVerdict, "frame" | "timestamp"> {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    return { focalElementPresent: false, textReadable: false, artifacts: ["unparseable response"], suggestion: content.slice(0, 200) };
  }
  try {
    const j = JSON.parse(match[0]);
    return {
      focalElementPresent: !!j.focalElementPresent,
      textReadable: !!j.textReadable,
      artifacts: Array.isArray(j.artifacts) ? j.artifacts : [],
      suggestion: typeof j.suggestion === "string" ? j.suggestion : "OK",
    };
  } catch {
    return { focalElementPresent: false, textReadable: false, artifacts: ["invalid JSON"], suggestion: content.slice(0, 200) };
  }
}

function findFfmpeg(): string | null {
  const candidates = ["ffmpeg", join(ROOT, "node_modules", ".bin", "ffmpeg")];
  for (const c of candidates) {
    const r = spawnSync(c, ["-version"], { encoding: "utf-8", shell: true });
    if (r.status === 0) return c;
  }
  return null;
}

const targetId = process.argv[2] ?? "model-compression";
const defaultVideo = join(ROOT, "out", `${targetId}.mp4`);
runVisualQA(targetId, process.argv[3] ?? defaultVideo).catch((e) => {
  console.error(e);
  process.exit(1);
});
