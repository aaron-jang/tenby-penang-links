const test = require('node:test');
const assert = require('node:assert');
const { validateContent } = require('./build.js');

function baseLangI18n(label) {
  return {
    sections: { portal: label },
    links: { isams: { name: 'n', desc: 'd' } },
    meta: { title: 't', description: 'd', h1: 'h', subtitle: 's' },
    guide: {
      aboutTitle: 'a',
      aboutBody: ['body'],
      portalsTitle: 'p',
      portals: [{ name: 'n', desc: 'd' }],
      checklistTitle: 'c',
      checklist: ['item']
    },
    faqTitle: 'FAQ',
    faq: [{ q: 'q', a: 'a' }],
    disclaimer: 'disclaimer text {url}',
    uiLabels: { ios: 'iOS', android: 'Android', qrgen: 'QR' }
  };
}

function baseContent() {
  return {
    languages: [{ code: 'en' }, { code: 'ko' }],
    sections: [{ id: 'portal', links: [{ id: 'isams' }] }],
    i18n: {
      en: baseLangI18n('Portal'),
      ko: baseLangI18n('포털')
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

for (const field of ['title', 'description', 'h1', 'subtitle']) {
  test(`validateContent throws naming the exact path when meta.${field} is missing`, () => {
    const c = baseContent();
    delete c.i18n.ko.meta[field];
    assert.throws(() => validateContent(c), new RegExp(`i18n\\.ko\\.meta\\.${field} missing`));
  });
}

for (const field of ['aboutTitle', 'aboutBody', 'portalsTitle', 'portals', 'checklistTitle', 'checklist']) {
  test(`validateContent throws naming the exact path when guide.${field} is missing`, () => {
    const c = baseContent();
    delete c.i18n.ko.guide[field];
    assert.throws(() => validateContent(c), new RegExp(`i18n\\.ko\\.guide\\.${field} missing`));
  });
}

test('validateContent throws naming the exact path when guide is missing entirely', () => {
  const c = baseContent();
  delete c.i18n.ko.guide;
  assert.throws(() => validateContent(c), /i18n\.ko\.guide\.aboutTitle missing/);
});

test('validateContent throws naming the exact path when faqTitle is missing', () => {
  const c = baseContent();
  delete c.i18n.ko.faqTitle;
  assert.throws(() => validateContent(c), /i18n\.ko\.faqTitle missing/);
});

test('validateContent throws naming the exact path when faq is missing entirely', () => {
  const c = baseContent();
  delete c.i18n.ko.faq;
  assert.throws(() => validateContent(c), /i18n\.ko\.faq missing/);
});

test('validateContent throws naming the exact path when faq is present but empty', () => {
  const c = baseContent();
  c.i18n.ko.faq = [];
  assert.throws(() => validateContent(c), /i18n\.ko\.faq missing/);
});

test('validateContent throws naming the exact path when disclaimer is missing', () => {
  const c = baseContent();
  delete c.i18n.ko.disclaimer;
  assert.throws(() => validateContent(c), /i18n\.ko\.disclaimer missing/);
});

test('validateContent throws naming the exact path when disclaimer is empty string', () => {
  const c = baseContent();
  c.i18n.ko.disclaimer = '';
  assert.throws(() => validateContent(c), /i18n\.ko\.disclaimer missing/);
});

for (const field of ['ios', 'android', 'qrgen']) {
  test(`validateContent throws naming the exact path when uiLabels.${field} is missing`, () => {
    const c = baseContent();
    delete c.i18n.ko.uiLabels[field];
    assert.throws(() => validateContent(c), new RegExp(`i18n\\.ko\\.uiLabels\\.${field} missing`));
  });
}

test('validateContent does not throw when meta.keywords is absent (keywords is optional)', () => {
  const c = baseContent();
  delete c.i18n.ko.meta.keywords;
  assert.strictEqual(validateContent(c), true);
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

test('renderJsonLd carries every schoolSameAs URL onto the about node as an array', () => {
  const c = ldContent();
  c.site.schoolSameAs = [
    'https://www.tenby.edu.my/penang/',
    'https://www.facebook.com/tenbypenang/',
    'https://www.instagram.com/tenbypenang/',
    'https://www.linkedin.com/company/tenbyschoolspenang/'
  ];
  const page = parseLd(renderJsonLd(c, c.languages[1])).find(b => b['@type'] === 'WebPage');
  assert.ok(Array.isArray(page.about.sameAs), 'sameAs must be an array when schoolSameAs is set');
  assert.deepStrictEqual(page.about.sameAs, c.site.schoolSameAs);
});

test('renderJsonLd emits the school address as a PostalAddress with region and country', () => {
  const c = ldContent();
  c.site.schoolAddress = { addressRegion: 'Penang', addressCountry: 'Malaysia' };
  const page = parseLd(renderJsonLd(c, c.languages[0])).find(b => b['@type'] === 'WebPage');
  assert.strictEqual(page.about.address['@type'], 'PostalAddress');
  assert.strictEqual(page.about.address.addressRegion, 'Penang');
  assert.strictEqual(page.about.address.addressCountry, 'Malaysia');
});

test('renderJsonLd keeps the school a referenced School node, never an EducationalOrganization', () => {
  const c = ldContent();
  c.site.schoolSameAs = ['https://www.tenby.edu.my/penang/', 'https://www.facebook.com/tenbypenang/'];
  c.site.schoolAddress = { addressRegion: 'Penang', addressCountry: 'Malaysia' };
  const html = renderJsonLd(c, c.languages[1]);
  const blocks = parseLd(html);
  const page = blocks.find(b => b['@type'] === 'WebPage');
  assert.strictEqual(page.about['@type'], 'School');
  assert.ok(!blocks.some(b => b['@type'] === 'EducationalOrganization'));
  assert.ok(!/EducationalOrganization/.test(html), 'no block may mention EducationalOrganization');
});

test('renderJsonLd falls back to the single officialUrl string when schoolSameAs is absent or empty', () => {
  const c = ldContent();
  delete c.site.schoolSameAs;
  const absent = parseLd(renderJsonLd(c, c.languages[0])).find(b => b['@type'] === 'WebPage');
  assert.strictEqual(absent.about.sameAs, 'https://www.tenby.edu.my/penang/');
  c.site.schoolSameAs = [];
  const empty = parseLd(renderJsonLd(c, c.languages[0])).find(b => b['@type'] === 'WebPage');
  assert.strictEqual(empty.about.sameAs, 'https://www.tenby.edu.my/penang/');
});

test('renderJsonLd omits address entirely when schoolAddress is absent, never emitting undefined', () => {
  const c = ldContent();
  delete c.site.schoolAddress;
  const html = renderJsonLd(c, c.languages[0]);
  const page = parseLd(html).find(b => b['@type'] === 'WebPage');
  assert.ok(!('address' in page.about), 'about must have no address key at all');
  assert.ok(!/undefined/.test(html), 'rendered JSON-LD must never contain the string "undefined"');
});

const { loadContent: loadShippedContent } = require('./build.js');

test('the shipped content.json actually carries the school sameAs profiles and address', () => {
  // Pins the real config, not a fixture: the five tests above set schoolSameAs/schoolAddress
  // themselves, so deleting them from content.json would leave those tests green.
  const site = loadShippedContent(__dirname).site;
  assert.ok(Array.isArray(site.schoolSameAs), 'site.schoolSameAs must be an array');
  for (const url of [
    'https://www.tenby.edu.my/penang/',
    'https://www.facebook.com/tenbypenang/',
    'https://www.instagram.com/tenbypenang/',
    'https://www.linkedin.com/company/tenbyschoolspenang/'
  ]) {
    assert.ok(site.schoolSameAs.includes(url), `site.schoolSameAs must contain ${url}`);
  }
  assert.ok(site.schoolAddress, 'site.schoolAddress must be present');
  assert.strictEqual(site.schoolAddress.addressRegion, 'Penang');
  assert.strictEqual(site.schoolAddress.addressCountry, 'Malaysia');
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

test('renderJsonLd escapes < to prevent </script> breakout', () => {
  const c = ldContent();
  c.i18n.en.faq[0].a = 'This contains </script> which should not break out';
  const html = renderJsonLd(c, c.languages[0]);
  const scriptTags = html.split('<script type="application/ld+json">').length - 1;
  const closeTags = (html.match(/<\/script>/g) || []).length;
  assert.strictEqual(closeTags, scriptTags, 'closing tags should equal opening tags');
  assert.ok(!html.includes('</script> which should not'), 'raw </script> should not appear in unescaped text');
});

test('renderJsonLd escaping is lossless: parsed JSON recovers original unescaped < character', () => {
  const c = ldContent();
  c.i18n.en.faq[0].a = 'Answer with <tag> inside';
  const html = renderJsonLd(c, c.languages[0]);
  const blocks = parseLd(html);
  const faq = blocks.find(b => b['@type'] === 'FAQPage');
  assert.strictEqual(faq.mainEntity[0].acceptedAnswer.text, 'Answer with <tag> inside');
});

test('renderJsonLd handles non-ASCII with < escape (Korean)', () => {
  const c = ldContent();
  c.i18n.ko.faq[0].a = '한국어 <태그> 포함';
  const html = renderJsonLd(c, c.languages[1]);
  const blocks = parseLd(html);
  const faq = blocks.find(b => b['@type'] === 'FAQPage');
  assert.strictEqual(faq.mainEntity[0].acceptedAnswer.text, '한국어 <태그> 포함');
});

test('renderJsonLd handles title with < (page title as page subject)', () => {
  const c = ldContent();
  c.i18n.en.meta.title = 'My <Script> Title';
  const html = renderJsonLd(c, c.languages[0]);
  const blocks = parseLd(html);
  const page = blocks.find(b => b['@type'] === 'WebPage');
  assert.strictEqual(page.name, 'My <Script> Title');
});

test('renderJsonLd blocks do not contain raw </script> substring', () => {
  const c = ldContent();
  c.i18n.ko.meta.description = 'Test </script> in description';
  const html = renderJsonLd(c, c.languages[1]);
  const scriptBlockCount = (html.match(/<script type="application\/ld\+json">/g) || []).length;
  const endScriptCount = (html.match(/<\/script>/g) || []).length;
  assert.strictEqual(endScriptCount, scriptBlockCount);
});

const { renderSections, renderCard } = require('./build.js');

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

const { jsSingleQuoted, trackAttr } = require('./build.js');

test('jsSingleQuoted escapes apostrophes', () => {
  assert.strictEqual(jsSingleQuoted("L'école"), "L\\'école");
});

test('jsSingleQuoted escapes backslashes', () => {
  assert.strictEqual(jsSingleQuoted("path\\to\\file"), "path\\\\to\\\\file");
});

test('renderCard with apostrophe in name generates valid onclick', () => {
  const c = sectionContent();
  c.i18n.ko.links.isams.name = "L'école";
  const out = renderSections(c, { code: 'ko' }, '');
  assert.ok(out.includes("\\'école"), "onclick should contain escaped apostrophe");
  assert.ok(!out.includes("('L'"), "raw apostrophe sequence should not appear");
});

test('renderCard with double quote in name does not double-escape', () => {
  const c = sectionContent();
  c.i18n.ko.links.isams.name = 'Portal "Test"';
  const out = renderSections(c, { code: 'ko' }, '');
  const onclickMatch = out.match(/onclick="([^"]*)"/) || [];
  assert.ok(onclickMatch[1], "onclick attribute should exist");
  const onclick = onclickMatch[1];
  const quoteCount = (onclick.match(/&quot;/g) || []).length;
  assert.strictEqual(quoteCount, 2, "&quot; should appear exactly twice in onclick (once per input quote)");
  assert.ok(!onclick.includes('&amp;quot;'), "onclick should not contain double-escaped &amp;quot;");
});

test('renderCard with ampersand in name escapes once', () => {
  const c = sectionContent();
  c.i18n.ko.links.isams.name = 'Marks & Grades';
  const out = renderSections(c, { code: 'ko' }, '');
  assert.ok(out.includes('&amp;'), "onclick should contain &amp;");
  assert.ok(!out.includes('&amp;amp;'), "should not contain double-escaped &amp;amp;");
});

test('renderCard app-type buttons with apostrophe in name escape both onclicks', () => {
  const c = sectionContent();
  c.i18n.ko.links.vircle.name = "L'app";
  const out = renderSections(c, { code: 'ko' }, '');

  assert.ok(out.includes("trackLinkClick('L\\'app iOS'"), "iOS button onclick should have escaped apostrophe");
  assert.ok(out.includes("trackLinkClick('L\\'app Android'"), "Android button onclick should have escaped apostrophe");
  assert.ok(!out.includes("trackLinkClick('L'app"), "should not contain raw unescaped apostrophe in tracking calls");
});

test('renderCard web link with apostrophe in URL escapes the onclick', () => {
  const c = sectionContent();
  c.sections[0].links[0].url = "https://example.com/a'b";
  const out = renderSections(c, { code: 'ko' }, '');

  const match = out.match(/onclick="([^"]*)"/);
  assert.ok(match, "onclick attribute should exist");
  const onclick = match[1];

  assert.ok(onclick.includes("https://example.com/a\\'b"),
    "onclick should escape apostrophes in URL");
});

test('renderCard iOS button escapes special characters in href', () => {
  const c = sectionContent();
  c.sections[0].links[1].ios.id = '123&x"y';
  const out = renderSections(c, { code: 'ko' }, '');

  const match = out.match(/href="(https:\/\/apps\.apple\.com\/app\/id[^"]*)"/);
  assert.ok(match, "iOS href should be present");
  const iosHref = match[1];

  assert.ok(iosHref.includes('&amp;'), "iOS href should escape & to &amp;");
  assert.ok(iosHref.includes('&quot;'), "iOS href should escape \" to &quot;");
  assert.ok(!iosHref.match(/&(?!amp;|quot;)/), "iOS href should not contain raw unescaped & outside of entity refs");
});

test('renderCard preserves non-ASCII characters inside onclick attribute', () => {
  const c = sectionContent();
  c.i18n.ko.links.isams.name = '학부모 포털';
  const out = renderSections(c, { code: 'ko' }, '');

  const match = out.match(/onclick="([^"]*)"/);
  assert.ok(match, "onclick attribute should exist");
  const onclick = match[1];

  assert.ok(onclick.includes('학부모 포털'), "Korean text should pass through intact in onclick attribute");
});

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
    portalsTitle: '자주 쓰는 포털', portals: [{ name: 'iSAMS', desc: '성적 확인' }, { name: 'PowerSchool', desc: '학사일정' }],
    checklistTitle: '체크리스트', checklist: ['계정 발급받기', '모바일앱 설치']
  }}}};
  const out = renderGuide(c, { code: 'ko' });
  assert.ok(out.includes('학교 소개'));
  assert.ok(out.includes('첫 문단'));
  assert.ok(out.includes('둘째 문단'));
  assert.ok(out.includes('자주 쓰는 포털'));
  assert.ok(out.includes('iSAMS'));
  assert.ok(out.includes('성적 확인'));
  assert.ok(out.includes('PowerSchool'));
  assert.ok(out.includes('학사일정'));
  assert.ok(out.includes('체크리스트'));
  assert.ok(out.includes('계정 발급받기'));
  assert.ok(out.includes('모바일앱 설치'));
});

