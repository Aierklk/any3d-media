/**
 * Card specifications per tool.
 *
 * buildToolCardSpec takes a toolId, style, and lang, returning a CardSpec
 * the generator turns into HTML. Screenshots reference element PNGs captured
 * by capture/card-shots.ts under tmp/<id>/card/frames/<label>.png.
 *
 * Screenshots are keyed by capture-flow anchor label (upload-zone, settings-
 * panel, preview-result …) — NOT by video frame number — so they are always
 * the stable, post-load view of the right UI zone. No loading spinners, no
 * full-viewport crops needing a second trim.
 *
 * Card copy lives here (per-lang), independent of config/video-targets.ts,
 * which is the video registry (its narration language is out of scope).
 */

import type { CardSpec, CardFrame, CardStyle, Lang } from "./types.js";

interface FrameCopy {
  title: string;
  subtitle?: string;
  body?: string[];
  metrics?: Array<{ label: string; value: string }>;
}

interface ToolCopy {
  coverTitle: string;
  coverSubtitle: string;
  squareTitle: string;
  /** xhs content + summary steps, in order: upload → settings → compress → results. */
  steps: FrameCopy[];
}

const COPY: Record<Lang, ToolCopy> = {
  zh: {
    coverTitle: "3D 模型压缩",
    coverSubtitle: "浏览器内一键减重 70%",
    squareTitle: "3D 模型压缩",
    steps: [
      {
        title: "上传模型文件",
        body: ["支持 GLB、GLTF、OBJ、FBX、STL、PLY 格式", "拖拽或点击上传，浏览器内处理"],
      },
      {
        title: "调整压缩参数",
        body: ["网格简化比例", "纹理质量与最大尺寸", "Draco 压缩级别"],
      },
      {
        title: "一键压缩",
        body: ["点击压缩按钮，几秒内完成", "实时查看原始与压缩效果对比"],
      },
      {
        title: "压缩效果",
        metrics: [
          { label: "体积减少", value: "70%" },
          { label: "处理时间", value: "5s" },
          { label: "格式输出", value: "GLB" },
          { label: "质量损失", value: "极低" },
        ],
      },
    ],
  },
  en: {
    coverTitle: "3D Model Compression",
    coverSubtitle: "70% smaller, right in the browser",
    squareTitle: "3D Compression",
    steps: [
      {
        title: "Upload your model",
        body: ["GLB, GLTF, OBJ, FBX, STL, PLY supported", "Drag-and-drop or click — processed in-browser"],
      },
      {
        title: "Tune compression",
        body: ["Mesh simplification ratio", "Texture quality & max size", "Draco compression level"],
      },
      {
        title: "One-click compress",
        body: ["Hit compress — done in seconds", "Compare original vs. compressed live"],
      },
      {
        title: "Results",
        metrics: [
          { label: "Size reduction", value: "70%" },
          { label: "Time", value: "5s" },
          { label: "Output", value: "GLB" },
          { label: "Quality loss", value: "Minimal" },
        ],
      },
    ],
  },
};

export async function buildToolCardSpec(toolId: string, style: CardStyle, lang: Lang = "zh"): Promise<CardSpec> {
  const copy = COPY[lang];
  const [upload, settings, compress, results] = copy.steps;

  const frames: CardFrame[] = [
    {
      id: "xhs-01",
      platform: "xhs",
      role: "cover",
      title: copy.coverTitle,
      subtitle: copy.coverSubtitle,
    },
    {
      id: "xhs-02",
      platform: "xhs",
      role: "content",
      ...upload,
      screenshot: "../frames/upload-zone.png",
      shotAspect: "16x9",
    },
    {
      id: "xhs-03",
      platform: "xhs",
      role: "content",
      ...settings,
      screenshot: "../frames/settings-panel.png",
      shotAspect: "3x4",
    },
    {
      id: "xhs-04",
      platform: "xhs",
      role: "content",
      ...compress,
      screenshot: "../frames/preview-result.png",
      shotAspect: "1x1",
    },
    {
      id: "xhs-05",
      platform: "xhs",
      role: "summary",
      ...results,
    },
    {
      id: "wechat-wide",
      platform: "wechat-wide",
      role: "cover",
      title: copy.coverTitle,
      subtitle: copy.coverSubtitle,
    },
    {
      id: "wechat-square",
      platform: "wechat-square",
      role: "cover",
      title: copy.squareTitle,
    },
  ];

  return {
    toolId,
    style,
    lang,
    theme: style === "editorial" ? "ink-classic" : undefined,
    frames,
  };
}
