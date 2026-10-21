const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Starte Test-Suite: Minimalist Seats, Player Profile Modal, Grimoire Z-Index & Stirnkarten...');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// 1. Verifiziere das Magier-Profil Modal (#player-detail-modal) in index.html
console.log('  1. Prüfe HTML-Struktur von #player-detail-modal...');
assert(indexHtml.includes('id="player-detail-modal"'), '#player-detail-modal fehlt in index.html');
assert(indexHtml.includes('id="playerDetailAvatar"'), '#playerDetailAvatar fehlt');
assert(indexHtml.includes('id="playerDetailName"'), '#playerDetailName fehlt');
assert(indexHtml.includes('id="playerDetailTitle"'), '#playerDetailTitle fehlt');
assert(indexHtml.includes('id="playerDetailStatus"'), '#playerDetailStatus fehlt');
assert(indexHtml.includes('id="playerDetailRankBox"'), '#playerDetailRankBox fehlt');
assert(indexHtml.includes('id="playerDetailDivision"'), '#playerDetailDivision fehlt');
assert(indexHtml.includes('id="playerDetailSR"'), '#playerDetailSR fehlt');
assert(indexHtml.includes('id="playerDetailStatsTitle"'), '#playerDetailStatsTitle fehlt');
assert(indexHtml.includes('id="playerDetailStatsGrid"'), '#playerDetailStatsGrid fehlt');
assert(indexHtml.includes('id="btnPlayerDetailAddFriend"'), '#btnPlayerDetailAddFriend fehlt');
assert(indexHtml.includes('id="btnPlayerDetailClose"'), '#btnPlayerDetailClose fehlt');
assert(indexHtml.includes('id="playerDetailModalClose"'), '#playerDetailModalClose fehlt');
console.log('     ✅ #player-detail-modal Struktur ist vollständig!');

// 2. Verifiziere Grimoire der Gefährten: CSS-Balance, Fixed-Position & Z-Index
console.log('  2. Prüfe Grimoire der Gefährten CSS-Balance & Z-Index 2500...');
const styleMatch = indexHtml.match(/<style>([\s\S]*?)<\/style>/);
assert(styleMatch, 'Style-Tag in index.html nicht gefunden');
let depth = 0;
for (const c of styleMatch[1]) {
  if (c === '{') depth++;
  if (c === '}') depth--;
}
assert.strictEqual(depth, 0, `CSS-Klammern in index.html müssen perfekt balanciert sein (Tiefe: ${depth})`);
assert(indexHtml.includes('#companions-drawer') && indexHtml.includes('z-index: 2500 !important;'),
  '#companions-drawer muss z-index: 2500 !important besitzen');
assert(indexHtml.includes('#companions-drawer') && indexHtml.includes('position: fixed !important;'),
  '#companions-drawer muss position: fixed !important besitzen');
assert(indexHtml.includes('@media (min-width: 769px)') && indexHtml.includes('#drawer-backdrop') && indexHtml.includes('display: none !important;'),
  'Desktop-Backdrop sollte bei >= 769px ausgeblendet sein');
assert(clientJs.includes("CompanionsManager.close()"), 'CompanionsManager.close() fehlt im Backdrop/Drawer-Cleanup');
assert(clientJs.includes("e.key === 'Escape'"), 'Escape-Key-Handler fehlt in client.js');
console.log('     ✅ Grimoire der Gefährten liegt garantiert fest über dem Spieltisch!');

// 3. Verifiziere die minimalistischen Sitze & Mobile Styles
console.log('  3. Prüfe minimalistische Sitze und Mobile Responsive Regeln...');
assert(indexHtml.includes('.seat-dealer-pin'), '.seat-dealer-pin CSS fehlt in index.html');
assert(indexHtml.includes('.player-seat .seat-name-row') && indexHtml.includes('display: none !important;'),
  'Auf mobilen Geräten muss der Name-Row ausgeblendet werden');
assert(indexHtml.includes('.player-seat .seat-avatar') && indexHtml.includes('width: 28px !important;'),
  'Mobile Avatar muss kompakt sein (28px)');
console.log('     ✅ Minimalistische Sitze & Smartphone-Medaillons erfolgreich validiert!');

// 4. Verifiziere Stirnkarte in Runde 1 (Drittes Magie-Auge & Clearance)
console.log('  4. Prüfe schwebende Stirnkarten-Animation & Runde-1 Clearance...');
assert(indexHtml.includes('@keyframes foreheadCardFloat'), '@keyframes foreheadCardFloat fehlt in CSS');
assert(indexHtml.includes('.forehead-floating-card'), '.forehead-floating-card CSS fehlt in index.html');
assert(indexHtml.includes('#opponents-container.round-1-opponents'), '.round-1-opponents CSS fehlt');
assert(clientJs.includes("opponentsContainer.classList.toggle('round-1-opponents', currentRound === 1)"),
  'renderOpponents muss .round-1-opponents schalten');
assert(clientJs.includes('class="forehead-floating-card"'), 'renderOpponents muss .forehead-floating-card verwenden');
console.log('     ✅ Stirnkarten-Animation und Floating-Klasse erfolgreich validiert!');

// 5. Verifiziere goldenen Atem-Puls um den aktiven Spieler-Avatar
console.log('  5. Prüfe goldenen Atem-Puls um den aktiven Spieler-Avatar...');
assert(indexHtml.includes('@keyframes avatarActiveTurnPulse'), '@keyframes avatarActiveTurnPulse fehlt');
assert(indexHtml.includes('.player-seat.seat-active-turn .seat-avatar'),
  '.player-seat.seat-active-turn .seat-avatar Selector fehlt');
