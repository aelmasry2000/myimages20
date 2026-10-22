import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {insertCharacter, parseCodePoint, groupMarks} from './diacritics.mjs';
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
test('Unicode catalog contains expected scripts and unique valid code points',async()=>{
 const {marks}=JSON.parse(await readFile(new URL('marks.json',import.meta.url),'utf8'));
 assert.ok(marks.length>2000); assert.equal(new Set(marks.map(m=>m.code)).size,marks.length);
 for(const m of marks) {assert.match(m.character,/^\p{Mark}$/u);assert.equal(parseCodePoint(m.code),m.character);}
 for(const name of ['COMBINING ACUTE ACCENT','ARABIC FATHA','HEBREW POINT SHEVA','DEVANAGARI VOWEL SIGN I']) assert.ok(marks.some(m=>m.name===name));
});

test('marks are grouped by script and sorted by name without mutating the catalog',()=>{
 const input=[{name:'HEBREW POINT SHEVA',code:'U+05B0',group:'Hebrew'}, {name:'ARABIC SHADDA',code:'U+0651',group:'Arabic'}, {name:'ARABIC FATHA',code:'U+064E',group:'Arabic'}];
 const result=groupMarks(input);
 assert.deepEqual(result.map(group=>group.name),['Arabic','Hebrew']);
 assert.deepEqual(result[0].marks.map(mark=>mark.name),['ARABIC FATHA','ARABIC SHADDA']);
 assert.equal(input[0].name,'HEBREW POINT SHEVA');
});
