const fs = require('fs');
const assert = require('assert');
const path = require('path');
const vm = require('vm');

console.log('--- TESTE CUSTOM DIALOGS & MOBILE HEADER OVERHAUL ---');

const htmlPath = path.join(__dirname, '../public/index.html');
const jsPath = path.join(__dirname, '../public/client.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

// 1. Prüfe HTML Struktur & Tag-Balance
const openDivCount = (html.match(/<div(\s|>)/gi) || []).length;
const closeDivCount = (html.match(/<\/div>/gi) || []).length;
assert.strictEqual(openDivCount, closeDivCount, `HTML div Tags müssen perfekt ausgeglichen sein (Open: ${openDivCount}, Close: ${closeDivCount})`);

// Prüfe, dass Modals NICHT in anderen versteckten Containern geschachtelt sind
const inviteModalIdx = html.indexOf('id="friend-invite-modal"');
const serverModalIdx = html.indexOf('id="server-settings-modal"');
const dialogModalIdx = html.indexOf('id="grimoire-dialog-modal"');
assert.ok(inviteModalIdx > 0 && serverModalIdx > 0 && dialogModalIdx > 0, 'Alle Modals im HTML vorhanden');

// Der Bereich zwischen friend-invite-modal und server-settings-modal muss vollständig geschlossen sein
const betweenInviteAndServer = html.substring(inviteModalIdx, serverModalIdx);
const divsInInvite = (betweenInviteAndServer.match(/<div(\s|>)/gi) || []).length;
const closeDivsInInvite = (betweenInviteAndServer.match(/<\/div>/gi) || []).length;
assert.strictEqual(divsInInvite, closeDivsInInvite, 'friend-invite-modal muss vor server-settings-modal vollständig geschlossen sein');
console.log('✓ 1. HTML Tag-Balance & freistehende Modal-Hierarchie verifiziert');

// 2. Prüfe HTML Struktur der einheitlichen Header-Bar
assert.ok(html.includes('class="lobby-header-bar'), 'lobby-header-bar Klasse im Header vorhanden');
assert.ok(html.includes('id="auth-lobby-bar"'), 'id="auth-lobby-bar" für Rückwärtskompatibilität vorhanden');
assert.ok(html.includes('class="lobby-header-left"'), 'lobby-header-left vorhanden');
assert.ok(html.includes('class="lobby-header-right"'), 'lobby-header-right vorhanden');
assert.ok(html.includes('id="btnOpenLogin"'), 'btnOpenLogin vorhanden');
assert.ok(html.includes('id="btnOpenRegister"'), 'btnOpenRegister vorhanden');
assert.ok(html.includes('id="auth-guest-controls"'), 'auth-guest-controls vorhanden');
assert.ok(html.includes('id="auth-user-controls"'), 'auth-user-controls vorhanden');
assert.ok(html.includes('id="authUserPill"'), 'authUserPill vorhanden');
assert.ok(html.includes('id="btnOpenProfile"'), 'btnOpenProfile vorhanden');
assert.ok(html.includes('id="btnLogout"'), 'btnLogout vorhanden');
assert.ok(html.includes('id="btnOpenCompanionsGuest"'), 'btnOpenCompanionsGuest im Header vorhanden');
assert.ok(html.includes('id="btnOpenCompanionsUser"'), 'btnOpenCompanionsUser im Header vorhanden');
assert.ok(html.includes('id="btnOpenLeaderboardGuest"'), 'btnOpenLeaderboardGuest im Header vorhanden');
assert.ok(html.includes('id="btnOpenLeaderboardUser"'), 'btnOpenLeaderboardUser im Header vorhanden');
assert.ok(html.includes('id="btnOpenServerSettings"'), 'btnOpenServerSettings im Header vorhanden');
assert.ok(html.includes('id="lobby-audio-toggle"'), 'lobby-audio-toggle im Header vorhanden');
console.log('✓ 2. Einheitliche Header-Bar & Steuerungs-Elemente verifiziert');

// 3. Prüfe HTML Struktur des GrimoireDialog Modals
assert.ok(html.includes('id="grimoire-dialog-modal"'), 'grimoire-dialog-modal vorhanden');
assert.ok(html.includes('class="auth-modal-card grimoire-dialog-card"'), 'grimoire-dialog-card Klasse vorhanden');
assert.ok(html.includes('id="dialogIcon"'), 'dialogIcon Element vorhanden');
assert.ok(html.includes('id="dialogTitle"'), 'dialogTitle Element vorhanden');
assert.ok(html.includes('id="dialogMessage"'), 'dialogMessage Element vorhanden');
assert.ok(html.includes('id="dialogConfirmBtn"'), 'dialogConfirmBtn Element vorhanden');
assert.ok(html.includes('id="dialogCancelBtn"'), 'dialogCancelBtn Element vorhanden');
console.log('✓ 3. GrimoireDialog Modal-Markup mit Runen & Knöpfen verifiziert');

// 4. Prüfe CSS Regeln für Responsivität & Dialog
assert.ok(html.includes('.lobby-header-bar'), '.lobby-header-bar CSS-Klasse vorhanden');
assert.ok(html.includes('.grimoire-dialog-card'), '.grimoire-dialog-card CSS vorhanden');
assert.ok(html.includes('dialogPop'), 'dialogPop Keyframe vorhanden');
assert.ok(html.includes('-webkit-overflow-scrolling: touch'), '-webkit-overflow-scrolling: touch für flüssiges iOS/Android-Scrollen vorhanden');
assert.ok(html.includes('overscroll-behavior-y: contain'), 'overscroll-behavior-y: contain vorhanden');
assert.ok(html.includes('max-width: 640px'), 'Media Query für Smartphones (<= 640px) vorhanden');
assert.ok(html.includes('max-width: 380px'), 'Media Query für kompakte Smartphones (<= 380px) vorhanden');
console.log('✓ 4. Responsives CSS, Safe-Area und Touch-Scrolling verifiziert');

// 5. Prüfe, dass keine ungeschützten nativen alert() oder confirm() im Spielcode mehr vorkommen
const cleanedJs = js
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*/g, '');

