# ScriptShifter for Alma Metadata Editor — 0.4.0 prototype

Copyright © 2026 Ayman El-Masry.

A separate Chrome 116+/recent Edge side-panel extension reusing the FOLIO extension's ScriptShifter API, capitalization rules and ScriptShifter-sourced romanization character picker. Intended for Alma’s MARC Metadata Editor. The other Alma editor has a separate extension. **Live Alma editing and saved-record behavior have not been validated. This is not feature-equivalent to the FOLIO integration yet.**

## Install and use

1. Download the repository ZIP, extract it, and open `chrome://extensions` (or `edge://extensions`). Enable Developer mode and Load unpacked from `extensions/alma-metadata-scriptshifter`.
2. Open Alma and click the extension toolbar button to open its side panel. It stays open while you select fields in Alma.
3. Click **Enable on this Alma site** and approve access to that specific HTTPS origin. A different library's site is enabled separately. The extension has no hard-coded institution URL. Merely being enableable at any site does not establish compatibility with every Alma version.
4. This extension opens directly in **MARC Metadata Editor** mode; there is no editor selector. Click a standard text input or textarea in Alma, then **Capture current field** in the panel. If several editor frames are ambiguous, click the intended field again and capture it. The extension never scans all fields into a list.
5. For offline diacritics, select a mark and insert it into the captured field at its captured cursor position. Undo works while the panel remains open. Searchable marks are grouped and sorted by name, with language filtering.
6. For conversion, load languages, confirm the language/direction and field kind, and click **Convert**. This sends text to `https://bibframe.org/scriptshifter/`, the Library of Congress service used by Princeton's OCLC macro. No Alma credentials are sent. Conversion itself leaves the source unchanged.
7. To add a parallel value, use Alma's native controls to create the appropriate alternate field/property, click its **empty** text input, and click **Insert conversion into current field** in the panel. Existing nonempty values are never replaced by this conversion action. Check the record in Alma and save using Alma's own action.

## Editor behavior

- MARC field tags are identified only from recognized textarea wrapper IDs (`MarcEditorPresenter.textArea.<tag>`) or an explicit `data-marc-tag` attribute. If a tag is not identified, choose the field kind yourself. The adapter supports standard text controls, not arbitrary editor internals.
- MARC conversion preserves textual subfield delimiters (`$$`, `$`, `ǂ`, `‡`) and codes. Numeric subfields, URI values, 856 `$u` and name relationship codes are retained. Control fields are excluded. Each eligible subfield is sent separately; only the first textual segment gets sentence capitalization, while name fields use every-word capitalization. Multiple subfields may take longer because each requires a service call.
- Personal/corporate name tags use every-word capitalization. In 260/264, publisher/printer/producer names in `$b` use every-word capitalization, while place in `$a` uses first-letter-only case. Other textual fields use first-letter-only case across the field. Arabic title tags preserve the initial lowercase `al-` and capitalize the following stem (for example `al-Kitāb wa-al-maktabah`). A final case pass corrects interior capitals returned by ScriptShifter. Reverse conversion is unchanged.
- **Automatic MARC 880 creation/linking is not implemented.** Create and link alternate fields through Alma's native tools. This prototype does not automatically set MARC `$6` linkage, tag/indicators or script metadata. Do not paste a source field's existing linkage into an unrelated parallel field: review/remove/update linkage in Alma as appropriate.

## Compatibility and privacy

The extension is independent of the library hostname, but actual support depends on Alma's UI version. Custom rich-text widgets, contenteditable editors, CodeMirror/Monaco models, dropdowns, identifiers, unsupported cross-origin frames and saved model integration require further adapters/testing. Unsupported controls are rejected. A changed field or page invalidates insertion.

