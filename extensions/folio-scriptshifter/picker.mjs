import {insertCharacter, groupMarks} from './diacritics.mjs';
function element(tag, text) {const el = document.createElement(tag); if (text) el.textContent = text; return el;}
function label(text, input) {const el = element('label', text); el.append(input); return el;}
export function renderDiacritics(entry, marks, applyToField) {
  const card = element('article'); card.append(element('strong', entry.label));
  const draft = element('textarea'); draft.value = entry.text; draft.dir = 'auto';
  draft.setAttribute('aria-label', `${entry.label}: diacritics draft`);
  card.append(label('Edit text; place the cursor after the letter to mark', draft));
  const search = element('input'); search.type = 'search'; search.placeholder = 'Arabic fatha, Hebrew, acute…';
  search.setAttribute('aria-label', `${entry.label}: search marks`);
  const choices = element('select'); choices.setAttribute('aria-label', `${entry.label}: Unicode mark`);
  const count = element('small');
  const groups = groupMarks(marks);
  function filter() {
    const words = search.value.trim().toUpperCase().split(/\s+/).filter(Boolean);
    let total = 0;
    const options = [];
    for (const group of groups) {
      const matches = group.marks.filter(mark => words.every(word => `${group.name} ${mark.name} ${mark.code} ${mark.character}`.toUpperCase().includes(word)));
      if (!matches.length) continue;
      const optgroup = element('optgroup'); optgroup.label = group.name;
      optgroup.append(...matches.map(mark => new Option(`${mark.name} — ${'◌'+mark.character}`, mark.character)));
      options.push(optgroup); total += matches.length;
    }
    choices.replaceChildren(...options);
    count.textContent = `${total} matching marks.`;
  }
  search.addEventListener('input', filter); filter();
  const insert = element('button', 'Insert selected mark into FOLIO field');
  const apply = element('button', 'Apply edited draft to field'); apply.disabled = true;
  const undo = element('button', 'Undo diacritics'); undo.disabled = true;
  const message = element('p'); message.setAttribute('role','status');
  let start = entry.selectionStart ?? draft.value.length, end = entry.selectionEnd ?? start, fieldValue = entry.text, pending = false;
  draft.setSelectionRange(start, end);
  const remember = () => {start = draft.selectionStart; end = draft.selectionEnd;};
  for (const event of ['select','keyup','click','input','blur']) draft.addEventListener(event, remember);
  function update() {
    apply.disabled = pending || draft.value === fieldValue;
    undo.disabled = pending || fieldValue === entry.text;
    insert.disabled = pending;
    draft.readOnly = pending;
  }
  draft.addEventListener('input', update);
  async function write(next) {
    pending = true; update();
    try {
      await applyToField(fieldValue, next); fieldValue = next;
      message.textContent = 'Inserted into the FOLIO field. Verify the value before saving. Undo is available while this popup stays open.';
      return true;
    } catch (error) {message.textContent = error.message; return false;}
    finally {pending = false; update();}
  }
  async function add(character) {
    if (pending) return;
    try {
      const result = insertCharacter(draft.value, start, end, character);
      draft.value = result.text; start = end = result.cursor;
      await write(result.text);
      draft.focus(); draft.setSelectionRange(start,end);
    } catch (error) {message.textContent = error.message;}
  }
  insert.addEventListener('click', () => add(choices.value));
  apply.addEventListener('click', () => write(draft.value));
  undo.addEventListener('click', async () => {
    if (await write(entry.text)) {
      draft.value = entry.text; start = end = draft.value.length;
      update(); message.textContent = 'Original text restored.';
    }
  });
  card.append(label('Search Unicode marks',search), choices, count, insert,
    apply, undo, message);
  return card;
}
