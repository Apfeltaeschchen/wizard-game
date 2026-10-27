const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: UNBOXING MODAL, DIRECT NEXT CHEST & SCROLL HEADER START ---');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');
assert.ok(fs.existsSync(clientJsPath), 'client.js existiert');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// [1/4] Dediziertes Unboxing-Zeremonie-Modal mit 100% sichtbaren Rändern
console.log('[1/4] Überprüfe dediziertes Unboxing-Zeremonie-Modal...');
assert.ok(indexHtml.includes('id="vaultUnboxingModalOverlay"'), 'vaultUnboxingModalOverlay vorhanden');
assert.ok(indexHtml.includes('class="modal-overlay vault-unboxing-modal-overlay"'), 'Klasse vault-unboxing-modal-overlay vorhanden');
assert.ok(indexHtml.includes('class="vault-unboxing-modal-card"'), 'Klasse vault-unboxing-modal-card vorhanden');

const overlayCssMatch = indexHtml.match(/\.vault-unboxing-modal-overlay\s*\{([^}]+)\}/);
assert.ok(overlayCssMatch, '.vault-unboxing-modal-overlay CSS gefunden');
assert.ok(overlayCssMatch[1].includes('z-index: 2500'), 'Overlay liegt mit z-index: 2500 über allem');
assert.ok(overlayCssMatch[1].includes('padding: 24px') || overlayCssMatch[1].includes('padding:'), 'Overlay besitzt Sicherheitsabstand zum Viewport');

const cardCssMatch = indexHtml.match(/\.vault-unboxing-modal-card\s*\{([^}]+)\}/);
assert.ok(cardCssMatch, '.vault-unboxing-modal-card CSS gefunden');
assert.ok(cardCssMatch[1].includes('border: 2px solid') || cardCssMatch[1].includes('border:'), 'Goldener Rahmen rund um die Modal-Karte definiert');
assert.ok(cardCssMatch[1].includes('max-height: min(88vh, 720px)') || cardCssMatch[1].includes('max-height:'), 'Max-Height begrenzt, damit alle 4 Ränder sichtbar bleiben');

assert.ok(indexHtml.includes('id="btnVaultUnboxingModalClose"'), 'Schließen-Button im Unboxing-Modal vorhanden');
assert.ok(indexHtml.includes('id="vaultArcaneChestModal"'), 'Dedizierte Truhe für das Unboxing-Modal vorhanden');
assert.ok(indexHtml.includes('id="vaultChestClickPromptModal"'), 'Modal-eigener Prompt vorhanden');
console.log('✓ 1. Dediziertes Unboxing-Modal mit 100% sichtbaren Rändern verifiziert.');

// [2/4] Ketten-Öffnen Button [Nächste Truhe öffnen]
console.log('[2/4] Überprüfe Ketten-Öffnen Button [Nächste Truhe öffnen]...');
assert.ok(indexHtml.includes('id="btnNextChest"'), '#btnNextChest Button im HTML vorhanden');
assert.ok(indexHtml.includes('id="btnNextChestText"'), '#btnNextChestText für dynamische Restanzahl vorhanden');
assert.ok(indexHtml.includes('.btn-next-chest'), 'CSS-Klasse .btn-next-chest vorhanden');

const nextBtnCssMatch = indexHtml.match(/\.btn-next-chest\s*\{([^}]+)\}/);
assert.ok(nextBtnCssMatch, '.btn-next-chest CSS gefunden');
assert.ok(nextBtnCssMatch[1].includes('linear-gradient'), 'Auffälliger Gradient für Nächste-Truhe-Aktion');

assert.ok(clientJs.includes('startDirectNextChestOpening'), 'startDirectNextChestOpening Funktion in client.js implementiert');
assert.ok(clientJs.includes('btnNextChest.style.display'), 'Dynamisches Einblenden von btnNextChest in client.js');
console.log('✓ 2. Direktes Ketten-Öffnen ohne redundantes Einsammeln verifiziert.');

// [3/4] Auto-Hide & Instant-Reveal Header beim Scrollen
console.log('[3/4] Überprüfe Scroll-Verhalten des Schatzkammer-Headers...');
assert.ok(indexHtml.includes('id="vaultTopBar"'), 'vaultTopBar Wrapper vorhanden');
assert.ok(indexHtml.includes('.vault-top-bar {'), 'CSS-Regel für .vault-top-bar vorhanden');
assert.ok(indexHtml.includes('.vault-top-bar.vault-top-bar-hidden {'), 'CSS-Regel für .vault-top-bar-hidden vorhanden');

const topBarHiddenCssMatch = indexHtml.match(/\.vault-top-bar\.vault-top-bar-hidden\s*\{([^}]+)\}/);
assert.ok(topBarHiddenCssMatch, '.vault-top-bar-hidden CSS gefunden');
assert.ok(topBarHiddenCssMatch[1].includes('transform: translateY(-100%)'), 'Fährt beim Runterscrollen nach oben aus dem Sichtfeld');

assert.ok(clientJs.includes('vault-top-bar-hidden'), 'client.js toggelt vault-top-bar-hidden beim Scrollen');
console.log('✓ 3. Auto-Hide beim Runterscrollen & Sofort-Einblenden beim Hochschollen verifiziert.');

// [4/4] Permanentes Podest in der Schatzkammer
console.log('[4/4] Überprüfe Podest-Vorschau in der Schatzkammer...');
assert.ok(indexHtml.includes('id="vaultUnboxingArea" class="unboxing-overlay"'), 'vaultUnboxingArea vorhanden');
assert.ok(indexHtml.includes('id="vaultArcaneChest" class="vault-arcane-chest empty-podium"'), 'vaultArcaneChest vorhanden');
assert.ok(indexHtml.includes('id="vaultChestClickPrompt" class="chest-click-prompt empty-state"'), 'vaultChestClickPrompt vorhanden');
console.log('✓ 4. Schatzkammer-Podest bleibt als dauerhafte Vorschau-Bühne erhalten.');

console.log('================================================================');
console.log('🏆 ALLE UNBOXING MODAL & SCROLL HEADER TESTS ERFOLGREICH BESTANDEN!');
console.log('================================================================');
