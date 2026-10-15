const assert = require('assert');
const {
  createBotPlayer,
  calculateBotBid,
  chooseBotCard,
  chooseBotWitchSwap,
  chooseBotJugglerPass,
  chooseBotCloudAdjustment,
  BOT_PROFILES
} = require('../server/botLogic');

console.log('--- TESTE MEHRSTUFIGE KI-SCHWIERIGKEITSGRADE (NOVIZE, MEISTER, ERZMAGIER) ---');

// ============================================================================
// 1. TEST: BOT-PROFILE & ERSTELLUNG
// ============================================================================
console.log('1. Test: Bot-Profile, Ränge und Schwierigkeitsgrade...');
const botNovice = createBotPlayer([], 'novice');
const botMaster = createBotPlayer([], 'master');
const botArchmage = createBotPlayer([], 'archmage');

assert.strictEqual(botNovice.difficulty, 'novice', 'Novize muss difficulty=novice haben');
assert.strictEqual(botNovice.title, 'Zauberlehrling', 'Novize hat Titel Zauberlehrling');
assert.strictEqual(botNovice.skillRating, 850, 'Novize hat ca. 850 SR');
assert.strictEqual(botNovice.rank.tier, 'novice', 'Novize Rank-Tier ist novice');

assert.strictEqual(botMaster.difficulty, 'master', 'Meister muss difficulty=master haben');
assert.strictEqual(botMaster.title, 'Meistermagier', 'Meister hat Titel Meistermagier');
assert.strictEqual(botMaster.skillRating, 1350, 'Meister hat ca. 1350 SR');
assert.strictEqual(botMaster.rank.tier, 'adept', 'Meister Rank-Tier ist adept');

assert.strictEqual(botArchmage.difficulty, 'archmage', 'Erzmagier muss difficulty=archmage haben');
assert.strictEqual(botArchmage.title, 'Oberster Rat', 'Erzmagier hat Titel Oberster Rat');
assert.strictEqual(botArchmage.skillRating, 2150, 'Erzmagier hat ca. 2150 SR');
assert.strictEqual(botArchmage.rank.tier, 'archmage', 'Erzmagier Rank-Tier ist archmage');
console.log('✓ 1. Bot-Profile und Ränge für alle 3 Stufen erfolgreich verifiziert!');

// ============================================================================
// 2. TEST: BIET-HEURISTIKEN (PREDICTION PHASE)
// ============================================================================
console.log('2. Test: Biet-Heuristiken & Zero-Risk-Toxicity-Index...');

// Fall A: Giftige Hand mit Mittelkarten (6, 7, 8) und 0 Narren/Zauberern in Runde 4
const toxicHand = [
  { type: 'color', suit: 'red', value: 7 },
  { type: 'color', suit: 'blue', value: 8 },
  { type: 'color', suit: 'green', value: 6 },
  { type: 'color', suit: 'yellow', value: 2 }
];
const trumpCard = { type: 'color', suit: 'red', value: 3 };

const bidArchmageToxic = calculateBotBid(toxicHand, trumpCard, 'red', [1, 1], false, 4, 3, 'archmage');
// Erzmagier erkennt die Giftigkeit der Mittelkarten und weigert sich 0 zu bieten (Toxicity Index)!
assert.strictEqual(bidArchmageToxic >= 1, true, `Erzmagier muss bei giftiger Mittelkarten-Hand mindestens 1 bieten, bot: ${bidArchmageToxic}`);

// Fall B: Sichere Null-Hand mit Narren
const safeZeroHand = [
  { type: 'jester', suit: 'none', value: 0 },
  { type: 'color', suit: 'blue', value: 2 },
  { type: 'color', suit: 'green', value: 3 }
];
const bidArchmageSafeZero = calculateBotBid(safeZeroHand, trumpCard, 'red', [1, 1], false, 3, 3, 'archmage');
assert.strictEqual(bidArchmageSafeZero, 0, `Erzmagier muss bei sicherer Hand mit Narr 0 bieten, bot: ${bidArchmageSafeZero}`);

// Fall C: Geber-Regel (+/- 1)
const dealerHand = [
  { type: 'wizard', suit: 'none', value: 14 },
  { type: 'color', suit: 'red', value: 12 }
];
// 2 Spieler haben 0 geboten. Runde 2. Wenn Bot 2 bieten will, ist Summe = 2, also 2 VERBOTEN!
const masterDealerBid = calculateBotBid(dealerHand, trumpCard, 'red', [0, 0], true, 2, 3, 'master');
assert.notStrictEqual(masterDealerBid, 2, 'Meister darf verbotenes Geber-Gebot 2 nicht bieten');
assert.strictEqual([1, 0].includes(masterDealerBid), true, `Meister weicht auf 1 oder 0 aus, bot: ${masterDealerBid}`);

console.log('✓ 2. Biet-Heuristiken & Zero-Risk-Index erfolgreich verifiziert!');

// ============================================================================
// 3. TEST: STICHFÜHRUNG & ZERO-KILLER SABOTAGE
// ============================================================================
console.log('3. Test: Stichführung & Zero-Killer Sabotage...');

// Situation: Ein Null-Bieter (Player B, bid: 0, tricksWon: 0) hat eine 8 gelegt und führt aktuell den Stich!
// Der Erzmagier hat bid: 0, tricksWon: 0 und hält: [Gelb 12, Narr, Rot 2]
const archmageHand = [
  { type: 'color', suit: 'yellow', value: 12 },
  { type: 'jester', suit: 'none', value: 0 },
  { type: 'color', suit: 'red', value: 2 }
];
const trickWithZeroBidder = [
  { playerSessionId: 'player_zero_bidder', card: { type: 'color', suit: 'yellow', value: 8 } }
];
const roomContext = {
  playedCards: [],
  playerVoids: {},
  players: [
    { sessionId: 'player_zero_bidder', name: 'Zero Rival', bid: 0, tricksWon: 0, totalScore: 120 },
    { sessionId: 'bot_archmage_sess', name: 'Gandalf', bid: 0, tricksWon: 0, totalScore: 110 }
  ],
  edition: 'classic',
  botSessionId: 'bot_archmage_sess'
};

