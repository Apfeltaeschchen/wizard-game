const { isValidMove, evaluateTrickDetails, isForbiddenBid, getEffectiveCard } = require('./gameLogic');

const BOT_NAMES = [
  'Merlin (KI)',
  'Morgana (KI)',
  'Albus (KI)',
  'Circe (KI)',
  'Gandalf (KI)',
  'Yennefer (KI)'
];

/**
 * Erstellt ein Bot-Spieler-Objekt
 */
function createBotPlayer(existingPlayers = []) {
  const existingNames = new Set(existingPlayers.map(p => p.name));
  let chosenName = BOT_NAMES.find(n => !existingNames.has(n));
  if (!chosenName) {
    chosenName = `KI-Magier ${existingPlayers.filter(p => p.isBot).length + 1}`;
  }

  const botSessionId = 'bot_' + Math.random().toString(36).substring(2, 9);

  return {
    sessionId: botSessionId,
    socketId: 'sock_' + botSessionId,
    userId: null,
    name: chosenName,
    avatarId: 'wizard_green',
    title: 'Virtueller Erzmagier',
    skillRating: 1200,
    rank: {
      tier: 'adept',
      tierKey: 'adept',
      division: 2,
      divisionName: 'Adept II',
      color: '#60a5fa',
      progressPercent: 60
    },
    isBot: true,
    connected: true,
    hand: [],
    bid: null,
    tricksWon: 0,
    totalScore: 0
  };
}

/**
 * Berechnet das Gebot für einen Bot
 */
function calculateBotBid(hand, trumpCard, trumpSuit, playerBids = [], isDealer = false, round = 1) {
  if (!hand || hand.length === 0) return 0;

  const tSuit = trumpSuit || (trumpCard && trumpCard.suit !== 'none' ? trumpCard.suit : 'none');

  let estimatedTricks = 0.0;

  hand.forEach(c => {
    // 1. Zauberer, Drache, Werwolf-Trumpf = fast garantierter Stich
    if (c.type === 'wizard' || c.type === 'dragon' || c.type === 'werewolf_trump') {
      estimatedTricks += 0.95;
      return;
    }

    // 2. Narren, Feen, Bomben = 0 Stiche
    if (c.type === 'jester' || c.type === 'fairy' || c.type === 'bomb' || c.type === 'witch') {
      return;
    }

    // 3. Gestaltenwandler: Als Zauberer einsetzbar
    if (c.type === 'shapeshifter') {
      estimatedTricks += 0.85;
      return;
    }

    // 4. Einhorn: Stark gegen Zauberer, kann Stich machen
    if (c.type === 'unicorn') {
      estimatedTricks += 0.5;
      return;
    }

    // 5. Farbkarten
    if (c.type === 'color' || c.type === 'cloud' || c.type === 'juggler') {
      const val = c.value || 0;
      const isTrump = (c.suit === tSuit && tSuit !== 'none');

      if (isTrump) {
        if (val >= 11) estimatedTricks += 0.85;
        else if (val >= 8) estimatedTricks += 0.6;
        else if (val >= 5) estimatedTricks += 0.35;
        else estimatedTricks += 0.15;
      } else {
        if (val === 13) estimatedTricks += (round <= 4 ? 0.6 : 0.4);
        else if (val === 12) estimatedTricks += 0.25;
      }
    }
  });

  let bid = Math.round(estimatedTricks);
  if (bid > round) bid = round;
  if (bid < 0) bid = 0;

  // Geber-Regel (Plus/Minus Eins) für den letzten Spieler beachten
  if (isDealer) {
    const totalBidsSoFar = playerBids.filter(b => b !== null && b !== undefined).reduce((a, b) => a + b, 0);
    if (isForbiddenBid(bid, round, totalBidsSoFar, true)) {
      // Wenn verboten, nach oben oder unten ausweichen
      if (estimatedTricks > bid && bid + 1 <= round) {
        bid = bid + 1;
      } else if (bid - 1 >= 0) {
        bid = bid - 1;
      } else if (bid + 1 <= round) {
        bid = bid + 1;
      }
    }
  }

  return bid;
}

/**
 * Wählt die beste spielbare Karte für den Bot
 */
