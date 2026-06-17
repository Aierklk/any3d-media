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
    coverSubtitle: "浏览器内一键减重，最高 95%",
    squareTitle: "3D 模型压缩",
    steps: [
      {
        title: "调整压缩参数",
        body: [
          "智能网格简化 — 可视化滑块控制多边形精简比例",
          "Draco 几何编码 — 不减面数也能大幅压缩，视觉几乎无差异",
          "纹理智能压缩 — 支持 WebP / JPEG / KTX2 等多种格式，自动检测 + 尺寸缩放",
        ],
      },
      {
        title: "一键压缩",
        body: ["浏览器内全流程处理 + 实时 3D 预览，无需上传服务器，隐私安全"],
      },
      {
        title: "压缩效果",
        metrics: [
          { label: "体积减少", value: "≤95%" },
          { label: "处理时间", value: "10s" },
          { label: "格式输出", value: "GLB" },
          { label: "质量损失", value: "极低" },
        ],
      },
    ],
  },
  en: {
    coverTitle: "3D Model Compression",
    coverSubtitle: "Up to 95% smaller, right in the browser",
    squareTitle: "3D Compression",
    steps: [
      {
        title: "Tune compression",
        body: [
          "Smart mesh simplification — visual slider controls polygon reduction ratio",
          "Draco geometry encoding — compress without reducing faces, visually lossless",
          "Smart texture compression — auto-detect textures, WebP conversion + resize + quality tuning",
        ],
      },
      {
        title: "One-click compress",
        body: ["Full in-browser pipeline, no server upload, privacy-safe", "Real-time 3D preview with instant visual feedback"],
      },
      {
        title: "Results",
        metrics: [
          { label: "Size reduction", value: "Up to 95%" },
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
  const [settings, compress, results] = copy.steps;

  // Twitter (X) is an English-facing channel — the deck copy is always taken
  // from the EN dictionary regardless of the requested lang, so the same
  // `pnpm card <id> zh` run also emits an English 4:5 card for X.
  const tw = COPY.en;

  const frames: CardFrame[] = [
    {
      id: "xhs-infographic",
      platform: "xhs",
      role: "infographic",
      title: copy.coverTitle,
      subtitle: copy.coverSubtitle,
      // All content merged into one frame — the generator builds a
      // single rich poster instead of N separate cards.
      screenshots: [
        { src: "./frames/settings-preview.png", aspect: "4x3" },
      ],
      body: [...(settings.body ?? []), ...(compress.body ?? [])],
      metrics: results.metrics,
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
    {
      // X / Twitter in-feed image — 4:5 (1080×1350) is the max-display
      // aspect on mobile. Always English for an international audience:
      // copy from COPY.en, and the screenshot is the en-US UI capture
      // written by `pnpm card:shots <id> --en` to tmp/<id>/card/frames-en/.
      //
      // Content is trimmed vs the xhs deck: 4:5 has less vertical room than
      // 3:4, so we keep the 2 strongest bullets (one per step) + a wider
      // 16:9 screenshot (flatter than 16x10 → less height consumed) so the
      // KPI grid stays fully visible above the fold.
      id: "twitter-infographic",
      platform: "twitter",
      role: "infographic",
      title: tw.coverTitle,
      subtitle: tw.coverSubtitle,
      screenshots: [
        { src: "./frames-en/settings-preview.png", aspect: "16x9" },
      ],
      body: [
        tw.steps[0].body?.[0] ?? "",
        tw.steps[1].body?.[0] ?? "",
      ].filter(Boolean),
      metrics: tw.steps[2].metrics,
    },
  ];

  return {
    toolId,
    style,
    lang,
    theme: style === "editorial" ? "ink-classic" : undefined,
    accent: style === "swiss" ? "any3d-blue" : undefined,
    frames,
  };
}
