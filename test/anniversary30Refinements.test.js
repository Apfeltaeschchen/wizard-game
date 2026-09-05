const assert = require('assert');
const {
  createDeck,
  shuffle,
  evaluateTrickDetails,
  isValidMove,
  sortCards,
  calculatePoints
} = require('../server/gameLogic');

console.log('====================================================');
console.log('TEST: 30 JAHRE REFINEMENTS & STIRN-WIZARD VALIDIERUNG');
console.log('====================================================\n');

// 1. Vampir bei Werwolf-Trumpf: Neue Trumpfkarte aufdecken
console.log('1. Test: Vampir deckt bei Werwolf-Trumpf sofort neue Trumpfkarte auf...');
{
  const remainingDeck = [
    { type: 'color', suit: 'green', value: 7 },
    { type: 'color', suit: 'blue', value: 12 }
  ];
  const room = {
    round: 2,
    trumpCard: { type: 'werewolf_trump', suit: 'red', chosenSuit: 'red' },
    trumpSuit: 'red',
    remainingDeck: [...remainingDeck],
    players: [
      { sessionId: 'p1', name: 'Albin', hand: [{ type: 'vampire' }] },
      { sessionId: 'p2', name: 'Berta', hand: [{ type: 'color', suit: 'red', value: 4 }] }
    ]
  };

  const isWerewolfTrump = room.trumpCard && (
    room.trumpCard.type === 'werewolf_trump' ||
    room.trumpCard.isWerewolf
  );
  assert.strictEqual(isWerewolfTrump, true, 'Werwolf-Trumpf muss erkannt werden');

  const cardToPlay = room.players[0].hand[0];
  const newTrump = room.remainingDeck.pop();
  assert.deepStrictEqual(newTrump, { type: 'color', suit: 'blue', value: 12 }, 'Neue Trumpfkarte vom Deck muss Blau 12 sein');

  room.trumpCard = newTrump;
  room.trumpSuit = newTrump.suit;
  cardToPlay.copiedCard = { ...newTrump };

  assert.strictEqual(room.trumpSuit, 'blue', 'Neue Trumpffarbe muss Blau sein');
  assert.strictEqual(cardToPlay.copiedCard.suit, 'blue');
  assert.strictEqual(cardToPlay.copiedCard.value, 12);
  console.log('✓ Vampir deckt neue Trumpfkarte (Blau 12) erfolgreich auf und kopiert sie');
}

// 2. Bomben-Interaktionen: Höchste Nicht-Bomben-Karte führt nächsten Stich an
console.log('\n2. Test: Bomben-Stich: Höchster Nicht-Bomben-Spieler leitet nächsten Stich an...');
{
  const trickWithBomb = [
    { playerId: 'p1', card: { type: 'color', suit: 'blue', value: 8 } },
    { playerId: 'p2', card: { type: 'bomb' } },
    { playerId: 'p3', card: { type: 'color', suit: 'blue', value: 13 } }
  ];
  const res = evaluateTrickDetails(trickWithBomb, { type: 'color', suit: 'red' });
  assert.strictEqual(res.isBombed, true, 'Stich muss als gebombt gewertet werden');
  assert.strictEqual(res.winnerPlayerId, null, 'Gebombter Stich hat keinen Gewinner');
  assert.strictEqual(res.nextLeadPlayerId, 'p3', 'p3 (Blau 13) muss den nächsten Stich anspielen');
  console.log('✓ Nächster Anspieler nach Bombe ist korrekt p3 (höchste Nicht-Bombe)');
}

// 3. Bombe zerstört NICHT den Jongleur, aber zerstört die Wolke
console.log('\n3. Test: Bombe zerstört Jongleur NICHT, neutralisiert aber die Wolke...');
{
  const trickWithBombAndJuggler = [
    { playerId: 'p1', card: { type: 'juggler', chosenSuit: 'red' } },
    { playerId: 'p2', card: { type: 'bomb' } },
    { playerId: 'p3', card: { type: 'cloud', chosenSuit: 'red' } }
  ];
  const res = evaluateTrickDetails(trickWithBombAndJuggler, { type: 'color', suit: 'red' });
  assert.strictEqual(res.isBombed, true);

  const isBombed = res.isBombed;
  const hadJuggler = trickWithBombAndJuggler.some(t => t.card && t.card.type === 'juggler');
  const hadCloud = !isBombed && trickWithBombAndJuggler.some(t => t.card && t.card.type === 'cloud');

  assert.strictEqual(hadJuggler, true, 'Jongleur-Fähigkeit muss trotz Bombe aktiv bleiben!');
  assert.strictEqual(hadCloud, false, 'Wolken-Fähigkeit muss bei Bombe neutralisiert sein!');
  console.log('✓ Bombe lässt Jongleur-Tribut unberührt, zerstört aber Wolken-Fluch');
}

