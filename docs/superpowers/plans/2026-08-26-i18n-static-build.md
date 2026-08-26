# 다국어 정적 페이지 빌드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `content.json` + `template.html` + `build.js`로 5개 언어의 정적 `index.html`과 `sitemap.xml`을 생성하고, 기존 JS 언어 전환 방식을 대체한다.

**Architecture:** 의존성 0의 CommonJS 스크립트 `build.js`가 `content.json`(구조 1벌 + 언어별 문구 5벌)을 읽어 `template.html`의 `{{token}}`을 치환하고, 반복 블록은 문자열로 조립해 주입한다. `build.js`는 순수 함수들을 `module.exports`로 내보내고 `require.main === module`일 때만 실행되므로, `node:test`로 각 함수를 단위 테스트할 수 있다.

**Tech Stack:** Node.js 26 내장 모듈만 (`fs`, `path`, `node:test`, `node:assert`). `package.json` 없음, npm 설치 없음.

**Spec:** `docs/superpowers/specs/2026-08-26-i18n-static-build-design.md`

## Global Constraints

- **의존성 0.** `package.json`을 만들지 않는다. CommonJS(`require`/`module.exports`)를 쓴다.
- **`baseUrl`**: `https://soosoo.life/tenby-penang-links/` (트레일링 슬래시 포함)
- **언어 5개**: `en`(path `""`), `ko`(`ko/`), `ja`(`ja/`), `zh-CN`(`zh-cn/`), `zh-TW`(`zh-tw/`)
- **`<html lang>`**: en / ko / ja / **zh-Hans** / **zh-Hant**
- **hreflang**: en / ko / ja / **zh-CN** / **zh-TW** + **x-default → 루트**. 5개 페이지 전부 동일한 6줄 세트.
- **canonical**: 자기 자신 URL, 트레일링 슬래시 포함
- **내부 자원 경로**: 반드시 `{{base}}` 접두 (루트 `""`, 언어 하위 `"../"`). 절대경로 `/tenby-penang-links/` 금지 — 로컬 미리보기가 깨진다.
- **iOS URL**: `https://apps.apple.com/app/id{ios.id}` — 국가 세그먼트 없음, `?l=` 없음, 5개 언어 동일
- **Android URL**: `https://play.google.com/store/apps/details?id={pkg}&hl={playLangParam[lang]}`
- **`twitter:site` 메타는 넣지 않는다** (계정 소유 미확인)
- **JSON-LD에서 학교를 페이지 주체로 선언하지 않는다.** `WebPage.about` → `{"@type":"School", "sameAs": "https://www.tenby.edu.my/penang/"}` 참조만.
- **한국어 표기**: 한글 일반 표현은 `국제학교`(붙여쓰기). 영문 정식명 `Tenby International School Penang` 병기. `인터내셔널 스쿨` 한글 표기는 FAQ 답변 1회만. `인터네셔널`(오타 변형)은 사용 금지.
- **자동 언어 리다이렉트 금지.** `detectBrowserLanguage`, `localStorage['preferred-language']`는 완전 제거.
- **생성 파일 첫 줄**: `<!-- GENERATED FILE — DO NOT EDIT. Source: content.json + template.html. Run: node build.js -->`
- **기존 CSS·클래스명·카드 마크업 구조는 변경하지 않는다.** 디자인 회귀 금지.
- 테스트 실행: `node --test build.test.js`

---

## File Structure

| 파일 | 책임 |
|---|---|
| `content.json` | 사이트 설정, 언어 목록, 링크 구조(1벌), 언어별 문구(5벌) |
| `template.html` | 공통 껍데기 — `<head>` 슬롯, 인라인 CSS, 헤더/푸터, 유지되는 JS |
| `build.js` | 검증 → URL 조립 → 렌더링 → 파일 출력. 순수 함수 export |
| `build.test.js` | `node:test` 단위 테스트 |
| `tools/extract-translations.js` | 1회용. 기존 `index.html`의 `translations`를 content.json 조각으로 추출 |
| `index.html`, `{ko,ja,zh-cn,zh-tw}/index.html`, `sitemap.xml` | 생성물 |

---

### Task 1: content.json 스켈레톤 + 검증

**Files:**
- Create: `content.json`
- Create: `build.js`
- Test: `build.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `loadContent(dir)` → object, `validateContent(content)` → true 또는 throw

- [ ] **Step 1: `content.json` 스켈레톤 작성**

전체 데이터는 Task 10에서 채운다. 지금은 구조 검증이 가능한 최소본만.

```json
{
  "site": {
    "baseUrl": "https://soosoo.life/tenby-penang-links/",
    "gaId": "G-2P6F0R5CLH",
    "officialUrl": "https://www.tenby.edu.my/penang/",
    "schoolNameEn": "Tenby International School Penang",
    "siteName": "Tenby International School Penang Parent Resources",
    "ogImage": "og-image.png"
  },
  "languages": [
    { "code": "en",    "path": "",       "htmlLang": "en",      "hreflang": "en",    "ogLocale": "en_US", "label": "EN" },
    { "code": "ko",    "path": "ko/",    "htmlLang": "ko",      "hreflang": "ko",    "ogLocale": "ko_KR", "label": "한" },
    { "code": "zh-CN", "path": "zh-cn/", "htmlLang": "zh-Hans", "hreflang": "zh-CN", "ogLocale": "zh_CN", "label": "中简" },
    { "code": "zh-TW", "path": "zh-tw/", "htmlLang": "zh-Hant", "hreflang": "zh-TW", "ogLocale": "zh_TW", "label": "中繁" },
    { "code": "ja",    "path": "ja/",    "htmlLang": "ja",      "hreflang": "ja",    "ogLocale": "ja_JP", "label": "日" }
  ],
  "appStore": {
    "playLangParam": { "en": "en", "ko": "ko", "ja": "ja", "zh-CN": "zh-CN", "zh-TW": "zh-TW" }
  },
  "sections": [
    {
      "id": "portal",
      "icon": "🏫",
      "links": [
        { "id": "portal-isams", "type": "web",
          "url": "https://tenbypenang.parents.isamshosting.cloud/",
          "iconFile": "isams.webp" },
        { "id": "vircle", "type": "app",
          "iconFile": "vircle.webp", "iconFit": "cover",
          "ios": { "id": "1492422874" },
          "android": { "pkg": "dc.circlepay.customer" } }
      ]
    }
  ],
  "i18n": {
    "en": {
      "meta": { "title": "t", "description": "d", "keywords": "k", "h1": "h", "subtitle": "s" },
      "sections": { "portal": "School Portal & Resources" },
      "links": {
        "portal-isams": { "name": "Parent Portal (iSAMS)", "desc": "Access student grades, attendance, and announcements" },
        "vircle": { "name": "Vircle", "desc": "Card top-up, uniforms & school store" }
      },
      "guide": { "aboutTitle": "a", "aboutBody": ["b"], "portalsTitle": "p", "portals": [], "checklistTitle": "c", "checklist": [] },
      "faqTitle": "FAQ",
      "faq": [],
      "disclaimer": "d",
      "uiLabels": { "ios": "📱 iOS", "android": "🤖 Android", "qrgen": "QR Code Generator" }
    }
  }
}
```

`languages` 순서는 화면의 언어 버튼 순서(EN 한 中简 中繁 日)와 같아야 한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`build.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { validateContent } = require('./build.js');

function baseContent() {
  return {
    languages: [{ code: 'en' }, { code: 'ko' }],
    sections: [{ id: 'portal', links: [{ id: 'isams' }] }],
    i18n: {
      en: { sections: { portal: 'Portal' }, links: { isams: { name: 'n', desc: 'd' } } },
      ko: { sections: { portal: '포털' }, links: { isams: { name: 'n', desc: 'd' } } }
    }
  };
}

test('validateContent passes when every language covers every id', () => {
  assert.strictEqual(validateContent(baseContent()), true);
});

test('validateContent throws when a link translation is missing', () => {
  const c = baseContent();
  delete c.i18n.ko.links.isams;
  assert.throws(() => validateContent(c), /i18n\.ko\.links\.isams/);
});

test('validateContent throws when a section translation is missing', () => {
  const c = baseContent();
  delete c.i18n.ko.sections.portal;
  assert.throws(() => validateContent(c), /i18n\.ko\.sections\.portal/);
});

