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
const rulesDrawer = document.getElementById('rules-drawer');
const rulesDrawerToggle = document.getElementById('rules-drawer-toggle');
const rulesDrawerClose = document.getElementById('rules-drawer-close');
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

// Modals: 30 Jahre Jubiläumsedition Phase 2
const shapeshifterModal = document.getElementById('shapeshifter-modal');
const btnShapeshifterWizard = document.getElementById('btnShapeshifterWizard');
const btnShapeshifterJester = document.getElementById('btnShapeshifterJester');
const btnShapeshifterCancel = document.getElementById('btnShapeshifterCancel');

const cloudSuitModal = document.getElementById('cloud-suit-modal');
const btnCloudCancel = document.getElementById('btnCloudCancel');

const cloudBidAdjustmentModal = document.getElementById('cloud-bid-adjustment-modal');
const btnCloudMinus = document.getElementById('btnCloudMinus');
const btnCloudPlus = document.getElementById('btnCloudPlus');

// Modals: 30 Jahre Jubiläumsedition Phase 2 Etappe 2 (Werwolf, Hexe, Jongleur)
const werewolfInfoModal = document.getElementById('werewolf-info-modal');
const werewolfInfoTitle = document.getElementById('werewolf-info-title');
const werewolfInfoDesc = document.getElementById('werewolf-info-desc');
const werewolfTakenCardContainer = document.getElementById('werewolf-taken-card-container');
const werewolfNewCardContainer = document.getElementById('werewolf-new-card-container');
const btnWerewolfInfoClose = document.getElementById('btnWerewolfInfoClose');

const jugglerModal = document.getElementById('juggler-modal');
const btnJugglerCancel = document.getElementById('btnJugglerCancel');

const jugglerPassModal = document.getElementById('juggler-pass-modal');
const jugglerPassHand = document.getElementById('juggler-pass-hand');
const btnJugglerPassConfirm = document.getElementById('btnJugglerPassConfirm');

const jugglerReceivedModal = document.getElementById('juggler-received-modal');
const jugglerReceivedDesc = document.getElementById('juggler-received-desc');
const jugglerReceivedCardContainer = document.getElementById('juggler-received-card-container');
const btnJugglerReceivedClose = document.getElementById('btnJugglerReceivedClose');
let jugglerReceivedTimer = null;

const witchModal = document.getElementById('witch-modal');
const witchTrickCards = document.getElementById('witch-trick-cards');
const witchHandCards = document.getElementById('witch-hand-cards');
const btnWitchSwapExecute = document.getElementById('btnWitchSwapExecute');
const btnWitchNoSwap = document.getElementById('btnWitchNoSwap');
const btnWitchCancel = document.getElementById('btnWitchCancel');

const witchSwapShowcase = document.getElementById('witch-swap-showcase');
const witchShowcaseMsg = document.getElementById('witch-showcase-msg');
const witchShowcaseTaken = document.getElementById('witch-showcase-taken');
const witchShowcaseGiven = document.getElementById('witch-showcase-given');

let pendingCardPlayIndex = null;
let selectedWitchTrickIndex = null;
let selectedWitchHandIndex = null;
let selectedJugglerPassCardIndex = null;

function hideSpecialModals() {
  if (shapeshifterModal) shapeshifterModal.style.display = 'none';
  if (cloudSuitModal) cloudSuitModal.style.display = 'none';
  if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
  if (jugglerModal) jugglerModal.style.display = 'none';
  if (witchModal) witchModal.style.display = 'none';
  if (witchSwapShowcase) witchSwapShowcase.style.display = 'none';
  if (jugglerPassModal) jugglerPassModal.style.display = 'none';
  if (jugglerReceivedModal) jugglerReceivedModal.style.display = 'none';
  if (werewolfInfoModal) werewolfInfoModal.style.display = 'none';
  if (jugglerReceivedTimer) {
    clearTimeout(jugglerReceivedTimer);
    jugglerReceivedTimer = null;
  }
  pendingCardPlayIndex = null;
  selectedWitchTrickIndex = null;
  selectedWitchHandIndex = null;
  selectedJugglerPassCardIndex = null;
}

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

  if (screenName !== 'game') {
    hideSpecialModals();
  }
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

// --- DRAWER-STEUERUNG (BUCH DER WAHRHEIT & REGELWERK) ---
function openScoreDrawer() {
  closeRulesDrawer();
  scoreDrawer.classList.add('open');
  drawerBackdrop.classList.add('open');
}

function closeScoreDrawer() {
  scoreDrawer.classList.remove('open');
  if (!rulesDrawer || !rulesDrawer.classList.contains('open')) {
    drawerBackdrop.classList.remove('open');
  }
}

function openRulesDrawer() {
  closeScoreDrawer();
  if (rulesDrawer) rulesDrawer.classList.add('open');
  drawerBackdrop.classList.add('open');
}

function closeRulesDrawer() {
  if (rulesDrawer) rulesDrawer.classList.remove('open');
  if (!scoreDrawer.classList.contains('open')) {
    drawerBackdrop.classList.remove('open');
  }
}

scoreDrawerToggle.addEventListener('click', () => {
  if (scoreDrawer.classList.contains('open')) {
    closeScoreDrawer();
  } else {
    openScoreDrawer();
  }
});

if (rulesDrawerToggle) {
  rulesDrawerToggle.addEventListener('click', () => {
    if (rulesDrawer && rulesDrawer.classList.contains('open')) {
      closeRulesDrawer();
    } else {
      openRulesDrawer();
    }
  });
}

scoreDrawerClose.addEventListener('click', closeScoreDrawer);
if (rulesDrawerClose) rulesDrawerClose.addEventListener('click', closeRulesDrawer);

