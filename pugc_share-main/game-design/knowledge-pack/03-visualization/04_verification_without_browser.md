---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/03-visualization/04-verification-without-browser.md"
---

# 04 — Verifying pages without a browser

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

When a rendered browser is unavailable, use a jsdom harness against the running server.
It verifies DOM structure and interactions, not visual rendering; use a real browser when available:

```js
// /tmp/mm/u.js   (npm i jsdom)
const { JSDOM, VirtualConsole } = require('jsdom'); const vc = new VirtualConsole(); const errs = [];
vc.on('jsdomError', e => errs.push(e.message));
(async () => {
  const html = await (await fetch('http://localhost:8611/plant-roster.html')).text();
  const dom = new JSDOM(html.replace(/<script src="https:[^>]+><\/script>/, ''), {
    url: 'http://localhost:8611/plant-roster.html', runScripts: 'dangerously', resources: 'usable', virtualConsole: vc,
    beforeParse(w) { w.fetch = u => fetch(new URL(u, 'http://localhost:8611'));          // jsdom has no fetch
      w.Chart = function () { this.destroy = () => {}; };                                 // stub CDN chart lib
      w.HTMLCanvasElement.prototype.getContext = () => null; } });
  await new Promise(r => setTimeout(r, 3000)); const d = dom.window.document;
  console.log(errs, d.querySelectorAll('#heat tr').length);                               // structure checks
  const lv = d.getElementById('hLv'); lv.value = 40; lv.dispatchEvent(new dom.window.Event('input')); // interactions
  d.querySelector('#ds button[data-ds=dev]').click();                                     // dataset toggle
  process.exit(0);
})();
```
Start the server in the same bash call when the sandbox kills background processes between calls:
`(PORT=8611 nohup timeout 70 node server.js &) ; for i in $(seq 30); do sleep 2; curl -s localhost:8611/ && break; done; node /tmp/mm/u.js`.

Checklist per page: no jsdom errors; expected element counts (rows, cells); text of key cells; each
control changes the numbers; dataset toggle works; reset restores defaults. Also `node --check` every JS
file and `new Function(inlineScript)` for inline page scripts.

For UI mockups add: render every screen in a sweep, compare measured pixel positions with the `.ui`
coordinates, and build a standalone HTML with inlined data-URL assets when a human must look at it.

Disclose what was actually verified. If you could not inspect a rendered page, say so and leave visual
correctness unverified; request a restart only if the running server is stale. Do not report a browser
limitation when you did use one.
