const socket = io();

let mySessionId = sessionStorage.getItem('wizard_session_id');
if (!mySessionId) {
  mySessionId = 'user_' + Math.random().toString(36).substring(2, 10);
  sessionStorage.setItem('wizard_session_id', mySessionId);
}

// UI-Elemente
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const joinBtn = document.getElementById('joinBtn');
const startBtn = document.getElementById('startBtn');
const resetGameBtn = document.getElementById('resetGameBtn');
const gameOverModal = document.getElementById('game-over-modal');
const podiumList = document.getElementById('podium-list');
const nameInput = document.getElementById('playerName');
const roomInput = document.getElementById('roomCode');
const displayRoomCode = document.getElementById('displayRoomCode');
const displayRound = document.getElementById('displayRound');
const statusMessage = document.getElementById('status-message');
const tableArea = document.getElementById('table-area');
const trumpContainer = document.getElementById('trump-container');
const trumpWrapper = document.getElementById('trump-wrapper');
const handContainer = document.getElementById('hand-container');
const bidOverlay = document.getElementById('bid-overlay');
const bidButtons = document.getElementById('bid-buttons');
const trickContainer = document.getElementById('trick-container');
const trumpSelectionArea = document.getElementById('trump-selection-area');
const scoreTableHead = document.getElementById('score-table-head');
const scoreTableBody = document.getElementById('score-table-body');
const scoreDrawer = document.getElementById('score-board-drawer');
const scoreDrawerToggle = document.getElementById('score-drawer-toggle');
const scoreDrawerClose = document.getElementById('score-drawer-close');
const drawerBackdrop = document.getElementById('drawer-backdrop');

if (sessionStorage.getItem('wizard_last_name')) {
  nameInput.value = sessionStorage.getItem('wizard_last_name');
}
if (sessionStorage.getItem('wizard_last_room')) {
  roomInput.value = sessionStorage.getItem('wizard_last_room');
}

// Spielzustand
let currentRoomCode = '';
let currentRound = 1;
let myCurrentHand = [];
let currentTrick = [];
let isMyTurn = false;
let currentGameState = 'lobby';
let currentActiveSessionId = null;
let cachedScoreHistory = [];
let cachedPlayers = [];

// --- DRAWER-STEUERUNG ---

function openScoreDrawer() {
  scoreDrawer.classList.add('open');
  drawerBackdrop.classList.add('open');
}

function closeScoreDrawer() {
  scoreDrawer.classList.remove('open');
  drawerBackdrop.classList.remove('open');
}

scoreDrawerToggle.addEventListener('click', () => {
  if (scoreDrawer.classList.contains('open')) {
    closeScoreDrawer();
  } else {
    openScoreDrawer();
  }
});

scoreDrawerClose.addEventListener('click', closeScoreDrawer);
drawerBackdrop.addEventListener('click', closeScoreDrawer);

// --- LOBBY & STEUERUNG ---

joinBtn.addEventListener('click', () => {
  const playerName = nameInput.value.trim();
  currentRoomCode = roomInput.value.trim();

  if (playerName && currentRoomCode) {
    sessionStorage.setItem('wizard_last_name', playerName);
    sessionStorage.setItem('wizard_last_room', currentRoomCode);

    socket.emit('joinRoom', { 
      playerName, 
      roomCode: currentRoomCode, 
      sessionId: mySessionId 
    });

    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    displayRoomCode.innerText = currentRoomCode;
    startBtn.style.display = 'none';
    statusMessage.innerText = 'Betrete Raum...';
  }
});

startBtn.addEventListener('click', () => {
  startBtn.style.display = 'none';
  startBtn.disabled = true;
  socket.emit('startGame', { roomCode: currentRoomCode });
});

resetGameBtn.addEventListener('click', () => {
  socket.emit('resetGame', { roomCode: currentRoomCode });
});

socket.on('lobbyError', ({ message }) => {
  alert(message);
  lobbyScreen.style.display = 'block';
  gameScreen.style.display = 'none';
});

socket.on('actionError', ({ message }) => {
  alert(message);
});

// --- DER BLOCK DER WAHRHEIT (TABELLE) ---

