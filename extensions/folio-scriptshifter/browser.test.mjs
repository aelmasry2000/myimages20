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
  if (!['popup.html','popup.mjs','tab.mjs','corrections.mjs','core.mjs','form.mjs','picker.mjs','diacritics.mjs','marks.json'].includes(name)) {res.writeHead(404).end();return;}
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
  if (trans) {requests++;assert.equal(route.request().postDataJSON().text,'كتاب');assert.equal(route.request().postDataJSON().capitalize,'first');}
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(trans?{output:'Kitāb',warnings:[]}:{arabic:{label:'Arabic',marc_code:'ara',has_s2r:true,has_r2s:false}})});
 });
 await popup.exposeFunction('executeInRecord', async (source,args) => [{result:await record.evaluate(({source,args}) => (0,eval)(`(${source})`)(...args),{source,args})}]);
 await popup.addInitScript(({url}) => {window.correctionStore={};window.chrome={storage:{local:{get:async key=>key.startsWith('scriptshifterCorrectionV1:')?{[key]:window.correctionStore[key]}:{},set:async entries=>{for(const [key,value] of Object.entries(entries))if(key.startsWith('scriptshifterCorrectionV1:'))window.correctionStore[key]=value;},remove:async key=>{delete window.correctionStore[key];}}},tabs:{query:async()=>[{id:1}]},scripting:{executeScript:({func,args=[]})=>window.executeInRecord(func.toString(),args)}};},{url:base+'/record'});
 async function reviewedParallel(){
  const before=await record.locator('#title').inputValue();
  await popup.getByText('Convert for review',{exact:true}).click();
  await popup.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Add reviewed parallel field'&&!button.disabled));
  assert.equal(await record.locator('#title').inputValue(),before);
  await popup.getByText('Add reviewed parallel field',{exact:true}).click();
 }
 await popup.goto(base+'/popup.html');
 await popup.getByLabel('Title: diacritics draft',{exact:true}).waitFor();
 assert.equal(await popup.locator('article').count(),1);
 assert.equal(await popup.getByLabel('Title: character language',{exact:true}).inputValue(),'Arabic');
 assert.ok(await popup.getByLabel('Title: romanization character',{exact:true}).locator('option').count()<250);
 await popup.getByLabel('Title: character language',{exact:true}).selectOption('');
 assert.ok(await popup.getByLabel('Title: romanization character',{exact:true}).locator('option').count()<=200);
 await popup.getByLabel('Title: search marks',{exact:true}).fill('HEBREW');
 assert.ok(await popup.getByLabel('Title: romanization character',{exact:true}).locator('option').count()>0);
 await record.locator('#title').evaluate(el=>el.blur());
 await popup.getByText('Transliterate current field',{exact:true}).click();
 await popup.waitForFunction(()=>document.querySelectorAll('article').length===1);
 assert.equal(await popup.getByLabel('Title: language',{exact:true}).inputValue(),'arabic');
 assert.equal(await popup.getByLabel('Title: direction',{exact:true}).inputValue(),'s2r');
 await popup.getByText('Preview this field',{exact:true}).click();
 await popup.waitForFunction(()=>!document.querySelectorAll('article button')[1].disabled);
 assert.equal(await popup.getByLabel('Title: preview',{exact:true}).inputValue(),'Kitāb');
 await popup.getByText('Apply to field',{exact:true}).click();
 await record.waitForFunction(()=>document.querySelector('#title').value==='Kitāb');
 assert.deepEqual(await record.evaluate(()=>window.events),['Kitāb']);
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
  const payload=trans?route.request().postDataJSON():null;
  if(payload?.t_dir==='r2s')assert.equal(payload.capitalize,false);
  if(payload?.text==='كتاب جديد')assert.equal(payload.capitalize,'first');
  if(['أحمد علي','جامعة القاهرة','دار الكتب'].includes(payload?.text))assert.equal(payload.capitalize,'all');
  const names={'أحمد علي':'Aḥmad ʿAlī','جامعة القاهرة':'Jāmiʿat Al-qāhirah','دار الكتب':'Dār Al-kutub'};
  const body=trans ? {output:payload.t_dir==='s2r'?(names[payload.text] || (payload.text==='كتاب جديد'?'kiTāb JaDĪD':'Kitāb')):'كتاب',warnings:[]} : {arabic:{label:'Arabic',marc_code:'ara',has_s2r:true,has_r2s:true}};
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
 await popup.getByText('Transliterate current field',{exact:true}).click();
 await reviewedParallel();
 await record.waitForFunction(()=>document.querySelector('[name="alternativeTitles[0].alternativeTitle"]')?.value==='Kitāb');
 assert.equal(await record.locator('#title').inputValue(),'كتاب');
 await popup.getByText(/Choose an Alternative title type in FOLIO before saving/).waitFor();
 await reviewedParallel();
 await popup.getByText(/That parallel value is already present/).waitFor();
 assert.equal(await record.locator('[name$=".alternativeTitle"]').count(),1);
 await record.locator('#title').fill('kitāb');
 await popup.getByText('Transliterate current field',{exact:true}).click();
 assert.equal(await popup.getByLabel('Title: romanization capitalization',{exact:true}).count(),0);
 await reviewedParallel();
 await record.waitForFunction(()=>document.querySelector('[name="alternativeTitles[1].alternativeTitle"]')?.value==='كتاب');
 assert.equal(await record.locator('#title').inputValue(),'kitāb');
 await record.locator('#title').fill('كتاب جديد');
 await popup.getByText('Transliterate current field',{exact:true}).click();
 await reviewedParallel();
 await record.waitForFunction(()=>document.querySelector('[name="alternativeTitles[2].alternativeTitle"]')?.value==='Kitāb jadīd');
 assert.equal(await record.locator('#title').inputValue(),'كتاب جديد');
 console.log('PASS: first-word-only capitalization reaches API and its complete response is inserted.');
 console.log('PASS: popup converts and adds native parallel title in both directions without replacing the original (mock API).');
 await popup.unroute('https://bibframe.org/scriptshifter/**');
 await popup.route('https://bibframe.org/scriptshifter/**',async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type'}});return;}
  const trans=route.request().url().endsWith('/trans');
  const payload=trans?route.request().postDataJSON():null;
  const names={'أحمد علي':'aḤMAD ʿaLĪ','جامعة القاهرة':'jĀmiʿat AL-QĀHIRAH','دار الكتب':'dĀR al-KUTUB'};
  if(payload && names[payload.text])assert.equal(payload.capitalize,'all');
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(trans?{output:names[payload.text] || 'al-Kitāb wa-al-Maktabah',warnings:[]}:{arabic:{label:'Arabic',marc_code:'ara',has_s2r:true,has_r2s:true}})});
 });
 await record.locator('#title').fill('الكتاب والمكتبة');
 await popup.getByText('Transliterate current field',{exact:true}).click();
 await reviewedParallel();
 await record.waitForFunction(()=>document.querySelector('[name="alternativeTitles[3].alternativeTitle"]')?.value==='al-Kitāb wa-al-maktabah');
 assert.equal(await popup.getByLabel('Title: preview',{exact:true}).inputValue(),'al-Kitāb wa-al-maktabah');
 console.log('PASS: interior capitals from the API are corrected in both preview and saved-form parallel title.');
 // Exercise both personal/corporate name types and publication name roles.
 await record.evaluate(()=>{
  for(const root of ['contributors','publication']) {
   const group=document.createElement('fieldset');group.id='test-'+root;group.setAttribute('data-test-repeatable-field','');
   group.innerHTML='<ul></ul><button type="button" data-test-repeatable-field-add-item-button>Add</button>';
   group.querySelector('button').onclick=()=>{
    const n=group.querySelectorAll('li').length;const row=document.createElement('li');row.setAttribute('data-test-repeatable-field-list-item','');
    row.innerHTML=root==='contributors'?`<textarea aria-label="Name" name="contributors[${n}].name"></textarea><select name="contributors[${n}].contributorNameTypeId"><option value="person">Personal</option><option value="corporate">Corporate</option></select>`:`<textarea aria-label="Publisher" name="publication[${n}].publisher"></textarea><input name="publication[${n}].role" value="Publication">`;
    group.querySelector('ul').append(row);
   };
   document.querySelector('form').append(group);group.querySelector('button').click();
  }
 });
 for(const [text,type] of [['أحمد علي','person'],['جامعة القاهرة','corporate']]) {
  await record.locator('[name="contributors[0].name"]').fill(text);
  await record.locator('[name="contributors[0].contributorNameTypeId"]').selectOption(type);
  await record.locator('[name="contributors[0].name"]').focus();
  await popup.getByText('Transliterate current field',{exact:true}).click();
  await reviewedParallel();
  const expected=type==='person'?'Aḥmad ʿAlī':'Jāmiʿat Al-qāhirah';
  await record.waitForFunction(value=>[...document.querySelectorAll('#test-contributors textarea')].some(el=>el.value===value),expected);
 }
 for(const role of ['Publication','Manufacture','Production']) {
  await record.locator('[name="publication[0].publisher"]').fill('دار الكتب');
  await record.locator('[name="publication[0].role"]').fill(role);
  await record.locator('[name="publication[0].publisher"]').focus();
  // Remove the last generated row between roles so each role creates a fresh parallel entry.
  await record.locator('#test-publication li').evaluateAll(rows=>rows.slice(1).forEach(row=>row.remove()));
  await popup.getByText('Transliterate current field',{exact:true}).click();
  await reviewedParallel();
  await record.waitForFunction(()=>document.querySelector('[name="publication[1].publisher"]')?.value==='Dār Al-kutub');
  assert.equal(await record.locator('[name="publication[1].role"]').inputValue(),role);
 }
 console.log('PASS: personal/corporate contributors and publisher/printer/producer name roles request every-word capitalization and retain row metadata.');
 await record.locator('#test-contributors').evaluate(el=>el.remove());
 await record.locator('#test-publication').evaluate(el=>el.remove());
 // Restore fixture to one title/notes form for focused-field checks below.
 await record.locator('fieldset').evaluate(el=>el.remove());
 await popup.unroute('https://bibframe.org/scriptshifter/**');
 let offlineRequests = 0;
 await popup.route('https://bibframe.org/**', route => {offlineRequests++; return route.abort();});
 await record.locator('#title').fill('Ali');
 await record.locator('#title').evaluate(el=>el.setSelectionRange(0,0));
 await popup.getByText('Use current field',{exact:true}).click();
 await popup.waitForFunction(()=>document.querySelectorAll('article').length===1);
 const draft = popup.getByLabel('Title: diacritics draft',{exact:true});
 await popup.getByLabel('Title: search marks',{exact:true}).fill('Arabic Ayn');
 const markChoices=popup.getByLabel('Title: romanization character',{exact:true});
 const labels=await markChoices.locator('option').allTextContents();
 assert.ok(labels.length>0);
 assert.ok(labels.every(text=>/^Ayn .* — ʻ/u.test(text)));
 assert.deepEqual(labels,[...labels].sort((a,b)=>a.localeCompare(b,'en')));
 assert.equal(await markChoices.locator('optgroup').first().getAttribute('label'),'Arabic');
 await markChoices.selectOption('ʻ');
 await popup.locator('article').first().getByText('Insert character into FOLIO field',{exact:true}).click();
 assert.equal(await draft.inputValue(),'ʻAli');
 await record.waitForFunction(()=>document.querySelector('#title').value==='ʻAli');
 await popup.locator('article').first().getByText('Undo diacritics',{exact:true}).click();
 await record.waitForFunction(()=>document.querySelector('#title').value==='Ali');
 assert.equal(await popup.getByRole('button', {name:'Insert code point into FOLIO field',exact:true}).count(),0);
 await record.locator('#notes').focus();
 await popup.getByText('Use current field',{exact:true}).click();
 await popup.getByLabel('Notes: diacritics draft',{exact:true}).fill('é');
 await popup.locator('article').first().getByText('Apply edited draft to field',{exact:true}).click();
 assert.equal(await popup.getByLabel('Notes: diacritics draft',{exact:true}).inputValue(),'é');
 await record.waitForFunction(()=>document.querySelector('#notes').value==='é');
 assert.equal(offlineRequests,0);
 await popup.getByText('Transliterate current field',{exact:true}).click();
 await popup.getByText(/Transliteration could not load/).waitFor();
 assert.equal(await popup.locator('article').count(),1);
 assert.equal(await popup.getByLabel('Notes: diacritics draft',{exact:true}).count(),1);
 // Manual review and reusable correction of the reported Ayman error.
 await popup.unroute('https://bibframe.org/**');
 let badNameCalls=0;
 await popup.route('https://bibframe.org/scriptshifter/**',async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type'}});return;}
  const trans=route.request().url().endsWith('/trans');if(trans)badNameCalls++;
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(trans?{output:'أيما',warnings:[]}:{arabic:{label:'Arabic',marc_code:'ara',has_s2r:true,has_r2s:true}})});
 });
 await record.locator('#notes').fill('Ayman');
 await popup.getByText('Transliterate current field',{exact:true}).click();
 await popup.getByText('Preview this field',{exact:true}).click();
 await popup.waitForFunction(()=>document.querySelector('article textarea').value==='أيما');
 await popup.getByLabel('Notes: preview',{exact:true}).fill('أيمن');
 await popup.getByLabel('Notes: remember reverse correction',{exact:true}).check();
 await popup.getByText('Remember reviewed correction',{exact:true}).click();
 await popup.getByText(/Correction saved in this browser/).waitFor();
 assert.equal(await record.locator('#notes').inputValue(),'Ayman');
 await popup.getByText('Apply to field',{exact:true}).click();
 await record.waitForFunction(()=>document.querySelector('#notes').value==='أيمن');
 await popup.getByText('Transliterate current field',{exact:true}).click();
 await popup.getByText('Preview this field',{exact:true}).click();
 await popup.getByText(/Loaded your saved correction/).waitFor();
 assert.equal(await popup.getByLabel('Notes: preview',{exact:true}).inputValue(),'Ayman');
 assert.equal(badNameCalls,1);
 console.log('PASS: incorrect machine spelling is editable before insertion; a verified correction is saved and reused in reverse without another API call.');
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
