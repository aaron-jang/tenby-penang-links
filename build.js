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

module.exports = { loadContent, validateContent, baseFor, pageUrl, iosUrl, androidUrl, hreflangTags, renderHead, escapeHtml, escapeAttr };