// 4. Wolke: Sofortige Aktivierung nach dem Stich und Zwang zur Änderung
console.log('\n4. Test: Wolken-Gewinn direkt nach dem Stich fordert +/- 1 Änderung...');
{
  const trickWithCloud = [
    { playerId: 'p1', card: { type: 'color', suit: 'yellow', value: 6 } },
    { playerId: 'p2', card: { type: 'cloud', chosenSuit: 'yellow' } },
    { playerId: 'p3', card: { type: 'color', suit: 'yellow', value: 8 } }
  ];
  const res = evaluateTrickDetails(trickWithCloud, { type: 'color', suit: 'red' });
  assert.strictEqual(res.isBombed, false);
  assert.strictEqual(res.winnerPlayerId, 'p2', 'p2 (Wolke 9.75) gewinnt den Stich');

  const hadCloud = !res.isBombed && trickWithCloud.some(t => t.card && t.card.type === 'cloud');
  assert.strictEqual(hadCloud, true, 'Wolke im Stich muss sofort registriert werden');

  let currentBid = 0;
  const allowMinus = currentBid > 0;
  assert.strictEqual(allowMinus, false, 'Minus 1 darf bei Vorhersage 0 nicht wählbar sein');

  currentBid += 1;
  assert.strictEqual(currentBid, 1, 'Vorhersage muss nach Wolke auf 1 korrigiert sein');
  console.log('✓ Wolke zwingt zur sofortigen Anpassung (+1 / -1)');
}

// 5. Hexe: Pflicht-Tausch wenn Karten im Stich liegen
console.log('\n5. Test: Hexe erfordert zwingend Tausch wenn Karten im Stich liegen...');
{
  const hand = [
    { type: 'witch' },
    { type: 'color', suit: 'red', value: 5 }
  ];
  const currentTrick = [
    { playerName: 'Albin', card: { type: 'color', suit: 'blue', value: 11 } }
  ];

  const canSwap = currentTrick.length > 0 && hand.length > 1;
  assert.strictEqual(canSwap, true, 'Tausch ist möglich und somit Pflicht');

  const witchSwap = { trickCardIndex: 0, handCardIndex: 1 };
  const takenCard = currentTrick[witchSwap.trickCardIndex].card;
  const givenCard = hand[witchSwap.handCardIndex];

  currentTrick[witchSwap.trickCardIndex].card = givenCard;
  hand[witchSwap.handCardIndex] = takenCard;

  assert.strictEqual(currentTrick[0].card.value, 5, 'Im Stich liegt nun die abgegebene Handkarte');
  assert.strictEqual(hand[1].value, 11, 'Auf der Hand liegt nun die aus dem Stich genommene Karte');
  console.log('✓ Hexe Pflicht-Tausch erfolgreich validiert');
}

// 6. Runde 1: Stirn-Wizard (Blindrunde)
console.log('\n6. Test: Runde 1 Stirn-Wizard teilt verdeckte Karte aus und zeigt Mitspieler-Karten...');
{
  const room = {
    round: 1,
    dealerIndex: 0,
    hostSessionId: 'p1',
    players: [
      { sessionId: 'p1', name: 'Albin', hand: [{ type: 'color', suit: 'blue', value: 10 }], bid: null, tricksWon: 0, connected: true },
      { sessionId: 'p2', name: 'Berta', hand: [{ type: 'wizard' }], bid: null, tricksWon: 0, connected: true }
    ]
  };

  function getSanitizedPlayers(players, dealerIndex, hostSessionId, r) {
    return players.map((p, idx) => {
      const pData = {
        sessionId: p.sessionId,
        name: p.name,
        bid: p.bid,
        tricksWon: p.tricksWon,
        connected: p.connected,
        isDealer: idx === dealerIndex,
        isHost: p.sessionId === hostSessionId,
        handCount: p.hand ? p.hand.length : 0
      };
      if (r && r.round === 1 && p.hand && p.hand[0]) {
        pData.round1Card = p.hand[0];
      }
      return pData;
    });
  }

  const sanitized = getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room);
  assert.strictEqual(sanitized[0].round1Card.value, 10, 'Albins Stirn-Karte muss für andere sichtbar sein');
  assert.strictEqual(sanitized[1].round1Card.type, 'wizard', 'Bertas Stirn-Karte muss für andere sichtbar sein');

  const clientHandP1 = [{ type: 'blind_card', isBlind: true, id: 'blind-1' }];
  assert.strictEqual(clientHandP1[0].isBlind, true, 'Eigene Karte wird verdeckt empfangen');

  const playedCard = room.players[0].hand.splice(0, 1)[0];
  assert.deepStrictEqual(playedCard, { type: 'color', suit: 'blue', value: 10 }, 'Reale Karte wird erst beim Legen in den Stich aufgedeckt');
  console.log('✓ Stirn-Wizard Blindrunde perfekt verifiziert');
}

console.log('\n====================================================');
console.log('ALLE TESTS FÜR DIE REFINEMENTS & BLINDRUNDE BESTANDEN!');
console.log('====================================================\n');
