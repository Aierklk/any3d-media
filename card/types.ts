/**
 * Social card pipeline types.
 *
 * A CardSpec describes one card set for a tool: which platform, which
 * style, what content. The generator turns it into HTML using the
 * guizang seed templates; the renderer turns the HTML into PNGs.
 */

export type CardStyle = "editorial" | "swiss";

export type Platform = "xhs" | "wechat-wide" | "wechat-square";

export interface CardFrame {
  id: string;
  platform: Platform;
  title: string;
  subtitle?: string;
  /** Body bullets or paragraphs, one per item. */
  body?: string[];
  /** Path to a screenshot image (relative to the card HTML output dir). */
  screenshot?: string;
  /** Optional KPI/metric items for data-style cards. */
  metrics?: Array<{ label: string; value: string }>;
  /** Cover-only pages skip body and show title + visual. */
  role: "cover" | "content" | "summary" | "outro";
}

export interface CardSpec {
  toolId: string;
  style: CardStyle;
  theme?: string;
  frames: CardFrame[];
}

export interface RenderTarget {
  selector: string;
  filename: string;
  width: number;
  height: number;
}
