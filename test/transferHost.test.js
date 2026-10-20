const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const TEST_PORT = 3997;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- TESTE HOST-ÜBERGABE & LORE-UMBENENNUNGEN ---');

// 1. Quellcode-Validierung & Marken-Check (kein "Skull King", kein "Wizard-Wertung" im UI)
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const clientJs = fs.readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');

assert.ok(indexHtml.includes('.btn-transfer-host'), '.btn-transfer-host CSS-Klasse in index.html definiert');
assert.ok(clientJs.includes('btn-transfer-host'), '.btn-transfer-host Button in client.js vorhanden');
assert.ok(clientJs.includes("socket.on('hostTransferred'"), "socket.on('hostTransferred') Handler in client.js vorhanden");
assert.ok(clientJs.includes("socket.emit('transferHost'"), "socket.emit('transferHost') in client.js vorhanden");
assert.ok(serverJs.includes("socket.on('transferHost'"), "socket.on('transferHost') Handler in server/index.js vorhanden");
console.log('✓ 1. Quellcode-Prüfung: HTML-Styles, client.js Handler & server/index.js Socket-Event verifiziert');

// Branding-Check: Weder "Skull King" noch "Wizard-Wertung" darf in den Optionen oder Badges vorkommen
assert.ok(!indexHtml.includes('Skull King'), 'index.html darf kein "Skull King" im Text enthalten');
assert.ok(!indexHtml.includes('Wizard-Wertung'), 'index.html darf kein "Wizard-Wertung" im Text enthalten');
assert.ok(indexHtml.includes('Schattenfluch-Nullwertung'), 'Schattenfluch-Nullwertung muss im Modal vorhanden sein');
assert.ok(indexHtml.includes('Simultan-Prophezeiung'), 'Simultan-Prophezeiung muss im Modal vorhanden sein');
assert.ok(indexHtml.includes('Klassische Wertung') || indexHtml.includes('Klassische Grimoire-Wertung'), 'Klassische Wertung muss im Modal/Badges vorhanden sein');
assert.ok(!clientJs.includes('Skull-King-Nullwertung'), 'client.js darf kein "Skull-King-Nullwertung" mehr anzeigen');
assert.ok(!clientJs.includes("'🎯 Wizard-Wertung'"), 'client.js darf kein "🎯 Wizard-Wertung" mehr anzeigen');
console.log('✓ 2. Marken-Check bestanden: Alle Bezeichnungen nutzen authentische Grimoire-Fantasy-Lore');

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let serverProc;

