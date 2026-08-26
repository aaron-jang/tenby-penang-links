# 다국어 정적 페이지 빌드 구조 설계

- 작성일: 2026-08-26
- 대상: `soosoo.life/tenby-penang-links/`
- 상태: 승인됨 (구현 계획 작성 대기)

## 1. 배경

현재 사이트는 `index.html` 한 파일에서 JS로 5개 언어를 전환한다.

- `translations` (index.html:1200-1606) — en / ko / zh-CN / zh-TW / ja 문구 전체
- `seoMetaTags` (index.html:1616-1643) — 언어별 title/description
- `switchLanguage()` — `data-i18n` 속성 치환
- `DOMContentLoaded` 핸들러 (index.html:1874-1883) — 브라우저 언어 감지 후 자동 전환

이 구조의 문제:

1. **URL이 하나뿐이라 언어별 색인이 불가능하다.** Googlebot이 보는 것은 영어 초기 HTML 하나이고, 한국어/일본어/중국어 본문은 크롤러 입장에서 존재하지 않는다. 5개 언어 번역을 이미 다 가지고 있는데 검색 유입은 영어 쿼리로만 발생한다.
2. **앱스토어 링크에 실동작 버그가 있다.** `appStoreLinks`(index.html:1697-1784)의 키는 `en/ko/zh/ja`인데 `currentLanguage`는 `en/ko/zh-CN/zh-TW/ja`다. `appStoreLinks[id]['zh-CN']`은 항상 `undefined`이므로 `|| ['en']`로 폴백한다. 즉 **중국어 사용자는 한 번도 `/cn/` 스토어프론트를 받은 적이 없다.** 번체(zh-TW)는 구분 자체가 없다.
3. **국가별 스토어프론트 정책이 역효과를 낸다.** 페낭 거주 학부모의 Apple 계정은 대개 MY인데, 한국어 페이지라는 이유로 `/kr/`로 보내면 "사용 중인 국가/지역의 스토어에서 이용할 수 없습니다"가 뜬다.
4. **Android 링크에 언어 파라미터가 전혀 없다.** 14개 Play 링크 모두 `?hl=` 없이 기본 영어로 열린다.

## 2. 목표 / 비목표

### 목표
- 언어별 정적 URL 5개 생성 (실제 `index.html` 파일, SPA 방식 금지)
- 언어별 title / meta / H1 / OG / Twitter / JSON-LD 생성
- canonical(self) + hreflang(6) + sitemap 정리
- 하단에 학부모 가이드 + FAQ 추가 (첫 화면 링크 허브 UX는 불변)
- 모든 언어 문구를 `content.json` 한 곳에서 관리
- 디자인 변경은 `template.html` 한 곳에서 전 언어 반영

### 비목표
- `qr-generator.html` 다국어 정적화 (후속 과제. sitemap에는 현행대로 단일 URL 유지)
- `danang.html` (무관한 개인 페이지. sitemap 제외 현행 유지)
- 디자인/레이아웃 변경. 카드 UX·색상·다크모드 동작은 그대로
- 언어 자동 강제 리다이렉트 (명시적 금지)

## 3. 확정된 결정 사항

| 항목 | 결정 |
|---|---|
| 배포 | GitHub Pages + 빌드 결과물 git 커밋 |
| content.json 스키마 | 구조(1벌) / 문구(언어별) 분리 |
| qr-generator.html | 이번 범위 제외 |
| 언어 자동감지·localStorage 기억 | 완전 제거 |
| 한국어 표기 | "국제학교" 중심, 영문 정식명 병기, "인터내셔널 스쿨"은 FAQ 1회 |
| iOS 링크 | 국가 세그먼트 없는 URL (Apple 지오/계정 자동 리다이렉트), `?l=` 미사용 |
| Android 링크 | `&hl=<lang>` 언어별 부착 |

### iOS/Android 링크 정책 근거 (실측)

