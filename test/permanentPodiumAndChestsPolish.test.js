const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: PERMANENTES TRUHEN-PODEST, KREISRUNDES X & POLISH START ---');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');
assert.ok(fs.existsSync(clientJsPath), 'client.js existiert');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// [1/6] Test 1: Kreisrundes X (.unboxing-close-btn und #cardLightboxClose)
console.log('[1/6] Test 1: Kreisrundes X (.unboxing-close-btn und #cardLightboxClose)...');
assert.ok(indexHtml.includes('.unboxing-close-btn {'), 'CSS-Regel für .unboxing-close-btn existiert');
const closeBtnCssMatch = indexHtml.match(/\.unboxing-close-btn\s*\{([^}]+)\}/);
assert.ok(closeBtnCssMatch, '.unboxing-close-btn CSS-Block gefunden');
const closeBtnCss = closeBtnCssMatch[1];
assert.ok(closeBtnCss.includes('padding: 0 !important;'), 'padding: 0 !important vorhanden');
assert.ok(closeBtnCss.includes('width: 36px;'), 'width: 36px vorhanden');
assert.ok(closeBtnCss.includes('height: 36px;'), 'height: 36px vorhanden');
assert.ok(closeBtnCss.includes('aspect-ratio: 1 / 1;'), 'aspect-ratio: 1 / 1 vorhanden');
assert.ok(closeBtnCss.includes('border-radius: 50%;'), 'border-radius: 50% vorhanden');
assert.ok(closeBtnCss.includes('box-sizing: border-box;'), 'box-sizing: border-box vorhanden');

const lightboxBtnMatch = indexHtml.match(/id="cardLightboxClose"[^>]*style="([^"]+)"/);
assert.ok(lightboxBtnMatch, '#cardLightboxClose Button im HTML gefunden');
const lightboxBtnStyle = lightboxBtnMatch[1];
assert.ok(lightboxBtnStyle.includes('border-radius: 50%'), '#cardLightboxClose besitzt border-radius: 50%');
assert.ok(lightboxBtnStyle.includes('aspect-ratio: 1 / 1'), '#cardLightboxClose besitzt aspect-ratio: 1 / 1');
assert.ok(lightboxBtnStyle.includes('padding: 0 !important'), '#cardLightboxClose besitzt padding: 0 !important');
assert.ok(lightboxBtnStyle.includes('box-sizing: border-box'), '#cardLightboxClose besitzt box-sizing: border-box');
console.log('✓ 1. X-Schließen-Buttons sind mathematisch garantiert kreisrund (1:1 Aspect Ratio, kein Oval).');

// [2/6] Test 2: Entfernung "Zurück zur Zitadelle" aus Tab 1 und Tab 3
console.log('[2/6] Test 2: Prüfung der Fußzeilen in Tab 1 und Tab 3...');
const tab1ChestsMatch = indexHtml.match(/id="vaultPanelChests"[\s\S]*?id="vaultPanelWardrobe"/);
assert.ok(tab1ChestsMatch, 'Tab 1 (vaultPanelChests) gefunden');
assert.ok(!tab1ChestsMatch[0].includes('vault-panel-footer'), 'Tab 1 enthält keinen vault-panel-footer mehr');
assert.ok(!tab1ChestsMatch[0].includes('Zurück zur Zitadelle'), 'Tab 1 enthält keinen "Zurück zur Zitadelle" Button mehr');

const tab3ForgeMatch = indexHtml.match(/id="vaultPanelForge"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
assert.ok(tab3ForgeMatch, 'Tab 3 (vaultPanelForge) gefunden');
assert.ok(!tab3ForgeMatch[0].includes('vault-panel-footer'), 'Tab 3 enthält keinen vault-panel-footer mehr');
assert.ok(!tab3ForgeMatch[0].includes('Zurück zur Zitadelle'), 'Tab 3 enthält keinen "Zurück zur Zitadelle" Button mehr');
console.log('✓ 2. "Zurück zur Zitadelle" Footers restlos aus Tab 1 und Tab 3 entfernt.');

// [3/6] Test 3: Keine JPEG-Bounding-Box-Schatten mehr
console.log('[3/6] Test 3: Überprüfe Entfernung von drop-shadow auf .arcane-chest-hero-img und .chest-icon-visual...');
const heroImgCssMatch = indexHtml.match(/\.arcane-chest-hero-img\s*\{([^}]+)\}/);
assert.ok(heroImgCssMatch, '.arcane-chest-hero-img CSS-Block gefunden');
assert.ok(!heroImgCssMatch[1].includes('drop-shadow'), 'Kein drop-shadow auf .arcane-chest-hero-img');

