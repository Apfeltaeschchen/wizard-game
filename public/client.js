const socket = io();

// Eindeutige Session-ID pro Browser-Tab
let mySessionId = sessionStorage.getItem('wizard_session_id');
if (!mySessionId) {
  mySessionId = 'user_' + Math.random().toString(36).substring(2, 10);
  sessionStorage.setItem('wizard_session_id', mySessionId);
}

// UI-Elemente
const lobbyScreen = document.getElementById('lobby-screen');
const waitingRoomScreen = document.getElementById('waiting-room-screen');
const gameScreen = document.getElementById('game-screen');

// Screen 1: Haupt-Lobby
const createGameBtn = document.getElementById('createGameBtn');
const joinBtn = document.getElementById('joinBtn');
const nameInput = document.getElementById('playerName');
const roomInput = document.getElementById('roomCode');

// Screen 2: Separater Warteraum
const waitingRoomCode = document.getElementById('waitingRoomCode');
const btnCopyWaitingCode = document.getElementById('btnCopyWaitingCode');
const waitingRoomCount = document.getElementById('waitingRoomCount');
const waitingRoomPlayersList = document.getElementById('waitingRoomPlayersList');
const waitingRoomStartBtn = document.getElementById('waitingRoomStartBtn');
const waitingRoomLeaveBtn = document.getElementById('waitingRoomLeaveBtn');
const hostEditionControls = document.getElementById('host-edition-controls');
const guestEditionDisplay = document.getElementById('guest-edition-display');
const editionSelect = document.getElementById('editionSelect');

// Screen 3: Spieltisch
const btnLeaveGame = document.getElementById('btnLeaveGame');
const displayRoomCode = document.getElementById('displayRoomCode');
const btnCopyGameCode = document.getElementById('btnCopyGameCode');
const displayRound = document.getElementById('displayRound');
const displayMaxRounds = document.getElementById('displayMaxRounds');
const statusMessage = document.getElementById('status-message');

const tableArea = document.getElementById('table-area');
const opponentsContainer = document.getElementById('opponents-container');
const trumpContainer = document.getElementById('trump-container');
const trickContainer = document.getElementById('trick-container');
const trumpSelectionArea = document.getElementById('trump-selection-area');

const bidOverlay = document.getElementById('bid-overlay');
const bidBox = document.getElementById('bid-box');
const bidButtons = document.getElementById('bid-buttons');

const myHandSection = document.getElementById('my-hand-section');
const handContainer = document.getElementById('hand-container');

const scoreDrawer = document.getElementById('score-board-drawer');
const scoreDrawerToggle = document.getElementById('score-drawer-toggle');
const scoreDrawerClose = document.getElementById('score-drawer-close');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const scoreTableHead = document.getElementById('score-table-head');
const scoreTableBody = document.getElementById('score-table-body');

const pauseOverlay = document.getElementById('pause-overlay');
const pauseMessage = document.getElementById('pause-message');
const hostPauseControls = document.getElementById('host-pause-controls');
const btnHostReDeal = document.getElementById('btnHostReDeal');

const gameOverModal = document.getElementById('game-over-modal');
const podiumList = document.getElementById('podium-list');
const resetGameBtn = document.getElementById('resetGameBtn');

// Spielzustand
let currentRoomCode = '';
let currentRound = 1;
let maxRounds = 20;
let currentEdition = 'classic';
let myCurrentHand = [];
let currentTrick = [];
let isMyTurn = false;
let currentGameState = 'lobby';
let currentActiveSessionId = null;
let cachedScoreHistory = [];
let cachedPlayers = [];
let cachedTrumpCard = null;
let inspectedCardIndex = null; // Für Touch "Tap to Inspect"

// XSS-Schutz
function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Screen-Manager zur sauberen Umschaltung zwischen den 3 Screens
function switchScreen(screenName) {
  lobbyScreen.style.display = (screenName === 'lobby') ? 'flex' : 'none';
  waitingRoomScreen.style.display = (screenName === 'waiting') ? 'flex' : 'none';
  gameScreen.style.display = (screenName === 'game') ? 'block' : 'none';
}

// Gespeicherte Formulardaten vorausfüllen
if (sessionStorage.getItem('wizard_last_name')) {
  nameInput.value = sessionStorage.getItem('wizard_last_name');
}
if (sessionStorage.getItem('wizard_last_room')) {
  roomInput.value = sessionStorage.getItem('wizard_last_room');
}

// Automatischer Socket-Reconnect
socket.on('connect', () => {
  const savedRoom = sessionStorage.getItem('wizard_last_room');
  const savedName = sessionStorage.getItem('wizard_last_name');
  if (savedRoom && savedName) {
    currentRoomCode = savedRoom;
    socket.emit('joinRoom', {
      playerName: savedName,
      roomCode: savedRoom,
      sessionId: mySessionId
    });
  }
});

// --- DRAWER-STEUERUNG (BUCH DER WAHRHEIT) ---
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

// --- SCREEN 1: HAUPT-LOBBY ---
function doCreateGame() {
  const playerName = nameInput.value.trim();
  if (!playerName) {
    alert('Bitte gib zuerst deinen Spielernamen ein!');
    nameInput.focus();
    return;
  }
  sessionStorage.setItem('wizard_last_name', playerName);
  if (createGameBtn) createGameBtn.disabled = true;
  statusMessage.innerText = 'Erstelle neues Spiel...';
  socket.emit('createRoom', {
    playerName,
    sessionId: mySessionId
  });
}

