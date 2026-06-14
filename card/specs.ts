/**
 * Card specifications per tool.
 *
 * Each function takes a toolId and style, and returns a CardSpec that
 * the generator turns into HTML. Screenshots reference frames captured
 * during video recording (e.g. tmp/model-compression/frames/001200.jpg).
 */

import { getTarget } from "../config/video-targets.js";
import type { CardSpec, CardFrame, CardStyle } from "./types.js";

export async function buildToolCardSpec(toolId: string, style: CardStyle): Promise<CardSpec> {
  const target = getTarget(toolId);

  const frames: CardFrame[] = [
    {
      id: "xhs-01",
      platform: "xhs",
      role: "cover",
      title: target.coverTitle,
      subtitle: target.coverSubtitle,
    },
    {
      id: "xhs-02",
      platform: "xhs",
      role: "content",
      title: "上传模型文件",
      body: ["支持 GLB、GLTF、OBJ、FBX、STL、PLY 格式", "拖拽或点击上传，浏览器内处理"],
      screenshot: "../frames/000100.jpg",
    },
    {
      id: "xhs-03",
      platform: "xhs",
      role: "content",
      title: "调整压缩参数",
      body: ["网格简化比例", "纹理质量与最大尺寸", "Draco 压缩级别"],
      screenshot: "../frames/000300.jpg",
    },
    {
      id: "xhs-04",
      platform: "xhs",
      role: "content",
      title: "一键压缩",
      body: ["点击压缩按钮，几秒内完成", "实时查看原始与压缩效果对比"],
      screenshot: "../frames/000500.jpg",
    },
    {
      id: "xhs-05",
      platform: "xhs",
      role: "summary",
      title: "压缩效果",
      metrics: [
        { label: "体积减少", value: "70%" },
        { label: "处理时间", value: "5s" },
        { label: "格式输出", value: "GLB" },
        { label: "质量损失", value: "极低" },
      ],
    },
    {
      id: "wechat-wide",
      platform: "wechat-wide",
      role: "cover",
      title: target.coverTitle,
      subtitle: target.coverSubtitle,
    },
    {
      id: "wechat-square",
      platform: "wechat-square",
      role: "cover",
      title: "3D模型压缩",
    },
  ];

  return {
    toolId,
    style,
    theme: style === "editorial" ? "ink-classic" : undefined,
    frames,
  };
}
