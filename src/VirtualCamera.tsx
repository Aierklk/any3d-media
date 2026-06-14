import React, { useMemo } from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, Easing, Video } from "remotion";

export interface Shot {
  frame: number;
  label: string;
  region?: { x: number; y: number; w: number; h: number };
  endBehavior?: "hold" | "slow-zoom-in" | "slow-pan-right";
}

interface VirtualCameraProps {
  shots: Shot[];
  frameDir?: string;
  totalFrames?: number;
  srcVideo?: string;
  srcImage?: string;
}

const SRC_W = 1440;
const SRC_H = 900;
const OUT_W = 1080;
const OUT_H = 1920;

type Rect = { x: number; y: number; w: number; h: number };

const FULL: Rect = { x: 0, y: 0, w: SRC_W, h: SRC_H };

export const VirtualCamera: React.FC<VirtualCameraProps> = ({
  shots,
  srcVideo,
  srcImage,
}) => {
  const frame = useCurrentFrame();

  const sortedShots = useMemo(
    () => [...shots].sort((a, b) => a.frame - b.frame),
    [shots],
  );

  const { rect, rotation } = computeCamera(frame, sortedShots);

  const scale = OUT_H / rect.h;
  const offsetX = -(rect.x * scale) + (OUT_W - rect.w * scale) / 2;
  const offsetY = -(rect.y * scale);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0f", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: SRC_W,
          height: SRC_H,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale}) rotate(${rotation}deg)`,
          transformOrigin: "top left",
        }}
      >
        {srcVideo && <Video src={srcVideo} style={{ width: SRC_W, height: SRC_H, objectFit: "cover" }} />}
        {srcImage && <Img src={srcImage} style={{ width: SRC_W, height: SRC_H, objectFit: "cover" }} />}
      </div>
    </AbsoluteFill>
  );
};

function computeCamera(frame: number, shots: Shot[]): { rect: Rect; rotation: number } {
  if (shots.length === 0) return { rect: FULL, rotation: 0 };

  let i = 0;
  for (let k = 0; k < shots.length - 1; k++) {
    if (frame >= shots[k].frame && frame < shots[k + 1].frame) {
      i = k;
      break;
    }
    if (frame >= shots[shots.length - 1].frame) {
      i = shots.length - 2;
      break;
    }
  }
  i = Math.max(0, Math.min(i, shots.length - 2));

  const a = shots[i];
  const b = shots[i + 1];
  const aRect = a.region ?? FULL;
  const bRect = b.region ?? FULL;

  const progress = interpolate(
    frame,
    [a.frame, b.frame],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.42, 0, 0.58, 1) },
  );

  let cx = aRect.x + aRect.w / 2 + (bRect.x + bRect.w / 2 - (aRect.x + aRect.w / 2)) * progress;
  let cy = aRect.y + aRect.h / 2 + (bRect.y + bRect.h / 2 - (aRect.y + aRect.h / 2)) * progress;
  let cw = aRect.w + (bRect.w - aRect.w) * progress;
  let ch = aRect.h + (bRect.h - aRect.h) * progress;

  if (a.endBehavior === "slow-zoom-in" && progress < 0.5) {
    const z = interpolate(progress, [0, 0.5], [1, 0.85]);
    cw *= z;
    ch *= z;
  }
  if (a.endBehavior === "slow-pan-right") {
    cx += progress * 60;
  }

  const rect = clampToSource({ x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch });
  return { rect, rotation: 0 };
}

function clampToSource(r: Rect): Rect {
  let { x, y, w, h } = r;
  w = Math.max(400, Math.min(w, SRC_W));
  h = Math.max(400, Math.min(h, SRC_H));
  x = Math.max(0, Math.min(x, SRC_W - w));
  y = Math.max(0, Math.min(y, SRC_H - h));
  return { x, y, w, h };
}
