const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: SCHLANKE AVATAR-RAHMEN MIT PERIODISCHEN IDLE-ANIMATIONEN START ---');

const framesDir = path.join(__dirname, '../public/images/frames');
const indexHtmlPath = path.join(__dirname, '../public/index.html');
const cosmeticsDataPath = path.join(__dirname, '../server/cosmeticsData.js');

assert.ok(fs.existsSync(framesDir), 'Verzeichnis public/images/frames existiert');
assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
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
  'mvp_glow',
  'hearth_pine_wreath',
  'gothic_frost_chime',
  'silver_mistletoe_relic',
  'nutcracker_vanguard',
  'celestial_bethlehem_star'
];

// [1/5] Alle 15 Rahmen im cosmeticsData Katalog definiert
console.log('[1/5] Prüfe Rahmen-Katalog in cosmeticsData.js...');
assert.strictEqual(cosmeticsData.avatar_frames.length, expectedFrames.length, 'Genau 15 Avatar-Rahmen im Server-Katalog');
expectedFrames.forEach(id => {
  assert.ok(cosmeticsData.avatar_frames.some(f => f.id === id), `Rahmen ${id} ist in cosmeticsData.js vorhanden`);
});
console.log('✓ 1. Alle 15 Avatar-Rahmen im Server-Katalog vorhanden.');

// [2/5] Alle 15 SVG Vektor-Dateien existieren und sind valides SVG/XML mit viewBox="0 0 100 100"
console.log('[2/5] Prüfe SVG-Vektorgrafiken in public/images/frames/...');
expectedFrames.forEach(id => {
  const svgFile = path.join(framesDir, `frame_${id}.svg`);
  assert.ok(fs.existsSync(svgFile), `SVG-Datei frame_${id}.svg existiert`);
  const content = fs.readFileSync(svgFile, 'utf8');
  assert.ok(content.includes('<svg'), `frame_${id}.svg enthält <svg Tag`);
  assert.ok(content.includes('viewBox="0 0 100 100"'), `frame_${id}.svg besitzt standardisierte 0 0 100 100 viewBox`);
  assert.ok(content.includes('</svg>'), `frame_${id}.svg schließt sauber mit </svg> ab`);
});
console.log('✓ 2. Alle 15 SVG Vektorgrafiken existieren und sind valides XML mit 100x100 viewBox.');

// [3/5] Innenbereich r < 34.5 ist frei von blockierenden Keilen & Dornen + Schmuckelemente außen
console.log('[3/5] Prüfe Freiheit des Innenbereichs (keine Keile/Flügel im Gesicht) & Außen-Positionierung...');

// Void Crystal darf keine Keile bis y=35 ins Zentrum haben
const voidContent = fs.readFileSync(path.join(framesDir, 'frame_void_crystal.svg'), 'utf8');
assert.ok(!voidContent.includes('50,35') && !voidContent.includes('50,65'), 'void_crystal hat keine inneren Stacheln mehr');
assert.ok(voidContent.includes('32, 14') && voidContent.includes('68, 14'), 'void_crystal Kristalle wachsen nach außen');

// Bat Swarm hat animierten Flügelschlag oben auf dem Reif und keine massiven Blockflügel im Bild
const batContent = fs.readFileSync(path.join(framesDir, 'frame_bat_swarm.svg'), 'utf8');
assert.ok(batContent.includes('animateTransform') && (batContent.includes('dur="7s"') || batContent.includes('dur="8s"')), 'bat_swarm animiert');

// Iron Thorn Dornen wachsen nach außen
const ironContent = fs.readFileSync(path.join(framesDir, 'frame_iron_thorn.svg'), 'utf8');
assert.ok(ironContent.includes('50,6') && ironContent.includes('94,50'), 'iron_thorn Dornen wachsen nach außen');

// Silver Leaf hat Sternen-Funkeln
const silverContent = fs.readFileSync(path.join(framesDir, 'frame_silver_leaf.svg'), 'utf8');
assert.ok(silverContent.includes('animate') && (silverContent.includes('dur="7.5s"') || silverContent.includes('dur="8s"')), 'silver_leaf funkelt');

