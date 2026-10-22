import test from 'node:test';
import assert from 'node:assert/strict';
import {marcParts,convertMarc} from './marc.mjs';
test('MARC delimiters, codes and numeric identifiers are retained',async()=>{
 const seen=[];
 const output=await convertMarc('$$6880-01 $$a كتاب $$b جديد $$0http://example.org/ID','245','s2r',async(text,cap)=>{seen.push([text,cap]);return text==='كتاب'?'Kitāb':'jadīd';});
 assert.equal(output,'$$6880-01 $$a Kitāb $$b jadīd $$0http://example.org/ID');
 assert.deepEqual(seen,[['كتاب','first'],['جديد',false]]);
});
test('personal/corporate names and publisher names receive every-word capitalization',async()=>{
 for(const tag of ['100','110','111','700','710']){
  const calls=[];const result=await convertMarc('$$a أحمد علي $$e author $$6link',tag,'s2r',async(text,cap)=>{calls.push(cap);return 'Aḥmad ʿAlī';});
  assert.deepEqual(calls,['all']);assert.match(result,/\$\$e author \$\$6link$/);
 }
 const calls=[];await convertMarc('$$a القاهرة $$b دار الكتب','264','s2r',async(text,cap)=>{calls.push(cap);return text;});
 assert.deepEqual(calls,['first','all']);
});
test('reverse conversion has no capitalization and empty/control fields are rejected',async()=>{
 const calls=[];await convertMarc('$a Kitāb $b jadīd','245','r2s',async(text,cap)=>{calls.push(cap);return text;});assert.deepEqual(calls,[false,false]);
 await assert.rejects(convertMarc('123','001','s2r',async()=>''),/control fields/);
 await assert.rejects(convertMarc('$$6link','245','s2r',async()=>''),/No eligible/);
 assert.equal(marcParts('ǂa title ‡b subtitle').length,2);
});

test('URI and electronic-access subfields are never transliterated',async()=>{
 const calls=[];
 const result=await convertMarc('$$u https://example.org/كتاب $$y كتاب','856','s2r',async(text,cap)=>{calls.push([text,cap]);return 'Kitāb';});
 assert.equal(result,'$$u https://example.org/كتاب $$y Kitāb');assert.deepEqual(calls,[['كتاب','first']]);
});
