#!/usr/bin/env python3
"""Build the independently loadable FOLIO and Alma extension ZIPs."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import json

repo = Path(__file__).resolve().parent.parent
for name in ('folio-scriptshifter', 'alma-metadata-scriptshifter', 'alma-bibframe-scriptshifter'):
    source = repo / 'extensions' / name
    manifest = json.loads((source / 'manifest.json').read_text())
    assert manifest['manifest_version'] == 3
    destination = repo / 'downloads' / (name + '.zip')
    destination.parent.mkdir(exist_ok=True)
    with ZipFile(destination, 'w', compression=ZIP_DEFLATED) as archive:
        for file in sorted(source.iterdir()):
            if not file.is_file() or file.name.endswith('.test.mjs'):
                continue
            info = ZipInfo(name + '/' + file.name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, file.read_bytes())
    with ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert json.loads(archive.read(name + '/manifest.json'))['name'] == manifest['name']
        if (source / 'mode.mjs').exists():
            assert archive.read(name + '/mode.mjs') == (source / 'mode.mjs').read_bytes()
        if 'background' in manifest:
            assert name + '/' + manifest['background']['service_worker'] in archive.namelist()
    print(f'{destination.relative_to(repo)}: {manifest["name"]} {manifest["version"]}')
