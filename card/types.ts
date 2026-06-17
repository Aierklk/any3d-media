/**
 * Social card pipeline types.
 *
 * A CardSpec describes one card set for a tool: which platform, which
 * style, what content. The generator turns it into HTML using the
 * guizang seed templates; the renderer turns the HTML into PNGs.
 */

export type CardStyle = "editorial" | "swiss";

export type Platform = "xhs" | "wechat-wide" | "wechat-square" | "twitter";

/** 卡片文案语言。截图的 UI 语言固定跟随站点默认路由（见 capture/card-shots）。 */
export type Lang = "zh" | "en";

/** frame-shot 容器画幅，需匹配被截元素的比例以减少 object-fit 留白。 */
export type ShotAspect = "16x10" | "16x9" | "21x9" | "3x2" | "4x3" | "3x4" | "1x1";

export interface CardFrame {
  id: string;
  platform: Platform;
  title: string;
  subtitle?: string;
  /** Body bullets or paragraphs, one per item. */
  body?: string[];
  /** Path to a screenshot image (relative to the card HTML output dir). */
  screenshot?: string;
  /** Multiple screenshots for infographic layout (replaces single screenshot). */
  screenshots?: Array<{ src: string; caption?: string; aspect: ShotAspect }>;
  /** Container aspect ratio for the screenshot well. Defaults to 16x10. */
  shotAspect?: ShotAspect;
  /** Optional KPI/metric items for data-style cards. */
  metrics?: Array<{ label: string; value: string }>;
  /** Cover-only pages skip body and show title + visual. */
  role: "cover" | "content" | "summary" | "outro" | "infographic";
}

export interface CardSpec {
  toolId: string;
  style: CardStyle;
  lang: Lang;
  theme?: string;
  /** Swiss accent name (ikb | lemon-yellow | lemon-green | safety-orange). Only used when style === "swiss". */
  accent?: string;
  frames: CardFrame[];
}

export interface RenderTarget {
  selector: string;
  filename: string;
  width: number;
  height: number;
}