const heroHoverMatches = indexHtml.match(/\.vault-arcane-chest[\s\S]*?hover[\s\S]*?\.arcane-chest-hero-img\s*\{([^}]+)\}/g) || [];
heroHoverMatches.forEach(rule => {
  assert.ok(!rule.includes('drop-shadow'), `Hover-Regel enthält keinen drop-shadow: ${rule}`);
});

const chestIconCssMatch = indexHtml.match(/\.chest-icon-visual\s*\{([^}]+)\}/);
assert.ok(chestIconCssMatch, '.chest-icon-visual CSS-Block gefunden');
assert.ok(!chestIconCssMatch[1].includes('drop-shadow'), 'Kein drop-shadow auf .chest-icon-visual (keine doppelte Bounding-Box Trübung)');
console.log('✓ 3. Bounding-Box Schatten restlos von .arcane-chest-hero-img und .chest-icon-visual entfernt.');

// [4/6] Test 4: Beruhigte Kisten-Hover (Zero unruhige Rotationen & kein Compound Overzoom)
console.log('[4/6] Test 4: Überprüfe Kisten-Hover (keine unruhigen Rotationen & kein Compound-Zoom)...');
const chestIconHoverMatch = indexHtml.match(/\.chest-card:hover\s+\.chest-icon-visual\s*\{([^}]+)\}/);
assert.ok(chestIconHoverMatch, '.chest-card:hover .chest-icon-visual gefunden');
assert.ok(!chestIconHoverMatch[1].includes('rotate'), 'Kein rotate in .chest-card:hover .chest-icon-visual');

const chestVectorHoverMatch = indexHtml.match(/\.chest-card:hover\s+\.chest-vector-badge\s*\{([^}]+)\}/);
assert.ok(chestVectorHoverMatch, '.chest-card:hover .chest-vector-badge gefunden');
assert.ok(!chestVectorHoverMatch[1].includes('rotate'), 'Kein rotate in .chest-card:hover .chest-vector-badge');

const chestMedallionHoverMatch = indexHtml.match(/\.chest-card:hover\s+\.chest-medallion-img\s*\{([^}]+)\}/);
assert.ok(chestMedallionHoverMatch, '.chest-card:hover .chest-medallion-img gefunden');
assert.ok(!chestMedallionHoverMatch[1].includes('scale(1.12)'), 'Kein übersteuerter 1.12x Compound-Zoom auf .chest-medallion-img');
console.log('✓ 4. Kisten-Hover ist beruhigt und wackelfrei (skaliert sauber ohne Verkippung & Overzoom).');

// [5/6] Test 5: Permanente Podest-Bühne im HTML & client.js
console.log('[5/6] Test 5: Feste Podest-Bühne (kein Layout-Jumping & sauberer initialer HTML-State)...');
assert.ok(!indexHtml.includes('id="vaultUnboxingArea" class="unboxing-overlay" style="display: none;"'), 'vaultUnboxingArea ist im HTML NICHT mehr auf display: none versteckt');
assert.ok(indexHtml.includes('id="vaultUnboxingArea" class="unboxing-overlay"'), 'vaultUnboxingArea ist dauerhaft präsent');
assert.ok(indexHtml.includes('.vault-arcane-chest.empty-podium'), 'CSS für .empty-podium vorhanden');
assert.ok(indexHtml.includes('.chest-click-prompt.empty-state'), 'CSS für .empty-state Prompt vorhanden');

