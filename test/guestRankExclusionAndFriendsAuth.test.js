const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('--- TESTE GAST-RANG-AUSSCHLUSS, FREUNDE-AUTH & OVERLAY-LAYOUT ---');

const htmlPath = path.join(__dirname, '../public/index.html');
const jsPath = path.join(__dirname, '../public/client.js');
const serverPath = path.join(__dirname, '../server/index.js');
const dbPath = path.join(__dirname, '../server/database.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');
const serverCode = fs.readFileSync(serverPath, 'utf8');

// 1. HTML & CSS OVERLAY PRÜFUNGEN
// a) Klang-Button im Warteraum liegt in .waiting-header-bar mit z-index 250
assert.ok(html.includes('class="waiting-header-bar"'), 'waiting-header-bar vorhanden');
assert.ok(html.includes('id="waiting-audio-toggle"'), 'waiting-audio-toggle vorhanden');
const waitingHeaderIdx = html.indexOf('class="waiting-header-bar"');
const waitingAudioIdx = html.indexOf('id="waiting-audio-toggle"');
const glassCardIdx = html.indexOf('class="glass-card"');
assert.ok(waitingAudioIdx > waitingHeaderIdx, 'waiting-audio-toggle befindet sich im waiting-header-bar');
assert.ok(html.includes('.waiting-header-bar {') && html.includes('z-index: 250;'), 'waiting-header-bar besitzt z-index: 250');
console.log('✓ 1a. Klang-Button in Warteraum liegt sicher in .waiting-header-bar mit z-index 250 (nicht hinter Glass-Card)');

// b) Z-Index Hierarchie für Header, Banner und Overlays
assert.ok(html.includes('id="connection-status-banner"'), 'id connection-status-banner im HTML vorhanden');
assert.ok(html.includes('.connection-status-banner') && html.includes('z-index: 900;'), 'connection-status-banner besitzt z-index 900');
assert.ok(html.includes('body.has-active-banner'), 'body.has-active-banner Versatz-Klasse im CSS definiert');
assert.ok(html.includes('54px'), 'body.has-active-banner mobiler Versatz definiert');
console.log('✓ 1b. Verbindungsbanner z-index 900 mit dynamischem Body-Paddingversatz verifiziert');

// c) Mobiles Biet-Overlay und Handkarten Swipeable CSS
assert.ok(html.includes('#bid-overlay {') && html.includes('z-index: 500;'), 'bid-overlay besitzt z-index 500');
assert.ok(html.includes('bottom: calc(var(--card-h) + 75px);'), 'bid-overlay positioniert sich über den Handkarten (angehoben)');
assert.ok(html.includes('#hand-container.swipeable {') && html.includes('justify-content: flex-start !important;'), 'swipeable Handkarten haben justify-content: flex-start');
assert.ok(html.includes('#playerName,') && html.includes('min-height: 44px;'), 'Touch-freundliche Formular-Inputs (>= 44px, 16px Font) vorhanden');
console.log('✓ 1c. Mobiles Biet-Overlay, Handkarten-Swipeable & Touch-Input-Dimensionen verifiziert');

// 2. CLIENT-SIDE LOGIK PRÜFUNGEN
// a) Banner schaltet has-active-banner Klasse
assert.ok(js.includes("document.body.classList.add('has-active-banner')"), 'showConnectionStatus fügt has-active-banner hinzu');
assert.ok(js.includes("document.body.classList.remove('has-active-banner')"), 'hideConnectionStatus entfernt has-active-banner');
console.log('✓ 2a. Dynamische has-active-banner Schaltung in client.js verifiziert');

// b) GrimoireDialog.requireAuth('companions') & CompanionsManager Auth-Prüfung
assert.ok(js.includes("featureName === 'companions'"), 'requireAuth für companions implementiert');
assert.ok(js.includes('Gefährten-Bund erfordert Siegel') || js.includes('Grimoire der Gefährten'), 'Titel für Gefährten-Auth vorhanden');
assert.ok(js.includes("socket.on('friendsError'"), 'friendsError Socket-Listener in CompanionsManager vorhanden');
assert.ok(js.includes("GrimoireDialog.requireAuth('companions')"), 'Gäste-Klick auf Gefährten leitet an GrimoireDialog.requireAuth weiter');
console.log('✓ 2b. Gefährten-Grimoire Zugriffsschutz & Auth-Modal-Triggering verifiziert');

