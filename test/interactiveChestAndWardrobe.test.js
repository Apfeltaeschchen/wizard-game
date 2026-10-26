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

// [2/5] Überprüfe Interaktive 3D-Truhe im HTML & CSS
console.log('[2/5] Überprüfe Interaktive 3D-Truhe & Animationen...');
assert.ok(indexHtml.includes('id="vaultUnboxingStage"'), '#vaultUnboxingStage vorhanden');
assert.ok(indexHtml.includes('id="vaultChestInteractive"'), '#vaultChestInteractive 3D-Truhe vorhanden');
assert.ok(indexHtml.includes('id="vaultChestClickPrompt"'), '#vaultChestClickPrompt vorhanden');
assert.ok(indexHtml.includes('.chest-3d-model'), 'CSS für .chest-3d-model vorhanden');
assert.ok(indexHtml.includes('.chest-lid'), 'CSS für .chest-lid vorhanden');
assert.ok(indexHtml.includes('.chest-lock'), 'CSS für .chest-lock vorhanden');
assert.ok(indexHtml.includes('.chest-light-burst'), 'CSS für .chest-light-burst vorhanden');
assert.ok(indexHtml.includes('@keyframes chestRumble'), '@keyframes chestRumble vorhanden');
assert.ok(indexHtml.includes('@keyframes floatChest'), '@keyframes floatChest vorhanden');
console.log('✓ 2. 3D-Truhen-Bühne & Keyframe-Animationen vollständig.');

// [3/5] Überprüfe Garderoben-Visuals für alle 6 Kategorien
console.log('[3/5] Überprüfe Bildvorschauen & Filter-Pills in Garderobe & Schmiede...');
assert.ok(indexHtml.includes('.cosmetic-mini-cardback'), 'CSS für .cosmetic-mini-cardback vorhanden');
assert.ok(indexHtml.includes('.cosmetic-mini-table'), 'CSS für .cosmetic-mini-table vorhanden');
assert.ok(indexHtml.includes('.cosmetic-mini-lobby'), 'CSS für .cosmetic-mini-lobby vorhanden');
assert.ok(indexHtml.includes('.cosmetic-mini-title'), 'CSS für .cosmetic-mini-title vorhanden');
assert.ok(clientJs.includes('function getCosmeticVisualHtml'), 'getCosmeticVisualHtml Generator in client.js vorhanden');
assert.ok(clientJs.includes('currentWardrobeCategory = pill.dataset.category'), 'Wardrobe Filter-Pills nutzen korrektes data-category');
assert.ok(clientJs.includes('currentForgeCategory = pill.dataset.forgeCategory'), 'Forge Filter-Pills nutzen korrektes data-forgeCategory');
console.log('✓ 3. Bildvorschauen & Filter-Listener für alle 6 Kosmetik-Typen verifiziert.');

// [4/5] Überprüfe Audio & Klick-Interaktion der Truhe
console.log('[4/5] Überprüfe Audio-Engine & Klick-Zeremonie...');
assert.ok(clientJs.includes('playChestRumble'), 'WizardAudio.playChestRumble implementiert');
assert.ok(clientJs.includes('playChestBurst'), 'WizardAudio.playChestBurst implementiert');
assert.ok(clientJs.includes('function handleChestClick'), 'handleChestClick Funktion implementiert');
assert.ok(clientJs.includes('chestInteractive.addEventListener(\'click\', handleChestClick)'), 'Klick-Handler auf 3D-Truhe registriert');
console.log('✓ 4. Klick-Entriegelung & Audio-Feedback verifiziert.');

// [5/5] Überprüfe Persistentes Account- & Kosmetik-Backup (Zero Data Loss)
console.log('[5/5] Überprüfe Persistentes Account- & Kosmetik-Backup...');
const tempDbPath = path.join(__dirname, 'test_persistence_chest.db');
const tempBackupPath = path.join(__dirname, 'wizard_accounts_backup.json');

// Cleanup vor dem Test
try { if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath); } catch (e) {}
try { if (fs.existsSync(tempBackupPath)) fs.unlinkSync(tempBackupPath); } catch (e) {}

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

// Aufräumen
try { if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath); } catch (e) {}
try { if (fs.existsSync(tempBackupPath)) fs.unlinkSync(tempBackupPath); } catch (e) {}

console.log('--- TEST: INTERAKTIVE 3D-TRUHEN-ZEREMONIE & GARDEROBE BESTANDEN! ---');
