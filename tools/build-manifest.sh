#!/usr/bin/env bash
# Builds spaces/manifest.json — the list of all spaces for the catalog.
# Each file spaces/<id>.js is one space. Files starting with "_" (templates) are skipped.
# Runs automatically on deploy (.github/workflows/pages.yml); run it locally after adding a space.
set -euo pipefail
cd "$(dirname "$0")/.."

ids=()
for f in spaces/*.js; do
  id=$(basename "$f" .js)
  [[ $id == _* ]] && continue
  if [[ ! $id =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
    echo "Skipping $f: the file name must consist of lowercase Latin letters, digits and hyphens" >&2
    continue
  fi
  ids+=("\"$id\"")
done

( IFS=,; printf '[%s]\n' "${ids[*]}" ) > spaces/manifest.json
echo "spaces/manifest.json: spaces — ${#ids[@]}"
