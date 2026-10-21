const { isValidMove, evaluateTrickDetails, isForbiddenBid, getEffectiveCard, sortCards } = require('./gameLogic');

// Definition der Bot-Profile nach Schwierigkeitsgrad
const BOT_PROFILES = {
  novice: {
    names: [
      'Rincewind (KI)',
      'Gilderoy Lockhart (KI)',
      'Presto (KI)',
      'Gargamel (KI)',
      'Neville Longbottom (KI)',
      'Orko (KI)'
    ],
    avatarId: 'wizard_green',
    title: 'Zauberlehrling',
    skillRating: 850,
    rank: {
      tier: 'novice',
      tierKey: 'novice',
      division: 3,
      divisionName: 'Novize III',
      color: '#cd7f32',
      progressPercent: 40
    }
  },
  master: {
    names: [
      'Severus Snape (KI)',
      'Doctor Strange (KI)',
      'Yennefer von Vengerberg (KI)',
      'Howl Pendragon (KI)',
      'Raistlin Majere (KI)',
      'Minerva McGonagall (KI)'
    ],
    avatarId: 'wizard_blue',
    title: 'Meistermagier',
    skillRating: 1350,
    rank: {
      tier: 'adept',
      tierKey: 'adept',
      division: 2,
      divisionName: 'Adept II',
      color: '#60a5fa',
      progressPercent: 65
    }
  },
  archmage: {
    names: [
      'Gandalf (KI)',
      'Albus Dumbledore (KI)',
      'Merlin (KI)',
      'Saruman (KI)',
      'Lord Voldemort (KI)',
      'Elminster (KI)'
    ],
    avatarId: 'wizard_purple',
    title: 'Oberster Rat',
    skillRating: 2150,
    rank: {
      tier: 'archmage',
      tierKey: 'archmage',
      division: 1,
      divisionName: 'Erzmagier I',
      color: '#e879f9',
      progressPercent: 90
    }
  }
};

const BOT_NAMES = [
  ...BOT_PROFILES.novice.names,
  ...BOT_PROFILES.master.names,
  ...BOT_PROFILES.archmage.names
];

/**
 * Erstellt ein Bot-Spieler-Objekt mit spezifischer Schwierigkeitsstufe
 * @param {Array} existingPlayers 
 * @param {'novice'|'master'|'archmage'} difficulty 
 */
function createBotPlayer(existingPlayers = [], difficulty = 'master') {
  const diffKey = ['novice', 'master', 'archmage'].includes(difficulty) ? difficulty : 'master';
  const profile = BOT_PROFILES[diffKey];

  const existingNames = new Set(existingPlayers.map(p => p.name));
  let chosenName = profile.names.find(n => !existingNames.has(n));
  if (!chosenName) {
    const pool = profile.names;
    const base = pool[existingPlayers.filter(p => p.isBot).length % pool.length].replace(' (KI)', '');
    chosenName = `${base} II (KI)`;
  }

  const botSessionId = 'bot_' + Math.random().toString(36).substring(2, 9);

  return {
    sessionId: botSessionId,
    socketId: 'sock_' + botSessionId,
    userId: null,
    name: chosenName,
    avatarId: profile.avatarId,
    title: profile.title,
    skillRating: profile.skillRating,
    rank: { ...profile.rank },
    difficulty: diffKey,
    isBot: true,
    connected: true,
    hand: [],
    bid: null,
    tricksWon: 0,
    totalScore: 0
  };
}

// ============================================================================
// 1. BIET-HEURISTIKEN (PREDICTION PHASE)
// ============================================================================

/**
 * 1. NOVIZE (Lehrling):
 * Schematisches, naives Bieten. Überschätzt Mittelkarten und weicht bei Geber-Zwang blind ab.
 */
function calculateNoviceBid(hand, trumpCard, trumpSuit, playerBids = [], isDealer = false, round = 1) {
  if (!hand || hand.length === 0) return 0;
  const tSuit = trumpSuit || (trumpCard && trumpCard.suit !== 'none' ? trumpCard.suit : 'none');

  let raw = 0.0;
  hand.forEach(c => {
    if (c.type === 'wizard' || c.type === 'dragon' || c.type === 'werewolf_trump') {
      raw += 1.0;
    } else if (c.type === 'shapeshifter') {
      raw += 0.8;
    } else if (c.type === 'unicorn') {
      raw += 0.5;
    } else if (c.type === 'color' || c.type === 'cloud' || c.type === 'juggler') {
      const isTrump = (c.suit === tSuit && tSuit !== 'none');
      const val = c.value || 0;
      if (isTrump) {
        if (val >= 9) raw += 0.9;
        else if (val >= 5) raw += 0.5;
        else raw += 0.25;
      } else {
        if (val === 13) raw += 0.65;
        else if (val >= 11) raw += 0.35;
        else if (val >= 8) raw += 0.2; // Fataler Fehler: Novize hofft auf Mittelkarten!
      }
    }
  });

  let bid = Math.round(raw);
  if (bid > round) bid = round;
  if (bid < 0) bid = 0;

  // Geber-Regel (Plus/Minus Eins): Novize weicht blind aus
  if (isDealer) {
    const totalBidsSoFar = playerBids.filter(b => b !== null && b !== undefined).reduce((a, b) => a + b, 0);
    if (isForbiddenBid(bid, round, totalBidsSoFar, true)) {
      // 50% Zufall nach oben oder unten
      if (bid === 0) {
        bid = 1;
      } else if (bid === round) {
        bid = round - 1;
      } else {
        bid = (Math.random() < 0.5) ? bid + 1 : bid - 1;
      }
    }
  }

  return Math.max(0, Math.min(round, bid));
}

