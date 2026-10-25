// =====================================================================
// GRIMOIRE ONLINE - KOSMETIK-KATALOG, LOOTBOX-DROPS & LEVEL-PROGRESSION
// Etappe 6: Magische Schatztruhen & Overwatch-2-Style Progression
// =====================================================================

const RARITY_CONFIG = {
  common: { name: 'Gewöhnlich', color: '#e2e8f0', dustValue: 15, dustCost: 60 },
  rare: { name: 'Selten', color: '#38bdf8', dustValue: 40, dustCost: 160 },
  epic: { name: 'Episch', color: '#c084fc', dustValue: 120, dustCost: 480 },
  legendary: { name: 'Legendär', color: '#fbbf24', dustValue: 400, dustCost: 1200 }
};

const CHEST_TIERS = {
  wooden: {
    name: 'Holztruhe des Lehrlings',
    icon: '🪵',
    itemCount: 2,
    rarityChances: { common: 0.80, rare: 0.18, epic: 0.02, legendary: 0.00 }
  },
  silver: {
    name: 'Silberne Magiertruhe',
    icon: '🥈',
    itemCount: 3,
    rarityChances: { common: 0.50, rare: 0.40, epic: 0.09, legendary: 0.01 }
  },
  gold: {
    name: 'Goldene Erzmagier-Kassette',
    icon: '👑',
    itemCount: 4,
    rarityChances: { common: 0.20, rare: 0.45, epic: 0.25, legendary: 0.10 }
  }
};

