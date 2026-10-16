const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createDeck } = require('../server/gameLogic');

console.log('🧪 Starte Test-Suite: Karten-Artworks & App-Icon Integration...');

// 1. Test: createDeck Vergabe von Varianten (1..4)
console.log('  1. Prüfe Server createDeck() für 4 Magier & 4 Scharlatane...');
const classicDeck = createDeck('classic');
const wizards = classicDeck.filter(c => c.type === 'wizard');
const jesters = classicDeck.filter(c => c.type === 'jester');

assert.strictEqual(wizards.length, 4, 'Es müssen genau 4 Erzmagier im Deck sein.');
assert.strictEqual(jesters.length, 4, 'Es müssen genau 4 Scharlatane im Deck sein.');

const expectedSuits = ['red', 'blue', 'green', 'yellow'];
for (let i = 0; i < 4; i++) {
  assert.strictEqual(wizards[i].variant, i + 1, `Erzmagier ${i} muss variant=${i + 1} haben.`);
  assert.strictEqual(wizards[i].variantSuit, expectedSuits[i], `Erzmagier ${i} muss variantSuit=${expectedSuits[i]} haben.`);
  assert.strictEqual(jesters[i].variant, i + 1, `Scharlatan ${i} muss variant=${i + 1} haben.`);
  assert.strictEqual(jesters[i].variantSuit, expectedSuits[i], `Scharlatan ${i} muss variantSuit=${expectedSuits[i]} haben.`);
}
console.log('     ✅ createDeck() vergibt erfolgreich individuelle Varianten 1..4 für Magier & Scharlatane!');

// 2. Test: Prüfe Vorhandensein aller Artworks in public/images/cards/
console.log('  2. Prüfe Dateipräsenz aller hochgeladenen Artworks in public/images/cards/...');
const cardsDir = path.join(__dirname, '../public/images/cards');
const requiredCardFiles = [
  'archmage_1.png', 'archmage_2.png', 'archmage_3.png', 'archmage_4.png',
  'charlatan_1.png', 'charlatan_2.png', 'charlatan_3.png', 'charlatan_4.png',
  'bloodlord.png', 'doppelganger.png', 'himmelsschleier.png', 'lindwurm.png',
  'magiekollaps.png', 'moonbeast.png', 'shadowwitch.png', 'trickster.png',
  'unicorn.png', 'waldnymphe.png'
];

requiredCardFiles.forEach(file => {
  const filePath = path.join(cardsDir, file);
  assert(fs.existsSync(filePath), `Karten-Artwork ${file} muss in public/images/cards/ existieren!`);
  const stat = fs.statSync(filePath);
  assert(stat.size > 100000, `Karten-Artwork ${file} muss echtes hochauflösendes Bild sein (> 100KB, aktuell: ${stat.size} Bytes).`);
});
console.log('     ✅ Alle 18 hochauflösenden Karten-Artworks (Magier, Scharlatane, Sonderkarten) sind vollständig vorhanden!');

// 3. Test: Prüfe App-Icon & Android Mipmap-Ressourcen
console.log('  3. Prüfe App-Icon & Android Mipmap-Ressourcen...');
const iconPng = path.join(__dirname, '../public/images/icon.png');
assert(fs.existsSync(iconPng), 'public/images/icon.png muss existieren.');
const iconStat = fs.statSync(iconPng);
assert(iconStat.size > 50000, `App-Icon muss hochauflösend sein (> 50KB, aktuell: ${iconStat.size} Bytes).`);

const androidResDir = path.join(__dirname, '../android/app/src/main/res');
const mipmaps = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
const iconFiles = ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'];

mipmaps.forEach(m => {
  iconFiles.forEach(ic => {
    const p = path.join(androidResDir, m, ic);
    assert(fs.existsSync(p), `Android Icon ${m}/${ic} muss existieren!`);
    const s = fs.statSync(p);
    assert(s.size > 500, `Android Icon ${m}/${ic} darf nicht leer sein!`);
  });
});
console.log('     ✅ Alle Android Launcher-, Round- und Foreground-Icons in allen 5 Dichten verifiziert!');

