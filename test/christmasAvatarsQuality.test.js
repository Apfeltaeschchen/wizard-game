const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST: WEIHNACHTS-AVATARE & AMBIENT-EFFEKTE START ---');

const cosmeticsDataPath = path.join(__dirname, '../server/cosmeticsData.js');
const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');
const avatarsDir = path.join(__dirname, '../public/images/avatars');

assert.ok(fs.existsSync(cosmeticsDataPath), 'cosmeticsData.js existiert');
assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');
assert.ok(fs.existsSync(clientJsPath), 'client.js existiert');
assert.ok(fs.existsSync(avatarsDir), 'public/images/avatars existiert');

const cosmeticsDataModule = require(cosmeticsDataPath);
const cosmeticsData = cosmeticsDataModule.COSMETICS_CATALOG;
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

const newChristmasAvatars = [
  { id: 'icon_yule_elf', rarity: 'common' },
  { id: 'icon_frost_golem', rarity: 'rare' },
  { id: 'icon_nutcracker_general', rarity: 'epic' },
  { id: 'icon_winter_queen', rarity: 'epic' },
  { id: 'icon_santa_archmage', rarity: 'legendary' }
];

// [1/5] Katalogprüfung
console.log('[1/5] Prüfe Katalogeinträge in cosmeticsData.js...');
assert.strictEqual(cosmeticsData.avatar_icons.length, 14, 'Genau 14 Avatare im Server-Katalog (1 Default + 13 Artworks)');
const defaultAvatars = cosmeticsData.avatar_icons.filter(a => a.isDefault);
assert.strictEqual(defaultAvatars.length, 1, 'Exakt 1 Standard-Avatar im Katalog');
assert.strictEqual(defaultAvatars[0].id, 'default', 'Standard-Avatar ist Initialen-Medaillon (id: default)');

newChristmasAvatars.forEach(av => {
  const item = cosmeticsData.avatar_icons.find(a => a.id === av.id);
  assert.ok(item, `Avatar ${av.id} im Katalog vorhanden`);
  assert.strictEqual(item.rarity, av.rarity, `Avatar ${av.id} hat korrekte Seltenheit ${av.rarity}`);
  assert.ok(item.image, `Avatar ${av.id} hat Bildpfad`);
  assert.ok(item.lore, `Avatar ${av.id} hat Lore`);
});
console.log('✓ 1. Alle 5 neuen Weihnachts-Avatare im Server-Katalog validiert.');

// [2/5] Asset-Dateiprüfung
console.log('[2/5] Prüfe PNG-Bilddateien im Dateisystem...');
newChristmasAvatars.forEach(av => {
  const file = path.join(avatarsDir, `${av.id}.png`);
  assert.ok(fs.existsSync(file), `Bilddatei ${av.id}.png existiert`);
  const stat = fs.statSync(file);
  assert.ok(stat.size > 100000, `${av.id}.png ist valide hochauflösende Datei (${stat.size} Bytes)`);
});
console.log('✓ 2. Alle Bilddateien vorhanden und valide.');

// [3/5] CSS-Integration & Keyframes in index.html
console.log('[3/5] Prüfe CSS-Klassen und Ambient-Keyframes in index.html...');
newChristmasAvatars.forEach(av => {
  assert.ok(indexHtml.includes(`.avatar-img-${av.id}`), `CSS-Klasse .avatar-img-${av.id} vorhanden`);
});

const expectedKeyframes = [
  'elfMischiefGlint',
  'golemFrostBreath',
  'nutcrackerHonorFlash',
  'winterQueenAura',
  'santaLegendaryRadiance'
];
expectedKeyframes.forEach(kf => {
  assert.ok(indexHtml.includes(`@keyframes ${kf}`), `Keyframe @keyframes ${kf} vorhanden`);
});
console.log('✓ 3. CSS-Klassen und alle 5 Animation-Keyframes vorhanden.');

// [4/5] Client-Integration in client.js
console.log('[4/5] Prüfe Client-Hooks in client.js...');
assert.ok(clientJs.includes('avatar-img-${a}'), 'Avatar-Img Hook mit dynamic class vorhanden');
assert.ok(clientJs.includes('avatar-img-${p.avatarId}'), 'Seat-Avatar-Img Hook mit dynamic class vorhanden');
console.log('✓ 4. Client-Rendering mit Avatar-Klassen verifiziert.');

// [5/5] Kompatibilität mit bestehenden Tests
console.log('[5/5] Prüfe Abwesenheit von Dummy-SVGs...');
const hasDummySvg = cosmeticsData.avatar_icons.some(a => a.id === 'wizard_red' || a.id === 'wizard_green');
assert.strictEqual(hasDummySvg, false, 'Keine Dummy-SVGs');
console.log('✓ 5. Keine Dummy-SVGs vorhanden.');

console.log('\n================================================================');
console.log('🏆 ALLE 5 TESTS FÜR WEIHNACHTS-AVATARE ERFOLGREICH BESTANDEN!');
console.log('================================================================');