const COSMETICS_CATALOG = {
  avatar_icons: [
    // Standard-Avatare
    { id: 'wizard_blue', name: 'Blauer Magier', rarity: 'common', isDefault: true, image: '/images/avatars/wizard_blue.svg' },
    { id: 'wizard_red', name: 'Roter Pyromant', rarity: 'common', isDefault: true, image: '/images/avatars/wizard_red.svg' },
    { id: 'wizard_green', name: 'Grüner Druide', rarity: 'common', isDefault: true, image: '/images/avatars/wizard_green.svg' },
    { id: 'wizard_purple', name: 'Violetter Arkanist', rarity: 'common', isDefault: true, image: '/images/avatars/wizard_purple.svg' },
    { id: 'wizard_gold', name: 'Goldener Sonnenmeister', rarity: 'common', isDefault: true, image: '/images/avatars/wizard_gold.svg' },
    { id: 'wizard_dark', name: 'Dunkler Schattenmagier', rarity: 'common', isDefault: true, image: '/images/avatars/wizard_dark.svg' },

    // Freischaltbare Artworks (via image-generator)
    { id: 'icon_pyromancer', name: 'Flammen-Erzmagier', rarity: 'epic', image: '/images/avatars/icon_pyromancer.png', lore: 'Gebieter über die sengende Glut der Zitadelle.' },
    { id: 'icon_moon_witch', name: 'Mondhexe', rarity: 'epic', image: '/images/avatars/icon_moon_witch.png', lore: 'Hüterin der silbernen Mondsichel und der Gezeitengeheimnisse.' },
    { id: 'icon_jester', name: 'Scharlatan', rarity: 'rare', image: '/images/avatars/icon_jester.png', lore: 'Keiner weiß, wer hinter der lächelnden Porzellanmaske steckt.' },
    { id: 'icon_dragon', name: 'Lindwurm', rarity: 'legendary', image: '/images/avatars/icon_dragon.png', lore: 'Ein Furcht einflößendes Relikt aus dem Zeitalter des Feuers.' },
    { id: 'icon_forest_nymph', name: 'Waldnymphe', rarity: 'rare', image: '/images/avatars/icon_forest_nymph.png', lore: 'Geboren aus uraltem Moos und leuchtendem Feenstaub.' },
    { id: 'icon_necromancer', name: 'Nekromant', rarity: 'rare', image: '/images/avatars/icon_necromancer.png', lore: 'Spricht im Flüsterton mit den Seelen verblichener Kartenspieler.' },
    { id: 'icon_vampire', name: 'Vampir-Graf', rarity: 'epic', image: '/images/avatars/icon_vampire.png', lore: 'Ein edler Aristokrat aus den finsteren Gewölben der Nacht.' },
    { id: 'icon_seer', name: 'Astralseherin', rarity: 'legendary', image: '/images/avatars/icon_seer.png', lore: 'Sieht jeden Stich voraus, noch bevor das Deck gemischt wird.' }
  ],

  card_backs: [
    { id: 'default', name: 'Zitadellen-Blau', rarity: 'common', isDefault: true, icon: '🔷', lore: 'Das klassische kobaltblaue Siegel der Zitadelle.' },
    { id: 'parchment', name: 'Uraltes Pergament', rarity: 'common', icon: '📜', lore: 'Vergilbtes Kalbsleder mit handgravierten goldenen Schutzrunen.' },
    { id: 'astral', name: 'Astral-Kosmos', rarity: 'rare', icon: '✨', lore: 'Ein mitternachtsblaues Sternenrad mit glimmenden Konstellationen.' },
    { id: 'forest', name: 'Hain der Waldnymphen', rarity: 'rare', icon: '🌿', lore: 'Lebendiges Geäst, umschlungen von leuchtendem Feenstaub.' },
    { id: 'shadow', name: 'Schattenflamme', rarity: 'epic', icon: '🔥', lore: 'Dunkler Obsidian, durchzuckt von violetten Höllenflammen.' },
    { id: 'dragon', name: 'Drachenschuppe', rarity: 'legendary', icon: '🐉', lore: 'Echte rote Lindwurmschuppen, geschmiedet im Kraterfeuer.' },
    // Halloween Spezial
    { id: 'pumpkin_king', name: 'Kürbiskönig', rarity: 'epic', icon: '🎃', lore: 'Ein furchterregender Schnitzkürbis mit feurig glühendem Dämonengrinsen.' },
    { id: 'spider_queen', name: 'Spinnenkönigin', rarity: 'rare', icon: '🕷️', lore: 'Ein filigranes violettes Spinnennetz, benetzt mit taufrischem Gift.' },
    { id: 'gravestone_runes', name: 'Grabstein-Runen', rarity: 'epic', icon: '🪦', lore: 'Verwitterter Schiefer mit uralten Totenkopf-Gravuren und Moos.' }
  ],

  table_skins: [
    { id: 'emerald_felt', name: 'Klassischer Zitadellen-Filz', rarity: 'common', isDefault: true, icon: '🟢', lore: 'Traditioneller, weicher smaragdgrüner Kartentischfilz.' },
    { id: 'tavern_wood', name: 'Rustikales Tavernen-Holz', rarity: 'rare', icon: '🪵', lore: 'Schwere Eichenbohlen mit gemütlichem Kaminfeuer-Schatten.' },
    { id: 'amethyst_crypt', name: 'Amethyst-Krypta', rarity: 'rare', icon: '🔮', lore: 'Dunkelviolette Runenplatten mit sanft pulsierendem Glanz.' },
    { id: 'volcano_keep', name: 'Vulkan-Festung', rarity: 'epic', icon: '🌋', lore: 'Pechschwarzer Basaltstein mit glühenden Magma-Adern.' },
    { id: 'astral_observatory', name: 'Sternen-Observatorium', rarity: 'legendary', icon: '🌌', lore: 'Ein kreisförmiges Observatorium unter freiem Himmelszelt.' },
    // Halloween Spezial
    { id: 'haunted_crypt', name: 'Spukhaus-Gruft', rarity: 'epic', icon: '🪦', lore: 'Ein gespenstischer Steintisch, umhüllt von kaltem Geisternebel und Spinnweben.' }
  ],

  avatar_frames: [
    { id: 'none', name: 'Schlichter Goldring', rarity: 'common', isDefault: true, icon: '⭕', lore: 'Ein dezenter polierter Messingrand.' },
    { id: 'iron_thorn', name: 'Eiserne Dornenleiste', rarity: 'common', icon: '⛓️', lore: 'Geschmiedetes Schwarzmetall mit spitzen Kanten.' },
    { id: 'silver_leaf', name: 'Silberne Lorbeerblätter', rarity: 'rare', icon: '🍃', lore: 'Ein zarter Kranz aus filigranem Elfen-Silber.' },
    { id: 'golden_runes', name: 'Leuchtende Runen-Aura', rarity: 'rare', icon: '🔆', lore: 'Kreisende arkane Symbole in warmem Sonnenlicht.' },
    { id: 'dragon_fire', name: 'Pulsierende Drachenflammen', rarity: 'epic', icon: '🔥', lore: 'Ein feuriger Kranz aus züngelnden Flammenzungen.' },
    { id: 'void_crystal', name: 'Schwebende Astralkristalle', rarity: 'legendary', icon: '💎', lore: 'Schwebende Prismen aus reinem violettem Äther.' },
    // Halloween & MVP Spezial
    { id: 'pumpkin_lantern', name: 'Kürbis-Laternen-Kranz', rarity: 'epic', icon: '🎃', lore: 'Flackernde Schnitzkürbisse und Herbstlaub umrahmen das Avatar-Medaillon.' },
    { id: 'bat_swarm', name: 'Fledermaus-Schwarm', rarity: 'rare', icon: '🦇', lore: 'Schwebende Fledermäuse und dichter violetter Spuknebel.' },
    { id: 'ghost_specter', name: 'Geisterhafte Erscheinung', rarity: 'epic', icon: '👻', lore: 'Transparente, spektrale Seelenfratzen aus der Unterwelt.' },
    { id: 'mvp_glow', name: 'Krone des Meistermagiers', rarity: 'legendary', icon: '👑', lore: 'Eine strahlende goldene Aura, die dem gekrönten MVP der Zitadelle gebührt.' }
  ],

  lobby_backgrounds: [
    { id: 'citadel_halls', name: 'Hallen der Zitadelle', rarity: 'common', isDefault: true, icon: '🏰', lore: 'Klassische, ehrwürdige Steinhallen der Zauberer-Zitadelle.' },
    { id: 'haunted_graveyard', name: 'Verfluchter Friedhof im Vollmond', rarity: 'epic', icon: '🎃', lore: 'Verwitterte Grabsteine, kriechender Nebel und grinsende Kürbislaternen.' },
    { id: 'witch_hut', name: 'Hexenhütte im Schwarzwald', rarity: 'rare', icon: '🕷️', lore: 'Ein brodelnder Hexenkessel, umflattert von Fledermäusen im dichten Dickicht.' },
    { id: 'tavern_fireplace', name: 'Kaminfeuer-Taverne', rarity: 'rare', icon: '🍺', lore: 'Rustikales Holz, behagliche Wärme und das Knistern von Eichenbalken.' },
    { id: 'astral_observatory', name: 'Sternen-Observatorium', rarity: 'epic', icon: '🌌', lore: 'Ein endloser Blick in kreisende Galaxien und glühende Sternbilder.' },
    { id: 'magma_forge', name: 'Magmaschmiede der Zwerge', rarity: 'epic', icon: '🌋', lore: 'Glühender Basaltstein und fliegende Funken aus den Tiefen des Berges.' },
    { id: 'celestial_sanctum', name: 'Himmlisches Sanktum', rarity: 'legendary', icon: '☀️', lore: 'Erhabener goldener Marmor, durchflutet von göttlichen Sonnenstrahlen.' }
  ],

  titles: [
    // Gewöhnlich (Common)
    { id: 'Zauberlehrling', name: 'Zauberlehrling', rarity: 'common', isDefault: true },
    { id: 'Kartenflüsterer', name: 'Kartenflüsterer', rarity: 'common' },
    { id: 'Novize der Akademie', name: 'Novize der Akademie', rarity: 'common' },
    { id: 'Wanderer der Nebel', name: 'Wanderer der Nebel', rarity: 'common' },
    { id: 'Der Suchende', name: 'Der Suchende', rarity: 'common' },
    { id: 'Geselle der Zitadelle', name: 'Geselle der Zitadelle', rarity: 'common' },
    { id: 'Schüler der Runen', name: 'Schüler der Runen', rarity: 'common' },
    { id: 'Kartenleger', name: 'Kartenleger', rarity: 'common' },
    { id: 'Der Geduldige', name: 'Der Geduldige', rarity: 'common' },
    { id: 'Tavernengast', name: 'Tavernengast', rarity: 'common' },

    // Selten (Rare)
    { id: 'Seher der Sterne', name: 'Seher der Sterne', rarity: 'rare' },
    { id: 'Schattenmeister', name: 'Schattenmeister', rarity: 'rare' },
    { id: 'Hüter der Flamme', name: 'Hüter der Flamme', rarity: 'rare' },
    { id: 'Gezeitenrufer', name: 'Gezeitenrufer', rarity: 'rare' },
    { id: 'Frostgeborener', name: 'Frostgeborener', rarity: 'rare' },
    { id: 'Meister der Vorhersage', name: 'Meister der Vorhersage', rarity: 'rare' },
    { id: 'Der Scharfsinnige', name: 'Der Scharfsinnige', rarity: 'rare' },
    { id: 'König der Bettler', name: 'König der Bettler', rarity: 'rare' },
    { id: 'Wolfsseele', name: 'Wolfsseele', rarity: 'rare' },
    { id: 'Freund der Feen', name: 'Freund der Feen', rarity: 'rare' },
    { id: 'Sturmbringer', name: 'Sturmbringer', rarity: 'rare' },
    { id: 'Der Unberechenbare', name: 'Der Unberechenbare', rarity: 'rare' },
    { id: 'Archivar des Rates', name: 'Archivar des Rates', rarity: 'rare' },
    { id: 'Hofmagier', name: 'Hofmagier', rarity: 'rare' },
    { id: 'Nachtmahr der Zitadelle', name: 'Nachtmahr der Zitadelle', rarity: 'rare' },
    { id: 'Geisterbeschwörer', name: 'Geisterbeschwörer', rarity: 'rare' },

    // Episch (Epic)
    { id: 'Drachenbändiger', name: 'Drachenbändiger', rarity: 'epic' },
    { id: 'Vampir-Bannmeister', name: 'Vampir-Bannmeister', rarity: 'epic' },
    { id: 'Schicksalsweber', name: 'Schicksalsweber', rarity: 'epic' },
    { id: 'Das Orakel von Avalon', name: 'Das Orakel von Avalon', rarity: 'epic' },
    { id: 'Meister der Renonce', name: 'Meister der Renonce', rarity: 'epic' },
    { id: 'Der Dreifach-Gekrönte', name: 'Der Dreifach-Gekrönte', rarity: 'epic' },
    { id: 'Phönixgeborener', name: 'Phönixgeborener', rarity: 'epic' },
    { id: 'Schattenfürst', name: 'Schattenfürst', rarity: 'epic' },
    { id: 'Großinquisitor', name: 'Großinquisitor', rarity: 'epic' },
    { id: 'Herrscher der Gezeiten', name: 'Herrscher der Gezeiten', rarity: 'epic' },
    { id: 'Die Weiße Hexe', name: 'Die Weiße Hexe', rarity: 'epic' },
    { id: 'Vollstrecker der Prophezeiung', name: 'Vollstrecker der Prophezeiung', rarity: 'epic' },
    { id: 'Kürbiskönig von Halloween', name: 'Kürbiskönig von Halloween', rarity: 'epic' },
    { id: 'Graf der Finsternis', name: 'Graf der Finsternis', rarity: 'epic' },

    // Legendär (Legendary)
    { id: 'Oberster Erzmagier', name: 'Oberster Erzmagier', rarity: 'legendary' },
    { id: 'Unantastbar', name: 'Unantastbar', rarity: 'legendary' },
    { id: 'Herrscher des Chaos', name: 'Herrscher des Chaos', rarity: 'legendary' },
    { id: 'Legende der Zitadelle', name: 'Legende der Zitadelle', rarity: 'legendary' },
    { id: 'Beherrscher der Zeit', name: 'Beherrscher der Zeit', rarity: 'legendary' },
    { id: 'Der Ewig-Wachende', name: 'Der Ewig-Wachende', rarity: 'legendary' },
    { id: 'Sonnengott von Solaria', name: 'Sonnengott von Solaria', rarity: 'legendary' },
    { id: 'Avatar des Schicksals', name: 'Avatar des Schicksals', rarity: 'legendary' },
    { id: 'Der Kopflose Reiter', name: 'Der Kopflose Reiter', rarity: 'legendary' },
    { id: 'MVP der Zitadelle', name: 'MVP der Zitadelle', rarity: 'legendary' }
  ]
};

