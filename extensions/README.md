# ScriptShifter extensions

Copyright © 2026 Ayman El-Masry.

Each folder is a separate Chrome/Edge extension. Load the folder containing the appropriate `manifest.json` using **Load unpacked** in the browser's extensions page.

- [FOLIO Inventory](folio-scriptshifter/README.md): `folio-scriptshifter`.
- [Alma MARC Metadata Editor](alma-metadata-scriptshifter/README.md): `alma-metadata-scriptshifter`.
- [Alma built-in BIBFRAME editor](alma-bibframe-scriptshifter/README.md): `alma-bibframe-scriptshifter`.

The previous combined `alma-scriptshifter` prototype is replaced by the two Alma extensions. Remove/disable that combined extension before loading these separately.

Separate Alma ZIPs are in [`downloads`](../downloads/). Extract a ZIP and load its extracted extension folder. Alma versions remain prototypes: live Alma compatibility and saved-record behavior are unverified, and native parallel MARC 880 fields/BIBFRAME properties must be created in Alma manually. The FOLIO extension is separate.

Rebuild both Alma archives using `python3 scripts/package-alma-extensions.py` from the repository root.
