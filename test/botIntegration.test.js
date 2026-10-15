const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');

const TEST_PORT = 3899;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- STARTE WIZARD BOT & SOLO-MODUS INTEGRATIONSTEST ---');

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

  let client;

  try {
    client = io(SERVER_URL, { forceNew: true });
    await new Promise(r => client.on('connect', r));

    const roomCode = 'BOTROOM';
    client.emit('joinRoom', { playerName: 'Archmage Solo', roomCode: roomCode, sessionId: 'sess_solo_host', createIfNotExists: true });
    await wait(200);

    let playersInRoom = [];
    const wait3Players = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout beim Warten auf 3 Spieler (1 Mensch + 2 Bots). Zuletzt empfangen: ' + playersInRoom.length)), 4000);
      client.on('roomUpdated', (players) => {
        playersInRoom = players;
        if (players.length === 3) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    // 1. Ersten Bot hinzufügen
    client.emit('addBot', { roomCode });
    await wait(150);

    // 2. Zweiten Bot hinzufügen
    client.emit('addBot', { roomCode });

    await wait3Players;

    assert.strictEqual(playersInRoom.length, 3, 'Es müssen genau 3 Spieler im Raum sein.');
    assert.strictEqual(playersInRoom[0].sessionId, 'sess_solo_host', 'Host muss der erste Spieler sein.');
    const botPlayers = playersInRoom.filter(p => p.sessionId.startsWith('bot_'));
    assert.strictEqual(botPlayers.length, 2, 'Es müssen genau 2 KI-Magier im Raum sein.');
    console.log('✓ 2 Bots erfolgreich zum Warteraum hinzugefügt: ' + botPlayers.map(b => b.name).join(', '));

    // 3. Spiel starten (Host startet für 3 Spieler)
    let handReceived = null;
    client.on('handDealt', (hand) => {
      handReceived = hand;
    });

    client.emit('startGame', { roomCode });
    await wait(400);

    assert(handReceived !== null, 'Host muss Handkarten für Runde 1 erhalten haben.');
    console.log('✓ Spiel erfolgreich gestartet!');

    // 4. Biet- und Spielablauf: Bots müssen automatisch ziehen
    let turnsObserved = [];
    let biddingFinished = false;
    let trickCompleted = false;

    client.on('actionError', err => console.log('[Client actionError]:', err));
    client.on('invalidMove', err => console.log('[Client invalidMove]:', err));
    client.on('trickWinner', res => {
      console.log('✓ trickWinner Event empfangen:', res);
      trickCompleted = true;
    });

    client.on('turnChanged', (turnData) => {
      turnsObserved.push(turnData);
      console.log('[Turn Changed]: active=' + turnData.activePlayerSessionId + ', state=' + turnData.gameState);
    });

    client.on('biddingFinished', () => {
      console.log('✓ biddingFinished Event empfangen');
      biddingFinished = true;
    });

    // Prüfe Turn-Ablauf: wenn Host an der Reihe ist, Gebot 0 abgeben
    const maxWaitTime = 8000;
    const startTime = Date.now();
    let hostBidded = false;

    while (Date.now() - startTime < maxWaitTime) {
      const lastTurn = turnsObserved[turnsObserved.length - 1];
      if (lastTurn && lastTurn.gameState === 'bidding' && lastTurn.activePlayerSessionId === 'sess_solo_host' && !hostBidded) {
        hostBidded = true;
        const bidToSubmit = (lastTurn.forbiddenBid === 0) ? 1 : 0;
        console.log(`Host gibt Gebot ab: ${bidToSubmit} (verboten war: ${lastTurn.forbiddenBid})`);
        client.emit('submitBid', { roomCode, bid: bidToSubmit });
      } else if (lastTurn && lastTurn.gameState === 'choose_trump' && lastTurn.activePlayerSessionId === 'sess_solo_host') {
        client.emit('selectTrumpSuit', { roomCode, suit: 'red' });
      }

      if (biddingFinished) {
        break;
      }
      await wait(300);
    }

    assert.strictEqual(biddingFinished, true, 'Bietphase mit Bots muss erfolgreich beendet worden sein.');
    console.log('✓ Bietphase mit Bots lief vollautomatisch durch!');

    // 5. Spielphase: Runde 1 Stich spielen
    let hostPlayed = false;
    const playStartTime = Date.now();
    while (Date.now() - playStartTime < 8000) {
      const lastTurn = turnsObserved[turnsObserved.length - 1];
      if (lastTurn && lastTurn.gameState === 'playing_tricks' && lastTurn.activePlayerSessionId === 'sess_solo_host' && !hostPlayed) {
        hostPlayed = true;
        console.log('Host spielt Karte 0 aus...');
        client.emit('playCard', { roomCode, cardIndex: 0 });
      }
      if (trickCompleted) {
        break;
      }
      await wait(300);
    }

    assert.strictEqual(trickCompleted, true, 'Stich in Runde 1 muss von Spieler und Bots beendet worden sein.');
    console.log('✓ Runde 1 Stich wurde erfolgreich ausgewertet und Bots spielten vollautomatisch!');

    console.log('\n=========================================');
    console.log('🏆 ALLE BOT-INTEGRATIONSTESTS ERFOLGREICH BESTANDEN!');
    console.log('=========================================\n');

  } finally {
    if (client) client.disconnect();
    serverProc.kill();
  }
}

runTests().catch(err => {
  console.error('\n❌ FEHLER BEIM BOT-INTEGRATIONSTEST:', err);
  serverProc.kill();
  process.exit(1);
});
