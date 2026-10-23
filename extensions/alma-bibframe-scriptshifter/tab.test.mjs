import test from 'node:test';
import assert from 'node:assert/strict';
import {currentTab} from './tab.mjs';
test('HTTPS Alma tab uses the last focused browser window',async()=>{
 const tab=await currentTab({tabs:{query:async options=>{assert.deepEqual(options,{active:true,lastFocusedWindow:true});return [{id:0,url:'https://alma.example/editor'}];}}});
 assert.equal(tab.id,0);
});
test('missing URL is recovered using activeTab scripting access',async()=>{
 const tab=await currentTab({tabs:{query:async()=>[{id:7}]},scripting:{executeScript:async options=>{assert.deepEqual(options.target,{tabId:7});return [{result:'https://alma.example/editor'}];}}});
 assert.equal(tab.url,'https://alma.example/editor');
});
test('inaccessible, absent and non-HTTPS tabs give actionable errors',async()=>{
 await assert.rejects(currentTab({tabs:{query:async()=>[]}}),/toolbar icon/);
 await assert.rejects(currentTab({tabs:{query:async()=>[{id:7}]},scripting:{executeScript:async()=>{throw Error('denied');}}}),/Cannot access this tab/);
 for(const url of ['chrome://extensions','http://example.org'])await assert.rejects(currentTab({tabs:{query:async()=>[{id:7,url}]}}),/HTTPS page/);
});
test('toolbar opens panel within the click handler and disables automatic behavior',async()=>{
 let install,click;const calls=[];
 globalThis.chrome={runtime:{onInstalled:{addListener:fn=>{install=fn;}}},action:{onClicked:{addListener:fn=>{click=fn;}}},sidePanel:{setPanelBehavior:options=>{calls.push(['behavior',options]);return Promise.resolve();},open:options=>{calls.push(['open',options]);return Promise.resolve();}}};
 try {
  await import('./background.mjs');install();click({id:12});
  assert.deepEqual(calls,[['behavior',{openPanelOnActionClick:false}],['open',{tabId:12}]]);
 } finally {delete globalThis.chrome;}
});
