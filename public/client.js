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
const btnOpenHostSettings = document.getElementById('btnOpenHostSettings');
const hostSettingsModal = document.getElementById('host-settings-modal');
const btnCloseHostSettings = document.getElementById('btnCloseHostSettings');
const btnCancelHostSettings = document.getElementById('btnCancelHostSettings');
const btnSaveHostSettings = document.getElementById('btnSaveHostSettings');
const modalEditionSelect = document.getElementById('modalEditionSelect');
const modalFormatSelect = document.getElementById('modalFormatSelect');
const modalScoringSelect = document.getElementById('modalScoringSelect');
const modalBiddingSelect = document.getElementById('modalBiddingSelect');
const hostSettingsBtnIcon = document.getElementById('hostSettingsBtnIcon');
const hostSettingsBtnText = document.getElementById('hostSettingsBtnText');
const hostSettingsModalIcon = document.getElementById('hostSettingsModalIcon');
const hostSettingsModalTitleText = document.getElementById('hostSettingsModalTitleText');
const hostSettingsGuestNotice = document.getElementById('hostSettingsGuestNotice');
const simultaneousRevealOverlay = document.getElementById('simultaneous-reveal-overlay');
const revealCountdownNumber = document.getElementById('reveal-countdown-number');
const revealSubtitle = document.getElementById('reveal-subtitle');
const biddingSummaryPill = document.getElementById('bidding-summary-pill');
const badgeSettingEdition = document.getElementById('badge-setting-edition');
const badgeSettingFormat = document.getElementById('badge-setting-format');
const badgeSettingScoring = document.getElementById('badge-setting-scoring');
const badgeSettingBidding = document.getElementById('badge-setting-bidding');

function updateRoomSettingsBadges(edition, format, scoring, bidding) {
  if (badgeSettingEdition) {
    badgeSettingEdition.innerText = (edition === 'anniversary_30') ? '🐉 Bestien & Mythen' : '📜 Klassisch';
  }
  if (badgeSettingFormat) {
    badgeSettingFormat.innerText = (format === 'team_2v2') ? '🔥🌙 2vs2 Allianzen' : '⚔️ Jeder gegen Jeden';
  }
  if (badgeSettingScoring) {
    badgeSettingScoring.innerText = (scoring === 'skull_king_zero') ? '☠️ Schattenfluch-Nullwertung' : '🎯 Klassische Wertung';
  }
  if (badgeSettingBidding) {
    if (bidding === 'simultaneous') {
      badgeSettingBidding.innerText = '🎲 Simultan-Prophezeiung';
    } else if (bidding === 'secret') {
      badgeSettingBidding.innerText = '🤫 Geheimes Bieten';
    } else {
      badgeSettingBidding.innerText = '📜 Reihum-Bieten';
    }
  }
}

function updateWaitingRoomHostControls() {
  const amIHost = cachedPlayers.some(p => p.sessionId === mySessionId && p.isHost);
  if (btnOpenHostSettings) {
    btnOpenHostSettings.style.display = 'block';
    if (hostSettingsBtnIcon) {
      hostSettingsBtnIcon.innerText = amIHost ? '⚙️' : '📜';
    }
    if (hostSettingsBtnText) {
      hostSettingsBtnText.innerText = amIHost
        ? 'Raum-Einstellungen & Hausregeln anpassen'
        : 'Raum-Einstellungen ansehen';
    }
    btnOpenHostSettings.setAttribute('title', amIHost
      ? 'Spielregeln, Edition, Format, Wertung & Bieten als Spielleiter anpassen'
      : 'Aktuelle Raum-Einstellungen und Hausregeln ansehen');
  }
}

const roomSettingsSummaryBar = document.getElementById('room-settings-summary-bar');
if (roomSettingsSummaryBar) {
  roomSettingsSummaryBar.addEventListener('click', () => {
    if (btnOpenHostSettings) {
      btnOpenHostSettings.click();
    }
  });
}

if (btnOpenHostSettings) {
  btnOpenHostSettings.addEventListener('click', () => {
    const amIHost = cachedPlayers.some(p => p.sessionId === mySessionId && p.isHost);

    if (modalEditionSelect) modalEditionSelect.value = currentEdition || 'classic';
    if (modalFormatSelect) modalFormatSelect.value = currentMatchFormat || 'ffa';
    if (modalScoringSelect) modalScoringSelect.value = currentScoringMode || 'classic';
    if (modalBiddingSelect) modalBiddingSelect.value = currentBiddingMode || 'classic';

    // Nur der Host darf die Werte anpassen und speichern
    const isEditable = amIHost;
    if (modalEditionSelect) modalEditionSelect.disabled = !isEditable;
    if (modalFormatSelect) modalFormatSelect.disabled = !isEditable;
    if (modalScoringSelect) modalScoringSelect.disabled = !isEditable;
    if (modalBiddingSelect) modalBiddingSelect.disabled = !isEditable;

    if (hostSettingsGuestNotice) {
      hostSettingsGuestNotice.style.display = isEditable ? 'none' : 'block';
    }
    if (hostSettingsModalIcon) {
      hostSettingsModalIcon.innerText = isEditable ? '⚙️' : '📜';
    }
    if (hostSettingsModalTitleText) {
      hostSettingsModalTitleText.innerText = isEditable
        ? 'Raum-Einstellungen & Hausregeln'
        : 'Aktuelle Raum-Einstellungen';
    }
    if (btnSaveHostSettings) {
      btnSaveHostSettings.style.display = isEditable ? 'inline-flex' : 'none';
    }
    if (btnCancelHostSettings) {
      btnCancelHostSettings.innerText = isEditable ? 'Abbrechen' : 'Schließen';
    }

    const modal = hostSettingsModal || document.getElementById('host-settings-modal');
    if (modal) modal.style.display = 'block';
  });
}

function closeHostSettingsModal() {
  const modal = hostSettingsModal || document.getElementById('host-settings-modal');
  if (modal) modal.style.display = 'none';
}
const closeHostSettingsBtn = btnCloseHostSettings || document.getElementById('btnCloseHostSettings');
const cancelHostSettingsBtn = btnCancelHostSettings || document.getElementById('btnCancelHostSettings');
if (closeHostSettingsBtn) closeHostSettingsBtn.addEventListener('click', closeHostSettingsModal);
if (cancelHostSettingsBtn) cancelHostSettingsBtn.addEventListener('click', closeHostSettingsModal);

if (btnSaveHostSettings) {
  btnSaveHostSettings.addEventListener('click', () => {
    const newEdition = modalEditionSelect ? modalEditionSelect.value : 'classic';
    const newFormat = modalFormatSelect ? modalFormatSelect.value : 'ffa';
    const newScoring = modalScoringSelect ? modalScoringSelect.value : 'classic';
    const newBidding = modalBiddingSelect ? modalBiddingSelect.value : 'classic';

    socket.emit('updateRoomSettings', {
      roomCode: currentRoomCode,
      edition: newEdition,
      matchFormat: newFormat,
      scoringMode: newScoring,
      biddingMode: newBidding
    });
    closeHostSettingsModal();
  });
}

const editionSelect = document.getElementById('editionSelect');
const hostFormatControls = document.getElementById('host-format-controls');
const guestFormatDisplay = document.getElementById('guest-format-display');
const btnFormatFFA = document.getElementById('btnFormatFFA');
const btnFormat2v2 = document.getElementById('btnFormat2v2');
const waitingRoomTeamsContainer = document.getElementById('waitingRoomTeamsContainer');
const btnRandomizeTeams = document.getElementById('btnRandomizeTeams');
const teamContainerNeutral = document.getElementById('teamContainerNeutral');
const teamContainerA = document.getElementById('teamContainerA');
const teamContainerB = document.getElementById('teamContainerB');
const teamContainerC = document.getElementById('teamContainerC');
const teamPlayersListNeutral = document.getElementById('teamPlayersListNeutral');
const teamPlayersListA = document.getElementById('teamPlayersListA');
const teamPlayersListB = document.getElementById('teamPlayersListB');
const teamPlayersListC = document.getElementById('teamPlayersListC');
const teamCountNeutral = document.getElementById('teamCountNeutral');
const teamCountA = document.getElementById('teamCountA');
const teamCountB = document.getElementById('teamCountB');
const teamCountC = document.getElementById('teamCountC');
const badgeTeamNeutral = document.getElementById('badgeTeamNeutral');
const badgeTeamA = document.getElementById('badgeTeamA');
const badgeTeamB = document.getElementById('badgeTeamB');
const badgeTeamC = document.getElementById('badgeTeamC');
const btnJoinTeamA = document.getElementById('btnJoinTeamA');
const btnJoinTeamB = document.getElementById('btnJoinTeamB');

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
const btnClaimGlory = document.getElementById('btnClaimGlory');
const btnGameOverStay = document.getElementById('btnGameOverStay');
const btnGameOverClose = document.getElementById('btnGameOverClose');
const btnReopenGameOver = document.getElementById('btnReopenGameOver');

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
let currentMatchFormat = 'ffa';
let currentScoringMode = 'classic';
let currentBiddingMode = 'classic';
let currentTeams = {
  team_a: { name: 'Allianz des Sonnenfeuers', score: 0 },
  team_b: { name: 'Allianz der Mondschatten', score: 0 }
};
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
  let musicCompressor = null;
  let wasPlayingBeforeHide = false;
  let isAppInBackground = false;

  // Lade gespeicherte Audioeinstellungen oder Defaults
  let settings = {
    master: 0.8,
    sfx: 0.9,
    music: 0.5,
    sfxMuted: false,
    musicMuted: false,
    turnSoundEnabled: true
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

        // Sanfter DynamicsCompressorNode zur Abfederung von Dynamikspitzen und Pegelangleichung
        if (typeof ctx.createDynamicsCompressor === 'function') {
          try {
            musicCompressor = ctx.createDynamicsCompressor();
            const t = ctx.currentTime || 0;
            if (musicCompressor.threshold && typeof musicCompressor.threshold.setValueAtTime === 'function') {
              musicCompressor.threshold.setValueAtTime(-24, t);
            }
            if (musicCompressor.knee && typeof musicCompressor.knee.setValueAtTime === 'function') {
              musicCompressor.knee.setValueAtTime(20, t);
            }
            if (musicCompressor.ratio && typeof musicCompressor.ratio.setValueAtTime === 'function') {
              musicCompressor.ratio.setValueAtTime(6, t);
            }
            if (musicCompressor.attack && typeof musicCompressor.attack.setValueAtTime === 'function') {
              musicCompressor.attack.setValueAtTime(0.005, t);
            }
            if (musicCompressor.release && typeof musicCompressor.release.setValueAtTime === 'function') {
              musicCompressor.release.setValueAtTime(0.150, t);
            }
            musicGain.connect(musicCompressor);
            musicCompressor.connect(masterGain);
          } catch (e) {
            musicGain.connect(masterGain);
          }
        } else {
          musicGain.connect(masterGain);
        }

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
    const currentTrack = (typeof MUSIC_PLAYLIST !== 'undefined' && MUSIC_PLAYLIST && MUSIC_PLAYLIST[currentTrackIdx]) ? MUSIC_PLAYLIST[currentTrackIdx] : null;
    const trackGain = (currentTrack && typeof currentTrack.gainFactor === 'number') ? currentTrack.gainFactor : 1.0;

    if (ctx) {
      const t = ctx.currentTime;
      if (masterGain && masterGain.gain && typeof masterGain.gain.setValueAtTime === 'function') {
        masterGain.gain.setValueAtTime(settings.master, t);
      }
      if (sfxGain && sfxGain.gain && typeof sfxGain.gain.setValueAtTime === 'function') {
        sfxGain.gain.setValueAtTime(settings.sfxMuted ? 0 : settings.sfx, t);
      }
      if (musicGain && musicGain.gain && typeof musicGain.gain.setValueAtTime === 'function') {
        const effectiveMusic = (settings.musicMuted ? 0 : settings.music) * trackGain;
        musicGain.gain.setValueAtTime(effectiveMusic, t);
      }
    }
    if (musicAudio && !musicSourceNode) {
      const effective = (settings.musicMuted || settings.master <= 0) ? 0 : (settings.music * settings.master * trackGain);
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

  // --- ZUG-HINWEISTON (AUTHENTISCHER BRONZEGONG AM ZUG) ---
  function playTurnChime() {
    if (isAppInBackground || settings.turnSoundEnabled === false || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
    const c = getContext();
    if (!c) return;
    try {
      loadBuffer('/audio/gong.ogg').then(buf => {
        if (buf && !isAppInBackground) {
          playBufferNode(buf, 0.85, 0.0);
        }
      }).catch(() => {
        // Fallback Synthesizer falls Audio-Sample nicht lädt
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(164, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(t);
        osc.stop(t + 1.2);
      });
    } catch (e) {
      console.warn('Audio playTurnChime error:', e);
    }
  }

  // --- HINTERGRUNDMUSIK-ENGINE (DEDIZIERTE RPG-TAVERNEN-SUITE: CITADEL NIGHT) ---
  const MUSIC_PLAYLIST = [
    { title: 'Nacht in der Zitadelle (Harfen-Meditation)', url: '/audio/citadel_night_suite.mp3', gainFactor: 1.0 }
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

  function playTick() {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 + Math.random() * 150, c.currentTime);
      gain.gain.setValueAtTime(0.08 * settings.sfx * settings.master, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.04);
    } catch (e) {}
  }

  function playLevelUp() {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, c.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.2 * settings.sfx * settings.master, c.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + idx * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(c.currentTime + idx * 0.12);
        osc.stop(c.currentTime + idx * 0.12 + 0.45);
      });
      playInviteChime();
    } catch (e) {}
  }

  function playMvpGong() {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
      loadBuffer('/audio/gong.ogg').then(buf => {
        if (buf && !isAppInBackground) playBufferNode(buf, 0.9, 0.0);
      }).catch(() => {
        playTurnChime();
      });
    } catch (e) {
      playTurnChime();
    }
  }

  function playChestUnlock() {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
      const now = c.currentTime;
      const vol = settings.sfx * settings.master;

      // Klick 1: Schlossriegel schnappt auf
      const osc1 = c.createOscillator();
      const gain1 = c.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1400, now);
      osc1.frequency.exponentialRampToValueAtTime(320, now + 0.045);
      gain1.gain.setValueAtTime(0.35 * vol, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc1.connect(gain1);
      gain1.connect(c.destination);
      osc1.start(now);
      osc1.stop(now + 0.055);

      // Klick 2: Mechanischer Bügelanschlag
      const osc2 = c.createOscillator();
      const gain2 = c.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(980, now + 0.065);
      osc2.frequency.exponentialRampToValueAtTime(180, now + 0.14);
      gain2.gain.setValueAtTime(0.38 * vol, now + 0.065);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc2.connect(gain2);
      gain2.connect(c.destination);
      osc2.start(now + 0.065);
      osc2.stop(now + 0.16);
    } catch (e) {}
  }

  function playLidPop() {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
      const now = c.currentTime;
      const vol = settings.sfx * settings.master;

      // Weißes Rauschen mit Bandpass-Sweep für Hydraulik-/Dampfzischen
      const bufferSize = Math.floor(c.sampleRate * 0.28);
      const noiseBuffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = c.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.12);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.28);
      filter.Q.setValueAtTime(2.5, now);

      const gain = c.createGain();
      gain.gain.setValueAtTime(0.28 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.29);
    } catch (e) {}
  }

  function playCometLaunch() {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
      const now = c.currentTime;
      const vol = settings.sfx * settings.master;

      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.45);
      gain.gain.setValueAtTime(0.22 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.52);
    } catch (e) {}
  }

  function playImpact(rarity) {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
      const now = c.currentTime;
      const vol = settings.sfx * settings.master;

      // 1. Satter Bass-Punch (Sub-Bass Sweep 90Hz -> 32Hz)
      const bassOsc = c.createOscillator();
      const bassGain = c.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(90, now);
      bassOsc.frequency.exponentialRampToValueAtTime(32, now + 0.22);
      bassGain.gain.setValueAtTime(0.42 * vol, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      bassOsc.connect(bassGain);
      bassGain.connect(c.destination);
      bassOsc.start(now);
      bassOsc.stop(now + 0.26);

      // 2. Kristallklang je nach Seltenheit
      const chordMap = {
        common: [523.25],
        rare: [523.25, 659.25],
        epic: [523.25, 659.25, 783.99],
        legendary: [523.25, 659.25, 783.99, 1046.5, 1318.51]
      };
      const freqs = chordMap[(rarity || 'common').toLowerCase()] || chordMap.common;
      freqs.forEach((freq, idx) => {
        const chimeOsc = c.createOscillator();
        const chimeGain = c.createGain();
        chimeOsc.type = 'triangle';
        const tStart = now + idx * 0.035;
        chimeOsc.frequency.setValueAtTime(freq, tStart);
        chimeGain.gain.setValueAtTime(0.24 * vol, tStart);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, tStart + 0.45);
        chimeOsc.connect(chimeGain);
        chimeGain.connect(c.destination);
        chimeOsc.start(tStart);
        chimeOsc.stop(tStart + 0.48);
      });
    } catch (e) {}
  }

  function playChestRumble() {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
      playCardSnap();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(48, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(115, c.currentTime + 0.6);
      gain.gain.setValueAtTime(0.25 * settings.sfx * settings.master, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.65);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.65);
    } catch (e) {}
  }

  function playChestBurst() {
    if (isAppInBackground) return;
    try {
      const c = getContext();
      if (!c || settings.sfxMuted || settings.sfx <= 0 || settings.master <= 0) return;
      playMvpGong();
      const notes = [440, 554.37, 659.25, 880, 1108.73];
      notes.forEach((freq, idx) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, c.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.25 * settings.sfx * settings.master, c.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + idx * 0.08 + 0.5);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(c.currentTime + idx * 0.08);
        osc.stop(c.currentTime + idx * 0.08 + 0.55);
      });
    } catch (e) {}
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
    playTurnChime,
    playInviteChime,
    playTick,
    playLevelUp,
    playMvpGong,
    playChestUnlock,
    playLidPop,
    playCometLaunch,
    playImpact,
    playChestRumble,
    playChestBurst,
    startMusic,
    stopMusic,
    toggleMusic,
    skipNextTrack: () => {
      playNextTrack();
    },
    getCurrentTrackTitle: () => MUSIC_PLAYLIST[currentTrackIdx].title,
    getCurrentTrackGainFactor: () => {
      const t = MUSIC_PLAYLIST[currentTrackIdx];
      return (t && typeof t.gainFactor === 'number') ? t.gainFactor : 1.0;
    },
    getPlaylist: () => MUSIC_PLAYLIST.map(track => ({ ...track })),
    getCompressorNode: () => musicCompressor,
    isMusicPlaying: () => isMusicPlaying || !!(musicAudio && !musicAudio.paused && !settings.musicMuted && settings.music > 0),
    getSettings: () => ({ ...settings }),
    setTurnSoundEnabled: (enabled) => {
      settings.turnSoundEnabled = !!enabled;
      saveSettings();
    },
    isTurnSoundEnabled: () => settings.turnSoundEnabled !== false,
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

