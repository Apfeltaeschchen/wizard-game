const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');

const TEST_PORT = 3894;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- STARTE TEST FÜR RAUMCODE-ERHALT BEI SPIELER-ABBRUCH ---');

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

async function runTests() {
  await wait(1200);

  const socketsToClose = [];

  try {
    // 1. Host erstellt Raum
    const hostSock = io(SERVER_URL, { forceNew: true });
    socketsToClose.push(hostSock);

    let originalRoomCode = null;
    await new Promise((resolve, reject) => {
      hostSock.on('roomCreated', ({ roomCode }) => {
        originalRoomCode = roomCode;
        resolve();
      });
      hostSock.on('lobbyError', reject);
      hostSock.emit('createRoom', { playerName: 'Merlin', sessionId: 'sess_merlin' });
    });

    assert.strictEqual(/^\d{6}$/.test(originalRoomCode), true, 'Code muss 6-stellig sein');
    console.log(`✓ Raum mit Code ${originalRoomCode} erstellt`);

    // 2. Zwei weitere Spieler treten bei (Arthur und Morgana)
    const p2Sock = io(SERVER_URL, { forceNew: true });
    const p3Sock = io(SERVER_URL, { forceNew: true });
    socketsToClose.push(p2Sock, p3Sock);

    await new Promise((resolve) => {
      p2Sock.emit('joinRoom', { playerName: 'Arthur', roomCode: originalRoomCode, sessionId: 'sess_arthur' });
      p2Sock.on('roomUpdated', resolve);
    });

    await new Promise((resolve) => {
      p3Sock.emit('joinRoom', { playerName: 'Morgana', roomCode: originalRoomCode, sessionId: 'sess_morgana' });
      p3Sock.on('roomUpdated', resolve);
    });

    console.log('✓ 3 Spieler erfolgreich im Warteraum');

    // 3. Spiel starten
    await new Promise((resolve) => {
      hostSock.emit('startGame', { roomCode: originalRoomCode });
      hostSock.on('gameStarted', resolve);
    });

    console.log('✓ Spiel gestartet (Runde 1)');
    await wait(300);

    // 4. Spieler 3 (Morgana) verlässt das Spiel -> Weniger als 3 Spieler -> Rückfall in den Warteraum
    let resetReceived = false;
    let codeAfterReset = null;

    const resetPromise = new Promise((resolve) => {
      hostSock.on('gameResetToLobby', ({ message, players, roomCode }) => {
        resetReceived = true;
        codeAfterReset = roomCode;
        resolve();
      });
    });

    p3Sock.emit('leaveRoom', { roomCode: originalRoomCode });
    await resetPromise;

    assert.strictEqual(resetReceived, true, 'gameResetToLobby muss empfangen worden sein');
    assert.strictEqual(codeAfterReset, originalRoomCode, `Raumcode nach Reset (${codeAfterReset}) muss exakt dem ursprünglichen Code (${originalRoomCode}) entsprechen!`);
    console.log(`✓ Nach Rausfliegen/Verlassen: Verbleibende Spieler landen im Warteraum mit EXAKT DEMSELBEN Code: ${codeAfterReset}`);

    // 5. Ein neuer Spieler (Lancelot) kann dem Raum mit demselben Code beitreten
    const p4Sock = io(SERVER_URL, { forceNew: true });
    socketsToClose.push(p4Sock);

    let joinedSuccessfully = false;
    await new Promise((resolve) => {
      p4Sock.emit('joinRoom', { playerName: 'Lancelot', roomCode: originalRoomCode, sessionId: 'sess_lancelot' });
      p4Sock.on('roomUpdated', (players) => {
        assert.strictEqual(players.some(p => p.name === 'Lancelot'), true);
        joinedSuccessfully = true;
        resolve();
      });
    });

    assert.strictEqual(joinedSuccessfully, true, 'Neuer Spieler muss mit demselben Code beitreten können');
    console.log(`✓ Neuer Spieler 'Lancelot' ist erfolgreich mit demselben Code ${originalRoomCode} beigetreten!`);

    // 6. Host kann das Spiel mit den 3 Spielern erneut starten
    let restarted = false;
    await new Promise((resolve) => {
      hostSock.emit('startGame', { roomCode: originalRoomCode });
      hostSock.on('gameStarted', () => {
        restarted = true;
        resolve();
      });
    });

    assert.strictEqual(restarted, true, 'Spiel muss im selben Raum erneut gestartet werden können');
    console.log('✓ Spiel erfolgreich erneut gestartet!');

    console.log('\n======================================================');
    console.log('ALLE TESTS FÜR RAUMCODE-ERHALT ERFOLGREICH!');
    console.log('======================================================\n');
  } finally {
    socketsToClose.forEach(s => s.disconnect());
    serverProc.kill('SIGTERM');
  }
}

runTests().catch(err => {
  console.error('Test fehlgeschlagen:', err);
  serverProc.kill('SIGTERM');
  process.exit(1);
});
