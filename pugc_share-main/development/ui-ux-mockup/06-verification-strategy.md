# 06 — Verifying a Mockup Without a Real Browser

An AI agent running in a sandboxed environment often **cannot open a real browser to take a
screenshot** — meaning it can't "look at" the mockup to visually check it the way a human would.
Instead, use Node.js to verify as much of the code's STRUCTURE and CORRECTNESS as possible before
reporting it's done, and clearly tell the designer which part still needs their own visual review.

**Always make this clear to the designer**: Node-based verification only catches structural bugs
(crashes, missing assets, wrong data, broken interaction flow) — it does NOT catch visual/layout bugs
that only show up by looking (two elements overlapping, spacing that doesn't look right...). That
second category of bug can only be caught by the designer looking at it directly.

## Layer 1 — Syntax checking

Run after EVERY change to a JS/CSS file, before reporting it's done:

```bash
node --check path/to/file.js
```

## Layer 2 — Sweep the entire screen list (render sweep)

If the project uses a registry structure (one array holding every screen definition — see file 07),
write a script that calls every screen's `render()` and checks:

```js
const { SCREENS } = require('./uiux.js'); // export SCREENS at the bottom of the file so it's requireable

let bad = 0;
for (const screen of SCREENS) {
  try {
    const html = screen.render();
    if (/undefined|NaN/.test(html)) {
      console.log('BAD (undefined/NaN):', screen.id);
      bad++;
    }
  } catch (e) {
    console.log('CRASH:', screen.id, e.message);
    bad++;
  }
}
console.log(`Total: ${SCREENS.length}, Bad: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
```

Run this script after EVERY change to the file containing the screen registry, even if you only edited
one screen — changing a shared component (file 04) can silently break EVERY other screen that uses it.

## Layer 3 — Check for "unknown" assets/colors (spec test)

If you have a list of assets/colors already KNOWN to be real (from `.ui`/reference images — see file
01), write a script that scans the rendered HTML of every screen, extracts every image path
(`src="..."`, `url(...)`) and hex color (`#xxxxxx`), and cross-checks them against the known list — any
value NOT on that list is a sign of a fabricated asset/color, or a typo'd filename. Print the count of
"unknowns" found — the target is 0.

## Layer 4 — Simulating interaction with jsdom (for pages with interactive JS)

For a page with click/open-popup logic (not just a static display), use `jsdom` to build a real DOM in
Node, run the page's actual script, then simulate clicks and assert the results — this is the closest
thing to "opening a browser and testing it" without needing a real browser:

```js
const { JSDOM } = require('jsdom');
const dom = new JSDOM(pageHtml, { runScripts: 'outside-only', url: 'http://localhost/page.html' });
const { window } = dom;

// Combine multiple JS files into a single eval — calling window.eval() separately multiple times may
// NOT reliably share top-level variable scope (const/function) between calls in jsdom, even though on
// a real browser multiple separate <script src> tags do share a single global scope.
dom.window.eval(scriptA + '\n' + scriptB + '\n' + scriptC);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

const button = window.document.querySelector('[data-testid="my-button"]');
button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

// assert: the right popup opened, with the right content, the close button works, no "orphan"
// elements left behind...
```

Using `jsdom` does NOT replace visually checking layout/colors by eye (jsdom has no real layout engine,
so it can't compute actual pixel positions/sizes) — it only confirms the CORRECT DOM STRUCTURE and the
CORRECT EVENT FLOW (clicking button A → the right popup B appears → clicking close → it disappears
correctly, with no leftover elements). This is still a very valuable verification layer because it
catches a lot of logic bugs (mixed-up screen IDs, forgetting to remove an event listener, leaving a
stale element behind when a new screen opens...) without needing a real browser.

## Layer 5 — Layout lint (alignment and design-system drift)

[`templates/layout-lint.js`](templates/layout-lint.js) parses the rendered HTML of every screen (no browser) and
reports: font sizes off the type scale, spacing off the grid, colors that are not tokens/rarity colors,
hand-set popup heights, absolute children overflowing their parent, overlapping absolute siblings, manual
`left/top` inside kit popups, silent truncation, and skins still on placeholder fallback.

```bash
node layout-lint.js --self-test
node layout-lint.js --screens public/js/screens.js --css public/kit/ui-kit.css --kit public/kit/ui-kit.js
```

Target: 0 errors. Warnings need a reason in the screen's `mapping` (e.g. `data-abs-ok` for a 1:1 `.ui`
rebuild). For the designer's eye check, open the gallery with **Outline boxes** on: misaligned edges show
up immediately.

## Layer 6 — Golden screens

Keep the approved HTML of 3–5 representative screens in `golden/<id>.html`. After any shared-component change,
re-render and diff; show every changed golden screen to the designer
([11-component-extraction-workflow.md](11-component-extraction-workflow.md), step 5).

## When you find a bug that none of the layers above caught

Some bugs (layout overlap issues, CSS bugs that only surface when content is taller than its
container...) can only be found by the designer looking at it. When the designer reports this kind of
bug, after fixing it, **add a new assertion** to your existing test suite so the same bug can't
reappear on a future change — turning every bug the designer finds into a permanent safeguard for the
project, not just a one-off fix.

## Before reporting "done" to the designer

- [ ] `node --check` on every JS file you just changed.
- [ ] The render sweep runs with 0 errors across the ENTIRE screen list (not just the screen you
      changed).
- [ ] The spec test (if any) — 0 unknown assets/colors.
- [ ] `layout-lint.js` — 0 errors over every screen; warnings explained.
- [ ] If the page has interactivity — the jsdom test PASSES the entire click/open/close flow related
      to your change.
- [ ] Tell the designer clearly: "structure has been verified; the visual/layout part still needs your
      own direct review."
