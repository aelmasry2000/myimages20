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
    if(!native || event.ctrlKey || event.key!=='F8' || event.code!=='F8' || event.keyCode!==119)return;
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
 async function apply(direction='s2r',input=before,output=converted,targetKey=''){
  return page.evaluate(async({fn,input,output,direction,targetKey})=>{
   try{return {value:await (0,eval)(`(${fn})`)('source',input,output,direction,location.href,100,targetKey)};}
   catch(error){return {error:error.message};}
  },{fn:apply245Pair.toString(),input,output,direction,targetKey});
 }
 await fixture({copy:true,linked:true});
 assert.deepEqual((await apply()).value,{upper:'$$6880-01 '+converted,lower:'$$6245-01 '+before});
 assert.match((await apply('s2r','$$6880-01 '+converted)).error,/already has a completed pair/);
 await fixture({native:false});assert.match((await apply()).error,/Fill selected lower row/);
 assert.equal(await page.locator('textarea').inputValue(),before);
 await fixture({existing:'$$a existing original'});assert.match((await apply()).error,/already contains text/);
 assert.deepEqual(await page.locator('textarea').evaluateAll(nodes=>nodes.map(el=>el.value)),[before,'$$a existing original']);
 await fixture();assert.match((await apply('s2r','stale text')).error,/field changed/);
 assert.equal(await page.locator('textarea').count(),1);
 await fixture({multiple:true});assert.match((await apply()).error,/multiple controls/);
 assert.equal(await page.locator('textarea').first().inputValue(),before);
 await fixture({native:false});
 await page.evaluate(()=>document.querySelector('textarea').value='  $$a al-Kitāb  ');
 // An existing empty native row can be filled without dispatching F8 again.
 await page.evaluate(()=>document.querySelector('textarea').parentElement.append(document.createElement('textarea')));
 assert.deepEqual((await apply('r2s','  $$a al-Kitāb  ','$$a الكتاب')).value,{upper:'  $$a al-Kitāb  ',lower:'$$a الكتاب'});
 // F8 may open a focused editor with its own native wrapper, outside the
 // original wrapper and any table row. Empty subfield markers are not content.
 await fixture({native:false});
 await page.evaluate(()=>{
  document.querySelector('textarea').onkeydown=event=>{
   if(event.key!=='F8')return;
   const wrapper=document.createElement('div');wrapper.id='MarcEditorPresenter.textArea.245.alternate';
   const lower=document.createElement('textarea');lower.value='$$a ';wrapper.append(lower);document.body.append(wrapper);lower.focus();
  };
 });
 assert.deepEqual((await apply()).value,{upper:converted,lower:before});
 // Explicitly selected existing native row: no second shortcut, even when its
 // wrapper does not reveal its relationship to the captured field.
 for(const direction of ['s2r','r2s']){
  await fixture({native:false});
  const input=direction==='s2r'?before:converted,output=direction==='s2r'?converted:before;
  await page.evaluate(({input})=>{
   document.querySelector('textarea').value=input;
   const lower=document.createElement('textarea');lower.value='$$a $$b';lower.setAttribute('data-alma-scriptshifter','lower');document.body.append(lower);
   window.shortcuts=0;document.querySelector('textarea').onkeydown=()=>{window.shortcuts++;};
  },{input});
  assert.deepEqual((await apply(direction,input,output,'lower')).value,{upper:converted,lower:before});
  assert.equal(await page.evaluate(()=>window.shortcuts),0);
 }
 await fixture({native:false});
 await page.evaluate(()=>{const lower=document.createElement('textarea');lower.value='$$a existing';lower.setAttribute('data-alma-scriptshifter','lower');document.body.append(lower);});
 assert.match((await apply('s2r',before,converted,'lower')).error,/already contains text/);
 assert.equal(await page.locator('textarea').last().inputValue(),'$$a existing');
 console.log('PASS: native linkage preservation, duplicate protection, shortcut failure, existing-content protection, stale source, ambiguous rows and unchanged romanized input.');
}finally{await browser.close();}
