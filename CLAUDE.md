# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Any3D 宣传视频 + 社交卡片生产流水线。用 Playwright 录制真实工具操作 → edge-tts 生成中文配音 → @remotion/captions 构建字幕 → Remotion 渲染 1080×1920 竖屏视频（带虚拟运镜）→ glm-5v-turbo 视觉质检。另有一套独立的 guizang 风格社交卡片生成器（小红书 3:4 + 微信封面）。

ESM 工程（`"type": "module"`），TypeScript 通过 `tsx` 直接运行。无测试框架、无 lint 配置；验证手段是 `pnpm qa`（视觉模型）与 `pnpm studio`（人工预览）。

## 常用命令

所有阶段命令接收 targetId（默认 `model-compression`），卡片类命令还接收 style（`editorial` | `swiss`，默认 `editorial`）与 lang（`zh` | `en`，默认 `zh`，仅影响卡片文案；截图 UI 语言跟随站点默认路由）。

| 命令 | 作用 |
|------|------|
| `pnpm capture <id>` | Playwright 录制，输出 `tmp/<id>/frames/*.jpg` + `captures.json` + `capture.webm` |
| `pnpm narrate <id>` | edge-tts 生成 `narration.mp3` + `narration-timing.json` |
| `pnpm captions <id>` | 由配音时序生成 `captions.json`（无需 ASR） |
| `pnpm render <id>` | Remotion 渲染最终 `out/<id>.mp4` |
| `pnpm qa <id>` | 提取关键帧送 glm-5v-turbo 检查 → `qa-report.json` |
| `pnpm card <id> <style> [lang]` | 卡片生成 + 渲染 → `out/<id>/cards/*.png` |
| `pnpm card:shots <id>` | 重走 capture flow，按 anchor 截核心元素 → `tmp/<id>/card/frames/*.png` |
| `pnpm card:generate <id> <style> [lang]` | 仅生成卡片 HTML（`tmp/<id>/card/index.html`），不截图 |
| `pnpm studio` | Remotion Studio 预览 |
| `pnpm all <id> [skipCsv] [style] [lang]` | 完整流水线（视频 + 卡片），skipCsv 用逗号跳过步骤 |
| `pnpm all:cards <id> [style] [lang]` | 仅卡片流水线（跳过视频） |

跳过步骤示例：`pnpm all model-compression capture,narrate`。`run-all.ts` 内的 7 个步骤名为：`capture, narrate, captions, render, qa, frames, cards`（`frames` 步骤对应 `capture/card-shots.ts`：重走 flow 按 anchor 截图）。

类型检查（无独立 script）：`npx tsc --noEmit`。

## 架构

### 数据流（一次 `pnpm all` 的产物链）

```
config/video-targets.ts  ← 中央注册表（静态：旁白/镜头/时长）
        │
        ▼
capture  →  tmp/<id>/frames/*.jpg + captures.json(resolvedShots=静态shots叠加上实测算子框) + capture.webm
        │
narrate  →  tmp/<id>/narration.mp3 + narration-timing.json
        │
captions →  tmp/<id>/captions.json（按时序把旁白切分为 ≤12 字的 cue）
        │
   src/Root.tsx  在注册 Composition 时读取 captures.json + captions.json，
   把 resolvedShots / captionCues 作为 defaultProps 注入 PromoVideo
        │
render   →  out/<id>.mp4（bundle src/index.ts → selectComposition → renderMedia）
        │
qa       →  ffmpeg 抽帧 → glm-5v-turbo → tmp/<id>/qa-report.json
        │
frames   →  capture/card-shots.ts 重走 flow，按 anchor 截核心元素到 tmp/<id>/card/frames/*.png
        │
cards    →  generate.ts 用 guizang 模板拼 HTML → render.ts 逐 .poster 截图 → out/<id>/cards/*.png
```

### 核心设计要点（需读多个文件才能理解）

- **双模式模块**：每个阶段模块既是可导入函数（`export async function xxx(targetId)`），又是可直接运行的 CLI——文件末尾的 `const targetId = process.argv[2]...; xxx(...)` 块是入口，不是死代码。新增逻辑时复用已导出的函数，勿重复实现。