// Hilfs-Maps für schnellen O(1) Lookup
const CATALOG_BY_TYPE_AND_ID = {};
for (const [type, items] of Object.entries(COSMETICS_CATALOG)) {
  CATALOG_BY_TYPE_AND_ID[type] = {};
  for (const item of items) {
    CATALOG_BY_TYPE_AND_ID[type][item.id] = item;
  }
}

// Flat-Pool aller ziehbaren Items (ohne Default-Items) nach Seltenheit gruppiert
const DROPPABLE_ITEMS_BY_RARITY = { common: [], rare: [], epic: [], legendary: [] };
for (const [type, items] of Object.entries(COSMETICS_CATALOG)) {
  for (const item of items) {
    if (!item.isDefault) {
      DROPPABLE_ITEMS_BY_RARITY[item.rarity].push({
        type,
        id: item.id,
        name: item.name,
        rarity: item.rarity,
        icon: item.icon || (type === 'avatar_icons' ? '👤' : '✨'),
        image: item.image || null,
        lore: item.lore || ''
      });
    }
  }
}

// Würfelt eine Seltenheit basierend auf Truhen-Wahrscheinlichkeiten
function rollRarity(rarityChances, forceMinRarity = null) {
  if (forceMinRarity === 'legendary') return 'legendary';
  if (forceMinRarity === 'epic') {
    const r = Math.random();
    return r < 0.70 ? 'epic' : 'legendary';
  }

  const rand = Math.random();
  let cumulative = 0;
  for (const [rarity, chance] of Object.entries(rarityChances)) {
    cumulative += chance;
    if (rand <= cumulative) return rarity;
  }
  return 'common';
}