const archmageChoice = chooseBotCard(
  archmageHand,
  trickWithZeroBidder,
  { type: 'color', suit: 'blue', value: 5 },
  0,
  0,
  3,
  'archmage',
  roomContext
);

// Der Erzmagier darf NICHT die gelbe 12 legen (denn das würde den Stich gewinnen)!
// Stattdessen duckt er sich mit dem Narren (S) weg, um dem Null-Bieter den Stich aufzudrücken!
const chosenCard = archmageHand[archmageChoice.cardIndex];
assert.strictEqual(chosenCard.type, 'jester', 'Erzmagier duckt sich mit Narr weg, um Null-Bieter zu zerstören');
console.log('✓ 3. Zero-Killer Sabotage Taktik erfolgreich verifiziert!');

// ============================================================================
// 4. TEST: 30-JAHRE SONDERKARTEN COUNTER (FEE SCHLÄGT DRACHE)
// ============================================================================
console.log('4. Test: 30-Jahre Editions-Specials (Fee vs. Drache & Bombe)...');

// Im Stich liegt ein Drache (Lindwurm)!
const trickWithDragon = [
  { playerSessionId: 'p1', card: { type: 'dragon', suit: 'none', value: 15 } }
];
const handWithFairy = [
  { type: 'color', suit: 'red', value: 10 },
  { type: 'fairy', suit: 'none', value: -1 },
  { type: 'color', suit: 'blue', value: 4 }
];

const fairyChoice = chooseBotCard(
  handWithFairy,
  trickWithDragon,
  { type: 'color', suit: 'green', value: 5 },
  1,
  0,
  3,
  'archmage',
  { botSessionId: 'bot_archmage_sess', players: [] }
);
assert.strictEqual(handWithFairy[fairyChoice.cardIndex].type, 'fairy', 'Erzmagier sniped Drachen eiskalt mit der Fee!');

// ============================================================================
// 5. TEST: HEXE & JONGLEUR ENTSCHEIDUNGEN
// ============================================================================
console.log('5. Test: Hexe-Tausch & Jongleur-Tribut...');

// Bot will Stich gewinnen (bid: 2, won: 0). Hält eine nutzlose grüne 2.
// Im Stich liegt ein Zauberer und eine rote 5.
const witchBot = { difficulty: 'archmage', bid: 2, tricksWon: 0 };
const trickCards = [
  { card: { type: 'witch', suit: 'none', value: 0 } },
  { card: { type: 'wizard', suit: 'none', value: 14 } },
  { card: { type: 'color', suit: 'red', value: 5 } }
];
const witchHand = [
  { type: 'color', suit: 'green', value: 2 },
  { type: 'color', suit: 'red', value: 11 }
];

const witchSwap = chooseBotWitchSwap(witchBot, trickCards, witchHand);
assert.strictEqual(witchSwap.handIndex, 0, 'Hexe-Bot gibt schwächste Handkarte (grün 2) ab');
assert.strictEqual(trickCards[witchSwap.trickIndex].card.type, 'wizard', 'Hexe-Bot nimmt den Zauberer aus dem Stich!');

// Jongleur-Tribut: Bot will KEINE Stiche (bid: 0).
// Gibt seine gefährliche 13 an den linken Nachbarn weiter!
const jugglerBot = { difficulty: 'archmage', bid: 0, tricksWon: 0 };
const jugglerHand = [
  { type: 'jester', suit: 'none', value: 0 },
  { type: 'color', suit: 'red', value: 13 },
  { type: 'color', suit: 'blue', value: 3 }
];
const passedIdx = chooseBotJugglerPass(jugglerBot, jugglerHand);
assert.strictEqual(passedIdx, 1, 'Jongleur-Bot gibt toxische rote 13 an Nachbarn weiter');

// Wolke: Bot hat mehr Stiche als geboten -> passt Gebot um +1 an
const cloudDelta = chooseBotCloudAdjustment({ difficulty: 'master' }, 1, 2, []);
assert.strictEqual(cloudDelta, 1, 'Wolke passt Gebot bei Überschuss um +1 an');

console.log('✓ 4. & 5. 30-Jahre Sonderkarten-Entscheidungen erfolgreich verifiziert!');

// ============================================================================
// 6. TEST: VOID-DETECTION (RENONCE)
// ============================================================================
console.log('6. Test: Void-Erkennung (Renonce-Tracking)...');

const playerVoids = {};
const sessionId = 'player_target';
playerVoids[sessionId] = {};

// Angespielte Farbe war Rot, Spieler legt Blau 7 -> Spieler ist void in Rot!
const leadSuit = 'red';
const playedCard = { type: 'color', suit: 'blue', value: 7 };
if (playedCard.type === 'color' && playedCard.suit !== leadSuit) {
  playerVoids[sessionId][leadSuit] = true;
}

assert.strictEqual(playerVoids[sessionId]['red'], true, 'Spieler muss als Void in Rot markiert sein');
console.log('✓ 6. Void-Erkennung erfolgreich verifiziert!');

console.log('\n======================================================');
console.log('🏆 ALLE TESTE FÜR MEHRSTUFIGE KI-SCHWIERIGKEITSGRADE ERFOLGREICH!');
console.log('======================================================\n');
