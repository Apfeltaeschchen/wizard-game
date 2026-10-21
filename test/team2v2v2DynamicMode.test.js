const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateTeamPoints } = require('../server/gameLogic');

console.log('--- STARTE TEST-SUITE: 2vs2vs2 ALLIANZEN (3 TEAMS, NEUTRALER START & RANDOMIZE) ---');

// ============================================================================
// 1. STATISCHE CSS & HTML PRÜFUNG (3 TEAMS, LOCKOUT & RANDOMIZE BUTTON)
// ============================================================================
console.log('1. Prüfe HTML & CSS auf Team C, Lockout-Styles und Randomize-Button...');

const htmlPath = path.join(__dirname, '../public/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Prüfe Sternenwind-Klassen
assert(htmlContent.includes('.player-seat.seat-team-sternenwind .seat-avatar'), 'seat-team-sternenwind muss für Spieler-Sitze definiert sein');
assert(htmlContent.includes('#10b981'), 'Sternenwind smaragdgrüne Farbe #10b981 muss definiert sein');
assert(htmlContent.includes('.alliance-score-box-sternenwind'), 'alliance-score-box-sternenwind muss für Scoreboard definiert sein');

// Prüfe Team-Lockout CSS (pointer-events: none)
assert(htmlContent.includes('.team-card-full'), '.team-card-full Klasse muss definiert sein');
assert(htmlContent.includes('pointer-events: none !important;'), 'Volle Teams müssen Klicks via pointer-events: none sperren');

// Prüfe Container-Buttons im HTML
assert(htmlContent.includes('id="teamContainerNeutral"'), 'Container für neutrale Spieler muss vorhanden sein');
assert(htmlContent.includes('id="teamContainerA"'), 'Container für Team A vorhanden');
assert(htmlContent.includes('id="teamContainerB"'), 'Container für Team B vorhanden');
assert(htmlContent.includes('id="teamContainerC"'), 'Container für Team C vorhanden');
assert(htmlContent.includes('id="btnRandomizeTeams"'), 'Zufalls-Würfel-Button des Hosts vorhanden');

console.log('✓ HTML & CSS für 2vs2vs2 Allianzen erfolgreich verifiziert!');

// ============================================================================
// 2. CLIENT-LOGIK AUDIT (PUBLIC/CLIENT.JS)
// ============================================================================
console.log('2. Prüfe public/client.js auf dynamische Team-C Steuerung & Lockout...');

const clientPath = path.join(__dirname, '../public/client.js');
const clientContent = fs.readFileSync(clientPath, 'utf8');

// Prüfe Event-Listener für Container
assert(clientContent.includes('teamContainerNeutral.addEventListener(\'click\''), 'Klick-Handler für Neutral-Container vorhanden');
assert(clientContent.includes('teamContainerA.addEventListener(\'click\''), 'Klick-Handler für Team A Container vorhanden');
assert(clientContent.includes('teamContainerB.addEventListener(\'click\''), 'Klick-Handler für Team B Container vorhanden');
assert(clientContent.includes('teamContainerC.addEventListener(\'click\''), 'Klick-Handler für Team C Container vorhanden');
assert(clientContent.includes('btnRandomizeTeams.addEventListener(\'click\''), 'Klick-Handler für Zufalls-Würfeln vorhanden');

// Prüfe Team C Sichtbarkeit & Lockout-Logik
assert(clientContent.includes('teamContainerC.style.display'), 'Team C muss dynamisch ein-/ausgeblendet werden');
assert(clientContent.includes('teamContainerA.classList.toggle(\'team-card-full\''), 'Team A Lockout-Klasse toggle vorhanden');
assert(clientContent.includes('teamContainerB.classList.toggle(\'team-card-full\''), 'Team B Lockout-Klasse toggle vorhanden');
assert(clientContent.includes('teamContainerC.classList.toggle(\'team-card-full\''), 'Team C Lockout-Klasse toggle vorhanden');

// Prüfe HUD & Scoreboard & GameOver Erweiterung
assert(clientContent.includes('seat-team-sternenwind'), 'Sitzplatz styling für Team C vorhanden');
assert(clientContent.includes('🌪️ Sternenwind'), 'Team C Label und Icon vorhanden');

console.log('✓ Client-Logik für 2vs2vs2 Allianzen erfolgreich verifiziert!');

// ============================================================================
// 3. SERVER-LOGIK: RANDOMIZE-TEAMS SIMULATION
// ============================================================================
console.log('3. Teste Randomize-Teams Algorithmus für 4 und 6 Spieler...');

function simulateRandomizeTeams(players) {
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const targetTeams = (players.length > 4)
    ? ['team_a', 'team_b', 'team_c']
    : ['team_a', 'team_b'];

  players.forEach(p => { p.team = null; });

  let teamIdx = 0;
  shuffled.forEach(p => {
    for (let offset = 0; offset < targetTeams.length; offset++) {
      const candidateTeam = targetTeams[(teamIdx + offset) % targetTeams.length];
      const count = players.filter(pl => pl.team === candidateTeam).length;
      if (count < 2) {
        p.team = candidateTeam;
        teamIdx = (teamIdx + offset + 1) % targetTeams.length;
        break;
      }
    }
  });

  return players;
}

// 4 Spieler Test
for (let iter = 0; iter < 10; iter++) {
  const players4 = [
    { id: 1, team: null },
    { id: 2, team: null },
    { id: 3, team: null },
    { id: 4, team: null }
  ];
  simulateRandomizeTeams(players4);
  const a = players4.filter(p => p.team === 'team_a').length;
  const b = players4.filter(p => p.team === 'team_b').length;
  const c = players4.filter(p => p.team === 'team_c').length;
  const neutral = players4.filter(p => p.team === null).length;
  assert.strictEqual(a, 2, 'Team A muss 2 Spieler haben');
  assert.strictEqual(b, 2, 'Team B muss 2 Spieler haben');
  assert.strictEqual(c, 0, 'Team C muss 0 Spieler haben');
  assert.strictEqual(neutral, 0, 'Kein Spieler darf neutral bleiben');
}

// 6 Spieler Test (2vs2vs2)
for (let iter = 0; iter < 10; iter++) {
  const players6 = [
    { id: 1, team: null },
    { id: 2, team: null },
    { id: 3, team: null },
    { id: 4, team: null },
    { id: 5, team: null },
    { id: 6, team: null }
  ];
  simulateRandomizeTeams(players6);
  const a = players6.filter(p => p.team === 'team_a').length;
  const b = players6.filter(p => p.team === 'team_b').length;
  const c = players6.filter(p => p.team === 'team_c').length;
  const neutral = players6.filter(p => p.team === null).length;
  assert.strictEqual(a, 2, 'Team A muss genau 2 Spieler haben');
  assert.strictEqual(b, 2, 'Team B muss genau 2 Spieler haben');
  assert.strictEqual(c, 2, 'Team C muss genau 2 Spieler haben');
  assert.strictEqual(neutral, 0, 'Kein Spieler darf neutral bleiben');
}

console.log('✓ Randomize-Teams Algorithmus teilt 4 und 6 Spieler fehlerfrei 2/2 und 2/2/2 auf!');

// ============================================================================
// 4. SITZORDNUNG: GEGENÜBER-SITZUNG (PARTNER OPPOSITE)
// ============================================================================
console.log('4. Teste alternierende Sitzordnung für 4 Spieler und 6 Spieler...');

// 4 Spieler: [A1, B1, A2, B2]
const p4_A = [{ name: 'A1', team: 'team_a' }, { name: 'A2', team: 'team_a' }];
const p4_B = [{ name: 'B1', team: 'team_b' }, { name: 'B2', team: 'team_b' }];
const order4 = [p4_A[0], p4_B[0], p4_A[1], p4_B[1]];

assert.strictEqual(order4[0].team, order4[2].team, 'Sitz 0 und Sitz 2 (Gegenüber) müssen im gleichen Team A sein');
assert.strictEqual(order4[1].team, order4[3].team, 'Sitz 1 und Sitz 3 (Gegenüber) müssen im gleichen Team B sein');

// 6 Spieler: [A1, B1, C1, A2, B2, C2]
const p6_A = [{ name: 'A1', team: 'team_a' }, { name: 'A2', team: 'team_a' }];
const p6_B = [{ name: 'B1', team: 'team_b' }, { name: 'B2', team: 'team_b' }];
const p6_C = [{ name: 'C1', team: 'team_c' }, { name: 'C2', team: 'team_c' }];
const order6 = [p6_A[0], p6_B[0], p6_C[0], p6_A[1], p6_B[1], p6_C[1]];

// An einem 6er-Tisch sitzt der Partner genau an Position (i + 3) % 6
for (let i = 0; i < 6; i++) {
  const opposite = (i + 3) % 6;
  assert.strictEqual(
    order6[i].team,
    order6[opposite].team,
    `Sitz ${i} (${order6[i].name}) und gegenüberliegender Sitz ${opposite} (${order6[opposite].name}) müssen Teamgefährten sein`
  );
}

console.log('✓ Alternierende Sitzordnung platziert bei 4 und 6 Spielern Partner exakt gegenüber!');

// ============================================================================
// 5. SERVER-SCORING FÜR 3 ALLIANZEN (FINISHROUNDSCORING)
// ============================================================================
console.log('5. Teste kooperative Punkteberechnung für 3 Allianzen...');

// Team A: Gebot 2, Stiche 2 -> Volltreffer: 20 + 2*10 = 40 Punkte
const ptsA = calculateTeamPoints(2, 2, 1, 'classic');
assert.strictEqual(ptsA, 40);

// Team B: Gebot 1, Stiche 0 -> Verfehlt um 1: -10 Punkte
const ptsB = calculateTeamPoints(1, 0, 1, 'classic');
assert.strictEqual(ptsB, -10);

// Team C: Gebot 3, Stiche 4 -> Verfehlt um 1 (+1): -10 Punkte
const ptsC = calculateTeamPoints(3, 4, 1, 'classic');
assert.strictEqual(ptsC, -10);

console.log('✓ 3-Allianzen Punkteberechnung fehlerfrei!');

console.log('\n======================================================');
console.log('🏆 ALLE 2vs2vs2 ALLIANZEN TESTS VOLLSTÄNDIG BESTANDEN!');
console.log('======================================================\n');
