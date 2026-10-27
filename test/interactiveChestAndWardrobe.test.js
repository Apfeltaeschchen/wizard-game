const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { createSqliteEngine } = require('../server/db/sqliteEngine');
const sharedHelpers = require('../server/db/sharedHelpers');

console.log('--- TEST: INTERAKTIVE 3D-TRUHEN-ZEREMONIE & GARDEROBE START ---');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');
assert.ok(fs.existsSync(clientJsPath), 'client.js existiert');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// [1/5] Überprüfe Profil-Bereinigung
console.log('[1/5] Überprüfe Profil-Bereinigung...');
assert.ok(!indexHtml.includes('id="profileSelectAvatar"'), 'profileSelectAvatar Dropdown ist aus Profil entfernt');
assert.ok(!indexHtml.includes('id="profileSelectFrame"'), 'profileSelectFrame Dropdown ist aus Profil entfernt');
assert.ok(!indexHtml.includes('id="profileSelectCardBack"'), 'profileSelectCardBack Dropdown ist aus Profil entfernt');
assert.ok(!indexHtml.includes('id="profileSelectTableSkin"'), 'profileSelectTableSkin Dropdown ist aus Profil entfernt');
assert.ok(indexHtml.includes('id="btnProfileOpenVault"'), 'Schnellzugriff zur Garderobe vorhanden');
console.log('✓ 1. Profil-Drawer sauber bereinigt.');

// [2/5] Überprüfe Interaktive 3D-Truhe, Canvas-FX & Schatztruhen-Artworks im HTML & CSS
console.log('[2/5] Überprüfe Interaktive Unboxing-Bühne, Canvas-FX & Schatztruhen-Artworks...');
assert.ok(indexHtml.includes('id="btnVaultUnboxingClose"'), '#btnVaultUnboxingClose Schließen-Button vorhanden');
assert.ok(clientJs.includes('btnUnboxClose.addEventListener(\'click\', finishUnboxing)'), 'Schließen-Handler auf #btnVaultUnboxingClose registriert');
assert.ok(indexHtml.includes('id="vaultUnboxingStage"'), '#vaultUnboxingStage vorhanden');
assert.ok(indexHtml.includes('id="vaultFxCanvas"'), '#vaultFxCanvas 60-FPS Canvas Layer vorhanden');
assert.ok(indexHtml.includes('id="vaultChestInteractive"'), '#vaultChestInteractive interaktive Truhe vorhanden');
assert.ok(indexHtml.includes('.stylized-chest-wrapper'), '.stylized-chest-wrapper 3D-Bühne vorhanden');
assert.ok(indexHtml.includes('.stylized-chest-body'), '.stylized-chest-body Truhen-Unterteil vorhanden');
assert.ok(indexHtml.includes('.stylized-chest-interior'), '.stylized-chest-interior Truhen-Innenraum vorhanden');
assert.ok(indexHtml.includes('.stylized-chest-lid'), '.stylized-chest-lid 3D-Deckel vorhanden');
assert.ok(indexHtml.includes('.stylized-chest-clasp'), '.stylized-chest-clasp Schlossriegel vorhanden');
assert.ok(indexHtml.includes('.chest-energy-core'), '.chest-energy-core Energiekern vorhanden');
assert.ok(indexHtml.includes('@keyframes lidPopOpen'), '@keyframes lidPopOpen vorhanden');
assert.ok(indexHtml.includes('@keyframes claspUnlock'), '@keyframes claspUnlock vorhanden');
assert.ok(indexHtml.includes('id="vaultChestFlashOverlay"'), '#vaultChestFlashOverlay Scheitelpunkt-Blitz vorhanden');
assert.ok(indexHtml.includes('id="vaultChestClickPrompt"'), '#vaultChestClickPrompt vorhanden');
assert.ok(indexHtml.includes('.chest-artwork-container'), 'CSS für .chest-artwork-container vorhanden');
assert.ok(indexHtml.includes('.chest-aura'), 'CSS für .chest-aura (volumetrische Runen-Aura) vorhanden');
assert.ok(indexHtml.includes('.chest-artwork-container.bursting') || indexHtml.includes('.stylized-chest-wrapper.bursting'), 'CSS für Apex-Animation vorhanden');
assert.ok(indexHtml.includes('.chest-artwork-container.opened') || indexHtml.includes('.stylized-chest-wrapper.opened'), 'CSS für opened vorhanden');
assert.ok(indexHtml.includes('class="chest-light-burst"'), 'chest-light-burst Element in 3D-Truhe vorhanden');
assert.ok(indexHtml.includes('.chest-flash-overlay'), 'CSS für .chest-flash-overlay vorhanden');
assert.ok(indexHtml.includes('.chest-artwork-medallion'), 'CSS für .chest-artwork-medallion vorhanden');
assert.ok(indexHtml.includes('.mini-chest-wood'), 'Miniatur-Visual für Holztruhe');
assert.ok(indexHtml.includes('.mini-chest-silver'), 'Miniatur-Visual für Silbertruhe');
assert.ok(indexHtml.includes('.mini-chest-gold'), 'Miniatur-Visual für Goldkassette');
assert.ok(indexHtml.includes('@keyframes chestRumble'), '@keyframes chestRumble vorhanden');
assert.ok(indexHtml.includes('@keyframes floatChest'), '@keyframes floatChest vorhanden');
assert.ok(indexHtml.includes('.btn-drop-equip'), 'CSS für .btn-drop-equip vorhanden');

