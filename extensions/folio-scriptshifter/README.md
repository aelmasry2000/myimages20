# ScriptShifter for FOLIO — prototype

A standalone Chrome 116+/recent Edge Manifest V3 side-panel extension for reviewing transliterations in populated FOLIO text fields. It does not require changes to a FOLIO server. It uses the same Library of Congress service as [Princeton's OCLC ScriptShifter macro](https://github.com/pulibrary/oclcscriptshifter): `https://bibframe.org/scriptshifter/`. This is an independent prototype, not a Princeton or Library of Congress product.

## Install and use

1. Extract the extension archive into a local folder.
2. In Chrome open `chrome://extensions`, or in Edge open `edge://extensions`.
3. Enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Open your FOLIO **New instance** form and enter the title or other text you want to transliterate. Click the extension in the browser toolbar to open its persistent side panel.
5. Click **Transliterate current field**. The extension loads only the currently focused, populated text field inside one recognized Inventory New/Edit instance form. Search, Held by, sidebar filters and autocomplete lookup controls are excluded. Open one record form before loading fields. Select fields by using **Preview this field** only on fields you want to change.
6. Confirm the language and conversion direction. Romanization capitalizes each word for personal/corporate contributor names and publisher/printer/producer names. Other fields capitalize only the first word of the whole field. For supported fields, click **Convert for review**, edit or confirm the result, then click **Add reviewed parallel field** to call ScriptShifter and insert a separate native FOLIO entry, keeping the original. Other fields retain the explicit **Preview this field** / **Apply to field** replacement workflow.
7. Close the popup, verify the values in FOLIO, and use FOLIO's own save action. The extension never submits the record.

## Add diacritics to the current field

1. In FOLIO's New/Edit instance form, click the text field you want to edit. Place the cursor after the letter you want to mark, or select that letter.
2. Open the extension side panel. It automatically shows only that field, preserving your cursor or selection. Empty text fields are supported.
3. Search for a mark, such as `acute`, `ARABIC FATHA`, or `HEBREW POINT SHEVA`, select it and click **Insert selected mark into FOLIO field**. The field updates immediately. You may add more marks or use **Undo diacritics** to restore its original text.
4. Save the record using FOLIO's Save action. If you edit the draft by typing, use **Apply edited draft to field**. Closing the panel discards undo history.

To switch fields, click another FOLIO field, then click **Use current field** in the panel. **Use current field** refreshes the selected field. Search and Held by controls cannot be selected as record fields.

The picker works offline with 2,450 Unicode marks. Each option starts with its Unicode name, followed by its symbol. To keep opening fast, the picker initially shows the script detected from the field (shared marks for Latin text). Use **Language / script** to switch groups. Typing a search automatically searches across all groups. All-script searches display at most 200 results; selecting a script displays its full matching list. Marks are grouped by Unicode script and sorted alphabetically by name within each group; search preserves that ordering. Shared marks appear in a separate group because scripts and languages do not have a one-to-one mapping. Group metadata uses the Unicode 15.0 Scripts.txt data from the Unicode Consortium. Combining marks attach after the cursor/selection, and text is normalized to NFC. Rendering depends on your font and browser. No text is sent to an external service by this mode. Automatic restoration is not implemented; the picker inserts marks you choose.

To update an existing installation, download the latest repository ZIP, replace the extracted extension folder, and click **Reload** on its card in `chrome://extensions` or `edge://extensions`.

## Parallel original-script and romanized values

**Convert for review** detects the direction from the source text, uses the language you confirm, and prepares a result for review. **Add reviewed parallel field** inserts the reviewed text using FOLIO's own repeatable-field Add action. Conversion only starts when you click the button. Reverse conversion must be supported by the selected API language table. Existing identical values are not added again.

- **Resource title:** a single-value field in FOLIO. Its conversion goes into the native **Alternative titles** section below it. Choose the required Alternative title type in FOLIO before saving. The extension cannot create a second saved Resource title with that same label; FOLIO defines the label and schema.
- **Contributors → name, Notes → note, Series → value, Alternative titles → alternativeTitle:** a new entry in the same section. Relevant row metadata is copied, including contributor type and note Staff only. Primary contributor status is not duplicated. Contributor authority links are not copied to the converted name.
- **Publication → publisher/place:** a new publication row, retaining the other visible publication values and role.
- **Editions, physical descriptions, publication frequency/range:** a new scalar entry in the same repeatable section when the native controls match the supported Inventory structure.

New entries are appended by FOLIO's native Add control; the extension does not reorder existing rows or fabricate labels. Unknown/nonrepeatable fields do not offer parallel insertion. Disabled Add controls are respected. Review all new rows and required fields before saving. Remove unwanted parallel entries using FOLIO's own row delete control. The extension does not save the record, create MARC 880 links, or validate a live shared-record save.

## Detection and capabilities

The extension reads a single visible Language control when it can identify one, then matches its label or MARC language code to the API's languages. Without that metadata, it suggests languages for a limited set of identifiable scripts. Arabic, Cyrillic, Han and Latin text remain ambiguous without record metadata; choose the language manually. This avoids treating script identification as reliable language identification.

Direction is suggested as original script to romanization for non-Latin letters and romanization to original script for Latin letters. Mixed-script text requires an explicit direction. Latin text may already be a native Latin language, rather than romanization: confirm before sending. Reverse conversion is available only when the selected API table advertises it; not all romanization is reversible.

The language list comes from `GET /languages` and is cached locally for 24 hours to avoid downloading it each time. Language metadata caching stores no record text. If you explicitly click **Remember reviewed correction**, the source and corrected text are also saved locally. The `storage` permission is used for this cache. Conversions use `POST /trans` with `lang`, the complete field as `text`, `t_dir`, `capitalize`, and `options: {}`. Romanization automatically requests every-word capitalization (`"all"`) for `contributors[n].name` and `publication[n].publisher` (the name field used for publishers, printers and producers, according to the publication row role). Titles, publication places, notes and other fields request first-word-only capitalization (`"first"`). There is no capitalization menu. Reverse conversion always sends `capitalize: false`. The extension sends the complete field once, including punctuation, subtitle and statement of responsibility, instead of converting or capitalizing selected fragments separately. API warnings are displayed. After ScriptShifter returns the complete field, the extension enforces the requested case: it lowercases the result and uppercases only the first cased letter for title-like fields, or the first cased letter of each whitespace-separated word for contributor/publisher names. For example, `al-Kitāb wa-al-Maktabah` becomes `al-Kitāb wa-al-maktabah` for Arabic title fields: the initial `al-` stays lowercase and the following stem initial is capitalized. Other later words are lowercase. This article exception applies to Resource title, Index title and Alternative title, not publisher/contributor names. This overrides internal capitals introduced by transliteration tables. Reverse conversion is left unchanged. This setting does not constitute a complete automatic implementation of language-specific cataloging rules or proper-name recognition. Review capitalization of proper names and other language-dependent cases. Additional table-specific name options are not yet exposed.

## Scope and limitations

- Intended for text fields in Inventory New instance and similar forms. It has no hard-coded FOLIO hostname, so it can be tried on different installations. Field discovery requires the Inventory instance form marker or a recognized title input inside a form. Unknown editors fail with a prompt to open an instance form instead of scanning unrelated controls. Compatibility with all FOLIO releases, consortium configurations, custom editors, React form state, and shared-record saving has **not** been verified.
- This is not a quickMARC/880 editor: it does not create parallel MARC fields, link subfields, or modify source MARC. Shared-record permissions and record ownership remain governed by FOLIO.
- Transliteration skips empty fields; offline diacritics includes them. Both skip hidden, disabled, readonly, password, search, numeric and other non-text inputs. It does not support iframe or shadow-root forms, rich-text editors, or browser-restricted pages.
- Applying uses native input setters and bubbling input/change events. Verify FOLIO retained the result before saving. Navigation or source text changes invalidate an application attempt.
- Closing the panel discards previews and undo state. Original values are not stored persistently unless you explicitly save a reviewed correction.
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

These browser fixtures verify field-aware capitalization request values for personal/corporate names, publisher/printer/producer roles and titles, and insertion of the complete mock API response, as well as both conversion directions through the popup with a mock API, native alternative-title rows, duplicate protection, contributor metadata, staff-only notes, locked Add controls, unsupported fields and stale source values. Live API calls and actual FOLIO persistence still require testing in your browser.

## Troubleshooting intermittent controls (0.8.0)

The extension now uses a side panel so it stays open while you interact with FOLIO. It remembers the last selected field/cursor when extension UI takes focus, and field tokens remain stable between local diacritics and conversion views. Changing records or editing source text still invalidates unsafe writes. A failed language request keeps the offline picker available, and delayed requests cannot replace a newer view.

Remove the older FOLIO extension, extract the latest dedicated FOLIO ZIP into a fresh folder, and Load unpacked again. Refresh FOLIO, open New/Edit instance, click in the desired field, then open the toolbar side panel. Use **Use current field** after selecting a different field.

Fixture browser tests cover field blur, direct marks, failed language fetches and preservation of the offline controls. This development environment blocks installation of unpacked extensions by browser administrator policy, so a real installed-extension/toolbar test could not be completed here. Live FOLIO behavior still needs verification in the user's browser.

## Tab-access fix (0.8.1)

Chrome may omit a tab's URL from `tabs.query`. The extension now accepts a valid tab ID without requiring that optional metadata and checks access by running its field inspector. The toolbar action explicitly opens the side panel inside the user gesture that grants `activeTab`. No broad site or tabs permission was added.

After updating, reload the extension, refresh the FOLIO page, select its browser tab and click the ScriptShifter toolbar icon. Opening the panel from Chrome's generic side-panel selector alone does not necessarily grant access. If access is missing, the tool now gives that specific instruction rather than claiming FOLIO is not in a normal browser tab.

## Reviewed corrections (0.9.0)

Conversion no longer automatically inserts a machine result into a parallel field. Review or edit the output first, then use **Add reviewed parallel field** (or **Apply to field** for nonrepeatable fields). Machine transliteration can be ambiguous; this workflow is not a guarantee of correct spelling for all names or languages.

**Remember reviewed correction** stores the exact source and reviewed output in this browser for the selected language/direction, reusable in any field. For example, correct `Ayman → أيما` to `Ayman → أيمن`, then save. Select **Also remember the reverse mapping** only if you also want `أيمن → Ayman`. A conflicting inverse mapping is rejected without changing either saved entry. Matching uses Unicode NFC and trims outside whitespace; it is not a substring dictionary and does not guess variants or merge different source names. Saved reviewed values override automatic casing.

**Forget saved correction** removes the current source/direction entry; inverse entries are separate and can be removed when that direction/source is selected. Saved corrections contain bibliographic text, stay local to this extension/browser profile, and are not shared with other installations or sent to a new lookup service. No name/authority service has been integrated; a saved correction represents your review, not independent verification. Saved exact matches can work without another conversion API request, but the language list must be available. No universal accuracy claim is made.
