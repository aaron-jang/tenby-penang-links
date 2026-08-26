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
