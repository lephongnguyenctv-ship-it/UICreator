---
name: craftland-data-tooling-patterns
description: >
  Game-agnostic tooling patterns proven on Craftland projects: reading master
  data xlsx reliably, building/patching single-file HTML balance calculators,
  headless JS verification, draw.io XML generation, and Google Drive/Sheets
  export. Use whenever a Craftland task involves reading spreadsheets,
  building calculators, generating diagrams, or exporting to Drive.
type: ai-skill
domain: craftland-ugc
status: authoritative
version: 1.0.2
last_updated: 2026-10-14
---

# Data & Tooling Patterns

## 1. Reading master data (xlsx)

- `openpyxl.load_workbook(path, read_only=True, data_only=True)` —
  `data_only` required to get values instead of formulas.
- **Always enumerate sheet names first.** Sheet names contain typos (e.g.
  `GlobalCofig`) and non-obvious labels; never guess.
- `pandas.read_excel(..., sheet_name=..., header=None)` for raw layout
  capture when headers are irregular.
- **Google Drive connector truncates large files (~50MB+) to the first
  sheet silently.** For bulk sheet reading, have the file uploaded directly
  to the project instead. Drive is fine for `search_files` discovery.

## 2. Single-file HTML balance calculators

- One self-contained file: vanilla JS + Chart.js. Every config value is an
  input; no hardcoded assumptions.
- Two input tiers: distribution-changing (re-run full simulation) vs
  check-only (prices/targets — re-check against existing distribution).
  Keeps the tool responsive.
- **Patch via Python string `.replace()` on a placeholder**, not sed/heredoc
  — heredoc expansion corrupts large JS payloads. Inject data as JSON into a
  `__PETS__`-style placeholder.
- Headless verification: extract the inline script with
  `/<script>([\s\S]*?)<\/script>\s*<\/body>/`, run under Node with stub
  `document`/`window`/`Chart`. Primary correctness check: probability
  distributions normalize to 100%. Cross-check math with a parallel Python
  reimplementation when stakes are high.
- Playwright headless is available for full-DOM interaction testing.

## 3. draw.io XML generation

- Build XML programmatically (Python); `html.escape(value, quote=True)` on
  every value attribute.
- `html=1` must be set in cell style for mxGraph to render `<b>`/`<font>`.
- Cell IDs must be **globally unique across the whole file** (not per page)
  — duplicates are silently dropped.
- To preserve user layout edits across versions: parse with
  `xml.etree.ElementTree`, re-serialize untouched pages verbatim via
  `ET.tostring(page, encoding='unicode')`.

## 4. Google Sheets export

- Build locally as `.xlsx` (openpyxl) → base64 → `Google Drive:create_file`
  with `contentMimeType:
  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` —
  converts to a native Google Sheet on upload.
- Formula row references must use actual runtime row numbers (sections
  shift); do a read-pass after writing to confirm positions. Use the xlsx
  skill's `recalc.py` (LibreOffice) to evaluate formulas and check for
  errors before shipping.


## Related game-design tooling

For a multi-page balance website backed by a player simulator, config mirrors, fingerprints
and proposal-vs-dev comparisons, use the [Game Balance & Visualization Knowledge Pack](../game-design/knowledge-pack/README.md).
The single-file calculators above remain the lightweight option for focused tuning tasks.


## Related Analytics Website Workflow

For a persistent multi-user internal analytics website, use
[Analytics Website Builder](../development/analytics-website-builder/README.md): Google login,
server-side access/privacy, Sheets ingestion, quota/cache control, charts/exports and diagnostics.
Its [AI prompt recipes](../development/analytics-website-builder/13_ai_analysis_and_prompt_recipes.md)
consume authorized evidence; reading/importing the guide does not authorize provider calls or messages.