```
https://apps.apple.com/app/id552602056      -> 301 -> /us/app/classdojo/id552602056
/my/app/classdojo/id552602056               -> <html lang="en-GB">
/my/app/classdojo/id552602056?l=ko          -> <html lang="en-GB">   # 무시됨
/kr/app/classdojo/id552602056               -> <html lang="ko">
/jp/app/classdojo/id552602056               -> <html lang="ja">
play.google.com/...?id=com.classdojo.android&hl=ko    -> <html lang="ko">
play.google.com/...&hl=ja                             -> <html lang="ja">
play.google.com/...&hl=zh-TW                          -> <html lang="zh-TW">
```

- 국가 세그먼트 없는 App Store URL은 지오IP 기준 301. iOS 기기에서는 App Store 앱이 열리며 **Apple 계정의 스토어프론트**를 사용한다 — 페이지 언어가 아니라 사용자 실제 국가를 따르므로 위 3번 문제가 사라진다.
- `?l=`은 MY 스토어프론트에서 무시되고, 자국 스토어로 리다이렉트되면 이미 자국어로 표시되므로 도움 되는 경우가 없다. **미사용.**
- Play의 `hl`은 스토어프론트와 무관하게 동작하므로 **언어별로 부착한다.**
- 트레이드오프: 지오IP 기반이라 도착 스토어를 제어·미리보기할 수 없고 VPN 사용자는 VPN 국가로 간다. 수용한다.

## 4. 파일 구조

```
tenby-penang-links/
  content.json          # 구조 1벌 + 언어별 문구 5벌
  template.html         # 공통 껍데기 (head 슬롯, 인라인 CSS, 헤더/푸터, JS)
  build.js              # 의존성 0. `node build.js` 하나로 전부 생성
  index.html            ┐
  ko/index.html         │
  ja/index.html         │ 생성물 (GENERATED 배너, 손수정 금지)
  zh-cn/index.html      │
  zh-tw/index.html      │
  sitemap.xml           ┘
  icons/ favicon.svg og-image.png robots.txt qr-generator.html danang.html   # 불변
```

CSS 약 530줄은 현행대로 **인라인 유지**한다. 외부 `styles.css`로 분리하면 요청이 하나 늘고 LCP만 손해인데, 원본이 `template.html` 한 곳이라 유지보수 문제는 이미 해결된다.

## 5. content.json 스키마

```jsonc
{
  "site": {
    "baseUrl": "https://soosoo.life/tenby-penang-links/",
    "gaId": "G-2P6F0R5CLH",
    "officialUrl": "https://www.tenby.edu.my/penang/",
    "schoolNameEn": "Tenby International School Penang",
    "ogImage": "og-image.png"
  },

  "languages": [
    { "code": "en",    "path": "",        "htmlLang": "en",      "hreflang": "en",    "ogLocale": "en_US", "label": "EN"  },
    { "code": "ko",    "path": "ko/",     "htmlLang": "ko",      "hreflang": "ko",    "ogLocale": "ko_KR", "label": "한"  },
    { "code": "ja",    "path": "ja/",     "htmlLang": "ja",      "hreflang": "ja",    "ogLocale": "ja_JP", "label": "日"  },
    { "code": "zh-CN", "path": "zh-cn/",  "htmlLang": "zh-Hans", "hreflang": "zh-CN", "ogLocale": "zh_CN", "label": "中简" },
    { "code": "zh-TW", "path": "zh-tw/",  "htmlLang": "zh-Hant", "hreflang": "zh-TW", "ogLocale": "zh_TW", "label": "中繁" }
  ],

  "appStore": {
    "playLangParam": { "en": "en", "ko": "ko", "ja": "ja", "zh-CN": "zh-CN", "zh-TW": "zh-TW" }
  },

  // ---- 구조: 언어 무관, 1벌만 ----
  "sections": [
    {
      "id": "portal",
      "icon": "🏫",
      "links": [
        { "id": "isams",  "type": "web", "url": "https://tenbypenang.parents.isamshosting.cloud/",
          "iconFile": "isams.webp" },
        { "id": "vircle", "type": "app", "iconFile": "vircle.webp",   // 아래 아이콘 규칙 참조
          "ios":     { "id": "1492422874" },
          "android": { "pkg": "dc.circlepay.customer" } }
      ]
    }
  ],

  // ---- 문구: 언어별 5벌 ----
  "i18n": {
    "ko": {
      "meta": {
        "title": "…", "description": "…", "keywords": "…",
        "h1": "…", "subtitle": "…"
      },
      "sections": { "portal": "학교 포털 및 자료" },
      "links": { "isams": { "name": "iSAMS 학부모 포털", "desc": "성적·출결·공지 확인" } },
      "guide": {
        "aboutTitle": "…", "aboutBody": ["문단1", "문단2"],
        "portalsTitle": "…", "portals": [ { "name": "iSAMS", "desc": "…" } ],
        "checklistTitle": "…", "checklist": ["항목1", "항목2"]
      },
      "faqTitle": "…",
      "faq": [ { "q": "…", "a": "…" } ],
      "disclaimer": "…",
      "uiLabels": { "ios": "📱 iOS", "android": "🤖 Android", "web": "🌐 웹" }
    }
  }
}
```