drawerBackdrop.addEventListener('click', () => {
  closeScoreDrawer();
  closeRulesDrawer();
});

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
      ? '30 Jahre Jubiläumsedition'
      : 'Standard Wizard';
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
        ? '30 Jahre Jubiläumsedition'
        : 'Standard Wizard';
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
        ? '30 Jahre Jubiläumsedition'
        : 'Standard Wizard';
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
  updateMyStatsHUD();
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
  updateMyStatsHUD();
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
  closeRulesDrawer();
  renderTrumpCard(trumpCard);
  renderOpponents();
  renderScoreBoard();
  updateMyStatsHUD();
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
  myHandSection.classList.toggle('my-turn-hand-focus', isMyTurn);

  renderOpponents();
  renderHand();
  renderScoreBoard();

  // Aktiven Spielernamen für zentrierten Status ermitteln
  const activePlayer = cachedPlayers.find(p => p.sessionId === activePlayerSessionId);
  const activePlayerName = activePlayer ? escapeHtml(activePlayer.name) : 'Ein Mitspieler';

  if (gameState === 'choose_trump') {
    bidOverlay.style.display = 'none';
    const isWerewolfChooser = cachedTrumpCard && (cachedTrumpCard.type === 'werewolf_trump_pending' || cachedTrumpCard.isWerewolf);
    const trumpTitle = document.getElementById('trump-selection-title');
    if (isMyTurn) {
      if (isWerewolfChooser) {
        statusMessage.innerText = '🐺 Du hast den Werwolf! Wähle die Trumpffarbe.';
        if (trumpTitle) trumpTitle.innerText = '🐺 Du hast den Werwolf! Wähle die Trumpffarbe:';
      } else {
        statusMessage.innerText = 'Du bist der Geber! Wähle die Trumpffarbe.';
        if (trumpTitle) trumpTitle.innerText = 'Du bist der Geber! Wähle die Trumpffarbe:';
      }
      trumpSelectionArea.style.display = 'block';
    } else {
      if (isWerewolfChooser) {
        statusMessage.innerText = `🐺 ${activePlayerName} wählt die Trumpffarbe...`;
      } else {
        const dealer = cachedPlayers.find(p => p.isDealer);
        const dealerName = dealer ? escapeHtml(dealer.name) : 'Der Geber';
        statusMessage.innerText = `${dealerName} wählt die Trumpffarbe...`;
      }
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
    if (shapeshifterModal) shapeshifterModal.style.display = 'none';
    if (cloudSuitModal) cloudSuitModal.style.display = 'none';
    if (jugglerModal) jugglerModal.style.display = 'none';
    if (witchModal) witchModal.style.display = 'none';
  } else if (gameState === 'cloud_adjust_bid') {
    bidOverlay.style.display = 'none';
    trumpSelectionArea.style.display = 'none';
    if (shapeshifterModal) shapeshifterModal.style.display = 'none';
    if (cloudSuitModal) cloudSuitModal.style.display = 'none';
    if (jugglerModal) jugglerModal.style.display = 'none';
    if (witchModal) witchModal.style.display = 'none';
    if (isMyTurn) {
      statusMessage.innerText = 'Wolken-Prophezeiung! Passe deinen Tipp um +1 oder -1 an.';
      if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'flex';
    } else {
      statusMessage.innerText = `${activePlayerName} passt durch die Wolke den Tipp an...`;
      if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
    }
  } else if (gameState === 'juggler_passing') {
    bidOverlay.style.display = 'none';
    trumpSelectionArea.style.display = 'none';
    if (shapeshifterModal) shapeshifterModal.style.display = 'none';
    if (cloudSuitModal) cloudSuitModal.style.display = 'none';
    if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
    if (jugglerModal) jugglerModal.style.display = 'none';
    if (witchModal) witchModal.style.display = 'none';
    statusMessage.innerText = 'Der Jongleur fordert seinen Tribut! Wähle 1 Handkarte zum verdeckten Weitergeben.';
    if ((!jugglerPassModal || jugglerPassModal.style.display === 'none') && myCurrentHand.length > 0 && selectedJugglerPassCardIndex === null) {
      renderJugglerPassModal('Der Jongleur fordert seinen Tribut! Wähle 1 Handkarte zum verdeckten Weitergeben.');
    }
  } else if (gameState === 'round_over') {
    bidOverlay.style.display = 'none';
    trumpSelectionArea.style.display = 'none';
    hideSpecialModals();
    statusMessage.innerText = 'Runde beendet!';
  }
}

socket.on('handDealt', (hand) => {
  myCurrentHand = hand;
  inspectedCardIndex = null;
  renderHand(true);
});

// Trumpfwahl-Buttons (Geber)
document.querySelectorAll('#trump-selection-area .trump-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const suit = e.target.getAttribute('data-suit');
    socket.emit('selectTrumpSuit', { roomCode: currentRoomCode, suit });
    trumpSelectionArea.style.display = 'none';
  });
});

// Gestaltenwandler-Wahl (Zauberer oder Narr)
if (btnShapeshifterWizard) {
  btnShapeshifterWizard.addEventListener('click', () => {
    if (pendingCardPlayIndex !== null) {
      socket.emit('playCard', {
        roomCode: currentRoomCode,
        cardIndex: pendingCardPlayIndex,
        chosenRole: 'wizard'
      });
      pendingCardPlayIndex = null;
      if (shapeshifterModal) shapeshifterModal.style.display = 'none';
      isMyTurn = false;
      inspectedCardIndex = null;
      renderHand();
    }
  });
}

if (btnShapeshifterJester) {
  btnShapeshifterJester.addEventListener('click', () => {
    if (pendingCardPlayIndex !== null) {
      socket.emit('playCard', {
        roomCode: currentRoomCode,
        cardIndex: pendingCardPlayIndex,
        chosenRole: 'jester'
      });
      pendingCardPlayIndex = null;
      if (shapeshifterModal) shapeshifterModal.style.display = 'none';
      isMyTurn = false;
      inspectedCardIndex = null;
      renderHand();
    }
  });
}

if (btnShapeshifterCancel) {
  btnShapeshifterCancel.addEventListener('click', () => {
    pendingCardPlayIndex = null;
    if (shapeshifterModal) shapeshifterModal.style.display = 'none';
  });
}

// Wolke-Farbauswahl
document.querySelectorAll('#cloud-suit-modal .cloud-suit-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const suit = e.target.getAttribute('data-suit');
    if (pendingCardPlayIndex !== null && suit) {
      socket.emit('playCard', {
        roomCode: currentRoomCode,
        cardIndex: pendingCardPlayIndex,
        chosenSuit: suit
      });
      pendingCardPlayIndex = null;
      if (cloudSuitModal) cloudSuitModal.style.display = 'none';
      isMyTurn = false;
      inspectedCardIndex = null;
      renderHand();
    }
  });
});

if (btnCloudCancel) {
  btnCloudCancel.addEventListener('click', () => {
    pendingCardPlayIndex = null;
    if (cloudSuitModal) cloudSuitModal.style.display = 'none';
  });
}

// Wolke: Tipp-Anpassung (+1 / -1)
socket.on('cloudBidAdjustmentPending', ({ playerName, playerSessionId }) => {
  if (playerSessionId !== mySessionId) {
    statusMessage.innerText = `☁️ ${escapeHtml(playerName)} hat die Wolke gewonnen und passt den Tipp an...`;
  }
});

