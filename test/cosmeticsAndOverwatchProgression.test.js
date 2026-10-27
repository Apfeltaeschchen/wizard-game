// =====================================================================
// AUTOMATED TEST SUITE: ETAPPE 6 - SCHATZKAMMER, KOSMETIK & PROGRESSION
// =====================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  RARITY_CONFIG,
  CHEST_TIERS,
  COSMETICS_CATALOG,
  CATALOG_BY_TYPE_AND_ID,
  WEEKLY_MILESTONES,
  calculateMatchXP,
  calculateLevelProgress,
  rollChestRewards,
  getCurrentWeeklyPeriodId,
  XP_PER_LEVEL
} = require('../server/cosmeticsData');

const { createSqliteEngine } = require('../server/db/sqliteEngine');
const sharedHelpers = require('../server/db/sharedHelpers');

console.log('--- TESTSUITE: SCHATZKAMMER & PROGRESSION (ETAPPE 6) START ---');

// 1. KATALOG & ASSET-INTEGRITÄT
console.log('[1/5] Überprüfe Katalog-Struktur und Bilddateien...');

assert(COSMETICS_CATALOG.avatar_icons.length >= 9, 'Katalog muss mindestens 9 Avatar-Icons enthalten (1 Initialen-Medaillon + 8 Artworks)');
assert(COSMETICS_CATALOG.table_skins.length >= 5, 'Katalog muss mindestens 5 Spieltische enthalten');
assert(COSMETICS_CATALOG.card_backs.length >= 6, 'Katalog muss mindestens 6 Kartendecks enthalten');
assert(COSMETICS_CATALOG.avatar_frames.length >= 6, 'Katalog muss mindestens 6 Rahmen enthalten');
assert(COSMETICS_CATALOG.titles.length >= 40, 'Katalog muss mindestens 40 Titel enthalten');

// Prüfe die 8 vom image-generator erstellten Avatar-Artworks auf der Festplatte
const expectedAvatars = [
  'icon_pyromancer.png',
  'icon_moon_witch.png',
  'icon_jester.png',
  'icon_dragon.png',
  'icon_forest_nymph.png',
  'icon_necromancer.png',
  'icon_vampire.png',
  'icon_seer.png'
];

expectedAvatars.forEach(filename => {
  const filePath = path.join(__dirname, '../public/images/avatars', filename);
  assert(fs.existsSync(filePath), `Avatar-Datei fehlt: ${filePath}`);
  const stats = fs.statSync(filePath);
  assert(stats.size > 10000, `Avatar-Datei ${filename} ist zu klein (${stats.size} Bytes)`);
});
console.log('✓ Alle 8 Avatar-Portraits existieren und sind valide Bilddateien.');

// 2. XP-BERECHNUNG & OVERWATCH-STYLE LEVEL-PROGRESSION
console.log('[2/5] Überprüfe Match-XP und Stufen-Fortschritt...');

// Basis Match XP
const normalXP = calculateMatchXP({ roundsPlayed: 10, rank: 3, bidsHit: 2, isRanked: false, isWinner: false });
assert.strictEqual(normalXP, 100 + 100 + 40 + 20, 'Match XP für Rang 3 falsch berechnet');

// Sieger Match XP mit Streak & Ranked
const winnerXP = calculateMatchXP({ roundsPlayed: 12, rank: 1, bidsHit: 8, isRanked: true, isWinner: true, isStreak: true });
assert.strictEqual(winnerXP, 100 + 120 + 150 + 80 + 50 + 50, 'Winner Match XP falsch berechnet');

// Levelaufstieg: 1 Stufe (1000 XP) -> Holztruhe
const prog1 = calculateLevelProgress(1, 800, 400); // 1200 Total -> Level 2, 200 XP
assert.strictEqual(prog1.oldLevel, 1);
assert.strictEqual(prog1.newLevel, 2);
assert.strictEqual(prog1.currentXP, 200);
assert.strictEqual(prog1.leveledUp, true);
assert.strictEqual(prog1.chestsAwarded.wooden, 1);
assert.strictEqual(prog1.chestsAwarded.silver, 0);

// Levelaufstieg: Erreichen von Stufe 5 -> Silbertruhe
const prog5 = calculateLevelProgress(4, 900, 200); // Level 5
assert.strictEqual(prog5.newLevel, 5);
assert.strictEqual(prog5.chestsAwarded.silver, 1);
assert.strictEqual(prog5.chestsAwarded.wooden, 0);