// --- MULTI-LAYER STORAGE ENGINE (MEMORY + LOCALSTORAGE + SESSIONSTORAGE + INDEXEDDB) ---
const GrimoireStorage = (() => {
  const DB_NAME = 'GrimoireVault';
  const DB_VERSION = 1;
  const STORE_NAME = 'auth';

  function openDB() {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return resolve(null);
      }
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function get(key) {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function set(key, val) {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(val, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  async function remove(key) {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  return { get, set, remove };
})();

// --- WIZARD AUTH & PROFIL-MODUL ---
const WizardAuth = (() => {
  let currentUser = null;
  let inMemoryToken = null;
  let selectedRegisterAvatar = 'wizard_blue';
  let activeAuthTab = 'login';

  function getToken() {
    if (inMemoryToken) return inMemoryToken;
    try {
      const fromLocal = localStorage.getItem('wizard_auth_token');
      if (fromLocal) {
        inMemoryToken = fromLocal;
        return fromLocal;
      }
      const fromSession = sessionStorage.getItem('wizard_auth_token');
      if (fromSession) {
        inMemoryToken = fromSession;
        try { localStorage.setItem('wizard_auth_token', fromSession); } catch (e) {}
        return fromSession;
      }
    } catch (e) {}
    return null;
  }

  function setToken(token) {
    inMemoryToken = token || null;
    try {
      if (token) {
        localStorage.setItem('wizard_auth_token', token);
        sessionStorage.setItem('wizard_auth_token', token);
        GrimoireStorage.set('token', token).catch(() => {});
      } else {
        localStorage.removeItem('wizard_auth_token');
        sessionStorage.removeItem('wizard_auth_token');
        GrimoireStorage.remove('token').catch(() => {});
      }
    } catch (e) {}
  }

  function getCachedUser() {
    try {
      const raw = localStorage.getItem('wizard_cached_user') || sessionStorage.getItem('wizard_cached_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function updatePhoenixVault(user, additionalData = {}) {
    if (!user || !user.username) return;
    try {
      const existingRaw = localStorage.getItem('grimoire_phoenix_vault') || sessionStorage.getItem('grimoire_phoenix_vault');
      const existing = existingRaw ? JSON.parse(existingRaw) : {};

      const vData = (typeof WizardVault !== 'undefined' && WizardVault.getVaultData) ? WizardVault.getVaultData() : null;
      const inv = additionalData.inventory || (vData && vData.inventory) || existing.inventory || [];

      const vault = {
        username: user.username,
        recoveryKey: existing.recoveryKey || user.recoveryKey || ('key_' + Math.random().toString(36).slice(2) + Date.now()),
        accountLevel: Math.max(existing.accountLevel || 1, user.account_level || 1),
        currentXp: Math.max(existing.currentXp || 0, user.account_xp || 0),
        astralDust: Math.max(existing.astralDust || 0, user.astral_dust || 0),
        chestsWooden: user.chests_wooden !== undefined ? user.chests_wooden : (existing.chestsWooden !== undefined ? existing.chestsWooden : 1),
        chestsSilver: user.chests_silver !== undefined ? user.chests_silver : (existing.chestsSilver || 0),
        chestsGold: user.chests_gold !== undefined ? user.chests_gold : (existing.chestsGold || 0),
        avatarId: user.avatar_id || existing.avatarId || 'default',
        title: user.title || existing.title || 'Novize der Akademie',
        inventory: Array.isArray(inv) ? inv : [],
        equipped: {
          equipped_card_back: user.equipped_card_back || existing.equipped?.equipped_card_back || 'default',
          equipped_table_skin: user.equipped_table_skin || existing.equipped?.equipped_table_skin || 'emerald_felt',
          equipped_avatar_frame: user.equipped_avatar_frame || existing.equipped?.equipped_avatar_frame || 'none',
          equipped_lobby_background: user.equipped_lobby_background || existing.equipped?.equipped_lobby_background || 'citadel_halls',
          ...(additionalData.equipped || {})
        },
        savedAt: new Date().toISOString()
      };

      const jsonStr = JSON.stringify(vault);
      localStorage.setItem('grimoire_phoenix_vault', jsonStr);
      sessionStorage.setItem('grimoire_phoenix_vault', jsonStr);
      if (typeof GrimoireStorage !== 'undefined') {
        GrimoireStorage.set('phoenix_vault', vault).catch(() => {});
      }
    } catch (e) {
      console.warn('Fehler beim Speichern des Phoenix Vaults:', e);
    }
  }

  function getPhoenixVault() {
    try {
      const raw = localStorage.getItem('grimoire_phoenix_vault') || sessionStorage.getItem('grimoire_phoenix_vault');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  async function tryPhoenixRestore() {
    if (localStorage.getItem('grimoire_explicit_logout') === 'true') {
      return null;
    }
    let vault = getPhoenixVault();
    if (!vault && typeof GrimoireStorage !== 'undefined') {
      try {
        vault = await GrimoireStorage.get('phoenix_vault');
      } catch (e) {}
    }
    if (!vault || !vault.username) return null;

    try {
      console.log(`[PhoenixClient] Aktiviere Magische Re-Synchronisation für "${vault.username}"...`);
      const resp = await fetch(getApiUrl('/api/auth/phoenix-restore'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vault)
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data.success && data.user && data.token) {
        setToken(data.token);
        currentUser = data.user;
        setCachedUser(currentUser);
        localStorage.removeItem('grimoire_explicit_logout');

        if (socket) {
          socket.auth = { token: data.token };
          if (socket.connected) {
            socket.emit('authIdentify', { token: data.token });
          }
        }
        if (nameInput) {
          nameInput.value = data.user.username;
          sessionStorage.setItem('wizard_last_name', data.user.username);
        }
        renderLobbyBar();
        showToast(`⚡ Magische Re-Synchronisation: Account "${data.user.username}" (Stufe ${data.user.account_level}) nach Server-Update wiederhergestellt!`);
        return data.user;
      }
    } catch (err) {
      console.warn('[PhoenixClient] Re-Synchronisation fehlgeschlagen:', err);
    }
    return null;
  }

  function setCachedUser(user) {
    try {
      if (user) {
        const json = JSON.stringify(user);
        localStorage.setItem('wizard_cached_user', json);
        sessionStorage.setItem('wizard_cached_user', json);
        GrimoireStorage.set('user', user).catch(() => {});
        updatePhoenixVault(user);
      } else {
        localStorage.removeItem('wizard_cached_user');
        sessionStorage.removeItem('wizard_cached_user');
        GrimoireStorage.remove('user').catch(() => {});
      }
    } catch (e) {}
  }

  async function checkSession() {
    let token = getToken();
    // Falls Token im localStorage/sessionStorage fehlt (z. B. nach Android Update/Cache-Wipe),
    // versuche die Wiederherstellung aus der persistenten IndexedDB:
    if (!token && typeof GrimoireStorage !== 'undefined') {
      try {
        const idbToken = await GrimoireStorage.get('token');
        if (idbToken) {
          token = idbToken;
          setToken(idbToken);
          const idbUser = await GrimoireStorage.get('user');
          if (idbUser) setCachedUser(idbUser);
        }
      } catch (e) {}
    }

    if (!token) {
      const restored = await tryPhoenixRestore();
      if (restored) return restored;
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
        if (resp.status === 401 || resp.status === 403) {
          const restored = await tryPhoenixRestore();
          if (restored) {
            return restored;
          }
          setToken(null);
          setCachedUser(null);
          currentUser = null;
        }
        try {
          const savedName = localStorage.getItem('grimoire_saved_username');
          if (savedName && nameInput && !nameInput.value) {
            nameInput.value = savedName;
          }
        } catch (e) {}
        renderLobbyBar();
        return currentUser;
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
        const restored = await tryPhoenixRestore();
        if (restored) return restored;
        setToken(null);
        setCachedUser(null);
        currentUser = null;
        renderLobbyBar();
        return null;
      }
    } catch (e) {
      console.warn('Fehler bei auth/me:', e);
      const restored = await tryPhoenixRestore();
      if (restored) return restored;
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
      let data = null;
      try {
        data = await resp.json();
      } catch (parseErr) {
        data = null;
      }
      if (!resp.ok || !data?.success) {
        const errorMsg = data?.error || (resp.status >= 500 ? `Serverfehler (${resp.status}). Bitte versuche es gleich erneut.` : 'Ungültiger Benutzername oder falsches Passwort.');
        showAuthError(errorMsg);
        return false;
      }
      setToken(data.token);
      currentUser = data.user;
      try { localStorage.removeItem('grimoire_explicit_logout'); } catch (e) {}
      setCachedUser(currentUser);
      if (socket) {
        socket.auth = { token: data.token };
        if (socket.connected) socket.emit('authIdentify', { token: data.token });
      }
      if (nameInput) {
        nameInput.value = data.user.username;
        sessionStorage.setItem('wizard_last_name', data.user.username);
        try { localStorage.setItem('grimoire_saved_username', data.user.username); } catch (e) {}
      }
      renderLobbyBar();
      closeAuthModal();
      showToast(`Willkommen zurück, ${data.user.username}!`);
      return true;
    } catch (e) {
      showAuthError('Verbindungsfehler bei der Anmeldung: ' + (e.message || 'Server nicht erreichbar'));
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
      let data = null;
      try {
        data = await resp.json();
      } catch (parseErr) {
        data = null;
      }
      if (!resp.ok || !data?.success) {
        const errorMsg = data?.error || (resp.status >= 500 ? `Serverfehler (${resp.status}). Bitte versuche es gleich erneut.` : 'Registrierung fehlgeschlagen.');
        showAuthError(errorMsg);
        return false;
      }
      setToken(data.token);
      currentUser = data.user;
      try { localStorage.removeItem('grimoire_explicit_logout'); } catch (e) {}
      setCachedUser(currentUser);
      if (socket) {
        socket.auth = { token: data.token };
        if (socket.connected) socket.emit('authIdentify', { token: data.token });
      }
      if (nameInput) {
        nameInput.value = data.user.username;
        sessionStorage.setItem('wizard_last_name', data.user.username);
        try { localStorage.setItem('grimoire_saved_username', data.user.username); } catch (e) {}
      }
      renderLobbyBar();
      closeAuthModal();
      showToast(`Willkommen im Bunde, ${data.user.username}!`);
      return true;
    } catch (e) {
      showAuthError('Verbindungsfehler bei der Registrierung: ' + (e.message || 'Server nicht erreichbar'));
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
    try { localStorage.setItem('grimoire_explicit_logout', 'true'); } catch (e) {}
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

  function safeSetDisplay(el, val) {
    if (!el || !el.style) return;
    if (typeof el.style.setProperty === 'function') {
      el.style.setProperty('display', val, 'important');
    } else {
      el.style.display = val;
    }
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
      safeSetDisplay(guestGroup, 'none');
      safeSetDisplay(userGroup, 'flex');
      if (userNameEl) userNameEl.innerText = currentUser.username;
      if (userTitleEl) userTitleEl.innerText = currentUser.title || 'Zauberlehrling';
      const levelEl = document.getElementById('lobbyUserLevelBadge');
      if (levelEl) levelEl.innerText = `Lvl ${currentUser.account_level || 1}`;
      if (userAvatarEl) {
        const frameClass = `frame-${currentUser.equipped_avatar_frame || 'none'}`;
        userAvatarEl.className = `seat-avatar ${frameClass}`;
        const initial = (currentUser.username || '?').charAt(0).toUpperCase();
        if (currentUser.avatar_id && currentUser.avatar_id.startsWith('icon_')) {
          userAvatarEl.innerHTML = `<img src="/images/avatars/${currentUser.avatar_id}.png" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;" onerror="this.style.display='none';">${initial}`;
        } else if (currentUser.avatar_id && currentUser.avatar_id.startsWith('wizard_')) {
          userAvatarEl.innerHTML = `<img src="/images/avatars/${currentUser.avatar_id}.svg" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;" onerror="this.style.display='none';">${initial}`;
        } else {
          userAvatarEl.innerText = initial;
        }
      }
      const totalChests = (currentUser.chests_wooden || 0) + (currentUser.chests_silver || 0) + (currentUser.chests_gold || 0);
      updateVaultBadgeCount(totalChests);
      safeSetDisplay(companionsGuest, 'none');
      safeSetDisplay(companionsUser, 'inline-flex');
      safeSetDisplay(lbGuest, 'none');
      safeSetDisplay(lbUser, 'inline-flex');
    } else {
      safeSetDisplay(guestGroup, 'flex');
      safeSetDisplay(userGroup, 'none');
      updateVaultBadgeCount(0);
      safeSetDisplay(companionsGuest, 'inline-flex');
      safeSetDisplay(companionsUser, 'none');
      safeSetDisplay(lbGuest, 'inline-flex');
      safeSetDisplay(lbUser, 'none');
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

  let checkUsernameTimeout = null;
  let isUsernameAvailableStatus = true;
  let checkUsernameSeq = 0;

  async function checkLiveUsername(username) {
    const feedbackEl = document.getElementById('authUsernameFeedback');
    if (!feedbackEl) return;
    if (activeAuthTab !== 'register') {
      feedbackEl.style.display = 'none';
      return;
    }
    const raw = (username || '').trim();
    if (!raw) {
      feedbackEl.style.display = 'none';
      feedbackEl.innerText = '';
      isUsernameAvailableStatus = false;
      return;
    }
    if (raw.length < 3 || raw.length > 18) {
      feedbackEl.style.display = 'block';
      feedbackEl.style.color = '#f87171';
      feedbackEl.innerHTML = '✗ Name muss 3 bis 18 Zeichen lang sein';
      isUsernameAvailableStatus = false;
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(raw)) {
      feedbackEl.style.display = 'block';
      feedbackEl.style.color = '#f87171';
      feedbackEl.innerHTML = '✗ Nur Buchstaben, Zahlen, _ und - erlaubt';
      isUsernameAvailableStatus = false;
      return;
    }

    const currentSeq = ++checkUsernameSeq;
    feedbackEl.style.display = 'block';
    feedbackEl.style.color = '#94a3b8';
    feedbackEl.innerHTML = '⏳ Prüfe Gilden-Register...';

    try {
      const resp = await fetch(getApiUrl(`/api/auth/check-username?username=${encodeURIComponent(raw)}`));
      if (currentSeq !== checkUsernameSeq) return;
      let data = null;
      try {
        data = await resp.json();
      } catch (parseErr) {
        data = null;
      }
      if (currentSeq !== checkUsernameSeq) return;
      if (!resp.ok) {
        feedbackEl.style.display = 'block';
        feedbackEl.style.color = '#f87171';
        feedbackEl.innerHTML = `⚠️ ${data?.error || `Server antwortet nicht (${resp.status})`}`;
        isUsernameAvailableStatus = false;
        return;
      }
      if (data && data.available) {
        feedbackEl.style.display = 'block';
        feedbackEl.style.color = '#4ade80';
        feedbackEl.innerHTML = '✓ Magier-Name ist frei!';
        isUsernameAvailableStatus = true;
        clearAuthError();
      } else {
        feedbackEl.style.display = 'block';
        feedbackEl.style.color = '#f87171';
        feedbackEl.innerHTML = `✗ ${data?.error || 'Name bereits vergeben'}`;
        isUsernameAvailableStatus = false;
      }
    } catch (e) {
      if (currentSeq !== checkUsernameSeq) return;
      feedbackEl.style.display = 'block';
      feedbackEl.style.color = '#f87171';
      feedbackEl.innerHTML = '⚠️ Verbindung zum Server fehlgeschlagen';
      isUsernameAvailableStatus = false;
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

    const feedbackEl = document.getElementById('authUsernameFeedback');
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
      if (feedbackEl) feedbackEl.style.display = 'none';
    }

    if (modal) modal.style.display = 'flex';
    const uInput = document.getElementById('authUsernameInput');
    if (uInput && !uInput.value.trim() && typeof nameInput !== 'undefined' && nameInput && nameInput.value.trim()) {
      uInput.value = nameInput.value.trim();
    }
    if (tab === 'register' && uInput && uInput.value.trim()) {
      checkLiveUsername(uInput.value.trim());
    }
    if (uInput) setTimeout(() => uInput.focus(), 50);
  }

  function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
    const pInput = document.getElementById('authPasswordInput');
    if (pInput) pInput.value = '';
    const feedbackEl = document.getElementById('authUsernameFeedback');
    if (feedbackEl) {
      feedbackEl.style.display = 'none';
      feedbackEl.innerText = '';
    }
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
    if (typeof WizardVault !== 'undefined' && WizardVault.fetchVaultState) {
      WizardVault.fetchVaultState();
    }
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
    if (avatarShieldEl) {
      const a = u.avatar_id || 'default';
      const f = u.equipped_avatar_frame || 'none';
      const initial = (u.username || '?').charAt(0).toUpperCase();
      avatarShieldEl.className = `seat-avatar frame-${f}`;
      if (a && a.startsWith('icon_')) {
        avatarShieldEl.innerHTML = `<img src="/images/avatars/${a}.png" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="${escapeHtml(u.username)}" onerror="this.parentElement.innerText='${initial}';">`;
      } else {
        avatarShieldEl.innerHTML = `<span style="font-family:var(--font-heading);font-size:28px;color:var(--gold-bright);">${initial}</span>`;
      }
    }

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

    // Ausrüstung & Garderobe im Profil
    renderProfileCosmetics();
  }

  function renderProfileCosmetics() {
    if (!currentUser) return;
    const u = currentUser;

    const avatarSelect = document.getElementById('profileSelectAvatar');
    const frameSelect = document.getElementById('profileSelectFrame');
    const cardBackSelect = document.getElementById('profileSelectCardBack');
    const tableSkinSelect = document.getElementById('profileSelectTableSkin');
    const titleSelect = document.getElementById('profileTitleSelect');
    const lobbyBgSelect = document.getElementById('profileSelectLobbyBackground');
    const desc = document.getElementById('profileTitleStatusDesc');

    if (!avatarSelect && !frameSelect && !cardBackSelect && !tableSkinSelect && !titleSelect && !lobbyBgSelect) {
      // Profil-Menü bereinigt: Garderobe wird exklusiv in der Schatzkammer verwaltet
      return;
    }

    const vData = (typeof WizardVault !== 'undefined' && WizardVault.getVaultData) ? WizardVault.getVaultData() : null;
    const catalog = (vData && vData.catalog) ? vData.catalog : null;
    const inventory = (vData && vData.inventory) ? vData.inventory : [];
    const ownedIds = new Set(inventory.map(i => i.item_id));

    // Falls Vault-Daten noch nicht da sind, im Hintergrund abrufen
    if (!catalog && typeof WizardVault !== 'undefined' && WizardVault.fetchVaultState) {
      WizardVault.fetchVaultState();
    }

    const rarNames = { common: 'Gewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär' };

    function populateSelect(selectEl, items, currentVal, typeKey) {
      if (!selectEl) return;
      selectEl.innerHTML = '';
      items.forEach(item => {
        const isOwned = item.isDefault || ownedIds.has(item.id);
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.disabled = !isOwned;
        const rarityStr = item.rarity ? ` (${rarNames[item.rarity] || item.rarity})` : '';
        opt.innerText = isOwned ? `${item.name}${rarityStr}` : `🔒 ${item.name}${rarityStr}`;
        if (item.id === currentVal) {
          opt.selected = true;
        }
        selectEl.appendChild(opt);
      });

      selectEl.onchange = () => {
        const chosenId = selectEl.value;
        if (!chosenId) return;
        if (typeKey === 'lobby_background') {
          applyLobbyTheme(chosenId);
        }
        if (typeof WizardVault !== 'undefined' && WizardVault.equipItem) {
          WizardVault.equipItem(typeKey, chosenId);
        } else if (typeKey === 'title') {
          updateTitle(chosenId);
        }
        if (desc) {
          desc.innerText = `Ausrüstung aktualisiert: "${selectEl.options[selectEl.selectedIndex].text}"`;
        }
      };
    }

    // 1. AVATAR-ICONS
    const avatarItems = (catalog && catalog.avatar_icons) ? catalog.avatar_icons : [
      { id: 'wizard_blue', name: 'Zitadellen-Blau', isDefault: true },
      { id: 'wizard_red', name: 'Pyromant-Rot', isDefault: true },
      { id: 'wizard_green', name: 'Druiden-Grün', isDefault: true },
      { id: 'wizard_yellow', name: 'Alchemisten-Gold', isDefault: true },
      { id: 'wizard_purple', name: 'Arkan-Violett', isDefault: true },
      { id: 'archmage', name: 'Erzmagier-Meister', isDefault: true }
    ];
    populateSelect(avatarSelect, avatarItems, u.avatar_id || 'wizard_blue', 'avatar_icon');

    // 2. AVATAR-RAHMEN
    const frameItems = (catalog && catalog.avatar_frames) ? catalog.avatar_frames : [
      { id: 'none', name: 'Kein Rahmen (Schlicht)', isDefault: true },
      { id: 'frame_wood', name: 'Holzkante', isDefault: false, rarity: 'common' },
      { id: 'frame_copper', name: 'Runen-Kupfer', isDefault: false, rarity: 'common' },
      { id: 'frame_silver', name: 'Silber-Filigran', isDefault: false, rarity: 'rare' },
      { id: 'frame_gold', name: 'Goldener Sonnenkranz', isDefault: false, rarity: 'rare' },
      { id: 'frame_amethyst', name: 'Amethyst-Glanz', isDefault: false, rarity: 'epic' },
      { id: 'frame_cosmic', name: 'Kosmischer Äther', isDefault: false, rarity: 'legendary' }
    ];
    populateSelect(frameSelect, frameItems, u.equipped_avatar_frame || 'none', 'avatar_frame');

    // 3. KARTENRÜCKEN
    const cardBackItems = (catalog && catalog.card_backs) ? catalog.card_backs : [
      { id: 'default', name: 'Zitadellen-Blau (Klassisch)', isDefault: true },
      { id: 'ancient_parchment', name: 'Uraltes Pergament', isDefault: false, rarity: 'common' },
      { id: 'runic_parchment', name: 'Runen-Pergament', isDefault: false, rarity: 'rare' },
      { id: 'astral_cosmos', name: 'Astral-Kosmos', isDefault: false, rarity: 'epic' },
      { id: 'dragon_scales', name: 'Drachenschuppen', isDefault: false, rarity: 'epic' },
      { id: 'fairy_grove', name: 'Feenhain', isDefault: false, rarity: 'rare' },
      { id: 'shadow_flame', name: 'Schattenflamme', isDefault: false, rarity: 'legendary' }
    ];
    populateSelect(cardBackSelect, cardBackItems, u.equipped_card_back || 'default', 'card_back');

    // 4. SPIELTISCH-SKINS
    const tableSkinItems = (catalog && catalog.table_skins) ? catalog.table_skins : [
      { id: 'emerald_felt', name: 'Klassischer Smaragd-Filz', isDefault: true },
      { id: 'tavern_wood', name: 'Tavernen-Eiche', isDefault: false, rarity: 'rare' },
      { id: 'amethyst_crypt', name: 'Amethyst-Krypta', isDefault: false, rarity: 'epic' },
      { id: 'volcano_keep', name: 'Vulkan-Festung', isDefault: false, rarity: 'epic' },
      { id: 'astral_observatory', name: 'Sternen-Observatorium', isDefault: false, rarity: 'legendary' }
    ];
    populateSelect(tableSkinSelect, tableSkinItems, u.equipped_table_skin || 'emerald_felt', 'table_skin');

    // 5. EHRENTITEL
    let titleItems = [];
    if (catalog && catalog.titles && catalog.titles.length > 0) {
      titleItems = catalog.titles;
    } else {
      titleItems = [
        { id: 'Zauberlehrling', name: 'Zauberlehrling', isDefault: true },
        { id: 'Meister der Illusion', name: 'Meister der Illusion', isDefault: true },
        { id: 'Seher von Stonehenge', name: 'Seher von Stonehenge', isDefault: false },
        { id: 'Unbesiegbarer Magier', name: 'Unbesiegbarer Magier', isDefault: false },
        { id: 'Großmagier', name: 'Großmagier', isDefault: false }
      ];
    }
    populateSelect(titleSelect, titleItems, u.title || 'Zauberlehrling', 'title');

    // 6. LOBBY-HINTERGRÜNDE
    const lobbyBgItems = (catalog && catalog.lobby_backgrounds) ? catalog.lobby_backgrounds : [
      { id: 'citadel_halls', name: 'Hallen der Zitadelle', isDefault: true },
      { id: 'haunted_graveyard', name: 'Verfluchter Friedhof', isDefault: false, rarity: 'epic' },
      { id: 'witch_hut', name: 'Hexenhütte', isDefault: false, rarity: 'rare' },
      { id: 'tavern_fireplace', name: 'Kaminfeuer-Taverne', isDefault: false, rarity: 'rare' },
      { id: 'astral_observatory', name: 'Sternen-Observatorium', isDefault: false, rarity: 'epic' },
      { id: 'magma_forge', name: 'Magmaschmiede', isDefault: false, rarity: 'epic' },
      { id: 'celestial_sanctum', name: 'Himmlisches Sanktum', isDefault: false, rarity: 'legendary' }
    ];
    populateSelect(lobbyBgSelect, lobbyBgItems, u.equipped_lobby_background || 'citadel_halls', 'lobby_background');
    applyLobbyTheme(u.equipped_lobby_background || 'citadel_halls');

    if (desc) {
      desc.innerText = `Aktiver Titel: "${u.title || 'Zauberlehrling'}"`;
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
        if (!isUsernameAvailableStatus && u.length >= 3) {
          showAuthError('Dieser Magier-Name ist nicht verfügbar oder ungültig.');
          return;
        }
        register(u, p);
      } else {
        login(u, p);
      }
    }

    if (authSubmitBtn) authSubmitBtn.addEventListener('click', submitAuth);
    if (uInput) {
      uInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); });
      uInput.addEventListener('input', () => {
        if (activeAuthTab === 'register') {
          clearTimeout(checkUsernameTimeout);
          checkUsernameTimeout = setTimeout(() => {
            checkLiveUsername(uInput.value);
          }, 250);
        } else {
          const feedbackEl = document.getElementById('authUsernameFeedback');
          if (feedbackEl) feedbackEl.style.display = 'none';
        }
      });
    }
    if (pInput) pInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); });

    // Profile-Drawer Controls
    const profileCloseBtn = document.getElementById('profile-drawer-close');
    if (profileCloseBtn) profileCloseBtn.addEventListener('click', closeProfileDrawer);

    const btnProfileVault = document.getElementById('btnProfileOpenVault');
    if (btnProfileVault) {
      btnProfileVault.addEventListener('click', () => {
        closeProfileDrawer();
        if (typeof WizardVault !== 'undefined' && WizardVault.openVault) {
          WizardVault.openVault('wardrobe');
        }
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
    refreshUser,
    renderProfileData,
    renderProfileCosmetics,
    updatePhoenixVault,
    tryPhoenixRestore
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
    close: closeCompanions,
    getFriends: () => cachedFriends
  };
})();
if (typeof window !== 'undefined') window.CompanionsManager = CompanionsManager;

// --- BOT LORE DATENBANK (INDIVIDUELLE GESCHICHTEN, PHILOSOPHIEN & STUFEN DER MAGIER AUS BUCH, FILM & SERIE) ---
const BOT_LORE_DATABASE = {
  // --- NOVIZEN (Tollpatschige / Chaotische Nachwuchs-Magier) ---
  'rincewind': {
    title: 'Zauberer der Unsichtbaren Universität (Scheibenwelt)',
    level: 'Stufe 5',
    philosophy: 'Flucht vor Stichen & Panik',
    story: 'Der wohl unbegabteste Zauberer der Scheibenwelt. Beherrscht nur einen einzigen unaussprechlichen Zauberspruch, der sich in seinem Kopf festgesetzt hat. Seine beste Taktik: Schnelle Beine und tunlichst keine Stiche riskieren.'
  },
  'lockhart': {
    title: 'Orden des Merlin 3. Klasse (Harry Potter)',
    level: 'Stufe 8',
    philosophy: 'Eitle Schau & Gedächtnislücken',
    story: 'Autor unzähliger erfundener Heldentaten und fünffacher Gewinner des Charmantestes-Lächeln-Preises. Zitiert liebend gern aus seinen Büchern, verwechselt aber im entscheidenden Stich die Farben und vergisst seine eigene Vorhersage.'
  },
  'presto': {
    title: 'Nachwuchs-Magier des Reichs (D&D)',
    level: 'Stufe 10',
    philosophy: 'Chaotischer Zylinderhut',
    story: 'Presto sucht stets nach dem passenden Zauberspruch, zieht aus seinem arkanen Zylinderhut aber verlässlich Gummienten, Bratpfannen oder fliegende Teppiche statt der erhofften Trumpfkarte.'
  },
  'gargamel': {
    title: 'Hinterlistiger Wald-Alchemist (Die Schlümpfe)',
    level: 'Stufe 12',
    philosophy: 'Wacklige Gifttränke & Frust',
    story: 'Lebt in einer baufälligen Hütte und schmiedet finstere Pläne, die regelmäßig durch eigene Ungeschicklichkeit und explodierende Kessel vereitelt werden. Seine Stichprophezeiungen scheitern meist spektakulär.'
  },
  'neville': {
    title: 'Kräuterkundler von Gryffindor (Harry Potter)',
    level: 'Stufe 14',
    philosophy: 'Zögerliche Vorsicht & Treue',
    story: 'Verlor unzählige Kröten, schmolz mehrere Kessel ein und zweifelt an seinen Zauberkünsten. Doch wenn es hart auf hart kommt, beweist Neville unerschütterlichen Mut – bietet aber lieber stets vorsichtig.'
  },
  'orko': {
    title: 'Hofzauberer von Trolla (He-Man)',
    level: 'Stufe 9',
    philosophy: 'Tollpatschige Dimensionsmagie',
    story: 'Schwebender Magier ohne Gesicht, dessen Taschen voller magischer Scherzartikel stecken. Auf Eternia funktionieren seine Zauber selten wie gedacht, weshalb seine Stiche oft unbeabsichtigt im Chaos enden.'
  },

  // --- MEISTER (Fähige / Respektierte Meistermagier) ---
  'snape': {
    title: 'Meister der Tränke & Okklumetik (Harry Potter)',
    level: 'Stufe 46',
    philosophy: 'Kalte Berechnung & Scharfsinn',
    story: 'Ein meisterhafter Zaubertrankbrauer und gedankenlesender Legilimentor. Snape mustert die Kontrahenten mit eisigem Blick, durchschaut gegnerische Bluffs mühelos und schlägt im perfekten Moment erbarmungslos zu.'
  },
  'strange': {
    title: 'Oberster Zauberer von Kamar-Taj (Marvel)',
    level: 'Stufe 48',
    philosophy: 'Spiegeldimension & Wahrscheinlichkeiten',
    story: 'Ehemaliger Neurochirurg und Hüter arkaner Dimensionen. Doctor Strange hat 14 Millionen Möglichkeiten der Runde durch das Auge von Agamotto vorausberechnet und navigiert zielstrebig zum optimalen Stichausgang.'
  },
  'yennefer': {
    title: 'Zauberin von Vengerberg (The Witcher)',
    level: 'Stufe 47',
    philosophy: 'Arkanes Chaos & Willensstärke',
    story: 'Eine der mächtigsten und willensstärksten Zauberinnen des Kontinents. Yennefer duldet keine Schwäche am Spieltisch, führt Farben mit kühler Eleganz und bestraft unvorsichtige Gebote ohne Gnade.'
  },
  'howl': {
    title: 'Exzentrischer Hofmagier (Das wandelnde Schloss)',
    level: 'Stufe 44',
    philosophy: 'Schillernde Illusion & Eleganz',
    story: 'Ein faszinierender, eitler Zauberer mit einem Herz aus Dämonenfeuer. Howl verzaubert die Runde mit glänzenden Manövern, weicht brenzligen Stichen virtuos aus und liebt dramatische Spielwendungen.'
  },
  'raistlin': {
    title: 'Meister der Schwarzen Roben (Dragonlance)',
    level: 'Stufe 50',
    philosophy: 'Skrupellose Kartenkontrolle',
    story: 'Körperlich gebrechlich, doch von unermesslichem Intellekt und grenzenlosem Ehrgeiz getrieben. Raistlin berechnet jede Karte mit messerscharfer Logik und opfert Figuren ohne jedes Zögern für den finalen Sieg.'
  },
  'mcgonagall': {
    title: 'Meisterin der Verwandlung (Harry Potter)',
    level: 'Stufe 49',
    philosophy: 'Strenge Disziplin & Farbzwang',
    story: 'Stellvertretende Schulleiterin und begnadete Animaga. Professor McGonagall behält den Spieltisch mit scharfem Falkenblick im Auge, besteht unnachgiebig auf Regeltreue und duldet keinen Leichtsinn.'
  },

  // --- ERZMAGIER (Übermächtige / Legendäre Magier) ---
  'gandalf': {
    title: 'Der Weiße Bote des Westens (Herr der Ringe)',
    level: 'Stufe 95',
    philosophy: 'Unerbittliche Weisheit & Führung',
    story: 'Ein unsterblicher Maia und Anführer des Weißen Rates. "Du kannst nicht vorbei!" – Gandalf durchdringt das Gewebe jeder Runde mit uralter Entschlossenheit und zerschmettert die Vorhersagen seiner Widersacher.'
  },
  'dumbledore': {
    title: 'Großmeister von Hogwarts (Harry Potter)',
    level: 'Stufe 98',
    philosophy: 'Weise Gelassenheit & Voraussicht',
    story: 'Der größte Magier der Neuzeit und Beherrscher des Elderstabs. Dumbledore begegnet jedem Stich mit heiterer Ruhe, plant zehn Züge im Voraus und lenkt die Partie unmerklich in die von ihm vorherbestimmten Bahnen.'
  },
  'merlin': {
    title: 'Urvater aller Magie (Artus-Sage)',
    level: 'Stufe 99',
    philosophy: 'Uralte Schicksals-Prophezeiung',
    story: 'Sohn des Himmels und Erzieher von Königen. Merlin lebt rückwärts durch die Zeit und kennt das Schicksal jeder gelegten Karte bereits, bevor sie gemischt wird. Seine Stichgebote treffen mit schicksalhafter Präzision ein.'
  },
  'saruman': {
    title: 'Das Oberhaupt des Weißen Rates (Herr der Ringe)',
    level: 'Stufe 92',
    philosophy: 'Eiserner Wille & Arkaner Zwang',
    story: 'Einst der Erste unter den Istari. Seine Stimme ist von bezwingender Macht und sein Verstand von eisiger Tiefe. Saruman duldet keine Abweichung von seinen Vorhersagen und manipuliert den Spielfluss mit erhabener Härte.'
  },
  'voldemort': {
    title: 'Der Dunkle Lord (Harry Potter)',
    level: 'Stufe 94',
    philosophy: 'Gnadenlose Furcht & Dominanz',
    story: 'Der gefürchtetste Dunkle Magier aller Zeiten. Lord Voldemort reißt Stiche mit unbarmherziger Brutalität an sich, bricht die Verteidigung der Gegner mit tödlicher Konsequenz und verzeiht keinen einzigen Fehltritt.'
  },
  'elminster': {
    title: 'Auserwählter der Mystra (D&D Forgotten Realms)',
    level: 'Stufe 97',
    philosophy: 'Allwissende Weltenwanderung',
    story: 'Der alte Magier von Schattental wandelt seit über tausend Jahren durch Faerûn. Gelassen mit seiner Pfeife am Tisch sitzend, pariert Elminster jede Bedrohung mit mühelosem arkanem Lächeln.'
  },

  // Rückwärtskompatible Aliase
  'pippin': {
    title: 'Akademie-Novize',
    level: 'Stufe 10',
    philosophy: 'Verspielt & Neugierig',
    story: 'Ein enthusiastischer Magierschüler mit großem Herzen und wagemutigen Vorhersagen.'
  },
  'luna': {
    title: 'Sternenbeobachterin',
    level: 'Stufe 12',
    philosophy: 'Astrologische Führung',
    story: 'Deutet Stiche wie Konstellationen am Nachthimmel.'
  },
  'sam': {
    title: 'Schildknappe',
    level: 'Stufe 10',
    philosophy: 'Eiserne Disziplin',
    story: 'Vertraut auf solide Verteidigung und sichere Vorhersagen.'
  },
  'arya': {
    title: 'Schattenläuferin',
    level: 'Stufe 14',
    philosophy: 'Flink & Unberechenbar',
    story: 'Deckt Karten im verblüffendsten Augenblick auf.'
  },
  'morgana': {
    title: 'Herrin der Nebel',
    level: 'Stufe 45',
    philosophy: 'Täuschung & Konter',
    story: 'Hüllt ihre Absichten in dichten Nebel arkaner Täuschung.'
  },
  'albus': {
    title: 'Großmeister des Zitadellenrats',
    level: 'Stufe 98',
    philosophy: 'Vorausschauende Harmonie',
    story: 'Beherrscht jede Nuance des arkanen Farbzwangs.'
  },
  'circe': {
    title: 'Alchemistin der Transformation',
    level: 'Stufe 44',
    philosophy: 'Farbanalyse & Wendigkeit',
    story: 'Erkennt Farblücken wie mit dem Seziermesser.'
  },
  'medea': {
    title: 'Hohepriesterin des Feuers',
    level: 'Stufe 89',
    philosophy: 'Aggressive Trumpfführung',
    story: 'Brennt mit unbändiger magischer Stichgewalt.'
  }
};

function getBotLore(botName, botDifficulty) {
  const lower = (botName || '').toLowerCase();
  for (const [key, lore] of Object.entries(BOT_LORE_DATABASE)) {
    if (lower.includes(key)) {
      return lore;
    }
  }
  const diff = botDifficulty || 'master';
  if (diff === 'novice') {
    return {
      title: 'Akademie-Novize',
      level: 'Stufe 10',
      philosophy: 'Neugierig & Lernbegierig',
      story: 'Ein aufstrebender Lehrling der Zauberakademie, der noch an seinen Vorhersagen feilt, aber mit frischem Eifer am Tisch agiert.'
    };
  } else if (diff === 'archmage') {
    return {
      title: 'Erzmagier der Ratskammer',
      level: 'Stufe 90',
      philosophy: 'Eiskalte Perfektion',
      story: 'Ein altehrwürdiges Mitglied des Magischen Konzils mit meisterhafter Kartenübersicht und unnachgiebiger Präzision.'
    };
  }
  return {
    title: 'Meister der arkanen Künste',
    level: 'Stufe 45',
    philosophy: 'Besonnene Taktik',
    story: 'Ein erfahrener Meistermagier der Zitadelle, der Risiken exakt abwägt und Stiche wohlüberlegt verteilt.'
  };
}

// ==========================================================================
// ETAPPE 6: DIE SCHATZKAMMER DES ERZMAGIERS, KOSMETIK & PROGRESSION
// ==========================================================================

function applyTableSkin(skinId) {
  const tableEl = document.getElementById('table-area') || document.querySelector('.poker-table');
  if (!tableEl) return;
  const skins = ['emerald_felt', 'tavern_wood', 'amethyst_crypt', 'volcano_keep', 'astral_observatory', 'haunted_crypt'];
  skins.forEach(s => tableEl.classList.remove(`table-skin-${s}`));
  tableEl.classList.add(`table-skin-${skinId || 'emerald_felt'}`);
}

function applyLobbyTheme(themeId) {
  const lobby = document.getElementById('lobby-screen');
  const waiting = document.getElementById('waiting-room-screen');
  const themes = ['citadel_halls', 'haunted_graveyard', 'witch_hut', 'tavern_fireplace', 'astral_observatory', 'magma_forge', 'celestial_sanctum'];
  [lobby, waiting].forEach(el => {
    if (!el) return;
    themes.forEach(t => el.classList.remove(`theme-${t}`));
    el.classList.add(`theme-${themeId || 'citadel_halls'}`);
  });
}

function updateVaultBadgeCount(count) {
  const badge1 = document.getElementById('vaultBadge');
  const badge2 = document.getElementById('waitingVaultBadge');
  const badge3 = document.getElementById('vaultChestsCountBadge');
  const c = Math.max(0, parseInt(count, 10) || 0);

  const badgeText = c > 0 ? `🎁 ${c}` : '';
  const tooltipText = c > 0 ? `Du hast ${c} ungeöffnete magische Schatztruhe${c > 1 ? 'n' : ''}!` : '';

  if (badge1) {
    badge1.innerText = badgeText;
    badge1.title = tooltipText;
    badge1.style.display = c > 0 ? 'inline-flex' : 'none';
  }
  if (badge2) {
    badge2.innerText = badgeText;
    badge2.title = tooltipText;
    badge2.style.display = c > 0 ? 'inline-flex' : 'none';
  }
  if (badge3) {
    badge3.innerText = c;
  }
}

const WizardVault = (() => {
  let vaultData = null;
  let currentTab = 'chests'; // 'chests', 'wardrobe', 'forge'
  let currentWardrobeCategory = 'avatar_icons';
  let currentForgeCategory = 'all';

  function updateBadges(count) {
    updateVaultBadgeCount(count);
  }

  function openVault(targetTab = 'chests') {
    const user = (typeof WizardAuth !== 'undefined') ? WizardAuth.getUser() : null;
    if (!user) {
      if (typeof WizardAuth !== 'undefined' && WizardAuth.openAuthModal) {
        showToast('Bitte melde dich an, um die Schatzkammer zu betreten!');
        WizardAuth.openAuthModal('login');
      }
      return;
    }
    const modal = document.getElementById('vault-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    switchTab(typeof targetTab === 'string' ? targetTab : 'chests');
    fetchVaultState();
  }

  function closeVault() {
    const modal = document.getElementById('vault-modal');
    if (modal) modal.style.display = 'none';
    if (typeof finishUnboxing === 'function') finishUnboxing();
  }

  function switchTab(tab) {
    currentTab = tab;
    const tabChests = document.getElementById('tabVaultChests');
    const tabWardrobe = document.getElementById('tabVaultWardrobe');
    const tabForge = document.getElementById('tabVaultForge');

    const panelChests = document.getElementById('vaultPanelChests');
    const panelWardrobe = document.getElementById('vaultPanelWardrobe');
    const panelForge = document.getElementById('vaultPanelForge');

    [tabChests, tabWardrobe, tabForge].forEach(b => { if (b) b.classList.remove('active'); });
    [panelChests, panelWardrobe, panelForge].forEach(p => { if (p) p.style.display = 'none'; });

    if (tab === 'chests') {
      if (tabChests) tabChests.classList.add('active');
      if (panelChests) panelChests.style.display = 'block';
    } else if (tab === 'wardrobe') {
      if (tabWardrobe) tabWardrobe.classList.add('active');
      if (panelWardrobe) panelWardrobe.style.display = 'block';
      renderWardrobe();
    } else if (tab === 'forge') {
      if (tabForge) tabForge.classList.add('active');
      if (panelForge) panelForge.style.display = 'block';
      renderForge();
    }
  }

  function fetchVaultState() {
    const token = (typeof WizardAuth !== 'undefined') ? WizardAuth.getToken() : null;
    if (socket && socket.connected) {
      socket.emit('vault:getState', { token });
    }
  }

  function onVaultStateReceived(data) {
    if (!data || !data.success) return;
    vaultData = data;
    try {
      const savedSnapshotRaw = localStorage.getItem('grimoire_account_snapshot');
      if (savedSnapshotRaw && data.user) {
        const savedSnapshot = JSON.parse(savedSnapshotRaw);
        const serverInvCount = (data.inventory || []).length;
        const localInvCount = (savedSnapshot.inventory || []).length;
        if (localInvCount > serverInvCount && savedSnapshot.user && savedSnapshot.user.username === data.user.username) {
          // Server hat nach Update/Neustart weniger Items als der Client persistent gemerkt hat -> Automatische Synchronisation
          const token = (typeof WizardAuth !== 'undefined') ? WizardAuth.getToken() : null;
          if (token) {
            fetch(getApiUrl('/api/auth/sync-backup'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                inventory: savedSnapshot.inventory,
                equipped: {
                  equipped_card_back: savedSnapshot.user.equipped_card_back,
                  equipped_table_skin: savedSnapshot.user.equipped_table_skin,
                  equipped_avatar_frame: savedSnapshot.user.equipped_avatar_frame,
                  equipped_lobby_background: savedSnapshot.user.equipped_lobby_background
                }
              })
            }).then(r => r.json()).then(syncRes => {
              if (syncRes && syncRes.success && syncRes.inventory) {
                data.inventory = syncRes.inventory;
                if (syncRes.user) data.user = syncRes.user;
                renderWardrobe();
              }
            }).catch(() => {});
          }
        }
      }

      localStorage.setItem('grimoire_account_snapshot', JSON.stringify({
        user: data.user,
        inventory: data.inventory || [],
        timestamp: Date.now()
      }));
      if (typeof GrimoireStorage !== 'undefined') {
        GrimoireStorage.set('account_snapshot', { user: data.user, inventory: data.inventory || [] }).catch(() => {});
      }
    } catch (e) {}
    if (data.user && data.user.equipped_lobby_background && typeof applyLobbyTheme === 'function') {
      applyLobbyTheme(data.user.equipped_lobby_background);
    }
    renderHeader();
    renderChests();
    renderWeeklyMilestones();
    if (currentTab === 'wardrobe') renderWardrobe();
    if (currentTab === 'forge') renderForge();
    const profileDrawer = document.getElementById('profile-drawer');
    if (profileDrawer && profileDrawer.classList.contains('open') && typeof WizardAuth !== 'undefined' && WizardAuth.renderProfileData) {
      WizardAuth.renderProfileData();
    }
  }

  function renderHeader() {
    if (!vaultData || !vaultData.user) return;
    const u = vaultData.user;
    const lvlEl = document.getElementById('vaultLevelDisplay');
    const xpFill = document.getElementById('vaultXpBarFill');
    const xpTxt = document.getElementById('vaultXpText');
    const dustEl = document.getElementById('vaultDustDisplay');
    const forgeDust = document.getElementById('forgeDustCounter');

    const curLvl = u.account_level || 1;
    const curXp = u.account_xp || 0;
    const pct = Math.min(100, Math.max(0, Math.round((curXp / 1000) * 100)));

    if (lvlEl) lvlEl.innerText = curLvl;
    if (xpFill) xpFill.style.width = `${pct}%`;
    if (xpTxt) xpTxt.innerText = `${curXp} / 1000 XP`;
    if (dustEl) dustEl.innerText = u.astral_dust || 0;
    if (forgeDust) forgeDust.innerText = `✨ ${u.astral_dust || 0}`;

    const totalChests = (u.chests_wooden || 0) + (u.chests_silver || 0) + (u.chests_gold || 0);
    updateBadges(totalChests);
  }

  function renderChests() {
    if (!vaultData || !vaultData.user) return;
    const u = vaultData.user;
    const wCount = u.chests_wooden || 0;
    const sCount = u.chests_silver || 0;
    const gCount = u.chests_gold || 0;

    const cw = document.getElementById('countWoodenChests');
    const cs = document.getElementById('countSilverChests');
    const cg = document.getElementById('countGoldChests');

    const bw = document.getElementById('btnOpenWoodenChest');
    const bs = document.getElementById('btnOpenSilverChest');
    const bg = document.getElementById('btnOpenGoldChest');

    if (cw) cw.innerText = wCount;
    if (cs) cs.innerText = sCount;
    if (cg) cg.innerText = gCount;

    if (bw) bw.disabled = (wCount <= 0);
    if (bs) bs.disabled = (sCount <= 0);
    if (bg) bg.disabled = (gCount <= 0);
  }

  function renderWeeklyMilestones() {
    if (!vaultData) return;
    const list = document.getElementById('vaultWeeklyMilestonesList');
    const periodTxt = document.getElementById('vaultWeeklyPeriodText');
    if (!list) return;

    const stats = vaultData.weeklyStats || {};
    if (periodTxt && stats.periodId) {
      periodTxt.innerText = `Woche: ${stats.periodId}`;
    }

    const milestones = vaultData.weeklyMilestones || [];
    const claimed = stats.claimedMilestones || [];

    list.innerHTML = '';
    milestones.forEach((m) => {
      let curVal = 0;
      if (m.type === 'matches') curVal = stats.matchesPlayed || 0;
      else if (m.type === 'wins') curVal = stats.matchesWon || 0;
      else if (m.type === 'bids') curVal = stats.perfectBids || 0;

      const isClaimed = claimed.includes(m.id);
      const isDone = (curVal >= m.target);
      const pct = Math.min(100, Math.round((curVal / m.target) * 100));

      let rewardText = '';
      if (m.reward.type === 'chest') {
        const tNames = { wooden: '🪵 Holztruhe', silver: '🥈 Silbertruhe', gold: '👑 Goldkassette' };
        rewardText = `${m.reward.amount}x ${tNames[m.reward.chestType] || 'Truhe'}`;
      } else if (m.reward.type === 'dust') {
        rewardText = `✨ ${m.reward.amount} Astralstaub`;
      }

      let btnHtml = '';
      if (isClaimed) {
        btnHtml = `<span style="color: #4ade80; font-size: 11.5px; font-weight: bold;">✓ Eingelöst</span>`;
      } else if (isDone) {
        btnHtml = `<button type="button" class="btn-auth-bar btn-auth-gold btn-claim-milestone" data-id="${m.id}" style="padding: 4px 10px; font-size: 11px;">Einfordern</button>`;
      } else {
        btnHtml = `<span style="color: #94a3b8; font-size: 11.5px;">${curVal} / ${m.target}</span>`;
      }

      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.background = 'rgba(255,255,255,0.03)';
      item.style.border = '1px solid rgba(255,255,255,0.08)';
      item.style.borderRadius = '6px';
      item.style.padding = '8px 12px';

      item.innerHTML = `
        <div style="flex: 1; margin-right: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px;">
            <span style="color: #fde047; font-weight: 500;">${escapeHtml(m.name)}</span>
            <span style="font-size: 11px; color: #a855f7;">Belohnung: ${rewardText}</span>
          </div>
          <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.5); border-radius: 3px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #d97706, #fbbf24);"></div>
          </div>
        </div>
        <div>${btnHtml}</div>
      `;

      const claimBtn = item.querySelector('.btn-claim-milestone');
      if (claimBtn) {
        claimBtn.addEventListener('click', () => {
          claimMilestone(m.id);
        });
      }

      list.appendChild(item);
    });
  }

  let activeUnboxingTier = null;
  let isUnboxingAnimationRunning = false;
  let chestClickStartTime = 0;
  let unboxingApexTimer = null;
  let unboxingStageTimer = null;
  let unboxingFlashTimer = null;

  // --- 60-FPS CANVAS FX ENGINE & OVERWATCH-KOMETEN-PHYSIK ---
  let chestFxCanvas = null;
  let chestFxCtx = null;
  let chestFxAnimId = null;
  let chestParticles = [];
  let chestShockwaves = [];
  let chestLightRays = [];
  let chestRuneMotes = [];
  let activeComets = [];

  class CometTailParticle {
    constructor(x, y, color, size, glowColor) {
      this.x = x + (Math.random() - 0.5) * 4;
      this.y = y + (Math.random() - 0.5) * 4;
      this.vx = (Math.random() - 0.5) * 1.0;
      this.vy = (Math.random() - 0.5) * 1.0;
      this.color = color;
      this.glowColor = glowColor;
      this.size = size || (Math.random() * 3.6 + 2.0);
      this.life = 1.0;
      this.decay = Math.random() * 0.035 + 0.024;
      this.isSpark = Math.random() < 0.35;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.size *= 0.94;
      this.life -= this.decay;
    }
    draw(ctx) {
      if (this.life <= 0 || this.size <= 0.2) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = this.isSpark ? 10 : 6;
      ctx.shadowColor = this.glowColor || this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class CometProjectile {
    constructor(index, total, reward, startX, startY, targetX, targetY, onImpact) {
      this.index = index;
      this.total = total;
      this.reward = reward;
      this.rarity = (reward.rarity || 'common').toLowerCase();

      const rarityMap = {
        common: { core: '#f8fafc', tail: '#cbd5e1', glow: 'rgba(203, 213, 225, 0.85)' },
        rare: { core: '#38bdf8', tail: '#7dd3fc', glow: 'rgba(56, 189, 248, 0.9)' },
        epic: { core: '#c084fc', tail: '#e9d5ff', glow: 'rgba(192, 132, 252, 0.95)' },
        legendary: { core: '#fbbf24', tail: '#fef08a', glow: 'rgba(251, 191, 36, 1.0)' }
      };
      const conf = rarityMap[this.rarity] || rarityMap.common;
      this.color = conf.core;
      this.tailColor = conf.tail;
      this.glowColor = conf.glow;

      this.x = startX;
      this.y = startY;
      this.targetX = targetX;
      this.targetY = targetY;
      this.onImpact = onImpact;

      // Flugphase nach oben mit bogenförmiger Fächerung
      const spread = (index - (total - 1) / 2) * 0.28;
      const launchAngle = -Math.PI / 2 + spread + (Math.random() - 0.5) * 0.05;
      const launchSpeed = 9.2 + Math.random() * 1.6;

      this.vx = Math.cos(launchAngle) * launchSpeed;
      this.vy = Math.sin(launchAngle) * launchSpeed;
      this.gravity = 0.36;
      this.state = 'rising'; // 'rising' -> 'apex' -> 'homing' -> 'done'
      this.apexTimer = 0;
      this.apexDuration = 18 + Math.floor(Math.random() * 8);
      this.homingSpeed = 3.8;
      this.tail = [];
      this.coreRadius = 6.5;
      this.pulseAngle = 0;
      this.done = false;
    }

    update() {
      // Dichter Sternschnuppenschweif mit weicher Interpolation entlang der Flugbahn
      const pCount = 5;
      for (let i = 0; i < pCount; i++) {
        const interp = i / pCount;
        const px = this.x - this.vx * interp + (Math.random() - 0.5) * 3;
        const py = this.y - this.vy * interp + (Math.random() - 0.5) * 3;
        const pColor = (Math.random() < 0.6) ? this.color : (Math.random() < 0.85 ? this.tailColor : '#ffffff');
        this.tail.push(new CometTailParticle(px, py, pColor, Math.random() * 3.8 + 2.2, this.glowColor));
      }

      for (let i = this.tail.length - 1; i >= 0; i--) {
        this.tail[i].update();
        if (this.tail[i].life <= 0) {
          this.tail.splice(i, 1);
        }
      }

      this.pulseAngle += 0.22;
      if (this.done) return;

      if (this.state === 'rising') {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= 0.98;

        if (this.vy >= -0.6) {
          this.state = 'apex';
          this.apexTimer = 0;
          this.vx *= 0.25;
          this.vy = 0;
        }
      } else if (this.state === 'apex') {
        // Verweilen im Scheitelpunkt in Seltenheitsfarbe (Overwatch Suspense)
        this.apexTimer++;
        this.x += this.vx;
        this.y += Math.sin(this.apexTimer * 0.25) * 0.25;
        this.vx *= 0.9;

        if (this.apexTimer >= this.apexDuration) {
          this.state = 'homing';
          this.homingSpeed = 4.0;
        }
      } else if (this.state === 'homing') {
        // Bogen nach unten auf Zielposition
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        this.homingSpeed = Math.min(26, this.homingSpeed + 1.2);
        const angle = Math.atan2(dy, dx);
        this.vx = Math.cos(angle) * this.homingSpeed;
        this.vy = Math.sin(angle) * this.homingSpeed;

        this.x += this.vx;
        this.y += this.vy;

        if (dist <= Math.max(16, this.homingSpeed * 1.1) || (this.vy > 0 && this.y >= this.targetY)) {
          this.x = this.targetX;
          this.y = this.targetY;
          this.state = 'done';
          this.done = true;
          if (typeof this.onImpact === 'function') {
            this.onImpact(this);
          }
        }
      }
    }

    draw(ctx) {
      for (let i = 0; i < this.tail.length; i++) {
        this.tail[i].draw(ctx);
      }

      if (this.done) return;

      ctx.save();
      ctx.translate(this.x, this.y);

      const pulseScale = 1.0 + Math.sin(this.pulseAngle) * 0.16;
      const r = this.coreRadius * pulseScale;

      ctx.beginPath();
      ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
      ctx.fillStyle = this.glowColor;
      ctx.shadowBlur = 24;
      ctx.shadowColor = this.color;
      ctx.globalAlpha = 0.55;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 16;
      ctx.shadowColor = this.color;
      ctx.globalAlpha = 0.9;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ffffff';
      ctx.globalAlpha = 1.0;
      ctx.fill();

      if (this.rarity !== 'common') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.85;
        const gLen = r * 2.2;
        ctx.beginPath();
        ctx.moveTo(-gLen, 0); ctx.lineTo(gLen, 0);
        ctx.moveTo(0, -gLen); ctx.lineTo(0, gLen);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  function initChestFxCanvas() {
    chestFxCanvas = document.getElementById('vaultFxCanvas');
    if (!chestFxCanvas) return;
    chestFxCtx = chestFxCanvas.getContext('2d');
    resizeChestFxCanvas();
  }

  function resizeChestFxCanvas() {
    if (!chestFxCanvas) return;
    const rect = chestFxCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.round(rect.width || 450);
    const cssH = Math.round(rect.height || 260);

    chestFxCanvas.width = cssW * dpr;
    chestFxCanvas.height = cssH * dpr;
    if (chestFxCtx) {
      chestFxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function triggerImpactFx(x, y, rarityColor) {
    if (!chestFxCanvas) initChestFxCanvas();
    const col = rarityColor || '#fbbf24';

    // 1. Aufprall-Schockwelle in Seltenheitsfarbe
    chestShockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius: 75,
      speed: 5.5,
      lineWidth: 7,
      color: col,
      alpha: 1.0,
      decay: 0.04
    });

    // 2. Partikelsterne & Funken-Explosion
    const pCount = 28;
    for (let i = 0; i < pCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6.5 + 2.5;
      chestParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.15,
        drag: 0.95,
        size: Math.random() * 3.8 + 2.0,
        isStar: Math.random() < 0.45,
        color: Math.random() < 0.7 ? col : '#ffffff',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25,
        life: 1.0,
        decay: Math.random() * 0.028 + 0.02
      });
    }

    if (!chestFxAnimId) {
      updateChestFx();
    }
  }

  function launchComets(rewards, data) {
    if (!chestFxCanvas) initChestFxCanvas();
    if (!chestFxCtx || !chestFxCanvas) return;
    resizeChestFxCanvas();

    const canvasRect = chestFxCanvas.getBoundingClientRect();
    const w = canvasRect.width || 450;
    const h = canvasRect.height || 480;

    const chestEl = document.getElementById('vaultChestInteractive');
    let ox = w / 2;
    let oy = h * 0.35;
    if (chestEl) {
      const chestRect = chestEl.getBoundingClientRect();
      if (chestRect.width > 0 && chestRect.height > 0) {
        ox = (chestRect.left + chestRect.width / 2) - canvasRect.left;
        oy = (chestRect.top + chestRect.height * 0.4) - canvasRect.top;
      }
    }

    activeComets = [];
    const total = (rewards || []).length;
    if (total === 0) {
      isUnboxingAnimationRunning = false;
      return;
    }

    if (typeof WizardAudio !== 'undefined' && WizardAudio.playCometLaunch) {
      WizardAudio.playCometLaunch();
    }

    // Zeige Beutekarten-Bereich an mit 'pending-comet'
    showUnboxingStage(data, true);

    const dropsCont = document.getElementById('vaultUnboxingDrops');

    rewards.forEach((r, idx) => {
      let tx = w * (0.2 + 0.6 * ((idx + 0.5) / Math.max(1, total)));
      let ty = h * 0.75;

      if (dropsCont && dropsCont.children[idx]) {
        const cRect = dropsCont.children[idx].getBoundingClientRect();
        if (cRect.width > 0 && cRect.height > 0) {
          tx = (cRect.left + cRect.width / 2) - canvasRect.left;
          ty = (cRect.top + cRect.height / 2) - canvasRect.top;
        }
      }

      const comet = new CometProjectile(idx, total, r, ox, oy, tx, ty, (c) => {
        // Impact-Slam!
        if (typeof WizardAudio !== 'undefined' && WizardAudio.playImpact) {
          WizardAudio.playImpact(c.rarity);
        }
        triggerImpactFx(c.targetX, c.targetY, c.color);

        if (dropsCont && dropsCont.children[c.index]) {
          const cardEl = dropsCont.children[c.index];
          cardEl.classList.remove('pending-comet');
          cardEl.classList.add('revealed');
        }

        const allDone = activeComets.every(item => item.done);
        if (allDone) {
          isUnboxingAnimationRunning = false;
          if (unboxingStageTimer) {
            clearTimeout(unboxingStageTimer);
            unboxingStageTimer = null;
          }
        }
      });

      activeComets.push(comet);
    });

    if (!chestFxAnimId) {
      updateChestFx();
    }
  }

  function triggerChestBurstFx(rarityHex, chestTier) {
    if (!chestFxCanvas) initChestFxCanvas();
    if (!chestFxCtx || !chestFxCanvas) return;

    resizeChestFxCanvas();
    stopChestFx();

    const canvasRect = chestFxCanvas.getBoundingClientRect();
    const w = canvasRect.width || 450;
    const h = canvasRect.height || 480;

    const chestEl = document.getElementById('vaultChestInteractive');
    let ox = w / 2;
    let oy = h * 0.35;
    if (chestEl) {
      const chestRect = chestEl.getBoundingClientRect();
      if (chestRect.width > 0 && chestRect.height > 0) {
        ox = (chestRect.left + chestRect.width / 2) - canvasRect.left;
        oy = (chestRect.top + chestRect.height * 0.45) - canvasRect.top;
      }
    }

    const baseColor = rarityHex || '#fbbf24';
    const accentColor = '#ffffff';

    // Tier-spezifische Farbpalette für Volumetrik & God-Rays
    let tierRayColor = 'rgba(251, 191, 36, 0.45)';
    if (chestTier === 'silver') {
      tierRayColor = 'rgba(56, 189, 248, 0.55)';
    } else if (chestTier === 'wooden') {
      tierRayColor = 'rgba(245, 158, 11, 0.5)';
    } else if (chestTier === 'gold') {
      tierRayColor = 'rgba(251, 191, 36, 0.65)';
    }

    // 1. Volumetrische God-Rays / Lichtsäulen nach oben
    const rayCount = 7;
    for (let r = 0; r < rayCount; r++) {
      const spread = (r - (rayCount - 1) / 2) * 0.18 + (Math.random() - 0.5) * 0.08;
      chestLightRays.push({
        ox: ox + (r - (rayCount - 1) / 2) * 12,
        oy: oy - 5,
        angle: -Math.PI / 2 + spread,
        length: Math.max(w, h) * (0.85 + Math.random() * 0.35),
        baseWidth: Math.random() * 18 + 14,
        color: tierRayColor,
        alpha: 0.9,
        decay: Math.random() * 0.012 + 0.015,
        swing: (Math.random() - 0.5) * 0.003
      });
    }

    // 2. Gestaffelte Schockwellen-Ringe
    chestShockwaves.push({
      x: ox,
      y: oy,
      radius: 14,
      maxRadius: Math.max(w, h) * 0.65,
      speed: 7.5,
      lineWidth: 9,
      color: baseColor,
      alpha: 1.0,
      decay: 0.024
    });

    setTimeout(() => {
      if (chestFxAnimId) {
        chestShockwaves.push({
          x: ox,
          y: oy,
          radius: 10,
          maxRadius: Math.max(w, h) * 0.55,
          speed: 6.2,
          lineWidth: 6,
          color: accentColor,
          alpha: 0.92,
          decay: 0.028
        });
      }
    }, 85);

    // 3. 80 physikalische Partikel (Fontäne & Sternfunken)
    const particleCount = 80;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 8.5 + 3.5;
      const isStar = Math.random() < 0.38;
      const colChoice = Math.random();
      const color = colChoice < 0.6 ? baseColor : (colChoice < 0.85 ? '#fde68a' : accentColor);

      chestParticles.push({
        x: ox + (Math.random() - 0.5) * 22,
        y: oy + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed * (0.85 + Math.random() * 0.55),
        vy: (Math.sin(angle) * speed * 0.8) - (Math.random() * 4.5 + 2.5),
        gravity: 0.17,
        drag: 0.976,
        size: Math.random() * 4.2 + 2.5,
        isStar,
        color,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.22,
        life: 1.0,
        decay: Math.random() * 0.016 + 0.013
      });
    }

    // 4. Sanft schwebende Runen-Funken nach oben
    const runeMoteCount = 18;
    for (let m = 0; m < runeMoteCount; m++) {
      chestRuneMotes.push({
        x: ox + (Math.random() - 0.5) * 90,
        y: oy + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(Math.random() * 2.2 + 1.2),
        oscFreq: Math.random() * 0.08 + 0.04,
        oscAmp: Math.random() * 1.5 + 0.8,
        size: Math.random() * 3 + 1.8,
        color: baseColor,
        alpha: 0.95,
        decay: Math.random() * 0.012 + 0.01,
        time: Math.random() * 10
      });
    }

    updateChestFx();
  }

  function updateChestFx() {
    if (!chestFxCtx || !chestFxCanvas) return;
    const rect = chestFxCanvas.getBoundingClientRect();
    const w = rect.width || 450;
    const h = rect.height || 260;

    chestFxCtx.clearRect(0, 0, w, h);

    // 1. God-Rays / Lichtsäulen rendern
    for (let i = chestLightRays.length - 1; i >= 0; i--) {
      const ray = chestLightRays[i];
      ray.alpha -= ray.decay;
      ray.angle += ray.swing;
      if (ray.alpha <= 0) {
        chestLightRays.splice(i, 1);
        continue;
      }
      chestFxCtx.save();
      chestFxCtx.translate(ray.ox, ray.oy);
      chestFxCtx.rotate(ray.angle);

      const grad = chestFxCtx.createLinearGradient(0, 0, ray.length, 0);
      grad.addColorStop(0, ray.color);
      grad.addColorStop(0.35, ray.color);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      chestFxCtx.fillStyle = grad;
      chestFxCtx.globalAlpha = Math.max(0, ray.alpha);
      chestFxCtx.beginPath();
      chestFxCtx.moveTo(0, -ray.baseWidth * 0.3);
      chestFxCtx.lineTo(ray.length, -ray.baseWidth * 2.2);
      chestFxCtx.lineTo(ray.length, ray.baseWidth * 2.2);
      chestFxCtx.lineTo(0, ray.baseWidth * 0.3);
      chestFxCtx.closePath();
      chestFxCtx.fill();
      chestFxCtx.restore();
    }

    // 2. Schockwellen rendern
    for (let i = chestShockwaves.length - 1; i >= 0; i--) {
      const sw = chestShockwaves[i];
      sw.radius += sw.speed;
      sw.alpha -= sw.decay;
      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        chestShockwaves.splice(i, 1);
        continue;
      }
      chestFxCtx.save();
      chestFxCtx.beginPath();
      chestFxCtx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      chestFxCtx.strokeStyle = sw.color;
      chestFxCtx.globalAlpha = Math.max(0, sw.alpha);
      chestFxCtx.lineWidth = Math.max(1, sw.lineWidth * sw.alpha);
      chestFxCtx.shadowBlur = 14;
      chestFxCtx.shadowColor = sw.color;
      chestFxCtx.stroke();
      chestFxCtx.restore();
    }

    // 3. Physikalische Partikel rendern
    for (let i = chestParticles.length - 1; i >= 0; i--) {
      const p = chestParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.life -= p.decay;
      p.rotation += p.rotSpeed;

      if (p.life <= 0) {
        chestParticles.splice(i, 1);
        continue;
      }

      chestFxCtx.save();
      chestFxCtx.translate(p.x, p.y);
      chestFxCtx.rotate(p.rotation);
      chestFxCtx.globalAlpha = Math.max(0, p.life);
      chestFxCtx.fillStyle = p.color;
      chestFxCtx.shadowBlur = 8;
      chestFxCtx.shadowColor = p.color;

      if (p.isStar) {
        const s = p.size * 1.35;
        chestFxCtx.beginPath();
        chestFxCtx.moveTo(0, -s);
        chestFxCtx.lineTo(s * 0.28, -s * 0.28);
        chestFxCtx.lineTo(s, 0);
        chestFxCtx.lineTo(s * 0.28, s * 0.28);
        chestFxCtx.lineTo(0, s);
        chestFxCtx.lineTo(-s * 0.28, s * 0.28);
        chestFxCtx.lineTo(-s, 0);
        chestFxCtx.lineTo(-s * 0.28, -s * 0.28);
        chestFxCtx.closePath();
        chestFxCtx.fill();
      } else {
        chestFxCtx.beginPath();
        chestFxCtx.arc(0, 0, p.size, 0, Math.PI * 2);
        chestFxCtx.fill();
      }
      chestFxCtx.restore();
    }

    // 4. Runen-Funken rendern
    for (let i = chestRuneMotes.length - 1; i >= 0; i--) {
      const m = chestRuneMotes[i];
      m.time += 1;
      m.x += m.vx + Math.sin(m.time * m.oscFreq) * m.oscAmp;
      m.y += m.vy;
      m.alpha -= m.decay;

      if (m.alpha <= 0) {
        chestRuneMotes.splice(i, 1);
        continue;
      }

      chestFxCtx.save();
      chestFxCtx.globalAlpha = Math.max(0, m.alpha);
      chestFxCtx.fillStyle = m.color;
      chestFxCtx.shadowBlur = 10;
      chestFxCtx.shadowColor = m.color;
      chestFxCtx.beginPath();
      chestFxCtx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      chestFxCtx.fill();
      chestFxCtx.restore();
    }

    // 5. Overwatch-Kometen & Sternschnuppenschauer rendern
    for (let i = activeComets.length - 1; i >= 0; i--) {
      const comet = activeComets[i];
      comet.update();
      comet.draw(chestFxCtx);
      if (comet.done && comet.tail.length === 0) {
        activeComets.splice(i, 1);
      }
    }

    if (chestParticles.length > 0 || chestShockwaves.length > 0 || chestLightRays.length > 0 || chestRuneMotes.length > 0 || activeComets.length > 0) {
      chestFxAnimId = requestAnimationFrame(updateChestFx);
    } else {
      chestFxAnimId = null;
      chestFxCtx.clearRect(0, 0, w, h);
    }
  }

  function stopChestFx() {
    if (chestFxAnimId) {
      cancelAnimationFrame(chestFxAnimId);
      chestFxAnimId = null;
    }
    chestParticles = [];
    chestShockwaves = [];
    chestLightRays = [];
    chestRuneMotes = [];
    activeComets = [];
    if (chestFxCtx && chestFxCanvas) {
      const rect = chestFxCanvas.getBoundingClientRect();
      chestFxCtx.clearRect(0, 0, rect.width || 450, rect.height || 260);
    }
  }

  function checkIfEquipped(itemType, itemId) {
    const u = (vaultData && vaultData.user) || (typeof WizardAuth !== 'undefined' ? WizardAuth.getUser() : null);
    if (!u) return false;
    let type = itemType || '';
    if (type.endsWith('s')) type = type.slice(0, -1);
    if (type === 'avatar_icon') return u.equipped_avatar_icon === itemId;
    if (type === 'avatar_frame') return u.equipped_avatar_frame === itemId;
    if (type === 'card_back') return u.equipped_card_back === itemId;
    if (type === 'table_skin') return u.equipped_table_skin === itemId;
    if (type === 'title') return u.equipped_title === itemId;
    if (type === 'lobby_background') return u.equipped_lobby_background === itemId;
    return false;
  }

  function openChest(tier) {
    if (unboxingApexTimer) { clearTimeout(unboxingApexTimer); unboxingApexTimer = null; }
    if (unboxingStageTimer) { clearTimeout(unboxingStageTimer); unboxingStageTimer = null; }
    if (unboxingFlashTimer) { clearTimeout(unboxingFlashTimer); unboxingFlashTimer = null; }

    activeUnboxingTier = tier;
    isUnboxingAnimationRunning = false;

    const unbox = document.getElementById('vaultUnboxingArea');
    const stage = document.getElementById('vaultUnboxingStage');
    const dropsArea = document.getElementById('vaultUnboxingDropsArea');
    const chestModel = document.getElementById('vaultChestInteractive');
    const prompt = document.getElementById('vaultChestClickPrompt');
    const titleEl = document.getElementById('vaultUnboxingTitle');
    const subTitle = document.getElementById('vaultUnboxingSubtitle');
    const imgClosed = document.getElementById('vaultChestImgClosed');
    const imgOpen = document.getElementById('vaultChestImgOpen');
    const flashOverlay = document.getElementById('vaultChestFlashOverlay');

    if (!unbox) return;

    unbox.style.display = 'flex';
    if (stage) stage.style.display = 'flex';
    if (dropsArea) dropsArea.style.display = 'none';

    const tNames = {
      wooden: 'Holztruhe des Lehrlings',
      silver: 'Silberne Magiertruhe',
      gold: 'Goldene Erzmagier-Kassette'
    };
    if (titleEl) titleEl.innerText = tNames[tier] || 'Arkane Schatztruhe';
    if (subTitle) subTitle.innerText = 'Ein uraltes Relikt der Zitadelle erwacht...';

    if (chestModel) {
      chestModel.className = `stylized-chest-wrapper chest-artwork-container chest-3d-model tier-${tier}`;
      chestModel.classList.remove('shaking', 'opened', 'bursting', 'has-open-sprite');
    }

    const closedImgs = {
      wooden: 'images/chests/chest_wooden_closed.png',
      silver: 'images/chests/chest_silver_closed.png',
      gold: 'images/chests/chest_gold_closed.png'
    };
    const openImgs = {
      wooden: 'images/chests/chest_wooden_closed.png',
      silver: 'images/chests/chest_silver_closed.png',
      gold: 'images/chests/chest_gold_open.png'
    };

    if (imgClosed) {
      imgClosed.src = closedImgs[tier] || closedImgs.wooden;
      imgClosed.style.display = 'block';
    }
    if (imgOpen) {
      imgOpen.src = openImgs[tier] || openImgs.gold;
      imgOpen.style.display = 'none';
    }
    if (flashOverlay) {
      flashOverlay.classList.remove('active');
    }

    if (prompt) {
      prompt.style.display = 'flex';
      prompt.innerHTML = `<span>✨</span><span>Klicke auf die Truhe, um das Siegel zu brechen!</span><span>✨</span>`;
    }

    initChestFxCanvas();

    if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
      WizardAudio.playCardSnap();
    }
  }

  function handleChestClick() {
    if (isUnboxingAnimationRunning || !activeUnboxingTier) return;
    isUnboxingAnimationRunning = true;
    chestClickStartTime = Date.now();

    const chestModel = document.getElementById('vaultChestInteractive');
    const prompt = document.getElementById('vaultChestClickPrompt');
    const subTitle = document.getElementById('vaultUnboxingSubtitle');

    if (chestModel) {
      chestModel.classList.remove('opened', 'bursting', 'has-open-sprite');
      chestModel.classList.add('shaking');
    }
    if (prompt) prompt.innerHTML = `<span>⚡</span><span>Das uralte Siegel bricht...</span><span>⚡</span>`;
    if (subTitle) subTitle.innerText = 'Arkane Energie entfesselt sich!';

    if (typeof WizardAudio !== 'undefined') {
      if (WizardAudio.playChestUnlock) WizardAudio.playChestUnlock();
      if (WizardAudio.playChestRumble) WizardAudio.playChestRumble();
    }

    const token = (typeof WizardAuth !== 'undefined') ? WizardAuth.getToken() : null;
    if (socket && socket.connected) {
      socket.emit('vault:openChest', { chestType: activeUnboxingTier, token });
    }
  }

  function onChestOpened(data) {
    if (!activeUnboxingTier) {
      isUnboxingAnimationRunning = false;
      return;
    }
    if (!data || !data.success) {
      showToast(data ? data.error : 'Fehler beim Öffnen der Truhe');
      isUnboxingAnimationRunning = false;
      const chestModel = document.getElementById('vaultChestInteractive');
      if (chestModel) chestModel.classList.remove('shaking');
      return;
    }
    if (data.user) {
      vaultData.user = data.user;
      renderHeader();
      renderChests();
    }

    const elapsed = Date.now() - chestClickStartTime;
    const remainingRumble = Math.max(0, 750 - elapsed);

    if (unboxingApexTimer) clearTimeout(unboxingApexTimer);
    unboxingApexTimer = setTimeout(() => {
      unboxingApexTimer = null;
      if (!activeUnboxingTier) return;
      executeChestApex(data);
    }, remainingRumble);
  }

  function executeChestApex(data) {
    if (!activeUnboxingTier) return;

    const chestModel = document.getElementById('vaultChestInteractive');
    const prompt = document.getElementById('vaultChestClickPrompt');
    const imgClosed = document.getElementById('vaultChestImgClosed');
    const imgOpen = document.getElementById('vaultChestImgOpen');
    const flashOverlay = document.getElementById('vaultChestFlashOverlay');

    if (chestModel) {
      chestModel.classList.remove('shaking');
      chestModel.classList.add('opened', 'bursting');
    }
    if (prompt) prompt.style.display = 'none';

    // Scheitelpunkt-Blitz
    if (flashOverlay) {
      flashOverlay.classList.remove('active');
      void flashOverlay.offsetWidth;
      flashOverlay.classList.add('active');
      if (unboxingFlashTimer) clearTimeout(unboxingFlashTimer);
      unboxingFlashTimer = setTimeout(() => {
        unboxingFlashTimer = null;
        if (flashOverlay) flashOverlay.classList.remove('active');
      }, 700);
    }

    // Sprite-Swap bei Apex falls Bild-Element vorhanden
    if (data.chestType === 'gold' && imgOpen && imgClosed) {
      if (chestModel) chestModel.classList.add('has-open-sprite');
      imgOpen.style.display = 'block';
    }

    // Dynamische Partikelfarbe nach höchster Seltenheit
    const rarityRank = { common: 1, rare: 2, epic: 3, legendary: 4 };
    const rarityColors = {
      legendary: '#fbbf24',
      epic: '#c084fc',
      rare: '#38bdf8',
      common: '#cbd5e1'
    };

    let highestRarity = 'common';
    let highestRank = 1;
    (data.rewards || []).forEach(r => {
      const rKey = (r.rarity || 'common').toLowerCase();
      const rank = rarityRank[rKey] || 1;
      if (rank > highestRank) {
        highestRank = rank;
        highestRarity = rKey;
      }
    });

    const burstColor = rarityColors[highestRarity] || '#fbbf24';

    if (typeof WizardAudio !== 'undefined') {
      if (WizardAudio.playLidPop) WizardAudio.playLidPop();
      if (WizardAudio.playChestBurst) WizardAudio.playChestBurst();
    }

    // Schockwellen, Lichtsäulen & Partikelfontäne
    triggerChestBurstFx(burstColor, data.chestType);

    // Overwatch-Kometen & Sternschnuppenschauer starten
    launchComets(data.rewards || [], data);

    // Gestaffelter Loot-Aufstieg als Rückfallebene
    if (unboxingStageTimer) clearTimeout(unboxingStageTimer);
    unboxingStageTimer = setTimeout(() => {
      unboxingStageTimer = null;
      if (!activeUnboxingTier) return;
      showUnboxingStage(data, false);
      isUnboxingAnimationRunning = false;
    }, 1800);
  }

  function showUnboxingStage(data, pendingCometMode) {
    const dropsArea = document.getElementById('vaultUnboxingDropsArea');
    const dropsCont = document.getElementById('vaultUnboxingDrops');
    const titleEl = document.getElementById('vaultUnboxingTitle');
    const subTitle = document.getElementById('vaultUnboxingSubtitle');
    const dustNotice = document.getElementById('vaultUnboxingDustNotice');
    if (!dropsArea || !dropsCont) return;

    dropsArea.style.display = 'flex';

    if (!pendingCometMode && dropsCont.children.length > 0) {
      const pendingCards = dropsCont.querySelectorAll('.drop-card-reveal.pending-comet');
      if (pendingCards.length > 0) {
        pendingCards.forEach((c) => {
          c.classList.remove('pending-comet');
          c.classList.add('revealed');
        });
      }
      return;
    }

    dropsCont.innerHTML = '';

    const tNames = { wooden: 'Holztruhe', silver: 'Silberne Magiertruhe', gold: 'Goldene Erzmagier-Kassette' };
    if (titleEl) titleEl.innerText = `${tNames[data.chestType] || 'Truhe'} geöffnet!`;
    if (subTitle) subTitle.innerText = 'Deine neuen Schätze:';

    if (dustNotice) {
      if (data.totalDustGained > 0) {
        dustNotice.innerText = `🔄 Duplikate erkannt: +${data.totalDustGained} Astralstaub gutgeschrieben!`;
        dustNotice.style.display = 'block';
      } else {
        dustNotice.style.display = 'none';
      }
    }

    const rewards = data.rewards || [];
    rewards.forEach((r, idx) => {
      const card = document.createElement('div');
      const baseClass = `drop-card-reveal rarity-${r.rarity || 'common'}`;
      card.className = pendingCometMode ? `${baseClass} pending-comet` : `${baseClass} revealed`;
      card.style.animationDelay = `${idx * 0.18}s`;

      const itemType = r.type || r.singularType || '';
      const visualHtml = getCosmeticVisualHtml(r, itemType);
      const dupHtml = r.isDuplicate ? `<div class="drop-card-duplicate">🔄 Duplikat (+${r.dustRefund} Staub)</div>` : '';
      const rarNames = { common: 'Gewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär' };

      const isEquipped = checkIfEquipped(itemType, r.id);
      const equipBtnHtml = isEquipped
        ? `<button type="button" class="btn-drop-equip equipped" disabled><span>✓</span> Ausgerüstet</button>`
        : `<button type="button" class="btn-drop-equip" data-item-type="${itemType}" data-item-id="${r.id}"><span>⚡</span> Ausrüsten</button>`;

      card.innerHTML = `
        ${visualHtml}
        <div class="drop-card-name">${escapeHtml(r.name)}</div>
        <div class="drop-card-rarity" style="color: ${r.rarityColor || '#cbd5e1'};">${rarNames[r.rarity] || r.rarity}</div>
        ${dupHtml}
        ${equipBtnHtml}
      `;

      // Direkte Ausrüstung auf der Beutekarte via socket.emit('wardrobe:equip')
      const equipBtn = card.querySelector('.btn-drop-equip');
      if (equipBtn && !isEquipped) {
        equipBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetType = equipBtn.dataset.itemType;
          const targetId = equipBtn.dataset.itemId;
          const token = (typeof WizardAuth !== 'undefined') ? WizardAuth.getToken() : null;

          if (socket && socket.connected) {
            socket.emit('wardrobe:equip', { itemType: targetType, itemId: targetId, token });
          }

          equipBtn.classList.add('equipped');
          equipBtn.disabled = true;
          equipBtn.innerHTML = '<span>✓</span> Ausgerüstet';

          if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
            WizardAudio.playCardSnap();
          }
          showToast(`"${r.name}" ausgerüstet! ✨`);
        });
      }

      dropsCont.appendChild(card);
    });

    fetchVaultState();
  }

  function finishUnboxing() {
    if (unboxingApexTimer) {
      clearTimeout(unboxingApexTimer);
      unboxingApexTimer = null;
    }
    if (unboxingStageTimer) {
      clearTimeout(unboxingStageTimer);
      unboxingStageTimer = null;
    }
    if (unboxingFlashTimer) {
      clearTimeout(unboxingFlashTimer);
      unboxingFlashTimer = null;
    }

    const unbox = document.getElementById('vaultUnboxingArea');
    const stage = document.getElementById('vaultUnboxingStage');
    const dropsArea = document.getElementById('vaultUnboxingDropsArea');
    const chestModel = document.getElementById('vaultChestInteractive');
    const imgClosed = document.getElementById('vaultChestImgClosed');
    const imgOpen = document.getElementById('vaultChestImgOpen');
    const flashOverlay = document.getElementById('vaultChestFlashOverlay');

    if (unbox) unbox.style.display = 'none';
    if (dropsArea) dropsArea.style.display = 'none';
    if (stage) stage.style.display = 'flex';
    if (chestModel) {
      chestModel.className = 'stylized-chest-wrapper chest-artwork-container chest-3d-model tier-wooden';
      chestModel.classList.remove('shaking', 'opened', 'bursting', 'has-open-sprite');
    }
    if (imgClosed) imgClosed.style.display = 'block';
    if (imgOpen) imgOpen.style.display = 'none';
    if (flashOverlay) flashOverlay.classList.remove('active');

    stopChestFx();
    activeUnboxingTier = null;
    isUnboxingAnimationRunning = false;
  }

  function getCosmeticVisualHtml(item, singularType) {
    if (!item) return '<div style="font-size:32px;line-height:48px;height:48px;margin-bottom:6px;">📜</div>';
    let type = singularType || item.singularType || item.type || '';
    if (type.endsWith('s')) type = type.slice(0, -1);

    const u = (vaultData && vaultData.user) || {};
    const initial = (u.username ? u.username.charAt(0).toUpperCase() : 'M');

    if (type === 'avatar_icon') {
      const isCustom = (item.id || '').startsWith('icon_');
      if (!isCustom) {
        return `
          <div style="width:52px;height:52px;border-radius:50%;border:2px solid #fbbf24;background:radial-gradient(circle at 50% 35%, #1e1b4b, #090301);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.7);margin-bottom:6px;">
            <span style="font-family:var(--font-heading);font-size:26px;color:#fde047;text-shadow:0 0 10px #f59e0b;">${initial}</span>
          </div>
        `;
      }
      const img = item.image || `/images/avatars/${item.id}.png`;
      const rarCol = (vaultData && vaultData.rarityConfig && vaultData.rarityConfig[item.rarity]) ? vaultData.rarityConfig[item.rarity].color : '#fbbf24';
      return `<img src="${img}" alt="" style="width:52px;height:52px;border-radius:50%;object-fit:cover;margin-bottom:6px;border:2px solid ${rarCol};box-shadow:0 3px 10px rgba(0,0,0,0.6);">`;
    }

    if (type === 'card_back') {
      const themeClass = `cardback-theme-${item.id}`;
      return `
        <div class="cosmetic-mini-cardback ${themeClass}" title="${escapeHtml(item.name || '')}">
          <div class="cosmetic-mini-cardback-inner"></div>
        </div>
      `;
    }

    if (type === 'table_skin') {
      const themeClass = `table-theme-${item.id}`;
      return `
        <div class="cosmetic-mini-table ${themeClass}" title="${escapeHtml(item.name || '')}"></div>
      `;
    }

    if (type === 'avatar_frame') {
      const frameId = item.id || 'none';
      return `
        <div class="seat-avatar frame-${frameId}" style="width:48px;height:54px;margin-bottom:6px;box-shadow:0 3px 8px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;" title="${escapeHtml(item.name || '')}">
          <span style="font-family:var(--font-heading);font-size:22px;color:var(--gold-bright);">${initial}</span>
        </div>
      `;
    }

    if (type === 'lobby_background') {
      const themeClass = `lobby-theme-${item.id}`;
      return `
        <div class="cosmetic-mini-lobby ${themeClass}" title="${escapeHtml(item.name || '')}"></div>
      `;
    }

    if (type === 'title') {
      return `
        <div class="cosmetic-mini-title" title="${escapeHtml(item.name || '')}">
          <span style="font-size:11px;font-weight:bold;color:#78350f;letter-spacing:0.5px;">TITEL</span>
        </div>
      `;
    }

    if (item.image) {
      return `<img src="${item.image}" alt="" style="width:50px;height:50px;border-radius:6px;object-fit:cover;margin-bottom:6px;">`;
    }
    return `<div style="font-size:24px;line-height:48px;height:48px;margin-bottom:6px;">✨</div>`;
  }

  function claimMilestone(id) {
    const token = (typeof WizardAuth !== 'undefined') ? WizardAuth.getToken() : null;
    if (socket && socket.connected) {
      socket.emit('vault:claimMilestone', { milestoneId: id, token });
    }
  }

  function onMilestoneClaimed(data) {
    if (!data || !data.success) return;
    showToast('Wöchentliche Belohnung eingelöst! 🎉');
    if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
      WizardAudio.playCardSnap();
    }
    fetchVaultState();
  }

  function renderWardrobe() {
    if (!vaultData || !vaultData.user) return;
    const u = vaultData.user;
    const previewImg = document.getElementById('wardrobePreviewAvatarImg');
    const previewInitial = document.getElementById('wardrobePreviewInitial');
    const previewWrap = document.getElementById('wardrobePreviewAvatarWrapper');
    const previewName = document.getElementById('wardrobePreviewName');
    const previewTitle = document.getElementById('wardrobePreviewTitle');
    const previewDeck = document.getElementById('wardrobePreviewDeck');
    const previewTable = document.getElementById('wardrobePreviewTable');
    const previewFrame = document.getElementById('wardrobePreviewFrame');
    const previewLobby = document.getElementById('wardrobePreviewLobby');

    const initial = u.username ? u.username.charAt(0).toUpperCase() : 'M';
    if (previewName) previewName.innerText = u.username || 'Magier';
    if (previewTitle) previewTitle.innerText = u.title || 'Zauberlehrling';

    if (previewWrap) {
      const f = u.equipped_avatar_frame || 'none';
      previewWrap.className = `wardrobe-mirror-avatar-wrap seat-avatar frame-${f}`;
    }

    const a = u.avatar_id || 'default';
    if (previewInitial && previewImg) {
      if (!a || a === 'default' || a === 'wizard_blue' || !a.startsWith('icon_')) {
        previewInitial.style.display = 'flex';
        previewInitial.innerText = initial;
        previewImg.style.display = 'none';
      } else {
        previewInitial.style.display = 'none';
        previewImg.style.display = 'block';
        previewImg.src = `/images/avatars/${a}.png`;
        previewImg.onerror = function() {
          previewImg.style.display = 'none';
          previewInitial.style.display = 'flex';
          previewInitial.innerText = initial;
        };
      }
    }

    const cat = vaultData.catalog || {};
    const deckItem = (cat.card_backs || []).find(i => i.id === (u.equipped_card_back || 'default'));
    const tableItem = (cat.table_skins || []).find(i => i.id === (u.equipped_table_skin || 'emerald_felt'));
    const frameItem = (cat.avatar_frames || []).find(i => i.id === (u.equipped_avatar_frame || 'none'));
    const lobbyItem = (cat.lobby_backgrounds || []).find(i => i.id === (u.equipped_lobby_background || 'citadel_halls'));

    if (previewDeck) previewDeck.innerText = deckItem ? deckItem.name : 'Novizen-Pergament';
    if (previewTable) previewTable.innerText = tableItem ? tableItem.name : 'Klassischer Filz';
    if (previewFrame) previewFrame.innerText = frameItem ? frameItem.name : 'Schlichter Goldring';
    if (previewLobby) previewLobby.innerText = lobbyItem ? lobbyItem.name : 'Hallen der Zitadelle';

    const previewDeckBox = document.getElementById('wardrobePreviewDeckBox');
    if (previewDeckBox) previewDeckBox.className = `cosmetic-mini-cardback cardback-theme-${u.equipped_card_back || 'default'}`;
    const previewTableBox = document.getElementById('wardrobePreviewTableBox');
    if (previewTableBox) previewTableBox.className = `cosmetic-mini-table table-theme-${u.equipped_table_skin || 'emerald_felt'}`;
    const previewLobbyBox = document.getElementById('wardrobePreviewLobbyBox');
    if (previewLobbyBox) previewLobbyBox.className = `cosmetic-mini-lobby lobby-theme-${u.equipped_lobby_background || 'citadel_halls'}`;
    const previewStage = document.getElementById('wardrobePreviewStage');
    if (previewStage) previewStage.className = `wardrobe-preview-stage lobby-theme-${u.equipped_lobby_background || 'citadel_halls'}`;

    renderWardrobeItems();
  }

  function renderWardrobeItems() {
    if (!vaultData || !vaultData.catalog) return;
    const grid = document.getElementById('wardrobeItemsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const cat = vaultData.catalog[currentWardrobeCategory] || [];
    const inv = vaultData.inventory || [];
    const u = vaultData.user || {};

    let equippedId = '';
    let singularType = currentWardrobeCategory;
    if (singularType.endsWith('s')) singularType = singularType.slice(0, -1);

    if (singularType === 'avatar_icon') equippedId = (u.avatar_id && u.avatar_id !== 'wizard_blue') ? u.avatar_id : 'default';
    else if (singularType === 'avatar_frame') equippedId = u.equipped_avatar_frame || 'none';
    else if (singularType === 'title') equippedId = u.title || 'Zauberlehrling';
    else if (singularType === 'card_back') equippedId = u.equipped_card_back || 'default';
    else if (singularType === 'table_skin') equippedId = u.equipped_table_skin || 'emerald_felt';
    else if (singularType === 'lobby_background') equippedId = u.equipped_lobby_background || 'citadel_halls';

    const previewImg = document.getElementById('wardrobePreviewAvatarImg');
    const previewInitial = document.getElementById('wardrobePreviewInitial');
    const previewWrap = document.getElementById('wardrobePreviewAvatarWrapper');
    const previewDeck = document.getElementById('wardrobePreviewDeck');
    const previewTable = document.getElementById('wardrobePreviewTable');
    const previewFrame = document.getElementById('wardrobePreviewFrame');
    const previewLobby = document.getElementById('wardrobePreviewLobby');
    const previewTitle = document.getElementById('wardrobePreviewTitle');
    const previewDeckBox = document.getElementById('wardrobePreviewDeckBox');
    const previewTableBox = document.getElementById('wardrobePreviewTableBox');
    const previewLobbyBox = document.getElementById('wardrobePreviewLobbyBox');
    const previewStage = document.getElementById('wardrobePreviewStage');
    const initial = u.username ? u.username.charAt(0).toUpperCase() : 'M';

    grid.onmouseleave = () => {
      // Magier-Spiegel auf echten ausgerüsteten Stand zurücksetzen
      if (previewWrap) previewWrap.className = `wardrobe-mirror-avatar-wrap seat-avatar frame-${u.equipped_avatar_frame || 'none'}`;
      if (previewInitial && previewImg) {
        const curA = u.avatar_id || 'default';
        if (!curA || curA === 'default' || curA === 'wizard_blue' || !curA.startsWith('icon_')) {
          previewInitial.style.display = 'flex';
          previewInitial.innerText = initial;
          previewImg.style.display = 'none';
        } else {
          previewInitial.style.display = 'none';
          previewImg.style.display = 'block';
          previewImg.src = `/images/avatars/${curA}.png`;
        }
      }
      const catList = vaultData.catalog || {};
      const curDeck = (catList.card_backs || []).find(i => i.id === (u.equipped_card_back || 'default'));
      const curTable = (catList.table_skins || []).find(i => i.id === (u.equipped_table_skin || 'emerald_felt'));
      const curFrame = (catList.avatar_frames || []).find(i => i.id === (u.equipped_avatar_frame || 'none'));
      const curLobby = (catList.lobby_backgrounds || []).find(i => i.id === (u.equipped_lobby_background || 'citadel_halls'));
      if (previewDeck) previewDeck.innerText = curDeck ? curDeck.name : 'Novizen-Pergament';
      if (previewTable) previewTable.innerText = curTable ? curTable.name : 'Klassischer Filz';
      if (previewFrame) previewFrame.innerText = curFrame ? curFrame.name : 'Schlichter Goldring';
      if (previewLobby) previewLobby.innerText = curLobby ? curLobby.name : 'Hallen der Zitadelle';
      if (previewTitle) previewTitle.innerText = u.title || 'Zauberlehrling';

      if (previewDeckBox) previewDeckBox.className = `cosmetic-mini-cardback cardback-theme-${u.equipped_card_back || 'default'}`;
      if (previewTableBox) previewTableBox.className = `cosmetic-mini-table table-theme-${u.equipped_table_skin || 'emerald_felt'}`;
      if (previewLobbyBox) previewLobbyBox.className = `cosmetic-mini-lobby lobby-theme-${u.equipped_lobby_background || 'citadel_halls'}`;
      if (previewStage) previewStage.className = `wardrobe-preview-stage lobby-theme-${u.equipped_lobby_background || 'citadel_halls'}`;
    };

    // Nach Seltenheit sortieren (Common -> Rare -> Epic -> Legendary)
    const rarityOrder = { common: 1, rare: 2, epic: 3, legendary: 4 };
    const sortedCat = [...cat].sort((a, b) => {
      const rA = rarityOrder[a.rarity] || 1;
      const rB = rarityOrder[b.rarity] || 1;
      if (rA !== rB) return rA - rB;
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return (a.name || '').localeCompare(b.name || '', 'de');
    });

    sortedCat.forEach(item => {
      const isOwned = item.isDefault || inv.some(i => i.item_id === item.id);
      const isEquipped = (item.id === equippedId);

      const card = document.createElement('div');
      card.className = `cosmetic-item-card ${isEquipped ? 'equipped' : ''} ${!isOwned ? 'locked' : ''}`;

      const visualHtml = getCosmeticVisualHtml(item, singularType);

      let btnHtml = '';
      if (isEquipped) {
        btnHtml = `<button type="button" class="btn-equip is-equipped" disabled>Ausgerüstet</button>`;
      } else if (isOwned) {
        btnHtml = `<button type="button" class="btn-equip btn-do-equip" data-type="${singularType}" data-id="${item.id}">Ausrüsten</button>`;
      } else {
        btnHtml = `<button type="button" class="btn-equip" disabled style="opacity:0.5;background:#374151;border-color:#6b7280;">🔒 Gesperrt</button>`;
      }

      const rarNames = { common: 'Gewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär' };
      const rarCol = (vaultData.rarityConfig && vaultData.rarityConfig[item.rarity]) ? vaultData.rarityConfig[item.rarity].color : '#cbd5e1';

      card.innerHTML = `
        ${visualHtml}
        <div style="font-size:12px;font-weight:bold;color:#fef3c7;margin-bottom:2px;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
        <div style="font-size:10px;font-weight:700;color:${rarCol};">${rarNames[item.rarity] || item.rarity}</div>
        ${btnHtml}
      `;

      // Interaktive Live-Vorschau im Magier-Spiegel bei Hover & Klick
      const triggerPreview = () => {
        if (singularType === 'avatar_icon') {
          if (!item.id || item.id === 'default' || !item.id.startsWith('icon_')) {
            if (previewInitial) { previewInitial.style.display = 'flex'; previewInitial.innerText = initial; }
            if (previewImg) previewImg.style.display = 'none';
          } else {
            if (previewInitial) previewInitial.style.display = 'none';
            if (previewImg) {
              previewImg.style.display = 'block';
              previewImg.src = `/images/avatars/${item.id}.png`;
            }
          }
        } else if (singularType === 'avatar_frame') {
          if (previewWrap) previewWrap.className = `wardrobe-mirror-avatar-wrap seat-avatar frame-${item.id}`;
          if (previewFrame) previewFrame.innerText = item.name;
        } else if (singularType === 'card_back') {
          if (previewDeck) previewDeck.innerText = item.name;
          if (previewDeckBox) previewDeckBox.className = `cosmetic-mini-cardback cardback-theme-${item.id}`;
        } else if (singularType === 'table_skin') {
          if (previewTable) previewTable.innerText = item.name;
          if (previewTableBox) previewTableBox.className = `cosmetic-mini-table table-theme-${item.id}`;
        } else if (singularType === 'lobby_background') {
          if (previewLobby) previewLobby.innerText = item.name;
          if (previewLobbyBox) previewLobbyBox.className = `cosmetic-mini-lobby lobby-theme-${item.id}`;
          if (previewStage) previewStage.className = `wardrobe-preview-stage lobby-theme-${item.id}`;
        } else if (singularType === 'title') {
          if (previewTitle) previewTitle.innerText = item.name;
        }
      };

      card.addEventListener('mouseenter', triggerPreview);
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-do-equip')) {
          triggerPreview();
        }
      });

      const eqBtn = card.querySelector('.btn-do-equip');
      if (eqBtn) {
        eqBtn.addEventListener('click', () => {
          equipItem(singularType, item.id);
        });
      }

      grid.appendChild(card);
    });
  }

  function equipItem(itemType, itemId) {
    const token = (typeof WizardAuth !== 'undefined') ? WizardAuth.getToken() : null;
    if (socket && socket.connected) {
      if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
        WizardAudio.playCardSnap();
      }
      socket.emit('vault:equip', { itemType, itemId, token });
    }
  }

  function onEquipped(data) {
    if (!data || !data.success) {
      showToast(data ? data.error : 'Fehler beim Ausrüsten');
      return;
    }
    showToast('Ausrüstung gewechselt! ✨');
    if (data.user) {
      vaultData.user = data.user;
      if (typeof WizardAuth !== 'undefined') {
        if (WizardAuth.setCachedUser) WizardAuth.setCachedUser(data.user);
        if (WizardAuth.updatePhoenixVault) WizardAuth.updatePhoenixVault(data.user, { inventory: vaultData.inventory });
      }
      if (data.user.equipped_lobby_background && typeof applyLobbyTheme === 'function') {
        applyLobbyTheme(data.user.equipped_lobby_background);
      }
      renderHeader();
      renderWardrobe();
      if (typeof WizardAuth !== 'undefined' && WizardAuth.renderProfileData) {
        WizardAuth.renderProfileData();
      }
    }
    if (typeof WizardAuth !== 'undefined' && WizardAuth.renderLobbyBar) {
      WizardAuth.renderLobbyBar();
    }
  }

  function renderForge() {
    if (!vaultData || !vaultData.catalog) return;
    const grid = document.getElementById('forgeItemsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const inv = vaultData.inventory || [];
    const ownedIds = new Set(inv.map(i => i.item_id));
    const dust = (vaultData.user && vaultData.user.astral_dust) || 0;
    const rarConfig = vaultData.rarityConfig || {};

    const categories = (currentForgeCategory === 'all')
      ? ['avatar_icons', 'avatar_frames', 'titles', 'card_backs', 'table_skins', 'lobby_backgrounds']
      : [currentForgeCategory];

    let itemsToForge = [];
    categories.forEach(catKey => {
      let singularType = catKey;
      if (singularType.endsWith('s')) singularType = singularType.slice(0, -1);
      const list = vaultData.catalog[catKey] || [];
      list.forEach(item => {
        if (!item.isDefault && !ownedIds.has(item.id)) {
          itemsToForge.push({ ...item, singularType });
        }
      });
    });

    if (itemsToForge.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: #a855f7; font-style: italic;">Du besitzt bereits alle Kosmetika in dieser Kategorie! Meisterhaft! 👑</div>`;
      return;
    }

    itemsToForge.forEach(item => {
      const card = document.createElement('div');
      card.className = 'forge-item-card';

      const rarity = item.rarity || 'common';
      const meta = rarConfig[rarity] || { color: '#cbd5e1', dustCost: 60 };
      const cost = meta.dustCost || 60;
      const canAfford = (dust >= cost);

      const visualHtml = getCosmeticVisualHtml(item, item.singularType);

      card.innerHTML = `
        ${visualHtml}
        <div style="font-size:12.5px;font-weight:bold;color:#fef3c7;margin-bottom:2px;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
        <div style="font-size:10.5px;font-weight:700;color:${meta.color};">${rarity.toUpperCase()}</div>
        <div style="font-size:11.5px;color:#e9d5ff;margin:4px 0 2px;">Kosten: ✨ ${cost}</div>
        <button type="button" class="btn-forge btn-do-craft" data-type="${item.singularType}" data-id="${item.id}" ${canAfford ? '' : 'disabled'}>
          ${canAfford ? 'Schmieden' : 'Zu wenig Staub'}
        </button>
      `;

      const craftBtn = card.querySelector('.btn-do-craft');
      if (craftBtn && canAfford) {
        craftBtn.addEventListener('click', () => {
          craftItem(item.singularType, item.id);
        });
      }

      grid.appendChild(card);
    });
  }

  function craftItem(itemType, itemId) {
    const token = (typeof WizardAuth !== 'undefined') ? WizardAuth.getToken() : null;
    if (socket && socket.connected) {
      if (typeof WizardAudio !== 'undefined' && WizardAudio.playTurnChime) {
        WizardAudio.playTurnChime();
      }
      socket.emit('vault:craft', { itemType, itemId, token });
    }
  }

  function onCrafted(data) {
    if (!data || !data.success) {
      showToast(data ? data.error : 'Fehler beim Schmieden');
      return;
    }
    showToast(`"${data.item ? data.item.name : 'Gegenstand'}" erfolgreich geschmiedet! ✨`);
    if (data.user) {
      vaultData.user = data.user;
    }
    fetchVaultState();
  }

  function onMatchProgressionSummary(data) {
    if (!data) return;
    const modal = document.getElementById('progression-modal');
    if (!modal) return;

    const subEl = document.getElementById('progressionSubtitle');
    const levelBanner = document.getElementById('progressionLevelUpBanner');
    const newLvlBadge = document.getElementById('progNewLevelBadge');
    const lvlHint = document.getElementById('progLevelUpRewardHint');
    const curLvlTxt = document.getElementById('progCurrentLevelTxt');
    const xpNumTxt = document.getElementById('progXpNumbersTxt');
    const xpFill = document.getElementById('progXpBarFill');
    const breakdownEl = document.getElementById('progressionXpBreakdown');
    const modalCard = modal.querySelector('.progression-modal-card');

    if (subEl) subEl.innerText = `+${data.gainedXP || 0} Erfahrungs-Punkte gewonnen`;
    if (levelBanner) levelBanner.style.display = 'none';
    if (modalCard) modalCard.classList.remove('levelup-burst-effect');

    if (breakdownEl) {
      breakdownEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;"><span>🎮 Teilnahme &amp; Runden:</span><b>+${Math.min(300, (data.gainedXP || 0) > 100 ? 200 : 100)} XP</b></div>
        <div style="display:flex;justify-content:space-between;"><span>🏆 Platzierung &amp; Sieg:</span><b>+${(data.gainedXP || 0) >= 250 ? 150 : 50} XP</b></div>
        <div style="display:flex;justify-content:space-between;"><span>🎯 Präzise Vorhersagen:</span><b>+${Math.max(0, (data.gainedXP || 0) - 250)} XP</b></div>
      `;
    }

    const btnProgVaultDefault = document.getElementById('btnProgressionOpenVault');
    if (btnProgVaultDefault) {
      btnProgVaultDefault.innerHTML = `<span>🗝️</span> <span>Schatzkammer öffnen</span>`;
      btnProgVaultDefault.onclick = () => {
        const pModal = document.getElementById('progression-modal');
        if (pModal) pModal.style.display = 'none';
        openVault('chests');
      };
    }

    modal.style.display = 'flex';

    const isLevelUp = Boolean(data.leveledUp);
    const targetLevel = data.newLevel || 1;
    const targetXp = data.currentXP || 0;
    const oldLevel = data.oldLevel || (isLevelUp ? Math.max(1, targetLevel - 1) : targetLevel);

    let startXp = 0;
    if (!isLevelUp) {
      startXp = Math.max(0, targetXp - (data.gainedXP || 0));
    } else {
      const totalXpEarned = data.gainedXP || 0;
      const remainingInNew = targetXp;
      const neededInOld = Math.max(0, totalXpEarned - remainingInNew);
      startXp = Math.max(0, 1000 - neededInOld);
    }

    if (curLvlTxt) curLvlTxt.innerText = oldLevel;
    if (xpNumTxt) xpNumTxt.innerText = `${startXp} / 1000 XP`;
    if (xpFill) xpFill.style.width = `${Math.min(100, Math.round((startXp / 1000) * 100))}%`;

    const stepCount = 20;
    let currentStep = 0;
    const phase1Target = isLevelUp ? 1000 : targetXp;
    const phase1Diff = phase1Target - startXp;

    const tickInterval = setInterval(() => {
      currentStep++;
      const progress = Math.min(1, currentStep / stepCount);
      const currentVal = Math.round(startXp + phase1Diff * progress);

      if (xpNumTxt) xpNumTxt.innerText = `${currentVal} / 1000 XP`;
      if (xpFill) xpFill.style.width = `${Math.min(100, Math.round((currentVal / 1000) * 100))}%`;

      if (typeof WizardAudio !== 'undefined' && WizardAudio.playTick) {
        WizardAudio.playTick();
      }

      if (currentStep >= stepCount) {
        clearInterval(tickInterval);

        if (isLevelUp) {
          setTimeout(() => {
            if (curLvlTxt) curLvlTxt.innerText = targetLevel;
            if (levelBanner) levelBanner.style.display = 'block';
            if (newLvlBadge) newLvlBadge.innerText = targetLevel;
            if (modalCard) modalCard.classList.add('levelup-burst-effect');

            let rewardTxt = 'Belohnung: ';
            let awardedTier = 'wooden';
            const ca = data.chestsAwarded || {};
            if (ca.gold > 0) {
              rewardTxt += `${ca.gold}x Goldene Erzmagier-Kassette 👑`;
              awardedTier = 'gold';
            } else if (ca.silver > 0) {
              rewardTxt += `${ca.silver}x Silberne Magiertruhe 🥈`;
              awardedTier = 'silver';
            } else {
              rewardTxt += `${ca.wooden || 1}x Holztruhe des Lehrlings 🪵`;
              awardedTier = 'wooden';
            }
            if (lvlHint) lvlHint.innerText = `🎁 ${rewardTxt}`;

            const btnProgVault = document.getElementById('btnProgressionOpenVault');
            if (btnProgVault) {
              btnProgVault.innerHTML = `<span>🎁</span> <span>Jetzt Truhe entriegeln</span>`;
              btnProgVault.onclick = () => {
                const modal = document.getElementById('progression-modal');
                if (modal) modal.style.display = 'none';
                openVault('chests');
                setTimeout(() => {
                  openChest(awardedTier);
                }, 150);
              };
            }

            if (typeof WizardAudio !== 'undefined' && WizardAudio.playLevelUp) {
              WizardAudio.playLevelUp();
            }

            if (xpFill) xpFill.style.width = '0%';
            if (xpNumTxt) xpNumTxt.innerText = `0 / 1000 XP`;

            let phase2Step = 0;
            const phase2Steps = 15;
            const phase2Interval = setInterval(() => {
              phase2Step++;
              const p2Progress = Math.min(1, phase2Step / phase2Steps);
              const p2Val = Math.round(targetXp * p2Progress);
              if (xpNumTxt) xpNumTxt.innerText = `${p2Val} / 1000 XP`;
              if (xpFill) xpFill.style.width = `${Math.min(100, Math.round((p2Val / 1000) * 100))}%`;
              if (typeof WizardAudio !== 'undefined' && WizardAudio.playTick) {
                WizardAudio.playTick();
              }

              if (phase2Step >= phase2Steps) {
                clearInterval(phase2Interval);
                finalizeProgression();
              }
            }, 45);
          }, 350);
        } else {
          finalizeProgression();
        }
      }
    }, 45);

    function finalizeProgression() {
      if (curLvlTxt) curLvlTxt.innerText = targetLevel;
      if (xpNumTxt) xpNumTxt.innerText = `${targetXp} / 1000 XP`;
      if (xpFill) xpFill.style.width = `${Math.min(100, Math.round((targetXp / 1000) * 100))}%`;
      const totalChests = (data.chests && (data.chests.wooden + data.chests.silver + data.chests.gold)) || 0;
      updateVaultBadgeCount(totalChests);
      fetchVaultState();
    }
  }

  function init() {
    const btnOpenVault = document.getElementById('btnOpenVault');
    if (btnOpenVault) btnOpenVault.addEventListener('click', () => openVault('chests'));

    const btnWaitingVault = document.getElementById('waiting-vault-toggle');
    if (btnWaitingVault) btnWaitingVault.addEventListener('click', () => openVault('chests'));

    const btnClose = document.getElementById('btnVaultClose');
    if (btnClose) btnClose.addEventListener('click', closeVault);

    const vaultCloseBtn = document.getElementById('vaultCloseBtn');
    if (vaultCloseBtn) vaultCloseBtn.addEventListener('click', closeVault);

    const btnModalClose = document.getElementById('vaultModalClose');
    if (btnModalClose) btnModalClose.addEventListener('click', closeVault);

    // Alle "Zurück zur Zitadelle"-Schaltflächen in den Tab-Fußzeilen
    const footerCloseBtns = document.querySelectorAll('.btn-vault-close-action');
    footerCloseBtns.forEach(btn => {
      btn.addEventListener('click', closeVault);
    });

    // Klick auf den abgedunkelten Hintergrund (Backdrop)
    const vaultModalEl = document.getElementById('vault-modal');
    if (vaultModalEl) {
      vaultModalEl.addEventListener('click', (e) => {
        if (e.target === vaultModalEl) {
          closeVault();
        }
      });
    }

    const tabChests = document.getElementById('tabVaultChests');
    if (tabChests) tabChests.addEventListener('click', () => switchTab('chests'));

    const tabWardrobe = document.getElementById('tabVaultWardrobe');
    if (tabWardrobe) tabWardrobe.addEventListener('click', () => switchTab('wardrobe'));

    const tabForge = document.getElementById('tabVaultForge');
    if (tabForge) tabForge.addEventListener('click', () => switchTab('forge'));

    const bw = document.getElementById('btnOpenWoodenChest');
    if (bw) bw.addEventListener('click', () => openChest('wooden'));

    const bs = document.getElementById('btnOpenSilverChest');
    if (bs) bs.addEventListener('click', () => openChest('silver'));

    const bg = document.getElementById('btnOpenGoldChest');
    if (bg) bg.addEventListener('click', () => openChest('gold'));

    const btnFinish = document.getElementById('btnFinishUnboxing');
    if (btnFinish) btnFinish.addEventListener('click', finishUnboxing);

    const btnUnboxClose = document.getElementById('btnVaultUnboxingClose');
    if (btnUnboxClose) btnUnboxClose.addEventListener('click', finishUnboxing);

    const unboxOverlay = document.getElementById('vaultUnboxingArea');
    if (unboxOverlay) {
      unboxOverlay.addEventListener('click', (e) => {
        if (e.target === unboxOverlay && !isUnboxingAnimationRunning) {
          finishUnboxing();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        const unbox = document.getElementById('vaultUnboxingArea');
        if (unbox && unbox.style.display !== 'none' && !isUnboxingAnimationRunning) {
          finishUnboxing();
          return;
        }
        const vaultModal = document.getElementById('vault-modal');
        if (vaultModal && vaultModal.style.display !== 'none') {
          closeVault();
        }
      }
    });

    const chestInteractive = document.getElementById('vaultChestInteractive');
    if (chestInteractive) {
      chestInteractive.addEventListener('click', handleChestClick);
    }

    const wardrobePills = document.querySelectorAll('#vaultPanelWardrobe .cosmetics-filter-pill, #vaultPanelWardrobe .cosmetic-cat-pill');
    wardrobePills.forEach(pill => {
      pill.addEventListener('click', () => {
        wardrobePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentWardrobeCategory = pill.dataset.category || pill.dataset.cat || 'avatar_icons';
        renderWardrobeItems();
      });
    });

    const forgePills = document.querySelectorAll('#vaultPanelForge .cosmetics-filter-pill, #vaultPanelForge .forge-cat-pill');
    forgePills.forEach(pill => {
      pill.addEventListener('click', () => {
        forgePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentForgeCategory = pill.dataset.forgeCategory || pill.dataset.category || pill.dataset.cat || 'all';
        renderForge();
      });
    });

    const btnProgClose = document.getElementById('btnProgressionClose');
    if (btnProgClose) {
      btnProgClose.addEventListener('click', () => {
        const modal = document.getElementById('progression-modal');
        if (modal) modal.style.display = 'none';
      });
    }

    const btnProgVault = document.getElementById('btnProgressionOpenVault');
    if (btnProgVault) {
      btnProgVault.addEventListener('click', () => {
        const modal = document.getElementById('progression-modal');
        if (modal) modal.style.display = 'none';
        openVault('chests');
      });
    }

    if (typeof socket !== 'undefined' && socket) {
      socket.on('vault:state', onVaultStateReceived);
      socket.on('vault:chestOpened', onChestOpened);
      socket.on('vault:equipped', onEquipped);
      socket.on('vault:crafted', onCrafted);
      socket.on('vault:milestoneClaimed', onMilestoneClaimed);
      socket.on('progression:matchSummary', (data) => {
        pendingProgressionSummary = data;
        const highlightModal = document.getElementById('highlight-modal');
        const mvpModal = document.getElementById('mvp-voting-modal');
        const isSequencing = (highlightModal && highlightModal.style.display !== 'none') || (mvpModal && mvpModal.style.display !== 'none');
        if (!isSequencing && (!currentGameState || currentGameState === 'lobby' || currentGameState === 'game_over')) {
          onMatchProgressionSummary(data);
        }
      });
    }
  }

  return {
    init,
    openVault,
    closeVault,
    switchTab,
    fetchVaultState,
    updateBadges,
    equipItem,
    openChest,
    handleChestClick,
    getCosmeticVisualHtml,
    getVaultData: () => vaultData,
    renderWardrobe,
    renderWardrobeItems,
    renderForge,
    showMatchProgression: onMatchProgressionSummary
  };
})();
if (typeof window !== 'undefined') window.WizardVault = WizardVault;

// --- MAGIER-PROFIL & SPIELER-DETAILS MODAL (SPIELTISCH & GRIMOIRE DER GEFÄHRTEN) ---
function openPlayerDetailModal(data, source = 'table') {
  try {
    const modal = document.getElementById('player-detail-modal');
    if (!modal || !data) return;

    const isTable = (source === 'table' || source === 'podium');
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

    const isBot = Boolean(data.isBot || (data.sessionId && String(data.sessionId).startsWith('bot_')) || (data.name && data.name.includes('(KI)')));
    const name = isFriendSource ? data.username : data.name;
    const initial = isFriendSource ? (data.username ? data.username.charAt(0).toUpperCase() : '?') : (isBot ? '🤖' : (data.name ? data.name.charAt(0).toUpperCase() : '?'));
    const title = data.title || (isBot ? 'Virtueller Zitadellen-Gefährte' : 'Magier der Zitadelle');

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
      } else if (isBot) {
        statusEl.innerHTML = '<span style="color: #c084fc; font-weight: bold;">🤖 Virtueller Rat</span>';
      } else {
        statusEl.innerHTML = data.connected === false
          ? '<span style="color: #f87171; font-weight: bold;">● Getrennt</span>'
          : '<span style="color: #86efac; font-weight: bold;">● Am Spieltisch</span>';
      }
    }

    // Rang / Level
    if (isBot) {
      const diff = data.difficulty || 'master';
      const lore = getBotLore(name, diff);

      if (titleEl) titleEl.innerText = lore.title;
      if (divisionEl) {
        divisionEl.innerText = lore.level;
        divisionEl.style.color = (diff === 'novice' ? '#86efac' : (diff === 'archmage' ? '#d8b4fe' : '#93c5fd'));
      }
      if (srEl) {
        srEl.innerText = (diff === 'novice' ? 'Zauber-Lehrling' : (diff === 'archmage' ? 'Oberster Rat' : 'Meister-Magier'));
      }
      if (crestEl) {
        crestEl.innerHTML = (diff === 'novice' ? '🌱' : (diff === 'archmage' ? '⚡' : '✨'));
      }
      if (botDiffEl) {
        botDiffEl.style.display = 'none';
        botDiffEl.innerHTML = '';
      }

      // Lore-Profil statt Zahlen-Statistiken
      if (statsTitleEl) {
        statsTitleEl.innerText = 'Grimoire-Chronik & Wesensart';
      }
      if (statsGridEl) {
        statsGridEl.style.display = 'block';
        statsGridEl.innerHTML = `
          <div style="background: rgba(18, 10, 6, 0.75); border: 1.5px solid var(--gold-antique); border-radius: 10px; padding: 12px 14px; text-align: left; box-shadow: 0 4px 18px rgba(0,0,0,0.6);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px dashed rgba(212,163,89,0.35); padding-bottom: 6px;">
              <span style="font-family: var(--font-subheading); color: var(--gold-bright); font-size: 13px; font-weight: bold;">
                📜 ${escapeHtml(lore.title)}
              </span>
              <span style="font-family: var(--font-medieval); color: #86efac; font-size: 13px; font-weight: 900; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(134,239,172,0.4);">
                ${escapeHtml(lore.level)}
              </span>
            </div>
            <div style="font-size: 11.5px; color: #f7eedb; line-height: 1.45; margin-bottom: 8px;">
              ${escapeHtml(lore.story)}
            </div>
            <div style="font-size: 11px; color: #d6be90; display: flex; align-items: center; gap: 5px;">
              <span style="color: var(--gold-bright);">Taktik:</span>
              <span style="font-style: italic; color: #fde047;">${escapeHtml(lore.philosophy)}</span>
            </div>
          </div>
        `;
      }
    } else {
      // Normaler menschlicher Spieler
      const sr = isFriendSource ? (data.skill_rating || 1000) : (data.skillRating || (data.rank ? data.rank.skillRating : 1000) || 1000);
      const rank = data.rank || (typeof getRankDetailsFromSR === 'function' ? getRankDetailsFromSR(sr) : null);
      const divName = rank ? rank.divisionName : (data.userId ? 'Novize V' : 'Gast-Magier');
      const tierKey = rank ? rank.tierKey : 'novice';
      const crestSvg = (typeof RANK_CRESTS !== 'undefined' && RANK_CRESTS[tierKey]) ? RANK_CRESTS[tierKey] : '';

      if (divisionEl) {
        divisionEl.innerText = divName;
        if (rank && rank.color) divisionEl.style.color = rank.color;
      }
      if (srEl) {
        srEl.innerText = (data.userId || isFriendSource) ? `${sr} SR` : 'Nicht gewertet';
      }
      if (crestEl) {
        crestEl.innerHTML = (data.userId || isFriendSource) ? crestSvg : '🔮';
      }
      if (botDiffEl) {
        botDiffEl.style.display = 'none';
        botDiffEl.innerHTML = '';
      }

      if (statsGridEl) {
        statsGridEl.style.display = 'grid';
        statsGridEl.style.gridTemplateColumns = 'repeat(3, 1fr)';
        statsGridEl.innerHTML = '';
        if (isTable) {
          if (statsTitleEl) statsTitleEl.innerText = 'Runden-Statistiken (Aktuelle Partie)';
          const bidVal = (data.bid !== null && data.bid !== undefined) ? data.bid : '-';
          const wonVal = (data.tricksWon !== undefined) ? data.tricksWon : 0;
          let totalPts = data.totalScore !== undefined ? data.totalScore : 0;
          if (totalPts === 0 && typeof cachedScoreHistory !== 'undefined' && Array.isArray(cachedScoreHistory)) {
            cachedScoreHistory.forEach(entry => {
              if (entry.entries) {
                const e = entry.entries.find(ent => ent.sessionId === data.sessionId);
                if (e && e.totalScore !== undefined) totalPts = e.totalScore;
              } else if (entry.scores && entry.scores[data.sessionId] !== undefined) {
                totalPts += entry.scores[data.sessionId];
              }
            });
          }

          let careerHtml = '';
          if (data.userStats) {
            const u = data.userStats;
            careerHtml = `
              <div style="grid-column: 1 / -1; margin-top: 10px; padding: 10px 12px; background: rgba(20, 12, 6, 0.85); border: 1.5px solid var(--gold-antique); border-radius: 8px;">
                <div style="font-size: 11px; font-weight: bold; color: var(--gold-bright); margin-bottom: 6px; font-family: var(--font-subheading); text-align: left;">
                  🏆 Grimoire-Karriere (Registrierter Magier)
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center;">
                  <div style="background: rgba(0,0,0,0.4); padding: 5px 2px; border-radius: 6px;">
                    <div style="font-size: 13px; font-weight: bold; color: #fef08a;">${u.gamesPlayed}</div>
                    <div style="font-size: 9px; color: #d6be90;">Partien</div>
                  </div>
                  <div style="background: rgba(0,0,0,0.4); padding: 5px 2px; border-radius: 6px;">
                    <div style="font-size: 13px; font-weight: bold; color: #86efac;">${u.gamesWon} (${u.winRate}%)</div>
                    <div style="font-size: 9px; color: #d6be90;">Siege</div>
                  </div>
                  <div style="background: rgba(0,0,0,0.4); padding: 5px 2px; border-radius: 6px;">
                    <div style="font-size: 13px; font-weight: bold; color: #fde047;">${u.highestScore}</div>
                    <div style="font-size: 9px; color: #d6be90;">Highscore</div>
                  </div>
                  <div style="background: rgba(0,0,0,0.4); padding: 5px 2px; border-radius: 6px;">
                    <div style="font-size: 13px; font-weight: bold; color: #a78bfa;">${u.skillRating}</div>
                    <div style="font-size: 9px; color: #d6be90;">SR</div>
                  </div>
                </div>
              </div>
            `;
          } else if (!isBot) {
            careerHtml = `
              <div style="grid-column: 1 / -1; margin-top: 8px; font-size: 10px; color: #94a3b8; font-style: italic; text-align: center;">
                🔮 Gast-Konto (nicht registriert – keine Karriere-Chronik gespeichert)
              </div>
            `;
          }

          statsGridEl.innerHTML = `
            <div style="background: rgba(0,0,0,0.5); padding: 8px 4px; border-radius: 8px; border: 1px solid var(--gold-antique);">
              <div style="font-size: 15px; font-weight: 900; color: #86efac; font-family: var(--font-medieval);">${wonVal}</div>
              <div style="font-size: 10px; color: #d6be90; margin-top: 2px;">Erzielte Stiche</div>
            </div>
            <div style="background: rgba(0,0,0,0.5); padding: 8px 4px; border-radius: 8px; border: 1px solid var(--gold-antique);">
              <div style="font-size: 15px; font-weight: 900; color: var(--gold-bright); font-family: var(--font-medieval);">${bidVal}</div>
              <div style="font-size: 10px; color: #d6be90; margin-top: 2px;">Prophezeiung</div>
            </div>
            <div style="background: rgba(0,0,0,0.5); padding: 8px 4px; border-radius: 8px; border: 1px solid var(--gold-antique);">
              <div style="font-size: 15px; font-weight: 900; color: ${totalPts >= 0 ? '#86efac' : '#f87171'}; font-family: var(--font-medieval);">${totalPts}</div>
              <div style="font-size: 10px; color: #d6be90; margin-top: 2px;">Gesamtpunkte</div>
            </div>
            ${careerHtml}
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
    }

    // Aktionen
    if (btnAddFriend) {
      const isMe = (!isFriendSource && data.sessionId === mySessionId);
      const isBotPlayer = (!isFriendSource && isBot);
      const friendsList = (typeof CompanionsManager !== 'undefined' && typeof CompanionsManager.getFriends === 'function')
        ? CompanionsManager.getFriends()
        : [];
      const isFriend = !isBotPlayer && !isMe && Array.isArray(friendsList) && friendsList.some(f => (f && (f.username || f.name) || '').toLowerCase() === (name || '').toLowerCase());

      if (isMe) {
        btnAddFriend.style.display = 'none';
      } else if (isBotPlayer) {
        btnAddFriend.style.display = 'none';
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
  } catch (err) {
    console.error('Fehler in openPlayerDetailModal:', err);
  }
}
if (typeof window !== 'undefined') window.openPlayerDetailModal = openPlayerDetailModal;

// --- RUNDE 1 STIRNKARTEN-INSPEKTION (GROSSES ARTWORK & EFFEKT-INFO) ---
function openForeheadInspectModal(player) {
  const modal = document.getElementById('forehead-inspect-modal');
  const titleEl = document.getElementById('foreheadInspectTitle');
  const cardContainer = document.getElementById('foreheadInspectCardContainer');
  const descEl = document.getElementById('foreheadInspectCardDesc');
  if (!modal || !player || !player.round1Card) return;

  if (typeof GrimoireAudio !== 'undefined' && GrimoireAudio.playCardSnap) GrimoireAudio.playCardSnap();

  if (titleEl) titleEl.innerText = `🔮 Stirnkarte von ${player.name || 'Magier'}`;
  if (cardContainer) {
    cardContainer.innerHTML = '';
    const largeCard = renderCard(player.round1Card);
    largeCard.style.transform = 'scale(1.35)';
    largeCard.style.margin = '16px auto';
    largeCard.style.boxShadow = '0 16px 36px rgba(0,0,0,0.95), 0 0 20px var(--gold-bright)';
    largeCard.classList.remove('card-fly-up');
    cardContainer.appendChild(largeCard);
  }

  const card = player.round1Card;
  let desc = '';
  if (card.type === 'wizard') desc = 'Erzmagier: Höchste Zauberkraft, gewinnt jeden Stich.';
  else if (card.type === 'jester') desc = 'Scharlatan: Völlig machtlos, unterliegt jeder Karte.';
  else if (card.type === 'dragon') desc = 'Drache: Verschlingt alle Zauberer, unterliegt nur der Fee.';
  else if (card.type === 'fairy') desc = 'Fee: Verzaubert und besiegt den Drachen.';
  else if (card.type === 'bomb') desc = 'Magiekollaps: Zerstört den Stich vollkommen.';
  else if (card.type === 'color') {
    const sNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
    const suitName = sNames[card.suit] || card.suit;
    desc = `Farbkarte ${suitName} mit Wert ${card.value}`;
  } else {
    desc = card.name || 'Sonderkarte der Zitadelle';
  }
  if (descEl) descEl.innerText = desc;

  modal.style.display = 'flex';
}
if (typeof window !== 'undefined') window.openForeheadInspectModal = openForeheadInspectModal;

const foreheadModalEl = document.getElementById('forehead-inspect-modal');
const foreheadModalCloseBtn = document.getElementById('foreheadInspectModalClose');
if (foreheadModalCloseBtn && foreheadModalEl) {
  foreheadModalCloseBtn.addEventListener('click', () => {
    foreheadModalEl.style.display = 'none';
  });
  foreheadModalEl.addEventListener('click', (e) => {
    if (e.target === foreheadModalEl) foreheadModalEl.style.display = 'none';
  });
}

// Screen-Manager zur sauberen Umschaltung zwischen den 3 Screens
function switchScreen(screenName) {
  lobbyScreen.style.display = (screenName === 'lobby') ? 'flex' : 'none';
  waitingRoomScreen.style.display = (screenName === 'waiting') ? 'flex' : 'none';
  gameScreen.style.display = (screenName === 'game') ? 'flex' : 'none';

  if (screenName === 'game') {
    if (typeof WizardVault !== 'undefined' && WizardVault.closeVault) {
      WizardVault.closeVault();
    } else if (typeof closeVault === 'function') {
      closeVault();
    }
  }

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
  if (scoreDrawer) {
    if (window.innerWidth >= 768 && Array.isArray(cachedPlayers) && cachedPlayers.length > 0) {
      const neededWidth = Math.min(
        window.innerWidth * 0.92,
        Math.max(520, 120 + cachedPlayers.length * 125)
      );
      scoreDrawer.style.width = neededWidth + 'px';
    } else {
      scoreDrawer.style.width = '';
    }
    scoreDrawer.classList.add('open');
  }
  if (drawerBackdrop) drawerBackdrop.classList.add('open');
}

function closeScoreDrawer() {
  if (scoreDrawer) {
    scoreDrawer.classList.remove('open');
    scoreDrawer.style.zIndex = '';
    scoreDrawer.style.width = '';
  }
  const profileDrawer = document.getElementById('profile-drawer');
  const profileOpen = profileDrawer && profileDrawer.classList.contains('open');
  if ((!rulesDrawer || !rulesDrawer.classList.contains('open')) && !profileOpen) {
    if (drawerBackdrop) drawerBackdrop.classList.remove('open');
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

// --- KARTEN-ARTWORK LIGHTBOX (GROSSANSICHT) ---
function openCardLightbox(imageSrc, title) {
  const modal = document.getElementById('card-art-lightbox-modal');
  const img = document.getElementById('cardLightboxImage');
  const titleEl = document.getElementById('cardLightboxTitle');
  if (!modal || !img) return;
  img.src = imageSrc;
  if (titleEl) titleEl.innerText = title || '';
  modal.style.display = 'flex';
}
function closeCardLightbox() {
  const modal = document.getElementById('card-art-lightbox-modal');
  if (modal) modal.style.display = 'none';
}
if (typeof window !== 'undefined') {
  window.openCardLightbox = openCardLightbox;
  window.closeCardLightbox = closeCardLightbox;
}

const cardLightboxModal = document.getElementById('card-art-lightbox-modal');
const btnCardLightboxClose = document.getElementById('cardLightboxClose');
if (cardLightboxModal) cardLightboxModal.addEventListener('click', closeCardLightbox);
if (btnCardLightboxClose) btnCardLightboxClose.addEventListener('click', closeCardLightbox);

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
    if (typeof closeCardLightbox === 'function') closeCardLightbox();
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
    const connectedCount = (cachedPlayers || []).filter(p => p.connected).length;
    if (currentMatchFormat === 'team_2v2') {
      const teamAPlayers = (cachedPlayers || []).filter(p => p.connected && p.team === 'team_a');
      const teamBPlayers = (cachedPlayers || []).filter(p => p.connected && p.team === 'team_b');
      const teamCPlayers = (cachedPlayers || []).filter(p => p.connected && p.team === 'team_c');
      const neutralPlayers = (cachedPlayers || []).filter(p => p.connected && (!p.team || !['team_a', 'team_b', 'team_c'].includes(p.team)));

      if (connectedCount === 4) {
        if (teamAPlayers.length !== 2 || teamBPlayers.length !== 2 || neutralPlayers.length > 0) {
          if (typeof GrimoireAudio !== 'undefined' && GrimoireAudio.playCardSnap) GrimoireAudio.playCardSnap();
          GrimoireDialog.alert({
            title: 'Allianzen nicht ausgeglichen',
            message: `Für ein 2vs2-Match müssen beide Allianzen aus genau 2 Magiern bestehen (Sonnenfeuer: ${teamAPlayers.length}/2, Mondschatten: ${teamBPlayers.length}/2) und es darf keine unentschlossenen Magier mehr geben.\n\nKlicke auf die Allianz-Karten oder nutze 'Allianzen zufällig würfeln'.`,
            icon: '⚖️',
            confirmText: 'Verstanden'
          });
          return;
        }
      } else if (connectedCount === 6) {
        if (teamAPlayers.length !== 2 || teamBPlayers.length !== 2 || teamCPlayers.length !== 2 || neutralPlayers.length > 0) {
          if (typeof GrimoireAudio !== 'undefined' && GrimoireAudio.playCardSnap) GrimoireAudio.playCardSnap();
          GrimoireDialog.alert({
            title: 'Allianzen nicht ausgeglichen',
            message: `Für ein 2vs2vs2-Match müssen alle 3 Allianzen aus genau 2 Magiern bestehen (Sonnenfeuer: ${teamAPlayers.length}/2, Mondschatten: ${teamBPlayers.length}/2, Sternenwind: ${teamCPlayers.length}/2) und es darf keine unentschlossenen Magier mehr geben.\n\nKlicke auf die Allianz-Karten oder nutze 'Allianzen zufällig würfeln'.`,
            icon: '⚖️',
            confirmText: 'Verstanden'
          });
          return;
        }
      } else {
        if (typeof GrimoireAudio !== 'undefined' && GrimoireAudio.playCardSnap) GrimoireAudio.playCardSnap();
        GrimoireDialog.alert({
          title: 'Allianzen: 4 oder 6 Magier benötigt',
          message: `Der Allianzen-Modus erfordert entweder genau 4 Magier (2vs2) oder genau 6 Magier (2vs2vs2)!\n\nAktuell in der Kammer: ${connectedCount} Magier.\n\nFüge Bots hinzu oder lade Gefährten ein.`,
          icon: '🤝',
          confirmText: 'Verstanden'
        });
        return;
      }
    } else {
      if (connectedCount < 3) {
        if (typeof GrimoireAudio !== 'undefined' && GrimoireAudio.playCardSnap) GrimoireAudio.playCardSnap();
        GrimoireDialog.alert({
          title: 'Mindestens 3 Magier benötigt',
          message: `Für eine klassische Partie werden mindestens 3 Magier benötigt (aktuell: ${connectedCount}/3)!\n\nBitte lade Gefährten ein oder füge Bots hinzu.`,
          icon: '📜',
          confirmText: 'Verstanden'
        });
        return;
      }
    }

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

socket.on('roomSettingsUpdated', ({ edition, matchFormat, scoringMode, biddingMode }) => {
  if (edition) currentEdition = edition;
  if (matchFormat) currentMatchFormat = matchFormat;
  if (scoringMode) currentScoringMode = scoringMode;
  if (biddingMode) currentBiddingMode = biddingMode;
  updateRoomSettingsBadges(currentEdition, currentMatchFormat, currentScoringMode, currentBiddingMode);
  updateWaitingRoomHostControls();
});

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
    if (btnReopenGameOver) btnReopenGameOver.style.display = 'none';
  }
}

if (waitingRoomLeaveBtn) waitingRoomLeaveBtn.addEventListener('click', confirmAndLeaveRoom);
if (btnLeaveGame) btnLeaveGame.addEventListener('click', confirmAndLeaveRoom);

function claimGloryAndLeave() {
  if (typeof WizardAudio !== 'undefined') {
    if (typeof WizardAudio.playLevelUp === 'function') {
      WizardAudio.playLevelUp();
    } else if (typeof WizardAudio.playCardSnap === 'function') {
      WizardAudio.playCardSnap();
    }
  }

  // Profil-Daten im Hintergrund synchronisieren
  if (typeof WizardAuth !== 'undefined' && WizardAuth.refreshUser) {
    WizardAuth.refreshUser();
  }

  if (currentRoomCode) {
    socket.emit('leaveRoom', { roomCode: currentRoomCode });
  }

  sessionStorage.removeItem('wizard_last_room');
  currentRoomCode = '';
  currentGameState = 'lobby';

  if (gameOverModal) gameOverModal.style.display = 'none';
  if (btnReopenGameOver) btnReopenGameOver.style.display = 'none';
  if (pauseOverlay) pauseOverlay.style.display = 'none';
  if (tableArea) tableArea.style.display = 'none';

  switchScreen('lobby');
}

if (btnClaimGlory) {
  btnClaimGlory.addEventListener('click', claimGloryAndLeave);
}

if (btnGameOverClose) {
  btnGameOverClose.addEventListener('click', () => {
    if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
      WizardAudio.playCardSnap();
    }
    if (gameOverModal) gameOverModal.style.display = 'none';
    if (btnReopenGameOver) btnReopenGameOver.style.display = 'inline-flex';
  });
}

if (btnReopenGameOver) {
  btnReopenGameOver.addEventListener('click', () => {
    if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
      WizardAudio.playCardSnap();
    }
    if (gameOverModal) gameOverModal.style.display = 'flex';
    if (btnReopenGameOver) btnReopenGameOver.style.display = 'none';
  });
}