function renderScoreBoard() {
  scoreTableHead.innerHTML = '';
  scoreTableBody.innerHTML = '';

  if (cachedPlayers.length === 0) return;

  const headerRow = document.createElement('tr');
  const thRound = document.createElement('th');
  thRound.innerText = 'Runde';
  thRound.style.width = '65px';
  headerRow.appendChild(thRound);

  cachedPlayers.forEach(player => {
    const th = document.createElement('th');
    const isMe = (player.sessionId === mySessionId);
    const hostBadge = player.isHost ? '<span class="host-badge">Host</span>' : '';
    const dealerBadge = player.isDealer ? '<span class="dealer-badge">Geber</span>' : '';
    const disconnected = !player.connected ? ' (Getrennt)' : '';

    if (player.sessionId === currentActiveSessionId) {
      th.classList.add('active-turn');
    }

    th.innerHTML = `
      <div>${player.name} ${isMe ? '<b>(Du)</b>' : ''}${disconnected}</div>
      <div style="margin: 3px 0;">${hostBadge}${dealerBadge}</div>
      <div style="font-size: 11px; opacity: 0.9; color: #f1c40f;">${player.totalScore || 0} Pkt.</div>
    `;
    headerRow.appendChild(th);
  });
  scoreTableHead.appendChild(headerRow);

  cachedScoreHistory.forEach(record => {
    const row = document.createElement('tr');
    
    const tdRound = document.createElement('td');
    tdRound.innerText = record.round;
    tdRound.style.fontWeight = 'bold';
    row.appendChild(tdRound);

    cachedPlayers.forEach(player => {
      const td = document.createElement('td');
      const entry = record.entries.find(e => e.sessionId === player.sessionId);

      if (entry) {
        const sign = entry.roundPoints >= 0 ? `+${entry.roundPoints}` : `${entry.roundPoints}`;
        const colorClass = entry.roundPoints >= 0 ? 'score-positive' : 'score-negative';
        
        td.innerHTML = `
          <div><small>T: ${entry.bid} | G: ${entry.tricksWon}</small></div>
          <div><span class="${colorClass}">${sign}</span> <b>(${entry.totalScore})</b></div>
        `;
      } else {
        td.innerText = '-';
      }
      row.appendChild(td);
    });

    scoreTableBody.appendChild(row);
  });

  if (currentGameState !== 'lobby') {
    const liveRow = document.createElement('tr');
    liveRow.classList.add('current-round-row');

    const tdLiveRound = document.createElement('td');
    tdLiveRound.innerHTML = `<b>${currentRound}</b><br><span style="font-size: 10px; color: #3498db;">(aktiv)</span>`;
    liveRow.appendChild(tdLiveRound);

    cachedPlayers.forEach(player => {
      const td = document.createElement('td');
      const bidText = player.bid !== null ? player.bid : '-';
      const wonText = player.tricksWon !== undefined ? player.tricksWon : 0;

      td.innerHTML = `<div><small>T: <b>${bidText}</b> | G: <b>${wonText}</b></small></div>`;
      liveRow.appendChild(td);
    });

    scoreTableBody.appendChild(liveRow);
  }

  const scrollContainer = document.querySelector('.drawer-scroll');
  if (scrollContainer) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }
}

// --- UPDATES & RECONNECT ---

socket.on('syncGameState', (state) => {
  currentRoomCode = state.roomCode;
  currentRound = state.round;
  currentGameState = state.gameState;
  myCurrentHand = state.hand || [];
  currentTrick = state.currentTrick || [];
  cachedPlayers = state.players;
  cachedScoreHistory = state.scoreHistory || [];

  const amIHost = state.players.some(p => p.sessionId === mySessionId && p.isHost);

  lobbyScreen.style.display = 'none';
  gameScreen.style.display = 'block';
  displayRoomCode.innerText = currentRoomCode;
  displayRound.innerText = currentRound;

  if (currentGameState === 'lobby') {
    tableArea.style.display = 'none';
    startBtn.style.display = amIHost ? 'inline-block' : 'none';
    if (amIHost) {
      statusMessage.innerText = state.players.length < 3
        ? `Du bist der Host. Warte auf Mitspieler (${state.players.length}/3)...`
        : 'Du bist der Host. Klicke auf "Spiel starten"!';
    } else {
      statusMessage.innerText = 'Warte auf den Host zum Starten...';
    }
  } else {
    tableArea.style.display = 'block';
    startBtn.style.display = 'none';
  }

  renderScoreBoard();
  renderTrumpCard(state.trumpCard);
  renderHand();
  renderTrickCards(state.currentTrick);
  handleTurnState(state.activePlayerSessionId, state.gameState, state.forbiddenBid);
});

