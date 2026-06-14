import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

interface CaptionCue {
  text: string;
  startMs: number;
  endMs: number;
}

interface CaptionsProps {
  cues: CaptionCue[];
}

export const Captions: React.FC<CaptionsProps> = ({ cues }) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const nowMs = (frame / fps) * 1000;

  const active = cues.find((c) => nowMs >= c.startMs && nowMs < c.endMs);
  if (!active) return null;

  const localFrame = frame - (active.startMs / 1000) * fps;
  const opacity = interpolate(localFrame, [0, 3, (active.endMs - active.startMs) / 1000 * fps - 3, (active.endMs - active.startMs) / 1000 * fps], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 180 }}>
      <div
        style={{
          opacity,
          background: "rgba(0,0,0,0.72)",
          borderRadius: 14,
          padding: "16px 36px",
          maxWidth: "82%",
        }}
      >
        <span
          style={{
            fontFamily: "'PingFang SC','Noto Sans SC',sans-serif",
            fontSize: 64,
            fontWeight: 800,
            color: "#fff",
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            lineHeight: 1.2,
            letterSpacing: 0,
          }}
        >
          {active.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
