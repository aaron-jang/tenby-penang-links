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
