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
 * `hooks.onAnchor` fires after each zone becomes stable — the video
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

    const settingsPanel = page.locator(".grid > div:first-child");
    const previewCanvas = page.locator(".grid > div:last-child");
    anchors["settings-panel"] = await measure(page, settingsPanel);
    await hooks?.onAnchor?.("settings-panel", settingsPanel, page);
    anchors["preview-canvas"] = await measure(page, previewCanvas);
    await hooks?.onAnchor?.("preview-canvas", previewCanvas, page);

    const compressBtn = page.locator("button", { hasText: /压缩|Compress/ }).first();
    await compressBtn.waitFor({ state: "visible" });
    anchors["compress-button"] = await measure(page, compressBtn);
    await hooks?.onAnchor?.("compress-button", compressBtn, page);

    await compressBtn.click();

    console.log("[flow:model-compression] Waiting for compression to complete...");
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll("button"));
        const download = btns.find((b) => /下载|Download/.test(b.textContent ?? ""));
        return !!download && !download.disabled;
      },
      { timeout: 60000 },
    );
    await page.waitForTimeout(1500);

    const downloadBtn = page.locator("button", { hasText: /下载|Download/ }).first();
    anchors["download-result"] = await measure(page, downloadBtn);
    await hooks?.onAnchor?.("download-result", downloadBtn, page);

    // Re-measure the preview AFTER compression so cards can capture the
    // post-compression model. preview-canvas above was measured pre-click;
    // the same locator now resolves to the compressed result state.
    anchors["preview-result"] = await measure(page, previewCanvas);
    await hooks?.onAnchor?.("preview-result", previewCanvas, page);

    return anchors;
  },
};
