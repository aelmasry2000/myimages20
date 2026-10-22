export const API = 'https://bibframe.org/scriptshifter/';

export function detectDirection(text) {
  const letters = [...text].filter(c => /\p{Letter}/u.test(c));
  if (!letters.length) return '';
  const latin = letters.filter(c => /\p{Script=Latin}/u.test(c)).length;
  if (latin === letters.length) return 'r2s';
  if (latin === 0) return 's2r';
  return ''; // Mixed scripts require a choice.
}

export function suggestLanguage(text, tables, recordLanguage = '') {
  const hint = recordLanguage.trim().toLowerCase();
  if (hint) {
    const matches = Object.entries(tables).filter(([id, t]) => !t.alias_of &&
      (id.toLowerCase() === hint || t.label?.toLowerCase() === hint ||
       (Array.isArray(t.marc_code) ? t.marc_code : String(t.marc_code || '').split(/[,\s]+/)).includes(hint)));
    if (matches.length === 1) return {id: matches[0][0], reason: 'Record language'};
  }
  // Script identification is not language identification: Arabic, Cyrillic, Han,
  // and Latin can each represent several languages. Do not guess those.
  const uniqueScripts = [['Hangul', 'korean'], ['Hiragana', 'japanese'],
    ['Katakana', 'japanese'], ['Greek', 'greek'], ['Armenian', 'armenian'],
    ['Georgian', 'georgian']];
  const candidates = new Set();
  for (const [script, id] of uniqueScripts) {
    if (new RegExp(`\\p{Script=${script}}`, 'u').test(text) && tables[id] && !tables[id].alias_of) candidates.add(id);
  }
  return candidates.size === 1 ? {id: [...candidates][0], reason: 'Script-based suggestion; confirm language'} :
    {id: '', reason: 'Language is ambiguous; select it below'};
}

export function assertSupported(tables, lang, direction) {
  if (!tables[lang] || tables[lang].alias_of) throw new Error('Select a language.');
  if (!['s2r', 'r2s'].includes(direction)) throw new Error('Select a conversion direction.');
  if (!tables[lang][`has_${direction}`]) throw new Error('This language does not support that direction.');
}

export async function apiRequest(path, body, fetcher = fetch) {
  if (!['languages', 'trans'].includes(path)) throw new Error('Invalid API route');
  const response = await fetcher(API + path, {
    method: body ? 'POST' : 'GET', credentials: 'omit', redirect: 'error',
    headers: body ? {'Content-Type': 'application/json'} : {},
    ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`ScriptShifter returned HTTP ${response.status}.`);
  const data = await response.json();
  if (path === 'trans' && (typeof data.output !== 'string' || !data.output.trim())) {
    throw new Error('ScriptShifter returned no usable output.');
  }
  if (path === 'languages' && (!data || Array.isArray(data) || typeof data !== 'object' || !Object.keys(data).length)) {
    throw new Error('ScriptShifter returned an invalid language list.');
  }
  return data;
}

// Cache public language metadata only; field text and conversions are never stored.
export async function loadLanguages(cache = globalThis.chrome?.storage?.local, request = apiRequest, now = Date.now()) {
  const key='scriptshifterLanguagesV1';
  if (cache) {
    try {
      const saved=(await cache.get(key))[key];
      if (saved && now>=saved.savedAt && now-saved.savedAt<86400000 &&
          saved.tables && typeof saved.tables === 'object' && !Array.isArray(saved.tables) && Object.keys(saved.tables).length &&
          Object.values(saved.tables).every(table=>table && typeof table.label === 'string')) return saved.tables;
    } catch { /* Storage failure should not prevent a live fetch. */ }
  }
  const tables=await request('languages');
  if(cache) {try{await cache.set({[key]:{savedAt:now,tables}});}catch{}}
  return tables;
}

export function transliterationRequest(lang, text, direction, fieldName = '') {
  if (!['s2r','r2s'].includes(direction)) throw new Error('Choose a supported conversion direction.');
  const nameField = /^(contributors\[\d+\]\.name|publication\[\d+\]\.publisher)$/.test(fieldName);
  return {lang, text, t_dir:direction,
    capitalize:direction==='s2r' ? (nameField ? 'all' : 'first') : false,
    options:{}};
}