function doJoin() {
  const playerName = nameInput.value.trim();
  const rawRoomCode = roomInput.value.trim();

  if (!playerName) {
    alert('Bitte gib zuerst deinen Spielernamen ein!');
    nameInput.focus();
    return;
  }
  if (!rawRoomCode) {
    alert('Bitte gib den Zahlencode des Raums ein!');
    roomInput.focus();
    return;
  }

  currentRoomCode = rawRoomCode.toUpperCase();
  sessionStorage.setItem('wizard_last_name', playerName);
  sessionStorage.setItem('wizard_last_room', currentRoomCode);

  socket.emit('joinRoom', {
    playerName,
    roomCode: currentRoomCode,
    sessionId: mySessionId
  });

  statusMessage.innerText = 'Betrete Raum...';
}

if (createGameBtn) createGameBtn.addEventListener('click', doCreateGame);
joinBtn.addEventListener('click', doJoin);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (roomInput.value.trim()) doJoin();
    else doCreateGame();
  }
});
roomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });

// Event wenn Raum erfolgreich erstellt wurde
socket.on('roomCreated', ({ roomCode }) => {
  currentRoomCode = roomCode;
  sessionStorage.setItem('wizard_last_room', roomCode);
  if (createGameBtn) createGameBtn.disabled = false;
  switchScreen('waiting');
});

// --- KOPIER-FUNKTION FÜR DEN ZAHLENCODE ---
async function copyRoomCode(btnElement) {
  if (!currentRoomCode) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(currentRoomCode);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = currentRoomCode;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    if (btnElement) {
      const originalHtml = btnElement.innerHTML;
      btnElement.classList.add('copied');
      btnElement.innerHTML = btnElement.classList.contains('btn-copy-small') ? '✓' : 'Kopiert! ✓';
      setTimeout(() => {
        btnElement.classList.remove('copied');
        btnElement.innerHTML = originalHtml;
      }, 2000);
    }
  } catch (err) {
    console.error('Fehler beim Kopieren des Codes:', err);
  }
}

if (btnCopyWaitingCode) {
  btnCopyWaitingCode.addEventListener('click', () => copyRoomCode(btnCopyWaitingCode));
}
if (btnCopyGameCode) {
  btnCopyGameCode.addEventListener('click', () => copyRoomCode(btnCopyGameCode));
}

// --- SCREEN 2: SEPARATER WARTERAUM ---
waitingRoomStartBtn.addEventListener('click', () => {
  waitingRoomStartBtn.disabled = true;
  socket.emit('startGame', { roomCode: currentRoomCode });
});

if (editionSelect) {
  editionSelect.addEventListener('change', (e) => {
    const selected = e.target.value;
    currentEdition = selected;
    socket.emit('setEdition', { roomCode: currentRoomCode, edition: selected });
  });
}

socket.on('editionChanged', ({ edition }) => {
  currentEdition = edition;
  if (editionSelect) editionSelect.value = edition;
  if (guestEditionDisplay) {
    guestEditionDisplay.innerText = (edition === 'anniversary_30')
      ? '30 Jahre Jubiläumsedition (63 Karten: +Drache, +Fee, +Bombe)'
      : 'Standard Wizard (60 Karten)';
  }
});

function confirmAndLeaveRoom() {
  if (confirm('Möchtest du den Raum wirklich verlassen?')) {
    socket.emit('leaveRoom', { roomCode: currentRoomCode });
    sessionStorage.removeItem('wizard_last_room');
    currentRoomCode = '';
    currentGameState = 'lobby';
    switchScreen('lobby');
    pauseOverlay.style.display = 'none';
    gameOverModal.style.display = 'none';
  }
}

waitingRoomLeaveBtn.addEventListener('click', confirmAndLeaveRoom);
btnLeaveGame.addEventListener('click', confirmAndLeaveRoom);

resetGameBtn.addEventListener('click', () => {
  socket.emit('resetGame', { roomCode: currentRoomCode });
});

btnHostReDeal.addEventListener('click', () => {
  socket.emit('hostReDealRound', { roomCode: currentRoomCode });
});

const btnHostAbortToWaiting = document.getElementById('btnHostAbortToWaiting');
if (btnHostAbortToWaiting) {
  btnHostAbortToWaiting.addEventListener('click', () => {
    socket.emit('abortGameToWaitingRoom', { roomCode: currentRoomCode });
  });
}

const btnPauseLeaveGame = document.getElementById('btnPauseLeaveGame');
if (btnPauseLeaveGame) {
  btnPauseLeaveGame.addEventListener('click', confirmAndLeaveRoom);
}

socket.on('lobbyError', ({ message }) => {
  alert(message);
  sessionStorage.removeItem('wizard_last_room');
  currentRoomCode = '';
  if (createGameBtn) createGameBtn.disabled = false;
  switchScreen('lobby');
});

socket.on('actionError', ({ message }) => {
  alert(message);
  waitingRoomStartBtn.disabled = false;
});

