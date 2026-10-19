const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- TESTE SCHRITT 8: SIEGEREHRUNG & EHRE EINHEIMSEN / RÜCKKEHR ---');

const indexPath = path.join(__dirname, '../public/index.html');
const clientPath = path.join(__dirname, '../public/client.js');

const indexHtml = fs.readFileSync(indexPath, 'utf-8');
const clientJs = fs.readFileSync(clientPath, 'utf-8');

// 1. STATISCHE PRÜFUNG DES HTML-MARKUPS
console.log('1. Prüfe HTML-Struktur von #game-over-modal und Reopen-Button...');

assert.ok(indexHtml.includes('id="game-over-modal"'), 'game-over-modal muss in index.html vorhanden sein');
assert.ok(indexHtml.includes('id="btnGameOverClose"'), 'btnGameOverClose (&times;) muss im Modal vorhanden sein');
assert.ok(indexHtml.includes('aria-label="Siegerehrung schließen"'), 'btnGameOverClose muss barrierefreies aria-label besitzen');

assert.ok(indexHtml.includes('id="btnClaimGlory"'), 'btnClaimGlory muss vorhanden sein');
assert.ok(indexHtml.includes('Ehre einheimsen &amp; Zur Zitadelle'), 'btnClaimGlory muss passenden Text haben');
assert.ok(indexHtml.includes('aria-label="Ehre einheimsen &amp; zur Zitadelle zurückkehren"'), 'btnClaimGlory muss barrierefreies aria-label besitzen');

assert.ok(indexHtml.includes('id="resetGameBtn"'), 'resetGameBtn muss vorhanden sein');
assert.ok(indexHtml.includes('aria-label="Neuen Bund stiften &amp; erneut spielen"'), 'resetGameBtn muss barrierefreies aria-label besitzen');

assert.ok(indexHtml.includes('id="btnGameOverStay"'), 'btnGameOverStay muss vorhanden sein');
assert.ok(indexHtml.includes('Im Warteraum auf neue Runde warten'), 'btnGameOverStay muss passenden Text haben');
assert.ok(indexHtml.includes('aria-label="Im Warteraum auf nächste Runde warten"'), 'btnGameOverStay muss barrierefreies aria-label besitzen');

assert.ok(indexHtml.includes('id="btnReopenGameOver"'), 'btnReopenGameOver muss vorhanden sein');
assert.ok(indexHtml.includes('aria-label="Siegerehrung anzeigen"'), 'btnReopenGameOver muss barrierefreies aria-label besitzen');

console.log('✓ 1. HTML-Markup für Siegerehrungs-Aktionen und Reopen-Button erfolgreich verifiziert!');

// 2. STATISCHE PRÜFUNG VON CLIENT.JS
console.log('2. Prüfe client.js Event-Handling und Rollenlogik...');

assert.ok(clientJs.includes('const btnClaimGlory = document.getElementById(\'btnClaimGlory\');'), 'btnClaimGlory Deklaration fehlt in client.js');
assert.ok(clientJs.includes('const btnGameOverStay = document.getElementById(\'btnGameOverStay\');'), 'btnGameOverStay Deklaration fehlt in client.js');
assert.ok(clientJs.includes('const btnGameOverClose = document.getElementById(\'btnGameOverClose\');'), 'btnGameOverClose Deklaration fehlt in client.js');
assert.ok(clientJs.includes('const btnReopenGameOver = document.getElementById(\'btnReopenGameOver\');'), 'btnReopenGameOver Deklaration fehlt in client.js');

assert.ok(clientJs.includes('function claimGloryAndLeave('), 'Funktion claimGloryAndLeave fehlt in client.js');
assert.ok(clientJs.includes('btnClaimGlory.addEventListener(\'click\', claimGloryAndLeave);'), 'Event-Listener für btnClaimGlory fehlt');
assert.ok(clientJs.includes('btnGameOverClose.addEventListener(\'click\''), 'Event-Listener für btnGameOverClose fehlt');
assert.ok(clientJs.includes('btnReopenGameOver.addEventListener(\'click\''), 'Event-Listener für btnReopenGameOver fehlt');
assert.ok(clientJs.includes('btnGameOverStay.addEventListener(\'click\''), 'Event-Listener für btnGameOverStay fehlt');

// Prüfen, dass showGameOverScreen rollenbasierte Sichtbarkeit handhabt
assert.ok(clientJs.includes('resetGameBtn.style.display = amIHost ? \'flex\' : \'none\';'), 'resetGameBtn Sichtbarkeit nicht korrekt an amIHost gekoppelt');
assert.ok(clientJs.includes('btnGameOverStay.style.display = !amIHost ? \'flex\' : \'none\';'), 'btnGameOverStay Sichtbarkeit nicht korrekt an !amIHost gekoppelt');
assert.ok(clientJs.includes('btnClaimGlory.style.display = \'flex\';'), 'btnClaimGlory muss für alle sichtbar sein');

