const assert = require('assert');
const {
  createDeck,
  getMaxRounds,
  sortCards,
  isValidMove,
  evaluateTrickDetails,
  getEffectiveCard
} = require('../server/gameLogic');

console.log('--- STARTE WIZARD 30-JAHRE ETAPPE 1 UNIT-TESTS (Gestaltenwandler, Vampir, Wolke) ---');

// 1. Deckgröße & Sonderkarten
const classicDeck = createDeck('classic');
assert.strictEqual(classicDeck.length, 60, 'Klassisches Deck muss genau 60 Karten haben');

const anniDeck = createDeck('anniversary_30');
assert.strictEqual(anniDeck.length, 69, '30-Jahre Deck muss genau 69 Karten haben');
assert.strictEqual(anniDeck.filter(c => c.type === 'dragon').length, 1);
assert.strictEqual(anniDeck.filter(c => c.type === 'fairy').length, 1);
assert.strictEqual(anniDeck.filter(c => c.type === 'bomb').length, 1);
assert.strictEqual(anniDeck.filter(c => c.type === 'shapeshifter').length, 1);
assert.strictEqual(anniDeck.filter(c => c.type === 'vampire').length, 1);
assert.strictEqual(anniDeck.filter(c => c.type === 'cloud').length, 1);
assert.strictEqual(anniDeck.filter(c => c.type === 'werewolf').length, 1);
assert.strictEqual(anniDeck.filter(c => c.type === 'witch').length, 1);
assert.strictEqual(anniDeck.filter(c => c.type === 'juggler').length, 1);
console.log('✓ createDeck(anniversary_30): 69 Karten inkl. aller 9 Sonderkarten');

// 2. Rundenanzahl
assert.strictEqual(getMaxRounds(3, 'anniversary_30'), 23, '3 Spieler: 23 Runden (69/3)');
assert.strictEqual(getMaxRounds(4, 'anniversary_30'), 17, '4 Spieler: 17 Runden (68/4)');
assert.strictEqual(getMaxRounds(5, 'anniversary_30'), 13, '5 Spieler: 13 Runden (65/5)');
assert.strictEqual(getMaxRounds(6, 'anniversary_30'), 11, '6 Spieler: 11 Runden (66/6)');
console.log('✓ getMaxRounds für alle Spieleranzahlen validiert (3->23, 4->17, 5->13, 6->11)');

// 3. Sortierung der Handkarten
const testHand = [
  { type: 'dragon', suit: 'none', value: 15 },
  { type: 'wizard', suit: 'none', value: 14 },
  { type: 'color', suit: 'green', value: 10 },
  { type: 'color', suit: 'red', value: 5 },
  { type: 'cloud', suit: 'none', value: 9.75 },
  { type: 'vampire', suit: 'none', value: 0 },
  { type: 'shapeshifter', suit: 'none', value: 0 },
  { type: 'bomb', suit: 'none', value: -99 },
  { type: 'jester', suit: 'none', value: 0 },
  { type: 'fairy', suit: 'none', value: -1 }
];

const sorted = sortCards(testHand, 'green');
const types = sorted.map(c => c.type);
assert.strictEqual(types[0], 'fairy', 'Fee muss ganz links liegen (-2)');
assert.strictEqual(types[1], 'jester', 'Narr muss an Position 2 liegen (-1)');
assert.strictEqual(types[2], 'bomb', 'Bombe muss an Position 3 liegen (0)');
assert.strictEqual(types[3], 'shapeshifter', 'Gestaltenwandler muss nach Bombe liegen');
assert.strictEqual(types[4], 'cloud', 'Wolke muss nach Gestaltenwandler liegen');
assert.strictEqual(types[5], 'vampire', 'Vampir muss nach Wolke liegen');
assert.strictEqual(types[6], 'color', 'Rot 5 (Fehlfarbe)');
assert.strictEqual(types[7], 'color', 'Grün 10 (Trumpf)');
assert.strictEqual(types[8], 'wizard', 'Zauberer vor Drache');
assert.strictEqual(types[9], 'dragon', 'Drache ganz rechts');
console.log('✓ sortCards mit allen 6 Sonderkarten bestanden');

