// Generiert das Deck (60 Karten bei 'classic', 63 Karten bei 'anniversary_30')
function createDeck(edition = 'classic') {
  const suits = ['red', 'blue', 'green', 'yellow'];
  const deck = [];

  // 1 bis 13 für jede Farbe
  suits.forEach(suit => {
    for (let i = 1; i <= 13; i++) {
      deck.push({ type: 'color', suit: suit, value: i });
    }
  });

  // 4 Zauberer (Z) und 4 Narren (N)
  for (let i = 0; i < 4; i++) {
    deck.push({ type: 'wizard', suit: 'none', value: 14 });
    deck.push({ type: 'jester', suit: 'none', value: 0 });
  }

  // Sonderkarten der 30-Jahre-Jubiläumsedition
  if (edition === 'anniversary_30') {
    deck.push({ type: 'dragon', suit: 'none', value: 15 });
    deck.push({ type: 'fairy', suit: 'none', value: -1 });
    deck.push({ type: 'bomb', suit: 'none', value: -99 });
  }

  return deck;
}

// Fisher-Yates Shuffle für echtes, faires Durchmischen
function shuffle(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Detaillierte Auswertung eines Stichs (inkl. Bomben-Neutralisierung und Vorrangregeln)
function evaluateTrickDetails(trickCards, trumpCard) {
  if (!trickCards || trickCards.length === 0) {
    return { winnerPlayerId: null, nextLeadPlayerId: null, isBombed: false };
  }

  // 1. Trumpffarbe ermitteln (auch wenn Zauberer oder Drache aufgedeckt wurde)
  let trumpSuit = 'none';
  if (trumpCard) {
    if (trumpCard.type === 'color') {
      trumpSuit = trumpCard.suit;
    } else if ((trumpCard.type === 'wizard' || trumpCard.type === 'dragon') && trumpCard.chosenSuit) {
      trumpSuit = trumpCard.chosenSuit; // Berücksichtigt die Wahl des Gebers
    }
  }

  // 2. Bedienfarbe (erste gespielte reguläre Farbkarte) ermitteln
  let leadSuit = 'none';
  for (let i = 0; i < trickCards.length; i++) {
    const card = trickCards[i].card;
    if (card.type === 'wizard' || card.type === 'dragon') {
      break; // Zauberer oder Drache eröffnen -> keine Bedienfarbe für nachfolgende Spieler
    }
    if (card.type === 'color') {
      leadSuit = card.suit;
      break;
    }
  }

  // 3. Prüfen, ob eine Bombe im Stich liegt
  const hasBomb = trickCards.some(t => t.card.type === 'bomb');

  // Interne Ermittlung der höchsten Karte (ohne Bomben-Neutralisierung)
  function getHighestEntry(entries) {
    const hasDragon = entries.some(t => t.card.type === 'dragon');
    const hasFairy = entries.some(t => t.card.type === 'fairy');

    // REGEL 1: Liegen Drache UND Fee im Stich? -> Die Fee gewinnt immer! (erste gespielte Fee)
    if (hasDragon && hasFairy) {
      return entries.find(t => t.card.type === 'fairy');
    }

    // REGEL 2: Liegt ein Drache im Stich? (ohne Fee) -> Erster Drache schlägt alles, inkl. Zauberer!
    if (hasDragon) {
      return entries.find(t => t.card.type === 'dragon');
    }

    // REGEL 3: Liegt ein Zauberer im Stich? (ohne Drache) -> Erster Zauberer gewinnt!
    const firstWizard = entries.find(t => t.card.type === 'wizard');
    if (firstWizard) {
      return firstWizard;
    }

    // REGEL 4: Liegt ein Trumpf im Stich?
    if (trumpSuit !== 'none') {
      const trumpCards = entries.filter(t => t.card.type === 'color' && t.card.suit === trumpSuit);
      if (trumpCards.length > 0) {
        return trumpCards.reduce((highest, curr) => curr.card.value > highest.card.value ? curr : highest);
      }
    }

    // REGEL 5: Liegt die Bedienfarbe im Stich?
    if (leadSuit !== 'none') {
      const leadCards = entries.filter(t => t.card.type === 'color' && t.card.suit === leadSuit);
      if (leadCards.length > 0) {
        return leadCards.reduce((highest, curr) => curr.card.value > highest.card.value ? curr : highest);
      }
    }

    // REGEL 6: Keine Trümpfe, keine Bedienfarbe (z. B. nur Narren oder nur Fee)
    const firstJester = entries.find(t => t.card.type === 'jester');
    if (firstJester) {
      return firstJester;
    }

    const firstFairy = entries.find(t => t.card.type === 'fairy');
    if (firstFairy) {
      return firstFairy;
    }

    return entries[0];
  }

  if (hasBomb) {
    // Stich ist durch die Bombe zerstört/neutralisiert (kein Stichgewinner!)
    const nonBombEntries = trickCards.filter(t => t.card.type !== 'bomb');
    let nextLeadPlayerId;
    if (nonBombEntries.length > 0) {
      nextLeadPlayerId = getHighestEntry(nonBombEntries).playerId;
    } else {
      nextLeadPlayerId = trickCards[0].playerId;
    }

    return {
      winnerPlayerId: null,
      nextLeadPlayerId: nextLeadPlayerId,
      isBombed: true
    };
  }

  const winningEntry = getHighestEntry(trickCards);
  return {
    winnerPlayerId: winningEntry.playerId,
    nextLeadPlayerId: winningEntry.playerId,
    isBombed: false
  };
}

// Rückwärtskompatible Hauptfunktion für bestehende Aufrufer & Tests
function evaluateTrick(trickCards, trumpCard) {
  const details = evaluateTrickDetails(trickCards, trumpCard);
  return details.winnerPlayerId;
}

// Prüft, ob ein Zug den offiziellen Regeln entspricht
function isValidMove(cardToPlay, hand, currentTrick) {
  // 1. Zauberer, Narren, Drache, Fee und Bombe dürfen IMMER gespielt werden.
  if (['wizard', 'jester', 'dragon', 'fairy', 'bomb'].includes(cardToPlay.type)) {
    return true;
  }

  // 2. Wer den Stich eröffnet, darf jede Karte legen.
  if (currentTrick.length === 0) {
    return true;
  }

  // 3. Bedienfarbe (leadSuit) des aktuellen Stichs ermitteln.
  let leadSuit = 'none';
  for (let i = 0; i < currentTrick.length; i++) {
    const trickCard = currentTrick[i].card;

    if (trickCard.type === 'wizard' || trickCard.type === 'dragon') {
      // Wurde der Stich mit Zauberer oder Drache eröffnet, gibt es keine Bedienpflicht für nachfolgende Spieler.
      break;
    }

    if (trickCard.type === 'color') {
      // Die erste gespielte Farbkarte bestimmt die Bedienfarbe. Vorausgegangene Narren, Feen und Bomben werden ignoriert.
      leadSuit = trickCard.suit;
      break;
    }
  }

  // 4. Gibt es keine Bedienfarbe, ist jede Karte erlaubt.
  if (leadSuit === 'none') {
    return true;
  }

  // 5. Wird die Bedienfarbe bedient, ist der Zug gültig.
  if (cardToPlay.type === 'color' && cardToPlay.suit === leadSuit) {
    return true;
  }

  // 6. Spieler will eine andere Farbe (oder Trumpf) spielen.
  // Das ist laut Regeln nur erlaubt, wenn er die Bedienfarbe NICHT auf der Hand hat.
  const hasLeadSuit = hand.some(c => c.type === 'color' && c.suit === leadSuit);

  if (hasLeadSuit) {
    return false; // Illegaler Zug: Spieler könnte bedienen, tut es aber nicht.
  }

  return true; // Spieler hat die Farbe nicht und darf abwerfen oder stechen.
}

// Berechnet die Erfahrungspunkte am Rundenende
function calculatePoints(bid, tricksWon) {
  if (bid === tricksWon) {
    // Richtige Vorhersage: 20 Bonuspunkte + 10 pro Stich
    return 20 + (tricksWon * 10);
  } else {
    // Falsche Vorhersage: -10 Punkte für jeden Stich Differenz
    return -10 * Math.abs(bid - tricksWon);
  }
}

// Berechnet die maximale Rundenanzahl für eine gegebene Spieleranzahl (3 bis 6) und Edition
function getMaxRounds(playerCount, edition = 'classic') {
  const deckSize = (edition === 'anniversary_30') ? 63 : 60;
  if (!playerCount || playerCount < 1) return Math.floor(deckSize / 3);
  return Math.floor(deckSize / playerCount);
}

// Prüft, ob ein Gebot für den Geber (letzter Spieler) nach der Plus/Minus-Eins-Regel verboten ist
function isForbiddenBid(bid, currentRound, totalBidsSoFar, isLastPlayer) {
  if (!isLastPlayer) return false;
  const forbiddenBid = currentRound - totalBidsSoFar;
  return forbiddenBid >= 0 && bid === forbiddenBid;
}

// Sortiert Handkarten:
// 1. Fee (-2)
// 2. Narren (-1)
// 3. Bombe (0)
// 4. Reguläre Farben: Gelb -> Rot -> Grün -> Blau (aufsteigend nach Wert 1-13)
// 5. Trumpf-Farbkarten (aufsteigend nach Wert 1-13)
// 6. Zauberer (14)
// 7. Drache (15)
function sortCards(cards, trumpSuit = 'none') {
  if (!cards || !Array.isArray(cards)) return [];
  const colorOrder = { yellow: 1, red: 2, green: 3, blue: 4 };

  const specialRanks = {
    fairy: -2,
    jester: -1,
    bomb: 0,
    wizard: 14,
    dragon: 15
  };

  return [...cards].sort((a, b) => {
    const aSpecial = specialRanks[a.type];
    const bSpecial = specialRanks[b.type];

    // Beide sind Sonderkarten / Zauberer / Narren
    if (aSpecial !== undefined && bSpecial !== undefined) {
      return aSpecial - bSpecial;
    }

    // Eine ist linke Sonderkarte (Fee, Narr, Bombe <= 0)
    if (aSpecial !== undefined && aSpecial <= 0) return -1;
    if (bSpecial !== undefined && bSpecial <= 0) return 1;

    // Eine ist rechte Sonderkarte (Zauberer, Drache >= 14)
    if (aSpecial !== undefined && aSpecial >= 14) return 1;
    if (bSpecial !== undefined && bSpecial >= 14) return -1;

    // Beide Karten sind reguläre Farbkarten:
    const aIsTrump = (trumpSuit && trumpSuit !== 'none' && a.suit === trumpSuit);
    const bIsTrump = (trumpSuit && trumpSuit !== 'none' && b.suit === trumpSuit);

    // Trumpf kommt hinter alle regulären Fehlfarben, aber vor die Zauberer
    if (!aIsTrump && bIsTrump) return -1;
    if (aIsTrump && !bIsTrump) return 1;

    // Wenn beide Trumpf sind: nach Kartenwert aufsteigend
    if (aIsTrump && bIsTrump) {
      return a.value - b.value;
    }

    // Beide sind reguläre Fehlfarben: Gelb -> Rot -> Grün -> Blau, dann nach Wert
    if (a.suit !== b.suit) {
      return (colorOrder[a.suit] || 5) - (colorOrder[b.suit] || 5);
    }
    return a.value - b.value;
  });
}

module.exports = {
  createDeck,
  shuffle,
  evaluateTrick,
  evaluateTrickDetails,
  isValidMove,
  calculatePoints,
  sortCards,
  isForbiddenBid,
  getMaxRounds
};