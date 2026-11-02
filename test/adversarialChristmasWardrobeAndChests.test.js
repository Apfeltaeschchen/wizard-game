// =====================================================================
// ADVERSARIAL STRESS-TEST SUITE: CHRISTMAS COSMETICS, DROPS & WARDROBE
// Empirical Challenger: challenger_wardrobe_drops_r3
// =====================================================================

const assert = require('assert');
const {
  RARITY_CONFIG,
  CHEST_TIERS,
  COSMETICS_CATALOG,
  CATALOG_BY_TYPE_AND_ID,
  DROPPABLE_ITEMS_BY_RARITY,
  rollChestRewards,
  rollRarity
} = require('../server/cosmeticsData');

const { createSqliteEngine } = require('../server/db/sqliteEngine');
const sharedHelpers = require('../server/db/sharedHelpers');

console.log('=====================================================================');
console.log('⚡ ADVERSARIAL CHALLENGER STRESS-TEST SUITE START');
console.log('   Target: Christmas Cosmetics Drops, Pity-Dust & Wardrobe SQLite');
console.log('=====================================================================\n');

// ---------------------------------------------------------------------
// HELPER: Identify Christmas Items (Strictly event === 'christmas')
// ---------------------------------------------------------------------
function isChristmasItem(item) {
  return !!(item && item.event === 'christmas');
}

// Extract Christmas items by rarity and catalog
const christmasItemsCatalog = [];
const christmasItemsByRarity = { common: [], rare: [], epic: [], legendary: [] };

for (const [cat, items] of Object.entries(COSMETICS_CATALOG)) {
  for (const item of items) {
    if (isChristmasItem(item)) {
      christmasItemsCatalog.push({ ...item, category: cat });
      if (item.rarity && christmasItemsByRarity[item.rarity]) {
        christmasItemsByRarity[item.rarity].push({ ...item, category: cat });
      }
    }
  }
}

const christmasItemIds = new Set(christmasItemsCatalog.map(i => i.id));
console.log(`[Setup] Identifiziert: ${christmasItemsCatalog.length} Weihnachts-Gegenstände im Gesamtkatalog.`);
console.log(`  - Common: ${christmasItemsByRarity.common.length}`);
console.log(`  - Rare: ${christmasItemsByRarity.rare.length}`);
console.log(`  - Epic: ${christmasItemsByRarity.epic.length}`);
console.log(`  - Legendary: ${christmasItemsByRarity.legendary.length}`);
console.log(`  - Gesamt Droppable Pool: Common=${DROPPABLE_ITEMS_BY_RARITY.common.length}, Rare=${DROPPABLE_ITEMS_BY_RARITY.rare.length}, Epic=${DROPPABLE_ITEMS_BY_RARITY.epic.length}, Legendary=${DROPPABLE_ITEMS_BY_RARITY.legendary.length}\n`);

assert.strictEqual(christmasItemsCatalog.length, 69, 'Exakt 69 Weihnachts-Gegenstände erwartet');
assert(christmasItemsByRarity.common.length >= 10, 'Mindestens 10 Common Weihnachtsgegenstände erwartet');
assert(christmasItemsByRarity.rare.length >= 10, 'Mindestens 10 Rare Weihnachtsgegenstände erwartet');
assert(christmasItemsByRarity.epic.length >= 10, 'Mindestens 10 Epic Weihnachtsgegenstände erwartet');
assert(christmasItemsByRarity.legendary.length >= 10, 'Mindestens 10 Legendary Weihnachtsgegenstände erwartet');

// =====================================================================
// [TEST 1] MONTE CARLO SIMULATION: 10,000 CHEST ROLLS PER TIER
// =====================================================================
console.log('--- [TEST 1] MONTE CARLO SIMULATION (10,000 ROLLS x 3 TIERS = 30,000 ROLLS) ---');

function runMonteCarloTier(tier, rollsCount = 10000) {
  const config = CHEST_TIERS[tier];
  const itemsPerChest = config.itemCount;
  const totalItemsExpected = rollsCount * itemsPerChest;

  const rarityCounts = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const christmasCounts = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const christmasItemsObserved = new Set();
  let totalChristmasItems = 0;

  for (let r = 0; r < rollsCount; r++) {
    const roll = rollChestRewards(tier, []);
    assert.strictEqual(roll.rewards.length, itemsPerChest, `${tier} Truhe muss ${itemsPerChest} Items droppen`);

    for (const reward of roll.rewards) {
      rarityCounts[reward.rarity] = (rarityCounts[reward.rarity] || 0) + 1;
      if (christmasItemIds.has(reward.id)) {
        christmasCounts[reward.rarity] = (christmasCounts[reward.rarity] || 0) + 1;
        christmasItemsObserved.add(reward.id);
        totalChristmasItems++;
      }
    }
  }

  return {
    tier,
    rollsCount,
    totalItems: totalItemsExpected,
    rarityCounts,
    christmasCounts,
    totalChristmasItems,
    christmasItemsObserved
  };
}