assert(indexHtml.includes('.my-stats-hud.my-turn-active'), '.my-stats-hud.my-turn-active fehlt in CSS');
assert(clientJs.includes("myHud.classList.toggle('my-turn-active', isMyTurn)"),
  'handleTurnState muss my-turn-active auf myHud schalten');
console.log('     ✅ Goldenes Atmen um den aktiven Avatar erfolgreich verifiziert!');

// 6. Verifiziere openPlayerDetailModal Controller und Klick-Events
console.log('  6. Prüfe openPlayerDetailModal Controller und Klick-Verknüpfung...');
assert(clientJs.includes('function openPlayerDetailModal(data, source = \'table\')'),
  'openPlayerDetailModal Funktion fehlt in client.js');
assert(clientJs.includes('openPlayerDetailModal(p, \'table\')'),
  'Klick auf Gegnersitz muss openPlayerDetailModal aufrufen');
assert(clientJs.includes('openPlayerDetailModal(friend, \'friends\')'),
  'Klick auf Freundeskarte im Grimoire muss openPlayerDetailModal aufrufen');
assert(clientJs.includes('window.openPlayerDetailModal = openPlayerDetailModal'),
  'openPlayerDetailModal muss global verfügbar sein');
console.log('     ✅ Magier-Profil Controller & Klick-Events erfolgreich verifiziert!');

// 7. Funktionale Laufzeit-Prüfung von renderOpponents() (TDZ-Schutz & Pillen-Generierung)
console.log('  7. Prüfe fehlerfreie renderOpponents() Ausführung & TDZ-Freiheit in Sandbox...');
const vm = require('vm');

function createMockElement(tag, id = '') {
  const children = [];
  return {
    tagName: tag.toUpperCase(),
    id,
    className: '',
    innerHTML: '',
    style: {},
    attributes: {},
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      toggle(c, force) { if (force) this.classes.add(c); else this.classes.delete(c); },
      contains(c) { return this.classes.has(c); }
    },
    children,
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
    appendChild(child) { children.push(child); },
    querySelector(sel) {
      if (sel === '.seat-bid-pill') return createMockElement('span');
      if (sel === '.seat-avatar') return createMockElement('div');
      if (sel === '.seat-name-row') return createMockElement('div');
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener(ev, fn) { this._listener = fn; }
  };
}

const mockOpponentsContainer = createMockElement('div', 'opponents-container');
let modalOpenedWith = null;

const sandbox = {
  opponentsContainer: mockOpponentsContainer,
  cachedPlayers: [
    { sessionId: 'sess_me', name: 'Ich', isHost: true, bid: 1, tricksWon: 1 },
    { sessionId: 'sess_bot1', name: 'Meister Merlin (KI)', isBot: true, bid: 0, tricksWon: 0 },
    { sessionId: 'sess_bot2', name: 'Novize Artus (KI)', isBot: true, bid: 2, tricksWon: 1 },
    { sessionId: 'sess_human', name: 'Morgana', bid: 1, tricksWon: 0 }
  ],
  mySessionId: 'sess_me',
  currentRound: 2,
  currentActiveSessionId: 'sess_bot1',
  currentMatchFormat: 'ffa',
  document: {
    createElement(tag) { return createMockElement(tag); },
    getElementById(id) {
      if (id === 'bidding-summary-pill') return createMockElement('div', 'bidding-summary-pill');
      return null;
    }
  },
  escapeHtml(str) { return str; },
  renderCard() { return { outerHTML: '<div>Card</div>' }; },
  MEDIEVAL_ICONS: {},
  openPlayerDetailModal(p, src) { modalOpenedWith = { p, src }; },
  openForeheadInspectModal() {},
  updateBiddingSummaryPill() {},
  console: console
};

vm.createContext(sandbox);

// Extrahiere renderOpponents Code aus clientJs
const renderCode = clientJs.substring(
  clientJs.indexOf('function renderOpponents()'),
  clientJs.indexOf('function updateMyStatsHUD()')
);

// Führe Code in der Sandbox aus
vm.runInContext(renderCode, sandbox);

// Rufe renderOpponents auf
assert.doesNotThrow(() => {
  sandbox.renderOpponents();
}, 'renderOpponents darf NIEMALS einen ReferenceError oder TDZ-Fehler werfen!');

assert.strictEqual(mockOpponentsContainer.children.length, 3, 'Es müssen genau 3 Mitspieler-Sitze gerendert worden sein');
assert(mockOpponentsContainer.className.includes('count-3'), 'Container muss Klasse count-3 erhalten');

const firstSeat = mockOpponentsContainer.children[0];
assert(firstSeat.innerHTML.includes('seat-bid-pill'), 'Sitz muss .seat-bid-pill enthalten');
assert(firstSeat.innerHTML.includes('🏆 0 / 🎯 0'), 'Sitz muss Gemacht / Vorhersage anzeigen');

console.log('     ✅ renderOpponents() läuft absolut fehlerfrei, erzeugt alle Sitze & Pillen!');

console.log('\n🎉 Alle Tests für Minimalist Seats, Player Profile Modal, Grimoire Z-Index & Stirnkarten erfolgreich bestanden!');
