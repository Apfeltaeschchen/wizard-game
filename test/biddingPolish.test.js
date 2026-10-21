const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { calculatePoints, calculateTeamPoints } = require('../server/gameLogic');

const TEST_PORT = process.env.TEST_PORT || 4018;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- STARTE BIET-POLISH, BOT-PACING & PROFILE AUTOMATION TESTS ---');

// ==========================================
// TEST SECTION 1: Mathematische Regeltreue
// ==========================================
console.log('\n--- 1. Test: Standard & Schattenfluch Punkteberechnung (Ohne Blind-0) ---');

// Klassische Wertung (ohne Blind-0)
assert.strictEqual(calculatePoints(0, 0, 1, 'classic'), 20, 'Normal 0 getroffen = +20');
assert.strictEqual(calculatePoints(0, 1, 1, 'classic'), -10, 'Normal 0 verfehlt (+1) = -10');
assert.strictEqual(calculatePoints(2, 2, 3, 'classic'), 40, 'Gebot 2 getroffen in R3 = +40');
assert.strictEqual(calculatePoints(3, 1, 4, 'classic'), -20, 'Gebot 3 mit 1 Stich in R4 = -20');

// Schattenfluch (Skull King Zero)
assert.strictEqual(calculatePoints(0, 0, 5, 'skull_king_zero'), 50, '0 in R5 getroffen = +50');
assert.strictEqual(calculatePoints(0, 1, 5, 'skull_king_zero'), -50, '0 in R5 verfehlt = -50');
assert.strictEqual(calculatePoints(0, 4, 5, 'skull_king_zero'), -50, '0 in R5 verfehlt (+4) = -50');

// Team 2vs2 Wertung
assert.strictEqual(calculateTeamPoints(0, 0, 4, 'skull_king_zero'), 40, 'Team 0 getroffen in R4 = +40');
assert.strictEqual(calculateTeamPoints(0, 1, 4, 'skull_king_zero'), -40, 'Team 0 verfehlt in R4 = -40');
assert.strictEqual(calculateTeamPoints(2, 2, 3, 'classic'), 40, 'Team 2 getroffen in R3 = +40');

console.log('✓ Mathematische Regeltreue für Punkteberechnung fehlerfrei verifiziert');

// ==========================================
// TEST SECTION 2: UI Markup & DOM Integrität
// ==========================================
console.log('\n--- 2. Test: UI-Markup, Entfernung von Blind-0 & Mobile-Ergonomie ---');
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const clientJs = fs.readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');

assert.ok(indexHtml.includes('id="simultaneous-reveal-overlay"'), 'simultaneous-reveal-overlay existiert');
assert.ok(indexHtml.includes('id="reveal-countdown-number"'), 'reveal-countdown-number existiert');
assert.ok(indexHtml.includes('id="bidding-summary-pill"'), 'bidding-summary-pill existiert am Tisch');

// Blind-0 darf nirgends mehr im Markup oder Client existieren
assert.ok(!indexHtml.includes('id="btnBlindZero"'), 'btnBlindZero wurde vollständig aus index.html entfernt');
assert.ok(!indexHtml.includes('id="modalAllowBlindZero"'), 'modalAllowBlindZero wurde vollständig aus index.html entfernt');
assert.ok(!indexHtml.includes('id="my-hud-bilanz-wrap"'), 'my-hud-bilanz-wrap wurde aus Spieler-HUD entfernt');
assert.ok(!clientJs.includes('modalAllowBlindZero'), 'client.js enthält keine Referenzen auf modalAllowBlindZero');
assert.ok(!clientJs.includes('btnBlindZero'), 'client.js enthält keine Referenzen auf btnBlindZero');

// Mobile Anhebung des Biet-Overlays
assert.ok(indexHtml.includes('bottom: calc(var(--card-h) + 75px);'), 'Mobile bid-overlay ist um 75px über Handkarten angehoben');

// Veredelte Namen Styles
assert.ok(indexHtml.includes('.seat-name.host-name'), 'CSS für Host-Krone existiert');
assert.ok(indexHtml.includes('.seat-name.bot-novice'), 'CSS für Novize existiert');
assert.ok(indexHtml.includes('.seat-name.bot-master'), 'CSS für Meister existiert');
assert.ok(indexHtml.includes('.seat-name.bot-archmage'), 'CSS für Erzmagier existiert');