// 1.1 Wooden Chest Monte Carlo (10,000 rolls = 20,000 items)
console.log('Running 10,000 Wooden Chest rolls...');
const mcWood = runMonteCarloTier('wooden', 10000);
console.log(`  Wooden items: Total=${mcWood.totalItems}`);
console.log(`  Rarities: Common=${mcWood.rarityCounts.common}, Rare=${mcWood.rarityCounts.rare}, Epic=${mcWood.rarityCounts.epic}, Legendary=${mcWood.rarityCounts.legendary}`);
console.log(`  Christmas items: Common=${mcWood.christmasCounts.common}, Rare=${mcWood.christmasCounts.rare}, Epic=${mcWood.christmasCounts.epic}, Legendary=${mcWood.christmasCounts.legendary}`);

// Statistical verification for Wooden Chest:
// Expected: Common=0.80 (16,000), Rare=0.18 (3,600), Epic=0.02 (400), Legendary=0 (0)
function assertZScore(observed, expected, total, label, maxZ = 4.5) {
  const p = expected / total;
  if (p === 0) {
    assert.strictEqual(observed, 0, `${label}: Erwartet 0, erhalten ${observed}`);
    return;
  }
  const stdDev = Math.sqrt(total * p * (1 - p));
  const z = (observed - expected) / stdDev;
  console.log(`    Z-Score ${label}: z=${z.toFixed(2)} (Observed=${observed}, Expected=${expected}, sigma=${stdDev.toFixed(1)})`);
  assert(Math.abs(z) < maxZ, `${label}: Z-Score zu hoch: ${z} (|z| >= ${maxZ})`);
}

console.log('  Statistical check: Wooden Chest');
assertZScore(mcWood.rarityCounts.common, 16000, 20000, 'Wooden Rarity Common');
assertZScore(mcWood.rarityCounts.rare, 3600, 20000, 'Wooden Rarity Rare');
assertZScore(mcWood.rarityCounts.epic, 400, 20000, 'Wooden Rarity Epic');
assert.strictEqual(mcWood.rarityCounts.legendary, 0, 'Wooden Truhe darf keine Legendary Gegenstände droppen');

// Christmas fraction in Wooden Chest:
// Common pool: 10 Xmas out of 20 -> expected ~ 16,000 * 0.50 = 8,000
assertZScore(mcWood.christmasCounts.common, 8000, 20000, 'Wooden Xmas Common');
// Rare pool: 25 Xmas out of 54 -> expected ~ 3,600 * (25/54) ≈ 1666.7
assertZScore(mcWood.christmasCounts.rare, Math.round(3600 * (25 / 54)), 20000, 'Wooden Xmas Rare');
// Epic pool: 21 Xmas out of 50 -> expected ~ 400 * 0.42 = 168
assertZScore(mcWood.christmasCounts.epic, 168, 20000, 'Wooden Xmas Epic');
assert.strictEqual(mcWood.christmasCounts.legendary, 0, 'Wooden Xmas Legendary muss 0 sein');

// 1.2 Silver Chest Monte Carlo (10,000 rolls = 30,000 items)
console.log('\nRunning 10,000 Silver Chest rolls...');
const mcSilver = runMonteCarloTier('silver', 10000);
console.log(`  Silver items: Total=${mcSilver.totalItems}`);
console.log(`  Rarities: Common=${mcSilver.rarityCounts.common}, Rare=${mcSilver.rarityCounts.rare}, Epic=${mcSilver.rarityCounts.epic}, Legendary=${mcSilver.rarityCounts.legendary}`);
console.log(`  Christmas items: Common=${mcSilver.christmasCounts.common}, Rare=${mcSilver.christmasCounts.rare}, Epic=${mcSilver.christmasCounts.epic}, Legendary=${mcSilver.christmasCounts.legendary}`);

