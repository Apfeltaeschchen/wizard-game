process.env.WIZARD_DB_PATH = ':memory:';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dbModule = require('../server/database');

console.log('--- STARTE DATENBANK & AUTH UNIT-TESTS ---');

// 1. Registrierung Test
const uname = 'TestWiz_' + Date.now().toString().slice(-6);
const reg1 = dbModule.registerUser(uname, 'geheim123', 'wizard_blue');
assert.strictEqual(reg1.success, true, 'Registrierung sollte erfolgreich sein');
assert.ok(reg1.token, 'Session-Token muss existieren');
assert.strictEqual(reg1.user.username, uname);
assert.strictEqual(reg1.user.games_played, 0);
assert.strictEqual(reg1.user.games_won, 0);
assert.strictEqual(reg1.user.games_lost, 0);
console.log(`✓ 1. Registrierung von ${uname} erfolgreich`);

// 2. Duplikat-Name Test
const regDup = dbModule.registerUser(uname.toLowerCase(), 'nochEinPasswort');
assert.strictEqual(regDup.success, false, 'Case-insensitive Duplikate müssen blockiert werden');
console.log('✓ 2. Duplikat-Prüfung verhindert doppelte Registrierung');

// 3. Login Test (Falsches Passwort vs. Richtiges Passwort)
const loginFail = dbModule.loginUser(uname, 'falsch');
assert.strictEqual(loginFail.success, false, 'Falsches Passwort muss abgelehnt werden');

const loginOk = dbModule.loginUser(uname, 'geheim123');
assert.strictEqual(loginOk.success, true, 'Korrektes Passwort muss erfolgreich sein');
assert.ok(loginOk.token);
console.log('✓ 3. Login mit Passwort-Prüfung erfolgreich');

// 4. Token Validierung
const userByTok = dbModule.getUserByToken(loginOk.token);
assert.ok(userByTok, 'Nutzer muss über Token gefunden werden');
assert.strictEqual(userByTok.username, uname);
console.log('✓ 4. Token Authentifizierung verifiziert');

// 5. Statistik-Tracking: Runden-Bids & Treffer
dbModule.recordRoundBid(reg1.user.id, 2, 2); // Getroffen
dbModule.recordRoundBid(reg1.user.id, 1, 0); // Verfehlt
const userStatsAfterBids = dbModule.getUserById(reg1.user.id);
assert.strictEqual(userStatsAfterBids.bids_made, 2);
assert.strictEqual(userStatsAfterBids.bids_hit, 1);
console.log('✓ 5. Runden-Bids und Prophezeiungs-Treffer erfasst (1/2 = 50%)');

// 6. Spielende: Sieg und Alltime Win/Loss Bilanz
dbModule.recordGameFinished(reg1.user.id, {
  rank: 1,
  totalPlayers: 4,
  points: 120,
  hadZeroWizardTrickWin: true
});
let userAfterGame1 = dbModule.getUserById(reg1.user.id);
assert.strictEqual(userAfterGame1.games_played, 1);
assert.strictEqual(userAfterGame1.games_won, 1);
assert.strictEqual(userAfterGame1.games_lost, 0);
assert.strictEqual(userAfterGame1.current_streak, 1);
assert.strictEqual(userAfterGame1.max_win_streak, 1);
assert.strictEqual(userAfterGame1.podium_finishes, 1);
assert.strictEqual(userAfterGame1.highest_score, 120);
assert.strictEqual(userAfterGame1.total_points, 120);
console.log('✓ 6. Spiel-Sieg (1W - 0L, Streak: 1, Score: 120) verbucht');

// 7. Spielende: Niederlage
dbModule.recordGameFinished(reg1.user.id, {
  rank: 2,
  totalPlayers: 4,
  points: 80,
  hadZeroWizardTrickWin: false
});
let userAfterGame2 = dbModule.getUserById(reg1.user.id);
assert.strictEqual(userAfterGame2.games_played, 2);
assert.strictEqual(userAfterGame2.games_won, 1);
assert.strictEqual(userAfterGame2.games_lost, 1);
assert.strictEqual(userAfterGame2.current_streak, 0, 'Streak muss bei Niederlage auf 0 zurückgesetzt werden');
assert.strictEqual(userAfterGame2.max_win_streak, 1, 'Max-Streak muss erhalten bleiben');
console.log('✓ 7. Spiel-Niederlage (1W - 1L, Streak: 0, Max Streak: 1) verbucht');

// 8. Leaderboard Test
const leaderboard = dbModule.getLeaderboard(10);
assert.ok(Array.isArray(leaderboard));
assert.ok(leaderboard.length > 0);
const leader = leaderboard.find(l => l.username === uname);
assert.ok(leader, 'Nutzer muss im Leaderboard gefunden werden');
assert.strictEqual(leader.username, uname);
assert.strictEqual(leader.games_won, 1);
assert.strictEqual(leader.games_lost, 1);
assert.strictEqual(leader.win_rate, 50);
console.log('✓ 8. Leaderboard mit W/L und Winrate (50%) verifiziert');

console.log('\n=======================================');
console.log('ALLE DATENBANK- & AUTH-TESTS BESTANDEN!');
console.log('=======================================\n');