socket.on('roomUpdated', (players) => {
  cachedPlayers = players;
  const amIHost = players.some(p => p.sessionId === mySessionId && p.isHost);

  if (currentGameState === 'lobby') {
    tableArea.style.display = 'none';
    if (amIHost) {
      startBtn.style.display = 'inline-block';
      statusMessage.innerText = players.length < 3 
        ? `Du bist der Host. Warte auf Mitspieler (${players.length}/3)...` 
        : 'Du bist der Host. Alle bereit? Klicke auf "Spiel starten"!';
    } else {
      startBtn.style.display = 'none';
      statusMessage.innerText = 'Warte auf den Host zum Starten...';
    }
  } else {
    startBtn.style.display = 'none';
  }

  renderScoreBoard();
});

// --- SPIELABLAUF ---

socket.on('turnChanged', ({ activePlayerSessionId, gameState, forbiddenBid }) => {
  handleTurnState(activePlayerSessionId, gameState, forbiddenBid);
});

function handleTurnState(activePlayerSessionId, gameState, forbiddenBid) {
  currentActiveSessionId = activePlayerSessionId;
  isMyTurn = (mySessionId === activePlayerSessionId);
  currentGameState = gameState;

  renderHand();
  renderScoreBoard();

  if (gameState === 'choose_trump') {
    bidOverlay.style.display = 'none';
    if (isMyTurn) {
      statusMessage.innerText = 'Du bist der Geber! Wähle die Trumpffarbe.';
      trumpSelectionArea.style.display = 'block';
    } else {
      statusMessage.innerText = 'Warte auf Trumpfwahl vom Geber...';
      trumpSelectionArea.style.display = 'none';
    }
  } else if (gameState === 'bidding') {
    trumpSelectionArea.style.display = 'none';

    if (isMyTurn) {
      statusMessage.innerText = 'Du bist dran mit Tippen!';
      if (forbiddenBid !== null) {
        statusMessage.innerText += ` (Verboten: ${forbiddenBid})`;
      }
      renderBidButtons(currentRound, forbiddenBid);
      bidOverlay.style.display = 'flex';
    } else {
      statusMessage.innerText = 'Warte auf die Ansagen der anderen...';
      bidOverlay.style.display = 'none';
    }
  } else if (gameState === 'playing_tricks') {
    bidOverlay.style.display = 'none';
    trumpSelectionArea.style.display = 'none';
    statusMessage.innerText = isMyTurn ? 'Du bist am Zug! Wähle eine Karte.' : 'Ein Mitspieler spielt...';
  }
}

socket.on('gameStarted', ({ round, trumpCard, gameState }) => {
  currentGameState = gameState || 'bidding';
  startBtn.style.display = 'none';
  startBtn.disabled = false;
  gameOverModal.style.display = 'none';
  tableArea.style.display = 'block';
  displayRound.innerText = round;
  currentRound = round;
  currentTrick = [];
  trickContainer.innerHTML = '';

  closeScoreDrawer();
  renderTrumpCard(trumpCard);
  renderScoreBoard();
});

function renderTrumpCard(trumpCard) {
  trumpContainer.innerHTML = '';
  
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';

  if (!trumpCard) {
    const emptyCard = document.createElement('div');
    emptyCard.classList.add('card');
    emptyCard.style.background = 'rgba(255,255,255,0.06)';
    emptyCard.style.borderColor = 'rgba(255,255,255,0.2)';
    emptyCard.innerHTML = '<span style="font-size: 20px; color: #94a3b8;">-</span>';
    
    const subText = document.createElement('div');
    subText.style.fontStyle = 'italic';
    subText.style.fontSize = '12px';
    subText.style.color = '#94a3b8';
    subText.style.marginTop = '6px';
    subText.innerText = 'Kein Trumpf';

    wrap.appendChild(emptyCard);
    wrap.appendChild(subText);
    trumpContainer.appendChild(wrap);
    return;
  }

  const el = renderCard(trumpCard);
  wrap.appendChild(el);

  const subText = document.createElement('div');
  subText.style.fontStyle = 'italic';
  subText.style.fontSize = '12px';
  subText.style.marginTop = '6px';

  if (trumpCard.type === 'wizard' && trumpCard.chosenSuit) {
    const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
    subText.style.color = '#f1c40f';
    subText.innerText = `Trumpf: ${suitNames[trumpCard.chosenSuit]}`;
  } else if (trumpCard.type === 'jester') {
    subText.style.color = '#94a3b8';
    subText.innerText = 'Kein Trumpf';
  } else if (trumpCard.type === 'color') {
    const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
    subText.style.color = '#cbd5e1';
    subText.innerText = `Farbe: ${suitNames[trumpCard.suit]}`;
  }

  wrap.appendChild(subText);
  trumpContainer.appendChild(wrap);
}

