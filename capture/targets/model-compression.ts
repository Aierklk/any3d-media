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

    const compressBtn = page.locator("button", { hasText: /Ñ¹Ëõ|Compress/ }).first();
    await compressBtn.waitFor({ state: "visible" });
    anchors["compress-button"] = await measure(page, compressBtn);
    await hooks?.onAnchor?.("compress-button", compressBtn, page);

    await compressBtn.click();

    console.log("[flow:model-compression] Waiting for compression to complete...");
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll("button"));
        const download = btns.find((b) => /ÏÂÔØ|Download/.test(b.textContent ?? ""));
        return !!download && !download.disabled;
      },
      { timeout: 60000 },
    );
    await page.waitForTimeout(1500);

    const downloadBtn = page.locator("button", { hasText: /ÏÂÔØ|Download/ }).first();
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
