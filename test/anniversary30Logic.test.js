const assert = require('assert');
const {
  createDeck,
  evaluateTrick,
  evaluateTrickDetails,
  isValidMove,
  getMaxRounds,
  sortCards
} = require('../server/gameLogic');

console.log('--- STARTE WIZARD 30-JAHRE-JUBILÄUMSEDITION UNIT-TESTS ---');

// 1. Deck-Generierung & Editionen
const classicDeck = createDeck('classic');
assert.strictEqual(classicDeck.length, 60, 'Classic Deck muss 60 Karten enthalten');
assert.strictEqual(classicDeck.filter(c => c.type === 'dragon').length, 0);
assert.strictEqual(classicDeck.filter(c => c.type === 'fairy').length, 0);
assert.strictEqual(classicDeck.filter(c => c.type === 'bomb').length, 0);
console.log('✓ createDeck(classic): 60 Karten ohne Sonderkarten');

const annivDeck = createDeck('anniversary_30');
assert.strictEqual(annivDeck.length, 66, '30-Jahre-Deck muss 66 Karten enthalten (60 + 6 Sonderkarten)');
assert.strictEqual(annivDeck.filter(c => c.type === 'dragon').length, 1, 'Muss genau 1 Drachen enthalten');
assert.strictEqual(annivDeck.filter(c => c.type === 'fairy').length, 1, 'Muss genau 1 Fee enthalten');
assert.strictEqual(annivDeck.filter(c => c.type === 'bomb').length, 1, 'Muss genau 1 Bombe enthalten');
assert.strictEqual(annivDeck.filter(c => c.type === 'shapeshifter').length, 1, 'Muss genau 1 Gestaltenwandler enthalten');
assert.strictEqual(annivDeck.filter(c => c.type === 'vampire').length, 1, 'Muss genau 1 Vampir enthalten');
assert.strictEqual(annivDeck.filter(c => c.type === 'cloud').length, 1, 'Muss genau 1 Wolke enthalten');
assert.strictEqual(annivDeck.filter(c => c.type === 'wizard').length, 4, 'Muss weiterhin 4 Zauberer enthalten');
assert.strictEqual(annivDeck.filter(c => c.type === 'jester').length, 4, 'Muss weiterhin 4 Narren enthalten');
console.log('✓ createDeck(anniversary_30): 66 Karten inkl. aller 6 Sonderkarten');

// 2. Rundenberechnung (getMaxRounds)
assert.strictEqual(getMaxRounds(3, 'classic'), 20);
assert.strictEqual(getMaxRounds(4, 'classic'), 15);
assert.strictEqual(getMaxRounds(5, 'classic'), 12);
assert.strictEqual(getMaxRounds(6, 'classic'), 10);

assert.strictEqual(getMaxRounds(3, 'anniversary_30'), 22, '3 Spieler haben 22 Runden (66 / 3)');
assert.strictEqual(getMaxRounds(4, 'anniversary_30'), 16, '4 Spieler haben 16 Runden (66 / 4 = 16)');
assert.strictEqual(getMaxRounds(5, 'anniversary_30'), 13, '5 Spieler haben 13 Runden (66 / 5 = 13)');
assert.strictEqual(getMaxRounds(6, 'anniversary_30'), 11, '6 Spieler haben 11 Runden (66 / 6 = 11)');
console.log('✓ getMaxRounds für alle Spieleranzahlen validiert');

// 3. Handkarten-Sortierung
const unsortedHand = [
  { type: 'wizard', suit: 'none', value: 14 },
  { type: 'color', suit: 'red', value: 10 },
  { type: 'dragon', suit: 'none', value: 15 },
  { type: 'color', suit: 'green', value: 4 }, // Trumpf
  { type: 'jester', suit: 'none', value: 0 },
  { type: 'bomb', suit: 'none', value: -99 },
  { type: 'fairy', suit: 'none', value: -1 },
  { type: 'color', suit: 'yellow', value: 7 }
];

