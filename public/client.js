const savedAuthToken = (function() {
  try { return localStorage.getItem('wizard_auth_token'); } catch (e) { return null; }
})();
const connectionBanner = document.getElementById('connection-status-banner');
const lobbyStatusMsg = document.getElementById('lobby-status-message');

const DEFAULT_PRODUCTION_SERVER = 'https://grimoire-cardgame.onrender.com';

function isCapacitorNativeApp() {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
    return true;
  }
  if (window.location) {
    if (window.location.protocol === 'capacitor:') return true;
    // Android WebView serviert über http://localhost ohne separaten Dev-Port (3000)
    if (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '' || window.location.port === '80')) {
      return true;
    }
  }
  return false;
}

function getGrimoireServerUrl() {
  try {
    const custom = localStorage.getItem('grimoire_server_url');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
  } catch (e) {}

  // Native Android-App (Capacitor) verbindet standardmäßig direkt mit Render
  if (isCapacitorNativeApp()) {
    return DEFAULT_PRODUCTION_SERVER;
  }
  return '';
}

function getApiUrl(endpoint) {
  const base = getGrimoireServerUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  return base ? (base + cleanEndpoint) : cleanEndpoint;
}

let isBannerDismissedByUser = false;

// ==========================================================================
// GRIMOIRE CUSTOM DIALOG SYSTEM (EDLES DARK-FANTASY POPUP SYSTEM)
// ==========================================================================
const GrimoireDialog = {
  modal: null,
  iconEl: null,
  titleEl: null,
  messageEl: null,
  confirmBtn: null,
  cancelBtn: null,
  resolvePromise: null,

  init() {
    this.modal = document.getElementById('grimoire-dialog-modal');
    this.iconEl = document.getElementById('dialogIcon');
    this.titleEl = document.getElementById('dialogTitle');
    this.messageEl = document.getElementById('dialogMessage');
    this.confirmBtn = document.getElementById('dialogConfirmBtn');
    this.cancelBtn = document.getElementById('dialogCancelBtn');

    if (this.confirmBtn && !this.confirmBtn._hasDialogListener) {
      this.confirmBtn._hasDialogListener = true;
      this.confirmBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close(true);
      });
    }

    if (this.cancelBtn && !this.cancelBtn._hasDialogListener) {
      this.cancelBtn._hasDialogListener = true;
      this.cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close(false);
      });
    }

    if (this.modal && !this.modal._hasDialogListener) {
      this.modal._hasDialogListener = true;
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close(false);
        }
      });
    }

    if (typeof document !== 'undefined' && !document._hasDialogEscListener) {
      document._hasDialogEscListener = true;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modal && this.modal.style.display !== 'none') {
          this.close(false);
        }
      });
    }
  },

  close(result) {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
    if (typeof this.resolvePromise === 'function') {
      const res = this.resolvePromise;
      this.resolvePromise = null;
      res(result);
    }
  },

  alert: function(options) {
    return new Promise((resolve) => {
      if (!this.modal) this.init();
      if (typeof this.resolvePromise === 'function') {
        const prev = this.resolvePromise;
        this.resolvePromise = null;
        prev(false);
      }
      const opts = (typeof options === 'string') ? { message: options } : (options || {});
      this.resolvePromise = resolve;

      if (this.iconEl) this.iconEl.innerText = opts.icon || '📜';
      if (this.titleEl) this.titleEl.innerText = opts.title || 'Hinweis des Grimoires';
      if (this.messageEl) this.messageEl.innerText = opts.message || '';
      if (this.confirmBtn) {
        this.confirmBtn.innerText = opts.confirmText || 'Verstanden';
        this.confirmBtn.className = 'btn-auth-bar btn-auth-gold';
      }
      if (this.cancelBtn) {
        this.cancelBtn.style.display = 'none';
      }

      if (this.modal) {
        this.modal.style.display = 'flex';
      } else {
        resolve(true);
      }
    });
  },

  confirm: function(options) {
    return new Promise((resolve) => {
      if (!this.modal) this.init();
      if (typeof this.resolvePromise === 'function') {
        const prev = this.resolvePromise;
        this.resolvePromise = null;
        prev(false);
      }
      const opts = (typeof options === 'string') ? { message: options } : (options || {});
      this.resolvePromise = resolve;

      if (this.iconEl) this.iconEl.innerText = opts.icon || '🔮';
      if (this.titleEl) this.titleEl.innerText = opts.title || 'Bestätigung erbeten';
      if (this.messageEl) this.messageEl.innerText = opts.message || '';
      if (this.confirmBtn) {
        this.confirmBtn.innerText = opts.confirmText || 'Bestätigen';
        this.confirmBtn.className = opts.danger ? 'btn-auth-bar btn-auth-danger' : 'btn-auth-bar btn-auth-gold';
      }
      if (this.cancelBtn) {
        this.cancelBtn.style.display = 'inline-flex';
        this.cancelBtn.innerText = opts.cancelText || 'Abbrechen';
      }

      if (this.modal) {
        this.modal.style.display = 'flex';
      } else {
        resolve(false);
      }
    });
  },

  requireAuth(featureName = 'ranked') {
    const isRanked = featureName === 'ranked';
    const isCompanions = featureName === 'companions';
    const title = isCompanions ? 'Gefährten-Bund erfordert Siegel' : 'Magier-Siegel erforderlich';
    let message = 'Für diese geheime Kunst musst du ein eingetragenes Magier-Siegel besitzen. Melde dich jetzt an oder erschaffe ein neues Konto!';
    if (isRanked) {
      message = 'Für Ranglistenspiele und das Sammeln von Siegel-Rangpunkten (SR) im Buch der Meister musst du im Magier-Register angemeldet sein.';
    } else if (isCompanions) {
      message = 'Für das Grimoire der Gefährten und gemeinsame Einladungen musst du im Magier-Register eingetragen sein. Melde dich jetzt an oder registriere dich kostenlos!';
    }

    return this.confirm({
      title,
      message,
      icon: isRanked ? '⚔️' : (isCompanions ? '👥' : '✨'),
      confirmText: '✨ Jetzt Anmelden / Registrieren',
      cancelText: 'Zurück',
      danger: false
    }).then((proceed) => {
      const auth = (typeof window !== 'undefined' && window.WizardAuth) ? window.WizardAuth : ((typeof WizardAuth !== 'undefined') ? WizardAuth : null);
      if (proceed && auth && typeof auth.openAuthModal === 'function') {
        auth.openAuthModal('login');
      }
      return proceed;
    });
  }
};

if (typeof window !== 'undefined') {
  window.GrimoireDialog = GrimoireDialog;
}

// ==========================================================================
// SPIELSERVER- & NETZWERK-EINSTELLUNGEN (CAPACITOR & MOBILE)
// ==========================================================================
const GrimoireServerSettings = {
  modal: null,
  input: null,
  feedback: null,
  presetSelect: null,

  init() {
    this.modal = document.getElementById('server-settings-modal');
    this.input = document.getElementById('inputCustomServerUrl');
    this.feedback = document.getElementById('serverSettingsFeedback');
    this.presetSelect = document.getElementById('serverPresetSelect');

    const openBtn = document.getElementById('btnOpenServerSettings');
    const closeBtn = document.getElementById('btnCloseServerSettings');
    const saveBtn = document.getElementById('btnSaveServerUrl');
    const resetBtn = document.getElementById('btnResetServerUrl');
    const dismissBtn = document.getElementById('btnDismissConnectionBanner');

    if (openBtn && !openBtn._hasServerSettingListener) {
      openBtn._hasServerSettingListener = true;
      openBtn.addEventListener('click', (e) => { e.preventDefault(); this.openModal(); });
    }
    if (closeBtn && !closeBtn._hasServerSettingListener) {
      closeBtn._hasServerSettingListener = true;
      closeBtn.addEventListener('click', (e) => { e.preventDefault(); this.closeModal(); });
    }
    if (saveBtn && !saveBtn._hasServerSettingListener) {
      saveBtn._hasServerSettingListener = true;
      saveBtn.addEventListener('click', (e) => { e.preventDefault(); this.save(); });
    }
    if (resetBtn && !resetBtn._hasServerSettingListener) {
      resetBtn._hasServerSettingListener = true;
      resetBtn.addEventListener('click', (e) => { e.preventDefault(); this.reset(); });
    }
    if (dismissBtn && !dismissBtn._hasServerSettingListener) {
      dismissBtn._hasServerSettingListener = true;
      dismissBtn.addEventListener('click', (e) => { e.preventDefault(); this.dismissBanner(); });
    }

    if (this.presetSelect && !this.presetSelect._hasServerSettingListener) {
      this.presetSelect._hasServerSettingListener = true;
      this.presetSelect.addEventListener('change', () => {
        const val = this.presetSelect.value;
        if (val && val !== 'custom') {
          if (this.input) this.input.value = val;
        } else if (val === 'custom') {
          if (this.input) {
            this.input.focus();
          }
        }
      });
    }

    if (this.input && !this.input._hasServerSettingListener) {
      this.input._hasServerSettingListener = true;
      this.input.addEventListener('input', () => {
        this.syncPresetWithInput();
      });
    }

    if (this.modal && !this.modal._hasServerSettingListener) {
      this.modal._hasServerSettingListener = true;
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }
  },

  syncPresetWithInput() {
    if (!this.presetSelect || !this.input) return;
    const currentVal = this.input.value.trim().replace(/\/+$/, '');
    let matched = false;
    for (let i = 0; i < this.presetSelect.options.length; i++) {
      const optVal = this.presetSelect.options[i].value;
      if (optVal && optVal !== 'custom' && optVal.replace(/\/+$/, '') === currentVal) {
        this.presetSelect.selectedIndex = i;
        matched = true;
        break;
      }
    }
    if (!matched) {
      this.presetSelect.value = currentVal ? 'custom' : '';
    }
  },

  dismissBanner() {
    isBannerDismissedByUser = true;
    hideConnectionStatus();
  },

  openModal() {
    if (!this.modal) this.init();
    const currentUrl = getGrimoireServerUrl();
    if (this.input) {
      this.input.value = currentUrl;
    }
    this.syncPresetWithInput();
    if (this.feedback) {
      this.feedback.style.display = 'none';
    }
    if (this.modal) {
      this.modal.style.display = 'flex';
    }
  },

  closeModal() {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  },

  save() {
    if (!this.input) return;
    let rawVal = this.input.value.trim();
    if (rawVal) {
      // Automatische Korrektur: Protokoll ergänzen falls vergessen
      if (!rawVal.startsWith('http://') && !rawVal.startsWith('https://')) {
        if (rawVal.includes('localhost') || /^(\d{1,3}\.){3}\d{1,3}/.test(rawVal)) {
          rawVal = 'http://' + rawVal;
        } else {
          rawVal = 'https://' + rawVal;
        }
      }
      // Falls Port vergessen wurde (z. B. nur IP wie 192.168.188.162 oder localhost), :3000 anfügen
      try {
        const u = new URL(rawVal);
        if (!u.port && (u.hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(u.hostname))) {
          u.port = '3000';
          rawVal = u.origin;
        }
      } catch (err) {}

      const cleanUrl = rawVal.replace(/\/+$/, '');
      try {
        localStorage.setItem('grimoire_server_url', cleanUrl);
        this.showFeedback('Gespeichert! Verbinde neu mit ' + cleanUrl + '...', false);
        setTimeout(() => {
          window.location.reload();
        }, 600);
      } catch (e) {
        this.showFeedback('Fehler beim Speichern: ' + e.message, true);
      }
    } else {
      this.reset();
    }
  },

  reset() {
    try {
      localStorage.removeItem('grimoire_server_url');
      const defaultUrl = isCapacitorNativeApp() ? DEFAULT_PRODUCTION_SERVER : '';
      if (this.input) this.input.value = defaultUrl;
      this.syncPresetWithInput();
      const targetLabel = isCapacitorNativeApp() ? 'Offizieller Render-Server' : 'Standard-Server';
      this.showFeedback(`${targetLabel} wiederhergestellt! Seite lädt neu...`, false);
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (e) {
      this.showFeedback('Fehler beim Zurücksetzen: ' + e.message, true);
    }
  },

  showFeedback(msg, isError) {
    if (!this.feedback) return;
    this.feedback.textContent = msg;
    this.feedback.style.display = 'block';
    this.feedback.style.background = isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
    this.feedback.style.color = isError ? '#fca5a5' : '#86efac';
    this.feedback.style.border = isError ? '1px solid #ef4444' : '1px solid #22c55e';
  }
};

if (typeof window !== 'undefined') {
  window.GrimoireServerSettings = GrimoireServerSettings;
}

// Globales Event-Delegation für Server-Settings & Dismiss-Banner
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const serverTrigger = e.target && e.target.closest && e.target.closest('#btnOpenServerSettings, .btn-open-server-settings, #open-server-config-btn, #btnBannerOpenServerSettings');
    if (serverTrigger) {
      e.preventDefault();
      e.stopPropagation();
      GrimoireServerSettings.openModal();
      return;
    }
    const bannerDismiss = e.target && e.target.closest && e.target.closest('#btnDismissConnectionBanner, .btn-dismiss-banner');
    if (bannerDismiss) {
      e.preventDefault();
      e.stopPropagation();
      GrimoireServerSettings.dismissBanner();
      return;
    }
  });
}

function showConnectionStatus(message, isError = true) {
  let safeHtml = String(message).replace(/(https?:\/\/localhost:3000)/g, '<a href="$1" style="color: #fde047; text-decoration: underline; font-weight: bold;">$1</a>');
  const serverSettingsBtnHtml = ' <button type="button" id="btnBannerOpenServerSettings" class="btn-auth-bar btn-open-server-settings" style="margin-left: 6px; padding: 3px 10px; font-size: 11px; vertical-align: middle; display: inline-flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.5); border: 1px solid var(--gold-antique); cursor: pointer;" onclick="window.GrimoireServerSettings && window.GrimoireServerSettings.openModal()"><span class="btn-icon" aria-hidden="true">⚙️</span><span class="btn-text">Server einstellen</span></button>';
  const closeBtnHtml = ' <button type="button" id="btnDismissConnectionBanner" class="btn-dismiss-banner" style="background: transparent; border: none; color: #fff; font-size: 22px; cursor: pointer; padding: 0 8px; line-height: 1; display: flex; align-items: center;" title="Hinweis schließen" onclick="window.GrimoireServerSettings && window.GrimoireServerSettings.dismissBanner()">&times;</button>';
  
  if (connectionBanner) {
    connectionBanner.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex: 1; flex-wrap: wrap;"><span>⚠️</span><span>${safeHtml}</span>${serverSettingsBtnHtml}</div>${closeBtnHtml}`;
    if (!isBannerDismissedByUser) {
      connectionBanner.style.display = 'flex';
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('has-active-banner');
      }
    }
    if (isError) {
      connectionBanner.classList.add('error');
    } else {
      connectionBanner.classList.remove('error');
    }
  }
  const currentLobbyScreen = document.getElementById('lobby-screen');
  if (lobbyStatusMsg && (!currentLobbyScreen || currentLobbyScreen.style.display !== 'none')) {
    lobbyStatusMsg.innerHTML = safeHtml + serverSettingsBtnHtml;
    lobbyStatusMsg.style.display = 'block';
    lobbyStatusMsg.style.color = isError ? '#f87171' : '#fde047';
  }
}

function hideConnectionStatus() {
  if (connectionBanner) {
    connectionBanner.style.display = 'none';
  }
  if (lobbyStatusMsg) {
    lobbyStatusMsg.style.display = 'none';
  }
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.remove('has-active-banner');
  }
}

