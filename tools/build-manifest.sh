#!/usr/bin/env bash
# Собирает spaces/manifest.json — список всех пространств для каталога.
# Каждый файл spaces/<id>.js = одно пространство. Файлы, начинающиеся с «_» (шаблоны), пропускаются.
# Запускается автоматически при деплое (.github/workflows/pages.yml); локально — после добавления пространства.
set -euo pipefail
cd "$(dirname "$0")/.."

ids=()
for f in spaces/*.js; do
  id=$(basename "$f" .js)
  [[ $id == _* ]] && continue
  if [[ ! $id =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
    echo "Пропускаю $f: имя файла должно состоять из латиницы в нижнем регистре, цифр и дефисов" >&2
    continue
  fi
  ids+=("\"$id\"")
done

( IFS=,; printf '[%s]\n' "${ids[*]}" ) > spaces/manifest.json
echo "spaces/manifest.json: пространств — ${#ids[@]}"
