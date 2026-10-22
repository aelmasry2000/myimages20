import {insertCharacter, parseCodePoint} from './diacritics.mjs';
function element(tag, text) {const el = document.createElement(tag); if (text) el.textContent = text; return el;}
function label(text, input) {const el = element('label', text); el.append(input); return el;}
export function renderDiacritics(entry, marks, applyToField) {
  const card = element('article'); card.append(element('strong', entry.label));
  const draft = element('textarea'); draft.value = entry.text; draft.dir = 'auto';
  draft.setAttribute('aria-label', `${entry.label}: diacritics draft`);
  card.append(label('Edit text; place the cursor after the letter to mark', draft));
  const search = element('input'); search.type = 'search'; search.placeholder = 'Arabic fatha, Hebrew, acute, U+0301…';
  search.setAttribute('aria-label', `${entry.label}: search marks`);
  const choices = element('select'); choices.setAttribute('aria-label', `${entry.label}: Unicode mark`);
  const count = element('small');
  function filter() {
    const words = search.value.trim().toUpperCase().split(/\s+/).filter(Boolean);
    const matches = marks.filter(mark => words.every(word => `${mark.name} ${mark.code} ${mark.character}`.toUpperCase().includes(word)));
    choices.replaceChildren(...matches.slice(0,100).map(mark => new Option(`${'◌'+mark.character} — ${mark.name} (${mark.code})`, mark.character)));
    count.textContent = `${matches.length} matching marks${matches.length>100 ? '; showing the first 100. Search to narrow the list.' : '.'}`;
  }
  search.addEventListener('input', filter); filter();
  const insert = element('button', 'Insert selected mark');
  const code = element('input'); code.type = 'text'; code.placeholder = 'U+0301';
  code.setAttribute('aria-label', `${entry.label}: Unicode code point`);
  const insertCode = element('button', 'Insert code point');
  const apply = element('button', 'Apply diacritics to field'); apply.disabled = true;
  const undo = element('button', 'Undo diacritics'); undo.disabled = true;
  const message = element('p'); message.setAttribute('role','status');
  let start = draft.value.length, end = start, applied = null;
  let pending = false;
  const remember = () => {start = draft.selectionStart; end = draft.selectionEnd;};
  for (const event of ['select','keyup','click','input','blur']) draft.addEventListener(event, remember);
  function dirty() {apply.disabled = pending || draft.value === entry.text || applied !== null;}
  draft.addEventListener('input', dirty);
  function add(character) {
    try {
      const result = insertCharacter(draft.value, start, end, character);
      draft.value = result.text; start = end = result.cursor;
      draft.focus(); draft.setSelectionRange(start,end); dirty();
      message.textContent = 'Review your draft, then apply it to the field.';
    } catch (error) {message.textContent = error.message;}
  }
  insert.addEventListener('click', () => add(choices.value));
  insertCode.addEventListener('click', () => {
    try {add(parseCodePoint(code.value));} catch (error) {message.textContent = error.message;}
  });
  apply.addEventListener('click', async () => {
    pending = true; dirty(); draft.readOnly = true; insert.disabled = insertCode.disabled = true;
    const next = draft.value;
    try {
      await applyToField(entry.text, next); applied = next; undo.disabled = false;
      insert.disabled = insertCode.disabled = true;
      message.textContent = 'Applied to the form. Verify the result in FOLIO before saving. Undo is available while this popup stays open.';
    } catch (error) {draft.readOnly = false; insert.disabled = insertCode.disabled = false; message.textContent = error.message;}
    finally {pending = false; dirty();}
  });
  undo.addEventListener('click', async () => {
    undo.disabled = true;
    try {
      await applyToField(applied, entry.text); applied = null; draft.value = entry.text;
      start = end = draft.value.length; draft.readOnly = false;
      insert.disabled = insertCode.disabled = false; dirty(); message.textContent = 'Original text restored.';
    } catch (error) {undo.disabled = false; message.textContent = error.message;}
  });
  card.append(label('Search Unicode marks',search), choices, count, insert,
    label('Or enter any assigned character or mark by its Unicode code point',code), insertCode,
    element('small','Combining marks attach to the preceding letter (or the end of your selection). Precomposed letters replace selected text. Text is normalized to Unicode NFC. Automatic restoration requires a language-specific service and is not connected yet.'),
    apply, undo, message);
  return card;
}
