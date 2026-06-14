import React from "react";
import { AbsoluteFill, Audio, Img, Series, staticFile, useVideoConfig } from "remotion";
import { VirtualCamera, type Shot } from "./VirtualCamera.js";
import { Captions } from "./Captions.js";

export interface PromoVideoProps {
  [key: string]: unknown;
  shots: Shot[];
  captionCues: Array<{ text: string; startMs: number; endMs: number }>;
  coverTitle: string;
  coverSubtitle: string;
  srcVideo?: string;
  srcImage?: string;
  narrationAudio?: string;
}

export const PromoVideo: React.FC<PromoVideoProps> = ({
  shots,
  captionCues,
  coverTitle,
  coverSubtitle,
  srcVideo,
  srcImage,
  narrationAudio,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0f" }}>
      <Series>
        <Series.Sequence durationInFrames={Math.round(3 * fps)}>
          <CoverCard title={coverTitle} subtitle={coverSubtitle} />
        </Series.Sequence>

        <Series.Sequence durationInFrames={Math.round(24 * fps)}>
          <>
            <VirtualCamera shots={shots} srcVideo={srcVideo} srcImage={srcImage} />
            <Captions cues={captionCues} />
          </>
        </Series.Sequence>

        <Series.Sequence durationInFrames={Math.round(3 * fps)}>
          <OutroCard title={coverTitle} subtitle={coverSubtitle} />
        </Series.Sequence>
      </Series>

      {narrationAudio && <Audio src={staticFile(narrationAudio)} />}
    </AbsoluteFill>
  );
};

const CoverCard: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", padding: 40 }}>
        <div
          style={{
            fontFamily: "'PingFang SC','Noto Sans SC',sans-serif",
            fontSize: 110,
            fontWeight: 900,
            color: "#fff",
            textShadow: "0 4px 24px rgba(0,0,0,0.3)",
            marginBottom: 24,
            letterSpacing: 0,
          }}
        >
          {title}
        </div>
        <p
          style={{
            fontFamily: "'PingFang SC','Noto Sans SC',sans-serif",
            fontSize: 42,
            fontWeight: 500,
            color: "rgba(255,255,255,0.9)",
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      </div>
    </AbsoluteFill>
  );
};

const OutroCard: React.FC<{ title: string; subtitle: string }> = ({ title }) => {
  return (
    <AbsoluteFill style={{ background: "#0b0b0f", justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: "'PingFang SC','Noto Sans SC',sans-serif",
            fontSize: 96,
            fontWeight: 900,
            color: "#fff",
            marginBottom: 32,
            margin: 0,
          }}
        >
          {title}
        </p>
        <p style={{ fontSize: 38, color: "rgba(255,255,255,0.7)", fontFamily: "sans-serif", margin: 0 }}>
          any3d.com
        </p>
      </div>
    </AbsoluteFill>
  );
};