// Rendert den separaten Warteraum
function updateWaitingRoomView(amIHost) {
  waitingRoomCode.innerText = currentRoomCode;
  waitingRoomCount.innerText = cachedPlayers.length;
  waitingRoomPlayersList.innerHTML = '';

  cachedPlayers.forEach(p => {
    const isMe = (p.sessionId === mySessionId);
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'space-between';
    item.style.background = isMe ? 'rgba(241, 196, 15, 0.18)' : 'rgba(255, 255, 255, 0.05)';
    item.style.padding = '10px 14px';
    item.style.borderRadius = '8px';
    item.style.border = isMe ? '1px solid #f1c40f' : '1px solid rgba(255,255,255,0.1)';

    const hostBadge = p.isHost ? '<span class="host-badge">Host</span>' : '';
    const statusText = p.connected
      ? '<span style="color: #2ecc71; font-size: 12px; font-weight: bold;">● Bereit</span>'
      : '<span style="color: #e74c3c; font-size: 12px; font-weight: bold;">● Getrennt</span>';

    item.innerHTML = `
      <div style="font-size: 15px;"><b>${escapeHtml(p.name)}</b> ${isMe ? '<small style="color: #f1c40f;">(Du)</small>' : ''} ${hostBadge}</div>
      <div>${statusText}</div>
    `;
    waitingRoomPlayersList.appendChild(item);
  });

  // Edition-Auswahl für Host bzw. Anzeige für Gäste aktualisieren
  if (hostEditionControls && guestEditionDisplay) {
    if (amIHost) {
      hostEditionControls.style.display = 'block';
      guestEditionDisplay.style.display = 'none';
      if (editionSelect) editionSelect.value = currentEdition;
    } else {
      hostEditionControls.style.display = 'none';
      guestEditionDisplay.style.display = 'block';
      guestEditionDisplay.innerText = (currentEdition === 'anniversary_30')
        ? '30 Jahre Jubiläumsedition (63 Karten: +Drache, +Fee, +Bombe)'
        : 'Standard Wizard (60 Karten)';
    }
  }

  const connectedCount = cachedPlayers.filter(p => p.connected).length;
  if (amIHost) {
    waitingRoomStartBtn.style.display = 'inline-block';
    waitingRoomStartBtn.disabled = connectedCount < 3;
    waitingRoomStartBtn.innerText = connectedCount < 3
      ? `Warte auf Spieler (${connectedCount}/3)...`
      : 'Spiel jetzt starten (Runde 1)';
  } else {
    waitingRoomStartBtn.style.display = 'none';
  }
}

// --- SYNCHRONISATION & SPIELZUSTAND ---

socket.on('syncGameState', (state) => {
  currentRoomCode = state.roomCode;
  currentRound = state.round;
  maxRounds = state.maxRounds || Math.floor(60 / (state.players ? state.players.length : 3));
  if (state.edition) {
    currentEdition = state.edition;
    if (editionSelect) editionSelect.value = state.edition;
    if (guestEditionDisplay) {
      guestEditionDisplay.innerText = (state.edition === 'anniversary_30')
        ? '30 Jahre Jubiläumsedition (63 Karten: +Drache, +Fee, +Bombe)'
        : 'Standard Wizard (60 Karten)';
    }
  }
  currentGameState = state.gameState;
  myCurrentHand = state.hand || [];
  currentTrick = state.currentTrick || [];
  cachedPlayers = state.players || [];
  cachedScoreHistory = state.scoreHistory || [];
  cachedTrumpCard = state.trumpCard;

  const amIHost = cachedPlayers.some(p => p.sessionId === mySessionId && p.isHost);

  displayRoomCode.innerText = currentRoomCode;
  displayRound.innerText = currentRound;
  displayMaxRounds.innerText = maxRounds;

  if (currentGameState === 'lobby') {
    switchScreen('waiting');
    updateWaitingRoomView(amIHost);
  } else {
    switchScreen('game');
    tableArea.style.display = 'flex';
  }

  // Pausen-Zustand handhaben
  if (state.isPaused) {
    showPauseOverlay(state.pausedReason, amIHost);
  } else {
    pauseOverlay.style.display = 'none';
  }

  renderOpponents();
  renderScoreBoard();
  renderTrumpCard(cachedTrumpCard);
  renderHand();
  renderTrickCards(currentTrick, false);
  handleTurnState(state.activePlayerSessionId, state.gameState, state.forbiddenBid);

  // Siegerehrung bei Spielende
  if (state.isGameOver) {
    showGameOverScreen(amIHost);
  } else {
    gameOverModal.style.display = 'none';
  }
});

socket.on('roomUpdated', (players) => {
  cachedPlayers = players;
  const amIHost = players.some(p => p.sessionId === mySessionId && p.isHost);

  if (currentGameState === 'lobby') {
    switchScreen('waiting');
    updateWaitingRoomView(amIHost);
  }

  renderOpponents();
  renderScoreBoard();
});

// --- SPIELABLAUF & EVENT-LISTENER ---

socket.on('gameStarted', ({ round, maxRounds: mr, trumpCard, gameState }) => {
  currentGameState = gameState || 'bidding';
  currentRound = round;
  if (mr) maxRounds = mr;
  currentTrick = [];
  cachedTrumpCard = trumpCard;
  inspectedCardIndex = null;

  switchScreen('game');
  tableArea.style.display = 'flex';
  gameOverModal.style.display = 'none';
  pauseOverlay.style.display = 'none';

  displayRound.innerText = currentRound;
  displayMaxRounds.innerText = maxRounds;
  trickContainer.innerHTML = '';

  closeScoreDrawer();
  renderTrumpCard(trumpCard);
  renderOpponents();
  renderScoreBoard();
});

socket.on('turnChanged', ({ activePlayerSessionId, gameState, forbiddenBid }) => {
  handleTurnState(activePlayerSessionId, gameState, forbiddenBid);
});

