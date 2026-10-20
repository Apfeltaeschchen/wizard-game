const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const TEST_PORT = 3995;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- STARTE HOST SETTINGS MENU & SCORING MULTIPLAYER TEST ---');

// Quellcode-Prüfung: Universeller Button & saubere Warteraum-Struktur
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const clientJs = fs.readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');

assert.ok(indexHtml.includes('id="btnOpenHostSettings"'), 'btnOpenHostSettings Button existiert');
assert.ok(!indexHtml.includes('id="btnOpenHostSettings" type="button" class="btn-auth-bar btn-auth-gold" style="width: 100%; margin: 8px 0 6px; display: none;'), 'btnOpenHostSettings darf nicht mehr initial auf display:none stehen');
assert.ok(indexHtml.includes('id="hostSettingsGuestNotice"'), 'hostSettingsGuestNotice Info-Banner für Gäste existiert');
assert.ok(!indexHtml.includes('id="btnRemoveBot"'), 'Großer btnRemoveBot Button wurde aus dem Warteraum entfernt');
assert.ok(!indexHtml.includes('id="room-settings-summary-bar"'), 'Alte Status-Badges unter dem Button wurden entfernt');

assert.ok(clientJs.includes('hostSettingsGuestNotice'), 'client.js bindet hostSettingsGuestNotice ein');
assert.ok(clientJs.includes('modalEditionSelect.disabled = !isEditable'), 'client.js sperrt Eingaben im Gast-Modus');
console.log('✓ 0. Quellcode-Prüfung: Universeller Settings-Button & Warteraum-Bereinigung verifiziert');

const serverProc = spawn('node', [path.join(__dirname, '../server/index.js')], {
  env: { ...process.env, PORT: TEST_PORT },
  stdio: 'pipe'
});

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await wait(1200);

  let hostClient = io(SERVER_URL, { forceNew: true });
  let guestClient = io(SERVER_URL, { forceNew: true });
  let newJoinerClient = io(SERVER_URL, { forceNew: true });

  try {
    const hostSessionId = 'host_settings_test_session';
    const guestSessionId = 'guest_settings_test_session';
    const newJoinerSessionId = 'new_joiner_session';

    // 1. Host erstellt Raum
    let roomCode = null;
    let initialScoringMode = null;
    await new Promise((resolve) => {
      hostClient.emit('createRoom', { playerName: 'HostMagier', sessionId: hostSessionId });
      hostClient.on('roomCreated', (data) => {
        roomCode = data.roomCode;
        initialScoringMode = data.scoringMode;
        resolve();
      });
    });

    assert.ok(roomCode, 'Raumcode muss vorhanden sein');
    assert.strictEqual(initialScoringMode, 'classic', 'Standard-Wertungsmodus muss classic sein');
    console.log(`✓ 1. Raum ${roomCode} mit Default scoringMode='classic' erstellt`);

    // 2. Gast tritt bei
    await new Promise((resolve) => {
      guestClient.on('roomUpdated', resolve);
      guestClient.emit('joinRoom', { playerName: 'GastZauberer', roomCode, sessionId: guestSessionId });
    });
    console.log('✓ 2. Gast erfolgreich beigetreten');

    // 3. Zero-Trust: Gast versucht updateRoomSettings -> muss mit actionError abgewiesen werden
    const actionErrorPromise = new Promise((resolve) => {
      guestClient.on('actionError', (err) => resolve(err.message));
    });
    guestClient.emit('updateRoomSettings', {
      roomCode,
      edition: 'anniversary_30',
      matchFormat: 'team_2v2',
      scoringMode: 'skull_king_zero'
    });
    const errorMsg = await Promise.race([actionErrorPromise, wait(1500).then(() => null)]);
    assert.ok(errorMsg && errorMsg.includes('Nur der Host'), 'Gast darf Spieleinstellungen nicht ändern');
    console.log('✓ 3. Zero-Trust Schutz: Nicht-Host wurde abgewehrt');

    // 4. Host aktualisiert alle Einstellungen via updateRoomSettings
    let receivedSettings = null;
    const settingsPromise = new Promise((resolve) => {
      guestClient.on('roomSettingsUpdated', (data) => {
        receivedSettings = data;
        resolve();
      });
    });

    hostClient.emit('updateRoomSettings', {
      roomCode,
      edition: 'anniversary_30',
      matchFormat: 'team_2v2',
      scoringMode: 'skull_king_zero'
    });

    await Promise.race([settingsPromise, wait(2000)]);
    assert.ok(receivedSettings, 'roomSettingsUpdated muss empfangen worden sein');
    assert.strictEqual(receivedSettings.edition, 'anniversary_30', 'Edition muss anniversary_30 sein');
    assert.strictEqual(receivedSettings.matchFormat, 'team_2v2', 'Matchformat muss team_2v2 sein');
    assert.strictEqual(receivedSettings.scoringMode, 'skull_king_zero', 'ScoringMode muss skull_king_zero sein');
    console.log('✓ 4. Host hat Einstellungen erfolgreich aktualisiert & an Gast gebroadcastet');

    // 5. Neuer Spieler joint und empfängt die aktuellen Einstellungen im GameState
    let joinState = null;
    await new Promise((resolve) => {
      newJoinerClient.on('syncGameState', (state) => {
        joinState = state;
        resolve();
      });
      newJoinerClient.on('gameState', (state) => {
        joinState = state;
        resolve();
      });
      newJoinerClient.emit('joinRoom', { playerName: 'Spätzünder', roomCode, sessionId: newJoinerSessionId });
    });

    assert.ok(joinState, 'GameState muss empfangen werden');
    assert.strictEqual(joinState.scoringMode, 'skull_king_zero', 'Neuer Spieler muss aktuellen scoringMode erhalten');
    assert.strictEqual(joinState.edition, 'anniversary_30', 'Neuer Spieler muss aktuelle Edition erhalten');
    assert.strictEqual(joinState.matchFormat, 'team_2v2', 'Neuer Spieler muss aktuelles MatchFormat erhalten');
    console.log('✓ 5. Neuer Spieler empfängt synchrone Raum-Einstellungen im GameState');

    console.log('========================================================');
    console.log('🏆 ALLE HOST SETTINGS MENU MULTIPLAYER TESTS BESTANDEN!');
    console.log('========================================================');
  } finally {
    hostClient.disconnect();
    guestClient.disconnect();
    newJoinerClient.disconnect();
    serverProc.kill();
  }
}

run().catch((err) => {
  console.error('Test fehlgeschlagen:', err);
  serverProc.kill();
  process.exit(1);
});