if (btnGameOverStay) {
  btnGameOverStay.addEventListener('click', () => {
    if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
      WizardAudio.playCardSnap();
    }
    if (gameOverModal) gameOverModal.style.display = 'none';
    if (btnReopenGameOver) btnReopenGameOver.style.display = 'inline-flex';
    if (statusMessage) {
      statusMessage.style.display = 'block';
      statusMessage.innerText = 'Ehre verbucht! Warte im Saal auf die nächste Runde...';
    }
  });
}

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

if (btnFormatFFA) {
  btnFormatFFA.addEventListener('click', () => {
    if (currentMatchFormat === 'ffa' && btnFormatFFA.classList.contains('active')) return;
    if (typeof GrimoireAudio !== 'undefined' && GrimoireAudio.playCardSnap) GrimoireAudio.playCardSnap();
    btnFormatFFA.classList.add('active');
    if (btnFormat2v2) btnFormat2v2.classList.remove('active');
    currentMatchFormat = 'ffa';
    const amIHost = (cachedPlayers || []).some(p => p.sessionId === mySessionId && p.isHost);
    updateWaitingRoomView(amIHost);
    socket.emit('setMatchFormat', { roomCode: currentRoomCode, matchFormat: 'ffa' });
  });
}

if (btnFormat2v2) {
  btnFormat2v2.addEventListener('click', () => {
    if (currentMatchFormat === 'team_2v2' && btnFormat2v2.classList.contains('active')) return;
    if (typeof GrimoireAudio !== 'undefined' && GrimoireAudio.playCardSnap) GrimoireAudio.playCardSnap();
    btnFormat2v2.classList.add('active');
    if (btnFormatFFA) btnFormatFFA.classList.remove('active');
    currentMatchFormat = 'team_2v2';
    const amIHost = (cachedPlayers || []).some(p => p.sessionId === mySessionId && p.isHost);
    updateWaitingRoomView(amIHost);
    socket.emit('setMatchFormat', { roomCode: currentRoomCode, matchFormat: 'team_2v2' });
    const count = (cachedPlayers || []).filter(p => p.connected).length;
    if (count <= 4) {
      showToast(`🤝 Allianzen-Modus aktiv: 4 Magier für 2vs2 (aktuell: ${count}).`);
    } else {
      showToast(`🤝 Allianzen-Modus aktiv: 6 Magier für 2vs2vs2 (aktuell: ${count}/6).`);
    }
  });
}

