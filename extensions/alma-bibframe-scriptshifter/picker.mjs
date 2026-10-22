import {insertCharacter, groupMarks} from './diacritics.mjs';
function element(tag, text) {const el = document.createElement(tag); if (text) el.textContent = text; return el;}
function label(text, input) {const el = element('label', text); el.append(input); return el;}
export function renderDiacritics(entry, marks, applyToField, languages = []) {
  const card = element('article'); card.append(element('strong', entry.label));
  const draft = element('textarea'); draft.value = entry.text; draft.dir = 'auto';
  draft.setAttribute('aria-label', `${entry.label}: diacritics draft`);
  card.append(label('Edit text; place the cursor after the letter to mark', draft));
  const search = element('input'); search.type = 'search'; search.placeholder = 'Ayn, hamza, macron, dot below…';
  search.setAttribute('aria-label', `${entry.label}: search marks`);
  const choices = element('select'); choices.setAttribute('aria-label', `${entry.label}: romanization character`);
  const count = element('small');
  const indexed = groupMarks(marks);
  for (const language of languages) if (!indexed.some(group=>group.name===language.label))indexed.push({name:language.label,marks:[]});
  const groups = indexed.sort((a,b)=>a.name.localeCompare(b.name,'en')).map(group => ({...group, marks:group.marks.map(mark => ({...mark,
    searchText:`${group.name} ${mark.name} ${mark.unicode_name || ''} ${mark.code} ${mark.character}`.toUpperCase()
  }))}));
  const script = element('select'); script.setAttribute('aria-label', `${entry.label}: character language`);
  script.append(new Option('All ScriptShifter languages',''), ...groups.map(group=>new Option(group.name,group.name)));
  const firstLetter=[...entry.text].find(character=>/\p{Letter}/u.test(character));
  let initial='';
  if(firstLetter && !/\p{Script=Latin}/u.test(firstLetter)) {
    initial=groups.find(group=>{try{return new RegExp(`\\p{Script=${group.name.replaceAll(' ','_')}}`,'u').test(firstLetter);}catch{return false;}})?.name || initial;
  }
  const preferred=languages.find(language=>[language.id,language.label].some(value=>value?.toLowerCase()===entry.preferredLanguage?.toLowerCase()));
  if(preferred)initial=preferred.label;
  script.value=groups.some(group=>group.name===initial)?initial:'';
  function filter() {
    const words = search.value.trim().toUpperCase().split(/\s+/).filter(Boolean);
    let total = 0;
    const options = [];
    let shown = 0;
    for (const group of groups) {
      if (script.value && group.name !== script.value) continue;
      const matches = group.marks.filter(mark => words.every(word => mark.searchText.includes(word)));
      total += matches.length;
      const visible = script.value ? matches : matches.slice(0, Math.max(0,200-shown));
      if (!visible.length) continue;
      const optgroup = element('optgroup'); optgroup.label = group.name;
      optgroup.append(...visible.map(mark => new Option(`${mark.name} — ${/^\p{Mark}+$/u.test(mark.character)?'◌':''}${mark.character}`, mark.character)));
      options.push(optgroup); shown += visible.length;
    }
    choices.replaceChildren(...options);
    count.textContent = total ? `${total} documented romanization characters.${shown<total?' Showing the first 200; choose a language or refine your search.':''}` : 'No documented romanization characters found for this selection.';
  }
  search.addEventListener('input', () => {if(search.value.trim()) script.value=''; filter();});
  script.addEventListener('change',filter); filter();
  const insert = element('button', 'Insert character into Alma field');
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
      message.textContent = 'Inserted into the Alma field. Verify the value before saving. Undo is available while this panel stays open.';
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
  card.append(label('ScriptShifter language',script), label('Search romanization characters',search), choices, count, insert,
    apply, undo, message);
  return card;
}
