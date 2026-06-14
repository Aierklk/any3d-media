import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(2);
// WebGL (three.js) needs real GPU; fall back to SwiftShader if no GPU.
Config.setChromiumOpenGlRenderer("angle");
