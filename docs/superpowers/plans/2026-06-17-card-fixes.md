# Card Fixes: Twitter Bottom Clip + Navbar Removal + URL Priority

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix X/Twitter card bottom clipping, remove site navbar from card screenshots, and ensure localhost:3000 is the default URL.

**Architecture:** Three independent fixes across the card pipeline — (1) reduce screenshot aspect ratio and fix content layout for Twitter's 4:5 board, (2) inject CSS to hide navbar before capture flow runs, (3) verify URL defaults already point to localhost.

**Tech Stack:** TypeScript, Playwright, CSS, guizang template system

---

### Task 1: Hide navbar in card screenshots via CSS injection

**Files:**
- Modify: `capture/card-shots.ts:57-93` (`runCapturePass` function)

**Context:** `runCapturePass()` navigates to the URL, loads the flow, then runs it with hooks that fire per-anchor screenshots. The navbar is visible during all of this. We need to inject a style rule **after navigation but before the flow runs**, so every subsequent screenshot (element-level and page-level clip) excludes the navbar.

- [ ] **Step 1: Add navbar-hiding CSS injection in `runCapturePass`**

In `capture/card-shots.ts`, inside `runCapturePass()`, after `page.goto()` resolves (line 68) and before `loadFlow` / `flow.run()` (line 70-91), add:

```typescript
// Hide site navbar/header so it never appears in card screenshots.
// Uses broad semantic selectors to survive DOM restructuring.
await page.addStyleTag({
  content: `
    nav, header,
    [role="navigation"],
    [data-navbar],
    header nav { display: none !important; }
  `,
});
```

Insert this between line 68 (`await page.goto(...)`) and line 70 (`const flow = await loadFlow(targetId)`).

**Why here and not in the capture flow target file:** The injection point in `card-shots.ts` is universal — it applies to every tool's capture pass without modifying each `capture/targets/<id>.ts`. If a specific tool needs different hiding logic, it can still add its own `page.addStyleTag` in its `run()` function.

- [ ] **Step 2: Verify no other files hardcode any3d.cc as primary URL**

Check that `TARGET_BASE_URL` defaults to `http://localhost:3000` in:
- `capture/card-shots.ts:101` — already correct
- Any other file that references `any3d.cc`

Run: `grep -rn "any3d.cc" --include="*.ts" .`
Expected: Only appears as fallback/alternate, never as primary default.

- [ ] **Step 3: Commit**

```bash
git add capture/card-shots.ts
git commit -m "fix(card): hide navbar from screenshots via CSS injection"
```

---

### Task 2: Fix X/Twitter (4:5) card bottom clipping — reduce screenshot ratio + flex layout

**Files:**
- Modify: `card/specs.ts:140-147` (Twitter frame screenshot aspect)
- Modify: `card/generate.ts:115-155` (Editorial infographic layout)
- Modify: `card/assets/template-editorial-card.html:148-153` (`.content` base styles)

**Context:** The Twitter infographic board is 1080×1350 (4:5). With 92px top+bottom padding, usable height is ~1166px. Current content (kicker + h-display 124px + h-sub 30px + r-16x10 screenshot ~613px + body × 2 + kpi-grid) totals ~1214px+, exceeding available space. `.poster { overflow: hidden }` silently clips the bottom.

**Two-part fix:**
1. Change Twitter screenshot from `r-16x10` to `r-16x9` (saves ~61px of height)
2. Make Editorial `.content` use flex column layout so KPI grid pushes to bottom gracefully (matching Swiss pattern)

- [ ] **Step 1: Change Twitter screenshot aspect ratio in specs**

In `card/specs.ts`, line 146, change:

```typescript
// Before:
{ src: "./frames-en/settings-preview.png", aspect: "16x10" },

// After:
{ src: "./frames-en/settings-preview.png", aspect: "16x9" },
```

This reduces the screenshot container from ~613px to ~552px at 904px content width (saves ~61px).

- [ ] **Step 2: Make Editorial `.content` a flex column container**

In `template-editorial-card.html`, modify line 153:

```css
/* Before: */
.content { position: relative; width: 100%; height: 100%; z-index: 2; }

/* After: */
.content {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 2;
  display: flex;
  flex-direction: column;
}
```

This enables `margin-top: auto` on child elements (like kpi-grid) to push them to the bottom when there's extra space, or at minimum ensures they don't get clipped silently — flex items will shrink before overflowing.

- [ ] **Step 3: Update KPI grid to push to bottom in editorial generate**

In `card/generate.ts`, line 146-152, change the kpi-grid div to include `margin-top: auto`:

```typescript
// Before:
parts.push(`        <div class="kpi-grid">`);

// After:
parts.push(`        <div class="kpi-grid" style="margin-top:auto">`);
```

This mirrors the Swiss template's approach (line 247) where metrics use `margin-top: auto` within a flex stack.

- [ ] **Step 4: Verify Swiss template already handles this correctly**

The Swiss template's `.content` may also need the same flex treatment. Check `template-swiss-card.html` line 139:

```css
.content { position: relative; width: 100%; height: 100%; z-index: 2; }
```

If Swiss Twitter cards also clip, apply the same flex fix. Otherwise leave as-is (Swiss uses explicit `style="margin-top:auto"` on its grid-4 which only works if parent is flex).

Apply the same flex change to Swiss `.content` for consistency:

```css
/* After (Swiss): */
.content {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 2;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 5: Commit**

```bash
git add card/specs.ts card/generate.ts card/assets/template-editorial-card.html card/assets/template-swiss-card.html
git commit -m "fix(card): prevent Twitter 4:5 bottom clipping — flatter shot + flex content layout"
```

---

### Task 3: Verify end-to-end

- [ ] **Step 1: Type-check the project**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run card pipeline for visual verification**

Run: `pnpm card model-compression editorial zh`
Then inspect `out/model-compression/cards/twitter-infographic-01-infographic.png` to confirm:
- Bottom KPI grid is fully visible (not clipped)
- Screenshot does not contain site navbar

Also check `out/model-compression/cards/xhs-infographic-01-infographic.png` to confirm no regression on the taller 3:4 board.

