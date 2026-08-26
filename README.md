# tenby-penang-links

Tenby International School Penang 학부모용 비공식 링크 모음.

## 빌드

문구·링크 수정은 `content.json`, 디자인 수정은 `template.html`에서 한다.
생성된 `index.html`들은 직접 수정하지 않는다.

```bash
node build.js       # 5개 언어 index.html + sitemap.xml 생성
node --test build.test.js
./verify.sh         # canonical/hreflang/자원 경로 검증
```

| URL | 파일 |
|---|---|
| `/tenby-penang-links/` | `index.html` (en, canonical) |
| `/tenby-penang-links/ko/` | `ko/index.html` |
| `/tenby-penang-links/ja/` | `ja/index.html` |
| `/tenby-penang-links/zh-cn/` | `zh-cn/index.html` |
| `/tenby-penang-links/zh-tw/` | `zh-tw/index.html` |
