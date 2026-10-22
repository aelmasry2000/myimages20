import {lookupCorrection,rememberCorrection,forgetCorrection} from './corrections.mjs';
import {activePage} from './tab.mjs';
import {renderDiacritics} from './picker.mjs';
import {apiRequest, detectDirection, suggestLanguage, assertSupported, loadLanguages, transliterationRequest, normalizeRomanization} from './core.mjs';
import {inspectForm, applyField, addParallelField} from './form.mjs';
const status = document.querySelector('#status');
const load = document.querySelector('#load');
const diacritics = document.querySelector('#diacritics');
const fields = document.querySelector('#fields');
let languageLoad = null;
let fieldView = 0;
function element(tag, text) {const el = document.createElement(tag); if (text) el.textContent = text; return el;}
async function execute(tabId, func, args = []) {
  let result;
  try {result = await chrome.scripting.executeScript({target:{tabId},func,args});}
  catch(error) {
    if(/cannot access|host permission|not allowed to access/i.test(error.message))throw new Error('Click the ScriptShifter toolbar icon while the FOLIO tab is active to allow access, then try again.');
    throw error;
  }
  if (!result[0] || result[0].error || result[0].result === undefined) throw new Error(result[0]?.error?.message || 'FOLIO could not read this field. Refresh the FOLIO page, click an editable field, and try again.');
  return result[0].result;
}
load.addEventListener('click', async () => {
  if(languageLoad)return;
  const view=++fieldView;
  load.disabled=true; status.textContent='Loading ScriptShifter languages… You can continue using diacritics.';
  // Capture the field first, while it is still the user's chosen source.
  try {
    const tab=await activePage();
    const form=await execute(tab.id,inspectForm,[false,true]);
    const pending=loadLanguages();languageLoad=pending;
    const tables=await pending;
    if(view!==fieldView)return;
    fields.replaceChildren();
    for(const entry of form.entries)render(entry,tables,tab.id,form);
    status.textContent=`Transliterating: ${form.entries[0].label}`;
  } catch(error){if(view!==fieldView)return;status.textContent=`Transliteration could not load: ${error.message} Diacritics remains available.`;}
  finally{languageLoad=null;load.disabled=false;}
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
  const parallel = entry.resourceTitle || /^(contributors\[\d+\]\.name|notes\[\d+\]\.note|series\[\d+\]\.value|alternativeTitles\[\d+\]\.alternativeTitle|publication\[\d+\]\.(publisher|place)|(editions|physicalDescriptions|publicationFrequency|publicationRange)\[\d+\])$/.test(entry.name || '');
  const preview = element('button', parallel ? 'Convert for review' : 'Preview this field');
  const apply = element('button', parallel ? 'Add reviewed parallel field' : 'Apply to field'); apply.disabled = true;
  const undo = element('button', 'Undo'); undo.disabled = true;
  const output = element('textarea'); output.readOnly = false; output.setAttribute('aria-label', `${entry.label}: preview`);
  const message = element('p'); message.setAttribute('role', 'status');
  if (parallel) undo.hidden = true;
  const remember=element('button','Remember reviewed correction');remember.disabled=true;
  const forget=element('button','Forget saved correction');
  const reverse=element('input');reverse.type='checkbox';reverse.setAttribute('aria-label',`${entry.label}: remember reverse correction`);
  const reverseLabel=element('label','Also remember the reverse mapping');reverseLabel.prepend(reverse);
  const updateReview=()=>{apply.disabled=!output.value.trim() || output.value===before;remember.disabled=!output.value.trim();};
  output.addEventListener('input',updateReview);
  let before = entry.text, applied = '';
  function invalidate() {output.value = ''; apply.disabled = true;remember.disabled=true;}
  lang.addEventListener('change', invalidate);
  direction.addEventListener('change', invalidate);
  preview.addEventListener('click', async () => {
    invalidate(); output.readOnly=true;preview.disabled = true; lang.disabled = true; direction.disabled = true;
    message.textContent = 'Waiting for ScriptShifter conversion…';
    try {
      if(!tables[lang.value] || !['s2r','r2s'].includes(direction.value))throw new Error('Select the language and direction first.');
      const saved=await lookupCorrection(lang.value,direction.value,before);
      let converted,warnings=[];
      if(saved!==null)converted=saved;
      else {
        assertSupported(tables,lang.value,direction.value);
        const data=await apiRequest('trans',transliterationRequest(lang.value,before,direction.value,entry.name));
        converted=normalizeRomanization(data.output,direction.value,entry.name,lang.value);warnings=data.warnings || [];
      }
      output.value=converted;updateReview();
      message.textContent=[saved!==null?'Loaded your saved correction.':'Machine conversion may be ambiguous, especially names.', 'Review or edit the result, then insert it.',...warnings].join('\n');
    } catch (error) {message.textContent = error.message;}
    finally {output.readOnly=false;preview.disabled = false; lang.disabled = false; direction.disabled = false;}
  });
  apply.addEventListener('click', async () => {
    apply.disabled = true;
    try {
      if(parallel){
        const result=await execute(tabId,addParallelField,[entry.key,before,output.value,form.url]);
        message.textContent=[result.duplicate?'That parallel value is already present.':'Added the reviewed parallel entry; the original is unchanged.',result.needsType?'Choose an Alternative title type in FOLIO before saving.':'Review and save in FOLIO.'].join('\n');
        return;
      }
      await execute(tabId, applyField, [entry.key, before, output.value, form.url]);
      applied = output.value; undo.disabled = false; preview.disabled = true;
      lang.disabled = true; direction.disabled = true;
      message.textContent = 'Applied to the form. Verify the value in FOLIO before saving. Undo is available while this popup stays open.';
    } catch (error) {message.textContent = error.message;updateReview();}
  });
  remember.addEventListener('click',async()=>{
    remember.disabled=true;
    try{await rememberCorrection(lang.value,direction.value,before,output.value,reverse.checked);message.textContent='Correction saved in this browser for this language and exact text, in any field.';}
    catch(error){message.textContent=error.message;}
    finally{remember.disabled=false;}
  });
  forget.addEventListener('click',async()=>{
    try{await forgetCorrection(lang.value,direction.value,before);message.textContent='Saved correction for this direction removed. Reverse corrections are separate.';}
    catch(error){message.textContent=error.message;}
  });
  undo.addEventListener('click', async () => {
    undo.disabled = true;
    try {
      await execute(tabId, applyField, [entry.key, applied, before, form.url]);
      invalidate(); preview.disabled = false; lang.disabled = false; direction.disabled = false;
      message.textContent = 'Original text restored.';
    } catch (error) {message.textContent = error.message;}
  });
  card.append(preview, output, apply, reverseLabel,remember,forget,undo, element('small','Saved corrections stay in this browser and contain the source and corrected text. They are exact matches, not authority verification.'),message); fields.append(card);
}

async function loadCurrentField() {
  ++fieldView;
  load.disabled = true; diacritics.disabled = true; fields.replaceChildren(); status.textContent = 'Loading diacritics…';
  try {
    const tab=await activePage();
    const [catalog, form] = await Promise.all([
      fetch(new URL('./marks.json', import.meta.url)).then(response => {
        if (!response.ok) throw new Error('Cannot load the bundled Unicode catalog.');
        return response.json();
      }), execute(tab.id, inspectForm, [true, true])
    ]);
    for (const entry of form.entries) fields.append(renderDiacritics({...entry,preferredLanguage:form.language}, catalog.marks,
      (before, after) => execute(tab.id, applyField, [entry.key, before, after, form.url]),catalog.languages));
    status.textContent = `Editing: ${form.entries[0].label}`;
  } catch (error) {status.textContent = error.message;}
  finally {load.disabled = Boolean(languageLoad); diacritics.disabled = false;}
}
diacritics.addEventListener('click', loadCurrentField);
loadCurrentField();