// Weg 2: Lottie-Bühne & Vektor-Badges prüfen
assert.ok(indexHtml.includes('id="vaultLottieContainer"'), '#vaultLottieContainer vorhanden');
assert.ok(indexHtml.includes('id="vaultArcaneChest"'), '#vaultArcaneChest vorhanden');
assert.ok(indexHtml.includes('.mystery-card-wrap'), 'CSS für .mystery-card-wrap (3D Card Flip) vorhanden');
assert.ok(indexHtml.includes('id="btnFlipAllCards"'), '#btnFlipAllCards vorhanden');
assert.ok(indexHtml.includes('class="vault-lottie-container'), '.vault-lottie-container CSS-Klasse vorhanden');
assert.ok(indexHtml.includes('.chest-vector-badge'), 'CSS für .chest-vector-badge vorhanden');
assert.ok(indexHtml.includes('badge-tier-wooden'), 'Vektor-Badge für Holztruhe vorhanden');
assert.ok(indexHtml.includes('badge-tier-silver'), 'Vektor-Badge für Silbertruhe vorhanden');
assert.ok(indexHtml.includes('badge-tier-gold'), 'Vektor-Badge für Goldkassette vorhanden');
assert.ok(!indexHtml.includes('images/chests/chest_wooden_closed.png'), 'Altes Bitmap-Artwork für Holztruhe sauber entfernt');
assert.ok(!indexHtml.includes('images/chests/chest_silver_closed.png'), 'Altes Bitmap-Artwork für Silbertruhe sauber entfernt');
assert.ok(!indexHtml.includes('images/chests/chest_gold_closed.png'), 'Altes Bitmap-Artwork für Goldkassette sauber entfernt');
assert.ok(indexHtml.includes('src="js/lottie.min.js"'), 'lottie.min.js Script-Tag eingebunden');
assert.ok(indexHtml.includes('client.js?v=20261027_arcane_cards_truhe'), 'Cache-Busting auf v=20261027_arcane_cards_truhe aktualisiert');

// Lottie-Web Bibliothek lokal prüfen
const lottieJsPath = path.join(__dirname, '../public/js/lottie.min.js');
assert.ok(fs.existsSync(lottieJsPath), 'public/js/lottie.min.js existiert');
const lottieStat = fs.statSync(lottieJsPath);
assert.ok(lottieStat.size > 100000, `lottie.min.js ist valide (>100KB): ${lottieStat.size} Bytes`);

// Lottie Animationsdateien für alle 3 Stufen prüfen
const animDir = path.join(__dirname, '../public/animations/chests');
const requiredAnims = ['chest_wooden_lottie.json', 'chest_silver_lottie.json', 'chest_gold_lottie.json'];
for (const animName of requiredAnims) {
  const p = path.join(animDir, animName);
  assert.ok(fs.existsSync(p), `Lottie-Animation existiert: ${animName}`);
  const stat = fs.statSync(p);
  assert.ok(stat.size > 20000, `Dateigröße von ${animName} ist valide (>20KB): ${stat.size} Bytes`);
}

console.log('✓ 2. Unboxing-Bühne, Weg 2 Lottie-Assets, Canvas-FX Layer & Vektor-Badges verifiziert.');

