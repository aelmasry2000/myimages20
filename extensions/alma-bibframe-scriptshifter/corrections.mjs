const prefix='scriptshifterCorrectionV1:';
function clean(value){return value.normalize('NFC').trim();}
async function key(lang,direction,source){
 const bytes=new TextEncoder().encode(JSON.stringify([lang,direction,clean(source)]));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return prefix+[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function lookupCorrection(lang,direction,source,storage=globalThis.chrome?.storage?.local){
 if(!storage)return null;
 const id=await key(lang,direction,source),data=(await storage.get(id))[id];
 return data?.lang===lang && data.direction===direction && data.source===clean(source) && typeof data.target==='string' ? data.target : null;
}
export async function rememberCorrection(lang,direction,source,target,reverse=false,storage=globalThis.chrome?.storage?.local){
 if(!storage)throw new Error('Local correction storage is unavailable.');
 source=clean(source);target=clean(target);
 if(!lang || !['s2r','r2s'].includes(direction) || !source || !target)throw new Error('Select the language/direction and review a nonempty conversion first.');
 if(source.length>4096 || target.length>4096)throw new Error('Saved corrections are limited to 4,096 characters per value.');
 const forward=await key(lang,direction,source),entries={[forward]:{lang,direction,source,target}};
 if(reverse){
  const opposite=direction==='s2r'?'r2s':'s2r';
  const inverse=await key(lang,opposite,target),existing=(await storage.get(inverse))[inverse];
  if(existing && existing.target!==source)throw new Error('That reverse value already has a different saved correction. It was not overwritten.');
  entries[inverse]={lang,direction:opposite,source:target,target:source};
 }
 await storage.set(entries);
}
export async function forgetCorrection(lang,direction,source,storage=globalThis.chrome?.storage?.local){
 if(!storage)throw new Error('Local correction storage is unavailable.');
 await storage.remove(await key(lang,direction,source));
}
