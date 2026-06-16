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

  const framesHtml = spec.frames.map((f) => renderFrame(f, spec.style, spec.accent)).join("\n");

  if (spec.theme) {
    templateHtml = templateHtml.replace(
      /data-theme="[^"]*"/,
      `data-theme="${spec.theme}"`,
    );
  }

  // For Swiss style, set data-accent on <html> so CSS variables resolve
  if (spec.style === "swiss" && spec.accent) {
    templateHtml = templateHtml.replace(
      /data-accent="[^"]*"/,
      `data-accent="${spec.accent}"`,
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

function renderFrame(frame: CardFrame, style: CardStyle, accent?: string): string {
  const cls = platformClass(frame.platform);
  const innerFn = style === "editorial" ? renderEditorialInner : renderSwissInner;
  const inner = innerFn(frame, accent);

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

/**
 * Map accent names to their screenshot background texture classes.
 * These are the vibrant style-b textured backgrounds — rich gradients,
 * halftones, and dot patterns that give each deck its colour personality.
 */
const SWISS_SHOT_BG: Record<string, string> = {
  ikb:            "bg-asset-ikb-dot",
  "lemon-yellow": "bg-asset-lemon-grid",
  "lemon-green":  "bg-asset-lemon-green-dot",
  "safety-orange": "bg-asset-safety-orange",
  "any3d-blue":   "bg-asset-any3d-blue",
};

/** Default to IKB Klein Blue if accent is unknown. */
function shotBgForAccent(accent?: string): string {
  return SWISS_SHOT_BG[accent ?? ""] ?? SWISS_SHOT_BG.ikb;
}

function renderSwissInner(f: CardFrame, accent?: string): string {
  const parts: string[] = [];
  const shotBg = shotBgForAccent(accent);

  // Every poster gets a subtle dot texture layer for depth
  parts.push(`      <div class="dot-mat"></div>`);
  parts.push(`      <div class="content">`);

  if (f.role === "infographic") {
    // ── INFOGRAPHIC: all content in ONE rich poster ──────────
    // Header: brand tag + full-width title + subtitle (no side card)
    parts.push(`        <div class="stack gap-4">`);
    parts.push(`          <p class="t-cat">ANY3D · CC</p>`);
    parts.push(`          <h1 class="h-statement">${f.title}</h1>`);
    if (f.subtitle) parts.push(`          <p class="lead">${f.subtitle}</p>`);
    parts.push(`        </div>`);

    // Screenshot: single large centered shot (top-bottom layout)
    if (f.screenshots && f.screenshots.length > 0) {
      parts.push(`          <div class="stack gap-4" style="margin-top:${varSp(6)};align-items:center">`);
      for (const shot of f.screenshots) {
        const ratio = `r-${shot.aspect}`;
        parts.push(`            <div class="frame-shot ${ratio} corners-md shadow-ed ${shotBg} inset-sub" style="width:100%;max-width:100%">`);
        parts.push(`              <img src="${shot.src}" alt="${shot.caption}">`);
        parts.push(`            </div>`);
        if (shot.caption) parts.push(`            <p class="swiss-img-caption">${shot.caption}</p>`);
      }
      parts.push(`          </div>`);
    }

    // Feature bullets
    if (f.body && f.body.length > 0) {
      parts.push(`          <div class="stack gap-3" style="margin-top:${varSp(6)}">`);
      for (const line of f.body.slice(0, 4)) { // max 4 bullets to fit
        parts.push(`            <div class="row gap-4" style="align-items:center">`);
        parts.push(`              <div style="width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0"></div>`);
        parts.push(`              <p class="body" style="margin:0">${line}</p>`);
        parts.push(`            </div>`);
      }
      parts.push(`          </div>`);
    }

    // Metrics row: show all 4 in a grid
    if (f.metrics && f.metrics.length > 0) {
      parts.push(`          <div class="grid-4" style="margin-top:auto;padding-top:${varSp(7)};border-top:1px solid var(--grey-2)">`);
      for (const m of f.metrics) {
        parts.push(`            <div class="stack gap-2" style="align-items:flex-start">`);
        parts.push(`              <span class="t-meta">${m.label.toUpperCase()}</span>`);
        parts.push(`              <span class="h-md" style="color:var(--accent)">${m.value}</span>`);
        parts.push(`            </div>`);
      }
      parts.push(`          </div>`);
    }

    parts.push(`        </div>`);

  } else if (f.role === "cover") {
    // Cover: accent category line + oversized statement + lead
    parts.push(`        <div class="stack gap-7">`);
    parts.push(`          <p class="t-cat">ANY3D · CC</p>`);
    parts.push(`          <h1 class="h-statement">${f.title}</h1>`);
    if (f.subtitle) parts.push(`          <p class="lead">${f.subtitle}</p>`);
    parts.push(`        </div>`);
    parts.push(`        <div class="grow"></div>`);
    parts.push(`        <hr class="hr-accent">`);
    parts.push(`        <div class="row gap-6">`);
    parts.push(`          <p class="t-meta">Vol. 01</p>`);
    parts.push(`          <p class="t-meta">/ Any3D</p>`);
    parts.push(`        </div>`);
  } else {
    // Content: title + screenshot with coloured texture bg + body copy
    parts.push(`        <h2 class="h-xl">${f.title}</h2>`);

    if (f.screenshot) {
      const ratio = `r-${f.shotAspect ?? "16x10"}`;
      // Use the vibrant style-b textured background instead of flat grey
      parts.push(`        <div class="frame-shot ${ratio} corners-md shadow-ed ${shotBg} inset-sub">`);
      parts.push(`          <img src="${f.screenshot}" alt="${f.title}">`);
      parts.push(`        </div>`);
      parts.push(`        <p class="swiss-img-caption">${f.title.toLowerCase()} · screenshot</p>`);
    }

    if (f.body && f.body.length > 0) {
      parts.push(`        <div class="stack gap-4">`);
      for (const line of f.body) parts.push(`          <p class="body">${line}</p>`);
      parts.push(`        </div>`);
    }

    if (f.metrics && f.metrics.length > 0) {
      // Summary: matrix with one accent highlight cell + hero stat bottom
      parts.push(`        <div class="matrix-fill">`);
      f.metrics.forEach((m, i) => {
        const isHighlight = i === 0; // first metric gets the accent cell
        const cellCls = isHighlight ? "matrix-cell is-accent" : "matrix-cell";
        parts.push(`          <div class="${cellCls}">`);
        parts.push(`            <span class="cell-nb">0${i + 1}</span>`);
        parts.push(`            <span class="cell-title">${m.label}</span>`);
        parts.push(`            <span class="num-xl">${m.value}</span>`);
        parts.push(`          </div>`);
      });
      parts.push(`        </div>`);
      // Big hero number below the matrix
      const heroValue = f.metrics[0]?.value ?? "";
      const heroLabel = f.metrics[0]?.label ?? "";
      parts.push(`        <div class="hero-stat-bottom">`);
      parts.push(`          <span class="num-mega">${heroValue}</span>`);
      parts.push(`          <span class="t-meta">${heroLabel.toUpperCase()}</span>`);
      parts.push(`        </div>`);
    }
  }

  parts.push(`      </div>`);
  return parts.join("\n");
}

/** Helper: resolve a spacing token name for inline styles. */
function varSp(n: number): string {
  const map: Record<number, string> = {
    2: "var(--sp-4)", 3: "var(--sp-5)", 4: "var(--sp-5)",
    5: "var(--sp-6)", 6: "var(--sp-7)", 7: "var(--sp-7)", 8: "var(--sp-8)",
  };
  return map[n] ?? `${n * 8}px`;
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
