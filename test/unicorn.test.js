const assert = require('assert');
const {
  createDeck,
  evaluateTrickDetails,
  evaluateTrick,
  isValidMove,
  sortCards,
  getMaxRounds
} = require('../server/gameLogic');

console.log('--- STARTE WIZARD EINHORN & RIVALEN TESTS ---');

// Test 1: Deckgröße 70 Karten
const deck30 = createDeck('anniversary_30');
assert.strictEqual(deck30.length, 70, '30-Jahre-Deck muss genau 70 Karten haben');
const unicornCard = deck30.find(c => c.type === 'unicorn');
assert.ok(unicornCard, 'Einhorn muss im Deck enthalten sein');
console.log('✓ Test 1: Deckgröße 70 Karten mit Einhorn bestanden');

// Test 2: Einhorn neutralisiert Zauberer & Trümpfe, höchste Zahl gewinnt
{
  const trick = [
    { playerId: 'p1', card: { type: 'wizard', suit: 'none', value: 14 } },
    { playerId: 'p2', card: { type: 'color', suit: 'yellow', value: 11 } },
    { playerId: 'p3', card: { type: 'color', suit: 'red', value: 9 } }, // Red ist Trumpf
    { playerId: 'p4', card: { type: 'unicorn', suit: 'none', value: 0 } }
  ];
  const trump = { type: 'color', suit: 'red', value: 7 };
  const res = evaluateTrickDetails(trick, trump);
  assert.strictEqual(res.winnerPlayerId, 'p2', 'Yellow 11 muss gewinnen, da Einhorn Zauberer & Trumpf neutralisiert');
  assert.strictEqual(res.isUnicornActive, true);
  console.log('✓ Test 2: Einhorn neutralisiert Zauberer & Trümpfe (Gelb 11 gewinnt)');
}

// Test 3: Gleichstand bei Zahlenkarten -> erste gespielte gewinnt
{
  const trick = [
    { playerId: 'p1', card: { type: 'color', suit: 'blue', value: 12 } },
    { playerId: 'p2', card: { type: 'color', suit: 'green', value: 12 } },
    { playerId: 'p3', card: { type: 'unicorn', suit: 'none', value: 0 } }
  ];
  const res = evaluateTrickDetails(trick, null);
  assert.strictEqual(res.winnerPlayerId, 'p1', 'Erste gespielte 12 (p1) muss bei Gleichstand gewinnen');
  console.log('✓ Test 3: Gleichstand bei höchsten Zahlenkarten bestanden');
}

// Test 4: Uralte Rivalen - Fall A: Einhorn ZUERST, Bombe DANACH (Bombe gewinnt Streit)
{
  const trick = [
    { playerId: 'p1', card: { type: 'unicorn', suit: 'none', value: 0 } },
    { playerId: 'p2', card: { type: 'color', suit: 'blue', value: 13 } },
    { playerId: 'p3', card: { type: 'bomb', suit: 'none', value: -99 } }
  ];
  const res = evaluateTrickDetails(trick, null);
  assert.strictEqual(res.winnerPlayerId, null, 'Stich muss durch spätere Bombe gesprengt werden');
  assert.strictEqual(res.isBombed, true, 'isBombed muss true sein');
  assert.strictEqual(res.nextLeadPlayerId, 'p2', 'p2 hatte höchste Karte vor der Bombe');
  console.log('✓ Test 4: Rivalen Fall A (Einhorn vor Bombe -> Bombe sprengt Stich) bestanden');
}

// Test 5: Uralte Rivalen - Fall B: Bombe ZUERST, Einhorn DANACH (Einhorn gewinnt Streit)
{
  const trick = [
    { playerId: 'p1', card: { type: 'bomb', suit: 'none', value: -99 } },
    { playerId: 'p2', card: { type: 'color', suit: 'green', value: 8 } },
    { playerId: 'p3', card: { type: 'unicorn', suit: 'none', value: 0 } }
  ];
  const res = evaluateTrickDetails(trick, null);
  assert.strictEqual(res.winnerPlayerId, 'p2', 'Grün 8 gewinnt, da späteres Einhorn die Bombe neutralisiert');
  assert.strictEqual(res.isBombed, false, 'isBombed muss false sein');
  assert.strictEqual(res.isUnicornActive, true, 'isUnicornActive muss true sein');
  console.log('✓ Test 5: Rivalen Fall B (Bombe vor Einhorn -> Einhorn neutralisiert Bombe) bestanden');
}

// Test 6: Reine Sonderkarten im Einhorn-Stich -> Stich abgeworfen, Einhorn-Spieler eröffnet
{
  const trick = [
    { playerId: 'p1', card: { type: 'wizard', suit: 'none', value: 14 } },
    { playerId: 'p2', card: { type: 'jester', suit: 'none', value: 0 } },
    { playerId: 'p3', card: { type: 'dragon', suit: 'none', value: 15 } },
    { playerId: 'p4', card: { type: 'unicorn', suit: 'none', value: 0 } }
  ];
  const res = evaluateTrickDetails(trick, null);
  assert.strictEqual(res.winnerPlayerId, null, 'Kein Gewinner, da keine Zahlenkarten vorhanden');
  assert.strictEqual(res.isUnicornVoided, true, 'isUnicornVoided muss true sein');
  assert.strictEqual(res.nextLeadPlayerId, 'p4', 'Einhorn-Spieler p4 muss den nächsten Stich eröffnen');
  console.log('✓ Test 6: Reine Sonderkarten-Abwurfregel bestanden (Einhorn eröffnet neu)');
}

// Test 7: Bedienpflicht / Narrenfreiheit
{
  const hand = [
    { type: 'color', suit: 'blue', value: 5 },
    { type: 'unicorn', suit: 'none', value: 0 }
  ];
  const currentTrick = [
    { playerId: 'p1', card: { type: 'color', suit: 'blue', value: 9 } }
  ];
  assert.strictEqual(isValidMove(hand[1], hand, currentTrick), true, 'Einhorn darf trotz Bedienpflicht gelegt werden');
  console.log('✓ Test 7: Narrenfreiheit des Einhorns bestanden');
}

// Test 8: Handkarten-Sortierung
{
  const hand = [
    { type: 'wizard', suit: 'none', value: 14 },
    { type: 'unicorn', suit: 'none', value: 0 },
    { type: 'color', suit: 'red', value: 10 },
    { type: 'jester', suit: 'none', value: 0 }
  ];
  const sorted = sortCards(hand, 'none');
  assert.strictEqual(sorted[0].type, 'jester', 'Narr ganz links');
  assert.strictEqual(sorted[1].type, 'color', 'Farbe in der Mitte');
  assert.strictEqual(sorted[2].type, 'unicorn', 'Einhorn vor Zauberer');
  assert.strictEqual(sorted[3].type, 'wizard', 'Zauberer ganz rechts');
  console.log('✓ Test 8: Handkarten-Sortierung mit Einhorn bestanden');
}

console.log('=======================================');
console.log('ALLE EINHORN-TESTS ERFOLGREICH BESTANDEN!');
console.log('=======================================');
