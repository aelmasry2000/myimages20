# ScriptShifter for FOLIO — prototype

A standalone Chrome/Edge Manifest V3 extension for reviewing transliterations in populated FOLIO text fields. It does not require changes to a FOLIO server. It uses the same Library of Congress service as [Princeton's OCLC ScriptShifter macro](https://github.com/pulibrary/oclcscriptshifter): `https://bibframe.org/scriptshifter/`. This is an independent prototype, not a Princeton or Library of Congress product.

## Install and use

1. Extract the extension archive into a local folder.
2. In Chrome open `chrome://extensions`, or in Edge open `edge://extensions`.
3. Enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Open your FOLIO **New instance** form and enter the title or other text you want to transliterate. Click the extension in the browser toolbar.
5. Click **Load fields and languages**. The extension lists populated, visible, editable text inputs and textareas inside one recognized Inventory New/Edit instance form. Search, Held by, sidebar filters and autocomplete lookup controls are excluded. Open one record form before loading fields. Select fields by using **Preview this field** only on fields you want to change.
6. Confirm each language and conversion direction. For supported fields, click **Convert and add parallel field** to call ScriptShifter and insert a separate native FOLIO entry, keeping the original. Other fields retain the explicit **Preview this field** / **Apply to field** replacement workflow.
7. Close the popup, verify the values in FOLIO, and use FOLIO's own save action. The extension never submits the record.

## Add diacritics to the current field

1. In FOLIO's New/Edit instance form, click the text field you want to edit. Place the cursor after the letter you want to mark, or select that letter.
2. Open the extension. It automatically shows only that field, preserving your cursor or selection. Empty text fields are supported.
3. Search for a mark, such as `acute`, `ARABIC FATHA`, or `HEBREW POINT SHEVA`, select it and click **Insert selected mark into FOLIO field**. The field updates immediately. You may add more marks or use **Undo diacritics** to restore its original text.
4. Save the record using FOLIO's Save action. If you edit the draft by typing, use **Apply edited draft to field**. Closing the popup discards undo history.

To switch fields, close the popup, click another FOLIO field, then reopen the extension. **Use current field** refreshes the selected field. Search and Held by controls cannot be selected as record fields.

The picker works offline with 2,450 Unicode marks. Combining marks attach after the cursor/selection, and text is normalized to NFC. Rendering depends on your font and browser. No text is sent to an external service by this mode. Automatic restoration is not implemented; the picker inserts marks you choose.

To update an existing installation, download the latest repository ZIP, replace the extracted extension folder, and click **Reload** on its card in `chrome://extensions` or `edge://extensions`.

## Parallel original-script and romanized values

**Convert and add parallel field** detects the direction from the source text, uses the language you confirm, and inserts the conversion using FOLIO's own repeatable-field Add action. Conversion only starts when you click the button. Reverse conversion must be supported by the selected API language table. Existing identical values are not added again.

- **Resource title:** a single-value field in FOLIO. Its conversion goes into the native **Alternative titles** section below it. Choose the required Alternative title type in FOLIO before saving. The extension cannot create a second saved Resource title with that same label; FOLIO defines the label and schema.
- **Contributors → name, Notes → note, Series → value, Alternative titles → alternativeTitle:** a new entry in the same section. Relevant row metadata is copied, including contributor type and note Staff only. Primary contributor status is not duplicated. Contributor authority links are not copied to the converted name.
- **Publication → publisher/place:** a new publication row, retaining the other visible publication values and role.
- **Editions, physical descriptions, publication frequency/range:** a new scalar entry in the same repeatable section when the native controls match the supported Inventory structure.

New entries are appended by FOLIO's native Add control; the extension does not reorder existing rows or fabricate labels. Unknown/nonrepeatable fields do not offer parallel insertion. Disabled Add controls are respected. Review all new rows and required fields before saving. Remove unwanted parallel entries using FOLIO's own row delete control. The extension does not save the record, create MARC 880 links, or validate a live shared-record save.

## Detection and capabilities

The extension reads a single visible Language control when it can identify one, then matches its label or MARC language code to the API's languages. Without that metadata, it suggests languages for a limited set of identifiable scripts. Arabic, Cyrillic, Han and Latin text remain ambiguous without record metadata; choose the language manually. This avoids treating script identification as reliable language identification.

Direction is suggested as original script to romanization for non-Latin letters and romanization to original script for Latin letters. Mixed-script text requires an explicit direction. Latin text may already be a native Latin language, rather than romanization: confirm before sending. Reverse conversion is available only when the selected API table advertises it; not all romanization is reversible.

The language list comes from `GET /languages`. Previews use `POST /trans` with `lang`, `text`, `t_dir`, `capitalize: "no_change"` and `options: {}`. API warnings are displayed. This prototype uses default options; it does not yet expose table-specific capitalization/name options.

## Scope and limitations

- Intended for text fields in Inventory New instance and similar forms. It has no hard-coded FOLIO hostname, so it can be tried on different installations. Field discovery requires the Inventory instance form marker or a recognized title input inside a form. Unknown editors fail with a prompt to open an instance form instead of scanning unrelated controls. Compatibility with all FOLIO releases, consortium configurations, custom editors, React form state, and shared-record saving has **not** been verified.
- This is not a quickMARC/880 editor: it does not create parallel MARC fields, link subfields, or modify source MARC. Shared-record permissions and record ownership remain governed by FOLIO.
- Transliteration skips empty fields; offline diacritics includes them. Both skip hidden, disabled, readonly, password, search, numeric and other non-text inputs. It does not support iframe or shadow-root forms, rich-text editors, or browser-restricted pages.
- Applying uses native input setters and bubbling input/change events. Verify FOLIO retained the result before saving. Navigation or source text changes invalidate an application attempt.
- Closing the popup discards previews and undo state. Original values are not stored persistently.
- Only an explicit preview sends field text to `bibframe.org`; no FOLIO cookies or credentials accompany that request. The API's own data handling applies. Your institution may require approval before bibliographic data is sent to an external service.
- Live API access from the development environment returned HTTP 403 at its egress proxy. Actual service availability and the installed extension on the supplied FOLIO site remain unverified. No FOLIO record has been created or changed during development.

## Validation

Run `node --test core.test.mjs diacritics.test.mjs` for detection, direction support, API payload, and failure behavior tests.

The browser smoke test needs Playwright and Chromium. Run:

```
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node browser.test.mjs
```

Use `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`. This test runs the popup and form bridge against a local fixture, with a mock ScriptShifter API and Chrome scripting bridge. It checks discovery, language metadata, preview, apply, input events, undo, stale text protection, automatic current-field selection, preservation of the FOLIO cursor position, immediate offline Arabic mark insertion, precomposed characters in empty fields, exclusion of Search/Held by/lookup controls, and rejection of pages without a record form. It does not validate packaged extension permissions or a live FOLIO installation.

## Copyright

Copyright © 2026 Ayman El-Masry.

For native parallel-row insertion tests, run:

```
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node parallel.test.mjs
```

These browser fixtures verify both conversion directions through the popup with a mock API, native alternative-title rows, duplicate protection, contributor metadata, staff-only notes, locked Add controls, unsupported fields and stale source values. Live API calls and actual FOLIO persistence still require testing in your browser.
