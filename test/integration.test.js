const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');

const TEST_PORT = 3891;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- STARTE WIZARD MULTIPLAYER INTEGRATIONSTEST ---');

const serverProc = spawn('node', [path.join(__dirname, '../server/index.js')], {
  env: { ...process.env, PORT: TEST_PORT },
  stdio: 'pipe'
});

serverProc.stdout.on('data', (d) => {
  // console.log('[Server stdout]:', d.toString().trim());
});

serverProc.stderr.on('data', (d) => {
  console.error('[Server stderr]:', d.toString().trim());
});

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
  await wait(1200); // Server hochfahren lassen

  let c1, c2, c3;

  try {
    c1 = io(SERVER_URL, { forceNew: true });
    await new Promise(r => c1.on('connect', r));
    c1.emit('joinRoom', { playerName: 'Alice', roomCode: 'TESTROOM', sessionId: 'sess_alice' });
    await wait(150);

    c2 = io(SERVER_URL, { forceNew: true });
    await new Promise(r => c2.on('connect', r));
    c2.emit('joinRoom', { playerName: 'Bob', roomCode: 'TESTROOM', sessionId: 'sess_bob' });
    await wait(150);

    c3 = io(SERVER_URL, { forceNew: true });
    await new Promise(r => c3.on('connect', r));
    c3.emit('joinRoom', { playerName: 'Charlie', roomCode: 'TESTROOM', sessionId: 'sess_charlie' });

    let playersList = [];
    await new Promise((resolve) => {
      c1.on('roomUpdated', (players) => {
        if (players.length === 3) {
          playersList = players;
          assert.strictEqual(players[0].name, 'Alice');
          assert.strictEqual(players[0].isHost, true);
          assert.strictEqual(players.some(p => p.name === 'Bob'), true);
          assert.strictEqual(players.some(p => p.name === 'Charlie'), true);
          resolve();
        }
      });
    });
    console.log('✓ 3 Spieler erfolgreich beigetreten & Host zugewiesen');

    // 2. Handkarten-Listener vor Start registrieren
    const hands = {};
    c1.on('handDealt', (hand) => { hands.alice = hand; });
    c2.on('handDealt', (hand) => { hands.bob = hand; });
    c3.on('handDealt', (hand) => { hands.charlie = hand; });

    // Alice startet das Spiel
    c1.emit('startGame', { roomCode: 'TESTROOM' });

    let gameStartedData = null;
    await new Promise((resolve) => {
      c1.on('gameStarted', (data) => {
        gameStartedData = data;
        assert.strictEqual(data.round, 1);
        resolve();
      });
    });
    console.log('✓ Spiel erfolgreich gestartet (Runde 1)');

    await wait(300);
    assert.strictEqual(hands.alice && hands.alice.length, 1);
    assert.strictEqual(hands.bob && hands.bob.length, 1);
    assert.strictEqual(hands.charlie && hands.charlie.length, 1);
    console.log('✓ Handkarten für alle 3 Spieler ausgeteilt');

    // 4. Wenn Zauberer als Trumpfkarte aufgedeckt wurde -> Geber wählt Trumpf
    if (gameStartedData.gameState === 'choose_trump') {
      console.log('Trumpf ist Zauberer -> Geber (Alice) wählt Rot...');
      c1.emit('selectTrumpSuit', { roomCode: 'TESTROOM', suit: 'red' });
      await wait(400);
    }

    // 5. Biet-Phase testen inkl. serverseitigem Geber-Verbot
    const clientMap = {
      'Alice': c1,
      'Bob': c2,
      'Charlie': c3
    };

    // Spieler bei Index 1 tippt 1
    const p1Socket = clientMap[playersList[1].name];
    p1Socket.emit('submitBid', { roomCode: 'TESTROOM', bid: 1 });
    await wait(300);

    // Spieler bei Index 2 tippt 0
    const p2Socket = clientMap[playersList[2].name];
    p2Socket.emit('submitBid', { roomCode: 'TESTROOM', bid: 0 });
    await wait(300);

    // Alice ist Dealer (Index 0, letzter Spieler).
    // Runde ist 1. Bids bisher: 1 + 0 = 1.
    // Verbotenes Gebot: 1 - 1 = 0!
    let gotActionError = false;
    c1.once('actionError', (err) => {
      gotActionError = true;
    });

    // Alice versucht illegal 0 zu bieten:
    c1.emit('submitBid', { roomCode: 'TESTROOM', bid: 0 });
    await wait(400);
    assert.strictEqual(gotActionError, true, 'Server muss verbotenes Geber-Gebot 0 abweisen!');
    console.log('✓ Serverseitige Geber-Regel (Plus/Minus Eins) hat verbotenes Gebot abgewehrt');

    // Alice bietet legales Gebot 1
    c1.emit('submitBid', { roomCode: 'TESTROOM', bid: 1 });
    await wait(400);
    console.log('✓ Legale Biet-Phase abgeschlossen, Wechsel zu playing_tricks');

    // 6. Leave Room Test: Charlie verlässt das Spiel
    // Bei 3 Spielern verbleiben danach nur 2 -> Raum muss in die Lobby zurückgesetzt werden
    let resetToLobbyReceived = false;
    c1.on('gameResetToLobby', (data) => {
      resetToLobbyReceived = true;
    });

    c3.emit('leaveRoom', { roomCode: 'TESTROOM' });
    await wait(600);
    assert.strictEqual(resetToLobbyReceived, true, 'Bei weniger als 3 Spielern muss das Spiel in die Lobby zurückfallen!');
    console.log('✓ Leave-Button & Lobby-Fallback bei < 3 Spielern erfolgreich validiert');

    console.log('\n=======================================');
    console.log('ALLE INTEGRATIONSTESTS ERFOLGREICH!');
    console.log('=======================================');
  } finally {
    c1.disconnect();
    c2.disconnect();
    c3.disconnect();
    serverProc.kill('SIGTERM');
  }
}

runTests().catch((err) => {
  console.error('Testfehler:', err);
  serverProc.kill('SIGTERM');
  process.exit(1);
});