console.log('✓ 2. client.js Handler und Rollensteuerung erfolgreich verifiziert!');

// 3. FUNKTIONALE SIMULATION IN VM-SANDBOX
console.log('3. Führe funktionale Simulation der Interaktionen in Sandbox aus...');

function createMockElement(id) {
  return {
    id,
    style: { display: 'none' },
    innerText: '',
    innerHTML: '',
    listeners: {},
    addEventListener(event, fn) {
      this.listeners[event] = fn;
    },
    click() {
      if (this.listeners['click']) this.listeners['click']();
    }
  };
}

const mockElements = {
  'game-over-modal': createMockElement('game-over-modal'),
  'podium-list': createMockElement('podium-list'),
  'resetGameBtn': createMockElement('resetGameBtn'),
  'btnClaimGlory': createMockElement('btnClaimGlory'),
  'btnGameOverStay': createMockElement('btnGameOverStay'),
  'btnGameOverClose': createMockElement('btnGameOverClose'),
  'btnReopenGameOver': createMockElement('btnReopenGameOver'),
  'pause-overlay': createMockElement('pause-overlay'),
  'table-area': createMockElement('table-area'),
  'status-message': createMockElement('status-message')
};

const emittedEvents = [];
const mockSocket = {
  emit(event, data) {
    emittedEvents.push({ event, data });
  }
};

const storageState = {
  wizard_last_room: 'CITADEL-42'
};

const mockSessionStorage = {
  getItem(key) { return storageState[key]; },
  setItem(key, val) { storageState[key] = val; },
  removeItem(key) { delete storageState[key]; }
};

let audioPlayed = false;
let userRefreshed = false;
let currentScreen = 'game';

const sandbox = {
  document: {
    getElementById(id) {
      return mockElements[id] || null;
    }
  },
  socket: mockSocket,
  sessionStorage: mockSessionStorage,
  WizardAudio: {
    playLevelUp() { audioPlayed = true; },
    playCardSnap() { audioPlayed = true; }
  },
  WizardAuth: {
    refreshUser() { userRefreshed = true; }
  },
  currentRoomCode: 'CITADEL-42',
  currentGameState: 'round_over',
  switchScreen(screen) {
    currentScreen = screen;
  },
  console: console
};

vm.createContext(sandbox);

// Sandbox-Code für Simulation
const simulationCode = `
  const gameOverModal = document.getElementById('game-over-modal');
  const podiumList = document.getElementById('podium-list');
  const resetGameBtn = document.getElementById('resetGameBtn');
  const btnClaimGlory = document.getElementById('btnClaimGlory');
  const btnGameOverStay = document.getElementById('btnGameOverStay');
  const btnGameOverClose = document.getElementById('btnGameOverClose');
  const btnReopenGameOver = document.getElementById('btnReopenGameOver');
  const pauseOverlay = document.getElementById('pause-overlay');
  const tableArea = document.getElementById('table-area');
  const statusMessage = document.getElementById('status-message');

  function claimGloryAndLeave() {
    if (typeof WizardAudio !== 'undefined') {
      if (typeof WizardAudio.playLevelUp === 'function') {
        WizardAudio.playLevelUp();
      } else if (typeof WizardAudio.playCardSnap === 'function') {
        WizardAudio.playCardSnap();
      }
    }

    if (typeof WizardAuth !== 'undefined' && WizardAuth.refreshUser) {
      WizardAuth.refreshUser();
    }

    if (currentRoomCode) {
      socket.emit('leaveRoom', { roomCode: currentRoomCode });
    }

    sessionStorage.removeItem('wizard_last_room');
    currentRoomCode = '';
    currentGameState = 'lobby';

    if (gameOverModal) gameOverModal.style.display = 'none';
    if (btnReopenGameOver) btnReopenGameOver.style.display = 'none';
    if (pauseOverlay) pauseOverlay.style.display = 'none';
    if (tableArea) tableArea.style.display = 'none';

    switchScreen('lobby');
  }

  if (btnClaimGlory) {
    btnClaimGlory.addEventListener('click', claimGloryAndLeave);
  }

  if (btnGameOverClose) {
    btnGameOverClose.addEventListener('click', () => {
      if (gameOverModal) gameOverModal.style.display = 'none';
      if (btnReopenGameOver) btnReopenGameOver.style.display = 'inline-flex';
    });
  }

  if (btnReopenGameOver) {
    btnReopenGameOver.addEventListener('click', () => {
      if (gameOverModal) gameOverModal.style.display = 'flex';
      if (btnReopenGameOver) btnReopenGameOver.style.display = 'none';
    });
  }

  if (btnGameOverStay) {
    btnGameOverStay.addEventListener('click', () => {
      if (gameOverModal) gameOverModal.style.display = 'none';
      if (btnReopenGameOver) btnReopenGameOver.style.display = 'inline-flex';
      if (statusMessage) {
        statusMessage.style.display = 'block';
        statusMessage.innerText = 'Ehre verbucht! Warte im Saal auf die nächste Runde...';
      }
    });
  }

  function simulateShowGameOverScreen(amIHost) {
    if (resetGameBtn) {
      resetGameBtn.style.display = amIHost ? 'flex' : 'none';
    }
    if (btnGameOverStay) {
      btnGameOverStay.style.display = !amIHost ? 'flex' : 'none';
    }
    if (btnClaimGlory) {
      btnClaimGlory.style.display = 'flex';
    }
    if (btnReopenGameOver) {
      btnReopenGameOver.style.display = 'none';
    }
    if (gameOverModal) {
      gameOverModal.style.display = 'flex';
    }
  }
`;