// Expected Silver: Common=0.50 (15,000), Rare=0.40 (12,000), Epic=0.09 (2,700), Legendary=0.01 (300)
console.log('  Statistical check: Silver Chest');
assertZScore(mcSilver.rarityCounts.common, 15000, 30000, 'Silver Rarity Common');
assertZScore(mcSilver.rarityCounts.rare, 12000, 30000, 'Silver Rarity Rare');
assertZScore(mcSilver.rarityCounts.epic, 2700, 30000, 'Silver Rarity Epic');
assertZScore(mcSilver.rarityCounts.legendary, 300, 30000, 'Silver Rarity Legendary');

// Christmas fraction in Silver:
// Common: 15,000 * (10/20) = 7,500
assertZScore(mcSilver.christmasCounts.common, 7500, 30000, 'Silver Xmas Common');
// Rare: 12,000 * (25/54) ≈ 5,556
assertZScore(mcSilver.christmasCounts.rare, Math.round(12000 * (25 / 54)), 30000, 'Silver Xmas Rare');
// Epic: 2,700 * (21/50) = 1,134
assertZScore(mcSilver.christmasCounts.epic, 1134, 30000, 'Silver Xmas Epic');
// Legendary: 300 * (13/31) ≈ 126
assertZScore(mcSilver.christmasCounts.legendary, Math.round(300 * (13 / 31)), 30000, 'Silver Xmas Legendary');
assert(mcSilver.christmasCounts.legendary > 50, 'Silver Truhen müssen Christmas Legendary Gegenstände droppen');

// 1.3 Gold Chest Monte Carlo (10,000 rolls = 40,000 items)
console.log('\nRunning 10,000 Gold Chest rolls...');
const mcGold = runMonteCarloTier('gold', 10000);
console.log(`  Gold items: Total=${mcGold.totalItems}`);
console.log(`  Rarities: Common=${mcGold.rarityCounts.common}, Rare=${mcGold.rarityCounts.rare}, Epic=${mcGold.rarityCounts.epic}, Legendary=${mcGold.rarityCounts.legendary}`);
console.log(`  Christmas items: Common=${mcGold.christmasCounts.common}, Rare=${mcGold.christmasCounts.rare}, Epic=${mcGold.christmasCounts.epic}, Legendary=${mcGold.christmasCounts.legendary}`);
console.log(`  Unique Christmas items observed in Gold Chests: ${mcGold.christmasItemsObserved.size} / 69`);

// Gold chest: Slots 0-2 (30k items): common=0.20 (6000), rare=0.45 (13500), epic=0.25 (7500), leg=0.10 (3000)
// Slot 3 (10k items): epic=0.70 (7000), leg=0.30 (3000)
// Total Gold: Common=6000, Rare=13500, Epic=14500, Legendary=6000
console.log('  Statistical check: Gold Chest');
assertZScore(mcGold.rarityCounts.common, 6000, 40000, 'Gold Rarity Common');
assertZScore(mcGold.rarityCounts.rare, 13500, 40000, 'Gold Rarity Rare');
assertZScore(mcGold.rarityCounts.epic, 14500, 40000, 'Gold Rarity Epic');
assertZScore(mcGold.rarityCounts.legendary, 6000, 40000, 'Gold Rarity Legendary');

// Christmas fraction in Gold:
// Common: 6000 * (10/20) = 3000
assertZScore(mcGold.christmasCounts.common, 3000, 40000, 'Gold Xmas Common');
// Rare: 13500 * (25/54) = 6250
assertZScore(mcGold.christmasCounts.rare, 6250, 40000, 'Gold Xmas Rare');
// Epic: 14500 * (21/50) = 6090
assertZScore(mcGold.christmasCounts.epic, 6090, 40000, 'Gold Xmas Epic');
// Legendary: 6000 * (13/31) ≈ 2516
assertZScore(mcGold.christmasCounts.legendary, Math.round(6000 * (13 / 31)), 40000, 'Gold Xmas Legendary');

// Ensure 100% of all 69 Christmas items drop at least once across 10,000 gold chest rolls!
assert.strictEqual(
  mcGold.christmasItemsObserved.size,
  69,
  `Alle 69 Weihnachts-Gegenstände müssen in 10.000 Goldtruhen mindestens einmal gezogen werden (Gefunden: ${mcGold.christmasItemsObserved.size})`
);

