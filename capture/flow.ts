import type { CaptureFlow } from "./types.js";

/**
 * Dynamically load a capture flow for a target.
 * Shared by the video recorder and the card screenshoter so the same
 * flow drives both pipelines.
 */
export async function loadFlow(targetId: string): Promise<CaptureFlow> {
  const mod = await import(`./targets/${targetId}.js`);
  return mod.default as CaptureFlow;
}
