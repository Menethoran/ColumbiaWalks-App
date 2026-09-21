#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  printf 'Usage: %s /absolute/path/to/complete-active-theme\n' "$0" >&2
  exit 64
fi

overlay_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
theme_dir="$(realpath -e -- "$1")"

case "$theme_dir" in
  /|/home|/root|/var|/var/lib|/var/lib/ghost|/var/lib/ghost/content|/var/lib/ghost/content/themes)
    printf 'Refusing broad or unsafe theme path: %s\n' "$theme_dir" >&2
    exit 64
    ;;
esac

index_file="$theme_dir/index.hbs"
partial_source="$overlay_dir/partials/civic-editorial.hbs"
css_source="$overlay_dir/assets/css/civic-editorial.css"
js_source="$overlay_dir/assets/js/civic-editorial.js"

for required_file in "$index_file" "$partial_source" "$css_source" "$js_source"; do
  if [[ ! -f "$required_file" ]]; then
    printf 'Required file is missing: %s\n' "$required_file" >&2
    exit 66
  fi
done

if [[ "$(grep -cF 'class="stat-strip"' "$index_file")" -ne 1 ]]; then
  printf 'Expected exactly one homepage statistic-strip anchor in %s\n' "$index_file" >&2
  exit 65
fi

if ! grep -Eq 'class="stat-strip".*</section>' "$index_file"; then
  printf 'The statistic-strip anchor is not on one complete line; review the template before applying.\n' >&2
  exit 65
fi

if [[ "$(grep -cF '{{#contentFor "styles"}}' "$index_file")" -ne 1 ]]; then
  printf 'Expected exactly one homepage styles block in %s\n' "$index_file" >&2
  exit 65
fi

if grep -qF '{{> "civic-editorial"}}' "$index_file"; then
  printf 'The civic editorial is already present in %s; no files were changed.\n' "$index_file"
  exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
theme_parent="$(dirname -- "$theme_dir")"
theme_name="$(basename -- "$theme_dir")"
backup_dir="$theme_parent/${theme_name}.before-civic-editorial-$timestamp"

if [[ -e "$backup_dir" ]]; then
  printf 'Backup target already exists: %s\n' "$backup_dir" >&2
  exit 73
fi

mkdir -p -- "$backup_dir/assets/css" "$backup_dir/assets/js" "$backup_dir/partials"
cp -a -- "$index_file" "$backup_dir/index.hbs"

for relative_file in assets/css/civic-editorial.css assets/js/civic-editorial.js partials/civic-editorial.hbs; do
  if [[ -e "$theme_dir/$relative_file" ]]; then
    cp -a -- "$theme_dir/$relative_file" "$backup_dir/$relative_file"
  fi
done

mkdir -p -- "$theme_dir/assets/css" "$theme_dir/assets/js" "$theme_dir/partials"
install -m 0644 -- "$partial_source" "$theme_dir/partials/civic-editorial.hbs"
install -m 0644 -- "$css_source" "$theme_dir/assets/css/civic-editorial.css"
install -m 0644 -- "$js_source" "$theme_dir/assets/js/civic-editorial.js"

temporary_index="$(mktemp --tmpdir="$theme_dir" '.index.hbs.civic.XXXXXX')"
cleanup() {
  if [[ -n "${temporary_index:-}" && -e "$temporary_index" ]]; then
    rm -f -- "$temporary_index"
  fi
}
trap cleanup EXIT

awk '
BEGIN { added_assets = 0; added_partial = 0 }
{
  line = $0
  if (!added_assets && index(line, "{{#contentFor \"styles\"}}") && index(line, "{{/contentFor}}")) {
    sub(/{{\/contentFor}}/, "<link rel=\"stylesheet\" href=\"{{asset \"css/civic-editorial.css\"}}\"><script defer src=\"{{asset \"js/civic-editorial.js\"}}\"></script>{{/contentFor}}", line)
    added_assets = 1
  }
  print line
  if (!added_partial && index(line, "class=\"stat-strip\"") && index(line, "</section>")) {
    print "{{> \"civic-editorial\"}}"
    added_partial = 1
  }
}
END {
  if (!added_assets || !added_partial) {
    exit 42
  }
}
' "$index_file" > "$temporary_index"

chmod --reference="$index_file" "$temporary_index"
chown --reference="$index_file" "$temporary_index" 2>/dev/null || true
mv -f -- "$temporary_index" "$index_file"
temporary_index=""

if [[ "$(grep -cF '{{> "civic-editorial"}}' "$index_file")" -ne 1 ]] ||
   [[ "$(grep -cF 'css/civic-editorial.css' "$index_file")" -ne 1 ]] ||
   [[ "$(grep -cF 'js/civic-editorial.js' "$index_file")" -ne 1 ]]; then
  printf 'Post-apply validation failed. Restore index.hbs from %s before restarting Ghost.\n' "$backup_dir" >&2
  exit 70
fi

printf 'Civic editorial applied to: %s\n' "$theme_dir"
printf 'Rollback copy preserved at: %s\n' "$backup_dir"
printf 'Restart Ghost, then verify the public homepage before considering the change complete.\n'
sha256sum -- "$index_file" "$theme_dir/partials/civic-editorial.hbs" "$theme_dir/assets/css/civic-editorial.css" "$theme_dir/assets/js/civic-editorial.js"
