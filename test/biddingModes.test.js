const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const assert = require('assert');
const path = require('path');

const TEST_PORT = 3996;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

console.log('--- STARTE WIZARD ALTERNATIVE BIETMODI TEST (SIMULTAN & GEHEIM) ---');

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

  let c1, c2, c3;

  try {
    // ==========================================
    // TEST SECTION 1: Zero-Trust & Settings Mode
    // ==========================================
    console.log('\n--- 1. Test: Zero-Trust & Settings Prüfung ---');
    c1 = io(SERVER_URL, { forceNew: true });
    await new Promise(r => c1.on('connect', r));

    const roomCode = 'BIETRAUM';
    c1.emit('joinRoom', { playerName: 'HostAlice', roomCode, sessionId: 'sess_h_alice', createIfNotExists: true });
    await wait(200);

    c2 = io(SERVER_URL, { forceNew: true });
    await new Promise(r => c2.on('connect', r));
    c2.emit('joinRoom', { playerName: 'GuestBob', roomCode, sessionId: 'sess_g_bob' });
    await wait(200);

    // Gast versucht setBiddingMode -> muss abgewehrt werden
    const actionErrorPromise = new Promise((resolve) => {
      c2.once('actionError', (err) => resolve(err.message));
    });
    c2.emit('setBiddingMode', { roomCode, biddingMode: 'simultaneous' });
    const errText = await Promise.race([actionErrorPromise, wait(1500).then(() => null)]);
    assert.ok(errText && errText.includes('Nur der Host'), 'Gast darf Bietmodus nicht verändern!');
    console.log('✓ Zero-Trust: Gast wurde bei setBiddingMode abgewehrt');

    // Host ändert Bietmodus auf simultaneous
    let settingsUpdated = null;
    const settingsPromise = new Promise((resolve) => {
      c2.once('roomSettingsUpdated', (data) => resolve(data));
    });
    c1.emit('setBiddingMode', { roomCode, biddingMode: 'simultaneous' });
    settingsUpdated = await Promise.race([settingsPromise, wait(2000)]);
    assert.ok(settingsUpdated, 'roomSettingsUpdated muss gesendet werden');
    assert.strictEqual(settingsUpdated.biddingMode, 'simultaneous', 'Bietmodus muss simultaneous sein');
    console.log('✓ Host hat Bietmodus erfolgreich auf "simultaneous" gesetzt');

    // ==========================================
    // TEST SECTION 2: Simultan-Bieten (Skull King)
    // ==========================================
    console.log('\n--- 2. Test: Simultan-Bieten (Skull King Modus) ---');

    c3 = io(SERVER_URL, { forceNew: true });
    await new Promise(r => c3.on('connect', r));
    c3.emit('joinRoom', { playerName: 'GuestCharlie', roomCode, sessionId: 'sess_g_charlie' });
    await wait(300);

    let revealedData = null;
    let biddingFinishedCalled = false;
    c1.once('simultaneousBidsRevealed', (data) => {
      revealedData = data;
    });
    c1.once('biddingFinished', () => {
      biddingFinishedCalled = true;
    });

    let lastTurnData = null;
    c1.on('turnChanged', (td) => {
      lastTurnData = td;
    });

    // Host startet das Spiel
    c1.emit('startGame', { roomCode });
    await wait(500);

    if (lastTurnData && lastTurnData.gameState === 'choose_trump') {
      c1.emit('selectTrumpSuit', { roomCode, suit: 'red' });
      await wait(300);
    }

    assert.ok(lastTurnData, 'turnChanged muss empfangen worden sein');
    assert.strictEqual(lastTurnData.gameState, 'bidding');
    assert.strictEqual(lastTurnData.activePlayerSessionId, 'all', 'In simultaneous mode, active player ist "all"');
    assert.strictEqual(lastTurnData.forbiddenBid, null, 'Keine Geber-Regel im Simultan-Bieten');
    console.log('✓ Simultan-Bieten aktiv: turnChanged meldet activePlayerSessionId="all" und forbiddenBid=null');

    // 1. Charlie gibt als Erster ab (obwohl er nicht Dealer oder erster Reihum-Spieler ist)
    let bobSawCharlieBid = null;
    const bobRoomUpdatePromise = new Promise((resolve) => {
      c2.on('roomUpdated', (players) => {
        const charlie = players.find(p => p.name === 'GuestCharlie');
        if (charlie && charlie.bid !== null && charlie.bid !== undefined) {
          bobSawCharlieBid = charlie.bid;
          resolve();
        }
      });
    });

    c3.emit('submitBid', { roomCode, bid: 1 });
    await Promise.race([bobRoomUpdatePromise, wait(2000)]);
    assert.strictEqual(bobSawCharlieBid, '✓', 'Bob muss Charlies Gebot als "✓" maskiert sehen (Zero-Trust)');
    console.log('✓ Zero-Trust Maskierung: Bob sieht Charlies Tipp verdeckt als "✓"');

    // 2. Bob gibt ab (Gebot 0)
    c2.emit('submitBid', { roomCode, bid: 0 });
    await wait(300);

    // 3. Alice gibt ab (Gebot 0) - Gesamtsumme wäre 1+0+0 = 1 = round (wäre klassisch verboten, hier erlaubt!)
    c1.emit('submitBid', { roomCode, bid: 0 });
    await wait(500);

    assert.ok(revealedData, 'simultaneousBidsRevealed muss nach allen Geboten gefeuert werden');
    assert.strictEqual(biddingFinishedCalled, true, 'biddingFinished muss aufgerufen werden');

    const aliceRevealed = revealedData.players.find(p => p.name === 'HostAlice');
    const bobRevealed = revealedData.players.find(p => p.name === 'GuestBob');
    const charlieRevealed = revealedData.players.find(p => p.name === 'GuestCharlie');

    assert.strictEqual(aliceRevealed.bid, 0, 'Alice Gebot muss aufgedeckt 0 sein');
    assert.strictEqual(bobRevealed.bid, 0, 'Bob Gebot muss aufgedeckt 0 sein');
    assert.strictEqual(charlieRevealed.bid, 1, 'Charlie Gebot muss aufgedeckt 1 sein');
    console.log('✓ Alle Tipps wurden synchron demaskiert und offenbart: Alice=0, Bob=0, Charlie=1');

    // ==========================================
    // TEST SECTION 3: Geheimes Bieten (Secret)
    // ==========================================
    console.log('\n--- 3. Test: Geheimes Bieten (Secret Mode) ---');
    const sRoomCode = 'SECRETROOM';

    const sHost = io(SERVER_URL, { forceNew: true });
    const sGuest1 = io(SERVER_URL, { forceNew: true });
    const sGuest2 = io(SERVER_URL, { forceNew: true });

    sHost.emit('joinRoom', { playerName: 'Morgath', roomCode: sRoomCode, sessionId: 's_morgath', createIfNotExists: true });
    await wait(150);
    sGuest1.emit('joinRoom', { playerName: 'Elrond', roomCode: sRoomCode, sessionId: 's_elrond' });
    await wait(150);
    sGuest2.emit('joinRoom', { playerName: 'Gandalf', roomCode: sRoomCode, sessionId: 's_gandalf' });
    await wait(200);

    // Host wählt geheimes Bieten via updateRoomSettings
    sHost.emit('updateRoomSettings', {
      roomCode: sRoomCode,
      edition: 'classic',
      matchFormat: 'ffa',
      scoringMode: 'classic',
      biddingMode: 'secret'
    });
    await wait(300);

    let sTurnData = null;
    let hostObservedPlayers = null;
    sHost.on('turnChanged', td => { sTurnData = td; });
    sHost.on('roomUpdated', players => { hostObservedPlayers = players; });

    sHost.emit('startGame', { roomCode: sRoomCode });
    await wait(400);

    if (sTurnData && sTurnData.gameState === 'choose_trump') {
      sHost.emit('selectTrumpSuit', { roomCode: sRoomCode, suit: 'red' });
      await wait(300);
    }

    // Reihum bieten lassen: alle 3 Spieler tippen nacheinander
    // Finde heraus, wer dran ist und lass ihn tippen
    for (let step = 0; step < 3; step++) {
      assert.ok(sTurnData, 'Turn Data muss vorhanden sein');
      assert.strictEqual(sTurnData.gameState, 'bidding');
      const activeSession = sTurnData.activePlayerSessionId;
      const targetClient = (activeSession === 's_morgath') ? sHost : (activeSession === 's_elrond' ? sGuest1 : sGuest2);
      targetClient.emit('submitBid', { roomCode: sRoomCode, bid: 0 });
      await wait(300);
    }

    assert.strictEqual(sTurnData.gameState, 'playing_tricks', 'Spiel muss in playing_tricks wechseln');

    // Prüfe Zero-Trust Sicht während playing_tricks:
    // sHost muss seinen eigenen Tipp als Zahl sehen, aber Elrond & Gandalf als '?'
    assert.ok(hostObservedPlayers, 'Host muss roomUpdated empfangen haben');
    const morgath = hostObservedPlayers.find(p => p.name === 'Morgath');
    const elrond = hostObservedPlayers.find(p => p.name === 'Elrond');
    const gandalf = hostObservedPlayers.find(p => p.name === 'Gandalf');

    assert.strictEqual(morgath.bid, 0, 'Host sieht seinen eigenen Tipp unmaskiert als 0');
    assert.strictEqual(elrond.bid, '?', 'Host sieht Elronds Tipp während des Stichspiels als "?"');
    assert.strictEqual(gandalf.bid, '?', 'Host sieht Gandalfs Tipp während des Stichspiels als "?"');
    console.log('✓ Zero-Trust im geheimen Stichspiel: Eigener Tipp sichtbar, Gegnertipps als "?" verborgen');

    sHost.disconnect();
    sGuest1.disconnect();
    sGuest2.disconnect();

    console.log('\n========================================================');
    console.log('🏆 ALLE ALTERNATIVEN BIETMODI TESTS ERFOLGREICH BESTANDEN!');
    console.log('========================================================');
  } finally {
    if (c1) c1.disconnect();
    if (c2) c2.disconnect();
    if (c3) c3.disconnect();
    serverProc.kill();
  }
}

runTests().catch((err) => {
  console.error('Test fehlgeschlagen:', err);
  serverProc.kill();
  process.exit(1);
});
