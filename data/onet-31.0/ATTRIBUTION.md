# O*NET 31.0 data attribution

The files `occupation_data.json`, `job_titles.json`, and `task_statements.json` in this directory are verbatim official O*NET 31.0 Database files distributed by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the [Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/). O*NET® is a trademark of USDOL/ETA. Source: [O*NET 31.0 Database](https://www.onetcenter.org/database.html); [license and attribution notice](https://www.onetcenter.org/license_db.html).

The importer selects the occupation code, English name and description, job title and task statement fields, and maps those unchanged fields into the application's schema. It does not create translations, automate task classifications, or derive predictions. USDOL/ETA has not approved, endorsed, or tested this application or mapping.

- occupation data: https://www.onetcenter.org/dl_files/database/db_31_0_json/occupation_data.json ; SHA-256 `8eec5d2449c0b96a90fca0f67184b3bf76c15b3549c4f145adb48c3ae55f52f8` ; 1,016 rows.
- task statements: https://www.onetcenter.org/dl_files/database/db_31_0_json/task_statements.json ; SHA-256 `d48d985c2bcf39a8760c9ffac599cd12309d597d564856e4bb3e9759ee948545` ; 18,838 rows.
- job titles: https://www.onetcenter.org/dl_files/database/db_31_0_json/job_titles.json ; SHA-256 `862953f66de9675402a41380242374077af9dc266b1455bee325e953b079bf21` ; 54,269 rows.

Validation: `npx tsx scripts/import-onet.ts --validate-only`. After PostgreSQL is configured and `npm run db:push` has completed, import with `npx tsx scripts/import-onet.ts`. The script preserves existing edited translations and aliases; it writes an audit entry and does not remove other data.