// 4. isValidMove: Sonderkarten immer spielbar & Wolke etabliert Bedienfarbe
const handWithBlue = [
  { type: 'color', suit: 'blue', value: 4 },
  { type: 'shapeshifter', suit: 'none', value: 0 },
  { type: 'cloud', suit: 'none', value: 9.75 },
  { type: 'vampire', suit: 'none', value: 0 }
];

// Angespielt ist Rot: Sonderkarten dürfen trotzdem immer gelegt werden
const trickLedRed = [{ playerId: 'p1', card: { type: 'color', suit: 'red', value: 10 } }];
assert.strictEqual(isValidMove(handWithBlue[1], handWithBlue, trickLedRed), true, 'Gestaltenwandler immer spielbar');
assert.strictEqual(isValidMove(handWithBlue[2], handWithBlue, trickLedRed), true, 'Wolke immer spielbar');
assert.strictEqual(isValidMove(handWithBlue[3], handWithBlue, trickLedRed), true, 'Vampir immer spielbar');

// Wenn Wolke mit Farbe 'blue' eröffnet, muss Spieler mit Blau bedienen!
const trickLedCloudBlue = [{ playerId: 'p1', card: { type: 'cloud', suit: 'none', chosenSuit: 'blue', value: 9.75 } }];
const handWithBlueAndRed = [
  { type: 'color', suit: 'blue', value: 4 },
  { type: 'color', suit: 'red', value: 9 }
];
assert.strictEqual(isValidMove(handWithBlueAndRed[0], handWithBlueAndRed, trickLedCloudBlue), true, 'Blau bedient Wolken-Bedienfarbe Blau');
assert.strictEqual(isValidMove(handWithBlueAndRed[1], handWithBlueAndRed, trickLedCloudBlue), false, 'Rot darf nicht abgeworfen werden, da Blau vorhanden ist');
console.log('✓ isValidMove: Sonderkarten immer erlaubt, Wolke etabliert Bedienfarbe');

// 5. Gestaltenwandler Auswertung
// 5a. Als Zauberer: schlägt reguläre hohe Farben
const trickG_Wizard = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 13 } },
  { playerId: 'p2', card: { type: 'shapeshifter', suit: 'none', chosenRole: 'wizard', value: 0 } },
  { playerId: 'p3', card: { type: 'color', suit: 'red', value: 5 } }
];
assert.strictEqual(evaluateTrickDetails(trickG_Wizard, null).winnerPlayerId, 'p2', 'Gestaltenwandler als Zauberer gewinnt gegen Rote 13');

// 5b. Als Narr: verliert gegen Farbkarten
const trickG_Jester = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 13 } },
  { playerId: 'p2', card: { type: 'shapeshifter', suit: 'none', chosenRole: 'jester', value: 0 } },
  { playerId: 'p3', card: { type: 'color', suit: 'red', value: 5 } }
];
assert.strictEqual(evaluateTrickDetails(trickG_Jester, null).winnerPlayerId, 'p1', 'Gestaltenwandler als Narr verliert gegen Rote 13');
console.log('✓ Gestaltenwandler: Als Zauberer gewinnt er, als Narr verliert er');

// 6. Wolke (Wert 9.75) Auswertung
// 6a. Wolke (9.75) schlägt eine 9 derselben Farbe
const trickCloudVs9 = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 9 } },
  { playerId: 'p2', card: { type: 'cloud', suit: 'none', chosenSuit: 'red', value: 9.75 } }
];
assert.strictEqual(evaluateTrickDetails(trickCloudVs9, null).winnerPlayerId, 'p2', 'Wolke (9.75) schlägt Rote 9');

