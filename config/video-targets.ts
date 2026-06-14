/**
 * Central registry of all video targets (one per tool).
 * To add a new tool's promo video, add an entry here and a matching
 * capture flow in capture/targets/<id>.ts.
 */

export interface VideoTarget {
  /** Unique id, used as the Remotion composition id and output filename. */
  id: string;
  /** URL path on the Any3D site (relative to TARGET_BASE_URL). */
  url: string;
  /** Path to the demo file used during recording (under fixtures/). */
  fixtureFile: string;
  /** Narration script, split into segments aligned with camera shots. */
  narration: NarrationSegment[];
  /** Camera shot list. Coordinates are in the 1440x900 source viewport. */
  shots: ShotSpec[];
  /** Total duration in seconds (must match narration + shots). */
  durationSeconds: number;
  /** Cover title shown at the start and end. */
  coverTitle: string;
  coverSubtitle: string;
}

export interface NarrationSegment {
  /** Spoken text for TTS. */
  text: string;
  /** Start time in seconds within the final video. */
  start: number;
}

export interface ShotSpec {
  /** Label for QA logging. */
  label: string;
  /** Start frame (30fps). */
  frame: number;
  /**
   * Source-viewport rectangle to focus on, in 1440x900 space.
   * If omitted, uses the full viewport (wide establishing shot).
   * These are typically filled in dynamically by the recorder from
   * element bounding boxes; static values here are the fallback.
   */
  region?: { x: number; y: number; w: number; h: number };
  /** Hold this shot until the next shot's frame. */
  endBehavior?: "hold" | "slow-zoom-in" | "slow-pan-right";
}

export const VIDEO_TARGETS: VideoTarget[] = [
  {
    id: "model-compression",
    url: "/zh-CN/tools/model-compression",
    fixtureFile: "fixtures/sample.glb",
    coverTitle: "3D 模型压缩",
    coverSubtitle: "浏览器内一键减重 70%",
    durationSeconds: 30,
    narration: [
      { text: "3D 模型太大？加载慢、传输慢、存储贵。", start: 0 },
      { text: "上传你的模型，Any3D 在浏览器里完成压缩。", start: 4 },
      { text: "拖动滑块，调整网格简化与纹理质量。", start: 9 },
      { text: "点击压缩，几秒内完成。", start: 14 },
      { text: "对比原始与压缩后的效果，几乎看不出差别。", start: 18 },
      { text: "体积减小百分之七十，下载即用。", start: 24 },
    ],
    shots: [
      { label: "establish", frame: 0 },
      { label: "upload-zone", frame: 60, endBehavior: "hold" },
      { label: "settings-panel", frame: 270, endBehavior: "slow-pan-right" },
      { label: "compress-button", frame: 420, endBehavior: "hold" },
      { label: "preview-canvas", frame: 540, endBehavior: "slow-zoom-in" },
      { label: "download-result", frame: 780, endBehavior: "hold" },
      { label: "establish", frame: 870 },
    ],
  },
];

export function getTarget(id: string): VideoTarget {
  const t = VIDEO_TARGETS.find((v) => v.id === id);
  if (!t) throw new Error(`Unknown video target: ${id}`);
  return t;
}
