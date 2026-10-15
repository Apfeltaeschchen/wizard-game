const assert = require('assert');
const { createBotPlayer, calculateBotBid, chooseBotCard } = require('../server/botLogic');

console.log('--- TESTE WIZARD BOT LOGIK & HEURISTIKEN ---');

// 1. Bot Erstellung
const bot1 = createBotPlayer([]);
assert.strictEqual(bot1.isBot, true, 'isBot muss true sein');
assert.ok(bot1.name.includes('(KI)'), 'Name muss (KI) enthalten');

const bot2 = createBotPlayer([bot1]);
assert.notStrictEqual(bot1.name, bot2.name, 'Zweiter Bot muss anderen Namen haben');
console.log('✓ 1. Bot-Spieler Erstellung erfolgreich');

// 2. Biet-Heuristik
// Hand mit 1 Zauberer, 1 Narr, 1 niedriger Trumpf
const hand1 = [
  { type: 'wizard', suit: 'none', value: 14 },
  { type: 'jester', suit: 'none', value: 0 },
  { type: 'color', suit: 'red', value: 3 }
];
const trumpCard = { type: 'color', suit: 'red', value: 7 };

const bid1 = calculateBotBid(hand1, trumpCard, 'red', [0], false, 3);
assert.strictEqual(bid1, 1, 'Bot mit 1 Zauberer und 1 Narr sollte 1 bieten');

// Geber-Regel (Plus/Minus Eins): Bei 3 Karten und vorherigen Geboten von 2 darf der Geber nicht 1 bieten (2 + 1 = 3 verboten)
const bidDealer = calculateBotBid(hand1, trumpCard, 'red', [2], true, 3);
assert.notStrictEqual(bidDealer, 1, 'Geber-Regel darf verbotenes Gebot von 1 nicht zulassen');
console.log('✓ 2. Bot-Bietheuristik & Geber-Regel erfolgreich');

// 3. Kartenauswahl
// Stich: Spieler 1 hat Rot 10 gelegt. Bot hat Rot 5 und Rot 12.
// Fall A: Bot will Stich gewinnen (bid: 1, won: 0)
const handA = [
  { type: 'color', suit: 'red', value: 5 },
  { type: 'color', suit: 'red', value: 12 },
  { type: 'color', suit: 'blue', value: 2 }
];
const trickA = [{ playerId: 'p1', card: { type: 'color', suit: 'red', value: 10 } }];
const choiceA = chooseBotCard(handA, trickA, { type: 'color', suit: 'green', value: 5 }, 1, 0, 3);
assert.strictEqual(choiceA.cardIndex, 1, 'Bot sollte Rot 12 spielen um Rot 10 zu überstechen');

// Fall B: Bot will Stich abtreten (bid: 0, won: 0)
const choiceB = chooseBotCard(handA, trickA, { type: 'color', suit: 'green', value: 5 }, 0, 0, 3);
assert.strictEqual(choiceB.cardIndex, 0, 'Bot sollte Rot 5 unterlegen um den Stich nicht zu machen');
console.log('✓ 3. Taktische Stichführung erfolgreich');

console.log('\n=======================================');
console.log('ALLE BOT-LOGIK TESTS ERFOLGREICH!');
console.log('=======================================\n');