test('validateContent throws when a whole language block is missing', () => {
  const c = baseContent();
  delete c.i18n.ko;
  assert.throws(() => validateContent(c), /i18n\.ko missing/);
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `node --test build.test.js`
Expected: FAIL — `Cannot find module './build.js'`

- [ ] **Step 4: 최소 구현**

`build.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');

function loadContent(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'content.json'), 'utf8'));
}

function validateContent(content) {
  const errors = [];
  const sectionIds = content.sections.map(s => s.id);
  const linkIds = content.sections.flatMap(s => s.links.map(l => l.id));

  const dupes = linkIds.filter((id, i) => linkIds.indexOf(id) !== i);
  if (dupes.length) errors.push(`duplicate link ids: ${[...new Set(dupes)].join(', ')}`);

  for (const lang of content.languages) {
    const t = content.i18n[lang.code];
    if (!t) { errors.push(`i18n.${lang.code} missing`); continue; }
    for (const id of sectionIds) {
      if (!t.sections || !t.sections[id]) errors.push(`i18n.${lang.code}.sections.${id} missing`);
    }
    for (const id of linkIds) {
      if (!t.links || !t.links[id]) errors.push(`i18n.${lang.code}.links.${id} missing`);
    }
  }
  if (errors.length) throw new Error('content.json validation failed:\n  ' + errors.join('\n  '));
  return true;
}

module.exports = { loadContent, validateContent };
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test build.test.js`
Expected: PASS — 4 tests

- [ ] **Step 6: 실제 content.json도 검증되는지 확인**

Run: `node -e "const b=require('./build.js'); console.log(b.validateContent(b.loadContent('.')))"`
Expected: `true`

- [ ] **Step 7: 커밋**

```bash
git add content.json build.js build.test.js
git commit -m "feat: content.json 스키마와 검증 로직 추가"
```

---

### Task 2: URL 조립 함수

**Files:**
- Modify: `build.js`
- Test: `build.test.js`

**Interfaces:**
- Consumes: `content.site`, `content.appStore`, `content.languages`
- Produces: `baseFor(lang)`, `pageUrl(site, lang)`, `iosUrl(link)`, `androidUrl(link, langCode, appStore)`, `hreflangTags(content)`

- [ ] **Step 1: 실패하는 테스트 작성**

`build.test.js` 하단에 추가:

```js
const { baseFor, pageUrl, iosUrl, androidUrl, hreflangTags } = require('./build.js');

const SITE = { baseUrl: 'https://soosoo.life/tenby-penang-links/' };
const APPSTORE = { playLangParam: { en: 'en', ko: 'ko', 'zh-TW': 'zh-TW' } };

test('baseFor returns empty string at root and ../ in a language directory', () => {
  assert.strictEqual(baseFor({ path: '' }), '');
  assert.strictEqual(baseFor({ path: 'ko/' }), '../');
  assert.strictEqual(baseFor({ path: 'zh-cn/' }), '../');
});

test('pageUrl keeps the trailing slash', () => {
  assert.strictEqual(pageUrl(SITE, { path: '' }), 'https://soosoo.life/tenby-penang-links/');
  assert.strictEqual(pageUrl(SITE, { path: 'ko/' }), 'https://soosoo.life/tenby-penang-links/ko/');
});

test('iosUrl has no country segment and no l parameter', () => {
  const url = iosUrl({ ios: { id: '1492422874' } });
  assert.strictEqual(url, 'https://apps.apple.com/app/id1492422874');
  assert.ok(!/\/(us|kr|jp|cn|tw|my)\//.test(url));
  assert.ok(!url.includes('?l='));
});

test('androidUrl appends the per-language hl parameter', () => {
  const link = { android: { pkg: 'com.classdojo.android' } };
  assert.strictEqual(androidUrl(link, 'ko', APPSTORE),
    'https://play.google.com/store/apps/details?id=com.classdojo.android&hl=ko');
  assert.ok(androidUrl(link, 'zh-TW', APPSTORE).endsWith('&hl=zh-TW'));
});

test('androidUrl throws on an unmapped language', () => {
  assert.throws(() => androidUrl({ android: { pkg: 'x' } }, 'de', APPSTORE), /playLangParam.*de/);
});

test('hreflangTags emits every language plus x-default pointing at the root', () => {
  const content = {
    site: SITE,
    languages: [
      { path: '', hreflang: 'en' },
      { path: 'ko/', hreflang: 'ko' },
      { path: 'zh-cn/', hreflang: 'zh-CN' }
    ]
  };
  const out = hreflangTags(content);
  assert.ok(out.includes('hreflang="en" href="https://soosoo.life/tenby-penang-links/"'));
  assert.ok(out.includes('hreflang="ko" href="https://soosoo.life/tenby-penang-links/ko/"'));
  assert.ok(out.includes('hreflang="zh-CN" href="https://soosoo.life/tenby-penang-links/zh-cn/"'));
  assert.ok(out.includes('hreflang="x-default" href="https://soosoo.life/tenby-penang-links/"'));
  assert.strictEqual(out.split('\n').length, 4);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test build.test.js`
Expected: FAIL — `baseFor is not a function`

- [ ] **Step 3: 구현**

`build.js`의 `module.exports` 위에 추가:

```js
function baseFor(lang) {
  return lang.path === '' ? '' : '../';
}

function pageUrl(site, lang) {
  return site.baseUrl + lang.path;
}

function iosUrl(link) {
  return `https://apps.apple.com/app/id${link.ios.id}`;
}

function androidUrl(link, langCode, appStore) {
  const hl = appStore.playLangParam[langCode];
  if (!hl) throw new Error(`appStore.playLangParam.${langCode} missing`);
  return `https://play.google.com/store/apps/details?id=${link.android.pkg}&hl=${hl}`;
}

function hreflangTags(content) {
  const lines = content.languages.map(l =>
    `    <link rel="alternate" hreflang="${l.hreflang}" href="${pageUrl(content.site, l)}">`);
  lines.push(`    <link rel="alternate" hreflang="x-default" href="${content.site.baseUrl}">`);
  return lines.join('\n');
}
```

`module.exports`를 갱신:

```js
module.exports = { loadContent, validateContent, baseFor, pageUrl, iosUrl, androidUrl, hreflangTags };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test build.test.js`
Expected: PASS — 10 tests

- [ ] **Step 5: 커밋**

```bash
git add build.js build.test.js
git commit -m "feat: URL 조립 함수 추가 (iOS 국가 세그먼트 제거, Android hl 부착)"
```

---

### Task 3: `<head>` 렌더러

**Files:**
- Modify: `build.js`
- Test: `build.test.js`

**Interfaces:**
- Consumes: `pageUrl`, `hreflangTags`
- Produces: `renderHead(content, lang)` → HTML 문자열

- [ ] **Step 1: 실패하는 테스트 작성**

```js
const { renderHead } = require('./build.js');

function headContent() {
  return {
    site: {
      baseUrl: 'https://soosoo.life/tenby-penang-links/',
      siteName: 'Tenby Parent Resources',
      ogImage: 'og-image.png'
    },
    languages: [
      { code: 'en', path: '', htmlLang: 'en', hreflang: 'en', ogLocale: 'en_US' },
      { code: 'ko', path: 'ko/', htmlLang: 'ko', hreflang: 'ko', ogLocale: 'ko_KR' }
    ],
    i18n: {
      en: { meta: { title: 'EN Title', description: 'EN desc', keywords: 'a, b' } },
      ko: { meta: { title: '한국어 제목', description: '한국어 설명', keywords: '가, 나' } }
    }
  };
}

test('renderHead uses a self-referencing canonical', () => {
  const c = headContent();
  assert.ok(renderHead(c, c.languages[1])
    .includes('<link rel="canonical" href="https://soosoo.life/tenby-penang-links/ko/">'));
});

test('renderHead emits the language-specific title and description', () => {
  const c = headContent();
  const out = renderHead(c, c.languages[1]);
  assert.ok(out.includes('<title>한국어 제목</title>'));
  assert.ok(out.includes('content="한국어 설명"'));
});

test('renderHead includes the full hreflang set on every page', () => {
  const c = headContent();
  for (const lang of c.languages) {
    const out = renderHead(c, lang);
    assert.ok(out.includes('hreflang="en"'));
    assert.ok(out.includes('hreflang="ko"'));
    assert.ok(out.includes('hreflang="x-default"'));
  }
});

test('renderHead sets og:locale and lists the others as alternates', () => {
  const c = headContent();
  const out = renderHead(c, c.languages[1]);
  assert.ok(out.includes('<meta property="og:locale" content="ko_KR">'));
  assert.ok(out.includes('<meta property="og:locale:alternate" content="en_US">'));
  assert.ok(!out.includes('<meta property="og:locale:alternate" content="ko_KR">'));
});

test('renderHead uses absolute URLs for og:image and og:url', () => {
  const c = headContent();
  const out = renderHead(c, c.languages[1]);
  assert.ok(out.includes('content="https://soosoo.life/tenby-penang-links/og-image.png"'));
  assert.ok(out.includes('<meta property="og:url" content="https://soosoo.life/tenby-penang-links/ko/">'));
});

test('renderHead never emits twitter:site', () => {
  const c = headContent();
  assert.ok(!renderHead(c, c.languages[0]).includes('twitter:site'));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test build.test.js`
Expected: FAIL — `renderHead is not a function`

- [ ] **Step 3: 구현**

```js
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderHead(content, lang) {
  const t = content.i18n[lang.code];
  const url = pageUrl(content.site, lang);
  const ogImage = content.site.baseUrl + content.site.ogImage;
  const alternates = content.languages
    .filter(l => l.code !== lang.code)
    .map(l => `    <meta property="og:locale:alternate" content="${l.ogLocale}">`)
    .join('\n');

  return [
    `    <title>${escapeHtml(t.meta.title)}</title>`,
    `    <meta name="description" content="${escapeAttr(t.meta.description)}">`,
    `    <meta name="keywords" content="${escapeAttr(t.meta.keywords)}">`,
    `    <meta name="robots" content="index, follow">`,
    `    <link rel="canonical" href="${url}">`,
    ``,
    hreflangTags(content),
    ``,
    `    <meta property="og:title" content="${escapeAttr(t.meta.title)}">`,
    `    <meta property="og:description" content="${escapeAttr(t.meta.description)}">`,
    `    <meta property="og:image" content="${ogImage}">`,
    `    <meta property="og:url" content="${url}">`,
    `    <meta property="og:type" content="website">`,
    `    <meta property="og:site_name" content="${escapeAttr(content.site.siteName)}">`,
    `    <meta property="og:locale" content="${lang.ogLocale}">`,
    alternates,
    ``,
    `    <meta name="twitter:card" content="summary_large_image">`,
    `    <meta name="twitter:title" content="${escapeAttr(t.meta.title)}">`,
    `    <meta name="twitter:description" content="${escapeAttr(t.meta.description)}">`,
    `    <meta name="twitter:image" content="${ogImage}">`
  ].join('\n');
}
```

`module.exports`에 `renderHead`, `escapeHtml`, `escapeAttr` 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test build.test.js`
Expected: PASS — 16 tests

- [ ] **Step 5: 커밋**

```bash
git add build.js build.test.js
git commit -m "feat: 언어별 head 렌더러 (canonical/hreflang/OG/Twitter)"
```

---

### Task 4: JSON-LD 렌더러

**Files:**
- Modify: `build.js`
- Test: `build.test.js`

**Interfaces:**
- Consumes: `pageUrl`, `iosUrl`
- Produces: `renderJsonLd(content, lang)` → `<script type="application/ld+json">` 블록 문자열

- [ ] **Step 1: 실패하는 테스트 작성**

```js
const { renderJsonLd } = require('./build.js');

function ldContent() {
  return {
    site: {
      baseUrl: 'https://soosoo.life/tenby-penang-links/',
      siteName: 'Tenby Parent Resources',
      schoolNameEn: 'Tenby International School Penang',
      officialUrl: 'https://www.tenby.edu.my/penang/'
    },
    languages: [
      { code: 'en', path: '', htmlLang: 'en' },
      { code: 'ko', path: 'ko/', htmlLang: 'ko' }
    ],
    appStore: { playLangParam: { en: 'en', ko: 'ko' } },
    sections: [{ id: 'portal', links: [
      { id: 'isams', type: 'web', url: 'https://isams.example/' },
      { id: 'vircle', type: 'app', ios: { id: '1492422874' }, android: { pkg: 'dc.circlepay.customer' } }
    ]}],
    i18n: {
      en: { meta: { title: 'T', description: 'D' }, links: { isams: { name: 'iSAMS' }, vircle: { name: 'Vircle' } }, faq: [{ q: 'Q1', a: 'A1' }] },
      ko: { meta: { title: '제목', description: '설명' }, links: { isams: { name: 'iSAMS' }, vircle: { name: 'Vircle' } }, faq: [{ q: '질문', a: '답변' }] }
    }
  };
}

function parseLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)]
    .map(m => JSON.parse(m[1]));
}

test('renderJsonLd describes the school with about/sameAs, not as the page subject', () => {
  const c = ldContent();
  const blocks = parseLd(renderJsonLd(c, c.languages[1]));
  const page = blocks.find(b => b['@type'] === 'WebPage');
  assert.strictEqual(page.about['@type'], 'School');
  assert.strictEqual(page.about.sameAs, 'https://www.tenby.edu.my/penang/');
  assert.ok(!blocks.some(b => b['@type'] === 'EducationalOrganization'));
});

test('renderJsonLd sets inLanguage from htmlLang', () => {
  const c = ldContent();
  const page = parseLd(renderJsonLd(c, c.languages[1])).find(b => b['@type'] === 'WebPage');
  assert.strictEqual(page.inLanguage, 'ko');
});

test('renderJsonLd emits an ItemList covering every link', () => {
  const c = ldContent();
  const list = parseLd(renderJsonLd(c, c.languages[0])).find(b => b['@type'] === 'ItemList');
  assert.strictEqual(list.itemListElement.length, 2);
  assert.strictEqual(list.itemListElement[0].position, 1);
  assert.strictEqual(list.itemListElement[1].url, 'https://apps.apple.com/app/id1492422874');
});

test('renderJsonLd emits FAQPage from the language faq entries', () => {
  const c = ldContent();
  const faq = parseLd(renderJsonLd(c, c.languages[1])).find(b => b['@type'] === 'FAQPage');
  assert.strictEqual(faq.mainEntity[0].name, '질문');
  assert.strictEqual(faq.mainEntity[0].acceptedAnswer.text, '답변');
});

test('renderJsonLd emits BreadcrumbList on language pages but not on the English root', () => {
  const c = ldContent();
  const ko = parseLd(renderJsonLd(c, c.languages[1]));
  const en = parseLd(renderJsonLd(c, c.languages[0]));
  const koCrumb = ko.find(b => b['@type'] === 'BreadcrumbList');
  assert.strictEqual(koCrumb.itemListElement.length, 2);
  assert.ok(!en.some(b => b['@type'] === 'BreadcrumbList'));
});

test('renderJsonLd omits FAQPage when there are no faq entries', () => {
  const c = ldContent();
  c.i18n.en.faq = [];
  assert.ok(!parseLd(renderJsonLd(c, c.languages[0])).some(b => b['@type'] === 'FAQPage'));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test build.test.js`
Expected: FAIL — `renderJsonLd is not a function`

- [ ] **Step 3: 구현**

```js
function linkTargetUrl(link) {
  if (link.type === 'web') return link.url;
  return iosUrl(link);
}

function renderJsonLd(content, lang) {
  const t = content.i18n[lang.code];
  const site = content.site;
  const url = pageUrl(site, lang);
  const blocks = [];

  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    url,
    name: t.meta.title,
    description: t.meta.description,
    inLanguage: lang.htmlLang,
    isPartOf: { '@type': 'WebSite', url: site.baseUrl, name: site.siteName },
    about: { '@type': 'School', name: site.schoolNameEn, sameAs: site.officialUrl }
  });

  const items = [];
  for (const section of content.sections) {
    for (const link of section.links) {
      items.push({
        '@type': 'ListItem',
        position: items.length + 1,
        name: t.links[link.id].name,
        url: linkTargetUrl(link)
      });
    }
  }
  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.meta.title,
    itemListElement: items
  });

  if (t.faq && t.faq.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: t.faq.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    });
  }

  if (lang.path !== '') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: site.siteName, item: site.baseUrl },
        { '@type': 'ListItem', position: 2, name: t.meta.h1 || t.meta.title, item: url }
      ]
    });
  }

  return blocks
    .map(b => `    <script type="application/ld+json">\n${JSON.stringify(b, null, 4)}\n    </script>`)
    .join('\n');
}
```

`module.exports`에 `renderJsonLd`, `linkTargetUrl` 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test build.test.js`
Expected: PASS — 22 tests

- [ ] **Step 5: 커밋**

```bash
git add build.js build.test.js
git commit -m "feat: JSON-LD 렌더러 (WebPage/ItemList/FAQPage/BreadcrumbList)"
```

---

### Task 5: 링크 카드 및 섹션 렌더러

**Files:**
- Modify: `build.js`
- Test: `build.test.js`

**Interfaces:**
- Consumes: `iosUrl`, `androidUrl`, `escapeAttr`, `escapeHtml`
- Produces: `renderSections(content, lang)` → HTML 문자열

기존 마크업을 그대로 재현해야 한다. `web` 타입은 `<a class="app-card web-card">`, `app` 타입은 `<div class="app-card">` + 버튼. `data-i18n` 속성은 더 이상 필요 없으므로 붙이지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
const { renderSections } = require('./build.js');

function sectionContent() {
  return {
    appStore: { playLangParam: { ko: 'ko' } },
    sections: [{ id: 'portal', icon: '🏫', links: [
      { id: 'isams', type: 'web', url: 'https://isams.example/', iconFile: 'isams.webp' },
      { id: 'vircle', type: 'app', iconFile: 'vircle.webp', iconFit: 'cover',
        ios: { id: '1492422874' }, android: { pkg: 'dc.circlepay.customer' } }
    ]}],
    i18n: { ko: {
      sections: { portal: '학교 포털 및 자료' },
      links: { isams: { name: 'iSAMS 학부모 포털', desc: '성적·출결 확인' },
               vircle: { name: 'Vircle', desc: '교복 및 스토어' } },
      uiLabels: { ios: '📱 iOS', android: '🤖 Android' }
    }}
  };
}

test('renderSections prefixes icon paths with base', () => {
  const c = sectionContent();
  assert.ok(renderSections(c, { code: 'ko' }, '../').includes('src="../icons/isams.webp"'));
  assert.ok(renderSections(c, { code: 'ko' }, '').includes('src="icons/isams.webp"'));
});

test('renderSections renders a web link as an anchor card', () => {
  const out = renderSections(sectionContent(), { code: 'ko' }, '');
  assert.ok(out.includes('<a href="https://isams.example/" class="app-card web-card" target="_blank"'));
  assert.ok(out.includes('iSAMS 학부모 포털'));
});

test('renderSections bakes the store URLs into hrefs', () => {
  const out = renderSections(sectionContent(), { code: 'ko' }, '');
  assert.ok(out.includes('href="https://apps.apple.com/app/id1492422874"'));
  assert.ok(out.includes('&amp;hl=ko"'));
});

test('renderSections never emits openAppStore or data-i18n', () => {
  const out = renderSections(sectionContent(), { code: 'ko' }, '');
  assert.ok(!out.includes('openAppStore'));
  assert.ok(!out.includes('data-i18n'));
});

test('renderSections honours iconFit, defaulting to contain', () => {
  const out = renderSections(sectionContent(), { code: 'ko' }, '');
  assert.ok(out.includes('object-fit: cover'));
  assert.ok(out.includes('object-fit: contain'));
});

test('renderSections uses the localized section title', () => {
  assert.ok(renderSections(sectionContent(), { code: 'ko' }, '').includes('학교 포털 및 자료'));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test build.test.js`
Expected: FAIL — `renderSections is not a function`

- [ ] **Step 3: 구현**

```js
function renderIcon(link, name, base) {
  const fit = link.iconFit || 'contain';
  return [
    `                            <div class="app-icon">`,
    `                                <img src="${base}icons/${link.iconFile}" alt="${escapeAttr(name)}" style="width: 100%; height: 100%; border-radius: 15px; object-fit: ${fit};">`,
    `                            </div>`
  ].join('\n');
}

function renderCard(content, lang, link, sectionId, base) {
  const t = content.i18n[lang.code];
  const info = t.links[link.id];
  const ui = t.uiLabels || {};
  const inner = [
    `                        <div class="app-left">`,
    renderIcon(link, info.name, base),
    `                            <div class="app-info">`,
    `                                <div class="app-title">${escapeHtml(info.name)}</div>`,
    `                                <div class="app-description">${escapeHtml(info.desc)}</div>`,
    `                            </div>`,
    `                        </div>`
  ].join('\n');

  if (link.type === 'web') {
    const track = `trackLinkClick('${escapeAttr(info.name).replace(/'/g, "\\'")}', '${link.url}', '${sectionId}')`;
    return [
      `                    <a href="${escapeAttr(link.url)}" class="app-card web-card" target="_blank" onclick="${escapeAttr(track)}">`,
      inner,
      `                    </a>`
    ].join('\n');
  }

  const buttons = [];
  if (link.ios) {
    const u = iosUrl(link);
    buttons.push(`                            <a href="${u}" class="app-button" target="_blank" onclick="${escapeAttr(`trackLinkClick('${info.name} iOS', '${u}', 'App Store')`)}">${escapeHtml(ui.ios || '📱 iOS')}</a>`);
  }
  if (link.android) {
    const u = androidUrl(link, lang.code, content.appStore);
    buttons.push(`                            <a href="${escapeAttr(u)}" class="app-button" target="_blank" onclick="${escapeAttr(`trackLinkClick('${info.name} Android', '${u}', 'App Store')`)}">${escapeHtml(ui.android || '🤖 Android')}</a>`);
  }

  return [
    `                    <div class="app-card">`,
    inner,
    `                        <div class="app-buttons">`,
    buttons.join('\n'),
    `                        </div>`,
    `                    </div>`
  ].join('\n');
}