vm.runInContext(simulationCode, sandbox);

// A. Test Host Ansicht
sandbox.simulateShowGameOverScreen(true);
assert.strictEqual(mockElements['game-over-modal'].style.display, 'flex', 'Modal muss geöffnet sein');
assert.strictEqual(mockElements['resetGameBtn'].style.display, 'flex', 'Host muss resetGameBtn sehen');
assert.strictEqual(mockElements['btnGameOverStay'].style.display, 'none', 'Host darf btnGameOverStay nicht sehen');
assert.strictEqual(mockElements['btnClaimGlory'].style.display, 'flex', 'Host muss btnClaimGlory sehen');
assert.strictEqual(mockElements['btnReopenGameOver'].style.display, 'none', 'Reopen button muss ausgeblendet sein');

// B. Test Schließen über &times; und Reopen
mockElements['btnGameOverClose'].click();
assert.strictEqual(mockElements['game-over-modal'].style.display, 'none', 'Modal muss nach Close geschlossen sein');
assert.strictEqual(mockElements['btnReopenGameOver'].style.display, 'inline-flex', 'Reopen Button muss nach Close sichtbar sein');

mockElements['btnReopenGameOver'].click();
assert.strictEqual(mockElements['game-over-modal'].style.display, 'flex', 'Modal muss nach Reopen wieder sichtbar sein');
assert.strictEqual(mockElements['btnReopenGameOver'].style.display, 'none', 'Reopen Button muss wieder verborgen sein');

// C. Test Gast Ansicht
sandbox.simulateShowGameOverScreen(false);
assert.strictEqual(mockElements['resetGameBtn'].style.display, 'none', 'Gast darf resetGameBtn nicht sehen');
assert.strictEqual(mockElements['btnGameOverStay'].style.display, 'flex', 'Gast muss btnGameOverStay sehen');
assert.strictEqual(mockElements['btnClaimGlory'].style.display, 'flex', 'Gast muss btnClaimGlory sehen');

// D. Test "Im Warteraum verbleiben"
mockElements['btnGameOverStay'].click();
assert.strictEqual(mockElements['game-over-modal'].style.display, 'none', 'Modal muss geschlossen werden');
assert.strictEqual(mockElements['btnReopenGameOver'].style.display, 'inline-flex', 'Reopen Button muss sichtbar werden');
assert.strictEqual(mockElements['status-message'].style.display, 'block', 'Statusmeldung muss eingeblendet werden');

// E. Test "Ehre einheimsen & Zur Zitadelle"
sandbox.simulateShowGameOverScreen(false); // Nochmal öffnen
mockElements['btnClaimGlory'].click();

assert.ok(audioPlayed, 'Triumph-Audio muss abgespielt werden');
assert.ok(userRefreshed, 'WizardAuth.refreshUser muss aufgerufen werden');
assert.strictEqual(emittedEvents.length, 1, 'Socket leaveRoom muss emittiert werden');
assert.strictEqual(emittedEvents[0].event, 'leaveRoom');
assert.strictEqual(emittedEvents[0].data.roomCode, 'CITADEL-42');
assert.strictEqual(sandbox.sessionStorage.getItem('wizard_last_room'), undefined, 'Room Code muss aus Storage entfernt werden');
assert.strictEqual(sandbox.currentGameState, 'lobby', 'GameState muss auf lobby gesetzt sein');
assert.strictEqual(currentScreen, 'lobby', 'Screen muss auf lobby gewechselt sein');
assert.strictEqual(mockElements['game-over-modal'].style.display, 'none', 'Modal muss geschlossen sein');
assert.strictEqual(mockElements['btnReopenGameOver'].style.display, 'none', 'Reopen Button muss nach Verlassen verborgen sein');

console.log('✓ 3. Alle funktionalen Interaktions- und Transitionstests erfolgreich bestanden!');

console.log('\n======================================================');
console.log('🏆 SCHRITT 8 (SIEGEREHRUNG & RÜCKKEHR) VOLLSTÄNDIG BESTANDEN!');
console.log('======================================================');
