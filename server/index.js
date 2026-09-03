const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createDeck, shuffle, evaluateTrick, isValidMove, calculatePoints, sortCards } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../public')));

const rooms = {}; 

io.on('connection', (socket) => {

  socket.on('joinRoom', ({ playerName, roomCode, sessionId }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = { 
        players: [], 
        gameState: 'lobby',
        round: 1,
        trumpCard: null,
        currentTurnIndex: 0,
        dealerIndex: 0,
        currentTrick: [],
        scoreHistory: [],
        hostSessionId: null
      };
    }
    
    const room = rooms[roomCode];
    const existingPlayer = room.players.find(p => p.sessionId === sessionId);

    if (existingPlayer) {
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      socket.join(roomCode);

      if (!room.hostSessionId && room.players.length > 0) {
        room.hostSessionId = room.players[0].sessionId;
      }

      let activePlayer;
      if (room.gameState === 'choose_trump') {
        activePlayer = room.players[room.dealerIndex];
      } else {
        activePlayer = room.players[room.currentTurnIndex];
      }

      const isLastPlayer = (room.currentTurnIndex === room.dealerIndex);
      let forbiddenBid = null;
      if (room.gameState === 'bidding' && isLastPlayer) {
        const totalBidsSoFar = room.players.reduce((sum, p) => sum + (p.bid !== null ? p.bid : 0), 0);
        forbiddenBid = room.round - totalBidsSoFar;
        if (forbiddenBid < 0) forbiddenBid = null;
      }

      socket.emit('syncGameState', {
        roomCode,
        round: room.round,
        gameState: room.gameState,
        trumpCard: room.trumpCard,
        hand: existingPlayer.hand,
        currentTrick: room.currentTrick,
        players: getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId),
        activePlayerSessionId: activePlayer ? activePlayer.sessionId : null,
        dealerSessionId: room.players[room.dealerIndex].sessionId,
        scoreHistory: room.scoreHistory,
        hostSessionId: room.hostSessionId,
        forbiddenBid: forbiddenBid
      });

      io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
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

    socket.join(roomCode);

    if (room.players.length === 0 || !room.hostSessionId) {
      room.hostSessionId = sessionId;
    }

    const newPlayer = { 
      sessionId, 
      socketId: socket.id, 
      name: playerName, 
      hand: [], 
      bid: null, 
      tricksWon: 0, 
      totalScore: 0,
      connected: true 
    };
    room.players.push(newPlayer);

    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
  });

  socket.on('startGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'lobby') return;

    if (!room.hostSessionId && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host darf das Spiel starten!' });
      return;
    }

    if (room.players.length < 3) {
      socket.emit('actionError', { message: 'Ihr braucht mindestens 3 Spieler zum Starten!' });
      return;
    }

    room.round = 1;
    room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length; 
    room.currentTrick = [];

    const deck = shuffle(createDeck());

    room.players.forEach(player => {
      player.hand = sortCards([deck.pop()]);
      player.bid = null;
      player.tricksWon = 0;
      io.to(player.socketId).emit('handDealt', player.hand);
    });

    room.trumpCard = deck.pop();

    if (room.trumpCard && room.trumpCard.type === 'wizard') {
      room.gameState = 'choose_trump';
    } else {
      room.gameState = 'bidding';
    }

    io.to(roomCode).emit('gameStarted', { round: room.round, trumpCard: room.trumpCard, gameState: room.gameState });
    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
    notifyTurn(roomCode);
  });

  function proceedToNextRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.round++;
    const maxRounds = Math.floor(60 / room.players.length);
    if (room.round > maxRounds) return;

    room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;
    room.currentTrick = [];

    const deck = shuffle(createDeck());

    room.players.forEach(player => {
      player.hand = [];
      for (let i = 0; i < room.round; i++) {
        player.hand.push(deck.pop());
      }
      player.hand = sortCards(player.hand);
      player.bid = null;
      player.tricksWon = 0;
      io.to(player.socketId).emit('handDealt', player.hand);
    });

    if (room.round === maxRounds) {
      room.trumpCard = null;
      room.gameState = 'bidding';
    } else {
      room.trumpCard = deck.pop();
      if (room.trumpCard.type === 'wizard') {
        room.gameState = 'choose_trump';
      } else {
        room.gameState = 'bidding';
      }
    }

    io.to(roomCode).emit('gameStarted', { round: room.round, trumpCard: room.trumpCard, gameState: room.gameState });
    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
    notifyTurn(roomCode);
  }

  socket.on('resetGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) return;

    room.gameState = 'lobby';
    room.round = 1;
    room.trumpCard = null;
    room.currentTurnIndex = 0;
    room.dealerIndex = 0;
    room.currentTrick = [];
    room.scoreHistory = [];

    room.players.forEach(p => {
      p.hand = [];
      p.bid = null;
      p.tricksWon = 0;
      p.totalScore = 0;
    });

    io.to(roomCode).emit('gameReset', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
  });

  socket.on('selectTrumpSuit', ({ roomCode, suit }) => {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'choose_trump') return;

    const dealer = room.players[room.dealerIndex];
    if (socket.id !== dealer.socketId) return;

    room.trumpCard.chosenSuit = suit;
    io.to(roomCode).emit('trumpSuitChosen', { suit });

    room.gameState = 'bidding';
    notifyTurn(roomCode);
  });

  socket.on('submitBid', ({ roomCode, bid }) => {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'bidding') return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (socket.id !== currentPlayer.socketId) return;

    const parsedBid = parseInt(bid, 10);
    if (isNaN(parsedBid) || parsedBid < 0 || parsedBid > room.round) return;

    currentPlayer.bid = parsedBid;
    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));

    const allBidsPlaced = room.players.every(p => p.bid !== null);

    if (allBidsPlaced) {
      room.gameState = 'playing_tricks';
      room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;
      io.to(roomCode).emit('biddingFinished');
      notifyTurn(roomCode);
    } else {
      room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
      notifyTurn(roomCode);
    }
  });

  socket.on('playCard', ({ roomCode, cardIndex }) => {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'playing_tricks') return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (socket.id !== currentPlayer.socketId) return; 

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
    io.to(roomCode).emit('trickUpdated', room.currentTrick);

    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    
    if (room.currentTrick.length === room.players.length) {
      room.gameState = 'evaluating_trick'; 
      
      const winnerSessionId = evaluateTrick(
        room.currentTrick.map(t => ({ playerId: t.playerSessionId, card: t.card })), 
        room.trumpCard
      );
      const winner = room.players.find(p => p.sessionId === winnerSessionId);
      
      if (winner) {
        winner.tricksWon += 1; 
        io.to(roomCode).emit('trickWinner', { winnerName: winner.name });
        io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId)); 
      }

      setTimeout(() => {
        room.currentTrick = []; 
        
        if (room.players[0].hand.length === 0) {
          room.gameState = 'round_over';
          
          if (!room.scoreHistory) room.scoreHistory = [];

          const roundEntries = room.players.map(p => {
            const roundPoints = calculatePoints(p.bid, p.tricksWon);
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

          room.dealerIndex = (room.dealerIndex + 1) % room.players.length;
          const maxRounds = Math.floor(60 / room.players.length);
          const isGameOver = room.round >= maxRounds;

          io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
          io.to(roomCode).emit('roundFinished', { 
            isGameOver, 
            scoreHistory: room.scoreHistory 
          });
          io.to(roomCode).emit('turnChanged', { activePlayerSessionId: null, gameState: 'round_over' });

          if (!isGameOver) {
            setTimeout(() => {
              proceedToNextRound(roomCode);
            }, 4000);
          }
        } else {
          room.gameState = 'playing_tricks';
          room.currentTurnIndex = room.players.findIndex(p => p.sessionId === winnerSessionId);
          io.to(roomCode).emit('trickUpdated', room.currentTrick);
          notifyTurn(roomCode);
        }
      }, 3500); 
      
      io.to(roomCode).emit('turnChanged', { activePlayerSessionId: null, gameState: 'evaluating_trick' });
    } else {
      notifyTurn(roomCode);
    }
  });

  socket.on('disconnect', () => {
    for (const code in rooms) {
      const room = rooms[code];
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.connected = false;
        // Host-Rolle bleibt bei Reload erhalten
        io.to(code).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId));
        break;
      }
    }
  });

  function notifyTurn(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    
    let activePlayer;
    if (room.gameState === 'choose_trump') {
      activePlayer = room.players[room.dealerIndex];
    } else {
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
      activePlayerSessionId: activePlayer.sessionId,
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
      isHost: p.sessionId === hostSessionId
    }));
  }
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server läuft! Öffne http://localhost:${PORT}`);
});