### 스키마 원칙
- 링크의 URL·아이콘·앱 ID·카드 순서·섹션 구성은 `sections`에만 존재한다. 언어별로 반복하지 않는다.
- 링크 추가 = `sections`에 1개 항목 + 각 언어 `i18n.<lang>.links.<id>`에 이름/설명.
- 앱 하나당 관리 값은 **iOS 숫자 ID와 Android 패키지명 두 개뿐**이다. 기존 56줄 하드코딩 URL 맵은 제거된다.
- `i18n.<lang>.links`에 `sections`의 링크 id가 누락되면 **빌드를 실패시킨다** (조용한 영어 폴백 금지).

### 아이콘 규칙
현재 카드 26개 중 25개는 로컬 `icons/*.webp`를 쓰고, Vircle 1개만 `play-lh.googleusercontent.com`을 핫링크한다(index.html:768). 핫링크는 외부 요청이 추가되고 언제든 깨질 수 있으므로 **해당 이미지를 `icons/vircle.webp`로 내려받아 로컬화한다.** 스키마는 `iconFile`(로컬, `icons/` 기준 파일명) 하나로 통일하고 원격 URL 필드는 두지 않는다.

## 6. template.html 슬롯

`{{token}}` 치환 방식. 반복 블록(섹션/카드/가이드/FAQ/JSON-LD)은 build.js가 문자열로 조립해 슬롯에 주입한다. 별도 템플릿 엔진을 쓰지 않는다.

| 슬롯 | 내용 |
|---|---|
| `{{htmlLang}}` | `<html lang="…">` |
| `{{head}}` | title/description/keywords/canonical/hreflang/OG/Twitter 전체 |
| `{{jsonld}}` | JSON-LD `<script>` 블록들 |
| `{{base}}` | 루트 `""`, 언어 하위 `"../"` |
| `{{h1}}` `{{subtitle}}` | 헤더 문구 |
| `{{langSwitcher}}` | `<a>` 기반 언어 전환 |
| `{{sections}}` | 링크 카드 전체 |
| `{{guide}}` | 하단 학부모 가이드 |
| `{{faq}}` | FAQ 아코디언 |
| `{{disclaimer}}` | 비공식 고지 푸터 |
| `{{gaId}}` | GA4 측정 ID |

### 상대 경로 처리
현재 아이콘 참조 28곳이 `src="icons/isams.webp"` 형태(루트 상대 아님)라 `/ko/`에서 전부 404가 난다. `favicon.svg` 2곳, `qr-generator.html` 링크 1곳도 동일하다.

→ 템플릿의 모든 내부 자원 참조에 `{{base}}`를 붙인다: `src="{{base}}icons/isams.webp"`, `href="{{base}}qr-generator.html"`.

`/tenby-penang-links/` 절대경로로 박지 않는다 — 로컬 미리보기(`python3 -m http.server`)가 깨지기 때문이다.

## 7. build.js 동작

Node 내장 모듈만 사용 (`fs`, `path`). `package.json` 불필요. 실행: `node build.js`.