const savedServerUrl = getGrimoireServerUrl();
let socket;
if (typeof io !== 'undefined') {
  const socketOpts = {
    auth: {
      token: savedAuthToken || null
    }
  };
  socket = savedServerUrl ? io(savedServerUrl, socketOpts) : io(socketOpts);

  let renderWakeupAttempts = 0;

  socket.on('connect', () => {
    renderWakeupAttempts = 0;
    hideConnectionStatus();
  });

  socket.on('connect_error', () => {
    const currentTarget = getGrimoireServerUrl();
    const isRender = (currentTarget && currentTarget.includes('onrender.com')) || (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.includes('onrender.com'));

    if (isRender) {
      renderWakeupAttempts++;
      const waitHint = renderWakeupAttempts > 1
        ? '⏳ Der Grimoire-Server auf Render erwacht aus der magischen Meditation... (Kaltstart dauert ca. 30–50 Sek.). Bitte kurz warten!'
        : '🔮 Verbinde mit Grimoire Online auf Render... (Falls der Server schläft, wacht er gerade auf)';
      showConnectionStatus(waitHint, false);
      return;
    }

    const isCap = isCapacitorNativeApp();
    const hint = isCap
      ? '⚠️ Verbindung zum Spielserver verloren oder nicht erreichbar. Prüfe deine Internetverbindung oder wähle im Zahnrad-Menü den offiziellen Render-Server.'
      : '⚠️ Verbindung zum Spielserver verloren oder nicht erreichbar. Bitte prüfen, ob der Node-Server läuft.';
    showConnectionStatus(hint, true);
  });

  socket.on('disconnect', (reason) => {
    showConnectionStatus('⚠️ Verbindung zum Server getrennt (' + reason + '). Versuche Wiederverbindung...');
  });
} else {
  socket = {
    on: () => {},
    emit: () => {},
    connected: false
  };
  const isAltPort = (typeof window !== 'undefined' && window.location && window.location.port && window.location.port !== '3000');
  const customNotice = isAltPort
    ? `⚠️ Hinweis: Du hast die Seite über Port ${window.location.port} (z. B. VS Code Live Server) geöffnet. Der Spielserver benötigt Node.js: Bitte starte "npm start" im Terminal und öffne http://localhost:3000 im Browser.`
    : '⚠️ Der Spielserver (Socket.IO) ist nicht erreichbar. Bitte starte den Server mit "npm start" und öffne http://localhost:3000 im Browser.';
  showConnectionStatus(customNotice);
}

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
  </svg>`,

  unicorn: `<svg viewBox="0 0 48 48" class="crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 38 C14 34 13 25 17 17 C19 13 23 9 32 8 C36 7 40 9 42 12 C40 15 38 18 38 22 C42 24 40 28 36 29 C34 32 32 36 26 38 Z" fill="url(#unicornBody)" stroke="#a5b4fc" stroke-width="1.4"/>
    <polygon points="30,10 44,2 34,13" fill="url(#unicornHorn)" stroke="#fef08a" stroke-width="1"/>
    <circle cx="33" cy="16" r="1.8" fill="#38bdf8"/>
    <path d="M22 20 Q16 26 22 34" stroke="#c084fc" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M25 18 Q19 24 26 32" stroke="#67e8f9" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="44" cy="2" r="2.5" fill="#fef08a"/>
    <defs>
      <linearGradient id="unicornBody" x1="16" y1="8" x2="40" y2="38" gradientUnits="userSpaceOnUse"><stop stop-color="#ffffff"/><stop offset="0.6" stop-color="#e0e7ff"/><stop offset="1" stop-color="#c7d2fe"/></linearGradient>
      <linearGradient id="unicornHorn" x1="30" y1="10" x2="44" y2="2" gradientUnits="userSpaceOnUse"><stop stop-color="#fde047"/><stop offset="1" stop-color="#ca8a04"/></linearGradient>
    </defs>
  </svg>`
};

// --- HERALDISCHE WAPPEN DER 6 MAGIER-RÄNGE (OVERWATCH-STIL) ---
const RANK_CRESTS = {
  novice: `<svg viewBox="0 0 48 48" class="rank-crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" fill="url(#noviceGrad)" stroke="#78350f" stroke-width="2"/>
    <circle cx="24" cy="24" r="10" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="2 2"/>
    <path d="M24,16 L26.5,21.5 L32,22 L28,26 L29,31.5 L24,28.5 L19,31.5 L20,26 L16,22 L21.5,21.5 Z" fill="#d97706" stroke="#fef3c7" stroke-width="0.8"/>
    <defs><linearGradient id="noviceGrad" x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse"><stop stop-color="#b45309"/><stop offset="1" stop-color="#451a03"/></linearGradient></defs>
  </svg>`,

  adept: `<svg viewBox="0 0 48 48" class="rank-crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 4 L42 10 V26 C42 36 24 44 24 44 C24 44 6 36 6 26 V10 Z" fill="url(#adeptGrad)" stroke="#0284c7" stroke-width="2"/>
    <polygon points="24,12 33,24 24,36 15,24" fill="url(#adeptGem)" stroke="#e0f2fe" stroke-width="1.2"/>
    <circle cx="24" cy="24" r="3" fill="#ffffff"/>
    <defs>
      <linearGradient id="adeptGrad" x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse"><stop stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/></linearGradient>
      <linearGradient id="adeptGem" x1="24" y1="12" x2="24" y2="36" gradientUnits="userSpaceOnUse"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#0369a1"/></linearGradient>
    </defs>
  </svg>`,

  mage: `<svg viewBox="0 0 48 48" class="rank-crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 3 L43 12 V28 C43 37 24 45 24 45 C24 45 5 37 5 28 V12 Z" fill="url(#mageGrad)" stroke="#f59e0b" stroke-width="2"/>
    <path d="M24 10 L28 20 L38 24 L28 28 L24 38 L20 28 L10 24 L20 20 Z" fill="url(#mageStar)" stroke="#fef08a" stroke-width="1.2"/>
    <circle cx="24" cy="24" r="4" fill="#a855f7" stroke="#fef08a" stroke-width="1"/>
    <defs>
      <linearGradient id="mageGrad" x1="24" y1="3" x2="24" y2="45" gradientUnits="userSpaceOnUse"><stop stop-color="#3b0764"/><stop offset="1" stop-color="#1e0338"/></linearGradient>
      <linearGradient id="mageStar" x1="24" y1="10" x2="24" y2="38" gradientUnits="userSpaceOnUse"><stop stop-color="#fde047"/><stop offset="1" stop-color="#ca8a04"/></linearGradient>
    </defs>
  </svg>`,

  archmage: `<svg viewBox="0 0 48 48" class="rank-crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 2 L44 11 V27 C44 38 24 46 24 46 C24 46 4 38 4 27 V11 Z" fill="url(#archGrad)" stroke="#10b981" stroke-width="2"/>
    <polygon points="24,8 36,18 31,34 17,34 12,18" stroke="#34d399" stroke-width="1.5" fill="none"/>
    <polygon points="24,12 32,30 16,30" fill="url(#archEmerald)" stroke="#6ee7b7" stroke-width="1"/>
    <circle cx="24" cy="23" r="3.5" fill="#ecfdf5" stroke="#059669" stroke-width="1"/>
    <defs>
      <linearGradient id="archGrad" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse"><stop stop-color="#064e3b"/><stop offset="1" stop-color="#022c22"/></linearGradient>
      <linearGradient id="archEmerald" x1="24" y1="12" x2="24" y2="30" gradientUnits="userSpaceOnUse"><stop stop-color="#34d399"/><stop offset="1" stop-color="#047857"/></linearGradient>
    </defs>
  </svg>`,

  grandmaster: `<svg viewBox="0 0 48 48" class="rank-crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 2 L45 10 V27 C45 39 24 46 24 46 C24 46 3 39 3 27 V10 Z" fill="url(#gmGrad)" stroke="#f59e0b" stroke-width="2"/>
    <path d="M12 12 Q24 6 36 12 Q30 24 24 38 Q18 24 12 12 Z" fill="url(#gmRuby)" stroke="#fca5a5" stroke-width="1.5"/>
    <polygon points="24,14 27,21 34,22 29,27 30,34 24,30 18,34 19,27 14,22 21,21" fill="#fbbf24" stroke="#78350f" stroke-width="0.8"/>
    <defs>
      <linearGradient id="gmGrad" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse"><stop stop-color="#7f1d1d"/><stop offset="1" stop-color="#450a0a"/></linearGradient>
      <linearGradient id="gmRuby" x1="24" y1="10" x2="24" y2="38" gradientUnits="userSpaceOnUse"><stop stop-color="#ef4444"/><stop offset="1" stop-color="#991b1b"/></linearGradient>
    </defs>
  </svg>`,

  high_council: `<svg viewBox="0 0 48 48" class="rank-crest-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="22" stroke="url(#councilRing)" stroke-width="2"/>
    <path d="M24 2 L45 10 V26 C45 38 24 46 24 46 C24 46 3 38 3 26 V10 Z" fill="url(#councilGrad)" stroke="#38bdf8" stroke-width="1.5"/>
    <path d="M12 20 L24 8 L36 20 L30 36 L18 36 Z" fill="url(#councilDiamond)" stroke="#fef08a" stroke-width="1.2"/>
    <circle cx="24" cy="22" r="5" fill="#ffffff" stroke="#38bdf8" stroke-width="1.5"/>
    <defs>
      <linearGradient id="councilRing" x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse"><stop stop-color="#fde047"/><stop offset="0.5" stop-color="#38bdf8"/><stop offset="1" stop-color="#c084fc"/></linearGradient>
      <linearGradient id="councilGrad" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse"><stop stop-color="#1e1b4b"/><stop offset="1" stop-color="#020617"/></linearGradient>
      <linearGradient id="councilDiamond" x1="24" y1="8" x2="24" y2="36" gradientUnits="userSpaceOnUse"><stop stop-color="#e0f2fe"/><stop offset="0.5" stop-color="#67e8f9"/><stop offset="1" stop-color="#0284c7"/></linearGradient>
    </defs>
  </svg>`
};

// Spielzustand
let currentRoomCode = '';
let currentRound = 1;
let maxRounds = 20;
let currentEdition = 'classic';
let currentIsRanked = false;
let selectedGameMode = 'quickplay';
let cachedRankedResults = null;
let myCurrentHand = [];
let currentTrick = [];
let isMyTurn = false;
let currentGameState = 'lobby';
let currentActiveSessionId = null;
let cachedScoreHistory = [];
let cachedPlayers = [];
let cachedTrumpCard = null;
let inspectedCardIndex = null; // Für Touch "Tap to Inspect"
let isDealingAnimationPending = false;
let hasDealtThisRound = false;
let lastPlayedCardOrigin = null;

// --- ERKENNUNG STARKER KARTEN FÜR AUFPRALL & STAUBWOLKE ---
function isStrongCard(card) {
  if (!card) return false;
  // Vampir kopiert die Trumpfkarte: Falls die kopierte Karte stark ist
  if (card.type === 'vampire' && card.copiedCard) {
    return isStrongCard(card.copiedCard);
  }
  // Karten unter oder gleich Null (Narr, Fee, Hexe, Werwolf) sind NIEMALS stark:
  if (card.type === 'jester' || card.type === 'fairy' || card.type === 'witch' || card.type === 'werewolf') {
    return false;
  }
  // Gestaltenwandler: Entweder-Oder (nur stark, wenn als Zauberer gewählt)
  if (card.type === 'shapeshifter') {
    return (card.selectedType === 'wizard' || card.chosenRole === 'wizard');
  }
  // Starke Sonderkarten (> Narr)
  if (['wizard', 'dragon', 'bomb', 'juggler', 'werewolf_trump'].includes(card.type)) {
    return true;
  }
  // Höchste Farbkarten (Wert 13 oder 14)
  if (card.type === 'color' && Number(card.value) >= 13) {
    return true;
  }
  return false;
}

// --- WEISSE & GRAUE STAUBWOLKE BEIM TISCH-AUFPRALL ---
function createDustCloudEffect(container) {
  if (!container) return;
  const cloud = document.createElement('div');
  cloud.classList.add('card-dust-cloud');

  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    const puff = document.createElement('div');
    puff.classList.add('dust-puff');

    // Kreisförmig nach außen streuen (Winkel 0 bis 360 Grad)
    const angle = (i / particleCount) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
    const dist = 28 + Math.random() * 28;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * (dist * 0.65); // Ovale Tischperspektive

    const size = 18 + Math.random() * 16;
    const scale = 1.9 + Math.random() * 0.8;
    const delay = Math.random() * 0.04;

    puff.style.width = `${size}px`;
    puff.style.height = `${size}px`;
    puff.style.setProperty('--dx', `${dx.toFixed(1)}px`);
    puff.style.setProperty('--dy', `${dy.toFixed(1)}px`);
    puff.style.setProperty('--scale', scale.toFixed(2));
    puff.style.animationDelay = `${delay.toFixed(3)}s`;

    // Feine Variation zwischen reinweiß und hellem Schiefergrau
    const grayVal = Math.floor(225 + Math.random() * 30);
    puff.style.background = `radial-gradient(circle, rgba(${grayVal}, ${grayVal}, ${grayVal + 5}, 0.88) 0%, rgba(205, 210, 220, 0.45) 45%, rgba(160, 165, 175, 0) 70%)`;

    cloud.appendChild(puff);
  }

  // Unter der Karte platzieren (vor dem cardWrapper im DOM)
  if (container.firstChild) {
    container.insertBefore(cloud, container.firstChild);
  } else {
    container.appendChild(cloud);
  }

  setTimeout(() => {
    cloud.remove();
  }, 620);
}

// --- AAA MAGISCHE PARTIKEL- & SPEZIALEFFEKTE FÜR SONDERKARTEN ---
const GrimoireFX = {
  getLayer() {
    return (typeof document !== 'undefined') ? document.getElementById('table-fx-layer') : null;
  },

  triggerSpecialCardEffect(card, targetContainer) {
    if (!card) return;
    const type = card.type;
    if (type === 'dragon') {
      this.triggerDragonImpact(targetContainer);
    } else if (type === 'bomb') {
      this.triggerBombShockwave(targetContainer);
    } else if (type === 'fairy') {
      this.triggerFairyImpact(targetContainer);
    } else if (type === 'unicorn') {
      this.triggerUnicornRing(targetContainer);
    }
  },

  triggerDragonImpact(targetContainer) {
    const layer = this.getLayer();
    if (!layer || !targetContainer) return;
    const rect = targetContainer.getBoundingClientRect();
    const lRect = layer.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - lRect.left;
    const cy = rect.top + rect.height / 2 - lRect.top;

    const count = 10;
    for (let i = 0; i < count; i++) {
      const ember = document.createElement('div');
      ember.classList.add('dragon-ember');
      ember.style.left = `${cx}px`;
      ember.style.top = `${cy}px`;

      const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.5 - 0.25);
      const dist = 32 + Math.random() * 38;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * (dist * 0.7);

      ember.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      ember.style.setProperty('--dy', `${dy.toFixed(1)}px`);
      ember.style.animationDelay = `${(Math.random() * 0.05).toFixed(3)}s`;

      layer.appendChild(ember);
      setTimeout(() => ember.remove(), 480);
    }
  },

  triggerBombShockwave(targetContainer) {
    const layer = this.getLayer();
    const table = (typeof document !== 'undefined') ? (document.querySelector('.poker-table') || document.getElementById('table-area')) : null;
    if (table) {
      table.classList.remove('table-micro-shake');
      void table.offsetWidth; // force reflow
      table.classList.add('table-micro-shake');
      setTimeout(() => table.classList.remove('table-micro-shake'), 220);
    }

    if (!layer) return;
    let cx = layer.clientWidth / 2;
    let cy = layer.clientHeight / 2;
    if (targetContainer) {
      const rect = targetContainer.getBoundingClientRect();
      const lRect = layer.getBoundingClientRect();
      cx = rect.left + rect.width / 2 - lRect.left;
      cy = rect.top + rect.height / 2 - lRect.top;
    }

    const ring = document.createElement('div');
    ring.classList.add('bomb-shockwave-ring');
    ring.style.left = `${cx}px`;
    ring.style.top = `${cy}px`;
    layer.appendChild(ring);
    setTimeout(() => ring.remove(), 400);
  },

  triggerFairyImpact(targetContainer) {
    const layer = this.getLayer();
    if (!layer || !targetContainer) return;
    const rect = targetContainer.getBoundingClientRect();
    const lRect = layer.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - lRect.left;
    const cy = rect.top + rect.height / 2 - lRect.top;

    const count = 9;
    for (let i = 0; i < count; i++) {
      const sparkle = document.createElement('div');
      sparkle.classList.add('fairy-dust');
      sparkle.style.left = `${cx}px`;
      sparkle.style.top = `${cy}px`;

      const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.4);
      const dist = 24 + Math.random() * 32;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * (dist * 0.65) - 10;

      sparkle.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      sparkle.style.setProperty('--dy', `${dy.toFixed(1)}px`);
      sparkle.style.animationDelay = `${(i * 0.025).toFixed(3)}s`;

      layer.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 550);
    }
  },

  triggerUnicornRing(targetContainer) {
    const layer = this.getLayer();
    if (!layer) return;
    let cx = layer.clientWidth / 2;
    let cy = layer.clientHeight / 2;
    if (targetContainer) {
      const rect = targetContainer.getBoundingClientRect();
      const lRect = layer.getBoundingClientRect();
      cx = rect.left + rect.width / 2 - lRect.left;
      cy = rect.top + rect.height / 2 - lRect.top;
    }

    const ring = document.createElement('div');
    ring.classList.add('unicorn-ring');
    ring.style.left = `${cx}px`;
    ring.style.top = `${cy}px`;
    layer.appendChild(ring);
    setTimeout(() => ring.remove(), 450);
  }
};

if (typeof window !== 'undefined') {
  window.GrimoireFX = GrimoireFX;
}

// --- NATIVE WEB AUDIO API SOUND- & MUSIK-ENGINE (OHNE EXTERNE DATEIEN) ---
const WizardAudio = (() => {
  let ctx = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  let wasPlayingBeforeHide = false;
  let isAppInBackground = false;

  // Lade gespeicherte Audioeinstellungen oder Defaults
  let settings = {
    master: 0.8,
    sfx: 0.9,
    music: 0.5,
    sfxMuted: false,
    musicMuted: false
  };

  try {
    const saved = localStorage.getItem('wizard_audio_settings');
    if (saved) {
      settings = Object.assign(settings, JSON.parse(saved));
    }
  } catch (e) {}

  function getContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
        masterGain = ctx.createGain();
        sfxGain = ctx.createGain();
        musicGain = ctx.createGain();

        sfxGain.connect(masterGain);
        musicGain.connect(masterGain);
        masterGain.connect(ctx.destination);

        applyVolumeSettings();
      }
    }
    if (ctx && ctx.state === 'suspended' && !isAppInBackground) {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function applyVolumeSettings() {
    if (ctx) {
      const t = ctx.currentTime;
      if (masterGain) {
        masterGain.gain.setValueAtTime(settings.master, t);
      }
      if (sfxGain) {
        sfxGain.gain.setValueAtTime(settings.sfxMuted ? 0 : settings.sfx, t);
      }
      if (musicGain) {
        musicGain.gain.setValueAtTime(settings.musicMuted ? 0 : settings.music, t);
      }
    }
    if (musicAudio && !musicSourceNode) {
      const effective = (settings.musicMuted || settings.master <= 0) ? 0 : (settings.music * settings.master);
      musicAudio.volume = Math.max(0, Math.min(1, effective));
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem('wizard_audio_settings', JSON.stringify(settings));
    } catch (e) {}
  }

  // --- AUDIO-ASSETS: ECHTE STUDIOMUSTER (KENNEY CC0 CASINO & RANDOMMIND CC0 TAVERN) ---
  const SOUND_URLS = {
    cardPlace: [
      '/audio/card-place-1.ogg',
      '/audio/card-place-2.ogg',
      '/audio/card-place-3.ogg',
      '/audio/card-place-4.ogg'
    ],
    cardSlide: [
      '/audio/card-slide-1.ogg',
      '/audio/card-slide-2.ogg',
      '/audio/card-slide-3.ogg',
      '/audio/card-slide-4.ogg',
      '/audio/card-slide-5.ogg',
      '/audio/card-slide-6.ogg'
    ],
    cardShuffle: '/audio/card-shuffle.ogg'
  };

  const audioBuffers = {};
  const loadingPromises = {};

  async function loadBuffer(url) {
    if (audioBuffers[url]) return audioBuffers[url];
    if (loadingPromises[url]) return loadingPromises[url];

    loadingPromises[url] = (async () => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const arr = await resp.arrayBuffer();
        const c = getContext();
        if (!c) return null;
        const buf = await c.decodeAudioData(arr);
        audioBuffers[url] = buf;
        return buf;
      } catch (e) {
        return null;
      } finally {
        delete loadingPromises[url];
      }
    })();

    return loadingPromises[url];
  }

  function preloadAssets() {
    const list = [...SOUND_URLS.cardPlace, ...SOUND_URLS.cardSlide, SOUND_URLS.cardShuffle];
    list.forEach(url => {
      loadBuffer(url).catch(() => {});
    });
  }

  function playBufferNode(buf, volume = 0.95, pitchJitter = 0.08) {
    if (isAppInBackground) return;
    const c = getContext();
    if (!c || !buf || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
    try {
      const src = c.createBufferSource();
      src.buffer = buf;
      // Natürliche mikro-tonale Variation für lebendiges Haptik-Gefühl
      const rate = 1.0 + (Math.random() * pitchJitter * 2 - pitchJitter);
      src.playbackRate.setValueAtTime(rate, c.currentTime);

      const gain = c.createGain();
      gain.gain.setValueAtTime(volume, c.currentTime);

      src.connect(gain);
      gain.connect(sfxGain);
      src.start();
    } catch (e) {
      console.warn('playBufferNode error:', e);
    }
  }

  // Echter Papier-/Kartenlege-Sound auf Spieltischfilz
  function playCardSnap() {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;

      const pool = SOUND_URLS.cardPlace;
      const url = pool[Math.floor(Math.random() * pool.length)];
      if (audioBuffers[url]) {
        playBufferNode(audioBuffers[url], 0.95, 0.06);
      } else {
        loadBuffer(url).then(buf => {
          if (buf) playBufferNode(buf, 0.95, 0.06);
        });
      }
    } catch (e) {
      console.warn('playCardSnap error:', e);
    }
  }

  // Echter Kartengleit-Sound (z. B. beim Austeilen der Handkarten)
  function playCardDeal() {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;

      const pool = SOUND_URLS.cardSlide;
      const url = pool[Math.floor(Math.random() * pool.length)];
      if (audioBuffers[url]) {
        playBufferNode(audioBuffers[url], 0.75, 0.08);
      } else {
        loadBuffer(url).then(buf => {
          if (buf) playBufferNode(buf, 0.75, 0.08);
        });
      }
    } catch (e) {
      console.warn('playCardDeal error:', e);
    }
  }

  // Satter, dumpfer Holzplatten-Aufschlag bei wuchtigem Karten-Slam
  function playTableThump() {
    if (isAppInBackground) return;
    try {
      playCardSnap();
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
      const t = c.currentTime;

      // Resonanter tiefer Holz-Thump (Sinus 68Hz -> 36Hz)
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(68, t);
      osc.frequency.exponentialRampToValueAtTime(36, t + 0.14);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(t);
      osc.stop(t + 0.18);
    } catch (e) {
      console.warn('Audio playTableThump error:', e);
    }
  }

  function playForCard(card) {
    if (isAppInBackground) return;
    if (!card) return playCardSnap();
    if (isStrongCard(card)) {
      playTableThump();
    } else {
      playCardSnap();
    }
  }

  // --- HINTERGRUNDMUSIK-ENGINE (MEHRTEILIGE TAVERNEN-PLAYLIST: RANDOMMIND CC0) ---
  const MUSIC_PLAYLIST = [
    { title: 'The Old Tower Inn', url: '/audio/tavern_music.mp3' },
    { title: "King's Feast", url: '/audio/Kings_Feast.mp3' },
    { title: 'Market Day', url: '/audio/Market_Day.mp3' }
  ];
  let currentTrackIdx = 0;
  let musicAudio = null;
  let musicSourceNode = null;
  let isMusicPlaying = false;

  function playNextTrack() {
    currentTrackIdx = (currentTrackIdx + 1) % MUSIC_PLAYLIST.length;
    if (musicAudio) {
      musicAudio.src = MUSIC_PLAYLIST[currentTrackIdx].url;
      if (typeof musicAudio.load === 'function') musicAudio.load();
      applyVolumeSettings();
      if (!isAppInBackground && isMusicPlaying && !settings.musicMuted && settings.music > 0) {
        musicAudio.play().catch(() => {});
      }
    }
  }

  function initMusicAudio() {
    if (!musicAudio) {
      musicAudio = new Audio(MUSIC_PLAYLIST[currentTrackIdx].url);
      musicAudio.loop = false;
      musicAudio.preload = 'auto';

      musicAudio.addEventListener('ended', () => {
        playNextTrack();
      });

      const c = getContext();
      if (c && !musicSourceNode) {
        try {
          musicSourceNode = c.createMediaElementSource(musicAudio);
          musicSourceNode.connect(musicGain);
        } catch (e) {
          // Fallback, falls MediaElementSource nicht unterstützt wird
        }
      }
    }
    return musicAudio;
  }

  function startMusic() {
    if (isAppInBackground) {
      wasPlayingBeforeHide = true;
      return;
    }
    wasPlayingBeforeHide = false;
    const c = getContext();
    if (c && c.state === 'suspended') {
      c.resume().catch(() => {});
    }
    if (settings.musicMuted || settings.music <= 0 || settings.master <= 0) {
      isMusicPlaying = false;
      return;
    }
    const audio = initMusicAudio();
    if (!audio) return;
    applyVolumeSettings();
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        isMusicPlaying = true;
      }).catch((err) => {
        // Autoplay vom Browser verzögert bis zur ersten Benutzerinteraktion
        console.log('Autoplay deferred until user interaction:', err);
      });
    }
  }

  function stopMusic() {
    isMusicPlaying = false;
    wasPlayingBeforeHide = false;
    if (musicAudio) {
      musicAudio.pause();
    }
  }

  function handleAppBackground() {
    if (!isAppInBackground) {
      isAppInBackground = true;
      if (isMusicPlaying || (musicAudio && !musicAudio.paused)) {
        wasPlayingBeforeHide = true;
      }
    }
    isMusicPlaying = false;
    if (musicAudio && !musicAudio.paused) {
      musicAudio.pause();
    }
    if (ctx && ctx.state !== 'suspended' && typeof ctx.suspend === 'function') {
      ctx.suspend().catch(() => {});
    }
  }

  function handleAppForeground() {
    isAppInBackground = false;
    if (ctx && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }
    if (wasPlayingBeforeHide) {
      wasPlayingBeforeHide = false;
      if (!settings.musicMuted && settings.music > 0 && settings.master > 0) {
        if (musicAudio) {
          applyVolumeSettings();
          const playPromise = musicAudio.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              isMusicPlaying = true;
            }).catch(() => {
              // Falls Browser Autoplay nach Sleep blockiert, reaktiviere beim nächsten User-Tap
              const onWakeGesture = () => {
                if (typeof window !== 'undefined') {
                  ['click', 'touchstart', 'pointerdown'].forEach(e => window.removeEventListener(e, onWakeGesture));
                }
                if (!isAppInBackground && !isMusicPlaying && !settings.musicMuted && settings.music > 0) {
                  if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
                    ctx.resume().catch(() => {});
                  }
                  if (musicAudio) {
                    musicAudio.play().then(() => { isMusicPlaying = true; }).catch(() => {});
                  }
                }
              };
              if (typeof window !== 'undefined') {
                ['click', 'touchstart', 'pointerdown'].forEach(e => window.addEventListener(e, onWakeGesture, { once: true, passive: true }));
              }
            });
          }
        } else {
          startMusic();
        }
      }
    }
  }

  function toggleMusic() {
    if (musicAudio && !musicAudio.paused) {
      stopMusic();
      return false;
    } else {
      startMusic();
      return true;
    }
  }

  function playInviteChime() {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
      loadBuffer('/audio/invite-chime.wav').then(buf => {
        if (buf && !isAppInBackground) playBufferNode(buf, 0.95, 0.0);
      });
    } catch (e) {
      console.warn('playInviteChime error:', e);
    }
  }

  // Bei erstem User-Event AudioContext aufwecken, Assets cachen und Musik starten
  ['click', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => {
      const c = getContext();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
      preloadAssets();
      if (!isMusicPlaying && !settings.musicMuted && settings.music > 0) {
        startMusic();
      }
    }, { once: true, passive: true });
  });

  return {
    getContext,
    playCardSnap,
    playCardDeal,
    playTableThump,
    playForCard,
    playInviteChime,
    startMusic,
    stopMusic,
    toggleMusic,
    skipNextTrack: () => {
      playNextTrack();
    },
    getCurrentTrackTitle: () => MUSIC_PLAYLIST[currentTrackIdx].title,
    isMusicPlaying: () => isMusicPlaying || !!(musicAudio && !musicAudio.paused && !settings.musicMuted && settings.music > 0),
    getSettings: () => ({ ...settings }),
    setMasterVolume: (val) => {
      settings.master = Math.max(0, Math.min(1, val));
      applyVolumeSettings();
      saveSettings();
    },
    setSfxVolume: (val) => {
      settings.sfx = Math.max(0, Math.min(1, val));
      applyVolumeSettings();
      saveSettings();
    },
    setMusicVolume: (val) => {
      settings.music = Math.max(0, Math.min(1, val));
      applyVolumeSettings();
      saveSettings();
      if (settings.music > 0 && !settings.musicMuted && (!musicAudio || musicAudio.paused)) {
        startMusic();
      }
    },
    setSfxMuted: (muted) => {
      settings.sfxMuted = !!muted;
      applyVolumeSettings();
      saveSettings();
    },
    handleAppBackground,
    handleAppForeground,
    wasPlayingBeforeHide: () => wasPlayingBeforeHide,
    isAppInBackground: () => isAppInBackground,
    setMusicMuted: (muted) => {
      settings.musicMuted = !!muted;
      applyVolumeSettings();
      saveSettings();
      if (!settings.musicMuted && settings.music > 0) {
        startMusic();
      } else if (settings.musicMuted) {
        stopMusic();
      }
    }
  };
})();
if (typeof window !== 'undefined') window.WizardAudio = WizardAudio;

// --- AUDIO LIFECYCLE MANAGEMENT (Hintergrund / Sperrbildschirm / Tab-Wechsel) ---
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      WizardAudio.handleAppBackground();
    } else if (document.visibilityState === 'visible') {
      WizardAudio.handleAppForeground();
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    WizardAudio.handleAppBackground();
  });
  window.addEventListener('blur', () => {
    WizardAudio.handleAppBackground();
  });
  window.addEventListener('focus', () => {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      WizardAudio.handleAppForeground();
    }
  });

  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try {
      window.Capacitor.Plugins.App.addListener('appStateChange', (state) => {
        if (state && state.isActive) {
          WizardAudio.handleAppForeground();
        } else {
          WizardAudio.handleAppBackground();
        }
      });
    } catch (e) {}
  }
}

// --- CAPACITOR & WEB HAPTISCHES FEEDBACK ---
const GrimoireHaptics = {
  async impact(style = 'light') {
    try {
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Haptics')) {
        const capStyle = style === 'heavy' ? 'HEAVY' : (style === 'medium' ? 'MEDIUM' : 'LIGHT');
        await window.Capacitor.Plugins.Haptics.impact({ style: capStyle });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(style === 'heavy' ? 45 : (style === 'medium' ? 25 : 12));
      }
    } catch (e) {}
  },
  async notification(type = 'success') {
    try {
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Haptics')) {
        await window.Capacitor.Plugins.Haptics.notification({ type: type.toUpperCase() });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(type === 'error' ? [30, 40, 30] : (type === 'warning' ? [20, 30] : [20, 25, 20]));
      }
    } catch (e) {}
  },
  async selection() {
    try {
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Haptics')) {
        await window.Capacitor.Plugins.Haptics.selectionChanged();
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(8);
      }
    } catch (e) {}
  }
};
if (typeof window !== 'undefined') window.GrimoireHaptics = GrimoireHaptics;

// --- "DU BIST DRAN!" TOAST-POP-UP TRIGGER (1.4s AUTO-FADE) ---
let turnPopupTimer = null;
function triggerTurnPopup() {
  GrimoireHaptics.impact('medium');
  const banner = document.getElementById('turn-popup-banner');
  if (!banner) return;
  clearTimeout(turnPopupTimer);
  banner.classList.remove('show');
  void banner.offsetWidth; // Force Reflow
  banner.classList.add('show');
  turnPopupTimer = setTimeout(() => {
    banner.classList.remove('show');
  }, 850);
}

// --- GLOBALER TOAST-BANNER (DARK FANTASY NOTIFICATION) ---
function showToast(msg, duration = 2800) {
  const toast = document.getElementById('global-toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.add('show');
  clearTimeout(toast._toastTimer);
  toast._toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// XSS-Schutz
function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// --- WIZARD AUTH & PROFIL-MODUL ---
const WizardAuth = (() => {
  let currentUser = null;
  let selectedRegisterAvatar = 'wizard_blue';
  let activeAuthTab = 'login';

  function getToken() {
    try {
      return localStorage.getItem('wizard_auth_token');
    } catch (e) {
      return null;
    }
  }

  function setToken(token) {
    try {
      if (token) {
        localStorage.setItem('wizard_auth_token', token);
      } else {
        localStorage.removeItem('wizard_auth_token');
      }
    } catch (e) {}
  }

  function getCachedUser() {
    try {
      const raw = localStorage.getItem('wizard_cached_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setCachedUser(user) {
    try {
      if (user) {
        localStorage.setItem('wizard_cached_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('wizard_cached_user');
      }
    } catch (e) {}
  }

  async function checkSession() {
    const token = getToken();
    if (!token) {
      currentUser = null;
      setCachedUser(null);
      renderLobbyBar();
      return null;
    }

    try {
      const resp = await fetch(getApiUrl('/api/auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!resp.ok) {
        setToken(null);
        setCachedUser(null);
        currentUser = null;
        renderLobbyBar();
        return null;
      }
      const data = await resp.json();
      if (data.success && data.user) {
        currentUser = data.user;
        setCachedUser(currentUser);
        if (socket) {
          socket.auth = { token };
          if (socket.connected) {
            socket.emit('authIdentify', { token });
          }
        }
        if (nameInput) {
          nameInput.value = data.user.username;
          sessionStorage.setItem('wizard_last_name', data.user.username);
        }
        renderLobbyBar();
        return data.user;
      } else {
        setToken(null);
        setCachedUser(null);
        currentUser = null;
        renderLobbyBar();
        return null;
      }
    } catch (e) {
      console.warn('Fehler bei auth/me:', e);
      renderLobbyBar();
      return null;
    }
  }

  async function login(username, password) {
    if (!username || !password) {
      showAuthError('Bitte gib Benutzername und Passwort ein.');
      return false;
    }
    try {
      const resp = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await resp.json();
      if (!data.success) {
        showAuthError(data.error || 'Anmeldung fehlgeschlagen.');
        return false;
      }
      setToken(data.token);
      currentUser = data.user;
      setCachedUser(currentUser);
      if (socket) {
        socket.auth = { token: data.token };
        if (socket.connected) socket.emit('authIdentify', { token: data.token });
      }
      if (nameInput) {
        nameInput.value = data.user.username;
        sessionStorage.setItem('wizard_last_name', data.user.username);
      }
      renderLobbyBar();
      closeAuthModal();
      showToast(`Willkommen zurück, ${data.user.username}!`);
      return true;
    } catch (e) {
      showAuthError('Verbindungsfehler bei der Anmeldung.');
      return false;
    }
  }

  async function register(username, password, avatarId) {
    if (!username || !password) {
      showAuthError('Bitte gib alle erforderlichen Felder ein.');
      return false;
    }
    try {
      const resp = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, avatar_id: avatarId || 'wizard_blue' })
      });
      const data = await resp.json();
      if (!data.success) {
        showAuthError(data.error || 'Registrierung fehlgeschlagen.');
        return false;
      }
      setToken(data.token);
      currentUser = data.user;
      setCachedUser(currentUser);
      if (socket) {
        socket.auth = { token: data.token };
        if (socket.connected) socket.emit('authIdentify', { token: data.token });
      }
      if (nameInput) {
        nameInput.value = data.user.username;
        sessionStorage.setItem('wizard_last_name', data.user.username);
      }
      renderLobbyBar();
      closeAuthModal();
      showToast(`Willkommen im Bunde, ${data.user.username}!`);
      return true;
    } catch (e) {
      showAuthError('Verbindungsfehler bei der Registrierung.');
      return false;
    }
  }

  async function logout() {
    const token = getToken();
    if (token) {
      try {
        await fetch(getApiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {}
    }
    setToken(null);
    setCachedUser(null);
    currentUser = null;
    if (socket) {
      socket.auth = {};
    }
    renderLobbyBar();
    closeProfileDrawer();
    showToast('Erfolgreich abgemeldet.');
  }

  async function updateTitle(title) {
    const token = getToken();
    if (!token) return;
    try {
      const resp = await fetch(getApiUrl('/api/auth/profile'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title })
      });
      const data = await resp.json();
      if (data.success && data.user) {
        currentUser = data.user;
        setCachedUser(currentUser);
        renderLobbyBar();
        renderProfileData();
        showToast(`Ehrentitel gewechselt zu "${title}"`);
      }
    } catch (e) {
      console.warn('Fehler bei updateTitle:', e);
    }
  }

  async function updateAvatar(avatarId) {
    const token = getToken();
    if (!token) return;
    try {
      const resp = await fetch(getApiUrl('/api/auth/profile'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatar_id: avatarId })
      });
      const data = await resp.json();
      if (data.success && data.user) {
        currentUser = data.user;
        setCachedUser(currentUser);
        renderLobbyBar();
        renderProfileData();
        showToast('Magier-Gestalt aktualisiert!');
      }
    } catch (e) {
      console.warn('Fehler bei updateAvatar:', e);
    }
  }

  async function refreshUser() {
    const token = getToken();
    if (!token) return;
    try {
      const resp = await fetch(getApiUrl('/api/auth/me'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.user) {
          currentUser = data.user;
          setCachedUser(currentUser);
          renderLobbyBar();
          const profileDrawer = document.getElementById('profile-drawer');
          if (profileDrawer && profileDrawer.classList.contains('open')) {
            renderProfileData();
          }
        }
      }
    } catch (e) {}
  }

  function renderLobbyBar() {
    const guestGroup = document.getElementById('auth-guest-controls');
    const userGroup = document.getElementById('auth-user-controls');
    const userNameEl = document.getElementById('lobbyUserName');
    const userTitleEl = document.getElementById('lobbyUserTitle');
    const userAvatarEl = document.getElementById('lobbyUserAvatarShield') || document.getElementById('lobbyUserAvatar');

    const companionsGuest = document.getElementById('btnOpenCompanionsGuest');
    const companionsUser = document.getElementById('btnOpenCompanionsUser');
    const lbGuest = document.getElementById('btnOpenLeaderboardGuest');
    const lbUser = document.getElementById('btnOpenLeaderboardUser');

    if (currentUser) {
      if (guestGroup) guestGroup.style.display = 'none';
      if (userGroup) userGroup.style.display = 'flex';
      if (userNameEl) userNameEl.innerText = currentUser.username;
      if (userTitleEl) userTitleEl.innerText = currentUser.title || 'Zauberlehrling';
      if (userAvatarEl) {
        userAvatarEl.innerText = (currentUser.username || '?').charAt(0).toUpperCase();
      }
      if (companionsGuest) companionsGuest.style.display = 'none';
      if (companionsUser) companionsUser.style.display = 'inline-flex';
      if (lbGuest) lbGuest.style.display = 'none';
      if (lbUser) lbUser.style.display = 'inline-flex';
    } else {
      if (guestGroup) guestGroup.style.display = 'flex';
      if (userGroup) userGroup.style.display = 'none';
      if (companionsGuest) companionsGuest.style.display = 'inline-flex';
      if (companionsUser) companionsUser.style.display = 'none';
      if (lbGuest) lbGuest.style.display = 'inline-flex';
      if (lbUser) lbUser.style.display = 'none';
    }
  }

  function showAuthError(msg) {
    const banner = document.getElementById('authErrorBanner');
    if (!banner) return;
    banner.innerText = msg;
    banner.style.display = 'block';
  }

  function clearAuthError() {
    const banner = document.getElementById('authErrorBanner');
    if (banner) {
      banner.innerText = '';
      banner.style.display = 'none';
    }
  }

  function openAuthModal(tab = 'login') {
    activeAuthTab = tab;
    clearAuthError();
    const modal = document.getElementById('auth-modal');
    const tabLogin = document.getElementById('tabLoginBtn');
    const tabReg = document.getElementById('tabRegisterBtn');
    const submitBtn = document.getElementById('authSubmitBtn');
    const titleEl = document.getElementById('authModalTitle');

    if (tab === 'register') {
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabReg) tabReg.classList.add('active');
      if (submitBtn) submitBtn.innerText = 'Konto erschaffen';
      if (titleEl) titleEl.innerText = 'Gilden-Aufnahme';
    } else {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabReg) tabReg.classList.remove('active');
      if (submitBtn) submitBtn.innerText = 'Einloggen';
      if (titleEl) titleEl.innerText = 'Gilden-Register';
    }

    if (modal) modal.style.display = 'flex';
    const uInput = document.getElementById('authUsernameInput');
    if (uInput && !uInput.value.trim() && typeof nameInput !== 'undefined' && nameInput && nameInput.value.trim()) {
      uInput.value = nameInput.value.trim();
    }
    if (uInput) setTimeout(() => uInput.focus(), 50);
  }

  function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
    const pInput = document.getElementById('authPasswordInput');
    if (pInput) pInput.value = '';
    clearAuthError();
  }

  function openProfileDrawer() {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    // Andere Drawers schließen
    if (typeof closeScoreDrawer === 'function') closeScoreDrawer();
    if (typeof closeRulesDrawer === 'function') closeRulesDrawer();

    const drawer = document.getElementById('profile-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    if (drawer) drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('open');

    renderProfileData();
    // Im Hintergrund frische Daten laden
    refreshUser();
  }

  function closeProfileDrawer() {
    const drawer = document.getElementById('profile-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    if (drawer) drawer.classList.remove('open');
    const scoreDrawer = document.getElementById('score-board-drawer');
    const rulesDrawer = document.getElementById('rules-drawer');
    const scoreOpen = scoreDrawer && scoreDrawer.classList.contains('open');
    const rulesOpen = rulesDrawer && rulesDrawer.classList.contains('open');
    if (backdrop && !scoreOpen && !rulesOpen) {
      backdrop.classList.remove('open');
    }
  }

  function renderProfileData() {
    if (!currentUser) return;

    const u = currentUser;
    const usernameEl = document.getElementById('profileUsername');
    const titleBadgeEl = document.getElementById('profileTitleBadge');
    const avatarShieldEl = document.getElementById('profileAvatarShield');
    const memberSinceEl = document.getElementById('profileMemberSince');

    if (usernameEl) usernameEl.innerText = u.username;
    if (titleBadgeEl) titleBadgeEl.innerText = u.title || 'Zauberlehrling';
    if (avatarShieldEl) avatarShieldEl.innerText = (u.username || '?').charAt(0).toUpperCase();

    if (memberSinceEl && u.created_at) {
      try {
        const d = new Date(u.created_at);
        memberSinceEl.innerText = `Chronik begonnen: ${d.toLocaleDateString('de-DE')}`;
      } catch (e) {}
    }

    // Alltime Win/Loss Banner (E-Sport Stil)
    const gamesPlayed = u.games_played || 0;
    const gamesWon = u.games_won || 0;
    const gamesLost = u.games_lost || 0;
    const winRate = gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(1) : '0.0';

    const totalGamesEl = document.getElementById('profileTotalGames');
    const winsBadgeEl = document.getElementById('profileWinsBadge');
    const lossesBadgeEl = document.getElementById('profileLossesBadge');
    const winRateEl = document.getElementById('profileWinRate');
    const winRateBarEl = document.getElementById('profileWinRateBar');
    const currentStreakEl = document.getElementById('profileCurrentStreak');
    const maxStreakEl = document.getElementById('profileMaxStreak');
    const podiumCountEl = document.getElementById('profilePodiumCount');

    if (totalGamesEl) totalGamesEl.innerText = `${gamesPlayed} ${gamesPlayed === 1 ? 'Partie' : 'Partien'}`;
    if (winsBadgeEl) winsBadgeEl.innerText = `${gamesWon}W`;
    if (lossesBadgeEl) lossesBadgeEl.innerText = `${gamesLost}L`;
    if (winRateEl) winRateEl.innerText = `${winRate}%`;
    if (winRateBarEl) winRateBarEl.style.width = `${Math.min(100, Math.max(0, parseFloat(winRate)))}%`;
    if (currentStreakEl) currentStreakEl.innerText = u.current_streak || 0;
    if (maxStreakEl) maxStreakEl.innerText = u.max_win_streak || 0;
    if (podiumCountEl) podiumCountEl.innerText = u.podium_finishes || 0;

    // Wizard Signatur-Statistiken
    const bidsMade = u.bids_made || 0;
    const bidsHit = u.bids_hit || 0;
    const prophecyRate = bidsMade > 0 ? ((bidsHit / bidsMade) * 100).toFixed(1) : '0.0';

    const prophecyRateEl = document.getElementById('profileProphecyRate');
    const prophecyHitsEl = document.getElementById('profileProphecyHits');
    const highestScoreEl = document.getElementById('profileHighestScore');
    const totalPointsEl = document.getElementById('profileTotalPoints');
    const wizardsPlayedEl = document.getElementById('profileWizardsPlayed');
    const jestersPlayedEl = document.getElementById('profileJestersPlayed');
    const avgPointsEl = document.getElementById('profileAvgPoints');

    if (prophecyRateEl) prophecyRateEl.innerText = `${prophecyRate}%`;
    if (prophecyHitsEl) prophecyHitsEl.innerText = `${bidsHit} / ${bidsMade} Treffer`;
    if (highestScoreEl) highestScoreEl.innerText = (u.highest_score || 0).toLocaleString('de-DE');
    if (totalPointsEl) totalPointsEl.innerText = (u.total_points || 0).toLocaleString('de-DE');
    if (wizardsPlayedEl) wizardsPlayedEl.innerText = (u.wizards_played || 0).toLocaleString('de-DE');
    if (jestersPlayedEl) jestersPlayedEl.innerText = (u.jesters_played || 0).toLocaleString('de-DE');
    if (avgPointsEl) {
      const avg = gamesPlayed > 0 ? ((u.total_points || 0) / gamesPlayed).toFixed(1) : '0.0';
      avgPointsEl.innerText = avg;
    }

    // Titel-Auswahl Dropdown
    renderTitleSelector();
  }

  function renderTitleSelector() {
    if (!currentUser) return;
    const select = document.getElementById('profileTitleSelect');
    const desc = document.getElementById('profileTitleStatusDesc');
    if (!select) return;

    const u = currentUser;
    const wins = u.games_won || 0;
    const maxStreak = u.max_win_streak || 0;
    const bidsMade = u.bids_made || 0;
    const bidsHit = u.bids_hit || 0;
    const pRate = bidsMade > 0 ? (bidsHit / bidsMade) : 0;

    // Freischalt-Bedingungen (Standard: Zauberlehrling, Meister der Illusion, Seher von Stonehenge, Unbesiegbarer Magier, Großmagier)
    const titleDefinitions = [
      {
        id: 'Zauberlehrling',
        name: 'Zauberlehrling',
        unlocked: true,
        desc: 'Standard-Ehrentitel aller neuen Magier'
      },
      {
        id: 'Meister der Illusion',
        name: 'Meister der Illusion',
        unlocked: true,
        desc: 'Meisterhafte Täuschung – Sieg mit klugem Stichspiel'
      },
      {
        id: 'Seher von Stonehenge',
        name: 'Seher von Stonehenge',
        unlocked: (bidsMade >= 20 && pRate >= 0.75) || (u.title === 'Seher von Stonehenge'),
        desc: 'Erfordert mindestens 20 Vorhersagen mit ≥ 75% Trefferquote'
      },
      {
        id: 'Unbesiegbarer Magier',
        name: 'Unbesiegbarer Magier',
        unlocked: (maxStreak >= 5) || (u.title === 'Unbesiegbarer Magier'),
        desc: 'Erfordert eine Serie von mindestens 5 Siegen in Folge'
      },
      {
        id: 'Großmagier',
        name: 'Großmagier',
        unlocked: (wins >= 25) || (u.title === 'Großmagier'),
        desc: 'Erfordert mindestens 25 siegreiche Partien'
      }
    ];

    select.innerHTML = '';
    titleDefinitions.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.disabled = !t.unlocked;
      opt.innerText = t.unlocked ? t.name : `${t.name} (Gesperrt: ${t.desc})`;
      if (t.name === u.title) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    const activeDef = titleDefinitions.find(t => t.name === u.title) || titleDefinitions[0];
    if (desc) {
      desc.innerText = `Aktiver Titel: "${activeDef.name}" – ${activeDef.desc}`;
    }
  }

  let currentLeaderboardTab = 'alltime';

  function closeLeaderboard() {
    const modal = document.getElementById('leaderboard-modal');
    if (modal) modal.style.display = 'none';
  }

  async function openLeaderboard(tab = 'alltime') {
    const modal = document.getElementById('leaderboard-modal');
    if (modal) modal.style.display = 'flex';
    currentLeaderboardTab = (typeof tab === 'string' && tab) ? tab : 'alltime';
    updateLeaderboardTabUI();
    await loadLeaderboard(currentLeaderboardTab);
  }

  function updateLeaderboardTabUI() {
    const tabAlltime = document.getElementById('tabLeaderboardAlltime');
    const tabRanked = document.getElementById('tabLeaderboardRanked');
    const titleEl = document.getElementById('leaderboardTitle');
    const subEl = document.getElementById('leaderboardSubtitle');

    if (tabAlltime) tabAlltime.classList.toggle('active', currentLeaderboardTab === 'alltime');
    if (tabRanked) tabRanked.classList.toggle('active', currentLeaderboardTab === 'ranked');

    if (currentLeaderboardTab === 'ranked') {
      if (titleEl) titleEl.innerText = 'Magier-Rangliste (Ranked)';
      if (subEl) subEl.innerText = 'Die mächtigsten Magier im gewerteten Duell nach Skill Rating (SR)';
    } else {
      if (titleEl) titleEl.innerText = 'Ruhmeshalle der Großmagier';
      if (subEl) subEl.innerText = 'Die besten Magier aller Reiche im ewigen Wettstreit';
    }
  }

  async function loadLeaderboard(type = 'alltime') {
    const thead = document.getElementById('leaderboardTableHead');
    const tbody = document.getElementById('leaderboardTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #d6be90; font-style: italic;">Rufe Chronik der Magier ab...</td></tr>';

    if (type === 'ranked') {
      if (thead) {
        thead.innerHTML = `
          <tr>
            <th style="width: 46px; text-align: center;">Rang</th>
            <th>Magier</th>
            <th>Liga & Division</th>
            <th style="text-align: center;">Skill Rating</th>
            <th style="text-align: center;">Höchstes SR</th>
            <th style="text-align: center;">Siege / Niederlagen</th>
            <th style="text-align: center;">Winrate</th>
          </tr>
        `;
      }

      try {
        const resp = await fetch(getApiUrl('/api/leaderboard/ranked?limit=15'));
        const data = await resp.json();
        if (!data.success || !Array.isArray(data.leaderboard) || data.leaderboard.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #d6be90; font-style: italic;">Noch keine Magier in der Rangliste verzeichnet. Bestreite das erste gewertete Duell!</td></tr>';
          return;
        }

        tbody.innerHTML = '';
        data.leaderboard.forEach((entry, idx) => {
          const row = document.createElement('tr');
          const rank = idx + 1;
          let rankClass = 'rank-other';
          let rankLabel = rank;
          if (rank === 1) { rankClass = 'rank-1'; rankLabel = '🥇'; }
          else if (rank === 2) { rankClass = 'rank-2'; rankLabel = '🥈'; }
          else if (rank === 3) { rankClass = 'rank-3'; rankLabel = '🥉'; }

          const initial = entry.username ? entry.username.charAt(0).toUpperCase() : '?';
          const r = entry.rank;
          const crestSvg = (r && RANK_CRESTS[r.tier]) ? RANK_CRESTS[r.tier] : '';
          const rankBadge = r ? `
            <span class="player-rank-badge" style="color: ${r.color}; border-color: ${r.color};">
              <span style="display:inline-block; width:18px; height:18px; vertical-align:middle;">${crestSvg}</span>
              ${escapeHtml(r.divisionName)}
            </span>
          ` : '<span style="color:#777;">Unplatziert</span>';

          row.innerHTML = `
            <td style="text-align: center;">
              <span class="rank-pill ${rankClass}">${rankLabel}</span>
            </td>
            <td>
              <div class="lb-player-cell">
                <div class="seat-avatar" style="width: 26px; height: 30px; font-size: 12px; margin: 0; box-shadow: none;">${initial}</div>
                <span class="lb-player-name">${escapeHtml(entry.username)}</span>
              </div>
            </td>
            <td>${rankBadge}</td>
            <td style="text-align: center; font-family: var(--font-medieval); font-weight: bold; font-size: 15px; color: ${r ? r.color : '#fde047'};">
              ${entry.skill_rating} SR
            </td>
            <td style="text-align: center; font-family: var(--font-medieval); color: #d6be90;">
              ${entry.highest_skill_rating || entry.skill_rating} SR
            </td>
            <td style="text-align: center;">
              <span style="color: #86efac; font-weight: bold;">${entry.ranked_games_won}W</span> - <span style="color: #fca5a5;">${entry.ranked_games_lost}L</span>
            </td>
            <td style="text-align: center; font-weight: bold; color: var(--gold-bright);">
              ${entry.ranked_win_rate}%
            </td>
          `;
          tbody.appendChild(row);
        });
      } catch (e) {
        console.warn('Fehler beim Laden der Rangliste:', e);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #ef4444;">Verbindungsfehler beim Laden der Rangliste.</td></tr>';
      }
    } else {
      if (thead) {
        thead.innerHTML = `
          <tr>
            <th style="width: 46px; text-align: center;">Rang</th>
            <th>Magier</th>
            <th>Ehrentitel</th>
            <th style="text-align: center;">Siege / Niederlagen</th>
            <th style="text-align: center;">Winrate</th>
            <th style="text-align: center;">Prophezeiung</th>
            <th style="text-align: right;">Highscore</th>
            <th style="text-align: right;">Gesamtpunkte</th>
          </tr>
        `;
      }

      try {
        const resp = await fetch(getApiUrl('/api/leaderboard?limit=10'));
        const data = await resp.json();
        if (!data.success || !Array.isArray(data.leaderboard) || data.leaderboard.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #d6be90; font-style: italic;">Noch keine Magier in der Ruhmeshalle verzeichnet. Bestreite das erste Duell!</td></tr>';
          return;
        }

        tbody.innerHTML = '';
        data.leaderboard.forEach((entry, idx) => {
          const row = document.createElement('tr');
          const rank = idx + 1;
          let rankClass = 'rank-other';
          let rankLabel = rank;
          if (rank === 1) { rankClass = 'rank-1'; rankLabel = '🥇'; }
          else if (rank === 2) { rankClass = 'rank-2'; rankLabel = '🥈'; }
          else if (rank === 3) { rankClass = 'rank-3'; rankLabel = '🥉'; }

          const initial = entry.username ? entry.username.charAt(0).toUpperCase() : '?';
          const titleBadge = entry.title ? `<span class="lb-title-badge">${escapeHtml(entry.title)}</span>` : '<span style="color:#777;">-</span>';

          row.innerHTML = `
            <td style="text-align: center;">
              <span class="rank-pill ${rankClass}">${rankLabel}</span>
            </td>
            <td>
              <div class="lb-player-cell">
                <div class="seat-avatar" style="width: 26px; height: 30px; font-size: 12px; margin: 0; box-shadow: none;">${initial}</div>
                <span class="lb-player-name">${escapeHtml(entry.username)}</span>
              </div>
            </td>
            <td>${titleBadge}</td>
            <td style="text-align: center;">
              <span style="color: #86efac; font-weight: bold;">${entry.games_won}W</span> - <span style="color: #fca5a5;">${entry.games_lost}L</span>
            </td>
            <td style="text-align: center; font-weight: bold; color: var(--gold-bright);">
              ${entry.win_rate}%
            </td>
            <td style="text-align: center; color: #cbd5e1;">
              ${entry.prophecy_rate}%
            </td>
            <td style="text-align: right; font-family: var(--font-medieval); font-weight: bold; color: #fde047;">
              ${(entry.highest_score || 0).toLocaleString('de-DE')}
            </td>
            <td style="text-align: right; font-family: var(--font-medieval); font-weight: bold; color: var(--gold-bright);">
              ${(entry.total_points || 0).toLocaleString('de-DE')}
            </td>
          `;
          tbody.appendChild(row);
        });
      } catch (e) {
        console.warn('Fehler beim Laden der Bestenliste:', e);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #ef4444;">Verbindungsfehler beim Laden der Ruhmeshalle.</td></tr>';
      }
    }
  }

  function setupUIBindings() {
    // Buttons in Haupt-Lobby
    const btnOpenLogin = document.getElementById('btnOpenLogin');
    const btnOpenRegister = document.getElementById('btnOpenRegister');
    const btnOpenLeaderboardGuest = document.getElementById('btnOpenLeaderboardGuest');
    const btnOpenLeaderboardUser = document.getElementById('btnOpenLeaderboardUser');
    const btnOpenProfile = document.getElementById('btnOpenProfile');
    const authUserPill = document.getElementById('authUserPill');
    const btnLogout = document.getElementById('btnLogout');

    if (btnOpenLogin) btnOpenLogin.addEventListener('click', () => openAuthModal('login'));
    if (btnOpenRegister) btnOpenRegister.addEventListener('click', () => openAuthModal('register'));
    if (btnOpenLeaderboardGuest) btnOpenLeaderboardGuest.addEventListener('click', openLeaderboard);
    if (btnOpenLeaderboardUser) btnOpenLeaderboardUser.addEventListener('click', openLeaderboard);
    if (btnOpenProfile) btnOpenProfile.addEventListener('click', openProfileDrawer);
    if (authUserPill) authUserPill.addEventListener('click', openProfileDrawer);
    if (btnLogout) btnLogout.addEventListener('click', logout);

    // Auth-Modal Controls
    const tabLoginBtn = document.getElementById('tabLoginBtn');
    const tabRegisterBtn = document.getElementById('tabRegisterBtn');
    const authCloseBtn = document.getElementById('authModalClose');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authGuestBtn = document.getElementById('authGuestBtn');
    const uInput = document.getElementById('authUsernameInput');
    const pInput = document.getElementById('authPasswordInput');

    if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => openAuthModal('login'));
    if (tabRegisterBtn) tabRegisterBtn.addEventListener('click', () => openAuthModal('register'));
    if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);
    if (authGuestBtn) authGuestBtn.addEventListener('click', closeAuthModal);

    // Form Submit
    function submitAuth() {
      const u = uInput ? uInput.value.trim() : '';
      const p = pInput ? pInput.value : '';
      if (activeAuthTab === 'register') {
        register(u, p);
      } else {
        login(u, p);
      }
    }

    if (authSubmitBtn) authSubmitBtn.addEventListener('click', submitAuth);
    if (uInput) uInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); });
    if (pInput) pInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); });

    // Profile-Drawer Controls
    const profileCloseBtn = document.getElementById('profile-drawer-close');
    if (profileCloseBtn) profileCloseBtn.addEventListener('click', closeProfileDrawer);

    // Title Selector im Profile Drawer
    const titleSelect = document.getElementById('profileTitleSelect');
    if (titleSelect) {
      titleSelect.addEventListener('change', (e) => {
        const newTitle = e.target.value;
        if (newTitle) updateTitle(newTitle);
      });
    }

    // Leaderboard Controls
    const lbCloseBtn = document.getElementById('leaderboardCloseBtn');
    const btnRefreshLb = document.getElementById('btnRefreshLeaderboard');
    const tabLbAlltime = document.getElementById('tabLeaderboardAlltime');
    const tabLbRanked = document.getElementById('tabLeaderboardRanked');

    if (lbCloseBtn) lbCloseBtn.addEventListener('click', closeLeaderboard);
    const lbModal = document.getElementById('leaderboard-modal');
    if (lbModal) {
      lbModal.addEventListener('click', (e) => {
        if (e.target === lbModal) closeLeaderboard();
      });
    }
    if (tabLbAlltime) tabLbAlltime.addEventListener('click', () => {
      currentLeaderboardTab = 'alltime';
      updateLeaderboardTabUI();
      loadLeaderboard('alltime');
    });
    if (tabLbRanked) tabLbRanked.addEventListener('click', () => {
      currentLeaderboardTab = 'ranked';
      updateLeaderboardTabUI();
      loadLeaderboard('ranked');
    });
    if (btnRefreshLb) btnRefreshLb.addEventListener('click', () => loadLeaderboard(currentLeaderboardTab));

    // Penalty-Notice Modal Controls
    const btnPenaltyNoticeAck = document.getElementById('btnPenaltyNoticeAck');
    const penaltyNoticeModal = document.getElementById('penalty-notice-modal');
    if (btnPenaltyNoticeAck && penaltyNoticeModal) {
      btnPenaltyNoticeAck.addEventListener('click', () => {
        penaltyNoticeModal.style.display = 'none';
      });
    }
  }

  return {
    init: async () => {
      // 0ms Auto-Login: Synchron aus dem lokalen Speicher laden
      const token = getToken();
      const cached = getCachedUser();
      if (token && cached) {
        currentUser = cached;
        if (nameInput && cached.username) {
          nameInput.value = cached.username;
          sessionStorage.setItem('wizard_last_name', cached.username);
        }
        renderLobbyBar();
      }
      setupUIBindings();
      await checkSession();
    },
    getUser: () => currentUser,
    getCurrentUser: () => currentUser,
    getCachedUser,
    setCachedUser,
    getToken,
    setToken,
    login,
    register,
    logout,
    openAuthModal,
    closeAuthModal,
    openProfileDrawer,
    closeProfileDrawer,
    openLeaderboard,
    closeLeaderboard,
    updateTitle,
    updateAvatar,
    refreshUser
  };
})();
if (typeof window !== 'undefined') window.WizardAuth = WizardAuth;

// --- GRIMOIRE DER GEFÄHRTEN & OVERWATCH-STYLE INVITE CONTROLLER ---
const CompanionsManager = (() => {
  let cachedFriends = [];
  let inviteTimerInterval = null;
  let pendingInviteData = null;

  function init() {
    setupUI();
    setupSocket();
  }

  function setupUI() {
    const drawer = document.getElementById('companions-drawer');
    const closeBtn = document.getElementById('btnCompanionsClose');
    const guestOpenBtn = document.getElementById('btnOpenCompanionsGuest');
    const userOpenBtn = document.getElementById('btnOpenCompanionsUser');
    const waitingOpenBtn = document.getElementById('btnOpenCompanionsWaiting');

    function checkAuthAndOpen() {
      const user = (typeof WizardAuth !== 'undefined') ? WizardAuth.getUser() : null;
      if (!user) {
        if (typeof GrimoireDialog !== 'undefined' && GrimoireDialog.requireAuth) {
          GrimoireDialog.requireAuth('companions');
        } else if (typeof WizardAuth !== 'undefined' && WizardAuth.openAuthModal) {
          WizardAuth.openAuthModal('login');
        }
        return;
      }
      openCompanions();
    }

    if (guestOpenBtn) guestOpenBtn.addEventListener('click', checkAuthAndOpen);
    if (userOpenBtn) userOpenBtn.addEventListener('click', checkAuthAndOpen);
    if (waitingOpenBtn) waitingOpenBtn.addEventListener('click', checkAuthAndOpen);

    if (closeBtn) closeBtn.addEventListener('click', closeCompanions);

    const backdrop = document.getElementById('drawer-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        if (drawer && drawer.classList.contains('open')) {
          closeCompanions();
        }
      });
    }

    const btnAdd = document.getElementById('btnAddFriend');
    const inputName = document.getElementById('inputAddFriendName');
    if (btnAdd && inputName) {
      btnAdd.addEventListener('click', () => {
        const val = inputName.value.trim();
        if (!val) return;
        socket.emit('addFriend', { friendUsername: val, token: WizardAuth.getToken() });
        inputName.value = '';
      });
      inputName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          btnAdd.click();
        }
      });
    }

    const btnGuestRegister = document.getElementById('btnCompanionsGuestRegister');
    if (btnGuestRegister) {
      btnGuestRegister.addEventListener('click', () => {
        closeCompanions();
        if (typeof WizardAuth !== 'undefined' && WizardAuth.openAuthModal) {
          WizardAuth.openAuthModal('register');
        }
      });
    }

    // Overwatch Invite Modal Buttons
    const btnAccept = document.getElementById('btnAcceptInvite');
    const btnDecline = document.getElementById('btnDeclineInvite');
    if (btnAccept) {
      btnAccept.addEventListener('click', () => {
        if (pendingInviteData && pendingInviteData.roomCode) {
          const code = pendingInviteData.roomCode;
          closeInviteModal();
          joinRoomWithCode(code);
        }
      });
    }
    if (btnDecline) {
      btnDecline.addEventListener('click', closeInviteModal);
    }
  }

  function setupSocket() {
    if (!socket || typeof socket.on !== 'function') return;

    socket.on('friendsList', ({ friends }) => {
      cachedFriends = friends || [];
      renderFriendsList();
    });

    socket.on('friendsError', ({ message }) => {
      showToast('⚠️ ' + (message || 'Gefährten-Grimoire nicht verfügbar.'));
    });

    socket.on('friendActionSuccess', ({ message }) => {
      showToast(message || 'Aktion erfolgreich!');
      const msgEl = document.getElementById('companionActionMessage');
      if (msgEl) {
        msgEl.innerText = message || '';
        msgEl.style.color = '#86efac';
        msgEl.style.display = 'block';
        setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 4000);
      }
    });

    socket.on('friendActionError', ({ message }) => {
      showToast('⚠️ ' + (message || 'Fehler!'));
      const msgEl = document.getElementById('companionActionMessage');
      if (msgEl) {
        msgEl.innerText = message || '';
        msgEl.style.color = '#f87171';
        msgEl.style.display = 'block';
        setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 4000);
      }
    });

    socket.on('friendGameInvite', (inviteData) => {
      showInviteModal(inviteData);
    });
  }

  function openCompanions() {
    const user = (typeof WizardAuth !== 'undefined') ? WizardAuth.getUser() : null;
    if (!user) {
      if (typeof GrimoireDialog !== 'undefined' && GrimoireDialog.requireAuth) {
        GrimoireDialog.requireAuth('companions');
      } else if (typeof WizardAuth !== 'undefined' && WizardAuth.openAuthModal) {
        WizardAuth.openAuthModal('login');
      }
      return;
    }

    // Andere Drawers schließen
    if (typeof closeScoreDrawer === 'function') closeScoreDrawer();
    if (typeof closeRulesDrawer === 'function') closeRulesDrawer();
    if (typeof WizardAuth !== 'undefined' && WizardAuth.closeProfileDrawer) {
      WizardAuth.closeProfileDrawer();
    }

    const guestView = document.getElementById('companions-guest-view');
    const userView = document.getElementById('companions-user-view');
    const drawer = document.getElementById('companions-drawer');
    const backdrop = document.getElementById('drawer-backdrop');

    if (guestView) guestView.style.display = 'none';
    if (userView) userView.style.display = 'block';
    if (socket && typeof socket.emit === 'function') {
      socket.emit('getFriends', { token: WizardAuth.getToken() });
    }

    if (drawer) drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
  }

  function closeCompanions() {
    const drawer = document.getElementById('companions-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    if (drawer) drawer.classList.remove('open');

    const scoreDrawer = document.getElementById('score-board-drawer');
    const rulesDrawer = document.getElementById('rules-drawer');
    const profileDrawer = document.getElementById('profile-drawer');
    const scoreOpen = scoreDrawer && scoreDrawer.classList.contains('open');
    const rulesOpen = rulesDrawer && rulesDrawer.classList.contains('open');
    const profileOpen = profileDrawer && profileDrawer.classList.contains('open');
    if (backdrop && !scoreOpen && !rulesOpen && !profileOpen) {
      backdrop.classList.remove('open');
    }
  }

  function renderFriendsList() {
    const listEl = document.getElementById('companionsList');
    const countEl = document.getElementById('companionsCount');
    if (countEl) countEl.innerText = cachedFriends.length;
    if (!listEl) return;

    if (cachedFriends.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; color: #a89070; padding: 28px 12px; font-style: italic; font-size: 13.5px;">
          Dein Grimoire ist noch leer. Gib den Namen eines Magiers ein, um euren Bund zu stiften!
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    cachedFriends.forEach(friend => {
      const card = document.createElement('div');
      card.className = 'companion-card';
      card.setAttribute('data-id', friend.id);
      card.style.cursor = 'pointer';
      card.title = `Klicke, um Magier-Profil von ${escapeHtml(friend.username)} zu öffnen`;

      const statusMap = {
        citadel: { label: 'In der Zitadelle', dot: '🟢', color: '#86efac' },
        waiting_room: { label: friend.liveStatusText || 'Im Warteraum', dot: '🟡', color: '#fde047' },
        in_game: { label: friend.liveStatusText || 'Im Duell', dot: '🔴', color: '#f87171' },
        offline: { label: 'Abwesend', dot: '⚫', color: '#94a3b8' }
      };
      const st = statusMap[friend.liveStatus] || statusMap.offline;

      const sr = friend.skill_rating || 1000;
      const rank = friend.rank || (typeof getRankDetailsFromSR === 'function' ? getRankDetailsFromSR(sr) : null);
      const divName = rank ? rank.divisionName : 'Novize V';
      const tierKey = rank ? rank.tierKey : 'novice';
      const crestSvg = (typeof RANK_CRESTS !== 'undefined' && RANK_CRESTS[tierKey]) ? RANK_CRESTS[tierKey] : '';

      // Buttons
      let actionButtons = '';
      const inWaitingRoom = (currentGameState === 'lobby' && currentRoomCode);
      if (inWaitingRoom && friend.liveStatus !== 'in_game' && friend.liveStatus !== 'offline') {
        actionButtons += `<button class="btn-companion-action btn-invite-companion btn-hybrid-compact" data-id="${friend.id}" title="In Warteraum einladen" aria-label="In Warteraum einladen"><span class="btn-icon" aria-hidden="true">✉️</span><span class="btn-text">Einladen</span></button>`;
      }
      if (friend.liveStatus === 'waiting_room' && friend.liveRoomCode) {
        actionButtons += `<button class="btn-companion-action btn-join-companion btn-hybrid-compact" data-code="${friend.liveRoomCode}" title="Raum beitreten" aria-label="Raum beitreten"><span class="btn-icon" aria-hidden="true">🚀</span><span class="btn-text">Beitreten</span></button>`;
      }
      actionButtons += `<button class="btn-companion-remove" data-id="${friend.id}" data-name="${escapeHtml(friend.username)}" title="Aus Grimoire entfernen" aria-label="Aus Grimoire entfernen"><span class="btn-icon" aria-hidden="true">✕</span></button>`;

      card.innerHTML = `
        <div class="companion-avatar-wrap">
          <div class="companion-mini-crest">${crestSvg}</div>
        </div>
        <div class="companion-info">
          <div class="companion-name">${escapeHtml(friend.username)}</div>
          <div class="companion-rank">${escapeHtml(divName)} • ${sr} SR</div>
          <div class="companion-status" style="color: ${st.color}; font-size: 11px;">
            <span>${st.dot}</span> ${escapeHtml(st.label)}
          </div>
        </div>
        <div class="companion-actions">
          ${actionButtons}
        </div>
      `;

      listEl.appendChild(card);
    });

    // Klick auf Begleiter-Karte öffnet Magier-Profil
    listEl.querySelectorAll('.companion-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-companion-action') || e.target.closest('.btn-companion-remove')) return;
        const id = card.getAttribute('data-id');
        const friend = cachedFriends.find(f => String(f.id) === String(id));
        if (friend && typeof openPlayerDetailModal === 'function') {
          openPlayerDetailModal(friend, 'friends');
        }
      });
    });

    // Event listener bindings
    listEl.querySelectorAll('.btn-invite-companion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        socket.emit('inviteFriendToRoom', { friendId: id, roomCode: currentRoomCode, token: WizardAuth.getToken() });
      });
    });

    listEl.querySelectorAll('.btn-join-companion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.getAttribute('data-code');
        closeCompanions();
        joinRoomWithCode(code);
      });
    });

    listEl.querySelectorAll('.btn-companion-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        GrimoireDialog.confirm({
          title: 'Gefährten verbannen',
          message: `Möchtest du ${name} wirklich aus deinem Grimoire der Gefährten entfernen?`,
          icon: '👥',
          confirmText: 'Ja, entfernen',
          cancelText: 'Behalten',
          danger: true
        }).then((confirmed) => {
          if (confirmed) {
            socket.emit('removeFriend', { friendId: id, token: WizardAuth.getToken() });
          }
        });
      });
    });
  }

  function showInviteModal(data) {
    pendingInviteData = data;
    const modal = document.getElementById('friend-invite-modal');
    const hostEl = document.getElementById('inviteHostName');
    const codeEl = document.getElementById('inviteRoomCode');
    const timerFill = document.getElementById('inviteTimerFill');
    const timerLabel = document.getElementById('inviteTimerLabel');
    const modeBadge = document.getElementById('inviteModeBadge');

    if (!modal) return;

    if (hostEl) hostEl.innerText = data.hostName || 'Ein Gefährte';
    if (codeEl) codeEl.innerText = data.roomCode || '------';
    if (modeBadge) {
      modeBadge.innerText = data.isRanked ? '⚔️ Rangliste' : '🍻 Schnellspiel';
      modeBadge.className = data.isRanked ? 'waiting-mode-badge mode-ranked' : 'waiting-mode-badge mode-quickplay';
    }

    // Play CC0 Audio Chime
    if (typeof WizardAudio !== 'undefined' && WizardAudio.playInviteChime) {
      WizardAudio.playInviteChime();
    }

    // 15s Countdown
    if (timerFill) timerFill.style.width = '100%';
    if (timerLabel) timerLabel.innerText = '15s';

    if (inviteTimerInterval) clearInterval(inviteTimerInterval);

    const startTime = Date.now();
    const duration = 15000;

    inviteTimerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const leftMs = Math.max(0, duration - elapsed);
      const pct = (leftMs / duration) * 100;
      const sec = Math.ceil(leftMs / 1000);

      if (timerFill) timerFill.style.width = `${pct}%`;
      if (timerLabel) timerLabel.innerText = `${sec}s`;

      if (leftMs <= 0) {
        clearInterval(inviteTimerInterval);
        inviteTimerInterval = null;
        closeInviteModal();
      }
    }, 100);

    modal.style.display = 'flex';
  }

  function closeInviteModal() {
    if (inviteTimerInterval) {
      clearInterval(inviteTimerInterval);
      inviteTimerInterval = null;
    }
    pendingInviteData = null;
    const modal = document.getElementById('friend-invite-modal');
    if (modal) modal.style.display = 'none';
  }

  function joinRoomWithCode(code) {
    if (!code) return;
    if (nameInput && !nameInput.value.trim()) {
      const user = (typeof WizardAuth !== 'undefined') ? WizardAuth.getUser() : null;
      if (user && user.username) nameInput.value = user.username;
    }
    if (roomInput) roomInput.value = code;
    if (joinBtn) joinBtn.click();
  }

  return {
    init,
    open: openCompanions,
    close: closeCompanions
  };
})();
if (typeof window !== 'undefined') window.CompanionsManager = CompanionsManager;

// --- MAGIER-PROFIL & SPIELER-DETAILS MODAL (SPIELTISCH & GRIMOIRE DER GEFÄHRTEN) ---
function openPlayerDetailModal(data, source = 'table') {
  const modal = document.getElementById('player-detail-modal');
  if (!modal || !data) return;

  const isTable = (source === 'table');
  const isFriendSource = (source === 'friends');

  const avatarEl = document.getElementById('playerDetailAvatar');
  const nameEl = document.getElementById('playerDetailName');
  const titleEl = document.getElementById('playerDetailTitle');
  const statusEl = document.getElementById('playerDetailStatus');
  const divisionEl = document.getElementById('playerDetailDivision');
  const srEl = document.getElementById('playerDetailSR');
  const crestEl = document.getElementById('playerDetailCrest');
  const botDiffEl = document.getElementById('playerDetailBotDiff');
  const statsTitleEl = document.getElementById('playerDetailStatsTitle');
  const statsGridEl = document.getElementById('playerDetailStatsGrid');
  const btnAddFriend = document.getElementById('btnPlayerDetailAddFriend');
  const btnClose = document.getElementById('btnPlayerDetailClose');
  const modalClose = document.getElementById('playerDetailModalClose');

  const name = isFriendSource ? data.username : data.name;
  const initial = isFriendSource ? (data.username ? data.username.charAt(0).toUpperCase() : '?') : (data.isBot ? '🤖' : (data.name ? data.name.charAt(0).toUpperCase() : '?'));
  const title = data.title || (data.isBot ? 'Virtueller Zitadellen-Gefährte' : 'Magier der Zitadelle');

  if (avatarEl) avatarEl.innerText = initial;
  if (nameEl) nameEl.innerText = name || 'Magier';
  if (titleEl) titleEl.innerText = title;

  // Status
  if (statusEl) {
    if (isFriendSource) {
      const statusMap = {
        citadel: { label: 'In der Zitadelle', color: '#86efac' },
        waiting_room: { label: data.liveStatusText || 'Im Warteraum', color: '#fde047' },
        in_game: { label: data.liveStatusText || 'Im Duell', color: '#f87171' },
        offline: { label: 'Abwesend', color: '#94a3b8' }
      };
      const st = statusMap[data.liveStatus] || statusMap.offline;
      statusEl.innerHTML = `<span style="color: ${st.color}; font-weight: bold;">● ${escapeHtml(st.label)}</span>`;
    } else if (data.isBot) {
      statusEl.innerHTML = '<span style="color: #c084fc; font-weight: bold;">🤖 Virtueller Rat</span>';
    } else {
      statusEl.innerHTML = data.connected === false
        ? '<span style="color: #f87171; font-weight: bold;">● Getrennt</span>'
        : '<span style="color: #86efac; font-weight: bold;">● Am Spieltisch</span>';
    }
  }

  // Rang
  const sr = isFriendSource ? (data.skill_rating || 1000) : (data.skillRating || (data.rank ? data.rank.skillRating : 1000) || 1000);
  const rank = data.rank || (typeof getRankDetailsFromSR === 'function' ? getRankDetailsFromSR(sr) : null);
  const divName = rank ? rank.divisionName : (data.userId || data.isBot ? 'Novize V' : 'Gast-Magier');
  const tierKey = rank ? rank.tierKey : 'novice';
  const crestSvg = (typeof RANK_CRESTS !== 'undefined' && RANK_CRESTS[tierKey]) ? RANK_CRESTS[tierKey] : '';

  if (divisionEl) {
    divisionEl.innerText = divName;
    if (rank && rank.color) divisionEl.style.color = rank.color;
  }
  if (srEl) {
    srEl.innerText = (data.userId || data.isBot || isFriendSource) ? `${sr} SR` : 'Nicht gewertet';
  }
  if (crestEl) {
    crestEl.innerHTML = (data.userId || data.isBot || isFriendSource) ? crestSvg : '🔮';
  }

  // Bot-Schwierigkeit
  if (botDiffEl) {
    if (data.isBot) {
      const diff = data.difficulty || 'master';
      const label = diff === 'novice' ? 'Novize' : (diff === 'archmage' ? 'Erzmagier' : 'Meister');
      botDiffEl.innerHTML = `<span class="seat-bot-pill bot-pill-${diff}">${label}</span>`;
      botDiffEl.style.display = 'block';
    } else {
      botDiffEl.innerHTML = '';
      botDiffEl.style.display = 'none';
    }
  }

  // Statistiken Grid
  if (statsGridEl) {
    statsGridEl.innerHTML = '';
    if (isTable) {
      if (statsTitleEl) statsTitleEl.innerText = 'Runden-Statistiken (Aktuelle Partie)';
      const bidVal = (data.bid !== null && data.bid !== undefined) ? data.bid : '-';
      const wonVal = (data.tricksWon !== undefined) ? data.tricksWon : 0;
      let totalPts = 0;
      if (typeof cachedScoreHistory !== 'undefined' && Array.isArray(cachedScoreHistory)) {
        cachedScoreHistory.forEach(entry => {
          if (entry.scores && entry.scores[data.sessionId] !== undefined) {
            totalPts += entry.scores[data.sessionId];
          }
        });
      }

      statsGridEl.innerHTML = `
        <div style="background: rgba(0,0,0,0.5); padding: 8px 4px; border-radius: 8px; border: 1px solid var(--gold-antique);">
          <div style="font-size: 15px; font-weight: 900; color: var(--gold-bright); font-family: var(--font-medieval);">${bidVal}</div>
          <div style="font-size: 10px; color: #d6be90; margin-top: 2px;">Prophezeiung</div>
        </div>
        <div style="background: rgba(0,0,0,0.5); padding: 8px 4px; border-radius: 8px; border: 1px solid var(--gold-antique);">
          <div style="font-size: 15px; font-weight: 900; color: #86efac; font-family: var(--font-medieval);">${wonVal}</div>
          <div style="font-size: 10px; color: #d6be90; margin-top: 2px;">Erzielte Stiche</div>
        </div>
        <div style="background: rgba(0,0,0,0.5); padding: 8px 4px; border-radius: 8px; border: 1px solid var(--gold-antique);">
          <div style="font-size: 15px; font-weight: 900; color: ${totalPts >= 0 ? '#86efac' : '#f87171'}; font-family: var(--font-medieval);">${totalPts}</div>
          <div style="font-size: 10px; color: #d6be90; margin-top: 2px;">Gesamtpunkte</div>
        </div>
      `;
    } else {
      // Karriere-Statistiken aus dem Grimoire der Gefährten
      if (statsTitleEl) statsTitleEl.innerText = 'Karriere-Statistiken';
      const played = data.games_played || 0;
      const won = data.games_won || 0;
      const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
      const high = data.highest_score || 0;

      statsGridEl.innerHTML = `
        <div style="background: rgba(0,0,0,0.5); padding: 8px 4px; border-radius: 8px; border: 1px solid var(--gold-antique);">
          <div style="font-size: 15px; font-weight: 900; color: var(--gold-bright); font-family: var(--font-medieval);">${played}</div>
          <div style="font-size: 10px; color: #d6be90; margin-top: 2px;">Partien</div>
        </div>
        <div style="background: rgba(0,0,0,0.5); padding: 8px 4px; border-radius: 8px; border: 1px solid var(--gold-antique);">
          <div style="font-size: 15px; font-weight: 900; color: #86efac; font-family: var(--font-medieval);">${won} (${winRate}%)</div>
          <div style="font-size: 10px; color: #d6be90; margin-top: 2px;">Siege</div>
        </div>
        <div style="background: rgba(0,0,0,0.5); padding: 8px 4px; border-radius: 8px; border: 1px solid var(--gold-antique);">
          <div style="font-size: 15px; font-weight: 900; color: #fde047; font-family: var(--font-medieval);">${high}</div>
          <div style="font-size: 10px; color: #d6be90; margin-top: 2px;">Highscore</div>
        </div>
      `;
    }
  }

  // Aktionen
  if (btnAddFriend) {
    const isMe = (!isFriendSource && data.sessionId === mySessionId);
    const isBot = (!isFriendSource && data.isBot);
    const isFriend = Array.isArray(cachedFriends) && cachedFriends.some(f => f.username.toLowerCase() === (name || '').toLowerCase());

    if (isMe) {
      btnAddFriend.style.display = 'none';
    } else if (isBot) {
      btnAddFriend.style.display = 'block';
      btnAddFriend.disabled = true;
      btnAddFriend.style.opacity = '0.5';
      btnAddFriend.style.cursor = 'default';
      btnAddFriend.innerText = '🤖 Virtueller Rat (Kein Gefährte)';
      btnAddFriend.onclick = null;
    } else if (isFriend) {
      if (isFriendSource) {
        btnAddFriend.style.display = 'block';
        btnAddFriend.disabled = false;
        btnAddFriend.style.opacity = '1';
        btnAddFriend.style.cursor = 'pointer';
        if (data.liveStatus === 'waiting_room' && data.liveRoomCode) {
          btnAddFriend.innerText = '🚀 Warteraum beitreten';
          btnAddFriend.onclick = () => {
            modal.style.display = 'none';
            if (typeof CompanionsManager !== 'undefined') CompanionsManager.close();
            joinRoomWithCode(data.liveRoomCode);
          };
        } else {
          btnAddFriend.innerText = '✉️ In Warteraum einladen';
          const canInvite = (currentGameState === 'lobby' && currentRoomCode && data.liveStatus !== 'offline' && data.liveStatus !== 'in_game');
          btnAddFriend.disabled = !canInvite;
          btnAddFriend.style.opacity = canInvite ? '1' : '0.5';
          btnAddFriend.onclick = () => {
            if (canInvite) {
              socket.emit('inviteFriendToRoom', { friendId: data.id, roomCode: currentRoomCode, token: WizardAuth.getToken() });
              showToast(`Einladung an ${data.username} gesendet! ✉️`);
              modal.style.display = 'none';
            }
          };
        }
      } else {
        btnAddFriend.style.display = 'block';
        btnAddFriend.disabled = true;
        btnAddFriend.style.opacity = '0.7';
        btnAddFriend.style.cursor = 'default';
        btnAddFriend.innerText = '✅ Bereits dein Gefährte';
        btnAddFriend.onclick = null;
      }
    } else {
      // Neuer Freund hinzufügen
      btnAddFriend.style.display = 'block';
      btnAddFriend.disabled = false;
      btnAddFriend.style.opacity = '1';
      btnAddFriend.style.cursor = 'pointer';
      btnAddFriend.innerText = '✨ Als Gefährten hinzufügen';
      btnAddFriend.onclick = () => {
        const user = (typeof WizardAuth !== 'undefined') ? WizardAuth.getUser() : null;
        if (!user) {
          modal.style.display = 'none';
          if (typeof GrimoireDialog !== 'undefined' && GrimoireDialog.requireAuth) {
            GrimoireDialog.requireAuth('companions');
          }
          return;
        }
        socket.emit('addFriend', { friendUsername: name, token: WizardAuth.getToken() });
        btnAddFriend.disabled = true;
        btnAddFriend.innerText = '✨ Anfrage gesendet!';
        setTimeout(() => {
          modal.style.display = 'none';
        }, 1200);
      };
    }
  }

  const closeModal = () => { modal.style.display = 'none'; };
  if (btnClose) btnClose.onclick = closeModal;
  if (modalClose) modalClose.onclick = closeModal;

  modal.style.display = 'flex';
}
if (typeof window !== 'undefined') window.openPlayerDetailModal = openPlayerDetailModal;

// Screen-Manager zur sauberen Umschaltung zwischen den 3 Screens
function switchScreen(screenName) {
  lobbyScreen.style.display = (screenName === 'lobby') ? 'flex' : 'none';
  waitingRoomScreen.style.display = (screenName === 'waiting') ? 'flex' : 'none';
  gameScreen.style.display = (screenName === 'game') ? 'flex' : 'none';

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
      sessionId: mySessionId,
      authToken: WizardAuth.getToken()
    });
  }
});

// --- DRAWER-STEUERUNG (BUCH DER WAHRHEIT, REGELWERK & PROFIL) ---
function openScoreDrawer() {
  closeRulesDrawer();
  if (typeof WizardAuth !== 'undefined') WizardAuth.closeProfileDrawer();
  scoreDrawer.classList.add('open');
  drawerBackdrop.classList.add('open');
}

function closeScoreDrawer() {
  scoreDrawer.classList.remove('open');
  const profileDrawer = document.getElementById('profile-drawer');
  const profileOpen = profileDrawer && profileDrawer.classList.contains('open');
  if ((!rulesDrawer || !rulesDrawer.classList.contains('open')) && !profileOpen) {
    drawerBackdrop.classList.remove('open');
  }
}

function openRulesDrawer() {
  closeScoreDrawer();
  if (typeof WizardAuth !== 'undefined') WizardAuth.closeProfileDrawer();
  if (rulesDrawer) rulesDrawer.classList.add('open');
  drawerBackdrop.classList.add('open');
}

function closeRulesDrawer() {
  if (rulesDrawer) rulesDrawer.classList.remove('open');
  const profileDrawer = document.getElementById('profile-drawer');
  const profileOpen = profileDrawer && profileDrawer.classList.contains('open');
  if ((!scoreDrawer || !scoreDrawer.classList.contains('open')) && !profileOpen) {
    drawerBackdrop.classList.remove('open');
  }
}

if (scoreDrawerToggle) {
  scoreDrawerToggle.addEventListener('click', () => {
    if (scoreDrawer && scoreDrawer.classList.contains('open')) {
      closeScoreDrawer();
    } else {
      openScoreDrawer();
    }
  });
}

if (rulesDrawerToggle) {
  rulesDrawerToggle.addEventListener('click', () => {
    if (rulesDrawer && rulesDrawer.classList.contains('open')) {
      closeRulesDrawer();
    } else {
      openRulesDrawer();
    }
  });
}

if (scoreDrawerClose) scoreDrawerClose.addEventListener('click', closeScoreDrawer);
if (rulesDrawerClose) rulesDrawerClose.addEventListener('click', closeRulesDrawer);

// Tab-Umschaltung im Grimoire der Regeln
document.querySelectorAll('.rules-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTabId = btn.getAttribute('data-tab');
    document.querySelectorAll('.rules-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.rules-tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const targetContent = document.getElementById(targetTabId);
    if (targetContent) targetContent.classList.add('active');
  });
});

if (drawerBackdrop) {
  drawerBackdrop.addEventListener('click', () => {
    closeScoreDrawer();
    closeRulesDrawer();
    if (typeof WizardAuth !== 'undefined') WizardAuth.closeProfileDrawer();
    if (typeof CompanionsManager !== 'undefined' && CompanionsManager.close) CompanionsManager.close();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (typeof closeScoreDrawer === 'function') closeScoreDrawer();
    if (typeof closeRulesDrawer === 'function') closeRulesDrawer();
    if (typeof WizardAuth !== 'undefined' && WizardAuth.closeProfileDrawer) WizardAuth.closeProfileDrawer();
    if (typeof CompanionsManager !== 'undefined' && CompanionsManager.close) CompanionsManager.close();
    const playerModal = document.getElementById('player-detail-modal');
    if (playerModal) playerModal.style.display = 'none';
  }
});

// --- SPIELMODUS-WAHL (LOBBY) ---
const btnModeQuickplay = document.getElementById('btnModeQuickplay');
const btnModeRanked = document.getElementById('btnModeRanked');

function setGameMode(mode) {
  if (mode === 'ranked') {
    if (typeof WizardAuth !== 'undefined' && !WizardAuth.getToken()) {
      GrimoireDialog.requireAuth('ranked');
      return;
    }
    selectedGameMode = 'ranked';
  } else {
    selectedGameMode = 'quickplay';
  }

  if (btnModeQuickplay) btnModeQuickplay.classList.toggle('active', selectedGameMode === 'quickplay');
  if (btnModeRanked) btnModeRanked.classList.toggle('active', selectedGameMode === 'ranked');
}

if (btnModeQuickplay) btnModeQuickplay.addEventListener('click', () => setGameMode('quickplay'));
if (btnModeRanked) btnModeRanked.addEventListener('click', () => setGameMode('ranked'));

// --- SCREEN 1: HAUPT-LOBBY ---
function clearLobbyInputErrors() {
  if (nameInput) nameInput.classList.remove('input-error');
  if (roomInput) roomInput.classList.remove('input-error');
  if (lobbyStatusMsg) {
    lobbyStatusMsg.style.display = 'none';
    lobbyStatusMsg.textContent = '';
  }
}

function showLobbyError(msg, targetInput = null) {
  if (lobbyStatusMsg) {
    lobbyStatusMsg.textContent = msg;
    lobbyStatusMsg.style.display = 'block';
    lobbyStatusMsg.style.color = '#f87171';
  }
  if (targetInput) {
    targetInput.classList.add('input-error');
    targetInput.focus();
  }
}

function doCreateGame() {
  clearLobbyInputErrors();

  if (!socket || !socket.connected) {
    showLobbyError('⚠️ Keine Verbindung zum Spielserver. Bitte prüfe, ob "npm start" läuft.');
    showConnectionStatus('⚠️ Keine Verbindung zum Spielserver. Bitte prüfe, ob der Server läuft.');
    return;
  }

  const playerName = nameInput ? nameInput.value.trim() : '';
  if (!playerName) {
    showLobbyError('Bitte gib zuerst deinen Spielernamen ein!', nameInput);
    return;
  }
  if (selectedGameMode === 'ranked' && typeof WizardAuth !== 'undefined' && !WizardAuth.getToken()) {
    showLobbyError('Für Ranglistenspiele musst du im Magier-Register angemeldet sein!');
    WizardAuth.openAuthModal('login');
    return;
  }
  sessionStorage.setItem('wizard_last_name', playerName);
  if (createGameBtn) {
    createGameBtn.disabled = true;
    setTimeout(() => {
      if (currentGameState === 'lobby' && createGameBtn) {
        createGameBtn.disabled = false;
      }
    }, 4000);
  }
  if (lobbyStatusMsg) {
    lobbyStatusMsg.textContent = 'Erstelle Spielraum in der Zitadelle...';
    lobbyStatusMsg.style.display = 'block';
    lobbyStatusMsg.style.color = '#fde047';
  }
  socket.emit('createRoom', {
    playerName,
    sessionId: mySessionId,
    authToken: WizardAuth.getToken(),
    isRanked: (selectedGameMode === 'ranked')
  });
}

function doJoin() {
  clearLobbyInputErrors();

  if (!socket || !socket.connected) {
    showLobbyError('⚠️ Keine Verbindung zum Spielserver. Bitte prüfe, ob "npm start" läuft.');
    showConnectionStatus('⚠️ Keine Verbindung zum Spielserver. Bitte prüfe, ob der Server läuft.');
    return;
  }

  const playerName = nameInput ? nameInput.value.trim() : '';
  const rawRoomCode = roomInput ? roomInput.value.trim() : '';

  if (!playerName) {
    showLobbyError('Bitte gib zuerst deinen Spielernamen ein!', nameInput);
    return;
  }
  if (!rawRoomCode) {
    showLobbyError('Bitte gib den Zahlencode des Raums ein!', roomInput);
    return;
  }

  currentRoomCode = rawRoomCode.toUpperCase();
  sessionStorage.setItem('wizard_last_name', playerName);
  sessionStorage.setItem('wizard_last_room', currentRoomCode);

  if (lobbyStatusMsg) {
    lobbyStatusMsg.textContent = 'Betrete Spielraum ' + currentRoomCode + '...';
    lobbyStatusMsg.style.display = 'block';
    lobbyStatusMsg.style.color = '#fde047';
  }

  socket.emit('joinRoom', {
    playerName,
    roomCode: currentRoomCode,
    sessionId: mySessionId,
    authToken: WizardAuth.getToken()
  });
}

if (createGameBtn) createGameBtn.addEventListener('click', doCreateGame);
if (joinBtn) joinBtn.addEventListener('click', doJoin);
if (nameInput) {
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (roomInput && roomInput.value.trim()) doJoin();
      else doCreateGame();
    }
  });
}
if (roomInput) {
  roomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doJoin();
  });
}

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
      if (!btnElement.dataset.originalHtml) {
        btnElement.dataset.originalHtml = btnElement.innerHTML;
      }
      const originalHtml = btnElement.dataset.originalHtml;
      clearTimeout(btnElement._copyTimeout);

      btnElement.classList.add('copied');
      btnElement.innerHTML = btnElement.classList.contains('btn-copy-small') ? '✓' : 'Kopiert! ✓';
      btnElement._copyTimeout = setTimeout(() => {
        btnElement.classList.remove('copied');
        btnElement.innerHTML = originalHtml;
      }, 1600);
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
if (waitingRoomStartBtn) {
  waitingRoomStartBtn.addEventListener('click', () => {
    waitingRoomStartBtn.disabled = true;
    socket.emit('startGame', { roomCode: currentRoomCode });
  });
}

if (editionSelect) {
  editionSelect.addEventListener('change', (e) => {
    const selected = e.target.value;
    currentEdition = selected;
    socket.emit('setEdition', { roomCode: currentRoomCode, edition: selected });
  });
}

function updateRulesTabForEdition(edition) {
  const targetTab = (edition === 'anniversary_30') ? 'tab-rules-special' : 'tab-rules-basic';
  const tabBtn = document.querySelector(`.rules-tab-btn[data-tab="${targetTab}"]`);
  if (tabBtn) {
    document.querySelectorAll('.rules-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.rules-tab-content').forEach(c => c.classList.remove('active'));
    tabBtn.classList.add('active');
    const content = document.getElementById(targetTab);
    if (content) content.classList.add('active');
  }
}

socket.on('editionChanged', ({ edition }) => {
  currentEdition = edition;
  if (editionSelect) editionSelect.value = edition;
  if (guestEditionDisplay) {
    guestEditionDisplay.innerText = (edition === 'anniversary_30')
      ? 'Zeitalter der Bestien & Mythen'
      : 'Bund der Erzmagier (Klassisch)';
  }
  updateRulesTabForEdition(edition);
});

async function confirmAndLeaveRoom() {
  if (typeof GrimoireGameMenu !== 'undefined' && GrimoireGameMenu.close) {
    GrimoireGameMenu.close();
  }
  const confirmed = await GrimoireDialog.confirm({
    title: 'Kammer verlassen',
    message: 'Möchtest du den Spielbund wirklich verlassen und zur Zitadelle zurückkehren?',
    icon: '🚪',
    confirmText: 'Ja, verlassen',
    cancelText: 'Hierbleiben',
    danger: true
  });
  if (confirmed) {
    if (typeof GrimoireGameMenu !== 'undefined' && GrimoireGameMenu.close) {
      GrimoireGameMenu.close();
    }
    socket.emit('leaveRoom', { roomCode: currentRoomCode });
    sessionStorage.removeItem('wizard_last_room');
    currentRoomCode = '';
    currentGameState = 'lobby';
    switchScreen('lobby');
    if (pauseOverlay) pauseOverlay.style.display = 'none';
    if (gameOverModal) gameOverModal.style.display = 'none';
  }
}

if (waitingRoomLeaveBtn) waitingRoomLeaveBtn.addEventListener('click', confirmAndLeaveRoom);
if (btnLeaveGame) btnLeaveGame.addEventListener('click', confirmAndLeaveRoom);

if (resetGameBtn) {
  resetGameBtn.addEventListener('click', () => {
    socket.emit('resetGame', { roomCode: currentRoomCode });
  });
}

if (btnHostReDeal) {
  btnHostReDeal.addEventListener('click', () => {
    socket.emit('hostReDealRound', { roomCode: currentRoomCode });
  });
}

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
  showLobbyError(message);
  sessionStorage.removeItem('wizard_last_room');
  currentRoomCode = '';
  if (createGameBtn) createGameBtn.disabled = false;
  switchScreen('lobby');
});

socket.on('actionError', ({ message }) => {
  GrimoireDialog.alert({
    title: 'Aktion abgewiesen',
    message: message || 'Diese Handlung konnte nicht ausgeführt werden.',
    icon: '⚠️'
  });
  if (waitingRoomStartBtn) waitingRoomStartBtn.disabled = false;
});

// Bot-Steuerung im Warteraum
const btnAddBot = document.getElementById('btnAddBot');
const btnRemoveBot = document.getElementById('btnRemoveBot');
const botDifficultyMenu = document.getElementById('botDifficultyMenu');

if (btnAddBot) {
  btnAddBot.addEventListener('click', (e) => {
    e.stopPropagation();
    if (botDifficultyMenu) {
      const isVisible = botDifficultyMenu.style.display === 'flex';
      botDifficultyMenu.style.display = isVisible ? 'none' : 'flex';
    }
  });
}

document.querySelectorAll('.bot-diff-option').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const diff = btn.getAttribute('data-diff') || 'master';
    socket.emit('addBot', { roomCode: currentRoomCode, difficulty: diff });
    if (botDifficultyMenu) botDifficultyMenu.style.display = 'none';
  });
});

document.addEventListener('click', (e) => {
  if (botDifficultyMenu && !e.target.closest('.bot-dropdown-wrapper')) {
    botDifficultyMenu.style.display = 'none';
  }
});

if (btnRemoveBot) {
  btnRemoveBot.addEventListener('click', () => {
    socket.emit('removeBot', { roomCode: currentRoomCode });
  });
}

// Rendert den separaten Warteraum
function updateWaitingRoomView(amIHost) {
  waitingRoomCode.innerText = currentRoomCode;
  waitingRoomCount.innerText = cachedPlayers.length;
  waitingRoomPlayersList.innerHTML = '';

  const modeBadge = document.getElementById('waitingRoomModeBadge');
  if (modeBadge) {
    if (currentIsRanked) {
      modeBadge.className = 'waiting-mode-badge mode-ranked';
      modeBadge.innerHTML = '⚔️ Ranglisten-Duell (Gewertet)';
    } else {
      modeBadge.className = 'waiting-mode-badge mode-quickplay';
      modeBadge.innerHTML = '🍻 Schnellspiel (Normal)';
    }
  }

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
    let botBadge = '';
    if (p.isBot) {
      const diff = p.difficulty || 'master';
      if (diff === 'novice') {
        botBadge = '<span class="bot-badge bot-badge-novice" title="Schwierigkeitsstufe: Novize (Lehrling)">🟢 Novize</span>';
      } else if (diff === 'archmage') {
        botBadge = '<span class="bot-badge bot-badge-archmage" title="Schwierigkeitsstufe: Erzmagier (Oberster Rat)">🟣 Erzmagier</span>';
      } else {
        botBadge = '<span class="bot-badge bot-badge-master" title="Schwierigkeitsstufe: Meister (Magier)">🔵 Meister</span>';
      }
    }
    const statusText = p.isBot
      ? '<span style="color: #c084fc; font-size: 12px; font-weight: bold;">● KI-Bereit</span>'
      : (p.connected
        ? '<span style="color: #2ecc71; font-size: 12px; font-weight: bold;">● Bereit</span>'
        : '<span style="color: #e74c3c; font-size: 12px; font-weight: bold;">● Getrennt</span>');

    const initial = p.isBot ? '🤖' : (p.name ? p.name.charAt(0).toUpperCase() : '?');
    const titleHtml = p.title ? `<div style="font-size: 11px; color: #d6be90; font-style: italic;">${escapeHtml(p.title)}</div>` : '';

    let rankBadgeHtml = '';
    if (p.rank && (p.userId || p.isBot)) {
      const crestSvg = RANK_CRESTS[p.rank.tier] || '';
      rankBadgeHtml = `
        <span class="player-rank-badge" style="color: ${p.rank.color}; border-color: ${p.rank.color};" title="${escapeHtml(p.rank.divisionName)} (${p.skillRating || 0} SR)">
          <span style="display:inline-flex; width:13px; height:13px; align-items:center; justify-content:center; flex-shrink:0;">${crestSvg}</span>
          ${escapeHtml(p.rank.divisionName)}
        </span>
      `;
    }

    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="seat-avatar" style="width: 32px; height: 36px; font-size: 14px; margin: 0; box-shadow: none;">${initial}</div>
        <div>
          <div style="font-size: 15px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
            <b>${escapeHtml(p.name)}</b> ${isMe ? '<small style="color: #f1c40f;">(Du)</small>' : ''} ${hostBadge} ${botBadge}
            ${rankBadgeHtml}
          </div>
          ${titleHtml}
        </div>
      </div>
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
        ? 'Zeitalter der Bestien & Mythen'
        : 'Bund der Erzmagier (Klassisch)';
    }
  }

  // Host-Bot-Steuerung anzeigen / aktualisieren
  const hostBotControls = document.getElementById('host-bot-controls');
  if (hostBotControls) {
    hostBotControls.style.display = amIHost ? 'flex' : 'none';
    const botCount = cachedPlayers.filter(p => p.isBot).length;
    if (btnAddBot) btnAddBot.disabled = cachedPlayers.length >= 6;
    if (btnRemoveBot) btnRemoveBot.disabled = botCount === 0;
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
  if (state.isRanked !== undefined) {
    currentIsRanked = !!state.isRanked;
  }
  if (state.edition) {
    currentEdition = state.edition;
    if (editionSelect) editionSelect.value = state.edition;
    if (guestEditionDisplay) {
      guestEditionDisplay.innerText = (state.edition === 'anniversary_30')
        ? 'Zeitalter der Bestien & Mythen'
        : 'Bund der Erzmagier (Klassisch)';
    }
    updateRulesTabForEdition(state.edition);
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
    hasDealtThisRound = true;
    isDealingAnimationPending = false;
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
  hasDealtThisRound = false;

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
  const previouslyMyTurn = isMyTurn;
  currentActiveSessionId = activePlayerSessionId;
  isMyTurn = (mySessionId === activePlayerSessionId);
  currentGameState = gameState;

  // ANIMIERTES "DU BIST DRAN!" POP-UP FEEDBACK
  if (isMyTurn && (!previouslyMyTurn || gameState === 'playing_tricks' || gameState === 'bidding')) {
    triggerTurnPopup();
  }

  // SUBTILE TISCH-AURA & HANDKARTEN-FOKUS
  tableArea.classList.toggle('my-turn-aura', isMyTurn);
  myHandSection.classList.toggle('my-turn-hand-focus', isMyTurn);
  const myHud = document.getElementById('my-stats-hud');
  if (myHud) myHud.classList.toggle('my-turn-active', isMyTurn);

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
        statusMessage.innerText = '🐺 Du hast die Mondbestie! Wähle die Trumpffarbe.';
        if (trumpTitle) trumpTitle.innerText = '🐺 Du hast die Mondbestie! Wähle die Trumpffarbe:';
      } else {
        statusMessage.innerText = 'Du bist der Geber! Wähle die Trumpffarbe.';
        if (trumpTitle) trumpTitle.innerText = 'Du bist der Geber! Wähle die Trumpffarbe:';
      }
      trumpSelectionArea.style.display = 'block';
    } else {
      if (isWerewolfChooser) {
        statusMessage.innerText = `🐺 ${activePlayerName} wählt als Mondbestie die Trumpffarbe...`;
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
      statusMessage.innerText = '⚡ Schicksal des Himmelsschleiers! Du hast den Stich gewonnen und passt deine Prophezeiung um +1 oder -1 an.';
      if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'flex';
    } else {
      statusMessage.innerText = `⚡ ${activePlayerName} hat den Stich mit dem Himmelsschleier gewonnen und passt die Prophezeiung an...`;
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
    statusMessage.innerText = 'Der Taschenspieler fordert seinen Tribut! Wähle 1 Handkarte zum verdeckten Weitergeben.';
    if ((!jugglerPassModal || jugglerPassModal.style.display === 'none') && myCurrentHand.length > 0 && selectedJugglerPassCardIndex === null) {
      renderJugglerPassModal('Der Taschenspieler fordert seinen Tribut! Wähle 1 Handkarte zum verdeckten Weitergeben.');
    }
  } else if (gameState === 'witch_swap') {
    bidOverlay.style.display = 'none';
    trumpSelectionArea.style.display = 'none';
    if (shapeshifterModal) shapeshifterModal.style.display = 'none';
    if (cloudSuitModal) cloudSuitModal.style.display = 'none';
    if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
    if (jugglerModal) jugglerModal.style.display = 'none';
    if (isMyTurn) {
      statusMessage.innerText = '🔮 Ritual der Schattenhexe! Wähle 1 Handkarte und 1 Karte aus dem Stich zum Tauschen.';
    } else {
      statusMessage.innerText = `🔮 ${activePlayerName} vollzieht das Ritual der Schattenhexe mit dem Stich...`;
      if (witchModal) witchModal.style.display = 'none';
    }
  } else if (gameState === 'round_over') {
    bidOverlay.style.display = 'none';
    trumpSelectionArea.style.display = 'none';
    hideSpecialModals();
    statusMessage.innerText = 'Runde beendet!';
  }
}

// --- AUSTEIL-VERARBEITUNG & HANDKARTEN ---
socket.on('handDealt', (hand) => {
  myCurrentHand = hand;
  inspectedCardIndex = null;

  if (hasDealtThisRound) {
    // Normales Update während des Spiels (z. B. nach gespielter Karte oder Tausch)
    renderHand(false);
    return;
  }

  // Erstes Austeilen dieser Runde (nur 1x pro Runde)
  hasDealtThisRound = true;
  isDealingAnimationPending = true;
  handContainer.innerHTML = '';

  const isDrawerOpen = (scoreDrawer && scoreDrawer.classList.contains('open'));
  closeScoreDrawer();

  // Wenn das Sidepanel verschwindet: 320ms Ausblendung + 500ms Pause (halbe Sekunde nichts) = 820ms; sonst knackige 150ms
  const dealDelay = isDrawerOpen ? 820 : 150;
  setTimeout(() => {
    isDealingAnimationPending = false;
    renderHand(true);
  }, dealDelay);
});

// Trumpfwahl-Buttons (Geber)
document.querySelectorAll('#trump-selection-area .trump-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    GrimoireHaptics.impact('medium');
    const suit = btn.getAttribute('data-suit');
    socket.emit('selectTrumpSuit', { roomCode: currentRoomCode, suit });
    if (trumpSelectionArea) trumpSelectionArea.style.display = 'none';
  });
});

// Gestaltenwandler-Wahl (Zauberer oder Narr)
if (btnShapeshifterWizard) {
  btnShapeshifterWizard.addEventListener('click', () => {
    if (pendingCardPlayIndex !== null) {
      GrimoireHaptics.impact('medium');
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
      GrimoireHaptics.impact('light');
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
  btn.addEventListener('click', () => {
    const suit = btn.getAttribute('data-suit');
    if (pendingCardPlayIndex !== null && suit) {
      GrimoireHaptics.impact('light');
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

// --- 30 JAHRE JUBILÄUMSEDITION: ETAPPE 2 HANDLERS ---

// Jongleur: Farbauswahl beim Ausspielen
document.querySelectorAll('#juggler-modal .juggler-suit-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const suit = btn.getAttribute('data-suit');
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
  statusMessage.innerText = message || 'Taschenspieler! Wähle 1 Karte zum geheimen Weitergeben.';
}

socket.on('jugglerPassPrompt', (data) => {
  const message = (data && data.message) ? data.message : 'Der Taschenspieler fordert seinen Tribut! Wähle 1 Handkarte zum verdeckten Weitergeben.';
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

// Himmelsschleier: Tipp-Anpassung (+1 / -1) nach Beenden des Stichs
socket.on('cloudBidAdjustmentPrompt', ({ currentBid }) => {
  if (!cloudBidAdjustmentModal) return;
  cloudBidAdjustmentModal.style.display = 'flex';
  statusMessage.innerText = `⚡ Schicksal des Himmelsschleiers! Passe deine Prophezeiung (${currentBid}) um +1 oder -1 an.`;
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
  statusMessage.innerText = `☁️ ${escapeHtml(playerName)} muss die Vorhersage anpassen (+1 / -1)...`;
});

socket.on('cloudBidAdjusted', ({ playerName, oldBid, newBid }) => {
  if (cloudBidAdjustmentModal) cloudBidAdjustmentModal.style.display = 'none';
  showToast(`☁️ ${escapeHtml(playerName)} hat die Vorhersage von ${oldBid} auf ${newBid} geändert!`);
  statusMessage.innerText = `☁️ ${escapeHtml(playerName)} hat die Prophezeiung von ${oldBid} auf ${newBid} korrigiert!`;
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

// Schattenhexe: Tausch-Modal Steuerung nach Beenden des Stichs
socket.on('witchSwapPrompt', ({ trickCards, handCards }) => {
  renderWitchModal(trickCards, handCards || myCurrentHand);
});

socket.on('witchSwapPending', ({ playerName }) => {
  statusMessage.innerText = `🔮 ${escapeHtml(playerName)} vollzieht das Ritual der Schattenhexe mit dem Stich...`;
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
      lbl.innerText = isWitch ? `${escapeHtml(trickItem.playerName)} (Schattenhexe)` : escapeHtml(trickItem.playerName);

      const el = renderCard(trickItem.card);

      if (isWitch) {
        wrap.style.cursor = 'not-allowed';
        wrap.style.opacity = '0.4';
        wrap.title = 'Die Schattenhexe selbst kann nicht aus dem Stich genommen werden';
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

// Schattenhexe: 3.5s Showcase Overlay für alle Mitspieler zum Kartenzählen
socket.on('witchSwapShowcase', (data) => {
  const pName = (data && (data.witchPlayerName || data.playerName)) || 'Ein Magier';
  if (witchShowcaseMsg) {
    witchShowcaseMsg.innerText = `🔮 ${escapeHtml(pName)} hat ein Tauschritual mit der Schattenhexe vollzogen!`;
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
  }, (data && data.durationMs) || 1500);
});

// Mondbestie: Benachrichtigung & Animation beim Trumpftausch
socket.on('werewolfTrumpSwapped', ({ werewolfPlayerName, takenCard, newTrumpCard, trumpSuit }) => {
  if (werewolfInfoTitle) {
    werewolfInfoTitle.innerText = '🐺 Mondbestie auf der Hand!';
  }
  if (werewolfInfoDesc) {
    werewolfInfoDesc.innerText = `${escapeHtml(werewolfPlayerName)} besitzt die Mondbestie! Er nimmt die aufgedeckte Trumpfkarte auf die Hand und bestimmt selbst die neue Trumpffarbe:`;
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
  statusMessage.innerText = `🐺 ${escapeHtml(werewolfPlayerName)} wählt als Herr der Mondbestien die Trumpffarbe!`;
});

if (btnWerewolfInfoClose) {
  btnWerewolfInfoClose.addEventListener('click', () => {
    if (werewolfInfoModal) werewolfInfoModal.style.display = 'none';
  });
}

socket.on('vampireRevealedNewTrump', ({ vampirePlayerName, newTrumpCard, trumpSuit }) => {
  cachedTrumpCard = newTrumpCard;
  renderTrumpCard(newTrumpCard);
  const suitNames = { red: 'Rubin', blue: 'Saphir', green: 'Smaragd', yellow: 'Topas', none: 'Kein Trumpf' };
  const sText = suitNames[trumpSuit] || trumpSuit;
  statusMessage.innerText = `🩸 ${escapeHtml(vampirePlayerName)} hat als Blutfürst eine neue Trumpfkarte aufgedeckt! (Trumpf: ${sText})`;
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
  GrimoireDialog.alert({
    title: 'Regelverstoß',
    message: message || 'Dieser Spielzug verstößt gegen die Regeln der Zauberer.',
    icon: '⚡'
  });
  isMyTurn = true;
  renderHand();
});

socket.on('trickUpdated', (trickCards) => {
  currentTrick = trickCards;
  renderTrickCards(trickCards, true);
  renderHand();
  renderOpponents();
});

socket.on('trickWinner', ({ winnerName, winnerSessionId, isBombed, isUnicornVoided, nextLeadName }) => {
  if (isBombed) {
    GrimoireHaptics.impact('heavy');
    statusMessage.innerText = `💥 Der Magiekollaps hat den Stich neutralisiert! ${escapeHtml(nextLeadName || 'Nächster Spieler')} eröffnet den nächsten Stich.`;
  } else if (isUnicornVoided) {
    GrimoireHaptics.impact('medium');
    statusMessage.innerText = `🦄 Das Einhorn hat alle Mächte gebannt! Da keine Zahlenkarte lag, verpufft der Stich. ${escapeHtml(nextLeadName || 'Nächster Spieler')} eröffnet den nächsten Stich.`;
  } else {
    statusMessage.innerText = `${escapeHtml(winnerName)} gewinnt den Stich!`;
    if (winnerSessionId === mySessionId) {
      GrimoireHaptics.notification('success');
    } else {
      GrimoireHaptics.impact('light');
    }
  }

  const isMe = (winnerSessionId === mySessionId);
  const trickItems = document.querySelectorAll('#trick-container .trick-card-item');

  // 1. Zuerst strahlendes Sieger-Highlight ("Wolke") auf den Stichkarten (480ms)
  trickItems.forEach(item => item.classList.add('trick-winner-highlight'));

  // 2. Danach zielgerichteter 3D-Vektor-Einzug zum Gewinner-Avatar
  setTimeout(() => {
    if (isBombed) {
      GrimoireFX.triggerBombShockwave();
      trickItems.forEach(item => {
        item.classList.remove('trick-winner-highlight');
        item.classList.add('trick-clearing');
      });
    } else if (isUnicornVoided) {
      GrimoireFX.triggerUnicornRing();
      trickItems.forEach(item => {
        item.classList.remove('trick-winner-highlight');
        item.classList.add('trick-clearing');
      });
    } else {
      let targetEl = null;
      if (isMe) {
        targetEl = document.getElementById('my-hud-bid') || document.getElementById('my-stats-hud') || document.getElementById('my-hand-section');
      } else {
        targetEl = (winnerSessionId ? document.getElementById('seat-' + winnerSessionId) : null) ||
                   document.querySelector(`.player-seat[data-session-id="${winnerSessionId}"]`) ||
                   document.querySelector(`.player-seat[data-player-name="${winnerName}"]`) ||
                   document.querySelector('.player-seat');
      }

      const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (targetEl && !prefersReducedMotion && targetEl.getBoundingClientRect) {
        const targetRect = targetEl.getBoundingClientRect();
        const tx = targetRect.left + targetRect.width / 2;
        const ty = targetRect.top + targetRect.height / 2;

        trickItems.forEach((wrap, i) => {
          wrap.classList.remove('trick-winner-highlight');
          const cRect = wrap.getBoundingClientRect();
          const cx = cRect.left + cRect.width / 2;
          const cy = cRect.top + cRect.height / 2;
          const dx = tx - cx;
          const dy = ty - cy;
          const stagger = i * 25;

          setTimeout(() => {
            wrap.style.transition = 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease-in';
            wrap.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0px) scale(0.15) rotate(${15 + (i * 8)}deg)`;
            wrap.style.opacity = '0';
            wrap.style.pointerEvents = 'none';
          }, stagger);
        });

        setTimeout(() => {
          if (targetEl) {
            targetEl.classList.remove('winner-avatar-pulse');
            void targetEl.offsetWidth; // force reflow
            targetEl.classList.add('winner-avatar-pulse');
            setTimeout(() => targetEl.classList.remove('winner-avatar-pulse'), 550);
          }
        }, 320);
      } else {
        // Fallback: richtungsabhängig oder sofort
        trickItems.forEach(item => {
          item.classList.remove('trick-winner-highlight');
          if (isMe) {
            item.classList.add('trick-clearing-me');
          } else {
            item.classList.add('trick-clearing-opponent');
          }
        });
      }
    }

    setTimeout(() => {
      trickContainer.innerHTML = '';
      trickContainer.classList.remove('round-1-trick');
    }, 380);
  }, 480);
});

