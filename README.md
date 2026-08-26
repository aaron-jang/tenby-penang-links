# tenby-penang-links

Tenby International School Penang 학부모용 비공식 링크 모음.

## 빌드

문구·링크 수정은 `content.json`, 디자인 수정은 `template.html`에서 한다.
생성된 `index.html`들은 직접 수정하지 않는다.

```bash
node build.js       # content.json의 각 언어별 index.html + sitemap.xml 생성
node --test build.test.js
./verify.sh         # canonical/hreflang/자원 경로 검증
```

언어 목록(URL 경로, htmlLang 등)은 `content.json`의 `languages` 배열이 유일한 소스다.
언어를 추가/삭제할 때는 그 배열만 수정하면 되며, 이 문서나 `verify.sh`를 따로 고칠 필요는 없다
(`verify.sh`도 `content.json`에서 언어 목록을 읽어 검증한다). 현재 등록된 언어는 다음 명령으로 확인한다:

```bash
node -e "for (const l of require('./content.json').languages) console.log(l.path || '(root)', '->', (l.path || '') + 'index.html')"
```
