const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const { calculateTeamPoints, createDeck, isValidMove } = require('../server/gameLogic');
const { chooseBotCard, createBotPlayer } = require('../server/botLogic');

console.log('--- STARTE 2vs2 ALLIANZEN (TEAM-MODUS) TESTS ---');

// ============================================================================
// 1. UNIT TESTS: calculateTeamPoints (Kooperative Allianz-Punkteauswertung)
// ============================================================================
console.log('1. Teste calculateTeamPoints Math-Formel...');

// Exakter Treffer: +20 Punkte Basis + 10 Punkte pro gemachtem Stich
assert.strictEqual(calculateTeamPoints(0, 0), 20, 'Team-Gebot 0, 0 Stiche => 20 Punkte');
assert.strictEqual(calculateTeamPoints(1, 1), 30, 'Team-Gebot 1, 1 Stich => 30 Punkte');
assert.strictEqual(calculateTeamPoints(3, 3), 50, 'Team-Gebot 3, 3 Stiche => 50 Punkte');
assert.strictEqual(calculateTeamPoints(6, 6), 80, 'Team-Gebot 6, 6 Stiche => 80 Punkte');

// Verfehlt: -10 Punkte pro Stich Abweichung (egal ob zu viel oder zu wenig)
assert.strictEqual(calculateTeamPoints(3, 2), -10, 'Team-Gebot 3, 2 Stiche (-1 Abweichung) => -10 Punkte');
assert.strictEqual(calculateTeamPoints(2, 4), -20, 'Team-Gebot 2, 4 Stiche (+2 Abweichung) => -20 Punkte');
assert.strictEqual(calculateTeamPoints(0, 3), -30, 'Team-Gebot 0, 3 Stiche (+3 Abweichung) => -30 Punkte');
assert.strictEqual(calculateTeamPoints(5, 0), -50, 'Team-Gebot 5, 0 Stiche (-5 Abweichung) => -50 Punkte');

// Null / Undefined Robustheit
assert.strictEqual(calculateTeamPoints(null, null), 20, 'null / null sollte wie 0 / 0 ausgewertet werden');
assert.strictEqual(calculateTeamPoints(undefined, 2), -20, 'undefined / 2 sollte wie 0 / 2 ausgewertet werden');

console.log('✓ calculateTeamPoints erfolgreich verifiziert!');

// ============================================================================
// 2. UNIT TESTS: Team-Zuweisung, Balancierung & Alternierende Sitzordnung
// ============================================================================
console.log('2. Teste Team-Zuweisung & Sitzordnung [A1, B1, A2, B2]...');

function simulateStart2v2(players) {
  const connectedPlayers = players.filter(p => p.connected);
  if (connectedPlayers.length !== 4) {
    return { error: 'Für 2vs2 Allianzen werden genau 4 aktive Magier benötigt!' };
  }

  let teamA = connectedPlayers.filter(p => p.team === 'team_a');
  let teamB = connectedPlayers.filter(p => p.team === 'team_b');
  const unassigned = connectedPlayers.filter(p => p.team !== 'team_a' && p.team !== 'team_b');

  while (teamA.length > 2) {
    const excess = teamA.pop();
    excess.team = null;
    unassigned.push(excess);
  }
  while (teamB.length > 2) {
    const excess = teamB.pop();
    excess.team = null;
    unassigned.push(excess);
  }

  for (const p of unassigned) {
    if (teamA.length < 2) {
      p.team = 'team_a';
      teamA.push(p);
    } else if (teamB.length < 2) {
      p.team = 'team_b';
      teamB.push(p);
    }
  }

  if (teamA.length !== 2 || teamB.length !== 2) {
    return { error: 'Beide Allianzen müssen aus genau 2 Magiern bestehen!' };
  }

  const orderedPlayers = [teamA[0], teamB[0], teamA[1], teamB[1]];
  return { success: true, players: orderedPlayers };
}

// Fall A: 4 Spieler mit je 2 in Team A und 2 in Team B
const scenarioA = [
  { sessionId: 's1', name: 'A1', team: 'team_a', connected: true },
  { sessionId: 's2', name: 'A2', team: 'team_a', connected: true },
  { sessionId: 's3', name: 'B1', team: 'team_b', connected: true },
  { sessionId: 's4', name: 'B2', team: 'team_b', connected: true }
];
const resA = simulateStart2v2(scenarioA);
assert.strictEqual(resA.success, true);
assert.strictEqual(resA.players[0].team, 'team_a');
assert.strictEqual(resA.players[1].team, 'team_b');
assert.strictEqual(resA.players[2].team, 'team_a');
assert.strictEqual(resA.players[3].team, 'team_b');
// Gegenübersitzung: Index 0 und 2 sind Team A; Index 1 und 3 sind Team B
assert.strictEqual(resA.players[0].team, resA.players[2].team, 'Partner 1 und Partner 2 von Team A sitzen gegenüber');
assert.strictEqual(resA.players[1].team, resA.players[3].team, 'Partner 1 und Partner 2 von Team B sitzen gegenüber');

