# ISCO-08 source and rights review

Source: International Labour Organization, [ISCO-08 official structure CSV](https://www.ilo.org/ilostat-files/ISCO/newdocs-08-2021/ISCO-08/ISCO-08%20EN.csv), linked from [ISCO-08](https://isco.ilo.org/en/isco-08/). Accessed 2026-10-31. The HTTP Last-Modified header was 2021-08-03. SHA-256: `9afc6377d6ed6738d59aa0476777042e180397400d7dcd932e084045228b4d49`.

The original CSV includes four classification versions. The conversion script selects ISCO-08 and verifies the official count of 436 unit groups. Three military codes have a leading zero lost in the CSV; they are restored from the source major-group field (`0`): `0110`, `0210`, `0310`. Names are the official English labels only. No translation, probability, task or prediction is inferred.

**Rights:** ILO's [rights and permissions policy](https://www.ilo.org/rights-and-permissions) says pre-3 May 2023 datasets are not automatically licensed CC BY 4.0. This source was last modified in 2021. The exact reproduction terms of this CSV have not been established; the original ISCO-08 publication requests permission for reproduction and translation. Keep the snapshot for local review; obtain or verify rights before publicly redistributing or publishing it. Do not label it CC BY 4.0 without evidence.

Both `ISCO-08-EN.csv` and `isco08-normalized.json` are excluded from Git while their redistribution terms remain unverified. A fresh checkout therefore does not contain them. The command below is for a local, separately acquired source only and will not run until the source is present; obtaining a file does not itself establish redistribution rights. The application's current database does not depend on these review-only ISCO files.

Run `python etl/normalize_isco08.py data/isco-08/ISCO-08-EN.csv data/isco-08/isco08-normalized.json`. This creates a local review file, not a database publication.