function renderSections(content, lang, base) {
  const t = content.i18n[lang.code];
  return content.sections.map(section => [
    `            <div class="section">`,
    `                <h2 class="section-title">`,
    `                    <span class="section-icon">${section.icon}</span>`,
    `                    <span>${escapeHtml(t.sections[section.id])}</span>`,
    `                </h2>`,
    `                <div class="app-links">`,
    section.links.map(l => renderCard(content, lang, l, section.id, base)).join('\n'),
    `                </div>`,
    `            </div>`
  ].join('\n')).join('\n\n');
}
```

`module.exports`에 `renderSections`, `renderCard` 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test build.test.js`
Expected: PASS — 28 tests

- [ ] **Step 5: 커밋**

```bash
git add build.js build.test.js
git commit -m "feat: 링크 카드/섹션 렌더러 (store URL 빌드 시점 확정)"
```

---

### Task 6: 언어 스위처, 가이드, FAQ 렌더러

**Files:**
- Modify: `build.js`
- Test: `build.test.js`

**Interfaces:**
- Consumes: `baseFor`, `escapeHtml`
- Produces: `renderLangSwitcher(content, lang, base)`, `renderGuide(content, lang)`, `renderFaq(content, lang)`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
const { renderLangSwitcher, renderGuide, renderFaq } = require('./build.js');

