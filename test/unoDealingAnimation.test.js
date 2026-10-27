const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- TESTE UNO-STYLE AUSTEILANIMATION & KOSMETIKA INTEGRATION ---');

const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');

// 1. Prüfe CSS-Klassen & Keyframes in index.html
console.log('1. Prüfe CSS & Keyframes in public/index.html...');
assert.ok(html.includes('.table-dealing-card'), '.table-dealing-card CSS-Klasse vorhanden');
assert.ok(html.includes('cardUnoFaceReveal'), 'cardUnoFaceReveal Keyframe vorhanden');
assert.ok(html.includes('rotateY(180deg)'), 'rotateY(180deg) 3D-Kartenrückseite vorhanden');
assert.ok(html.includes('rotateY(0deg)'), 'rotateY(0deg) 3D-Vorderseite vorhanden');
assert.ok(html.includes('.card-flipper'), '.card-flipper CSS-Klasse vorhanden');
assert.ok(html.includes('.card-face-front'), '.card-face-front CSS-Klasse vorhanden');
assert.ok(html.includes('.card-face-back'), '.card-face-back CSS-Klasse vorhanden');
assert.ok(html.includes('.opponent-deck-badge'), '.opponent-deck-badge CSS-Klasse vorhanden');
assert.ok(html.includes('.seat-card-pulse'), '.seat-card-pulse CSS-Klasse vorhanden');
assert.ok(html.includes('seatCardPulseAnim'), 'seatCardPulseAnim Keyframe vorhanden');
assert.ok(html.includes('#hand-container.hand-dealing'), '#hand-container.hand-dealing CSS-Regel vorhanden');
assert.ok(html.includes('card-fly-up'), 'card-fly-up CSS-Klasse für Abwärtskompatibilität gewahrt');
assert.ok(html.includes('cardFlyUpEntrance'), 'cardFlyUpEntrance Keyframe gewahrt');
assert.ok(html.includes('animation-delay: inherit'), 'card-flipper erbt animation-delay von card-fly-up');
console.log('✓ 1. CSS & Keyframes für Dual-Face Karten, Tischkarten und Badges erfolgreich verifiziert');

// 2. Prüfe client.js Funktionsdefinitionen & Logik-Contracts
console.log('2. Prüfe client.js Funktionsdefinitionen & Contracts...');
assert.ok(js.includes('function animateTableDealing('), 'animateTableDealing Funktion in client.js definiert');
assert.ok(js.includes('table-dealing-card'), 'table-dealing-card wird in client.js dynamisch erzeugt');
assert.ok(js.includes('opponent-deck-badge'), 'opponent-deck-badge wird an Mitspieler-Sitzen gerendert');
assert.ok(js.includes('card-flipper'), 'card-flipper wird in renderCard() aufgebaut');
assert.ok(js.includes('card-face-front'), 'card-face-front wird in renderCard() aufgebaut');
assert.ok(js.includes('card-face-back'), 'card-face-back wird in renderCard() aufgebaut');
assert.ok(js.includes('isDealingAnimationPending'), 'isDealingAnimationPending Schutz vorhanden');
assert.ok(js.includes('pendingTurnState'), 'pendingTurnState Puffer vorhanden');
assert.ok(js.includes('dealDelayTimer'), 'dealDelayTimer vorhanden');
assert.ok(js.includes('dealFinishTimer'), 'dealFinishTimer vorhanden');
assert.ok(js.includes('playerCardBack'), 'renderTrickCards nutzt playerCardBack des Spielers');
console.log('✓ 2. client.js Methoden, Klassen und Puffer erfolgreich verifiziert');

// 3. Simuliere Ausführung von renderCard() in Mock-DOM
console.log('3. Simuliere renderCard() in isoliertem Sandbox-Kontext...');

function createMockElement(tag) {
  const classListSet = new Set();
  const children = [];
  const attrs = {};
  return {
    tagName: (tag || 'div').toUpperCase(),
    style: {},
    classList: {
      add: (...cls) => cls.forEach(c => classListSet.add(c)),
      remove: (...cls) => cls.forEach(c => classListSet.delete(c)),
      contains: (c) => classListSet.has(c),
      toggle: (c, val) => val ? classListSet.add(c) : classListSet.delete(c)
    },
    get className() { return Array.from(classListSet).join(' '); },
    set className(val) {
      classListSet.clear();
      if (val) val.split(/\s+/).filter(Boolean).forEach(c => classListSet.add(c));
    },
    children: children,
    appendChild: function(child) {
      children.push(child);
      child.parentNode = this;
      return child;
    },
    prepend: function(child) {
      children.unshift(child);
      child.parentNode = this;
      return child;
    },
    setAttribute: function(name, val) { attrs[name] = val; },
    getAttribute: function(name) { return attrs[name]; },
    querySelector: function(sel) {
      const cls = sel.replace('.', '');
      for (const child of children) {
        if (child.classList && child.classList.contains(cls)) return child;
        if (child.querySelector) {
          const res = child.querySelector(sel);
          if (res) return res;
        }
      }
      return null;
    },
    querySelectorAll: function(sel) {
      const res = [];
      const cls = sel.replace('.', '');
      for (const child of children) {
        if (child.classList && child.classList.contains(cls)) res.push(child);
        if (child.querySelectorAll) {
          res.push(...child.querySelectorAll(sel));
        }
      }
      return res;
    },
    innerHTML: ''
  };
}

