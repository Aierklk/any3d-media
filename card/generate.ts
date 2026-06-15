/**
 * Card generator: takes a CardSpec and produces a self-contained HTML
 * file using the guizang seed template's CSS class system.
 *
 * The output HTML references assets (templates, screenshot backgrounds)
 * via relative paths. It gets rendered to PNGs by render.ts.
 */

import { readFile, writeFile, mkdir, copyFile, cp } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import type { CardSpec, CardFrame, CardStyle, Lang, RenderTarget } from "./types.js";
import { buildToolCardSpec } from "./specs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const BOARD_DIMS: Record<string, { w: number; h: number }> = {
  xhs: { w: 1080, h: 1440 },
  "wechat-wide": { w: 2100, h: 900 },
  "wechat-square": { w: 1080, h: 1080 },
};

const STYLE_TEMPLATE: Record<CardStyle, string> = {
  editorial: "template-editorial-card.html",
  swiss: "template-swiss-card.html",
};

export async function generateCards(spec: CardSpec): Promise<{ htmlPath: string; targets: RenderTarget[] }> {
  const outDir = join(ROOT, "tmp", spec.toolId, "card");
  const assetsDir = join(outDir, "assets");
  await mkdir(assetsDir, { recursive: true });
  await mkdir(join(assetsDir, "screenshot-backgrounds"), { recursive: true });

  const templateName = STYLE_TEMPLATE[spec.style];
  const templatePath = join(ROOT, "card", "assets", templateName);
  let templateHtml = await readFile(templatePath, "utf-8");

  await copyAssetsTo(assetsDir);

  const framesHtml = spec.frames.map((f) => renderFrame(f, spec.style)).join("\n");

  if (spec.theme) {
    templateHtml = templateHtml.replace(
      /data-theme="[^"]*"/,
      `data-theme="${spec.theme}"`,
    );
  }

  const title = spec.frames[0]?.title ?? spec.toolId;
  templateHtml = templateHtml.replace(/\[必填\][^<]*/g, title);

  // The marker appears twice in the template: once inside the <style> doc
  // comment, once at the real insertion point in <main>. A regex replace
  // would match the first one and swallow the entire stylesheet up to
  // </main>. Anchor on the body-level (last) marker and slice instead.
  const marker = "<!-- POSTERS_HERE -->";
  const markerIdx = templateHtml.lastIndexOf(marker);
  const mainEnd = templateHtml.indexOf("</main>", markerIdx);
  if (markerIdx === -1 || mainEnd === -1) {
    throw new Error("Card template missing <!-- POSTERS_HERE --> or </main>");
  }
  templateHtml =
    templateHtml.slice(0, markerIdx) +
    framesHtml +
    "\n  </main>" +
    templateHtml.slice(mainEnd + "</main>".length);

  const htmlPath = join(outDir, "index.html");
  await writeFile(htmlPath, templateHtml);

  const targets: RenderTarget[] = spec.frames.map((f, i) => {
    const dims = BOARD_DIMS[f.platform];
    return {
      selector: `#${f.id}`,
      filename: `${f.platform}-${String(i + 1).padStart(2, "0")}-${f.role}.png`,
      width: dims.w,
      height: dims.h,
    };
  });

  console.log(`[card:generate] ${targets.length} frames -> ${htmlPath}`);
  return { htmlPath, targets };
}

function renderFrame(frame: CardFrame, style: CardStyle): string {
  const cls = platformClass(frame.platform);
  const innerFn = style === "editorial" ? renderEditorialInner : renderSwissInner;
  const inner = innerFn(frame);

  return `    <section class="poster ${cls}" id="${frame.id}">\n${inner}\n    </section>`;
}

function platformClass(platform: string): string {
  switch (platform) {
    case "xhs": return "xhs";
    case "wechat-wide": return "wechat wide";
    case "wechat-square": return "wechat square";
    default: return "xhs";
  }
}