// Host: Allianzen zufällig auswürfeln
if (btnRandomizeTeams) {
  btnRandomizeTeams.addEventListener('click', () => {
    if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.impact('medium');
    if (typeof GrimoireAudio !== 'undefined' && GrimoireAudio.playCardSnap) GrimoireAudio.playCardSnap();
    socket.emit('randomizeTeams', { roomCode: currentRoomCode });
  });
}

// Container-Klicks: Direkte Zuweisung zu Allianzen oder Neutral
if (teamContainerNeutral) {
  teamContainerNeutral.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const me = (cachedPlayers || []).find(p => p.sessionId === mySessionId);
    if (me && me.team !== null) {
      if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.impact('light');
      socket.emit('switchTeam', { roomCode: currentRoomCode, team: null });
    }
  });
}

if (teamContainerA) {
  teamContainerA.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const me = (cachedPlayers || []).find(p => p.sessionId === mySessionId);
    const countA = (cachedPlayers || []).filter(p => p.team === 'team_a').length;
    if (me && me.team === 'team_a') return;
    if (countA >= 2) return; // Team voll - kein Klick möglich
    if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.impact('light');
    socket.emit('switchTeam', { roomCode: currentRoomCode, team: 'team_a' });
  });
}

if (teamContainerB) {
  teamContainerB.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const me = (cachedPlayers || []).find(p => p.sessionId === mySessionId);
    const countB = (cachedPlayers || []).filter(p => p.team === 'team_b').length;
    if (me && me.team === 'team_b') return;
    if (countB >= 2) return; // Team voll - kein Klick möglich
    if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.impact('light');
    socket.emit('switchTeam', { roomCode: currentRoomCode, team: 'team_b' });
  });
}