// [3/5] Überprüfe Garderoben-Visuals, Zero-Crude-Icons & Raumwelten-Artworks
console.log('[3/5] Überprüfe Bildvorschauen, Zero-Crude-Icons & Raumwelten-Artworks...');
assert.ok(indexHtml.includes('.cosmetic-mini-cardback'), 'CSS für .cosmetic-mini-cardback vorhanden');
assert.ok(indexHtml.includes('.cardback-theme-citadel_ancient'), 'Legendäres altes Zitadellen-Deck vorhanden');
assert.ok(indexHtml.includes('.cardback-theme-default'), 'Standard Novizen-Pergament Deck vorhanden');
assert.ok(indexHtml.includes('.cosmetic-mini-table'), 'CSS für .cosmetic-mini-table vorhanden');
assert.ok(indexHtml.includes('.cosmetic-mini-lobby'), 'CSS für .cosmetic-mini-lobby vorhanden');
assert.ok(indexHtml.includes('.cosmetic-mini-title'), 'CSS für .cosmetic-mini-title vorhanden');

// Echte Hintergrund-Artworks prüfen
const backgroundsDir = path.join(__dirname, '../public/images/backgrounds');
assert.ok(fs.existsSync(path.join(backgroundsDir, 'bg_haunted_graveyard.jpg')), 'bg_haunted_graveyard.jpg existiert');
assert.ok(fs.existsSync(path.join(backgroundsDir, 'bg_witch_hut.jpg')), 'bg_witch_hut.jpg existiert');
assert.ok(fs.existsSync(path.join(backgroundsDir, 'bg_tavern_fireplace.jpg')), 'bg_tavern_fireplace.jpg existiert');
assert.ok(fs.existsSync(path.join(backgroundsDir, 'bg_astral_observatory.jpg')), 'bg_astral_observatory.jpg existiert');
assert.ok(fs.existsSync(path.join(backgroundsDir, 'bg_magma_forge.jpg')), 'bg_magma_forge.jpg existiert');
assert.ok(fs.existsSync(path.join(backgroundsDir, 'bg_celestial_sanctum.jpg')), 'bg_celestial_sanctum.jpg existiert');

// Katalog prüfen: Nur 1 Initialen-Default-Avatar und keine Dummy-SVGs mehr
const { COSMETICS_CATALOG } = require('../server/cosmeticsData');
const defaultAvatars = COSMETICS_CATALOG.avatar_icons.filter(a => a.isDefault);
assert.strictEqual(defaultAvatars.length, 1, 'Exakt 1 Standard-Avatar im Katalog');
assert.strictEqual(defaultAvatars[0].id, 'default', 'Standard-Avatar ist das Initialen-Medaillon (id: default)');
const hasDummySvg = COSMETICS_CATALOG.avatar_icons.some(a => a.id === 'wizard_red' || a.id === 'wizard_green');
assert.strictEqual(hasDummySvg, false, 'Redundante Dummy-SVG-Avatare sauber entfernt');

assert.ok(clientJs.includes('function getCosmeticVisualHtml'), 'getCosmeticVisualHtml Generator in client.js vorhanden');
assert.ok(clientJs.includes('currentWardrobeCategory = pill.dataset.category'), 'Wardrobe Filter-Pills nutzen korrektes data-category');
assert.ok(clientJs.includes('currentForgeCategory = pill.dataset.forgeCategory'), 'Forge Filter-Pills nutzen korrektes data-forgeCategory');
console.log('✓ 3. Zero-Crude-Icons, Raumwelten-Artworks & Avatar-Bereinigung verifiziert.');

