# any3d-media

Any3D promotional video production pipeline. Records real tool operations with Playwright, adds TTS narration and captions, renders a portrait video with cinematic camera movement via Remotion, and runs visual QA with glm-5v-turbo.

## Architecture

```
capture/          Playwright drives the real Any3D app, records frames + element anchors
narration/        edge-tts generates Chinese voiceover with per-segment timestamps
captions/         Narration timing -> @remotion/captions JSON (no ASR needed)
src/              Remotion compositions: VirtualCamera, PromoVideo, Captions
qa/               Visual QA via glm-5v-turbo - checks focal elements, text, artifacts
card/             Social card pipeline (guizang-style XHS + WeChat covers)
  generate.ts     CardSpec -> HTML using guizang seed templates
  render.ts       HTML -> PNG via Playwright
  specs.ts        Per-tool card content definitions
  assets/         Guizang seed templates + 9 screenshot-background WebPs
scripts/          render.ts (video) + run-all.ts (full) + run-cards.ts (cards only)
config/           video-targets.ts - registry of all tools to produce videos for
fixtures/         Demo model files for recording
```

## Prerequisites

- Node.js 20+
- ffmpeg (system-installed, for frame extraction in QA)
- A local Any3D dev server running on localhost:3000
- Optional: glm-5v-turbo API key for automated visual QA

## Setup

```bash
cd D:/Codes/any3d-media
pnpm install
npx playwright install chromium
cp .env.example .env  # fill in API keys if using visual QA
```

Place a sample GLB file at `fixtures/sample.glb`.

## Pipeline stages

| Stage | Command | What it does |
|-------|---------|-------------|
| Capture | `pnpm capture model-compression` | Launches headful Chromium, drives the tool, records frames + anchors |
| Narrate | `pnpm narrate model-compression` | edge-tts generates narration.mp3 with timestamps |
| Captions | `pnpm captions model-compression` | Builds caption cues from narration timing |
| Render | `pnpm render model-compression` | Remotion renders the final 1080x1920 MP4 |
| QA | `pnpm qa model-compression` | glm-5v-turbo inspects key frames for issues |
| Cards | `pnpm card model-compression editorial` | Generates XHS 3:4 cards + WeChat covers from captured frames |

### Full pipeline (video + cards)

```bash
pnpm all model-compression
```

Cards only (skip video):

```bash
pnpm all:cards model-compression
```

Skip stages with comma-separated names:

```bash
pnpm all model-compression capture,narrate
```

### Social card styles

The card pipeline supports two visual systems from guizang:

- **editorial** — magazine feel with serif typography, paper textures
- **swiss** — engineering grid with Inter sans-serif, data-driven

```bash
pnpm card model-compression editorial
pnpm card model-compression swiss
```

Output: `out/<id>/cards/` with XHS 3:4 pages + WeChat 21:9 and 1:1 covers.

## How camera movement works

The VirtualCamera component pans and zooms within a 1440x900 source viewport to produce a 1080x1920 portrait output. Shot anchors (element bounding boxes) are measured live during Playwright recording and stored in `captures.json`. Between shots, the camera interpolates smoothly with cubic easing.

To adjust camera movement for a tool, edit the `shots` array in `config/video-targets.ts`.

## Adding a new tool

1. Add an entry to `VIDEO_TARGETS` in `config/video-targets.ts`
2. Create `capture/targets/<id>.ts` with a flow that drives the tool's UI
3. Add the id to the `ids` array in `src/Root.tsx`
4. Run `pnpm all <id>`

## Models

- **Visual QA**: glm-5v-turbo (OpenAI-compatible API at bigmodel.cn)
- **Text/narration polish** (optional): moonshotai/kimi-k2.6
- **TTS**: edge-tts-node (free, no API key, uses Microsoft Edge's online TTS)

## Output

Final videos go to `out/<id>.mp4`. Intermediate artifacts (frames, captures.json, narration-timing.json, captions.json, qa-report.json) are in `tmp/<id>/`.
