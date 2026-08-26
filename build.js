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
    .map(b => {
      const json = JSON.stringify(b, null, 4).replace(/</g, '\\u003c');
      return `    <script type="application/ld+json">\n${json}\n    </script>`;
    })
    .join('\n');
}

module.exports = { loadContent, validateContent, baseFor, pageUrl, iosUrl, androidUrl, hreflangTags, renderHead, escapeHtml, escapeAttr, renderJsonLd, linkTargetUrl };