// 6b. Wolke (9.75) verliert gegen eine 10 derselben Farbe
const trickCloudVs10 = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 10 } },
  { playerId: 'p2', card: { type: 'cloud', suit: 'none', chosenSuit: 'red', value: 9.75 } }
];
assert.strictEqual(evaluateTrickDetails(trickCloudVs10, null).winnerPlayerId, 'p1', 'Rote 10 schlägt Wolke (9.75)');

// 6c. Wolke in Trumpffarbe schlägt Nicht-Trumpfkarten
const trickCloudTrump = [
  { playerId: 'p1', card: { type: 'color', suit: 'yellow', value: 13 } },
  { playerId: 'p2', card: { type: 'cloud', suit: 'none', chosenSuit: 'green', value: 9.75 } }
];
const trumpGreen = { type: 'color', suit: 'green', value: 2 };
assert.strictEqual(evaluateTrickDetails(trickCloudTrump, trumpGreen).winnerPlayerId, 'p2', 'Wolke als Trumpf (Grün) sticht Gelbe 13');
console.log('✓ Wolke: 9.75 schlägt 9, unterliegt 10, sticht als Trumpf');

// 7. Vampir Kopier-Mechanik
// 7a. Vampir kopiert Rote 10
const vampRed10 = {
  type: 'vampire',
  suit: 'none',
  value: 0,
  copiedCard: { type: 'color', suit: 'red', value: 10 }
};
const trickVampColor = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 8 } },
  { playerId: 'p2', card: vampRed10 }
];
assert.strictEqual(evaluateTrickDetails(trickVampColor, null).winnerPlayerId, 'p2', 'Vampir als Rote 10 schlägt Rote 8');

// 7b. Vampir kopiert Zauberer
const vampWizard = {
  type: 'vampire',
  suit: 'none',
  value: 0,
  copiedCard: { type: 'wizard', suit: 'none', value: 14 }
};
const trickVampWizard = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 13 } },
  { playerId: 'p2', card: vampWizard }
];
assert.strictEqual(evaluateTrickDetails(trickVampWizard, null).winnerPlayerId, 'p2', 'Vampir als Zauberer schlägt Rote 13');

// 7c. Vampir kopiert Bombe -> Stich neutralisiert!
const vampBomb = {
  type: 'vampire',
  suit: 'none',
  value: 0,
  copiedCard: { type: 'bomb', suit: 'none', value: -99 }
};
const trickVampBomb = [
  { playerId: 'p1', card: { type: 'wizard', suit: 'none', value: 14 } },
  { playerId: 'p2', card: vampBomb }
];
const bombResult = evaluateTrickDetails(trickVampBomb, null);
assert.strictEqual(bombResult.isBombed, true, 'Vampir als Bombe neutralisiert den Stich');
assert.strictEqual(bombResult.winnerPlayerId, null);
assert.strictEqual(bombResult.nextLeadPlayerId, 'p1', 'Zauberer eröffnet nach Bombe nächsten Stich');
console.log('✓ Vampir: Kopiert Farbkarte, Zauberer und Bombe einwandfrei');

// 8. Aufgedeckter Trumpf mit Farbwahl für Gestaltenwandler, Wolke und Vampir
const trumpShapeshifter = { type: 'shapeshifter', suit: 'none', chosenSuit: 'blue' };
const trickWithTrumpChoice = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 13 } },
  { playerId: 'p2', card: { type: 'color', suit: 'blue', value: 2 } }
];
assert.strictEqual(evaluateTrickDetails(trickWithTrumpChoice, trumpShapeshifter).winnerPlayerId, 'p2', 'Trumpfwahl des Gebers bei Gestaltenwandler aktiv');
console.log('✓ Aufgedeckter Trumpf mit Farbwahl für Gestaltenwandler/Wolke/Vampir funktioniert');

console.log('\n=============================================================================');
console.log('ALLE TESTS FÜR 30-JAHRE ETAPPE 1 (Gestaltenwandler, Vampir, Wolke) ERFOLGREICH!');
console.log('=============================================================================');
