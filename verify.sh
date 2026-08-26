#!/usr/bin/env bash
set -euo pipefail

# Language list and base URL are derived from content.json — the single
# source of truth. Adding a language there is enough for this script to
# start checking it too; nothing here needs to be edited.
BASE="$(node -e "process.stdout.write(require('./content.json').site.baseUrl.replace(/\/\$/, ''))")"
LANG_COUNT="$(node -e "process.stdout.write(String(require('./content.json').languages.length))")"
HREFLANG_COUNT=$((LANG_COUNT + 1))

fail=0
chk() { if eval "$2" >/dev/null 2>&1; then echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi }

LANGS="$(node -e "
const c = require('./content.json');
for (const l of c.languages) console.log(l.path + '|' + l.htmlLang);
")"

while IFS='|' read -r p lang; do
  file="${p}index.html"
  echo "== $file"
  chk "file exists"            "test -f '$file'"
  chk "html lang=$lang"        "grep -q '<html lang=\"$lang\">' '$file'"
  chk "self canonical"         "grep -q 'rel=\"canonical\" href=\"$BASE/$p\"' '$file'"
  chk "hreflang set ($HREFLANG_COUNT)" "test \$(grep -c 'rel=\"alternate\" hreflang=' '$file') -eq $HREFLANG_COUNT"
  chk "x-default -> root"      "grep -q 'hreflang=\"x-default\" href=\"$BASE/\"' '$file'"
  chk "no unreplaced tokens"   "! grep -q '{{' '$file'"
  chk "no legacy i18n JS"      "! grep -qE 'switchLanguage|openAppStore|detectBrowserLanguage|preferred-language|data-i18n' '$file'"
  chk "generated banner"       "grep -q 'DO NOT EDIT' '$file'"
  chk "ios url has no country" "! grep -qE 'apps\.apple\.com/(us|kr|jp|cn|tw|my)/' '$file'"
done <<< "$LANGS"

echo "== assets"
python3 - <<'PY'
import re, os, sys, glob
bad = []
for f in ['index.html'] + glob.glob('*/index.html'):
    d = os.path.dirname(f)
    for m in re.finditer(r'(?:src|href)="((?:\.\./)?(?:icons/|favicon\.svg|qr-generator\.html)[^"]*)"', open(f, encoding='utf-8').read()):
        p = os.path.normpath(os.path.join(d, m.group(1)))
        if not os.path.exists(p):
            bad.append(f'{f} -> {m.group(1)}')
print('  FAIL missing assets:\n   ' + '\n   '.join(bad) if bad else '  ok   all asset paths resolve')
sys.exit(1 if bad else 0)
PY

echo "== sitemap"
while IFS='|' read -r p lang; do
  chk "sitemap has $BASE/$p" "grep -q '<loc>$BASE/$p</loc>' sitemap.xml"
done <<< "$LANGS"
chk "sitemap xhtml ns"   "grep -q 'xmlns:xhtml' sitemap.xml"
chk "robots -> sitemap"  "grep -q 'Sitemap: $BASE/sitemap.xml' robots.txt"

exit $fail
