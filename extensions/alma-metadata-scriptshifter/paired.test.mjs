// Browser-level regression checks for the injected native-row adapter.
import assert from 'node:assert/strict';
import {apply245Pair} from './paired.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 async function fixture({native=true,existing='',copy=false,linked=false,multiple=false}={}){
  await page.setContent('<div id="MarcEditorPresenter.textArea.245"><textarea data-alma-scriptshifter="source">$$a الكتاب $$b والمكتبة</textarea></div>');
  await page.evaluate(({native,existing,copy,linked,multiple})=>{
   const source=document.querySelector('textarea');
   if(existing){const lower=document.createElement('textarea');lower.value=existing;source.parentElement.append(lower);}
   source.onkeydown=event=>{
    if(!native || !event.ctrlKey || event.code!=='KeyL')return;
    event.preventDefault();
    if(linked)source.value='$$6880-01 '+source.value;
    for(let i=0;i<(multiple?2:1);i++){
     const lower=document.createElement('textarea');lower.value=(linked?'$$6245-01 ':'')+(copy?'$$a الكتاب $$b والمكتبة':'');
     source.parentElement.append(lower);
    }
   };
  },{native,existing,copy,linked,multiple});
 }
 const before='$$a الكتاب $$b والمكتبة',converted='$$a al-Kitāb $$b wa-al-maktabah';
 async function apply(direction='s2r',input=before,output=converted){
  return page.evaluate(async({fn,input,output,direction})=>{
   try{return {value:await (0,eval)(`(${fn})`)('source',input,output,direction,location.href,100)};}
   catch(error){return {error:error.message};}
  },{fn:apply245Pair.toString(),input,output,direction});
 }
 await fixture({copy:true,linked:true});
 assert.deepEqual((await apply()).value,{upper:'$$6880-01 '+converted,lower:'$$6245-01 '+before});
 assert.match((await apply('s2r','$$6880-01 '+converted)).error,/already has a completed pair/);
 await fixture({native:false});assert.match((await apply()).error,/Ctrl\+L manually/);
 assert.equal(await page.locator('textarea').inputValue(),before);
 await fixture({existing:'$$a existing original'});assert.match((await apply()).error,/already contains text/);
 assert.deepEqual(await page.locator('textarea').evaluateAll(nodes=>nodes.map(el=>el.value)),[before,'$$a existing original']);
 await fixture();assert.match((await apply('s2r','stale text')).error,/field changed/);
 assert.equal(await page.locator('textarea').count(),1);
 await fixture({multiple:true});assert.match((await apply()).error,/multiple controls/);
 assert.equal(await page.locator('textarea').first().inputValue(),before);
 await fixture({native:false});
 await page.evaluate(()=>document.querySelector('textarea').value='  $$a al-Kitāb  ');
 // An existing empty native row can be filled without dispatching Ctrl+L again.
 await page.evaluate(()=>document.querySelector('textarea').parentElement.append(document.createElement('textarea')));
 assert.deepEqual((await apply('r2s','  $$a al-Kitāb  ','$$a الكتاب')).value,{upper:'  $$a al-Kitāb  ',lower:'$$a الكتاب'});
 console.log('PASS: native linkage preservation, duplicate protection, shortcut failure, existing-content protection, stale source, ambiguous rows and unchanged romanized input.');
}finally{await browser.close();}
