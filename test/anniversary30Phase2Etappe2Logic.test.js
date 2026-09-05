const assert = require('assert');
const {
  createDeck,
  getMaxRounds,
  sortCards,
  getEffectiveCard,
  isValidMove,
  evaluateTrick
} = require('../server/gameLogic');

console.log('====================================================');
console.log('TEST: 30 JAHRE JUBILÄUMSEDITION - ETAPPE 2 LOGIK');
console.log('      (Werwolf, Hexe, Jongleur & 69-Karten-Deck)');
console.log('====================================================\n');

// 1. Deck-Zusammensetzung (69 Karten)
const deck = createDeck('anniversary_30');
assert.strictEqual(deck.length, 69, '30-Jahre-Deck muss genau 69 Karten enthalten');
assert.strictEqual(deck.filter(c => c.type === 'dragon').length, 1, '1 Drache');
assert.strictEqual(deck.filter(c => c.type === 'fairy').length, 1, '1 Fee');
assert.strictEqual(deck.filter(c => c.type === 'bomb').length, 1, '1 Bombe');
assert.strictEqual(deck.filter(c => c.type === 'shapeshifter').length, 1, '1 Gestaltenwandler');
assert.strictEqual(deck.filter(c => c.type === 'vampire').length, 1, '1 Vampir');
assert.strictEqual(deck.filter(c => c.type === 'cloud').length, 1, '1 Wolke');
assert.strictEqual(deck.filter(c => c.type === 'werewolf').length, 1, '1 Werwolf');
assert.strictEqual(deck.filter(c => c.type === 'witch').length, 1, '1 Hexe');
assert.strictEqual(deck.filter(c => c.type === 'juggler').length, 1, '1 Jongleur');
assert.strictEqual(deck.filter(c => c.type === 'wizard').length, 4, '4 Zauberer');
assert.strictEqual(deck.filter(c => c.type === 'jester').length, 4, '4 Narren');
console.log('✓ 1. createDeck(anniversary_30): Exakt 69 Karten inkl. aller 9 Sonderkarten');

// 2. Rundenanzahlen
assert.strictEqual(getMaxRounds(3, 'anniversary_30'), 23, '3 Spieler: 23 Runden (69/3)');
assert.strictEqual(getMaxRounds(4, 'anniversary_30'), 17, '4 Spieler: 17 Runden (68/4)');
assert.strictEqual(getMaxRounds(5, 'anniversary_30'), 13, '5 Spieler: 13 Runden (65/5)');
assert.strictEqual(getMaxRounds(6, 'anniversary_30'), 11, '6 Spieler: 11 Runden (66/6)');
console.log('✓ 2. getMaxRounds für alle Spielerzahlen korrekt (23, 17, 13, 11)');

// 3. getEffectiveCard
const werewolfCard = { type: 'werewolf' };
const effWerewolf = getEffectiveCard(werewolfCard);
assert.strictEqual(effWerewolf.type, 'jester', 'Werwolf im Stich gilt als Narr');
assert.strictEqual(effWerewolf.value, 0, 'Werwolf Wert ist 0');

const witchCard = { type: 'witch' };
const effWitch = getEffectiveCard(witchCard);
assert.strictEqual(effWitch.type, 'jester', 'Hexe im Stich gilt als Narr');
assert.strictEqual(effWitch.value, 0, 'Hexe Wert ist 0');

const jugglerCard = { type: 'juggler', chosenSuit: 'blue' };
const effJuggler = getEffectiveCard(jugglerCard);
assert.strictEqual(effJuggler.type, 'color', 'Jongleur gilt als Farbkarte');
assert.strictEqual(effJuggler.suit, 'blue', 'Jongleur übernimmt die gewählte Farbe');
assert.strictEqual(effJuggler.value, 7.5, 'Jongleur hat den Wert 7.5');
console.log('✓ 3. getEffectiveCard für Werwolf, Hexe und Jongleur erfolgreich validiert');

// 4. isValidMove (Bedienpflicht & Sonderkarten)
const handWithBlueAndSpecials = [
  { type: 'color', suit: 'blue', value: 10 },
  { type: 'color', suit: 'yellow', value: 5 },
  { type: 'werewolf' },
  { type: 'witch' },
  { type: 'juggler' }
];

const trickWithBlueLead = [
  { playerIndex: 0, card: { type: 'color', suit: 'blue', value: 4 } }
];

// Sonderkarten dürfen immer gelegt werden, selbst wenn Blau auf der Hand ist
assert.strictEqual(isValidMove({ type: 'werewolf' }, handWithBlueAndSpecials, trickWithBlueLead), true);
assert.strictEqual(isValidMove({ type: 'witch' }, handWithBlueAndSpecials, trickWithBlueLead), true);
assert.strictEqual(isValidMove({ type: 'juggler' }, handWithBlueAndSpecials, trickWithBlueLead), true);