// Initialer HTML-Zustand des Podests (muss leer starten, damit kein Aufblitzen stattfindet)
assert.ok(indexHtml.includes('id="vaultArcaneChest" class="vault-arcane-chest empty-podium"'), 'Initialer DOM-Zustand ist leeres Podest');
assert.ok(indexHtml.includes('id="vaultChestClickPrompt" class="chest-click-prompt empty-state"'), 'Initialer Prompt ist empty-state');

// Prüfe finishUnboxing in client.js
const finishUnboxMatch = clientJs.match(/function finishUnboxing\(\)\s*\{([\s\S]*?)\n  \}/);
assert.ok(finishUnboxMatch, 'finishUnboxing in client.js gefunden');
const finishUnboxCode = finishUnboxMatch[1];
assert.ok(!finishUnboxCode.includes("unbox.style.display = 'none'"), 'finishUnboxing versteckt das Podest NICHT mehr auf display: none');
assert.ok(finishUnboxCode.includes("unbox.style.display = 'flex'"), 'finishUnboxing hält das Podest dauerhaft auf display: flex');
assert.ok(finishUnboxCode.includes('renderChests()'), 'finishUnboxing ruft renderChests() auf');
assert.ok(!finishUnboxCode.includes('tier-wooden'), 'finishUnboxing erzwingt nicht fälschlich tier-wooden vor renderChests()');
console.log('✓ 5. Podest-Bühne bleibt dauerhaft geöffnet, kein Layout-Jumping nach oben/unten.');

// [6/6] Test 6: Priorisierung (schlechteste zuerst) & State Machine Simulation
console.log('[6/6] Test 6: Priorisierung (schlechteste zuerst) & State Machine Simulation...');
assert.ok(clientJs.includes('function getPrioritizedAvailableTier()'), 'getPrioritizedAvailableTier implementiert');
assert.ok(clientJs.includes('function updatePodiumDisplay()'), 'updatePodiumDisplay implementiert');
assert.ok(clientJs.includes('function selectTierOnPodium(tier)'), 'selectTierOnPodium implementiert');

// Extrahiere getPrioritizedAvailableTier zur Ausführung
const prioMatch = clientJs.match(/function getPrioritizedAvailableTier\(\)\s*\{([\s\S]*?)\n  \}/);
assert.ok(prioMatch, 'getPrioritizedAvailableTier Funktionsrumpf gefunden');
const getPrioTierFunc = new Function('vaultData', prioMatch[1]);

// Testfall A: Alle 3 vorhanden -> Holz muss gewinnen (schlechteste zuerst)
const resAll = getPrioTierFunc({ user: { chests_wooden: 2, chests_silver: 1, chests_gold: 1 } });
assert.strictEqual(resAll, 'wooden', 'Priorisiert Holz vor Silber und Gold');

// Testfall B: Nur Silber und Gold vorhanden -> Silber muss gewinnen
const resSilverGold = getPrioTierFunc({ user: { chests_wooden: 0, chests_silver: 3, chests_gold: 1 } });
assert.strictEqual(resSilverGold, 'silver', 'Priorisiert Silber vor Gold');

// Testfall C: Nur Gold vorhanden -> Gold gewinnt
const resGoldOnly = getPrioTierFunc({ user: { chests_wooden: 0, chests_silver: 0, chests_gold: 2 } });
assert.strictEqual(resGoldOnly, 'gold', 'Zeigt Gold an wenn keine anderen Truhen vorhanden sind');

// Testfall D: 0 Truhen vorhanden -> null (leeres Podest)
const resNone = getPrioTierFunc({ user: { chests_wooden: 0, chests_silver: 0, chests_gold: 0 } });
assert.strictEqual(resNone, null, 'Gibt null zurück für leeres Podest bei 0 Truhen');

// Cache-Busting Check
assert.ok(indexHtml.includes('client.js?v=20261027_permanent_podium'), 'client.js Cache-Busting auf v=20261027_permanent_podium gesetzt');

console.log('✓ 6. Priorisierungs-Logik (Holz ➔ Silber ➔ Gold ➔ Leer) fehlerfrei verifiziert.');

console.log('================================================================');
console.log('🏆 ALLE ANFORDERUNGEN ERFOLGREICH VERIFIZIERT!');
console.log('================================================================');