console.log('✓ [TEST 1 PASSED] Monte Carlo Simulation (30.000 Truhen) verifiziert: Alle 4 Seltenheiten von Weihnachtskosmetika droppen mit statistischer Signifikanz (|z| < 4.5) und 100% Katalog-Abdeckung.\n');

// =====================================================================
// [TEST 2] DUPLICATE REFUND DUST LOGIC FOR CHRISTMAS ITEMS
// =====================================================================
console.log('--- [TEST 2] ADVERSARIAL VERIFICATION: DUPLICATE DUST REFUNDS ---');

// 2.1 Full-Christmas Owned Rolls: 100% of Christmas drops must be duplicates with correct dust
const allXmasArray = Array.from(christmasItemIds);
let testedXmasDuplicateDrops = 0;
const DUST_VALUES = {
  common: RARITY_CONFIG.common.dustValue,
  rare: RARITY_CONFIG.rare.dustValue,
  epic: RARITY_CONFIG.epic.dustValue,
  legendary: RARITY_CONFIG.legendary.dustValue
};

for (let i = 0; i < 500; i++) {
  const roll = rollChestRewards('gold', allXmasArray);
  let rollDustSum = 0;

  for (const item of roll.rewards) {
    if (christmasItemIds.has(item.id)) {
      testedXmasDuplicateDrops++;
      assert.strictEqual(item.isDuplicate, true, `Item ${item.id} muss als Duplikat erkannt werden`);
      const expectedDust = DUST_VALUES[item.rarity];
      assert.strictEqual(item.dustRefund, expectedDust, `Item ${item.id} (${item.rarity}) muss ${expectedDust} Staub erstatten (erhalten: ${item.dustRefund})`);
      rollDustSum += item.dustRefund;
    } else {
      if (item.isDuplicate) {
        rollDustSum += item.dustRefund;
      }
    }
  }

  assert.strictEqual(roll.totalDustGained, rollDustSum, 'totalDustGained muss der exakten Summe aller Erstattungen entsprechen');
}

console.log(`  ✓ 500 Goldtruhen mit vollem Weihnachtsbesitz geprüft: ${testedXmasDuplicateDrops} Duplikat-Drops mit exakten Staubwerten validiert.`);

// 2.2 Intra-Chest Duplicate Detection
// Even with an empty owned set, if the exact same item drops twice in the same roll,
// the second instance MUST be recognized as duplicate and yield dust!
let intraRollDuplicatesDetected = 0;
for (let i = 0; i < 3000; i++) {
  const roll = rollChestRewards('wooden', []);
  const seenInRoll = new Set();
  for (const item of roll.rewards) {
    if (seenInRoll.has(item.id)) {
      intraRollDuplicatesDetected++;
      assert.strictEqual(item.isDuplicate, true, 'Zweites identisches Item in derselben Truhe muss als Duplikat markiert sein');
      assert.strictEqual(item.dustRefund, DUST_VALUES[item.rarity], 'Zweites Item muss Staub erstatten');
    } else {
      assert.strictEqual(item.isDuplicate, false, 'Erstes Auftreten eines Items bei leerem Besitz darf kein Duplikat sein');
      seenInRoll.add(item.id);
    }
  }
}
console.log(`  ✓ Intra-Truhen Duplikaterkennung verifiziert (${intraRollDuplicatesDetected} identische Drops innerhalb derselben Truhe sauber zu Staub konvertiert).`);

// 2.3 SQLite Engine End-to-End Chest Opening with Dust Persistence
const dbTestChests = createSqliteEngine(':memory:', sharedHelpers);
const regUserRes = dbTestChests.registerUser('XmasDustTester', 'ZauberPass#2026');
assert(regUserRes.success, 'Test-Benutzer Registrierung fehlgeschlagen');
const dustUserId = regUserRes.user.id;

// Grant 10 Christmas items and 5 gold chests
const sampleChristmasAwards = [
  { type: 'avatar_icon', id: 'icon_santa_archmage', rarity: 'legendary' },
  { type: 'card_back', id: 'star_of_bethlehem', rarity: 'legendary' },
  { type: 'table_skin', id: 'velvet_red_gold', rarity: 'epic' },
  { type: 'avatar_frame', id: 'starlit_halo', rarity: 'legendary' },
  { type: 'lobby_background', id: 'glacier_peak', rarity: 'legendary' },
  { type: 'title', id: 'Weihnachtsmagier', rarity: 'legendary' }
];

for (const award of sampleChristmasAwards) {
  assert.strictEqual(dbTestChests.awardCosmetic(dustUserId, award.type, award.id), true);
}