// Fall B: 4 unzugewiesene Spieler werden automatisch 2/2 aufgeteilt
const scenarioB = [
  { sessionId: 'p1', name: 'P1', team: null, connected: true },
  { sessionId: 'p2', name: 'P2', team: null, connected: true },
  { sessionId: 'p3', name: 'P3', team: null, connected: true },
  { sessionId: 'p4', name: 'P4', team: null, connected: true }
];
const resB = simulateStart2v2(scenarioB);
assert.strictEqual(resB.success, true);
assert.strictEqual(resB.players[0].team, 'team_a');
assert.strictEqual(resB.players[1].team, 'team_b');
assert.strictEqual(resB.players[2].team, 'team_a');
assert.strictEqual(resB.players[3].team, 'team_b');

// Fall C: 3 in Team A, 1 in Team B -> automatisches Ausbalancieren
const scenarioC = [
  { sessionId: 'p1', name: 'P1', team: 'team_a', connected: true },
  { sessionId: 'p2', name: 'P2', team: 'team_a', connected: true },
  { sessionId: 'p3', name: 'P3', team: 'team_a', connected: true },
  { sessionId: 'p4', name: 'P4', team: 'team_b', connected: true }
];
const resC = simulateStart2v2(scenarioC);
assert.strictEqual(resC.success, true);
const finalCountA = resC.players.filter(p => p.team === 'team_a').length;
const finalCountB = resC.players.filter(p => p.team === 'team_b').length;
assert.strictEqual(finalCountA, 2, 'Team A hat nach Balancierung genau 2 Spieler');
assert.strictEqual(finalCountB, 2, 'Team B hat nach Balancierung genau 2 Spieler');

// Fall D: Ungültige Spielerzahl (3 oder 5)
assert(simulateStart2v2(scenarioA.slice(0, 3)).error !== undefined, '3 Spieler müssen geblockt werden');
const scenario5 = [...scenarioA, { sessionId: 's5', name: 'P5', team: null, connected: true }];
assert(simulateStart2v2(scenario5).error !== undefined, '5 Spieler müssen geblockt werden');

console.log('✓ Team-Zuweisung, Balancierung und alternierende Sitzordnung [A1, B1, A2, B2] erfolgreich verifiziert!');

// ============================================================================
// 3. UNIT TESTS: Kooperative Runden-Auswertung & Punkte-Pool
// ============================================================================
console.log('3. Teste kooperative Runden-Auswertung & Punkte-Pool...');

function evaluate2v2Round(players, currentTeams) {
  const teamAPlayers = players.filter(p => p.team === 'team_a');
  const teamBPlayers = players.filter(p => p.team === 'team_b');

  const teamABid = teamAPlayers.reduce((sum, p) => sum + (p.bid !== null ? p.bid : 0), 0);
  const teamATricks = teamAPlayers.reduce((sum, p) => sum + (p.tricksWon || 0), 0);
  const teamAPoints = calculateTeamPoints(teamABid, teamATricks);

  const teamBBid = teamBPlayers.reduce((sum, p) => sum + (p.bid !== null ? p.bid : 0), 0);
  const teamBTricks = teamBPlayers.reduce((sum, p) => sum + (p.tricksWon || 0), 0);
  const teamBPoints = calculateTeamPoints(teamBBid, teamBTricks);

  currentTeams.team_a.score += teamAPoints;
  currentTeams.team_b.score += teamBPoints;

  players.forEach(p => {
    p.totalScore = (p.team === 'team_a') ? currentTeams.team_a.score : currentTeams.team_b.score;
  });

  return { teamAPoints, teamBPoints, currentTeams };
}

const teamsState = {
  team_a: { name: 'Allianz des Sonnenfeuers', score: 0 },
  team_b: { name: 'Allianz der Mondschatten', score: 0 }
};

