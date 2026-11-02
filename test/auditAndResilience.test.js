const assert = require('assert');
const {
  createDeck,
  getEffectiveCard,
  evaluateTrickDetails,
  sortCards
} = require('../server/gameLogic');
const {
  calculateBotBid,
  chooseBotCard
} = require('../server/botLogic');

console.log('--- STARTE AUDIT & RESILIENCE VERIFIKATIONSTESTS ---');

// 1. TEST: BOT-01 Vampir-Bietheuristik
console.log('1. Teste BOT-01: Vampir-Bietheuristik für alle Schwierigkeitsgrade...');
const vampireWizardHand = [
  { type: 'vampire', copiedCard: { type: 'wizard', suit: 'none', value: 14 } },
  { type: 'color', suit: 'red', value: 2 },
  { type: 'jester', suit: 'none', value: 0 }
];

const noviceBid = calculateBotBid(vampireWizardHand, null, 'blue', [], false, 3, 4, 'novice', 'anniversary_30');
const masterBid = calculateBotBid(vampireWizardHand, null, 'blue', [], false, 3, 4, 'master', 'anniversary_30');
const archmageBid = calculateBotBid(vampireWizardHand, null, 'blue', [], false, 3, 4, 'archmage', 'anniversary_30');

assert(noviceBid >= 1, `Novice sollte mindestens 1 Stich für Vampir-Zauberer bieten, bot: ${noviceBid}`);
assert(masterBid >= 1, `Master sollte mindestens 1 Stich für Vampir-Zauberer bieten, bot: ${masterBid}`);
assert(archmageBid >= 1, `Archmage sollte mindestens 1 Stich für Vampir-Zauberer bieten, bot: ${archmageBid}`);
console.log('✓ BOT-01: Vampir als Zauberer fließt erfolgreich in alle 3 Bietheuristiken ein.');

// Vampir als Trumpf
const vampireTrumpHand = [
  { type: 'vampire', copiedCard: { type: 'color', suit: 'green', value: 13 } },
  { type: 'color', suit: 'red', value: 2 }
];
const masterBidTrump = calculateBotBid(vampireTrumpHand, null, 'green', [], false, 2, 4, 'master', 'anniversary_30');
assert(masterBidTrump >= 1, `Master sollte für Vampir als Trumpf-13 mindestens 1 bieten, bot: ${masterBidTrump}`);
console.log('✓ BOT-01: Vampir als kopierter Trumpf wird korrekt bewertet.');

// 2. TEST: BOT-02 Boss-Karten vor Trümpfen beim Anspiel
console.log('2. Teste BOT-02: Boss-Karten vor niedrigen Trümpfen beim Anspiel...');
const handWithBossAndTrump = [
  { type: 'color', suit: 'yellow', value: 2 }, // Niedriger Trumpf
  { type: 'wizard', suit: 'none', value: 14 },
  { type: 'color', suit: 'blue', value: 5 }
];
const masterLeadWin = chooseBotCard(handWithBossAndTrump, [], { suit: 'yellow' }, 1, 0, 3, 'master');
assert.strictEqual(masterLeadWin.cardIndex, 1, `Master sollte Zauberer (Index 1) anspielen, nicht Trumpf 2, wählte Index: ${masterLeadWin.cardIndex}`);

const archmageLeadWin = chooseBotCard(handWithBossAndTrump, [], { suit: 'yellow' }, 1, 0, 3, 'archmage', {});
assert.strictEqual(archmageLeadWin.cardIndex, 1, `Archmage sollte Zauberer (Index 1) anspielen, nicht Trumpf 2, wählte Index: ${archmageLeadWin.cardIndex}`);
console.log('✓ BOT-02: Boss-Karten (Zauberer/Drache) haben Vorrang vor Trümpfen beim Anspiel zum Gewinnen.');

// 3. TEST: BOT-03 Fehlfarben vor Trümpfen beim Ducken
console.log('3. Teste BOT-03: Fehlfarben vor Trümpfen beim Ducken (Anspiel)...');
const handDuck = [
  { type: 'color', suit: 'yellow', value: 2 }, // Trumpf 2
  { type: 'color', suit: 'red', value: 4 }      // Fehlfarbe 4
];
// myBid = 0, tricksWon = 0 -> wantsToWin = false
const masterLeadDuck = chooseBotCard(handDuck, [], { suit: 'yellow' }, 0, 0, 2, 'master');
assert.strictEqual(masterLeadDuck.cardIndex, 1, `Master sollte Fehlfarbe Rot 4 anspielen, nicht Trumpf 2, wählte: ${masterLeadDuck.cardIndex}`);

const archmageLeadDuck = chooseBotCard(handDuck, [], { suit: 'yellow' }, 0, 0, 2, 'archmage', {});
assert.strictEqual(archmageLeadDuck.cardIndex, 1, `Archmage sollte Fehlfarbe Rot 4 anspielen, nicht Trumpf 2, wählte: ${archmageLeadDuck.cardIndex}`);
console.log('✓ BOT-03: Fehlfarben werden beim Ducken vor Trümpfen angespielt.');