const sortedHand = sortCards(unsortedHand, 'green');
assert.strictEqual(sortedHand[0].type, 'fairy', 'Fee muss ganz links liegen (Pos 0)');
assert.strictEqual(sortedHand[1].type, 'jester', 'Narr muss an Pos 1 liegen');
assert.strictEqual(sortedHand[2].type, 'bomb', 'Bombe muss an Pos 2 liegen');
assert.strictEqual(sortedHand[3].suit, 'yellow', 'Gelb an Pos 3');
assert.strictEqual(sortedHand[4].suit, 'red', 'Rot an Pos 4');
assert.strictEqual(sortedHand[5].suit, 'green', 'Trumpf Grün an Pos 5');
assert.strictEqual(sortedHand[6].type, 'wizard', 'Zauberer an Pos 6');
assert.strictEqual(sortedHand[7].type, 'dragon', 'Drache muss ganz rechts liegen (Pos 7)');
console.log('✓ sortCards mit Drache, Fee, Bombe und Trumpf bestanden');

// 4. isValidMove
const myHand = [
  { type: 'color', suit: 'red', value: 3 },
  { type: 'dragon', suit: 'none', value: 15 },
  { type: 'fairy', suit: 'none', value: -1 },
  { type: 'bomb', suit: 'none', value: -99 },
  { type: 'color', suit: 'blue', value: 9 }
];

const redLeadTrick = [{ playerId: 'p1', card: { type: 'color', suit: 'red', value: 10 } }];
assert.strictEqual(isValidMove(myHand[1], myHand, redLeadTrick), true, 'Drache darf immer gelegt werden');
assert.strictEqual(isValidMove(myHand[2], myHand, redLeadTrick), true, 'Fee darf immer gelegt werden');
assert.strictEqual(isValidMove(myHand[3], myHand, redLeadTrick), true, 'Bombe darf immer gelegt werden');
assert.strictEqual(isValidMove(myHand[4], myHand, redLeadTrick), false, 'Blau darf nicht gelegt werden, wenn Rot auf Hand');

// Wenn Drache eröffnet -> keine Bedienpflicht
const dragonLeadTrick = [{ playerId: 'p1', card: { type: 'dragon', suit: 'none', value: 15 } }];
assert.strictEqual(isValidMove(myHand[4], myHand, dragonLeadTrick), true, 'Jede Karte erlaubt nach Drachen-Eröffnung');
console.log('✓ isValidMove für Sonderkarten bestanden');

// 5. STICH-EVALUATION (VORRANG-MATRIX)

// Test Fall 1: Drache + Zauberer (ohne Fee) -> Drache gewinnt!
const trickDragonWizard = [
  { playerId: 'p1', card: { type: 'wizard', suit: 'none', value: 14 } },
  { playerId: 'p2', card: { type: 'color', suit: 'red', value: 13 } },
  { playerId: 'p3', card: { type: 'dragon', suit: 'none', value: 15 } }
];
assert.strictEqual(evaluateTrick(trickDragonWizard, null), 'p3', 'Drache schlägt Zauberer');
console.log('✓ Fall 1: Drache schlägt Zauberer');

// Test Fall 2: Zauberer + Fee (ohne Drache) -> Zauberer gewinnt!
const trickWizardFairy = [
  { playerId: 'p1', card: { type: 'fairy', suit: 'none', value: -1 } },
  { playerId: 'p2', card: { type: 'color', suit: 'red', value: 13 } },
  { playerId: 'p3', card: { type: 'wizard', suit: 'none', value: 14 } }
];
assert.strictEqual(evaluateTrick(trickWizardFairy, null), 'p3', 'Zauberer schlägt Fee');
console.log('✓ Fall 2: Zauberer schlägt Fee (ohne Drache)');

// Test Fall 3: Drache + Fee (ohne Zauberer) -> Fee gewinnt immer!
const trickDragonFairy = [
  { playerId: 'p1', card: { type: 'dragon', suit: 'none', value: 15 } },
  { playerId: 'p2', card: { type: 'color', suit: 'green', value: 13 } },
  { playerId: 'p3', card: { type: 'fairy', suit: 'none', value: -1 } }
];
assert.strictEqual(evaluateTrick(trickDragonFairy, { type: 'color', suit: 'green', value: 1 }), 'p3', 'Fee schlägt Drachen');
console.log('✓ Fall 3: Fee schlägt Drache');