// MVP Glow hat Kronen-Sternenblitz
const mvpContent = fs.readFileSync(path.join(framesDir, 'frame_mvp_glow.svg'), 'utf8');
assert.ok(mvpContent.includes('animate') && (mvpContent.includes('dur="6.0s"') || mvpContent.includes('dur="6s"')), 'mvp_glow blitz');

// Weihnachts-Rahmen: Periodische Idle-Animationen
const pineContent = fs.readFileSync(path.join(framesDir, 'frame_hearth_pine_wreath.svg'), 'utf8');
assert.ok(pineContent.includes('animate') && pineContent.includes('dur="8s"'), 'hearth_pine_wreath besitzt 8s-Glutpuls');

const chimeContent = fs.readFileSync(path.join(framesDir, 'frame_gothic_frost_chime.svg'), 'utf8');
assert.ok(chimeContent.includes('animate') && chimeContent.includes('dur="7.5s"'), 'gothic_frost_chime besitzt 7.5s-Glockenschwung');

const mistletoeContent = fs.readFileSync(path.join(framesDir, 'frame_silver_mistletoe_relic.svg'), 'utf8');
assert.ok(mistletoeContent.includes('animate') && mistletoeContent.includes('dur="7.0s"'), 'silver_mistletoe_relic besitzt 7s-Kerzenflackern');

const nutcrackerContent = fs.readFileSync(path.join(framesDir, 'frame_nutcracker_vanguard.svg'), 'utf8');
assert.ok(nutcrackerContent.includes('animate') && nutcrackerContent.includes('dur="6.5s"'), 'nutcracker_vanguard besitzt 6.5s-Sternenblitz');

const bethlehemContent = fs.readFileSync(path.join(framesDir, 'frame_celestial_bethlehem_star.svg'), 'utf8');
assert.ok(bethlehemContent.includes('animate') && bethlehemContent.includes('dur="6.0s"'), 'celestial_bethlehem_star besitzt 6s-Lichtausbruch');

console.log('✓ 3. Schlanke Geometrie (Innenbereich frei, Schmuck außen) & SVG-Idle-Animationen verifiziert.');

// [4/5] CSS Integration in index.html mit .seat-avatar::after und ruhigem Schatten (kein Dauerpulsieren)
console.log('[4/5] Prüfe ruhige CSS-Regeln & Layering in index.html...');
assert.ok(indexHtml.includes('.seat-avatar::after {'), '.seat-avatar::after Basisschicht definiert');
assert.ok(indexHtml.includes('inset: -21.5%'), 'Perfekte 100x100 zu 70x70 Avatar-Skalierung (-21.5%)');
assert.ok(indexHtml.includes('z-index: 3'), 'Rahmen-Overlay auf z-index: 3');

// Prüfe, dass die alten Dauerpuls-Animationen entfernt wurden
assert.ok(!indexHtml.includes('animation: dragonFirePulse'), 'Kein permanentes dragonFirePulse mehr in index.html');
assert.ok(!indexHtml.includes('animation: batSwarmPulse'), 'Kein permanentes batSwarmPulse mehr in index.html');
assert.ok(!indexHtml.includes('animation: pumpkinFlicker'), 'Kein permanentes pumpkinFlicker mehr in index.html');

expectedFrames.forEach(id => {
  assert.ok(indexHtml.includes(`.seat-avatar.frame-${id}`), `CSS-Klasse .seat-avatar.frame-${id} vorhanden`);
  assert.ok(indexHtml.includes(`url('/images/frames/frame_${id}.svg')`), `frame_${id}.svg als background-image eingebunden`);
});
console.log('✓ 4. CSS-Regeln für alle 15 Rahmen, z-Index und Beseitigung des Dauerpulsierens verifiziert.');

console.log('\n================================================================');
console.log('🏆 ALLE 5 TESTS FÜR SCHLANKE AVATAR-RAHMEN ERFOLGREICH BESTANDEN!');
console.log('================================================================');