if (teamContainerC) {
  teamContainerC.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const me = (cachedPlayers || []).find(p => p.sessionId === mySessionId);
    const countC = (cachedPlayers || []).filter(p => p.team === 'team_c').length;
    if (me && me.team === 'team_c') return;
    if (countC >= 2) return; // Team voll - kein Klick möglich
    if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.impact('light');
    socket.emit('switchTeam', { roomCode: currentRoomCode, team: 'team_c' });
  });
}

socket.on('matchFormatChanged', ({ matchFormat, teams }) => {
  currentMatchFormat = matchFormat;
  if (teams) currentTeams = teams;
  const amIHost = cachedPlayers.some(p => p.sessionId === mySessionId && p.isHost);
  updateWaitingRoomView(amIHost);
});

// Hilfsfunktion: Erstellt ein Spieler-Element für den Warteraum
function createPlayerWaitingItem(p, isHostUser) {
  const isMe = (p.sessionId === mySessionId);
  const isHost = (typeof isHostUser === 'boolean')
    ? isHostUser
    : (cachedPlayers && cachedPlayers.some(player => player.sessionId === mySessionId && player.isHost));

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

  let actionHtml = '';
  if (isHost && !isMe) {
    if (p.isBot) {
      actionHtml = `
        <button type="button" class="btn-kick-bot" data-bot-id="${escapeHtml(p.sessionId)}" title="${escapeHtml(p.name)} entfernen" aria-label="Bot entfernen">
          <span class="btn-icon" aria-hidden="true">❌</span>
          <span class="btn-text">Bot kicken</span>
        </button>
      `;
    } else {
      actionHtml = `
        <button type="button" class="btn-transfer-host" data-player-id="${escapeHtml(p.sessionId)}" title="${escapeHtml(p.name)} zum Host ernennen" aria-label="Host übergeben">
          <span class="btn-icon" aria-hidden="true">👑</span>
          <span class="btn-text">Host</span>
        </button>
        <button type="button" class="btn-kick-player" data-player-id="${escapeHtml(p.sessionId)}" title="${escapeHtml(p.name)} aus der Kammer verweisen" aria-label="Mitspieler kicken">
          <span class="btn-icon" aria-hidden="true">🚪</span>
          <span class="btn-text">Kicken</span>
        </button>
      `;
    }
  }

  const frameClass = `frame-${p.avatarFrame || 'none'}`;
  let avatarVisualHtml = initial;
  if (p.avatarId) {
    if (p.avatarId.startsWith('icon_')) {
      avatarVisualHtml = `<img src="/images/avatars/${p.avatarId}.png" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" onerror="this.style.display='none';">${initial}`;
    } else if (p.avatarId.startsWith('wizard_')) {
      avatarVisualHtml = `<img src="/images/avatars/${p.avatarId}.svg" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" onerror="this.style.display='none';">${initial}`;
    }
  }
  const levelBadgeHtml = (p.accountLevel && p.accountLevel > 0)
    ? `<span class="user-pill-level-badge" title="Stufe ${p.accountLevel}">Lvl ${p.accountLevel}</span>`
    : '';

  item.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <div class="seat-avatar ${frameClass}" style="width: 32px; height: 36px; font-size: 14px; margin: 0; box-shadow: none;">${avatarVisualHtml}</div>
      <div>
        <div style="font-size: 15px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
          <b>${escapeHtml(p.name)}</b> ${isMe ? '<small style="color: #f1c40f;">(Du)</small>' : ''} ${hostBadge} ${botBadge}
          ${levelBadgeHtml}
          ${rankBadgeHtml}
        </div>
        ${titleHtml}
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      ${statusText}
      ${actionHtml}
    </div>
  `;

  const kickBtn = item.querySelector('.btn-kick-bot');
  if (kickBtn) {
    kickBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
        WizardAudio.playCardSnap();
      }
      socket.emit('removeBot', { roomCode: currentRoomCode, botSessionId: p.sessionId });
    });
  }

  const transferHostBtn = item.querySelector('.btn-transfer-host');
  if (transferHostBtn) {
    transferHostBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const playerName = p.name || 'diesen Magier';
      if (typeof GrimoireDialog !== 'undefined' && GrimoireDialog.confirm) {
        GrimoireDialog.confirm({
          title: 'Host-Rolle übergeben?',
          message: `Möchtest du die Spielleitung der Kammer an "${playerName}" übergeben?`,
          confirmText: 'Übergeben',
          cancelText: 'Abbrechen',
          danger: false,
          icon: '👑'
        }).then(confirmed => {
          if (confirmed) {
            if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
              WizardAudio.playCardSnap();
            }
            socket.emit('transferHost', { roomCode: currentRoomCode, targetSessionId: p.sessionId });
          }
        });
      } else {
        socket.emit('transferHost', { roomCode: currentRoomCode, targetSessionId: p.sessionId });
      }
    });
  }

  const kickPlayerBtn = item.querySelector('.btn-kick-player');
  if (kickPlayerBtn) {
    kickPlayerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const playerName = p.name || 'diesen Magier';
      if (typeof GrimoireDialog !== 'undefined' && GrimoireDialog.confirm) {
        GrimoireDialog.confirm({
          title: 'Magier verweisen?',
          message: `Möchtest du "${playerName}" wirklich aus der Kammer verweisen?`,
          confirmText: 'Verweisen',
          cancelText: 'Abbrechen',
          danger: true,
          icon: '🚪'
        }).then(confirmed => {
          if (confirmed) {
            if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
              WizardAudio.playCardSnap();
            }
            socket.emit('kickPlayer', { roomCode: currentRoomCode, targetSessionId: p.sessionId });
          }
        });
      } else {
        socket.emit('kickPlayer', { roomCode: currentRoomCode, targetSessionId: p.sessionId });
      }
    });
  }

  // Klick auf den Spieler-Eintrag öffnet das Magier-Detailprofil (mit Lore & Level)
  item.style.cursor = 'pointer';
  item.setAttribute('title', `${escapeHtml(p.name)} – Klicken für Profil`);
  item.addEventListener('click', (e) => {
    if (e.target.closest('.btn-kick-bot') || e.target.closest('.btn-transfer-host') || e.target.closest('.btn-kick-player')) {
      return;
    }
    if (typeof openPlayerDetailModal === 'function') {
      openPlayerDetailModal(p, 'waiting');
    }
  });

  return item;
}

// Rendert den separaten Warteraum
function updateWaitingRoomView(amIHost) {
  waitingRoomCode.innerText = currentRoomCode;
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

  // Format-Steuerung für Host & Gäste
  if (hostFormatControls && guestFormatDisplay) {
    if (amIHost) {
      hostFormatControls.style.display = 'block';
      guestFormatDisplay.style.display = 'none';
      if (btnFormatFFA) btnFormatFFA.classList.toggle('active', currentMatchFormat === 'ffa');
      if (btnFormat2v2) btnFormat2v2.classList.toggle('active', currentMatchFormat === 'team_2v2');
    } else {
      hostFormatControls.style.display = 'none';
      guestFormatDisplay.style.display = 'block';
      guestFormatDisplay.innerText = (currentMatchFormat === 'team_2v2')
        ? '🤝 2vs2 Allianzen (Team-Stichkampf)'
        : '⚔️ Jeder gegen Jeden (FFA)';
    }
  }

  if (btnRandomizeTeams) {
    btnRandomizeTeams.style.display = (amIHost && currentMatchFormat === 'team_2v2') ? 'inline-flex' : 'none';
  }

  if (currentMatchFormat === 'team_2v2') {
    if (waitingRoomPlayersList) waitingRoomPlayersList.style.display = 'none';
    if (waitingRoomTeamsContainer) {
      waitingRoomTeamsContainer.style.display = 'flex';

      const neutralPlayers = cachedPlayers.filter(p => !p.team || !['team_a', 'team_b', 'team_c'].includes(p.team));
      const teamAPlayers = cachedPlayers.filter(p => p.team === 'team_a');
      const teamBPlayers = cachedPlayers.filter(p => p.team === 'team_b');
      const teamCPlayers = cachedPlayers.filter(p => p.team === 'team_c');

      const showTeamC = (cachedPlayers.length > 4 || teamCPlayers.length > 0);
      if (teamContainerC) {
        teamContainerC.style.display = showTeamC ? 'block' : 'none';
      }

      waitingRoomCount.innerText = `${cachedPlayers.length}/${showTeamC ? 6 : 4}`;

      if (teamCountNeutral) teamCountNeutral.innerText = `(${neutralPlayers.length})`;
      if (teamCountA) teamCountA.innerText = `(${teamAPlayers.length}/2)`;
      if (teamCountB) teamCountB.innerText = `(${teamBPlayers.length}/2)`;
      if (teamCountC) teamCountC.innerText = `(${teamCPlayers.length}/2)`;

      const me = cachedPlayers.find(p => p.sessionId === mySessionId);
      const myTeam = me ? me.team : null;

      // Container-Status & Klicksperre bei vollen Teams (pointer-events: none)
      if (teamContainerNeutral) {
        teamContainerNeutral.classList.toggle('team-card-selected', myTeam === null);
        if (badgeTeamNeutral) {
          badgeTeamNeutral.innerText = (myTeam === null) ? '✓ Dein Status' : 'Klicken für Neutral';
        }
      }

      if (teamContainerA) {
        const isFullA = teamAPlayers.length >= 2;
        const isMyA = (myTeam === 'team_a');
        teamContainerA.classList.toggle('team-card-selected', isMyA);
        teamContainerA.classList.toggle('team-card-full', isFullA && !isMyA);
        if (badgeTeamA) {
          badgeTeamA.innerText = isMyA ? '✓ Dein Bündnis' : (isFullA ? '🔒 Voll (2/2)' : 'Klicken zum Beitreten');
        }
      }

      if (teamContainerB) {
        const isFullB = teamBPlayers.length >= 2;
        const isMyB = (myTeam === 'team_b');
        teamContainerB.classList.toggle('team-card-selected', isMyB);
        teamContainerB.classList.toggle('team-card-full', isFullB && !isMyB);
        if (badgeTeamB) {
          badgeTeamB.innerText = isMyB ? '✓ Dein Bündnis' : (isFullB ? '🔒 Voll (2/2)' : 'Klicken zum Beitreten');
        }
      }

      if (teamContainerC) {
        const isFullC = teamCPlayers.length >= 2;
        const isMyC = (myTeam === 'team_c');
        teamContainerC.classList.toggle('team-card-selected', isMyC);
        teamContainerC.classList.toggle('team-card-full', isFullC && !isMyC);
        if (badgeTeamC) {
          badgeTeamC.innerText = isMyC ? '✓ Dein Bündnis' : (isFullC ? '🔒 Voll (2/2)' : 'Klicken zum Beitreten');
        }
      }

      // Spielerlisten rendern
      if (teamPlayersListNeutral) {
        teamPlayersListNeutral.innerHTML = '';
        if (neutralPlayers.length === 0) {
          teamPlayersListNeutral.innerHTML = '<div style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 2px 0;">Alle Magier haben ein Bündnis gewählt</div>';
        } else {
          neutralPlayers.forEach(p => teamPlayersListNeutral.appendChild(createPlayerWaitingItem(p, amIHost)));
        }
      }

      if (teamPlayersListA) {
        teamPlayersListA.innerHTML = '';
        if (teamAPlayers.length === 0) {
          teamPlayersListA.innerHTML = '<div style="font-size: 12px; color: #94a3b8; font-style: italic; padding: 4px 0;">Noch keine Magier in diesem Bündnis</div>';
        } else {
          teamAPlayers.forEach(p => teamPlayersListA.appendChild(createPlayerWaitingItem(p, amIHost)));
        }
      }

      if (teamPlayersListB) {
        teamPlayersListB.innerHTML = '';
        if (teamBPlayers.length === 0) {
          teamPlayersListB.innerHTML = '<div style="font-size: 12px; color: #94a3b8; font-style: italic; padding: 4px 0;">Noch keine Magier in diesem Bündnis</div>';
        } else {
          teamBPlayers.forEach(p => teamPlayersListB.appendChild(createPlayerWaitingItem(p, amIHost)));
        }
      }

      if (teamPlayersListC) {
        teamPlayersListC.innerHTML = '';
        if (teamCPlayers.length === 0) {
          teamPlayersListC.innerHTML = '<div style="font-size: 12px; color: #94a3b8; font-style: italic; padding: 4px 0;">Noch keine Magier in diesem Bündnis</div>';
        } else {
          teamCPlayers.forEach(p => teamPlayersListC.appendChild(createPlayerWaitingItem(p, amIHost)));
        }
      }
    }
  } else {
    waitingRoomCount.innerText = `${cachedPlayers.length}/6`;
    if (waitingRoomPlayersList) {
      waitingRoomPlayersList.style.display = 'flex';
      cachedPlayers.forEach(p => {
        waitingRoomPlayersList.appendChild(createPlayerWaitingItem(p, amIHost));
      });
    }
    if (waitingRoomTeamsContainer) waitingRoomTeamsContainer.style.display = 'none';
  }

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

  // Host-Einstellungs-Button im Warteraum aktualisieren
  updateWaitingRoomHostControls();

  // Host-Bot-Steuerung anzeigen / aktualisieren
  const hostBotControls = document.getElementById('host-bot-controls');
  if (hostBotControls) {
    hostBotControls.style.display = amIHost ? 'flex' : 'none';
    const botCount = cachedPlayers.filter(p => p.isBot).length;
    const maxAllowed = 6;
    if (btnAddBot) btnAddBot.disabled = cachedPlayers.length >= maxAllowed;
    if (btnRemoveBot) btnRemoveBot.disabled = botCount === 0;
  }

  const connectedCount = cachedPlayers.filter(p => p.connected).length;
  if (amIHost) {
    waitingRoomStartBtn.style.display = 'inline-block';
    const btnTextEl = waitingRoomStartBtn.querySelector('.btn-text');
    const updateBtnLabel = (fullTxt, shortTxt) => {
      if (btnTextEl) {
        if (shortTxt) {
          btnTextEl.innerHTML = `<span class="btn-text-full">${fullTxt}</span><span class="btn-text-short">${shortTxt}</span>`;
        } else {
          btnTextEl.innerText = fullTxt;
        }
      } else {
        waitingRoomStartBtn.innerText = fullTxt;
      }
    };

    if (currentMatchFormat === 'team_2v2') {
      const neutralPlayers = cachedPlayers.filter(p => p.connected && (!p.team || !['team_a', 'team_b', 'team_c'].includes(p.team)));
      const teamAPlayers = cachedPlayers.filter(p => p.connected && p.team === 'team_a');
      const teamBPlayers = cachedPlayers.filter(p => p.connected && p.team === 'team_b');
      const teamCPlayers = cachedPlayers.filter(p => p.connected && p.team === 'team_c');

      const isReady2v2 = (connectedCount === 4 && teamAPlayers.length === 2 && teamBPlayers.length === 2 && neutralPlayers.length === 0);
      const isReady2v2v2 = (connectedCount === 6 && teamAPlayers.length === 2 && teamBPlayers.length === 2 && teamCPlayers.length === 2 && neutralPlayers.length === 0);
      const isReadyAlliances = (isReady2v2 || isReady2v2v2);

      waitingRoomStartBtn.disabled = false;
      waitingRoomStartBtn.classList.toggle('btn-not-ready', !isReadyAlliances);

      if (connectedCount < 4) {
        updateBtnLabel(`Warte auf 4 Magier für 2vs2 (${connectedCount}/4)...`, `Warten (${connectedCount}/4)`);
      } else if (connectedCount === 4) {
        if (!isReady2v2) {
          updateBtnLabel('Allianzen ausgleichen (je 2 Magier)...', 'Ausgleichen');
        } else {
          updateBtnLabel('2vs2 Allianzen starten', 'Starten');
        }
      } else if (connectedCount === 5) {
        updateBtnLabel('Warte auf 6. Magier für 2vs2vs2 (5/6)...', 'Warten (5/6)');
      } else if (connectedCount === 6) {
        if (!isReady2v2v2) {
          updateBtnLabel('3 Allianzen ausgleichen (je 2 Magier)...', 'Ausgleichen');
        } else {
          updateBtnLabel('2vs2vs2 Allianzen starten', 'Starten');
        }
      } else {
        updateBtnLabel('Zu viele Spieler für Allianzen', 'Überfüllt');
      }
    } else {
      const isReadyFFA = connectedCount >= 3;
      waitingRoomStartBtn.disabled = false;
      waitingRoomStartBtn.classList.toggle('btn-not-ready', !isReadyFFA);
      if (!isReadyFFA) {
        updateBtnLabel(`Warte auf Spieler (${connectedCount}/3)...`, `Warten (${connectedCount}/3)`);
      } else {
        updateBtnLabel('Partie beginnen', 'Starten');
      }
    }
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
  if (state.matchFormat) {
    currentMatchFormat = state.matchFormat;
  }
  if (state.teams) {
    currentTeams = state.teams;
  }
  if (state.scoringMode) {
    currentScoringMode = state.scoringMode;
  }
  if (state.biddingMode) {
    currentBiddingMode = state.biddingMode;
  }
  if (state.tableSkin) {
    applyTableSkin(state.tableSkin);
  }
  updateRoomSettingsBadges(currentEdition, currentMatchFormat, currentScoringMode, currentBiddingMode);
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
    if (btnReopenGameOver) btnReopenGameOver.style.display = 'none';
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

  if (currentGameState === 'bidding' && (currentBiddingMode === 'simultaneous' || currentBiddingMode === 'secret')) {
    const me = cachedPlayers.find(p => p.sessionId === mySessionId);
    const hasAlreadyBid = me && (me.hasBid || (me.bid !== null && me.bid !== undefined));
    if (hasAlreadyBid) {
      statusMessage.innerText = currentBiddingMode === 'secret'
        ? 'Geheimer Tipp eingereicht! Warte auf die anderen Magier...'
        : 'Tipp eingereicht! Warte auf die anderen Magier...';
      bidOverlay.style.display = 'none';
    }
  }

  renderOpponents();
  renderScoreBoard();
  updateMyStatsHUD();
});

// Vom Host aus der Kammer verwiesen
socket.on('kickedFromRoom', (data) => {
  sessionStorage.removeItem('wizard_last_room');
  currentRoomCode = '';
  currentGameState = 'lobby';
  cachedPlayers = [];
  if (typeof switchScreen === 'function') {
    switchScreen('lobby');
  }
  if (pauseOverlay) pauseOverlay.style.display = 'none';
  if (gameOverModal) gameOverModal.style.display = 'none';

  if (typeof GrimoireDialog !== 'undefined' && GrimoireDialog.alert) {
    GrimoireDialog.alert({
      title: 'Aus Kammer verwiesen',
      message: (data && data.reason) || 'Du wurdest vom Host aus der Kammer verwiesen.',
      icon: '🚪'
    });
  }
});

// Host-Rolle übergeben
socket.on('hostTransferred', ({ newHostSessionId, newHostName }) => {
  const isMeNowHost = (newHostSessionId === mySessionId);
  const msg = isMeNowHost
    ? '👑 Du bist jetzt die neue Spielleitung (Host) der Kammer!'
    : `👑 ${newHostName} ist jetzt die neue Spielleitung (Host)!`;

  if (typeof showToast === 'function') {
    showToast(msg);
  }
  if (typeof GrimoireHaptics !== 'undefined' && GrimoireHaptics.notification) {
    GrimoireHaptics.notification('success');
  }
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
  if (btnReopenGameOver) btnReopenGameOver.style.display = 'none';
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

  // ANIMIERTES "DU BIST DRAN!" POP-UP FEEDBACK & EXTREM-FLASH + KRISTALL-GONG
  if (isMyTurn && (!previouslyMyTurn || gameState === 'playing_tricks' || gameState === 'bidding')) {
    triggerTurnPopup();
    if (!previouslyMyTurn) {
      if (typeof WizardAudio !== 'undefined' && WizardAudio.playTurnChime) {
        WizardAudio.playTurnChime();
      }
      if (tableArea) {
        tableArea.classList.remove('turn-start-extreme-flash');
        void tableArea.offsetWidth;
        tableArea.classList.add('turn-start-extreme-flash');
        setTimeout(() => { if (tableArea) tableArea.classList.remove('turn-start-extreme-flash'); }, 480);
      }
      if (myHandSection) {
        myHandSection.classList.remove('turn-start-extreme-flash');
        void myHandSection.offsetWidth;
        myHandSection.classList.add('turn-start-extreme-flash');
        setTimeout(() => { if (myHandSection) myHandSection.classList.remove('turn-start-extreme-flash'); }, 480);
      }
    }
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
        statusMessage.innerText = '🐺 Du hast das Mondbiest! Wähle die Trumpffarbe.';
        if (trumpTitle) trumpTitle.innerText = '🐺 Du hast das Mondbiest! Wähle die Trumpffarbe:';
      } else {
        statusMessage.innerText = 'Du bist der Geber! Wähle die Trumpffarbe.';
        if (trumpTitle) trumpTitle.innerText = 'Du bist der Geber! Wähle die Trumpffarbe:';
      }
      trumpSelectionArea.style.display = 'block';
    } else {
      if (isWerewolfChooser) {
        statusMessage.innerText = `🐺 ${activePlayerName} wählt als Mondbiest die Trumpffarbe...`;
      } else {
        const dealer = cachedPlayers.find(p => p.isDealer);
        const dealerName = dealer ? escapeHtml(dealer.name) : 'Der Geber';
        statusMessage.innerText = `${dealerName} wählt die Trumpffarbe...`;
      }
      trumpSelectionArea.style.display = 'none';
    }
  } else if (gameState === 'bidding') {
    trumpSelectionArea.style.display = 'none';

    if (currentBiddingMode === 'simultaneous' || currentBiddingMode === 'secret') {
      const me = cachedPlayers.find(p => p.sessionId === mySessionId);
      const hasAlreadyBid = me && (me.hasBid || (me.bid !== null && me.bid !== undefined));

      if (!hasAlreadyBid) {
        statusMessage.innerText = currentBiddingMode === 'secret'
          ? '🤫 Geheimes Bieten! Alle tippen gleichzeitig & verdeckt. Wie viele Stiche prophezeist du?'
          : '⚡ Alle Magier tippen gleichzeitig! Wie viele Stiche prophezeist du?';
        renderBidButtons(currentRound, null);
        bidOverlay.style.display = 'flex';
      } else {
        statusMessage.innerText = currentBiddingMode === 'secret'
          ? 'Geheimer Tipp eingereicht! Warte auf die anderen Magier...'
          : 'Tipp eingereicht! Warte auf die anderen Magier...';
        bidOverlay.style.display = 'none';
      }
    } else {
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

// Mondbiest: Benachrichtigung & Animation beim Trumpftausch
socket.on('werewolfTrumpSwapped', ({ werewolfPlayerName, takenCard, newTrumpCard, trumpSuit }) => {
  if (werewolfInfoTitle) {
    werewolfInfoTitle.innerText = '🐺 Mondbiest auf der Hand!';
  }
  if (werewolfInfoDesc) {
    werewolfInfoDesc.innerText = `${escapeHtml(werewolfPlayerName)} besitzt das Mondbiest! Er nimmt die aufgedeckte Trumpfkarte auf die Hand und bestimmt selbst die neue Trumpffarbe:`;
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
  statusMessage.innerText = `🐺 ${escapeHtml(werewolfPlayerName)} wählt als Herr der Mondbieste die Trumpffarbe!`;
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

function triggerSimultaneousReveal(players) {
  const overlay = document.getElementById('simultaneous-reveal-overlay');
  const countEl = document.getElementById('reveal-countdown-number');
  const subEl = document.getElementById('reveal-subtitle');

  if (!overlay || !countEl) {
    if (players) cachedPlayers = players;
    renderOpponents();
    updateMyStatsHUD();
    updateBiddingSummaryPill();
    return;
  }

  overlay.style.display = 'flex';
  countEl.innerText = '3';
  if (subEl) subEl.innerText = 'Alle Magier haben getippt...';

  // 3 -> 2
  setTimeout(() => {
    countEl.innerText = '2';
    if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.impact('light');

    // 2 -> 1
    setTimeout(() => {
      countEl.innerText = '1';
      if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.impact('medium');

      // 1 -> Aufdecken!
      setTimeout(() => {
        countEl.innerText = '⚡';
        if (subEl) subEl.innerText = 'Prophezeiungen aufdecken!';
        if (typeof GrimoireHaptics !== 'undefined') GrimoireHaptics.notification('success');

        if (players) {
          cachedPlayers = players;
        }
        renderOpponents();
        updateMyStatsHUD();
        updateBiddingSummaryPill();

        // 3D-Flip Animation auf allen Sitz-Pills
        const pills = document.querySelectorAll('.seat-bid-pill');
        pills.forEach(p => {
          p.classList.add('revealing');
          setTimeout(() => p.classList.remove('revealing'), 800);
        });

        // Overlay nach kurzem Reveal sanft ausblenden
        setTimeout(() => {
          overlay.style.display = 'none';
          statusMessage.innerText = '⚡ Alle Tipps liegen auf dem Tisch! Mögen die Stiche beginnen!';
        }, 550);
      }, 350);
    }, 350);
  }, 350);
}

socket.on('simultaneousBidsRevealed', ({ players }) => {
  triggerSimultaneousReveal(players);
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
  renderOpponents();
});

socket.on('trickWinner', ({ winnerName, winnerSessionId, isBombed, isUnicornVoided, isUnicornActive, nextLeadName }) => {
  if (isBombed) {
    GrimoireHaptics.impact('heavy');
    statusMessage.innerText = `💥 Der Magiekollaps hat den Stich neutralisiert! ${escapeHtml(nextLeadName || 'Nächster Spieler')} eröffnet den nächsten Stich.`;
  } else if (isUnicornVoided) {
    GrimoireHaptics.impact('medium');
    statusMessage.innerText = `🦄 Das Einhorn hat alle Mächte gebannt! Da keine Zahlenkarte lag, verpufft der Stich. ${escapeHtml(nextLeadName || 'Nächster Spieler')} eröffnet den nächsten Stich.`;
  } else if (isUnicornActive) {
    GrimoireHaptics.impact('medium');
    statusMessage.innerText = `🦄 Das Einhorn bannt alle Magie! ${escapeHtml(winnerName)} triumphiert mit der höchsten Farbkarte!`;
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
      if (isUnicornActive) {
        GrimoireFX.triggerUnicornRing();
      }
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

socket.on('roundFinished', ({ isGameOver, scoreHistory, round, isRanked, rankedResults, matchFormat, teams, highlight, mvpCandidates }) => {
  if (matchFormat) {
    currentMatchFormat = matchFormat;
  }
  if (teams) {
    currentTeams = teams;
  }
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
  currentGameState = 'round_over';

  if (scoreHistory) {
    cachedScoreHistory = scoreHistory;
    renderScoreBoard();
  }

  updateBiddingSummaryPill();
  openScoreDrawer();

  if (isGameOver) {
    statusMessage.innerText = 'Das Spiel ist beendet!';
    const amIHost = cachedPlayers.some(p => p.sessionId === mySessionId && p.isHost);
    if (highlight) pendingHighlight = highlight;
    if (mvpCandidates) pendingMvpCandidates = mvpCandidates;
    handleGameOverSequence(amIHost);
  } else {
    statusMessage.innerText = `Runde ${round} beendet! Nächste Runde startet gleich...`;
  }
});

// Highlight & MVP Events
socket.on('highlight:replay', (highlightData) => {
  pendingHighlight = highlightData;
});

socket.on('mvp:startVoting', (data) => {
  if (data && data.candidates) {
    pendingMvpCandidates = data.candidates;
  }
  const highlightModal = document.getElementById('highlight-modal');
  const mvpModal = document.getElementById('mvp-voting-modal');
  if (mvpModal && mvpModal.style.display !== 'none') {
    return;
  }
  if (!highlightModal || highlightModal.style.display === 'none') {
    startMvpVoting(data, () => {
      const amIHost = cachedPlayers.some(p => p.sessionId === mySessionId && p.isHost);
      if (pendingProgressionSummary) {
        const summary = pendingProgressionSummary;
        pendingProgressionSummary = null;
        if (typeof WizardVault !== 'undefined' && WizardVault.showMatchProgression) {
          WizardVault.showMatchProgression(summary);
        }
      } else {
        showGameOverScreen(amIHost);
      }
    });
  }
});

socket.on('mvp:updateVotes', onMvpVotesUpdated);
socket.on('mvp:results', onMvpResultsReceived);

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
  if (gameOverModal) gameOverModal.style.display = 'none';
  if (btnReopenGameOver) btnReopenGameOver.style.display = 'none';
  if (pauseOverlay) pauseOverlay.style.display = 'none';
  if (tableArea) tableArea.style.display = 'none';

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

  // Informative Rückmeldung für Mitspieler (nicht für den Host, der den Reset selbst angestoßen hat)
  if (message && !amIHost) {
    await GrimoireDialog.alert({
      title: 'Neuer Bund gestiftet',
      message: message,
      icon: '🏛️'
    });
  }
});

// --- VIRTUELLE MITSPIELER-SITZE RENDERN (RELATIVE UHRZEIGER-REIHENFOLGE) ---
function renderOpponents() {
  try {
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
    opponentsContainer.className = `opponents-container count-${opponents.length}`;
    opponentsContainer.classList.toggle('round-1-opponents', currentRound === 1);

  opponents.forEach(p => {
    const isHisTurn = (p.sessionId === currentActiveSessionId);
    const seatEl = document.createElement('div');
    seatEl.classList.add('player-seat');
    seatEl.id = `seat-${p.sessionId}`;
    seatEl.setAttribute('data-session-id', p.sessionId);
    seatEl.setAttribute('data-player-name', p.name);
    if (isHisTurn) seatEl.classList.add('seat-active-turn');

    const me = cachedPlayers.find(p => p.sessionId === mySessionId);
    const myTeam = me ? me.team : null;

    if (currentMatchFormat === 'team_2v2' && p.team) {
      if (p.team === 'team_a') {
        seatEl.classList.add('seat-team-sonnenfeuer');
      } else if (p.team === 'team_b') {
        seatEl.classList.add('seat-team-mondschatten');
      } else if (p.team === 'team_c') {
        seatEl.classList.add('seat-team-sternenwind');
      }
      if (myTeam && p.team === myTeam) {
        seatEl.classList.add('seat-team-partner');
      }
    }

    const initial = p.name ? p.name.charAt(0).toUpperCase() : '?';
    const disconnectedClass = !p.connected ? 'disconnected' : '';
    const dealerPinHtml = p.isDealer ? '<div class="seat-dealer-pin" title="Geber dieser Runde">D</div>' : '';

    const bidText = p.bid !== null ? p.bid : '-';
    const wonText = p.tricksWon !== undefined ? p.tricksWon : 0;

    let foreheadCardHtml = '';
    if (currentRound === 1 && p.round1Card) {
      const cardEl = renderCard(p.round1Card);
      const isColorCard = (p.round1Card.type === 'color');
      const suit = isColorCard ? p.round1Card.suit : p.round1Card.type;
      const suitNames = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
      const sName = suitNames[p.round1Card.suit] || '';
      const crestSvg = isColorCard ? (MEDIEVAL_ICONS[p.round1Card.suit] || '') : '';

      const specialCardInfo = {
        wizard: { name: 'Zauberer', icon: MEDIEVAL_ICONS.wizard || '🧙‍♂️' },
        jester: { name: 'Narr', icon: MEDIEVAL_ICONS.jester || '🃏' },
        dragon: { name: 'Drache', icon: MEDIEVAL_ICONS.dragon || '🐉' },
        fairy: { name: 'Fee', icon: MEDIEVAL_ICONS.fairy || '🧚' },
        bomb: { name: 'Bombe', icon: MEDIEVAL_ICONS.bomb || '💣' },
        unicorn: { name: 'Einhorn', icon: MEDIEVAL_ICONS.unicorn || '🦄' },
        shapeshifter: { name: 'Wandler', icon: MEDIEVAL_ICONS.shapeshifter || '🎭' },
        vampire: { name: 'Vampir', icon: MEDIEVAL_ICONS.vampire || '🧛' },
        cloud: { name: 'Wolke', icon: MEDIEVAL_ICONS.cloud || '☁️' },
        werewolf: { name: 'Mondbiest', icon: MEDIEVAL_ICONS.werewolf || '🐺' },
        werewolf_trump: { name: 'Mondbiest', icon: MEDIEVAL_ICONS.werewolf || '🐺' },
        werewolf_trump_pending: { name: 'Mondbiest', icon: MEDIEVAL_ICONS.werewolf || '🐺' },
        witch: { name: 'Hexe', icon: MEDIEVAL_ICONS.witch || '🧙‍♀️' },
        juggler: { name: 'Jongleur', icon: MEDIEVAL_ICONS.juggler || '🤹' }
      };

      let badgeHtml = '';
      if (isColorCard) {
        badgeHtml = `
          <div class="forehead-suit-badge forehead-suit-${p.round1Card.suit}" title="${sName}">
            <span class="forehead-suit-icon">${crestSvg}</span>
            <span class="forehead-suit-text">${sName}</span>
          </div>
        `;
      } else if (specialCardInfo[p.round1Card.type]) {
        const spec = specialCardInfo[p.round1Card.type];
        const cardTypeClass = p.round1Card.type.startsWith('werewolf') ? 'werewolf' : p.round1Card.type;
        badgeHtml = `
          <div class="forehead-suit-badge forehead-suit-${cardTypeClass}" title="${spec.name}">
            <span class="forehead-suit-icon">${spec.icon}</span>
            <span class="forehead-suit-text">${spec.name}</span>
          </div>
        `;
      }

      foreheadCardHtml = `
        <div class="forehead-floating-card" title="Stirnkarte von ${escapeHtml(p.name)}">
          ${cardEl.outerHTML}
          ${badgeHtml}
        </div>
      `;
    }

    let nameClass = 'seat-name';
    let iconPrefix = '';
    let nameTitle = `${escapeHtml(p.name)} – Klicken für Profil`;

    if (p.isHost) {
      nameClass += ' host-name';
      iconPrefix = '👑 ';
      nameTitle = `Gastgeber: ${escapeHtml(p.name)} – Klicken für Profil`;
    } else if (p.isBot) {
      const diff = p.difficulty || 'master';
      if (diff === 'novice') {
        nameClass += ' bot-novice';
        iconPrefix = '🌱 ';
      } else if (diff === 'archmage') {
        nameClass += ' bot-archmage';
        iconPrefix = '⚡ ';
      } else {
        nameClass += ' bot-master';
        iconPrefix = '✨ ';
      }
      nameTitle = `Virtueller Rat: ${escapeHtml(p.name)} – Klicken für Profil`;
    }

    let teamPrefix = '';
    if (currentMatchFormat === 'team_2v2' && p.team) {
      const isPartner = myTeam && p.team === myTeam;
      if (p.team === 'team_a') {
        teamPrefix = `<span style="margin-right: 2px;" title="Allianz des Sonnenfeuers${isPartner ? ' (Dein Gefährte)' : ''}">🔥</span>`;
      } else if (p.team === 'team_b') {
        teamPrefix = `<span style="margin-right: 2px;" title="Allianz der Mondschatten${isPartner ? ' (Dein Gefährte)' : ''}">🌙</span>`;
      } else if (p.team === 'team_c') {
        teamPrefix = `<span style="margin-right: 2px;" title="Allianz des Sternenwinds${isPartner ? ' (Dein Gefährte)' : ''}">🌪️</span>`;
      }
    }

    let bidPillHtml = '';
    if (p.bid === '✓') {
      bidPillHtml = `<span class="seat-bid-pill" style="border-color: #a855f7; color: #d8b4fe;" title="Tipp verdeckt abgegeben">🎯 ✓ Bereit</span>`;
    } else if (currentMatchFormat === 'team_2v2' && p.team) {
      const teamPlayers = cachedPlayers.filter(pl => pl.team === p.team);
      const teamWon = teamPlayers.reduce((s, pl) => s + (pl.tricksWon || 0), 0);
      const isSecretActive = (currentBiddingMode === 'secret' && currentGameState !== 'round_over');
      const allHaveBid = teamPlayers.length > 0 && teamPlayers.every(pl => pl.bid !== null && pl.bid !== undefined);
      let teamBidDisplay = '-';
      if (isSecretActive) {
        teamBidDisplay = '?';
      } else if (allHaveBid) {
        teamBidDisplay = teamPlayers.reduce((s, pl) => s + (typeof pl.bid === 'number' ? pl.bid : 0), 0);
      }
      bidPillHtml = `<span class="seat-bid-pill" title="Allianz-Stiche: ${teamWon} von ${teamBidDisplay}">🛡️ ${teamWon} / 🎯 ${teamBidDisplay}</span>`;
    } else if (p.bid === '?') {
      bidPillHtml = `<span class="seat-bid-pill" title="Tipp ist geheim">🏆 ${wonText} / 🎯 ?</span>`;
    } else {
      bidPillHtml = `<span class="seat-bid-pill" title="Gewonnen: ${wonText} | Vorhersage: ${bidText}">🏆 ${wonText} / 🎯 ${bidText}</span>`;
    }

    const frameClass = `frame-${p.avatarFrame || 'none'}`;
    let avatarVisualHtml = `<span class="seat-avatar-initial">${initial}</span>`;
    if (p.avatarId && p.avatarId.startsWith('icon_')) {
      avatarVisualHtml = `<img src="/images/avatars/${p.avatarId}.png" alt="" class="seat-avatar-img" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" onerror="this.remove();">${initial}`;
    }
    const levelBadgeHtml = (p.accountLevel && p.accountLevel > 0)
      ? `<span class="user-pill-level-badge" title="Stufe ${p.accountLevel}">Lvl ${p.accountLevel}</span>`
      : '';

    seatEl.innerHTML = `
      ${foreheadCardHtml}
      <div class="seat-avatar ${disconnectedClass} ${frameClass}">
        ${avatarVisualHtml}
        ${dealerPinHtml}
      </div>
      <div class="seat-details">
        <div class="seat-name-row" style="cursor: pointer;" title="${nameTitle}">
          <span class="${nameClass}" title="${nameTitle}">${teamPrefix}${iconPrefix}${escapeHtml(p.name)}</span>
          ${levelBadgeHtml}
        </div>
        ${bidPillHtml}
      </div>
    `;

    // Klick auf Biet-Pille öffnet Magier-Profil
    const bidPill = seatEl.querySelector('.seat-bid-pill');
    if (bidPill) {
      if (bidPill.style) bidPill.style.cursor = 'pointer';
      bidPill.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof openPlayerDetailModal === 'function') {
          openPlayerDetailModal(p, 'table');
        }
      });
    }

    // Klick auf Avatar öffnet Magier-Profil
    const avatarEl = seatEl.querySelector('.seat-avatar');
    if (avatarEl) {
      if (avatarEl.style) avatarEl.style.cursor = 'pointer';
      avatarEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof openPlayerDetailModal === 'function') {
          openPlayerDetailModal(p, 'table');
        }
      });
    }

    // Klick auf Name öffnet Magier-Profil
    const nameRow = seatEl.querySelector('.seat-name-row');
    if (nameRow) {
      nameRow.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof openPlayerDetailModal === 'function') {
          openPlayerDetailModal(p, 'table');
        }
      });
    }

    // Interaktives Magier-Profil Modal beim Klick auf den Sitz (oder Stirnkarten-Großansicht)
    seatEl.style.cursor = 'pointer';
    seatEl.setAttribute('title', `${escapeHtml(p.name)} – Klicken für Details`);
    seatEl.addEventListener('click', (e) => {
      const foreheadEl = e.target.closest('.forehead-floating-card') || e.target.closest('.forehead-card-wrapper');
      if (foreheadEl && p.round1Card) {
        e.stopPropagation();
        openForeheadInspectModal(p);
        return;
      }
      if (typeof openPlayerDetailModal === 'function') {
        openPlayerDetailModal(p, 'table');
      }
    });

    opponentsContainer.appendChild(seatEl);
  });
  updateBiddingSummaryPill();
  } catch (err) {
    console.error('Fehler in renderOpponents:', err);
  }
}

