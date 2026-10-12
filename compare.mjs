// Compares two measure.mjs runs and prints a before/after table.
//
//   node compare.mjs main fix   (reads results-main.json and results-fix.json)
//
// Exits non-zero if anything outside Dialog and Toast under reduced motion
// changed between the two runs, so it doubles as a regression check.

import { readFile, writeFile } from "node:fs/promises";

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error("usage: node compare.mjs <before-tag> <after-tag>"); process.exit(1); }
const load = async (t) => JSON.parse(await readFile(`results-${t}.json`, "utf8"));
const [A, B] = await Promise.all([load(a), load(b)]);
const key = (r) => `${r.case}|${r.viewport}|${r.mode}`;
const byKey = (d) => new Map(d.results.map((r) => [key(r), r]));
const [MA, MB] = [byKey(A), byKey(B)];

const anim = (l) => l.filter((x) => x.kind !== "VisiblePosition");
const sig = (l) => JSON.stringify(anim(l).map((x) => [x.slot, x.prop, x.durationMs]).sort());
const moving = (r) => [...new Set([...anim(r.enter), ...anim(r.exit)]
  .filter((x) => x.slot !== "button").map((x) => `${x.prop} ${x.durationMs}ms`))].join(", ") || "none";
// "none", scale 1 and the identity matrix are the same resting position.
const rest = (p) => p.split("|").map((v) => (v === "1" || v === "matrix(1, 0, 0, 1, 0, 0)" ? "none" : v)).join("|");
// Does the element ever sit anywhere other than its resting position while visible?
// A yes/no answer is stable across runs; a count of sampled positions is not.
const moves = (r) => [...r.enter, ...r.exit]
  .filter((x) => x.kind === "VisiblePosition")
  .some((x) => rest(x.prop) !== "none|none|none") ? "yes" : "no";

const TARGETS = ["dialog", "toast"];
const changedElsewhere = [];
for (const [k, ra] of MA) {
  const rb = MB.get(k);
  const [name, , mode] = k.split("|");
  if (TARGETS.includes(name) && mode === "reduce") continue;
  if (sig(ra.enter) !== sig(rb.enter) || sig(ra.exit) !== sig(rb.exit)) changedElsewhere.push(k);
}

let md = `## Reduced motion: before and after\n\n`;
md += `Before: coss \`${A.cossSource}\` · After: coss \`${B.cossSource}\`\n\n`;
md += `| Component | Viewport | Before: transitions under reduced motion | After | Moves while visible (before → after) |\n|---|---|---|---|---|\n`;
for (const name of TARGETS) for (const vp of ["desktop", "mobile"]) {
  const ra = MA.get(`${name}|${vp}|reduce`), rb = MB.get(`${name}|${vp}|reduce`);
  md += `| ${name} | ${vp} | ${moving(ra)} | ${moving(rb)} | ${moves(ra)} → ${moves(rb)} |\n`;
}
md += `\nMoves while visible: whether the element's translate, scale or transform differs from its resting position on any frame where it can be seen.\n`;
md += `\nEverything else (the other primitives, and both components with reduced motion off): ${changedElsewhere.length ? `**changed: ${changedElsewhere.join(", ")}**` : "identical in both runs"}.\n`;
const sane = [A, B].every((d) => d.results.every((r) => r.mediaMatchesReduce === (r.mode === "reduce")));
md += `Media feature check: ${sane ? "passed on every run" : "FAILED"}.\n`;

await writeFile(`compare-${a}-${b}.md`, md);
console.log(md);
process.exit(changedElsewhere.length || !sane ? 1 : 0);
