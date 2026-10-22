# ScriptShifter for Alma BIBFRAME Editor — 0.3.0 prototype

Copyright © 2026 Ayman El-Masry.

A separate Chrome 116+/recent Edge side-panel extension reusing the FOLIO extension's ScriptShifter API, capitalization rules and offline Unicode diacritics picker. Intended for Alma’s built-in BIBFRAME editor. The other Alma editor has a separate extension. **Live Alma editing and saved-record behavior have not been validated. This is not feature-equivalent to the FOLIO integration yet.**

## Install and use

1. Download the repository ZIP, extract it, and open `chrome://extensions` (or `edge://extensions`). Enable Developer mode and Load unpacked from `extensions/alma-bibframe-scriptshifter`.
2. Open Alma and click the extension toolbar button to open its side panel. It stays open while you select fields in Alma.
3. Click **Enable on this Alma site** and approve access to that specific HTTPS origin. A different library's site is enabled separately. The extension has no hard-coded institution URL. Merely being enableable at any site does not establish compatibility with every Alma version.
4. This extension opens directly in **Alma BIBFRAME editor** mode; there is no editor selector. Click a standard text input or textarea in Alma, then **Capture current field** in the panel. If several editor frames are ambiguous, click the intended field again and capture it. The extension never scans all fields into a list.
5. For offline diacritics, select a mark and insert it into the captured field at its captured cursor position. Undo works while the panel remains open. Searchable marks are grouped and sorted by name, with script filtering.
6. For conversion, load languages, confirm the language/direction and field kind, and click **Convert**. This sends text to `https://bibframe.org/scriptshifter/`, the Library of Congress service used by Princeton's OCLC macro. No Alma credentials are sent. Conversion itself leaves the source unchanged.
7. To add a parallel value, use Alma's native controls to create the appropriate alternate field/property, click its **empty** text input, and click **Insert conversion into current field** in the panel. Existing nonempty values are never replaced by this conversion action. Check the record in Alma and save using Alma's own action.

## Editor behavior

- BIBFRAME conversion uses the focused literal text as one request. Choose **Title / other text** or **Name** to set capitalization; the extension does not infer RDF property semantics from arbitrary page labels.
- **Automatic BIBFRAME property/language/script creation is not implemented.** Create the parallel literal/property and set its language/script using Alma. This extension edits text controls only; it does not write RDF directly.

## Compatibility and privacy

The extension is independent of the library hostname, but actual support depends on Alma's UI version. Custom rich-text widgets, contenteditable editors, CodeMirror/Monaco models, dropdowns, identifiers, unsupported cross-origin frames and saved model integration require further adapters/testing. Unsupported controls are rejected. A changed field or page invalidates insertion.

The site grant covers the specific origin requested. A Metadata Editor hosted at another origin may need separate access and additional integration work. Focus timing is tracked in each allowed frame's isolated extension world; record text is not persistently stored unless you explicitly save a reviewed correction. Public ScriptShifter language metadata is cached for 24 hours. **Remember reviewed correction** additionally stores the exact source and corrected text locally, keyed by language and direction. You can opt in to the inverse mapping; conflicting inverse values are not overwritten. Use **Forget saved correction** to remove the current direction. These are manual reviewed mappings, not authority validation. Saved corrections are separate for each installed extension. The panel's source/output and undo history exist only while it stays open. ScriptShifter's own data handling applies to conversion requests.

The broad optional HTTPS permission lets the browser request an individual institution's origin, including custom Alma hostnames. It is not a default grant to every website. The extension requests no Alma API keys. It neither saves nor publishes library records.

Live API access from the development machine was blocked by its network proxy (HTTP 403). Local tests use a mock API. Actual Chrome permission prompts, Alma widgets, RDF/MARC persistence and behavior in each library's tenant still need validation. No live Alma record has been modified during development.

## Checks

```
node --test diacritics.test.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node browser.test.mjs
```

The browser fixture exercises standard text controls and the extension bridge with mocked Chrome APIs and ScriptShifter. It is not a live Alma compatibility test. No third-party extension implementation code is copied; the historical MARC textarea wrapper convention was checked against the publicly available Alma Booster project.