/**
 * 2. MEISTER (Magier):
 * Ausbalancierte Lock- vs. Soft-Heuristik. Berücksichtigt Handkartenlängen und Tisch-Defizit.
 */
function calculateMasterBid(hand, trumpCard, trumpSuit, playerBids = [], isDealer = false, round = 1, numPlayers = 4) {
  if (!hand || hand.length === 0) return 0;
  const tSuit = trumpSuit || (trumpCard && trumpCard.suit !== 'none' ? trumpCard.suit : 'none');

  let lockTricks = 0.0;
  let softTricks = 0.0;

  // Zähle Farbenanzahl zur Erkennung von Längen
  const suitCounts = { red: 0, blue: 0, green: 0, yellow: 0 };
  hand.forEach(c => {
    if (c.suit && suitCounts[c.suit] !== undefined) suitCounts[c.suit]++;
  });

  hand.forEach(c => {
    // Locks: Zauberer, Drache, Werwolf-Trumpf
    if (c.type === 'wizard' || c.type === 'dragon' || c.type === 'werewolf_trump') {
      lockTricks += 0.95;
      return;
    }
    if (c.type === 'shapeshifter') {
      lockTricks += 0.85;
      return;
    }
    if (c.type === 'unicorn') {
      softTricks += 0.45;
      return;
    }
    if (c.type === 'jester' || c.type === 'fairy' || c.type === 'bomb' || c.type === 'witch') {
      return; // 0 Stiche
    }

    if (c.type === 'color' || c.type === 'cloud' || c.type === 'juggler') {
      const val = c.value || 0;
      const isTrump = (c.suit === tSuit && tSuit !== 'none');

      if (isTrump) {
        if (val >= 11) lockTricks += 0.85;
        else if (val >= 8) softTricks += 0.6;
        else if (val >= 5) softTricks += 0.3;
        else softTricks += 0.1;
      } else {
        const count = suitCounts[c.suit] || 1;
        if (val === 13) {
          // In kurzer Farbe (1-2 Karten) sticht 13 sicherer; in langer Farbe wird abgestochen
          softTricks += (count <= 2) ? 0.6 : 0.3;
        } else if (val === 12) {
          softTricks += (count === 1) ? 0.35 : 0.15;
        }
      }
    }
  });

  // Tisch-Defizit / Tisch-Temperatur beachten (wenn Spieler schon geboten haben)
  const bidsKnown = playerBids.filter(b => b !== null && b !== undefined);
  if (bidsKnown.length >= Math.floor(numPlayers / 2)) {
    const totalSoFar = bidsKnown.reduce((a, b) => a + b, 0);
    const averageExpectedPerPlayer = round / numPlayers;
    const expectedSoFar = bidsKnown.length * averageExpectedPerPlayer;
    if (totalSoFar > expectedSoFar + 1.2) {
      // Tisch ist überzeichnet -> Stiche werden umkämpft, Soft-Tricks abwerten
      softTricks *= 0.65;
    } else if (totalSoFar < expectedSoFar - 1.2) {
      // Tisch ist unterzeichnet -> Stiche fallen leicht zu, Soft-Tricks aufwerten
      softTricks *= 1.25;
    }
  }

  let bid = Math.round(lockTricks + softTricks);
  if (bid > round) bid = round;
  if (bid < 0) bid = 0;

  // Geber-Regel (+/- 1): Meister weicht taktisch basierend auf Rest-Wahrscheinlichkeit aus
  if (isDealer) {
    const totalBidsSoFar = bidsKnown.reduce((a, b) => a + b, 0);
    if (isForbiddenBid(bid, round, totalBidsSoFar, true)) {
      const diff = (lockTricks + softTricks) - bid;
      if (diff > 0.05 && bid + 1 <= round) {
        bid = bid + 1;
      } else if (bid - 1 >= 0) {
        bid = bid - 1;
      } else if (bid + 1 <= round) {
        bid = bid + 1;
      }
    }
  }

  return Math.max(0, Math.min(round, bid));
}

/**
 * 3. ERZMAGIER (Oberster Rat):
 * Bayesian Expectation mit Nachziehstapel-Wahrscheinlichkeit + Zero-Risk-Toxicity-Index.
 */