function renderEditorialInner(f: CardFrame): string {
  const parts: string[] = [];
  parts.push(`      <div class="content">`);
  parts.push(`        <div class="kicker">Any3D</div>`);

  if (f.role === "cover") {
    parts.push(`        <h1 class="h-display">${f.title}</h1>`);
    if (f.subtitle) parts.push(`        <p class="h-sub">${f.subtitle}</p>`);
  } else {
    parts.push(`        <h2 class="h-xl">${f.title}</h2>`);
  }

  if (f.screenshot) {
    const ratio = `r-${f.shotAspect ?? "16x10"}`;
    parts.push(`        <div class="frame-shot ${ratio} corners-sm shadow-soft bg-paper-2 inset-sub">`);
    parts.push(`          <img src="${f.screenshot}" alt="${f.title}" style="width:100%;height:100%;object-fit:contain">`);
    parts.push(`        </div>`);
  }

  if (f.body && f.body.length > 0) {
    parts.push(`        <div class="body">`);
    for (const line of f.body) parts.push(`          <p>${line}</p>`);
    parts.push(`        </div>`);
  }

  if (f.metrics && f.metrics.length > 0) {
    parts.push(`        <div class="ledger">`);
    for (const m of f.metrics) {
      parts.push(`          <div class="ledger-row"><span class="ledger-title">${m.label}</span><span class="ledger-note">${m.value}</span></div>`);
    }
    parts.push(`        </div>`);
  }

  parts.push(`      </div>`);
  return parts.join("\n");
}

function renderSwissInner(f: CardFrame): string {
  const parts: string[] = [];
  parts.push(`      <div class="content">`);

  if (f.role === "cover") {
    parts.push(`        <h1 class="h-hero">${f.title}</h1>`);
    if (f.subtitle) parts.push(`        <p class="lead">${f.subtitle}</p>`);
  } else {
    parts.push(`        <h2 class="h-xl">${f.title}</h2>`);
  }

  if (f.screenshot) {
    const ratio = `r-${f.shotAspect ?? "16x10"}`;
    parts.push(`        <div class="frame-shot ${ratio} corners-sq shadow-none bg-grey-1 inset-bal">`);
    parts.push(`          <img src="${f.screenshot}" alt="${f.title}">`);
    parts.push(`        </div>`);
  }

  if (f.body && f.body.length > 0) {
    for (const line of f.body) parts.push(`        <p class="body">${line}</p>`);
  }

  if (f.metrics && f.metrics.length > 0) {
    parts.push(`        <div class="matrix-fill">`);
    for (const m of f.metrics) {
      parts.push(`          <div class="cell"><span class="num-xl">${m.value}</span><span class="t-meta">${m.label}</span></div>`);
    }
    parts.push(`        </div>`);
  }

  parts.push(`      </div>`);
  return parts.join("\n");
}

async function copyAssetsTo(dstAssets: string): Promise<void> {
  const srcAssets = join(ROOT, "card", "assets");
  const srcBg = join(srcAssets, "screenshot-backgrounds");
  const dstBg = join(dstAssets, "screenshot-backgrounds");

  try {
    await copyFile(join(srcAssets, "magazine-bg-webgl.js"), join(dstAssets, "magazine-bg-webgl.js"));
  } catch {}

  if (existsSync(srcBg)) {
    // Backgrounds are decorative; never let a copy failure (Windows file
    // locks, AV scanning a .webp) block card generation. force overwrites
    // stale copies, and we warn-and-skip on anything still locked.
    try {
      await cp(srcBg, dstBg, { recursive: true, force: true });
    } catch (e) {
      console.warn(`[card:generate] screenshot-backgrounds copy skipped: ${(e as Error).message}`);
    }
  }
}

const targetId = process.argv[2] ?? "model-compression";
const styleArg = (process.argv[3] as CardStyle) ?? "editorial";
const langArg = (process.argv[4] as Lang) ?? "zh";
const spec = await buildToolCardSpec(targetId, styleArg, langArg);
generateCards(spec).catch((e) => {
  console.error(e);
  process.exit(1);
});