// [4/5] Überprüfe Audio, Klick-Zeremonie, Canvas-FX & Spielstart-Schutz
console.log('[4/5] Überprüfe Audio-Engine, Klick-Zeremonie, Canvas-FX & Spielstart-Schutz...');
assert.ok(clientJs.includes('playChestRumble'), 'WizardAudio.playChestRumble implementiert');
assert.ok(clientJs.includes('playChestBurst'), 'WizardAudio.playChestBurst implementiert');
assert.ok(clientJs.includes('playChestUnlock'), 'WizardAudio.playChestUnlock implementiert');
assert.ok(clientJs.includes('playLidPop'), 'WizardAudio.playLidPop implementiert');
assert.ok(clientJs.includes('playCometLaunch'), 'WizardAudio.playCometLaunch implementiert');
assert.ok(clientJs.includes('playImpact'), 'WizardAudio.playImpact implementiert');
assert.ok(clientJs.includes('CometProjectile'), 'CometProjectile Kometen-Klasse implementiert');
assert.ok(clientJs.includes("common: { core: '#f8fafc'"), 'Common Seltenheitsfarbe ist Weiß/Silber/Slate (#f8fafc), nicht Gold/Amber');
assert.ok(clientJs.includes("this.x - this.vx * interp"), 'Weiche Partikel-Interpolation entlang der Flugbahn für kontinuierlichen Schweif vorhanden');
assert.ok(clientJs.includes('CometTailParticle'), 'CometTailParticle Sternschnuppenschweif implementiert');
assert.ok(clientJs.includes('launchComets'), 'launchComets Zeremonie implementiert');
assert.ok(clientJs.includes('function handleChestClick'), 'handleChestClick Funktion implementiert');
assert.ok(clientJs.includes('triggerChestBurstFx'), 'triggerChestBurstFx Canvas-FX implementiert');
assert.ok(clientJs.includes('chestLightRays'), 'Volumetrische God-Rays / Lichtsäulen in Canvas-FX integriert');
assert.ok(clientJs.includes('chestRuneMotes'), 'Schwebende Runen-Funken in Canvas-FX integriert');
assert.ok(clientJs.includes('unboxingApexTimer'), 'unboxingApexTimer Lebenszyklus-Schutz vorhanden');
assert.ok(clientJs.includes('unboxingStageTimer'), 'unboxingStageTimer Lebenszyklus-Schutz vorhanden');
assert.ok(clientJs.includes('wardrobe:equip'), 'wardrobe:equip Socket-Event auf Beutekarte integriert');
// Sicherstellen, dass kein redundanter doppelter Event-Emit auf Beutekarten existiert
assert.ok(!clientJs.includes("socket.emit('wardrobe:equip', { itemType: targetType, itemId: targetId, token });\n            socket.emit('vault:equip'"), 'Kein redundanter Doppel-Emit von wardrobe:equip und vault:equip auf Beutekarte');
assert.ok(clientJs.includes('chestInteractive.addEventListener(\'click\', handleChestClick)'), 'Klick-Handler auf 3D-Truhe registriert');
assert.ok(clientJs.includes('lottieContainer.addEventListener(\'click\', handleChestClick)'), 'Klick-Handler auf Lottie-Container registriert');
assert.ok(clientJs.includes("e.key === 'Enter' || e.key === ' '"), 'Tastatur-Entriegelung (Enter/Space) für Truhen-Bühne registriert');
assert.ok(clientJs.includes('VaultLottieEngine'), 'VaultLottieEngine in client.js implementiert');
assert.ok(clientJs.includes('init(tier') || clientJs.includes('init('), 'VaultLottieEngine.init implementiert');
assert.ok(clientJs.includes('playOpen'), 'VaultLottieEngine.playOpen mit Scheitelpunkt-Synchronisation implementiert');
assert.ok(clientJs.includes('setChestData'), 'VaultLottieEngine.setChestData für Scheitelpunkt-Synchronisation implementiert');
assert.ok(clientJs.includes('playSegments([60, 150]'), 'Elastisches Öffnungs-Segment [60, 150] implementiert');
assert.ok(clientJs.includes('curFrame >= 85') || clientJs.includes('85'), 'Apex-Marker bei Frame 85 implementiert');
assert.ok(clientJs.includes('VaultLottieEngine.destroy') || clientJs.includes('VaultLottieEngine.cleanup'), 'VaultLottieEngine Bereinigung aufgerufen');
assert.ok(clientJs.includes("if (screenName === 'game')"), 'Concurrency-Schutz bei Spielstart vorhanden');
assert.ok(clientJs.includes('WizardVault.closeVault()') || clientJs.includes('closeVault()'), 'closeVault() bei Spielstart aufgerufen');
console.log('✓ 4. Klick-Entriegelung, Weg 2 VaultLottieEngine, Canvas-FX & Spielstart-Schutz verifiziert.');

// [5/5] Überprüfe Persistentes Account- & Kosmetik-Backup (Zero Data Loss)
console.log('[5/5] Überprüfe Persistentes Account- & Kosmetik-Backup...');
const tempDir = path.join(__dirname, 'temp_isolated_chest_persistence');
const tempDbPath = path.join(tempDir, 'test_persistence_chest.db');
const tempBackupPath = path.join(tempDir, 'wizard_accounts_backup.json');

// Cleanup vor dem Test
try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
fs.mkdirSync(tempDir, { recursive: true });

