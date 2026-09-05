const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  createDeck,
  shuffle,
  evaluateTrick,
  evaluateTrickDetails,
  isValidMove,
  calculatePoints,
  sortCards,
  isForbiddenBid,
  getMaxRounds
} = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../public')));

// In-Memory Speicher für alle aktiven Spielräume
const rooms = {};

// Bereinigt Namen und verhindert HTML-Injections (XSS)
function sanitizeName(name) {
  if (!name || typeof name !== 'string') return 'Spieler';
  const trimmed = name.trim().substring(0, 18);
  return trimmed.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]) || 'Spieler';
}

// Timer-Verwaltung für saubere Resets und Pausen
function clearRoomTimers(room) {
  if (room.timers && room.timers.length > 0) {
    room.timers.forEach(t => clearTimeout(t));
    room.timers = [];
  }
}

function setRoomTimeout(room, fn, ms) {
  if (!room.timers) room.timers = [];
  const t = setTimeout(() => {
    const idx = room.timers.indexOf(t);
    if (idx !== -1) room.timers.splice(idx, 1);
    fn();
  }, ms);
  room.timers.push(t);
  return t;
}

// Prüft und plant das Löschen verwaister Räume (nach 5 Min Inaktivität)
function checkRoomCleanup(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  const allDisconnected = room.players.length === 0 || room.players.every(p => !p.connected);

  if (allDisconnected) {
    if (!room.cleanupTimer) {
      room.cleanupTimer = setTimeout(() => {
        const r = rooms[roomCode];
        if (r && (r.players.length === 0 || r.players.every(p => !p.connected))) {
          clearRoomTimers(r);
          delete rooms[roomCode];
          console.log(`Raum ${roomCode} nach Inaktivität aufgeräumt.`);
        }
      }, 5 * 60 * 1000);
    }
  } else if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
}

// Generiert einen kollisionsfreien 6-stelligen numerischen Raum-Code (100000 - 999999)
function generateUniqueRoomCode() {
  let code;
  let attempts = 0;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    attempts++;
  } while (rooms[code] && attempts < 10000);
  return code;
}

function createNewRoomState(hostSessionId = null, roomCode = '') {
  return {
    players: [],
    roomCode: roomCode,
    gameState: 'lobby',
    edition: 'classic', // 'classic' oder 'anniversary_30'
    round: 1,
    trumpCard: null,
    trumpChooserSessionId: null,
    vampireCopiedCard: null,
    cloudWinnerSessionId: null,
    cloudPlayerSessionId: null,
    cloudNextCallback: null,
    witchPlayerSessionId: null,
    witchNextCallback: null,
    jugglerPassSelections: {},
    jugglerNextLeadSessionId: null,
    jugglerNextCallback: null,
    remainingDeck: [],
    currentTurnIndex: 0,
    dealerIndex: 0,
    currentTrick: [],
    scoreHistory: [],
    hostSessionId: hostSessionId,
    isPaused: false,
    pausedReason: null,
    timers: [],
    cleanupTimer: null
  };
}

