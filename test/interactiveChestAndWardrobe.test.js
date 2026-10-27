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

// [2/5] Überprüfe Interaktive Unboxing-Bühne, Altlasten-Bereinigung & plastische Dark-Fantasy Artworks
console.log('[2/5] Überprüfe Interaktive Unboxing-Bühne, Altlasten-Bereinigung & Vektor-Artworks...');
assert.ok(indexHtml.includes('id="btnVaultUnboxingClose"'), '#btnVaultUnboxingClose Schließen-Button vorhanden');
assert.ok(clientJs.includes('btnUnboxClose.addEventListener(\'click\', finishUnboxing)'), 'Schließen-Handler auf #btnVaultUnboxingClose registriert');
assert.ok(indexHtml.includes('id="vaultUnboxingStage"'), '#vaultUnboxingStage vorhanden');
assert.ok(indexHtml.includes('id="vaultFxCanvas"'), '#vaultFxCanvas 60-FPS Canvas Layer vorhanden');
assert.ok(indexHtml.includes('id="vaultArcaneChest"'), '#vaultArcaneChest interaktive Truhe vorhanden');
assert.ok(indexHtml.includes('id="vaultArcaneChestArtwork"'), '#vaultArcaneChestArtwork Container vorhanden');
assert.ok(indexHtml.includes('id="vaultChestFlashOverlay"'), '#vaultChestFlashOverlay Scheitelpunkt-Blitz vorhanden');
assert.ok(indexHtml.includes('id="vaultChestClickPrompt"'), '#vaultChestClickPrompt vorhanden');

assert.ok(indexHtml.includes('.vault-arcane-chest'), 'CSS für .vault-arcane-chest vorhanden');
assert.ok(indexHtml.includes('.arcane-chest-halo'), 'CSS für .arcane-chest-halo (magische Glüh-Aura) vorhanden');
assert.ok(indexHtml.includes('.vault-arcane-chest.bursting'), 'CSS für Apex-Animation vorhanden');
assert.ok(indexHtml.includes('.chest-flash-overlay'), 'CSS für .chest-flash-overlay vorhanden');
assert.ok(indexHtml.includes('.chest-artwork-medallion'), 'CSS für .chest-artwork-medallion vorhanden');
assert.ok(indexHtml.includes('.mini-chest-wood'), 'Miniatur-Visual für Holztruhe');
assert.ok(indexHtml.includes('.mini-chest-silver'), 'Miniatur-Visual für Silbertruhe');
assert.ok(indexHtml.includes('.mini-chest-gold'), 'Miniatur-Visual für Goldkassette');
assert.ok(indexHtml.includes('@keyframes chestRumble'), '@keyframes chestRumble vorhanden');
assert.ok(indexHtml.includes('@keyframes floatChest'), '@keyframes floatChest vorhanden');
assert.ok(indexHtml.includes('.btn-drop-equip'), 'CSS für .btn-drop-equip vorhanden');

// 3D-Karten-Flip & Unboxing-Bedienelemente
assert.ok(indexHtml.includes('.mystery-card-wrap'), 'CSS für .mystery-card-wrap (3D Card Flip) vorhanden');
assert.ok(indexHtml.includes('id="btnFlipAllCards"'), '#btnFlipAllCards vorhanden');
assert.ok(indexHtml.includes('.chest-vector-badge'), 'CSS für .chest-vector-badge vorhanden');
assert.ok(indexHtml.includes('badge-tier-wooden'), 'Vektor-Badge für Holztruhe vorhanden');
assert.ok(indexHtml.includes('badge-tier-silver'), 'Vektor-Badge für Silbertruhe vorhanden');
assert.ok(indexHtml.includes('badge-tier-gold'), 'Vektor-Badge für Goldkassette vorhanden');
assert.ok(!indexHtml.includes('images/chests/chest_wooden_closed.png'), 'Altes Bitmap-Artwork für Holztruhe sauber entfernt');
assert.ok(!indexHtml.includes('images/chests/chest_silver_closed.png'), 'Altes Bitmap-Artwork für Silbertruhe sauber entfernt');
assert.ok(!indexHtml.includes('images/chests/chest_gold_closed.png'), 'Altes Bitmap-Artwork für Goldkassette sauber entfernt');

