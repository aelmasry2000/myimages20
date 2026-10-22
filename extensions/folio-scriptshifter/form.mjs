// Executed in the active tab only after the extension button is clicked.
export function inspectForm(includeEmpty = false, focusedOnly = false) {
  // Keep the page's last field/cursor when browser extension UI takes focus.
  const state = globalThis.folioScriptShifterSelection ||= {installed:false,last:null};
  const remember = () => {
    const field=document.activeElement;
    if (field && ['INPUT','TEXTAREA'].includes(field.tagName) &&
        (field.tagName==='TEXTAREA' || ['text',''].includes(field.type))) {
      state.last={field,start:field.selectionStart,end:field.selectionEnd,url:location.href};
    }
  };
  if(!state.installed){
    for(const event of ['focusin','selectionchange','pointerup','keyup'])document.addEventListener(event,remember,true);
    state.installed=true;
  }
  remember();
  const visible = el => !!el.getClientRects().length && !el.disabled && !el.readOnly &&
    !el.closest('[hidden], [aria-hidden="true"]');
  const labelText = node => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('input, textarea, select, button').forEach(el => el.remove());
    return copy.textContent.trim();
  };
  const label = el => [...(el.labels || [])].map(labelText).join(' ') ||
    el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || 'Unlabelled field';
  // Inventory renders the creation/editing layer beside the search/filter panes.
  // Use its actual form marker, never all document inputs.
  const candidates = [...document.querySelectorAll('form[data-test-instance-page-type]')].filter(visible);
  if (!candidates.length) {
    for (const title of document.querySelectorAll('#input_instance_title, form input[name="title"]')) {
      const form = title.closest('form');
      if (form && visible(form) && !candidates.includes(form)) candidates.push(form);
    }
  }
  if (candidates.length !== 1) throw new Error('Open one FOLIO New instance or Edit instance form, then load fields again. Search and filter controls are excluded.');
  const scope = candidates[0];
  const recordText = el => !el.closest('[role="search"], [role="searchbox"]') &&
    !['combobox','searchbox'].includes(el.getAttribute('role')) && !el.hasAttribute('aria-autocomplete');
  let inputs = [...scope.querySelectorAll('input, textarea')].filter(el =>
    (el.tagName === 'TEXTAREA' || ['text', ''].includes(el.type)) && visible(el) && recordText(el) && (includeEmpty || el.value.trim()));
  if (focusedOnly) {
    let active = document.activeElement;
    if ((!active || ['BODY','HTML'].includes(active.tagName)) && state.last?.url===location.href && state.last.field.isConnected)active=state.last.field;
    if (!inputs.includes(active)) throw new Error('Click inside the FOLIO text field you want to edit, then open this extension.');
    inputs = [active];
  }
  const token = crypto.randomUUID();
  const entries = inputs.map((el, index) => {
    const key = el.getAttribute('data-folio-scriptshifter') || `${token}-${index}`;
    el.setAttribute('data-folio-scriptshifter', key);
    return {key, label: label(el), name: el.name, resourceTitle: el.name === 'title' || el.id === 'input_instance_title', text: el.value, selectionStart: state.last?.field===el ? state.last.start : el.selectionStart, selectionEnd: state.last?.field===el ? state.last.end : el.selectionEnd};
  });
  // Use a single unambiguous record-language control; do not infer from UI locale.
  const langs = [...scope.querySelectorAll('input, select')].filter(el => visible(el) &&
    /^(record )?language(s)?\s*:?$/i.test(label(el))).map(el =>
      el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent.trim() : el.value).filter(Boolean);
  return {entries, language: langs.length === 1 ? langs[0] : '', url: location.href};
}

export function applyField(key, before, after, originalUrl) {
  if (location.href !== originalUrl) throw new Error('The record page changed. Refresh fields and preview again.');
  const matches = [...document.querySelectorAll('[data-folio-scriptshifter]')].filter(el =>
    el.getAttribute('data-folio-scriptshifter') === key);
  if (matches.length !== 1) throw new Error('Field changed or disappeared. Refresh fields.');
  const el = matches[0];
  if (!el.isConnected || !el.getClientRects().length || el.disabled || el.readOnly || el.value !== before) {
    throw new Error('Field changed since preview. Refresh fields and preview again.');
  }
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, after);
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
  return true;
}

