const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');

const TEST_PORT = 3893;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- STARTE TEST FÜR EINZIGARTIGE ZAHLENCODES & RAUM-ISOLIERUNG ---');

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
  await wait(1200); // Server hochfahren lassen

  const socketsToClose = [];

  try {
    // 1. TEST: 20 parallele Räume erstellen und prüfen, ob alle Codes 6-stellig, numerisch und kollisionsfrei sind
    console.log('Test 1: Erstellung von 20 parallelen Räumen mit eindeutigen 6-stelligen Zahlencodes...');
    const generatedCodes = new Set();
    const createPromises = [];

    for (let i = 0; i < 20; i++) {
      const sock = io(SERVER_URL, { forceNew: true });
      socketsToClose.push(sock);
      const p = new Promise((resolve, reject) => {
        sock.on('roomCreated', ({ roomCode }) => {
          assert.strictEqual(typeof roomCode, 'string', 'roomCode muss String sein');
          assert.strictEqual(/^\d{6}$/.test(roomCode), true, `roomCode ${roomCode} muss genau 6 Ziffern lang sein`);
          assert.strictEqual(generatedCodes.has(roomCode), false, `Kollision entdeckt! Raumcode ${roomCode} wurde doppelt vergeben!`);
          generatedCodes.add(roomCode);
          resolve(roomCode);
        });
        sock.on('lobbyError', (err) => reject(new Error(err.message)));
        sock.emit('createRoom', { playerName: `Host_${i}`, sessionId: `sess_host_${i}` });
      });
      createPromises.push(p);
      await wait(30); // Leichtes Sequencing für Socket.io
    }

    const codes = await Promise.all(createPromises);
    assert.strictEqual(codes.length, 20);
    assert.strictEqual(generatedCodes.size, 20, 'Alle 20 erstellten Zahlencodes müssen einzigartig sein!');
    console.log(`✓ 20 Räume erfolgreich mit einzigartigen 6-stelligen Codes erstellt: ${Array.from(generatedCodes).slice(0, 5).join(', ')}...`);

    // 2. TEST: Raum-Isolierung zwischen zwei parallelen Spielen (Raum A und Raum B)
    console.log('Test 2: Parallele Raum-Isolierung zwischen Raum A und Raum B...');
    const h1 = io(SERVER_URL, { forceNew: true });
    const h2 = io(SERVER_URL, { forceNew: true });
    const p1 = io(SERVER_URL, { forceNew: true });
    const p2 = io(SERVER_URL, { forceNew: true });
    socketsToClose.push(h1, h2, p1, p2);

    let roomACode = null;
    let roomBCode = null;

    await new Promise((resolve) => {
      h1.on('roomCreated', ({ roomCode }) => {
        roomACode = roomCode;
        resolve();
      });
      h1.emit('createRoom', { playerName: 'Host_A', sessionId: 'sess_h1' });
    });

    await new Promise((resolve) => {
      h2.on('roomCreated', ({ roomCode }) => {
        roomBCode = roomCode;
        resolve();
      });
      h2.emit('createRoom', { playerName: 'Host_B', sessionId: 'sess_h2' });
    });

    assert.notStrictEqual(roomACode, roomBCode, 'Raum A und Raum B müssen unterschiedliche Codes haben');

    let roomAReceivedPlayerB = false;
    let roomBReceivedPlayerA = false;

    h1.on('roomUpdated', (players) => {
      if (players.some(p => p.name === 'Player_B')) {
        roomAReceivedPlayerB = true;
      }
    });

    h2.on('roomUpdated', (players) => {
      if (players.some(p => p.name === 'Player_A')) {
        roomBReceivedPlayerA = true;
      }
    });

    // Player A tritt Raum A bei
    p1.emit('joinRoom', { playerName: 'Player_A', roomCode: roomACode, sessionId: 'sess_p1' });
    // Player B tritt Raum B bei
    p2.emit('joinRoom', { playerName: 'Player_B', roomCode: roomBCode, sessionId: 'sess_p2' });

    await wait(400);

    assert.strictEqual(roomAReceivedPlayerB, false, 'Raum A darf keine Spieler aus Raum B empfangen!');
    assert.strictEqual(roomBReceivedPlayerA, false, 'Raum B darf keine Spieler aus Raum A empfangen!');
    console.log('✓ Vollständige Raum-Isolierung bestätigt: Events dringen nicht in fremde Räume');

    // 3. TEST: joinRoom mit nicht-existentem Zahlencode liefert lobbyError
    console.log('Test 3: joinRoom mit nicht existierendem Code...');
    const fakeSock = io(SERVER_URL, { forceNew: true });
    socketsToClose.push(fakeSock);

    const nonExistentError = await new Promise((resolve) => {
      fakeSock.on('lobbyError', (err) => resolve(err.message));
      fakeSock.emit('joinRoom', { playerName: 'LostPlayer', roomCode: '999991', sessionId: 'sess_lost' });
    });

    assert.strictEqual(typeof nonExistentError, 'string');
    assert.strictEqual(nonExistentError.includes('Kein aktiver Raum'), true, 'Fehlermeldung muss über nicht existierenden Raum informieren');
    console.log(`✓ Nicht-existenter Raum wird sauber abgewiesen: "${nonExistentError}"`);

    console.log('\n=============================================');
    console.log('ALLE TESTS FÜR EINZIGARTIGE ZAHLENCODES ERFOLGREICH!');
    console.log('=============================================\n');

  } finally {
    socketsToClose.forEach(s => s.disconnect());
    serverProc.kill();
  }
}

runTests().catch(err => {
  console.error('TEST FEHLGESCHLAGEN:', err);
  serverProc.kill();
  process.exit(1);
});
