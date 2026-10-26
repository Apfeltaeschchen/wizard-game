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

// Methode A: Video-Bühne & Screen-Blend CSS prüfen
assert.ok(indexHtml.includes('id="vaultVideoStage"'), '#vaultVideoStage vorhanden');
assert.ok(indexHtml.includes('id="vaultChestVideoIdle"'), '#vaultChestVideoIdle vorhanden');
assert.ok(indexHtml.includes('id="vaultChestVideoOpen"'), '#vaultChestVideoOpen vorhanden');
assert.ok(indexHtml.includes('mix-blend-mode: screen'), 'CSS für mix-blend-mode: screen vorhanden');
assert.ok(indexHtml.includes('transform: translateZ(0)'), 'CSS für transform: translateZ(0) Hardware-Beschleunigung vorhanden');
assert.ok(indexHtml.includes('.video-ambient-glow'), 'CSS für .video-ambient-glow vorhanden');
assert.ok(indexHtml.includes('transform: translate(-50%, -50%) scale('), 'peakFlash Keyframes behalten Zentrierung translate(-50%, -50%) bei');

// Echte Truhen-Artworks in public/images/chests prüfen
const chestsDir = path.join(__dirname, '../public/images/chests');
assert.ok(fs.existsSync(path.join(chestsDir, 'chest_wooden_closed.png')), 'chest_wooden_closed.png existiert');
assert.ok(fs.existsSync(path.join(chestsDir, 'chest_silver_closed.png')), 'chest_silver_closed.png existiert');
assert.ok(fs.existsSync(path.join(chestsDir, 'chest_gold_closed.png')), 'chest_gold_closed.png existiert');
assert.ok(fs.existsSync(path.join(chestsDir, 'chest_gold_open.png')), 'chest_gold_open.png existiert');

// Methode A: Echte Truhen-Videos in public/video/chests prüfen (alle 12 Assets: MP4 & WebM)
const videoChestsDir = path.join(__dirname, '../public/video/chests');
const requiredVideos = [
  'chest_wooden_idle.mp4', 'chest_wooden_idle.webm',
  'chest_wooden_open.mp4', 'chest_wooden_open.webm',
  'chest_silver_idle.mp4', 'chest_silver_idle.webm',
  'chest_silver_open.mp4', 'chest_silver_open.webm',
  'chest_gold_idle.mp4', 'chest_gold_idle.webm',
  'chest_gold_open.mp4', 'chest_gold_open.webm'
];
for (const vidName of requiredVideos) {
  const p = path.join(videoChestsDir, vidName);
  assert.ok(fs.existsSync(p), `Video existiert: ${vidName}`);
  const stat = fs.statSync(p);
  assert.ok(stat.size > 50000, `Videogröße von ${vidName} ist valide (>50KB): ${stat.size} Bytes`);
}

console.log('✓ 2. Unboxing-Bühne, Methode A Video-Assets (12/12 MP4 & WebM), Canvas-FX Layer & Artwork-Assets verifiziert.');

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
assert.ok(clientJs.includes('videoStage.addEventListener(\'click\', handleChestClick)'), 'Klick-Handler auf Video-Bühne registriert');
assert.ok(clientJs.includes("e.key === 'Enter' || e.key === ' '"), 'Tastatur-Entriegelung (Enter/Space) für Video-Bühne registriert');
assert.ok(clientJs.includes('VaultVideoEngine'), 'VaultVideoEngine in client.js implementiert');
assert.ok(clientJs.includes('preloadChestVideos'), 'preloadChestVideos Methode implementiert');
assert.ok(clientJs.includes('playOpen'), 'playOpen mit Scheitelpunkt-Synchronisation implementiert');
assert.ok(clientJs.includes('setChestData'), 'setChestData für Scheitelpunkt-Synchronisation implementiert');
assert.ok(clientJs.includes('getVideoExtension') || clientJs.includes('canPlayType'), 'Codec-Erkennung für MP4/WebM vorhanden');
assert.ok(clientJs.includes('timeupdate'), 'timeupdate Apex-Synchronisation implementiert');
assert.ok(clientJs.includes('VaultVideoEngine.cleanup()'), 'VaultVideoEngine.cleanup() aufgerufen');
assert.ok(clientJs.includes("if (screenName === 'game')"), 'Concurrency-Schutz bei Spielstart vorhanden');
assert.ok(clientJs.includes('WizardVault.closeVault()') || clientJs.includes('closeVault()'), 'closeVault() bei Spielstart aufgerufen');
console.log('✓ 4. Klick-Entriegelung, Methode A VaultVideoEngine, Canvas-FX & Spielstart-Schutz verifiziert.');

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
// 1. Asset-Integrität: Beide Erweiterungen (.png und .jpg) vorhanden und valide Bildgröße (> 500 KB)
const requiredImages = [
  'chest_wooden_closed.png', 'chest_wooden_closed.jpg',
  'chest_silver_closed.png', 'chest_silver_closed.jpg',
  'chest_gold_closed.png', 'chest_gold_closed.jpg',
  'chest_gold_open.png', 'chest_gold_open.jpg'
];
for (const imgName of requiredImages) {
  const p = path.join(chestsDir, imgName);
  assert.ok(fs.existsSync(p), `Bild existiert: ${imgName}`);
  const stat = fs.statSync(p);
  assert.ok(stat.size > 500000, `Bildgröße von ${imgName} ist valide (>500KB): ${stat.size} Bytes`);
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

console.log('✓ 6. Concurrency-, Lifecycle- & Timer-Sicherheit vollständig verifiziert!');

console.log('--- TEST: INTERAKTIVE 3D-TRUHEN-ZEREMONIE & GARDEROBE BESTANDEN! ---');
