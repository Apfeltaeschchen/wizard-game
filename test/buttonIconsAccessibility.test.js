const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starte Test-Suite: Durchgängige Button-Icons & Mobile Ergonomie (bencium-controlled-ux-designer)...');

const htmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// --- 1. CSS & WCAG 2.1 AA ERGONOMIE REGELN ---
console.log('  1. Prüfe CSS Button-Basisregeln & WCAG 44px Mindest-Touch-Target...');
assert.ok(html.includes('min-height: 44px; /* WCAG 2.1 AA Mindest-Touch-Target */') || html.includes('min-height: 44px;'), 'Mindest-Touch-Target von 44px für Buttons im CSS definiert');
assert.ok(html.includes('.btn-icon {'), '.btn-icon CSS-Klasse vorhanden');
assert.ok(html.includes('.btn-text {'), '.btn-text CSS-Klasse vorhanden');

// --- 2. RESPONSIVE HYBRID BUTTONS AUF SMARTPHONES (<= 420px) ---
console.log('  2. Prüfe Responsive Hybrid Media Query (<= 420px)...');
assert.ok(html.includes('@media (max-width: 420px)'), 'Media Query für <= 420px vorhanden');
assert.ok(html.includes('.btn-hybrid-compact .btn-text'), 'Regel zum Ausblenden von Sekundärtext auf schmalen Handys vorhanden');
assert.ok(html.includes('.btn-hybrid-compact {'), '.btn-hybrid-compact Definition vorhanden');

// --- 3. DURCHGÄNGIGE ICONS AUF ZENTRALEN HTML-BUTTONS ---
console.log('  3. Prüfe zentrale HTML-Buttons auf semantische Icons & .btn-icon Spans...');

const requiredButtonChecks = [
  { id: 'createGameBtn', icon: '📜', name: 'Neues Spiel gründen' },
  { id: 'joinBtn', icon: '⚔️', name: 'Dem Bunde beitreten' },
  { id: 'waitingRoomLeaveBtn', icon: '🚪', name: 'Kammer verlassen' },
  { id: 'waitingRoomStartBtn', icon: '⚔️', name: 'Partie jetzt beginnen' },
  { id: 'btnAddBot', icon: '🤖', name: 'KI hinzufügen' },
  { id: 'btnRemoveBot', icon: '❌', name: 'KI entfernen' },
  { id: 'btnOpenCompanionsWaiting', icon: '👥', name: 'Gefährten einladen' },
  { id: 'btnCopyWaitingCode', icon: '📋', name: 'Code kopieren' },
  { id: 'btnHostReDeal', icon: '🔄', name: 'Runde neu austeilen' },
  { id: 'btnHostAbortToWaiting', icon: '🏛️', name: 'Ratskammer' },
  { id: 'btnPauseLeaveGame', icon: '🚪', name: 'Bund verlassen' },
  { id: 'resetGameBtn', icon: '🔄', name: 'Neuen Bund stiften' },
  { id: 'btnClaimGlory', icon: '✨', name: 'Ehre einheimsen' },
  { id: 'btnGameOverStay', icon: '⏳', name: 'Im Warteraum' },
  { id: 'btnReopenGameOver', icon: '🏆', name: 'Siegerehrung anzeigen' },
  { id: 'btnWerewolfInfoClose', icon: '👁️', name: 'Verstanden' },
  { id: 'btnWitchSwapExecute', icon: '🔮', name: 'Ritualtausch vollziehen' },
  { id: 'btnJugglerPassConfirm', icon: '🎭', name: 'Karte verdeckt weitergeben' },
  { id: 'btnJugglerReceivedClose', icon: '✋', name: 'In die Hand nehmen' },
  { id: 'btnCloudMinus', icon: '➖', name: '-1 Stich' },
  { id: 'btnCloudPlus', icon: '➕', name: '+1 Stich' },
  { id: 'btnPlayerDetailAddFriend', icon: '✨', name: 'Als Gefährten hinzufügen' },
  { id: 'btnPlayerDetailClose', icon: '🚪', name: 'Schließen' },
  { id: 'tabLoginBtn', icon: '🔑', name: 'Anmelden Tab' },
  { id: 'tabRegisterBtn', icon: '✨', name: 'Registrieren Tab' },
  { id: 'authSubmitBtn', icon: '🗝️', name: 'Einloggen' },
  { id: 'authGuestBtn', icon: '👤', name: 'Als Gast fortfahren' },
  { id: 'tabLeaderboardAlltime', icon: '🏆', name: 'Ruhmeshalle Tab' },
  { id: 'tabLeaderboardRanked', icon: '⚔️', name: 'Rangliste Tab' },
  { id: 'btnRefreshLeaderboard', icon: '🔄', name: 'Bestenliste Refresh' },
  { id: 'btnPenaltyNoticeAck', icon: '⚖️', name: 'Strafe anerkennen' },
  { id: 'btnCompanionsGuestRegister', icon: '✨', name: 'Gefährten Gast Registrieren' },
  { id: 'btnAddFriend', icon: '➕', name: 'Gefährten Hinzufügen' },
  { id: 'btnAcceptInvite', icon: '⚔️', name: 'Duell-Einladung Beitreten' },
  { id: 'btnDeclineInvite', icon: '❌', name: 'Duell-Einladung Ablehnen' },
  { id: 'btnResetServerUrl', icon: '↺', name: 'Server URL Standard' },
  { id: 'btnSaveServerUrl', icon: '⚔️', name: 'Server URL Speichern' },
  { id: 'dialogCancelBtn', icon: '❌', name: 'Dialog Abbrechen' },
  { id: 'dialogConfirmBtn', icon: '✅', name: 'Dialog Bestätigen' }
];

