const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: UNBOXING MODAL POLISH, ANTI-SPOILER & HOVER FIX START ---');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');
assert.ok(fs.existsSync(clientJsPath), 'client.js existiert');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// [1/4] Feste Modal-Größe
console.log('[1/4] Überprüfe feste Modal-Größe...');
const modalMatch = indexHtml.match(/\.vault-unboxing-modal-card\s*\{([^}]+)\}/);
assert.ok(modalMatch, '.vault-unboxing-modal-card gefunden');
assert.ok(modalMatch[1].includes('height: min(88vh, 670px)'), 'height: min(88vh, 670px) definiert');
assert.ok(modalMatch[1].includes('min-height: min(88vh, 670px)'), 'min-height: min(88vh, 670px) definiert');
assert.ok(indexHtml.includes('.vault-unboxing-modal-card .unboxing-stage'), 'Flexibles Zentrieren für unboxing-stage');
assert.ok(indexHtml.includes('.vault-unboxing-modal-card #vaultUnboxingDropsArea'), 'Flexibles Zentrieren für drops area');
console.log('✓ 1. Feste, einheitliche Modal-Größe verifiziert.');

// [2/4] Beseitigung der Geisterbox & sauberer 3D-Karten-Hover
console.log('[2/4] Überprüfe Beseitigung der Geisterbox beim Hovern...');
assert.ok(indexHtml.includes('.mystery-card-wrap.drop-card-reveal'), 'CSS-Überschreibung für Altlast-Klasse vorhanden');
assert.ok(indexHtml.includes('.mystery-card-wrap:not(.flipped):hover .mystery-card-inner'), 'Hover bewegt die innere 3D-Karte als Einheit');
assert.ok(!clientJs.includes("className = `mystery-card-wrap drop-card-reveal"), 'drop-card-reveal nicht mehr unnötig auf mystery-card-wrap gesetzt');
console.log('✓ 2. Geisterbox und Doppelrahmen beim Karten-Hover erfolgreich beseitigt.');

// [3/4] Anti-Spoiler für Astralstaub
console.log('[3/4] Überprüfe Anti-Spoiler für Astralstaub...');
const showStageMatch = clientJs.match(/function showUnboxingStage\(data\)\s*\{([\s\S]*?)\n  \}/);
assert.ok(showStageMatch, 'showUnboxingStage gefunden');
const showStageCode = showStageMatch[1];
assert.ok(showStageCode.includes("dustNotice.style.display = 'none'"), 'Staub-Hinweis startet strikt ausgeblendet');

const checkFlippedMatch = clientJs.match(/function checkAllCardsFlipped\(\)\s*\{([\s\S]*?)\n  \}/);
assert.ok(checkFlippedMatch, 'checkAllCardsFlipped gefunden');
const checkFlippedCode = checkFlippedMatch[1];
assert.ok(checkFlippedCode.includes("dustNotice.style.display = 'block'"), 'Staub-Hinweis wird erst bei verbleibenden 0 Karten eingeblendet');
assert.ok(indexHtml.includes('.dust-notice-animated'), 'Fade-In Animation für Staub-Hinweis definiert');
console.log('✓ 3. Anti-Spoiler verifiziert: Staub wird erst nach dem Enthüllen aller Karten gezeigt.');

// [4/4] Aufdeck-Pflicht vor Nächste Truhe / Fertig
console.log('[4/4] Überprüfe Aufdeck-Pflicht für Buttons...');
assert.ok(indexHtml.includes('.btn-unboxing-locked'), 'CSS für .btn-unboxing-locked vorhanden');
assert.ok(showStageCode.includes("btnNextChest.classList.add('btn-unboxing-locked')"), 'btnNextChest startet gesperrt');
assert.ok(showStageCode.includes("btnFinish.classList.add('btn-unboxing-locked')"), 'btnFinish startet gesperrt');
assert.ok(checkFlippedCode.includes("btnNext.classList.remove('btn-unboxing-locked')"), 'btnNextChest wird bei 0 verbleibenden Karten freigeschaltet');
assert.ok(checkFlippedCode.includes("btnFinish.classList.remove('btn-unboxing-locked')"), 'btnFinish wird bei 0 verbleibenden Karten freigeschaltet');

const nextChestMatch = clientJs.match(/function startDirectNextChestOpening\(tier\)\s*\{([\s\S]*?)\n  \}/);
assert.ok(nextChestMatch, 'startDirectNextChestOpening gefunden');
assert.ok(nextChestMatch[1].includes('unrevealed.length > 0'), 'Schutz vor Ausführung bei verdeckten Karten vorhanden');
console.log('✓ 4. Aufdeck-Pflicht verifiziert: Buttons sind gesperrt bis alle Karten aufgedeckt sind.');

console.log('================================================================');
console.log('🏆 ALLE PRÜFUNGEN FÜR MODAL-POLISH ERFOLGREICH BESTANDEN!');
console.log('================================================================');