function handleTurnState(activePlayerSessionId, gameState, forbiddenBid) {
  currentActiveSessionId = activePlayerSessionId;
  isMyTurn = (mySessionId === activePlayerSessionId);
  currentGameState = gameState;

  // SUBTILE TISCH-AURA & HANDKARTEN-FOKUS
  tableArea.classList.toggle('my-turn-aura', isMyTurn);
  myHandSection.classList.toggle('hand-my-turn', isMyTurn && currentGameState === 'playing_tricks');
  myHandSection.classList.toggle('hand-waiting', !isMyTurn && currentGameState === 'playing_tricks');
  bidBox.classList.toggle('bid-active-pulse', isMyTurn && currentGameState === 'bidding');

  renderOpponents();
  renderHand();
  renderScoreBoard();

  // Aktiven Spielernamen für zentrierten Status ermitteln
  const activePlayer = cachedPlayers.find(p => p.sessionId === activePlayerSessionId);
  const activePlayerName = activePlayer ? escapeHtml(activePlayer.name) : 'Ein Mitspieler';

  if (gameState === 'choose_trump') {
    bidOverlay.style.display = 'none';
    if (isMyTurn) {
      statusMessage.innerText = 'Du bist der Geber! Wähle die Trumpffarbe.';
      trumpSelectionArea.style.display = 'block';
    } else {
      const dealer = cachedPlayers.find(p => p.isDealer);
      const dealerName = dealer ? escapeHtml(dealer.name) : 'Der Geber';
      statusMessage.innerText = `${dealerName} wählt die Trumpffarbe...`;
      trumpSelectionArea.style.display = 'none';
    }
  } else if (gameState === 'bidding') {
    trumpSelectionArea.style.display = 'none';

    if (isMyTurn) {
      let msg = 'Du bist dran mit Tippen!';
      if (forbiddenBid !== null && forbiddenBid !== undefined) {
        msg += ` (Verboten: ${forbiddenBid})`;
      }
      statusMessage.innerText = msg;
      renderBidButtons(currentRound, forbiddenBid);
      bidOverlay.style.display = 'flex';
    } else {
      statusMessage.innerText = `${activePlayerName} ist an der Reihe mit Tippen...`;
      bidOverlay.style.display = 'none';
    }
  } else if (gameState === 'playing_tricks') {
    bidOverlay.style.display = 'none';
    trumpSelectionArea.style.display = 'none';
    statusMessage.innerText = isMyTurn
      ? 'Du bist am Zug! Wähle eine Karte.'
      : `${activePlayerName} ist an der Reihe...`;
  } else if (gameState === 'evaluating_trick') {
    bidOverlay.style.display = 'none';
    trumpSelectionArea.style.display = 'none';
  } else if (gameState === 'round_over') {
    bidOverlay.style.display = 'none';
    trumpSelectionArea.style.display = 'none';
    statusMessage.innerText = 'Runde beendet!';
  }
}

socket.on('handDealt', (hand) => {
  myCurrentHand = hand;
  inspectedCardIndex = null;
  renderHand(true);
});

// Trumpfwahl-Buttons (Geber)
document.querySelectorAll('.trump-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const suit = e.target.getAttribute('data-suit');
    socket.emit('selectTrumpSuit', { roomCode: currentRoomCode, suit });
    trumpSelectionArea.style.display = 'none';
  });
});

socket.on('trumpSuitChosen', ({ suit, trumpCard }) => {
  cachedTrumpCard = trumpCard;
  renderTrumpCard(trumpCard);
  const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
  statusMessage.innerText = `Trumpf ist ${suitNames[suit] || suit}. Das Tippen beginnt!`;
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
  renderTrickCards(trickCards, true);
  renderHand();
  renderOpponents();
});

socket.on('trickWinner', ({ winnerName, winnerSessionId, isBombed, nextLeadName }) => {
  if (isBombed) {
    statusMessage.innerText = `💥 Die Bombe hat den Stich neutralisiert! ${escapeHtml(nextLeadName || 'Nächster Spieler')} eröffnet den nächsten Stich.`;
  } else {
    statusMessage.innerText = `${escapeHtml(winnerName)} gewinnt den Stich!`;
  }

  setTimeout(() => {
    const trickItems = document.querySelectorAll('#trick-container .trick-card-item');
    trickItems.forEach(item => item.classList.add('trick-clearing'));
    setTimeout(() => {
      trickContainer.innerHTML = '';
    }, 450);
  }, 1800);
});

socket.on('roundFinished', ({ isGameOver, scoreHistory, round }) => {
  currentTrick = [];
  trickContainer.innerHTML = '';

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
    statusMessage.innerText = `Runde ${round} beendet! Nächste Runde startet gleich...`;
  }
});

// Pause & Reconnect Events
socket.on('gamePaused', ({ pausedPlayerName, sessionId }) => {
  const amIHost = cachedPlayers.some(p => p.sessionId === mySessionId && p.isHost);
  showPauseOverlay({ playerName: pausedPlayerName, sessionId }, amIHost);
});

socket.on('gameResumed', () => {
  pauseOverlay.style.display = 'none';
  statusMessage.innerText = 'Spiel fortgesetzt!';
});

function showPauseOverlay(reason, amIHost) {
  const name = reason ? reason.playerName : 'Ein Mitspieler';
  pauseMessage.innerText = `${escapeHtml(name)} hat die Verbindung verloren. Das Spiel pausiert...`;
  hostPauseControls.style.display = amIHost ? 'block' : 'none';
  pauseOverlay.style.display = 'flex';
}

socket.on('roundReDealt', ({ message, round, maxRounds: mr, trumpCard, gameState }) => {
  pauseOverlay.style.display = 'none';
  currentRound = round;
  if (mr) maxRounds = mr;
  currentGameState = gameState;
  cachedTrumpCard = trumpCard;
  currentTrick = [];
  trickContainer.innerHTML = '';

  displayRound.innerText = currentRound;
  displayMaxRounds.innerText = maxRounds;
  statusMessage.innerText = message || 'Runde neu ausgeteilt!';

  renderTrumpCard(trumpCard);
  renderOpponents();
  renderScoreBoard();
});