socket.on('handDealt', (hand) => {
  myCurrentHand = hand;
  renderHand(true);
});

document.querySelectorAll('.trump-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const suit = e.target.getAttribute('data-suit');
    socket.emit('selectTrumpSuit', { roomCode: currentRoomCode, suit: suit });
    trumpSelectionArea.style.display = 'none';
  });
});

socket.on('trumpSuitChosen', ({ suit }) => {
  const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
  statusMessage.innerText = `Trumpf ist ${suitNames[suit]}. Das Tippen beginnt!`;
});

socket.on('biddingFinished', () => {
  bidOverlay.style.display = 'none';
  statusMessage.innerText = 'Alle Tipps abgegeben! Das Ausspielen beginnt.';
});

socket.on('invalidMove', ({ message }) => {
  alert(`Regelverstoß: ${message}`);
  isMyTurn = true;
  renderHand();
});

socket.on('trickUpdated', (trickCards) => {
  currentTrick = trickCards;
  renderTrickCards(trickCards);
  renderHand();
});

function renderTrickCards(trickCards) {
  trickContainer.innerHTML = '';
  trickCards.forEach((item, idx) => {
    const wrap = document.createElement('div');
    wrap.style.textAlign = 'center';
    
    const nameLabel = document.createElement('div');
    nameLabel.innerText = item.playerName;
    nameLabel.style.fontSize = '12px';
    nameLabel.style.fontWeight = 'bold';
    nameLabel.style.marginBottom = '5px';
    nameLabel.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
    
    const cardEl = renderCard(item.card);
    cardEl.classList.add('card-played');
    
    const rot = ((idx % 3) - 1) * 5;
    cardEl.style.setProperty('--rand-rot', `${rot}deg`);

    wrap.appendChild(nameLabel);
    wrap.appendChild(cardEl);
    trickContainer.appendChild(wrap);
  });
}

socket.on('trickWinner', ({ winnerName }) => {
  statusMessage.innerText = `${winnerName} gewinnt den Stich!`;
  const middleCards = document.querySelectorAll('#trick-container .card');
  
  setTimeout(() => {
    middleCards.forEach(card => card.classList.add('trick-clearing'));
  }, 2200);
});

socket.on('roundFinished', ({ isGameOver, scoreHistory }) => {
  if (scoreHistory) {
    cachedScoreHistory = scoreHistory;
    renderScoreBoard();
  }

  openScoreDrawer();

  if (isGameOver) {
    statusMessage.innerText = 'Das Spiel ist beendet!';
    const amIHost = cachedPlayers.some(p => p.sessionId === mySessionId && p.isHost);
    showGameOverScreen(amIHost);
  } else {
    statusMessage.innerText = 'Runde beendet! Nächste Runde startet in Kürze...';
  }
});

function showGameOverScreen(amIHost) {
  if (!gameOverModal || !podiumList) return;

  const sorted = [...cachedPlayers].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

  podiumList.innerHTML = '';
  sorted.forEach((p, idx) => {
    const row = document.createElement('div');
    row.style.padding = '10px 14px';
    row.style.margin = '6px 0';
    row.style.borderRadius = '8px';
    row.style.background = idx === 0 ? 'rgba(241, 196, 15, 0.25)' : 'rgba(255, 255, 255, 0.05)';
    row.style.border = idx === 0 ? '1px solid #f1c40f' : '1px solid #7f8c8d';

    row.innerHTML = `<b>${idx + 1}. ${p.name}</b>: ${p.totalScore || 0} Punkte`;
    podiumList.appendChild(row);
  });

  if (resetGameBtn) {
    resetGameBtn.style.display = amIHost ? 'inline-block' : 'none';
  }

  gameOverModal.style.display = 'flex';
}

socket.on('gameReset', (players) => {
  gameOverModal.style.display = 'none';
  tableArea.style.display = 'none';
  statusMessage.innerText = 'Spiel zurückgesetzt!';
  displayRound.innerText = '-';
  currentRound = 1;
  currentGameState = 'lobby';
  myCurrentHand = [];
  currentTrick = [];
  cachedScoreHistory = [];
  cachedPlayers = players;
  
  const amIHost = players.some(p => p.sessionId === mySessionId && p.isHost);
  startBtn.style.display = amIHost ? 'inline-block' : 'none';

  closeScoreDrawer();
  renderScoreBoard();
});