function calculateArchmageBid(hand, trumpCard, trumpSuit, playerBids = [], isDealer = false, round = 1, numPlayers = 4, edition = 'classic') {
  if (!hand || hand.length === 0) return 0;
  const tSuit = trumpSuit || (trumpCard && trumpCard.suit !== 'none' ? trumpCard.suit : 'none');

  const totalDeck = (edition === 'anniversary_30') ? 69 : 60;
  const dealtCards = round * numPlayers;
  const drawPileCount = Math.max(0, totalDeck - dealtCards);

  // Wahrscheinlichkeit, dass eine feindliche höhere Karte auf einer Gegnerhand liegt:
  // Bei großem Nachziehstapel liegen viele hohe Karten unverteilt im Stapel!
  const opponentInHandProb = (dealtCards - round) / (totalDeck - round);

  let lockExpectation = 0.0;
  let softExpectation = 0.0;
  let jesterCount = 0;
  let poisonCards = 0;

  const suitCards = { red: [], blue: [], green: [], yellow: [] };

  hand.forEach(c => {
    if (c.type === 'jester' || c.type === 'fairy') {
      jesterCount++;
      return;
    }
    if (c.type === 'wizard' || c.type === 'dragon' || c.type === 'werewolf_trump') {
      lockExpectation += 0.98;
      return;
    }
    if (c.type === 'shapeshifter') {
      lockExpectation += 0.9;
      return;
    }
    if (c.type === 'unicorn') {
      softExpectation += 0.55;
      return;
    }
    if (c.type === 'bomb' || c.type === 'witch') {
      return;
    }

    if (c.type === 'color' || c.type === 'cloud' || c.type === 'juggler') {
      const val = c.value || 0;
      if (c.suit && suitCards[c.suit]) suitCards[c.suit].push(val);

      const isTrump = (c.suit === tSuit && tSuit !== 'none');
      if (isTrump) {
        if (val >= 11) lockExpectation += 0.9;
        else if (val >= 8) softExpectation += 0.65;
        else if (val >= 5) softExpectation += 0.35;
        else softExpectation += 0.12;
      } else {
        if (val === 13) {
          // Off-Suit 13: Wenn viele Karten noch im Stapel liegen, gewinnt die 13 fast immer!
          const winProb = 0.45 + (1 - opponentInHandProb) * 0.35;
          softExpectation += Math.min(0.85, winProb);
        } else if (val === 12) {
          softExpectation += (1 - opponentInHandProb) * 0.35;
        } else if (val >= 6 && val <= 10) {
          // Giftige Mittelkarten: Gefahr bei Null-Tipp!
          poisonCards++;
        }
      }
    }
  });

  // Zero-Risk Toxicity Check:
  // Ein Null-Tipp mit giftigen Mittelkarten (6-10) und ohne Narren ist Selbstmord (-30 Pkt Penalty)!
  const totalRaw = lockExpectation + softExpectation;
  let rawBid = Math.round(totalRaw);

  if (rawBid === 0 && poisonCards >= 1 && jesterCount === 0 && round >= 3) {
    // Erzmagier lehnt den 0-Tipp ab und bietet kalkuliert 1 Stich!
    rawBid = 1;
  }

  // Geber- & Tisch-Defizit-Auswertung
  let finalBid = Math.max(0, Math.min(round, rawBid));

  if (isDealer) {
    const knownBids = playerBids.filter(b => b !== null && b !== undefined);
    const sumSoFar = knownBids.reduce((a, b) => a + b, 0);

    if (isForbiddenBid(finalBid, round, sumSoFar, true)) {
      const remainingDistance = totalRaw - finalBid;
      if (remainingDistance >= 0.0 && finalBid + 1 <= round) {
        finalBid = finalBid + 1;
      } else if (finalBid - 1 >= 0) {
        finalBid = finalBid - 1;
      } else if (finalBid + 1 <= round) {
        finalBid = finalBid + 1;
      }
    }
  }

  return Math.max(0, Math.min(round, finalBid));
}

/**
 * Universeller Dispatcher für das Bot-Gebot
 */
function calculateBotBid(hand, trumpCard, trumpSuit, playerBids = [], isDealer = false, round = 1, numPlayers = 4, difficulty = 'master', edition = 'classic') {
  if (difficulty === 'novice') {
    return calculateNoviceBid(hand, trumpCard, trumpSuit, playerBids, isDealer, round);
  }
  if (difficulty === 'archmage') {
    return calculateArchmageBid(hand, trumpCard, trumpSuit, playerBids, isDealer, round, numPlayers, edition);
  }
  return calculateMasterBid(hand, trumpCard, trumpSuit, playerBids, isDealer, round, numPlayers);
}

// ============================================================================
// 2. STICHFÜHRUNG & KARTENAUSWAHL (TRICK-PLAY PHASE)
// ============================================================================

/**
 * 1. NOVIZE (Lehrling):
 * Gedächtnislos, gierig, verheizt Zauberer früh und wirft bei Fehlfarben unbedacht ab.
 */
