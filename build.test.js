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

const { escapeAttr, escapeHtml } = require('./build.js');

test('escapeHtml escapes & < > but not " with exact replacement order', () => {
  const input = 'A & B "C" <D>';
  const expected = 'A &amp; B "C" &lt;D&gt;';
  assert.strictEqual(escapeHtml(input), expected);
});

test('escapeAttr escapes & " < > with exact replacement order', () => {
  const input = 'A & B "C" <D>';
  const expected = 'A &amp; B &quot;C&quot; &lt;D&gt;';
  assert.strictEqual(escapeAttr(input), expected);
});

test('renderHead escapes dangerous characters in title and description', () => {
  const c = headContent();
  c.i18n.ko.meta.title = 'A & B "C" <D>';
  c.i18n.ko.meta.description = 'E & F "G" <H>';
  const out = renderHead(c, c.languages[1]);
  assert.ok(out.includes('<title>A &amp; B "C" &lt;D&gt;</title>'));
  assert.ok(out.includes('content="E &amp; F &quot;G&quot; &lt;H&gt;"'));
  assert.ok(!out.includes('<"'));
  assert.ok(!out.includes('content="E & F'));
});

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