// Test Fall 4: Drache + Zauberer + Fee (alle drei im Stich) -> FEE GEWINNT IMMER!
const trickAllThree = [
  { playerId: 'p1', card: { type: 'wizard', suit: 'none', value: 14 } },
  { playerId: 'p2', card: { type: 'dragon', suit: 'none', value: 15 } },
  { playerId: 'p3', card: { type: 'fairy', suit: 'none', value: -1 } }
];
assert.strictEqual(evaluateTrick(trickAllThree, null), 'p3', 'Fee gewinnt bei Drache + Zauberer + Fee');
console.log('✓ Fall 4: Fee gewinnt bei allen drei (Drache + Zauberer + Fee)');

// Test Fall 5: Bombe im Stich -> neutralisiert!
const trickWithBomb = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 8 } },
  { playerId: 'p2', card: { type: 'wizard', suit: 'none', value: 14 } },
  { playerId: 'p3', card: { type: 'bomb', suit: 'none', value: -99 } },
  { playerId: 'p4', card: { type: 'color', suit: 'red', value: 12 } }
];
const bombResult = evaluateTrickDetails(trickWithBomb, null);
assert.strictEqual(bombResult.isBombed, true, 'isBombed muss true sein');
assert.strictEqual(bombResult.winnerPlayerId, null, 'winnerPlayerId muss null sein');
assert.strictEqual(bombResult.nextLeadPlayerId, 'p2', 'Zauberer (p2) war höchste Karte und eröffnet nächsten Stich');
assert.strictEqual(evaluateTrick(trickWithBomb, null), null, 'evaluateTrick Rückgabe muss null sein');
console.log('✓ Fall 5: Bombe neutralisiert Stich und Zauberer eröffnet nächsten Stich');

// Test Fall 5b: Bombe mit Drache und Fee
const trickBombDragonFairy = [
  { playerId: 'p1', card: { type: 'dragon', suit: 'none', value: 15 } },
  { playerId: 'p2', card: { type: 'fairy', suit: 'none', value: -1 } },
  { playerId: 'p3', card: { type: 'bomb', suit: 'none', value: -99 } }
];
const bombDragonFairyRes = evaluateTrickDetails(trickBombDragonFairy, null);
assert.strictEqual(bombDragonFairyRes.isBombed, true);
assert.strictEqual(bombDragonFairyRes.winnerPlayerId, null);
assert.strictEqual(bombDragonFairyRes.nextLeadPlayerId, 'p2', 'Fee schlägt Drache und eröffnet daher nächsten Stich');
console.log('✓ Fall 5b: Bombe mit Drache und Fee: Fee eröffnet nächsten Stich');

// Test Fall 6: Drache als Trumpf aufgedeckt -> Geber darf wählen (chosenSuit)
const dragonTrumpChosen = { type: 'dragon', suit: 'none', value: 15, chosenSuit: 'blue' };
const trickWithTrumpChosen = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 13 } },
  { playerId: 'p2', card: { type: 'color', suit: 'blue', value: 2 } }
];
assert.strictEqual(evaluateTrick(trickWithTrumpChosen, dragonTrumpChosen), 'p2', 'Gewählte Trumpffarbe Blau sticht Rot');
console.log('✓ Fall 6: Drache als aufgedeckter Trumpf ermöglicht Farbwahl');

// Test Fall 7: Fee oder Bombe als aufgedeckter Trumpf -> kein Trumpf
const fairyTrump = { type: 'fairy', suit: 'none', value: -1 };
const trickFairyTrump = [
  { playerId: 'p1', card: { type: 'color', suit: 'red', value: 13 } },
  { playerId: 'p2', card: { type: 'color', suit: 'blue', value: 2 } }
];
assert.strictEqual(evaluateTrick(trickFairyTrump, fairyTrump), 'p1', 'Bedienfarbe Rot gewinnt, kein Trumpf');
console.log('✓ Fall 7: Fee als aufgedeckter Trumpf -> kein Trumpf');

console.log('\n========================================================');
console.log('ALLE TESTS FÜR DIE 30-JAHRE-JUBILÄUMSEDITION ERFOLGREICH!');
console.log('========================================================');