function updateMyStatsHUD() {
  const me = cachedPlayers.find(p => p.sessionId === mySessionId);
  const bidEl = document.getElementById('my-hud-bid');
  const tricksEl = document.getElementById('my-hud-tricks');
  const hudContainer = document.getElementById('my-stats-hud');

  const bidVal = (me && me.bid !== null && me.bid !== undefined)
    ? me.bid
    : '-';
  const tricksVal = (me && me.tricksWon !== undefined) ? me.tricksWon : 0;

  if (bidEl) bidEl.innerText = bidVal;
  if (tricksEl) tricksEl.innerText = tricksVal;

  // 2vs2 Allianzen: Team-Stiche und Team-Gebot im HUD aktualisieren
  const teamSep = document.getElementById('my-hud-team-separator');
  const teamContainer = document.getElementById('my-hud-team-container');
  const teamNameEl = document.getElementById('my-hud-team-name');
  const teamIconEl = document.getElementById('my-hud-team-icon');
  const teamTricksEl = document.getElementById('my-hud-team-tricks');

  if (currentMatchFormat === 'team_2v2' && me && me.team) {
    if (teamSep) teamSep.style.display = 'inline';
    if (teamContainer) teamContainer.style.display = 'inline-flex';
    if (teamIconEl) {
      const teamIcons = { team_a: '🔥', team_b: '🌙', team_c: '🌪️' };
      teamIconEl.innerText = teamIcons[me.team] || '🛡️';
      teamIconEl.style.display = 'inline-block';
    }
    if (teamNameEl) {
      const teamNames = { team_a: '🔥 Allianz:', team_b: '🌙 Allianz:', team_c: '🌪️ Allianz:' };
      teamNameEl.innerText = teamNames[me.team] || '🛡️ Allianz:';
    }
    const myAlliancePlayers = cachedPlayers.filter(p => p.team === me.team);
    const totalWon = myAlliancePlayers.reduce((sum, p) => sum + (p.tricksWon || 0), 0);
    const isSecretActive = (currentBiddingMode === 'secret' && currentGameState !== 'round_over');
    const allHaveBid = myAlliancePlayers.length > 0 && myAlliancePlayers.every(p => p.bid !== null && p.bid !== undefined);
    let totalBid = '-';
    if (isSecretActive) {
      totalBid = '?';
    } else if (allHaveBid) {
      totalBid = myAlliancePlayers.reduce((sum, p) => sum + (typeof p.bid === 'number' ? p.bid : 0), 0);
    }
    if (tricksEl) tricksEl.innerText = totalWon;
    if (bidEl) bidEl.innerText = totalBid;
    if (teamTricksEl) {
      teamTricksEl.innerText = `${totalWon}/${totalBid}`;
      teamTricksEl.title = `Allianz-Stiche: ${totalWon} von ${totalBid}`;
    }
  } else {
    if (teamSep) teamSep.style.display = 'none';
    if (teamContainer) teamContainer.style.display = 'none';
  }

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

  updateBiddingSummaryPill();
}

