// =====================================================================
// AUTOMATED TEST SUITE: WEIHNACHTS-KARTENRÜCKEN QUALITÄT & SVG-INTEGRITÄT
// =====================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST: WEIHNACHTS-KARTENRÜCKEN QUALITÄT & SVG-INTEGRITÄT START ---');

const { COSMETICS_CATALOG } = require('../server/cosmeticsData');
const cardBacksDir = path.join(__dirname, '../public/images/card_backs');
const androidCardBacksDir = path.join(__dirname, '../android/app/src/main/assets/public/images/card_backs');
const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

const EXPECTED_CHRISTMAS_DECKS = [
  { id: 'yule_pine_ribbon', rarity: 'common', name: 'Festtags-Pergament & Rote Seide' },
  { id: 'frost_snowflake_filigree', rarity: 'rare', name: 'Eiskristall-Mandala & Frostsilber' },
  { id: 'nutcracker_regiment', rarity: 'epic', name: 'Kaiserliche Samt-Tressen & Garde-Emblem' },
  { id: 'candlelight_vigil', rarity: 'epic', name: 'Geweihte Mistelranke & Sonnenwend-Licht' },
  { id: 'celestial_solstice_gold', rarity: 'legendary', name: 'Stern von Bethlehem & Sonnenwend-Gold' }
];

// 1. 100% SVG-Konsistenz im Ordner public/images/card_backs/
console.log('[1/5] Überprüfe 100% SVG-Konsistenz im Verzeichnis public/images/card_backs...');
const allFiles = fs.readdirSync(cardBacksDir);
assert.strictEqual(allFiles.length, 15, `Es müssen genau 15 Kartenrücken existieren (10 Standard + 5 Weihnachten), gefunden: ${allFiles.length}`);
for (const f of allFiles) {
  assert.ok(f.endsWith('.svg'), `Datei ${f} ist keine .svg-Datei! Vorgabe war 100% SVG.`);
}
console.log(`✓ Alle 15 Dateien im Kartenrücken-Ordner sind einheitlich .svg.`);

// 2. Server-Katalog Validierung
console.log('[2/5] Überprüfe COSMETICS_CATALOG.card_backs auf Vollständigkeit...');
assert.ok(COSMETICS_CATALOG && Array.isArray(COSMETICS_CATALOG.card_backs), 'Katalog hat card_backs Array');
for (const expected of EXPECTED_CHRISTMAS_DECKS) {
  const item = COSMETICS_CATALOG.card_backs.find(c => c.id === expected.id);
  assert.ok(item, `Katalogeintrag für ${expected.id} fehlt!`);
  assert.strictEqual(item.rarity, expected.rarity, `Rarität für ${expected.id} weicht ab`);
  assert.strictEqual(item.name, expected.name, `Name für ${expected.id} weicht ab`);
  assert.ok(item.lore && item.lore.length > 20, `Lore für ${expected.id} zu kurz oder fehlt`);
}
console.log('✓ Alle 5 Weihnachts-Kartenrücken im Serverkatalog vollständig und korrekt konfiguriert.');

// 3. SVG-Artwork-Integrität & Android-Spiegelung
console.log('[3/5] Überprüfe SVG-Struktur und Android-Assets...');
for (const expected of EXPECTED_CHRISTMAS_DECKS) {
  const svgName = `back_${expected.id}.svg`;
  const pubPath = path.join(cardBacksDir, svgName);
  const andPath = path.join(androidCardBacksDir, svgName);

  assert.ok(fs.existsSync(pubPath), `Public SVG fehlt: ${svgName}`);
  assert.ok(fs.existsSync(andPath), `Android SVG fehlt: ${svgName}`);

  const svgContent = fs.readFileSync(pubPath, 'utf8');
  assert.ok(svgContent.includes('<svg'), `${svgName} enthält keinen <svg> Tag`);
  assert.ok(svgContent.includes('viewBox="0 0 1050 1498"'), `${svgName} hat nicht das korrekte viewBox (0 0 1050 1498)`);
  assert.ok(svgContent.includes('<image'), `${svgName} enthält kein gerendertes Artwork-Element`);
  assert.ok(svgContent.length > 50000, `${svgName} ist unvollständig klein (${svgContent.length} bytes)`);
}
console.log('✓ Alle 5 SVG-Artworks valide und fehlerfrei nach Android gespiegelt.');

// 4. CSS-Selektoren in public/index.html
console.log('[4/5] Überprüfe CSS-Selektoren in public/index.html...');
for (const expected of EXPECTED_CHRISTMAS_DECKS) {
  const themeClass = `.cardback-theme-${expected.id}`;
  const svgUrl = `/images/card_backs/back_${expected.id}.svg`;
  assert.ok(indexHtml.includes(themeClass), `CSS-Klasse ${themeClass} fehlt in index.html`);
  assert.ok(indexHtml.includes(svgUrl), `SVG-URL ${svgUrl} fehlt in index.html`);
}
console.log('✓ Alle CSS-Klassen und Bildpfade in index.html integriert.');

// 5. Client.js Fallbacks & Inspector-Lore
console.log('[5/5] Überprüfe client.js Fallback-Arrays und Inspektor-Lore...');
for (const expected of EXPECTED_CHRISTMAS_DECKS) {
  assert.ok(clientJs.includes(`id: '${expected.id}'`), `Fallback-Eintrag für ${expected.id} fehlt in client.js`);
  assert.ok(clientJs.includes(`${expected.id}: '`), `Inspektor-Lore für ${expected.id} fehlt in client.js`);
}
console.log('✓ client.js Fallbacks und 3D-Inspektor-Lore vollständig vorhanden.');

console.log('================================================================');
console.log('🏆 ALLE WEIHNACHTS-KARTENRÜCKEN TESTS ERFOLGREICH BESTANDEN!');
console.log('================================================================');
