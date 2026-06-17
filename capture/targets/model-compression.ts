import type { Page } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { measure } from "../anchors.js";
import type { AnchorMap, CaptureFlowHooks } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Drives the model-compression tool through its full demo flow and
 * returns the bounding boxes of key UI zones for the VirtualCamera.
 *
 * Every wait is condition-based so the recording is stable regardless
 * of machine speed. We never sleep a fixed duration for state changes.
 *
 * `hooks.onAnchor` fires after each zone becomes stable ¡ª the video
 * recorder ignores it; the card screenshoter uses it to capture a clean
 * element screenshot at that step (no loading state, no full-viewport crop).
 */
export default {
  async run(page: Page, fixtureFile: string, hooks?: CaptureFlowHooks): Promise<AnchorMap> {
    const anchors: AnchorMap = {};
    const fixturePath = resolve(__dirname, "../../", fixtureFile);

    anchors.establish = { x: 0, y: 0, w: 1440, h: 900 };

    await page.waitForSelector('[role="button"]', { state: "visible", timeout: 15000 });
    await page.waitForTimeout(800);
    const uploadZone = page.locator('[role="button"][aria-label]');
    anchors["upload-zone"] = await measure(page, uploadZone);
    await hooks?.onAnchor?.("upload-zone", uploadZone, page);

    const fileInput = page.locator('input[type="file"][accept*=".glb"]');
    await fileInput.setInputFiles(fixturePath);

    console.log("[flow:model-compression] Waiting for model to load...");
    await page.waitForFunction(
      () => {
        const canvases = document.querySelectorAll("canvas");
        if (canvases.length === 0) return false;
        const c = canvases[0] as HTMLCanvasElement;
        if (c.width === 0 || c.height === 0) return false;
        return true;
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(2000);

    // Production site has multiple .grid containers; we need ONLY the left
    // settings column (sliders + compress button), not the full grid wrapper.
    const rangeInput = page.locator('input[type="range"]').first();
    const settingsPanel = rangeInput.locator("xpath=ancestor::div[contains(@class,'col')][1]");
    const previewCanvas = page.locator('canvas').first();
    anchors["settings-panel"] = await measure(page, settingsPanel);
    await hooks?.onAnchor?.("settings-panel", settingsPanel, page);
    anchors["preview-canvas"] = await measure(page, previewCanvas);
    await hooks?.onAnchor?.("preview-canvas", previewCanvas, page);

    // Merged screenshot: settings column + 3D preview canvas side by side.
    // Compute union of both already-measured boxes, then use page-level clip.
    const sp = anchors["settings-panel"];
    const pc = anchors["preview-canvas"];
    if (sp && pc) {
      const pad = 16;
      anchors["settings-preview"] = {
        x: Math.min(sp.x, pc.x) - pad,
        y: Math.min(sp.y, pc.y) - pad,
        w: Math.max(sp.x + sp.w, pc.x + pc.w) - Math.min(sp.x, pc.x) + pad * 2,
        h: Math.max(sp.y + sp.h, pc.y + pc.h) - Math.min(sp.y, pc.y) + pad * 2,
      };
      // Pass clip rect via hook ¡ª card-shots will use page.screenshot({ clip })
      await hooks?.onAnchor?.(
        "settings-preview",
        settingsPanel,
        page,
        anchors["settings-preview"],
      );
    }

    // CJK search terms built from codepoints to bypass source-file encoding issues.
    const COMPRESS_TEXT = String.fromCharCode(0x538B, 0x7F29); // "Ñ¹Ëõ"
    const COMPRESS_EN = "Compress";
    const DOWNLOAD_TEXT = String.fromCharCode(0x4E0B, 0x8F7D); // "ÏÂÔØ"
    const DOWNLOAD_EN = "Download";

    // The compress button may coexist with hidden/detached elements matching
    // the same text (e.g. inside dropdowns). Use page.evaluate to find the
    // truly visible one, then click via Playwright locator from its index.
    // Try both CJK and English labels since --en visits /en-US/ URL.
    let compressBtnIdx = -1;
    for (const needle of [COMPRESS_TEXT, COMPRESS_EN]) {
      for (let attempt = 0; attempt < 10; attempt++) {
        compressBtnIdx = await page.evaluate(
          ({ n }) => {
            const btns = Array.from(document.querySelectorAll("button"));
            return btns.findIndex((b) => {
              const t = (b as HTMLElement).textContent ?? "";
              if ((b as HTMLElement).offsetParent === null) return false;
              return t.includes(n);
            });
          },
          { n: needle },
        );
        if (compressBtnIdx >= 0) break;
        await page.waitForTimeout(500);
      }
      if (compressBtnIdx >= 0) break;
    }
    console.log(`[flow:model-compression] Compress button index: ${compressBtnIdx}`);
    if (compressBtnIdx === -1) {
      throw new Error(`Compress button ("${COMPRESS_TEXT}") not found among visible buttons`);
    }
    const compressBtn = page.locator("button").nth(compressBtnIdx);
    await compressBtn.waitFor({ state: "visible", timeout: 10000 });
    anchors["compress-button"] = await measure(page, compressBtn);
    await hooks?.onAnchor?.("compress-button", compressBtn, page);

    await compressBtn.click();

    console.log("[flow:model-compression] Waiting for compression to complete...");
    // Try both CJK and English download labels
    const dlLabels = [DOWNLOAD_TEXT, DOWNLOAD_EN];
    let dlFound = false;
    for (const dlText of dlLabels) {
      try {
        await page.waitForFunction(
          ({ d }) => {
            const btns = Array.from(document.querySelectorAll("button"));
            return btns.some((b) => {
              const t = b.textContent ?? "";
              return t.includes(d) && !b.disabled;
            });
          },
          { d: dlText },
          { timeout: 30000 },
        );
        dlFound = true;
        break;
      } catch {
        // Try next label
      }
    }
    if (!dlFound) throw new Error("Download button not found after compression (tried all labels)");
    await page.waitForTimeout(1500);

    // Locate download button by its visible text (try both labels)
    let dlIdx = -1;
    for (const dlText of dlLabels) {
      dlIdx = await page.evaluate(
        ({ d }) => {
          const btns = Array.from(document.querySelectorAll("button"));
          return btns.findIndex(
            (b) => {
              const t = b.textContent ?? "";
              return t.includes(d) && (b as HTMLElement).offsetParent !== null;
            },
          );
        },
        { d: dlText },
      );
      if (dlIdx >= 0) break;
    }
    if (dlIdx === -1) throw new Error("Download button not found among visible buttons");
    const downloadBtn = page.locator("button").nth(dlIdx);
    anchors["download-result"] = await measure(page, downloadBtn);
    await hooks?.onAnchor?.("download-result", downloadBtn, page);

    // Re-measure the preview AFTER compression so cards can capture the
    // post-compression model. preview-canvas above was measured pre-click;
    // the same locator now resolves to the compressed result state.
    const postCanvas = page.locator('canvas').first();
    anchors["preview-result"] = await measure(page, postCanvas);
    await hooks?.onAnchor?.("preview-result", postCanvas, page);

    // Post-compression merged screenshot: settings column + compressed 3D preview.
    // This is what cards display ¡ª showing the tool with results, not the
    // empty pre-compress state. Re-measure both elements since layout may
    // have shifted after compression.
    const postSettings = rangeInput.locator("xpath=ancestor::div[contains(@class,'col')][1]");
    const sp2 = await measure(page, postSettings);
    const pc2 = anchors["preview-result"];
    if (sp2 && pc2) {
      const pad = 16;
      anchors["result-preview"] = {
        x: Math.min(sp2.x, pc2.x) - pad,
        y: Math.min(sp2.y, pc2.y) - pad,
        w: Math.max(sp2.x + sp2.w, pc2.x + pc2.w) - Math.min(sp2.x, pc2.x) + pad * 2,
        h: Math.max(sp2.y + sp2.h, pc2.y + pc2.h) - Math.min(sp2.y, pc2.y) + pad * 2,
      };
      await hooks?.onAnchor?.(
        "result-preview",
        postSettings,
        page,
        anchors["result-preview"],
      );
    }

    return anchors;
  },
};