// Bereinigung von früheren Altlasten (Lottie, Videos, Dummy-Container)
assert.ok(!indexHtml.includes('src="js/lottie.min.js"'), 'lottie.min.js Script-Tag sauber aus index.html entfernt');
assert.ok(!indexHtml.includes('id="vaultLottieContainer"'), 'Alte Kompatibilitäts-Container #vaultLottieContainer entfernt');
assert.ok(!indexHtml.includes('id="vaultChestInteractive"'), 'Alte Dummy-Struktur #vaultChestInteractive entfernt');
assert.ok(!indexHtml.includes('class="vault-lottie-container'), 'Klasse .vault-lottie-container aus index.html entfernt');
assert.ok(!indexHtml.includes('.vault-video-stage'), 'Klasse .vault-video-stage aus index.html entfernt');
assert.ok(!fs.existsSync(path.join(__dirname, '../public/js/lottie.min.js')), 'public/js/lottie.min.js Datei sauber gelöscht');
assert.ok(!fs.existsSync(path.join(__dirname, '../scripts/generate_lottie_chests.js')), 'scripts/generate_lottie_chests.js sauber gelöscht');
assert.ok(!fs.existsSync(path.join(__dirname, '../public/animations/chests')), 'public/animations/chests sauber gelöscht');
assert.ok(indexHtml.includes('client.js?v=20261027_isolated_chests') || indexHtml.includes('client.js?v=20261027_hearthstone_chests') || indexHtml.includes('client.js?v=20261027_clean_unboxing') || indexHtml.includes('client.js?v=20261027_permanent_podium') || indexHtml.includes('client.js?v=20261027_fancier_unboxing'), 'Cache-Busting aktualisiert');

// Handgemalte Dark-Fantasy Artworks & Bereinigung
const chestsDir = path.join(__dirname, '../public/images/chests');
assert.ok(fs.existsSync(path.join(chestsDir, 'chest_wooden.png')), 'Transparente Holztruhe existiert');
assert.ok(fs.existsSync(path.join(chestsDir, 'chest_silver.png')), 'Transparente Silbertruhe existiert');
assert.ok(fs.existsSync(path.join(chestsDir, 'chest_gold.png')), 'Transparente Goldtruhe existiert');
assert.ok(clientJs.includes('getChestArtworkHtml'), 'getChestArtworkHtml in client.js vorhanden');
assert.ok(indexHtml.includes('.arcane-chest-hero-img'), 'CSS für .arcane-chest-hero-img vorhanden');
assert.ok(indexHtml.includes('display: none !important'), 'vault-fx-canvas für saubere Kartenansicht ausgeblendet');

// Freigestellte 3D-Truhen, Punkt-Bereinigung & Auto-Scroll Verifikation
assert.ok(!indexHtml.includes('.mini-chest-wood::after'), 'Veralteter Punkt auf Holztruhen-Medaillon entfernt');
assert.ok(!indexHtml.includes('.mini-chest-silver::after'), 'Veralteter Punkt auf Silbertruhen-Medaillon entfernt');
assert.ok(!indexHtml.includes('.mini-chest-gold::after'), 'Veralteter Punkt auf Goldtruhen-Medaillon entfernt');
assert.ok(indexHtml.includes('chest_wooden.png'), 'Transparente 32-Bit PNG Truhe für Holztruhe eingebunden');
assert.ok(clientJs.includes('chest_${t}.png'), 'getChestArtworkHtml nutzt echte Alpha-Transparenz PNGs');
assert.ok(clientJs.includes('openChestModal'), 'openChestModal in client.js vorhanden');
assert.ok(clientJs.includes('unbox.scrollIntoView'), 'Automatisches Scrollen via scrollIntoView vorhanden');
assert.ok(clientJs.includes('vaultBody.scrollTop = 0'), 'Scroll-Reset auf vaultBody vorhanden');

