const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');

const TEST_PORT = 3892;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- STARTE PAUSE & RECONNECT INTEGRATIONSTEST ---');

const serverProc = spawn('node', [path.join(__dirname, '../server/index.js')], {
  env: { ...process.env, PORT: TEST_PORT },
  stdio: 'pipe'
});

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await wait(1200);

  let c1 = io(SERVER_URL, { forceNew: true });
  let c2 = io(SERVER_URL, { forceNew: true });
  let c3 = io(SERVER_URL, { forceNew: true });
  let c4 = io(SERVER_URL, { forceNew: true });

  try {
    c1.on('actionError', (e) => console.log('Action error c1:', e));
    c1.emit('joinRoom', { playerName: 'Alice', roomCode: 'PAUSEROOM', sessionId: 's_alice' });
    await wait(150);
    c2.emit('joinRoom', { playerName: 'Bob', roomCode: 'PAUSEROOM', sessionId: 's_bob' });
    await wait(150);
    c3.emit('joinRoom', { playerName: 'Charlie', roomCode: 'PAUSEROOM', sessionId: 's_charlie' });
    await wait(150);
    c4.emit('joinRoom', { playerName: 'Dave', roomCode: 'PAUSEROOM', sessionId: 's_dave' });

    await new Promise((resolve) => {
      c1.on('roomUpdated', (players) => {
        if (players.length === 4) resolve();
      });
    });
    console.log('✓ 4 Spieler beigetreten');

    // Spiel starten
    c1.emit('startGame', { roomCode: 'PAUSEROOM' });
    await wait(500);

    // Dave trennt die Verbindung
    let gamePausedReceived = false;
    c1.on('gamePaused', (data) => {
      gamePausedReceived = true;
      assert.strictEqual(data.pausedPlayerName, 'Dave');
    });

    c4.disconnect();
    await wait(600);
    assert.strictEqual(gamePausedReceived, true, 'gamePaused Event muss bei Disconnect gefeuert werden');
    console.log('✓ Disconnect löst Spielpause aus');

    // Dave reconnectet mit derselben Session
    let gameResumedReceived = false;
    c1.on('gameResumed', () => {
      gameResumedReceived = true;
    });

    c4 = io(SERVER_URL, { forceNew: true });
    c4.emit('joinRoom', { playerName: 'Dave', roomCode: 'PAUSEROOM', sessionId: 's_dave' });
    await wait(600);
    assert.strictEqual(gameResumedReceived, true, 'gameResumed Event muss nach Reconnect gefeuert werden');
    console.log('✓ Reconnect hebt Spielpause erfolgreich auf');

    // Dave verlässt das Spiel freiwillig (4 Spieler -> 3 verbleiben)
    let roundReDealtReceived = false;
    c1.on('roundReDealt', (data) => {
      roundReDealtReceived = true;
      assert.strictEqual(data.round, 1);
    });

    c4.emit('leaveRoom', { roomCode: 'PAUSEROOM' });
    await wait(600);
    assert.strictEqual(roundReDealtReceived, true, 'Bei >= 3 verbleibenden Spielern muss die Runde neu ausgeteilt werden!');
    console.log('✓ Bei 4 Spielern führt Leave von einem Spieler zum Neustart der aktuellen Runde mit 3 Spielern');

    console.log('\n=======================================');
    console.log('PAUSE & RECONNECT TEST BESTANDEN!');
    console.log('=======================================');
  } finally {
    c1.disconnect();
    c2.disconnect();
    c3.disconnect();
    c4.disconnect();
    serverProc.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('Testfehler:', err);
  serverProc.kill('SIGTERM');
  process.exit(1);
});
