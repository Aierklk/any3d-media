import type { Page, Locator } from "playwright";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Measure an element's bounding box in the fixed 1440x900 viewport space.
 * Pads the box slightly so the camera frame includes comfortable margin
 * around the focal element rather than cropping tight to its edges.
 */
export async function measure(page: Page, selector: string, pad?: number): Promise<Box>;
export async function measure(page: Page, locator: Locator, pad?: number): Promise<Box>;
export async function measure(page: Page, arg: string | Locator, pad: number = 40): Promise<Box> {
  const el = typeof arg === "string" ? page.locator(arg).first() : arg;
  return measureLocator(el, pad);
}

export async function measureLocator(el: Locator, pad = 40): Promise<Box> {
  await el.waitFor({ state: "visible" });
  const bb = await el.boundingBox();
  if (!bb) throw new Error("Element has no bounding box");
  return {
    x: Math.max(0, bb.x - pad),
    y: Math.max(0, bb.y - pad),
    w: bb.width + pad * 2,
    h: bb.height + pad * 2,
  };
}

export const FULL_VIEWPORT: Box = { x: 0, y: 0, w: 1440, h: 900 };
