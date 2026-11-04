"""Validate a normalized official classification export for human review.

This deliberately writes a staging JSON file, not the production database.
Only use a source whose redistribution and processing terms have been checked.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse

LOCALES = ("ko", "en", "zh-CN", "zh-TW")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_file", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    for key in ("system", "version", "source_url", "license", "expected_count"):
        if not manifest.get(key):
            raise ValueError(f"manifest missing {key}")
    parsed = urlparse(manifest["source_url"])
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("source_url must be an HTTPS URL")
    if not isinstance(manifest["expected_count"], int) or manifest["expected_count"] < 1:
        raise ValueError("expected_count must be a positive integer")
    raw = args.csv_file.read_bytes()
    rows = []
    codes = set()
    with args.csv_file.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or "code" not in reader.fieldnames:
            raise ValueError("CSV requires a code column and at least one name_<locale> column")
        for number, row in enumerate(reader, 2):
            code = (row.get("code") or "").strip()
            names = {locale: (row.get(f"name_{locale}") or "").strip() for locale in LOCALES}
            names = {locale: name for locale, name in names.items() if name}
            if not code or not names:
                raise ValueError(f"row {number}: code and at least one sourced name required")
            if code in codes:
                raise ValueError(f"row {number}: duplicate code {code}")
            codes.add(code)
            rows.append({"code": code, "names": names})
    if len(rows) != manifest["expected_count"]:
        raise ValueError(f"expected {manifest['expected_count']} rows, got {len(rows)}")
    output = {"status": "pending_review", "manifest": manifest,
              "input_sha256": hashlib.sha256(raw).hexdigest(), "occupations": rows}
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Staged {len(rows)} rows; publication requires review.")


if __name__ == "__main__":
    main()