socket.on('roundFinished', ({ isGameOver, scoreHistory, round, isRanked, rankedResults }) => {
  if (isRanked !== undefined) {
    currentIsRanked = !!isRanked;
  }
  if (rankedResults) {
    cachedRankedResults = Array.isArray(rankedResults) ? rankedResults : Object.values(rankedResults);
  }
  currentTrick = [];
  trickContainer.innerHTML = '';
  handContainer.innerHTML = '';
  isDealingAnimationPending = true;
  hasDealtThisRound = false;
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
  hasDealtThisRound = false;
  isDealingAnimationPending = true;

  renderTrumpCard(trumpCard);
  renderOpponents();
  renderScoreBoard();
});

socket.on('gameResetToLobby', async ({ message, players, roomCode }) => {
  await GrimoireDialog.alert({
    title: 'Runde beendet',
    message: message || 'Die Versammlung wurde aufgelöst. Zurück zur Zitadelle!',
    icon: '🏛️'
  });
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
  hasDealtThisRound = false;
  isDealingAnimationPending = false;
  if (players) cachedPlayers = players;

  switchScreen('waiting');
  const amIHost = cachedPlayers.some(p => p.sessionId === mySessionId && p.isHost);
  updateWaitingRoomView(amIHost);
});

// --- VIRTUELLE MITSPIELER-SITZE RENDERN (RELATIVE UHRZEIGER-REIHENFOLGE) ---
function renderOpponents() {
  opponentsContainer.innerHTML = '';
  opponentsContainer.classList.toggle('round-1-opponents', currentRound === 1);
  const myIndex = cachedPlayers.findIndex(p => p.sessionId === mySessionId);
  let opponents = [];
  if (myIndex !== -1 && cachedPlayers.length > 1) {
    for (let i = 1; i < cachedPlayers.length; i++) {
      const nextIdx = (myIndex + i) % cachedPlayers.length;
      opponents.push(cachedPlayers[nextIdx]);
    }
  } else {
    opponents = cachedPlayers.filter(p => p.sessionId !== mySessionId);
  }

  opponents.forEach(p => {
    const isHisTurn = (p.sessionId === currentActiveSessionId);
    const seatEl = document.createElement('div');
    seatEl.classList.add('player-seat');
    seatEl.id = `seat-${p.sessionId}`;
    seatEl.setAttribute('data-session-id', p.sessionId);
    seatEl.setAttribute('data-player-name', p.name);
    if (isHisTurn) seatEl.classList.add('seat-active-turn');

    const initial = p.name ? p.name.charAt(0).toUpperCase() : '?';
    const disconnectedClass = !p.connected ? 'disconnected' : '';
    const hostBadge = p.isHost ? '<span class="host-badge">Host</span>' : '';
    const dealerPinHtml = p.isDealer ? '<div class="seat-dealer-pin" title="Geber dieser Runde">D</div>' : '';

    const bidText = p.bid !== null ? p.bid : '-';
    const wonText = p.tricksWon !== undefined ? p.tricksWon : 0;

    let foreheadCardHtml = '';
    if (currentRound === 1 && p.round1Card) {
      const cardEl = renderCard(p.round1Card);
      foreheadCardHtml = `
        <div class="forehead-floating-card" title="Stirnkarte von ${escapeHtml(p.name)}">
          ${cardEl.outerHTML}
        </div>
      `;
    }

    let rankBadgeHtml = '';
    if (p.rank && (p.userId || p.isBot)) {
      rankBadgeHtml = `
        <span class="player-rank-badge player-rank-badge-table" style="color: ${p.rank.color}; border-color: ${p.rank.color};" title="${escapeHtml(p.rank.divisionName)} (${p.skillRating || 0} SR)">
          ${escapeHtml(p.rank.divisionName)}
        </span>
      `;
    }

    let botDiffHtml = '';
    if (p.isBot) {
      const diff = p.difficulty || 'master';
      const label = diff === 'novice' ? 'Novize' : (diff === 'archmage' ? 'Erzmagier' : 'Meister');
      botDiffHtml = `<span class="seat-bot-pill bot-pill-${diff}">${label}</span>`;
    }

    const bidPillHtml = `<span class="seat-bid-pill" title="Gebot: ${bidText} | Gewonnen: ${wonText}">🎯 ${bidText}/${wonText}</span>`;

    seatEl.innerHTML = `
      ${foreheadCardHtml}
      <div class="seat-avatar ${disconnectedClass}">
        ${initial}
        ${dealerPinHtml}
      </div>
      <div class="seat-details">
        <div class="seat-name-row">
          <span class="seat-name">${escapeHtml(p.name)}</span>
          ${hostBadge}${botDiffHtml}${rankBadgeHtml}
        </div>
        ${bidPillHtml}
      </div>
    `;

    // Interaktives Magier-Profil Modal beim Klick auf den Sitz
    seatEl.style.cursor = 'pointer';
    seatEl.setAttribute('title', `${escapeHtml(p.name)} – Klicken für Profil & Details`);
    seatEl.addEventListener('click', () => {
      if (typeof openPlayerDetailModal === 'function') {
        openPlayerDetailModal(p, 'table');
      }
    });

    opponentsContainer.appendChild(seatEl);
  });
}

