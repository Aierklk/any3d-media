/**
 * Card screenshoter: re-runs the capture flow headfully, but instead of
 * recording video it screenshots each anchor element once it has stabilized.
 *
 * This is the deterministic replacement for picking frames out of the video
 * timeline. The flow waits for each state (waitForFunction) before measuring,
 * so every screenshot is the stable post-load view — never a loading spinner,
 * never a full-viewport crop that needs trimming.
 *
 * Output: tmp/<id>/card/frames/<label>.png — referenced by card/specs.ts via
 * the anchor label (e.g. ../frames/settings-panel.png).
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { getTarget } from "../config/video-targets.js";
import type { CaptureFlowHooks } from "./types.js";
import { loadFlow } from "./flow.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const VIEWPORT_W = 1440;
const VIEWPORT_H = 900;

export async function captureCardShots(targetId: string): Promise<string[]> {
  const target = getTarget(targetId);
  const baseUrl = process.env.TARGET_BASE_URL ?? "http://localhost:3000";
  const framesDir = join(ROOT, "tmp", target.id, "card", "frames");
  await mkdir(framesDir, { recursive: true });

  console.log(`[card-shots] Launching browser for "${target.id}"...`);
  // Same GPU flags as the recorder: three.js/WebGL must render correctly or
  // the model preview is blank. Headful keeps software-fallback pitfalls away.
  const browser = await chromium.launch({
    headless: false,
    channel: process.env.CAPTURE_CHANNEL,
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
  });
  const page = await context.newPage();

  const fullUrl = baseUrl + target.url;
  console.log(`[card-shots] Navigating to ${fullUrl}`);
  await page.goto(fullUrl, { waitUntil: "networkidle" });

  const flow = await loadFlow(target.id);
  const shots: string[] = [];

  const hooks: CaptureFlowHooks = {
    // The flow has already waitFor'd each anchor stable before measuring.
    // We only add a short visual settle for fonts/animations (not a state wait).
    async onAnchor(label, locator, p, clip): Promise<void> {
      await p.waitForTimeout(300);
      const outPath = join(framesDir, `${label}.png`);
      if (clip) {
        // Use page-level screenshot with clip rect for merged/combined regions
        await p.screenshot({ path: outPath, type: "png", clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h } });
      } else {
        // Default: element screenshot
        await locator.screenshot({ path: outPath, type: "png" });
      }
      shots.push(outPath);
      console.log(`[card-shots] ${label}.png`);
    },
  };

  await flow.run(page, target.fixtureFile, hooks);

  await browser.close();
  console.log(`[card-shots] Done. ${shots.length} element shots in ${framesDir}`);
  return shots;
}

const targetId = process.argv[2] ?? "model-compression";
captureCardShots(targetId).catch((e) => {
  console.error(e);
  process.exit(1);
});
