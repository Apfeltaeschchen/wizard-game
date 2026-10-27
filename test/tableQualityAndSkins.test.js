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

// 5. ÜBERPRÜFUNG DER KOSMETIK- UND UI-FEINJUSTIERUNG (PHASEN 1 - 6)
console.log('[5/5] Überprüfe Schatzkammer-Button, kreisrunde Avatare, Entwackeln, Titel-Sync & Kartenrücken...');

// 5.1 Schatzkammer-Button
assert(html.includes('#4d2d14') && html.includes('#281406'), 'Schatzkammer-Button muss soliden Zitadellen-Mahagoni-Verlauf besitzen');
assert(html.includes('.btn-vault-action'), 'btn-vault-action muss definiert sein');

// 5.2 Kreisrunde Avatare & Dimensionen
assert(html.includes('aspect-ratio: 1 / 1;') && html.includes('overflow: hidden;'), '.seat-avatar muss aspect-ratio 1 / 1 und overflow: hidden aufweisen');
assert(!html.includes('width: 28px; height: 32px;'), 'Asymmetrische Maße 28x32px dürfen nicht mehr existieren');
assert(!html.includes('width: 54px; height: 60px;'), 'Asymmetrische Maße 54x60px dürfen nicht mehr existieren');
assert(!js.includes('width: 32px; height: 36px;'), 'Asymmetrische Maße 32x36px dürfen im client.js nicht mehr existieren');
assert(!js.includes('width: 26px; height: 30px;'), 'Asymmetrische Maße 26x30px dürfen im client.js nicht mehr existieren');

// 5.3 Kein Transform: Scale in Keyframes (Zero Jitter)
const voidMatch = html.match(/@keyframes voidCrystalFloat\s*\{([^}]+)\}/);
assert(voidMatch && !voidMatch[1].includes('scale('), 'voidCrystalFloat darf kein transform: scale mehr enthalten');
const ghostMatch = html.match(/@keyframes ghostSpecterFloat\s*\{([^}]+)\}/);
assert(ghostMatch && !ghostMatch[1].includes('scale('), 'ghostSpecterFloat darf kein transform: scale mehr enthalten');
const turnMatch = html.match(/@keyframes avatarActiveTurnPulse\s*\{([^}]+)\}/);
assert(turnMatch && !turnMatch[1].includes('scale('), 'avatarActiveTurnPulse darf kein transform: scale mehr enthalten');

// 5.4 Magier-Titel State-Sync & Plaketten
assert(js.includes('currentUser = user || null;'), 'setCachedUser muss currentUser synchronisieren');
assert(js.includes('u.title === itemId'), 'checkIfEquipped muss u.title === itemId prüfen');
assert(html.includes('.player-title-badge'), '.player-title-badge muss im CSS definiert sein');
assert(html.includes('.player-title-badge.title-rarity-legendary'), 'Seltenheitsfarben für Titel müssen definiert sein');
assert(js.includes('function getTitleBadgeHtml(titleName)'), 'getTitleBadgeHtml muss existieren');

// 5.5 Vollwertige Spielkarten-Rücken & Stirnkarte
const cardBackDecks = [
  'default', 'citadel_ancient', 'parchment', 'forest', 'spider_queen',
  'shadow', 'pumpkin_king', 'gravestone_runes', 'astral', 'dragon'
];
cardBackDecks.forEach(deckId => {
  assert(html.includes(`.card.card-back.cardback-theme-${deckId}`) || html.includes(`.cardback-theme-${deckId}`), `Kartenrücken-Klasse für ${deckId} fehlt im CSS`);
});
assert(js.includes('cardback-theme-${myCardBack}'), 'Stirnkarte in client.js muss das ausgerüstete Deck rendern');
assert(js.includes('card-3d-back'), '3D-Kartenflug muss Rückseite unterstützen');

// 5.6 Tisch-Vignette & Rand-Artworks
assert(html.includes('rgba(0, 0, 0, 0.35) 100%'), 'Tisch-Vignette muss auf 0.35 aufgehellt sein');
const feltSvg = fs.readFileSync(path.join(tablesDir, 'table_emerald_felt.svg'), 'utf8');
assert(feltSvg.includes('Akanthus') || feltSvg.includes('KORDELBORDÜRE'), 'emerald_felt muss Rand-Bordüre und Akanthus-Spangen enthalten');
const woodSvg = fs.readFileSync(path.join(tablesDir, 'table_tavern_wood.svg'), 'utf8');
assert(woodSvg.includes('Eckbeschläge') || woodSvg.includes('Kanten-Eisenbänder'), 'tavern_wood muss Kanten-Eisenbänder und Eckbeschläge enthalten');
const amethystSvg = fs.readFileSync(path.join(tablesDir, 'table_amethyst_crypt.svg'), 'utf8');
assert(amethystSvg.includes('KANTENRUNEN') && amethystSvg.includes('KRISTALLCLUSTER'), 'amethyst_crypt muss Kantenrunen und Kristallcluster enthalten');
const volcanoSvg = fs.readFileSync(path.join(tablesDir, 'table_volcano_keep.svg'), 'utf8');
assert(volcanoSvg.includes('BASALTKANTEN') || volcanoSvg.includes('Magmarisse'), 'volcano_keep muss Basaltkanten und Magmarisse enthalten');
const astralSvg = fs.readFileSync(path.join(tablesDir, 'table_astral_observatory.svg'), 'utf8');
assert(astralSvg.includes('TIERKREISKRANZ') || astralSvg.includes('ASTROLABIUM'), 'astral_observatory muss Tierkreiskranz oder Astrolabium enthalten');
const cryptSvg = fs.readFileSync(path.join(tablesDir, 'table_haunted_crypt.svg'), 'utf8');
assert(cryptSvg.includes('STEINGESIMS') || cryptSvg.includes('WASSERSPEIER'), 'haunted_crypt muss Steingesims oder Wasserspeier enthalten');
// 5.7 Android Assets Synchronisation & Modale
const androidIndex = path.join(__dirname, '../android/app/src/main/assets/public/index.html');
assert(fs.existsSync(androidIndex), 'android assets index.html muss existieren');
const androidHtml = fs.readFileSync(androidIndex, 'utf8');
assert(androidHtml.includes('#4d2d14') && androidHtml.includes('#281406'), 'Android index.html muss synchronisiert sein (#4d2d14)');
assert(js.includes('playerDetailAvatar') && js.includes('getTitleBadgeHtml(title)'), 'playerDetailModal muss Titel-Badge und Avatar unterstützen');

console.log('✓ Kosmetik- und UI-Feinjustierung vollständig verifiziert.');

console.log('================================================================');
console.log('🏆 ALLE PRÜFUNGEN FÜR AAA-SPIELTISCH-QUALITÄT ERFOLGREICH BESTANDEN!');
console.log('================================================================');