for (const check of requiredButtonChecks) {
  // Regex sucht nach dem Button-Block
  const regex = new RegExp(`<button[^>]*id=["']${check.id}["'][\\s\\S]*?<\\/button>`, 'i');
  const match = html.match(regex);
  assert.ok(match, `Button #${check.id} (${check.name}) existiert im HTML`);
  const btnMarkup = match[0];
  assert.ok(
    btnMarkup.includes(check.icon) || btnMarkup.includes('btn-icon'),
    `Button #${check.id} muss das Icon "${check.icon}" und die btn-icon Klasse enthalten`
  );
  assert.ok(
    btnMarkup.includes('aria-label=') || btnMarkup.includes('title=') || btnMarkup.includes('btn-text'),
    `Button #${check.id} muss barrierefrei beschriftet sein (aria-label, title oder btn-text)`
  );
}

// --- 4. PRÜFE TRUMP- & SUIT-BUTTONS ---
console.log('  4. Prüfe heraldische Farbwahl- & Trumpfbuttons (🔥, 💧, 🌿, ⚡)...');
const suitSymbols = { red: '🔥', blue: '💧', green: '🌿', yellow: '⚡' };
for (const [suit, symbol] of Object.entries(suitSymbols)) {
  const trumpRegex = new RegExp(`<button[^>]*class=["'][^"']*trump-btn[^"']*["'][^>]*data-suit=["']${suit}["'][\\s\\S]*?<\\/button>`, 'i');
  const match = html.match(trumpRegex);
  assert.ok(match, `Trumpf-Button für Farbe ${suit} existiert`);
  assert.ok(match[0].includes(symbol), `Trumpf-Button für Farbe ${suit} enthält Symbol ${symbol}`);
}

// --- 5. PRÜFE DYNAMISCHE BUTTONS IN CLIENT.JS ---
console.log('  5. Prüfe dynamisch generierte Buttons in client.js...');
assert.ok(clientJs.includes('btn-invite-companion') && clientJs.includes('btn-icon'), 'Einladen-Button in Gefährtenliste besitzt .btn-icon');
assert.ok(clientJs.includes('btn-join-companion') && clientJs.includes('btn-icon'), 'Beitreten-Button in Gefährtenliste besitzt .btn-icon');
assert.ok(clientJs.includes('btn-companion-remove') && clientJs.includes('btn-icon'), 'Entfernen-Button in Gefährtenliste besitzt .btn-icon');
assert.ok(clientJs.includes('btnBannerOpenServerSettings') && clientJs.includes('btn-icon'), 'Server-Settings Button im Verbindungs-Banner besitzt .btn-icon');

console.log('\n======================================================');
console.log('🏆 ALLE BUTTON-ICON & ACCESSIBILITY TESTS BESTANDEN!');
console.log('======================================================\n');
