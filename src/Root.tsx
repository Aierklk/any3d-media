import { Composition } from "remotion";
import { PromoVideo, type PromoVideoProps } from "./PromoVideo.js";
import { getTarget } from "../config/video-targets.js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadTargetData(targetId: string) {
  const target = getTarget(targetId);
  const tmpDir = join(ROOT, "tmp", targetId);

  let captionCues: Array<{ text: string; startMs: number; endMs: number }> = [];
  const captionsFile = join(tmpDir, "captions.json");
  if (existsSync(captionsFile)) {
    captionCues = JSON.parse(readFileSync(captionsFile, "utf-8"));
  }

  const captureFile = join(tmpDir, "captures.json");
  let resolvedShots = target.shots;
  if (existsSync(captureFile)) {
    const data = JSON.parse(readFileSync(captureFile, "utf-8"));
    resolvedShots = data.resolvedShots ?? target.shots;
  }

  return {
    target,
    captionCues,
    resolvedShots,
    srcVideo: `tmp/${targetId}/capture.webm`,
    narrationAudio: `tmp/${targetId}/narration.mp3`,
  };
}

export const RemotionRoot: React.FC = () => {
  const ids = ["model-compression"];

  return (
    <>
      {ids.map((id) => {
        const { target, captionCues, resolvedShots, srcVideo, narrationAudio } = loadTargetData(id);
        const durationInFrames = Math.round(target.durationSeconds * 30);
        const props: PromoVideoProps = {
          shots: resolvedShots,
          captionCues,
          coverTitle: target.coverTitle,
          coverSubtitle: target.coverSubtitle,
          srcVideo,
          narrationAudio,
        };
        return (
          <Composition<any, PromoVideoProps>
            key={id}
            id={id}
            component={PromoVideo}
            durationInFrames={durationInFrames}
            fps={30}
            width={1080}
            height={1920}
            defaultProps={props}
          />
        );
      })}
    </>
  );
};
