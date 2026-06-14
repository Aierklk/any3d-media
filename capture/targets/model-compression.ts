import type { Page } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { measure } from "../anchors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface AnchorBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Drives the model-compression tool through its full demo flow and
 * returns the bounding boxes of key UI zones for the VirtualCamera.
 *
 * Every wait is condition-based so the recording is stable regardless
 * of machine speed. We never sleep a fixed duration for state changes.
 */
export default {
  async run(page: Page, fixtureFile: string): Promise<Record<string, AnchorBox>> {
    const anchors: Record<string, AnchorBox> = {};
    const fixturePath = resolve(__dirname, "../../../", fixtureFile);

    anchors.establish = { x: 0, y: 0, w: 1440, h: 900 };

    await page.waitForSelector('[role="button"]', { state: "visible", timeout: 15000 });
    await page.waitForTimeout(800);
    anchors["upload-zone"] = await measure(page, '[role="button"][aria-label]');

    const fileInput = page.locator('input[type="file"]');
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
    anchors["settings-panel"] = await measure(page, ".grid > div:first-child");
    anchors["preview-canvas"] = await measure(page, ".grid > div:last-child");

    const compressBtn = page.locator("button", { hasText: /压缩|Compress/ }).first();
    await compressBtn.waitFor({ state: "visible" });
    anchors["compress-button"] = await measure(page, compressBtn);

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

    return anchors;
  },
};
