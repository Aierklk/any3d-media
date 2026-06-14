import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import { mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

export async function render(targetId: string) {
  console.log(`[render] Bundling Remotion entry...`);
  const entryPoint = join(ROOT, "src", "index.ts");
  const serveUrl = await bundle({ entryPoint });

  console.log(`[render] Selecting composition "${targetId}"...`);
  const composition = await selectComposition({ serveUrl, id: targetId });

  const outDir = join(ROOT, "out");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${targetId}.mp4`);

  console.log(`[render] Rendering to ${outPath}...`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outPath,
    chromiumOptions: {
      enableMultiProcessOnLinux: false,
      gl: "angle",
    },
  });

  console.log(`[render] Done: ${outPath}`);
  return outPath;
}

const targetId = process.argv[2] ?? "model-compression";
render(targetId).catch((e) => {
  console.error(e);
  process.exit(1);
});
