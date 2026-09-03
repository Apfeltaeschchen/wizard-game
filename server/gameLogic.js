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

// Sortiert Handkarten: Narren -> Farben (Gelb, Rot, Grün, Blau aufsteigend) -> Zauberer
function sortCards(cards) {
  const suitOrder = { yellow: 1, red: 2, green: 3, blue: 4, none: 5 };

  return cards.sort((a, b) => {
    // 1. Narren ganz nach links
    if (a.type === 'jester' && b.type !== 'jester') return -1;
    if (b.type === 'jester' && a.type !== 'jester') return 1;

    // 2. Zauberer ganz nach rechts
    if (a.type === 'wizard' && b.type !== 'wizard') return 1;
    if (b.type === 'wizard' && a.type !== 'wizard') return -1;

    // 3. Wenn beide Karten Farbkarten sind: Nach Farbe gruppieren, dann nach Wert
    if (a.type === 'color' && b.type === 'color') {
      if (a.suit !== b.suit) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return a.value - b.value;
    }

    return 0;
  });
}

module.exports = {
  createDeck,
  shuffle,
  evaluateTrick,
  isValidMove,
  calculatePoints,
  sortCards
};