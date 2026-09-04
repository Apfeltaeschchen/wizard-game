const assert = require('assert');
const {
  createDeck,
  shuffle,
  evaluateTrick,
  isValidMove,
  calculatePoints,
  sortCards,
  isForbiddenBid,
  getMaxRounds
} = require('../server/gameLogic');

console.log('--- STARTE WIZARD GAME LOGIC TESTS ---');

// 1. Tests für getMaxRounds
assert.strictEqual(getMaxRounds(3), 20);
assert.strictEqual(getMaxRounds(4), 15);
assert.strictEqual(getMaxRounds(5), 12);
assert.strictEqual(getMaxRounds(6), 10);
console.log('✓ getMaxRounds bestanden');

// 2. Tests für isForbiddenBid
assert.strictEqual(isForbiddenBid(2, 5, 3, true), true); // 5 - 3 = 2 -> Verboten
assert.strictEqual(isForbiddenBid(1, 5, 3, true), false);
assert.strictEqual(isForbiddenBid(2, 5, 3, false), false); // Nicht der letzte Spieler
assert.strictEqual(isForbiddenBid(0, 5, 6, true), false); // Summe bereits > Runde (5 - 6 = -1 < 0)
console.log('✓ isForbiddenBid bestanden');

// 3. Tests für calculatePoints
assert.strictEqual(calculatePoints(0, 0), 20);
assert.strictEqual(calculatePoints(2, 2), 40);
assert.strictEqual(calculatePoints(0, 1), -10);
assert.strictEqual(calculatePoints(3, 1), -20);
assert.strictEqual(calculatePoints(1, 3), -20);
console.log('✓ calculatePoints bestanden');

// 4. Tests für sortCards (Narren -> Gelb/Rot/Grün/Blau -> Trumpf -> Zauberer)
const testHand = [
  { type: 'color', suit: 'red', value: 8 },
  { type: 'wizard', suit: 'none', value: 14 },
  { type: 'color', suit: 'green', value: 2 },
  { type: 'jester', suit: 'none', value: 0 },
  { type: 'color', suit: 'yellow', value: 10 },
  { type: 'color', suit: 'blue', value: 5 },
  { type: 'color', suit: 'red', value: 3 },
  { type: 'color', suit: 'green', value: 11 },
  { type: 'wizard', suit: 'none', value: 14 }
];

// Fall A: Trumpf ist Grün
// Reihenfolge: Jester (0) -> Gelb (10) -> Rot (3, 8) -> Blau (5) -> TRUMPF GRÜN (2, 11) -> Wizard (14, 14)
const sortedTrumpGreen = sortCards(testHand, 'green');
assert.strictEqual(sortedTrumpGreen[0].type, 'jester');
assert.strictEqual(sortedTrumpGreen[1].suit, 'yellow');
assert.strictEqual(sortedTrumpGreen[1].value, 10);
assert.strictEqual(sortedTrumpGreen[2].suit, 'red');
assert.strictEqual(sortedTrumpGreen[2].value, 3);
assert.strictEqual(sortedTrumpGreen[3].suit, 'red');
assert.strictEqual(sortedTrumpGreen[3].value, 8);
assert.strictEqual(sortedTrumpGreen[4].suit, 'blue');
assert.strictEqual(sortedTrumpGreen[4].value, 5);
assert.strictEqual(sortedTrumpGreen[5].suit, 'green'); // Trumpf 1
assert.strictEqual(sortedTrumpGreen[5].value, 2);
assert.strictEqual(sortedTrumpGreen[6].suit, 'green'); // Trumpf 2
assert.strictEqual(sortedTrumpGreen[6].value, 11);
assert.strictEqual(sortedTrumpGreen[7].type, 'wizard');
assert.strictEqual(sortedTrumpGreen[8].type, 'wizard');
console.log('✓ sortCards mit Trumpf (Grün) bestanden');

// Fall B: Trumpf ist 'none'
// Reihenfolge: Jester -> Gelb -> Rot -> Grün -> Blau -> Zauberer
const sortedNoTrump = sortCards(testHand, 'none');
assert.strictEqual(sortedNoTrump[0].type, 'jester');
assert.strictEqual(sortedNoTrump[1].suit, 'yellow');
assert.strictEqual(sortedNoTrump[2].suit, 'red');
assert.strictEqual(sortedNoTrump[3].suit, 'red');
assert.strictEqual(sortedNoTrump[4].suit, 'green');
assert.strictEqual(sortedNoTrump[5].suit, 'green');
assert.strictEqual(sortedNoTrump[6].suit, 'blue');
assert.strictEqual(sortedNoTrump[7].type, 'wizard');
assert.strictEqual(sortedNoTrump[8].type, 'wizard');
console.log('✓ sortCards ohne Trumpf bestanden');

