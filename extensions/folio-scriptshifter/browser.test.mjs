// Run with: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node browser.test.mjs
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = new URL('./', import.meta.url);
const server = createServer(async (req,res) => {
 try {
  if (req.url === '/record') {res.setHeader('Content-Type','text/html; charset=utf-8'); res.end('<aside><label>Search<input id="inventory-search" value="query"></label><label>Held by<input id="held-by" value="library"></label></aside><form data-test-instance-page-type="create"><div role="search"><label>Lookup<input value="lookup"></label></div><label>Title<input id="title" value="كتاب"></label><label>Language<select><option>Arabic</option></select></label><label>Notes<input id="notes" value=""></label><label>Password<input type="password" value="secret"></label></form><script>window.events=[];document.querySelector("#title").addEventListener("input",e=>window.events.push(e.target.value))</script>'); return;}
  const name = req.url.slice(1) || 'popup.html';
  if (!['popup.html','popup.mjs','core.mjs','form.mjs','picker.mjs','diacritics.mjs','marks.json'].includes(name)) {res.writeHead(404).end();return;}
  res.setHeader('Content-Type', name.endsWith('.mjs')?'text/javascript':'text/html');
  res.end(await readFile(new URL(name,root)));
 } catch {res.writeHead(500).end();}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
 browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context = await browser.newContext();
 const record = await context.newPage(); await record.goto(base+'/record'); await record.locator('#title').focus();
 const popup = await context.newPage(); popup.setDefaultTimeout(5000); popup.setDefaultNavigationTimeout(5000); let requests=0;
 await popup.route('https://bibframe.org/scriptshifter/**', async route => {
  if (route.request().method() === 'OPTIONS') {await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type'}});return;}
  const trans = route.request().url().endsWith('/trans');
  if (trans) {requests++;assert.equal(route.request().postDataJSON().text,'كتاب');}
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(trans?{output:'kitāb',warnings:[]}:{arabic:{label:'Arabic',marc_code:'ara',has_s2r:true,has_r2s:false}})});
 });
 await popup.exposeFunction('executeInRecord', async (source,args) => [{result:await record.evaluate(({source,args}) => (0,eval)(`(${source})`)(...args),{source,args})}]);
 await popup.addInitScript(({url}) => {window.chrome={tabs:{query:async()=>[{id:1,url}]},scripting:{executeScript:({func,args=[]})=>window.executeInRecord(func.toString(),args)}};},{url:base+'/record'});
 await popup.goto(base+'/popup.html');
 await popup.getByLabel('Title: diacritics draft',{exact:true}).waitFor();
 assert.equal(await popup.locator('article').count(),1);
 await popup.getByText('Load fields and languages',{exact:true}).click();
 await popup.waitForFunction(()=>document.querySelectorAll('article').length===1);
 assert.equal(await popup.getByLabel('Title: language',{exact:true}).inputValue(),'arabic');
 assert.equal(await popup.getByLabel('Title: direction',{exact:true}).inputValue(),'s2r');
 await popup.getByText('Preview this field',{exact:true}).click();
 await popup.waitForFunction(()=>!document.querySelectorAll('article button')[1].disabled);
 assert.equal(await popup.getByLabel('Title: preview',{exact:true}).inputValue(),'kitāb');
 await popup.getByText('Apply to field',{exact:true}).click();
 await record.waitForFunction(()=>document.querySelector('#title').value==='kitāb');
 assert.deepEqual(await record.evaluate(()=>window.events),['kitāb']);
 await popup.getByText('Undo',{exact:true}).click();
 await record.waitForFunction(()=>document.querySelector('#title').value==='كتاب');
 await popup.getByText('Preview this field',{exact:true}).click();
 await popup.waitForFunction(()=>!document.querySelectorAll('article button')[1].disabled);
 await record.locator('#title').fill('changed after preview');
 await popup.getByText('Apply to field',{exact:true}).click();
 await popup.getByText(/Field changed since preview\. Refresh fields and preview again\./).waitFor();
 assert.equal(await record.locator('#title').inputValue(),'changed after preview');
 assert.equal(requests,2);
 await popup.unroute('https://bibframe.org/scriptshifter/**');
 await popup.route('https://bibframe.org/scriptshifter/**', async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type'}});return;}
  const trans=route.request().url().endsWith('/trans');
  const body=trans ? {output:route.request().postDataJSON().t_dir==='s2r'?'kitāb':'كتاب',warnings:[]} : {arabic:{label:'Arabic',marc_code:'ara',has_s2r:true,has_r2s:true}};
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
 });
 await record.evaluate(()=>{
  const title=document.querySelector('#title');title.name='title';title.value='كتاب';
  const group=document.createElement('fieldset');group.setAttribute('data-test-repeatable-field','');
  group.innerHTML='<legend>Alternative titles</legend><ul></ul><button type="button" data-test-repeatable-field-add-item-button>Add alternative title</button>';
  group.querySelector('button').onclick=()=>{
   const n=group.querySelectorAll('li').length;const row=document.createElement('li');row.setAttribute('data-test-repeatable-field-list-item','');
   row.innerHTML=`<select name="alternativeTitles[${n}].alternativeTitleTypeId"><option value="">Choose type</option></select><textarea name="alternativeTitles[${n}].alternativeTitle"></textarea>`;
   group.querySelector('ul').append(row);
  };
  document.querySelector('form').append(group);
 });
 await popup.getByText('Load fields and languages',{exact:true}).click();
 await popup.getByText('Convert and add parallel field',{exact:true}).click();
 await record.waitForFunction(()=>document.querySelector('[name="alternativeTitles[0].alternativeTitle"]')?.value==='kitāb');
 assert.equal(await record.locator('#title').inputValue(),'كتاب');
 await popup.getByText(/Choose an Alternative title type in FOLIO before saving/).waitFor();
 await popup.getByText('Convert and add parallel field',{exact:true}).click();
 await popup.getByText(/That parallel value is already present/).waitFor();
 assert.equal(await record.locator('[name$=".alternativeTitle"]').count(),1);
 await record.locator('#title').fill('kitāb');
 await popup.getByText('Load fields and languages',{exact:true}).click();
 await popup.locator('article').first().getByText('Convert and add parallel field',{exact:true}).click();
 await record.waitForFunction(()=>document.querySelector('[name="alternativeTitles[1].alternativeTitle"]')?.value==='كتاب');
 assert.equal(await record.locator('#title').inputValue(),'kitāb');
 console.log('PASS: popup converts and adds native parallel title in both directions without replacing the original (mock API).');
 // Restore fixture to one title/notes form for focused-field checks below.
 await record.locator('fieldset').evaluate(el=>el.remove());
 await popup.unroute('https://bibframe.org/scriptshifter/**');
 let offlineRequests = 0;
 await popup.route('https://bibframe.org/**', route => {offlineRequests++; return route.abort();});
 await record.locator('#title').fill('كتاب');
 await record.locator('#title').evaluate(el=>el.setSelectionRange(1,1));
 await popup.getByText('Use current field',{exact:true}).click();
 await popup.waitForFunction(()=>document.querySelectorAll('article').length===1);
 const draft = popup.getByLabel('Title: diacritics draft',{exact:true});
 await popup.getByLabel('Title: search marks',{exact:true}).fill('ARABIC FATHA');
 await popup.getByLabel('Title: Unicode mark',{exact:true}).selectOption('َ');
 await popup.locator('article').first().getByText('Insert selected mark into FOLIO field',{exact:true}).click();
 assert.equal(await draft.inputValue(),'كَتاب');
 await record.waitForFunction(()=>document.querySelector('#title').value==='كَتاب');
 await popup.locator('article').first().getByText('Undo diacritics',{exact:true}).click();
 await record.waitForFunction(()=>document.querySelector('#title').value==='كتاب');
 assert.equal(await popup.getByRole('button', {name:'Insert code point into FOLIO field',exact:true}).count(),0);
 await record.locator('#notes').focus();
 await popup.getByText('Use current field',{exact:true}).click();
 await popup.getByLabel('Notes: diacritics draft',{exact:true}).fill('é');
 await popup.locator('article').first().getByText('Apply edited draft to field',{exact:true}).click();
 assert.equal(await popup.getByLabel('Notes: diacritics draft',{exact:true}).inputValue(),'é');
 await record.waitForFunction(()=>document.querySelector('#notes').value==='é');
 assert.equal(offlineRequests,0);
 assert.equal(await record.locator('#inventory-search').inputValue(),'query');
 assert.equal(await record.locator('#held-by').inputValue(),'library');
 await record.locator('#inventory-search').focus();
 await popup.getByText('Use current field',{exact:true}).click();
 await popup.getByText(/Click inside the FOLIO text field you want to edit/).waitFor();
 assert.equal(await popup.locator('article').count(),0);
 // With no open record editor, never fall back to sidebar filters.
 await record.locator('form').evaluate(el=>el.remove());
 await popup.getByText('Use current field',{exact:true}).click();
 await popup.getByText(/Open one FOLIO New instance or Edit instance form/).waitFor();
 assert.equal(await popup.locator('article').count(),0);
 console.log('PASS: Search, Held by, nested lookup controls excluded; missing record form rejected.');
 console.log('PASS: offline Arabic mark insertion at caret, apply/undo, empty field draft editing, and no API requests.');
 console.log('PASS: browser field discovery, metadata detection, preview, input events, apply, undo, stale-field protection, password exclusion (mock API and extension bridge).');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
