// =====================================================================
// AUTOMATED TEST SUITE: BESPOKE RARITY ARTWORKS & COSMETICS POLISH
// =====================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TESTSUITE: KOSMETIKA & SELTENHEITS-ARTWORKS START ---');

// 1. ÜBERPRÜFE DIE 4 NEUEN SVG-KARTENRÜCKEN
console.log('[1/3] Überprüfe Existenz und Vektor-Integrität der 4 Seltenheits-Artworks...');

const expectedSVGs = [
  'rarity_cardback_common.svg',
  'rarity_cardback_rare.svg',
  'rarity_cardback_epic.svg',
  'rarity_cardback_legendary.svg'
];

expectedSVGs.forEach(filename => {
  const filePath = path.join(__dirname, '../public/images/cards', filename);
  assert(fs.existsSync(filePath), `Kartenrücken-Artwork fehlt: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  assert(content.includes('<svg'), `${filename} ist kein valides SVG-Dokument`);
  assert(content.includes('viewBox="0 0 300 450"'), `${filename} hat nicht die standardisierte Card-ViewBox (0 0 300 450)`);
  assert(content.length > 1000, `${filename} hat zu wenig Inhalt (${content.length} Bytes) - Vektor-Details unvollständig`);
});
console.log('✓ Alle 4 Vektor-Artworks (Common, Rare, Epic, Legendary) existieren und sind valide.');

// 2. ÜBERPRÜFE CSS-BINDUNGEN IN PUBLIC/INDEX.HTML
console.log('[2/3] Überprüfe CSS-Selektoren für Schicksalskarten in public/index.html...');
const indexHtmlPath = path.join(__dirname, '../public/index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

assert(indexHtml.includes('/images/cards/rarity_cardback_common.svg'), 'index.html bindet rarity_cardback_common.svg nicht ein');
assert(indexHtml.includes('/images/cards/rarity_cardback_rare.svg'), 'index.html bindet rarity_cardback_rare.svg nicht ein');
assert(indexHtml.includes('/images/cards/rarity_cardback_epic.svg'), 'index.html bindet rarity_cardback_epic.svg nicht ein');
assert(indexHtml.includes('/images/cards/rarity_cardback_legendary.svg'), 'index.html bindet rarity_cardback_legendary.svg nicht ein');

// Prüfe die Rarity-Frames für Vorderseite und Garderobe
assert(indexHtml.includes('.mystery-card-wrap.rarity-common .mystery-card-front'), 'Common Front-Frame fehlt im CSS');
assert(indexHtml.includes('.mystery-card-wrap.rarity-rare .mystery-card-front'), 'Rare Front-Frame fehlt im CSS');
assert(indexHtml.includes('.mystery-card-wrap.rarity-epic .mystery-card-front'), 'Epic Front-Frame fehlt im CSS');
assert(indexHtml.includes('.mystery-card-wrap.rarity-legendary .mystery-card-front'), 'Legendary Front-Frame fehlt im CSS');

assert(indexHtml.includes('.cosmetic-item-card.rarity-rare'), 'Garderoben-Karten Seltenheitsklassen fehlen');
assert(indexHtml.includes('.cosmetic-item-card.rarity-legendary'), 'Garderoben-Karten Legendär-Klasse fehlt');
console.log('✓ CSS-Selektoren und Rarity-Frames in public/index.html erfolgreich verifiziert.');

// 3. ÜBERPRÜFE CLIENT.JS RENDERING
console.log('[3/3] Überprüfe Rarity-Klassen-Zuweisung in public/client.js...');
const clientJsPath = path.join(__dirname, '../public/client.js');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

assert(clientJs.includes('cosmetic-item-card rarity-${itemRarity}'), 'client.js weist die Rarity-Klasse nicht dynamisch zu');
console.log('✓ client.js weist Seltenheiten für Wardrobe-Karten korrekt zu.');

console.log('======================================================');
console.log('ALLE TESTS FÜR KOSMETIKA & SELTENHEITS-ARTWORKS BESTANDEN!');
console.log('======================================================');
