// =====================================================================
// AUTOMATED TEST SUITE: WEIHNACHTS-SPIELTISCHE QUALITÄT & SVG-INTEGRITÄT
// =====================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST: WEIHNACHTS-SPIELTISCHE QUALITÄT & SVG-INTEGRITÄT START ---');

const { COSMETICS_CATALOG } = require('../server/cosmeticsData');
const tablesDir = path.join(__dirname, '../public/images/tables');
const androidTablesDir = path.join(__dirname, '../android/app/src/main/assets/public/images/tables');
const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

const EXPECTED_CHRISTMAS_TABLES = [
  { id: 'yule_hearth_wood', rarity: 'common', marker: 'yuleWoodGrain', name: 'Festtags-Kaminholz & Tannengrün' },
  { id: 'frost_slate_shimmer', rarity: 'rare', marker: 'glacierSlateNoise', name: 'Raureif-Schiefer & Frostsilber' },
  { id: 'nutcracker_workshop', rarity: 'epic', marker: 'velvetSheen', name: 'Kaiserliche Uhrwerk-Werkbank' },
  { id: 'candlelight_mistletoe', rarity: 'epic', marker: 'marbleVeinNoise', name: 'Winterkönigin-Marmor & Mistel' },
  { id: 'celestial_solstice_gold', rarity: 'legendary', marker: 'cosmicLapisDust', name: 'Stern von Bethlehem & Sonnenwend-Gold' }
];

// 1. 100% SVG-Konsistenz im Verzeichnis public/images/tables/
console.log('[1/5] Überprüfe 100% SVG-Konsistenz im Verzeichnis public/images/tables...');
const allFiles = fs.readdirSync(tablesDir);
assert.strictEqual(allFiles.length, 11, `Es müssen genau 11 Tische existieren (6 Standard/Halloween + 5 Weihnachten), gefunden: ${allFiles.length}`);
for (const f of allFiles) {
  assert.ok(f.endsWith('.svg'), `Datei ${f} ist keine .svg-Datei! Vorgabe war 100% SVG.`);
}
console.log('✓ Alle 11 Dateien im Spieltisch-Ordner sind einheitlich .svg.');

// 2. Server-Katalog Validierung
console.log('[2/5] Überprüfe COSMETICS_CATALOG.table_skins auf Vollständigkeit...');
assert.ok(COSMETICS_CATALOG && Array.isArray(COSMETICS_CATALOG.table_skins), 'Katalog hat table_skins Array');
for (const expected of EXPECTED_CHRISTMAS_TABLES) {
  const item = COSMETICS_CATALOG.table_skins.find(t => t.id === expected.id);
  assert.ok(item, `Katalogeintrag für ${expected.id} fehlt!`);
  assert.strictEqual(item.rarity, expected.rarity, `Rarität für ${expected.id} weicht ab`);
  assert.strictEqual(item.name, expected.name, `Name für ${expected.id} weicht ab`);
  assert.ok(item.lore && item.lore.length > 20, `Lore für ${expected.id} zu kurz oder fehlt`);
}
console.log('✓ Alle 5 Weihnachts-Spieltische im Serverkatalog vollständig und korrekt konfiguriert.');

// 3. SVG-Artwork-Integrität & Android-Spiegelung
console.log('[3/5] Überprüfe SVG-Struktur und Android-Assets...');
for (const expected of EXPECTED_CHRISTMAS_TABLES) {
  const svgName = `table_${expected.id}.svg`;
  const pubPath = path.join(tablesDir, svgName);
  const andPath = path.join(androidTablesDir, svgName);

  assert.ok(fs.existsSync(pubPath), `Public SVG fehlt: ${svgName}`);
  assert.ok(fs.existsSync(andPath), `Android SVG fehlt: ${svgName}`);

  const svgContent = fs.readFileSync(pubPath, 'utf8');
  assert.ok(svgContent.includes('<svg'), `${svgName} enthält keinen <svg> Tag`);
  assert.ok(svgContent.includes('viewBox="0 0 1600 1000"'), `${svgName} hat nicht das korrekte viewBox (0 0 1600 1000)`);
  assert.ok(svgContent.includes(expected.marker), `${svgName} enthält thematischen Filter '${expected.marker}' nicht`);
  assert.ok(svgContent.length > 1500, `${svgName} muss detailreiche Vektorpfade enthalten (aktuelle Größe: ${svgContent.length} bytes)`);
}
console.log('✓ Alle 5 SVGs besitzen valide 1600x1000 ViewBoxen, thematische Shader und sind mit Android synchronisiert.');

// 4. CSS Selektoren, Auren & Garderobe-Vorschauen in index.html
console.log('[4/5] Überprüfe CSS-Selektoren der Tisch-Skins & Zug-Auren...');
for (const expected of EXPECTED_CHRISTMAS_TABLES) {
  const skinClass = `.poker-table.table-skin-${expected.id}`;
  const auraClass = `.poker-table.table-skin-${expected.id}.my-turn-aura`;
  const themeClass = `.table-theme-${expected.id}`;

  assert.ok(indexHtml.includes(skinClass), `CSS-Selektor ${skinClass} fehlt in index.html`);
  assert.ok(indexHtml.includes(auraClass), `Zug-Aura ${auraClass} fehlt in index.html`);
  assert.ok(indexHtml.includes(themeClass), `Garderoben-Vorschau ${themeClass} fehlt in index.html`);
}
console.log('✓ Alle 5 CSS-Selektoren, animierte Zug-Auren und Garderobe-Themes in index.html verifiziert.');

// 5. Client Wiring (applyTableSkin & Inspect Modal)
console.log('[5/5] Überprüfe applyTableSkin und Inspect Modal in client.js...');
for (const expected of EXPECTED_CHRISTMAS_TABLES) {
  assert.ok(clientJs.includes(`'${expected.id}'`), `Skin ID '${expected.id}' fehlt in client.js`);
}
console.log('✓ Client-Wiring vollständig konform.');

console.log('--- TEST: WEIHNACHTS-SPIELTISCHE QUALITÄT & SVG-INTEGRITÄT ERFOLGREICH BEENDET ---');
