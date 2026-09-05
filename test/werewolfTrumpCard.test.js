const assert = require('assert');
const {
  getEffectiveCard,
  evaluateTrickDetails,
  isValidMove,
  sortCards
} = require('../server/gameLogic');

console.log('Testing Werewolf Trump Card & Dynamics...');

// Test 1: getEffectiveCard with werewolf_trump
{
  const wtRed = { type: 'werewolf_trump', suit: 'red', chosenSuit: 'red' };
  const eff = getEffectiveCard(wtRed);
  assert.strictEqual(eff.type, 'color', 'werewolf_trump should be treated effectively as a color card');
  assert.strictEqual(eff.suit, 'red', 'werewolf_trump suit should be red');
  assert.strictEqual(eff.value, 14, 'werewolf_trump value should be 14');
  console.log('✔ getEffectiveCard(werewolf_trump) returns color card with value 14');
}

// Test 2: evaluateTrickDetails with werewolf_trump as trumpCard
{
  const trumpCard = { type: 'werewolf_trump', suit: 'green', chosenSuit: 'green', name: 'Werwolf-Trumpf' };
  const trick = [
    { playerId: 'p1', card: { type: 'color', suit: 'red', value: 12 } },
    { playerId: 'p2', card: { type: 'color', suit: 'green', value: 3 } }, // Trumpf!
    { playerId: 'p3', card: { type: 'color', suit: 'red', value: 13 } }
  ];

  const res = evaluateTrickDetails(trick, trumpCard);
  assert.strictEqual(res.winnerPlayerId, 'p2', 'Green 3 should win as trump against Red 13 because werewolf_trump set green as trump');
  console.log('✔ evaluateTrickDetails recognises werewolf_trump chosenSuit as round trump');
}

// Test 3: Vampire copying werewolf_trump
{
  const trumpCard = { type: 'werewolf_trump', suit: 'blue', chosenSuit: 'blue', name: 'Werwolf-Trumpf' };
  const vampireCard = { type: 'vampire', copiedCard: trumpCard };

  const effVampire = getEffectiveCard(vampireCard);
  assert.strictEqual(effVampire.type, 'color', 'Vampire copying werewolf_trump should effectively be color');
  assert.strictEqual(effVampire.suit, 'blue', 'Vampire copying werewolf_trump should have suit blue');
  assert.strictEqual(effVampire.value, 14, 'Vampire copying werewolf_trump should have value 14');

  // Trick with Vampire (Blue 14) vs Blue 13 vs Red 10
  const trick = [
    { playerId: 'p1', card: { type: 'color', suit: 'blue', value: 13 } },
    { playerId: 'p2', card: vampireCard },
    { playerId: 'p3', card: { type: 'color', suit: 'red', value: 10 } }
  ];

  const res = evaluateTrickDetails(trick, trumpCard);
  assert.strictEqual(res.winnerPlayerId, 'p2', 'Vampire copying werewolf_trump (Blue 14) beats Blue 13');
  console.log('✔ Vampire effectively copies werewolf_trump with value 14 in chosen suit');
}

// Test 4: Werwolf played into trick (e.g. last round where no trump exists) behaves as jester
{
  const werewolfCard = { type: 'werewolf' };
  const effW = getEffectiveCard(werewolfCard);
  assert.strictEqual(effW.type, 'jester', 'Werewolf played in trick counts as jester (value 0)');
  assert.strictEqual(effW.value, 0);

  const trick = [
    { playerId: 'p1', card: { type: 'color', suit: 'yellow', value: 2 } },
    { playerId: 'p2', card: werewolfCard }
  ];
  const res = evaluateTrickDetails(trick, null);
  assert.strictEqual(res.winnerPlayerId, 'p1', 'Yellow 2 beats played werewolf (value 0)');
  console.log('✔ Werewolf played directly into trick behaves as jester (value 0)');
}

// Test 5: Hand sorting with werewolf_trump as trump
{
  const hand = [
    { type: 'color', suit: 'red', value: 5 },
    { type: 'color', suit: 'yellow', value: 8 },
    { type: 'color', suit: 'yellow', value: 2 },
    { type: 'wizard', value: 14 }
  ];
  const sorted = sortCards(hand, 'yellow');
  // Non-trump (red), then trump (yellow 2, 8), then wizard (14)
  assert.strictEqual(sorted[0].suit, 'red');
  assert.strictEqual(sorted[1].suit, 'yellow');
  assert.strictEqual(sorted[1].value, 2);
  assert.strictEqual(sorted[2].value, 8);
  assert.strictEqual(sorted[3].type, 'wizard');
  console.log('✔ Hand sorting respects werewolf_trump chosenSuit correctly');
}

console.log('All Werewolf Trump Card tests passed successfully!');
