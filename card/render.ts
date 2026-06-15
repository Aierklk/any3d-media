/**
 * Card renderer: uses Playwright to screenshot each frame element from
 * the generated HTML and save as high-resolution PNG.
 *
 * This is the guizang production workflow: open index.html, wait for
 * fonts and images, screenshot each .poster section by id.
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RenderTarget, CardStyle, Lang } from "./types.js";
import { generateCards } from "./generate.js";
import { buildToolCardSpec } from "./specs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

export async function renderCards(
  toolId: string,
  htmlPath: string,
  targets: RenderTarget[],
): Promise<string[]> {
  const outDir = join(ROOT, "out", toolId, "cards");
  await mkdir(outDir, { recursive: true });

  // Drive a system-installed browser (Chrome/Edge) when CAPTURE_CHANNEL is set,
  // so PNG rendering works without Playwright's bundled Chromium download.
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.CAPTURE_CHANNEL,
  });
  const context = await browser.newContext({
    viewport: { width: 2200, height: 1500 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);

  const outputPaths: string[] = [];

  for (const target of targets) {
    const el = page.locator(target.selector).first();
    await el.waitFor({ state: "visible" });

    const outPath = join(outDir, target.filename);
    await el.screenshot({
      path: outPath,
      type: "png",
    });

    outputPaths.push(outPath);
    console.log(`[card:render] ${target.filename} (${target.width}x${target.height})`);
  }

  await browser.close();
  console.log(`[card:render] Done. ${outputPaths.length} PNGs in ${outDir}`);
  return outputPaths;
}

const targetId = process.argv[2] ?? "model-compression";
const styleArg = (process.argv[3] as CardStyle) ?? "editorial";
const langArg = (process.argv[4] as Lang) ?? "zh";

const spec = await buildToolCardSpec(targetId, styleArg, langArg);
const { htmlPath, targets } = await generateCards(spec);
await renderCards(targetId, htmlPath, targets);