function chooseNoviceCard(hand, currentTrick, trumpCard, myBid, tricksWon) {
  const legalCards = hand.map((card, index) => ({ card, index })).filter(item => isValidMove(item.card, hand, currentTrick));
  if (legalCards.length === 0) return { cardIndex: 0 };
  if (legalCards.length === 1) return { cardIndex: legalCards[0].index };

  // Anspiel (Lead): 40% Chance, sofort höchste Karte oder Zauberer zu verpulvern
  if (currentTrick.length === 0) {
    if (Math.random() < 0.4) {
      const wizards = legalCards.filter(c => c.card.type === 'wizard' || c.card.type === 'dragon');
      if (wizards.length > 0) return { cardIndex: wizards[0].index };
      // Höchste Farbkarte spielen
      legalCards.sort((a, b) => (b.card.value || 0) - (a.card.value || 0));
      return { cardIndex: legalCards[0].index };
    }
    // Sonst zufällige Karte
    const randIdx = Math.floor(Math.random() * legalCards.length);
    return { cardIndex: legalCards[randIdx].index };
  }

  // Folgespiel: Prüfe, welche Karten gewinnen
  const evaluated = legalCards.map(item => {
    const simTrick = [...currentTrick, { playerId: 'sim_novice', card: item.card }];
    const res = evaluateTrickDetails(simTrick, trumpCard);
    return { ...item, wouldWin: res.winnerPlayerId === 'sim_novice' };
  });

  const winning = evaluated.filter(e => e.wouldWin);
  if (winning.length > 0) {
    // Novize ist gierig: Nimmt sofort den Stich, oft mit der höchsten Karte
    winning.sort((a, b) => (b.card.value || 0) - (a.card.value || 0));
    return { cardIndex: winning[0].index };
  }

  // Kann nicht gewinnen: Wirft zufällige legale Karte ab (kein gezieltes Sloughing!)
  const randIdx = Math.floor(Math.random() * evaluated.length);
  return { cardIndex: evaluated[randIdx].index };
}

/**
 * 2. MEISTER (Magier):
 * Ausbalancierte Zielerfüllung: Minimaler Gewinneinsatz, Sloughing bei Voids, Narren-Rettungsring.
 */
function chooseMasterCard(hand, currentTrick, trumpCard, myBid, tricksWon, round = 1, playedCards = []) {
  const trumpSuit = trumpCard && trumpCard.suit !== 'none' ? trumpCard.suit : 'none';
  const legalCards = hand.map((card, index) => ({ card, index })).filter(item => isValidMove(item.card, hand, currentTrick));

  if (legalCards.length === 0) return { cardIndex: 0 };
  if (legalCards.length === 1) {
    const c = legalCards[0].card;
    return {
      cardIndex: legalCards[0].index,
      chosenRole: c.type === 'shapeshifter' ? ((tricksWon < myBid) ? 'wizard' : 'jester') : undefined,
      chosenSuit: (c.type === 'cloud' || c.type === 'juggler') ? (trumpSuit !== 'none' ? trumpSuit : 'red') : undefined
    };
  }

  const wantsToWin = (tricksWon < myBid);

  // Simuliere jede Karte
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

    const simTrick = [...currentTrick, { playerId: 'sim_master', card: eff }];
    const res = evaluateTrickDetails(simTrick, trumpCard);
    const wouldWin = (res.winnerPlayerId === 'sim_master');

    return { ...item, wouldWin, chosenRole: role, chosenSuit: suit };
  });

  // Anspiel (Lead)
  if (currentTrick.length === 0) {
    if (wantsToWin) {
      // Spiele Boss-Farbe oder hohen Trumpf an
      evaluated.sort((a, b) => {
        const isTrumpA = (a.card.suit === trumpSuit && trumpSuit !== 'none');
        const isTrumpB = (b.card.suit === trumpSuit && trumpSuit !== 'none');
        if (isTrumpA && !isTrumpB) return -1;
        if (!isTrumpA && isTrumpB) return 1;
        return (b.card.value || 0) - (a.card.value || 0);
      });
      return { cardIndex: evaluated[0].index, chosenRole: evaluated[0].chosenRole, chosenSuit: evaluated[0].chosenSuit };
    } else {
      // Vermeide Stiche: spiele niedrigste Nicht-Trumpf-Karte an
      evaluated.sort((a, b) => {
        const isSpecialA = ['wizard', 'dragon', 'unicorn'].includes(a.card.type);
        const isSpecialB = ['wizard', 'dragon', 'unicorn'].includes(b.card.type);
        if (isSpecialA && !isSpecialB) return 1;
        if (!isSpecialA && isSpecialB) return -1;
        return (a.card.value || 0) - (b.card.value || 0);
      });
      return { cardIndex: evaluated[0].index, chosenRole: evaluated[0].chosenRole, chosenSuit: evaluated[0].chosenSuit };
    }
  }

  // Folgespiel
  if (wantsToWin) {
    const winners = evaluated.filter(e => e.wouldWin);
    if (winners.length > 0) {
      // Minimal-Invasiv: nimm die schwächste gewinnende Karte
      winners.sort((a, b) => (a.card.value || 0) - (b.card.value || 0));
      return { cardIndex: winners[0].index, chosenRole: winners[0].chosenRole, chosenSuit: winners[0].chosenSuit };
    }
    // Kann nicht gewinnen -> wirf niedrigste Karte ab
    evaluated.sort((a, b) => (a.card.value || 0) - (b.card.value || 0));
    return { cardIndex: evaluated[0].index, chosenRole: evaluated[0].chosenRole, chosenSuit: evaluated[0].chosenSuit };
  } else {
    // Will Stich abtreten
    const nonWinners = evaluated.filter(e => !e.wouldWin);
    if (nonWinners.length > 0) {
      // Sloughing: Bevorzuge hohe Nicht-Trumpf-Karten zum Entsorgen, hebe Narren auf
      nonWinners.sort((a, b) => {
        const isJesterA = (a.card.type === 'jester' || a.card.type === 'fairy');
        const isJesterB = (b.card.type === 'jester' || b.card.type === 'fairy');
        // Hebe Narren auf, wenn andere Karten sicher abgeworfen werden können
        if (isJesterA && !isJesterB) return 1;
        if (!isJesterA && isJesterB) return -1;
        return (b.card.value || 0) - (a.card.value || 0); // Höchste sichere Karte zuerst entsorgen
      });
      return { cardIndex: nonWinners[0].index, chosenRole: nonWinners[0].chosenRole, chosenSuit: nonWinners[0].chosenSuit };
    }
    // Gezwungen zu gewinnen -> geringste Übermacht
    evaluated.sort((a, b) => (a.card.value || 0) - (b.card.value || 0));
    return { cardIndex: evaluated[0].index, chosenRole: evaluated[0].chosenRole, chosenSuit: evaluated[0].chosenSuit };
  }
}