// Öffnet eine Truhe und erzeugt Drops inkl. Pity-Duplicate-Staub
function rollChestRewards(chestType, ownedItems = []) {
  const config = CHEST_TIERS[chestType] || CHEST_TIERS.wooden;
  const count = config.itemCount;
  const rewards = [];
  let totalDustGained = 0;

  const ownedSet = (ownedItems instanceof Set) ? ownedItems : new Set(ownedItems);

  for (let i = 0; i < count; i++) {
    // Bei der goldenen Truhe ist das letzte Item garantiert Episch oder Legendär
    const forceRarity = (chestType === 'gold' && i === count - 1) ? 'epic' : null;
    const rarity = rollRarity(config.rarityChances, forceRarity);
    const pool = DROPPABLE_ITEMS_BY_RARITY[rarity];

    if (!pool || pool.length === 0) continue;

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const key = `${chosen.type}:${chosen.id}`;
    const isDuplicate = ownedSet.has(key) || ownedSet.has(chosen.id);
    const rarityMeta = RARITY_CONFIG[chosen.rarity] || RARITY_CONFIG.common;
    const dustRefund = isDuplicate ? rarityMeta.dustValue : 0;

    if (isDuplicate) {
      totalDustGained += dustRefund;
    } else {
      ownedSet.add(key);
      ownedSet.add(chosen.id);
    }

    rewards.push({
      type: chosen.type,
      id: chosen.id,
      name: chosen.name,
      rarity: chosen.rarity,
      rarityColor: rarityMeta.color,
      icon: chosen.icon,
      image: chosen.image,
      lore: chosen.lore,
      isDuplicate,
      dustRefund
    });
  }

  return {
    chestType,
    chestName: config.name,
    rewards,
    totalDustGained
  };
}