### 7.1 URL 조립
```
web      : link.url 그대로
ios      : https://apps.apple.com/app/id{ios.id}
android  : https://play.google.com/store/apps/details?id={android.pkg}&hl={playLangParam[lang]}
```

### 7.2 head 생성 (언어별)
- `<title>`, `<meta name="description">`, `<meta name="keywords">`
- `<link rel="canonical" href="{baseUrl}{path}">` — 자기 자신, 트레일링 슬래시 포함
- hreflang 6줄 (5언어 self 포함 + x-default → 루트). 전 페이지에 동일 세트를 넣어 상호 참조를 성립시킨다.
- `og:title/description/image/url/type/site_name/locale` + `og:locale:alternate` 4개 (zh_TW 포함 — 현재 누락되어 있음)
- `twitter:card/title/description/image`. **`twitter:site="@tenbypenang"`은 제거한다** (계정 소유 미확인. 카드 귀속이 학교로 가는 것을 피한다.)
- OG/Twitter 이미지와 canonical은 `site.baseUrl` 기반 절대 URL

`<html lang>`은 `zh-Hans`/`zh-Hant`(W3C 권장 스크립트 서브태그), hreflang은 `zh-CN`/`zh-TW`(지역 타겟팅)를 쓴다. 의도된 불일치이며 둘 다 유효하다.

### 7.3 JSON-LD
- `WebPage` — `@id`, `url`, `name`, `description`, `inLanguage`, `isPartOf`(WebSite), `about` → `{"@type":"School","name": schoolNameEn, "sameAs": officialUrl}`
- `ItemList` — 링크 카드 전체 (position, name, url)
- `FAQPage` — `i18n.<lang>.faq`
- `BreadcrumbList` — 루트 → 현재 언어 페이지 (2단계). **영어 루트 페이지에서는 생략한다** (1개짜리 breadcrumb은 의미가 없다.)

**학교를 페이지의 주체(`EducationalOrganization`)로 선언하지 않는다.** 이 사이트는 학교 공식 사이트가 아니므로 `about`/`sameAs`로 참조만 하고, 푸터에 비공식 고지를 둔다.

### 7.4 sitemap.xml 생성
- 5개 언어 URL + `qr-generator.html`
- 각 언어 URL에 `xhtml:link rel="alternate" hreflang="…"` 6개 (`xmlns:xhtml` 선언 필요)
- `lastmod`는 빌드 시각(YYYY-MM-DD)
- `robots.txt`는 이미 sitemap을 가리키므로 변경 없음

### 7.5 생성물 표시
각 생성 파일 첫 줄:
```html
<!-- GENERATED FILE — DO NOT EDIT. Source: content.json + template.html. Run: node build.js -->
```

## 8. 하단 학부모 가이드

첫 화면 링크 허브는 손대지 않는다. 카드 아래에 접이식 없이 순서대로 배치한다:

1. **About** — 학교 소개 2문단
2. **자주 쓰는 온라인 포털** — iSAMS / SchoolsBuddy / Vircle / ClassDojo 각각 무엇에 쓰는지
3. **처음 온 학부모를 위한 체크리스트** — 항목 리스트
4. **FAQ** — 기존 아코디언 재사용
5. **비공식 고지 푸터** — "학부모가 만든 비공식 링크 모음입니다. 공식 정보는 <공식 사이트>를 확인하세요."

첫 화면에 긴 설명문을 올리지 않는다. LCP 영향을 피하기 위해 접이식 대신 단순 하단 배치로 한다.

## 9. 언어별 콘텐츠 방향

기계 번역 5벌은 색인에 손해다. 각 언어권 학부모가 실제로 검색하는 표현으로 새로 쓴다. 분량은 언어별로 달라도 된다.

| 언어 | 축 |
|---|---|
| en | Tenby International School Penang, parent portal, learning apps |
| ko | 텐비 국제학교 페낭, 말레이시아 국제학교, 학부모 포털 |
| ja | ペナン インターナショナルスクール, Tenby Penang, 保護者ポータル |
| zh-CN | 槟城国际学校, Tenby Penang, 家长门户 |
| zh-TW | 檳城國際學校, Tenby Penang, 家長入口 |

