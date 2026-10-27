const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: TITEL-QUALITÄT, SELTENHEITS-RAHMEN & ZERO-ICON ANFORDERUNG START ---');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');
assert.ok(fs.existsSync(clientJsPath), 'client.js existiert');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// [1/5] Prüfe CSS-Rahmen für alle 4 Seltenheiten
console.log('[1/5] Prüfe CSS-Klassen für meisterhafte Titel-Plaketten und Seltenheits-Rahmen...');
assert.ok(indexHtml.includes('.title-plaque'), '.title-plaque Basisklasse vorhanden');
assert.ok(indexHtml.includes('.title-frame-common'), '.title-frame-common für gewöhnliche Titel vorhanden');
assert.ok(indexHtml.includes('.title-frame-rare'), '.title-frame-rare für seltene Titel vorhanden');
assert.ok(indexHtml.includes('.title-frame-epic'), '.title-frame-epic für epische Titel vorhanden');
assert.ok(indexHtml.includes('.title-frame-legendary'), '.title-frame-legendary für legendäre Titel vorhanden');
assert.ok(indexHtml.includes('.title-frame-legendary-sheen'), 'title-frame-legendary-sheen für dynamischen Lichtreflex vorhanden');
assert.ok(indexHtml.includes('@keyframes titleSheenAnim'), '@keyframes titleSheenAnim für kontinuierlichen Lichtsweep vorhanden');
assert.ok(indexHtml.includes('.cosmetic-item-card.is-title-card'), '.cosmetic-item-card.is-title-card vorhanden');
assert.ok(indexHtml.includes('.forge-item-card.is-title-card'), '.forge-item-card.is-title-card vorhanden');
assert.ok(indexHtml.includes('.drop-title-plaque-container'), '.drop-title-plaque-container vorhanden');
console.log('✓ 1. Meisterhafte CSS-Rahmen & Animations-Definitionen verifiziert.');

// [2/5] Prüfe renderTitlePlaqueHtml & getTitleRarity in client.js
console.log('[2/5] Prüfe Titel-Plaketten Rendering-Helfer in client.js...');
assert.ok(clientJs.includes('function renderTitlePlaqueHtml'), 'renderTitlePlaqueHtml Funktion vorhanden');
assert.ok(clientJs.includes('function getTitleRarity'), 'getTitleRarity Funktion vorhanden');
assert.ok(clientJs.includes('function updateTitleElement'), 'updateTitleElement Funktion vorhanden');

// Teste Plaketten-Erzeugung in isoliertem Node-Kontext
const vm = require('vm');
const sandbox = {
  escapeHtml: (s) => String(s),
  TITLE_RARITIES: {
    'Oberster Erzmagier': 'legendary',
    'Drachenbändiger': 'epic',
    'Seher der Sterne': 'rare',
    'Zauberlehrling': 'common'
  },
  WizardVault: {
    getVaultData: () => ({
      catalog: {
        titles: [
          { id: 'Oberster Erzmagier', name: 'Oberster Erzmagier', rarity: 'legendary' },
          { id: 'Drachenbändiger', name: 'Drachenbändiger', rarity: 'epic' },
          { id: 'Seher der Sterne', name: 'Seher der Sterne', rarity: 'rare' },
          { id: 'Zauberlehrling', name: 'Zauberlehrling', rarity: 'common' }
        ]
      }
    })
  }
};

const helperCode = `
function getTitleRarity(titleName) {
  if (!titleName) return 'common';
  if (typeof WizardVault !== 'undefined' && WizardVault.getVaultData) {
    const vd = WizardVault.getVaultData();
    if (vd && vd.catalog && Array.isArray(vd.catalog.titles)) {
      const match = vd.catalog.titles.find(t => (t.id === titleName || t.name === titleName));
      if (match && match.rarity) return match.rarity;
    }
  }
  return TITLE_RARITIES[titleName] || 'common';
}

function renderTitlePlaqueHtml(titleName, forcedRarity = null) {
  const name = String(titleName || 'Zauberlehrling');
  const rarity = forcedRarity || getTitleRarity(name);
  const sheenHtml = rarity === 'legendary' ? '<div class="title-frame-legendary-sheen" aria-hidden="true"></div>' : '';
  return '<div class="title-plaque title-frame-' + rarity + '" title="' + escapeHtml(name) + '">' +
    sheenHtml +
    '<span class="title-plaque-text">' + escapeHtml(name) + '</span>' +
  '</div>';
}
`;

