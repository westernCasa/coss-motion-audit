// Reduced-motion audit for coss ui enter/exit primitives.
//
// For every primitive, in two viewports and both values of the
// `prefers-reduced-motion` media feature, this opens and then closes the
// component and records every CSS transition and CSS animation the browser
// actually runs, read from document.getAnimations(). Nothing is inferred from
// class names. Output: results.json (raw) and results.md (table).
//
// Usage: npm run build && node measure.mjs

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const DIST = new URL(`./${process.env.OUT_DIR ?? "dist"}/`, import.meta.url).pathname;
const TAG = process.env.TAG ?? "";
const CASES = [
  "dialog", "alert-dialog", "sheet", "drawer", "toast",
  "popover", "tooltip", "preview-card", "menu", "context-menu", "accordion", "collapsible",
];
const VIEWPORTS = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };
const MODES = ["no-preference", "reduce"];
const SAMPLE_MS = 900;

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer(async (req, res) => {
  const path = req.url === "/" ? "index.html" : req.url.slice(1).split("?")[0];
  try {
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    res.end(await readFile(join(DIST, path)));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

// Runs in the page: sample every frame for `ms` and collect each distinct
// running CSS transition / animation, keyed by owning data-slot + property.
const sampler = (ms) => new Promise((resolve) => {
  const seen = new Map();
  const end = performance.now() + ms;
  const tick = () => {
    for (const a of document.getAnimations()) {
      const target = a.effect?.target;
      if (!target) continue;
      const slot = target.closest?.("[data-slot]")?.getAttribute("data-slot") ?? target.tagName.toLowerCase();
      const own = target.getAttribute?.("data-slot") === slot;
      const kind = a.constructor.name;
      const prop = kind === "CSSTransition" ? a.transitionProperty : a.animationName;
      const t = a.effect.getComputedTiming();
      const key = `${slot}|${own ? "" : "child:"}${prop}|${kind}`;
      if (!seen.has(key)) seen.set(key, {
        slot: own ? slot : `${slot} (child ${target.tagName.toLowerCase()})`,
        kind, prop, durationMs: Math.round(t.duration), easing: a.effect.getTiming().easing,
        iterations: t.iterations,
        from: kind === "CSSTransition" ? a.effect.getKeyframes()[0]?.[prop] : undefined,
        to: kind === "CSSTransition" ? a.effect.getKeyframes().at(-1)?.[prop] : undefined,
        cls: own ? undefined : (target.getAttribute("class") ?? "").slice(0, 60),
      });
    }
    for (const el of document.querySelectorAll('[data-slot="dialog-popup"], [data-slot="toast-popup"], [data-slot="toast-viewport"] > *')) {
      const c = getComputedStyle(el);
      if (parseFloat(c.opacity) <= 0.01) continue;
      const pos = `${c.translate}|${c.scale}|${c.transform}`;
      const k = `__pos|${el.getAttribute("data-slot") ?? "toast-root"}|${pos}`;
      if (!seen.has(k)) seen.set(k, { slot: el.getAttribute("data-slot") ?? "toast-root", kind: "VisiblePosition", prop: pos, durationMs: 0 });
    }
    performance.now() < end ? requestAnimationFrame(tick) : resolve([...seen.values()]);
  };
  requestAnimationFrame(tick);
});

const browser = await chromium.launch();
const results = [];
for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  for (const mode of MODES) {
    const context = await browser.newContext({ viewport, reducedMotion: mode });
    for (const name of CASES) {
      const page = await context.newPage();
      await page.goto(url);
      await page.waitForFunction(() => window.__ready === true);
      const check = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
      const enterP = page.evaluate(sampler, SAMPLE_MS);
      await page.evaluate((n) => window.__open(n), name);
      const enter = await enterP;
      await page.waitForTimeout(200);
      const exitP = page.evaluate(sampler, SAMPLE_MS);
      await page.evaluate((n) => window.__close(n), name);
      const exit = await exitP;
      results.push({ viewport: vpName, mode, mediaMatchesReduce: check, case: name, enter, exit });
      await page.close();
    }
    await context.close();
  }
}
await browser.close();
server.close();

const commit = (await readFile(new URL(`./${process.env.VENDOR ?? "vendor/coss"}/SOURCE`, import.meta.url), "utf8")).trim();
await writeFile(`results${TAG}.json`, JSON.stringify({ cossSource: commit, baseUi: "1.8.0", results }, null, 2));

// Table: one row per case x viewport, comparing the two modes.
const A = (l) => l.filter((x) => x.kind !== "VisiblePosition");
const P = (l) => [...new Set(l.filter((x) => x.kind === "VisiblePosition").map((x) => x.prop))];
const fmt = (list) => list.length === 0 ? "none"
  : list.map((x) => `${x.slot}: ${x.prop} ${x.from ?? ""}→${x.to ?? ""} ${x.durationMs}ms${x.iterations === Infinity ? " ∞" : ""}`).join("<br>");
const maxMs = (list) => list.reduce((m, x) => Math.max(m, x.durationMs), 0);
let md = `# coss ui — what still moves under prefers-reduced-motion: reduce\n\n`;
md += `coss \`${commit}\` · @base-ui/react 1.8.0 · Chromium (Playwright 1.56) · measured with document.getAnimations()\n\n`;
md += `| Primitive | Viewport | Normal: enter / exit (count, longest) | **Reduced: enter / exit (count, longest)** | Still moving under reduce |\n|---|---|---|---|---|\n`;
for (const name of CASES) for (const vp of Object.keys(VIEWPORTS)) {
  const n = results.find((r) => r.case === name && r.viewport === vp && r.mode === "no-preference");
  const r = results.find((r) => r.case === name && r.viewport === vp && r.mode === "reduce");
  md += `| ${name} | ${vp} | ${A(n.enter).length}, ${maxMs(A(n.enter))}ms / ${A(n.exit).length}, ${maxMs(A(n.exit))}ms | **${A(r.enter).length}, ${maxMs(A(r.enter))}ms / ${A(r.exit).length}, ${maxMs(A(r.exit))}ms** | ${fmt([...A(r.enter), ...A(r.exit).filter((e) => !A(r.enter).some((x) => x.slot === e.slot && x.prop === e.prop))])} |\n`;
}
md += `\n## Where Dialog and Toast sit while visible (translate | scale | transform)\n\nOne value per row means the element never moves while it can be seen.\n\n| Primitive | Viewport | Mode | Positions seen while visible |\n|---|---|---|---|\n`;
for (const name of ["dialog", "toast"]) for (const vp of Object.keys(VIEWPORTS)) for (const mode of MODES) {
  const x = results.find((r) => r.case === name && r.viewport === vp && r.mode === mode);
  const pos = [...new Set([...P(x.enter), ...P(x.exit)])];
  md += `| ${name} | ${vp} | ${mode} | ${pos.length} distinct: ${pos.slice(0, 4).map((p) => "`" + p + "`").join("<br>")}${pos.length > 4 ? "<br>…" : ""} |\n`;
}
const sane = results.every((r) => r.mediaMatchesReduce === (r.mode === "reduce"));
md += `\nMedia feature check: ${sane ? "every reduce run matched (prefers-reduced-motion: reduce), every normal run did not" : "MISMATCH — results invalid"}.\n`;
await writeFile(`results${TAG}.md`, md);
console.log(md);