// XP-Berechnung nach einem Spiel (Overwatch-Style)
function calculateMatchXP(matchStats = {}) {
  const {
    roundsPlayed = 1,
    rank = 3,
    bidsHit = 0,
    isRanked = false,
    isWinner = false,
    isStreak = false
  } = matchStats;

  let xp = 100; // Teilnahme-Basis
  xp += Math.min(200, roundsPlayed * 10); // Runden-Bonus
  if (isWinner || rank === 1) xp += 150;
  else if (rank === 2) xp += 75;
  else if (rank === 3) xp += 40;

  xp += Math.min(150, bidsHit * 10); // Präzisions-Bonus
  if (isRanked) xp += 50; // Ranked Bonus
  if (isStreak) xp += 50; // Streak Bonus

  return xp;
}

// Level-Up & Truhen-Berechnung
const XP_PER_LEVEL = 1000;

function calculateLevelProgress(currentLevel = 1, currentXP = 0, gainedXP = 0) {
  let totalXP = currentXP + gainedXP;
  let newLevel = currentLevel;
  const chestsAwarded = { wooden: 0, silver: 0, gold: 0 };
  let leveledUp = false;

  while (totalXP >= XP_PER_LEVEL) {
    totalXP -= XP_PER_LEVEL;
    newLevel += 1;
    leveledUp = true;

    if (newLevel % 10 === 0) {
      chestsAwarded.gold += 1;
    } else if (newLevel % 5 === 0) {
      chestsAwarded.silver += 1;
    } else {
      chestsAwarded.wooden += 1;
    }
  }

  return {
    oldLevel: currentLevel,
    newLevel,
    leveledUp,
    currentXP: totalXP,
    xpRequired: XP_PER_LEVEL,
    gainedXP,
    chestsAwarded
  };
}