// 5. Tests für evaluateTrick
// Test A: Erster Zauberer gewinnt gegen zweiten Zauberer
const trickA = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 12 } },
  { playerId: 'p2', card: { type: 'wizard', suit: 'none', value: 14 } },
  { playerId: 'p3', card: { type: 'wizard', suit: 'none', value: 14 } }
];
assert.strictEqual(evaluateTrick(trickA, { type: 'color', suit: 'green', value: 1 }), 'p2');

// Test B: Trumpf sticht höhere Fehlfarbe
const trickB = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 13 } },
  { playerId: 'p2', card: { type: 'color', suit: 'green', value: 2 } },
  { playerId: 'p3', card: { type: 'color', suit: 'red', value: 4 } }
];
assert.strictEqual(evaluateTrick(trickB, { type: 'color', suit: 'green', value: 1 }), 'p2');

// Test C: Höherer Trumpf schlägt niedrigeren Trumpf
const trickC = [
  { playerId: 'p1', card: { type: 'color', suit: 'green', value: 3 } },
  { playerId: 'p2', card: { type: 'color', suit: 'green', value: 10 } },
  { playerId: 'p3', card: { type: 'color', suit: 'green', value: 7 } }
];
assert.strictEqual(evaluateTrick(trickC, { type: 'color', suit: 'green', value: 1 }), 'p2');

// Test D: Nur Narren -> erster Narr gewinnt
const trickD = [
  { playerId: 'p1', card: { type: 'jester', suit: 'none', value: 0 } },
  { playerId: 'p2', card: { type: 'jester', suit: 'none', value: 0 } },
  { playerId: 'p3', card: { type: 'jester', suit: 'none', value: 0 } }
];
assert.strictEqual(evaluateTrick(trickD, { type: 'color', suit: 'red', value: 1 }), 'p1');

// Test E: Narr eröffnet, gefolgt von Farbe -> Farbkarte bestimmt Stich
const trickE = [
  { playerId: 'p1', card: { type: 'jester', suit: 'none', value: 0 } },
  { playerId: 'p2', card: { type: 'color', suit: 'yellow', value: 8 } },
  { playerId: 'p3', card: { type: 'color', suit: 'yellow', value: 11 } }
];
assert.strictEqual(evaluateTrick(trickE, { type: 'color', suit: 'blue', value: 1 }), 'p3');

// Test F: Geber hat Zauberer als Trumpfkarte und wählt 'yellow'
const trumpWizard = { type: 'wizard', suit: 'none', value: 14, chosenSuit: 'yellow' };
const trickF = [
  { playerId: 'p1', card: { type: 'color', suit: 'blue', value: 12 } },
  { playerId: 'p2', card: { type: 'color', suit: 'yellow', value: 2 } }
];
assert.strictEqual(evaluateTrick(trickF, trumpWizard), 'p2');
console.log('✓ evaluateTrick bestanden');

// 6. Tests für isValidMove
const handWithRed = [
  { type: 'color', suit: 'red', value: 5 },
  { type: 'color', suit: 'blue', value: 10 },
  { type: 'wizard', suit: 'none', value: 14 },
  { type: 'jester', suit: 'none', value: 0 }
];

// Stich eröffnet mit Red
const trickWithRedLead = [
  { playerName: 'P1', card: { type: 'color', suit: 'red', value: 9 } }
];

// Zauberer und Narr immer erlaubt
assert.strictEqual(isValidMove({ type: 'wizard', suit: 'none', value: 14 }, handWithRed, trickWithRedLead), true);
assert.strictEqual(isValidMove({ type: 'jester', suit: 'none', value: 0 }, handWithRed, trickWithRedLead), true);
// Red bedienen erlaubt
assert.strictEqual(isValidMove({ type: 'color', suit: 'red', value: 5 }, handWithRed, trickWithRedLead), true);
// Blue spielen verboten, da Red auf der Hand ist
assert.strictEqual(isValidMove({ type: 'color', suit: 'blue', value: 10 }, handWithRed, trickWithRedLead), false);

// Hand ohne Red
const handWithoutRed = [
  { type: 'color', suit: 'blue', value: 10 }
];
assert.strictEqual(isValidMove({ type: 'color', suit: 'blue', value: 10 }, handWithoutRed, trickWithRedLead), true);
console.log('✓ isValidMove bestanden');

console.log('\n=======================================');
console.log('ALLE SPIELLOGIK-TESTS ERFOLGREICH!');
console.log('=======================================');