// Use FOLIO's native repeatable-row action so React owns the new saved field.
export async function addParallelField(key, before, converted, originalUrl) {
  const fail = message => {throw new Error(message);};
  if (location.href !== originalUrl) fail('The record page changed. Load the field again.');
  const source = [...document.querySelectorAll('[data-folio-scriptshifter]')].find(el => el.getAttribute('data-folio-scriptshifter') === key);
  if (!source || source.value !== before || source.disabled || source.readOnly || !source.getClientRects().length) fail('The original field changed. Load it again.');
  if (!converted?.trim()) fail('No conversion to insert.');
  const form = source.closest('form');
  if (!form) fail('Record form not found.');
  const name = source.name;
  const title = name === 'title' || source.id === 'input_instance_title';
  const match = name.match(/^(contributors|notes|series|alternativeTitles|publication|editions|physicalDescriptions|publicationFrequency|publicationRange)\[(\d+)\](?:\.(\w+))?$/);
  const allowed = {contributors:['name'],notes:['note'],series:['value'],alternativeTitles:['alternativeTitle'],publication:['publisher','place'],editions:[''],physicalDescriptions:[''],publicationFrequency:[''],publicationRange:['']};
  if (!title && (!match || !allowed[match[1]].includes(match[3] || ''))) fail('This field has no supported parallel entry. The original has been kept.');
  const root = title ? 'alternativeTitles' : match[1];
  const member = title ? 'alternativeTitle' : (match[3] || '');
  const isTarget = el => new RegExp(`^${root}\\[\\d+\\]${member ? '\\.'+member : ''}$`).test(el.name);
  let group = title ? form.querySelector('[name^="alternativeTitles["]')?.closest('fieldset') : source.closest('fieldset');
  if (!group && title) {
    const section = form.querySelector('#instanceSection02');
    group = section?.querySelector('fieldset[data-test-repeatable-field]');
    if (!group) group = [...form.querySelectorAll('fieldset[data-test-repeatable-field]')].find(el => /alternative titles?/i.test(el.querySelector('legend')?.textContent || ''));
  }
  if (!group) fail('The native repeatable section was not found. The original has been kept.');
  const targets = () => [...group.querySelectorAll('input, textarea')].filter(isTarget);
  if (targets().some(el => el.value === converted)) return {duplicate:true, needsType:false};
  const button = group.querySelector('[data-test-repeatable-field-add-item-button]');
  if (!button || button.disabled) fail('FOLIO does not allow adding another entry here. The original has been kept.');
  const previous = new Set(targets().map(el => el.name));
  // Snapshot editable row metadata before triggering a React rerender.
  const sourceRow = title ? null : source.closest('[data-test-repeatable-field-list-item]');
  const metadata = sourceRow ? [...sourceRow.querySelectorAll('input, textarea, select')].filter(el => el !== source && el.name && el.type !== 'hidden' && !el.name.endsWith('.primary')).map(el => ({
    suffix: el.name.replace(new RegExp(`^${root}\\[\\d+\\]`), ''), value: el.value, checked: el.checked, type: el.type, tag:el.tagName
  })) : [];
  button.click();
  const target = await new Promise((resolve,reject) => {
    let timer;
    const observer = new MutationObserver(check);
    function check() {
      const found = targets().find(el => !previous.has(el.name));
      if (found) {observer.disconnect();clearTimeout(timer);resolve(found);}
    }
    observer.observe(group,{childList:true,subtree:true});
    timer=setTimeout(()=>{observer.disconnect();reject(new Error('FOLIO did not create a parallel entry. Check the form before trying again.'));},4000);
    check();
  });
  if (location.href !== originalUrl || !source.isConnected || source.value !== before) fail('The original field changed while adding the entry. Review the new blank row.');
  if (target.disabled || target.readOnly || target.value) fail('The new field is not empty and editable. No text was replaced.');
  const row = target.closest('[data-test-repeatable-field-list-item]');
  const prefix = target.name.replace(new RegExp(member ? '\\.'+member+'$' : '$'), '');
  function setValue(el, value) {
    if (el.disabled || el.readOnly) fail('A new row control is locked. Review the new row in FOLIO.');
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
    el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  for (const info of metadata) {
    const el = [...(row?.querySelectorAll('input, textarea, select') || [])].find(control => control.name === prefix+info.suffix);
    if (!el) {if (info.value || info.checked) fail('Matching row metadata is unavailable. Review the new blank row.');continue;}
    if (info.type === 'checkbox') {
      if (el.checked !== info.checked) {if (el.disabled) fail('Row privacy settings are locked.');el.click();}
    } else if (info.value) {
      if (el.tagName === 'SELECT' && ![...el.options].some(o=>o.value===info.value)) fail('The source row type is not available. Review the new blank row.');
      setValue(el,info.value);
    }
  }
  setValue(target,converted);
  let needsType = false;
  if (title && row) {
    const type = [...row.querySelectorAll('select')].find(el=>el.name.endsWith('.alternativeTitleTypeId'));
    // Type names vary by tenant. Leave this explicit rather than inventing one.
    needsType = !type?.value;
  }
  target.scrollIntoView({block:'nearest'});
  return {duplicate:false,needsType};
}
