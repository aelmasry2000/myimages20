import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {insertCharacter, parseCodePoint, groupMarks, pickerMarks} from './diacritics.mjs';
test('Latin mark composes without replacing a selected base letter',()=>{
 assert.deepEqual(insertCharacter('cafe',3,4,'\u0301'),{text:'café',cursor:4});
});
test('Arabic, Hebrew and Devanagari marks attach at cursor',()=>{
 assert.equal(insertCharacter('كتاب',1,1,'\u064e').text,'كَتاب');
 assert.equal(insertCharacter('ב',1,1,'\u05b0').text,'בְ');
 assert.equal(insertCharacter('क',1,1,'\u093f').text,'कि');
});
test('precomposed characters replace selections and insert into empty fields',()=>{
 assert.equal(insertCharacter('cat',0,1,'č').text,'čat');
 assert.equal(insertCharacter('',0,0,'é').text,'é');
 assert.deepEqual(insertCharacter('😀e',3,3,'\u0301'),{text:'😀é',cursor:3});
});
test('code point parser accepts marks and supplementary characters, rejects invalid inputs',()=>{
 assert.equal(parseCodePoint('U+0301'),'\u0301'); assert.equal(parseCodePoint('1E944'),'\u{1E944}');
 for (const input of ['110000','D800','0000','202E','not a code']) assert.throws(()=>parseCodePoint(input));
});
test('catalog is traceable to ScriptShifter and Arabic contains ayn, hamza and romanization marks only',async()=>{
 const data=JSON.parse(await readFile(new URL('marks.json',import.meta.url),'utf8'));
 assert.match(data.source_commit,/^[0-9a-f]{40}$/);assert.equal(data.source,'https://github.com/lcnetdev/scriptshifter');
 assert.equal(data.languages.length,165);
 assert.equal(new Set(data.marks.map(mark=>mark.group+'|'+mark.code)).size,data.marks.length);
 for(const mark of data.marks){
  assert.equal(parseCodePoint(mark.code),mark.character);
  assert.ok(mark.source_ids.length && mark.source_ids.every(id=>typeof data.source_files[id]==='string'));
 }
 const arabic=data.marks.filter(mark=>mark.group==='Arabic');
 assert.ok(arabic.some(mark=>mark.character==='ʻ' && mark.name.startsWith('Ayn')));
 assert.ok(arabic.some(mark=>mark.name.startsWith('Hamza')));
 for(const char of ['ā','ī','ū','ḥ','ṣ','ḍ','ṭ','ẓ','̄','̣'])assert.ok(arabic.some(mark=>mark.character===char),char);
 for(const char of ['َ','ُ','ِ','ً','ٌ','ٍ','ّ','ْ','ʉ'])assert.ok(!arabic.some(mark=>mark.character===char),char);
 assert.equal(data.languages.find(language=>language.id==='khmer').count,0);
});

test('characters are grouped by language and sorted by name without mutating the catalog',()=>{
 const input=[{name:'HEBREW POINT SHEVA',code:'U+05B0',group:'Hebrew'}, {name:'ARABIC SHADDA',code:'U+0651',group:'Arabic'}, {name:'ARABIC FATHA',code:'U+064E',group:'Arabic'}];
 const result=groupMarks(input);
 assert.deepEqual(result.map(group=>group.name),['Arabic','Hebrew']);
 assert.deepEqual(result[0].marks.map(mark=>mark.name),['ARABIC FATHA','ARABIC SHADDA']);
 assert.equal(input[0].name,'HEBREW POINT SHEVA');
});

test('picker exposes combining marks for every language without complete accented letters',()=>{
 const marks=pickerMarks([{character:'ḥ',name:'LATIN SMALL LETTER H WITH DOT BELOW',group:'Arabic',code:'U+1E25'}, {character:'\u0323',name:'COMBINING DOT BELOW',group:'Arabic',code:'U+0323'}, {character:'ʻ',name:'Ayn',group:'Arabic',code:'U+02BB'}], [{label:'French'}]);
 assert.ok(!marks.some(mark=>mark.character==='ḥ'));
 assert.ok(marks.some(mark=>mark.group==='French' && mark.name==='Dot below'));
 assert.ok(marks.some(mark=>mark.character==='ʻ'));
 for(const letter of ['b','q','x','Z']) {
  const result=insertCharacter(letter,0,1,'\u0323');
  assert.equal(result.text.normalize('NFD'),letter+'\u0323');
 }
});
