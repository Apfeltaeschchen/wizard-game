const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { calculatePoints, calculateTeamPoints } = require('../server/gameLogic');

const TEST_PORT = 3998;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- STARTE BIET-POLISH & BLIND-0 AUTOMATION TESTS ---');

// ==========================================
// TEST SECTION 1: Mathematische Regeltreue
// ==========================================
console.log('\n--- 1. Test: Blind-0 Punkteberechnung ---');

// Klassische Wertung mit Blind-0
assert.strictEqual(calculatePoints(0, 0, 1, 'classic', false), 20, 'Normal 0 getroffen = +20');
assert.strictEqual(calculatePoints(0, 0, 1, 'classic', true), 40, 'Blind 0 getroffen = +40 (doppelt)');
assert.strictEqual(calculatePoints(0, 1, 1, 'classic', false), -10, 'Normal 0 verfehlt (+1) = -10');
assert.strictEqual(calculatePoints(0, 1, 1, 'classic', true), -20, 'Blind 0 verfehlt (+1) = -20 (doppelt)');
assert.strictEqual(calculatePoints(0, 3, 1, 'classic', true), -60, 'Blind 0 verfehlt (+3) = -60 (doppelt)');

// Schattenfluch (Skull King Zero) mit Blind-0
assert.strictEqual(calculatePoints(0, 0, 5, 'skull_king_zero', false), 50, 'Normal 0 in R5 = +50');
assert.strictEqual(calculatePoints(0, 0, 5, 'skull_king_zero', true), 100, 'Blind 0 in R5 = +100 (doppelt)');
assert.strictEqual(calculatePoints(0, 1, 5, 'skull_king_zero', false), -50, 'Normal 0 verfehlt in R5 = -50');
assert.strictEqual(calculatePoints(0, 1, 5, 'skull_king_zero', true), -100, 'Blind 0 verfehlt in R5 = -100 (doppelt)');
assert.strictEqual(calculatePoints(0, 4, 5, 'skull_king_zero', true), -100, 'Blind 0 verfehlt in R5 = -100 (doppelt)');

// Blind-0 greift nur, wenn bid === 0
assert.strictEqual(calculatePoints(2, 2, 3, 'classic', true), 40, 'Gebot > 0 wird normal bewertet');

// Team 2vs2 mit Blind-0
assert.strictEqual(calculateTeamPoints(0, 0, 4, 'skull_king_zero', true), 80, 'Team Blind 0 getroffen in R4 = +80');
assert.strictEqual(calculateTeamPoints(0, 1, 4, 'skull_king_zero', true), -80, 'Team Blind 0 verfehlt in R4 = -80');

console.log('✓ Mathematische Regeltreue für Blind-0 erfolgreich verifiziert');

// ==========================================
// TEST SECTION 2: UI Markup & DOM Integrität
// ==========================================
console.log('\n--- 2. Test: UI-Markup & CSS-Klassen Prüfung ---');
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
assert.ok(indexHtml.includes('id="simultaneous-reveal-overlay"'), 'simultaneous-reveal-overlay existiert');
assert.ok(indexHtml.includes('id="reveal-countdown-number"'), 'reveal-countdown-number existiert');
assert.ok(indexHtml.includes('id="bidding-summary-pill"'), 'bidding-summary-pill existiert');
assert.ok(indexHtml.includes('id="btnBlindZero"'), 'btnBlindZero existiert');
assert.ok(indexHtml.includes('id="modalAllowBlindZero"'), 'modalAllowBlindZero Checkbox existiert');
assert.ok(indexHtml.includes('.seat-bid-pill.revealing'), 'CSS für 3D-Flip Animation existiert');
assert.ok(indexHtml.includes('.bidding-summary-pill'), 'CSS für Bietbilanz existiert');
assert.ok(indexHtml.includes('.bid-btn.bid-btn-zero'), 'CSS für 0-Gebot existiert');
console.log('✓ UI-Markup und CSS-Definitionen vollständig vorhanden');

// ==========================================
// TEST SECTION 3: Server Integration & Socket Tests
// ==========================================
console.log('\n--- 3. Test: Server Integration & Socket Ablauf ---');