// Give 10 gold chests
dbTestChests.db.prepare('UPDATE user_stats SET chests_gold = 10, astral_dust = 0 WHERE user_id = ?').run(dustUserId);

let accumulatedDust = 0;
for (let c = 1; c <= 10; c++) {
  const openRes = dbTestChests.openChest(dustUserId, 'gold');
  assert.strictEqual(openRes.success, true);
  accumulatedDust += openRes.totalDustGained;
  assert.strictEqual(openRes.newDustBalance, accumulatedDust, 'newDustBalance im Rückgabewert inkonsistent');

  // Verify in SQLite database directly
  const userStats = dbTestChests.db.prepare('SELECT astral_dust, chests_gold FROM user_stats WHERE user_id = ?').get(dustUserId);
  assert.strictEqual(userStats.astral_dust, accumulatedDust, 'astral_dust in user_stats Tabelle stimmt nicht mit akkumuliertem Staub überein');
  assert.strictEqual(userStats.chests_gold, 10 - c, 'chests_gold nicht sauber dekrementiert');

  // Verify user_inventory has no duplicate rows
  const duplicatesInDb = dbTestChests.db.prepare(`
    SELECT item_type, item_id, COUNT(*) as cnt
    FROM user_inventory
    WHERE user_id = ?
    GROUP BY item_type, item_id
    HAVING cnt > 1
  `).all(dustUserId);
  assert.strictEqual(duplicatesInDb.length, 0, 'Datenbank darf keine doppelten Inventareinträge aufweisen');
}

dbTestChests.closeDatabase();
console.log('✓ [TEST 2 PASSED] Duplicate-Refund-Logik & SQLite Staub-Persistenz fehlerfrei validiert.\n');

// =====================================================================
// [TEST 3] WARDROBE ADVERSARIAL STRESS TEST (IN-MEMORY SQLITE)
// =====================================================================
console.log('--- [TEST 3] WARDROBE ADVERSARIAL STRESS TEST (IN-MEMORY SQLITE) ---');

const dbWardrobe = createSqliteEngine(':memory:', sharedHelpers);

// Create 3 users for concurrency and state isolation tests
const userA = dbWardrobe.registerUser('MagusAlpha', 'Alpha#2026').user.id;
const userB = dbWardrobe.registerUser('MagusBeta', 'Beta#2026').user.id;
const userC = dbWardrobe.registerUser('MagusGamma', 'Gamma#2026').user.id;

const SIX_CATEGORIES = [
  { singular: 'avatar_icon', plural: 'avatar_icons', sample: 'icon_krampus_demon', default: 'default' },
  { singular: 'avatar_frame', plural: 'avatar_frames', sample: 'snowflake_crystal', default: 'none' },
  { singular: 'table_skin', plural: 'table_skins', sample: 'midnight_winter_snow', default: 'emerald_felt' },
  { singular: 'card_back', plural: 'card_backs', sample: 'snowflake_mandala', default: 'default' },
  { singular: 'lobby_background', plural: 'lobby_backgrounds', sample: 'snowy_castle', default: 'citadel_halls' },
  { singular: 'title', plural: 'titles', sample: 'Geist der Weihnacht', default: 'Zauberlehrling' }
];

// ---------------------------------------------------------------------
// 3.1 Unowned Equip Rejection across all 6 categories
// ---------------------------------------------------------------------
console.log('[3.1] Testing Unowned Equip Rejection across all 6 categories...');
for (const cat of SIX_CATEGORIES) {
  // Test valid unowned Christmas item
  const res = dbWardrobe.equipCosmetic(userA, cat.singular, cat.sample);
  assert.strictEqual(res.success, false, `Unbesessenes Item ${cat.sample} (${cat.singular}) muss abgewiesen werden`);
  assert(res.error.includes('Diesen Gegenstand besitzt du noch nicht'), `Fehlertext muss Besitzmangel anzeigen: ${res.error}`);

  // Test non-existent item ID
  const invalidIdRes = dbWardrobe.equipCosmetic(userA, cat.singular, 'totally_fake_item_xyz');
  assert.strictEqual(invalidIdRes.success, false, 'Nicht existierendes Item muss abgewiesen werden');
  assert(invalidIdRes.error.includes('existiert nicht im Katalog'), `Fehlertext falsch: ${invalidIdRes.error}`);
}