// Levelaufstieg: Erreichen von Stufe 10 -> Goldene Truhe
const prog10 = calculateLevelProgress(9, 950, 100); // Level 10
assert.strictEqual(prog10.newLevel, 10);
assert.strictEqual(prog10.chestsAwarded.gold, 1);
assert.strictEqual(prog10.chestsAwarded.wooden, 0);
console.log('✓ Overwatch-Progression & Stufen-Belohnungen fehlerfrei.');

// 3. TRUHEN-DROPS & DUPLIKAT-ZU-STAUB (PITY SYSTEM)
console.log('[3/5] Überprüfe Truhen-Drops & Astralstaub-Erstattung...');

const woodenRoll = rollChestRewards('wooden', []);
assert.strictEqual(woodenRoll.rewards.length, 2, 'Holztruhe muss 2 Gegenstände droppen');

const silverRoll = rollChestRewards('silver', []);
assert.strictEqual(silverRoll.rewards.length, 3, 'Silbertruhe muss 3 Gegenstände droppen');

const goldRoll = rollChestRewards('gold', []);
assert.strictEqual(goldRoll.rewards.length, 4, 'Goldtruhe muss 4 Gegenstände droppen');
// Garantiertes Episch/Legendär im letzten Slot der Goldtruhe
const lastItemRarity = goldRoll.rewards[3].rarity;
assert(['epic', 'legendary'].includes(lastItemRarity), `Letzter Slot muss epic oder legendary sein, war: ${lastItemRarity}`);

// Duplikat-Test: Wenn alle Items bereits im Besitz sind, muss Staub erstattet werden
const allItemIds = [];
for (const items of Object.values(COSMETICS_CATALOG)) {
  for (const item of items) {
    allItemIds.push(item.id);
  }
}
const dupRoll = rollChestRewards('wooden', allItemIds);
assert(dupRoll.totalDustGained > 0, 'Duplikate müssen Staub einbringen');
dupRoll.rewards.forEach(r => {
  assert.strictEqual(r.isDuplicate, true, 'Item muss als Duplikat markiert sein');
  assert(r.dustRefund > 0, 'Staub-Erstattung muss positiv sein');
});
console.log('✓ Truhen-Drops und Duplicate-to-Dust Logik verifiziert.');

// 4. IN-MEMORY SQLITE DATABASE METHODEN-TEST
console.log('[4/5] Überprüfe SQLite Engine Methoden...');

const db = createSqliteEngine(':memory:', sharedHelpers);

// Registriere Test-Magier
const reg = db.registerUser('ProgressionHero', 'ZauberPass123', 'wizard_blue');
assert(reg.success, 'Registrierung fehlgeschlagen');
const userId = reg.user.id;

// Prüfe Kosmetik-Status
const initialCosmetics = db.getUserCosmetics(userId);
assert(initialCosmetics.success, 'getUserCosmetics fehlgeschlagen');
assert.strictEqual(initialCosmetics.user.account_level, 1);
assert.strictEqual(initialCosmetics.user.chests_wooden, 1, 'Neuer Magier erhält 1 Willkommens-Holztruhe');
assert.strictEqual(initialCosmetics.user.astral_dust, 0);

// Öffne Willkommens-Truhe
const chestOpenRes = db.openChest(userId, 'wooden');
assert(chestOpenRes.success, 'Öffnen der Holztruhe fehlgeschlagen');
assert.strictEqual(chestOpenRes.rewards.length, 2);
assert.strictEqual(chestOpenRes.remainingChests, 0);

// Versuch, eine Truhe zu öffnen, wenn 0 vorhanden: muss geblockt werden
const emptyOpen = db.openChest(userId, 'wooden');
assert.strictEqual(emptyOpen.success, false, 'Leere Truhen dürfen nicht geöffnet werden können');

// Führe Match Progression aus (Sieg mit 5 Vorhersagen)
const matchRes = db.applyMatchProgression(userId, {
  rank: 1,
  isWinner: true,
  bidsHit: 5,
  roundsPlayed: 10,
  isRanked: true
});
assert(matchRes.gainedXP >= 400, 'Match XP muss mindestens 400 betragen');

// Gebe dem Spieler Astralstaub und teste die Zauberschmiede
db.db.prepare('UPDATE user_stats SET astral_dust = 500 WHERE user_id = ?').run(userId);
const craftRes = db.craftCosmetic(userId, 'table_skin', 'tavern_wood');
assert(craftRes.success, 'Zauberschmiede Schmieden fehlgeschlagen: ' + (craftRes.error || ''));
assert.strictEqual(craftRes.newDustBalance, 500 - RARITY_CONFIG.rare.dustCost);

