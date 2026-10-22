# ScriptShifter for FOLIO — prototype

A standalone Chrome/Edge Manifest V3 extension for reviewing transliterations in populated FOLIO text fields. It does not require changes to a FOLIO server. It uses the same Library of Congress service as [Princeton's OCLC ScriptShifter macro](https://github.com/pulibrary/oclcscriptshifter): `https://bibframe.org/scriptshifter/`. This is an independent prototype, not a Princeton or Library of Congress product.

## Install and use

1. Extract the extension archive into a local folder.
2. In Chrome open `chrome://extensions`, or in Edge open `edge://extensions`.
3. Enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Open your FOLIO **New instance** form and enter the title or other text you want to transliterate. Click the extension in the browser toolbar.
5. Click **Load fields and languages**. The extension lists populated, visible, editable text inputs and textareas. Select fields by using **Preview this field** only on fields you want to change.
6. Confirm each language and conversion direction. Click **Preview this field** to send its text to ScriptShifter, review the output, then click **Apply to field**. Apply replaces that field's text. **Undo** restores it while the popup remains open, provided you have not edited it since applying.
7. Close the popup, verify the values in FOLIO, and use FOLIO's own save action. The extension never submits the record.

## Detection and capabilities

The extension reads a single visible Language control when it can identify one, then matches its label or MARC language code to the API's languages. Without that metadata, it suggests languages for a limited set of identifiable scripts. Arabic, Cyrillic, Han and Latin text remain ambiguous without record metadata; choose the language manually. This avoids treating script identification as reliable language identification.

Direction is suggested as original script to romanization for non-Latin letters and romanization to original script for Latin letters. Mixed-script text requires an explicit direction. Latin text may already be a native Latin language, rather than romanization: confirm before sending. Reverse conversion is available only when the selected API table advertises it; not all romanization is reversible.

The language list comes from `GET /languages`. Previews use `POST /trans` with `lang`, `text`, `t_dir`, `capitalize: "no_change"` and `options: {}`. API warnings are displayed. This prototype uses default options; it does not yet expose table-specific capitalization/name options.

## Scope and limitations

- Intended for text fields in Inventory New instance and similar forms. It has no hard-coded FOLIO hostname, so it can be tried on different installations. Compatibility with all FOLIO releases, consortium configurations, custom editors, React form state, and shared-record saving has **not** been verified.
- This is not a quickMARC/880 editor: it does not create parallel MARC fields, link subfields, or modify source MARC. Shared-record permissions and record ownership remain governed by FOLIO.
- It skips empty, hidden, disabled, readonly, password, search, numeric and other non-text inputs. It does not support iframe or shadow-root forms, rich-text editors, or browser-restricted pages.
- Applying uses native input setters and bubbling input/change events. Verify FOLIO retained the result before saving. Navigation or source text changes invalidate an application attempt.
- Closing the popup discards previews and undo state. Original values are not stored persistently.
- Only an explicit preview sends field text to `bibframe.org`; no FOLIO cookies or credentials accompany that request. The API's own data handling applies. Your institution may require approval before bibliographic data is sent to an external service.
- Live API access from the development environment returned HTTP 403 at its egress proxy. Actual service availability and the installed extension on the supplied FOLIO site remain unverified. No FOLIO record has been created or changed during development.

## Validation

Run `node --test core.test.mjs` for detection, direction support, API payload, and failure behavior tests.

The browser smoke test needs Playwright and Chromium. Run:

```
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node browser.test.mjs
```

Use `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`. This test runs the popup and form bridge against a local fixture, with a mock ScriptShifter API and Chrome scripting bridge. It checks discovery, language metadata, preview, apply, input events, undo, and stale text protection. It does not validate packaged extension permissions or a live FOLIO installation.