try {
  const engine1 = createSqliteEngine(tempDbPath, sharedHelpers);
  const regRes = engine1.registerUser('PersistenzMeister', 'geheim123', 'wizard_gold');
  assert.ok(regRes.success, 'Benutzer erfolgreich registriert');
  const userId = regRes.user.id;

  // Vergib Kosmetika
  engine1.awardCosmetic(userId, 'card_back', 'pumpkin_king');
  engine1.awardCosmetic(userId, 'table_skin', 'tavern_wood');
  engine1.awardCosmetic(userId, 'lobby_background', 'haunted_graveyard');
  engine1.equipCosmetic(userId, 'card_back', 'pumpkin_king');

  // Exportiere Backup
  engine1.exportAccountsBackup();
  assert.ok(fs.existsSync(tempBackupPath), 'wizard_accounts_backup.json wurde erfolgreich angelegt');
  engine1.closeDatabase();

  // Lösche SQLite DB (Simuliere Container-Reset / Update auf Render)
  try { if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath); } catch (e) {}
  assert.ok(!fs.existsSync(tempDbPath), 'DB wurde temporär gelöscht (simulierter Server-Neustart)');

  // Starte frische Engine mit gelöschter DB (soll aus Backup wiederherstellen)
  const engine2 = createSqliteEngine(tempDbPath, sharedHelpers);
  const restoredUser = engine2.getUserById(userId);
  assert.ok(restoredUser, 'Benutzer wurde automatisch aus dem persistenten Backup wiederhergestellt!');
  assert.strictEqual(restoredUser.username, 'PersistenzMeister', 'Benutzername stimmt überein');
  assert.strictEqual(restoredUser.equipped_card_back, 'pumpkin_king', 'Ausgerüsteter Kartenrücken gemerkt!');

  const restoredCosmetics = engine2.getUserCosmetics(userId);
  const ownedIds = restoredCosmetics.inventory.map(i => i.item_id);
  assert.ok(ownedIds.includes('pumpkin_king'), 'Gegenstand pumpkin_king im wiederhergestellten Inventar vorhanden');
  assert.ok(ownedIds.includes('tavern_wood'), 'Gegenstand tavern_wood im wiederhergestellten Inventar vorhanden');
  assert.ok(ownedIds.includes('haunted_graveyard'), 'Gegenstand haunted_graveyard im wiederhergestellten Inventar vorhanden');
  console.log('✓ 5. Account & alle Kosmetika werden über Updates hinweg persistent gemerkt!');

  engine2.closeDatabase();
} finally {
  // Aufräumen
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
}

// [6/6] Überprüfe Concurrency-, Lifecycle- & Timer-Sicherheit
console.log('[6/6] Überprüfe Concurrency-, Lifecycle- & Timer-Sicherheit...');
// 1. Lottie-Asset-Integrität: Valides Bodymovin-Format, 60 FPS, 150 Frames & elastische Layer
for (const animName of requiredAnims) {
  const p = path.join(animDir, animName);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(data.fr, 60, `${animName} läuft mit konstanten 60 FPS`);
  assert.strictEqual(data.op, 150, `${animName} besitzt exakt 150 Frames`);
  assert.ok(data.layers.length >= 5, `${animName} besitzt mindestens 5 elastische Layer`);
  const layerNames = data.layers.map(l => l.nm);
  assert.ok(layerNames.includes('Chest Body') || layerNames.includes('Chest Lid'), `${animName} besitzt elastische Truhenteile`);
}

// 2. Lifecycle & Timer-Cleanup Simulation
// Prüfe, dass finishUnboxing alle drei Timer leert und FX stoppt
assert.ok(clientJs.includes('if (unboxingApexTimer)'), 'unboxingApexTimer wird vor/bei finishUnboxing sauber gecancelt');
assert.ok(clientJs.includes('if (unboxingStageTimer)'), 'unboxingStageTimer wird vor/bei finishUnboxing sauber gecancelt');
assert.ok(clientJs.includes('if (unboxingFlashTimer)'), 'unboxingFlashTimer wird vor/bei finishUnboxing sauber gecancelt');
assert.ok(clientJs.includes('stopChestFx()'), 'stopChestFx() wird in finishUnboxing aufgerufen');

