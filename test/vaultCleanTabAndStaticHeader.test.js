/**
 * @file vaultCleanTabAndStaticHeader.test.js
 * Verifiziert die Optimierungen der Schatzkammer:
 * 1. Das redundante Podest (#vaultUnboxingArea) im Reiter "Truhe öffnen" ist visuell ausgeblendet (.unboxing-overlay, #vaultUnboxingArea -> display: none !important).
 * 2. Der Header (#vaultTopBar) bleibt statisch sichtbar und wird beim Runterscrollen NICHT mehr ausgeblendet.
 * 3. 2-Stufen Zeremonie: Klick auf Truhe öffnet erst das Modal mit ruhiger Truhe; Klick auf Truhe im Modal bricht das Siegel (Schütteln & Öffnen).
 * 4. Klick auf Truhenkarten oder "Nächste Truhe öffnen" öffnet das Modal im ruhigen Klick-Bereit-Zustand.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starte Testsuite: vaultCleanTabAndStaticHeader.test.js...');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

const clientJsPath = path.join(__dirname, '../public/client.js');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// TEST 1: Visuelle Ausblendung des redundanten Vorab-Podests im Tab 1
assert(
  indexHtml.includes('#vaultUnboxingArea') && indexHtml.includes('display: none !important;'),
  '❌ index.html muss #vaultUnboxingArea mit display: none !important ausblenden, damit das Hauptpanel aufgeräumt bleibt'
);
console.log('✅ TEST 1: Redundantes Podest (#vaultUnboxingArea) ist visuell ausgeblendet.');

// TEST 2: Header scroll hide listener entfernt
assert(
  !clientJs.includes("vaultTopBar.classList.add('vault-top-bar-hidden')"),
  '❌ client.js darf den Header nicht mehr beim Runterscrollen verbergen (vault-top-bar-hidden)'
);
console.log('✅ TEST 2: Header-Autohide beim Runterscrollen wurde erfolgreich deaktiviert.');

// TEST 3: openChestModal versetzt die Truhe in den ruhigen Wartezustand
assert(
  clientJs.includes("modalChest.classList.remove('empty-podium', 'shaking', 'bursting');"),
  '❌ openChestModal muss die Truhe im Modal zunächst ruhig anzeigen (shaking/bursting entfernt)'
);
assert(
  clientJs.includes("promptModal.innerHTML = `<span>✨</span><span>Klicke auf die Truhe, um das Siegel zu brechen!</span><span>✨</span>`"),
  '❌ openChestModal muss den Aufforderungstext zum Klick auf die Truhe setzen'
);
console.log('✅ TEST 3: openChestModal initialisiert die Truhe im ruhigen Wartezustand.');

// TEST 4: Klick auf die Truhe im Modal ist an handleChestClick verdrahtet
assert(
  clientJs.includes("const modalChest = document.getElementById('vaultArcaneChestModal');") &&
  clientJs.includes("modalChest.addEventListener('click', handleChestClick);"),
  '❌ vaultArcaneChestModal muss ein Klick-Event für handleChestClick registriert haben'
);
assert(
  clientJs.includes("const promptModalEl = document.getElementById('vaultChestClickPromptModal');") &&
  clientJs.includes("promptModalEl.addEventListener('click', handleChestClick);"),
  '❌ vaultChestClickPromptModal muss ein Klick-Event für handleChestClick registriert haben'
);
console.log('✅ TEST 4: Klick auf Truhe und Aufforderung im Modal löst handleChestClick aus.');

// TEST 5: handleChestClick fügt shaking hinzu und startet Zeremonie
assert(
  clientJs.includes("modalChest.className = `vault-arcane-chest tier-${activeUnboxingTier} shaking`;"),
  '❌ handleChestClick muss der Modal-Truhe die Klasse shaking zuweisen'
);
console.log('✅ TEST 5: handleChestClick setzt shaking auf modalChest.');

// TEST 6: selectTierOnPodium ruft openChestModal auf
assert(
  clientJs.includes("function selectTierOnPodium(tier)") &&
  clientJs.includes("openChestModal(tier);"),
  '❌ selectTierOnPodium muss openChestModal(tier) aufrufen'
);
console.log('✅ TEST 6: Klick auf Truhenkarten in der unteren Auswahl ruft direkt openChestModal(tier) auf.');

// TEST 7: startDirectNextChestOpening ruft openChestModal auf
assert(
  clientJs.includes("function startDirectNextChestOpening(tier)") &&
  clientJs.includes("openChestModal(targetTier);"),
  '❌ startDirectNextChestOpening muss openChestModal(targetTier) aufrufen'
);
console.log('✅ TEST 7: startDirectNextChestOpening ruft direkt openChestModal(targetTier) auf.');

console.log('🎉 ALLE TESTS IN vaultCleanTabAndStaticHeader.test.js ERFOLGREICH BESTANDEN!');