socket.on('gameResetToLobby', ({ message, players, roomCode }) => {
  alert(message || 'Zurück zur Lobby!');
  gameOverModal.style.display = 'none';
  pauseOverlay.style.display = 'none';
  tableArea.style.display = 'none';

  if (roomCode) {
    currentRoomCode = roomCode;
    sessionStorage.setItem('wizard_last_room', roomCode);
  }

  currentGameState = 'lobby';
  myCurrentHand = [];
  currentTrick = [];
  cachedScoreHistory = [];
  if (players) cachedPlayers = players;

  switchScreen('waiting');
  const amIHost = cachedPlayers.some(p => p.sessionId === mySessionId && p.isHost);
  updateWaitingRoomView(amIHost);
});

// --- VIRTUELLE MITSPIELER-SITZE RENDERN ---
function renderOpponents() {
  opponentsContainer.innerHTML = '';
  const opponents = cachedPlayers.filter(p => p.sessionId !== mySessionId);

  opponents.forEach(p => {
    const isHisTurn = (p.sessionId === currentActiveSessionId);
    const seatEl = document.createElement('div');
    seatEl.classList.add('player-seat');
    seatEl.id = `seat-${p.sessionId}`;
    if (isHisTurn) seatEl.classList.add('seat-active-turn');

    const initial = p.name ? p.name.charAt(0).toUpperCase() : '?';
    const disconnectedClass = !p.connected ? 'disconnected' : '';
    const hostBadge = p.isHost ? '<span class="host-badge">Host</span>' : '';
    const dealerBadge = p.isDealer ? '<span class="dealer-badge">Geber</span>' : '';

    const bidText = p.bid !== null ? p.bid : '-';
    const wonText = p.tricksWon !== undefined ? p.tricksWon : 0;

    seatEl.innerHTML = `
      <div class="seat-avatar ${disconnectedClass}">${initial}</div>
      <div class="seat-details">
        <div class="seat-name-row">
          <span class="seat-name">${escapeHtml(p.name)}</span>
          ${hostBadge}${dealerBadge}
        </div>
        <div class="seat-stats">T: <b>${bidText}</b> | G: <b>${wonText}</b></div>
      </div>
    `;

    opponentsContainer.appendChild(seatEl);
  });
}

// --- AAA 3D-FLUG- & FLIP-ANIMATION DER GESPIELTEN KARTEN ---
function renderTrickCards(trickCards, animateLast = true) {
  trickContainer.innerHTML = '';
  const trickContainerRect = trickContainer.getBoundingClientRect();

  trickCards.forEach((item, idx) => {
    const isLastCard = (idx === trickCards.length - 1);
    const wrap = document.createElement('div');
    wrap.classList.add('trick-card-item');
    wrap.style.textAlign = 'center';

    const nameLabel = document.createElement('div');
    nameLabel.innerText = item.playerName;
    nameLabel.style.fontSize = '11px';
    nameLabel.style.fontWeight = 'bold';
    nameLabel.style.marginBottom = '3px';
    nameLabel.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';

    // 3D-Card Wrapper mit Vorder- und Rückseite
    const cardWrapper = document.createElement('div');
    cardWrapper.classList.add('card-3d-wrapper');

    const frontFace = renderCard(item.card);
    frontFace.classList.add('card-3d-face', 'card-3d-front');

    const backFace = document.createElement('div');
    backFace.classList.add('card-3d-face', 'card-3d-back');
    backFace.innerHTML = '<span class="card-3d-back-symbol">✦</span>';

    cardWrapper.appendChild(frontFace);
    cardWrapper.appendChild(backFace);

    const rot = ((idx % 4) - 1.5) * 6;
    cardWrapper.style.setProperty('--rand-rot', `${rot}deg`);

    if (animateLast && isLastCard) {
      cardWrapper.classList.add('card-played-animated');

      let originX = 0;
      let originY = 80;

      if (item.playerSessionId === mySessionId) {
        originX = 0;
        originY = 160;
      } else {
        const seatEl = document.getElementById(`seat-${item.playerSessionId}`);
        if (seatEl && trickContainerRect.width > 0) {
          const seatRect = seatEl.getBoundingClientRect();
          originX = (seatRect.left + seatRect.width / 2) - (trickContainerRect.left + trickContainerRect.width / 2);
          originY = (seatRect.top + seatRect.height / 2) - (trickContainerRect.top + trickContainerRect.height / 2);
        }
      }

      cardWrapper.style.setProperty('--origin-x', `${originX}px`);
      cardWrapper.style.setProperty('--origin-y', `${originY}px`);
    } else {
      cardWrapper.style.transform = `rotate(${rot}deg)`;
    }

    wrap.appendChild(nameLabel);
    wrap.appendChild(cardWrapper);
    trickContainer.appendChild(wrap);
  });
}

