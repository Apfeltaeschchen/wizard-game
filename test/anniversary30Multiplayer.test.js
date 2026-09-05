const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');

const TEST_PORT = 3893;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- STARTE WIZARD 30-JAHRE MULTIPLAYER TEST ---');

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
  let player2Client = io(SERVER_URL, { forceNew: true });
  let player3Client = io(SERVER_URL, { forceNew: true });

  try {
    let hostSessionId = 'host_session';
    let p2SessionId = 'p2_session';
    let p3SessionId = 'p3_session';

    // 1. Host erstellt Raum
    let roomCode = null;
    await new Promise((resolve) => {
      hostClient.emit('createRoom', { playerName: 'Erzmagier', sessionId: hostSessionId });
      hostClient.on('roomCreated', (data) => {
        roomCode = data.roomCode;
        resolve();
      });
    });
    assert.ok(roomCode, 'Raumcode muss vorhanden sein');
    console.log(`✓ Raum ${roomCode} von Host erstellt`);

    // 2. Nicht-Host versucht setEdition -> muss fehlschlagen
    player2Client.emit('joinRoom', { playerName: 'Gauckler', roomCode, sessionId: p2SessionId });
    await wait(200);

    let actionErrorReceived = false;
    player2Client.on('actionError', (err) => {
      actionErrorReceived = true;
    });
    player2Client.emit('setEdition', { roomCode, edition: 'anniversary_30' });
    await wait(200);
    assert.strictEqual(actionErrorReceived, true, 'Nicht-Host darf Edition nicht ändern');
    console.log('✓ Schutz: Nicht-Host darf Edition nicht ändern');

    // 3. Host ändert Edition auf 'anniversary_30'
    let editionChangedReceived = false;
    player2Client.on('editionChanged', ({ edition }) => {
      if (edition === 'anniversary_30') editionChangedReceived = true;
    });
    hostClient.emit('setEdition', { roomCode, edition: 'anniversary_30' });
    await wait(200);
    assert.strictEqual(editionChangedReceived, true, 'editionChanged Event an alle Spieler gesendet');
    console.log('✓ Host hat Edition erfolgreich auf anniversary_30 geändert');

    // 4. Spieler 3 tritt bei und erhält syncGameState mit anniversary_30
    let syncEdition = null;
    let syncMaxRounds = null;
    player3Client.on('syncGameState', (data) => {
      syncEdition = data.edition;
      syncMaxRounds = data.maxRounds;
    });
    player3Client.emit('joinRoom', { playerName: 'Alchemist', roomCode, sessionId: p3SessionId });
    await wait(300);
    assert.strictEqual(syncEdition, 'anniversary_30', 'Neuer Spieler synchronisiert mit anniversary_30');
    console.log('✓ Neuer Spieler empfängt anniversary_30 im GameState');

    // 5. Host startet Spiel (3 Spieler -> maxRounds = 21 für 63 Karten)
    let startedMaxRounds = null;
    hostClient.on('gameStarted', (data) => {
      startedMaxRounds = data.maxRounds;
    });
    hostClient.emit('startGame', { roomCode });
    await wait(400);
    assert.strictEqual(startedMaxRounds, 22, '3 Spieler in 30-Jahre-Edition haben genau 22 Runden (66/3)');
    console.log('✓ Spiel gestartet: Rundenanzahl ist 22 für 3 Spieler (66 Karten)');

    console.log('\n=======================================');
    console.log('30-JAHRE MULTIPLAYER-TEST ERFOLGREICH!');
    console.log('=======================================');
  } catch (err) {
    console.error('Testfehler:', err);
    process.exitCode = 1;
  } finally {
    hostClient.disconnect();
    player2Client.disconnect();
    player3Client.disconnect();
    serverProc.kill();
  }
}

run();