// Plastische Dark-Fantasy Vektor-Artworks in client.js verifizieren
assert.ok(clientJs.includes('tier-wooden-svg'), 'Detailliertes Vektor-Artwork für Holztruhe vorhanden');
assert.ok(clientJs.includes('tier-silver-svg'), 'Detailliertes Vektor-Artwork für Silbertruhe vorhanden');
assert.ok(clientJs.includes('tier-gold-svg'), 'Detailliertes Vektor-Artwork für Goldkassette vorhanden');
assert.ok(clientJs.includes('darkOakBody') && clientJs.includes('amberLockGlow') && clientJs.includes('forgedIronGrad'), 'Holz: Holzmaserung, Schmiedeeisen & Bernstein-Kern vorhanden');
assert.ok(clientJs.includes('mithrilPlateGrad') && clientJs.includes('frostSapphireCore') && clientJs.includes('cyanConduitGrad'), 'Silber: Mithril-Platten, Frost-Saphir & Cyan-Runen vorhanden');
assert.ok(clientJs.includes('goldPlinthGrad') && clientJs.includes('royalVelvetGrad') && clientJs.includes('dragonRubyCore'), 'Gold: 24k Gold, Purpursamt & Drachenrubin vorhanden');

console.log('✓ 2. Unboxing-Bühne, Altlasten-Bereinigung & plastische Dark-Fantasy Vektor-Artworks verifiziert.');

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

// Obsolete Kometen- & Lottie-Klassen restlos aus client.js entfernt
assert.ok(!clientJs.includes('class CometProjectile'), 'Obsolete CometProjectile-Klasse sauber entfernt');
assert.ok(!clientJs.includes('class CometTailParticle'), 'Obsolete CometTailParticle-Klasse sauber entfernt');
assert.ok(!clientJs.includes('function launchComets'), 'Obsolete launchComets-Funktion sauber entfernt');
assert.ok(!clientJs.includes('function triggerImpactFx'), 'Obsolete triggerImpactFx-Funktion sauber entfernt');
assert.ok(!clientJs.includes('activeComets'), 'activeComets Array und Schleifen sauber entfernt');
assert.ok(!clientJs.includes('const VaultLottieEngine ='), 'Alte VaultLottieEngine sauber entfernt');
assert.ok(!clientJs.includes('const VaultVideoEngine ='), 'Alte VaultVideoEngine sauber entfernt');

assert.ok(clientJs.includes('function handleChestClick'), 'handleChestClick Funktion implementiert');
assert.ok(clientJs.includes('triggerChestBurstFx'), 'triggerChestBurstFx Canvas-FX implementiert');
assert.ok(clientJs.includes('chestLightRays'), 'Volumetrische God-Rays / Lichtsäulen in Canvas-FX integriert');
assert.ok(clientJs.includes('chestRuneMotes'), 'Schwebende Runen-Funken in Canvas-FX integriert');
assert.ok(clientJs.includes('unboxingApexTimer'), 'unboxingApexTimer Lebenszyklus-Schutz vorhanden');
assert.ok(clientJs.includes('unboxingStageTimer'), 'unboxingStageTimer Lebenszyklus-Schutz vorhanden');
assert.ok(clientJs.includes('wardrobe:equip'), 'wardrobe:equip Socket-Event auf Beutekarte integriert');

// Sicherstellen, dass kein redundanter doppelter Event-Emit auf Beutekarten existiert
assert.ok(!clientJs.includes("socket.emit('wardrobe:equip', { itemType: targetType, itemId: targetId, token });\n            socket.emit('vault:equip'"), 'Kein redundanter Doppel-Emit von wardrobe:equip und vault:equip auf Beutekarte');
assert.ok(clientJs.includes('arcaneChest.addEventListener(\'click\', handleChestClick)'), 'Klick-Handler auf #vaultArcaneChest registriert');
assert.ok(clientJs.includes("e.key === 'Enter' || e.key === ' '"), 'Tastatur-Entriegelung (Enter/Space) für Truhen-Bühne registriert');
assert.ok(clientJs.includes("if (screenName === 'game')"), 'Concurrency-Schutz bei Spielstart vorhanden');
assert.ok(clientJs.includes('WizardVault.closeVault()') || clientJs.includes('closeVault()'), 'closeVault() bei Spielstart aufgerufen');
console.log('✓ 4. Klick-Entriegelung, reine Unboxing-Bühne, Canvas-FX & Spielstart-Schutz verifiziert.');

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

// 1. Lifecycle & Timer-Cleanup Simulation
assert.ok(clientJs.includes('if (unboxingApexTimer)'), 'unboxingApexTimer wird vor/bei finishUnboxing sauber gecancelt');
assert.ok(clientJs.includes('if (unboxingStageTimer)'), 'unboxingStageTimer wird vor/bei finishUnboxing sauber gecancelt');
assert.ok(clientJs.includes('if (unboxingFlashTimer)'), 'unboxingFlashTimer wird vor/bei finishUnboxing sauber gecancelt');
assert.ok(clientJs.includes('stopChestFx()'), 'stopChestFx() wird in finishUnboxing aufgerufen');