const round1Players = [
  { sessionId: 'a1', team: 'team_a', bid: 1, tricksWon: 0, totalScore: 0 },
  { sessionId: 'a2', team: 'team_a', bid: 1, tricksWon: 2, totalScore: 0 }, // Team A: Bid=2, Won=2 (+40)
  { sessionId: 'b1', team: 'team_b', bid: 0, tricksWon: 0, totalScore: 0 },
  { sessionId: 'b2', team: 'team_b', bid: 1, tricksWon: 0, totalScore: 0 }  // Team B: Bid=1, Won=0 (-10)
];

const round1Result = evaluate2v2Round(round1Players, teamsState);
assert.strictEqual(round1Result.teamAPoints, 40, 'Team A: 2 Gebote, 2 Stiche => +40 Punkte');
assert.strictEqual(round1Result.teamBPoints, -10, 'Team B: 1 Gebot, 0 Stiche => -10 Punkte');
assert.strictEqual(round1Players[0].totalScore, 40);
assert.strictEqual(round1Players[1].totalScore, 40);
assert.strictEqual(round1Players[2].totalScore, -10);
assert.strictEqual(round1Players[3].totalScore, -10);

console.log('✓ Kooperative Runden-Auswertung & Punkte-Pool erfolgreich verifiziert!');

// ============================================================================
// 4. UNIT TESTS: Bot-Partner-Awareness (Kein Überstechen des Gefährten)
// ============================================================================
console.log('4. Teste Bot-Partner-Awareness in chooseBotCard...');

const botHand = [
  { type: 'wizard', suit: 'none', value: 14 },
  { type: 'color', suit: 'red', value: 12 },
  { type: 'color', suit: 'blue', value: 3 },
  { type: 'jester', suit: 'none', value: 0 }
];

// Fall 1: Partner führt mit einem Zauberer (unangreifbar sicher)
const trickWithPartnerWizard = [
  { playerId: 'opponent_1', card: { type: 'color', suit: 'red', value: 10 } },
  { playerId: 'teammate_1', card: { type: 'wizard', suit: 'none', value: 14 } },
  { playerId: 'opponent_2', card: { type: 'color', suit: 'red', value: 6 } }
];

const trumpCard = { type: 'color', suit: 'green', value: 5 };

const botDecisionPartnerWinning = chooseBotCard(
  botHand,
  trickWithPartnerWizard,
  trumpCard,
  1, // botBid
  0, // tricksWon
  4, // round
  'master',
  {
    botSessionId: 'bot_partner',
    team: 'team_a',
    teammateSessionId: 'teammate_1'
  }
);

// Der Bot darf NICHT seinen Zauberer verschwenden, sondern sollte eine nicht-gewinnende Karte abwerfen
const chosenCard1 = botHand[botDecisionPartnerWinning.cardIndex];
assert.notStrictEqual(chosenCard1.type, 'wizard', 'Bot darf nicht seinen Zauberer über den Zauberer des Partners legen!');
console.log(`✓ Bot Partner-Awareness: Partner hält Zauberer -> Bot spielt ${chosenCard1.type === 'color' ? chosenCard1.suit + ' ' + chosenCard1.value : chosenCard1.type} statt eigenem Zauberer`);

// Fall 2: Gegner führt den Stich an
const trickWithOpponentWinning = [
  { playerId: 'teammate_1', card: { type: 'color', suit: 'red', value: 7 } },
  { playerId: 'opponent_1', card: { type: 'color', suit: 'red', value: 13 } }
];

const botDecisionOpponentWinning = chooseBotCard(
  botHand,
  trickWithOpponentWinning,
  trumpCard,
  1, // bot will Stich machen
  0,
  4,
  'master',
  {
    botSessionId: 'bot_partner',
    team: 'team_a',
    teammateSessionId: 'teammate_1'
  }
);

const chosenCard2 = botHand[botDecisionOpponentWinning.cardIndex];
console.log(`✓ Bot Taktik gegen Gegner: Bot wählt ${chosenCard2.type === 'color' ? chosenCard2.suit + ' ' + chosenCard2.value : chosenCard2.type}`);

// ============================================================================
// 5. INTEGRATION TEST: Socket Server 2vs2 Workflow & Alternating Seats
// ============================================================================
console.log('5. Teste Socket Server 2vs2 Workflow...');

