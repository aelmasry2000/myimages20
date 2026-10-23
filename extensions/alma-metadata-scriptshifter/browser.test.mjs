import {EDITOR_MODE} from './mode.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=new URL('./',import.meta.url);
const files=new Set(['paired.mjs','tab.mjs','panel.html','panel.mjs','mode.mjs','corrections.mjs','adapter.mjs','core.mjs','marc.mjs','picker.mjs','diacritics.mjs','marks.json']);
const server=createServer(async(req,res)=>{
 try{
  const name=req.url.slice(1);
  if(name==='record'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<label>Title<div id="MarcEditorPresenter.textArea.245"><textarea id="marc">$$a الكتاب $$b والمكتبة</textarea></div></label><label>Alternate<textarea id="target"></textarea></label><label>Name<input id="name" value="أحمد علي"></label><label>Search<input id="search" value="query"></label><script>window.changes=[];document.addEventListener("input",e=>window.changes.push(e.target.id))</script>');return;}
  if(!files.has(name)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',name.endsWith('.mjs')?'text/javascript; charset=utf-8':name.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8');res.end(await readFile(new URL(name,root)));
 }catch{res.writeHead(500).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext(),record=await context.newPage(),panel=await context.newPage();panel.setDefaultTimeout(5000);record.setDefaultTimeout(5000);
 await record.goto(base+'/record');
 if(EDITOR_MODE==='bibframe')await record.locator('#marc').fill('الكتاب');
 await panel.exposeFunction('runInRecord',async(source,args)=>[{frameId:0,result:await record.evaluate(({source,args})=>(0,eval)(`(${source})`)(...args),{source,args})}]);
 await panel.addInitScript(({url})=>{
  window.correctionStore={};window.chrome={storage:{local:{get:async key=>key.startsWith('scriptshifterCorrectionV1:')?{[key]:window.correctionStore[key]}:{},set:async entries=>{for(const [key,value] of Object.entries(entries))if(key.startsWith('scriptshifterCorrectionV1:'))window.correctionStore[key]=value;},remove:async key=>{delete window.correctionStore[key];}}},tabs:{query:async()=>[{id:1}]},permissions:{contains:async()=>true},scripting:{executeScript:({func,args=[],files})=>func?.toString()==='()=>location.href'?Promise.resolve([{frameId:0,result:'https://example.alma.exlibrisgroup.com/editor'}]):files?Promise.resolve([]):window.runInRecord(func.toString(),args)}};
 },{url:base+'/record'});
 const calls=[];
 await panel.route('https://bibframe.org/scriptshifter/**',async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type'}});return;}
  const trans=route.request().url().endsWith('/trans'),payload=trans?route.request().postDataJSON():null;
  if(trans)calls.push(payload);
  const output=payload?.t_dir==='r2s'?(payload.text==='al-Kitāb'?'الكتاب':'والمكتبة'):payload?.text==='الكتاب'?'al-Kitāb':payload?.text==='والمكتبة'?'wa-al-Maktabah':'aḤMAD ʿaLĪ';
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(trans?{output,warnings:[]}:{arabic:{label:'Arabic',marc_code:'ara',has_s2r:true,has_r2s:true}})});
 });
 await panel.goto(base+'/panel.html');
 assert.equal(await panel.locator('#mode').count(),0);
 await record.locator('#marc').focus();await panel.getByText('Capture current field',{exact:true}).click();
 await panel.getByText('Load languages',{exact:true}).click();await panel.getByLabel('Language',{exact:true}).selectOption('arabic');
 await panel.getByText('Convert',{exact:true}).click();
 const expected=EDITOR_MODE==='marc'?'$$a al-Kitāb $$b wa-al-maktabah':'al-Kitāb';
 const original=EDITOR_MODE==='marc'?'$$a الكتاب $$b والمكتبة':'الكتاب';
 await panel.waitForFunction(value=>document.getElementById('output').value===value,expected);
 assert.deepEqual(calls.map(call=>call.capitalize),EDITOR_MODE==='marc'?['first',false]:['first']);
 assert.equal(await record.locator('#marc').inputValue(),original);
 // Attempting to insert into the original nonempty field must fail.
 await panel.getByText('Insert conversion into current field',{exact:true}).click();
 await panel.getByText(/destination must be empty/).waitFor();
 await record.locator('#target').focus();await panel.getByText('Insert conversion into current field',{exact:true}).click();
 await record.waitForFunction(value=>document.getElementById('target').value===value,expected);
 assert.equal(await record.locator('#marc').inputValue(),original);
 // BIBFRAME literal mode uses one request and the explicitly selected Name kind.
 await record.locator('#name').focus();await record.locator('#name').evaluate(el=>el.setSelectionRange(el.value.length,el.value.length));
 await panel.getByText('Capture current field',{exact:true}).click();await panel.locator('#kind').selectOption('name');await panel.getByLabel('Language',{exact:true}).selectOption('arabic');
 await panel.getByText('Convert',{exact:true}).click();await panel.waitForFunction(()=>document.getElementById('output').value==='Aḥmad ʿAlī');assert.equal(calls.at(-1).capitalize,'all');
 const conversions=calls.length;
 await panel.locator('#reverse').check();await panel.getByText('Remember reviewed correction',{exact:true}).click();
 await panel.getByText(/Correction saved locally/).waitFor();
 await record.locator('#name').fill('Aḥmad ʿAlī');await panel.getByText('Capture current field',{exact:true}).click();
 await panel.getByLabel('Language',{exact:true}).selectOption('arabic');await panel.getByText('Convert',{exact:true}).click();
 await panel.waitForFunction(()=>document.getElementById('output').value==='أحمد علي');
 assert.equal(calls.length,conversions);
 await record.locator('#name').fill('Ali');await record.locator('#name').evaluate(el=>el.setSelectionRange(0,0));
 await panel.getByText('Capture current field',{exact:true}).click();
 // The offline picker writes the captured field and can undo it, without conversion.
 const before=calls.length;
 await panel.getByLabel('Name: search marks',{exact:true}).fill('Arabic Ayn');
 await panel.getByLabel('Name: romanization character',{exact:true}).selectOption('ʻ');
 await panel.getByText('Insert character into Alma field',{exact:true}).click();
 await record.waitForFunction(()=>document.getElementById('name').value==='ʻAli');
 await panel.getByText('Undo diacritics',{exact:true}).click();await record.waitForFunction(()=>document.getElementById('name').value==='Ali');assert.equal(calls.length,before);
 // Stale source field protection and search exclusion.
 await record.locator('#name').fill('changed');
 await panel.getByText('Insert character into Alma field',{exact:true}).click();await panel.getByText(/field changed/).waitFor();
 await record.locator('#search').focus();await panel.getByText('Capture current field',{exact:true}).click();await panel.getByText(/Click an editable text input/).waitFor();
 // Native F8 fixture: paired rows remain under one 245 field.
 for(const direction of ['s2r','r2s']){
  await record.goto(base+'/record');
  const input=direction==='s2r'?'$$a الكتاب':'$$a al-Kitāb';
  await record.locator('#marc').fill(input);
  await record.evaluate(()=>document.addEventListener('keydown',event=>{
   if(!event.ctrlKey && event.key==='F8' && event.code==='F8' && event.keyCode===119 && event.target.id==='marc'){
    event.preventDefault();window.pairShortcutCount=(window.pairShortcutCount || 0)+1;
    const lower=document.createElement('textarea');lower.id='paired-original';
    event.target.parentElement.append(lower);
   }
  }));
  await record.locator('#marc').focus();await panel.getByText('Capture current field',{exact:true}).click();
  await panel.getByLabel('Language',{exact:true}).selectOption('arabic');
  await panel.locator('#direction').selectOption(direction);
  await panel.getByText('Convert',{exact:true}).click();
  await panel.locator('#pair').click();
  await panel.getByText(/Updated the paired 245 rows/).waitFor();
  assert.equal((await record.locator('#marc').inputValue()).normalize('NFC'),'$$a al-Kitāb');
  assert.equal(await record.locator('#paired-original').inputValue(),'$$a الكتاب');
  assert.equal(await record.evaluate(()=>window.pairShortcutCount),1);
  assert.equal(await panel.locator('#pair').isDisabled(),true);
 }
 // Existing lower row can be selected explicitly after F8 produced a blank.
 for(const direction of ['s2r','r2s']){
  await record.goto(base+'/record');
  await record.locator('#marc').fill(direction==='s2r'?'$$a الكتاب':'$$a al-Kitāb');
  await record.locator('#marc').focus();await panel.getByText('Capture current field',{exact:true}).click();
  await panel.getByLabel('Language',{exact:true}).selectOption('arabic');await panel.locator('#direction').selectOption(direction);
  await panel.getByText('Convert',{exact:true}).click();
  await record.locator('#target').fill('$$a');await record.locator('#target').focus();
  await panel.getByText('Fill selected lower row',{exact:true}).click();
  await panel.getByText(/Filled the selected lower row/).waitFor();
  assert.equal((await record.locator('#marc').inputValue()).normalize('NFC'),'$$a al-Kitāb');
  assert.equal(await record.locator('#target').inputValue(),'$$a الكتاب');
 }
 console.log('PASS: select and fill an existing blank lower row in both directions, without creating another.');
 console.log('PASS: paired 245 UI workflow in both directions uses F8 and preserves original script below romanization (mock native action).');
 console.log(`PASS: ${EDITOR_MODE} fixed editor, capitalization, source preservation, empty-target insertion, names, offline diacritics/undo, stale-field protection and search rejection (mock API and Chrome bridge).`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
