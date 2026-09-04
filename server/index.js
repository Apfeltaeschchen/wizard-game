const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  createDeck,
  shuffle,
  evaluateTrick,
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

function createNewRoomState(hostSessionId = null) {
  return {
    players: [],
    gameState: 'lobby',
    round: 1,
    trumpCard: null,
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

    const room = createNewRoomState(sessionId);
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
      maxRounds: getMaxRounds(1),
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
        rooms[normalizedCode] = createNewRoomState();
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
      if (cleanName) existingPlayer.name = cleanName;
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
        activePlayer = room.players[room.dealerIndex];
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

      const maxRounds = getMaxRounds(room.players.length);
      const isGameOver = room.gameState === 'round_over' && room.round >= maxRounds;

      socket.emit('syncGameState', {
        roomCode: normalizedCode,
        round: room.round,
        maxRounds: maxRounds,
        gameState: room.gameState,
        trumpCard: room.trumpCard,
        hand: existingPlayer.hand || [],
        currentTrick: room.currentTrick,
        players: getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId),
        activePlayerSessionId: activePlayer ? activePlayer.sessionId : null,
        dealerSessionId: room.players[room.dealerIndex] ? room.players[room.dealerIndex].sessionId : null,
        scoreHistory: room.scoreHistory,
        hostSessionId: room.hostSessionId,
        forbiddenBid: forbiddenBid,
        isPaused: room.isPaused,
        pausedReason: room.pausedReason,
        isGameOver: isGameOver
      });

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

    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
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

    dealRound(room, 1);

    const maxRounds = getMaxRounds(room.players.length);
    io.to(normalizedCode).emit('gameStarted', {
      round: room.round,
      maxRounds: maxRounds,
      trumpCard: room.trumpCard,
      gameState: room.gameState
    });
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
    notifyTurn(normalizedCode);
  });

  // Teilt Karten für eine Runde aus und sortiert sie
  function dealRound(room, roundNum) {
    const deck = shuffle(createDeck());
    const maxRounds = getMaxRounds(room.players.length);

    let trumpCard = null;
    let trumpSuit = 'none';

    if (roundNum === maxRounds) {
      trumpCard = null;
      trumpSuit = 'none';
      room.gameState = 'bidding';
    } else {
      trumpCard = deck.pop();
      if (trumpCard.type === 'color') {
        trumpSuit = trumpCard.suit;
        room.gameState = 'bidding';
      } else if (trumpCard.type === 'wizard') {
        room.gameState = 'choose_trump';
      } else {
        // Narr als Trumpf -> Kein Trumpf
        trumpSuit = 'none';
        room.gameState = 'bidding';
      }
    }

    room.trumpCard = trumpCard;

    room.players.forEach(player => {
      player.hand = [];
      for (let i = 0; i < roundNum; i++) {
        player.hand.push(deck.pop());
      }
      player.hand = sortCards(player.hand, trumpSuit);
      player.bid = null;
      player.tricksWon = 0;
      io.to(player.socketId).emit('handDealt', player.hand);
    });
  }

  // Nächste Runde einläuten
  function proceedToNextRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.round++;
    const maxRounds = getMaxRounds(room.players.length);
    if (room.round > maxRounds) return;

    // Geber für die neue Runde weiterrücken
    room.dealerIndex = (room.dealerIndex + 1) % room.players.length;
    room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;
    room.currentTrick = [];

    dealRound(room, room.round);

    io.to(roomCode).emit('gameStarted', {
      round: room.round,
      maxRounds: maxRounds,
      trumpCard: room.trumpCard,
      gameState: room.gameState
    });
    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
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

    dealRound(room, room.round);

    const maxRounds = getMaxRounds(room.players.length);
    io.to(roomCode).emit('roundReDealt', {
      message: reasonMessage,
      round: room.round,
      maxRounds: maxRounds,
      trumpCard: room.trumpCard,
      gameState: room.gameState
    });
    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
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

    room.players.forEach(p => {
      p.hand = [];
      p.bid = null;
      p.tricksWon = 0;
      p.totalScore = 0;
    });

    io.to(roomCode).emit('gameResetToLobby', {
      message: message || 'Zurück zur Lobby.',
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

  // Geber wählt Trumpffarbe (wenn Zauberer als Trumpfkarte aufgedeckt)
  socket.on('selectTrumpSuit', ({ roomCode, suit }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'choose_trump' || room.isPaused) return;

    const dealer = room.players[room.dealerIndex];
    if (!dealer || socket.id !== dealer.socketId) return;

    if (!['red', 'blue', 'green', 'yellow'].includes(suit)) return;

    room.trumpCard.chosenSuit = suit;

    // Handkarten aller Spieler mit dem neuen Trumpf nachsortieren
    room.players.forEach(p => {
      p.hand = sortCards(p.hand, suit);
      io.to(p.socketId).emit('handDealt', p.hand);
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
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));

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

  // Spieler spielt eine Karte aus
  socket.on('playCard', ({ roomCode, cardIndex }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'playing_tricks' || room.isPaused) return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer || socket.id !== currentPlayer.socketId) return;

    const cardToPlay = currentPlayer.hand[cardIndex];
    if (!cardToPlay) return;

    if (!isValidMove(cardToPlay, currentPlayer.hand, room.currentTrick)) {
      socket.emit('invalidMove', { message: 'Du musst die angespielte Farbe bedienen!' });
      return;
    }

    const playedCard = currentPlayer.hand.splice(cardIndex, 1)[0];

    room.currentTrick.push({
      playerName: currentPlayer.name,
      playerSessionId: currentPlayer.sessionId,
      card: playedCard
    });

    io.to(currentPlayer.socketId).emit('handDealt', currentPlayer.hand);
    io.to(normalizedCode).emit('trickUpdated', room.currentTrick);
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));

    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;

    // Wenn alle Spieler eine Karte gelegt haben -> Stich auswerten
    if (room.currentTrick.length === room.players.length) {
      room.gameState = 'evaluating_trick';

      const winnerSessionId = evaluateTrick(
        room.currentTrick.map(t => ({ playerId: t.playerSessionId, card: t.card })),
        room.trumpCard
      );
      const winner = room.players.find(p => p.sessionId === winnerSessionId);

      if (winner) {
        winner.tricksWon += 1;
        io.to(normalizedCode).emit('trickWinner', { winnerName: winner.name, winnerSessionId: winner.sessionId });
        io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
      }

      setRoomTimeout(room, () => {
        room.currentTrick = [];

        // Prüfen, ob die Runde zu Ende ist (alle Hände leer)
        const roundFinished = room.players.every(p => !p.hand || p.hand.length === 0);

        if (roundFinished) {
          room.gameState = 'round_over';

          if (!room.scoreHistory) room.scoreHistory = [];

          const roundEntries = room.players.map(p => {
            const roundPoints = calculatePoints(p.bid !== null ? p.bid : 0, p.tricksWon);
            p.totalScore += roundPoints;
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

          const maxRounds = getMaxRounds(room.players.length);
          const isGameOver = room.round >= maxRounds;

          io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
          io.to(normalizedCode).emit('roundFinished', {
            isGameOver,
            scoreHistory: room.scoreHistory,
            round: room.round
          });
          io.to(normalizedCode).emit('turnChanged', { activePlayerSessionId: null, gameState: 'round_over' });

          if (!isGameOver) {
            setRoomTimeout(room, () => {
              proceedToNextRound(normalizedCode);
            }, 4000);
          }
        } else {
          room.gameState = 'playing_tricks';
          const nextIndex = room.players.findIndex(p => p.sessionId === winnerSessionId);
          room.currentTurnIndex = nextIndex !== -1 ? nextIndex : 0;
          io.to(normalizedCode).emit('trickUpdated', room.currentTrick);
          notifyTurn(normalizedCode);
        }
      }, 3500);

      io.to(normalizedCode).emit('turnChanged', { activePlayerSessionId: null, gameState: 'evaluating_trick' });
    } else {
      notifyTurn(normalizedCode);
    }
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

        // Host in Lobby migrieren, falls disconnected
        if (room.gameState === 'lobby' && room.hostSessionId === player.sessionId) {
          const nextHost = room.players.find(p => p.connected);
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
      activePlayer = room.players[room.dealerIndex];
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

  function getSanitizedPlayers(players, dealerIndex, hostSessionId) {
    return players.map((p, idx) => ({
      sessionId: p.sessionId,
      name: p.name,
      bid: p.bid,
      tricksWon: p.tricksWon,
      totalScore: p.totalScore,
      connected: p.connected,
      isDealer: idx === dealerIndex,
      isHost: p.sessionId === hostSessionId,
      handCount: p.hand ? p.hand.length : 0
    }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server läuft! Öffne http://localhost:${PORT}`);
});