// 4. Test: Prüfe HTML & Manifest Verknüpfung
console.log('  4. Prüfe HTML & Manifest Verknüpfung...');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
assert(html.includes('href="/images/icon.png"'), 'index.html muss /images/icon.png als Favicon/Icon verlinken.');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/manifest.json'), 'utf8'));
const hasPngIcon = manifest.icons.some(i => i.src === '/images/icon.png' && i.type === 'image/png');
assert(hasPngIcon, 'manifest.json muss /images/icon.png im icons-Array enthalten.');
console.log('     ✅ HTML & Manifest Verknüpfungen für icon.png erfolgreich verifiziert!');

// 5. Test: Prüfe client.js getCardArtworkFiles Logik & Bereinigung von card-mini-icon
console.log('  5. Prüfe getCardArtworkFiles() & Bereinigung der Ecksymbole in client.js...');
const clientJs = fs.readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');
assert(clientJs.includes('function getCardArtworkFiles(card)'), 'client.js muss getCardArtworkFiles() definieren.');
assert(clientJs.includes('archmage_${v}.png'), 'client.js muss archmage_${v}.png auflösen.');
assert(clientJs.includes('charlatan_${v}.png'), 'client.js muss charlatan_${v}.png auflösen.');
assert(!clientJs.includes('<div class="card-mini-icon">'), 'client.js darf keine card-mini-icon Elemente mehr in den Kartenecken rendern.');
assert(html.includes('.card-mini-icon') && html.includes('display: none !important;'), 'index.html muss .card-mini-icon auf display: none setzen.');
assert(html.includes('.forehead-floating-card .card .card-corner'), 'index.html muss kompakte Ecken für Stirnkarten definieren.');
console.log('     ✅ getCardArtworkFiles() Controller & saubere Ecken ohne Mini-Symbole erfolgreich verifiziert!');


// 6. Test: Prüfe Karten-UI-Feinschliff, reine Artwork-Karten & Flacker-Schutz
console.log('  6. Prüfe Farbkarten-Bereinigung, 100% reine Artworks & Flacker-Eliminierung...');
// a) Keine Namens-Labels mehr auf Zahlenkarten
assert(!clientJs.includes('${sName} ${card.value}'), 'client.js darf kein card-name-label (${sName} ${card.value}) mehr auf Farbkarten rendern.');

// b) 100% reine Kunstwerke: Ecken auf Artwork-Karten ausgeblendet
assert(
  html.includes('.card.card-has-artwork .card-corner') &&
  html.includes('display: none !important;'),
  'index.html muss .card.card-has-artwork .card-corner auf display: none !important setzen.'
);

// c) Farberkennung für Stirnkarten
assert(clientJs.includes('forehead-suit-badge'), 'client.js muss forehead-suit-badge für Stirnkarten in Runde 1 generieren.');
assert(clientJs.includes('forehead-suit-${p.round1Card.suit}'), 'client.js muss Stirnkarten mit Farbwappen forehead-suit-${p.round1Card.suit} versehen.');
assert(html.includes('.forehead-suit-badge'), 'index.html muss .forehead-suit-badge stylen.');
assert(html.includes('.forehead-floating-card .card.card-red'), 'index.html muss heraldische Glühfarben für Stirnkarten definieren.');

// d) Flacker-Schutz: DOM-sichere Bild-Montage & Intelligentes Hand-Rendering
assert(clientJs.includes('div.prepend(artImg)'), 'client.js muss artImg DOM-sicher via div.prepend(artImg) montieren.');
assert(clientJs.includes('getCardKey(card)'), 'client.js muss getCardKey() für intelligentes Hand-Re-Rendering definieren.');
assert(clientJs.includes('card.copiedCard ?'), 'client.js getCardKey muss copiedCard für Blutfürst/Vampir berücksichtigen.');
assert(clientJs.includes('inspectedCardIndex = null;'), 'client.js onHandCardClick muss inspectedCardIndex zurücksetzen können.');
const trickUpdatedBlock = clientJs.match(/socket\.on\('trickUpdated'[\s\S]*?\}\);/);
assert(trickUpdatedBlock && !trickUpdatedBlock[0].includes('renderHand()'), 'trickUpdated darf kein überflüssiges renderHand() ausführen.');

console.log('     ✅ Alle 4 Feinschliff- & Flacker-Kriterien erfolgreich verifiziert!');

console.log('\n======================================================');
console.log('🏆 ALLE KARTEN-ARTWORK & APP-ICON TESTS BESTANDEN!');
console.log('======================================================\n');
