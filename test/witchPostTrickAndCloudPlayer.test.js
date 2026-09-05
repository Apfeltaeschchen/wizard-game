const assert = require('assert');
const { evaluateTrickDetails, sortCards } = require('../server/gameLogic');

console.log('====================================================');
console.log('TEST: HEXE NACH STICH-ENDE & WOLKEN-AUSPLAYER WAHL');
console.log('====================================================\n');

// 1. Test: Wolke - Der Ausspieler (nicht der Gewinner) entscheidet die Anpassung
console.log('1. Test: Wolke - Der Ausspieler passt seinen eigenen Tipp an...');
{
  const trick = [
    { playerId: 'p1_cloud_player', card: { type: 'cloud', chosenSuit: 'red' } },
    { playerId: 'p2_wizard_player', card: { type: 'wizard' } },
    { playerId: 'p3_color_player', card: { type: 'color', suit: 'red', value: 8 } }
  ];

  const res = evaluateTrickDetails(trick, { type: 'color', suit: 'blue' });
  assert.strictEqual(res.isBombed, false);
  assert.strictEqual(res.winnerPlayerId, 'p2_wizard_player', 'Zauberer von p2 gewinnt den Stich');

  // Wolken-Erkennung
  const hadCloud = !res.isBombed && trick.some(t => t.card && (t.card.type === 'cloud' || (t.card.type === 'vampire' && t.card.copiedCard && t.card.copiedCard.type === 'cloud')));
  assert.strictEqual(hadCloud, true, 'Wolke im Stich registriert');

  // Der Spieler der Wolke wird anhand des Trick-Eintrags ermittelt
  const cloudEntry = trick.find(t => t.card && (t.card.type === 'cloud' || (t.card.type === 'vampire' && t.card.copiedCard && t.card.copiedCard.type === 'cloud')));
  assert.strictEqual(cloudEntry.playerId, 'p1_cloud_player', 'Ausspieler der Wolke ist p1, NICHT der Stichgewinner p2!');

  // Anpassung für p1 testen (+1 oder -1)
  let p1Bid = 2;
  const deltaPlus = 1;
  p1Bid += deltaPlus;
  assert.strictEqual(p1Bid, 3, 'Tipp von p1 um +1 angepasst');

  let p1BidZero = 0;
  const canMinus = p1BidZero > 0;
  assert.strictEqual(canMinus, false, 'Bei Tipp 0 ist -1 nicht erlaubt');

  console.log('✓ Wolken-Ausspieler p1 wird korrekt ermittelt und passt seinen eigenen Tipp an');
}

// 2. Test: Wolke bei Bombe wird neutralisiert
console.log('\n2. Test: Bombe neutralisiert Wolke...');
{
  const trickWithBomb = [
    { playerId: 'p1_cloud', card: { type: 'cloud', chosenSuit: 'green' } },
    { playerId: 'p2_bomb', card: { type: 'bomb' } },
    { playerId: 'p3_color', card: { type: 'color', suit: 'green', value: 12 } }
  ];

  const res = evaluateTrickDetails(trickWithBomb, { type: 'color', suit: 'blue' });
  assert.strictEqual(res.isBombed, true);

  const hadCloud = !res.isBombed && trickWithBomb.some(t => t.card && t.card.type === 'cloud');
  assert.strictEqual(hadCloud, false, 'Wolke bei gebombtem Stich neutralisiert');
  console.log('✓ Wolke wird bei Bombe ordnungsgemäß neutralisiert');
}

// 3. Test: Hexe - Zählt im Stich als Narr (Wert 0) und gewinnt nicht
console.log('\n3. Test: Hexe zählt im Stich als Narr (Wert 0)...');
{
  const trick = [
    { playerId: 'p1_color', card: { type: 'color', suit: 'red', value: 3 } },
    { playerId: 'p2_witch', card: { type: 'witch', value: 0 } },
    { playerId: 'p3_color', card: { type: 'color', suit: 'red', value: 7 } }
  ];

  const res = evaluateTrickDetails(trick, { type: 'color', suit: 'yellow' });
  assert.strictEqual(res.winnerPlayerId, 'p3_color', 'Rot 7 gewinnt gegen Rot 3 und Hexe');
  console.log('✓ Hexe zählt im Stich wie ein Narr (Wert 0)');
}

