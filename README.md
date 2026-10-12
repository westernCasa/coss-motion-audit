# coss-motion-audit

Built to test a fix for coss ui: https://github.com/cosscom/coss/pull/864. The fix makes Dialog and Toast keep their fades and drop their movement when reduced motion is on.

Measures what the [coss ui](https://coss.com/ui) enter/exit primitives animate when the user has asked for reduced motion (`prefers-reduced-motion: reduce`).

It renders the components exactly as they are in a coss checkout, opens and closes each one in Chromium, and reads every running CSS transition and animation from `document.getAnimations()`. Nothing is inferred from class names. It also records where Dialog and Toast sit on every frame while they are visible, so a jump with no transition still shows up.

## What it found

On coss `main` (`28135b0`, 11 Oct 2026), with reduced motion on, all ten primitives that animate on enter or exit run exactly the same motion as with it off. Menu and Context Menu have no enter/exit motion.

- **Toast** slides in from off-screen (100% of its height plus the inset) over 500 ms.
- **Dialog** scales from 0.98 on desktop and slides up 16 px on phones, over 200 ms.
- coss's own reduced-motion rule (in `packages/ui/src/styles/globals.css`) stops Toast's update shake, but it is not part of the Toast registry item, so a project that installs Toast from the registry gets the shake with no guard.

## Requirements

Node 20+, and a local clone of [cosscom/coss](https://github.com/cosscom/coss). Nothing from coss is stored in this repo; `prepare.mjs` copies the files in at run time.

## Run it

```bash
npm ci
npx playwright install chromium

# Copy the components out of a coss checkout (any branch)
node prepare.mjs ../coss main

# Build the test page and measure
VENDOR=vendor/main OUT_DIR=dist-main npx vite build
VENDOR=vendor/main OUT_DIR=dist-main TAG=-main node measure.mjs
```

This writes `results-main.json` (every transition, raw) and `results-main.md` (a table).

## Compare two branches

```bash
node prepare.mjs ../coss-fix fix
VENDOR=vendor/fix OUT_DIR=dist-fix npx vite build
VENDOR=vendor/fix OUT_DIR=dist-fix TAG=-fix node measure.mjs

node compare.mjs main fix
```

`compare.mjs` prints a before/after table for Dialog and Toast under reduced motion, and exits non-zero if anything else changed.

## The Toast shake check

```bash
# With coss's global stylesheet, then with the reduced-motion block removed
# (what a registry install has)
VENDOR=vendor/main CSS=globals.css OUT_DIR=dist-shake-a npx vite build && node shake.mjs dist-shake-a
VENDOR=vendor/main CSS=globals.consumer.css OUT_DIR=dist-shake-b npx vite build && node shake.mjs dist-shake-b
```

Each line reports which keyframe animation runs when a toast is updated, with reduced motion off and on.

## Method notes

- Viewports: 1280×800 and 390×844.
- Each primitive is opened through its own root `open` prop, or `toastManager.add` for Toast. No styles are added by the test page.
- A run is only valid if the media feature matched: every reduced-motion run must report `matchMedia("(prefers-reduced-motion: reduce)").matches === true`, and every normal run `false`. The tables say whether this passed.
- The close button inside Dialog and Sheet shows a 150 ms `box-shadow` transition. That is its focus ring, not movement.