function chooseBotCard(hand, currentTrick, trumpCard, myBid, tricksWon, round = 1) {
  if (!hand || hand.length === 0) return { cardIndex: 0 };

  const trumpSuit = trumpCard && trumpCard.suit !== 'none' ? trumpCard.suit : 'none';

  // 1. Alle legalen Handkarten finden
  const legalCards = [];
  hand.forEach((card, idx) => {
    if (isValidMove(card, hand, currentTrick)) {
      legalCards.push({ card, index: idx });
    }
  });

  if (legalCards.length === 0) {
    return { cardIndex: 0 };
  }

  if (legalCards.length === 1) {
    const c = legalCards[0].card;
    return {
      cardIndex: legalCards[0].index,
      chosenRole: c.type === 'shapeshifter' ? 'wizard' : undefined,
      chosenSuit: (c.type === 'cloud' || c.type === 'juggler') ? (trumpSuit !== 'none' ? trumpSuit : 'red') : undefined
    };
  }

  const wantsToWin = (tricksWon < myBid);

  // Simuliere den Ausgang für jede legale Karte
  const evaluated = legalCards.map(item => {
    const eff = { ...item.card };
    let role = undefined;
    let suit = undefined;

    if (item.card.type === 'shapeshifter') {
      role = wantsToWin ? 'wizard' : 'jester';
      eff.chosenRole = role;
    }
    if (item.card.type === 'cloud' || item.card.type === 'juggler') {
      suit = (trumpSuit !== 'none') ? trumpSuit : 'red';
      eff.chosenSuit = suit;
    }

    const simTrick = [...currentTrick, { playerId: 'sim_bot', card: eff }];
    const result = evaluateTrickDetails(simTrick, trumpCard);
    const wouldWin = (result.winnerPlayerId === 'sim_bot');

    return {
      ...item,
      wouldWin,
      chosenRole: role,
      chosenSuit: suit
    };
  });

  let chosen;

  if (wantsToWin) {
    // Versuche den Stich zu gewinnen: nimm die schwächste gewinnende Karte
    const winners = evaluated.filter(e => e.wouldWin);
    if (winners.length > 0) {
      // Sortiere so, dass nicht unnötig Zauberer verschwendet wird, wenn eine normale Karte reicht
      winners.sort((a, b) => {
        const valA = a.card.value !== undefined ? a.card.value : 14;
        const valB = b.card.value !== undefined ? b.card.value : 14;
        return valA - valB;
      });
      chosen = winners[0];
    } else {
      // Kann nicht gewinnen -> werfe schwächste/nutzlose Karte ab
      evaluated.sort((a, b) => {
        const valA = a.card.value !== undefined ? a.card.value : 0;
        const valB = b.card.value !== undefined ? b.card.value : 0;
        return valA - valB;
      });
      chosen = evaluated[0];
    }
  } else {
    // Will Stich abtreten: nimm eine Karte, die NICHT gewinnt
    const nonWinners = evaluated.filter(e => !e.wouldWin);
    if (nonWinners.length > 0) {
      // Bevorzuge Narren, Feen oder hohe Fehlfarben zum sicheren Entsorgen
      nonWinners.sort((a, b) => {
        const isJesterA = a.card.type === 'jester' || a.card.type === 'fairy';
        const isJesterB = b.card.type === 'jester' || b.card.type === 'fairy';
        if (isJesterA && !isJesterB) return -1;
        if (!isJesterA && isJesterB) return 1;
        const valA = a.card.value !== undefined ? a.card.value : 0;
        const valB = b.card.value !== undefined ? b.card.value : 0;
        return valB - valA; // Höchste nicht-gewinnende Karte abwerfen
      });
      chosen = nonWinners[0];
    } else {
      // Wenn gezwungen zu gewinnen, nimm die geringste Übermacht
      evaluated.sort((a, b) => (a.card.value || 0) - (b.card.value || 0));
      chosen = evaluated[0];
    }
  }

  return {
    cardIndex: chosen.index,
    chosenRole: chosen.chosenRole,
    chosenSuit: chosen.chosenSuit
  };
}

module.exports = {
  BOT_NAMES,
  createBotPlayer,
  calculateBotBid,
  chooseBotCard
};