// Bot Lore Datenbank
assert.ok(clientJs.includes('BOT_LORE_DATABASE'), 'BOT_LORE_DATABASE existiert in client.js');
assert.ok(clientJs.includes('pippin') && clientJs.includes('gandalf'), 'Bot-Profile wie Pippin und Gandalf sind definiert');
assert.ok(clientJs.includes('getBotLore'), 'getBotLore Funktion existiert');

console.log('✓ UI-Markup, Mobile-Positionierung und Lore-Datenbank vollständig verifiziert');

// ==========================================
// TEST SECTION 3: Server Integration & Socket Tests
// ==========================================
console.log('\n--- 3. Test: Server Integration, Simultan-Puffer & Bot Pacing ---');

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

    // Host schaltet Simultan-Modus ein (ohne allowBlindZero)
    const settingsPromise = new Promise(resolve => {
      c2.once('roomSettingsUpdated', resolve);
    });

    c1.emit('updateRoomSettings', {
      roomCode,
      edition: 'classic',
      matchFormat: 'ffa',
      scoringMode: 'skull_king_zero',
      biddingMode: 'simultaneous'
    });

    const updatedSettings = await settingsPromise;
    assert.strictEqual(updatedSettings.biddingMode, 'simultaneous', 'Bietmodus ist simultaneous');
    assert.strictEqual(updatedSettings.allowBlindZero, undefined, 'allowBlindZero existiert nicht mehr');
    console.log('✓ Host-Einstellungen erfolgreich synchronisiert (biddingMode=simultaneous)');

    // Spiel starten
    const gameStartedPromise = new Promise(resolve => {
      c1.once('gameStarted', resolve);
    });
    c1.emit('startGame', { roomCode });
    const startedData = await gameStartedPromise;
    assert.strictEqual(startedData.round, 1, 'Runde 1 gestartet');
    await wait(200);

    if (startedData.gameState === 'choose_trump') {
      c1.emit('selectTrumpSuit', { roomCode, suit: 'red' });
      await wait(200);
    }

    // Simultan-Bieten: Alle Spieler geben Tipps ab
    const revealPromise = new Promise(resolve => {
      c1.once('simultaneousBidsRevealed', resolve);
    });

    let turnChangedTime = null;
    const startTime = Date.now();
    c1.on('turnChanged', (tData) => {
      if (tData.gameState === 'playing_tricks') {
        turnChangedTime = Date.now();
      }
    });

    c1.emit('submitBid', { roomCode, bid: 0 });
    c2.emit('submitBid', { roomCode, bid: 1 });
    c3.emit('submitBid', { roomCode, bid: 0 });

    const revealedData = await revealPromise;
    const revealTime = Date.now();
    assert.ok(revealedData && Array.isArray(revealedData.players), 'simultaneousBidsRevealed liefert Spieler-Array');
    
    const hostPlayer = revealedData.players.find(p => p.sessionId === 'sess_h_vance');
    assert.strictEqual(hostPlayer.bid, 0, 'Host hat 0 getippt');

    const guestIris = revealedData.players.find(p => p.sessionId === 'sess_g_iris');
    assert.strictEqual(guestIris.bid, 1, 'Iris hat 1 getippt');

    // Warte auf turnChanged mit dem 1800ms Puffer
    await wait(2200);
    assert.ok(turnChangedTime !== null, 'turnChanged wurde nach Countdown-Puffer ausgelöst');
    const delayAfterReveal = turnChangedTime - revealTime;
    assert.ok(delayAfterReveal >= 1700, `Puffer nach Reveal beträgt mindestens 1700ms (tatsächlich: ${delayAfterReveal}ms)`);

    console.log(`✓ Simultan-Reveal & 1800ms Countdown-Puffer serverseitig fehlerfrei verifiziert (${delayAfterReveal}ms)`);

  } finally {
    if (c1) c1.disconnect();
    if (c2) c2.disconnect();
    if (c3) c3.disconnect();
    serverProc.kill();
  }
}

runSocketTests()
  .then(() => {
    console.log('\n--- ALLE TESTS ERFOLGREICH BESTANDEN! ---');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test fehlgeschlagen:', err);
    if (serverProc) serverProc.kill();
    process.exit(1);
  });
