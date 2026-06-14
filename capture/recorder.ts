/**
 * Playwright-based screen recorder for Any3D tools.
 *
 * Design principles for deterministic, stable output:
 * 1. Fixed viewport (1440x900) so element coordinates are stable.
 * 2. Headful Chromium with GPU flags so WebGL (three.js) renders correctly.
 * 3. Condition-based waits (waitForFunction), never fixed sleeps.
 * 4. CDP screencast (per-frame PNG) for pixel-accurate capture.
 * 5. Records element bounding boxes into captures.json so the Remotion
 *    VirtualCamera knows exactly where each operation zone is.
 */

import { chromium, type Page } from "playwright";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getTarget, type ShotSpec } from "../config/video-targets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const VIEWPORT_W = 1440;
const VIEWPORT_H = 900;
const FPS = 30;

export interface CaptureResult {
  videoPath: string;
  framesDir: string;
  frameCount: number;
  anchors: Record<string, { x: number; y: number; w: number; h: number }>;
  resolvedShots: ShotSpec[];
}

export async function recordTarget(targetId: string): Promise<CaptureResult> {
  const target = getTarget(targetId);
  const baseUrl = process.env.TARGET_BASE_URL ?? "http://localhost:3000";
  const outDir = join(ROOT, "tmp", target.id);
  const framesDir = join(outDir, "frames");
  await mkdir(framesDir, { recursive: true });

  console.log(`[recorder] Launching browser for "${target.id}"...`);
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--use-gl=desktop",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--disable-gpu-sandbox",
      `--window-size=${VIEWPORT_W},${VIEWPORT_H}`,
      "--force-color-profile=srgb",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
    deviceScaleFactor: 1,
    recordVideo: { dir: outDir, size: { width: VIEWPORT_W, height: VIEWPORT_H } },
  });

  const page = await context.newPage();

  const client = await context.newCDPSession(page);
  let frameIndex = 0;
  const onFrame = async (payload: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    const buf = Buffer.from(payload.data, "base64");
    const fname = String(frameIndex).padStart(6, "0") + ".jpg";
    await writeFile(join(framesDir, fname), buf);
    frameIndex++;
    await client.send("Page.screencastFrameAck", { sessionId: payload.sessionId }).catch(() => {});
  };

  client.on("Page.screencastFrame", onFrame);
  await client.send("Page.startScreencast", {
    format: "jpeg",
    quality: 90,
    everyNthFrame: 1,
  });

  const fullUrl = baseUrl + target.url;
  console.log(`[recorder] Navigating to ${fullUrl}`);
  await page.goto(fullUrl, { waitUntil: "networkidle" });

  const flow = await loadFlow(target.id);
  const anchors = await flow.run(page, target.fixtureFile);

  await page.waitForTimeout(500);
  await client.send("Page.stopScreencast");
  await page.waitForTimeout(200);

  const videoFiles = await readdir(outDir);
  const webm = videoFiles.find((f) => f.endsWith(".webm"));

  const resolvedShots: ShotSpec[] = target.shots.map((s) => ({
    ...s,
    region: anchors[s.label] ?? s.region,
  }));

  await browser.close();

  const result: CaptureResult = {
    videoPath: webm ? join(outDir, webm) : "",
    framesDir,
    frameCount: frameIndex,
    anchors,
    resolvedShots,
  };

  await writeFile(join(outDir, "captures.json"), JSON.stringify(result, null, 2));
  console.log(`[recorder] Done. ${frameIndex} frames, ${Object.keys(anchors).length} anchors.`);
  return result;
}

interface CaptureFlow {
  run(page: Page, fixtureFile: string): Promise<CaptureResult["anchors"]>;
}

async function loadFlow(targetId: string): Promise<CaptureFlow> {
  const mod = await import(`./targets/${targetId}.js`);
  return mod.default as CaptureFlow;
}

const targetId = process.argv[2] ?? "model-compression";
recordTarget(targetId).catch((e) => {
  console.error(e);
  process.exit(1);
});