async function runTests() {
  serverProc = spawn('node', [path.join(__dirname, '../server/index.js')], {
    env: { ...process.env, PORT: TEST_PORT },
    stdio: 'pipe'
  });

  serverProc.stderr.on('data', (d) => {
    console.error('[Server stderr]:', d.toString().trim());
  });

  await wait(1200);

  let hostClient, guestClient;

  try {
    hostClient = io(SERVER_URL, { forceNew: true });
    await new Promise(r => hostClient.on('connect', r));

    const roomCode = 'HOSTTEST';
    hostClient.emit('joinRoom', { playerName: 'HostMorgath', roomCode, sessionId: 'sess_morgath', createIfNotExists: true });
    await wait(200);

    guestClient = io(SERVER_URL, { forceNew: true });
    await new Promise(r => guestClient.on('connect', r));
    guestClient.emit('joinRoom', { playerName: 'GastElrond', roomCode, sessionId: 'sess_elrond' });
    await wait(200);

    // 1. Nicht-Host Gast versucht Spielleitung an sich selbst oder Host zu übergeben -> muss abgewehrt werden
    const actionErrorPromise = new Promise((resolve) => {
      guestClient.once('actionError', (err) => resolve(err.message));
    });
    guestClient.emit('transferHost', { roomCode, targetSessionId: 'sess_elrond' });
    const errText = await Promise.race([actionErrorPromise, wait(1500).then(() => null)]);
    assert.ok(errText && errText.includes('Nur der aktuelle Host'), 'Gast darf Host-Rolle nicht übergeben');
    console.log('✓ 3. Zero-Trust Schutz: Nicht-Host wurde bei transferHost abgewehrt');

    // 2. Host fügt einen Bot hinzu und versucht Spielleitung an Bot zu übergeben -> muss abgewehrt werden
    let playersWithBot = [];
    const botRoomPromise = new Promise((resolve) => {
      hostClient.on('roomUpdated', (players) => {
        if (players.some(p => p.isBot)) {
          playersWithBot = players;
          resolve();
        }
      });
    });
    hostClient.emit('addBot', { roomCode });
    await Promise.race([botRoomPromise, wait(2000)]);

    const botPlayer = playersWithBot.find(p => p.isBot);
    assert.ok(botPlayer, 'Bot muss im Raum vorhanden sein');

    const botActionErrorPromise = new Promise((resolve) => {
      hostClient.once('actionError', (err) => resolve(err.message));
    });
    hostClient.emit('transferHost', { roomCode, targetSessionId: botPlayer.sessionId });
    const botErrText = await Promise.race([botActionErrorPromise, wait(1500).then(() => null)]);
    assert.ok(botErrText && botErrText.includes('nicht an eine KI'), 'Host kann Rolle nicht an KI übertragen');
    console.log('✓ 4. KI-Schutz: Host-Rolle kann nicht an Bots übertragen werden');

    // 3. Host übergibt erfolgreich an GastElrond
    let transferredData = null;
    let guestReceivedUpdate = null;

    guestClient.once('hostTransferred', (data) => {
      transferredData = data;
    });

    const roomUpdatePromise = new Promise((resolve) => {
      guestClient.on('roomUpdated', (players) => {
        const elrond = players.find(p => p.sessionId === 'sess_elrond');
        if (elrond && elrond.isHost) {
          guestReceivedUpdate = players;
          resolve();
        }
      });
    });

    hostClient.emit('transferHost', { roomCode, targetSessionId: 'sess_elrond' });
    await Promise.race([roomUpdatePromise, wait(2000)]);

    assert.ok(transferredData, 'hostTransferred Event muss empfangen worden sein');
    assert.strictEqual(transferredData.newHostSessionId, 'sess_elrond');
    assert.strictEqual(transferredData.newHostName, 'GastElrond');

    assert.ok(guestReceivedUpdate, 'roomUpdated muss neuen Host reflektieren');
    const elrondPlayer = guestReceivedUpdate.find(p => p.sessionId === 'sess_elrond');
    const morgathPlayer = guestReceivedUpdate.find(p => p.sessionId === 'sess_morgath');

    assert.strictEqual(elrondPlayer.isHost, true, 'Elrond muss nun Host sein');
    assert.strictEqual(morgathPlayer.isHost, false, 'Morgath darf kein Host mehr sein');
    console.log('✓ 5. Host-Rolle erfolgreich an GastElrond übergeben!');

    // 4. Ehemaliger Host Morgath versucht nun Einstellungen zu ändern -> muss abgewehrt werden
    const oldHostErrorPromise = new Promise((resolve) => {
      hostClient.once('actionError', (err) => resolve(err.message));
    });
    hostClient.emit('updateRoomSettings', {
      roomCode,
      edition: 'anniversary_30',
      matchFormat: 'ffa',
      scoringMode: 'skull_king_zero',
      biddingMode: 'simultaneous'
    });
    const oldHostErr = await Promise.race([oldHostErrorPromise, wait(1500).then(() => null)]);
    assert.ok(oldHostErr && oldHostErr.includes('Nur der Host'), 'Ehemaliger Host darf keine Einstellungen mehr ändern');
    console.log('✓ 6. Rechte-Entzug: Ehemaliger Host kann keine Einstellungen mehr verändern');

    // 5. Neuer Host Elrond ändert erfolgreich Einstellungen
    let settingsUpdated = null;
    const settingsPromise = new Promise((resolve) => {
      hostClient.once('roomSettingsUpdated', (data) => resolve(data));
    });
    guestClient.emit('updateRoomSettings', {
      roomCode,
      edition: 'anniversary_30',
      matchFormat: 'ffa',
      scoringMode: 'skull_king_zero',
      biddingMode: 'simultaneous'
    });
    settingsUpdated = await Promise.race([settingsPromise, wait(2000)]);
    assert.ok(settingsUpdated, 'Neuer Host kann Raum-Einstellungen erfolgreich steuern');
    assert.strictEqual(settingsUpdated.scoringMode, 'skull_king_zero');
    assert.strictEqual(settingsUpdated.biddingMode, 'simultaneous');
    console.log('✓ 7. Vollwertige Spielleitung: Neuer Host kann Einstellungen steuern & broadcasten');

    console.log('\n========================================================');
    console.log('🏆 ALLE HOST-ÜBERGABE & BRANDING TESTS BESTANDEN!');
    console.log('========================================================');
  } finally {
    if (hostClient) hostClient.disconnect();
    if (guestClient) guestClient.disconnect();
    serverProc.kill();
  }
}

runTests().catch((err) => {
  console.error('Test fehlgeschlagen:', err);
  if (serverProc) serverProc.kill();
  process.exit(1);
});
