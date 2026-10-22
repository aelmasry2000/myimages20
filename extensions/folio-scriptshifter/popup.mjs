import {apiRequest, detectDirection, suggestLanguage, assertSupported} from './core.mjs';
import {inspectForm, applyField} from './form.mjs';
const status = document.querySelector('#status');
const load = document.querySelector('#load');
const fields = document.querySelector('#fields');
function element(tag, text) {const el = document.createElement(tag); if (text) el.textContent = text; return el;}
async function execute(tabId, func, args = []) {
  const result = await chrome.scripting.executeScript({target: {tabId}, func, args});
  if (!result[0] || result[0].error) throw new Error(result[0]?.error?.message || 'Could not access this form.');
  return result[0].result;
}
load.addEventListener('click', async () => {
  load.disabled = true; fields.replaceChildren(); status.textContent = 'Loading…';
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id || !/^https?:/.test(tab.url || '')) throw new Error('Open the FOLIO form in a normal browser tab.');
    const [tables, form] = await Promise.all([apiRequest('languages'), execute(tab.id, inspectForm)]);
    for (const entry of form.entries) render(entry, tables, tab.id, form);
    status.textContent = form.entries.length ? `${form.entries.length} populated text fields found. Only preview fields you intend to convert.` : 'No populated editable text fields found. Enter text in the record first.';
  } catch (error) {status.textContent = error.message;}
  finally {load.disabled = false;}
});
function render(entry, tables, tabId, form) {
  const card = element('article');
  card.append(element('strong', entry.label), element('p', entry.text));
  const lang = element('select'); lang.setAttribute('aria-label', `${entry.label}: language`);
  lang.append(new Option('Choose language…', ''));
  for (const [id, info] of Object.entries(tables).filter(([,t]) => !t.alias_of).sort((a,b) => a[1].label.localeCompare(b[1].label))) {
    lang.append(new Option(info.label, id));
  }
  const suggestion = suggestLanguage(entry.text, tables, form.language); lang.value = suggestion.id;
  const langLabel = element('label', 'Language'); langLabel.append(lang);
  card.append(langLabel, element('small', suggestion.reason));
  const direction = element('select'); direction.setAttribute('aria-label', `${entry.label}: direction`);
  direction.append(new Option('Choose direction…', ''), new Option('Original script → Romanization', 's2r'), new Option('Romanization → Original script', 'r2s'));
  direction.value = detectDirection(entry.text);
  const dirLabel = element('label', 'Direction'); dirLabel.append(direction); card.append(dirLabel);
  const preview = element('button', 'Preview this field');
  const apply = element('button', 'Apply to field'); apply.disabled = true;
  const undo = element('button', 'Undo'); undo.disabled = true;
  const output = element('textarea'); output.readOnly = true; output.setAttribute('aria-label', `${entry.label}: preview`);
  const message = element('p'); message.setAttribute('role', 'status');
  let before = entry.text, applied = '';
  function invalidate() {output.value = ''; apply.disabled = true;}
  lang.addEventListener('change', invalidate); direction.addEventListener('change', invalidate);
  preview.addEventListener('click', async () => {
    invalidate(); preview.disabled = true; lang.disabled = true; direction.disabled = true;
    try {
      assertSupported(tables, lang.value, direction.value);
      const data = await apiRequest('trans', {lang: lang.value, text: before, t_dir: direction.value, capitalize: 'no_change', options: {}});
      output.value = data.output; apply.disabled = data.output === before;
      message.textContent = [data.output === before ? 'Output is unchanged.' : 'Review the output, then apply.', ...(data.warnings || [])].join('\n');
    } catch (error) {message.textContent = error.message;}
    finally {preview.disabled = false; lang.disabled = false; direction.disabled = false;}
  });
  apply.addEventListener('click', async () => {
    apply.disabled = true;
    try {
      await execute(tabId, applyField, [entry.key, before, output.value, form.url]);
      applied = output.value; undo.disabled = false; preview.disabled = true;
      lang.disabled = true; direction.disabled = true;
      message.textContent = 'Applied to the form. Verify the value in FOLIO before saving. Undo is available while this popup stays open.';
    } catch (error) {message.textContent = error.message;}
  });
  undo.addEventListener('click', async () => {
    undo.disabled = true;
    try {
      await execute(tabId, applyField, [entry.key, applied, before, form.url]);
      invalidate(); preview.disabled = false; lang.disabled = false; direction.disabled = false;
      message.textContent = 'Original text restored.';
    } catch (error) {message.textContent = error.message;}
  });
  card.append(preview, output, apply, undo, message); fields.append(card);
}