socket.on('cloudBidAdjustmentPrompt', ({ currentBid }) => {
  statusMessage.innerText = `☁️ Wolken-Prophezeiung! Passe deinen Tipp (${currentBid}) um +1 oder -1 an.`;
  if (btnCloudMinus) {
    btnCloudMinus.disabled = (currentBid <= 0);
    btnCloudMinus.style.opacity = (currentBid <= 0) ? '0.4' : '1';
    btnCloudMinus.style.cursor = (currentBid <= 0) ? 'not-allowed' : 'pointer';
  }
  if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'flex';
});

if (btnCloudMinus) {
  btnCloudMinus.addEventListener('click', () => {
    socket.emit('submitCloudBidAdjustment', { roomCode: currentRoomCode, adjustment: -1 });
    if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
  });
}

if (btnCloudPlus) {
  btnCloudPlus.addEventListener('click', () => {
    socket.emit('submitCloudBidAdjustment', { roomCode: currentRoomCode, adjustment: 1 });
    if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
  });
}

socket.on('cloudBidAdjusted', ({ playerName, oldBid, newBid }) => {
  if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
  statusMessage.innerText = `☁️ ${escapeHtml(playerName)} hat den Tipp von ${oldBid} auf ${newBid} korrigiert!`;
});

// --- 30 JAHRE JUBILÄUMSEDITION: ETAPPE 2 HANDLERS ---

// Jongleur: Farbauswahl beim Ausspielen
document.querySelectorAll('#juggler-modal .juggler-suit-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const suit = e.target.getAttribute('data-suit');
    if (pendingCardPlayIndex !== null && suit) {
      socket.emit('playCard', {
        roomCode: currentRoomCode,
        cardIndex: pendingCardPlayIndex,
        chosenSuit: suit
      });
      pendingCardPlayIndex = null;
      if (jugglerModal) jugglerModal.style.display = 'none';
      isMyTurn = false;
      inspectedCardIndex = null;
      renderHand();
    }
  });
});

if (btnJugglerCancel) {
  btnJugglerCancel.addEventListener('click', () => {
    pendingCardPlayIndex = null;
    if (jugglerModal) jugglerModal.style.display = 'none';
  });
}

// Jongleur: Geheimes Weitergeben (Tribut)
function renderJugglerPassModal(message) {
  selectedJugglerPassCardIndex = null;
  if (btnJugglerPassConfirm) {
    btnJugglerPassConfirm.disabled = true;
    btnJugglerPassConfirm.style.opacity = '0.5';
    btnJugglerPassConfirm.style.cursor = 'not-allowed';
    btnJugglerPassConfirm.innerText = 'Karte verdeckt weitergeben';
  }

  if (jugglerPassHand) {
    jugglerPassHand.innerHTML = '';
    myCurrentHand.forEach((card, idx) => {
      const el = renderCard(card);
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        selectedJugglerPassCardIndex = idx;
        jugglerPassHand.querySelectorAll('.card').forEach((c, i) => {
          if (i === idx) {
            c.style.transform = 'translateY(-12px) scale(1.06)';
            c.style.boxShadow = '0 0 16px #06b6d4, 0 8px 24px rgba(0,0,0,0.8)';
          } else {
            c.style.transform = 'none';
            c.style.boxShadow = 'none';
          }
        });
        if (btnJugglerPassConfirm) {
          btnJugglerPassConfirm.disabled = false;
          btnJugglerPassConfirm.style.opacity = '1';
          btnJugglerPassConfirm.style.cursor = 'pointer';
        }
      });
      jugglerPassHand.appendChild(el);
    });
  }

  if (jugglerPassModal) jugglerPassModal.style.display = 'flex';
  statusMessage.innerText = message || 'Jongleur! Wähle 1 Karte zum geheimen Weitergeben.';
}

socket.on('jugglerPassPrompt', (data) => {
  const message = (data && data.message) ? data.message : 'Der Jongleur fordert seinen Tribut! Wähle 1 Handkarte zum verdeckten Weitergeben.';
  if (data && Array.isArray(data.hand) && data.hand.length > 0) {
    myCurrentHand = data.hand;
  }
  renderJugglerPassModal(message);
});

if (btnJugglerPassConfirm) {
  btnJugglerPassConfirm.addEventListener('click', () => {
    if (selectedJugglerPassCardIndex !== null) {
      socket.emit('submitJugglerPassCard', {
        roomCode: currentRoomCode,
        cardIndex: selectedJugglerPassCardIndex
      });
      btnJugglerPassConfirm.disabled = true;
      btnJugglerPassConfirm.innerText = 'Warte auf Mitspieler...';
      btnJugglerPassConfirm.style.opacity = '0.6';
      btnJugglerPassConfirm.style.cursor = 'not-allowed';
    }
  });
}

socket.on('jugglerPassProgress', ({ selectedCount, totalCount }) => {
  if (btnJugglerPassConfirm && selectedJugglerPassCardIndex !== null && btnJugglerPassConfirm.disabled) {
    btnJugglerPassConfirm.innerText = `Warte auf Mitspieler (${selectedCount}/${totalCount} gewählt)...`;
  }
});

socket.on('jugglerCardConfirmed', () => {
  if (btnJugglerPassConfirm) {
    btnJugglerPassConfirm.disabled = true;
    btnJugglerPassConfirm.innerText = 'Warte auf Mitspieler...';
  }
});

socket.on('jugglerCardReceived', ({ fromPlayerName, card }) => {
  if (jugglerPassModal) jugglerPassModal.style.display = 'none';
  selectedJugglerPassCardIndex = null;

  if (jugglerReceivedDesc) {
    jugglerReceivedDesc.innerHTML = `Du hast verdeckt eine neue Karte von <b>${escapeHtml(fromPlayerName)}</b> erhalten:`;
  }
  if (jugglerReceivedCardContainer) {
    jugglerReceivedCardContainer.innerHTML = '';
    if (card) {
      jugglerReceivedCardContainer.appendChild(renderCard(card));
    }
  }
  if (jugglerReceivedModal) {
    jugglerReceivedModal.style.display = 'flex';
  }

  if (jugglerReceivedTimer) clearTimeout(jugglerReceivedTimer);
  jugglerReceivedTimer = setTimeout(() => {
    if (jugglerReceivedModal) jugglerReceivedModal.style.display = 'none';
  }, 3500);
});

if (btnJugglerReceivedClose) {
  btnJugglerReceivedClose.addEventListener('click', () => {
    if (jugglerReceivedTimer) {
      clearTimeout(jugglerReceivedTimer);
      jugglerReceivedTimer = null;
    }
    if (jugglerReceivedModal) jugglerReceivedModal.style.display = 'none';
  });
}