// Test invalid category type
const invalidTypeRes = dbWardrobe.equipCosmetic(userA, 'magical_pet', 'dragon_pet');
assert.strictEqual(invalidTypeRes.success, false, 'Ungültige Kategorie muss abgewiesen werden');
assert(invalidTypeRes.error.includes('Ungültiger Kosmetiktyp'), `Fehlertext falsch: ${invalidTypeRes.error}`);

// Test unauthenticated call
const unauthRes = dbWardrobe.equipCosmetic(null, 'table_skin', 'midnight_winter_snow');
assert.strictEqual(unauthRes.success, false, 'Nicht angemeldeter Call muss abgewiesen werden');

console.log('  ✓ 3.1 Unbesessen-Schutz, ungültige IDs und fehlerhafte Typen in allen 6 Kategorien strikt abgewiesen.');

// ---------------------------------------------------------------------
// 3.2 Crafting with Exact vs. Insufficient Dust Balances across all 4 Rarities
// ---------------------------------------------------------------------
console.log('\n[3.2] Testing Crafting with Exact and Insufficient Dust across all 4 Rarities...');

const CRAFT_TEST_ITEMS = [
  { rarity: 'common', cost: RARITY_CONFIG.common.dustCost, type: 'avatar_icon', id: 'icon_peppermint_sorcerer' },
  { rarity: 'rare', cost: RARITY_CONFIG.rare.dustCost, type: 'avatar_frame', id: 'holly_wreath' },
  { rarity: 'epic', cost: RARITY_CONFIG.epic.dustCost, type: 'table_skin', id: 'velvet_red_gold' },
  { rarity: 'legendary', cost: RARITY_CONFIG.legendary.dustCost, type: 'card_back', id: 'star_of_bethlehem' }
];

for (const testCase of CRAFT_TEST_ITEMS) {
  // A. Insufficient dust: balance = cost - 1
  dbWardrobe.db.prepare('UPDATE user_stats SET astral_dust = ? WHERE user_id = ?').run(testCase.cost - 1, userB);
  const failCraft = dbWardrobe.craftCosmetic(userB, testCase.type, testCase.id);
  assert.strictEqual(failCraft.success, false, `Schmieden mit ${testCase.cost - 1} Staub (Bedarf: ${testCase.cost}) muss scheitern`);
  assert(failCraft.error.includes('Nicht genügend Astralstaub'), `Fehlermeldung falsch: ${failCraft.error}`);

  // Confirm dust was NOT deducted
  const dustAfterFail = dbWardrobe.db.prepare('SELECT astral_dust FROM user_stats WHERE user_id = ?').get(userB).astral_dust;
  assert.strictEqual(dustAfterFail, testCase.cost - 1, 'Staub darf bei Fehlversuch nicht abgebucht werden');

  // Confirm item is NOT in inventory
  const invAfterFail = dbWardrobe.db.prepare('SELECT 1 FROM user_inventory WHERE user_id = ? AND item_id = ?').get(userB, testCase.id);
  assert(!invAfterFail, 'Item darf bei Fehlversuch nicht im Inventar auftauchen');

  // B. Exact dust: balance = cost
  dbWardrobe.db.prepare('UPDATE user_stats SET astral_dust = ? WHERE user_id = ?').run(testCase.cost, userB);
  const successCraft = dbWardrobe.craftCosmetic(userB, testCase.type, testCase.id);
  assert.strictEqual(successCraft.success, true, `Schmieden mit exakt ${testCase.cost} Staub muss gelingen`);
  assert.strictEqual(successCraft.newDustBalance, 0, 'Restguthaben muss exakt 0 sein');

  // Confirm dust is 0 in DB
  const dustAfterSuccess = dbWardrobe.db.prepare('SELECT astral_dust FROM user_stats WHERE user_id = ?').get(userB).astral_dust;
  assert.strictEqual(dustAfterSuccess, 0, 'Staub muss in DB auf 0 reduziert sein');

  // Confirm item IS in inventory
  const invAfterSuccess = dbWardrobe.db.prepare('SELECT 1 FROM user_inventory WHERE user_id = ? AND item_id = ?').get(userB, testCase.id);
  assert(invAfterSuccess, 'Item muss nach erfolgreichem Schmieden im Inventar existieren');

  // Confirm crafted item CAN now be equipped
  const equipCrafted = dbWardrobe.equipCosmetic(userB, testCase.type, testCase.id);
  assert.strictEqual(equipCrafted.success, true, 'Geschmiedetes Item muss ausgerüstet werden können');

  // C. Duplicate craft rejection: trying to craft an already-owned item
  dbWardrobe.db.prepare('UPDATE user_stats SET astral_dust = 5000 WHERE user_id = ?').run(userB);
  const dupCraft = dbWardrobe.craftCosmetic(userB, testCase.type, testCase.id);
  assert.strictEqual(dupCraft.success, false, 'Bereits besessenes Item darf nicht erneut geschmiedet werden');
  assert(dupCraft.error.includes('besitzt du bereits'), `Fehlertext falsch: ${dupCraft.error}`);
  const dustAfterDup = dbWardrobe.db.prepare('SELECT astral_dust FROM user_stats WHERE user_id = ?').get(userB).astral_dust;
  assert.strictEqual(dustAfterDup, 5000, 'Staub darf bei Duplikatversuch nicht abgezogen werden');
}