function updateMyStatsHUD() {
  const me = cachedPlayers.find(p => p.sessionId === mySessionId);
  const bidEl = document.getElementById('my-hud-bid');
  const tricksEl = document.getElementById('my-hud-tricks');
  const hudContainer = document.getElementById('my-stats-hud');

  const bidVal = (me && me.bid !== null && me.bid !== undefined) ? me.bid : '-';
  const tricksVal = (me && me.tricksWon !== undefined) ? me.tricksWon : 0;

  if (bidEl) bidEl.innerText = bidVal;
  if (tricksEl) tricksEl.innerText = tricksVal;

  if (hudContainer && !hudContainer.dataset.detailBound) {
    hudContainer.dataset.detailBound = 'true';
    hudContainer.style.cursor = 'pointer';
    hudContainer.setAttribute('title', 'Klicken für dein Magier-Profil & Rundenstatistiken');
    hudContainer.addEventListener('click', () => {
      const currentMe = cachedPlayers.find(p => p.sessionId === mySessionId);
      if (currentMe && typeof openPlayerDetailModal === 'function') {
        openPlayerDetailModal(currentMe, 'table');
      }
    });
  }
}

// --- AAA FLIP 3D-KARTENFLUGBAHN, RICHTUNGSWINKEL & AUFPRALL-EFFEKTE ---
function renderTrickCards(trickCards, animateLast = true) {
  trickContainer.innerHTML = '';
  trickContainer.classList.toggle('round-1-trick', currentRound === 1);

  trickCards.forEach((item, idx) => {
    const isLastCard = (idx === trickCards.length - 1);
    const wrap = document.createElement('div');
    wrap.classList.add('trick-card-item');
    wrap.style.textAlign = 'center';

    // Vollwertige 3D-Karte (vollständig sichtbar, unbedeckt oben)
    const cardWrapper = document.createElement('div');
    cardWrapper.classList.add('card-3d-wrapper');

    const frontFace = renderCard(item.card);
    frontFace.classList.add('card-3d-face', 'card-3d-front');
    cardWrapper.appendChild(frontFace);

    const rot = ((idx % 4) - 1.5) * 4;
    cardWrapper.style.setProperty('--rand-rot', `${rot}deg`);

    wrap.title = `Gespielt von ${item.playerName}`;
    wrap.appendChild(cardWrapper);
    trickContainer.appendChild(wrap);

    if (animateLast && isLastCard) {
      const strong = isStrongCard(item.card);
      const isMe = (item.playerSessionId === mySessionId);
      const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let startRect = null;
      if (isMe && lastPlayedCardOrigin && (Date.now() - (lastPlayedCardOrigin.timestamp || 0) < 5000)) {
        startRect = lastPlayedCardOrigin;
        lastPlayedCardOrigin = null;
      } else if (isMe) {
        const handEl = document.getElementById('hand-container') || document.getElementById('my-hand-section');
        if (handEl && handEl.getBoundingClientRect) startRect = handEl.getBoundingClientRect();
      } else {
        const seatEl = (item.playerSessionId ? document.getElementById('seat-' + item.playerSessionId) : null) ||
                       document.querySelector(`.player-seat[data-session-id="${item.playerSessionId}"]`) ||
                       document.querySelector(`.player-seat[data-player-name="${item.playerName}"]`);
        if (seatEl && seatEl.getBoundingClientRect) startRect = seatEl.getBoundingClientRect();
      }

      const endRect = (cardWrapper.getBoundingClientRect) ? cardWrapper.getBoundingClientRect() : null;

      if (startRect && endRect && endRect.width > 0 && !prefersReducedMotion) {
        // FLIP-MATHEMATIK (First, Last, Invert, Play)
        const dx = (startRect.left + startRect.width / 2) - (endRect.left + endRect.width / 2);
        const dy = (startRect.top + startRect.height / 2) - (endRect.top + endRect.height / 2);
        const scaleFactor = Math.max(0.55, Math.min(1.25, startRect.width / endRect.width));

        // Zentrifugaler Neigungswinkel basierend auf Hand-Ursprung
        const screenMidX = window.innerWidth / 2;
        const originMidX = startRect.left + startRect.width / 2;
        const tilt = Math.max(-10, Math.min(10, ((originMidX - screenMidX) / Math.max(screenMidX, 1)) * 8));

        // 1. INVERT (sofort synchron am Startpunkt platzieren mit Z-Elevation)
        cardWrapper.style.transition = 'none';
        cardWrapper.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 60px) scale(${scaleFactor.toFixed(2)}) rotate(${tilt.toFixed(1)}deg)`;
        cardWrapper.style.boxShadow = '0 24px 38px rgba(0,0,0,0.65), 0 0 16px rgba(240, 195, 85, 0.45)';
        cardWrapper.style.zIndex = '100';

        // 2. PLAY (im nächsten Frame flüssig mit AAA Bezier auf den Tisch fliegen)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            cardWrapper.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s ease-out';
            cardWrapper.style.transform = `translate3d(0, 0, 0) scale(1) rotate(${rot}deg)`;
            cardWrapper.style.boxShadow = '';

            setTimeout(() => {
              cardWrapper.style.zIndex = '';
              cardWrapper.style.transition = '';
              if (strong) {
                createDustCloudEffect(wrap);
              }
              GrimoireFX.triggerSpecialCardEffect(item.card, wrap);
            }, 280);
          });
        });
      } else {
        // Fallback für reduzierte Bewegung oder fehlende Koordinaten
        if (strong) {
          cardWrapper.classList.add('card-slam-heavy');
          createDustCloudEffect(wrap);
        } else {
          cardWrapper.classList.add('card-played-animated');
        }
        GrimoireFX.triggerSpecialCardEffect(item.card, wrap);
      }

      WizardAudio.playForCard(item.card);
    } else {
      cardWrapper.style.transform = `rotate(${rot}deg)`;
    }
  });
}

// --- TRUMPFKARTE RENDERN (KOMPAKTER TALISMAN-DOCK) ---
function renderTrumpCard(trumpCard) {
  trumpContainer.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';

  const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };

  if (!trumpCard) {
    const emptyCard = document.createElement('div');
    emptyCard.classList.add('card', 'trump-card-compact');
    emptyCard.style.background = 'rgba(24, 14, 8, 0.7)';
    emptyCard.style.borderColor = '#5a371c';
    emptyCard.innerHTML = '<span style="font-size: 16px; color: var(--gold-antique); font-family: var(--font-medieval);">-</span>';

    const subText = document.createElement('div');
    subText.style.fontStyle = 'italic';
    subText.style.fontSize = '9px';
    subText.style.color = '#d6be90';
    subText.style.marginTop = '2px';
    subText.style.fontFamily = 'var(--font-subheading)';
    subText.innerText = 'Kein Trumpf';

    wrap.appendChild(emptyCard);
    wrap.appendChild(subText);
    wrap.title = 'Kein Trumpf in dieser Runde';
    trumpContainer.appendChild(wrap);
    return;
  }

  const el = renderCard(trumpCard);
  el.classList.add('trump-card-compact');
  wrap.appendChild(el);

  const subText = document.createElement('div');
  subText.style.fontWeight = 'bold';
  subText.style.fontSize = '9.5px';
  subText.style.marginTop = '2px';
  subText.style.fontFamily = 'var(--font-subheading)';
  subText.style.whiteSpace = 'nowrap';

  if (trumpCard.type === 'werewolf_trump_pending') {
    subText.style.color = '#f59e0b';
    subText.innerText = 'Werwolf wählt...';
  } else if (trumpCard.type === 'werewolf_trump') {
    const sName = suitNames[trumpCard.chosenSuit || trumpCard.suit] || 'Unbekannt';
    subText.style.color = 'var(--gold-bright)';
    subText.innerText = `Werwolf: ${sName}`;
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
    subText.innerText = `${suitNames[trumpCard.suit] || trumpCard.suit} ${trumpCard.value || ''}`;
  }

  wrap.title = `Aufgedeckter Trumpf: ${subText.innerText}`;
  wrap.addEventListener('click', () => {
    showToast(`Aufgedeckter Trumpf: ${subText.innerText}`);
    if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.impact('light');
  });

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
      btn.style.background = '#334155';
      btn.style.opacity = '0.35';
      btn.style.cursor = 'not-allowed';
      btn.title = 'Diese Zahl ist für den Geber verboten!';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        GrimoireHaptics.notification('error');
        showToast('🛑 Geber-Gesetz: Die Gesamtsumme darf die Stichzahl nicht treffen!');
      });
    } else {
      btn.addEventListener('click', () => {
        GrimoireHaptics.impact('light');
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
  if (['wizard', 'jester', 'dragon', 'fairy', 'bomb', 'shapeshifter', 'cloud', 'vampire', 'werewolf', 'witch', 'juggler', 'unicorn'].includes(cardToPlay.type)) {
    return true;
  }
  if (!trick || trick.length === 0) {
    return true;
  }
  let leadSuit = 'none';
  for (let i = 0; i < trick.length; i++) {
    const trickCard = trick[i].card;
    const effCard = getEffectiveCard(trickCard);
    if (effCard.type === 'wizard' || effCard.type === 'dragon' || effCard.type === 'unicorn' || effCard.type === 'bomb') break;
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
  if (isDealingAnimationPending && !isNewDeal) {
    return;
  }
  handContainer.innerHTML = '';

  const total = myCurrentHand.length;
  const mid = (total - 1) / 2;
  const isMobile = window.innerWidth <= 768;
  const isSwipeable = isMobile && total >= 8;

  let dynamicMargin = '3px';
  if (isSwipeable) {
    dynamicMargin = '4px';
  } else if (total > 5) {
    if (total <= 8) dynamicMargin = '-8px';
    else if (total <= 12) dynamicMargin = '-18px';
    else if (total <= 16) dynamicMargin = '-26px';
    else dynamicMargin = '-34px';
  }

  if (isSwipeable) {
    handContainer.classList.add('swipeable');
  } else {
    handContainer.classList.remove('swipeable');
  }

  myCurrentHand.forEach((card, index) => {
    const cardElement = renderCard(card);
    const isPlayingPhase = (currentGameState === 'playing_tricks');
    const playable = isMyTurn && isPlayingPhase && isCardPlayable(card, myCurrentHand, currentTrick);

    const angle = 0;
    const offsetY = 0;

    cardElement.style.marginLeft = (index === 0) ? '0px' : dynamicMargin;
    cardElement.style.marginRight = isSwipeable ? '4px' : '0px';
    cardElement.style.zIndex = index + 1;

    if (inspectedCardIndex === index) {
      cardElement.classList.add('card-inspected');
    }

    cardElement.style.setProperty('--target-y', `${offsetY}px`);
    cardElement.style.setProperty('--target-rot', `${angle}deg`);

    if (isNewDeal) {
      cardElement.classList.add('card-fly-up');
      const total = myCurrentHand.length;
      const staggerMs = Math.min(35, Math.max(16, Math.floor(260 / Math.max(total, 1))));
      cardElement.style.animationDelay = `${index * staggerMs}ms`;
      setTimeout(() => {
        cardElement.classList.remove('card-fly-up');
        if (inspectedCardIndex !== index) {
          cardElement.style.transform = `translateY(${offsetY}px) rotate(${angle}deg)`;
        }
      }, index * staggerMs + 280);
      setTimeout(() => {
        if (staggerMs >= 24 || index % 2 === 0) {
          WizardAudio.playCardDeal();
        }
      }, index * staggerMs);
    } else if (inspectedCardIndex !== index) {
      cardElement.style.transform = `translateY(${offsetY}px) rotate(${angle}deg)`;
    }

    if (playable) {
      cardElement.classList.add('card-playable');
      cardElement.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isMyTurn || currentGameState !== 'playing_tricks') return;

        const isTouchDevice = ('ontouchstart' in window) && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

        if (isTouchDevice && inspectedCardIndex !== index) {
          inspectedCardIndex = index;
          GrimoireHaptics.selection();
          renderHand();
        } else {
          if (cardElement && cardElement.getBoundingClientRect) {
            const r = cardElement.getBoundingClientRect();
            lastPlayedCardOrigin = {
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height,
              timestamp: Date.now()
            };
          }

          if (card.type === 'bomb') {
            GrimoireHaptics.impact('heavy');
          } else if (card.type === 'wizard' || card.type === 'dragon') {
            GrimoireHaptics.impact('medium');
          } else {
            GrimoireHaptics.impact('light');
          }

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

      if (isMyTurn && isPlayingPhase) {
        cardElement.style.filter = 'brightness(0.35)';
        cardElement.style.opacity = '0.45';
      } else {
        cardElement.style.filter = 'brightness(1)';
        cardElement.style.opacity = '1';
      }

      cardElement.addEventListener('click', (e) => {
        const isTouchDevice = ('ontouchstart' in window) && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        if (isTouchDevice && inspectedCardIndex !== index) {
          e.stopPropagation();
          inspectedCardIndex = index;
          GrimoireHaptics.selection();
          renderHand();
        }
      });
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

// (Heraldische Wappen & Rang-Icons wurden nach oben vor den Spielzustand verlegt)

// Karten-Renderer (Old Medieval Fantasy Style)
const CARD_ARTWORK_FILES = {
  wizard: ['archmage_1.png', 'archmage.png', 'archmage.svg', 'wizard.png'],
  jester: ['charlatan_1.png', 'charlatan.png', 'charlatan.svg', 'jester.png'],
  unicorn: ['unicorn.png', 'unicorn.svg', 'horned_beast.png', 'horned_beast.svg'],
  dragon: ['lindwurm.png', 'lindwurm.svg', 'wyrm.png', 'wyrm.svg', 'dragon.png'],
  fairy: ['waldnymphe.png', 'waldnymphe.svg', 'sylph.png', 'sylph.svg', 'fairy.png'],
  bomb: ['magiekollaps.png', 'magiekollaps.svg', 'collapse.png', 'collapse.svg', 'bomb.png'],
  shapeshifter: ['doppelganger.png', 'doppelganger.svg', 'metamorph.png', 'metamorph.svg', 'shapeshifter.png'],
  vampire: ['bloodlord.png', 'bloodlord.svg', 'vampire.png', 'vampire.svg'],
  cloud: ['himmelsschleier.png', 'himmelsschleier.svg', 'cloud.png', 'cloud.svg'],
  werewolf: ['moonbeast.png', 'moonbeast.svg', 'lycanthrope.png', 'lycanthrope.svg', 'werewolf.png'],
  werewolf_trump: ['moonbeast.png', 'moonbeast.svg', 'lycanthrope.png', 'lycanthrope.svg', 'werewolf.png'],
  werewolf_trump_pending: ['moonbeast.png', 'moonbeast.svg', 'lycanthrope.png', 'lycanthrope.svg', 'werewolf.png'],
  witch: ['shadowwitch.png', 'shadowwitch.svg', 'witch.png', 'witch.svg', 'oracle.png'],
  juggler: ['trickster.png', 'trickster.svg', 'gaukler.png', 'gaukler.svg', 'juggler.png']
};

function getCardArtworkFiles(card) {
  if (!card) return [];
  if (card.type === 'wizard') {
    const v = card.variant || 1;
    const candidates = [
      `archmage_${v}.png`,
      `archmage_${v}.webp`,
      `wizard_${v}.png`,
      `wizard_${v}.webp`
    ];
    if (card.variantSuit) {
      candidates.push(`archmage_${card.variantSuit}.png`, `wizard_${card.variantSuit}.png`);
    }
    candidates.push('archmage.png', 'archmage.webp', 'wizard.png', 'archmage.svg');
    return candidates;
  }
  if (card.type === 'jester') {
    const v = card.variant || 1;
    const candidates = [
      `charlatan_${v}.png`,
      `charlatan_${v}.webp`,
      `jester_${v}.png`,
      `jester_${v}.webp`
    ];
    if (card.variantSuit) {
      candidates.push(`charlatan_${card.variantSuit}.png`, `jester_${card.variantSuit}.png`);
    }
    candidates.push('charlatan.png', 'charlatan.webp', 'jester.png', 'charlatan.svg');
    return candidates;
  }
  return CARD_ARTWORK_FILES[card.type] || [];
}

// Karten-Renderer (Old Medieval Fantasy Style mit 1050 × 1498 px Artwork-Support)
function renderCard(card) {
  const div = document.createElement('div');
  div.classList.add('card');

  // Prüfe, ob für diese Spezialkarte ein Artwork vorhanden ist
  const artFiles = getCardArtworkFiles(card);
  if (artFiles && artFiles.length > 0 && !card.isBlind && card.type !== 'blind_card') {
    div.classList.add('card-has-artwork');
    const artImg = document.createElement('img');
    artImg.className = 'card-art-img';
    artImg.alt = card.type;
    let fileIdx = 0;
    artImg.src = `/images/cards/${artFiles[fileIdx]}`;
    artImg.setAttribute('data-candidates', JSON.stringify(artFiles));
    artImg.setAttribute('data-idx', '0');
    artImg.setAttribute('onerror', `
      try {
        var alts = JSON.parse(this.getAttribute('data-candidates') || '[]');
        var idx = parseInt(this.getAttribute('data-idx') || '0', 10) + 1;
        if (idx < alts.length) {
          this.setAttribute('data-idx', idx);
          this.src = '/images/cards/' + alts[idx];
        } else {
          var p = this.closest('.card');
          if (p) p.classList.remove('card-has-artwork');
          this.remove();
        }
      } catch(e) { this.remove(); }
    `);
    artImg.onerror = function() {
      fileIdx++;
      if (fileIdx < artFiles.length) {
        this.src = `/images/cards/${artFiles[fileIdx]}`;
      } else {
        this.remove();
        div.classList.remove('card-has-artwork');
      }
    };
    div.appendChild(artImg);
  }

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
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">E</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.wizard}</div>
        <div class="card-center-val" style="font-size: 26px; color: #fef08a; margin-top: 2px;">E</div>
        <div class="card-name-label"><em>Erzmagier</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">E</span>
      </div>
    `;
  } else if (card.type === 'jester') {
    div.classList.add('card-jester');
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">S</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.jester}</div>
        <div class="card-center-val" style="font-size: 26px; color: #f8fafc; margin-top: 2px;">S</div>
        <div class="card-name-label"><em>Scharlatan</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">S</span>
      </div>
    `;
  } else if (card.type === 'dragon') {
    div.classList.add('card-dragon');
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">L</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.dragon}</div>
        <div class="card-center-val" style="font-size: 26px; color: #fef08a; margin-top: 2px;">L</div>
        <div class="card-name-label"><em>Lindwurm</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">L</span>
      </div>
    `;
  } else if (card.type === 'fairy') {
    div.classList.add('card-fairy');
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">F</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.fairy}</div>
        <div class="card-center-val" style="font-size: 26px; color: #e0f2fe; margin-top: 2px;">F</div>
        <div class="card-name-label"><em>Waldnymphe</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">F</span>
      </div>
    `;
  } else if (card.type === 'bomb') {
    div.classList.add('card-bomb');
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">K</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.bomb}</div>
        <div class="card-center-val" style="font-size: 26px; color: #fdba74; margin-top: 2px;">K</div>
        <div class="card-name-label"><em>Magiekollaps</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">K</span>
      </div>
    `;
  } else if (card.type === 'unicorn') {
    div.classList.add('card-unicorn');
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">H</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.unicorn}</div>
        <div class="card-center-val" style="font-size: 26px; color: #e0e7ff; margin-top: 2px;">H</div>
        <div class="card-name-label"><em>Einhorn</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">H</span>
      </div>
    `;
  } else if (card.type === 'shapeshifter') {
    div.classList.add('card-shapeshifter');
    const roleSub = card.chosenRole === 'wizard' ? ' (E)' : (card.chosenRole === 'jester' ? ' (S)' : '');
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">D</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.shapeshifter}</div>
        <div class="card-center-val" style="font-size: 24px; color: #a7f3d0; margin-top: 2px;">D${roleSub}</div>
        <div class="card-name-label"><em>Doppelgänger</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">D</span>
      </div>
    `;
  } else if (card.type === 'vampire') {
    div.classList.add('card-vampire');
    let copyLabel = '';
    if (card.copiedCard) {
      if (card.copiedCard.type === 'wizard') copyLabel = '<div style="font-size: 8.5px; color: #fef08a; margin-top: 1px;">Kopie: Erzmagier</div>';
      else if (card.copiedCard.type === 'jester') copyLabel = '<div style="font-size: 8.5px; color: #cbd5e1; margin-top: 1px;">Kopie: Scharlatan</div>';
      else if (card.copiedCard.type === 'dragon') copyLabel = '<div style="font-size: 8.5px; color: #fef08a; margin-top: 1px;">Kopie: Lindwurm</div>';
      else if (card.copiedCard.type === 'fairy') copyLabel = '<div style="font-size: 8.5px; color: #bae6fd; margin-top: 1px;">Kopie: Waldnymphe</div>';
      else if (card.copiedCard.type === 'bomb') copyLabel = '<div style="font-size: 8.5px; color: #fdba74; margin-top: 1px;">Kopie: Magiekollaps</div>';
      else if (card.copiedCard.type === 'unicorn') copyLabel = '<div style="font-size: 8.5px; color: #f0abfc; margin-top: 1px;">Kopie: Einhorn</div>';
      else if (card.copiedCard.type === 'werewolf' || card.copiedCard.type === 'werewolf_trump' || card.copiedCard.type === 'werewolf_trump_pending') {
        const cSuit = card.copiedCard.chosenSuit ? ` (${card.copiedCard.chosenSuit})` : '';
        copyLabel = `<div style="font-size: 8.5px; color: #f59e0b; margin-top: 1px;">Kopie: Mondbestie${cSuit}</div>`;
      }
      else if (card.copiedCard.type === 'witch') copyLabel = '<div style="font-size: 8.5px; color: #c084fc; margin-top: 1px;">Kopie: Schattenhexe</div>';
      else if (card.copiedCard.type === 'juggler') copyLabel = '<div style="font-size: 8.5px; color: #67e8f9; margin-top: 1px;">Kopie: Taschenspieler</div>';
      else if (card.copiedCard.type === 'color') {
        const suitNames = { red: 'Rubin', blue: 'Saphir', green: 'Smaragd', yellow: 'Topas' };
        const sName = suitNames[card.copiedCard.suit] || card.copiedCard.suit;
        const valStr = card.copiedCard.value ? ` ${card.copiedCard.value}` : '';
        copyLabel = `<div style="font-size: 8.5px; color: #fca5a5; margin-top: 1px;">Kopie: ${sName}${valStr}</div>`;
      }
    }
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">B</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.vampire}</div>
        <div class="card-center-val" style="font-size: 24px; color: #fca5a5; margin-top: 1px;">B</div>
        <div class="card-name-label"><em>Blutfürst</em></div>
        ${copyLabel}
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">B</span>
      </div>
    `;
  } else if (card.type === 'cloud') {
    div.classList.add('card-cloud');
    const suitNames = { red: 'Rubin', blue: 'Saphir', green: 'Smaragd', yellow: 'Topas' };
    const suitSub = card.chosenSuit ? `<div style="font-size: 8.5px; color: #93c5fd; margin-top: 1px;">${suitNames[card.chosenSuit] || card.chosenSuit}</div>` : '';
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val" style="font-size: 13px;">9¾</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.cloud}</div>
        <div class="card-center-val" style="font-size: 20px; color: #f1f5f9; margin-top: 1px;">9 ¾</div>
        <div class="card-name-label"><em>Himmelsschleier</em></div>
        ${suitSub}
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val" style="font-size: 13px;">9¾</span>
      </div>
    `;
  } else if (card.type === 'werewolf' || card.type === 'werewolf_trump_pending') {
    div.classList.add('card-werewolf');
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">M</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.werewolf}</div>
        <div class="card-center-val" style="font-size: 24px; color: #f59e0b; margin-top: 2px;">M</div>
        <div class="card-name-label"><em>Mondbestie</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">M</span>
      </div>
    `;
  } else if (card.type === 'werewolf_trump') {
    div.classList.add('card-werewolf', 'card-werewolf-trump');
    const chosenSuit = card.chosenSuit || card.suit || 'red';
    div.classList.add(`card-werewolf-trump-${chosenSuit}`);
    const suitNames = { red: 'Rubin', blue: 'Saphir', green: 'Smaragd', yellow: 'Topas' };
    const suitName = suitNames[chosenSuit] || chosenSuit;
    const suitIcon = MEDIEVAL_ICONS[chosenSuit] || '';
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">M</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest" style="display: flex; gap: 3px; align-items: center; justify-content: center;">
          <div style="width: 20px; height: 20px;">${MEDIEVAL_ICONS.werewolf}</div>
          <div style="width: 18px; height: 18px;">${suitIcon}</div>
        </div>
        <div class="card-center-val" style="font-size: 20px; color: #fde047; margin-top: 1px;">M</div>
        <div class="card-name-label"><em>Mondbestien-Trumpf: ${suitName}</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">M</span>
      </div>
    `;
  } else if (card.type === 'witch') {
    div.classList.add('card-witch');
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">X</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.witch}</div>
        <div class="card-center-val" style="font-size: 24px; color: #c084fc; margin-top: 2px;">X</div>
        <div class="card-name-label"><em>Schattenhexe</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">X</span>
      </div>
    `;
  } else if (card.type === 'juggler') {
    div.classList.add('card-juggler');
    const suitNames = { red: 'Rubin', blue: 'Saphir', green: 'Smaragd', yellow: 'Topas' };
    const suitSub = card.chosenSuit ? `<div style="font-size: 8.5px; color: #67e8f9; margin-top: 1px;">${suitNames[card.chosenSuit] || card.chosenSuit}</div>` : '';
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val" style="font-size: 13px;">7½</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.juggler}</div>
        <div class="card-center-val" style="font-size: 20px; color: #67e8f9; margin-top: 1px;">7 ½</div>
        <div class="card-name-label"><em>Taschenspieler</em></div>
        ${suitSub}
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val" style="font-size: 13px;">7½</span>
      </div>
    `;
  } else {
    div.classList.add(`card-${card.suit}`);
    const iconSvg = MEDIEVAL_ICONS[card.suit] || '';
    const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
    const sName = suitNames[card.suit] || card.suit;
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">${card.value}</span>
      </div>
      <div class="card-center">
        <div class="card-center-val">${card.value}</div>
        <div class="card-center-crest">${iconSvg}</div>
        <div class="card-name-label"><em>${sName} ${card.value}</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">${card.value}</span>
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

  // RANKED OVERWATCH PROGRESSION DISPLAY
  const rankedBox = document.getElementById('ranked-gameover-container');
  const resultsList = Array.isArray(cachedRankedResults)
    ? cachedRankedResults
    : (cachedRankedResults ? Object.values(cachedRankedResults) : []);

  if (rankedBox) {
    if (currentIsRanked && resultsList.length > 0) {
      const myResult = resultsList.find(r => r.sessionId === mySessionId);
      const nr = myResult ? (myResult.newRank || myResult.rank) : null;
      if (myResult && nr) {
        const delta = myResult.deltaSR !== undefined ? myResult.deltaSR : (myResult.delta || 0);
        const deltaSign = delta >= 0 ? `+${delta}` : `${delta}`;
        const deltaClass = delta >= 0 ? 'sr-delta-positive' : 'sr-delta-negative';
        const tierKey = nr.tier || nr.tierKey || 'novice';
        const crestSvg = RANK_CRESTS[tierKey] || '';
        const divName = nr.divisionName || nr.label || 'Rang';
        const tierColor = nr.color || '#fde047';
        const progPct = nr.progressPercent !== undefined ? nr.progressPercent : (nr.progressPct || 0);

        rankedBox.style.display = 'block';
        rankedBox.innerHTML = `
          <div class="ranked-results-box">
            <div class="ranked-tier-showcase">
              <div class="ranked-big-crest">${crestSvg}</div>
              <div>
                <div class="ranked-tier-name" style="color: ${tierColor};">${escapeHtml(divName)}</div>
                <div style="font-size: 13px; color: #ebd7af;">
                  ${myResult.oldSR} SR ➔ <b style="color: #fff; font-size: 15px;">${myResult.newSR} SR</b>
                  <span class="sr-delta-badge ${deltaClass}">${deltaSign} SR</span>
                </div>
              </div>
            </div>
            <div class="sr-progress-track">
              <div class="sr-progress-fill" style="width: ${progPct}%; background: ${tierColor};"></div>
            </div>
            <div style="font-size: 11px; color: #d6be90; font-family: var(--font-subheading); letter-spacing: 0.5px;">
              ${progPct}% Divisions-Fortschritt
            </div>
          </div>
        `;
      } else {
        rankedBox.style.display = 'none';
      }
    } else {
      rankedBox.style.display = 'none';
    }
  }

  podiumList.innerHTML = '';
  sorted.forEach((p, idx) => {
    const row = document.createElement('div');
    row.style.padding = '10px 14px';
    row.style.margin = '6px 0';
    row.style.borderRadius = '8px';
    row.style.background = idx === 0 ? 'rgba(241, 196, 15, 0.25)' : 'rgba(255, 255, 255, 0.05)';
    row.style.border = idx === 0 ? '1px solid #f1c40f' : '1px solid #7f8c8d';

    let rankedDeltaHtml = '';
    if (currentIsRanked && resultsList.length > 0) {
      const pRes = resultsList.find(r => r.sessionId === p.sessionId);
      if (pRes) {
        const d = pRes.deltaSR !== undefined ? pRes.deltaSR : (pRes.delta || 0);
        const sign = d >= 0 ? `+${d}` : `${d}`;
        const cls = d >= 0 ? 'sr-delta-positive' : 'sr-delta-negative';
        rankedDeltaHtml = ` <span class="sr-delta-badge ${cls}" style="font-size: 11px; padding: 1px 6px;">${sign} SR</span>`;
      }
    }

    row.innerHTML = `<b>${idx + 1}. ${escapeHtml(p.name)}</b>: ${p.totalScore || 0} Punkte${rankedDeltaHtml}`;
    podiumList.appendChild(row);
  });

  if (resetGameBtn) {
    resetGameBtn.style.display = amIHost ? 'block' : 'none';
  }

  // Profil-Statistiken im Hintergrund aktualisieren (neue Siege/Niederlagen/Punkte sofort wirksam)
  if (typeof WizardAuth !== 'undefined' && WizardAuth.refreshUser) {
    WizardAuth.refreshUser();
  }

  gameOverModal.style.display = 'flex';
}

// Socket Events für Ranked-System
socket.on('rankedResults', (results) => {
  cachedRankedResults = results;
});

socket.on('rankedPenaltyNotice', ({ penaltyAmount, newSR, rank, notice }) => {
  const modal = document.getElementById('penalty-notice-modal');
  const descEl = document.getElementById('penaltyNoticeText');
  const srEl = document.getElementById('penaltyNewSR');
  if (modal) {
    if (descEl && notice) descEl.innerText = notice;
    if (srEl) srEl.innerText = `Neues Rating: ${newSR} SR (${rank ? rank.divisionName : 'Unplatziert'})`;
    modal.style.display = 'flex';
  }
});

const btnPenaltyNoticeAck = document.getElementById('btnPenaltyNoticeAck');
if (btnPenaltyNoticeAck) {
  btnPenaltyNoticeAck.addEventListener('click', () => {
    const modal = document.getElementById('penalty-notice-modal');
    if (modal) modal.style.display = 'none';
  });
}
const penaltyNoticeModal = document.getElementById('penalty-notice-modal');
if (penaltyNoticeModal) {
  penaltyNoticeModal.addEventListener('click', (e) => {
    if (e.target === penaltyNoticeModal) penaltyNoticeModal.style.display = 'none';
  });
}

// --- AUDIO- & SOUND-EINSTELLUNGEN UI CONTROLLER ---
function setupAudioSettingsUI() {
  const modal = document.getElementById('audio-settings-modal');
  const btnClose = document.getElementById('btnAudioClose');
  const btnSaveClose = document.getElementById('btnAudioSaveClose');

  const masterSlider = document.getElementById('masterVolSlider');
  const sfxSlider = document.getElementById('sfxVolSlider');
  const musicSlider = document.getElementById('musicVolSlider');

  const masterLabel = document.getElementById('masterVolLabel');
  const sfxLabel = document.getElementById('sfxVolLabel');
  const musicLabel = document.getElementById('musicVolLabel');

  const sfxMute = document.getElementById('sfxMuteToggle');
  const musicMute = document.getElementById('musicMuteToggle');

  const btnTestCard = document.getElementById('btnTestCardSound');
  const btnToggleMusic = document.getElementById('btnToggleMusicPlayback');
  const musicStatus = document.getElementById('musicPlayingStatus');

  function openAudioModal() {
    const s = WizardAudio.getSettings();
    if (masterSlider) masterSlider.value = Math.round(s.master * 100);
    if (sfxSlider) sfxSlider.value = Math.round(s.sfx * 100);
    if (musicSlider) musicSlider.value = Math.round(s.music * 100);

    if (masterLabel) masterLabel.innerText = `${Math.round(s.master * 100)}%`;
    if (sfxLabel) sfxLabel.innerText = `${Math.round(s.sfx * 100)}%`;
    if (musicLabel) musicLabel.innerText = `${Math.round(s.music * 100)}%`;

    if (sfxMute) sfxMute.checked = !!s.sfxMuted;
    if (musicMute) musicMute.checked = !!s.musicMuted;

    updateMusicUI();
    if (modal) modal.style.display = 'flex';
  }

  function closeAudioModal() {
    if (modal) modal.style.display = 'none';
  }

  function updateMusicUI() {
    if (!musicStatus || !btnToggleMusic) return;
    const isPlaying = WizardAudio.isMusicPlaying();
    if (isPlaying) {
      musicStatus.innerText = `Aktiv: ${WizardAudio.getCurrentTrackTitle()}`;
      musicStatus.style.color = '#86efac';
      btnToggleMusic.innerText = '⏸ Pause';
    } else {
      musicStatus.innerText = 'Pausiert';
      musicStatus.style.color = '#cbd5e1';
      btnToggleMusic.innerText = '▶ Abspielen';
    }
  }

  // Toggles auf den Screens
  ['audio-settings-toggle', 'lobby-audio-toggle', 'waiting-audio-toggle'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', openAudioModal);
  });

  if (btnClose) btnClose.addEventListener('click', closeAudioModal);
  if (btnSaveClose) btnSaveClose.addEventListener('click', closeAudioModal);

  if (masterSlider) {
    masterSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      WizardAudio.setMasterVolume(val);
      if (masterLabel) masterLabel.innerText = `${e.target.value}%`;
    });
  }

  if (sfxSlider) {
    sfxSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      WizardAudio.setSfxVolume(val);
      if (sfxLabel) sfxLabel.innerText = `${e.target.value}%`;
    });
  }

  if (musicSlider) {
    musicSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      WizardAudio.setMusicVolume(val);
      if (musicLabel) musicLabel.innerText = `${e.target.value}%`;
    });
  }

  if (sfxMute) {
    sfxMute.addEventListener('change', (e) => {
      WizardAudio.setSfxMuted(e.target.checked);
    });
  }

  if (musicMute) {
    musicMute.addEventListener('change', (e) => {
      WizardAudio.setMusicMuted(e.target.checked);
      updateMusicUI();
    });
  }

  if (btnTestCard) {
    btnTestCard.addEventListener('click', () => {
      WizardAudio.playCardSnap();
    });
  }

  if (btnToggleMusic) {
    btnToggleMusic.addEventListener('click', () => {
      WizardAudio.toggleMusic();
      updateMusicUI();
    });
  }

  const btnSkipMusic = document.getElementById('btnSkipMusicTrack');
  if (btnSkipMusic) {
    btnSkipMusic.addEventListener('click', () => {
      WizardAudio.skipNextTrack();
      updateMusicUI();
    });
  }
}

