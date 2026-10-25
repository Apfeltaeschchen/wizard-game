const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const TEST_PORT = 3900 + Math.floor(Math.random() * 900);
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- TESTE SCHRITT 6: GEZIELTES BOT-KICKEN IM WARTERAUM ---');

// 1. Quellcode-Validierung
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const clientJs = fs.readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');

assert.ok(indexHtml.includes('.btn-kick-bot'), '.btn-kick-bot CSS-Klasse in index.html definiert');
assert.ok(clientJs.includes('btn-kick-bot'), '.btn-kick-bot Button in client.js createPlayerWaitingItem vorhanden');
assert.ok(clientJs.includes('botSessionId: p.sessionId'), 'client.js sendet botSessionId an den Server');
assert.ok(serverJs.includes('botSessionId'), 'server/index.js unterstützt botSessionId in removeBot');
console.log('✓ 1. Quellcode-Prüfung: HTML-Styles, client.js Buttons und server/index.js Parameter verifiziert');

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let serverProc;

async function runIntegration() {
  serverProc = spawn('node', [path.join(__dirname, '../server/index.js')], {
    env: { ...process.env, PORT: TEST_PORT },
    stdio: 'pipe'
  });

  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('Server start timeout')), 5000);
    serverProc.stdout.on('data', (d) => {
      if (d.toString().includes('http://localhost')) {
        clearTimeout(to);
        resolve();
      }
    });
    serverProc.stderr.on('data', (d) => {
      console.error('[Server stderr]:', d.toString().trim());
    });
  });

  let hostClient, guestClient;

  try {
    hostClient = io(SERVER_URL, { forceNew: true });
    guestClient = io(SERVER_URL, { forceNew: true });

    await new Promise(r => hostClient.on('connect', r));
    await new Promise(r => guestClient.on('connect', r));

    const roomCode = 'BOTKICK';
    hostClient.emit('joinRoom', { playerName: 'Host Magus', roomCode, sessionId: 'sess_host_kick', createIfNotExists: true });
    await wait(250);

    let hostRoomPlayers = [];
    hostClient.on('roomUpdated', (players) => {
      hostRoomPlayers = players;
    });

    // 2. Drei Bots hinzufügen (Novize, Meister, Erzmagier)
    hostClient.emit('addBot', { roomCode, difficulty: 'novice' });
    await wait(120);
    hostClient.emit('addBot', { roomCode, difficulty: 'master' });
    await wait(120);
    hostClient.emit('addBot', { roomCode, difficulty: 'archmage' });
    await wait(250);

    assert.strictEqual(hostRoomPlayers.length, 4, 'Es müssen 4 Spieler im Raum sein (1 Host + 3 Bots)');
    const initialBots = hostRoomPlayers.filter(p => p.isBot);
    assert.strictEqual(initialBots.length, 3, 'Genau 3 Bots im Raum');

    const bot1 = initialBots[0];
    const bot2 = initialBots[1];
    const bot3 = initialBots[2];

    console.log(`✓ 2. Drei Bots erfolgreich hinzugefügt: ${bot1.name}, ${bot2.name}, ${bot3.name}`);

    // 3. Gezielter Kick des mittleren Bots (bot2)
    hostClient.emit('removeBot', { roomCode, botSessionId: bot2.sessionId });
    await wait(250);

    assert.strictEqual(hostRoomPlayers.length, 3, 'Nach gezieltem Kick müssen 3 Spieler im Raum sein');
    const remainingBots = hostRoomPlayers.filter(p => p.isBot);
    assert.strictEqual(remainingBots.length, 2, 'Genau 2 Bots verbleiben');
    assert.strictEqual(remainingBots.some(b => b.sessionId === bot2.sessionId), false, 'Bot 2 wurde gezielt entfernt');
    assert.strictEqual(remainingBots.some(b => b.sessionId === bot1.sessionId), true, 'Bot 1 ist weiterhin im Raum');
    assert.strictEqual(remainingBots.some(b => b.sessionId === bot3.sessionId), true, 'Bot 3 ist weiterhin im Raum');

    console.log(`✓ 3. Gezieltes Kicken von ${bot2.name} erfolgreich! ${bot1.name} und ${bot3.name} verbleiben unberührt.`);

    // 4. Nicht-Host Sicherheitstest: Gast versucht Bot zu entfernen
    guestClient.emit('joinRoom', { playerName: 'Gast Magus', roomCode, sessionId: 'sess_guest_kick' });
    await wait(250);

    let guestError = null;
    guestClient.on('actionError', (err) => {
      guestError = err;
    });

    guestClient.emit('removeBot', { roomCode, botSessionId: bot1.sessionId });
    await wait(250);

    assert.ok(guestError, 'Gast muss einen actionError erhalten');
    assert.strictEqual(guestError.message, 'Nur der Host kann Bots verwalten!');
    assert.strictEqual(hostRoomPlayers.some(p => p.sessionId === bot1.sessionId), true, 'Bot 1 darf nicht von Gast entfernt werden');
    console.log('✓ 4. Zero-Trust Schutz: Nicht-Host kann keine Bots kicken (actionError empfangen)');

    // 5. Abwärtskompatibler Kick ohne botSessionId (entfernt den letzten Bot)
    hostClient.emit('removeBot', { roomCode });
    await wait(250);

    const botsAfterPop = hostRoomPlayers.filter(p => p.isBot);
    assert.strictEqual(botsAfterPop.length, 1, 'Nur noch 1 Bot im Raum');
    assert.strictEqual(botsAfterPop[0].sessionId, bot1.sessionId, 'Letzter Bot (Bot 3) wurde durch Fallback entfernt, Bot 1 bleibt');
    console.log('✓ 5. Abwärtskompatibilität: removeBot ohne botSessionId entfernt den letzten Bot sauber');

    // 6. Test im 2vs2 Allianzen Modus
    hostClient.emit('setMatchFormat', { roomCode, matchFormat: 'team_2v2' });
    await wait(150);

    // Weiteren Bot hinzufügen
    hostClient.emit('addBot', { roomCode, difficulty: 'archmage' });
    await wait(250);

    const botInTeam = hostRoomPlayers.find(p => p.isBot && p.sessionId !== bot1.sessionId);
    assert.ok(botInTeam, 'Neuer Bot für 2vs2 vorhanden');

    // Gezielt neuen Bot kicken
    hostClient.emit('removeBot', { roomCode, botSessionId: botInTeam.sessionId });
    await wait(250);

    assert.strictEqual(hostRoomPlayers.some(p => p.sessionId === botInTeam.sessionId), false, 'Bot wurde im 2vs2-Modus gezielt entfernt');
    console.log('✓ 6. 2vs2 Allianzen Modus: Gezielter Bot-Kick bereinigt Raum und Teams');

  } finally {
    if (hostClient) hostClient.disconnect();
    if (guestClient) guestClient.disconnect();
    if (serverProc) serverProc.kill();
  }
}

runIntegration().then(() => {
  console.log('\n======================================================');
  console.log('🏆 SCHRITT 6 (GEZIELTES BOT-KICKEN) VOLLSTÄNDIG BESTANDEN!');
  console.log('======================================================\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ FEHLER IN SCHRITT 6 TEST:', err);
  if (serverProc) serverProc.kill();
  process.exit(1);
});
