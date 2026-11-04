const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST: WEIHNACHTS-LOBBY-HINTERGRÜNDE & AMBIENT-EFFEKTE START ---');

const cosmeticsDataPath = path.join(__dirname, '../server/cosmeticsData.js');
const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');
const backgroundsDir = path.join(__dirname, '../public/images/backgrounds');

assert.ok(fs.existsSync(cosmeticsDataPath), 'cosmeticsData.js existiert');
assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');
assert.ok(fs.existsSync(clientJsPath), 'client.js existiert');
assert.ok(fs.existsSync(backgroundsDir), 'public/images/backgrounds existiert');

const cosmeticsDataModule = require(cosmeticsDataPath);
const cosmeticsData = cosmeticsDataModule.COSMETICS_CATALOG;
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

const expectedLobbies = [
  'citadel_halls',
  'haunted_graveyard',
  'witch_hut',
  'tavern_fireplace',
  'astral_observatory',
  'magma_forge',
  'celestial_sanctum',
  'yule_hearth_hall',
  'winter_pine_forest',
  'toy_workshop_vault',
  'glacier_ice_palace',
  'aurora_observatory_peak'
];

// [1/5] Katalogprüfung
console.log('[1/5] Prüfe Katalogeinträge in cosmeticsData.js...');
assert.strictEqual(cosmeticsData.lobby_backgrounds.length, expectedLobbies.length, `Exakt ${expectedLobbies.length} Lobbies im Katalog`);
expectedLobbies.forEach(id => {
  assert.ok(cosmeticsData.lobby_backgrounds.some(b => b.id === id), `Lobby ${id} im Server-Katalog vorhanden`);
});
console.log(`✓ 1. Alle ${expectedLobbies.length} Lobbies im Server-Katalog validiert.`);

// [2/5] Asset-Dateiprüfung
console.log('[2/5] Prüfe Bilddateien im Dateisystem...');
expectedLobbies.forEach(id => {
  if (id === 'citadel_halls') {
    assert.ok(fs.existsSync(path.join(__dirname, '../public/images/lobby_bg.svg')), 'lobby_bg.svg existiert');
  } else {
    const file = path.join(backgroundsDir, `bg_${id}.jpg`);
    assert.ok(fs.existsSync(file), `Hintergrundbild bg_${id}.jpg existiert`);
    const stat = fs.statSync(file);
    assert.ok(stat.size > 20000, `bg_${id}.jpg ist nicht leer (${stat.size} Bytes)`);
  }
});
console.log('✓ 2. Alle Bilddateien vorhanden und nicht leer.');

// [3/5] CSS-Integration in index.html
console.log('[3/5] Prüfe CSS-Klassen und Miniatur-Vorschauen in index.html...');
expectedLobbies.forEach(id => {
  assert.ok(indexHtml.includes(`.theme-${id}`), `Theme-Klasse .theme-${id} in index.html vorhanden`);
  assert.ok(indexHtml.includes(`.lobby-theme-${id}`), `Miniaturklasse .lobby-theme-${id} in index.html vorhanden`);
});
console.log('✓ 3. CSS-Klassen und Miniatur-Vorschauen vollständig integriert.');

// [4/5] Ambient-Animationen
console.log('[4/5] Prüfe CSS-Ambient-Keyframes in index.html...');
const ambientKeyframes = [
  'hearthWarmthPulse',
  'gentleSnowFall',
  'workshopAmberBreathe',
  'frostPrismSweep',
  'auroraWavePulse'
];
ambientKeyframes.forEach(kf => {
  assert.ok(indexHtml.includes(`@keyframes ${kf}`), `Keyframe @keyframes ${kf} vorhanden`);
});
console.log('✓ 4. Alle 5 atmosphärischen Ambient-Keyframes vorhanden.');

// [5/5] Client-Integration in client.js
console.log('[5/5] Prüfe Client-Theme-Manager in client.js...');
expectedLobbies.forEach(id => {
  assert.ok(clientJs.includes(`'${id}'`), `Theme ${id} in applyLobbyTheme oder Fallback registriert`);
});
console.log('✓ 5. Client-Umschaltung und Fallback-Array verifiziert.');

console.log('\n================================================================');
console.log('🏆 ALLE 5 TESTS FÜR WEIHNACHTS-LOBBY-HINTERGRÜNDE BESTANDEN!');
console.log('================================================================');