test('renderFaq reuses the existing faq-item markup and toggleFaq handler', () => {
  const c = { i18n: { ko: { faqTitle: '자주 묻는 질문', faq: [{ q: '질문1', a: '답변1' }, { q: '질문2', a: '답변2' }] } } };
  const out = renderFaq(c, { code: 'ko' });
  assert.ok(out.includes('class="faq-title"'));
  assert.ok(out.includes('class="faq-item"'));
  assert.ok(out.includes('class="faq-question"'));
  assert.ok(out.includes('class="faq-answer"'));
  assert.ok(out.includes('onclick="toggleFaq(this)"'));
  assert.ok(out.includes('질문1'));
  assert.ok(out.includes('답변1'));
  assert.ok(out.includes('질문2'));
  assert.ok(out.includes('답변2'));
});

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

test('renderSitemap keeps xhtml:link elements out of extraUrls blocks', () => {
  const xml = renderSitemap(SITEMAP_CONTENT, '2026-08-26');
  const urlBlocks = xml.split('<url>').slice(1);
  const qrBlock = urlBlocks.find(b => b.includes('qr-generator.html'));
  assert.ok(qrBlock, 'qr-generator.html block exists');
  assert.ok(!qrBlock.includes('<xhtml:link'), 'qr-generator.html block contains no xhtml:link elements');
});

