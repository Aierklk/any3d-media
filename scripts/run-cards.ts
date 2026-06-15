/**
 * Standalone card pipeline: capture screenshots + generate + render.
 * Use when you already have a recorded video and just want social cards.
 *
 *   pnpm all:cards <id> [style] [lang]
 */

import { captureCardShots } from "../capture/card-shots.js";
import { generateCards } from "../card/generate.js";
import { renderCards } from "../card/render.js";
import { buildToolCardSpec } from "../card/specs.js";
import type { CardStyle, Lang } from "../card/types.js";

async function main() {
  const targetId = process.argv[2] ?? "model-compression";
  const style: CardStyle = (process.argv[3] as CardStyle) ?? "editorial";
  const lang: Lang = (process.argv[4] as Lang) ?? "zh";

  console.log(`\n=== Card pipeline: ${targetId} (${style}, ${lang}) ===\n`);

  await captureCardShots(targetId);

  const spec = await buildToolCardSpec(targetId, style, lang);
  const { htmlPath, targets } = await generateCards(spec);
  const pngs = await renderCards(targetId, htmlPath, targets);

  console.log(`\n=== Cards complete: ${pngs.length} PNGs ===\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