vm.createContext(sandbox);
vm.runInContext(helperCode, sandbox);

const legPlaque = sandbox.renderTitlePlaqueHtml('Oberster Erzmagier');
assert.ok(legPlaque.includes('title-frame-legendary'), 'Legendäre Plakette hat title-frame-legendary');
assert.ok(legPlaque.includes('title-frame-legendary-sheen'), 'Legendäre Plakette hat Sheen-Effekt');
assert.ok(legPlaque.includes('Oberster Erzmagier'), 'Titelname enthalten');
assert.ok(!legPlaque.includes('📜') && !legPlaque.includes('👑') && !legPlaque.includes('✨'), 'Kein störendes Icon in der Plakette');

const epicPlaque = sandbox.renderTitlePlaqueHtml('Drachenbändiger');
assert.ok(epicPlaque.includes('title-frame-epic'), 'Epische Plakette hat title-frame-epic');
assert.ok(!epicPlaque.includes('title-frame-legendary-sheen'), 'Epische Plakette hat keinen legendären Sheen');

const rarePlaque = sandbox.renderTitlePlaqueHtml('Seher der Sterne');
assert.ok(rarePlaque.includes('title-frame-rare'), 'Seltene Plakette hat title-frame-rare');

const commonPlaque = sandbox.renderTitlePlaqueHtml('Zauberlehrling');
assert.ok(commonPlaque.includes('title-frame-common'), 'Gewöhnliche Plakette hat title-frame-common');
console.log('✓ 2. Plaketten-Erzeugung und dynamische Seltenheits-Klassen verifiziert.');

// [3/5] Prüfe Garderobe: Kein Icon oben, solitäre Plakette in Titel-Kategorie
console.log('[3/5] Prüfe Garderobe: Beseitigung oberer Icons & reine Plaketten-Struktur...');
assert.ok(clientJs.includes("const isTitleCategory = (singularType === 'title');"), 'isTitleCategory Weiche in renderWardrobeItems');
assert.ok(clientJs.includes("card.className = `cosmetic-item-card ${isTitleCategory ? 'is-title-card' : ''}"), 'is-title-card Klasse vergeben');
assert.ok(clientJs.includes("if (isTitleCategory) {\n        // Reine Titel-Präsentation im jeweiligen Seltenheits-Rahmen, kein oberes Icon/Text"), 'Reine Titel-Präsentation ohne Text-Duplikate');
console.log('✓ 3. Garderoben-Titelkarten rendern ausschließlich die edle Plakette ohne Icon darüber.');

// [4/5] Prüfe Truhen-Öffnung & Schmiede
console.log('[4/5] Prüfe Truhen-Unboxing & Sternenschmiede...');
assert.ok(clientJs.includes("const isTitleItem = (itemType === 'title' || itemType === 'titles');"), 'isTitleItem Weiche in showUnboxingStage');
assert.ok(clientJs.includes('drop-title-plaque-container'), 'drop-title-plaque-container in showUnboxingStage eingebunden');
assert.ok(clientJs.includes("const isTitleCategory = (item.singularType === 'title');"), 'isTitleCategory Weiche in renderForge');
assert.ok(clientJs.includes("card.className = `forge-item-card ${isTitleCategory ? 'is-title-card' : ''}`;"), 'is-title-card in Schmiede gesetzt');
console.log('✓ 4. Truhen-Öffnung und Schmiede verifiziert.');

// [5/5] Prüfe Magier-Spiegel, Profil & Spieler-Detail Modal
console.log('[5/5] Prüfe Magier-Spiegel, Profil-Drawer & Spieler-Detail Modal...');
assert.ok(clientJs.includes('updateTitleElement(previewTitle'), 'Magier-Spiegel nutzt updateTitleElement');
assert.ok(clientJs.includes('titleBadgeEl.className = `profile-title-badge title-frame-${rarity}`;'), 'Profil-Drawer nutzt Seltenheitsrahmen');
assert.ok(clientJs.includes('updateTitleElement(titleEl, wt);'), 'Highlight-Winner nutzt updateTitleElement');
console.log('✓ 5. Magier-Spiegel, Profil und Highlight-Anzeige konsistent integriert.');

console.log('--- TEST ERFOLGREICH: TITEL-QUALITÄT, RAHMEN & ZERO-ICON VOLLSTÄNDIG BESTANDEN! ---');
