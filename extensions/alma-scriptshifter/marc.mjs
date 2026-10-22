// Preserve MARC delimiters/codes and identifiers; only text subfields are converted.
export function marcParts(text) {
  const regex=/(\$\$|\$|ǂ|‡)([a-z0-9])/g;
  const matches=[...text.matchAll(regex)];
  if(!matches.length)return [{prefix:'',code:'',text}];
  const parts=[];
  if(matches[0].index)parts.push({prefix:'',code:'',text:text.slice(0,matches[0].index),literal:true});
  for(let i=0;i<matches.length;i++){
    const match=matches[i];parts.push({prefix:match[0],code:match[2],text:text.slice(match.index+match[0].length,matches[i+1]?.index ?? text.length)});
  }
  return parts;
}
export function nameTag(tag) {return /^(100|110|111|700|710|711|800|810|811)$/.test(tag);}
export async function convertMarc(text, tag, direction, convert, kind='text') {
  if(tag && Number(tag)<10)throw new Error('MARC control fields are not transliterated.');
  const parts=marcParts(text);
  const eligible=parts.filter(part=>!part.literal && !/^[0-9]$/.test(part.code) && !(nameTag(tag) && ['e','i','r'].includes(part.code)) && !(tag==='856' && part.code==='u') && !/^(https?:\/\/|urn:|doi:)/i.test(part.text.trim()) && part.text.trim());
  let first=true;
  // Serial requests keep field-level capitalization consistent and avoid flooding the API.
  for(const part of eligible){
    const name=nameTag(tag) || (/^(260|264)$/.test(tag) && part.code==='b') || (!tag && kind==='name');
    const cap=direction==='s2r'?(name?'all':first?'first':false):false;
    const leading=part.text.match(/^\s*/)[0], trailing=part.text.match(/\s*$/)[0];
    const converted=await convert(part.text.trim(),cap);
    part.text=leading+converted+trailing;first=false;
  }
  if(!eligible.length)throw new Error('No eligible textual subfields were found.');
  return parts.map(part=>part.prefix+part.text).join('');
}