// --- TRUMPFKARTE RENDERN ---
function renderTrumpCard(trumpCard) {
  trumpContainer.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';

  const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };

  if (!trumpCard) {
    const emptyCard = document.createElement('div');
    emptyCard.classList.add('card');
    emptyCard.style.background = 'rgba(24, 14, 8, 0.7)';
    emptyCard.style.borderColor = '#5a371c';
    emptyCard.innerHTML = '<span style="font-size: 20px; color: var(--gold-antique); font-family: var(--font-medieval);">-</span>';

    const subText = document.createElement('div');
    subText.style.fontStyle = 'italic';
    subText.style.fontSize = '11px';
    subText.style.color = '#d6be90';
    subText.style.marginTop = '4px';
    subText.style.fontFamily = 'var(--font-subheading)';
    subText.innerText = 'Kein Trumpf';

    wrap.appendChild(emptyCard);
    wrap.appendChild(subText);
    trumpContainer.appendChild(wrap);
    return;
  }

  const el = renderCard(trumpCard);
  wrap.appendChild(el);

  const subText = document.createElement('div');
  subText.style.fontWeight = 'bold';
  subText.style.fontSize = '11px';
  subText.style.marginTop = '4px';
  subText.style.fontFamily = 'var(--font-subheading)';

  if (trumpCard.type === 'wizard' || trumpCard.type === 'dragon') {
    if (trumpCard.chosenSuit) {
      subText.style.color = 'var(--gold-bright)';
      subText.innerText = `Trumpf: ${suitNames[trumpCard.chosenSuit] || trumpCard.chosenSuit}`;
    } else {
      subText.style.color = '#c084fc';
      subText.innerText = 'Geber wählt...';
    }
  } else if (trumpCard.type === 'jester' || trumpCard.type === 'fairy' || trumpCard.type === 'bomb') {
    subText.style.color = '#d6be90';
    subText.innerText = 'Kein Trumpf';
  } else if (trumpCard.type === 'color') {
    subText.style.color = '#f7eedb';
    subText.innerText = `Trumpf: ${suitNames[trumpCard.suit] || trumpCard.suit}`;
  }

  wrap.appendChild(subText);
  trumpContainer.appendChild(wrap);
}