const SWITCH_CONTENT = {
  languages: [
    { code: 'en', path: '', hreflang: 'en', label: 'EN' },
    { code: 'ko', path: 'ko/', hreflang: 'ko', label: '한' },
    { code: 'zh-CN', path: 'zh-cn/', hreflang: 'zh-CN', label: '中简' }
  ]
};

test('renderLangSwitcher emits anchors, never switchLanguage calls', () => {
  const out = renderLangSwitcher(SWITCH_CONTENT, SWITCH_CONTENT.languages[1], '../');
  assert.ok(!out.includes('switchLanguage'));
  assert.ok(out.includes('<a href="../ko/"'));
  assert.ok(out.includes('hreflang="zh-CN"'));
});

test('renderLangSwitcher marks the current language active', () => {
  const out = renderLangSwitcher(SWITCH_CONTENT, SWITCH_CONTENT.languages[1], '../');
  assert.match(out, /class="lang-btn active"[^>]*hreflang="ko"/);
});

test('renderLangSwitcher links the English page at the base itself', () => {
  const out = renderLangSwitcher(SWITCH_CONTENT, SWITCH_CONTENT.languages[1], '../');
  assert.ok(out.includes('<a href="../"'));
});

test('renderGuide renders about, portals and checklist', () => {
  const c = { i18n: { ko: { guide: {
    aboutTitle: '학교 소개', aboutBody: ['첫 문단', '둘째 문단'],
    portalsTitle: '자주 쓰는 포털', portals: [{ name: 'iSAMS', desc: '성적 확인' }],
    checklistTitle: '체크리스트', checklist: ['계정 발급받기']
  }}}};
  const out = renderGuide(c, { code: 'ko' });
  assert.ok(out.includes('학교 소개'));
  assert.ok(out.includes('첫 문단'));
  assert.ok(out.includes('둘째 문단'));
  assert.ok(out.includes('iSAMS'));
  assert.ok(out.includes('계정 발급받기'));
});