const nativeAlertMatches = cleanedJs.match(/(?<![.\w])alert\s*\(/g) || [];
const nativeConfirmMatches = cleanedJs.match(/(?<![.\w])confirm\s*\(/g) || [];

assert.strictEqual(nativeAlertMatches.length, 0, `Es dürfen keine nativen alert() Aufrufe existieren (Gefunden: ${nativeAlertMatches.length})`);
assert.strictEqual(nativeConfirmMatches.length, 0, `Es dürfen keine nativen confirm() Aufrufe existieren (Gefunden: ${nativeConfirmMatches.length})`);
console.log('✓ 5. Vollständige Eliminierung aller nativen alert() und confirm() Aufrufe verifiziert');

// 6. Prüfe GrimoireDialog und GrimoireServerSettings Architektur
assert.ok(js.includes('const GrimoireDialog ='), 'GrimoireDialog Modul definiert');
assert.ok(js.includes('const GrimoireServerSettings ='), 'GrimoireServerSettings Modul definiert');
assert.ok(js.includes('GrimoireDialog.init();'), 'GrimoireDialog.init aufgerufen');
assert.ok(js.includes('GrimoireServerSettings.init();'), 'GrimoireServerSettings.init aufgerufen');

// Prüfe Reihenfolge: GrimoireServerSettings muss VOR showConnectionStatus definiert sein
const serverSettingsIndex = js.indexOf('const GrimoireServerSettings =');
const showConnStatusIndex = js.indexOf('function showConnectionStatus(');
assert.ok(serverSettingsIndex < showConnStatusIndex, 'GrimoireServerSettings muss VOR showConnectionStatus definiert sein');

// Prüfe Event Delegation
assert.ok(js.includes('#btnOpenServerSettings') && js.includes('.btn-open-server-settings') && js.includes('#btnBannerOpenServerSettings'), 'Globales Event-Delegation für Server-Settings vorhanden');
assert.ok(js.includes('#btnDismissConnectionBanner'), 'Globales Event-Delegation für Banner-Dismiss vorhanden');
console.log('✓ 6. GrimoireDialog & ausfallsichere GrimoireServerSettings Platzierung verifiziert');

// 7. Prüfe Ausfallsicherheit beim Offline-/Startup-Zustand (io undefined)
{
  const idRegex = /id=["']([^"']+)["']/g;
  const htmlIds = new Set();
  let matchId;
  while ((matchId = idRegex.exec(html)) !== null) {
    htmlIds.add(matchId[1]);
  }

  function createMockElement(tag = 'div', id = '') {
    const el = {
      tagName: tag.toUpperCase(),
      id: id,
      style: {},
      classList: {
        _classes: new Set(),
        add: (c) => el.classList._classes.add(c),
        remove: (c) => el.classList._classes.delete(c),
        toggle: (c, force) => {
          if (force === undefined) {
            if (el.classList._classes.has(c)) el.classList._classes.delete(c);
            else el.classList._classes.add(c);
          } else if (force) {
            el.classList._classes.add(c);
          } else {
            el.classList._classes.delete(c);
          }
        },
        contains: (c) => el.classList._classes.has(c)
      },
      innerHTML: '',
      innerText: '',
      value: '',
      disabled: false,
      _listeners: {},
      addEventListener: (evt, fn) => {
        if (!el._listeners[evt]) el._listeners[evt] = [];
        el._listeners[evt].push(fn);
      },
      removeEventListener: () => {},
      focus: () => {},
      click: () => {
        if (el._listeners['click']) {
          el._listeners['click'].forEach(fn => fn({ preventDefault: () => {}, stopPropagation: () => {} }));
        }
      },
      getAttribute: () => '',
      setAttribute: () => {},
      appendChild: () => {},
      querySelectorAll: () => []
    };
    return el;
  }

  const mockEls = {};
  for (const id of htmlIds) {
    mockEls[id] = createMockElement('div', id);
  }

  const offlineSandbox = {
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      location: { reload: () => {}, port: '3000' }
    },
    document: {
      getElementById: (id) => mockEls[id] || createMockElement('div', id),
      querySelector: () => createMockElement(),
      querySelectorAll: () => [],
      createElement: (tag) => createMockElement(tag),
      addEventListener: () => {},
      body: createMockElement('body')
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    // io ist absichtlich undefined!
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };

  vm.createContext(offlineSandbox);
  let offlineInitSuccess = false;
  try {
    vm.runInContext(js, offlineSandbox);
    offlineInitSuccess = true;
  } catch (err) {
    assert.fail(`client.js darf bei nicht erreichbarem io nicht mit ReferenceError abstürzen: ${err.stack}`);
  }
  assert.strictEqual(offlineInitSuccess, true, 'client.js initialisiert auch ohne io fehlerfrei');
  console.log('✓ 7. Ausfallsichere Initialisierung bei offline/fehlendem io ohne TDZ-ReferenceError verifiziert');
}

// 8. Funktionale Simulation von GrimoireDialog im DOM-Mock
(async () => {
  const idRegex = /id=["']([^"']+)["']/g;
  const htmlIds = new Set();
  let matchId;
  while ((matchId = idRegex.exec(html)) !== null) {
    htmlIds.add(matchId[1]);
  }

  const mockElements = {};
  function createMockEl(tag = 'div', id = '') {
    const el = {
      tagName: tag.toUpperCase(),
      id: id,
      style: {},
      classList: {
        _classes: new Set(),
        add: (c) => el.classList._classes.add(c),
        remove: (c) => el.classList._classes.delete(c),
        toggle: (c, force) => {
          if (force === undefined) {
            if (el.classList._classes.has(c)) el.classList._classes.delete(c);
            else el.classList._classes.add(c);
          } else if (force) {
            el.classList._classes.add(c);
          } else {
            el.classList._classes.delete(c);
          }
        },
        contains: (c) => el.classList._classes.has(c)
      },
      innerHTML: '',
      innerText: '',
      value: '',
      disabled: false,
      _listeners: {},
      addEventListener: (evt, fn) => {
        if (!el._listeners[evt]) el._listeners[evt] = [];
        el._listeners[evt].push(fn);
      },
      removeEventListener: () => {},
      focus: () => {},
      click: () => {
        if (el._listeners['click']) {
          el._listeners['click'].forEach(fn => fn({ preventDefault: () => {}, stopPropagation: () => {} }));
        }
      },
      getAttribute: () => '',
      setAttribute: () => {},
      appendChild: () => {},
      querySelectorAll: () => []
    };
    return el;
  }

  for (const id of htmlIds) {
    mockElements[id] = createMockEl('div', id);
  }

  const sandbox = {
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      location: { reload: () => {} }
    },
    document: {
      getElementById: (id) => mockElements[id] || createMockEl('div', id),
      querySelector: () => createMockEl(),
      querySelectorAll: () => [],
      createElement: (tag) => createMockEl(tag),
      addEventListener: (evt, fn) => {
        if (!sandbox.document._docListeners) sandbox.document._docListeners = {};
        if (!sandbox.document._docListeners[evt]) sandbox.document._docListeners[evt] = [];
        sandbox.document._docListeners[evt].push(fn);
      },
      body: createMockEl('body')
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    io: () => ({ on: () => {}, emit: () => {} }),
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ success: true }) }),
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };

  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);

  const GrimoireDialogMock = sandbox.window.GrimoireDialog;
  assert.ok(GrimoireDialogMock, 'GrimoireDialog auf window verfügbar');

  // Test 8a: Alert
  let alertResolved = false;
  GrimoireDialogMock.alert({
    title: 'Test-Titel',
    message: 'Test-Nachricht',
    icon: '⚡'
  }).then(() => {
    alertResolved = true;
  });

  assert.strictEqual(mockElements['dialogTitle'].innerText, 'Test-Titel', 'Titel korrekt gesetzt');
  assert.strictEqual(mockElements['dialogMessage'].innerText, 'Test-Nachricht', 'Nachricht korrekt gesetzt');
  assert.strictEqual(mockElements['dialogIcon'].innerText, '⚡', 'Icon korrekt gesetzt');
  assert.strictEqual(mockElements['dialogCancelBtn'].style.display, 'none', 'Cancel-Btn bei Alert ausgeblendet');
  assert.strictEqual(mockElements['grimoire-dialog-modal'].style.display, 'flex', 'Modal sichtbar');

  // Klick auf Bestätigen
  mockElements['dialogConfirmBtn'].click();
  await Promise.resolve();
  assert.strictEqual(alertResolved, true, 'Alert Promise aufgelöst');
  assert.strictEqual(mockElements['grimoire-dialog-modal'].style.display, 'none', 'Modal geschlossen');

  // Test 8b: Confirm (Bestätigen)
  let confirmResult = null;
  GrimoireDialogMock.confirm({
    title: 'Frage',
    message: 'Bist du sicher?',
    confirmText: 'Ja!',
    cancelText: 'Nein!',
    danger: true
  }).then((res) => {
    confirmResult = res;
  });

  assert.strictEqual(mockElements['dialogConfirmBtn'].innerText, 'Ja!', 'Confirm-Text gesetzt');
  assert.strictEqual(mockElements['dialogCancelBtn'].innerText, 'Nein!', 'Cancel-Text gesetzt');
  assert.strictEqual(mockElements['dialogCancelBtn'].style.display, 'inline-flex', 'Cancel-Btn bei Confirm sichtbar');
  assert.ok(mockElements['dialogConfirmBtn'].className.includes('btn-auth-danger'), 'Danger-Klasse gesetzt');

  mockElements['dialogConfirmBtn'].click();
  await Promise.resolve();
  assert.strictEqual(confirmResult, true, 'Confirm mit true aufgelöst');

  // Test 8c: Confirm (Abbrechen)
  let cancelResult = null;
  GrimoireDialogMock.confirm({
    title: 'Zweite Frage',
    message: 'Wirklich abbrechen?'
  }).then((res) => {
    cancelResult = res;
  });

  mockElements['dialogCancelBtn'].click();
  await Promise.resolve();
  assert.strictEqual(cancelResult, false, 'Confirm mit false aufgelöst');

  // Test 8d: RequireAuth ruft Auth-Modal auf
  let authOpened = false;
  sandbox.WizardAuth = sandbox.window.WizardAuth = {
    openAuthModal: (tab) => {
      if (tab === 'login') authOpened = true;
    }
  };

  GrimoireDialogMock.requireAuth('ranked');
  assert.strictEqual(mockElements['dialogIcon'].innerText, '⚔️', 'Ranked Icon ⚔️ gesetzt');
  mockElements['dialogConfirmBtn'].click();
  await new Promise(r => setTimeout(r, 20));

  assert.strictEqual(authOpened, true, 'WizardAuth.openAuthModal wurde aufgerufen');

  // Test 8e: Konkurrierende Dialoge hängen keine Promises ab
  let firstResolved = false;
  let secondResolved = false;
  GrimoireDialogMock.alert('Erster Dialog').then(() => { firstResolved = true; });
  GrimoireDialogMock.alert('Zweiter Dialog').then(() => { secondResolved = true; });
  await Promise.resolve();
  assert.strictEqual(firstResolved, true, 'Vorherige Promise wurde sauber aufgelöst');
  mockElements['dialogConfirmBtn'].click();
  await Promise.resolve();
  assert.strictEqual(secondResolved, true, 'Zweite Promise wurde bestätigt und aufgelöst');

  console.log('✓ 8. GrimoireDialog Alert, Confirm, RequireAuth & Concurrency Logik vollständig verifiziert');

  console.log('\n======================================================');
  console.log('🏆 ALLE CUSTOM DIALOG & MOBILE HEADER TESTS BESTANDEN!');
  console.log('======================================================\n');
})();