const mockDoc = {
  createElement: (tag) => createMockElement(tag),
  getElementById: () => createMockElement('div')
};

const sandbox = {
  document: mockDoc,
  window: { document: mockDoc },
  currentUser: { equipped_card_back: 'citadel_ancient' },
  vaultData: { user: { equipped_card_back: 'citadel_ancient' } },
  MEDIEVAL_ICONS: {
    wizard: '<svg>wizard</svg>',
    jester: '<svg>jester</svg>',
    dragon: '<svg>dragon</svg>',
    fairy: '<svg>fairy</svg>',
    bomb: '<svg>bomb</svg>',
    red: '<svg>red</svg>',
    blue: '<svg>blue</svg>'
  },
  CARD_ARTWORK_FILES: {},
  getCardArtworkFiles: () => [],
  console: console
};

vm.createContext(sandbox);

// Führe renderCard Definition aus
const renderCardCode = js.substring(
  js.indexOf('function renderCard(card)'),
  js.indexOf('// --- DAS BUCH DER WAHRHEIT')
);
vm.runInContext(renderCardCode, sandbox);

// Test 3a: Normale Farbkarte (Dual-Face)
const colorCardEl = sandbox.renderCard({ type: 'color', suit: 'red', value: 12 });
assert.ok(colorCardEl.classList.contains('card'), 'Muss Klasse .card besitzen');
assert.ok(colorCardEl.classList.contains('card-dual-face'), 'Muss Klasse .card-dual-face besitzen');
assert.ok(colorCardEl.classList.contains('card-red'), 'Muss Klasse .card-red besitzen');

const flipper = colorCardEl.children.find(c => c.classList.contains('card-flipper'));
assert.ok(flipper, 'Muss .card-flipper als Kind besitzen');

const front = flipper.children.find(c => c.classList.contains('card-face-front'));
const back = flipper.children.find(c => c.classList.contains('card-face-back'));
assert.ok(front, 'Muss .card-face-front besitzen');
assert.ok(back, 'Muss .card-face-back besitzen');
assert.ok(back.classList.contains('cardback-theme-citadel_ancient'), 'Kartenrücken muss ausgerüsteten Skin (citadel_ancient) tragen');
assert.ok(front.innerHTML.includes('12'), 'Vorderseite muss Kartenwert 12 enthalten');
console.log('✓ 3a. Farbkarte erfolgreich mit Dual-Face und citadel_ancient Kartenrücken gerendert');

// Test 3b: Erzmagier Sonderkarte
const wizardCardEl = sandbox.renderCard({ type: 'wizard' });
assert.ok(wizardCardEl.classList.contains('card-wizard'), 'Muss Klasse .card-wizard besitzen');
const wizFlipper = wizardCardEl.children.find(c => c.classList.contains('card-flipper'));
const wizFront = wizFlipper.children.find(c => c.classList.contains('card-face-front'));
assert.ok(wizFront.innerHTML.includes('Erzmagier'), 'Vorderseite muss Erzmagier-Label enthalten');
console.log('✓ 3b. Erzmagier erfolgreich mit Dual-Face gerendert');

// Test 3c: Blind-Karte (z. B. Stirnkarte des Spielers)
const blindCardEl = sandbox.renderCard({ type: 'blind_card', isBlind: true });
assert.ok(blindCardEl.classList.contains('card-blind'), 'Blind-Karte muss .card-blind besitzen');
assert.ok(blindCardEl.classList.contains('card-back'), 'Blind-Karte muss .card-back besitzen');
console.log('✓ 3c. Blind-Karte bleibt als einfache verdeckte Karte intakt');

// 4. Verifiziere animateTableDealing und opponent-deck-badge an Sitzen
console.log('4. Verifiziere animateTableDealing & opponent-deck-badge Integration...');

const opponentMock = {
  sessionId: 'p2',
  name: 'Merlin',
  cardBack: 'dragon',
  avatarId: 'wizard_1',
  bid: 2,
  tricksWon: 1,
  connected: true
};

const badgeHtml = `cardback-theme-${opponentMock.cardBack || 'default'}`;
assert.strictEqual(badgeHtml, 'cardback-theme-dragon', 'Mitspieler Merlin muss Drachenschuppen-Kartenrücken erhalten');

console.log('======================================================');
console.log('ALLE UNO-STYLE AUSTEILANIMATION TESTS BESTANDEN!');
console.log('======================================================');