test('renderFaq reuses the existing faq-item markup and toggleFaq handler', () => {
  const c = { i18n: { ko: { faqTitle: '자주 묻는 질문', faq: [{ q: '질문1', a: '답변1' }] } } };
  const out = renderFaq(c, { code: 'ko' });
  assert.ok(out.includes('class="faq-title"'));
  assert.ok(out.includes('class="faq-item"'));
  assert.ok(out.includes('onclick="toggleFaq(this)"'));
  assert.ok(out.includes('질문1'));
  assert.ok(out.includes('답변1'));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test build.test.js`
Expected: FAIL — `renderLangSwitcher is not a function`

- [ ] **Step 3: 구현**

```js
function renderLangSwitcher(content, lang, base) {
  return content.languages.map(l => {
    const cls = l.code === lang.code ? 'lang-btn active' : 'lang-btn';
    return `        <a href="${base}${l.path}" class="${cls}" hreflang="${l.hreflang}">${escapeHtml(l.label)}</a>`;
  }).join('\n');
}

function renderGuide(content, lang) {
  const g = content.i18n[lang.code].guide;
  const out = [`            <section class="parent-guide">`];

  out.push(`                <h2 class="guide-title">${escapeHtml(g.aboutTitle)}</h2>`);
  for (const p of g.aboutBody) out.push(`                <p class="guide-text">${escapeHtml(p)}</p>`);

  out.push(`                <h2 class="guide-title">${escapeHtml(g.portalsTitle)}</h2>`);
  out.push(`                <dl class="guide-portals">`);
  for (const p of g.portals) {
    out.push(`                    <dt>${escapeHtml(p.name)}</dt>`);
    out.push(`                    <dd>${escapeHtml(p.desc)}</dd>`);
  }
  out.push(`                </dl>`);

  out.push(`                <h2 class="guide-title">${escapeHtml(g.checklistTitle)}</h2>`);
  out.push(`                <ul class="guide-checklist">`);
  for (const item of g.checklist) out.push(`                    <li>${escapeHtml(item)}</li>`);
  out.push(`                </ul>`);

  out.push(`            </section>`);
  return out.join('\n');
}

function renderFaq(content, lang) {
  const t = content.i18n[lang.code];
  const items = t.faq.map(f => [
    `            <div class="faq-item">`,
    `                <button class="faq-question" onclick="toggleFaq(this)">${escapeHtml(f.q)}</button>`,
    `                <div class="faq-answer">${escapeHtml(f.a)}</div>`,
    `            </div>`
  ].join('\n')).join('\n\n');
  return `            <h2 class="faq-title">${escapeHtml(t.faqTitle)}</h2>\n\n${items}`;
}
```

`module.exports`에 세 함수 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test build.test.js`
Expected: PASS — 33 tests

- [ ] **Step 5: `.parent-guide` 스타일 추가**

`index.html`의 `<style>` 블록 끝(`</style>` 직전)에 추가한다. Task 9에서 `template.html`로 옮겨진다. 기존 색상 변수와 다크모드 규칙을 따를 것 — 주변 `.faq-item` 규칙을 읽고 같은 패턴을 쓴다.

```css
        .parent-guide { max-width: 800px; margin: 40px auto 0; padding: 0 20px; }
        .guide-title { font-size: 1.3rem; margin: 32px 0 12px; }
        .guide-text { line-height: 1.8; margin-bottom: 12px; opacity: 0.9; }
        .guide-portals dt { font-weight: 700; margin-top: 12px; }
        .guide-portals dd { margin: 4px 0 0 0; line-height: 1.7; opacity: 0.9; }
        .guide-checklist { padding-left: 20px; line-height: 1.9; opacity: 0.9; }
```

- [ ] **Step 6: 커밋**

```bash
git add build.js build.test.js index.html
git commit -m "feat: 언어 스위처/가이드/FAQ 렌더러와 가이드 스타일"
```

---

### Task 7: sitemap.xml 렌더러

**Files:**
- Modify: `build.js`
- Test: `build.test.js`

**Interfaces:**
- Consumes: `pageUrl`
- Produces: `renderSitemap(content, today)` → XML 문자열

- [ ] **Step 1: 실패하는 테스트 작성**

```js
const { renderSitemap } = require('./build.js');

const SITEMAP_CONTENT = {
  site: { baseUrl: 'https://soosoo.life/tenby-penang-links/' },
  languages: [
    { code: 'en', path: '', hreflang: 'en' },
    { code: 'ko', path: 'ko/', hreflang: 'ko' },
    { code: 'zh-CN', path: 'zh-cn/', hreflang: 'zh-CN' }
  ],
  extraUrls: [{ loc: 'qr-generator.html', changefreq: 'monthly', priority: '0.8' }]
};

test('renderSitemap lists every language URL', () => {
  const xml = renderSitemap(SITEMAP_CONTENT, '2026-08-26');
  assert.ok(xml.includes('<loc>https://soosoo.life/tenby-penang-links/</loc>'));
  assert.ok(xml.includes('<loc>https://soosoo.life/tenby-penang-links/ko/</loc>'));
  assert.ok(xml.includes('<loc>https://soosoo.life/tenby-penang-links/zh-cn/</loc>'));
});

test('renderSitemap adds xhtml alternates including x-default', () => {
  const xml = renderSitemap(SITEMAP_CONTENT, '2026-08-26');
  assert.ok(xml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));
  assert.ok(xml.includes('<xhtml:link rel="alternate" hreflang="ko" href="https://soosoo.life/tenby-penang-links/ko/"/>'));
  assert.ok(xml.includes('hreflang="x-default"'));
});

test('renderSitemap includes extra URLs without alternates', () => {
  const xml = renderSitemap(SITEMAP_CONTENT, '2026-08-26');
  assert.ok(xml.includes('<loc>https://soosoo.life/tenby-penang-links/qr-generator.html</loc>'));
});

test('renderSitemap stamps lastmod from the given date', () => {
  assert.ok(renderSitemap(SITEMAP_CONTENT, '2026-08-26').includes('<lastmod>2026-08-26</lastmod>'));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test build.test.js`
Expected: FAIL — `renderSitemap is not a function`

- [ ] **Step 3: 구현**

```js
function renderSitemap(content, today) {
  const alternates = content.languages
    .map(l => `    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${pageUrl(content.site, l)}"/>`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${content.site.baseUrl}"/>`)
    .join('\n');

  const entries = content.languages.map(l => [
    `  <url>`,
    `    <loc>${pageUrl(content.site, l)}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `    <changefreq>weekly</changefreq>`,
    `    <priority>${l.path === '' ? '1.0' : '0.9'}</priority>`,
    alternates,
    `  </url>`
  ].join('\n'));

  for (const extra of (content.extraUrls || [])) {
    entries.push([
      `  <url>`,
      `    <loc>${content.site.baseUrl}${extra.loc}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${extra.changefreq}</changefreq>`,
      `    <priority>${extra.priority}</priority>`,
      `  </url>`
    ].join('\n'));
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`,
    `        xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    entries.join('\n'),
    `</urlset>`,
    ``
  ].join('\n');
}
```

`content.json`의 `site` 옆에 `extraUrls`를 추가한다:

```json
"extraUrls": [{ "loc": "qr-generator.html", "changefreq": "monthly", "priority": "0.8" }]
```

`module.exports`에 `renderSitemap` 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test build.test.js`
Expected: PASS — 37 tests

- [ ] **Step 5: 커밋**

```bash
git add build.js build.test.js content.json
git commit -m "feat: hreflang alternate 포함 sitemap 생성기"
```

---

### Task 8: 페이지 조립과 파일 출력

**Files:**
- Modify: `build.js`
- Test: `build.test.js`

**Interfaces:**
- Consumes: 앞선 모든 렌더러
- Produces: `renderPage(content, lang, template)` → HTML 문자열, `build(dir, today)` → 생성 파일 경로 배열, `main()`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
const { renderPage } = require('./build.js');

const TEMPLATE = [
  '<!DOCTYPE html>',
  '<html lang="{{htmlLang}}">',
  '<head>',
  '{{head}}',
  '{{jsonld}}',
  '<link rel="icon" href="{{base}}favicon.svg">',
  '</head>',
  '<body>',
  '<div class="language-switcher">{{langSwitcher}}</div>',
  '<h1>{{h1}}</h1><p>{{subtitle}}</p>',
  '{{sections}}',
  '<a href="{{base}}qr-generator.html">{{qrgenLabel}}</a>',
  '{{guide}}',
  '{{faq}}',
  '<footer>{{disclaimer}}</footer>',
  '<script>gtag("config","{{gaId}}");</script>',
  '</body></html>'
].join('\n');

test('renderPage leaves no unreplaced tokens', () => {
  const c = fullFixture();          // Step 2에서 정의
  for (const lang of c.languages) {
    assert.ok(!renderPage(c, lang, TEMPLATE).includes('{{'), `unreplaced token in ${lang.code}`);
  }
});

test('renderPage sets html lang per language', () => {
  const c = fullFixture();
  assert.ok(renderPage(c, c.languages[0], TEMPLATE).startsWith('<!-- GENERATED FILE'));
  assert.match(renderPage(c, c.languages[1], TEMPLATE), /<html lang="ko">/);
  assert.match(renderPage(c, c.languages[2], TEMPLATE), /<html lang="zh-Hans">/);
});

test('renderPage resolves base to ../ inside language directories', () => {
  const c = fullFixture();
  assert.ok(renderPage(c, c.languages[1], TEMPLATE).includes('href="../qr-generator.html"'));
  assert.ok(renderPage(c, c.languages[0], TEMPLATE).includes('href="qr-generator.html"'));
});

test('renderPage carries the generated-file banner', () => {
  const c = fullFixture();
  assert.ok(renderPage(c, c.languages[0], TEMPLATE).includes('DO NOT EDIT'));
});
```

- [ ] **Step 2: 테스트 픽스처 추가**

`build.test.js` 상단에 넣는다. 앞선 픽스처들을 합친 것이다.

```js
function fullFixture() {
  return {
    site: {
      baseUrl: 'https://soosoo.life/tenby-penang-links/',
      gaId: 'G-TEST', officialUrl: 'https://www.tenby.edu.my/penang/',
      schoolNameEn: 'Tenby International School Penang',
      siteName: 'Tenby Parent Resources', ogImage: 'og-image.png'
    },
    languages: [
      { code: 'en', path: '', htmlLang: 'en', hreflang: 'en', ogLocale: 'en_US', label: 'EN' },
      { code: 'ko', path: 'ko/', htmlLang: 'ko', hreflang: 'ko', ogLocale: 'ko_KR', label: '한' },
      { code: 'zh-CN', path: 'zh-cn/', htmlLang: 'zh-Hans', hreflang: 'zh-CN', ogLocale: 'zh_CN', label: '中简' }
    ],
    appStore: { playLangParam: { en: 'en', ko: 'ko', 'zh-CN': 'zh-CN' } },
    sections: [{ id: 'portal', icon: '🏫', links: [
      { id: 'isams', type: 'web', url: 'https://isams.example/', iconFile: 'isams.webp' },
      { id: 'vircle', type: 'app', iconFile: 'vircle.webp',
        ios: { id: '1492422874' }, android: { pkg: 'dc.circlepay.customer' } }
    ]}],
    i18n: Object.fromEntries(['en', 'ko', 'zh-CN'].map(code => [code, {
      meta: { title: `T-${code}`, description: `D-${code}`, keywords: 'k', h1: `H-${code}`, subtitle: `S-${code}` },
      sections: { portal: `P-${code}` },
      links: { isams: { name: 'iSAMS', desc: 'd' }, vircle: { name: 'Vircle', desc: 'd' } },
      guide: { aboutTitle: 'a', aboutBody: ['b'], portalsTitle: 'p', portals: [{ name: 'n', desc: 'd' }],
               checklistTitle: 'c', checklist: ['i'] },
      faqTitle: 'F', faq: [{ q: 'q', a: 'a' }], disclaimer: 'disc',
      uiLabels: { ios: '📱 iOS', android: '🤖 Android', qrgen: 'QR' }
    }]))
  };
}
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `node --test build.test.js`
Expected: FAIL — `renderPage is not a function`

