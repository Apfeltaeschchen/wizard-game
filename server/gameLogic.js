// Generiert das 60-Karten-Deck
function createDeck() {
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

// Wertet den Stich aus und gibt die ID des Gewinners zurück
function evaluateTrick(trickCards, trumpCard) {
  if (!trickCards || trickCards.length === 0) return null;

  // 1. Regel: Der ERSTE gespielte Zauberer gewinnt immer sofort.
  for (let i = 0; i < trickCards.length; i++) {
    if (trickCards[i].card.type === 'wizard') {
      return trickCards[i].playerId;
    }
  }

  // 2. Trumpffarbe ermitteln
  let trumpSuit = 'none';
  if (trumpCard) {
    if (trumpCard.type === 'color') {
      trumpSuit = trumpCard.suit;
    } else if (trumpCard.type === 'wizard' && trumpCard.chosenSuit) {
      trumpSuit = trumpCard.chosenSuit; // Berücksichtigt die Wahl des Gebers
    }
  }

  // 3. Bedienfarbe (erste gespielte reguläre Farbkarte) ermitteln
  let leadSuit = 'none';
  for (let i = 0; i < trickCards.length; i++) {
    if (trickCards[i].card.type === 'color') {
      leadSuit = trickCards[i].card.suit;
      break;
    }
  }

  // 4. Sonderfall: Wenn NUR Narren gespielt wurden, gewinnt der erste Narr
  if (leadSuit === 'none') {
    return trickCards[0].playerId;
  }

  // 5. Reguläre Karten vergleichen (Trumpf vs. Bedienfarbe)
  let winningPlayerId = trickCards[0].playerId;
  let highestValue = -1;
  let isTrumpWinning = false;

  for (let i = 0; i < trickCards.length; i++) {
    const card = trickCards[i].card;
    const playerId = trickCards[i].playerId;

    if (card.type === 'color') {
      if (card.suit === trumpSuit) {
        // Trumpf gespielt! Schlägt alle normalen Karten und niedrigere Trümpfe.
        if (!isTrumpWinning || card.value > highestValue) {
          isTrumpWinning = true;
          highestValue = card.value;
          winningPlayerId = playerId;
        }
      } else if (!isTrumpWinning && card.suit === leadSuit) {
        // Bedienfarbe gespielt (zählt nur, wenn noch kein Trumpf im Stich liegt)
        if (card.value > highestValue) {
          highestValue = card.value;
          winningPlayerId = playerId;
        }
      }
    }
  }

  return winningPlayerId;
}

// Prüft, ob ein Zug den offiziellen Regeln entspricht
function isValidMove(cardToPlay, hand, currentTrick) {
  // 1. Zauberer und Narren dürfen IMMER gespielt werden.
  if (cardToPlay.type === 'wizard' || cardToPlay.type === 'jester') {
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

    if (trickCard.type === 'wizard') {
      // Wurde der Stich mit einem Zauberer eröffnet, gibt es keine Bedienpflicht für nachfolgende Spieler.
      break;
    }

    if (trickCard.type === 'color') {
      // Die erste gespielte Farbkarte bestimmt die Bedienfarbe. Vorausgegangene Narren werden ignoriert.
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

// Berechnet die maximale Rundenanzahl für eine gegebene Spieleranzahl (3 bis 6)
function getMaxRounds(playerCount) {
  if (!playerCount || playerCount < 1) return 20;
  return Math.floor(60 / playerCount);
}

// Prüft, ob ein Gebot für den Geber (letzter Spieler) nach der Plus/Minus-Eins-Regel verboten ist
function isForbiddenBid(bid, currentRound, totalBidsSoFar, isLastPlayer) {
  if (!isLastPlayer) return false;
  const forbiddenBid = currentRound - totalBidsSoFar;
  return forbiddenBid >= 0 && bid === forbiddenBid;
}

// Sortiert Handkarten:
// 1. Narren ganz links
// 2. Reguläre Farben: Gelb -> Rot -> Grün -> Blau (aufsteigend nach Wert)
// 3. Trumpf-Farbkarten (aufsteigend nach Wert)
// 4. Zauberer ganz rechts
function sortCards(cards, trumpSuit = 'none') {
  if (!cards || !Array.isArray(cards)) return [];
  const colorOrder = { yellow: 1, red: 2, green: 3, blue: 4 };

  return [...cards].sort((a, b) => {
    // 1. Narren ganz nach links
    if (a.type === 'jester' && b.type !== 'jester') return -1;
    if (b.type === 'jester' && a.type !== 'jester') return 1;
    if (a.type === 'jester' && b.type === 'jester') return 0;

    // 2. Zauberer ganz nach rechts
    if (a.type === 'wizard' && b.type !== 'wizard') return 1;
    if (b.type === 'wizard' && a.type !== 'wizard') return -1;
    if (a.type === 'wizard' && b.type === 'wizard') return 0;

    // Beide Karten sind reguläre Farbkarten:
    const aIsTrump = (trumpSuit && trumpSuit !== 'none' && a.suit === trumpSuit);
    const bIsTrump = (trumpSuit && trumpSuit !== 'none' && b.suit === trumpSuit);

    // 3. Trumpf kommt hinter alle regulären Farben, aber vor die Zauberer
    if (!aIsTrump && bIsTrump) return -1;
    if (aIsTrump && !bIsTrump) return 1;

    // 4. Wenn beide Trumpf sind: nach Kartenwert aufsteigend
    if (aIsTrump && bIsTrump) {
      return a.value - b.value;
    }

    // 5. Beide sind reguläre Fehlfarben: Gelb -> Rot -> Grün -> Blau, dann nach Wert
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
  isValidMove,
  calculatePoints,
  sortCards,
  isForbiddenBid,
  getMaxRounds
};