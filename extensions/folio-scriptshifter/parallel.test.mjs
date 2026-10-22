import assert from 'node:assert/strict';
import {inspectForm, addParallelField} from './form.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const page = await browser.newPage();
 await page.route('https://folio-fixture.invalid/**', route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'}));
 await page.goto('https://folio-fixture.invalid/inventory?layer=create');
 await page.setContent('<form data-test-instance-page-type="create"><section id="instanceSection02"><label>Resource title<textarea name="title" id="input_instance_title">كتاب</textarea></label><fieldset data-test-repeatable-field id="alternative"><legend>Alternative titles</legend><ul></ul><button type="button" data-test-repeatable-field-add-item-button>Add alternative title</button></fieldset></section><fieldset data-test-repeatable-field id="contributors"><legend>Contributors</legend><ul></ul><button type="button" data-test-repeatable-field-add-item-button>Add contributor</button></fieldset><fieldset data-test-repeatable-field id="notes"><legend>Notes</legend><ul></ul><button type="button" data-test-repeatable-field-add-item-button>Add note</button></fieldset><label>Index title<input name="indexTitle" value="unchanged"></label></form>');
 await page.evaluate(()=>{
  window.changes=[];
  document.querySelector('form').addEventListener('input',event=>window.changes.push([event.target.name,event.target.value]));
  for (const id of ['alternative','contributors','notes']) {
   const group=document.getElementById(id);
   group.querySelector('button').onclick=()=>{
    const n=group.querySelectorAll('li').length;
    const row=document.createElement('li');row.setAttribute('data-test-repeatable-field-list-item','');
    row.innerHTML=id==='alternative' ? `<select name="alternativeTitles[${n}].alternativeTitleTypeId" required><option value="">Choose type</option><option value="variant">Variant title</option></select><textarea name="alternativeTitles[${n}].alternativeTitle"></textarea>` : id==='contributors' ? `<textarea name="contributors[${n}].name"></textarea><select name="contributors[${n}].contributorNameTypeId"><option value="">Choose type</option><option value="person">Personal</option></select><input type="checkbox" name="contributors[${n}].primary">` : `<textarea name="notes[${n}].note"></textarea><select name="notes[${n}].instanceNoteTypeId"><option value="">Choose type</option><option value="general">General</option></select><input type="checkbox" name="notes[${n}].staffOnly">`;
    group.querySelector('ul').append(row);
   };
   if(id!=='alternative')group.querySelector('button').click();
  }
  document.querySelector('[name="contributors[0].name"]').value='كاتب';
  document.querySelector('[name="contributors[0].contributorNameTypeId"]').value='person';
  document.querySelector('[name="contributors[0].primary"]').checked=true;
  document.querySelector('[name="notes[0].note"]').value='ملاحظة';
  document.querySelector('[name="notes[0].instanceNoteTypeId"]').value='general';
  document.querySelector('[name="notes[0].staffOnly"]').checked=true;
 });
 const call=async(fn,args=[])=>page.evaluate(({source,args})=>(0,eval)(`(${source})`)(...args),{source:fn.toString(),args});
 const form=await call(inspectForm);const url=form.url;
 const entry=name=>form.entries.find(e=>e.name===name);
 const title=entry('title');
 const result=await call(addParallelField,[title.key,title.text,'kitāb',url]);
 assert.equal(result.needsType,true);assert.equal(await page.locator('[name="title"]').inputValue(),'كتاب');
 assert.equal(await page.locator('[name="alternativeTitles[0].alternativeTitle"]').inputValue(),'kitāb');
 const duplicate=await call(addParallelField,[title.key,title.text,'kitāb',url]);assert.equal(duplicate.duplicate,true);
 assert.equal(await page.locator('#alternative li').count(),1);
 const contributor=entry('contributors[0].name');
 await call(addParallelField,[contributor.key,contributor.text,'kātib',url]);
 assert.equal(await page.locator('[name="contributors[1].name"]').inputValue(),'kātib');
 assert.equal(await page.locator('[name="contributors[1].contributorNameTypeId"]').inputValue(),'person');
 assert.equal(await page.locator('[name="contributors[1].primary"]').isChecked(),false);
 assert.equal(await page.locator('[name="contributors[0].primary"]').isChecked(),true);
 const note=entry('notes[0].note');await call(addParallelField,[note.key,note.text,'mulāḥaẓah',url]);
 assert.equal(await page.locator('[name="notes[1].note"]').inputValue(),'mulāḥaẓah');
 assert.equal(await page.locator('[name="notes[1].instanceNoteTypeId"]').inputValue(),'general');
 assert.equal(await page.locator('[name="notes[1].staffOnly"]').isChecked(),true);
 const single=entry('indexTitle');await assert.rejects(call(addParallelField,[single.key,single.text,'other',url]),/no supported parallel/);
 await page.locator('#contributors button').evaluate(el=>el.disabled=true);
 await assert.rejects(call(addParallelField,[contributor.key,contributor.text,'another',url]),/does not allow/);
 await page.locator('[name="title"]').fill('changed');
 await assert.rejects(call(addParallelField,[title.key,title.text,'new',url]),/original field changed/);
 assert.equal(await page.locator('#alternative li').count(),1);
 const events=await page.evaluate(()=>window.changes);
 assert.ok(events.some(([name,value])=>name==='alternativeTitles[0].alternativeTitle'&&value==='kitāb'));
 console.log('PASS: native alternative title insertion, original preservation, duplicate protection, contributor type copying without primary duplication, staff-only note privacy, locked/unsupported/stale field rejection, and form input events.');
} finally {await browser.close();}