- [ ] **Step 4: 구현**

```js
const BANNER = '<!-- GENERATED FILE — DO NOT EDIT. Source: content.json + template.html. Run: node build.js -->';

function renderPage(content, lang, template) {
  const t = content.i18n[lang.code];
  const base = baseFor(lang);
  const tokens = {
    htmlLang: lang.htmlLang,
    head: renderHead(content, lang),
    jsonld: renderJsonLd(content, lang),
    base,
    h1: escapeHtml(t.meta.h1),
    subtitle: escapeHtml(t.meta.subtitle),
    langSwitcher: renderLangSwitcher(content, lang, base),
    sections: renderSections(content, lang, base),
    qrgenLabel: escapeHtml((t.uiLabels && t.uiLabels.qrgen) || 'QR Code Generator'),
    guide: renderGuide(content, lang),
    faq: renderFaq(content, lang),
    disclaimer: escapeHtml(t.disclaimer),
    gaId: content.site.gaId
  };

  const html = template.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    if (!(key in tokens)) throw new Error(`unknown template token: {{${key}}}`);
    return tokens[key];
  });

  return BANNER + '\n' + html;
}

function build(dir, today) {
  const content = loadContent(dir);
  validateContent(content);
  const template = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');
  const written = [];

  for (const lang of content.languages) {
    const outDir = path.join(dir, lang.path);
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, 'index.html');
    fs.writeFileSync(file, renderPage(content, lang, template));
    written.push(file);
  }

  const sitemap = path.join(dir, 'sitemap.xml');
  fs.writeFileSync(sitemap, renderSitemap(content, today));
  written.push(sitemap);
  return written;
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  for (const f of build(__dirname, today)) console.log('written:', path.relative(__dirname, f));
}

if (require.main === module) main();
```

`module.exports`에 `renderPage`, `build` 추가.

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test build.test.js`
Expected: PASS — 41 tests

- [ ] **Step 6: 커밋**

```bash
git add build.js build.test.js
git commit -m "feat: 페이지 조립과 언어별 파일 출력"
```

---

### Task 9: template.html 추출

**Files:**
- Create: `template.html`
- Read: `index.html` (원본, 아직 삭제하지 않는다)

**Interfaces:**
- Consumes: Task 8의 토큰 목록
- Produces: `template.html` — `{{htmlLang}} {{head}} {{jsonld}} {{base}} {{h1}} {{subtitle}} {{langSwitcher}} {{sections}} {{qrgenLabel}} {{guide}} {{faq}} {{disclaimer}} {{gaId}}` 만 사용

- [ ] **Step 1: 현재 index.html을 template.html로 복사**

```bash
cp index.html template.html
```

- [ ] **Step 2: `<head>` 정리**

`template.html`에서:
- `<html lang="en">` → `<html lang="{{htmlLang}}">`
- `<title>`부터 Twitter 메타 마지막 줄까지를 통째로 `{{head}}` 한 줄로 교체 (`<meta charset>`과 `<meta name="viewport">`는 남긴다)
- 기존 `<script type="application/ld+json">` 블록 2개를 삭제하고 그 자리에 `{{jsonld}}`
- `href="./favicon.svg"` 2곳 → `href="{{base}}favicon.svg"`
- gtag 스니펫의 `G-2P6F0R5CLH` 2곳 → `{{gaId}}`
- `<meta name="author">`, `<meta name="language">`, `<meta name="revisit-after">`는 삭제 (언어별 생성 대상이 아니고 SEO 가치 없음)

- [ ] **Step 3: 본문 슬롯화**

- `.language-switcher` 안의 `<button class="lang-btn" onclick="switchLanguage(...)">` 5줄 → `{{langSwitcher}}`. `theme-btn` 버튼은 그대로 둔다.
- `<h1>Tenby International School Penang</h1>` → `<h1>{{h1}}</h1>`
- `<p data-i18n="subtitle">…</p>` → `<p>{{subtitle}}</p>`
- `.links-container` 안의 `<div class="section">` 블록 5개 전체 → `{{sections}}`
- `.utility-tools`의 `href="qr-generator.html"` → `href="{{base}}qr-generator.html"`, 그 안 `<span data-i18n="link-qrgen">…</span>` → `<span>{{qrgenLabel}}</span>`
- FAQ 영역(`<h2 class="faq-title">`부터 마지막 `.faq-item`까지) → `{{faq}}`
- FAQ 바로 위에 `{{guide}}` 삽입
- 페이지 최하단에 푸터 추가:
  ```html
  <p class="site-disclaimer">{{disclaimer}}</p>
  ```

- [ ] **Step 4: 스크립트 정리**

`template.html`의 마지막 `<script>` 블록에서 아래를 **삭제**한다:

`translations`, `seoMetaTags`, `currentLanguage`, `switchLanguage()`, `updateSEOMetaTags()`, `detectBrowserLanguage()`, `appStoreLinks`, `openAppStore()`, 그리고 `DOMContentLoaded` 핸들러 안의 언어 복원 블록(`savedLang` / `defaultLang` / `langButton.click()`).

**남긴다:** `toggleFaq()`, `trackLinkClick()`, `toggleTheme()`, `getSystemTheme()`, 테마 인라인 스크립트, `DOMContentLoaded`의 테마 아이콘 동기화와 `matchMedia` 리스너.

- [ ] **Step 5: 남은 토큰과 잔재 확인**

```bash
grep -o '{{[a-zA-Z]*}}' template.html | sort -u
grep -c 'data-i18n\|switchLanguage\|openAppStore\|detectBrowserLanguage\|preferred-language' template.html
```

Expected: 첫 명령은 13개 토큰만 출력. 두 번째는 `0`.

- [ ] **Step 6: `.site-disclaimer` 스타일 추가**

`</style>` 직전:

```css
        .site-disclaimer { max-width: 800px; margin: 32px auto 24px; padding: 0 20px;
                           font-size: 0.85rem; opacity: 0.65; text-align: center; line-height: 1.6; }
```

- [ ] **Step 7: 커밋**

```bash
git add template.html
git commit -m "feat: index.html에서 공통 template.html 추출"
```

---

### Task 10: 기존 translations를 content.json으로 이관

기존 `index.html`의 `translations`에는 5개 언어 × 섹션명 × 링크 26개 이름/설명이 이미 들어 있다. 손으로 옮기지 말고 스크립트로 추출한다.

**Files:**
- Create: `tools/extract-translations.js`
- Modify: `content.json`
- Read: `index.html`

**Interfaces:**
- Consumes: `index.html`의 `translations`, `appStoreLinks`, 카드 마크업
- Produces: 완성된 `content.json`의 `sections`와 `i18n.*.{sections,links}`

- [ ] **Step 1: 추출 스크립트 작성**

`tools/extract-translations.js`:

```js
'use strict';
// 1회용 마이그레이션 스크립트. content.json 완성 후 삭제한다.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function sliceObject(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`marker not found: ${startMarker}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces after ${startMarker}`);
}

// eslint-disable-next-line no-eval
const translations = eval('(' + sliceObject(html, 'const translations =') + ')');
const appStoreLinks = eval('(' + sliceObject(html, 'const appStoreLinks =') + ')');

