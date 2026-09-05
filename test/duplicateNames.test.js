const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');

const TEST_PORT = 3894;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- STARTE TEST FÜR NAMENS-DUPLIKAT-SCHUTZ ---');

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
    // 1. Raum erstellen mit Host "Merlin"
    console.log('Test 1: Erstellung von Raum mit Spieler "Merlin"...');
    const h1 = io(SERVER_URL, { forceNew: true });
    socketsToClose.push(h1);

    let roomCode = null;
    await new Promise((resolve) => {
      h1.on('roomCreated', (data) => {
        roomCode = data.roomCode;
        resolve();
      });
      h1.emit('createRoom', { playerName: 'Merlin', sessionId: 'sess_merlin' });
    });

    assert.strictEqual(typeof roomCode, 'string');
    console.log(`✓ Raum ${roomCode} mit Host "Merlin" erstellt.`);

    // 2. Zweiter Spieler versucht mit exakt "Merlin" beizutreten -> Soll abgewiesen werden
    console.log('Test 2: Zweiter Spieler versucht mit gleichem Namen "Merlin" beizutreten...');
    const p2 = io(SERVER_URL, { forceNew: true });
    socketsToClose.push(p2);

    const errorExact = await new Promise((resolve) => {
      p2.on('lobbyError', (err) => resolve(err.message));
      p2.emit('joinRoom', { playerName: 'Merlin', roomCode: roomCode, sessionId: 'sess_imposter1' });
    });

    assert.strictEqual(typeof errorExact, 'string');
    assert.strictEqual(errorExact.includes('bereits vergeben'), true, 'Fehler muss über vergebenen Namen informieren');
    console.log(`✓ Exakter Duplikat-Name abgewiesen: "${errorExact}"`);

    // 3. Dritter Spieler versucht mit case-insensitiver Variante "  merlin  " beizutreten -> Soll ebenfalls abgewiesen werden
    console.log('Test 3: Dritter Spieler versucht mit "  merlin  " (kleingeschrieben & Leerzeichen) beizutreten...');
    const p3 = io(SERVER_URL, { forceNew: true });
    socketsToClose.push(p3);

    const errorCase = await new Promise((resolve) => {
      p3.on('lobbyError', (err) => resolve(err.message));
      p3.emit('joinRoom', { playerName: '  merlin  ', roomCode: roomCode, sessionId: 'sess_imposter2' });
    });

    assert.strictEqual(typeof errorCase, 'string');
    assert.strictEqual(errorCase.includes('bereits vergeben'), true, 'Case-insensitive Duplikate müssen abgewiesen werden');
    console.log(`✓ Case-insensitiver Duplikat-Name abgewiesen: "${errorCase}"`);

    // 4. Einzigartiger Name "Gandalf" darf beitreten
    console.log('Test 4: Einzigartiger Name "Gandalf" tritt bei...');
    const pLegal = io(SERVER_URL, { forceNew: true });
    socketsToClose.push(pLegal);

    let joinSuccess = false;
    await new Promise((resolve) => {
      pLegal.on('roomUpdated', (players) => {
        if (players.some(p => p.name === 'Gandalf')) {
          joinSuccess = true;
          resolve();
        }
      });
      pLegal.emit('joinRoom', { playerName: 'Gandalf', roomCode: roomCode, sessionId: 'sess_gandalf' });
    });

    assert.strictEqual(joinSuccess, true, 'Einzigartiger Spielername muss erfolgreich beitreten können');
    console.log('✓ Einzigartiger Spielername "Gandalf" erfolgreich beigetreten.');

    // 5. Reconnect von "Merlin" mit gleicher Session-ID ist erlaubt
    console.log('Test 5: Reconnect von "Merlin" mit derselben sessionId...');
    const h1Reconnect = io(SERVER_URL, { forceNew: true });
    socketsToClose.push(h1Reconnect);

    let reconnectSuccess = false;
    await new Promise((resolve) => {
      h1Reconnect.on('syncGameState', () => {
        reconnectSuccess = true;
        resolve();
      });
      h1Reconnect.emit('joinRoom', { playerName: 'Merlin', roomCode: roomCode, sessionId: 'sess_merlin' });
    });

    assert.strictEqual(reconnectSuccess, true, 'Reconnect mit gleicher Session-ID muss problemlos funktionieren');
    console.log('✓ Reconnect von "Merlin" mit gleicher Session-ID erfolgreich zugelassen.');

    // 6. Name "Merlin" in einem ANDEREN Raum darf problemlos existieren
    console.log('Test 6: Name "Merlin" in einem separaten zweiten Raum...');
    const otherRoomHost = io(SERVER_URL, { forceNew: true });
    socketsToClose.push(otherRoomHost);

    let otherRoomCode = null;
    await new Promise((resolve) => {
      otherRoomHost.on('roomCreated', (data) => {
        otherRoomCode = data.roomCode;
        resolve();
      });
      otherRoomHost.emit('createRoom', { playerName: 'Merlin', sessionId: 'sess_merlin_other' });
    });

    assert.strictEqual(typeof otherRoomCode, 'string');
    assert.notStrictEqual(otherRoomCode, roomCode);
    console.log(`✓ Name "Merlin" in anderem Raum ${otherRoomCode} unabhängig erlaubt.`);

    console.log('\n======================================================');
    console.log('ALLE TESTS FÜR NAMENS-DUPLIKAT-SCHUTZ ERFOLGREICH!');
    console.log('======================================================\n');

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