// --- BIETBILANZ PILL (TISCH & HUD) ---
function updateBiddingSummaryPill() {
  const pill = document.getElementById('bidding-summary-pill');
  if (!pill) return;

  if (currentGameState === 'lobby' || currentGameState === 'waiting') {
    pill.style.display = 'none';
    return;
  }

  // Im geheimen Bietmodus wird beim Trumpf keine Gesamtzahl / Bilanz mehr angezeigt
  if (currentBiddingMode === 'secret') {
    pill.style.display = 'none';
    return;
  }

  const allBids = cachedPlayers.map(p => p.bid).filter(b => typeof b === 'number');
  if (allBids.length < cachedPlayers.length || cachedPlayers.length === 0) {
    if (currentGameState === 'bidding') {
      pill.style.display = 'none';
      return;
    }
  }

  const sumBids = allBids.reduce((a, b) => a + b, 0);
  const diff = sumBids - currentRound;
  let statusText = '';
  let statusClass = '';

  if (diff > 0) {
    statusText = `+${diff} Überboten`;
    statusClass = 'bidding-summary-overbid';
  } else if (diff < 0) {
    statusText = `${diff} Unterboten`;
    statusClass = 'bidding-summary-underbid';
  } else {
    statusText = 'Ausgeglichen';
    statusClass = 'bidding-summary-even';
  }

  pill.style.display = 'inline-flex';
  pill.className = `bidding-summary-pill ${statusClass}`;
  pill.innerText = `🎯 ${sumBids} / ${currentRound} (${statusText})`;
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

    // Spielername über der gespielten Karte
    const nameBadge = document.createElement('div');
    nameBadge.className = 'trick-card-player-name';
    nameBadge.innerText = item.playerName || 'Magier';
    wrap.appendChild(nameBadge);

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
    subText.innerText = 'Mondbiest wählt...';
  } else if (trumpCard.type === 'werewolf_trump') {
    const sName = suitNames[trumpCard.chosenSuit || trumpCard.suit] || 'Unbekannt';
    subText.style.color = 'var(--gold-bright)';
    subText.innerText = `Mondbiest: ${sName}`;
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
    if (i === 0 && currentScoringMode === 'skull_king_zero') {
      btn.classList.add('bid-btn-zero');
      btn.title = '0 Stiche prophezeien (Schattenfluch: ±Runde × 10 Punkte!)';
    }
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

// --- HANDKARTEN RENDERN & INTELLIGENTES RE-RENDERING ---
function getCardKey(card) {
  if (!card) return '';
  const copyKey = card.copiedCard ? `_copy(${getCardKey(card.copiedCard)})` : '';
  return `${card.type}_${card.suit || ''}_${card.value !== undefined ? card.value : ''}_${card.variant || ''}_${card.variantSuit || ''}_${card.chosenRole || ''}_${card.chosenSuit || ''}_${card.isBlind ? 'blind' : ''}${copyKey}`;
}

function onHandCardClick(e) {
  e.stopPropagation();
  const cardElement = e.currentTarget;
  const index = parseInt(cardElement.getAttribute('data-index'), 10);
  if (isNaN(index) || index < 0 || index >= myCurrentHand.length) return;
  const card = myCurrentHand[index];
  if (!card) return;

  const isTouchDevice = ('ontouchstart' in window) && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  if (isTouchDevice && inspectedCardIndex !== index) {
    inspectedCardIndex = index;
    GrimoireHaptics.selection();
    renderHand();
    return;
  }

  const isPlayingPhase = (currentGameState === 'playing_tricks');
  const playable = isMyTurn && isPlayingPhase && isCardPlayable(card, myCurrentHand, currentTrick);
  if (!playable) {
    if (isTouchDevice && inspectedCardIndex === index) {
      inspectedCardIndex = null;
      renderHand();
    }
    return;
  }

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

function renderHand(isNewDeal = false) {
  if (isDealingAnimationPending && !isNewDeal) {
    return;
  }

  if (handContainer && isNewDeal) {
    handContainer.scrollLeft = 0;
  }

  const total = myCurrentHand.length;
  const isMobile = window.innerWidth <= 768;
  const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
  const isSwipeable = isMobile && total >= 5;
  const isTabletScrollable = isTablet && total >= 6;
  const enableSwipe = isSwipeable || isTabletScrollable;
  const restY = isMobile ? 16 : 0;

  let dynamicMargin = '3px';
  if (enableSwipe) {
    dynamicMargin = '-16px';
  } else if (total > 15) {
    dynamicMargin = '-54px';
  } else if (total > 12) {
    dynamicMargin = '-46px';
  } else if (total > 9) {
    dynamicMargin = '-36px';
  } else if (total > 6) {
    dynamicMargin = '-24px';
  } else if (total > 3) {
    dynamicMargin = '-10px';
  }

  if (enableSwipe) {
    handContainer.classList.add('swipeable');
  } else {
    handContainer.classList.remove('swipeable');
  }

  const isPlayingPhase = (currentGameState === 'playing_tricks');
  const existingChildren = Array.from(handContainer.children);
  const isSameHand = !isNewDeal && existingChildren.length === total && total > 0 &&
    existingChildren.every((el, idx) => el.getAttribute('data-card-key') === getCardKey(myCurrentHand[idx]));

  if (isSameHand) {
    existingChildren.forEach((cardElement, index) => {
      const card = myCurrentHand[index];
      const playable = isMyTurn && isPlayingPhase && isCardPlayable(card, myCurrentHand, currentTrick);

      cardElement.setAttribute('data-index', index);
      cardElement.style.setProperty('margin-left', (index === 0) ? '0px' : (enableSwipe ? '-16px' : dynamicMargin), 'important');
      cardElement.style.setProperty('margin-right', '0px', 'important');
      cardElement.style.zIndex = index + 1;

      if (inspectedCardIndex === index) {
        cardElement.classList.add('card-inspected');
      } else {
        cardElement.classList.remove('card-inspected');
        cardElement.style.transform = `translateY(${restY}px) rotate(0deg)`;
      }

      cardElement.classList.toggle('card-playable', playable);
      if (playable) {
        cardElement.style.filter = 'brightness(1)';
        cardElement.style.opacity = '1';
      } else if (isMyTurn && isPlayingPhase) {
        cardElement.style.filter = 'brightness(0.35)';
        cardElement.style.opacity = '0.45';
      } else {
        cardElement.style.filter = 'brightness(1)';
        cardElement.style.opacity = '1';
      }
    });
    return;
  }

  handContainer.innerHTML = '';

  myCurrentHand.forEach((card, index) => {
    const cardElement = renderCard(card);
    const playable = isMyTurn && isPlayingPhase && isCardPlayable(card, myCurrentHand, currentTrick);

    const angle = 0;
    const offsetY = restY;

    cardElement.setAttribute('data-card-key', getCardKey(card));
    cardElement.setAttribute('data-index', index);
    cardElement.style.setProperty('margin-left', (index === 0) ? '0px' : (enableSwipe ? '-16px' : dynamicMargin), 'important');
    cardElement.style.setProperty('margin-right', '0px', 'important');
    cardElement.style.zIndex = index + 1;

    if (inspectedCardIndex === index) {
      cardElement.classList.add('card-inspected');
    }

    cardElement.style.setProperty('--target-y', `${offsetY}px`);
    cardElement.style.setProperty('--target-rot', `${angle}deg`);

    if (isNewDeal) {
      cardElement.classList.add('card-fly-up');
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
      cardElement.style.filter = 'brightness(1)';
      cardElement.style.opacity = '1';
    } else {
      cardElement.classList.remove('card-playable');
      if (isMyTurn && isPlayingPhase) {
        cardElement.style.filter = 'brightness(0.35)';
        cardElement.style.opacity = '0.45';
      } else {
        cardElement.style.filter = 'brightness(1)';
        cardElement.style.opacity = '1';
      }
    }

    cardElement.addEventListener('click', onHandCardClick);
    handContainer.appendChild(cardElement);
  });

  if (handContainer && (isNewDeal || (isSwipeable && !isSameHand))) {
    handContainer.scrollLeft = 0;
  }
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
  let artImg = null;
  if (artFiles && artFiles.length > 0 && !card.isBlind && card.type !== 'blind_card') {
    div.classList.add('card-has-artwork');
    artImg = document.createElement('img');
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
        <span class="card-val">Z</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.wizard}</div>
        <div class="card-center-val" style="font-size: 26px; color: #fef08a; margin-top: 2px;">Z</div>
        <div class="card-name-label"><em>Erzmagier</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">Z</span>
      </div>
    `;
  } else if (card.type === 'jester') {
    div.classList.add('card-jester');
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">N</span>
      </div>
      <div class="card-center">
        <div class="card-center-crest">${MEDIEVAL_ICONS.jester}</div>
        <div class="card-center-val" style="font-size: 26px; color: #f8fafc; margin-top: 2px;">N</div>
        <div class="card-name-label"><em>Scharlatan</em></div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">N</span>
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
    const roleSub = card.chosenRole === 'wizard' ? ' (Z)' : (card.chosenRole === 'jester' ? ' (N)' : '');
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
        copyLabel = `<div style="font-size: 8.5px; color: #f59e0b; margin-top: 1px;">Kopie: Mondbiest${cSuit}</div>`;
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
        <div class="card-name-label"><em>Mondbiest</em></div>
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
        <div class="card-name-label"><em>Mondbiest-Trumpf: ${suitName}</em></div>
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
    div.innerHTML += `
      <div class="card-corner top-left">
        <span class="card-val">${card.value}</span>
      </div>
      <div class="card-center">
        <div class="card-center-val">${card.value}</div>
        <div class="card-center-crest">${iconSvg}</div>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">${card.value}</span>
      </div>
    `;
  }

  // Farbschatten (Glow) für Wolke und Jongleur bei gewählter Bedienfarbe
  if ((card.type === 'cloud' || card.type === 'juggler') && card.chosenSuit) {
    div.classList.add(`card-glow-${card.chosenSuit}`);
  }

  // Namens-Banner unter allen arkanen Nicht-Zahlen-Karten (auch bei vollflächigem Artwork sichtbar!)
  let bottomLabelText = '';
  const suitNamesGerman = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' };
  if (card.type === 'wizard') {
    bottomLabelText = '🧙‍♂️ Zauberer';
  } else if (card.type === 'jester') {
    bottomLabelText = '🃏 Narr';
  } else if (card.type === 'dragon') {
    bottomLabelText = '🐉 Drache';
  } else if (card.type === 'fairy') {
    bottomLabelText = '🧚 Fee';
  } else if (card.type === 'bomb') {
    bottomLabelText = '💣 Bombe';
  } else if (card.type === 'unicorn') {
    bottomLabelText = '🦄 Einhorn';
  } else if (card.type === 'werewolf' || card.type === 'werewolf_trump_pending') {
    bottomLabelText = '🐺 Mondbiest';
  } else if (card.type === 'werewolf_trump') {
    const sName = suitNamesGerman[card.chosenSuit || card.suit] || '';
    bottomLabelText = sName ? `🐺 Mondbiest (${sName})` : '🐺 Mondbiest';
  } else if (card.type === 'witch') {
    bottomLabelText = '🧙‍♀️ Hexe';
  } else if (card.type === 'vampire') {
    bottomLabelText = '🧛 Vampir';
  } else if (card.type === 'shapeshifter') {
    if (card.chosenRole === 'wizard') {
      bottomLabelText = '🎭 Doppelgänger (E)';
    } else if (card.chosenRole === 'jester') {
      bottomLabelText = '🎭 Doppelgänger (S)';
    } else {
      bottomLabelText = '🎭 Doppelgänger';
    }
  } else if (card.type === 'cloud') {
    const sName = suitNamesGerman[card.chosenSuit] || '';
    bottomLabelText = sName ? `☁️ Wolke (${sName})` : '☁️ Wolke';
  } else if (card.type === 'juggler') {
    const sName = suitNamesGerman[card.chosenSuit] || '';
    bottomLabelText = sName ? `🤹 Jongleur (${sName})` : '🤹 Jongleur';
  }

  if (bottomLabelText) {
    const bLabel = document.createElement('div');
    bLabel.className = 'card-bottom-label';
    bLabel.innerText = bottomLabelText;
    div.appendChild(bLabel);
  }

  if (artImg) {
    div.prepend(artImg);
  }

  return div;
}

// --- DAS BUCH DER WAHRHEIT (TABELLE) ---
function renderScoreBoard() {
  scoreTableHead.innerHTML = '';
  scoreTableBody.innerHTML = '';

  const allianceOverview = document.getElementById('alliance-score-overview');
  if (allianceOverview) {
    if (currentMatchFormat === 'team_2v2') {
      allianceOverview.style.display = 'flex';
      const scoreA = currentTeams?.team_a?.score || 0;
      const scoreB = currentTeams?.team_b?.score || 0;
      const hasTeamC = (currentTeams?.team_c && (cachedPlayers.some(p => p.team === 'team_c') || currentTeams.team_c.score !== 0));
      const scoreC = currentTeams?.team_c?.score || 0;
      let teamCHtml = '';
      if (hasTeamC) {
        teamCHtml = `
          <div class="alliance-score-box alliance-score-box-sternenwind">
            <div style="font-size: 11px; opacity: 0.9;">🌪️ Sternenwind</div>
            <div style="font-size: 16px; font-weight: bold;">${scoreC} Pkt.</div>
          </div>
        `;
      }
      allianceOverview.innerHTML = `
        <div class="alliance-score-box alliance-score-box-sonnenfeuer">
          <div style="font-size: 11px; opacity: 0.9;">🔥 Sonnenfeuer</div>
          <div style="font-size: 16px; font-weight: bold;">${scoreA} Pkt.</div>
        </div>
        <div class="alliance-score-box alliance-score-box-mondschatten">
          <div style="font-size: 11px; opacity: 0.9;">🌙 Mondschatten</div>
          <div style="font-size: 16px; font-weight: bold;">${scoreB} Pkt.</div>
        </div>
        ${teamCHtml}
      `;
    } else {
      allianceOverview.style.display = 'none';
      allianceOverview.innerHTML = '';
    }
  }

  if (cachedPlayers.length === 0) return;

  // Im Team-Modus die Spieler-Spalten sauber nach Allianzen gruppieren
  let displayPlayers = [...cachedPlayers];
  if (currentMatchFormat === 'team_2v2') {
    const teamOrder = { team_a: 1, team_b: 2, team_c: 3 };
    displayPlayers.sort((a, b) => {
      const ordA = teamOrder[a.team] || 99;
      const ordB = teamOrder[b.team] || 99;
      if (ordA !== ordB) return ordA - ordB;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  const headerRow = document.createElement('tr');
  const thRound = document.createElement('th');
  thRound.innerText = 'Runde';
  thRound.style.width = '60px';
  headerRow.appendChild(thRound);

  displayPlayers.forEach(player => {
    const th = document.createElement('th');
    const isMe = (player.sessionId === mySessionId);
    const hostBadge = player.isHost ? '<span class="host-badge">Host</span>' : '';
    const dealerBadge = player.isDealer ? '<span class="dealer-badge">Geber</span>' : '';
    const disconnected = !player.connected ? ' (Getrennt)' : '';
    let teamBadge = '';
    if (currentMatchFormat === 'team_2v2' && player.team) {
      if (player.team === 'team_a') {
        teamBadge = '<span style="color: #f87171; font-size: 10px; font-weight: bold; display: block;">🔥 Sonnenfeuer</span>';
      } else if (player.team === 'team_b') {
        teamBadge = '<span style="color: #60a5fa; font-size: 10px; font-weight: bold; display: block;">🌙 Mondschatten</span>';
      } else if (player.team === 'team_c') {
        teamBadge = '<span style="color: #10b981; font-size: 10px; font-weight: bold; display: block;">🌪️ Sternenwind</span>';
      }
    }

    th.innerHTML = `
      <div>${escapeHtml(player.name)} ${isMe ? '<b>(Du)</b>' : ''}${disconnected}</div>
      <div style="margin: 2px 0;">${teamBadge}${hostBadge}${dealerBadge}</div>
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

    displayPlayers.forEach(player => {
      const td = document.createElement('td');
      const entry = record.entries ? record.entries.find(e => e.sessionId === player.sessionId) : null;

      if (entry) {
        const sign = entry.roundPoints >= 0 ? `+${entry.roundPoints}` : `${entry.roundPoints}`;
        const colorClass = entry.roundPoints >= 0 ? 'score-positive' : 'score-negative';
        const displayBid = entry.bid;

        td.innerHTML = `
          <div><small>G: <b>${entry.tricksWon}</b> | T: <b>${displayBid}</b></small></div>
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

    displayPlayers.forEach(player => {
      const td = document.createElement('td');
      let bidText = player.bid !== null ? player.bid : '-';
      if (currentBiddingMode === 'secret' && currentGameState !== 'round_over') {
        bidText = '?';
      }
      const wonText = player.tricksWon !== undefined ? player.tricksWon : 0;

      td.innerHTML = `<div><small>G: <b>${wonText}</b> | T: <b>${bidText}</b></small></div>`;
      liveRow.appendChild(td);
    });

    scoreTableBody.appendChild(liveRow);
  }

  const scrollContainer = document.querySelector('.drawer-scroll');
  if (scrollContainer) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }
}

// ==========================================================================
// HIGHLIGHT DES SPIELS & POST-MATCH MVP VOTING CONTROLLER
// ==========================================================================
let highlightActiveTimeout = null;
let highlightCardTimeouts = [];
let pendingHighlight = null;
let pendingMvpCandidates = null;
let pendingProgressionSummary = null;
let mvpCountdownInterval = null;
let myVotedCandidateSessionId = null;

function playHighlightSequence(highlightData, onDone) {
  if (!highlightData) {
    if (typeof onDone === 'function') onDone();
    return;
  }

  const modal = document.getElementById('highlight-modal');
  if (!modal) {
    if (typeof onDone === 'function') onDone();
    return;
  }

  if (highlightActiveTimeout) clearTimeout(highlightActiveTimeout);
  highlightCardTimeouts.forEach(t => clearTimeout(t));
  highlightCardTimeouts = [];

  const headlineEl = document.getElementById('highlightHeadline');
  const descEl = document.getElementById('highlightDescription');
  const avatarWrap = document.getElementById('highlightPlayerAvatarWrap');
  const avatarImg = document.getElementById('highlightPlayerAvatarImg');
  const nameEl = document.getElementById('highlightPlayerName');
  const titleEl = document.getElementById('highlightPlayerTitle');
  const track = document.getElementById('highlightCardsTrack');
  const callout = document.getElementById('highlightWinnerCallout');
  const calloutTxt = document.getElementById('highlightWinnerCalloutTxt');
  const btnSkip = document.getElementById('btnSkipHighlight');

  if (headlineEl) headlineEl.innerText = highlightData.headline || 'Highlight des Spiels';
  if (descEl) descEl.innerText = highlightData.description || 'Ein spektakulärer Stich!';
  if (nameEl) nameEl.innerText = highlightData.winnerName || 'Magier';
  if (titleEl) titleEl.innerText = highlightData.winnerTitle || 'Magier der Zitadelle';

  if (avatarWrap) {
    avatarWrap.className = `seat-avatar frame-${highlightData.winnerFrame || 'none'}`;
  }
  if (avatarImg) {
    const av = highlightData.winnerAvatar || 'default';
    if (av.startsWith('icon_')) {
      avatarImg.style.display = 'block';
      avatarImg.src = `/images/avatars/${av}.png`;
    } else {
      avatarImg.style.display = 'none';
      if (avatarWrap) {
        const init = (highlightData.winnerName || 'M').charAt(0).toUpperCase();
        avatarWrap.innerHTML = `<span style="font-family:var(--font-heading);font-size:28px;color:var(--gold-bright);">${init}</span>`;
      }
    }
  }

  if (track) track.innerHTML = '';
  if (callout) callout.style.display = 'none';

  modal.style.display = 'flex';

  let hasEnded = false;
  function finishHighlight() {
    if (hasEnded) return;
    hasEnded = true;
    if (highlightActiveTimeout) clearTimeout(highlightActiveTimeout);
    highlightCardTimeouts.forEach(t => clearTimeout(t));
    highlightCardTimeouts = [];
    modal.style.display = 'none';
    if (typeof onDone === 'function') onDone();
  }

  if (btnSkip) {
    btnSkip.onclick = () => {
      finishHighlight();
    };
  }

  const trickCards = highlightData.trick || [];
  const cardDelay = trickCards.length > 0 ? Math.min(650, Math.max(350, Math.floor(2500 / trickCards.length))) : 500;

  trickCards.forEach((item, idx) => {
    const t = setTimeout(() => {
      if (hasEnded || !track) return;
      const wrap = document.createElement('div');
      wrap.className = 'highlight-card-wrapper';
      wrap.setAttribute('data-session-id', item.playerSessionId || '');

      const cardNode = renderCard(item.card);
      wrap.appendChild(cardNode);

      const pLabel = document.createElement('div');
      pLabel.style.fontSize = '11px';
      pLabel.style.fontWeight = 'bold';
      pLabel.style.marginTop = '6px';
      pLabel.style.color = '#ebd7af';
      pLabel.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
      pLabel.innerText = item.playerName || 'Magier';
      wrap.appendChild(pLabel);

      track.appendChild(wrap);

      if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
        WizardAudio.playCardSnap();
      }
    }, 1500 + idx * cardDelay);
    highlightCardTimeouts.push(t);
  });

  const totalDropTime = 1500 + trickCards.length * cardDelay;
  const victoryTimer = setTimeout(() => {
    if (hasEnded) return;

    if (track && highlightData.winnerSessionId) {
      const winnerWrap = track.querySelector(`[data-session-id="${highlightData.winnerSessionId}"] .card`);
      if (winnerWrap) {
        winnerWrap.classList.add('highlight-winner-pulse');
      }
    }

    if (callout && calloutTxt) {
      calloutTxt.innerText = `${highlightData.winnerName} gewinnt den Stich! 🏆`;
      callout.style.display = 'block';
    }

    if (typeof WizardAudio !== 'undefined' && WizardAudio.playTurnChime) {
      WizardAudio.playTurnChime();
    }
  }, totalDropTime);
  highlightCardTimeouts.push(victoryTimer);

  highlightActiveTimeout = setTimeout(() => {
    finishHighlight();
  }, totalDropTime + 1800);
}

function startMvpVoting(data, onDone) {
  if (!data || !data.candidates || data.candidates.length === 0) {
    if (typeof onDone === 'function') onDone();
    return;
  }

  const modal = document.getElementById('mvp-voting-modal');
  if (!modal) {
    if (typeof onDone === 'function') onDone();
    return;
  }

  if (modal.style.display !== 'none' && myVotedCandidateSessionId) {
    return;
  }

  myVotedCandidateSessionId = null;
  if (mvpCountdownInterval) clearInterval(mvpCountdownInterval);

  const grid = document.getElementById('mvpCandidatesGrid');
  const timerSec = document.getElementById('mvpTimerSec');
  const timerPill = document.querySelector('.mvp-timer-pill');
  const winnerBanner = document.getElementById('mvpWinnerBanner');
  const btnProceed = document.getElementById('btnProceedFromMvp');

  if (timerPill) timerPill.style.display = 'inline-block';
  if (winnerBanner) winnerBanner.style.display = 'none';

  let hasClosed = false;
  function closeMvpModal() {
    if (hasClosed) return;
    hasClosed = true;
    if (mvpCountdownInterval) clearInterval(mvpCountdownInterval);
    modal.style.display = 'none';
    if (typeof onDone === 'function') onDone();
  }

  if (btnProceed) {
    btnProceed.style.display = 'inline-block';
    btnProceed.innerText = 'Weiter zum Level-Fortschritt ➔';
    btnProceed.onclick = () => {
      closeMvpModal();
    };
  }

  let timeLeft = Math.round((data.durationMs || 15000) / 1000);
  if (timerSec) timerSec.innerText = timeLeft;

  mvpCountdownInterval = setInterval(() => {
    timeLeft--;
    if (timerSec) timerSec.innerText = Math.max(0, timeLeft);
    if (timeLeft <= 0) {
      clearInterval(mvpCountdownInterval);
    }
  }, 1000);

  if (grid) {
    grid.innerHTML = '';
    data.candidates.forEach(cand => {
      const card = document.createElement('div');
      card.className = 'mvp-card';
      card.setAttribute('data-session-id', cand.sessionId);

      const initial = cand.name ? cand.name.charAt(0).toUpperCase() : '?';
      const av = cand.avatarId || 'default';
      const isCustom = av.startsWith('icon_');
      const imgHtml = isCustom ? `<img src="/images/avatars/${av}.png" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.remove();">${initial}` : initial;

      card.innerHTML = `
        <div class="seat-avatar frame-${cand.frame || 'none'}" style="width: 58px; height: 66px; font-size: 26px; margin-bottom: 6px;">
          ${imgHtml}${initial}
        </div>
        <div style="font-weight: 800; font-size: 14px; color: #fff; margin-bottom: 2px;">${escapeHtml(cand.name)}</div>
        <div class="mvp-card-badge">${cand.badge || '⭐ Meistermagier'}</div>
        <div class="mvp-card-reason">${escapeHtml(cand.reason || '')}</div>
        <div class="mvp-card-votes" id="mvp-votes-${cand.sessionId}">0 Stimmen</div>
        <button type="button" class="btn-auth-bar btn-auth-gold btn-vote-cand" style="margin-top: 10px; width: 100%; padding: 6px 10px; font-size: 12px; font-weight: bold;">
          Wählen
        </button>
      `;

      const voteBtn = card.querySelector('.btn-vote-cand');
      if (voteBtn) {
        voteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (myVotedCandidateSessionId) return;
          myVotedCandidateSessionId = cand.sessionId;

          const allCards = grid.querySelectorAll('.mvp-card');
          allCards.forEach(c => {
            const sid = c.getAttribute('data-session-id');
            const btn = c.querySelector('.btn-vote-cand');
            if (sid === cand.sessionId) {
              c.classList.add('voted-mine');
              if (btn) {
                btn.innerText = '✓ Gewählt';
                btn.disabled = true;
              }
            } else {
              c.classList.add('voted-other');
              if (btn) btn.disabled = true;
            }
          });

          if (typeof WizardAudio !== 'undefined' && WizardAudio.playCardSnap) {
            WizardAudio.playCardSnap();
          }

          if (socket && socket.connected) {
            socket.emit('mvp:vote', {
              roomCode: currentRoomCode,
              candidateSessionId: cand.sessionId
            });
          }
        });
      }

      grid.appendChild(card);
    });
  }

  modal.style.display = 'flex';
}

