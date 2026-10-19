const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const TEST_PORT = 3974;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- TESTE SCHRITT 7: ECHTE MITSPIELER KICKEN (HOST KICK-SYSTEM) ---');

// 1. Quellcode-Validierung
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const clientJs = fs.readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');

assert.ok(indexHtml.includes('.btn-kick-player'), '.btn-kick-player CSS-Klasse in index.html definiert');
assert.ok(clientJs.includes('btn-kick-player'), '.btn-kick-player Button in client.js vorhanden');
assert.ok(clientJs.includes("socket.on('kickedFromRoom'"), "socket.on('kickedFromRoom') Handler in client.js vorhanden");
assert.ok(clientJs.includes("socket.emit('kickPlayer'"), "socket.emit('kickPlayer') in client.js vorhanden");
assert.ok(serverJs.includes("socket.on('kickPlayer'"), "socket.on('kickPlayer') Handler in server/index.js vorhanden");
console.log('✓ 1. Quellcode-Prüfung: HTML-Styles, client.js Handler & server/index.js Socket-Event verifiziert');

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

  let hostClient, guest1Client, guest2Client;

  try {
    hostClient = io(SERVER_URL, { forceNew: true });
    guest1Client = io(SERVER_URL, { forceNew: true });
    guest2Client = io(SERVER_URL, { forceNew: true });

    await Promise.all([
      new Promise(r => hostClient.on('connect', r)),
      new Promise(r => guest1Client.on('connect', r)),
      new Promise(r => guest2Client.on('connect', r))
    ]);

    const roomCode = 'KICKHUMAN';

    // Host tritt bei und gründet
    hostClient.emit('joinRoom', { playerName: 'Host Meister', roomCode, sessionId: 'sess_host_kicker', createIfNotExists: true });
    await wait(200);

    let hostRoomPlayers = [];
    hostClient.on('roomUpdated', (players) => {
      hostRoomPlayers = players;
    });

    // Gast 1 und Gast 2 treten bei
    guest1Client.emit('joinRoom', { playerName: 'Toxischer Gast', roomCode, sessionId: 'sess_guest_bad' });
    await wait(150);
    guest2Client.emit('joinRoom', { playerName: 'Treuer Gefährte', roomCode, sessionId: 'sess_guest_good' });
    await wait(250);

    assert.strictEqual(hostRoomPlayers.length, 3, 'Es müssen genau 3 menschliche Spieler im Raum sein');
    console.log('✓ 2. Host und zwei Mitspieler erfolgreich versammelt (3 Spieler im Warteraum)');

    // 3. Gast 1 registriert kickedFromRoom Listener
    let kickedReceived = null;
    guest1Client.on('kickedFromRoom', (data) => {
      kickedReceived = data;
    });

    // Host kickt Gast 1 (Toxischer Gast)
    hostClient.emit('kickPlayer', { roomCode, targetSessionId: 'sess_guest_bad' });
    await wait(250);

    assert.ok(kickedReceived, 'Gast 1 muss das kickedFromRoom Event empfangen haben');
    assert.strictEqual(kickedReceived.reason, 'Du wurdest vom Host aus der Kammer verwiesen.');
    assert.strictEqual(hostRoomPlayers.length, 2, 'Nach Kick müssen genau 2 Spieler verbleiben');
    assert.strictEqual(hostRoomPlayers.some(p => p.sessionId === 'sess_guest_bad'), false, 'Toxischer Gast wurde entfernt');
    assert.strictEqual(hostRoomPlayers.some(p => p.sessionId === 'sess_guest_good'), true, 'Treuer Gefährte ist weiterhin im Raum');

    console.log('✓ 3. Host kickt Gast 1 erfolgreich: kickedFromRoom empfangen & Spielerliste aktualisiert');

    // 4. Zero-Trust Sicherheitsprüfungen
    let guest2Error = null;
    guest2Client.on('actionError', (err) => {
      guest2Error = err;
    });

    // Gast 2 versucht Host zu kicken
    guest2Client.emit('kickPlayer', { roomCode, targetSessionId: 'sess_host_kicker' });
    await wait(200);
    assert.ok(guest2Error, 'Nicht-Host darf nicht kicken');
    assert.strictEqual(guest2Error.message, 'Nur der Host kann Mitspieler verwalten!');

    // Host versucht sich selbst zu kicken
    let hostError = null;
    hostClient.on('actionError', (err) => {
      hostError = err;
    });
    hostClient.emit('kickPlayer', { roomCode, targetSessionId: 'sess_host_kicker' });
    await wait(200);
    assert.ok(hostError, 'Selbstkick des Hosts muss abgewiesen werden');
    assert.strictEqual(hostError.message, 'Der Host kann sich nicht selbst verweisen!');

    // Ungültiger Spieler
    hostError = null;
    hostClient.emit('kickPlayer', { roomCode, targetSessionId: 'non_existent_player' });
    await wait(200);
    assert.ok(hostError, 'Nicht existierender Spieler muss abgewiesen werden');
    assert.strictEqual(hostError.message, 'Spieler nicht im Raum gefunden.');

    console.log('✓ 4. Zero-Trust Prüfungen bestanden: Nicht-Host, Selbstkick und ungültige IDs abgewehrt');

    // 5. 2vs2 Allianzen Bereinigung
    hostClient.emit('setMatchFormat', { roomCode, matchFormat: 'team_2v2' });
    await wait(150);

    // Gast 1 tritt erneut bei und wählt team_b
    guest1Client.emit('joinRoom', { playerName: 'Reuiger Gast', roomCode, sessionId: 'sess_guest_bad' });
    await wait(200);

    guest1Client.emit('switchTeam', { roomCode, team: 'team_b' });
    await wait(200);

    // Host kickt Gast 1 erneut
    hostClient.emit('kickPlayer', { roomCode, targetSessionId: 'sess_guest_bad' });
    await wait(250);

    assert.strictEqual(hostRoomPlayers.some(p => p.sessionId === 'sess_guest_bad'), false, 'Gast aus 2vs2 entfernt');
    console.log('✓ 5. 2vs2 Allianzen Bereinigung: Gekickter Mitspieler wird sauber aus Allianz entfernt');

    // 6. Kicking-Schutz während laufendem Spiel
    // Fülle Raum mit Bots auf und starte Spiel
    hostClient.emit('addBot', { roomCode });
    await wait(120);
    hostClient.emit('addBot', { roomCode });
    await wait(250);

    // Starte Spiel
    hostClient.emit('startGame', { roomCode });
    await wait(400);

    hostError = null;
    hostClient.emit('kickPlayer', { roomCode, targetSessionId: 'sess_guest_good' });
    await wait(200);
    assert.ok(hostError, 'Kicken während laufendem Spiel muss blockiert sein');
    assert.strictEqual(hostError.message, 'Mitspieler können nur im Warteraum verwiesen werden.');
    console.log('✓ 6. In-Game Schutz: Kicken im laufenden Spiel ist serverseitig strikt blockiert');

  } finally {
    if (hostClient) hostClient.disconnect();
    if (guest1Client) guest1Client.disconnect();
    if (guest2Client) guest2Client.disconnect();
    if (serverProc) serverProc.kill();
  }
}

runIntegration().then(() => {
  console.log('\n======================================================');
  console.log('🏆 SCHRITT 7 (MITSPIELER KICKEN) VOLLSTÄNDIG BESTANDEN!');
  console.log('======================================================\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ FEHLER IN SCHRITT 7 TEST:', err);
  if (serverProc) serverProc.kill();
  process.exit(1);
});