fs.writeFileSync(path.join(__dirname, 'translations.json'), JSON.stringify(translations, null, 2));
fs.writeFileSync(path.join(__dirname, 'appstore.json'), JSON.stringify(appStoreLinks, null, 2));
console.log('languages:', Object.keys(translations));
console.log('keys per language:', Object.keys(translations).map(k => `${k}=${Object.keys(translations[k]).length}`).join(' '));
console.log('ios app ids:', Object.keys(appStoreLinks).length);
```

- [ ] **Step 2: 스크립트 실행**

Run: `node tools/extract-translations.js`
Expected: `languages: [ 'en', 'ko', 'zh-CN', 'zh-TW', 'ja' ]`, 언어별 키 개수가 5개 언어에서 동일, `ios app ids: 14`

- [ ] **Step 3: 카드 인벤토리 만들기**

```bash
node -e '
const fs=require("fs"); const h=fs.readFileSync("index.html","utf8");
const re=/<div class="section">[\s\S]*?<span data-i18n="(section-[a-z]+)"[\s\S]*?<div class="app-links">([\s\S]*?)<\/div>\s*<\/div>/g;
let m,n=0;
while((m=re.exec(h))){
  console.log("\n##",m[1]);
  const cards=m[2].match(/data-i18n="(app|link)-[a-z0-9-]+"/g)||[];
  cards.forEach(c=>{n++;console.log("  ",c)});
}
console.log("\ntotal cards:",n);
'
```

이 출력이 `content.json`의 `sections` 순서와 링크 id 목록의 근거가 된다. **id는 `data-i18n` 값에서 `app-`/`link-` 접두를 뗀 것을 쓴다** (예: `link-portal` → `portal`, `app-vircle` → `vircle`). 이름 충돌이 나면 섹션 접두를 붙인다.

- [ ] **Step 4: content.json의 sections 채우기**

Step 3 출력 순서대로 섹션 5개(`portal`, `learning`, `creative`, `communication`, `info`)와 링크 26개를 채운다. 각 링크의 필드는 원본 `index.html`에서 가져온다:

- `type`: 마크업이 `<a class="app-card web-card">`면 `"web"`, `<div class="app-card">`면 `"app"`
- `url`: web 카드의 `href`
- `iconFile`: `src="icons/…"`의 파일명
- `iconFit`: 원본 `object-fit` 값이 `cover`면 `"cover"`, 아니면 생략
- `ios.id`: `tools/appstore.json`의 `<name>-ios` 항목 URL 끝 `id(\d+)`
- `android.pkg`: Play href의 `?id=` 값

- [ ] **Step 5: content.json의 i18n 채우기**

`tools/translations.json`의 각 언어에서:
- `section-portal` → `i18n.<lang>.sections.portal`
- `link-portal` / `link-portal-desc` → `i18n.<lang>.links.portal.{name,desc}`
- `app-vircle` / `app-vircle-desc` → `i18n.<lang>.links.vircle.{name,desc}`
- `faq-title` → `i18n.<lang>.faqTitle`
- `faq-q1`/`faq-a1` … → `i18n.<lang>.faq[]`
- `link-qrgen` → `i18n.<lang>.uiLabels.qrgen`

`meta`(title/description/keywords/h1/subtitle), `guide`, `disclaimer`는 Task 11–12에서 작성한다. 지금은 기존 `seoMetaTags` 값을 그대로 옮겨두고, `guide`는 빈 구조로 둔다.

- [ ] **Step 6: 검증**

Run: `node -e "const b=require('./build.js'); b.validateContent(b.loadContent('.')); console.log('ok')"`
Expected: `ok` — 26개 링크 × 5개 언어가 전부 채워졌다는 뜻이다. 누락이 있으면 정확한 경로가 에러로 출력된다.

- [ ] **Step 7: 임시 파일 정리 및 커밋**

```bash
rm -rf tools
git add content.json
git commit -m "feat: 기존 translations를 content.json으로 이관 (5개 언어 26개 링크)"
```

---

### Task 11: 영어·한국어 메타와 가이드 작성

**Files:**
- Modify: `content.json`

- [ ] **Step 1: 한국어 meta 확정값 입력**

```json
"meta": {
  "title": "텐비 국제학교 페낭 학부모 링크 모음 | 말레이시아 페낭 국제학교 포털",
  "description": "텐비 국제학교 페낭(Tenby International School Penang) 학부모를 위한 iSAMS 학부모 포털, SchoolsBuddy, Vircle, ClassDojo, 학습 앱, 학교 정보 링크 모음입니다.",
  "keywords": "텐비 국제학교, 텐비 국제학교 페낭, 텐비 페낭, 페낭 국제학교, 말레이시아 국제학교, 국제학교 학부모 포털, iSAMS 학부모 포털, SchoolsBuddy, Vircle",
  "h1": "텐비 국제학교 페낭 학부모 링크 모음",
  "subtitle": "학부모 자료 및 바로가기"
}
```

- [ ] **Step 2: 한국어 guide 작성**

```json
"guide": {
  "aboutTitle": "텐비 국제학교 페낭 안내",
  "aboutBody": [
    "텐비 국제학교 페낭 학부모를 위한 주요 링크 모음입니다. iSAMS Parent Portal, SchoolsBuddy, Vircle, ClassDojo, Learning Village 등 말레이시아 국제학교 생활에서 자주 쓰는 서비스를 한곳에 정리했습니다.",
    "학교 공식 정보와 학사 일정은 학교 홈페이지를 확인하시고, 이 페이지는 매일 쓰는 포털과 학습 앱에 빠르게 접근하는 용도로 사용하세요."
  ],
  "portalsTitle": "학부모가 자주 쓰는 온라인 포털",
  "portals": [
    { "name": "iSAMS 학부모 포털", "desc": "성적, 출결, 학교 공지를 확인하는 기본 포털입니다. 학년 초에 학교에서 받은 계정으로 로그인합니다." },
    { "name": "SchoolsBuddy", "desc": "방과후 활동(ECA), 클럽, 학교 행사 신청과 일정 확인에 사용합니다." },
    { "name": "Vircle", "desc": "학생 카드 충전, 교복 구매, 스쿨 스토어 결제에 사용하는 앱입니다." },
    { "name": "ClassDojo", "desc": "담임 교사와의 소통, 학급 공지, 사진 공유에 사용합니다." }
  ],
  "checklistTitle": "처음 오신 학부모를 위한 체크리스트",
  "checklist": [
    "iSAMS 학부모 포털 계정을 발급받고 로그인 확인",
    "SchoolsBuddy 계정으로 방과후 활동 신청 일정 확인",
    "Vircle 앱 설치 후 학생 카드 충전 설정",
    "ClassDojo에서 담임 교사 연결",
    "학년에 맞는 학습 앱 설치 (Early Years·KS1은 1-Minute Maths, Raz Kids, Purple Mash, Epic)",
    "Microsoft Teams 로그인 확인"
  ]
}
```

- [ ] **Step 2b: 한국어 FAQ에 표기 변형 문장 1회 추가**

기존 FAQ 배열 끝에 항목을 추가한다. **오타 변형 `인터네셔널`은 쓰지 않는다.**

```json
{
  "q": "학교 이름 표기가 여러 가지인데 같은 학교인가요?",
  "a": "네, 같은 학교입니다. 텐비 국제학교 페낭은 '텐비 인터내셔널 스쿨 페낭'으로도 불리며, 영문 정식 명칭은 Tenby International School Penang입니다. 페낭 지역 학부모 사이에서는 '텐비 페낭'으로 줄여 부르기도 합니다."
}
```

- [ ] **Step 3: 한국어 disclaimer 작성**

```json
"disclaimer": "이 페이지는 학부모가 만든 비공식 링크 모음입니다. 학교 공식 정보는 https://www.tenby.edu.my/penang/ 에서 확인하세요."
```

- [ ] **Step 4: 영어 meta / guide / disclaimer 작성**

한국어와 같은 구조로 영어판을 작성한다. 축은 `Tenby International School Penang`, `parent portal`, `learning apps`.

```json
"meta": {
  "title": "Tenby International School Penang | Parent Portal & Learning Apps Hub",
  "description": "Quick access for Tenby International School Penang parents: iSAMS parent portal, SchoolsBuddy, Vircle, ClassDojo, learning apps and school information links.",
  "keywords": "Tenby International School Penang, Tenby Penang parent portal, iSAMS Tenby Penang, SchoolsBuddy, Vircle, ClassDojo, international school Penang, international school Malaysia",
  "h1": "Tenby International School Penang",
  "subtitle": "Parent Resources & Quick Links"
},
"disclaimer": "This is an unofficial link hub maintained by parents. For official school information, visit https://www.tenby.edu.my/penang/"
```

`guide`는 한국어판과 같은 4개 포털 설명 + 6개 체크리스트 항목을 영어로 작성한다.

- [ ] **Step 5: 검증**

Run: `node -e "const b=require('./build.js'); const c=b.loadContent('.'); for(const l of ['en','ko']){const m=c.i18n[l].meta; if(!m.h1||!m.title) throw new Error(l); } console.log('ok')"`
Expected: `ok`

- [ ] **Step 6: 커밋**

```bash
git add content.json
git commit -m "feat: 영어·한국어 메타와 학부모 가이드 작성 (국제학교 키워드 중심)"
```

---

### Task 12: 일본어·중국어 간체·번체 콘텐츠 작성

**Files:**
- Modify: `content.json`

번역이 아니라 각 언어권 학부모의 검색 표현으로 새로 쓴다. 분량은 한국어보다 짧아도 된다.

- [ ] **Step 1: 일본어**

축: `ペナン インターナショナルスクール`, `Tenby Penang`, `保護者ポータル`, `マレーシア インターナショナルスクール`

```json
"meta": {
  "title": "テンビー ペナン 保護者リンク集 | マレーシア インターナショナルスクール",
  "description": "ペナンのインターナショナルスクール、Tenby International School Penang の保護者向けリンク集です。iSAMS 保護者ポータル、SchoolsBuddy、Vircle、ClassDojo、学習アプリをまとめています。",
  "keywords": "ペナン インターナショナルスクール, テンビー ペナン, Tenby Penang, マレーシア インターナショナルスクール, 保護者ポータル, iSAMS",
  "h1": "テンビー ペナン 保護者リンク集",
  "subtitle": "保護者向けリソースとクイックリンク"
}
```

`guide`(about 2문단, portals 4개, checklist 6개)와 `disclaimer`를 같은 축으로 작성한다.

- [ ] **Step 2: 중국어 간체**

축: `槟城国际学校`, `Tenby Penang`, `家长门户`, `马来西亚国际学校`

```json
"meta": {
  "title": "Tenby 槟城国际学校家长链接汇总 | 马来西亚国际学校家长门户",
  "description": "槟城国际学校 Tenby International School Penang 家长常用链接汇总：iSAMS 家长门户、SchoolsBuddy、Vircle、ClassDojo 及各类学习应用。",
  "keywords": "槟城国际学校, Tenby Penang, 马来西亚国际学校, 家长门户, iSAMS 家长门户, SchoolsBuddy, Vircle",
  "h1": "Tenby 槟城国际学校家长链接汇总",
  "subtitle": "家长资源与快捷链接"
}
```

- [ ] **Step 3: 중국어 번체**

축: `檳城國際學校`, `Tenby Penang`, `家長入口`, `馬來西亞國際學校`. 간체를 기계 변환하지 말고 번체 어휘로 쓴다 (`家长门户` → `家長入口`, `应用` → `應用程式`, `汇总` → `彙整`).

```json
"meta": {
  "title": "Tenby 檳城國際學校家長連結彙整 | 馬來西亞國際學校家長入口",
  "description": "檳城國際學校 Tenby International School Penang 家長常用連結彙整：iSAMS 家長入口、SchoolsBuddy、Vircle、ClassDojo 及各類學習應用程式。",
  "keywords": "檳城國際學校, Tenby Penang, 馬來西亞國際學校, 家長入口, iSAMS 家長入口, SchoolsBuddy, Vircle",
  "h1": "Tenby 檳城國際學校家長連結彙整",
  "subtitle": "家長資源與快速連結"
}
```

- [ ] **Step 4: 세 언어의 guide / disclaimer / uiLabels 완성**

각각 `aboutBody` 2문단, `portals` 4개(iSAMS / SchoolsBuddy / Vircle / ClassDojo), `checklist` 6개, `disclaimer` 1문장. 한국어판 항목 구성과 1:1로 맞춘다.

- [ ] **Step 5: 전 언어 완성도 검증**

```bash
node -e '
const b=require("./build.js"); const c=b.loadContent(".");
b.validateContent(c);
for(const l of c.languages){
  const t=c.i18n[l.code];
  for(const k of ["title","description","keywords","h1","subtitle"]) if(!t.meta[k]) throw new Error(`${l.code}.meta.${k}`);
  if(!t.guide.aboutBody.length||!t.guide.portals.length||!t.guide.checklist.length) throw new Error(`${l.code}.guide`);
  if(!t.faq.length) throw new Error(`${l.code}.faq`);
  if(!t.disclaimer) throw new Error(`${l.code}.disclaimer`);
}
console.log("all 5 languages complete");
'
```
Expected: `all 5 languages complete`

- [ ] **Step 6: 커밋**

```bash
git add content.json
git commit -m "feat: 일본어/중국어 간체/번체 콘텐츠 작성 (현지 검색 표현 기준)"
```

---

### Task 13: Vircle 아이콘 로컬화

**Files:**
- Create: `icons/vircle.webp`
- Modify: `content.json`

- [ ] **Step 1: 현재 핫링크 URL 확인**

Run: `grep -o 'https://play-lh[^"]*' index.html`
Expected: `https://play-lh.googleusercontent.com/6gAZ…` 1건

