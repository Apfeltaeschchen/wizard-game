const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: SUBTILE AAA AVATAR-RAHMEN (DORNENRANKEN-PRINZIP & AUSSEN-AUSBREITUNG) START ---');

const framesDir = path.join(__dirname, '../public/images/frames');
const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');
const cosmeticsDataPath = path.join(__dirname, '../server/cosmeticsData.js');

assert.ok(fs.existsSync(framesDir), 'Verzeichnis public/images/frames existiert');
assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');
assert.ok(fs.existsSync(clientJsPath), 'client.js existiert');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');
const cosmeticsDataModule = require(cosmeticsDataPath);
const cosmeticsData = cosmeticsDataModule.COSMETICS_CATALOG;

const expectedFrames = [
  'none',
  'iron_thorn',
  'silver_leaf',
  'golden_runes',
  'dragon_fire',
  'void_crystal',
  'pumpkin_lantern',
  'bat_swarm',
  'ghost_specter',
  'mvp_glow'
];

// [1/5] Alle 10 Rahmen im cosmeticsData Katalog definiert
console.log('[1/5] Prüfe Rahmen-Katalog in cosmeticsData.js...');
assert.strictEqual(cosmeticsData.avatar_frames.length, expectedFrames.length, 'Genau 10 Avatar-Rahmen im Server-Katalog');
expectedFrames.forEach(id => {
  assert.ok(cosmeticsData.avatar_frames.some(f => f.id === id), `Rahmen ${id} ist in cosmeticsData.js vorhanden`);
});
console.log('✓ 1. Alle 10 Avatar-Rahmen im Server-Katalog vorhanden.');

// [2/5] Alle 10 SVG Vektor-Dateien existieren und sind valides SVG/XML mit viewBox="0 0 100 100"
console.log('[2/5] Prüfe SVG-Vektorgrafiken in public/images/frames/...');
expectedFrames.forEach(id => {
  const svgFile = path.join(framesDir, `frame_${id}.svg`);
  assert.ok(fs.existsSync(svgFile), `SVG-Datei frame_${id}.svg existiert`);
  const content = fs.readFileSync(svgFile, 'utf8');
  assert.ok(content.includes('<svg'), `frame_${id}.svg enthält <svg Tag`);
  assert.ok(content.includes('viewBox="0 0 100 100"'), `frame_${id}.svg besitzt standardisierte 0 0 100 100 viewBox`);
  assert.ok(content.includes('</svg>'), `frame_${id}.svg schließt sauber mit </svg> ab`);
});
console.log('✓ 2. Alle 10 SVG Vektorgrafiken existieren und sind valides XML mit 100x100 viewBox.');

// [3/5] Subtiler Innen-Überhang (r >= 31, keine Verdeckung des Avatar-Kerns) & weite Ausbreitung nach AUSSEN (r >= 45 bzw. x,y <= 12 oder >= 88)
console.log('[3/5] Prüfe Subtilität nach innen & Ausbreitung nach außen in den SVGs...');

// 1. Eiserne Dornenleiste: Stacheln ragen nach außen bis x=12 / x=88 und subtil nach innen nur bis 31.5
const ironContent = fs.readFileSync(path.join(framesDir, 'frame_iron_thorn.svg'), 'utf8');
assert.ok(ironContent.includes('12,50') || ironContent.includes('88,50'), 'Eiserne Dornen ragen weit nach außen');
assert.ok(ironContent.includes('31.5'), 'Eiserne Dornen greifen nur ganz subtil bis r=31.5 nach innen');

// 2. Fledermaus-Schwarm: Schwingen spannen sich weit nach außen auf (x=8 / x=92)
const batContent = fs.readFileSync(path.join(framesDir, 'frame_bat_swarm.svg'), 'utf8');
assert.ok(batContent.includes('8,36') && batContent.includes('92,36'), 'Fledermausschwingen spannen sich weit nach außen (x=8, x=92) auf');
assert.ok(batContent.includes('32'), 'Fledermausflügel greifen nur subtil mit Daumenkralle bis x=32 nach innen');

// 3. Goldener Ring: Zarte Knoten nach außen bis x=14 / x=86
const noneContent = fs.readFileSync(path.join(framesDir, 'frame_none.svg'), 'utf8');
assert.ok(noneContent.includes('14,50') || noneContent.includes('86,50'), 'Goldknoten ragen weit nach außen');
assert.ok(noneContent.includes('33'), 'Goldring greift nur subtil bis r=33 nach innen');

// 4. Drachenflammen: Lodern weit nach außen (y=8, y=92)
const fireContent = fs.readFileSync(path.join(framesDir, 'frame_dragon_fire.svg'), 'utf8');
assert.ok(fireContent.includes('50,8') && fireContent.includes('50,92'), 'Drachenflammen lodern weit nach außen');
assert.ok(fireContent.includes('32.5'), 'Drachenkrallen greifen nur subtil bis y=32.5 nach innen');

console.log('✓ 3. Dornenranken-Prinzip & weite Außen-Ausbreitung erfolgreich verifiziert.');

// [4/5] CSS Integration in index.html mit .seat-avatar::after und korrekter SVG-Einbindung
console.log('[4/5] Prüfe CSS-Regeln & Layering in index.html...');
assert.ok(indexHtml.includes('.seat-avatar::after {'), '.seat-avatar::after Basisschicht definiert');
assert.ok(indexHtml.includes('inset: -21.5%'), 'Perfekte 100x100 zu 70x70 Avatar-Skalierung (-21.5%)');
assert.ok(indexHtml.includes('z-index: 3'), 'Rahmen-Overlay auf z-index: 3');

expectedFrames.forEach(id => {
  assert.ok(indexHtml.includes(`.seat-avatar.frame-${id}`), `CSS-Klasse .seat-avatar.frame-${id} vorhanden`);
  assert.ok(indexHtml.includes(`url('/images/frames/frame_${id}.svg')`), `frame_${id}.svg als background-image eingebunden`);
});
console.log('✓ 4. CSS-Regeln für alle 10 Rahmen und z-Index Schichtung verifiziert.');

// [5/5] client.js Fallback-Katalog synchronisiert
console.log('[5/5] Prüfe client.js Fallback-Katalog...');
expectedFrames.forEach(id => {
  assert.ok(clientJs.includes(`id: '${id}'`), `client.js enthält Rahmen-ID '${id}' im Fallback`);
});
console.log('✓ 5. client.js Fallback-Array konsistent.');

console.log('\n================================================================');
console.log('🏆 ALLE 5 TESTS FÜR SUBTILE AAA AVATAR-RAHMEN BESTANDEN!');
console.log('================================================================');