- **中央注册表 `config/video-targets.ts`**：`VIDEO_TARGETS` 是唯一真相源。`VideoTarget.narration` 段落的 `start`（秒）需与 `shots` 的 `frame`（30fps，即 frame/30 = 秒）时序对齐，且总时长需与 `durationSeconds` 自洽。

- **镜头 ↔ 录制锚点耦合**：`shots[].label` 必须与 capture flow 写入 `anchors` 的 key 完全一致（如 `upload-zone`、`settings-panel`）。recorder 会用 `anchors[label]` 覆盖静态 `region` 得到 `resolvedShots`；匹配不上则回退到静态 region 或全画幅。改镜头名要同步改 capture flow。

- **虚拟运镜数学（`src/VirtualCamera.tsx`）**：源视口固定 1440×900，输出 1080×1920，30fps。所有 region 坐标在源空间。`scale = OUT_H / rect.h`，`transformOrigin: top left` + translate。`computeCamera` 在相邻两镜头间用 cubic bezier 插值，`endBehavior` 提供缓慢推/摇。改运镜调 `computeCamera` 或 `shots` 数组。

- **capture flow 契约（`capture/targets/<id>.ts`）**：`export default { run(page, fixtureFile, hooks?): Promise<AnchorMap> }`（类型见 `capture/types.ts`）。必须用条件式等待（`waitForFunction` / `waitForSelector`）等待状态变化，禁止用固定 sleep 等待状态——这是确定性录制的硬性要求（仅动画/视觉稳定处用 `waitForTimeout`）。可选 `hooks.onAnchor(label, locator, page)` 在每个 anchor 稳定后回调：视频录制不传，卡片截图（`capture/card-shots.ts`）用它做 `element.screenshot()`，从而截到稳定局部、而非整屏或加载态。新增 anchor 时在该处 `measure` 后挂 `await hooks?.onAnchor?.(label, locator, page)`。

- **guizang 卡片系统（`card/generate.ts`）**：CSS class 体系定义在 `card/assets/template-{editorial,swiss}-card.html` 模板里，不在 TS 中。生成器用正则把 `<!-- POSTERS_HERE -->` 处替换为各 frame 的 HTML、把 `[必填]` 替换为标题、按 style 注入 `data-theme`。新增视觉样式优先改模板的 class，TS 只负责拼 DOM 结构。背景图与 WebGL 脚本会从 `card/assets/` 拷到产物目录。

- **anchor label ↔ 卡片截图对齐**：`capture/card-shots.ts` 按 capture flow 的 anchor label（`upload-zone`、`settings-panel`、`preview-result` 等）截图到 `tmp/<id>/card/frames/<label>.png`；`card/specs.ts` 的 `screenshot: "../frames/<label>.png"` 必须用同一 label，否则图片缺失。新增 anchor 要同步 specs，并配 `shotAspect`（容器画幅需匹配被截元素比例）。卡片文案双语见 `card/specs.ts` 的 `COPY` 字典。

- **导入路径写 `.js` 后缀**：所有相对导入用 `./Foo.js` 形式（`moduleResolution: bundler` + `tsx` 解析到 `.ts`）。新增文件保持此约定。

## 添加新工具（三处联动）

1. 在 `config/video-targets.ts` 的 `VIDEO_TARGETS` 加条目（id / url / fixtureFile / narration / shots / durationSeconds / coverTitle 等）。
2. 新建 `capture/targets/<id>.ts`，导出 `{ run }`，其返回的 anchors key 与 `shots[].label` 对齐。
3. 在 `src/Root.tsx` 的 `ids` 数组里加入该 id。
4. 运行 `pnpm all <id>`。

## 运行前置

- Node 20+；系统 ffmpeg（QA 抽帧用）；本地 Any3D dev server 跑在 `TARGET_BASE_URL`（默认 `http://localhost:3000`）。
- 录制需 headful Chromium + 真实 GPU（WebGL/three.js），已通过 `--use-gl=desktop` 等参数启用；无 GPU 环境会渲染异常。
- 录制前在 `fixtures/` 放入示例模型（`fixtures/sample.glb`，被 gitignore）。
- `.env` 仅视觉 QA 与可选文本模型需要（见 `.env.example`）；未设 `QA_VISION_API_KEY` 时 QA 阶段自动跳过。
