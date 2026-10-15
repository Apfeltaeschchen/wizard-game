const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const TEST_PORT = 3915;
const SERVER_URL = `http://localhost:${TEST_PORT}`;
const testDbPath = path.join(__dirname, 'test_friends_integ_' + Date.now() + '.db');

console.log('--- STARTE FREUNDESYSTEM & EINLADUNGS-INTEGRATIONSTEST ---');

const serverProc = spawn('node', [path.join(__dirname, '../server/index.js')], {
  env: { ...process.env, PORT: TEST_PORT, WIZARD_DB_PATH: testDbPath },
  stdio: 'pipe'
});

serverProc.stderr.on('data', (d) => {
  console.error('[Server stderr]:', d.toString().trim());
});

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function createClient(token) {
  return io(SERVER_URL, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true
  });
}

async function registerViaHttp(username, password) {
  const resp = await fetch(`${SERVER_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, avatar_id: 'wizard_blue' })
  });
  return await resp.json();
}

async function runTests() {
  await wait(1400); // Server hochfahren lassen

  let clientA;
  let clientB;

  try {
    // 1. Registriere zwei Magier über die HTTP API
    const rA = await registerViaHttp('MerlinHost', 'pass123');
    const rB = await registerViaHttp('MorganaGuest', 'pass456');
    assert.strictEqual(rA.success, true, 'Merlin registriert');
    assert.strictEqual(rB.success, true, 'Morgana registriert');

    const tokenA = rA.token;
    const tokenB = rB.token;
    const userA = rA.user;
    const userB = rB.user;

    // 2. Clients verbinden
    clientA = createClient(tokenA);
    clientB = createClient(tokenB);

    await Promise.all([
      new Promise(res => clientA.on('connect', res)),
      new Promise(res => clientB.on('connect', res))
    ]);
    console.log('✓ 1. Beide Sockets erfolgreich mit Authentifizierung verbunden');

    // 3. Magier A fügt Magier B als Gefährten hinzu
    const addPromiseB = new Promise(resolve => {
      clientB.on('friendsList', ({ friends }) => {
        const found = friends.find(f => f.username === 'MerlinHost');
        if (found) resolve(found);
      });
    });

    const addPromiseA = new Promise(resolve => {
      clientA.on('friendActionSuccess', ({ message }) => {
        resolve(message);
      });
    });

    clientA.emit('addFriend', { friendUsername: 'MorganaGuest' });

    const [msgA, friendOnB] = await Promise.all([addPromiseA, addPromiseB]);
    assert.ok(msgA.includes('Gefährte'), 'Erfolgsmeldung bei Freundschaft');
    assert.strictEqual(friendOnB.username, 'MerlinHost');
    assert.strictEqual(friendOnB.liveStatus, 'citadel');
    console.log('✓ 2. Freundschaftsanfrage verarbeitet, wechselseitig synchronisiert und Live-Status (citadel) erkannt');

    // 4. Magier A erstellt einen Spielraum
    const roomCode = '987123';
    const roomCreatedPromise = new Promise(resolve => {
      clientA.once('roomCreated', resolve);
    });

    clientA.emit('createRoom', {
      playerName: userA.username,
      sessionId: 'sess_merlin_host',
      roomCode: roomCode,
      authToken: tokenA
    });

    await roomCreatedPromise;
    console.log('✓ 3. Host hat Raum 987123 gegründet');

    // 5. Magier A lädt Magier B ein
    const invitePromise = new Promise(resolve => {
      clientB.once('friendGameInvite', (inviteData) => {
        resolve(inviteData);
      });
    });

    clientA.emit('inviteFriendToRoom', {
      friendId: userB.id,
      roomCode: roomCode
    });

    const invite = await invitePromise;
    assert.strictEqual(invite.roomCode, roomCode);
    assert.strictEqual(invite.hostName, 'MerlinHost');
    assert.strictEqual(invite.hostAvatar, 'wizard_blue');
    console.log('✓ 4. Overwatch-Style Spieleinladung bei Magier B eingetroffen:', invite.hostName, '-> Raum', invite.roomCode);

    // 6. Magier B nimmt Einladung an und tritt dem Raum bei
    const joinPromise = new Promise(resolve => {
      clientB.once('syncGameState', (state) => {
        resolve(state);
      });
    });

    clientB.emit('joinRoom', {
      playerName: userB.username,
      roomCode: invite.roomCode,
      sessionId: 'sess_morgana_guest',
      authToken: tokenB
    });

    const gameState = await joinPromise;
    assert.strictEqual(gameState.roomCode, roomCode);
    assert.strictEqual(gameState.players.length, 2);
    console.log('✓ 5. Magier B ist dem Raum über die Einladung erfolgreich beigetreten');

    console.log('\n======================================================');
    console.log('🏆 ALLE FREUNDES- & EINLADUNGS-INTEGRATIONSTESTS BESTANDEN!');
    console.log('======================================================\n');
  } finally {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    serverProc.kill();
    await wait(300);
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
      if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    } catch (e) {}
  }
}

runTests().catch(err => {
  console.error('Testfehler:', err);
  serverProc.kill();
  process.exit(1);
});