/**
 * 3. ERZMAGIER (Oberster Rat):
 * State-Tracker, Gegner-Void-Matrix & Zero-Killer Sabotage.
 */
function chooseArchmageCard(hand, currentTrick, trumpCard, myBid, tricksWon, round = 1, roomContext = {}) {
  const trumpSuit = trumpCard && trumpCard.suit !== 'none' ? trumpCard.suit : 'none';
  const legalCards = hand.map((card, index) => ({ card, index })).filter(item => isValidMove(item.card, hand, currentTrick));

  if (legalCards.length === 0) return { cardIndex: 0 };
  if (legalCards.length === 1) {
    const c = legalCards[0].card;
    return {
      cardIndex: legalCards[0].index,
      chosenRole: c.type === 'shapeshifter' ? ((tricksWon < myBid) ? 'wizard' : 'jester') : undefined,
      chosenSuit: (c.type === 'cloud' || c.type === 'juggler') ? (trumpSuit !== 'none' ? trumpSuit : 'red') : undefined
    };
  }

  const wantsToWin = (tricksWon < myBid);
  const playerVoids = roomContext.playerVoids || {};
  const players = roomContext.players || [];
  const playedCards = roomContext.playedCards || [];

  // Sabotage-Ziele identifizieren: Wer hat 0 geboten und steht noch bei 0?
  const zeroBidders = players.filter(p => p.bid === 0 && p.tricksWon === 0 && p.sessionId !== roomContext.botSessionId);

  // Simuliere alle legalen Züge
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

    const simTrick = [...currentTrick, { playerId: 'sim_archmage', card: eff }];
    const res = evaluateTrickDetails(simTrick, trumpCard);
    const wouldWin = (res.winnerPlayerId === 'sim_archmage');

    return { ...item, wouldWin, chosenRole: role, chosenSuit: suit };
  });

  // --- 30 JAHRE EDITIONS-SPECIALS (COUNTER-PLAY) ---
  // 1. Fee (Waldnymphe) vs. Drache (Lindwurm)
  const trickHasDragon = currentTrick.some(t => t.card && (t.card.type === 'dragon' || t.card.type === 'lindwurm'));
  if (trickHasDragon) {
    const fairy = evaluated.find(e => e.card.type === 'fairy' || e.card.type === 'waldnymphe');
    if (fairy) {
      // Eiskalter Counter: Die Fee schlägt den Drachen!
      return { cardIndex: fairy.index };
    }
  }

  // 2. Bombe (Magiekollaps) als Sabotage-Waffe
  const bomb = evaluated.find(e => e.card.type === 'bomb' || e.card.type === 'magiekollaps');
  if (bomb && currentTrick.length >= 2) {
    const currentWinnerId = evaluateTrickDetails(
      currentTrick.map(t => ({ playerId: t.playerSessionId || t.playerId, card: t.card })),
      trumpCard
    ).winnerPlayerId;
    const winningPlayer = players.find(p => p.sessionId === currentWinnerId);

    // Wenn ein Rivale kurz davor steht, sein Gebot perfekt zu erfüllen, sprenge den Stich!
    if (winningPlayer && winningPlayer.sessionId !== roomContext.botSessionId && winningPlayer.tricksWon + 1 === winningPlayer.bid) {
      return { cardIndex: bomb.index };
    }
  }

  // --- ANSPEL (LEAD) ---
  if (currentTrick.length === 0) {
    if (wantsToWin) {
      // Wenn wir Stiche wollen: Vermeide Farben, in denen Gegner Voids haben (Abstich-Gefahr!)
      evaluated.sort((a, b) => {
        const voidsInA = Object.values(playerVoids).filter(v => v && a.card.suit && v[a.card.suit]).length;
        const voidsInB = Object.values(playerVoids).filter(v => v && b.card.suit && v[b.card.suit]).length;
        if (voidsInA !== voidsInB) return voidsInA - voidsInB; // Weniger Voids = sicherer

        const isTrumpA = (a.card.suit === trumpSuit && trumpSuit !== 'none');
        const isTrumpB = (b.card.suit === trumpSuit && trumpSuit !== 'none');
        if (isTrumpA && !isTrumpB) return -1;
        if (!isTrumpA && isTrumpB) return 1;
        return (b.card.value || 0) - (a.card.value || 0);
      });
      return { cardIndex: evaluated[0].index, chosenRole: evaluated[0].chosenRole, chosenSuit: evaluated[0].chosenSuit };
    } else {
      // Wenn wir KEINE Stiche wollen:
      // ZERO-KILLER LEAD: Spiele eine Farbe an, die Null-Bieter noch besitzen, mit niedriger Karte
      if (zeroBidders.length > 0) {
        const target = zeroBidders[0];
        const targetVoids = playerVoids[target.sessionId] || {};
        const safeForTarget = evaluated.filter(e => e.card.suit && !targetVoids[e.card.suit] && (e.card.value || 0) <= 6);
        if (safeForTarget.length > 0) {
          return { cardIndex: safeForTarget[0].index, chosenRole: safeForTarget[0].chosenRole, chosenSuit: safeForTarget[0].chosenSuit };
        }
      }

      // Sonst sicherste niedrige Karte
      evaluated.sort((a, b) => {
        const isSpecialA = ['wizard', 'dragon', 'unicorn'].includes(a.card.type);
        const isSpecialB = ['wizard', 'dragon', 'unicorn'].includes(b.card.type);
        if (isSpecialA && !isSpecialB) return 1;
        if (!isSpecialA && isSpecialB) return -1;
        return (a.card.value || 0) - (b.card.value || 0);
      });
      return { cardIndex: evaluated[0].index, chosenRole: evaluated[0].chosenRole, chosenSuit: evaluated[0].chosenSuit };
    }
  }

  // --- FOLGESPIEL (FOLLOWING TRICK) ---

  // SABOTAGE: ZERO-KILLER TRAP
  // Wenn ein Null-Bieter aktuell den Stich hält und wir unterbieten können, lassen wir ihn bewusst gewinnen!
  const currentLeaderDetails = evaluateTrickDetails(
    currentTrick.map(t => ({ playerId: t.playerSessionId || t.playerId, card: t.card })),
    trumpCard
  );
  const currentWinnerId = currentLeaderDetails.winnerPlayerId;
  const isZeroBidderWinning = zeroBidders.some(zb => zb.sessionId === currentWinnerId);

  if (isZeroBidderWinning) {
    const duckingCards = evaluated.filter(e => !e.wouldWin);
    if (duckingCards.length > 0) {
      // Wenn wir den Stich nicht zwingend brauchen ODER noch ausreichend garantierte Stiche auf der Hand haben
      const remainingGuaranteed = hand.filter(c => c.type === 'wizard' || c.type === 'dragon').length;
      if (!wantsToWin || remainingGuaranteed >= (myBid - tricksWon)) {
        // Ducken und den Null-Bieter zerstören!
        duckingCards.sort((a, b) => (a.card.value || 0) - (b.card.value || 0));
        return { cardIndex: duckingCards[0].index, chosenRole: duckingCards[0].chosenRole, chosenSuit: duckingCards[0].chosenSuit };
      }
    }
  }

  // Reguläre rationale Auswertung
  if (wantsToWin) {
    const winners = evaluated.filter(e => e.wouldWin);
    if (winners.length > 0) {
      // Sparsamkeitsprinzip: Schwächste gewinnende Karte
      winners.sort((a, b) => {
        const isWizA = (a.card.type === 'wizard' || a.card.type === 'dragon');
        const isWizB = (b.card.type === 'wizard' || b.card.type === 'dragon');
        if (!isWizA && isWizB) return -1;
        if (isWizA && !isWizB) return 1;
        return (a.card.value || 0) - (b.card.value || 0);
      });
      return { cardIndex: winners[0].index, chosenRole: winners[0].chosenRole, chosenSuit: winners[0].chosenSuit };
    }
    // Kann nicht gewinnen: Ducke sauber und behalte Trümpfe
    evaluated.sort((a, b) => (a.card.value || 0) - (b.card.value || 0));
    return { cardIndex: evaluated[0].index, chosenRole: evaluated[0].chosenRole, chosenSuit: evaluated[0].chosenSuit };
  } else {
    // Will nicht gewinnen
    const nonWinners = evaluated.filter(e => !e.wouldWin);
    if (nonWinners.length > 0) {
      // Toxische hohe Farbkarten vor Narren entsorgen
      nonWinners.sort((a, b) => {
        const isJesterA = (a.card.type === 'jester' || a.card.type === 'fairy');
        const isJesterB = (b.card.type === 'jester' || b.card.type === 'fairy');
        if (isJesterA && !isJesterB) return 1; // Narren aufsparen!
        if (!isJesterA && isJesterB) return -1;
        return (b.card.value || 0) - (a.card.value || 0); // Höchste Karte entsorgen
      });
      return { cardIndex: nonWinners[0].index, chosenRole: nonWinners[0].chosenRole, chosenSuit: nonWinners[0].chosenSuit };
    }
    // Gezwungen zu gewinnen
    evaluated.sort((a, b) => (a.card.value || 0) - (b.card.value || 0));
    return { cardIndex: evaluated[0].index, chosenRole: evaluated[0].chosenRole, chosenSuit: evaluated[0].chosenSuit };
  }
}

