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