- [ ] **Step 2: 내려받아 webp로 저장**

```bash
curl -sL "$(grep -o 'https://play-lh[^"]*' index.html)" -o /tmp/vircle-src
file /tmp/vircle-src
```

`file` 출력이 PNG/JPEG면 webp로 변환한다. `cwebp`가 있으면 `cwebp /tmp/vircle-src -o icons/vircle.webp`, 없으면 `sips -s format png` 후 확장자를 실제 포맷에 맞춘다. **`.webp` 확장자를 붙이면서 내용이 PNG인 상태로 두지 말 것** — 확장자와 실제 포맷을 일치시킨다.

- [ ] **Step 3: 파일 확인**

```bash
ls -la icons/vircle.webp && file icons/vircle.webp
```
Expected: 파일 존재, 포맷이 확장자와 일치

- [ ] **Step 4: content.json 확인**

`vircle` 링크가 `"iconFile": "vircle.webp"`, `"iconFit": "cover"`인지 확인한다 (Task 10 Step 4에서 이미 설정됐어야 한다).

- [ ] **Step 5: 커밋**

```bash
git add icons/vircle.webp content.json
git commit -m "fix: Vircle 아이콘 핫링크를 로컬 파일로 교체"
```

---

### Task 14: 전체 빌드, 검증, 기존 index.html 대체

**Files:**
- Modify: `index.html` (생성물로 대체)
- Create: `ko/index.html`, `ja/index.html`, `zh-cn/index.html`, `zh-tw/index.html`
- Modify: `sitemap.xml`
- Create: `verify.sh`

- [ ] **Step 1: 원본 백업 후 빌드**

```bash
cp index.html /tmp/index.html.bak
node build.js
```
Expected: `written:` 6줄 (index.html, ko/, ja/, zh-cn/, zh-tw/, sitemap.xml)

- [ ] **Step 2: 검증 스크립트 작성**

`verify.sh`:

```bash
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
```

- [ ] **Step 3: 검증 실행**

```bash
chmod +x verify.sh && ./verify.sh
```
Expected: 모든 줄이 `ok`, 종료 코드 0. 실패하면 해당 항목을 고치고 `node build.js && ./verify.sh` 재실행.

- [ ] **Step 4: 단위 테스트 재확인**

Run: `node --test build.test.js`
Expected: PASS — 41 tests

- [ ] **Step 5: 로컬 서버로 육안 확인**

```bash
python3 -m http.server 8765 &
```

`http://localhost:8765/`와 `http://localhost:8765/ko/`를 열어 확인한다:
- 첫 화면이 기존 링크 허브 그대로인지 (카드 26개, 섹션 5개, 아이콘 전부 표시)
- 언어 버튼이 실제 URL 이동을 하는지, 현재 언어가 active인지
- 다크모드 토글과 FAQ 아코디언 동작
- 하단 가이드가 카드 아래에 있고 첫 화면을 밀어내지 않는지
- 앱 카드의 iOS/Android 버튼이 새 탭으로 열리는지

확인 후 `kill %1`.

- [ ] **Step 6: 원본과 카드 개수 비교**

```bash
echo "before: $(grep -c 'class="app-card' /tmp/index.html.bak)"
echo "after : $(grep -c 'class="app-card' index.html)"
```
Expected: 두 값이 26으로 동일

- [ ] **Step 7: README에 빌드 방법 기록**

```markdown
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
```

- [ ] **Step 8: 커밋**

```bash
git add index.html ko ja zh-cn zh-tw sitemap.xml verify.sh README.md
git commit -m "feat: 5개 언어 정적 페이지 빌드 결과 반영"
```

- [ ] **Step 9: 배포 후 확인 항목 기록**

푸시 후 실제 사이트에서 확인한다. 실패 시 별도 이슈로 처리한다.

```bash
for p in "" ko/ ja/ zh-cn/ zh-tw/; do
  curl -s -o /dev/null -w "%{http_code} %{url_effective}\n" -L "https://soosoo.life/tenby-penang-links/$p"
done
```
Expected: 전부 `200`. `/ko/`가 `/ko/index.html`로 서빙되는지(GitHub Pages 기본 동작) 여기서 확정된다.

이후 Google Search Console에서 5개 URL 색인 요청 + 국제 타겟팅 보고서로 hreflang 오류를 확인한다.

---

## 완료 기준

- `node build.js` 한 번으로 5개 `index.html` + `sitemap.xml`이 재생성된다
- `node --test build.test.js` 41개 통과
- `./verify.sh` 전 항목 통과
- `content.json`만 고쳐도 5개 언어에 반영되고, `template.html`만 고쳐도 5개 언어 디자인이 바뀐다
- 첫 화면 링크 허브 UX(카드 26개·섹션 5개·다크모드·FAQ)가 변경 전과 동일하다