const TEST_PORT = 3955;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runSocketIntegrationTests() {
  const serverProc = spawn('node', [path.join(__dirname, '../server/index.js')], {
    env: { ...process.env, PORT: TEST_PORT },
    stdio: 'pipe'
  });

  serverProc.stderr.on('data', d => console.error('[Server Err]:', d.toString().trim()));

  await wait(1200);

  let hostClient = null;
  let player2Client = null;

  try {
    hostClient = io(SERVER_URL, { forceNew: true });
    player2Client = io(SERVER_URL, { forceNew: true });

    await Promise.all([
      new Promise(r => hostClient.on('connect', r)),
      new Promise(r => player2Client.on('connect', r))
    ]);

    const roomCode = 'TEAM2V2';
    hostClient.emit('joinRoom', { playerName: 'HostMagier', roomCode, sessionId: 'sess_host', createIfNotExists: true });
    await wait(200);

    player2Client.emit('joinRoom', { playerName: 'GefährteMagier', roomCode, sessionId: 'sess_p2', createIfNotExists: false });
    await wait(200);

    // Host schaltet Format auf 2vs2
    let formatChangedReceived = null;
    hostClient.on('matchFormatChanged', (data) => {
      formatChangedReceived = data;
    });

    hostClient.emit('setMatchFormat', { roomCode, matchFormat: 'team_2v2' });
    await wait(200);

    assert(formatChangedReceived !== null, 'matchFormatChanged muss gesendet werden');
    assert.strictEqual(formatChangedReceived.matchFormat, 'team_2v2');
    console.log('✓ Host hat Spielformat erfolgreich auf team_2v2 geschaltet');

    // Spieler 2 wechselt Allianz zu team_a
    let updatedPlayers = [];
    hostClient.on('roomUpdated', (players) => {
      updatedPlayers = players;
    });

    player2Client.emit('switchTeam', { roomCode, team: 'team_a' });
    await wait(200);

    let p2InRoom = updatedPlayers.find(p => p.sessionId === 'sess_p2');
    assert(p2InRoom && p2InRoom.team === 'team_a', 'Spieler 2 muss nun in team_a sein');
    console.log('✓ Spieler 2 wechselte Allianz zu team_a');

    // Spieler 2 wechselt Allianz zurück zu team_b
    player2Client.emit('switchTeam', { roomCode, team: 'team_b' });
    await wait(200);

    p2InRoom = updatedPlayers.find(p => p.sessionId === 'sess_p2');
    assert(p2InRoom && p2InRoom.team === 'team_b', 'Spieler 2 muss nun in team_b sein');
    console.log('✓ Spieler 2 wechselte Allianz zurück zu team_b');

    // 2 Bots hinzufügen, damit genau 4 Spieler im Raum sind
    hostClient.emit('addBot', { roomCode });
    await wait(150);
    hostClient.emit('addBot', { roomCode });
    await wait(200);

    assert.strictEqual(updatedPlayers.length, 4, 'Es müssen genau 4 Spieler im Raum sein');
    console.log('✓ 4 Spieler im Raum versammelt: ' + updatedPlayers.map(p => `${p.name} (${p.team})`).join(', '));

    // Spiel starten und alternierende Sitzordnung prüfen
    let gameStartedData = null;
    hostClient.on('gameStarted', (data) => {
      gameStartedData = data;
    });

    hostClient.emit('startGame', { roomCode });
    await wait(400);

    assert(gameStartedData !== null, 'gameStarted muss ausgelöst werden');
    assert.strictEqual(gameStartedData.matchFormat, 'team_2v2');

    // Überprüfe Sitzordnung: Gegenübersitzung
    assert.strictEqual(updatedPlayers.length, 4);
    assert.strictEqual(updatedPlayers[0].team, 'team_a', 'Sitz 1 muss Team A sein');
    assert.strictEqual(updatedPlayers[1].team, 'team_b', 'Sitz 2 muss Team B sein');
    assert.strictEqual(updatedPlayers[2].team, 'team_a', 'Sitz 3 muss Team A sein (gegenüber Sitz 1)');
    assert.strictEqual(updatedPlayers[3].team, 'team_b', 'Sitz 4 muss Team B sein (gegenüber Sitz 2)');
    console.log('✓ Alternierende Sitzordnung [A1, B1, A2, B2] auf dem Live-Server erfolgreich verifiziert!');

  } finally {
    if (hostClient) hostClient.disconnect();
    if (player2Client) player2Client.disconnect();
    serverProc.kill();
    await wait(300);
  }

  console.log('\n======================================================');
  console.log('🏆 ALLE 2vs2 ALLIANZEN (TEAM-MODUS) TESTS BESTANDEN!');
  console.log('======================================================');
}

runSocketIntegrationTests().catch(err => {
  console.error('Test-Fehler:', err);
  process.exit(1);
});
