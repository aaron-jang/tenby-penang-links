#!/usr/bin/env bash
set -euo pipefail
BASE="https://soosoo.life/tenby-penang-links"
fail=0
chk() { if eval "$2" >/dev/null 2>&1; then echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi }

for pair in "index.html|en|" "ko/index.html|ko|ko/" "ja/index.html|ja|ja/" \
            "zh-cn/index.html|zh-Hans|zh-cn/" "zh-tw/index.html|zh-Hant|zh-tw/"; do
  IFS='|' read -r file lang p <<< "$pair"
  echo "== $file"
  chk "file exists"            "test -f '$file'"
  chk "html lang=$lang"        "grep -q '<html lang=\"$lang\">' '$file'"
  chk "self canonical"         "grep -q 'rel=\"canonical\" href=\"$BASE/$p\"' '$file'"
  chk "hreflang set (6)"       "test \$(grep -c 'rel=\"alternate\" hreflang=' '$file') -eq 6"
  chk "x-default -> root"      "grep -q 'hreflang=\"x-default\" href=\"$BASE/\"' '$file'"
  chk "no unreplaced tokens"   "! grep -q '{{' '$file'"
  chk "no legacy i18n JS"      "! grep -qE 'switchLanguage|openAppStore|detectBrowserLanguage|preferred-language|data-i18n' '$file'"
  chk "generated banner"       "grep -q 'DO NOT EDIT' '$file'"
  chk "ios url has no country" "! grep -qE 'apps\.apple\.com/(us|kr|jp|cn|tw|my)/' '$file'"
done

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
for p in "" "ko/" "ja/" "zh-cn/" "zh-tw/"; do
  chk "sitemap has $BASE/$p" "grep -q '<loc>$BASE/$p</loc>' sitemap.xml"
done
chk "sitemap xhtml ns"   "grep -q 'xmlns:xhtml' sitemap.xml"
chk "robots -> sitemap"  "grep -q 'Sitemap: $BASE/sitemap.xml' robots.txt"

exit $fail