test('renderSitemap pins x-default href to the site root', () => {
  const xml = renderSitemap(SITEMAP_CONTENT, '2026-08-26');
  assert.ok(xml.includes('<xhtml:link rel="alternate" hreflang="x-default" href="https://soosoo.life/tenby-penang-links/"/>'));
});

test('hreflangTags and renderSitemap alternate sets match', () => {
  const headAlts = hreflangTags(SITEMAP_CONTENT);
  const sitemapXml = renderSitemap(SITEMAP_CONTENT, '2026-08-26');

  const headPairs = new Set();
  const headRegex = /hreflang="([^"]+)"\s+href="([^"]+)"/g;
  let match;
  while ((match = headRegex.exec(headAlts)) !== null) {
    headPairs.add(`${match[1]}|${match[2]}`);
  }

  const sitemapPairs = new Set();
  const sitemapRegex = /hreflang="([^"]+)"\s+href="([^"]+)"/g;
  while ((match = sitemapRegex.exec(sitemapXml)) !== null) {
    sitemapPairs.add(`${match[1]}|${match[2]}`);
  }

  assert.deepStrictEqual(Array.from(sitemapPairs).sort(), Array.from(headPairs).sort(), 'hreflang alternate sets must match between HTML head and sitemap');
});

const { renderPage } = require('./build.js');

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
      faqTitle: 'F', faq: [{ q: 'q', a: 'a' }], disclaimer: 'disc {url}',
      uiLabels: { ios: '📱 iOS', android: '🤖 Android', qrgen: 'QR' }
    }]))
  };
}

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

