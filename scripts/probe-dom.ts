import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "../fixtures/sample.glb");

const browser = await chromium.launch({
  headless: false,
  channel: process.env.CAPTURE_CHANNEL,
  args: ["--use-gl=desktop", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox", "--window-size=1440,900", "--force-color-profile=srgb"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/zh-CN/tools/model-compression", { waitUntil: "networkidle" });
await page.waitForSelector('[role="button"]', { state: "visible", timeout: 15000 });
await page.waitForTimeout(800);

console.log("Uploading fixture...");
await page.locator('input[type="file"][accept*=".glb"]').setInputFiles(fixturePath);
await page.waitForSelector("canvas", { state: "attached", timeout: 60000 });
await page.waitForTimeout(4000);
console.log("Model loaded. Probing post-upload DOM...\n");

const dump = await page.evaluate(`(() => {
  const chain = (el, n) => {
    const out = [];
    let cur = el;
    for (let i = 0; i < n && cur; i++, cur = cur.parentElement) {
      out.push(cur.tagName.toLowerCase() + (cur.id ? '#' + cur.id : '') + '.' + (cur.className || '').toString().slice(0, 54));
    }
    return out;
  };
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const canvases = Array.from(document.querySelectorAll('canvas')).map((c) => ({
    size: { w: c.width, h: c.height },
    rect: rect(c),
    parents: chain(c.parentElement, 5),
  }));
  const ranges = Array.from(document.querySelectorAll('input[type="range"], input[type="number"]')).map((r) => ({
    label: r.getAttribute('aria-label') || r.getAttribute('name') || '?',
    parents: chain(r.parentElement, 4),
  }));
  const buttons = Array.from(document.querySelectorAll('button')).map((b) => ({
    text: (b.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 24),
    rect: rect(b),
  })).filter((b) => /压缩|下载|Compress|Download|重置|Reset/.test(b.text));
  return { canvases, ranges, buttons };
})()`);
console.log(JSON.stringify(dump, null, 2));

await browser.close();
