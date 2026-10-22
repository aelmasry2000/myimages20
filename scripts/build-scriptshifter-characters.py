#!/usr/bin/env python3
"""Build cataloging romanization characters from an explicit ScriptShifter checkout.
Requires PyYAML. No general Unicode mark inventory is used as a fallback.
"""
import argparse, csv, json, subprocess, unicodedata as ud
from functools import lru_cache
from pathlib import Path
import yaml

parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path,help='Local lcnetdev/scriptshifter Git checkout')
args=parser.parse_args()
upstream=args.source.resolve(); repo=Path(__file__).resolve().parent.parent
sha=subprocess.check_output(['git','-C',str(upstream),'rev-parse','HEAD'],text=True).strip()
loader=getattr(yaml,'CSafeLoader',yaml.SafeLoader)
index=yaml.load((upstream/'scriptshifter/tables/index.yml').read_text(),Loader=loader)
base=upstream/'scriptshifter/tables/data'

@lru_cache(None)
def table(name):
    path=base/(name+'.yml')
    data=yaml.load(path.read_text(),Loader=loader) or {}
    maps={'script_to_roman':{},'roman_to_script':{}}
    for parent in (data.get('general') or {}).get('parents',[]):
        inherited=table(parent)
        for direction in maps:maps[direction].update(inherited[direction])
    for direction in maps:
        for key,value in ((data.get(direction) or {}).get('map') or {}).items():
            maps[direction][key]=(value,str(path.relative_to(upstream))+':'+direction+'.map')
    return maps

samples={id:[] for id in index}
for path in sorted((upstream/'test/data/script_samples').glob('*.csv')):
    with path.open(encoding='utf-8-sig',newline='') as file:
        for row in csv.reader(file):
            if len(row)>=3 and row[0] in index:
                samples[row[0]].append((row[2],str(path.relative_to(upstream))+':romanized column'))

spacing=set('ʹʺʻʼʽʾʿˀˁ′″')
def candidates(text):
    # NFC supplies the precomposed form of a documented decomposed sequence;
    # NFD exposes its actual combining marks. These are not invented alphabets.
    for version in (text,ud.normalize('NFC',text),ud.normalize('NFD',text)):
        for char in version:
            name=ud.name(char,'')
            if ord(char)>127 and ('LATIN' in name or char in spacing or
                (ud.category(char).startswith('M') and name.startswith('COMBINING '))):
                yield char

marks=[];languages=[]
for id,info in index.items():
    target=info.get('alias_of',id)
    while target in index and index[target].get('alias_of'):target=index[target]['alias_of']
    maps=table(target);evidence={}
    # Tables take precedence; use samples only for hook-only languages.
    values=list(samples[id]) if not any(maps[direction] for direction in maps) else []
    for direction,items in maps.items():
        for key,(value,ref) in items.items():
            text=value if direction=='script_to_roman' else key
            if direction=='roman_to_script' and isinstance(value,str) and value and all(ud.category(c) in ('Cf','Cc') for c in value):continue
            if isinstance(text,str):values.append((text,ref))
    for text,ref in values:
        for char in candidates(text):evidence.setdefault(char,set()).add(ref)
    label=info['name']
    languages.append({'id':id,'label':label,'count':len(evidence)})
    for char,refs in evidence.items():
        name=ud.name(char)
        if id=='arabic':
            aliases={'ʻ':'Ayn (modifier letter turned comma)','ʿ':'Ayn (modifier letter left half ring)',
                     'ʼ':'Hamza (modifier letter apostrophe)','ʾ':'Hamza (modifier letter right half ring)'}
            display=aliases.get(char,name)
        else:display=name
        marks.append({'character':char,'name':display,'unicode_name':name,'group':label,
                      'language_id':id,'code':f'U+{ord(char):04X}','sources':sorted(refs)})
references=sorted({reference for mark in marks for reference in mark['sources']})
reference_ids={reference:index for index,reference in enumerate(references)}
for mark in marks:
    mark['source_ids']=[reference_ids[reference] for reference in mark.pop('sources')]
    mark.pop('language_id')
    if mark['name']==mark['unicode_name']:mark.pop('unicode_name')
marks.sort(key=lambda item:(item['group'].casefold(),item['name'].casefold(),item['code']))
data={'source':'https://github.com/lcnetdev/scriptshifter','source_commit':sha,
      'scope':'Romanization-side and inherited mappings; test samples only for hook-only languages. Not an exhaustive inventory for external services.',
      'unicode_version':ud.unidata_version,'source_files':references,'languages':sorted(languages,key=lambda item:item['label'].casefold()),'marks':marks}
for name in ('folio-scriptshifter','alma-metadata-scriptshifter','alma-bibframe-scriptshifter'):
    directory=repo/'extensions'/name
    (directory/'marks.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    (directory/'SCRIPTSHIFTER-LICENSE.txt').write_text((upstream/'LICENSE').read_text())
print(f'{len(marks)} entries across {len(languages)} indexed languages from {sha}')
print('No documented non-ASCII romanization characters:',', '.join(item['label'] for item in languages if not item['count']))
print('Arabic:',', '.join(item['character'] for item in marks if item['group']=='Arabic'))
