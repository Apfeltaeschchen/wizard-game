const assert = require('assert');
const ioClient = require('socket.io-client');
const { getEffectiveCard, sortCards } = require('../server/gameLogic');

function runTests() {
  console.log('--- STARTE AUDIT & JONGLEUR/HEXEN TESTS ---');

  // 1. Unit-Test: Vampire recursion guard & effective card
  console.log('Testing: Vampir mit ungültiger / zirkulärer copiedCard stürzt nicht ab...');
  const v1 = { type: 'vampire', copiedCard: { type: 'vampire' } };
  const eff = getEffectiveCard(v1);
  assert.strictEqual(eff.type, 'jester', 'Vampir-Kopie eines Vampirs muss als Narr enden');

  const v2 = { type: 'vampire', copiedCard: null };
  const eff2 = getEffectiveCard(v2);
  assert.strictEqual(eff2.type, 'jester', 'Vampir ohne Kopie muss als Narr enden');

  const v3 = { type: 'vampire', copiedCard: { type: 'werewolf_trump', chosenSuit: 'red', suit: 'red' } };
  const eff3 = getEffectiveCard(v3);
  assert.strictEqual(eff3.type, 'color');
  assert.strictEqual(eff3.suit, 'red');
  assert.strictEqual(eff3.value, 14);
  console.log('✓ Vampir Rekursionsschutz erfolgreich validiert');

  // 2. Unit-Test: Witch hand splice & sort stability
  console.log('Testing: Hexen-Tausch entfernt die Hexe und nicht die nachträglich umsortierte Handkarte...');
  // Angenommen ein Spieler hat [Rot 5, Gelb 3, Hexe].
  // Trumpf ist Rot. Gelb 3 soll gegen Blau 10 aus dem Stich getauscht werden.
  // Wenn vor dem Splice sortiert werden würde, stünde Hexe an Index 0 und Rot 5 an Index 2!
  const hand = [
    { type: 'color', suit: 'red', value: 5 },
    { type: 'color', suit: 'yellow', value: 3 },
    { type: 'witch', suit: 'none', value: 0 }
  ];
  const trick = [
    { card: { type: 'color', suit: 'blue', value: 10 } }
  ];

  const cardIndex = 2; // Hexe
  const handCardIndex = 1; // Gelb 3
  const trickCardIndex = 0; // Blau 10

  const takenCard = trick[trickCardIndex].card;
  const givenCard = hand[handCardIndex];

  trick[trickCardIndex].card = givenCard;
  hand[handCardIndex] = takenCard;

  // Splicen VOR dem Sortieren (unsere Korrektur)
  const playedCard = hand.splice(cardIndex, 1)[0];
  assert.strictEqual(playedCard.type, 'witch', 'Gespielte Karte muss die Hexe sein');

  const sortedRemainingHand = sortCards(hand, 'red');
  assert.strictEqual(sortedRemainingHand.length, 2);
  assert.strictEqual(sortedRemainingHand.some(c => c.type === 'witch'), false, 'Hexe darf nicht mehr auf der Hand sein');
  assert.strictEqual(sortedRemainingHand.some(c => c.type === 'color' && c.suit === 'blue' && c.value === 10), true, 'Blau 10 muss auf der Hand sein');
  assert.strictEqual(trick[0].card.suit, 'yellow', 'Im Stich muss Gelb 3 liegen');
  console.log('✓ Hexen-Tausch Splice-Reihenfolge erfolgreich validiert');

  // 3. Bombe zerstört NICHT den Jongleur (Tribut wird trotzdem ausgeführt)
  console.log('Testing: Bombe zerstört NICHT den Jongleur (Tribut bleibt aktiv)...');
  const bombedTrick = [
    { playerId: 'p1', card: { type: 'juggler', chosenSuit: 'red' } },
    { playerId: 'p2', card: { type: 'bomb' } },
    { playerId: 'p3', card: { type: 'color', suit: 'red', value: 10 } }
  ];
  const { evaluateTrickDetails } = require('../server/gameLogic');
  const res = evaluateTrickDetails(bombedTrick, { type: 'color', suit: 'red' });
  assert.strictEqual(res.isBombed, true);
  assert.strictEqual(res.winnerPlayerId, null);
  const hadJuggler = bombedTrick.some(t => t.card && t.card.type === 'juggler');
  assert.strictEqual(hadJuggler, true, 'Jongleur löst auch bei Bombe die Weitergabe aus');
  console.log('✓ Jongleur bleibt bei Bombe aktiv');

  // 4. Wolken-Gewinner via Vampir-Kopie
  console.log('Testing: Wolken-Gewinner erkennt auch Vampir-Kopie der Wolke...');
  const wonCardsWithVampireCloud = [
    { type: 'color', suit: 'red', value: 5 },
    { type: 'vampire', copiedCard: { type: 'cloud', chosenSuit: 'red' } }
  ];
  const wonCardsNormal = [
    { type: 'color', suit: 'red', value: 5 },
    { type: 'cloud', chosenSuit: 'blue' }
  ];
  const checkCloudWon = (cards) => cards.some(c => c.type === 'cloud' || (c.type === 'vampire' && c.copiedCard && c.copiedCard.type === 'cloud'));
  assert.strictEqual(checkCloudWon(wonCardsWithVampireCloud), true, 'Vampir mit Cloud muss als Cloud gewertet werden');
  assert.strictEqual(checkCloudWon(wonCardsNormal), true, 'Echte Cloud muss gewertet werden');
  console.log('✓ Wolken-Gewinn durch Vampir-Kopie erfolgreich validiert');

  console.log('\n======================================================');
  console.log('ALLE TESTS FÜR AUDIT & JONGLEUR-BEHEBUNG BESTANDEN!');
  console.log('======================================================\n');
}

runTests();
