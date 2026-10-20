const assert = require('assert');
const { calculatePoints, calculateTeamPoints } = require('../server/gameLogic');

console.log('--- STARTE TEST: SKULL KING 0-STICH-WERTUNG ---');

// Test 1: Klassische Wizard-Wertung (Standard)
{
  // 0 angesagt, 0 gemacht -> +20
  assert.strictEqual(calculatePoints(0, 0, 1, 'classic'), 20, 'Klassisch: 0/0 = 20 Pkt');
  // 0 angesagt, 1 gemacht -> -10
  assert.strictEqual(calculatePoints(0, 1, 1, 'classic'), -10, 'Klassisch: 0/1 = -10 Pkt');
  // 2 angesagt, 2 gemacht -> +40
  assert.strictEqual(calculatePoints(2, 2, 5, 'classic'), 40, 'Klassisch: 2/2 = 40 Pkt');
  // 3 angesagt, 1 gemacht -> -20
  assert.strictEqual(calculatePoints(3, 1, 5, 'classic'), -20, 'Klassisch: 3/1 = -20 Pkt');
  console.log('✓ 1. Standard Wizard-Wertung verifiziert');
}

// Test 2: Skull-King-Null-Stich-Wertung (Erfolg)
{
  // Runde 1: 0 angesagt, 0 gemacht -> +10
  assert.strictEqual(calculatePoints(0, 0, 1, 'skull_king_zero'), 10, 'Runde 1: 0/0 = +10 Pkt');
  // Runde 2: 0 angesagt, 0 gemacht -> +20
  assert.strictEqual(calculatePoints(0, 0, 2, 'skull_king_zero'), 20, 'Runde 2: 0/0 = +20 Pkt');
  // Runde 5: 0 angesagt, 0 gemacht -> +50
  assert.strictEqual(calculatePoints(0, 0, 5, 'skull_king_zero'), 50, 'Runde 5: 0/0 = +50 Pkt');
  // Runde 10: 0 angesagt, 0 gemacht -> +100
  assert.strictEqual(calculatePoints(0, 0, 10, 'skull_king_zero'), 100, 'Runde 10: 0/0 = +100 Pkt');
  console.log('✓ 2. Skull-King-Null-Wertung bei Erfolg (Runde * 10) verifiziert');
}

// Test 3: Skull-King-Null-Stich-Wertung (Fehlschlag)
{
  // Runde 1: 0 angesagt, 1 gemacht -> -10
  assert.strictEqual(calculatePoints(0, 1, 1, 'skull_king_zero'), -10, 'Runde 1: 0/1 = -10 Pkt');
  // Runde 2: 0 angesagt, 1 gemacht -> -20
  assert.strictEqual(calculatePoints(0, 1, 2, 'skull_king_zero'), -20, 'Runde 2: 0/1 = -20 Pkt');
  // Runde 4: 0 angesagt, 3 gemacht -> -40
  assert.strictEqual(calculatePoints(0, 3, 4, 'skull_king_zero'), -40, 'Runde 4: 0/3 = -40 Pkt');
  // Runde 10: 0 angesagt, 1 gemacht -> -100
  assert.strictEqual(calculatePoints(0, 1, 10, 'skull_king_zero'), -100, 'Runde 10: 0/1 = -100 Pkt');
  console.log('✓ 3. Skull-King-Null-Wertung bei Fehlschlag (- Runde * 10) verifiziert');
}

// Test 4: Skull-King-Modus bei Geboten > 0 folgt regulärer Wizard-Wertung
{
  // Runde 5: 2 angesagt, 2 gemacht -> 20 + 20 = 40
  assert.strictEqual(calculatePoints(2, 2, 5, 'skull_king_zero'), 40, 'Runde 5: 2/2 = +40 Pkt');
  // Runde 5: 2 angesagt, 4 gemacht -> -20 (2 Differenz)
  assert.strictEqual(calculatePoints(2, 4, 5, 'skull_king_zero'), -20, 'Runde 5: 2/4 = -20 Pkt');
  console.log('✓ 4. Skull-King-Modus bei Gebot > 0 folgt Standardregel verifiziert');
}

// Test 5: Team-Allianzen Punkteauswertung (calculateTeamPoints)
{
  // 0 Team-Stiche angesagt, 0 gemacht -> +30 in Runde 3
  assert.strictEqual(calculateTeamPoints(0, 0, 3, 'skull_king_zero'), 30, 'Team Runde 3: 0/0 = +30 Pkt');
  // 0 Team-Stiche angesagt, 1 gemacht -> -30 in Runde 3
  assert.strictEqual(calculateTeamPoints(0, 1, 3, 'skull_king_zero'), -30, 'Team Runde 3: 0/1 = -30 Pkt');
  // 2 Team-Stiche angesagt, 2 gemacht -> 20 + 20 = 40
  assert.strictEqual(calculateTeamPoints(2, 2, 3, 'skull_king_zero'), 40, 'Team Runde 3: 2/2 = +40 Pkt');
  console.log('✓ 5. Team-Allianzen Punkteauswertung mit Skull-King-Nullwertung verifiziert');
}

console.log('======================================================');
console.log('🏆 ALLE SKULL KING 0-STICH WERTUNGSTESTS BESTANDEN!');
console.log('======================================================');