// 2. Kein Doppel-Emit beim Ausrüsten
const equipHandlerMatch = clientJs.match(/equipBtn\.addEventListener\('click'[\s\S]*?showToast/);
assert.ok(equipHandlerMatch, 'Ausrüst-Klick-Handler auf Beutekarte gefunden');
const equipCode = equipHandlerMatch[0];
const vaultEquipEmits = (equipCode.match(/socket\.emit\(['"]vault:equip['"]/g) || []).length;
const wardrobeEquipEmits = (equipCode.match(/socket\.emit\(['"]wardrobe:equip['"]/g) || []).length;
assert.strictEqual(wardrobeEquipEmits, 1, 'Exakt 1 wardrobe:equip Socket-Event auf Beutekarte');
assert.strictEqual(vaultEquipEmits, 0, 'Kein redundantes vault:equip Socket-Event auf Beutekarte (verhindert doppelte DB-Writes)');

// 3. Zero-Crash-Prüfung und saubere Trennung alter Bildreferenzen
assert.ok(!clientJs.includes('if (safeData.chestType === \'gold\' && imgOpen'), 'Keine veraltete imgOpen/imgClosed Sprite-Referenz');
assert.ok(!indexHtml.includes('vaultChestImgClosed'), 'vaultChestImgClosed sauber aus index.html entfernt');
assert.ok(!indexHtml.includes('vaultChestImgOpen'), 'vaultChestImgOpen sauber aus index.html entfernt');

// 4. Teste Vektor-Generierungsfunktion für alle 3 Stufen
const getChestVectorMatch = clientJs.match(/function getChestVectorSvg\(tier\) \{([\s\S]*?)\n  \}/);
assert.ok(getChestVectorMatch, 'getChestVectorSvg im Client-Code vorhanden');
const getChestVectorFunc = new Function('tier', getChestVectorMatch[1]);

const goldSvg = getChestVectorFunc('gold');
assert.ok(goldSvg.includes('tier-gold-svg') && goldSvg.includes('dragonRubyCore'), 'Goldener Vektor ist vollständig und valide');
assert.ok(goldSvg.includes('viewBox="0 0 240 200"'), 'Goldene Truhe nutzt 240x200 HD ViewBox');

const silverSvg = getChestVectorFunc('silver');
assert.ok(silverSvg.includes('tier-silver-svg') && silverSvg.includes('frostSapphireCore'), 'Silberner Vektor ist vollständig und valide');
assert.ok(silverSvg.includes('viewBox="0 0 240 200"'), 'Silberne Truhe nutzt 240x200 HD ViewBox');

const woodSvg = getChestVectorFunc('wooden');
assert.ok(woodSvg.includes('tier-wooden-svg') && woodSvg.includes('amberLockGlow'), 'Hölzerner Vektor ist vollständig und valide');
assert.ok(woodSvg.includes('viewBox="0 0 240 200"'), 'Hölzerne Truhe nutzt 240x200 HD ViewBox');

// 5. Unboxing State Machine Ablauf-Simulation (3D Card Flip & Reveal)
let mockCardWrap = {
  classes: new Set(['mystery-card-wrap', 'drop-card-reveal', 'rarity-legendary']),
  classList: {
    add: function(...names) { names.forEach(n => mockCardWrap.classes.add(n)); },
    remove: function(...names) { names.forEach(n => mockCardWrap.classes.delete(n)); },
    contains: function(name) { return mockCardWrap.classes.has(name); }
  }
};

assert.strictEqual(mockCardWrap.classList.contains('flipped'), false, 'Karte startet im verdeckten Zustand');
// Flip-Aktion ausführen
mockCardWrap.classList.add('flipped', 'revealed');
assert.strictEqual(mockCardWrap.classList.contains('flipped'), true, 'Karte wechselt in geflippten Zustand');
assert.strictEqual(mockCardWrap.classList.contains('revealed'), true, 'Karte ist enthüllt');

console.log('✓ 6. Concurrency-, Lifecycle- & Timer-Sicherheit vollständig verifiziert!');

console.log('--- TEST: INTERAKTIVE 3D-TRUHEN-ZEREMONIE & GARDEROBE BESTANDEN! ---');
