import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupCorrection,rememberCorrection,forgetCorrection} from './corrections.mjs';
function store(){const data={};return {get:async key=>({[key]:data[key]}),set:async entries=>Object.assign(data,entries),remove:async key=>{delete data[key];}};}
test('verified name correction is reusable across fields and inverse direction is opt-in',async()=>{
 const storage=store();await rememberCorrection('arabic','r2s','Ayman','أيمن',false,storage);
 assert.equal(await lookupCorrection('arabic','r2s','Ayman',storage),'أيمن');
 assert.equal(await lookupCorrection('arabic','s2r','أيمن',storage),null);
 assert.equal(await lookupCorrection('persian','r2s','Ayman',storage),null);
 assert.equal(await lookupCorrection('arabic','r2s','Ayman Ali',storage),null);
 await rememberCorrection('arabic','r2s','Ayman','أيمن',true,storage);
 assert.equal(await lookupCorrection('arabic','s2r','أيمن',storage),'Ayman');
 await forgetCorrection('arabic','r2s','Ayman',storage);
 assert.equal(await lookupCorrection('arabic','r2s','Ayman',storage),null);
});
test('Unicode-equivalent text matches and conflicting inverse corrections are preserved',async()=>{
 const storage=store();await rememberCorrection('arabic','s2r','كتاب','kitāb',true,storage);
 assert.equal(await lookupCorrection('arabic','r2s','kitāb',storage),'كتاب');
 await assert.rejects(rememberCorrection('arabic','s2r','كتابة','kitāb',true,storage),/not overwritten/);
 assert.equal(await lookupCorrection('arabic','r2s','kitāb',storage),'كتاب');
 assert.equal(await lookupCorrection('arabic','s2r','كتابة',storage),null);
});
