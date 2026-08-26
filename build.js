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

function jsSingleQuoted(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function trackAttr(name, url, category) {
  const args = [name, url, category].map(v => `'${jsSingleQuoted(v)}'`).join(', ');
  return escapeAttr(`trackLinkClick(${args})`);
}

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
    return [
      `                    <a href="${escapeAttr(link.url)}" class="app-card web-card" target="_blank" onclick="${trackAttr(info.name, link.url, sectionId)}">`,
      inner,
      `                    </a>`
    ].join('\n');
  }

  const buttons = [];
  if (link.ios) {
    const u = iosUrl(link);
    buttons.push(`                            <a href="${escapeAttr(u)}" class="app-button" target="_blank" onclick="${trackAttr(info.name + ' iOS', u, 'App Store')}">${escapeHtml(ui.ios || '📱 iOS')}</a>`);
  }
  if (link.android) {
    const u = androidUrl(link, lang.code, content.appStore);
    buttons.push(`                            <a href="${escapeAttr(u)}" class="app-button" target="_blank" onclick="${trackAttr(info.name + ' Android', u, 'App Store')}">${escapeHtml(ui.android || '🤖 Android')}</a>`);
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

module.exports = { loadContent, validateContent, baseFor, pageUrl, iosUrl, androidUrl, hreflangTags, renderHead, escapeHtml, escapeAttr, renderJsonLd, linkTargetUrl, renderSections, renderCard, jsSingleQuoted, trackAttr, renderLangSwitcher, renderGuide, renderFaq, renderSitemap };