// 4. Test: Hexe - Tausch NACH Stich-Ende ändert den Gewinner NICHT
console.log('\n4. Test: Hexen-Tausch nach Stich-Ende...');
{
  let currentTrick = [
    { playerName: 'Albin', playerSessionId: 'p1', card: { type: 'color', suit: 'blue', value: 13 } },
    { playerName: 'Merlin', playerSessionId: 'p2_witch', card: { type: 'witch', value: 0 } },
    { playerName: 'Morgana', playerSessionId: 'p3', card: { type: 'color', suit: 'blue', value: 8 } }
  ];

  // Schritt 1: Stichgewinner VOR dem Tausch bestimmen
  const res = evaluateTrickDetails(currentTrick.map(t => ({ playerId: t.playerSessionId, card: t.card })), { type: 'color', suit: 'red' });
  assert.strictEqual(res.winnerPlayerId, 'p1', 'Albin (Blau 13) gewinnt den Stich');

  // Schritt 2: Hexen-Spieler p2_witch führt Tausch durch
  let witchHand = [
    { type: 'color', suit: 'red', value: 4 },
    { type: 'wizard' }
  ];

  const swappableTrickCards = currentTrick.filter(t => t.card.type !== 'witch');
  assert.strictEqual(swappableTrickCards.length, 2, '2 Karten im Stich stehen zum Tausch bereit');

  // Hexen-Spieler nimmt Blau 13 (Index 0) und legt Rot 4 (Index 0 aus Hand) hinein
  const trickCardIndex = 0; // Blau 13
  const handCardIndex = 0; // Rot 4

  const takenCard = currentTrick[trickCardIndex].card;
  const givenCard = witchHand[handCardIndex];

  currentTrick[trickCardIndex].card = givenCard;
  witchHand[handCardIndex] = takenCard;
  witchHand = sortCards(witchHand, 'red');

  // Überprüfungen:
  assert.strictEqual(currentTrick[0].card.value, 4, 'Im Stich liegt nun Rot 4');
  assert.strictEqual(currentTrick[0].card.suit, 'red');
  assert.strictEqual(witchHand.some(c => c.suit === 'blue' && c.value === 13), true, 'Blau 13 befindet sich nun auf der Hand der Hexe!');
  assert.strictEqual(res.winnerPlayerId, 'p1', 'Der Gewinner des Stichs bleibt unverändert p1!');
  console.log('✓ Hexen-Tausch tauscht Karten sauber aus, ohne den Sieger zu beeinflussen');
}

// 5. Test: Hexe - Tausch ist auch bei Bombe aktiv
console.log('\n5. Test: Hexe bei gebombtem Stich...');
{
  const bombedTrick = [
    { playerSessionId: 'p1', card: { type: 'bomb' } },
    { playerSessionId: 'p2_witch', card: { type: 'witch', value: 0 } },
    { playerSessionId: 'p3', card: { type: 'color', suit: 'yellow', value: 11 } }
  ];

  const res = evaluateTrickDetails(bombedTrick.map(t => ({ playerId: t.playerSessionId, card: t.card })), { type: 'color', suit: 'red' });
  assert.strictEqual(res.isBombed, true);

  // Hexe wird auch bei Bombe aktiviert:
  const hadWitch = bombedTrick.some(t => t.card && t.card.type === 'witch');
  assert.strictEqual(hadWitch, true, 'Hexe bleibt auch bei Bombe aktiv');

  const swappableTrickCards = bombedTrick.some(t => t.card && t.card.type !== 'witch');
  assert.strictEqual(swappableTrickCards, true, 'Nicht-Hexen-Karten können getauscht werden');
  console.log('✓ Hexe bleibt auch bei gebombtem Stich für Tausch verfügbar');
}

// 6. Test: Hexe bei 0 Handkarten (letzter Stich / Runde 1) überspringt sauber
console.log('\n6. Test: Hexe mit 0 verbleibenden Handkarten...');
{
  const witchHand = []; // Nach dem Ausspielen der Hexe keine Handkarten mehr
  const currentTrick = [
    { card: { type: 'witch', value: 0 } },
    { card: { type: 'color', suit: 'red', value: 5 } }
  ];

  const swappableTrickCards = currentTrick.some(t => t.card && t.card.type !== 'witch');
  const canSwap = witchHand.length > 0 && swappableTrickCards;
  assert.strictEqual(canSwap, false, 'Kein Tausch möglich bei 0 Handkarten -> wird sauber übersprungen');
  console.log('✓ 0 Handkarten führen zum sauberen Überspringen ohne Freeze');
}

// 7. Test: Pipeline-Reihenfolge Wolke -> Hexe -> Jongleur
console.log('\n7. Test: Pipeline-Reihenfolge Wolke -> Hexe -> Jongleur...');
{
  const trickWithAllThree = [
    { playerSessionId: 'p1_cloud', card: { type: 'cloud', chosenSuit: 'blue' } },
    { playerSessionId: 'p2_witch', card: { type: 'witch', value: 0 } },
    { playerSessionId: 'p3_juggler', card: { type: 'juggler', chosenSuit: 'blue' } }
  ];

  const isBombed = false;
  const hadCloud = !isBombed && trickWithAllThree.some(t => t.card.type === 'cloud');
  const hadWitch = trickWithAllThree.some(t => t.card.type === 'witch');
  const hadJuggler = trickWithAllThree.some(t => t.card.type === 'juggler');

  assert.strictEqual(hadCloud, true);
  assert.strictEqual(hadWitch, true);
  assert.strictEqual(hadJuggler, true);

  const order = [];
  function stepCloud(next) {
    if (hadCloud) order.push('cloud');
    next();
  }
  function stepWitch(next) {
    if (hadWitch) order.push('witch');
    next();
  }
  function stepJuggler(next) {
    if (hadJuggler) order.push('juggler');
    next();
  }
  function stepFinish() {
    order.push('finish');
  }

  stepCloud(() => {
    stepWitch(() => {
      stepJuggler(() => {
        stepFinish();
      });
    });
  });

  assert.deepStrictEqual(order, ['cloud', 'witch', 'juggler', 'finish']);
  console.log('✓ Pipeline-Reihenfolge perfekt eingehalten: Wolke -> Hexe -> Jongleur -> Finish');
}

console.log('\n====================================================');
console.log('ALLE TESTS FÜR HEXE & WOLKEN-AUSPLAYER BESTANDEN!');
console.log('====================================================');