/**
 * Universeller Dispatcher für Kartenauswahl
 */
function chooseBotCard(hand, currentTrick, trumpCard, myBid, tricksWon, round = 1, difficulty = 'master', roomContext = {}) {
  // Partner-Awareness für 2vs2 Allianzen
  const teammateSessionId = roomContext.teammateSessionId ||
    (roomContext.players && roomContext.team
      ? roomContext.players.find(p => p.team === roomContext.team && p.sessionId !== roomContext.botSessionId)?.sessionId
      : null);

  if (teammateSessionId && currentTrick && currentTrick.length > 0) {
    const currentLeadEvaluation = evaluateTrickDetails(
      currentTrick.map(t => ({ playerId: t.playerSessionId || t.playerId, card: t.card })),
      trumpCard
    );
    const currentWinnerId = currentLeadEvaluation.winnerPlayerId;

    if (currentWinnerId === teammateSessionId) {
      const teammateEntry = currentTrick.find(t => (t.playerSessionId || t.playerId) === teammateSessionId);
      const teammateCard = teammateEntry ? getEffectiveCard(teammateEntry.card) : null;
      const isStrongLeader = teammateCard && (
        teammateCard.type === 'wizard' ||
        teammateCard.type === 'dragon' ||
        currentTrick.length === 3 ||
        (teammateCard.value && teammateCard.value >= 10)
      );

      if (isStrongLeader) {
        const trumpSuit = (trumpCard && trumpCard.suit !== 'none') ? trumpCard.suit : (trumpCard?.chosenSuit || 'none');
        const legalCards = hand.map((card, index) => ({ card, index })).filter(item => isValidMove(item.card, hand, currentTrick));

        if (legalCards.length === 1) {
          const c = legalCards[0].card;
          return {
            cardIndex: legalCards[0].index,
            chosenRole: c.type === 'shapeshifter' ? 'jester' : undefined,
            chosenSuit: (c.type === 'cloud' || c.type === 'juggler') ? (trumpSuit !== 'none' ? trumpSuit : 'red') : undefined
          };
        }

        if (legalCards.length > 1) {
          const evaluated = legalCards.map(item => {
            const eff = { ...item.card };
            let role = undefined;
            let suit = undefined;
            if (item.card.type === 'shapeshifter') {
              role = 'jester';
              eff.chosenRole = role;
            }
            if (item.card.type === 'cloud' || item.card.type === 'juggler') {
              suit = (trumpSuit !== 'none') ? trumpSuit : 'red';
              eff.chosenSuit = suit;
            }
            const simTrick = [...currentTrick, { playerId: 'sim_partner_bot', card: eff }];
            const res = evaluateTrickDetails(simTrick, trumpCard);
            return {
              ...item,
              wouldWin: res.winnerPlayerId === 'sim_partner_bot',
              chosenRole: role,
              chosenSuit: suit
            };
          });

          const nonWinners = evaluated.filter(e => !e.wouldWin);
          if (nonWinners.length > 0) {
            // Gezielt niedrige Karten oder gefährliche hohe Fehlfarben abwerfen
            nonWinners.sort((a, b) => {
              // Höchste Sonderkarten (Zauberer & Drache) niemals leichtfertig abwerfen
              const isTopTierA = (a.card.type === 'wizard' || a.card.type === 'dragon');
              const isTopTierB = (b.card.type === 'wizard' || b.card.type === 'dragon');
              if (isTopTierA && !isTopTierB) return 1;
              if (!isTopTierA && isTopTierB) return -1;

              const isSaveA = (a.card.type === 'jester' || a.card.type === 'fairy');
              const isSaveB = (b.card.type === 'jester' || b.card.type === 'fairy');
              if (isSaveA && !isSaveB) return 1;
              if (!isSaveA && isSaveB) return -1;

              const isTrumpA = (a.card.suit === trumpSuit && trumpSuit !== 'none');
              const isTrumpB = (b.card.suit === trumpSuit && trumpSuit !== 'none');

              // Bevorzuge Fehlfarben vor Trumpfkarten zum Abwerfen
              if (!isTrumpA && isTrumpB) return -1;
              if (isTrumpA && !isTrumpB) return 1;

              // Bei Fehlfarben: gefährliche hohe Werte zuerst entsorgen (Sloughing)
              if (!isTrumpA && !isTrumpB) {
                return (b.card.value || 0) - (a.card.value || 0);
              }

              // Bei Trümpfen: schwächste Trümpfe zuerst opfern
              return (a.card.value || 0) - (b.card.value || 0);
            });

            return {
              cardIndex: nonWinners[0].index,
              chosenRole: nonWinners[0].chosenRole,
              chosenSuit: nonWinners[0].chosenSuit
            };
          }
        }
      }
    }
  }

  if (difficulty === 'novice') {
    return chooseNoviceCard(hand, currentTrick, trumpCard, myBid, tricksWon);
  }
  if (difficulty === 'archmage') {
    return chooseArchmageCard(hand, currentTrick, trumpCard, myBid, tricksWon, round, roomContext);
  }
  return chooseMasterCard(hand, currentTrick, trumpCard, myBid, tricksWon, round, roomContext.playedCards || []);
}

