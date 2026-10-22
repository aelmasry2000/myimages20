// Works with standard text controls only. No DOM-only duplicate record fields.
export function inspectActiveField() {
  const el=document.activeElement;
  if (!el || !['INPUT','TEXTAREA'].includes(el.tagName)) return null;
  if (el.tagName==='INPUT' && !['text',''].includes(el.type)) return null;
  if (!el.getClientRects().length || el.disabled || el.readOnly ||
      el.closest('[role="search"], [hidden], [aria-hidden="true"]') ||
      ['combobox','searchbox'].includes(el.getAttribute('role')) || el.hasAttribute('aria-autocomplete')) return null;
  const labels=[...(el.labels || [])].map(node=>{const copy=node.cloneNode(true);copy.querySelectorAll('input,textarea,select,button').forEach(n=>n.remove());return copy.textContent.trim();}).join(' ');
  const label=labels || el.getAttribute('aria-label') || el.name || el.id || 'Selected field';
  if (/^(search|find|filter)(\b|\s)/i.test(label)) return null;
  const wrapper=el.closest('[id^="MarcEditorPresenter.textArea."]');
  const tag=(wrapper?.id.match(/\.(\d{3})(?:\D|$)/) || el.getAttribute('data-marc-tag')?.match(/^(\d{3})$/))?.[1] || '';
  const token=crypto.randomUUID();el.setAttribute('data-alma-scriptshifter',token);
  return {key:token,text:el.value,label,tag,url:location.href,
    selectionStart:el.selectionStart,selectionEnd:el.selectionEnd,
    focusedAt:globalThis.almaScriptShifterFocusTime || 0};
}

export function writeField(key, before, after, url) {
  if(location.href!==url)throw new Error('The editor page changed. Capture the field again.');
  const el=[...document.querySelectorAll('[data-alma-scriptshifter]')].find(node=>node.getAttribute('data-alma-scriptshifter')===key);
  if(!el || !el.getClientRects().length || el.disabled || el.readOnly || el.value!==before)throw new Error('The field changed. Capture it again before inserting.');
  const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(el,after);
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
}