socket.on('jugglerPassingComplete', ({ message }) => {
  if (jugglerPassModal) jugglerPassModal.style.display = 'none';
  selectedJugglerPassCardIndex = null;
  statusMessage.innerText = message || 'Karten wurden verdeckt weitergegeben. Das Spiel geht weiter!';
});

// Wolke: Tipp-Anpassung (+1 / -1) nach Beenden des Stichs
socket.on('cloudBidAdjustmentPrompt', ({ currentBid }) => {
  if (!cloudBidAdjustmentModal) return;
  cloudBidAdjustmentModal.style.display = 'flex';
  if (btnCloudMinus) {
    if (currentBid <= 0) {
      btnCloudMinus.disabled = true;
      btnCloudMinus.style.opacity = '0.4';
      btnCloudMinus.style.cursor = 'not-allowed';
      btnCloudMinus.title = 'Vorhersage kann nicht unter 0 sinken';
    } else {
      btnCloudMinus.disabled = false;
      btnCloudMinus.style.opacity = '1';
      btnCloudMinus.style.cursor = 'pointer';
      btnCloudMinus.title = '';
    }
  }
});

socket.on('cloudBidAdjustmentPending', ({ playerName }) => {
  statusMessage.innerText = `☁️ ${escapeHtml(playerName)} muss die Wolken-Vorhersage anpassen (+1 / -1)...`;
});

socket.on('cloudBidAdjusted', ({ playerName, oldBid, newBid }) => {
  showToast(`☁️ ${escapeHtml(playerName)} hat die Vorhersage von ${oldBid} auf ${newBid} geändert!`);
});

if (btnCloudMinus) {
  btnCloudMinus.addEventListener('click', () => {
    socket.emit('submitCloudBidAdjustment', { roomCode: currentRoomCode, adjustment: -1 });
    if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
  });
}

if (btnCloudPlus) {
  btnCloudPlus.addEventListener('click', () => {
    socket.emit('submitCloudBidAdjustment', { roomCode: currentRoomCode, adjustment: 1 });
    if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
  });
}

// Hexe: Tausch-Modal Steuerung nach Beenden des Stichs
socket.on('witchSwapPrompt', ({ trickCards, handCards }) => {
  renderWitchModal(trickCards, handCards || myCurrentHand);
});

socket.on('witchSwapPending', ({ playerName }) => {
  statusMessage.innerText = `🧙‍♀️ ${escapeHtml(playerName)} vollzieht den Hexen-Tausch mit dem Stich...`;
});

function renderWitchModal(trickCards, handCards) {
  selectedWitchTrickIndex = null;
  selectedWitchHandIndex = null;
  if (btnWitchSwapExecute) {
    btnWitchSwapExecute.disabled = true;
    btnWitchSwapExecute.style.opacity = '0.5';
    btnWitchSwapExecute.style.cursor = 'not-allowed';
  }

  // Trick-Karten rendern
  if (witchTrickCards) {
    witchTrickCards.innerHTML = '';
    const cards = trickCards || currentTrick || [];
    cards.forEach((trickItem, tIdx) => {
      const isWitch = trickItem.card && trickItem.card.type === 'witch';
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.alignItems = 'center';

      const lbl = document.createElement('span');
      lbl.style.fontSize = '10px';
      lbl.style.color = '#c084fc';
      lbl.style.marginBottom = '2px';
      lbl.innerText = isWitch ? `${escapeHtml(trickItem.playerName)} (Hexe)` : escapeHtml(trickItem.playerName);

      const el = renderCard(trickItem.card);

      if (isWitch) {
        wrap.style.cursor = 'not-allowed';
        wrap.style.opacity = '0.4';
        wrap.title = 'Die Hexe selbst kann nicht aus dem Stich genommen werden';
      } else {
        wrap.style.cursor = 'pointer';
        wrap.addEventListener('click', () => {
          selectedWitchTrickIndex = tIdx;
          witchTrickCards.querySelectorAll('.card').forEach((c, idx) => {
            if (idx === tIdx) {
              c.style.transform = 'scale(1.08)';
              c.style.boxShadow = '0 0 16px #c084fc, 0 6px 20px rgba(0,0,0,0.8)';
            } else {
              c.style.transform = 'none';
              c.style.boxShadow = 'none';
            }
          });
          checkWitchSwapReady();
        });
      }

      wrap.appendChild(lbl);
      wrap.appendChild(el);
      witchTrickCards.appendChild(wrap);
    });
  }

  // Eigene Handkarten rendern
  if (witchHandCards) {
    witchHandCards.innerHTML = '';
    const cards = handCards || myCurrentHand || [];
    cards.forEach((hCard, hIdx) => {
      const wrap = document.createElement('div');
      wrap.style.cursor = 'pointer';
      const el = renderCard(hCard);
      wrap.appendChild(el);

      wrap.addEventListener('click', () => {
        selectedWitchHandIndex = hIdx;
        witchHandCards.querySelectorAll('.card').forEach((c) => {
          c.style.transform = 'none';
          c.style.boxShadow = 'none';
        });
        el.style.transform = 'scale(1.08)';
        el.style.boxShadow = '0 0 16px #c084fc, 0 6px 20px rgba(0,0,0,0.8)';
        checkWitchSwapReady();
      });
      witchHandCards.appendChild(wrap);
    });
  }

  if (witchModal) witchModal.style.display = 'flex';
}

function checkWitchSwapReady() {
  const ready = (selectedWitchTrickIndex !== null && selectedWitchHandIndex !== null);
  if (btnWitchSwapExecute) {
    btnWitchSwapExecute.disabled = !ready;
    btnWitchSwapExecute.style.opacity = ready ? '1' : '0.5';
    btnWitchSwapExecute.style.cursor = ready ? 'pointer' : 'not-allowed';
  }
}

if (btnWitchSwapExecute) {
  btnWitchSwapExecute.addEventListener('click', () => {
    if (selectedWitchTrickIndex !== null && selectedWitchHandIndex !== null) {
      socket.emit('submitWitchSwap', {
        roomCode: currentRoomCode,
        trickCardIndex: selectedWitchTrickIndex,
        handCardIndex: selectedWitchHandIndex
      });
      hideSpecialModals();
    }
  });
}

if (btnWitchCancel) {
  btnWitchCancel.addEventListener('click', () => {
    // Tausch ist Pflicht, Modal bleibt aktiv
  });
}