const WEEKLY_MILESTONES = [
  { id: 'weekly_games_3', name: '3 Partien abschließen', target: 3, type: 'matches', reward: { type: 'chest', chestType: 'wooden', amount: 1 } },
  { id: 'weekly_wins_1', name: '1 Sieg erringen', target: 1, type: 'wins', reward: { type: 'dust', amount: 50 } },
  { id: 'weekly_bids_10', name: '10 exakte Vorhersagen treffen', target: 10, type: 'bids', reward: { type: 'chest', chestType: 'silver', amount: 1 } },
  { id: 'weekly_games_10', name: '10 Partien meisterhaft bestreiten', target: 10, type: 'matches', reward: { type: 'chest', chestType: 'gold', amount: 1 } }
];

function getCurrentWeeklyPeriodId() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const firstJan = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil((((d - firstJan) / 86400000) + firstJan.getUTCDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

module.exports = {
  RARITY_CONFIG,
  CHEST_TIERS,
  COSMETICS_CATALOG,
  CATALOG_BY_TYPE_AND_ID,
  DROPPABLE_ITEMS_BY_RARITY,
  WEEKLY_MILESTONES,
  getCurrentWeeklyPeriodId,
  rollRarity,
  rollChestRewards,
  calculateMatchXP,
  calculateLevelProgress,
  XP_PER_LEVEL
};