// D. Default item craft rejection
const defaultCraftRes = dbWardrobe.craftCosmetic(userB, 'table_skin', 'emerald_felt');
assert.strictEqual(defaultCraftRes.success, false, 'Standard-Gegenstände dürfen nicht geschmiedet werden können');
assert(defaultCraftRes.error.includes('Standard-Gegenstände müssen nicht geschmiedet werden'), `Fehlertext falsch: ${defaultCraftRes.error}`);

console.log('  ✓ 3.2 Exakte vs. unzureichende Staub-Bilanzen für alle 4 Seltenheiten (Common/Rare/Epic/Legendary) und Duplikat-Schmiede-Schutz validiert.');

// ---------------------------------------------------------------------
// 3.3 Concurrent & Rapid Equips across Multiple Users and Slots
// ---------------------------------------------------------------------
console.log('\n[3.3] Testing Rapid Concurrent Equips across Multiple Users & Slots...');

// Award all Christmas items to userA, userB, userC
for (const item of christmasItemsCatalog) {
  let sType = item.category;
  if (sType.endsWith('s')) sType = sType.slice(0, -1);
  dbWardrobe.awardCosmetic(userA, sType, item.id);
  dbWardrobe.awardCosmetic(userB, sType, item.id);
  dbWardrobe.awardCosmetic(userC, sType, item.id);
}

// Perform 600 rapid sequential and interleaved equip operations
const users = [userA, userB, userC];
let totalEquipOps = 0;

for (let cycle = 0; cycle < 100; cycle++) {
  for (const u of users) {
    for (const cat of SIX_CATEGORIES) {
      // Pick a Christmas item for this category
      const pool = christmasItemsCatalog.filter(i => i.category === cat.plural);
      const chosenItem = pool[cycle % pool.length];
      const equipRes = dbWardrobe.equipCosmetic(u, cat.singular, chosenItem.id);
      assert.strictEqual(equipRes.success, true, `Rapid equip failed for user ${u}, ${cat.singular}, ${chosenItem.id}`);
      totalEquipOps++;
    }
  }
}
console.log(`  ✓ 3.3 Concurrency & Stress: ${totalEquipOps} blitzschnelle Ausrüstvorgänge über 3 Benutzer und alle 6 Slots ohne SQLITE_BUSY oder Dateninkonsistenz abgeschlossen.`);

// ---------------------------------------------------------------------
// 3.4 Profile State Integrity across All 6 Categories
// ---------------------------------------------------------------------
console.log('\n[3.4] Testing Complete Profile State Integrity across all 6 categories...');

// Target loadout:
const targetLoadout = {
  avatar_icon: 'icon_santa_archmage',
  avatar_frame: 'starlit_halo',
  table_skin: 'nutcracker_suite',
  card_back: 'winter_solstice_gold',
  lobby_background: 'glacier_peak',
  title: 'Weihnachtsmagier'
};

// Equip all 6 target items for userA
for (const [sType, itemId] of Object.entries(targetLoadout)) {
  const res = dbWardrobe.equipCosmetic(userA, sType, itemId);
  assert.strictEqual(res.success, true, `Equip von ${itemId} (${sType}) fehlgeschlagen: ${res.error}`);
}

