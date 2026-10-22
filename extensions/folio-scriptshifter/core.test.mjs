import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDirection, suggestLanguage, assertSupported, apiRequest, API, loadLanguages, transliterationRequest, normalizeRomanization} from './core.mjs';
const tables = {arabic: {label:'Arabic', marc_code:'ara', has_s2r:true, has_r2s:false}, korean:{label:'Korean',marc_code:'kor',has_s2r:true,has_r2s:true}};
test('direction distinguishes script, romanization, mixed and nonletter text', () => {
 assert.equal(detectDirection('كتاب'), 's2r'); assert.equal(detectDirection('kitāb'), 'r2s');
 assert.equal(detectDirection('كتاب book'), ''); assert.equal(detectDirection('123'), '');
});
test('language uses record metadata and leaves shared scripts ambiguous', () => {
 assert.equal(suggestLanguage('kitāb', tables, 'ara').id, 'arabic');
 assert.equal(suggestLanguage('한국', tables).id, 'korean');
 assert.equal(suggestLanguage('كتاب', tables).id, '');
 assert.equal(suggestLanguage('kitāb', tables).id, '');
});
test('unsupported reverse conversions are rejected', () => {
 assert.throws(() => assertSupported(tables, 'arabic', 'r2s'), /does not support/);
 assert.doesNotThrow(() => assertSupported(tables, 'arabic', 's2r'));
});
test('API sends required payload to documented endpoint without cookies', async () => {
 const payload = {lang:'arabic',text:'كتاب',t_dir:'s2r',capitalize:'first',options:{}};
 const result = await apiRequest('trans', payload, async (url, options) => {
  assert.equal(url, API+'trans'); assert.equal(options.credentials, 'omit');
  assert.deepEqual(JSON.parse(options.body), payload);
  return {ok:true,json:async()=>({output:'kitāb',warnings:[]})};
 }); assert.equal(result.output, 'kitāb');
});
test('HTTP failures and empty outputs cannot become previews', async () => {
 await assert.rejects(apiRequest('trans', {}, async()=>({ok:false,status:403})), /403/);
 await assert.rejects(apiRequest('trans', {}, async()=>({ok:true,json:async()=>({output:''})})), /no usable/);
});

test('language metadata cache avoids repeated requests, expires, and stores no field text',async()=>{
 let stored={},calls=0;
 const cache={get:async()=>stored,set:async value=>{stored=value;}};
 const request=async path=>{assert.equal(path,'languages');calls++;return tables;};
 assert.deepEqual(await loadLanguages(cache,request,100),tables);
 assert.deepEqual(await loadLanguages(cache,request,200),tables);assert.equal(calls,1);
 assert.deepEqual(Object.keys(stored.scriptshifterLanguagesV1),['savedAt','tables']);
 await loadLanguages(cache,request,86400200);assert.equal(calls,2);
});

test('only first-word capitalization is requested for the complete romanized field',()=>{
 const text='كتاب جديد : مقدمة / اسم المؤلف';
 assert.deepEqual(transliterationRequest('arabic',text,'s2r'), {lang:'arabic',text,t_dir:'s2r',capitalize:'first',options:{}});
 assert.equal(transliterationRequest('arabic','Kitāb jadīd','r2s').capitalize,false);
});

test('names use every-word capitalization while titles, places and notes use first word only',()=>{
 for(const field of ['contributors[0].name','contributors[3].name','publication[0].publisher','publication[2].publisher']) {
  assert.equal(transliterationRequest('arabic','أحمد علي','s2r',field).capitalize,'all');
  assert.equal(transliterationRequest('arabic','Aḥmad ʿAlī','r2s',field).capitalize,false);
 }
 for(const field of ['title','indexTitle','notes[0].note','publication[0].place','publication[0].role','contributors[0].contributorTypeText']) {
  assert.equal(transliterationRequest('arabic','كتاب جديد','s2r',field).capitalize,'first');
 }
});

test('title case correction lowercases interior capitals and uppercases only the first cased letter',()=>{
 assert.equal(normalizeRomanization('al-Kitāb wa-al-Maktabah','s2r','title'),'Al-kitāb wa-al-maktabah');
 assert.equal(normalizeRomanization('“al-Kitāb” : AL-MAKTABAH / ʿALĪ','s2r','title'),'“Al-kitāb” : al-maktabah / ʿalī');
 assert.equal(normalizeRomanization('123 — ʿALĪ wa-KITĀB','s2r','notes[0].note'),'123 — ʿAlī wa-kitāb');
});
test('name fields capitalize each word and reverse conversion is unchanged',()=>{
 assert.equal(normalizeRomanization('aḤMAD ʿaLĪ','s2r','contributors[0].name'),'Aḥmad ʿAlī');
 assert.equal(normalizeRomanization('dĀR al-KUTUB','s2r','publication[0].publisher'),'Dār Al-kutub');
 assert.equal(normalizeRomanization('الكتاب المكتبة','r2s','title'),'الكتاب المكتبة');
});
