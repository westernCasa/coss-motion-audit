import { createServer } from "node:http"; import { readFile } from "node:fs/promises"; import { chromium } from "playwright";
const D = new URL(`./${process.argv[2]}/`, import.meta.url).pathname;
const s = createServer(async (q, r) => { const p = q.url === "/" ? "index.html" : q.url.slice(1); try { r.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html" }); r.end(await readFile(D + p)); } catch { r.writeHead(404); r.end(); } }).listen(0);
const b = await chromium.launch(); const out = [];
for (const mode of ["no-preference", "reduce"]) {
  const pg = await (await b.newContext({ reducedMotion: mode })).newPage();
  await pg.goto(`http://localhost:${s.address().port}/`); await pg.waitForFunction(() => window.__ready);
  await pg.evaluate(() => window.__upsert("success")); await pg.waitForTimeout(700);
  const seen = await pg.evaluate(() => new Promise((res) => { const names = new Set(); window.__upsert("error"); const end = performance.now() + 500;
    const t = () => { for (const a of document.getAnimations()) if (a.constructor.name === "CSSAnimation") names.add(a.animationName); performance.now() < end ? requestAnimationFrame(t) : res([...names]); }; requestAnimationFrame(t); }));
  out.push(`${mode}: ${seen.length ? seen.join(", ") : "no keyframe animation"}`);
}
console.log(process.argv[2], "|", out.join(" | ")); await b.close(); s.close();