const serverProc = spawn('node', [path.join(__dirname, '../server/index.js')], {
  env: { ...process.env, PORT: TEST_PORT },
  stdio: 'pipe'
});

serverProc.stderr.on('data', (d) => {
  console.error('[Server stderr]:', d.toString().trim());
});

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runSocketTests() {
  await wait(1200);

  let c1, c2, c3;
  try {
    c1 = io(SERVER_URL, { forceNew: true });
    await new Promise(r => c1.on('connect', r));

    const roomCode = 'POLISH1';
    c1.emit('joinRoom', { playerName: 'HostVance', roomCode, sessionId: 'sess_h_vance', createIfNotExists: true });
    await wait(200);

    c2 = io(SERVER_URL, { forceNew: true });
    await new Promise(r => c2.on('connect', r));
    c2.emit('joinRoom', { playerName: 'GuestIris', roomCode, sessionId: 'sess_g_iris' });
    await wait(200);

    c3 = io(SERVER_URL, { forceNew: true });
    await new Promise(r => c3.on('connect', r));
    c3.emit('joinRoom', { playerName: 'GuestKael', roomCode, sessionId: 'sess_g_kael' });
    await wait(200);

    // Host schaltet Simultan-Modus und allowBlindZero ein
    const settingsPromise = new Promise(resolve => {
      c2.once('roomSettingsUpdated', resolve);
    });

    c1.emit('updateRoomSettings', {
      roomCode,
      edition: 'classic',
      matchFormat: 'ffa',
      scoringMode: 'skull_king_zero',
      biddingMode: 'simultaneous',
      allowBlindZero: true
    });

    const updatedSettings = await settingsPromise;
    assert.strictEqual(updatedSettings.biddingMode, 'simultaneous', 'Bietmodus ist simultaneous');
    assert.strictEqual(updatedSettings.allowBlindZero, true, 'allowBlindZero ist true');
    console.log('✓ Host-Einstellungen erfolgreich synchronisiert (biddingMode=simultaneous, allowBlindZero=true)');

    // Spiel starten
    const gameStartedPromise = new Promise(resolve => {
      c1.once('gameStarted', resolve);
    });
    c1.emit('startGame', { roomCode });
    const startedData = await gameStartedPromise;
    assert.strictEqual(startedData.round, 1, 'Runde 1 gestartet');
    await wait(200);

    // Simultan-Bieten: Spieler geben Tipps ab, einer blind 0
    const revealPromise = new Promise(resolve => {
      c1.once('simultaneousBidsRevealed', resolve);
    });

    c1.emit('submitBid', { roomCode, bid: 0, isBlindZero: true });
    c2.emit('submitBid', { roomCode, bid: 1, isBlindZero: false });
    c3.emit('submitBid', { roomCode, bid: 0, isBlindZero: false });

    const revealedData = await revealPromise;
    assert.ok(revealedData && Array.isArray(revealedData.players), 'simultaneousBidsRevealed liefert Spieler-Array');
    
    const hostPlayer = revealedData.players.find(p => p.sessionId === 'sess_h_vance');
    assert.strictEqual(hostPlayer.bid, 0, 'Host hat 0 getippt');
    assert.strictEqual(hostPlayer.isBlindZero, true, 'Host hat isBlindZero gesetzt');

    const guestIris = revealedData.players.find(p => p.sessionId === 'sess_g_iris');
    assert.strictEqual(guestIris.bid, 1, 'Iris hat 1 getippt');
    assert.strictEqual(guestIris.isBlindZero, false, 'Iris hat isBlindZero=false');

    console.log('✓ Simultan-Reveal & Blind-0 Prophezeiung serverseitig fehlerfrei ausgeführt');

  } finally {
    if (c1) c1.disconnect();
    if (c2) c2.disconnect();
    if (c3) c3.disconnect();
    serverProc.kill();
  }
}

runSocketTests()
  .then(() => {
    console.log('\n--- ALLE BIET-POLISH & BLIND-0 TESTS ERFOLGREICH BESTANDEN! ---');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test fehlgeschlagen:', err);
    if (serverProc) serverProc.kill();
    process.exit(1);
  });
