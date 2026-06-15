import { recordTarget } from "../capture/recorder.js";
import { generateNarration } from "../narration/tts.js";
import { buildCaptions } from "../captions/build.js";
import { render } from "./render.js";
import { runVisualQA } from "../qa/visual-qa.js";
import { captureCardShots } from "../capture/card-shots.js";
import { generateCards } from "../card/generate.js";
import { renderCards } from "../card/render.js";
import { buildToolCardSpec } from "../card/specs.js";
import type { CardStyle, Lang } from "../card/types.js";
import { join } from "node:path";

const STEPS = ["capture", "narrate", "captions", "render", "qa", "frames", "cards"] as const;

async function main() {
  const targetId = process.argv[2] ?? "model-compression";
  const skipRaw = process.argv[3] ?? "";
  const skip = skipRaw.split(",").map((s) => s.trim());
  const cardStyle: CardStyle = (process.argv[4] as CardStyle) ?? "editorial";
  const cardLang: Lang = (process.argv[5] as Lang) ?? "zh";

  console.log(`\n=== any3d-media pipeline: ${targetId} ===\n`);

  if (!skip.includes("capture")) {
    console.log("\n--- Step 1/7: Capture ---");
    await recordTarget(targetId);
  }

  if (!skip.includes("narrate")) {
    console.log("\n--- Step 2/7: Narration (TTS) ---");
    await generateNarration(targetId);
  }

  if (!skip.includes("captions")) {
    console.log("\n--- Step 3/7: Captions ---");
    await buildCaptions(targetId);
  }

  if (!skip.includes("render")) {
    console.log("\n--- Step 4/7: Render ---");
    await render(targetId);
  }

  if (!skip.includes("qa")) {
    console.log("\n--- Step 5/7: Visual QA ---");
    const outPath = join(process.cwd(), "out", `${targetId}.mp4`);
    await runVisualQA(targetId, outPath);
  }

  if (!skip.includes("frames")) {
    console.log("\n--- Step 6/7: Capture card screenshots ---");
    await captureCardShots(targetId);
  }

  if (!skip.includes("cards")) {
    console.log("\n--- Step 7/7: Generate social cards ---");
    const spec = await buildToolCardSpec(targetId, cardStyle, cardLang);
    const { htmlPath, targets } = await generateCards(spec);
    await renderCards(targetId, htmlPath, targets);
  }

  console.log(`\n=== Pipeline complete: out/${targetId}.mp4 + out/${targetId}/cards/ ===\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
