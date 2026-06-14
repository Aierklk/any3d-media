/**
 * Standalone card pipeline: extract frames + generate + render.
 * Use when you already have captured frames and just want social cards.
 */

import { extractCardFrames } from "./extract-frames.js";
import { generateCards } from "../card/generate.js";
import { renderCards } from "../card/render.js";
import { buildToolCardSpec } from "../card/specs.js";
import type { CardStyle } from "../card/types.js";

async function main() {
  const targetId = process.argv[2] ?? "model-compression";
  const style: CardStyle = (process.argv[3] as CardStyle) ?? "editorial";

  console.log(`\n=== Card pipeline: ${targetId} (${style}) ===\n`);

  await extractCardFrames(targetId);

  const spec = await buildToolCardSpec(targetId, style);
  const { htmlPath, targets } = await generateCards(spec);
  const pngs = await renderCards(targetId, htmlPath, targets);

  console.log(`\n=== Cards complete: ${pngs.length} PNGs ===\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