test('renderPage throws with the offending token name when the template has an unknown token', () => {
  const c = fullFixture();
  const badTemplate = TEMPLATE.replace('{{h1}}', '{{nosuchtoken}}');
  assert.throws(() => renderPage(c, c.languages[0], badTemplate), /nosuchtoken/);
});

test('renderPage throws instead of injecting inherited Object.prototype members for {{toString}}', () => {
  const c = fullFixture();
  const badTemplate = TEMPLATE.replace('{{h1}}', '{{toString}}');
  assert.throws(() => renderPage(c, c.languages[0], badTemplate), /toString/);
});

test('renderPage banner matches the required text exactly', () => {
  const c = fullFixture();
  const firstLine = renderPage(c, c.languages[0], TEMPLATE).split('\n')[0];
  assert.strictEqual(firstLine, '<!-- GENERATED FILE — DO NOT EDIT. Source: content.json + template.html. Run: node build.js -->');
});

const { renderDisclaimer, loadContent } = require('./build.js');

function discContent(text) {
  return {
    site: { officialUrl: 'https://www.tenby.edu.my/penang/' },
    i18n: { ko: { disclaimer: text } }
  };
}

test('renderDisclaimer turns the {url} placeholder into a real anchor', () => {
  const out = renderDisclaimer(discContent('공식 정보는 {url} 에서 확인하세요.'), { code: 'ko' });
  assert.ok(out.includes('<a href="https://www.tenby.edu.my/penang/"'));
  assert.ok(out.includes('>https://www.tenby.edu.my/penang/</a>'));
  assert.ok(!out.includes('{url}'));
});