The site grant covers the specific origin requested. A Metadata Editor hosted at another origin may need separate access and additional integration work. Focus timing is tracked in each allowed frame's isolated extension world; record text is not persistently stored unless you explicitly save a reviewed correction. Public ScriptShifter language metadata is cached for 24 hours. **Remember reviewed correction** additionally stores the exact source and corrected text locally, keyed by language and direction. You can opt in to the inverse mapping; conflicting inverse values are not overwritten. Use **Forget saved correction** to remove the current direction. These are manual reviewed mappings, not authority validation. Saved corrections are separate for each installed extension. The panel's source/output and undo history exist only while it stays open. ScriptShifter's own data handling applies to conversion requests.

The broad optional HTTPS permission lets the browser request an individual institution's origin, including custom Alma hostnames. It is not a default grant to every website. The extension requests no Alma API keys. It neither saves nor publishes library records.

Live API access from the development machine was blocked by its network proxy (HTTP 403). Local tests use a mock API. Actual Chrome permission prompts, Alma widgets, RDF/MARC persistence and behavior in each library's tenant still need validation. No live Alma record has been modified during development.

## Checks

```
node --test marc.test.mjs diacritics.test.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node browser.test.mjs
```

The browser fixture exercises standard text controls and the extension bridge with mocked Chrome APIs and ScriptShifter. It is not a live Alma compatibility test. No third-party extension implementation code is copied; the historical MARC textarea wrapper convention was checked against the publicly available Alma Booster project.

Direction detection treats romanization modifiers such as ʿ/ʾ as punctuation, so names such as `Aḥmad ʿAlī` are recognized as romanized text. Genuine mixtures of Latin and non-Latin script still require a direction choice.

## ScriptShifter-sourced character picker

This release replaces the general Unicode mark list with a pinned snapshot from [lcnetdev/scriptshifter](https://github.com/lcnetdev/scriptshifter/tree/b9d333d17e18563c79283b938f4b722d9c7a5dcc). The generator reads the Roman side of S2R/R2S mappings (including inherited tables) and, only for hook-only languages without explicit mappings, the romanized column of upstream test samples. Unicode NFC/NFD supplies equivalent precomposed letters and their combining accents. It excludes native-script vowel signs and rule-only control placeholders. It does not synthesize a language alphabet from the Unicode script block.

Arabic includes **Ayn (ʻ, U+02BB)**, **Hamza (ʼ, U+02BC; ʾ, U+02BE)**, documented macrons/dots below and their Latin letters. These forms are taken from the pinned Arabic rules; the picker does not substitute a visually similar character. Ayn is a spacing character, so it is inserted without a dotted-circle preview. A combining accent still uses the dotted-circle preview and attaches to the preceding letter. Character names appear first and are alphabetized within each language group.

The snapshot lists all **165 indexed languages**. It is a documented-character extraction, not a claim of a complete prescribed inventory: hook-only services can have characters not enumerated in tables/tests. Cherokee, Khmer and Yiddish currently have no non-ASCII character inventory in these extracted sources; their language entries remain selectable and explain that no documented characters were found. This does not mean the transliteration service itself is unsupported. No invented characters are added to fill gaps.

`marks.json` records the source commit, language counts and per-character source IDs into its `source_files` list. Display names otherwise use Unicode names; Arabic Ayn/Hamza labels clarify the letter function documented by the Arabic table. The upstream data is provided under CC0; see `SCRIPTSHIFTER-LICENSE.txt`.

To reproduce the catalog from a checked-out upstream repository, install PyYAML if needed and run `python3 scripts/build-scriptshifter-characters.py /path/to/scriptshifter` from this repository. The generator records the checkout’s actual HEAD. Run `python3 scripts/package-extensions.py` to rebuild ZIPs.

The picker displays combining mark names rather than complete accented letters. The union of combining marks documented in the source catalog is available under every language, alphabetically by name, so a mark can be attached to any selected base letter even without a precomposed Unicode character. Availability does not imply that every mark is appropriate for that language. Language-specific spacing signs such as ayn and hamza remain available. Searching preserves the selected language.
