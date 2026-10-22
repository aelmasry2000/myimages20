import test from 'node:test';
import assert from 'node:assert/strict';
import {activePage} from './tab.mjs';
test('valid tab without URL metadata is accepted',async()=>{
 const tab=await activePage(async options=>{assert.deepEqual(options,{active:true,lastFocusedWindow:true});return [{id:12}];});
 assert.equal(tab.id,12);
});
test('missing and browser-internal tabs receive actionable errors',async()=>{
 await assert.rejects(activePage(async()=>[]),/Select the browser tab/);
 await assert.rejects(activePage(async()=>[{id:1,url:'chrome://extensions'}]),/FOLIO web page/);
 assert.equal((await activePage(async()=>[{id:1,url:'https://example.org/inventory'}])).id,1);
});
test('toolbar opens panel within the click handler and disables automatic behavior',async()=>{
 let install,click;const calls=[];
 globalThis.chrome={runtime:{onInstalled:{addListener:fn=>{install=fn;}}},action:{onClicked:{addListener:fn=>{click=fn;}}},sidePanel:{setPanelBehavior:options=>{calls.push(['behavior',options]);return Promise.resolve();},open:options=>{calls.push(['open',options]);return Promise.resolve();}}};
 try {
  await import('./background.mjs');install();click({id:12});
  assert.deepEqual(calls,[['behavior',{openPanelOnActionClick:false}],['open',{tabId:12}]]);
 } finally {delete globalThis.chrome;}
});