// Hexe: 3.5s Showcase Overlay für alle Mitspieler zum Kartenzählen
socket.on('witchSwapShowcase', (data) => {
  const pName = (data && (data.witchPlayerName || data.playerName)) || 'Ein Magier';
  if (witchShowcaseMsg) {
    witchShowcaseMsg.innerText = `🧙‍♀️ ${escapeHtml(pName)} hat einen Hexen-Tausch vollzogen!`;
  }
  if (witchShowcaseTaken) {
    witchShowcaseTaken.innerHTML = '';
    if (data && data.takenCard) witchShowcaseTaken.appendChild(renderCard(data.takenCard));
  }
  if (witchShowcaseGiven) {
    witchShowcaseGiven.innerHTML = '';
    if (data && data.givenCard) witchShowcaseGiven.appendChild(renderCard(data.givenCard));
  }
  if (witchSwapShowcase) witchSwapShowcase.style.display = 'flex';

  setTimeout(() => {
    if (witchSwapShowcase) witchSwapShowcase.style.display = 'none';
  }, (data && data.durationMs) || 3500);
});

// Werwolf: Benachrichtigung & Animation beim Trumpftausch
socket.on('werewolfTrumpSwapped', ({ werewolfPlayerName, takenCard, newTrumpCard, trumpSuit }) => {
  if (werewolfInfoTitle) {
    werewolfInfoTitle.innerText = '🐺 Werwolf auf der Hand!';
  }
  if (werewolfInfoDesc) {
    werewolfInfoDesc.innerText = `${escapeHtml(werewolfPlayerName)} besitzt den Werwolf! Er nimmt die aufgedeckte Trumpfkarte auf die Hand und bestimmt selbst die neue Trumpffarbe:`;
  }
  if (werewolfTakenCardContainer) {
    werewolfTakenCardContainer.innerHTML = '';
    if (takenCard) werewolfTakenCardContainer.appendChild(renderCard(takenCard));
  }
  if (werewolfNewCardContainer) {
    werewolfNewCardContainer.innerHTML = '';
    if (newTrumpCard) werewolfNewCardContainer.appendChild(renderCard(newTrumpCard));
  }
  if (werewolfInfoModal) werewolfInfoModal.style.display = 'flex';
  statusMessage.innerText = `🐺 ${escapeHtml(werewolfPlayerName)} wählt als Werwolf-Meister die Trumpffarbe!`;
});

if (btnWerewolfInfoClose) {
  btnWerewolfInfoClose.addEventListener('click', () => {
    if (werewolfInfoModal) werewolfInfoModal.style.display = 'none';
  });
}

socket.on('vampireRevealedNewTrump', ({ vampirePlayerName, newTrumpCard, trumpSuit }) => {
  cachedTrumpCard = newTrumpCard;
  renderTrumpCard(newTrumpCard);
  const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb', none: 'Kein Trumpf' };
  const sText = suitNames[trumpSuit] || trumpSuit;
  statusMessage.innerText = `🦇 ${escapeHtml(vampirePlayerName)} hat als Vampir eine neue Trumpfkarte aufgedeckt! (Trumpf: ${sText})`;
});

socket.on('trumpSuitChosen', ({ suit, trumpCard }) => {
  if (werewolfInfoModal) werewolfInfoModal.style.display = 'none';
  cachedTrumpCard = trumpCard;
  renderTrumpCard(trumpCard);
  const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
  statusMessage.innerText = `Trumpf ist ${suitNames[suit] || suit}. Das Tippen beginnt!`;
  updateMyStatsHUD();
});