### 한국어 확정 문구
- title: `텐비 국제학교 페낭 학부모 링크 모음 | 말레이시아 페낭 국제학교 포털`
- H1: `텐비 국제학교 페낭 학부모 링크 모음`
- description: `텐비 국제학교 페낭(Tenby International School Penang) 학부모를 위한 iSAMS 학부모 포털, SchoolsBuddy, Vircle, ClassDojo, 학습 앱, 학교 정보 링크 모음입니다.`
- 본문 첫 문장: `텐비 국제학교 페낭 학부모를 위한 주요 링크 모음입니다. iSAMS Parent Portal, SchoolsBuddy, Vircle, ClassDojo, Learning Village 등 말레이시아 국제학교 생활에서 자주 쓰는 서비스를 한곳에 정리했습니다.`
- 키워드: 텐비 국제학교 / 텐비 국제학교 페낭 / 텐비 페낭 / 페낭 국제학교 / 말레이시아 국제학교 / 국제학교 학부모 포털 / iSAMS 학부모 포털 / SchoolsBuddy / Vircle
- 표기 원칙: 한글 일반 표현은 **"국제학교"**(붙여쓰기). 영문 정식명 `Tenby International School Penang`은 description·본문·JSON-LD `School.name`에 병기. `인터내셔널 스쿨` 한글 표기는 **FAQ 답변 1회만** — 예: "텐비 국제학교 페낭은 '텐비 인터내셔널 스쿨 페낭'으로도 불립니다." 오타 변형(`인터네셔널`)은 사용하지 않는다.

## 10. 제거되는 코드

| 대상 | 처리 |
|---|---|
| `translations` (1200-1606) | content.json으로 이관 후 삭제 |
| `seoMetaTags` (1616-1643) | 〃 |
| `switchLanguage()` / `updateSEOMetaTags()` / `currentLanguage` | 삭제 |
| `detectBrowserLanguage()` | 삭제 (자동 전환 금지) |
| `localStorage['preferred-language']` | 삭제 |
| `appStoreLinks` (1697-1784) / `openAppStore()` | 삭제. href를 빌드 시점에 확정 |
| 언어 버튼 `onclick="switchLanguage(…)"` | `<a href="{{base}}ko/" hreflang="ko">`로 대체 |

**유지**: `toggleTheme()`, `getSystemTheme()`, `localStorage['theme']`, 다크모드 인라인 스크립트, `toggleFaq()`, `trackLinkClick()`, gtag.

앱 버튼은 `onclick`에서 `trackLinkClick()`만 호출하고 `preventDefault` 없이 네이티브 `target="_blank"` 이동에 맡긴다.

## 11. 검증

`node build.js` 실행 후:

1. 5개 `index.html` + `sitemap.xml` 생성 확인
2. 각 파일 `<html lang="…">`이 언어와 일치
3. canonical이 자기 자신 URL
4. hreflang 6개가 5개 파일에서 상호 일치 (왕복 확인)
5. sitemap에 5개 언어 URL 존재
6. 생성된 HTML의 모든 `{{base}}` 치환 결과 경로가 실제 파일로 존재 (아이콘 28개 포함)
7. 미치환 `{{` 토큰 잔존 0건
8. `python3 -m http.server`로 `/`와 `/ko/` 확인 — 링크 허브 UX·아이콘·다크모드·FAQ 동작

## 12. 리스크 / 열린 항목

| 항목 | 상태 |
|---|---|
| `twitter:site="@tenbypenang"` 계정 소유 여부 | 미확인 → 일단 제거 |
| Vircle 아이콘 핫링크 | `icons/vircle.webp`로 로컬화 후 참조 |
| ja / zh-CN / zh-TW 카피 품질 | 초안 작성 후 원어민 검토가 이상적. 우선 검색어 중심으로 작성 |
| GitHub Pages 트레일링 슬래시 | `/ko/` → `/ko/index.html` 정상 서빙 (Pages 기본 동작). 배포 후 실제 확인 |
| 생성물 손수정 위험 | GENERATED 배너로 완화. 필요 시 후속으로 CI 검증 추가 |