// ============================================================================
// 3. SONDERKARTEN-ENTSCHEIDUNGEN (30 JAHRE JUBILÄUMSEDITION)
// ============================================================================

/**
 * Hexe (Witch) Ritual-Tausch für Bots
 */
function chooseBotWitchSwap(bot, trickCards = [], handCards = []) {
  if (!handCards || handCards.length === 0 || !trickCards || trickCards.length === 0) {
    return { handIndex: 0, trickIndex: 0 };
  }

  const diff = bot.difficulty || 'master';
  const swappableTrickCards = [];
  trickCards.forEach((t, idx) => {
    if (t.card && t.card.type !== 'witch') {
      swappableTrickCards.push({ card: t.card, index: idx });
    }
  });

  if (swappableTrickCards.length === 0) {
    return { handIndex: 0, trickIndex: 0 };
  }

  if (diff === 'novice') {
    // Novize tauscht rein zufällig
    return {
      handIndex: Math.floor(Math.random() * handCards.length),
      trickIndex: swappableTrickCards[Math.floor(Math.random() * swappableTrickCards.length)].index
    };
  }

  // Meister & Erzmagier: Finde schwächste Handkarte und beste Stichkarte
  const wantsToWin = (bot.tricksWon < (bot.bid !== null ? bot.bid : 0));

  let bestTrickItem = swappableTrickCards[0];
  if (wantsToWin) {
    // Suche Zauberer oder höchste Karte im Stich
    swappableTrickCards.sort((a, b) => {
      const isWizA = (a.card.type === 'wizard' || a.card.type === 'dragon');
      const isWizB = (b.card.type === 'wizard' || b.card.type === 'dragon');
      if (isWizA && !isWizB) return -1;
      if (!isWizA && isWizB) return 1;
      return (b.card.value || 0) - (a.card.value || 0);
    });
    bestTrickItem = swappableTrickCards[0];
  } else {
    // Suche Narr oder niedrigste Karte im Stich
    swappableTrickCards.sort((a, b) => {
      const isJesterA = (a.card.type === 'jester' || a.card.type === 'fairy');
      const isJesterB = (b.card.type === 'jester' || b.card.type === 'fairy');
      if (isJesterA && !isJesterB) return -1;
      if (!isJesterA && isJesterB) return 1;
      return (a.card.value || 0) - (b.card.value || 0);
    });
    bestTrickItem = swappableTrickCards[0];
  }

  // Schlechteste Handkarte zum Abgeben
  let worstHandIdx = 0;
  if (wantsToWin) {
    // Gib Narr oder schwächste Nicht-Trumpf-Karte ab
    let lowestVal = 999;
    handCards.forEach((c, i) => {
      const val = c.type === 'jester' ? -1 : (c.value || 0);
      if (val < lowestVal) {
        lowestVal = val;
        worstHandIdx = i;
      }
    });
  } else {
    // Gib giftige Mittel- oder Hochkarte ab
    let highestVal = -999;
    handCards.forEach((c, i) => {
      const val = (c.type === 'wizard' || c.type === 'dragon') ? 100 : (c.value || 0);
      if (val > highestVal) {
        highestVal = val;
        worstHandIdx = i;
      }
    });
  }

  return { handIndex: worstHandIdx, trickIndex: bestTrickItem.index };
}