// Falsche Farbe darf nicht bedient werden, wenn Blau vorhanden ist
assert.strictEqual(isValidMove({ type: 'color', suit: 'yellow', value: 5 }, handWithBlueAndSpecials, trickWithBlueLead), false);

// Jongleur als Anspielkarte eröffnet Farb-Bedienpflicht!
const trickJugglerLead = [
  { playerIndex: 0, card: { type: 'juggler', chosenSuit: 'yellow' } }
];
assert.strictEqual(isValidMove({ type: 'color', suit: 'yellow', value: 5 }, handWithBlueAndSpecials, trickJugglerLead), true);
assert.strictEqual(isValidMove({ type: 'color', suit: 'blue', value: 10 }, handWithBlueAndSpecials, trickJugglerLead), false);
console.log('✓ 4. isValidMove: Werwolf, Hexe & Jongleur jederzeit spielbar; Jongleur eröffnet Bedienpflicht');

// 5. Handkarten-Sortierung
const unsortedHand = [
  { type: 'wizard' },
  { type: 'werewolf' },
  { type: 'witch' },
  { type: 'juggler' },
  { type: 'fairy' },
  { type: 'jester' },
  { type: 'color', suit: 'red', value: 10 }
];

const sorted = sortCards(unsortedHand, 'green');
const typesInOrder = sorted.map(c => c.type);
// Sortier-Reihenfolge: fairy (-2) < jester (-1) < werewolf (0.4) < witch (0.5) < juggler (0.6) < color < wizard (14)
assert.strictEqual(typesInOrder[0], 'fairy');
assert.strictEqual(typesInOrder[1], 'jester');
assert.strictEqual(typesInOrder[2], 'werewolf');
assert.strictEqual(typesInOrder[3], 'witch');
assert.strictEqual(typesInOrder[4], 'juggler');
assert.strictEqual(typesInOrder[typesInOrder.length - 1], 'wizard');
console.log('✓ 5. sortCards: Feine Sortier-Reihenfolge aller Sonderkarten bestätigt');

// 6. evaluateTrick mit Jongleur, Hexe & Werwolf
// Test A: Jongleur (7.5) gewinnt gegen 7 derselben Farbe, verliert aber gegen 8
const trickJugglerWins = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 7 } },
  { playerId: 'p2', card: { type: 'juggler', chosenSuit: 'red' } },
  { playerId: 'p3', card: { type: 'color', suit: 'red', value: 3 } }
];
const res1 = evaluateTrick(trickJugglerWins, null);
assert.strictEqual(res1, 'p2', 'Jongleur (7.5) muss die 7 schlagen');

const trickJugglerLoses = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 8 } },
  { playerId: 'p2', card: { type: 'juggler', chosenSuit: 'red' } },
  { playerId: 'p3', card: { type: 'color', suit: 'red', value: 7 } }
];
const res2 = evaluateTrick(trickJugglerLoses, null);
assert.strictEqual(res2, 'p1', '8 muss den Jongleur (7.5) schlagen');

// Test B: Jongleur mit Trumpffarbe schlägt Nicht-Trumpfkarten
const trickJugglerTrump = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 13 } },
  { playerId: 'p2', card: { type: 'juggler', chosenSuit: 'green' } }, // Trumpf!
  { playerId: 'p3', card: { type: 'color', suit: 'red', value: 12 } }
];
const res3 = evaluateTrick(trickJugglerTrump, { type: 'color', suit: 'green', value: 1 });
assert.strictEqual(res3, 'p2', 'Jongleur mit Trumpffarbe gewinnt gegen reguläre 13');

// Test C: Hexe & Werwolf als Narren (Wert 0)
const trickWithWitchAndWerewolf = [
  { playerId: 'p1', card: { type: 'werewolf' } },
  { playerId: 'p2', card: { type: 'witch' } },
  { playerId: 'p3', card: { type: 'color', suit: 'blue', value: 2 } }
];
const res4 = evaluateTrick(trickWithWitchAndWerewolf, null);
assert.strictEqual(res4, 'p3', 'Blaue 2 schlägt Werwolf und Hexe (die wie Narren 0 wert sind)');

console.log('✓ 6. evaluateTrick: Mathematische Stichwertung für Jongleur, Hexe und Werwolf perfekt');

console.log('\n====================================================');
console.log('ALLE ETAPPE 2 LOGIK-TESTS ERFOLGREICH BESTANDEN!');
console.log('====================================================\n');