// --- KARTEN-LOGIK & RENDERN (REINE TYPOGRAFIE, KEINE EMOJIS) ---

function renderBidButtons(maxBid, forbiddenBid) {
  bidButtons.innerHTML = '';
  for (let i = 0; i <= maxBid; i++) {
    const btn = document.createElement('button');
    btn.classList.add('bid-btn');
    btn.innerText = i;
    
    if (i === forbiddenBid) {
      btn.disabled = true;
      btn.style.background = '#475569';
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.title = 'Diese Zahl ist für den Geber verboten!';
    } else {
      btn.addEventListener('click', () => {
        socket.emit('submitBid', { roomCode: currentRoomCode, bid: i });
        bidOverlay.style.display = 'none';
      });
    }
    bidButtons.appendChild(btn);
  }
}

function isCardPlayable(cardToPlay, hand, trick) {
  if (cardToPlay.type === 'wizard' || cardToPlay.type === 'jester') {
    return true;
  }
  if (!trick || trick.length === 0) {
    return true;
  }
  let leadSuit = 'none';
  for (let i = 0; i < trick.length; i++) {
    const trickCard = trick[i].card;
    if (trickCard.type === 'wizard') break;
    if (trickCard.type === 'color') {
      leadSuit = trickCard.suit;
      break;
    }
  }
  if (leadSuit === 'none') return true;
  if (cardToPlay.type === 'color' && cardToPlay.suit === leadSuit) return true;
  const hasLeadSuit = hand.some(c => c.type === 'color' && c.suit === leadSuit);
  return !hasLeadSuit;
}

function renderHand(isNewDeal = false) {
  handContainer.innerHTML = '';
  
  const total = myCurrentHand.length;
  const mid = (total - 1) / 2;

  myCurrentHand.forEach((card, index) => {
    const cardElement = renderCard(card);
    const isPlayingPhase = (currentGameState === 'playing_tricks');
    const playable = isMyTurn && isPlayingPhase && isCardPlayable(card, myCurrentHand, currentTrick);

    const angle = (index - mid) * 4;
    const offsetY = Math.abs(index - mid) * 3.5;
    const overlapMargin = total > 6 ? '-10px' : '3px';

    cardElement.style.margin = `0 ${overlapMargin}`;
    cardElement.style.zIndex = index + 1;

    if (isNewDeal) {
      cardElement.classList.add('card-dealing');
      cardElement.style.animationDelay = `${index * 0.05}s`;
    }

    if (playable) {
      cardElement.classList.add('card-playable');
      cardElement.style.transform = `translateY(${offsetY}px) rotate(${angle}deg)`;
      cardElement.style.filter = 'brightness(1)';
      cardElement.style.opacity = '1';
      
      cardElement.addEventListener('click', () => {
        if (isMyTurn && currentGameState === 'playing_tricks') {
          socket.emit('playCard', { roomCode: currentRoomCode, cardIndex: index });
          isMyTurn = false;
          renderHand();
        }
      });
    } else {
      cardElement.classList.remove('card-playable');
      cardElement.style.transform = `translateY(${offsetY}px) rotate(${angle}deg)`;
      
      if (isMyTurn && isPlayingPhase) {
        cardElement.style.filter = 'brightness(0.35)';
        cardElement.style.opacity = '0.5';
      } else {
        cardElement.style.filter = 'brightness(1)';
        cardElement.style.opacity = '1';
      }
    }
    
    handContainer.appendChild(cardElement);
  });
}

function renderCard(card) {
  const div = document.createElement('div');
  div.classList.add('card');

  if (card.type === 'wizard') {
    div.classList.add('card-wizard');
    div.innerHTML = `
      <div class="card-corner top-left">Z</div>
      <div class="card-center">Z</div>
      <div class="card-corner bottom-right">Z</div>
    `;
  } else if (card.type === 'jester') {
    div.classList.add('card-jester');
    div.innerHTML = `
      <div class="card-corner top-left">N</div>
      <div class="card-center">N</div>
      <div class="card-corner bottom-right">N</div>
    `;
  } else {
    div.classList.add(`card-${card.suit}`);
    div.innerHTML = `
      <div class="card-corner top-left">${card.value}</div>
      <div class="card-center">${card.value}</div>
      <div class="card-corner bottom-right">${card.value}</div>
    `;
  }

  return div;
}