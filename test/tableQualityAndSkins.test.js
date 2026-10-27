// =====================================================================
// AUTOMATED TEST SUITE: AAA SPIELTISCH-QUALITÄT & SKINS VERIFIKATION
// =====================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TESTSUITE: AAA SPIELTISCH-QUALITÄT & SKINS START ---');

const tablesDir = path.join(__dirname, '../public/images/tables');
const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

// 1. ÜBERPRÜFUNG DER 6 HD-VEKTORTEXTUREN (SVGs)
console.log('[1/4] Überprüfe Existenz und Struktur aller 6 Tisch-SVGs...');

const requiredSkins = [
  { id: 'emerald_felt', file: 'table_emerald_felt.svg', marker: 'baizeWeave' },
  { id: 'tavern_wood', file: 'table_tavern_wood.svg', marker: 'woodGrain' },
  { id: 'amethyst_crypt', file: 'table_amethyst_crypt.svg', marker: 'crystalVeinGrad' },
  { id: 'volcano_keep', file: 'table_volcano_keep.svg', marker: 'magmaFissureGrad' },
  { id: 'astral_observatory', file: 'table_astral_observatory.svg', marker: 'astralGold' },
  { id: 'haunted_crypt', file: 'table_haunted_crypt.svg', marker: 'spectralGrad' }
];

requiredSkins.forEach(skin => {
  const filePath = path.join(tablesDir, skin.file);
  assert(fs.existsSync(filePath), `SVG-Tischdatei fehlt: ${skin.file}`);

  const content = fs.readFileSync(filePath, 'utf8');
  assert(content.includes('<svg'), `${skin.file} muss valides SVG Markup enthalten`);
  assert(content.includes('viewBox="0 0 1600 1000"'), `${skin.file} muss 1600x1000 ViewBox besitzen`);
  assert(content.includes(skin.marker), `${skin.file} muss thematischen Marker '${skin.marker}' enthalten`);
  assert(content.length > 1000, `${skin.file} muss detailreiche Vektorpfade enthalten (${content.length} bytes)`);
});
console.log('✓ Alle 6 hochauflösenden Vektor-Tischtexturen erfolgreich validiert.');

// 2. ÜBERPRÜFUNG DES 3-STUFEN-TIEFENMODELLS IN INDEX.HTML
console.log('[2/4] Überprüfe 3D-Bande, Kanten-Intarsie und Vertiefung in index.html...');
const html = fs.readFileSync(indexHtmlPath, 'utf8');

// Physische Bande & Bevel
assert(html.includes('.poker-table::after'), 'index.html muss .poker-table::after für 3D-Kanten-Intarsie definieren');
assert(html.includes('inset: 3px'), 'Kanten-Intarsie muss inset: 3px aufweisen');
assert(html.includes('perspective: 1200px'), '.poker-table muss 1200px 3D-Perspektive beibehalten');
assert(html.includes('box-shadow: 0 0 28px rgba(0, 0, 0, 0.85)'), 'Symmetrischer Basisschatten muss erhalten bleiben');

// Taktiler Stichkarten-Schlagschatten
assert(html.includes('#trick-container .card'), '#trick-container .card muss definiert sein');
assert(html.includes('drop-shadow(0 6px 14px rgba(0, 0, 0, 0.75))'), 'Stichkarten müssen taktilen Schlagschatten werfen');
console.log('✓ 3D-Bande, Bevel-Kante und taktile Schatten erfolgreich verifiziert.');

// 3. ÜBERPRÜFUNG ALLER 6 TISCH-SKIN CSS-KLASSEN & AUREN
console.log('[3/4] Überprüfe CSS-Selektoren der Tisch-Skins & Zug-Auren...');

requiredSkins.forEach(skin => {
  const skinClass = `.poker-table.table-skin-${skin.id}`;
  assert(html.includes(skinClass), `CSS-Selektor ${skinClass} fehlt in index.html`);
  assert(html.includes(`/images/tables/${skin.file}`), `SVG-Pfad für ${skin.file} fehlt im CSS`);

  // Themenspezifische Zug-Aura
  const auraClass = `.poker-table.table-skin-${skin.id}.my-turn-aura`;
  assert(html.includes(auraClass), `Zug-Aura ${auraClass} fehlt in index.html`);

  // Mini-Table Vorschau in Garderobe
  const themeClass = `.table-theme-${skin.id}`;
  assert(html.includes(themeClass), `Miniatur-Vorschau ${themeClass} fehlt in index.html`);
});
console.log('✓ Alle 6 Tisch-Skins, thematischen Zug-Auren und Garderoben-Vorschauen fehlerfrei verifiziert.');

// 4. CLIENT.JS KOMPATIBILITÄT & ERGONOMIE
console.log('[4/4] Überprüfe applyTableSkin in client.js...');
const js = fs.readFileSync(clientJsPath, 'utf8');

assert(js.includes('function applyTableSkin(skinId)'), 'applyTableSkin Funktion muss existieren');
requiredSkins.forEach(skin => {
  assert(js.includes(`'${skin.id}'`), `Skin ID '${skin.id}' muss in client.js Liste enthalten sein`);
});
console.log('✓ Client-Wiring vollständig konform.');

console.log('================================================================');
console.log('🏆 ALLE PRÜFUNGEN FÜR AAA-SPIELTISCH-QUALITÄT ERFOLGREICH BESTANDEN!');
console.log('================================================================');