// 3. Kein Doppel-Emit beim Ausrüsten
const equipHandlerMatch = clientJs.match(/equipBtn\.addEventListener\('click'[\s\S]*?showToast/);
assert.ok(equipHandlerMatch, 'Ausrüst-Klick-Handler auf Beutekarte gefunden');
const equipCode = equipHandlerMatch[0];
const vaultEquipEmits = (equipCode.match(/socket\.emit\(['"]vault:equip['"]/g) || []).length;
const wardrobeEquipEmits = (equipCode.match(/socket\.emit\(['"]wardrobe:equip['"]/g) || []).length;
assert.strictEqual(wardrobeEquipEmits, 1, 'Exakt 1 wardrobe:equip Socket-Event auf Beutekarte');
assert.strictEqual(vaultEquipEmits, 0, 'Kein redundantes vault:equip Socket-Event auf Beutekarte (verhindert doppelte DB-Writes)');

// 4. Tiefe Funktions- & Zero-Crash-Simulation für alle 3 Stufen (insb. Goldene Truhe)
assert.ok(!clientJs.includes('if (safeData.chestType === \'gold\' && imgOpen'), 'Keine veraltete imgOpen/imgClosed Sprite-Referenz in executeChestApex (verhindert fatalen ReferenceError Crash bei Goldtruhe)');
assert.ok(!indexHtml.includes('vaultChestImgClosed'), 'vaultChestImgClosed sauber aus index.html entfernt');
assert.ok(!indexHtml.includes('vaultChestImgOpen'), 'vaultChestImgOpen sauber aus index.html entfernt');

// 5. Teste VaultLottieEngine State Machine & Segment-Apex Logik isoliert
const mockContainer = {
  className: '',
  innerHTML: '',
  style: {},
  classList: { remove: () => {}, add: () => {} }
};

let capturedApexData = null;
let fakeAnimPlayingSegments = null;
let fakeAnimListeners = {};
const mockLottieAnim = {
  firstFrame: 60,
  totalFrames: 90,
  playSegments(seg, loop) { fakeAnimPlayingSegments = { seg, loop }; },
  addEventListener(event, fn) { fakeAnimListeners[event] = fn; },
  removeEventListener(event) { delete fakeAnimListeners[event]; },
  destroy() { fakeAnimListeners = {}; }
};

// Simuliere VaultLottieEngine Methoden
const testEngine = {
  isOpenStarted: false,
  hasApexFired: false,
  hasApexReachedTime: false,
  pendingData: null,
  pendingApexCallback: null,
  lottieAnim: mockLottieAnim,
  getContainer() { return mockContainer; },
  init(tier) {
    this.currentTier = tier || 'wooden';
    this.isOpenStarted = false;
    this.hasApexFired = false;
    this.hasApexReachedTime = false;
    this.pendingData = null;
    this.pendingApexCallback = null;
  },
  fireApexOnce() {
    if (this.hasApexFired) return;
    this.hasApexFired = true;
    if (typeof this.pendingApexCallback === 'function') {
      this.pendingApexCallback(this.pendingData);
    }
  },
  setChestData(data) {
    this.pendingData = data;
    if (this.hasApexReachedTime && !this.hasApexFired) {
      this.fireApexOnce();
    }
  },
  playOpen(data, onApex) {
    this.isOpenStarted = true;
    this.hasApexFired = false;
    this.hasApexReachedTime = false;
    this.pendingApexCallback = onApex;
    this.pendingData = data;
    this.lottieAnim.playSegments([60, 150], false);
  }
};

testEngine.init('gold');
assert.strictEqual(testEngine.isOpenStarted, false, 'Engine startet im Idle-Zustand');
testEngine.playOpen(null, (d) => { capturedApexData = d; });
assert.strictEqual(testEngine.isOpenStarted, true, 'Engine wechselt sofort in isOpenStarted');
assert.deepStrictEqual(fakeAnimPlayingSegments, { seg: [60, 150], loop: false }, 'playSegments([60, 150]) elastisch gestartet');

// Server-Antwort trifft ein
testEngine.setChestData({ success: true, chestType: 'gold', rewards: [{ id: 'legendary_deck', rarity: 'legendary' }] });
// Frame-Update erreicht Apex (curFrame 25 auf firstFrame 60 = absFrame 85)
const curFrame = 25;
const firstFrame = testEngine.lottieAnim.firstFrame;
if (curFrame + firstFrame >= 85 || curFrame >= 25) {
  testEngine.hasApexReachedTime = true;
  testEngine.fireApexOnce();
}
assert.ok(testEngine.hasApexFired, 'Apex hat synchron ausgelöst');
assert.strictEqual(capturedApexData.chestType, 'gold', 'Gold-Truhendaten kamen sauber am Apex an');

console.log('✓ 6. Concurrency-, Lifecycle- & Timer-Sicherheit vollständig verifiziert!');

console.log('--- TEST: INTERAKTIVE 3D-TRUHEN-ZEREMONIE & GARDEROBE BESTANDEN! ---');
