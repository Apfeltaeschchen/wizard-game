const RESERVED_USERNAMES = [
  'meister merlin', 'meisterin morgana', 'erzmagier balthasar',
  'admin', 'administrator', 'system', 'zitadelle', 'oberster rat', 'bot'
];

function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'Bitte gib einen Spielernamen ein.';
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 18) return 'Der Name muss zwischen 3 und 18 Zeichen lang sein.';
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return 'Der Name darf nur Buchstaben, Zahlen, Bindestriche und Unterstriche enthalten.';
  return null;
}

function getRankDetailsFromSR(sr) {
  const rating = Math.max(0, sr !== undefined && sr !== null ? Number(sr) : 1000);
  let tierKey = 'novice';
  let tierName = 'Novize';
  let division = 5;
  let progressPct = 0;
  let minSR = 0;
  let maxSR = 199;

  if (rating < 1000) {
    tierKey = 'novice';
    tierName = 'Novize';
    const divIdx = Math.min(4, Math.floor(rating / 200));
    division = 5 - divIdx;
    minSR = divIdx * 200;
    maxSR = minSR + 199;
    progressPct = Math.round(((rating - minSR) / 200) * 100);
  } else if (rating < 1500) {
    tierKey = 'adept';
    tierName = 'Adept';
    const offset = rating - 1000;
    const divIdx = Math.min(4, Math.floor(offset / 100));
    division = 5 - divIdx;
    minSR = 1000 + divIdx * 100;
    maxSR = minSR + 99;
    progressPct = Math.round(((rating - minSR) / 100) * 100);
  } else if (rating < 2000) {
    tierKey = 'mage';
    tierName = 'Magier';
    const offset = rating - 1500;
    const divIdx = Math.min(4, Math.floor(offset / 100));
    division = 5 - divIdx;
    minSR = 1500 + divIdx * 100;
    maxSR = minSR + 99;
    progressPct = Math.round(((rating - minSR) / 100) * 100);
  } else if (rating < 2500) {
    tierKey = 'archmage';
    tierName = 'Erzmagier';
    const offset = rating - 2000;
    const divIdx = Math.min(4, Math.floor(offset / 100));
    division = 5 - divIdx;
    minSR = 2000 + divIdx * 100;
    maxSR = minSR + 99;
    progressPct = Math.round(((rating - minSR) / 100) * 100);
  } else if (rating < 3000) {
    tierKey = 'grandmaster';
    tierName = 'Großmagier';
    const offset = rating - 2500;
    const divIdx = Math.min(4, Math.floor(offset / 100));
    division = 5 - divIdx;
    minSR = 2500 + divIdx * 100;
    maxSR = minSR + 99;
    progressPct = Math.round(((rating - minSR) / 100) * 100);
  } else {
    tierKey = 'high_council';
    tierName = 'Oberster Rat';
    division = 1;
    minSR = 3000;
    maxSR = 9999;
    progressPct = 100;
  }

  const romans = { 5: 'V', 4: 'IV', 3: 'III', 2: 'II', 1: 'I' };
  const divisionRoman = (tierKey === 'high_council') ? '' : (romans[division] || 'V');
  const label = (tierKey === 'high_council') ? 'Oberster Rat' : `${tierName} ${divisionRoman}`;

  const tierColors = {
    novice: '#b45309',
    adept: '#38bdf8',
    mage: '#fbbf24',
    archmage: '#34d399',
    grandmaster: '#f87171',
    high_council: '#c084fc'
  };

  const finalProgress = Math.min(100, Math.max(0, progressPct));

  return {
    tier: tierKey,
    tierKey,
    tierName,
    division,
    divisionRoman,
    divisionName: label,
    label,
    color: tierColors[tierKey] || '#fbbf24',
    sr: rating,
    progressPercent: finalProgress,
    progressPct: finalProgress,
    minSR,
    maxSR
  };
}

function formatUserWithRank(user) {
  if (!user) return null;
  return {
    ...user,
    account_level: user.account_level || 1,
    account_xp: user.account_xp || 0,
    chests_wooden: user.chests_wooden || 0,
    chests_silver: user.chests_silver || 0,
    chests_gold: user.chests_gold || 0,
    astral_dust: user.astral_dust || 0,
    equipped_avatar_icon: (user.equipped_avatar_icon && user.equipped_avatar_icon !== 'wizard_blue') ? user.equipped_avatar_icon : ((user.avatar_id && user.avatar_id !== 'wizard_blue') ? user.avatar_id : 'default'),
    equipped_card_back: user.equipped_card_back || 'default',
    equipped_table_skin: user.equipped_table_skin || 'emerald_felt',
    equipped_avatar_frame: user.equipped_avatar_frame || 'none',
    equipped_lobby_background: user.equipped_lobby_background || 'citadel_halls',
    rank: getRankDetailsFromSR(user.skill_rating || 1000)
  };
}

module.exports = {
  RESERVED_USERNAMES,
  validateUsername,
  getRankDetailsFromSR,
  formatUserWithRank
};