function onMvpVotesUpdated({ voteCounts }) {
  if (!voteCounts) return;
  Object.keys(voteCounts).forEach(sid => {
    const el = document.getElementById(`mvp-votes-${sid}`);
    if (el) {
      const v = voteCounts[sid] || 0;
      el.innerText = `${v} Stimme${v === 1 ? '' : 'n'}`;
    }
  });
}

function onMvpResultsReceived(res) {
  if (mvpCountdownInterval) clearInterval(mvpCountdownInterval);
  const timerPill = document.querySelector('.mvp-timer-pill');
  if (timerPill) timerPill.style.display = 'none';

  const winnerBanner = document.getElementById('mvpWinnerBanner');
  const winnerName = document.getElementById('mvpWinnerName');
  const winnerBadge = document.getElementById('mvpWinnerBadge');
  const winnerReward = document.getElementById('mvpWinnerReward');
  const btnProceed = document.getElementById('btnProceedFromMvp');

  if (winnerName) winnerName.innerText = res.winnerName || 'Zitadellen-Magier';
  if (winnerBadge) winnerBadge.innerText = res.badge || 'MVP DER ZITADELLE';
  if (winnerReward) {
    winnerReward.innerText = `✨ +${res.bonusXP || 50} Bonus-XP & Titel "MVP der Zitadelle" verliehen!`;
  }
  if (winnerBanner) {
    winnerBanner.style.display = 'block';
  }

  if (res.winnerSessionId) {
    const winnerCard = document.querySelector(`.mvp-card[data-session-id="${res.winnerSessionId}"]`);
    if (winnerCard) {
      winnerCard.style.borderColor = '#facc15';
      winnerCard.style.boxShadow = '0 0 25px rgba(250, 204, 21, 0.7)';
    }
  }

  if (typeof WizardAudio !== 'undefined' && WizardAudio.playMvpGong) {
    WizardAudio.playMvpGong();
  }

  if (btnProceed) {
    btnProceed.style.display = 'inline-block';
    btnProceed.innerText = 'Weiter zum Level-Fortschritt ➔';
  }

  setTimeout(() => {
    const modal = document.getElementById('mvp-voting-modal');
    if (modal && modal.style.display !== 'none') {
      const btn = document.getElementById('btnProceedFromMvp');
      if (btn && btn.onclick) btn.onclick();
    }
  }, 4500);
}

function handleGameOverSequence(amIHost) {
  function proceedToProgressionOrPodium() {
    if (pendingProgressionSummary) {
      const summary = pendingProgressionSummary;
      pendingProgressionSummary = null;
      if (typeof WizardVault !== 'undefined' && WizardVault.showMatchProgression) {
        WizardVault.showMatchProgression(summary);
      }
      const btnProgClose = document.getElementById('btnProgressionClose');
      const btnProgVault = document.getElementById('btnProgressionOpenVault');
      const onProgClosed = () => {
        showGameOverScreen(amIHost);
      };
      if (btnProgClose) btnProgClose.onclick = onProgClosed;
      if (btnProgVault) {
        btnProgVault.onclick = () => {
          const modal = document.getElementById('progression-modal');
          if (modal) modal.style.display = 'none';
          showGameOverScreen(amIHost);
          if (typeof WizardVault !== 'undefined' && WizardVault.openVault) {
            WizardVault.openVault('chests');
          }
        };
      }
    } else {
      showGameOverScreen(amIHost);
    }
  }

  if (pendingHighlight) {
    const hl = pendingHighlight;
    pendingHighlight = null;
    playHighlightSequence(hl, () => {
      if (pendingMvpCandidates && pendingMvpCandidates.length > 0) {
        startMvpVoting({ candidates: pendingMvpCandidates, durationMs: 15000 }, () => {
          proceedToProgressionOrPodium();
        });
      } else {
        proceedToProgressionOrPodium();
      }
    });
  } else if (pendingMvpCandidates && pendingMvpCandidates.length > 0) {
    startMvpVoting({ candidates: pendingMvpCandidates, durationMs: 15000 }, () => {
      proceedToProgressionOrPodium();
    });
  } else {
    proceedToProgressionOrPodium();
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

  if (currentMatchFormat === 'team_2v2' && currentTeams) {
    const scoreA = currentTeams.team_a?.score || 0;
    const scoreB = currentTeams.team_b?.score || 0;
    const hasTeamC = (currentTeams.team_c && (cachedPlayers.some(p => p.team === 'team_c') || currentTeams.team_c.score !== 0));
    const scoreC = currentTeams.team_c?.score || 0;
    let winningTeamText = '';
    if (!hasTeamC) {
      if (scoreA > scoreB) {
        winningTeamText = `🏆 Sieg für die Allianz des Sonnenfeuers (${scoreA} : ${scoreB})`;
      } else if (scoreB > scoreA) {
        winningTeamText = `🏆 Sieg für die Allianz der Mondschatten (${scoreB} : ${scoreA})`;
      } else {
        winningTeamText = `⚖️ Unentschieden (${scoreA} : ${scoreB})`;
      }
    } else {
      const teamsArr = [
        { name: 'Allianz des Sonnenfeuers', icon: '🔥', score: scoreA },
        { name: 'Allianz der Mondschatten', icon: '🌙', score: scoreB },
        { name: 'Allianz des Sternenwinds', icon: '🌪️', score: scoreC }
      ];
      const maxScore = Math.max(scoreA, scoreB, scoreC);
      const winners = teamsArr.filter(t => t.score === maxScore);
      const scoreStr = `(🔥 ${scoreA} : 🌙 ${scoreB} : 🌪️ ${scoreC})`;
      if (winners.length === 1) {
        winningTeamText = `🏆 Sieg für die ${winners[0].name} ${scoreStr}`;
      } else {
        winningTeamText = `⚖️ Unentschieden ${scoreStr}`;
      }
    }
    const allianceBanner = document.createElement('div');
    allianceBanner.style.textAlign = 'center';
    allianceBanner.style.fontSize = '14px';
    allianceBanner.style.fontWeight = 'bold';
    allianceBanner.style.color = '#f1c40f';
    allianceBanner.style.marginBottom = '10px';
    allianceBanner.style.padding = '8px 12px';
    allianceBanner.style.background = 'rgba(0, 0, 0, 0.4)';
    allianceBanner.style.border = '1px solid var(--gold-antique)';
    allianceBanner.style.borderRadius = '8px';
    allianceBanner.innerText = winningTeamText;
    podiumList.appendChild(allianceBanner);
  }

  // Ermittle für jede Runde in cachedScoreHistory den/die Führenden (Platz 1)
  const roundLeaders = {};
  if (Array.isArray(cachedScoreHistory) && cachedScoreHistory.length > 0) {
    cachedScoreHistory.forEach(record => {
      const rNum = record.round;
      if (Array.isArray(record.entries) && record.entries.length > 0) {
        let maxScore = -Infinity;
        record.entries.forEach(e => {
          if (e.totalScore > maxScore) maxScore = e.totalScore;
        });
        roundLeaders[rNum] = record.entries.filter(e => e.totalScore === maxScore).map(e => e.sessionId);
      }
    });
  }

  sorted.forEach((p, idx) => {
    let correctBids = 0;
    let totalTricksWon = 0;
    let totalDiff = 0;
    let roundsCount = 0;
    let leadRounds = [];

    if (Array.isArray(cachedScoreHistory) && cachedScoreHistory.length > 0) {
      cachedScoreHistory.forEach(record => {
        roundsCount++;
        const entry = record.entries ? record.entries.find(e => e.sessionId === p.sessionId) : null;
        if (entry) {
          const b = entry.bid !== null && entry.bid !== undefined ? entry.bid : 0;
          const w = entry.tricksWon !== undefined ? entry.tricksWon : 0;
          totalTricksWon += w;
          totalDiff += Math.abs(w - b);
          if (w === b) correctBids++;
        }
        if (roundLeaders[record.round] && roundLeaders[record.round].includes(p.sessionId)) {
          leadRounds.push(record.round);
        }
      });
    }
    const accuracyPct = roundsCount > 0 ? Math.round((correctBids / roundsCount) * 100) : 0;

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

    let teamTag = '';
    if (currentMatchFormat === 'team_2v2' && p.team) {
      if (p.team === 'team_a') {
        teamTag = ' <span style="color: #f87171; font-size: 12px;">(🔥 Sonnenfeuer)</span>';
      } else if (p.team === 'team_b') {
        teamTag = ' <span style="color: #60a5fa; font-size: 12px;">(🌙 Mondschatten)</span>';
      } else if (p.team === 'team_c') {
        teamTag = ' <span style="color: #10b981; font-size: 12px;">(🌪️ Sternenwind)</span>';
      }
    }

    const isWinner = (idx === 0);
    const placeBadge = isWinner ? '🥇 1.' : (idx === 1 ? '🥈 2.' : (idx === 2 ? '🥉 3.' : `${idx + 1}.`));
    const isMe = (p.sessionId === mySessionId);

    const card = document.createElement('div');
    card.className = `podium-player-card ${isWinner ? 'winner' : 'regular'}`;
    card.setAttribute('data-session-id', p.sessionId);

    const crownPrefix = isWinner ? '👑 ' : '';
    const leaderBadge = leadRounds.length > 0
      ? `<span class="podium-stat-pill" style="border-color: #fde047; color: #fef08a;" title="In Führung gelegen in Runde ${leadRounds.join(', ')}">👑 ${leadRounds.length}x Spitze</span>`
      : '';

    card.innerHTML = `
      <div class="podium-card-header">
        <div class="podium-player-info" title="Klicken für Magier-Profil">
          <span style="font-weight: 800; color: ${isWinner ? '#f1c40f' : '#d6be90'}; font-size: 15px;">${placeBadge}</span>
          <span class="podium-player-name">${crownPrefix}${escapeHtml(p.name)}</span>
          ${teamTag}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="podium-score-badge">${p.totalScore || 0} Pkt.${rankedDeltaHtml}</span>
        </div>
      </div>
      <div class="podium-stats-row">
        <span class="podium-stat-pill" title="Trefferquote: Wie oft die Prophezeiung exakt stimmte">🎯 ${correctBids}/${roundsCount} (${accuracyPct}%)</span>
        <span class="podium-stat-pill" title="Erzielte Stiche über alle Runden">🏆 ${totalTricksWon} Stiche</span>
        <span class="podium-stat-pill" title="Gesamtabweichung (Fehlstiche) über alle Runden">⚖️ ±${totalDiff} Diff</span>
        ${leaderBadge}
      </div>
    `;

    // Klick auf Name/Info öffnet das Magier-Profil
    const infoEl = card.querySelector('.podium-player-info');
    if (infoEl) {
      infoEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openPlayerDetailModal(p, 'podium');
      });
    }

    podiumList.appendChild(card);
  });

  // Punktekurven-Diagramm (zentraler Button unter Profilen, über Grimoire-Drawer)
  const btnGameOverScoreChart = document.getElementById('btnGameOverScoreChart');
  if (btnGameOverScoreChart && !btnGameOverScoreChart._hasScoreChartListener) {
    btnGameOverScoreChart._hasScoreChartListener = true;
    btnGameOverScoreChart.addEventListener('click', () => {
      if (typeof openScoreChartModal === 'function') {
        openScoreChartModal(mySessionId);
      }
    });
  }

  const btnGameOverScoreboard = document.getElementById('btnGameOverScoreboard');
  if (btnGameOverScoreboard && !btnGameOverScoreboard._hasScoreboardListener) {
    btnGameOverScoreboard._hasScoreboardListener = true;
    btnGameOverScoreboard.addEventListener('click', () => {
      if (typeof openScoreDrawer === 'function') {
        if (scoreDrawer) scoreDrawer.style.zIndex = '2200';
        openScoreDrawer();
      }
    });
  }

  if (resetGameBtn) {
    resetGameBtn.style.display = amIHost ? 'flex' : 'none';
  }
  if (btnGameOverStay) {
    btnGameOverStay.style.display = !amIHost ? 'flex' : 'none';
  }
  if (btnClaimGlory) {
    btnClaimGlory.style.display = 'flex';
  }
  if (btnReopenGameOver) {
    btnReopenGameOver.style.display = 'none';
  }

  // Profil-Statistiken im Hintergrund aktualisieren (neue Siege/Niederlagen/Punkte sofort wirksam)
  if (typeof WizardAuth !== 'undefined' && WizardAuth.refreshUser) {
    WizardAuth.refreshUser();
  }

  gameOverModal.style.display = 'flex';
}

// ==========================================================================
// PUNKTEKURVEN-DIAGRAMM (SVG-CHART) CONTROLLER
// ==========================================================================
function openScoreChartModal(targetSessionId) {
  const modal = document.getElementById('score-chart-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  renderScoreChart(targetSessionId || mySessionId);
}

function closeScoreChartModal() {
  const modal = document.getElementById('score-chart-modal');
  if (modal) modal.style.display = 'none';
  const tooltip = document.getElementById('scoreChartTooltip');
  if (tooltip) tooltip.style.display = 'none';
}

function renderScoreChart(targetSessionId) {
  const titleEl = document.getElementById('scoreChartPlayerName');
  const tabsEl = document.getElementById('scoreChartPlayerTabs');
  const svgContainer = document.getElementById('scoreChartSvgContainer');
  const tooltipEl = document.getElementById('scoreChartTooltip');
  const metricsEl = document.getElementById('scoreChartMetrics');

  if (!svgContainer) return;
  if (tooltipEl) tooltipEl.style.display = 'none';

  const history = Array.isArray(cachedScoreHistory) ? cachedScoreHistory : [];
  const players = Array.isArray(cachedPlayers) ? cachedPlayers : [];

  if (players.length === 0) {
    svgContainer.innerHTML = '<div style="color: #d6be90; padding: 20px;">Keine Spieldaten verfügbar.</div>';
    return;
  }

  // Bestimme aktiven Spieler (Standard: targetSessionId, mySessionId oder 1. Spieler)
  let activePlayer = players.find(p => p.sessionId === targetSessionId);
  const isAllComparison = (targetSessionId === 'all');
  if (!activePlayer && !isAllComparison) {
    activePlayer = players.find(p => p.sessionId === mySessionId) || players[0];
  }

  // Spieler-Tabs generieren
  if (tabsEl) {
    tabsEl.innerHTML = '';

    // "Alle vergleichen" Button
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `chart-tab-btn ${isAllComparison ? 'active' : ''}`;
    allBtn.innerHTML = '🌟 Alle vergleichen';
    allBtn.addEventListener('click', () => renderScoreChart('all'));
    tabsEl.appendChild(allBtn);

    players.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isSelected = (!isAllComparison && activePlayer && p.sessionId === activePlayer.sessionId);
      btn.className = `chart-tab-btn ${isSelected ? 'active' : ''}`;
      const isMe = (p.sessionId === mySessionId);
      btn.innerHTML = `${isMe ? '👑 ' : ''}${escapeHtml(p.name)}`;
      btn.addEventListener('click', () => renderScoreChart(p.sessionId));
      tabsEl.appendChild(btn);
    });
  }

  const numRounds = history.length;
  if (numRounds === 0) {
    svgContainer.innerHTML = '<div style="color: #d6be90; padding: 20px; text-align: center;">Noch keine Runden abgeschlossen.</div>';
    if (metricsEl) metricsEl.innerHTML = '';
    return;
  }

  // Berechne Runden-Stände für alle Spieler
  // round 0: score = 0 für alle
  const seriesByPlayer = {};
  players.forEach(p => {
    seriesByPlayer[p.sessionId] = [{
      round: 0,
      score: 0,
      delta: 0,
      bid: null,
      tricksWon: 0,
      rank: 1,
      isRank1: true
    }];
  });

  // Iteriere Runden
  history.forEach(rec => {
    const rNum = rec.round;
    const roundEntries = rec.entries || [];

    // Finde Max-Score in dieser Runde für Rang 1
    let maxRoundScore = -Infinity;
    roundEntries.forEach(e => {
      if ((e.totalScore || 0) > maxRoundScore) maxRoundScore = (e.totalScore || 0);
    });

    // Sortiere für Rangberechnung
    const sortedRound = [...roundEntries].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

    roundEntries.forEach(e => {
      if (seriesByPlayer[e.sessionId]) {
        const rankIdx = sortedRound.findIndex(sr => sr.sessionId === e.sessionId);
        const rank = rankIdx !== -1 ? rankIdx + 1 : 1;
        seriesByPlayer[e.sessionId].push({
          round: rNum,
          score: e.totalScore || 0,
          delta: e.roundPoints || 0,
          bid: e.bid,
          tricksWon: e.tricksWon || 0,
          rank: rank,
          isRank1: (e.totalScore === maxRoundScore)
        });
      }
    });
  });

  // SVG-Abmessungen & Skalierung
  const svgW = 560;
  const svgH = 240;
  const padLeft = 45;
  const padRight = 24;
  const padTop = 32;
  const padBottom = 28;

  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBottom;

  // Min / Max Score über alle relevanten Kurven
  let minScore = 0;
  let maxScore = 40;

  if (isAllComparison) {
    Object.values(seriesByPlayer).forEach(pts => {
      pts.forEach(pt => {
        if (pt.score < minScore) minScore = pt.score;
        if (pt.score > maxScore) maxScore = pt.score;
      });
    });
  } else if (activePlayer && seriesByPlayer[activePlayer.sessionId]) {
    seriesByPlayer[activePlayer.sessionId].forEach(pt => {
      if (pt.score < minScore) minScore = pt.score;
      if (pt.score > maxScore) maxScore = pt.score;
    });
  }

  // Headroom oben (damit Kronen und Punkte nicht anstoßen)
  maxScore = Math.ceil(maxScore * 1.1 / 10) * 10;
  if (minScore < 0) minScore = Math.floor(minScore / 10) * 10;
  const scoreRange = (maxScore - minScore) || 1;

  function getX(r) {
    return padLeft + (r / numRounds) * plotW;
  }
  function getY(sc) {
    return padTop + plotH - ((sc - minScore) / scoreRange) * plotH;
  }

  // SVG Markup zusammenbauen
  let svgInner = '';

  // Gradient Definitionen
  svgInner += `
    <defs>
      <linearGradient id="chartGoldGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0"/>
      </linearGradient>
      <filter id="crownGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
  `;

  // Grid Lines (Horizontale Linien für Punkte)
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const val = Math.round(minScore + (scoreRange / gridSteps) * i);
    const yPos = getY(val);
    svgInner += `
      <line x1="${padLeft}" y1="${yPos}" x2="${svgW - padRight}" y2="${yPos}" stroke="rgba(214, 190, 144, 0.15)" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${padLeft - 6}" y="${yPos + 3.5}" text-anchor="end" font-size="10" fill="#d6be90" font-family="monospace">${val}</text>
    `;
  }

  // 0-Punkte Referenzlinie (falls minScore < 0)
  if (minScore < 0 && maxScore > 0) {
    const yZero = getY(0);
    svgInner += `
      <line x1="${padLeft}" y1="${yZero}" x2="${svgW - padRight}" y2="${yZero}" stroke="rgba(239, 68, 68, 0.55)" stroke-width="1.5" stroke-dasharray="4,3" />
      <text x="${svgW - padRight + 2}" y="${yZero + 3.5}" text-anchor="start" font-size="9.5" fill="#f87171">0 Pkt.</text>
    `;
  }

  // X-Achsen Beschriftung (Runden)
  for (let r = 0; r <= numRounds; r++) {
    const xPos = getX(r);
    const label = (r === 0) ? 'Start' : `R${r}`;
    svgInner += `
      <text x="${xPos}" y="${svgH - 10}" text-anchor="middle" font-size="10" fill="#d6be90">${label}</text>
    `;
  }

  // Palette für Multivergleich
  const PALETTE = ['#f59e0b', '#38bdf8', '#a855f7', '#4ade80', '#fb7185', '#fbbf24'];

  if (isAllComparison) {
    if (titleEl) titleEl.innerText = 'Punkteverlauf – Alle Magier im Vergleich';

    players.forEach((p, pIdx) => {
      const color = PALETTE[pIdx % PALETTE.length];
      const pts = seriesByPlayer[p.sessionId] || [];
      const coords = pts.map(pt => `${getX(pt.round)},${getY(pt.score)}`);

      svgInner += `
        <polyline points="${coords.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />
      `;

      // Knotenpunkte
      pts.forEach(pt => {
        const cx = getX(pt.round);
        const cy = getY(pt.score);
        svgInner += `
          <circle cx="${cx}" cy="${cy}" r="3.5" fill="${color}" stroke="#1b0f06" stroke-width="1.5" class="chart-node"
            data-player-name="${escapeHtml(p.name)}" data-round="${pt.round}" data-score="${pt.score}" data-delta="${pt.delta}"
            data-rank="${pt.rank}" data-is-rank1="${pt.isRank1}" data-bid="${pt.bid !== null ? pt.bid : '-'}" data-won="${pt.tricksWon}" />
        `;
      });
    });

    if (metricsEl) {
      metricsEl.innerHTML = `
        <div class="chart-metric-card" style="grid-column: 1 / -1;">
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            ${players.map((p, idx) => `
              <span style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #ebd7af;">
                <span style="display: inline-block; width: 12px; height: 12px; background: ${PALETTE[idx % PALETTE.length]}; border-radius: 3px;"></span>
                <b>${escapeHtml(p.name)}</b> (${p.totalScore || 0} Pkt.)
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }

  } else if (activePlayer) {
    if (titleEl) titleEl.innerText = `Punkteverlauf – ${activePlayer.name}`;
    const pts = seriesByPlayer[activePlayer.sessionId] || [];
    const coords = pts.map(pt => `${getX(pt.round)},${getY(pt.score)}`);

    // Fläche unter der Kurve
    const yBottom = getY(minScore);
    const xStart = getX(0);
    const xEnd = getX(numRounds);
    const areaPath = `M ${xStart},${yBottom} L ${coords.join(' L ')} L ${xEnd},${yBottom} Z`;

    svgInner += `
      <path d="${areaPath}" fill="url(#chartGoldGradient)" />
      <polyline points="${coords.join(' ')}" fill="none" stroke="#f59e0b" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
    `;

    // Knotenpunkte und 👑 Kronen-Marker für Platz 1
    const leadRounds = [];
    let bestGain = -Infinity;
    let bestGainRound = 1;
    let worstLoss = Infinity;
    let worstLossRound = 1;
    let peakScore = -Infinity;
    let peakRound = 0;
    let bestRank = Infinity;
    let bestRankRound = 1;
    let totalBidsCorrect = 0;

    pts.forEach(pt => {
      const cx = getX(pt.round);
      const cy = getY(pt.score);

      if (pt.round > 0) {
        if (pt.score > peakScore) { peakScore = pt.score; peakRound = pt.round; }
        if (pt.delta > bestGain) { bestGain = pt.delta; bestGainRound = pt.round; }
        if (pt.delta < worstLoss) { worstLoss = pt.delta; worstLossRound = pt.round; }
        if (pt.rank < bestRank) { bestRank = pt.rank; bestRankRound = pt.round; }
        if (pt.bid !== null && pt.bid === pt.tricksWon) { totalBidsCorrect++; }
        if (pt.isRank1) { leadRounds.push(pt.round); }
      }

      if (pt.isRank1 && pt.round > 0) {
        // 👑 Kronen-Marker auf der Kurve für Runden in Führung!
        svgInner += `
          <circle cx="${cx}" cy="${cy}" r="6.5" fill="#fde047" stroke="#fff" stroke-width="2.5" class="chart-node leader-node" filter="url(#crownGlow)"
            data-player-name="${escapeHtml(activePlayer.name)}" data-round="${pt.round}" data-score="${pt.score}" data-delta="${pt.delta}"
            data-rank="${pt.rank}" data-is-rank1="true" data-bid="${pt.bid !== null ? pt.bid : '-'}" data-won="${pt.tricksWon}" />
          <text x="${cx}" y="${cy - 9}" text-anchor="middle" font-size="13" class="chart-crown" style="user-select: none;">👑</text>
        `;
      } else {
        svgInner += `
          <circle cx="${cx}" cy="${cy}" r="4.5" fill="#fef08a" stroke="#b45309" stroke-width="2" class="chart-node"
            data-player-name="${escapeHtml(activePlayer.name)}" data-round="${pt.round}" data-score="${pt.score}" data-delta="${pt.delta}"
            data-rank="${pt.rank}" data-is-rank1="${pt.isRank1}" data-bid="${pt.bid !== null ? pt.bid : '-'}" data-won="${pt.tricksWon}" />
        `;
      }
    });

    // Metriken unter dem Diagramm anzeigen
    if (metricsEl) {
      const leaderText = leadRounds.length > 0
        ? `👑 ${leadRounds.length} Runden (R${leadRounds.join(', R')})`
        : `Höchste Platzierung: Rang ${bestRank} (R${bestRankRound})`;

      const accPct = numRounds > 0 ? Math.round((totalBidsCorrect / numRounds) * 100) : 0;

      metricsEl.innerHTML = `
        <div class="chart-metric-card">
          <div class="chart-metric-value" style="color: #fde047; font-size: 13px;">${leaderText}</div>
          <div class="chart-metric-label">Spitzenreiter (Platz 1)</div>
        </div>
        <div class="chart-metric-card">
          <div class="chart-metric-value">${peakScore} Pkt. <span style="font-size: 10px; color: #d6be90;">(R${peakRound})</span></div>
          <div class="chart-metric-label">Höchststand (Peak)</div>
        </div>
        <div class="chart-metric-card">
          <div class="chart-metric-value" style="color: #86efac;">${bestGain >= 0 ? '+' + bestGain : bestGain} Pkt. <span style="font-size: 10px; color: #d6be90;">(R${bestGainRound})</span></div>
          <div class="chart-metric-label">Bester Runden-Sprung</div>
        </div>
        <div class="chart-metric-card">
          <div class="chart-metric-value" style="color: ${worstLoss < 0 ? '#f87171' : '#86efac'};">${worstLoss > 0 ? '+' + worstLoss : worstLoss} Pkt. <span style="font-size: 10px; color: #d6be90;">(R${worstLossRound})</span></div>
          <div class="chart-metric-label">Größter Einbruch</div>
        </div>
        <div class="chart-metric-card">
          <div class="chart-metric-value">${totalBidsCorrect}/${numRounds} (${accPct}%)</div>
          <div class="chart-metric-label">Trefferquote</div>
        </div>
      `;
    }
  }

  svgContainer.innerHTML = `
    <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100%" style="display: block; overflow: visible;">
      ${svgInner}
    </svg>
  `;

  // Event Listener für interaktive Tooltips auf Knotenpunkten
  const nodes = svgContainer.querySelectorAll('.chart-node');
  nodes.forEach(node => {
    function showNodeTooltip() {
      if (!tooltipEl) return;
      const r = node.getAttribute('data-round');
      const sc = node.getAttribute('data-score');
      const d = node.getAttribute('data-delta');
      const rk = node.getAttribute('data-rank');
      const isR1 = (node.getAttribute('data-is-rank1') === 'true');
      const b = node.getAttribute('data-bid');
      const w = node.getAttribute('data-won');
      const pName = node.getAttribute('data-player-name') || '';

      const deltaFormatted = (d && parseInt(d, 10) >= 0) ? `+${d}` : d;
      const rankBadge = isR1 ? '<b style="color: #fde047;">👑 Platz 1 (in Führung)</b>' : `Platz ${rk}`;
      const bidInfo = (b && b !== '-') ? ` | Gebot: ${b}, Stiche: ${w}` : '';

      tooltipEl.style.display = 'block';
      tooltipEl.innerHTML = `
        <span style="color: var(--gold-bright); font-weight: bold;">${pName} – Runde ${r}:</span>
        <span style="color: #fff;">${sc} Pkt.</span>
        ${r > 0 ? `<span style="color: #86efac;">(${deltaFormatted} Pkt.)</span>` : ''}
        &nbsp;|&nbsp; ${rankBadge}${bidInfo}
      `;
    }

    node.addEventListener('mouseenter', showNodeTooltip);
    node.addEventListener('click', showNodeTooltip);
  });
}

// Chart Modal Schließen-Buttons
const btnScoreChartClose = document.getElementById('btnScoreChartClose');
if (btnScoreChartClose) {
  btnScoreChartClose.addEventListener('click', closeScoreChartModal);
}
const scoreChartModal = document.getElementById('score-chart-modal');
if (scoreChartModal) {
  scoreChartModal.addEventListener('click', (e) => {
    if (e.target === scoreChartModal) closeScoreChartModal();
  });
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
  const turnSoundToggle = document.getElementById('turnSoundToggle');

  const btnTestCard = document.getElementById('btnTestCardSound');
  const btnTestTurnSound = document.getElementById('btnTestTurnSound');
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
    if (turnSoundToggle) turnSoundToggle.checked = (s.turnSoundEnabled !== false);

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

  if (turnSoundToggle) {
    turnSoundToggle.addEventListener('change', (e) => {
      WizardAudio.setTurnSoundEnabled(e.target.checked);
    });
  }

  if (btnTestCard) {
    btnTestCard.addEventListener('click', () => {
      WizardAudio.playCardSnap();
    });
  }

  if (btnTestTurnSound) {
    btnTestTurnSound.addEventListener('click', () => {
      WizardAudio.playTurnChime();
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
WizardVault.init();
switchScreen('lobby');