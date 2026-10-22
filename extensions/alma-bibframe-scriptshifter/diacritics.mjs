// Unicode code points and textarea offsets are different: offsets are UTF-16.
export function insertCharacter(text, start, end, character) {
  if (!character || /[\p{Cc}\p{Cs}]/u.test(character)) throw new Error('Choose a printable Unicode character or combining mark.');
  if (start < 0 || end < start || end > text.length) throw new Error('Invalid cursor position.');
  const combining = [...character].every(c => /\p{Mark}/u.test(c));
  const prefix = text.slice(0, start) + (combining ? text.slice(start, end) : '') + character;
  return {text: (prefix + text.slice(end)).normalize('NFC'), cursor: prefix.normalize('NFC').length};
}

export function parseCodePoint(value) {
  const input = value.trim().replace(/^U\+/i, '');
  if (!/^[0-9a-f]{1,6}$/i.test(input)) throw new Error('Enter a Unicode code point such as U+0301.');
  const cp = Number.parseInt(input, 16);
  if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) throw new Error('Invalid Unicode code point.');
  const character = String.fromCodePoint(cp);
  if (/[\p{Cc}\p{Cs}\p{Cn}\p{Cf}\p{Z}]/u.test(character)) throw new Error('Choose an assigned visible character or combining mark.');
  return character;
}

const markCollator = new Intl.Collator('en');
export function groupMarks(marks) {
  const groups = new Map();
  for (const mark of marks) {
    const name = mark.group || 'Shared combining marks';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(mark);
  }
  return [...groups].sort(([a], [b]) => markCollator.compare(a,b)).map(([name, entries]) => ({
    name, marks: entries.sort((a,b) => markCollator.compare(a.name,b.name) || a.code.localeCompare(b.code))
  }));
}
