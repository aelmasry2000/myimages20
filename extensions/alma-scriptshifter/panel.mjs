import {inspectActiveField,writeField} from './adapter.mjs';
import {apiRequest,loadLanguages,detectDirection,suggestLanguage,transliterationRequest,normalizeRomanization,assertSupported} from './core.mjs';
import {renderDiacritics} from './picker.mjs';
import {convertMarc,marcParts,nameTag} from './marc.mjs';
const el=id=>document.getElementById(id);
let source=null,tables={},busy=false;
function invalidate(){el('output').value='';el('insert').disabled=true;}
function setBusy(value){busy=value;for(const id of ['capture','convert','languages','enable'])el(id).disabled=value;for(const id of ['mode','kind','language','direction'])el(id).disabled=value;el('insert').disabled=value || !el('output').value;}
async function currentTab(){
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!tab?.id || !tab.url?.startsWith('https://'))throw new Error('Open your Alma site in an HTTPS tab.');
 return tab;
}
async function execute(field,func,args){
 const results=await chrome.scripting.executeScript({target:{tabId:field.tabId,frameIds:[field.frameId]},func,args});
 if(!results[0] || results[0].error)throw new Error(results[0]?.error?.message || 'The editor frame is unavailable.');
 return results[0].result;
}
async function currentField(){
 const tab=await currentTab();
 const permission=new URL(tab.url).origin+'/*';
 if(!await chrome.permissions.contains({origins:[permission]}))throw new Error('Enable the extension on this Alma site first.');
 await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},files:['focus.js']});
 const results=await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},func:inspectActiveField});
 const candidates=results.filter(result=>result.result).map(result=>({...result.result,frameId:result.frameId,tabId:tab.id})).sort((a,b)=>b.focusedAt-a.focusedAt);
 if(!candidates.length)throw new Error('Click an editable text input or textarea in Alma, then capture it. Search, dropdown and rich-text controls are not supported.');
 if(candidates.length>1 && candidates[0].focusedAt===candidates[1].focusedAt)throw new Error('More than one editor frame has a selected field. Click the intended field again, then capture it.');
 return candidates[0];
}
el('enable').addEventListener('click',async()=>{
 try{
  const tab=await currentTab(),pattern=new URL(tab.url).origin+'/*';
  if(!await chrome.permissions.request({origins:[pattern]}))throw new Error('Site access was not granted.');
  const id='alma-focus-'+new URL(tab.url).hostname.replace(/[^a-z0-9-]/gi,'-');
  if(!(await chrome.scripting.getRegisteredContentScripts({ids:[id]})).length)await chrome.scripting.registerContentScripts([{id,matches:[pattern],js:['focus.js'],allFrames:true,runAt:'document_idle',persistAcrossSessions:true}]);
  await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},files:['focus.js']});
  el('status').textContent='Enabled for this site. Click a field in Alma, then Capture current field.';
 }catch(error){el('status').textContent=error.message;}
});
el('capture').addEventListener('click',async()=>{
 if(busy)return;setBusy(true);source=null;invalidate();el('conversion').hidden=true;el('diacritics').replaceChildren();
 try{
  const field=await currentField();
  const catalog=await fetch(new URL('./marks.json',import.meta.url)).then(response=>response.json());
  source={...field};invalidate();el('conversion').hidden=false;el('source').value=field.text;
  el('fieldName').textContent=field.tag?`${field.label} (MARC ${field.tag})`:field.label;
  const text=el('mode').value==='marc'?marcParts(field.text).filter(part=>!part.literal && !/^[0-9]$/.test(part.code)).map(part=>part.text).join(' '):field.text;
  const direction=detectDirection(text);el('direction').value=direction || 's2r';
  el('kind').value=nameTag(field.tag)?'name':'text';
  if(Object.keys(tables).length)el('language').value=suggestLanguage(text,tables).id;
  el('diacritics').replaceChildren(...(field.tag && Number(field.tag)<10 ? [] : [renderDiacritics(field,catalog.marks,async(before,after)=>{
    await execute(field,writeField,[field.key,before,after,field.url]);
    if(source?.key===field.key){source.text=after;el('source').value=after;invalidate();}
  })]));
  el('status').textContent=`Captured ${field.label}. ${direction?'Confirm the language and direction.':'Mixed or ambiguous text: select the direction.'}`;
 }catch(error){el('status').textContent=error.message;}
 finally{setBusy(false);}
});
el('languages').addEventListener('click',async()=>{
 setBusy(true);el('status').textContent='Loading ScriptShifter languages…';
 try{
  tables=await loadLanguages();
  el('language').replaceChildren(new Option('Choose language…',''),...Object.entries(tables).filter(([,table])=>!table.alias_of).sort((a,b)=>a[1].label.localeCompare(b[1].label)).map(([id,table])=>new Option(table.label,id)));
  if(source)el('language').value=suggestLanguage(source.text,tables).id;
  el('status').textContent='Confirm the language before converting.';
 }catch(error){el('status').textContent=error.message;}
 finally{setBusy(false);}
});
for(const id of ['mode','kind','language','direction'])el(id).addEventListener('change',invalidate);
el('convert').addEventListener('click',async()=>{
 if(!source)return;setBusy(true);invalidate();el('status').textContent='Waiting for ScriptShifter…';
 try{
  const lang=el('language').value,direction=el('direction').value,kind=el('kind').value;
  assertSupported(tables,lang,direction);
  const warnings=[];
  const request=async(text,cap)=>{
   const data=await apiRequest('trans',{lang,text,t_dir:direction,capitalize:cap,options:{}});
   warnings.push(...(data.warnings || []));
   if(direction!=='s2r')return data.output;
   if(cap===false)return data.output.toLowerCase();
   return normalizeRomanization(data.output,direction,cap==='all'?'contributors[0].name':(!source.tag || /^(130|240|242|243|245|246|247|730|740)$/.test(source.tag))?'title':'text',lang);
  };
  let output;
  if(el('mode').value==='marc')output=await convertMarc(source.text,source.tag,direction,request,kind);
  else{
   const fieldName=kind==='name'?'contributors[0].name':'title';
   output=await request(source.text,transliterationRequest(lang,source.text,direction,fieldName).capitalize);
  }
  el('output').value=output;
  el('status').textContent=['Converted; the source field is unchanged. Create a native parallel field/property in Alma, click its empty text control, then insert here.',...warnings].join('\n');
 }catch(error){el('status').textContent=error.message;}
 finally{setBusy(false);}
});
el('insert').addEventListener('click',async()=>{
 if(busy || !source || !el('output').value)return;setBusy(true);
 try{
  const target=await currentField();
  if(target.tabId!==source.tabId)throw new Error('Return to the same Alma tab as the captured field.');
  if(target.text.trim())throw new Error('The destination must be empty. Create/select a new parallel value in Alma first; no existing text was replaced.');
  if(target.key===source.key || (target.frameId===source.frameId && target.url===source.url && target.text===source.text && source.text.trim()))throw new Error('Select a different empty destination.');
  await execute(target,writeField,[target.key,target.text,el('output').value,target.url]);
  el('status').textContent='Inserted into the empty field. Check the record and any language/script/linkage metadata in Alma before saving.';
  invalidate();
 }catch(error){el('status').textContent=error.message;}
 finally{setBusy(false);}
});