// Rüste den geschmiedeten Tisch aus
const equipTableRes = db.equipCosmetic(userId, 'table_skin', 'tavern_wood');
assert(equipTableRes.success, 'Tisch ausrüsten fehlgeschlagen');
assert.strictEqual(equipTableRes.user.equipped_table_skin, 'tavern_wood');

// Rüste einen freigeschalteten Rahmen aus (z. B. default 'none' oder geschmiedeten)
const equipFrameRes = db.equipCosmetic(userId, 'avatar_frame', 'none');
assert(equipFrameRes.success, 'Rahmen ausrüsten fehlgeschlagen');
assert.strictEqual(equipFrameRes.user.equipped_avatar_frame, 'none');

// Teste Blockade: Nicht besessenes Item darf nicht ausgerüstet werden
const unownedEquip = db.equipCosmetic(userId, 'avatar_frame', 'void_crystal');
assert.strictEqual(unownedEquip.success, false, 'Unbesessene Kosmetika dürfen nicht ausgerüstet werden');

// Teste wöchentliche Meilensteine
db.db.prepare('UPDATE user_stats SET weekly_matches_played = 5 WHERE user_id = ?').run(userId);
const claimRes = db.claimWeeklyMilestone(userId, 'weekly_games_3');
assert(claimRes.success, 'Meilenstein einfordern fehlgeschlagen: ' + (claimRes.error || ''));
assert(claimRes.claimedMilestones.includes('weekly_games_3'));

// Zweites Einfordern desselben Meilensteins muss geblockt werden
const duplicateClaim = db.claimWeeklyMilestone(userId, 'weekly_games_3');
assert.strictEqual(duplicateClaim.success, false, 'Doppeltes Einfordern muss geblockt werden');

db.closeDatabase();
console.log('✓ Alle SQLite Kosmetik- & Progressionsmethoden erfolgreich validiert.');

// 5. REST ROUTEN & FRONTEND INTEGRATIONS-CHECK
console.log('[5/5] Überprüfe REST API Deklarationen & Frontend Hooks...');
const serverCode = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');
assert(serverCode.includes("app.get('/api/vault/state'"), 'GET /api/vault/state Route fehlt');
assert(serverCode.includes("app.post('/api/vault/open-chest'"), 'POST /api/vault/open-chest Route fehlt');
assert(serverCode.includes("app.post('/api/vault/equip'"), 'POST /api/vault/equip Route fehlt');
assert(serverCode.includes("app.post('/api/vault/craft'"), 'POST /api/vault/craft Route fehlt');
assert(serverCode.includes("app.post('/api/vault/claim-milestone'"), 'POST /api/vault/claim-milestone Route fehlt');
assert(serverCode.includes("progression:matchSummary"), 'progression:matchSummary Event fehlt im Server');

const clientCode = fs.readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');
assert(clientCode.includes("const WizardVault ="), 'WizardVault Modul fehlt in client.js');
assert(clientCode.includes("WizardVault.init();"), 'WizardVault.init() Aufruf fehlt in client.js');
assert(clientCode.includes("applyTableSkin"), 'applyTableSkin Funktion fehlt in client.js');
assert(clientCode.includes("updateVaultBadgeCount"), 'updateVaultBadgeCount Funktion fehlt in client.js');

const htmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
assert(htmlCode.includes('id="vault-modal"'), 'Schatzkammer-Modal fehlt in index.html');
assert(htmlCode.includes('id="progression-modal"'), 'Progression-Modal fehlt in index.html');
assert(htmlCode.includes('id="btnOpenVault"'), 'Lobby Header Vault Button fehlt in index.html');
assert(htmlCode.includes('id="waiting-vault-toggle"'), 'Warteraum Vault Button fehlt in index.html');
assert(htmlCode.includes('table-skin-tavern_wood'), 'CSS für Tisch-Skins fehlt in index.html');
assert(htmlCode.includes('frame-dragon_fire'), 'CSS für Avatar-Rahmen fehlt in index.html');

console.log('✓ REST Routen, Socket Events & Frontend Markup vollständig integriert.');
console.log('--- TESTSUITE: SCHATZKAMMER & PROGRESSION (ETAPPE 6) BESTANDEN! ---');