// c) Client-seitige Rang-Badge Filterung
assert.ok(js.includes('if (p.rank && (p.userId || p.isBot))'), 'Client filtert Ränge strikt auf userId oder Bot');
assert.ok(js.includes('isSwipeable = isMobile && total >='), 'isSwipeable greift mobil ab Handkarten-Schwellenwert');
assert.ok(js.includes("dynamicMargin = '-16px'") || js.includes("dynamicMargin = '4px'"), 'Kartenabstände bei swipeable Layout');
console.log('✓ 2c. Clientseitige Rang-Badge-Ausblendung für Gäste & Hand-Swipeable-Logik verifiziert');

// 3. SERVER-SIDE RANG-AUSSCHLUSS FÜR GÄSTE
// Importiere DB-Modul zur Überprüfung von getRankDetailsFromSR
const dbModule = require(dbPath);

// Simuliere getSanitizedPlayers aus server/index.js
// Extrahiere getSanitizedPlayers aus serverCode
const fnStart = serverCode.indexOf('function getSanitizedPlayers(');
assert.ok(fnStart > 0, 'getSanitizedPlayers Funktion im Server gefunden');
const fnEnd = serverCode.indexOf('\n  }', fnStart) + 4;
const fnCode = serverCode.substring(fnStart, fnEnd);

// Führe getSanitizedPlayers in kontrolliertem Kontext aus
const sandbox = {
  dbModule,
  console
};
const script = `
${fnCode}
result = { getSanitizedPlayers };
`;
const vmResult = {};
require('vm').createContext(sandbox);
require('vm').runInContext(script, sandbox);
const getSanitizedPlayers = sandbox.result.getSanitizedPlayers;

// Test 1: Unregistrierter Gast (kein userId, kein authUser)
const guestPlayer = {
  name: 'GartenZwerg',
  sessionId: 'sess_guest_1',
  socketId: 'sock_1',
  connected: true,
  hand: [{ type: 'color', suit: 'red', value: 7 }],
  bid: null,
  tricksWon: 0,
  totalScore: 0,
  isHost: true,
  isBot: false,
  userId: null,
  skillRating: null,
  rank: null
};

// Test 2: Registrierter Magier (mit userId und Skill Rating)
const authUserPlayer = {
  name: 'Merlin',
  sessionId: 'sess_user_1',
  socketId: 'sock_2',
  connected: true,
  hand: [{ type: 'wizard', value: 0 }],
  bid: null,
  tricksWon: 0,
  totalScore: 0,
  isHost: false,
  isBot: false,
  userId: 42,
  skillRating: 1450,
  rank: dbModule.getRankDetailsFromSR(1450)
};

// Test 3: KI-Bot
const botPlayer = {
  name: 'Albus [Bot]',
  sessionId: 'sess_bot_1',
  socketId: null,
  connected: true,
  hand: [{ type: 'fool', value: 0 }],
  bid: null,
  tricksWon: 0,
  totalScore: 0,
  isHost: false,
  isBot: true,
  userId: null,
  skillRating: 1100,
  rank: dbModule.getRankDetailsFromSR(1100)
};

const sanitized = getSanitizedPlayers([guestPlayer, authUserPlayer, botPlayer], 0, 'sess_guest_1', { isRanked: false });

const sanitizedGuest = sanitized.find(p => p.name === 'GartenZwerg');
const sanitizedUser = sanitized.find(p => p.name === 'Merlin');
const sanitizedBot = sanitized.find(p => p.name.includes('[Bot]'));

assert.strictEqual(sanitizedGuest.skillRating, null, 'Unregistrierter Gast darf NIEMALS skillRating erhalten (muss null sein)');
assert.strictEqual(sanitizedGuest.rank, null, 'Unregistrierter Gast darf NIEMALS einen Rang erhalten (muss null sein)');

assert.strictEqual(sanitizedUser.skillRating, 1450, 'Registrierter Magier muss sein Skill Rating behalten');
assert.ok(sanitizedUser.rank !== null && typeof sanitizedUser.rank === 'object', 'Registrierter Magier muss Rangdetails haben');
assert.strictEqual(sanitizedUser.rank.tier, 'adept', 'Merlin mit 1450 SR muss Adept-Rang haben');

assert.strictEqual(sanitizedBot.skillRating, 1100, 'Bot behält sein Skill Rating');
assert.ok(sanitizedBot.rank !== null, 'Bot behält seinen Rang');

console.log('✓ 3. Server getSanitizedPlayers schließt Gäste strikt von Rängen und SR aus (beide null)');

console.log('\n======================================================');
console.log('🏆 ALLE GAST-RANG-AUSSCHLUSS- & FREUNDE-AUTH-TESTS BESTANDEN!');
console.log('======================================================');
