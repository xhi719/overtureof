# Classification staging

The application does not ship invented occupations, translations, reports, forecasts, or dates. A reviewer must obtain an official versioned source and verify its permitted use and expected coverage before publication. The staging script does not fetch remote material or write to the database.

Normalize an authorized source into UTF-8 CSV with `code` and one or more of `name_ko`, `name_en`, `name_zh-CN`, `name_zh-TW`. Preserve codes as text, including leading zeroes. Prepare a JSON manifest with `system`, `version`, `source_url` (HTTPS), `license`, and a positive integer `expected_count`. Set the expected count from the official file and define precisely which level of a hierarchical classification it covers; do not compare unit groups with all hierarchy levels.

```
python etl/stage_classification.py source.csv manifest.json staged.json
```

The script validates mandatory fields, duplicates and row count, and records a SHA-256 digest. It does not verify that codes and translations match the original, check licensing, validate crosswalks or publish data. Those checks and database import remain administrative work. Keep the original source and manifest for provenance. Never interpret an exposure metric as a probability.

Official starting points: [ILO ISCO-08](https://isco.ilo.org/en/isco-08/) and [O*NET database](https://www.onetcenter.org/database.html). These are references, not bundled datasets; verify the license and version of any downloaded file separately.
