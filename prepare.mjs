// Copies the components under test out of a local coss checkout, unchanged.
// Nothing from coss is committed to this repo; run this first.
//
//   node prepare.mjs <path-to-coss-checkout> <name>
//   e.g. node prepare.mjs ../coss main   ->  vendor/main/
//
// Also writes globals.consumer.css: the same stylesheet with coss's
// prefers-reduced-motion block removed, which is what a project that installs
// a component from the coss registry has (the block is not in the registry item).

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const [coss, name] = process.argv.slice(2);
if (!coss || !name) { console.error("usage: node prepare.mjs <coss-checkout> <name>"); process.exit(1); }

const UI = ["dialog", "popover", "tooltip", "menu", "accordion", "collapsible", "sheet", "drawer", "toast",
  "alert-dialog", "preview-card", "context-menu", "button", "scroll-area", "spinner"];
const out = join("vendor", name);
mkdirSync(join(out, "registry/default/ui"), { recursive: true });
mkdirSync(join(out, "registry/default/lib"), { recursive: true });
for (const f of UI) copyFileSync(join(coss, `apps/ui/registry/default/ui/${f}.tsx`), join(out, `registry/default/ui/${f}.tsx`));
copyFileSync(join(coss, "apps/ui/registry/default/lib/utils.ts"), join(out, "registry/default/lib/utils.ts"));

// Point Tailwind's @source at the copied files instead of the coss monorepo.
const css = readFileSync(join(coss, "packages/ui/src/styles/globals.css"), "utf8")
  .replace('@source "../../../apps/**/*.{ts,tsx}";', '@source "./registry/**/*.{ts,tsx}";')
  .replace('@source "../**/*.{ts,tsx}";', '@source "../../src/**/*.{ts,tsx}";');
writeFileSync(join(out, "globals.css"), css);
const consumer = css.replace(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n/, "");
if (consumer === css) console.warn("note: no prefers-reduced-motion block found in globals.css");
writeFileSync(join(out, "globals.consumer.css"), consumer);

const commit = execFileSync("git", ["-C", coss, "rev-parse", "HEAD"]).toString().trim();
const dirty = execFileSync("git", ["-C", coss, "status", "--porcelain", "--", "apps/ui/registry", "packages/ui/src/styles"]).toString().trim();
writeFileSync(join(out, "SOURCE"), `${commit}${dirty ? " (with uncommitted changes)" : ""}\n`);
console.log(`vendor/${name}: coss ${commit.slice(0, 7)}${dirty ? " + uncommitted changes" : ""}`);