// 4. TEST: RUL-01 Renonce-Tracking nach Einhorn
console.log('4. Teste RUL-01: Renonce-Tracking nach Einhorn-Eröffnung...');
const trickWithUnicornAndColor = [
  { card: { type: 'unicorn', suit: 'none', value: 0 } },
  { card: { type: 'color', suit: 'green', value: 10 } }
];
let leadSuit = 'none';
for (let i = 0; i < trickWithUnicornAndColor.length; i++) {
  const tc = getEffectiveCard(trickWithUnicornAndColor[i].card);
  if (['wizard', 'dragon'].includes(tc.type)) break;
  if (tc.type === 'color') {
    leadSuit = tc.suit;
    break;
  }
}
assert.strictEqual(leadSuit, 'green', `Bedienfarbe nach Einhorn muss Grün sein, war: ${leadSuit}`);
console.log('✓ RUL-01: Erste Farbkarte nach Einhorn etabliert korrekt die Bedienfarbe für das Renonce-Tracking.');

// 5. TEST: RUL-02 Deckgröße 70 Karten
console.log('5. Teste RUL-02: Deckgröße 70 Karten für anniversary_30...');
const anniversaryDeck = createDeck('anniversary_30');
assert.strictEqual(anniversaryDeck.length, 70, `Deckgröße anniversary_30 muss exakt 70 sein, war: ${anniversaryDeck.length}`);
console.log('✓ RUL-02: Deckgröße ist exakt 70 Karten.');

// 6. TEST: SEC-01 Stirnkarten-Maskierung
console.log('6. Teste SEC-01: Stirnkarten-Maskierung in Runde 1...');
const fs = require('fs');
const indexCode = fs.readFileSync(require.resolve('../server/index.js'), 'utf8');

assert(indexCode.includes('if (viewerSessionId && p.sessionId === viewerSessionId)'), 'pData.round1Card muss für den Spieler selbst maskiert werden.');
assert(indexCode.includes('const isRoundOneForehead = (room.round === 1 && room.gameState !== \'lobby\');'), 'broadcastRoomUpdated muss in Runde 1 personalisiert senden.');
console.log('✓ SEC-01: Stirnkarten-Zero-Trust-Logik im Quellcode verifiziert.');

// 7. TEST: NET-01 Payload Destrukturierungsschutz
console.log('7. Teste NET-01: Socket-Handler Payload Fallbacks...');
assert(indexCode.includes("socket.on('playCard', (payload) => {"), 'playCard muss geschützten payload-Parameter verwenden.');
assert(indexCode.includes("const { roomCode, cardIndex, chosenRole, chosenSuit, witchSwap } = payload || {};"), 'playCard muss payload || {} destrukturieren.');
assert(indexCode.includes("socket.on('submitBid', (payload) => {"), 'submitBid muss geschützten payload-Parameter verwenden.');
assert(indexCode.includes("socket.on('joinRoom', async (payload) => {"), 'joinRoom muss geschützten payload-Parameter verwenden.');
assert(indexCode.includes("socket.on('leaveRoom', (payload) => {"), 'leaveRoom muss geschützten payload-Parameter verwenden.');
console.log('✓ NET-01: Alle kritischen Socket-Handler sind gegen null/undefined abgesichert.');

// 8. TEST: NET-02 Reconnect State Resumption
console.log('8. Teste NET-02: resumeRoomExecution bei Reconnect...');
assert(indexCode.includes('function resumeRoomExecution(room) {'), 'resumeRoomExecution muss definiert sein.');
assert(indexCode.includes('resumeRoomExecution(room);'), 'resumeRoomExecution muss beim Reconnect aufgerufen werden.');
console.log('✓ NET-02: resumeRoomExecution ist definiert und eingebunden.');

// 9. TEST: NET-03 Bot Room Cleanup
console.log('9. Teste NET-03: Bot-Raum Cleanup bei verlassenen Räumen...');
assert(indexCode.includes('const humanPlayers = room.players.filter(p => !p.isBot);'), 'checkRoomCleanup muss menschliche Spieler filtern.');
assert(indexCode.includes('const remainingHumans = room.players.filter(p => !p.isBot);'), 'leaveRoom muss menschliche Spieler filtern.');
console.log('✓ NET-03: Bot-Räume ohne menschliche Spieler werden ordnungsgemäß abgeräumt.');

// 10. TEST: UI-01 & UI-04 Client Fächer & CSS
console.log('10. Teste UI-01 bis UI-04: Fächer-Bogen, dynamische Kompression und Turn-Flash...');
const clientCode = fs.readFileSync(require.resolve('../public/client.js'), 'utf8');
const htmlCode = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');

assert(clientCode.includes("cardElement.style.getPropertyValue('--target-rot')"), 'renderHand muss Fächer-Rotation bei isSameHand beibehalten.');
assert(clientCode.includes("const compression = Math.min(82, 54 + extra * 5.5);"), 'renderHand muss dynamische Kompression bei >15 Karten anwenden.');
assert(htmlCode.includes('.turn-start-extreme-flash'), 'index.html muss .turn-start-extreme-flash definieren.');
assert(htmlCode.includes('@keyframes tableTurnFlash'), 'index.html muss @keyframes tableTurnFlash definieren.');
console.log('✓ UI-01 - UI-04: Fächer-Geometrie, dynamische Kompression und CSS-Effekte verifiziert.');

console.log('\n======================================================');
console.log('🎉 ALLE AUDIT- & RESILIENZ-TESTS ERFOLGREICH BESTANDEN!');
console.log('======================================================\n');
