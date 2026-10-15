const assert = require('assert');
const dbModule = require('../server/database');

console.log('--- STARTE OVERWATCH-RANGSYSTEM & DATENBANK TESTS ---');

// Test 1: Divisions- & Tier-Berechnung
{
  const rNovice = dbModule.getRankDetailsFromSR(150);
  assert.strictEqual(rNovice.tierKey, 'novice');
  assert.strictEqual(rNovice.division, 5);
  assert.strictEqual(rNovice.divisionRoman, 'V');
  assert.strictEqual(rNovice.label, 'Novize V');

  const rNoviceHigh = dbModule.getRankDetailsFromSR(900);
  assert.strictEqual(rNoviceHigh.tierKey, 'novice');
  assert.strictEqual(rNoviceHigh.division, 1);
  assert.strictEqual(rNoviceHigh.label, 'Novize I');

  const rAdept = dbModule.getRankDetailsFromSR(1240);
  assert.strictEqual(rAdept.tierKey, 'adept');
  assert.strictEqual(rAdept.division, 3);
  assert.strictEqual(rAdept.divisionRoman, 'III');
  assert.strictEqual(rAdept.label, 'Adept III');
  assert.strictEqual(rAdept.progressPct, 40);

  const rMage = dbModule.getRankDetailsFromSR(1850);
  assert.strictEqual(rMage.tierKey, 'mage');
  assert.strictEqual(rMage.division, 2);
  assert.strictEqual(rMage.label, 'Magier II');

  const rArchmage = dbModule.getRankDetailsFromSR(2450);
  assert.strictEqual(rArchmage.tierKey, 'archmage');
  assert.strictEqual(rArchmage.division, 1);
  assert.strictEqual(rArchmage.label, 'Erzmagier I');

  const rGrandmaster = dbModule.getRankDetailsFromSR(2750);
  assert.strictEqual(rGrandmaster.tierKey, 'grandmaster');
  assert.strictEqual(rGrandmaster.division, 3);
  assert.strictEqual(rGrandmaster.label, 'Großmagier III');

  const rCouncil = dbModule.getRankDetailsFromSR(3200);
  assert.strictEqual(rCouncil.tierKey, 'high_council');
  assert.strictEqual(rCouncil.label, 'Oberster Rat');
  assert.strictEqual(rCouncil.progressPct, 100);

  console.log('✓ Test 1: Overwatch-Tiers & Divisionen (Novize bis Oberster Rat) bestanden');
}

// Test 2: Registrierung & Ranked Match Abschluss
{
  const testName = 'RankedTester_' + Math.random().toString(36).substring(2, 7);
  const reg = dbModule.registerUser(testName, 'secret123');
  assert.strictEqual(reg.success, true);
  const userId = reg.user.id;
  assert.strictEqual(reg.user.rank.label, 'Adept V', 'Start-SR ist 1000 -> Adept V');

  // Match 1: 1. Platz mit hoher Prophezeiungs-Quote -> SR Gewinn
  const res1 = dbModule.recordRankedGameFinished(userId, {
    rank: 1,
    totalPlayers: 4,
    points: 180,
    bidsMade: 10,
    bidsHit: 9 // 90% Quote -> +5 SR Bonus
  });
  assert.ok(res1);
  assert.ok(res1.newSR > res1.oldSR, 'SR muss bei Platz 1 steigen');
  assert.strictEqual(res1.delta, 28 + 5, 'Basis 28 + Bonus 5 = 33 SR');
  assert.strictEqual(res1.newSR, 1033);

  // Match 2: Letzter Platz (4/4) -> SR Verlust
  const res2 = dbModule.recordRankedGameFinished(userId, {
    rank: 4,
    totalPlayers: 4,
    points: -30,
    bidsMade: 10,
    bidsHit: 2
  });
  assert.ok(res2.delta < 0, 'SR muss bei letztem Platz sinken');
  assert.strictEqual(res2.newSR, 1033 - 10);

  console.log('✓ Test 2: Ranked Match-Auswertung mit SR-Fortschritt bestanden');

  // Test 3: Leaver-Penalty & Pop Notice
  const penalty = dbModule.applyLeaverPenalty(userId);
  assert.strictEqual(penalty.penalty, 50);
  assert.strictEqual(penalty.newSR, 1023 - 50);

  const notice1 = dbModule.popPenaltyNotice(userId);
  assert.ok(notice1 && notice1.includes('-50 Rangpunkte'));

  const notice2 = dbModule.popPenaltyNotice(userId);
  assert.strictEqual(notice2, null, 'Zweiter Abruf muss null sein (wurde geleert)');
  console.log('✓ Test 3: Leaver-Penalty (-50 SR) & Rejoin-Benachrichtigung bestanden');
}

// Test 4: Ranked Leaderboard
{
  const lb = dbModule.getRankedLeaderboard(10);
  assert.ok(Array.isArray(lb));
  if (lb.length > 1) {
    assert.ok(lb[0].skill_rating >= lb[1].skill_rating, 'Muss absteigend nach SR sortiert sein');
  }
  console.log('✓ Test 4: Ranglisten-Leaderboard Abfrage bestanden');
}

console.log('=======================================');
console.log('ALLE RANGSYSTEM-TESTS ERFOLGREICH BESTANDEN!');
console.log('=======================================');