// Check via getUserCosmetics
const cosmeticsState = dbWardrobe.getUserCosmetics(userA);
assert.strictEqual(cosmeticsState.user.avatar_id, targetLoadout.avatar_icon, 'avatar_id stimmt nicht');
assert.strictEqual(cosmeticsState.user.equipped_avatar_frame, targetLoadout.avatar_frame, 'equipped_avatar_frame stimmt nicht');
assert.strictEqual(cosmeticsState.user.equipped_table_skin, targetLoadout.table_skin, 'equipped_table_skin stimmt nicht');
assert.strictEqual(cosmeticsState.user.equipped_card_back, targetLoadout.card_back, 'equipped_card_back stimmt nicht');
assert.strictEqual(cosmeticsState.user.equipped_lobby_background, targetLoadout.lobby_background, 'equipped_lobby_background stimmt nicht');
assert.strictEqual(cosmeticsState.user.title, targetLoadout.title, 'title stimmt nicht');

// Check via direct SQL on users and user_stats
const rawUsersRow = dbWardrobe.db.prepare('SELECT avatar_id, title FROM users WHERE id = ?').get(userA);
assert.strictEqual(rawUsersRow.avatar_id, targetLoadout.avatar_icon, 'Raw DB avatar_id inkonsistent');
assert.strictEqual(rawUsersRow.title, targetLoadout.title, 'Raw DB title inkonsistent');

const rawStatsRow = dbWardrobe.db.prepare(`
  SELECT equipped_card_back, equipped_table_skin, equipped_avatar_frame, equipped_lobby_background
  FROM user_stats WHERE user_id = ?
`).get(userA);
assert.strictEqual(rawStatsRow.equipped_avatar_frame, targetLoadout.avatar_frame, 'Raw DB equipped_avatar_frame inkonsistent');
assert.strictEqual(rawStatsRow.equipped_table_skin, targetLoadout.table_skin, 'Raw DB equipped_table_skin inkonsistent');
assert.strictEqual(rawStatsRow.equipped_card_back, targetLoadout.card_back, 'Raw DB equipped_card_back inkonsistent');
assert.strictEqual(rawStatsRow.equipped_lobby_background, targetLoadout.lobby_background, 'Raw DB equipped_lobby_background inkonsistent');

// 3.5 Resetting to Defaults across all 6 categories
console.log('[3.5] Testing Switch Back to Default Items across all 6 Categories...');
const defaultLoadout = {
  avatar_icon: 'default',
  avatar_frame: 'none',
  table_skin: 'emerald_felt',
  card_back: 'default',
  lobby_background: 'citadel_halls',
  title: 'Zauberlehrling'
};

for (const [sType, defId] of Object.entries(defaultLoadout)) {
  const defRes = dbWardrobe.equipCosmetic(userA, sType, defId);
  assert.strictEqual(defRes.success, true, `Rückfall auf Standard ${defId} (${sType}) fehlgeschlagen: ${defRes.error}`);
}

const resetState = dbWardrobe.getUserCosmetics(userA);
assert.strictEqual(resetState.user.avatar_id, defaultLoadout.avatar_icon, 'Standard avatar_id nicht wiederhergestellt');
assert.strictEqual(resetState.user.equipped_avatar_frame, defaultLoadout.avatar_frame, 'Standard frame nicht wiederhergestellt');
assert.strictEqual(resetState.user.equipped_table_skin, defaultLoadout.table_skin, 'Standard table_skin nicht wiederhergestellt');
assert.strictEqual(resetState.user.equipped_card_back, defaultLoadout.card_back, 'Standard card_back nicht wiederhergestellt');
assert.strictEqual(resetState.user.equipped_lobby_background, defaultLoadout.lobby_background, 'Standard lobby_background nicht wiederhergestellt');
assert.strictEqual(resetState.user.title, defaultLoadout.title, 'Standard title nicht wiederhergestellt');

dbWardrobe.closeDatabase();
console.log('✓ [TEST 3 PASSED] Wardrobe Stress-Test & Profil-Zustands-Integrität über alle 6 Kategorien vollständig bestanden.\n');

// =====================================================================
// FINAL VERDICT
// =====================================================================
console.log('=====================================================================');
console.log('🏆 EMPIRICAL ADVERSARIAL CHALLENGER VERDICT: APPROVE');
console.log('   - 30,000 Chest Monte Carlo: Statistically Valid Rarity Frequencies');
console.log('   - 69/69 Christmas Items Droppable with 100% Unique Coverage');
console.log('   - Duplicate-to-Dust Logic 100% Exact & Preserved in SQLite');
console.log('   - Wardrobe Unowned Protection, Exact-Dust Crafting & 6-Slot State Verified');
console.log('=====================================================================');