/**
 * Jongleur (Juggler) Tribut-Auswahl für Bots
 */
function chooseBotJugglerPass(bot, handCards = []) {
  if (!handCards || handCards.length === 0) return 0;
  const diff = bot.difficulty || 'master';

  if (diff === 'novice') return 0;

  const wantsToWin = (bot.tricksWon < (bot.bid !== null ? bot.bid : 0));
  if (wantsToWin) {
    // Gib schwächste Karte ab
    let minIdx = 0;
    let minVal = 999;
    handCards.forEach((c, i) => {
      const val = (c.type === 'jester' || c.type === 'fairy') ? -1 : (c.value || 0);
      if (val < minVal) {
        minVal = val;
        minIdx = i;
      }
    });
    return minIdx;
  } else {
    // Gib gefährliche Karte (7-13) an den Nachbarn weiter!
    let maxIdx = 0;
    let maxVal = -999;
    handCards.forEach((c, i) => {
      const val = (c.type === 'wizard' || c.type === 'dragon') ? 100 : (c.value || 0);
      if (val > maxVal) {
        maxVal = val;
        maxIdx = i;
      }
    });
    return maxIdx;
  }
}

/**
 * Wolke (Cloud) Anpassung für Bots
 */
function chooseBotCloudAdjustment(bot, currentBid, tricksWon, hand = []) {
  if (tricksWon > currentBid) return 1;
  if (tricksWon < currentBid) return -1;
  return (hand.length > 0 && bot.difficulty === 'archmage') ? 1 : -1;
}

module.exports = {
  BOT_PROFILES,
  BOT_NAMES,
  createBotPlayer,
  calculateBotBid,
  chooseBotCard,
  chooseBotWitchSwap,
  chooseBotJugglerPass,
  chooseBotCloudAdjustment
};
