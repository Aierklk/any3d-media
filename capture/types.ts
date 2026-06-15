import type { Page, Locator } from "playwright";

/** 元素在固定 1440×900 源视口空间内的矩形（measure 已含 pad margin）。 */
export interface AnchorBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AnchorMap = Record<string, AnchorBox>;

/**
 * capture flow 的可选钩子。每个 anchor 测量稳定后被调用一次。
 * 视频录制不传；卡片截图流程用它对核心元素做 element.screenshot()。
 */
export interface CaptureFlowHooks {
  onAnchor?(label: string, locator: Locator, page: Page): Promise<void>;
}

/**
 * capture flow 契约：驱动某工具走完演示流程，返回各操作区的 bounding box。
 * 这是 capture/targets/<id>.ts 的 default export 形状。
 * hooks 让同一套 flow 既可驱动视频录制，也可驱动卡片分步截图。
 */
export interface CaptureFlow {
  run(page: Page, fixtureFile: string, hooks?: CaptureFlowHooks): Promise<AnchorMap>;
}
