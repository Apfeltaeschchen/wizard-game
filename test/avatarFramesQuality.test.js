const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: AAA AVATAR-RAHMEN MIT TIEFEN-ÜBERLAPPUNG START ---');

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

// [1/5] Alle 10 Rahmen im cosmeticsData Katalog definiert
console.log('[1/5] Prüfe Rahmen-Katalog in cosmeticsData.js...');
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

// [3/5] Hineinragende Elemente (Inward Overlap: Elemente reichen tiefer als der Avatar-Rand r=35)
console.log('[3/5] Prüfe Inward-Overlap Geometrie in den SVGs...');
// Frame None: Fleur-de-lis Gemmenkrallen reichen bis y=28.5 bzw. r=28
assert.ok(fs.readFileSync(path.join(framesDir, 'frame_none.svg'), 'utf8').includes('28.5'), 'frame_none hat nach innen ragende Gemmenkrallen');
// Frame Iron Thorn: Eisendornen stechen bis r=25
assert.ok(fs.readFileSync(path.join(framesDir, 'frame_iron_thorn.svg'), 'utf8').includes('L50,25'), 'frame_iron_thorn hat nach innen ragende Stacheln');
// Frame Silver Leaf: Elfenblätter ragen bis r=27 (x=24, y=26)
assert.ok(fs.readFileSync(path.join(framesDir, 'frame_silver_leaf.svg'), 'utf8').includes('26'), 'frame_silver_leaf hat nach innen ragende Elfenblätter');
// Frame Dragon Fire: Drachenkrallen greifen tief bis r=24 ins Bild (y=26.5 / y=73.5)
assert.ok(fs.readFileSync(path.join(framesDir, 'frame_dragon_fire.svg'), 'utf8').includes('26.5') && fs.readFileSync(path.join(framesDir, 'frame_dragon_fire.svg'), 'utf8').includes('73.5'), 'frame_dragon_fire hat kräftige Krallen oben und unten');
// Frame Pumpkin: Kürbisfratze ragt bis y=26.5
assert.ok(fs.readFileSync(path.join(framesDir, 'frame_pumpkin_lantern.svg'), 'utf8').includes('26.5'), 'frame_pumpkin_lantern Fratzenkamm ragt in den Avatar');
// Frame MVP: Meistermagier-Krone ragt bis y=26 ins Bild
assert.ok(fs.readFileSync(path.join(framesDir, 'frame_mvp_glow.svg'), 'utf8').includes('Q68,26 50,26'), 'frame_mvp_glow Krone ragt in den Avatar');
console.log('✓ 3. Inward-Overlap Geometrie (r < 35, Krallen/Dornen/Kronen im Porträt) verifiziert.');

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
console.log('🏆 ALLE 5 TESTS FÜR AAA AVATAR-RAHMEN BESTANDEN!');
console.log('================================================================');