io.on('connection', (socket) => {

  // Neues Spiel erstellen mit garantiert einmaligem 6-stelligen Zahlencode
  socket.on('createRoom', ({ playerName, sessionId, roomCode }) => {
    if (!sessionId) {
      socket.emit('lobbyError', { message: 'Ungültige Session-Daten.' });
      return;
    }

    const cleanName = sanitizeName(playerName);
    // Falls ein spezifischer Code angegeben wurde und frei ist (z.B. in Tests), sonst neuen Zahlencode generieren:
    const code = (roomCode && typeof roomCode === 'string' && !rooms[roomCode.trim().toUpperCase()])
      ? roomCode.trim().toUpperCase().substring(0, 10)
      : generateUniqueRoomCode();

    const room = createNewRoomState(sessionId, code);
    const hostPlayer = {
      sessionId,
      socketId: socket.id,
      name: cleanName,
      hand: [],
      bid: null,
      tricksWon: 0,
      totalScore: 0,
      connected: true
    };
    room.players.push(hostPlayer);
    rooms[code] = room;

    socket.join(code);
    socket.emit('roomCreated', { roomCode: code });

    socket.emit('syncGameState', {
      roomCode: code,
      round: 1,
      maxRounds: getMaxRounds(1, room.edition || 'classic'),
      edition: room.edition || 'classic',
      gameState: 'lobby',
      trumpCard: null,
      hand: [],
      currentTrick: [],
      players: getSanitizedPlayers(room.players, 0, room.hostSessionId),
      activePlayerSessionId: null,
      dealerSessionId: sessionId,
      scoreHistory: [],
      hostSessionId: sessionId,
      forbiddenBid: null,
      isPaused: false,
      pausedReason: null,
      isGameOver: false
    });

    io.to(code).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
  });

  // Spieler tritt einem Raum bei
  socket.on('joinRoom', ({ playerName, roomCode, sessionId, createIfNotExists }) => {
    if (!roomCode || typeof roomCode !== 'string' || !sessionId) {
      socket.emit('lobbyError', { message: 'Ungültige Raum- oder Session-Daten.' });
      return;
    }

    const normalizedCode = roomCode.trim().toUpperCase().substring(0, 10);
    const cleanName = sanitizeName(playerName);

    if (!rooms[normalizedCode]) {
      // Abwärtskompatibilität für bestehende automatisierte Tests
      if (createIfNotExists || normalizedCode === 'TESTROOM' || normalizedCode === 'PAUSEROOM') {
        rooms[normalizedCode] = createNewRoomState(null, normalizedCode);
      } else {
        socket.emit('lobbyError', { message: `Kein aktiver Raum mit dem Zahlencode "${normalizedCode}" gefunden. Bitte prüfe die Eingabe oder erstelle ein neues Spiel.` });
        return;
      }
    }

    const room = rooms[normalizedCode];
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }

    const existingPlayer = room.players.find(p => p.sessionId === sessionId);

    if (existingPlayer) {
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      if (cleanName && cleanName !== existingPlayer.name) {
        const nameTaken = room.players.some(p => p.sessionId !== sessionId && p.name.trim().toLowerCase() === cleanName.toLowerCase());
        if (!nameTaken) {
          existingPlayer.name = cleanName;
        }
      }
      socket.join(normalizedCode);

      if (!room.hostSessionId && room.players.length > 0) {
        room.hostSessionId = room.players[0].sessionId;
      }

      // Prüfen, ob alle Spieler wieder verbunden sind
      if (room.isPaused && room.players.every(p => p.connected)) {
        room.isPaused = false;
        room.pausedReason = null;
        io.to(normalizedCode).emit('gameResumed');
      }

      let activePlayer = null;
      if (room.gameState === 'choose_trump') {
        if (room.trumpChooserSessionId) {
          activePlayer = room.players.find(p => p.sessionId === room.trumpChooserSessionId);
        }
        if (!activePlayer) {
          activePlayer = room.players[room.dealerIndex];
        }
      } else if (room.players[room.currentTurnIndex]) {
        activePlayer = room.players[room.currentTurnIndex];
      }

      const isLastPlayer = (room.currentTurnIndex === room.dealerIndex);
      let forbiddenBid = null;
      if (room.gameState === 'bidding' && isLastPlayer) {
        const totalBidsSoFar = room.players.reduce((sum, p) => sum + (p.bid !== null ? p.bid : 0), 0);
        forbiddenBid = room.round - totalBidsSoFar;
        if (forbiddenBid < 0) forbiddenBid = null;
      }

      const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
      const isGameOver = room.gameState === 'round_over' && room.round >= maxRounds;

      socket.emit('syncGameState', {
        roomCode: normalizedCode,
        round: room.round,
        maxRounds: maxRounds,
        edition: room.edition || 'classic',
        gameState: room.gameState,
        trumpCard: room.trumpCard,
        trumpChooserSessionId: room.trumpChooserSessionId,
        hand: (room.round === 1 && existingPlayer.hand && existingPlayer.hand.length > 0)
          ? [{ type: 'blind_card', isBlind: true, id: 'blind-1' }]
          : (existingPlayer.hand || []),
        currentTrick: room.currentTrick,
        players: getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room),
        activePlayerSessionId: activePlayer ? activePlayer.sessionId : null,
        dealerSessionId: room.players[room.dealerIndex] ? room.players[room.dealerIndex].sessionId : null,
        scoreHistory: room.scoreHistory,
        hostSessionId: room.hostSessionId,
        forbiddenBid: forbiddenBid,
        isPaused: room.isPaused,
        pausedReason: room.pausedReason,
        isGameOver: isGameOver,
        vampireCopiedCard: room.vampireCopiedCard,
        cloudWinnerSessionId: room.cloudPlayerSessionId,
        cloudPlayerSessionId: room.cloudPlayerSessionId,
        witchPlayerSessionId: room.witchPlayerSessionId
      });

      if (room.gameState === 'cloud_adjust_bid' && (room.cloudPlayerSessionId === existingPlayer.sessionId || room.cloudWinnerSessionId === existingPlayer.sessionId)) {
        socket.emit('cloudBidAdjustmentPrompt', { currentBid: existingPlayer.bid !== null ? existingPlayer.bid : 0 });
      }

      if (room.gameState === 'witch_swap' && room.witchPlayerSessionId === existingPlayer.sessionId) {
        socket.emit('witchSwapPrompt', {
          trickCards: room.currentTrick,
          handCards: existingPlayer.hand || []
        });
      }

      if (room.gameState === 'juggler_passing' && existingPlayer.hand && existingPlayer.hand.length > 0 && room.jugglerPassSelections[existingPlayer.sessionId] === undefined) {
        socket.emit('jugglerPassPrompt', {
          message: 'Der Jongleur fordert seinen Tribut! Wähle 1 Handkarte zum verdeckten Weitergeben.',
          hand: existingPlayer.hand
        });
      }

      io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
      return;
    }

    if (room.players.length >= 6) {
      socket.emit('lobbyError', { message: 'Der Raum ist voll (maximal 6 Spieler).' });
      return;
    }

    if (room.gameState !== 'lobby') {
      socket.emit('lobbyError', { message: 'Das Spiel läuft bereits.' });
      return;
    }

    // Namens-Duplikat-Prüfung: Kein doppelter Name im selben Raum
    const nameTaken = room.players.some(p => p.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (nameTaken) {
      socket.emit('lobbyError', { message: `Der Name "${cleanName}" ist in diesem Raum bereits vergeben. Bitte wähle einen anderen Spielernamen.` });
      return;
    }

    socket.join(normalizedCode);

    if (room.players.length === 0 || !room.hostSessionId) {
      room.hostSessionId = sessionId;
    }

    const newPlayer = {
      sessionId,
      socketId: socket.id,
      name: cleanName,
      hand: [],
      bid: null,
      tricksWon: 0,
      totalScore: 0,
      connected: true
    };
    room.players.push(newPlayer);

    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
    socket.emit('syncGameState', {
      roomCode: normalizedCode,
      round: room.round,
      maxRounds: maxRounds,
      edition: room.edition || 'classic',
      gameState: room.gameState,
      trumpCard: room.trumpCard,
      hand: [],
      currentTrick: room.currentTrick,
      players: getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId),
      activePlayerSessionId: null,
      dealerSessionId: room.players[room.dealerIndex] ? room.players[room.dealerIndex].sessionId : null,
      scoreHistory: room.scoreHistory,
      hostSessionId: room.hostSessionId,
      forbiddenBid: null,
      isPaused: room.isPaused,
      pausedReason: room.pausedReason,
      isGameOver: false
    });

    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
  });

  // Host ändert die gespielte Edition (classic vs. anniversary_30)
  socket.on('setEdition', ({ roomCode, edition }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Die Edition kann nur im Warteraum vor Spielbeginn geändert werden!' });
      return;
    }

    if (!room.hostSessionId && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host darf die Edition ändern!' });
      return;
    }

    if (!['classic', 'anniversary_30'].includes(edition)) {
      socket.emit('actionError', { message: 'Ungültige Edition.' });
      return;
    }

    room.edition = edition;
    io.to(normalizedCode).emit('editionChanged', { edition: room.edition });
  });

  // Spiel starten (aus der Lobby)
  socket.on('startGame', ({ roomCode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'lobby') return;

    if (!room.hostSessionId && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host darf das Spiel starten!' });
      return;
    }

    const connectedCount = room.players.filter(p => p.connected).length;
    if (connectedCount < 3) {
      socket.emit('actionError', { message: 'Ihr braucht mindestens 3 aktive Spieler zum Starten!' });
      return;
    }

    // Nicht verbundene Spieler vor Spielstart aus der Lobby entfernen
    room.players = room.players.filter(p => p.connected);

    room.round = 1;
    room.dealerIndex = 0;
    room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;
    room.currentTrick = [];
    room.scoreHistory = [];

    dealRound(room, 1, normalizedCode);

    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
    io.to(normalizedCode).emit('gameStarted', {
      round: room.round,
      maxRounds: maxRounds,
      trumpCard: room.trumpCard,
      gameState: room.gameState
    });
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
    notifyTurn(normalizedCode);
  });

  // Teilt Karten für eine Runde aus und sortiert sie
  function dealRound(room, roundNum, roomCode) {
    const code = roomCode || room.roomCode;
    const deck = shuffle(createDeck(room.edition || 'classic'));
    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');

    // 1. Zuerst Handkarten an alle Spieler austeilen
    room.players.forEach(player => {
      player.hand = [];
      player.wonCards = [];
      for (let i = 0; i < roundNum; i++) {
        player.hand.push(deck.pop());
      }
      player.bid = null;
      player.tricksWon = 0;
    });

    // 2. Trumpfkarte aufdecken (falls nicht letzte Runde)
    let trumpCard = null;
    let trumpSuit = 'none';
    let werewolfPlayer = null;
    let takenTrumpCard = null;

    if (roundNum >= maxRounds) {
      trumpCard = null;
      trumpSuit = 'none';
      room.gameState = 'bidding';
      room.trumpChooserSessionId = null;
    } else {
      trumpCard = deck.pop();
      if (!trumpCard) {
        trumpCard = { type: 'jester', value: 0 };
      }

      // Prüfen, ob ein Spieler den Werwolf auf der Hand hält
      werewolfPlayer = room.players.find(p => p.hand && p.hand.some(c => c && c.type === 'werewolf'));

      if (werewolfPlayer) {
        // Werwolf aus Hand entfernen
        const wIdx = werewolfPlayer.hand.findIndex(c => c && c.type === 'werewolf');
        werewolfPlayer.hand.splice(wIdx, 1);

        // Aufgedeckte Trumpfkarte auf die Hand nehmen
        takenTrumpCard = { ...trumpCard };
        werewolfPlayer.hand.push(takenTrumpCard);

        // Werwolf wird zur vorläufigen Trumpfkarte; Werwolf-Spieler wählt die Trumpffarbe!
        trumpCard = { type: 'werewolf_trump_pending', isWerewolf: true, suit: 'none' };
        trumpSuit = 'none';
        room.trumpChooserSessionId = werewolfPlayer.sessionId;
        room.gameState = 'choose_trump';
      } else if (trumpCard.type === 'werewolf') {
        // Werwolf wird vom Deck als Trumpf aufgedeckt -> Geber bestimmt Trumpffarbe
        const dealer = room.players[room.dealerIndex];
        trumpCard = { type: 'werewolf_trump_pending', isWerewolf: true, suit: 'none' };
        trumpSuit = 'none';
        room.trumpChooserSessionId = dealer ? dealer.sessionId : null;
        room.gameState = 'choose_trump';
      } else if (trumpCard.type === 'color') {
        trumpSuit = trumpCard.suit;
        room.gameState = 'bidding';
        room.trumpChooserSessionId = null;
      } else if (['wizard', 'dragon', 'shapeshifter', 'cloud', 'vampire'].includes(trumpCard.type)) {
        const dealer = room.players[room.dealerIndex];
        room.trumpChooserSessionId = dealer ? dealer.sessionId : null;
        room.gameState = 'choose_trump';
      } else {
        // Narr, Fee, Bombe, Hexe, Jongleur als Trumpf -> kein Trumpf
        trumpSuit = 'none';
        room.gameState = 'bidding';
        room.trumpChooserSessionId = null;
      }
    }

    room.trumpCard = trumpCard;
    room.vampireCopiedCard = trumpCard ? { ...trumpCard } : null;
    room.cloudWinnerSessionId = null;
    room.jugglerPassSelections = {};

    room.remainingDeck = deck;
    room.isRound1Blind = (roundNum === 1);

    // Handkarten für alle Spieler final sortieren und Vampire aktualisieren
    room.players.forEach(player => {
      player.hand.forEach(c => {
        if (c && c.type === 'vampire' && room.vampireCopiedCard) {
          c.copiedCard = { ...room.vampireCopiedCard };
        }
      });
      player.hand = sortCards(player.hand, trumpSuit);
      if (room.isRound1Blind) {
        io.to(player.socketId).emit('handDealt', [{ type: 'blind_card', isBlind: true, id: 'blind-1' }]);
      } else {
        io.to(player.socketId).emit('handDealt', player.hand);
      }
    });

    // Falls Werwolf eingetauscht wurde: Event an alle Clients senden
    if (code && werewolfPlayer && takenTrumpCard) {
      io.to(code).emit('werewolfTrumpSwapped', {
        werewolfPlayerName: werewolfPlayer.name,
        werewolfPlayerSessionId: werewolfPlayer.sessionId,
        takenCard: takenTrumpCard,
        newTrumpCard: trumpCard,
        trumpSuit: trumpSuit
      });
    }
  }

  // Nächste Runde einläuten
  function proceedToNextRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.round++;
    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
    if (room.round > maxRounds) return;

    // Geber für die neue Runde weiterrücken
    room.dealerIndex = (room.dealerIndex + 1) % room.players.length;
    room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;
    room.currentTrick = [];

    dealRound(room, room.round, roomCode);

    io.to(roomCode).emit('gameStarted', {
      round: room.round,
      maxRounds: maxRounds,
      trumpCard: room.trumpCard,
      gameState: room.gameState
    });
    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
    notifyTurn(roomCode);
  }

  // Aktuelle Runde neu austeilen (z.B. nach Ausstieg oder Host-Entscheid)
  function reDealCurrentRound(roomCode, reasonMessage) {
    const room = rooms[roomCode];
    if (!room) return;

    clearRoomTimers(room);
    room.currentTrick = [];
    room.isPaused = false;
    room.pausedReason = null;

    if (room.dealerIndex >= room.players.length) {
      room.dealerIndex = 0;
    }
    room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;

    dealRound(room, room.round, roomCode);

    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
    io.to(roomCode).emit('roundReDealt', {
      message: reasonMessage,
      round: room.round,
      maxRounds: maxRounds,
      trumpCard: room.trumpCard,
      gameState: room.gameState
    });
    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
    notifyTurn(roomCode);
  }

  // Raum komplett in die Lobby zurücksetzen
  function resetRoomToLobby(roomCode, message) {
    const room = rooms[roomCode];
    if (!room) return;

    clearRoomTimers(room);
    room.gameState = 'lobby';
    room.round = 1;
    room.trumpCard = null;
    room.currentTurnIndex = 0;
    room.dealerIndex = 0;
    room.currentTrick = [];
    room.scoreHistory = [];
    room.isPaused = false;
    room.pausedReason = null;

    // Getrennte Spieler bereinigen, damit der Warteraum nur aktive Spieler enthält
    room.players = room.players.filter(p => p.connected);

    // Sicherstellen, dass ein verbleibender Spieler Host ist
    if (!room.players.some(p => p.sessionId === room.hostSessionId) && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }

    room.players.forEach(p => {
      p.hand = [];
      p.bid = null;
      p.tricksWon = 0;
      p.totalScore = 0;
    });

    io.to(roomCode).emit('gameResetToLobby', {
      message: message || 'Zurück zur Lobby.',
      roomCode: roomCode,
      players: getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId)
    });
  }

  // Host setzt das Spiel nach Spielende zurück
  socket.on('resetGame', ({ roomCode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) return;

    resetRoomToLobby(normalizedCode, 'Spiel wurde vom Host zurückgesetzt.');
  });

  // Host bricht das pausierte Spiel ab und kehrt in den Warteraum zurück
  socket.on('abortGameToWaitingRoom', ({ roomCode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState === 'lobby') return;

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) return;

    resetRoomToLobby(normalizedCode, 'Spiel wurde vom Host abgebrochen. Zurück im Warteraum.');
  });

  // Host verteilt Runde neu, wenn ein Spieler getrennt ist
  socket.on('hostReDealRound', ({ roomCode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState === 'lobby') return;

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) return;

    // Getrennte Spieler entfernen
    room.players = room.players.filter(p => p.connected);

    if (room.players.length >= 3) {
      reDealCurrentRound(normalizedCode, 'Der Host hat die Runde neu ausgeteilt.');
    } else {
      resetRoomToLobby(normalizedCode, 'Zu wenige Spieler verbleibend (mindestens 3 erforderlich). Zurück zur Lobby.');
    }
  });

  // Geber bzw. Werwolf-Spieler wählt Trumpffarbe
  socket.on('selectTrumpSuit', ({ roomCode, suit }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'choose_trump' || room.isPaused) return;

    const allowedSessionId = room.trumpChooserSessionId || (room.players[room.dealerIndex] ? room.players[room.dealerIndex].sessionId : null);
    const chooser = room.players.find(p => p.sessionId === allowedSessionId);
    if (!chooser || socket.id !== chooser.socketId) return;

    if (!['red', 'blue', 'green', 'yellow'].includes(suit)) return;

    const isWerewolf = room.trumpCard && (room.trumpCard.isWerewolf || room.trumpCard.type === 'werewolf_trump_pending' || room.trumpCard.type === 'werewolf');

    if (isWerewolf) {
      room.trumpCard = {
        type: 'werewolf_trump',
        suit: suit,
        chosenSuit: suit,
        name: 'Werwolf-Trumpf'
      };
      room.trumpSuit = suit;
      room.vampireCopiedCard = { ...room.trumpCard };
    } else {
      room.trumpCard.chosenSuit = suit;
      room.trumpSuit = suit;
      if (room.vampireCopiedCard) {
        room.vampireCopiedCard.chosenSuit = suit;
      }
    }

    // Handkarten aller Spieler mit dem neuen Trumpf nachsortieren
    room.players.forEach(p => {
      p.hand.forEach(c => {
        if (c && c.type === 'vampire' && room.vampireCopiedCard) {
          c.copiedCard = { ...room.vampireCopiedCard };
        }
      });
      p.hand = sortCards(p.hand, suit);
      if (room.round === 1) {
        io.to(p.socketId).emit('handDealt', [{ type: 'blind_card', isBlind: true, id: 'blind-1' }]);
      } else {
        io.to(p.socketId).emit('handDealt', p.hand);
      }
    });

    io.to(normalizedCode).emit('trumpSuitChosen', {
      suit,
      trumpCard: room.trumpCard
    });

    room.gameState = 'bidding';
    notifyTurn(normalizedCode);
  });

  // Spieler gibt Stichvorhersage ab
  socket.on('submitBid', ({ roomCode, bid }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'bidding' || room.isPaused) return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer || socket.id !== currentPlayer.socketId) return;

    const parsedBid = parseInt(bid, 10);
    if (isNaN(parsedBid) || parsedBid < 0 || parsedBid > room.round) return;

    // Serverseitige Geber-Regel (Plus/Minus Eins) validieren
    const isLastPlayer = (room.currentTurnIndex === room.dealerIndex);
    if (isLastPlayer) {
      const totalBidsSoFar = room.players.reduce((sum, p) => sum + (p.bid !== null ? p.bid : 0), 0);
      if (isForbiddenBid(parsedBid, room.round, totalBidsSoFar, true)) {
        socket.emit('actionError', { message: 'Diese Stichansage ist für den Geber nach den Regeln verboten!' });
        return;
      }
    }

    currentPlayer.bid = parsedBid;
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));

    const allBidsPlaced = room.players.every(p => p.bid !== null);

    if (allBidsPlaced) {
      room.gameState = 'playing_tricks';
      room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;
      io.to(normalizedCode).emit('biddingFinished');
      notifyTurn(normalizedCode);
    } else {
      room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
      notifyTurn(normalizedCode);
    }
  });

  // Beendet die Rundenwertung und berechnet Punkte
  function finishRoundScoring(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.gameState = 'round_over';
    io.to(roomCode).emit('trickUpdated', room.currentTrick);

    if (!room.scoreHistory) room.scoreHistory = [];

    const roundEntries = room.players.map(p => {
      const roundPoints = calculatePoints(p.bid !== null ? p.bid : 0, p.tricksWon);
      p.totalScore += roundPoints;
      p.wonCards = [];
      return {
        sessionId: p.sessionId,
        name: p.name,
        bid: p.bid,
        tricksWon: p.tricksWon,
        roundPoints: roundPoints,
        totalScore: p.totalScore
      };
    });

    room.scoreHistory.push({
      round: room.round,
      entries: roundEntries
    });

    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
    const isGameOver = room.round >= maxRounds;

    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
    io.to(roomCode).emit('roundFinished', {
      isGameOver,
      scoreHistory: room.scoreHistory,
      round: room.round
    });
    io.to(roomCode).emit('turnChanged', { activePlayerSessionId: null, gameState: 'round_over' });

    if (!isGameOver) {
      setRoomTimeout(room, () => {
        proceedToNextRound(roomCode);
      }, 4000);
    }
  }

  // Spieler spielt eine Karte aus
  socket.on('playCard', ({ roomCode, cardIndex, chosenRole, chosenSuit, witchSwap }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'playing_tricks' || room.isPaused) return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer || socket.id !== currentPlayer.socketId) return;

    const cardToPlay = currentPlayer.hand[cardIndex];
    if (!cardToPlay) return;

    // Defaults für Runde 1 (wo Spieler blind legt):
    if (room.round === 1) {
      if (cardToPlay.type === 'shapeshifter' && !cardToPlay.chosenRole) {
        cardToPlay.chosenRole = 'wizard';
      }
      if (cardToPlay.type === 'cloud' && !cardToPlay.chosenSuit) {
        cardToPlay.chosenSuit = (room.trumpSuit && room.trumpSuit !== 'none') ? room.trumpSuit : 'red';
      }
      if (cardToPlay.type === 'juggler' && !cardToPlay.chosenSuit) {
        cardToPlay.chosenSuit = (room.trumpSuit && room.trumpSuit !== 'none') ? room.trumpSuit : 'red';
      }
    }

    // Gestaltenwandler: Rolle setzen
    if (cardToPlay.type === 'shapeshifter') {
      cardToPlay.chosenRole = (chosenRole === 'jester') ? 'jester' : 'wizard';
    }

    // Wolke: Farbe setzen
    if (cardToPlay.type === 'cloud') {
      cardToPlay.chosenSuit = ['red', 'blue', 'green', 'yellow'].includes(chosenSuit) ? chosenSuit : 'red';
    }

    // Jongleur: Farbe setzen
    if (cardToPlay.type === 'juggler') {
      cardToPlay.chosenSuit = ['red', 'blue', 'green', 'yellow'].includes(chosenSuit) ? chosenSuit : 'red';
    }

    // Vampir: Falls Trumpf ein Werwolf ist -> sofort neue Trumpfkarte aufdecken!
    if (cardToPlay.type === 'vampire') {
      const isWerewolfTrump = room.trumpCard && (
        room.trumpCard.type === 'werewolf_trump' ||
        room.trumpCard.type === 'werewolf_trump_pending' ||
        room.trumpCard.type === 'werewolf' ||
        room.trumpCard.isWerewolf
      );

      if (isWerewolfTrump) {
        let newTrump = (room.remainingDeck && room.remainingDeck.length > 0)
          ? room.remainingDeck.pop()
          : { type: 'jester', value: 0 };

        if (newTrump.type === 'color') {
          room.trumpSuit = newTrump.suit;
        } else if (['wizard', 'dragon', 'shapeshifter', 'cloud', 'vampire'].includes(newTrump.type)) {
          if (!newTrump.chosenSuit) newTrump.chosenSuit = room.trumpSuit || 'red';
          room.trumpSuit = newTrump.chosenSuit;
        } else {
          room.trumpSuit = 'none';
        }

        room.trumpCard = newTrump;
        room.vampireCopiedCard = { ...newTrump };
        cardToPlay.copiedCard = { ...newTrump };

        // Handkarten aller Spieler mit neuem Trumpf sortieren
        room.players.forEach(p => {
          p.hand.forEach(c => {
            if (c && c.type === 'vampire') {
              c.copiedCard = { ...newTrump };
            }
          });
          p.hand = sortCards(p.hand, room.trumpSuit);
          if (room.round === 1) {
            io.to(p.socketId).emit('handDealt', [{ type: 'blind_card', isBlind: true, id: 'blind-1' }]);
          } else {
            io.to(p.socketId).emit('handDealt', p.hand);
          }
        });

        io.to(normalizedCode).emit('vampireRevealedNewTrump', {
          vampirePlayerName: currentPlayer.name,
          vampirePlayerSessionId: currentPlayer.sessionId,
          newTrumpCard: newTrump,
          trumpSuit: room.trumpSuit
        });
      } else if (room.vampireCopiedCard) {
        cardToPlay.copiedCard = { ...room.vampireCopiedCard };
      }
    }

    if (!isValidMove(cardToPlay, currentPlayer.hand, room.currentTrick)) {
      socket.emit('invalidMove', { message: 'Du musst die angespielte Farbe bedienen!' });
      return;
    }

    const playedCard = currentPlayer.hand.splice(cardIndex, 1)[0];

    // Handkarten erst NACH dem Entfernen der gespielten Karte sortieren!
    let currentTrumpSuit = 'none';
    if (room.trumpCard) {
      currentTrumpSuit = room.trumpCard.chosenSuit || (room.trumpCard.type === 'color' ? room.trumpCard.suit : 'none');
    }
    currentPlayer.hand = sortCards(currentPlayer.hand, currentTrumpSuit);

    room.currentTrick.push({
      playerName: currentPlayer.name,
      playerSessionId: currentPlayer.sessionId,
      card: playedCard
    });

    if (room.round === 1) {
      io.to(currentPlayer.socketId).emit('handDealt', []);
    } else {
      io.to(currentPlayer.socketId).emit('handDealt', currentPlayer.hand);
    }
    io.to(normalizedCode).emit('trickUpdated', room.currentTrick);
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));

    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;

    // Wenn alle Spieler eine Karte gelegt haben -> Stich auswerten
    if (room.currentTrick.length === room.players.length) {
      room.gameState = 'evaluating_trick';

      const trickResult = evaluateTrickDetails(
        room.currentTrick.map(t => ({ playerId: t.playerSessionId, card: t.card })),
        room.trumpCard
      );

      const isBombed = trickResult.isBombed;
      const winnerSessionId = trickResult.winnerPlayerId;
      const nextLeadSessionId = trickResult.nextLeadPlayerId;

      const winner = winnerSessionId ? room.players.find(p => p.sessionId === winnerSessionId) : null;
      const nextLeadPlayer = nextLeadSessionId ? room.players.find(p => p.sessionId === nextLeadSessionId) : null;

      if (winner) {
        winner.tricksWon += 1;
        io.to(normalizedCode).emit('trickWinner', {
          winnerName: winner.name,
          winnerSessionId: winner.sessionId,
          isBombed: false
        });
        io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
      } else if (isBombed) {
        io.to(normalizedCode).emit('trickWinner', {
          winnerName: null,
          winnerSessionId: null,
          isBombed: true,
          nextLeadName: nextLeadPlayer ? nextLeadPlayer.name : null,
          nextLeadSessionId: nextLeadSessionId
        });
      }

      // Bombe zerstört NICHT den Jongleur oder die Hexe, aber neutralisiert die Wolke!
      const hadJuggler = room.currentTrick.some(t => t.card && (t.card.type === 'juggler' || (t.card.type === 'vampire' && t.card.copiedCard && t.card.copiedCard.type === 'juggler')));
      const hadCloud = !isBombed && room.currentTrick.some(t => t.card && (t.card.type === 'cloud' || (t.card.type === 'vampire' && t.card.copiedCard && t.card.copiedCard.type === 'cloud')));
      const hadWitch = room.currentTrick.some(t => t.card && t.card.type === 'witch');

      setRoomTimeout(room, () => {
        // Pipeline: Wolke -> Hexe -> Jongleur -> Stich aufräumen & weiter
        function stepCloud(next) {
          if (!hadCloud) return next();
          const cloudEntry = room.currentTrick.find(t => t.card && (t.card.type === 'cloud' || (t.card.type === 'vampire' && t.card.copiedCard && t.card.copiedCard.type === 'cloud')));
          const cloudPlayer = cloudEntry ? room.players.find(p => p.sessionId === cloudEntry.playerSessionId) : null;
          if (!cloudPlayer || !cloudPlayer.connected) return next();

          room.gameState = 'cloud_adjust_bid';
          room.cloudPlayerSessionId = cloudPlayer.sessionId;
          room.cloudNextCallback = next;

          io.to(normalizedCode).emit('cloudBidAdjustmentPending', {
            playerName: cloudPlayer.name,
            playerSessionId: cloudPlayer.sessionId
          });

          io.to(cloudPlayer.socketId).emit('cloudBidAdjustmentPrompt', {
            currentBid: cloudPlayer.bid !== null ? cloudPlayer.bid : 0
          });

          io.to(normalizedCode).emit('turnChanged', {
            activePlayerSessionId: cloudPlayer.sessionId,
            gameState: 'cloud_adjust_bid'
          });
        }

        function stepWitch(next) {
          if (!hadWitch) return next();
          const witchEntry = room.currentTrick.find(t => t.card && t.card.type === 'witch');
          const witchPlayer = witchEntry ? room.players.find(p => p.sessionId === witchEntry.playerSessionId) : null;

          const swappableTrickCards = room.currentTrick.some(t => t.card && t.card.type !== 'witch');
          const canSwap = witchPlayer && witchPlayer.connected && witchPlayer.hand && witchPlayer.hand.length > 0 && swappableTrickCards;

          if (!canSwap) return next();

          room.gameState = 'witch_swap';
          room.witchPlayerSessionId = witchPlayer.sessionId;
          room.witchNextCallback = next;

          io.to(normalizedCode).emit('witchSwapPending', {
            playerName: witchPlayer.name,
            playerSessionId: witchPlayer.sessionId
          });

          io.to(witchPlayer.socketId).emit('witchSwapPrompt', {
            trickCards: room.currentTrick,
            handCards: witchPlayer.hand
          });

          io.to(normalizedCode).emit('turnChanged', {
            activePlayerSessionId: witchPlayer.sessionId,
            gameState: 'witch_swap'
          });
        }

        function stepJuggler(next) {
          const anyPlayerHasCards = room.players.some(p => p.hand && p.hand.length > 0);
          if (!hadJuggler || !anyPlayerHasCards) return next();

          room.gameState = 'juggler_passing';
          room.jugglerPassSelections = {};
          room.jugglerNextLeadSessionId = nextLeadSessionId;
          room.jugglerNextCallback = next;

          io.to(normalizedCode).emit('trickUpdated', []);
          room.players.forEach(p => {
            if (p.connected && p.hand && p.hand.length > 0) {
              io.to(p.socketId).emit('jugglerPassPrompt', {
                message: 'Der Jongleur fordert seinen Tribut! Wähle 1 Handkarte zum verdeckten Weitergeben.',
                hand: p.hand
              });
            }
          });
          io.to(normalizedCode).emit('turnChanged', { activePlayerSessionId: null, gameState: 'juggler_passing' });
        }

        function stepFinish() {
          if (winner) {
            if (!winner.wonCards) winner.wonCards = [];
            winner.wonCards.push(...room.currentTrick.map(t => t.card));
          }
          room.currentTrick = [];

          const anyPlayerHasCards = room.players.some(p => p.hand && p.hand.length > 0);
          if (!anyPlayerHasCards) {
            finishRoundScoring(normalizedCode);
          } else {
            room.gameState = 'playing_tricks';
            const nextIndex = room.players.findIndex(p => p.sessionId === nextLeadSessionId);
            room.currentTurnIndex = nextIndex !== -1 ? nextIndex : 0;
            io.to(normalizedCode).emit('trickUpdated', room.currentTrick);
            notifyTurn(normalizedCode);
          }
        }

        // Starte Pipeline: Wolke -> Hexe -> Jongleur -> Finish
        stepCloud(() => {
          stepWitch(() => {
            stepJuggler(() => {
              stepFinish();
            });
          });
        });
      }, 3000);

      io.to(normalizedCode).emit('turnChanged', { activePlayerSessionId: null, gameState: 'evaluating_trick' });
    } else {
      notifyTurn(normalizedCode);
    }
  });

  // Spieler wählt verdeckt eine Handkarte zum Weitergeben an den linken Nachbarn (Jongleur)
  socket.on('submitJugglerPassCard', ({ roomCode, cardIndex }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'juggler_passing' || room.isPaused) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !player.hand || player.hand.length === 0) return;

    const cIdx = parseInt(cardIndex, 10);
    if (isNaN(cIdx) || cIdx < 0 || cIdx >= player.hand.length) return;

    room.jugglerPassSelections[player.sessionId] = cIdx;
    socket.emit('jugglerCardConfirmed', { cardIndex: cIdx });

    const activePlayers = room.players.filter(p => p.connected && p.hand && p.hand.length > 0);
    io.to(normalizedCode).emit('jugglerPassProgress', {
      selectedCount: Object.keys(room.jugglerPassSelections).length,
      totalCount: activePlayers.length
    });

    const allSelected = activePlayers.every(p => room.jugglerPassSelections[p.sessionId] !== undefined);

    if (allSelected) {
      executeJugglerPassing(normalizedCode);
    }
  });

  function executeJugglerPassing(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'juggler_passing') return;

    // Für jeden Spieler die gewählte Handkarte entnehmen
    const passedCards = [];
    room.players.forEach(p => {
      const selIdx = (room.jugglerPassSelections[p.sessionId] !== undefined)
        ? room.jugglerPassSelections[p.sessionId]
        : 0;
      const passedCard = p.hand.splice(selIdx, 1)[0] || p.hand.pop();
      passedCards.push({ fromPlayer: p, card: passedCard });
    });

    let trumpSuit = 'none';
    if (room.trumpCard) {
      trumpSuit = room.trumpCard.chosenSuit || (room.trumpCard.type === 'color' ? room.trumpCard.suit : 'none');
    }

    // Im Uhrzeigersinn an den linken Nachbarn übergeben (p[i] gibt an p[(i+1)%N])
    const N = room.players.length;
    for (let i = 0; i < N; i++) {
      const receiver = room.players[(i + 1) % N];
      const passedItem = passedCards[i];
      receiver.hand.push(passedItem.card);
      receiver.hand = sortCards(receiver.hand, trumpSuit);

      // Private Zustellung nur an den jeweiligen Empfänger (Niemand sonst sieht die Karte!)
      io.to(receiver.socketId).emit('handDealt', receiver.hand);
      io.to(receiver.socketId).emit('jugglerCardReceived', {
        card: passedItem.card,
        fromPlayerName: passedItem.fromPlayer.name
      });
    }

    // Öffentliche Meldung an den Tisch (ohne Karten zu verraten!)
    io.to(roomCode).emit('jugglerPassingComplete', {
      message: 'Alle Magier haben eine Karte verdeckt nach links weitergegeben.'
    });
    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));

    room.jugglerPassSelections = {};

    setRoomTimeout(room, () => {
      const nextCb = room.jugglerNextCallback;
      room.jugglerNextCallback = null;
      if (typeof nextCb === 'function') {
        nextCb();
      } else {
        const anyPlayerHasCards = room.players.some(p => p.hand && p.hand.length > 0);
        if (!anyPlayerHasCards) {
          finishRoundScoring(roomCode);
        } else {
          room.gameState = 'playing_tricks';
          const nextLeadSessionId = room.jugglerNextLeadSessionId;
          const nextIndex = room.players.findIndex(p => p.sessionId === nextLeadSessionId);
          room.currentTurnIndex = nextIndex !== -1 ? nextIndex : 0;
          io.to(roomCode).emit('trickUpdated', room.currentTrick);
          notifyTurn(roomCode);
        }
      }
    }, 2500);
  }

  // Spieler, der die Wolke gespielt hat, passt seine Stichvorhersage um +1 oder -1 an
  socket.on('submitCloudBidAdjustment', ({ roomCode, adjustment }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'cloud_adjust_bid' || room.isPaused) return;

    const player = room.players.find(p => p.sessionId === room.cloudPlayerSessionId || p.sessionId === room.cloudWinnerSessionId);
    if (!player || socket.id !== player.socketId) return;

    const delta = parseInt(adjustment, 10);
    if (delta !== 1 && delta !== -1) return;

    const oldBid = player.bid !== null ? player.bid : 0;
    const newBid = Math.max(0, oldBid + delta);
    player.bid = newBid;

    io.to(normalizedCode).emit('cloudBidAdjusted', {
      playerName: player.name,
      oldBid: oldBid,
      newBid: newBid
    });
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));

    const nextCb = room.cloudNextCallback;
    room.cloudWinnerSessionId = null;
    room.cloudPlayerSessionId = null;
    room.cloudNextCallback = null;

    if (typeof nextCb === 'function') {
      nextCb();
    } else {
      const anyCards = room.players.some(p => p.hand && p.hand.length > 0);
      if (!anyCards) {
        finishRoundScoring(normalizedCode);
      } else {
        room.gameState = 'playing_tricks';
        notifyTurn(normalizedCode);
      }
    }
  });

  // Hexen-Spieler tauscht nach Beenden des Stichs 1 Karte aus dem Stich mit 1 Karte aus der Hand
  socket.on('submitWitchSwap', ({ roomCode, trickCardIndex, handCardIndex }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'witch_swap' || room.isPaused) return;

    const player = room.players.find(p => p.sessionId === room.witchPlayerSessionId);
    if (!player || socket.id !== player.socketId) return;

    const tIdx = parseInt(trickCardIndex, 10);
    const hIdx = parseInt(handCardIndex, 10);

    if (isNaN(tIdx) || isNaN(hIdx)) return;
    if (tIdx < 0 || tIdx >= room.currentTrick.length) return;
    if (hIdx < 0 || hIdx >= player.hand.length) return;

    // Aus dem Stich darf nicht die Hexe selbst gewählt werden
    const trickEntry = room.currentTrick[tIdx];
    if (!trickEntry || !trickEntry.card || trickEntry.card.type === 'witch') {
      socket.emit('actionError', { message: 'Du darfst nicht die Hexe selbst aus dem Stich nehmen!' });
      return;
    }

    const takenCard = trickEntry.card;
    const givenCard = player.hand[hIdx];

    room.currentTrick[tIdx].card = givenCard;
    player.hand[hIdx] = takenCard;

    let currentTrumpSuit = 'none';
    if (room.trumpCard) {
      currentTrumpSuit = room.trumpCard.chosenSuit || (room.trumpCard.type === 'color' ? room.trumpCard.suit : 'none');
    }
    player.hand = sortCards(player.hand, currentTrumpSuit);

    if (room.round === 1) {
      io.to(player.socketId).emit('handDealt', []);
    } else {
      io.to(player.socketId).emit('handDealt', player.hand);
    }
    io.to(normalizedCode).emit('trickUpdated', room.currentTrick);

    io.to(normalizedCode).emit('witchSwapShowcase', {
      witchPlayerName: player.name,
      playerName: player.name,
      playerSessionId: player.sessionId,
      takenCard,
      givenCard,
      updatedTrick: room.currentTrick
    });

    const nextCb = room.witchNextCallback;
    room.witchPlayerSessionId = null;
    room.witchNextCallback = null;

    setRoomTimeout(room, () => {
      if (typeof nextCb === 'function') {
        nextCb();
      } else {
        const anyCards = room.players.some(p => p.hand && p.hand.length > 0);
        if (!anyCards) {
          finishRoundScoring(normalizedCode);
        } else {
          room.gameState = 'playing_tricks';
          notifyTurn(normalizedCode);
        }
      }
    }, 3000);
  });

  // Spieler verlässt den Raum freiwillig (Leave-Button)
  socket.on('leaveRoom', ({ roomCode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) return;

    const leavingPlayer = room.players.splice(playerIndex, 1)[0];
    socket.leave(normalizedCode);

    if (playerIndex < room.dealerIndex) {
      room.dealerIndex--;
    } else if (room.dealerIndex >= room.players.length && room.players.length > 0) {
      room.dealerIndex = 0;
    }

    // Host migrieren, falls der scheidende Spieler Host war
    if (room.hostSessionId === leavingPlayer.sessionId && room.players.length > 0) {
      const nextHost = room.players.find(p => p.connected) || room.players[0];
      room.hostSessionId = nextHost.sessionId;
    }

    if (room.players.length === 0) {
      clearRoomTimers(room);
      delete rooms[normalizedCode];
      return;
    }

    if (room.gameState === 'lobby') {
      io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
    } else {
      // Während des Spiels verlassen:
      if (room.players.length >= 3) {
        reDealCurrentRound(normalizedCode, `${leavingPlayer.name} hat das Spiel verlassen. Runde ${room.round} wird neu gestartet.`);
      } else {
        resetRoomToLobby(normalizedCode, `${leavingPlayer.name} hat das Spiel verlassen. Weniger als 3 Spieler im Raum – zurück zur Lobby.`);
      }
    }
  });

  // Verbindungsabbruch
  socket.on('disconnect', () => {
    for (const code in rooms) {
      const room = rooms[code];
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.connected = false;

        // Host migrieren, falls der scheidende Spieler Host war
        if (room.hostSessionId === player.sessionId) {
          const nextHost = room.players.find(p => p.connected && p.sessionId !== player.sessionId);
          if (nextHost) room.hostSessionId = nextHost.sessionId;
        }

        // Im laufenden Spiel: Spiel pausieren
        if (room.gameState !== 'lobby') {
          room.isPaused = true;
          room.pausedReason = { playerName: player.name, sessionId: player.sessionId };
          clearRoomTimers(room);
          io.to(code).emit('gamePaused', {
            pausedPlayerName: player.name,
            sessionId: player.sessionId
          });
        }

        io.to(code).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
        checkRoomCleanup(code);
        break;
      }
    }
  });

  function notifyTurn(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    let activePlayer = null;
    if (room.gameState === 'choose_trump') {
      if (room.trumpChooserSessionId) {
        activePlayer = room.players.find(p => p.sessionId === room.trumpChooserSessionId);
      }
      if (!activePlayer) {
        activePlayer = room.players[room.dealerIndex];
      }
    } else if (room.players[room.currentTurnIndex]) {
      activePlayer = room.players[room.currentTurnIndex];
    }

    const isLastPlayer = (room.currentTurnIndex === room.dealerIndex);
    let forbiddenBid = null;

    if (room.gameState === 'bidding' && isLastPlayer) {
      const totalBidsSoFar = room.players.reduce((sum, p) => sum + (p.bid !== null ? p.bid : 0), 0);
      forbiddenBid = room.round - totalBidsSoFar;
      if (forbiddenBid < 0) forbiddenBid = null;
    }

    io.to(roomCode).emit('turnChanged', {
      activePlayerSessionId: activePlayer ? activePlayer.sessionId : null,
      gameState: room.gameState,
      forbiddenBid: forbiddenBid
    });
  }

  function getSanitizedPlayers(players, dealerIndex, hostSessionId, room = null) {
    return players.map((p, idx) => {
      const pData = {
        sessionId: p.sessionId,
        name: p.name,
        bid: p.bid,
        tricksWon: p.tricksWon,
        totalScore: p.totalScore,
        connected: p.connected,
        isDealer: idx === dealerIndex,
        isHost: p.sessionId === hostSessionId,
        handCount: p.hand ? p.hand.length : 0
      };
      if (room && room.round === 1 && p.hand && p.hand[0]) {
        pData.round1Card = p.hand[0];
      }
      return pData;
    });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server läuft! Öffne http://localhost:${PORT}`);
});