socket.on('biddingFinished', () => {
  if (werewolfInfoModal) werewolfInfoModal.style.display = 'none';
  bidOverlay.style.display = 'none';
  statusMessage.innerText = 'Alle Tipps abgegeben! Das Ausspielen beginnt.';
  updateMyStatsHUD();
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
  if (shapeshifterModal) shapeshifterModal.style.display = 'none';
  if (cloudSuitModal) cloudSuitModal.style.display = 'none';
  if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
  pendingCardPlayIndex = null;

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
  if (shapeshifterModal) shapeshifterModal.style.display = 'none';
  if (cloudSuitModal) cloudSuitModal.style.display = 'none';
  if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
  pendingCardPlayIndex = null;

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

    let foreheadBadgeHtml = '';
    if (currentRound === 1 && p.round1Card) {
      const effC = p.round1Card;
      let cardDisplay = '';
      let pillStyle = '';

      if (effC.type === 'color') {
        const suitColors = { red: '#ef4444', blue: '#38bdf8', green: '#4ade80', yellow: '#facc15' };
        const suitBg = { red: 'rgba(239, 68, 68, 0.25)', blue: 'rgba(56, 189, 248, 0.25)', green: 'rgba(74, 222, 128, 0.25)', yellow: 'rgba(250, 204, 21, 0.25)' };
        const col = suitColors[effC.suit] || '#fff';
        const bg = suitBg[effC.suit] || 'transparent';
        cardDisplay = `${effC.value}`;
        pillStyle = `color: ${col}; background: ${bg}; border-color: ${col};`;
      } else if (effC.type === 'wizard') {
        cardDisplay = 'Zauberer (Z)';
        pillStyle = 'color: #fef08a; background: rgba(168, 85, 247, 0.25); border-color: #a855f7;';
      } else if (effC.type === 'jester') {
        cardDisplay = 'Narr (N)';
        pillStyle = 'color: #cbd5e1; background: rgba(71, 85, 105, 0.25); border-color: #94a3b8;';
      } else if (effC.type === 'dragon') {
        cardDisplay = 'Drache (D)';
        pillStyle = 'color: #fca5a5; background: rgba(220, 38, 38, 0.25); border-color: #ef4444;';
      } else if (effC.type === 'fairy') {
        cardDisplay = 'Fee (F)';
        pillStyle = 'color: #bae6fd; background: rgba(2, 132, 199, 0.25); border-color: #38bdf8;';
      } else if (effC.type === 'bomb') {
        cardDisplay = 'Bombe (B)';
        pillStyle = 'color: #fdba74; background: rgba(234, 88, 12, 0.25); border-color: #f97316;';
      } else if (effC.type === 'werewolf') {
        cardDisplay = 'Werwolf (W)';
        pillStyle = 'color: #fef08a; background: rgba(180, 83, 9, 0.25); border-color: #f59e0b;';
      } else if (effC.type === 'cloud') {
        cardDisplay = 'Wolke (9¾)';
        pillStyle = 'color: #e0e7ff; background: rgba(71, 85, 105, 0.25); border-color: #818cf8;';
      } else if (effC.type === 'witch') {
        cardDisplay = 'Hexe (H)';
        pillStyle = 'color: #e9d5ff; background: rgba(126, 34, 206, 0.25); border-color: #c084fc;';
      } else if (effC.type === 'juggler') {
        cardDisplay = 'Jongleur (7½)';
        pillStyle = 'color: #cffafe; background: rgba(8, 145, 178, 0.25); border-color: #06b6d4;';
      } else if (effC.type === 'vampire') {
        cardDisplay = 'Vampir (V)';
        pillStyle = 'color: #fecdd3; background: rgba(190, 18, 60, 0.25); border-color: #f43f5e;';
      } else if (effC.type === 'shapeshifter') {
        cardDisplay = 'Wandler (G)';
        pillStyle = 'color: #a7f3d0; background: rgba(5, 150, 105, 0.25); border-color: #34d399;';
      }

      foreheadBadgeHtml = `
        <div class="forehead-badge" title="Stirn-Karte dieses Spielers">
          <span class="forehead-badge-label">Stirn:</span>
          <span class="forehead-card-pill" style="${pillStyle}">${cardDisplay}</span>
        </div>
      `;
    }

    seatEl.innerHTML = `
      ${foreheadBadgeHtml}
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

function updateMyStatsHUD() {
  const me = cachedPlayers.find(p => p.sessionId === mySessionId);
  const bidEl = document.getElementById('my-hud-bid');
  const tricksEl = document.getElementById('my-hud-tricks');

  const bidVal = (me && me.bid !== null && me.bid !== undefined) ? me.bid : '-';
  const tricksVal = (me && me.tricksWon !== undefined) ? me.tricksWon : 0;

  if (bidEl) bidEl.innerText = bidVal;
  if (tricksEl) tricksEl.innerText = tricksVal;
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

  if (trumpCard.type === 'werewolf_trump_pending') {
    subText.style.color = '#f59e0b';
    subText.innerText = 'Werwolf wählt...';
  } else if (trumpCard.type === 'werewolf_trump') {
    const sName = suitNames[trumpCard.chosenSuit || trumpCard.suit] || 'Unbekannt';
    subText.style.color = 'var(--gold-bright)';
    subText.innerText = `Werwolf-Trumpf: ${sName}`;
  } else if (['wizard', 'dragon', 'shapeshifter', 'cloud', 'vampire'].includes(trumpCard.type)) {
    if (trumpCard.chosenSuit) {
      subText.style.color = 'var(--gold-bright)';
      subText.innerText = `Trumpf: ${suitNames[trumpCard.chosenSuit] || trumpCard.chosenSuit}`;
    } else {
      subText.style.color = '#c084fc';
      subText.innerText = 'Geber wählt...';
    }
  } else if (['jester', 'fairy', 'bomb', 'witch', 'juggler'].includes(trumpCard.type)) {
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

// --- EFFEKTIVE KARTE ERMITTELN (FÜR BEDIENTESTS) ---
function getEffectiveCard(card) {
  if (!card) return card;
  if (card.type === 'shapeshifter') {
    if (card.chosenRole === 'wizard') {
      return { ...card, type: 'wizard', value: 14, suit: 'none' };
    }
    return { ...card, type: 'jester', value: 0, suit: 'none' };
  }
  if (card.type === 'cloud') {
    return { ...card, type: 'color', suit: card.chosenSuit || 'none', value: 9.75 };
  }
  if (card.type === 'juggler') {
    return { ...card, type: 'color', suit: card.chosenSuit || 'none', value: 7.5 };
  }
  if (card.type === 'werewolf' || card.type === 'witch') {
    return { ...card, type: 'jester', value: 0, suit: 'none' };
  }
  if (card.type === 'werewolf_trump') {
    return { ...card, type: 'color', suit: card.suit || card.chosenSuit || 'none', value: 14 };
  }
  if (card.type === 'vampire') {
    if (card.copiedCard && card.copiedCard.type !== 'vampire') {
      return getEffectiveCard(card.copiedCard);
    }
    return { ...card, type: 'jester', value: 0, suit: 'none' };
  }
  return card;
}

// --- REGEL-PRÜFUNG: IST KARTE SPIELBAR? ---
function isCardPlayable(cardToPlay, hand, trick) {
  if (cardToPlay.isBlind || cardToPlay.type === 'blind_card') {
    return true;
  }
  if (['wizard', 'jester', 'dragon', 'fairy', 'bomb', 'shapeshifter', 'cloud', 'vampire', 'werewolf', 'witch', 'juggler'].includes(cardToPlay.type)) {
    return true;
  }
  if (!trick || trick.length === 0) {
    return true;
  }
  let leadSuit = 'none';
  for (let i = 0; i < trick.length; i++) {
    const trickCard = trick[i].card;
    const effCard = getEffectiveCard(trickCard);
    if (effCard.type === 'wizard' || effCard.type === 'dragon') break;
    if (effCard.type === 'color') {
      leadSuit = effCard.suit;
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

    cardElement.style.marginLeft = (index === 0) ? '0px' : dynamicMargin;
    cardElement.style.marginRight = '0px';
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
          if (card.isBlind || card.type === 'blind_card') {
            socket.emit('playCard', { roomCode: currentRoomCode, cardIndex: index });
            isMyTurn = false;
            inspectedCardIndex = null;
            renderHand();
            return;
          }
          if (card.type === 'shapeshifter') {
            pendingCardPlayIndex = index;
            if (shapeshifterModal) shapeshifterModal.style.display = 'block';
            return;
          }
          if (card.type === 'cloud') {
            pendingCardPlayIndex = index;
            if (cloudSuitModal) cloudSuitModal.style.display = 'block';
            return;
          }
          if (card.type === 'juggler') {
            pendingCardPlayIndex = index;
            if (jugglerModal) jugglerModal.style.display = 'block';
            return;
          }
          if (card.type === 'witch') {
            socket.emit('playCard', { roomCode: currentRoomCode, cardIndex: index });
            isMyTurn = false;
            inspectedCardIndex = null;
            renderHand();
            return;
          }

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
  </svg>`,

  shapeshifter: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 14 C12 6 24 6 24 6 C24 6 36 6 36 14 C36 28 24 40 24 40 C24 40 12 28 12 14 Z" fill="url(#maskGrad)" stroke="#34d399" stroke-width="1.2"/>
    <path d="M24 6 V40" stroke="#064e3b" stroke-width="1" stroke-dasharray="2 2"/>
    <path d="M16 18 Q20 15 22 19 Q19 22 16 18 Z" fill="#022c22" stroke="#6ee7b7" stroke-width="0.8"/>
    <path d="M26 19 Q28 15 32 18 Q29 22 26 19 Z" fill="#451a03" stroke="#fef08a" stroke-width="0.8"/>
    <path d="M18 29 Q24 33 30 29" stroke="#34d399" stroke-width="1.2" fill="none"/>
    <circle cx="24" cy="10" r="2" fill="#fef08a"/>
    <defs><linearGradient id="maskGrad" x1="12" y1="10" x2="36" y2="36" gradientUnits="userSpaceOnUse"><stop stop-color="#059669"/><stop offset="0.5" stop-color="#047857"/><stop offset="1" stop-color="#064e3b"/></linearGradient></defs>
  </svg>`,

  vampire: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 14 C27 8 30 8 32 12 C36 10 42 14 44 22 C39 20 35 24 33 30 C30 25 27 27 24 34 C21 27 18 25 15 30 C13 24 9 20 4 22 C6 14 12 10 16 12 C18 8 21 8 24 14 Z" fill="url(#vampGrad)" stroke="#ef4444" stroke-width="1.2"/>
    <polygon points="21,24 22,28 23,24" fill="#ffffff"/>
    <polygon points="25,24 26,28 27,24" fill="#ffffff"/>
    <circle cx="20" cy="18" r="1.5" fill="#f87171"/>
    <circle cx="28" cy="18" r="1.5" fill="#f87171"/>
    <defs><linearGradient id="vampGrad" x1="24" y1="8" x2="24" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="#7f1d1d"/><stop offset="1" stop-color="#180303"/></linearGradient></defs>
  </svg>`,

  cloud: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 32 C12 32 9 29 9 25 C9 21.5 11.5 18.5 15 18 C16.5 13 21 9 26 9 C31.5 9 36 13 36.5 18.5 C39.5 19.5 42 22 42 25.5 C42 29 39 32 35 32 Z" fill="url(#cloudGrad)" stroke="#94a3b8" stroke-width="1.3"/>
    <polygon points="25,21 21,29 26,29 23,37 30,27 25,27" fill="#fef08a" stroke="#ca8a04" stroke-width="0.8"/>
    <defs><linearGradient id="cloudGrad" x1="24" y1="9" x2="24" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#64748b"/><stop offset="1" stop-color="#1e293b"/></linearGradient></defs>
  </svg>`,

  werewolf: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 36 L15 22 L10 14 L20 18 L24 8 L28 18 L38 14 L33 22 L36 36 L24 32 Z" fill="url(#werewolfGrad)" stroke="#f59e0b" stroke-width="1.3"/>
    <circle cx="19" cy="22" r="2" fill="#fbbf24"/>
    <circle cx="29" cy="22" r="2" fill="#fbbf24"/>
    <polygon points="22,27 24,30 26,27" fill="#78350f"/>
    <polygon points="20,29 21,32 22,29" fill="#fef3c7"/>
    <polygon points="26,29 27,32 28,29" fill="#fef3c7"/>
    <defs><linearGradient id="werewolfGrad" x1="24" y1="8" x2="24" y2="36" gradientUnits="userSpaceOnUse"><stop stop-color="#b45309"/><stop offset="1" stop-color="#451a03"/></linearGradient></defs>
  </svg>`,

  witch: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 34 C16 31 32 31 38 34 C36 31 30 28 27 26 L36 12 L22 23 C18 26 12 31 10 34 Z" fill="url(#witchGrad)" stroke="#c084fc" stroke-width="1.2"/>
    <path d="M28 14 Q32 10 38 12 Q33 17 31 20" fill="none" stroke="#fef08a" stroke-width="1.2"/>
    <circle cx="21" cy="29" r="2" fill="#34d399"/>
    <circle cx="27" cy="29" r="2" fill="#34d399"/>
    <path d="M16 38 C16 42 32 42 32 38" stroke="#a855f7" stroke-width="1.5" fill="none"/>
    <defs><linearGradient id="witchGrad" x1="24" y1="12" x2="24" y2="38" gradientUnits="userSpaceOnUse"><stop stop-color="#7e22ce"/><stop offset="1" stop-color="#2e1065"/></linearGradient></defs>
  </svg>`,

  juggler: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="12" r="5" fill="url(#jugglerOrb1)" stroke="#06b6d4" stroke-width="1.2"/>
    <circle cx="14" cy="24" r="5" fill="url(#jugglerOrb2)" stroke="#ca8a04" stroke-width="1.2"/>
    <circle cx="34" cy="24" r="5" fill="url(#jugglerOrb3)" stroke="#06b6d4" stroke-width="1.2"/>
    <path d="M16 36 C18 30 24 28 24 28 C24 28 30 30 32 36 C28 40 20 40 16 36 Z" fill="url(#jugglerCap)" stroke="#38bdf8" stroke-width="1.2"/>
    <circle cx="16" cy="36" r="1.5" fill="#fef08a"/>
    <circle cx="32" cy="36" r="1.5" fill="#fef08a"/>
    <circle cx="24" cy="40" r="1.5" fill="#fef08a"/>
    <defs>
      <radialGradient id="jugglerOrb1" cx="40%" cy="40%" r="60%"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#0e7490"/></radialGradient>
      <radialGradient id="jugglerOrb2" cx="40%" cy="40%" r="60%"><stop stop-color="#fef08a"/><stop offset="1" stop-color="#a16207"/></radialGradient>
      <radialGradient id="jugglerOrb3" cx="40%" cy="40%" r="60%"><stop stop-color="#67e8f9"/><stop offset="1" stop-color="#155e75"/></radialGradient>
      <linearGradient id="jugglerCap" x1="16" y1="28" x2="32" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#0891b2"/><stop offset="1" stop-color="#164e63"/></linearGradient>
    </defs>
  </svg>`
};

// Karten-Renderer (Old Medieval Fantasy Style)
function renderCard(card) {
  const div = document.createElement('div');
  div.classList.add('card');

  if (card.isBlind || card.type === 'blind_card') {
    div.classList.add('card-blind');
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">?</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest" style="font-size: 20px;">✦</div>
        <div class="card-center-val" style="font-size: 28px; color: var(--gold-bright); margin-top: 1px;">?</div>
        <div class="card-name-label"><em>Stirn-Karte</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">?</span>
      </div>
    `;
    return div;
  }

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
        <div class="card-name-label"><em>Zauberer</em></div>
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
        <div class="card-name-label"><em>Narr</em></div>
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
        <div class="card-name-label"><em>Drache</em></div>
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
        <div class="card-name-label"><em>Fee</em></div>
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
        <div class="card-name-label"><em>Bombe</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">B</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.bomb}</div>
      </div>
    `;
  } else if (card.type === 'shapeshifter') {
    div.classList.add('card-shapeshifter');
    const roleSub = card.chosenRole === 'wizard' ? ' (Z)' : (card.chosenRole === 'jester' ? ' (N)' : '');
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">G</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.shapeshifter}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.shapeshifter}</div>
        <div class="card-center-val" style="font-size: 24px; color: #a7f3d0; margin-top: 2px;">G${roleSub}</div>
        <div class="card-name-label"><em>Gestaltenwandler</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">G</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.shapeshifter}</div>
      </div>
    `;
  } else if (card.type === 'vampire') {
    div.classList.add('card-vampire');
    let copyLabel = '';
    if (card.copiedCard) {
      if (card.copiedCard.type === 'wizard') copyLabel = '<div style="font-size: 8.5px; color: #fef08a; margin-top: 1px;">Kopie: Zauberer</div>';
      else if (card.copiedCard.type === 'jester') copyLabel = '<div style="font-size: 8.5px; color: #cbd5e1; margin-top: 1px;">Kopie: Narr</div>';
      else if (card.copiedCard.type === 'dragon') copyLabel = '<div style="font-size: 8.5px; color: #fef08a; margin-top: 1px;">Kopie: Drache</div>';
      else if (card.copiedCard.type === 'fairy') copyLabel = '<div style="font-size: 8.5px; color: #bae6fd; margin-top: 1px;">Kopie: Fee</div>';
      else if (card.copiedCard.type === 'bomb') copyLabel = '<div style="font-size: 8.5px; color: #fdba74; margin-top: 1px;">Kopie: Bombe</div>';
      else if (card.copiedCard.type === 'werewolf' || card.copiedCard.type === 'werewolf_trump' || card.copiedCard.type === 'werewolf_trump_pending') {
        const cSuit = card.copiedCard.chosenSuit ? ` (${card.copiedCard.chosenSuit})` : '';
        copyLabel = `<div style="font-size: 8.5px; color: #f59e0b; margin-top: 1px;">Kopie: Werwolf${cSuit}</div>`;
      }
      else if (card.copiedCard.type === 'witch') copyLabel = '<div style="font-size: 8.5px; color: #c084fc; margin-top: 1px;">Kopie: Hexe</div>';
      else if (card.copiedCard.type === 'juggler') copyLabel = '<div style="font-size: 8.5px; color: #67e8f9; margin-top: 1px;">Kopie: Jongleur</div>';
      else if (card.copiedCard.type === 'color') {
        const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
        const sName = suitNames[card.copiedCard.suit] || card.copiedCard.suit;
        const valStr = card.copiedCard.value ? ` ${card.copiedCard.value}` : '';
        copyLabel = `<div style="font-size: 8.5px; color: #fca5a5; margin-top: 1px;">Kopie: ${sName}${valStr}</div>`;
      }
    }
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">V</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.vampire}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.vampire}</div>
        <div class="card-center-val" style="font-size: 24px; color: #fca5a5; margin-top: 1px;">V</div>
        <div class="card-name-label"><em>Vampir</em></div>
        ${copyLabel}
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">V</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.vampire}</div>
      </div>
    `;
  } else if (card.type === 'cloud') {
    div.classList.add('card-cloud');
    const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
    const suitSub = card.chosenSuit ? `<div style="font-size: 8.5px; color: #93c5fd; margin-top: 1px;">${suitNames[card.chosenSuit] || card.chosenSuit}</div>` : '';
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val" style="font-size: 13px;">9¾</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.cloud}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.cloud}</div>
        <div class="card-center-val" style="font-size: 20px; color: #f1f5f9; margin-top: 1px;">9 ¾</div>
        <div class="card-name-label"><em>Wolke</em></div>
        ${suitSub}
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val" style="font-size: 13px;">9¾</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.cloud}</div>
      </div>
    `;
  } else if (card.type === 'werewolf' || card.type === 'werewolf_trump_pending') {
    div.classList.add('card-werewolf');
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">W</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.werewolf}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.werewolf}</div>
        <div class="card-center-val" style="font-size: 24px; color: #f59e0b; margin-top: 2px;">W</div>
        <div class="card-name-label"><em>Werwolf</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">W</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.werewolf}</div>
      </div>
    `;
  } else if (card.type === 'werewolf_trump') {
    div.classList.add('card-werewolf', 'card-werewolf-trump');
    const chosenSuit = card.chosenSuit || card.suit || 'red';
    div.classList.add(`card-werewolf-trump-${chosenSuit}`);
    const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
    const suitName = suitNames[chosenSuit] || chosenSuit;
    const suitIcon = MEDIEVAL_ICONS[chosenSuit] || '';
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">W</span>
        <div class="card-mini-icon">${suitIcon}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest" style="display: flex; gap: 3px; align-items: center; justify-content: center;">
          <div style="width: 20px; height: 20px;">${MEDIEVAL_ICONS.werewolf}</div>
          <div style="width: 18px; height: 18px;">${suitIcon}</div>
        </div>
        <div class="card-center-val" style="font-size: 20px; color: #fde047; margin-top: 1px;">W</div>
        <div class="card-name-label"><em>Werwolf-Trumpf: ${suitName}</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">W</span>
        <div class="card-mini-icon">${suitIcon}</div>
      </div>
    `;
  } else if (card.type === 'witch') {
    div.classList.add('card-witch');
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">H</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.witch}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.witch}</div>
        <div class="card-center-val" style="font-size: 24px; color: #c084fc; margin-top: 2px;">H</div>
        <div class="card-name-label"><em>Hexe</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">H</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.witch}</div>
      </div>
    `;
  } else if (card.type === 'juggler') {
    div.classList.add('card-juggler');
    const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
    const suitSub = card.chosenSuit ? `<div style="font-size: 8.5px; color: #67e8f9; margin-top: 1px;">${suitNames[card.chosenSuit] || card.chosenSuit}</div>` : '';
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val" style="font-size: 13px;">7½</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.juggler}</div>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.juggler}</div>
        <div class="card-center-val" style="font-size: 20px; color: #67e8f9; margin-top: 1px;">7 ½</div>
        <div class="card-name-label"><em>Jongleur</em></div>
        ${suitSub}
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val" style="font-size: 13px;">7½</span>
        <div class="card-mini-icon">${MEDIEVAL_ICONS.juggler}</div>
      </div>
    `;
  } else {
    div.classList.add(`card-${card.suit}`);
    const iconSvg = MEDIEVAL_ICONS[card.suit] || '';
    const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
    const sName = suitNames[card.suit] || card.suit;
    div.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-val">${card.value}</span>
        <div class="card-mini-icon">${iconSvg}</div>
      </div>
      <div class="card-center">
        <div class="card-center-val">${card.value}</div>
        <div class="card-center-crest">${iconSvg}</div>
        <div class="card-name-label"><em>${sName} ${card.value}</em></div>
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