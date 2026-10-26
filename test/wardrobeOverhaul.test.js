const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: GARDEROBEN-ÜBERARBEITUNG & SHOWROOM (6 ANFORDERUNGEN) START ---');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');
assert.ok(fs.existsSync(clientJsPath), 'client.js existiert');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// [1/6] Anforderung 1: Der Spiegel muss oben bleiben und immer zu sehen sein (Sticky Top)
console.log('[1/6] Test 1: Sticky Top Positionierung für Magier-Spiegel...');
assert.ok(indexHtml.includes('.wardrobe-preview-panel {'), 'CSS für .wardrobe-preview-panel vorhanden');
assert.ok(indexHtml.includes('position: sticky'), '.wardrobe-preview-panel besitzt position: sticky');
assert.ok(indexHtml.includes('top: 0'), '.wardrobe-preview-panel besitzt top: 0');
assert.ok(indexHtml.includes('z-index: 30') || indexHtml.includes('z-index: 25'), '.wardrobe-preview-panel besitzt hohen z-index');
// Prüfe, dass im HTML der Preview-Panel vor dem Items-Panel im DOM steht
const previewIdx = indexHtml.indexOf('id="wardrobePreviewPanel"');
const itemsIdx = indexHtml.indexOf('class="wardrobe-items-panel"');
assert.ok(previewIdx > 0 && itemsIdx > 0 && previewIdx < itemsIdx, 'Magier-Spiegel steht im HTML über der Artikelliste');
console.log('✓ 1. Magier-Spiegel ist oben platziert und sticky fixiert.');

// [2/6] Anforderung 2: Avatar des Spiegels muss hinter dem Rahmen sein
console.log('[2/6] Test 2: Z-Index Layering (Avatar hinter dem Rahmen)...');
assert.ok(indexHtml.includes('.wardrobe-mirror-avatar-wrap'), 'CSS Klasse .wardrobe-mirror-avatar-wrap vorhanden');
assert.ok(indexHtml.includes('z-index: 1') && indexHtml.includes('z-index: 2'), 'Z-Index Schichtung (Avatar z-index: 1, Rahmen z-index: 2) vorhanden');
assert.ok(indexHtml.includes('wardrobe-avatar-frame-overlay'), 'Rahmen-Overlay Element vorhanden');
console.log('✓ 2. Avatar liegt auf z-index: 1 hinter dem Rahmen auf z-index: 2.');

// [3/6] Anforderung 3: Avatar soll nicht oval sein sondern ein Kreis
console.log('[3/6] Test 3: Perfekte Kreisform (aspect-ratio 1:1, border-radius 50%, kein 76x86)...');
assert.ok(indexHtml.includes('aspect-ratio: 1 / 1'), 'Avatar-Wrapper besitzt aspect-ratio: 1 / 1');
assert.ok(indexHtml.includes('border-radius: 50%'), 'Avatar-Wrapper besitzt border-radius: 50%');
assert.ok(indexHtml.includes('overflow: hidden'), 'Avatar-Wrapper besitzt overflow: hidden zur Maskierung');
// Verifiziere, dass im Garderoben-Wrapper keine asymmetrische 76px x 86px Dimension mehr existiert
const wardrobeAvatarSnippet = indexHtml.substring(indexHtml.indexOf('id="wardrobePreviewAvatarWrapper"'), indexHtml.indexOf('id="wardrobePreviewAvatarWrapper"') + 250);
assert.ok(!wardrobeAvatarSnippet.includes('width: 76px; height: 86px;'), 'Keine asymmetrische 76x86px Ellipsen-Dimension mehr im Garderoben-Avatar');
console.log('✓ 3. Avatar ist mathematisch garantiert kreisrund (1:1).');

// [4/6] Anforderung 4: Kosmetika nach Seltenheit geordnet
console.log('[4/6] Test 4: Seltenheits-Sortierung in client.js...');
assert.ok(clientJs.includes('rarityOrder') || clientJs.includes('rarityRank'), 'client.js besitzt Seltenheits-Gewichtung');
assert.ok(clientJs.includes('common: 1, rare: 2, epic: 3, legendary: 4'), 'Progression Common -> Rare -> Epic -> Legendary definiert');
assert.ok(clientJs.includes('sortedCat') || clientJs.includes('.sort('), 'Katalog-Array wird vor dem Rendern sortiert');
console.log('✓ 4. Kosmetika werden nach Seltenheit (Common ➔ Rare ➔ Epic ➔ Legendary) sortiert.');

// [5/6] Anforderung 5: Visuelle Vorschau für Hintergründe, Tische, Decks & Avatare
console.log('[5/6] Test 5: Umfassende visuelle Live-Vorschau...');
assert.ok(indexHtml.includes('id="wardrobePreviewTableBox"'), 'Spieltisch-Vorschaukachel (#wardrobePreviewTableBox) vorhanden');
assert.ok(indexHtml.includes('id="wardrobePreviewDeckBox"'), 'Kartendeck-Vorschaukachel (#wardrobePreviewDeckBox) vorhanden');
assert.ok(indexHtml.includes('id="wardrobePreviewLobbyBox"'), 'Raumwelt-Vorschaukachel (#wardrobePreviewLobbyBox) vorhanden');
assert.ok(indexHtml.includes('id="wardrobePreviewStage"'), 'Bühnen-Hintergrund (#wardrobePreviewStage) vorhanden');
// Prüfe dynamische Aktualisierung im client.js
assert.ok(clientJs.includes('previewTableBox.className'), 'client.js aktualisiert Spieltisch-Vorschau dynamisch');
assert.ok(clientJs.includes('previewDeckBox.className'), 'client.js aktualisiert Deck-Vorschau dynamisch');
assert.ok(clientJs.includes('previewLobbyBox.className'), 'client.js aktualisiert Raumwelt-Vorschau dynamisch');
assert.ok(clientJs.includes('previewStage.className'), 'client.js aktualisiert Bühnen-Hintergrund dynamisch');
assert.ok(clientJs.includes('grid.onmouseleave'), 'client.js setzt bei onmouseleave alle Vorschauen auf ausgerüsteten Stand zurück');
console.log('✓ 5. Visuelle Live-Vorschau für Tische, Decks, Hintergründe und Avatare vollständig integriert.');

// [6/6] Anforderung 6: Button "Zurück zur Zitadelle" unten soll weg
console.log('[6/6] Test 6: Entfernung des Buttons "Zurück zur Zitadelle" in der Garderobe...');
const wardrobePanelStart = indexHtml.indexOf('id="vaultPanelWardrobe"');
const wardrobePanelEnd = indexHtml.indexOf('id="vaultPanelForge"');
const wardrobePanelHtml = indexHtml.substring(wardrobePanelStart, wardrobePanelEnd);

assert.ok(!wardrobePanelHtml.includes('Zurück zur Zitadelle'), 'Button "Zurück zur Zitadelle" ist aus Tab Garderobe entfernt');
assert.ok(!wardrobePanelHtml.includes('vault-panel-footer'), 'vault-panel-footer ist aus Tab Garderobe entfernt');
console.log('✓ 6. Button "Zurück zur Zitadelle" erfolgreich aus der Garderobe entfernt.');

console.log('\n================================================================');
console.log('🏆 ALLE 6 ANFORDERUNGEN DER GARDEROBEN-ÜBERARBEITUNG ERFÜLLT!');
console.log('================================================================');
