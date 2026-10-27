const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createSqliteEngine } = require('../server/db/sqliteEngine');
const sharedHelpers = require('../server/db/sharedHelpers');

console.log('--- TESTSUITE: MODAL-EXIT & PHOENIX ACCOUNT RESTORE START ---');

// =========================================================================
// [1/4] ÜBERPRÜFE HTML & CLIENT.JS MODAL-EXIT BINDINGS
// =========================================================================
console.log('[1/4] Überprüfe HTML & Client.js Modal-Schließen-Bindings...');

const htmlPath = path.join(__dirname, '../public/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const clientPath = path.join(__dirname, '../public/client.js');
const clientContent = fs.readFileSync(clientPath, 'utf8');

// 1. Prüfe Schließen-Button ID und Klassen im HTML
assert(htmlContent.includes('id="vaultCloseBtn"'), 'HTML muss #vaultCloseBtn enthalten');
assert(htmlContent.includes('class="drawer-close-btn btn-vault-close-action"'), 'HTML #vaultCloseBtn muss Klasse btn-vault-close-action besitzen');

// 2. Prüfe Schließen-Schaltflächen (.btn-vault-close-action): Kopfzeile (alle Tab-Fußzeilen sauber ohne redundanten Bottom-Button)
const footerMatches = htmlContent.match(/btn-vault-close-action/g) || [];
assert(footerMatches.length >= 1, `Es muss mindestens 1 Schließen-Schaltfläche (.btn-vault-close-action) existieren. Gefunden: ${footerMatches.length}`);
assert(htmlContent.includes('Zurück zur Zitadelle'), 'HTML muss "Zurück zur Zitadelle" Buttons enthalten');

// 3. Prüfe JavaScript Event-Bindings in client.js
assert(clientContent.includes("document.getElementById('vaultCloseBtn')"), 'client.js muss vaultCloseBtn binden');
assert(clientContent.includes("document.getElementById('btnVaultClose')"), 'client.js muss btnVaultClose binden');
assert(clientContent.includes("querySelectorAll('.btn-vault-close-action')"), 'client.js muss alle Tab-Fußzeilen-Buttons binden');
assert(clientContent.includes("e.target === vaultModalEl"), 'client.js muss Backdrop-Klick auf #vault-modal behandeln');
assert(clientContent.includes("e.key === 'Escape'"), 'client.js muss Escape-Taste behandeln');
assert(clientContent.includes("closeVault();"), 'client.js muss closeVault() beim Schließen aufrufen');

console.log('✓ Alle Modal-Schließen-Buttons, Backdrop-Klicks und Escape-Listener fehlerfrei verifiziert.');

// =========================================================================
// [2/4] TESTE PHOENIX RESTORE METHODE IN SQLITE ENGINE
// =========================================================================
console.log('[2/4] Überprüfe restoreUserPhoenix in SQLite Engine...');

const dbEngine = createSqliteEngine(':memory:', sharedHelpers);

const mockPhoenixPayload = {
  username: 'ArchmagePhoenix',
  recoveryKey: 'secret_phoenix_token_999',
  accountLevel: 8,
  currentXp: 750,
  astralDust: 350,
  chestsWooden: 2,
  chestsSilver: 1,
  chestsGold: 1,
  avatarId: 'icon_pyromancer',
  title: 'Phönix des Schicksals',
  inventory: [
    { item_type: 'card_back', item_id: 'citadel_ancient', acquired_at: new Date().toISOString() },
    { item_type: 'avatar_frame', item_id: 'frame_gold', acquired_at: new Date().toISOString() },
    { item_type: 'table_skin', item_id: 'magma_forge', acquired_at: new Date().toISOString() }
  ],
  equipped: {
    equipped_card_back: 'citadel_ancient',
    equipped_table_skin: 'magma_forge',
    equipped_avatar_frame: 'frame_gold',
    equipped_lobby_background: 'bg_magma_forge'
  }
};

// 1. Restore auf leerer Datenbank (Simulation von Render-Server-Wipe)
const restoreRes = dbEngine.restoreUserPhoenix(mockPhoenixPayload);
assert(restoreRes && restoreRes.success, 'restoreUserPhoenix muss auf frischer DB erfolgreich sein: ' + restoreRes?.error);
assert(restoreRes.token && restoreRes.token.length >= 32, 'Ein valider Session-Token muss zurückgegeben werden');
assert(restoreRes.user, 'Ein vollständiges Benutzerobjekt muss zurückgegeben werden');

const restoredUser = restoreRes.user;
assert.strictEqual(restoredUser.username, 'ArchmagePhoenix');
assert.strictEqual(restoredUser.account_level, 8, 'Account-Level 8 muss exakt wiederhergestellt sein');
assert.strictEqual(restoredUser.account_xp, 750, 'XP 750 müssen exakt wiederhergestellt sein');
assert.strictEqual(restoredUser.astral_dust, 350, 'Astralstaub 350 muss exakt wiederhergestellt sein');
assert.strictEqual(restoredUser.chests_wooden, 2, '2 Holztruhen müssen wiederhergestellt sein');
assert.strictEqual(restoredUser.chests_silver, 1, '1 Silbertruhe muss wiederhergestellt sein');
assert.strictEqual(restoredUser.chests_gold, 1, '1 Goldtruhe muss wiederhergestellt sein');
assert.strictEqual(restoredUser.avatar_id, 'icon_pyromancer');
assert.strictEqual(restoredUser.title, 'Phönix des Schicksals');
assert.strictEqual(restoredUser.equipped_card_back, 'citadel_ancient');
assert.strictEqual(restoredUser.equipped_table_skin, 'magma_forge');
assert.strictEqual(restoredUser.equipped_avatar_frame, 'frame_gold');

// 2. Prüfe wiederhergestelltes Inventar
const cosRes = dbEngine.getUserCosmetics(restoredUser.id);
assert(cosRes.success, 'getUserCosmetics fehlgeschlagen');
assert(cosRes.inventory.some(i => i.item_id === 'citadel_ancient'), 'Kartenrücken citadel_ancient muss im Inventar sein');
assert(cosRes.inventory.some(i => i.item_id === 'frame_gold'), 'Rahmen frame_gold muss im Inventar sein');
assert(cosRes.inventory.some(i => i.item_id === 'magma_forge'), 'Tisch magma_forge muss im Inventar sein');

// 3. Prüfe Token-Gültigkeit
const userByToken = dbEngine.getUserByToken(restoreRes.token);
assert(userByToken, 'getUserByToken mit neuem Phoenix-Token muss erfolgreich sein');
assert.strictEqual(userByToken.id, restoredUser.id);

console.log('✓ SQLite restoreUserPhoenix hat Account, Stufe, Astralstaub und Inventar erfolgreich wiederhergestellt.');

// =========================================================================
// [3/4] TESTE UPDATE EINES BEREITS EXISTIERENDEN USERS VIA PHOENIX RESTORE
// =========================================================================
console.log('[3/4] Überprüfe inkrementelles Update bei bestehendem User...');

const updatePayload = {
  username: 'ArchmagePhoenix',
  accountLevel: 10, // Höheres Level
  astralDust: 600,   // Mehr Staub
  inventory: [
    { item_type: 'title', item_id: 'MVP der Zitadelle', acquired_at: new Date().toISOString() }
  ]
};

const updateRes = dbEngine.restoreUserPhoenix(updatePayload);
assert(updateRes && updateRes.success, 'Update muss erfolgreich sein');
assert.strictEqual(updateRes.user.account_level, 10, 'Level muss auf 10 angehoben worden sein');
assert.strictEqual(updateRes.user.astral_dust, 600, 'Astralstaub muss auf 600 angehoben worden sein');

const updatedCos = dbEngine.getUserCosmetics(updateRes.user.id);
assert(updatedCos.inventory.some(i => i.item_id === 'MVP der Zitadelle'), 'Neuer Titel muss ins Inventar eingefügt worden sein');
assert(updatedCos.inventory.some(i => i.item_id === 'citadel_ancient'), 'Alter Kartenrücken muss erhalten geblieben sein');

console.log('✓ Inkrementelles Phoenix-Update bewahrt bestehendes Inventar und aktualisiert Höchstwerte.');

// =========================================================================
// [4/4] TESTE CLIENT PHOENIX SELF-HEALING LOGIK
// =========================================================================
console.log('[4/4] Überprüfe Client.js Phoenix Self-Healing & Vault Funktionen...');

assert(clientContent.includes('function updatePhoenixVault('), 'client.js muss updatePhoenixVault() deklarieren');
assert(clientContent.includes('function getPhoenixVault('), 'client.js muss getPhoenixVault() deklarieren');
assert(clientContent.includes('async function tryPhoenixRestore('), 'client.js muss tryPhoenixRestore() deklarieren');
assert(clientContent.includes('/api/auth/phoenix-restore'), 'client.js muss Endpunkt /api/auth/phoenix-restore aufrufen');
assert(clientContent.includes('grimoire_explicit_logout'), 'client.js muss zwischen gewolltem Logout und Server-Wipe unterscheiden');

console.log('✓ Client-seitige Phoenix Self-Healing Architektur vollständig integriert.');

dbEngine.closeDatabase();

console.log('\n======================================================');
console.log('🏆 ALLE MODAL-EXIT & PHOENIX RESTORE TESTS BESTANDEN!');
console.log('======================================================\n');
