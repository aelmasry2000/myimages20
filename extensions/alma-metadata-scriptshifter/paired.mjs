// Injected into Alma's editor frame. Create rows through Alma, never DOM clones.
export async function apply245Pair(key, before, converted, direction, url, timeout = 2000) {
 if (!['s2r','r2s'].includes(direction) || !converted?.trim()) throw new Error('Convert the field and choose its direction first.');
 if (location.href !== url) throw new Error('The editor page changed. Capture the field again.');
 const source = [...document.querySelectorAll('[data-alma-scriptshifter]')].find(el=>el.getAttribute('data-alma-scriptshifter')===key);
 const editable = el=>el?.isConnected && el.tagName==='TEXTAREA' && el.getClientRects().length && !el.disabled && !el.readOnly;
 const group = source?.closest('[id^="MarcEditorPresenter.textArea."]');
 const tag = group?.id.match(/\.(\d{3})(?:\D|$)/)?.[1] || source?.getAttribute('data-marc-tag');
 if (!editable(source) || source.value!==before) throw new Error('The field changed. Capture it again before updating the pair.');
 if (tag!=='245') throw new Error('Automatic paired rows currently require a recognized 245 textarea.');
 if (source.hasAttribute('data-alma-scriptshifter-paired')) throw new Error('This 245 already has a completed pair. Review its existing rows in Alma.');
 const fields = [...document.querySelectorAll('textarea')];
 const row = source.closest('tr');
 // Only reuse a row that Alma groups with this exact field, never an arbitrary empty field.
 const paired = [...(group || source).querySelectorAll('textarea')].filter(el=>el!==source && editable(el));
 if (paired.length>1 || (paired[0] && !(source.compareDocumentPosition(paired[0]) & Node.DOCUMENT_POSITION_FOLLOWING))) throw new Error('This field has multiple or ambiguous script rows. Review them in Alma.');
 let target = paired[0];
 let created = false;
 if (!target) {
  source.focus();
  const options = {key:'l',code:'KeyL',ctrlKey:true,keyCode:76,which:76,bubbles:true,cancelable:true};
  source.dispatchEvent(new KeyboardEvent('keydown',options));
  source.dispatchEvent(new KeyboardEvent('keyup',options));
  const deadline = Date.now()+timeout;
  do {
   const added = [...document.querySelectorAll('textarea')].filter(el=>!fields.includes(el) && editable(el));
   if (added.length>1) throw new Error('Alma opened multiple controls. Review the new row; no text was replaced.');
   if (added.length===1) {
    const candidate=added[0];
    // A dialog input is not a record row. The new row must belong to this field
    // or immediately follow the source's native table row.
    const sameGroup=group?.isConnected && group.contains(candidate);
    const nextRow=row?.nextElementSibling;
    if (!candidate.closest('[role="dialog"],dialog') && (sameGroup || (nextRow?.tagName==='TR' && nextRow.contains(candidate)))) {
     target=candidate;created=true;break;
    }
   }
   await new Promise(resolve=>setTimeout(resolve,50));
  } while(Date.now()<deadline);
 }
 if (!target) throw new Error('Alma did not expose a paired row after Ctrl+L. Press Ctrl+L manually in 245, then capture the upper row and try again. No text was replaced.');
 // Alma can add native linkage during Ctrl+L. Keep that linkage on each row.
 const parts = value=>{
  const matches=[...value.matchAll(/(\$\$|\$|ǂ|‡)([a-z0-9])/g)];
  const links=[];let text=matches.length?value.slice(0,matches[0].index):value;
  for(let i=0;i<matches.length;i++){
   const chunk=value.slice(matches[i].index,matches[i+1]?.index ?? value.length);
   if(matches[i][2]==='6')links.push(chunk.trim());else text+=chunk;
  }
  return {text:text.trim(),links};
 };
 const original=parts(before).text;
 if (!editable(source) || !editable(target) || parts(source.value).text!==original || location.href!==url) throw new Error('The source changed while Alma added the row. No text was replaced; capture it again.');
 if (target.value.trim() && (!created || (parts(target.value).text && parts(target.value).text!==original))) throw new Error('The lower row already contains text. It was not overwritten.');
 const upperBefore=source.value,lowerBefore=target.value;
 const retainLink=(text,current)=>[...parts(current).links,parts(text).text].filter(Boolean).join(' ');
 const upper=direction==='r2s'?upperBefore:retainLink(converted,upperBefore);
 const lower=retainLink(direction==='s2r'?before:converted,lowerBefore);
 const setValue=(el,value)=>{
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,value);
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
 };
 // Preserve the original script in the lower row before changing the upper row.
 setValue(target,lower);
 if (!editable(source) || !editable(target) || source.value!==upperBefore || target.value!==lower || location.href!==url) throw new Error('Alma changed the rows during insertion. Review the lower row; the upper text was not replaced by ScriptShifter.');
 if (upper!==upperBefore) setValue(source,upper);
 if (source.value!==upper || target.value!==lower) throw new Error('Alma did not retain both values. Review the record before saving.');
 source.setAttribute('data-alma-scriptshifter-paired','true');
 return {upper,lower};
}