test('renderDisclaimer escapes the surrounding text but not the anchor', () => {
  const out = renderDisclaimer(discContent('A & B <c> {url}'), { code: 'ko' });
  assert.ok(out.includes('A &amp; B &lt;c&gt;'));
  assert.ok(out.includes('<a href='), 'anchor must not be escaped');
  assert.ok(!out.includes('&lt;a href='));
});

test('renderDisclaimer opens the official site in a new tab with rel=noopener', () => {
  const out = renderDisclaimer(discContent('{url}'), { code: 'ko' });
  assert.ok(out.includes('target="_blank"'));
  assert.ok(out.includes('rel="noopener"'));
});

test('every language disclaimer renders exactly one official-site anchor', () => {
  const c = loadContent('.');
  for (const lang of c.languages) {
    const out = renderDisclaimer(c, lang);
    assert.strictEqual((out.match(/<a /g) || []).length, 1, `${lang.code} anchor count`);
    assert.ok(!out.includes('{url}'), `${lang.code} still has the placeholder`);
  }
});

test('validateContent rejects a disclaimer with no {url} placeholder', () => {
  const c = loadContent('.');
  c.i18n.ko.disclaimer = '플레이스홀더 없는 문구';
  assert.throws(() => validateContent(c), /i18n\.ko\.disclaimer missing the \{url\} placeholder/);
});
