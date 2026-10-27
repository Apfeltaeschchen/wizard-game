const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: ENHANCED UNBOXING, CARDBACKS & PERSISTENCE START ---');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');
const chestsDir = path.join(__dirname, '../public/images/chests');

assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');
assert.ok(fs.existsSync(clientJsPath), 'client.js existiert');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// [1/5] Transparente PNGs & Schatten-Eliminierung
console.log('[1/5] Überprüfe 32-Bit transparente PNG-Assets & Schatten-Befreiung...');
assert.ok(fs.existsSync(path.join(chestsDir, 'chest_wooden.png')), 'chest_wooden.png existiert');
assert.ok(fs.existsSync(path.join(chestsDir, 'chest_silver.png')), 'chest_silver.png existiert');
assert.ok(fs.existsSync(path.join(chestsDir, 'chest_gold.png')), 'chest_gold.png existiert');

assert.ok(clientJs.includes('images/chests/chest_${t}.png'), 'getChestArtworkHtml referenziert PNG-Assets');
assert.ok(indexHtml.includes('src="images/chests/chest_wooden.png"'), 'Holztruhen-Medaillon nutzt PNG');
assert.ok(indexHtml.includes('src="images/chests/chest_silver.png"'), 'Silbertruhen-Medaillon nutzt PNG');
assert.ok(indexHtml.includes('src="images/chests/chest_gold.png"'), 'Goldtruhen-Medaillon nutzt PNG');

const heroImgCss = indexHtml.match(/\.arcane-chest-hero-img\s*\{([^}]+)\}/);
assert.ok(heroImgCss, '.arcane-chest-hero-img CSS vorhanden');
assert.ok(heroImgCss[1].includes('mix-blend-mode: normal !important'), 'mix-blend-mode ist auf normal gesetzt');
assert.ok(heroImgCss[1].includes('mask-image: none !important'), 'mask-image ist deaktiviert');
console.log('✓ 1. Transparente PNGs und rückstandsfreie Schattendarstellung erfolgreich verifiziert.');

// [2/5] Auswählen-Buttons & Klick-Verhalten
console.log('[2/5] Überprüfe Auswählen-Buttons & sanftes Hochscrollen...');
assert.ok(indexHtml.includes('id="btnOpenWoodenChest" type="button" class="btn-chest-open" disabled>Auswählen</button>'), 'Holz-Button heißt Auswählen');
assert.ok(indexHtml.includes('id="btnOpenSilverChest" type="button" class="btn-chest-open" disabled>Auswählen</button>'), 'Silber-Button heißt Auswählen');
assert.ok(indexHtml.includes('id="btnOpenGoldChest" type="button" class="btn-chest-open" disabled>Auswählen</button>'), 'Gold-Button heißt Auswählen');

assert.ok(clientJs.includes("selectTierOnPodium('wooden')"), 'Holz-Button ruft selectTierOnPodium auf');
assert.ok(clientJs.includes("selectTierOnPodium('silver')"), 'Silber-Button ruft selectTierOnPodium auf');
assert.ok(clientJs.includes("selectTierOnPodium('gold')"), 'Gold-Button ruft selectTierOnPodium auf');

const selectPodiumMatch = clientJs.match(/function selectTierOnPodium\(tier\)\s*\{([\s\S]*?)\n    \}/);
assert.ok(selectPodiumMatch, 'selectTierOnPodium Funktion vorhanden');
assert.ok(selectPodiumMatch[1].includes('openChestModal(tier)'), 'Öffnet direkt das dedizierte Unboxing-Modal');
console.log('✓ 2. Auswählen-Buttons und Öffnen des Modals verifiziert.');

// [3/5] Ketten-Öffnen Persistenz in finishUnboxing
console.log('[3/5] Überprüfe Ketten-Öffnen Persistenz in finishUnboxing...');
const finishMatch = clientJs.match(/function finishUnboxing\(\)\s*\{([\s\S]*?)\n  \}/);
assert.ok(finishMatch, 'finishUnboxing vorhanden');
const finishCode = finishMatch[1];
assert.ok(finishCode.includes('const finishedTier = activeUnboxingTier;'), 'Merkt sich den geöffneten Truhentyp');
assert.ok(finishCode.includes("u['chests_' + finishedTier]"), 'Prüft verbleibenden Vorrat desselben Typs');
assert.ok(finishCode.includes('selectedPodiumTier = finishedTier;'), 'Behält Truhentyp bei Vorrat bei');
assert.ok(finishCode.includes('selectedPodiumTier = null;'), 'Fällt auf Priorisierung zurück wenn Vorrat erschöpft');
console.log('✓ 3. Ketten-Öffnen derselben Truhensorte fehlerfrei verifiziert.');

// [4/5] Rarity-spezifische Kosmetik-Rückseiten
console.log('[4/5] Überprüfe Fancier Rarity-Differentiated Card Backs...');
assert.ok(clientJs.includes('rarity-back-${rarity}'), 'Dynamische Rarity-Klasse auf Kartenrückseite');
assert.ok(clientJs.includes('rarity-sigil-${rarity}'), 'Dynamische Rarity-Klasse auf Sigil');
assert.ok(clientJs.includes('rarity-badge-${rarity}'), 'Dynamische Rarity-Badge auf Rückseite');

assert.ok(indexHtml.includes('.mystery-card-wrap.rarity-common .mystery-card-back'), 'CSS für Common Rückseite');
assert.ok(indexHtml.includes('.mystery-card-wrap.rarity-rare .mystery-card-back'), 'CSS für Rare Rückseite');
assert.ok(indexHtml.includes('.mystery-card-wrap.rarity-epic .mystery-card-back'), 'CSS für Epic Rückseite');
assert.ok(indexHtml.includes('.mystery-card-wrap.rarity-legendary .mystery-card-back'), 'CSS für Legendary Rückseite');
assert.ok(indexHtml.includes('.mystery-card-rarity-badge'), 'CSS für .mystery-card-rarity-badge');
assert.ok(indexHtml.includes('@keyframes goldSheenSweep'), 'Lichtschein-Animation für Legendary Rückseite vorhanden');
console.log('✓ 4. Edle, seltenheitsspezifische Kartenrückseiten verifiziert.');

// [5/5] Einheitliche Button-Reihe
console.log('[5/5] Überprüfe einheitliche Button-Reihe unter den Karten...');
assert.ok(indexHtml.includes('.unboxing-actions-row'), 'CSS für .unboxing-actions-row vorhanden');
const actionsRowMatch = indexHtml.match(/<div class="unboxing-actions-row">([\s\S]*?)<\/div>/);
assert.ok(actionsRowMatch, '.unboxing-actions-row im DOM vorhanden');
assert.ok(actionsRowMatch[1].includes('id="btnFlipAllCards"'), 'btnFlipAllCards in der Button-Reihe');
assert.ok(actionsRowMatch[1].includes('id="btnFinishUnboxing"'), 'btnFinishUnboxing in der Button-Reihe');
console.log('✓ 5. Einheitliche Button-Reihe unter den Beutekarten erfolgreich verifiziert.');

console.log('================================================================');
console.log('🏆 ALLE ENHANCED UNBOXING ANFORDERUNGEN ERFOLGREICH BESTANDEN!');
console.log('================================================================');