// --- RESIZABLE SEITENPANELS (BUCH DER WAHRHEIT & REGELWERK GRÖSSER ZIEHEN) ---
function setupResizableDrawers() {
  const handles = document.querySelectorAll('.drawer-resize-handle');
  handles.forEach(handle => {
    const drawerId = handle.getAttribute('data-drawer');
    const drawer = document.getElementById(drawerId);
    if (!drawer) return;

    let isResizing = false;

    function onPointerDown(e) {
      e.preventDefault();
      isResizing = true;
      handle.classList.add('resizing');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';

      function onPointerMove(moveEvent) {
        if (!isResizing) return;
        const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const newWidth = Math.max(340, Math.min(window.innerWidth * 0.94, window.innerWidth - clientX));
        drawer.style.width = `${newWidth}px`;
        drawer.style.maxWidth = '96vw';
      }

      function onPointerUp() {
        if (!isResizing) return;
        isResizing = false;
        handle.classList.remove('resizing');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);
      }

      window.addEventListener('mousemove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);
    }

    handle.addEventListener('mousedown', onPointerDown);
    handle.addEventListener('touchstart', onPointerDown, { passive: false });
  });
}

// --- ZENTRALES INGAME-MENÜ & EINSTELLUNGEN (CITADEL GAME MENU) ---
const GrimoireGameMenu = {
  modal: null,

  init() {
    this.modal = document.getElementById('game-menu-modal');

    const openBtn = document.getElementById('btnOpenGameMenu');
    const closeBtn = document.getElementById('btnCloseGameMenu');
    const audioBtn = document.getElementById('btnMenuAudioSettings');
    const rulesBtn = document.getElementById('btnMenuRules');
    const companionsBtn = document.getElementById('btnMenuCompanions');
    const serverBtn = document.getElementById('btnMenuServerSettings');
    const pill = document.getElementById('displayRoomCodePill');

    if (openBtn && !openBtn._hasGameMenuListener) {
      openBtn._hasGameMenuListener = true;
      openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    }

    if (closeBtn && !closeBtn._hasGameMenuListener) {
      closeBtn._hasGameMenuListener = true;
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
      });
    }

    if (this.modal && !this.modal._hasGameMenuListener) {
      this.modal._hasGameMenuListener = true;
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });
    }

    // Escape-Taste zum Schließen des Zitadellen-Menüs
    if (typeof document !== 'undefined' && !document._hasGameMenuEscListener) {
      document._hasGameMenuEscListener = true;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modal && this.modal.style.display !== 'none') {
          this.close();
        }
      });
    }

    if (audioBtn && !audioBtn._hasGameMenuListener) {
      audioBtn._hasGameMenuListener = true;
      audioBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
        const lobbyAudio = document.getElementById('lobby-audio-toggle');
        const audioSettingsToggle = document.getElementById('audio-settings-toggle');
        if (audioSettingsToggle) {
          audioSettingsToggle.click();
        } else if (lobbyAudio) {
          lobbyAudio.click();
        }
      });
    }

    if (rulesBtn && !rulesBtn._hasGameMenuListener) {
      rulesBtn._hasGameMenuListener = true;
      rulesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
        if (typeof openRulesDrawer === 'function') {
          openRulesDrawer();
        }
      });
    }

    if (companionsBtn && !companionsBtn._hasGameMenuListener) {
      companionsBtn._hasGameMenuListener = true;
      companionsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
        if (typeof CompanionsManager !== 'undefined' && CompanionsManager.open) {
          CompanionsManager.open();
        }
      });
    }

    if (serverBtn && !serverBtn._hasGameMenuListener) {
      serverBtn._hasGameMenuListener = true;
      serverBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
        if (typeof GrimoireServerSettings !== 'undefined' && GrimoireServerSettings.openModal) {
          GrimoireServerSettings.openModal();
        }
      });
    }

    // Antippen des Ratssiegel-Pills kopiert den Code sofort in die Zwischenablage
    if (pill && !pill._hasPillListener) {
      pill._hasPillListener = true;
      pill.addEventListener('click', () => {
        if (!currentRoomCode || currentRoomCode === '-') return;
        const copyText = currentRoomCode;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(copyText).then(() => {
            showToast(`Ratssiegel ${copyText} kopiert! ✨`);
            if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.impact('light');
          }).catch(() => {
            fallbackCopyPill(copyText);
          });
        } else {
          fallbackCopyPill(copyText);
        }
      });
    }

    function fallbackCopyPill(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showToast(`Ratssiegel ${text} kopiert! ✨`);
        if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.impact('light');
      } catch (err) {}
      document.body.removeChild(ta);
    }
  },

  open() {
    if (!this.modal) this.modal = document.getElementById('game-menu-modal');
    if (this.modal) {
      this.modal.style.display = 'flex';
      if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.impact('light');
    }
  },

  close() {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }
};

if (typeof window !== 'undefined') {
  window.GrimoireGameMenu = GrimoireGameMenu;
}

// Initialer Zustand: Haupt-Lobby, Audio-Bindings, Auth & Drawer-Resizing einrichten
setupAudioSettingsUI();
setupResizableDrawers();
GrimoireDialog.init();
GrimoireServerSettings.init();
GrimoireGameMenu.init();
WizardAuth.init();
CompanionsManager.init();
switchScreen('lobby');