// --- BIET-BUTTONS RENDERN ---
function renderBidButtons(maxBid, forbiddenBid) {
  bidButtons.innerHTML = '';
  for (let i = 0; i <= maxBid; i++) {
    const btn = document.createElement('button');
    btn.classList.add('bid-btn');
    btn.innerText = i;

    if (i === forbiddenBid) {
      btn.disabled = true;
      btn.style.background = '#475569';
      btn.style.opacity = '0.4';
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

// --- REGEL-PRÜFUNG: IST KARTE SPIELBAR? ---
function isCardPlayable(cardToPlay, hand, trick) {
  if (['wizard', 'jester', 'dragon', 'fairy', 'bomb'].includes(cardToPlay.type)) {
    return true;
  }
  if (!trick || trick.length === 0) {
    return true;
  }
  let leadSuit = 'none';
  for (let i = 0; i < trick.length; i++) {
    const trickCard = trick[i].card;
    if (trickCard.type === 'wizard' || trickCard.type === 'dragon') break;
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

// --- HANDKARTEN RENDERN ---
function renderHand(isNewDeal = false) {
  handContainer.innerHTML = '';

  const total = myCurrentHand.length;
  const mid = (total - 1) / 2;
  const isMobile = window.innerWidth <= 768;

  let dynamicMargin = '3px';
  if (total > 5) {
    if (total <= 8) dynamicMargin = '-8px';
    else if (total <= 12) dynamicMargin = '-18px';
    else if (total <= 16) dynamicMargin = '-26px';
    else dynamicMargin = '-34px';
  }

  if (isMobile && total >= 10) {
    handContainer.classList.add('swipeable');
  } else {
    handContainer.classList.remove('swipeable');
  }

  myCurrentHand.forEach((card, index) => {
    const cardElement = renderCard(card);
    const isPlayingPhase = (currentGameState === 'playing_tricks');
    const playable = isMyTurn && isPlayingPhase && isCardPlayable(card, myCurrentHand, currentTrick);

    const angle = (index - mid) * (total > 10 ? 2.2 : 3.5);
    const offsetY = Math.abs(index - mid) * (total > 10 ? 2 : 3);

    cardElement.style.margin = `0 ${dynamicMargin}`;
    cardElement.style.zIndex = index + 1;

    if (inspectedCardIndex === index) {
      cardElement.classList.add('card-inspected');
    }

    if (playable) {
      cardElement.classList.add('card-playable');
      if (inspectedCardIndex !== index) {
        cardElement.style.transform = `translateY(${offsetY}px) rotate(${angle}deg)`;
      }

      cardElement.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isMyTurn || currentGameState !== 'playing_tricks') return;

        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        if (isTouchDevice && inspectedCardIndex !== index) {
          inspectedCardIndex = index;
          renderHand();
        } else {
          socket.emit('playCard', { roomCode: currentRoomCode, cardIndex: index });
          isMyTurn = false;
          inspectedCardIndex = null;
          renderHand();
        }
      });
    } else {
      cardElement.classList.remove('card-playable');
      cardElement.style.transform = `translateY(${offsetY}px) rotate(${angle}deg)`;

      if (isMyTurn && isPlayingPhase) {
        cardElement.style.filter = 'brightness(0.35)';
        cardElement.style.opacity = '0.45';
      } else {
        cardElement.style.filter = 'brightness(1)';
        cardElement.style.opacity = '1';
      }
    }

    handContainer.appendChild(cardElement);
  });
}

document.addEventListener('click', () => {
  if (inspectedCardIndex !== null) {
    inspectedCardIndex = null;
    renderHand();
  }
});

// --- HERALDISCHE WAPPEN-SVGS FÜR KARTEN ---
const MEDIEVAL_ICONS = {
  red: `<svg viewBox="0 0 40 40" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 3L23 15H31L25 21L28 33L20 26L12 33L15 21L9 15H17L20 3Z" fill="url(#fireGrad)" stroke="#550c0f" stroke-width="1.2"/>
    <circle cx="20" cy="20" r="4.5" fill="#f87171" stroke="#fef08a" stroke-width="1"/>
    <defs><linearGradient id="fireGrad" x1="20" y1="3" x2="20" y2="33" gradientUnits="userSpaceOnUse"><stop stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient></defs>
  </svg>`,

  blue: `<svg viewBox="0 0 40 40" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 4 C14 14 10 20 10 26 C10 32 14.5 36 20 36 C25.5 36 30 32 30 26 C30 20 26 14 20 4 Z" fill="url(#waterGrad)" stroke="#091d3e" stroke-width="1.2"/>
    <path d="M16 25 Q20 20 24 25" stroke="#bae6fd" stroke-width="1.5" fill="none"/>
    <defs><linearGradient id="waterGrad" x1="20" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#0c4a6e"/></linearGradient></defs>
  </svg>`,

  green: `<svg viewBox="0 0 40 40" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 4 C11 15 11 27 20 36 C29 27 29 15 20 4 Z" fill="url(#earthGrad)" stroke="#092612" stroke-width="1.2"/>
    <path d="M20 8 V32 M15 18 L20 24 L25 18" stroke="#86efac" stroke-width="1.4" fill="none"/>
    <defs><linearGradient id="earthGrad" x1="20" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse"><stop stop-color="#22c55e"/><stop offset="1" stop-color="#14532d"/></linearGradient></defs>
  </svg>`,

  yellow: `<svg viewBox="0 0 40 40" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="8" fill="url(#sunGrad)" stroke="#5e3902" stroke-width="1.2"/>
    <path d="M20 3 V9 M20 31 V37 M3 20 H9 M31 20 H37 M8 8 L13 13 M27 27 L32 32 M8 32 L13 27 M27 13 L32 8" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
    <defs><linearGradient id="sunGrad" x1="20" y1="12" x2="20" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="#fde047"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs>
  </svg>`,

  wizard: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="21" stroke="#f0c355" stroke-width="1.5" stroke-dasharray="3 3"/>
    <polygon points="24,6 38,36 10,36" stroke="#f0c355" stroke-width="1.2" fill="none"/>
    <polygon points="24,42 38,12 10,12" stroke="#f0c355" stroke-width="1.2" fill="none"/>
    <circle cx="24" cy="24" r="6" fill="#f0c355" stroke="#765615" stroke-width="1"/>
    <path d="M20 24 Q24 20 28 24 Q24 28 20 24 Z" fill="#371252"/>
  </svg>`,

  jester: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 28 C12 16 16 12 24 10 C32 12 36 16 36 28 C36 34 30 38 24 38 C18 38 12 34 12 28 Z" fill="#52525b" stroke="#18181b" stroke-width="1.2"/>
    <path d="M12 20 Q6 24 10 32 M36 20 Q42 24 38 32" stroke="#d4d4d8" stroke-width="2" fill="none"/>
    <circle cx="10" cy="32" r="2.5" fill="#f0c355" stroke="#765615" stroke-width="0.8"/>
    <circle cx="38" cy="32" r="2.5" fill="#f0c355" stroke="#765615" stroke-width="0.8"/>
    <circle cx="24" cy="10" r="2.5" fill="#f0c355" stroke="#765615" stroke-width="0.8"/>
  </svg>`,

  dragon: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 4 C27 9 32 10 38 9 C35 15 32 20 37 25 C31 23 26 26 24 33 C22 26 17 23 11 25 C16 20 13 15 10 9 C16 10 21 9 24 4 Z" fill="url(#dragonGrad)" stroke="#78350f" stroke-width="1.2"/>
    <path d="M24 16 L28 22 L24 28 L20 22 Z" fill="#f59e0b" stroke="#451a03" stroke-width="0.8"/>
    <circle cx="21" cy="12" r="1.5" fill="#fef08a"/>
    <circle cx="27" cy="12" r="1.5" fill="#fef08a"/>
    <path d="M18 36 L24 44 L30 36 L24 39 Z" fill="#b91c1c" stroke="#450a0a" stroke-width="1"/>
    <defs><linearGradient id="dragonGrad" x1="24" y1="4" x2="24" y2="33" gradientUnits="userSpaceOnUse"><stop stop-color="#dc2626"/><stop offset="1" stop-color="#450a0a"/></linearGradient></defs>
  </svg>`,

  fairy: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="18" rx="10" ry="6" transform="rotate(-30 16 18)" fill="url(#fairyWingGrad)" stroke="#38bdf8" stroke-width="1.2"/>
    <ellipse cx="32" cy="18" rx="10" ry="6" transform="rotate(30 32 18)" fill="url(#fairyWingGrad)" stroke="#38bdf8" stroke-width="1.2"/>
    <ellipse cx="18" cy="28" rx="7" ry="4" transform="rotate(20 18 28)" fill="url(#fairyWingGrad)" stroke="#0284c7" stroke-width="1"/>
    <ellipse cx="30" cy="28" rx="7" ry="4" transform="rotate(-20 30 28)" fill="url(#fairyWingGrad)" stroke="#0284c7" stroke-width="1"/>
    <path d="M24 10 C25.5 10 26.5 12 26.5 14 C26.5 16 25 18 24 24 C23 18 21.5 16 21.5 14 C21.5 12 22.5 10 24 10 Z" fill="#f0fdf4" stroke="#bae6fd" stroke-width="0.8"/>
    <polygon points="24,30 26,38 24,44 22,38" fill="#e0f2fe"/>
    <circle cx="24" cy="13" r="2.5" fill="#fef08a"/>
    <polygon points="36,8 37.5,12 41,13.5 37.5,15 36,19 34.5,15 31,13.5 34.5,12" fill="#fef08a"/>
    <defs><linearGradient id="fairyWingGrad" x1="16" y1="12" x2="32" y2="30" gradientUnits="userSpaceOnUse"><stop stop-color="#7dd3fc" stop-opacity="0.8"/><stop offset="1" stop-color="#0284c7" stop-opacity="0.4"/></linearGradient></defs>
  </svg>`,

  bomb: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="27" r="14" fill="url(#bombGrad)" stroke="#0f172a" stroke-width="1.5"/>
    <rect x="23" y="10" width="6" height="4" rx="1" fill="#475569" stroke="#1e293b" stroke-width="1" transform="rotate(25 23 10)"/>
    <path d="M28 11 C31 8 36 7 38 10" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" fill="none"/>
    <polygon points="38,10 42,8 40,12 44,13 40,15 41,19 37,16 35,19 36,14 32,12 36,11" fill="#ea580c" stroke="#fef08a" stroke-width="0.8"/>
    <ellipse cx="17" cy="22" rx="4" ry="2" transform="rotate(-30 17 22)" fill="white" fill-opacity="0.3"/>
    <defs><linearGradient id="bombGrad" x1="16" y1="16" x2="28" y2="38" gradientUnits="userSpaceOnUse"><stop stop-color="#475569"/><stop offset="1" stop-color="#090d14"/></linearGradient></defs>
  </svg>`
};

// Karten-Renderer (Old Medieval Fantasy Style)
function renderCard(card) {
  const div = document.createElement('div');
  div.classList.add('card');

  if (card.type === 'wizard') {
    div.classList.add('card-wizard');
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">Z</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.wizard}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.wizard}</div>
        <div class="card-center-val" style="font-size: 26px; color: #fef08a; margin-top: 2px;">Z</div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">Z</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.wizard}</div>
      </div>
    `;
  } else if (card.type === 'jester') {
    div.classList.add('card-jester');
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">N</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.jester}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.jester}</div>
        <div class="card-center-val" style="font-size: 26px; color: #f8fafc; margin-top: 2px;">N</div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">N</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.jester}</div>
      </div>
    `;
  } else if (card.type === 'dragon') {
    div.classList.add('card-dragon');
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">D</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.dragon}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.dragon}</div>
        <div class="card-center-val" style="font-size: 26px; color: #fef08a; margin-top: 2px;">D</div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">D</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.dragon}</div>
      </div>
    `;
  } else if (card.type === 'fairy') {
    div.classList.add('card-fairy');
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">F</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.fairy}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.fairy}</div>
        <div class="card-center-val" style="font-size: 26px; color: #e0f2fe; margin-top: 2px;">F</div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">F</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.fairy}</div>
      </div>
    `;
  } else if (card.type === 'bomb') {
    div.classList.add('card-bomb');
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">B</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.bomb}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.bomb}</div>
        <div class="card-center-val" style="font-size: 26px; color: #fdba74; margin-top: 2px;">B</div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">B</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.bomb}</div>
      </div>
    `;
  } else {
    div.classList.add(`card-${card.suit}`);
    const iconSvg = MEDIEVAL_ICONS[card.suit] || '';
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">${card.value}</span>
        <div class="card-mini-icon">${iconSvg}</div>
      </div>
      <div class="card-center">
        <div class="card-center-val">${card.value}</div>
        <div class="card-center-crest">${iconSvg}</div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">${card.value}</span>
        <div class="card-mini-icon">${iconSvg}</div>
      </div>
    `;
  }

  return div;
}

// --- DAS BUCH DER WAHRHEIT (TABELLE) ---
function renderScoreBoard() {
  scoreTableHead.innerHTML = '';
  scoreTableBody.innerHTML = '';

  if (cachedPlayers.length === 0) return;

  const headerRow = document.createElement('tr');
  const thRound = document.createElement('th');
  thRound.innerText = 'Runde';
  thRound.style.width = '60px';
  headerRow.appendChild(thRound);

  cachedPlayers.forEach(player => {
    const th = document.createElement('th');
    const isMe = (player.sessionId === mySessionId);
    const hostBadge = player.isHost ? '<span class="host-badge">Host</span>' : '';
    const dealerBadge = player.isDealer ? '<span class="dealer-badge">Geber</span>' : '';
    const disconnected = !player.connected ? ' (Getrennt)' : '';

    th.innerHTML = `
      <div>${escapeHtml(player.name)} ${isMe ? '<b>(Du)</b>' : ''}${disconnected}</div>
      <div style="margin: 2px 0;">${hostBadge}${dealerBadge}</div>
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
      const entry = record.entries ? record.entries.find(e => e.sessionId === player.sessionId) : null;

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

  const roundAlreadyFinished = cachedScoreHistory.some(r => r.round === currentRound);
  if (currentGameState !== 'lobby' && !roundAlreadyFinished) {
    const liveRow = document.createElement('tr');
    liveRow.classList.add('current-round-row');

    const tdLiveRound = document.createElement('td');
    tdLiveRound.innerHTML = `<b>${currentRound}</b><br><span style="font-size: 10px; color: #92400e; font-weight: bold;">(aktiv)</span>`;
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

// --- SIEGEREHRUNG ---
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

    row.innerHTML = `<b>${idx + 1}. ${escapeHtml(p.name)}</b>: ${p.totalScore || 0} Punkte`;
    podiumList.appendChild(row);
  });

  if (resetGameBtn) {
    resetGameBtn.style.display = amIHost ? 'block' : 'none';
  }

  gameOverModal.style.display = 'flex';
}

// Initialer Zustand: Haupt-Lobby anzeigen
switchScreen('lobby');