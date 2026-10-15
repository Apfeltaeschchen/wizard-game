const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Erstelle das Datenverzeichnis falls nicht existent
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.WIZARD_DB_PATH || path.join(dataDir, 'wizard.db');
const db = new Database(dbPath);

// Performance & Concurrency Optimierungen
if (dbPath !== ':memory:') {
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

// Schemainitialisierung
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    avatar_id TEXT DEFAULT 'wizard_blue',
    title TEXT DEFAULT 'Zauberlehrling',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    max_win_streak INTEGER DEFAULT 0,
    podium_finishes INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    highest_score INTEGER DEFAULT 0,
    bids_made INTEGER DEFAULT 0,
    bids_hit INTEGER DEFAULT 0,
    wizards_played INTEGER DEFAULT 0,
    jesters_played INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_achievements (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id)
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id)
  );
`);

// Automatische Migration für Ranglisten-Felder
try { db.exec('ALTER TABLE user_stats ADD COLUMN skill_rating INTEGER DEFAULT 1000;'); } catch (e) {}
try { db.exec('ALTER TABLE user_stats ADD COLUMN highest_skill_rating INTEGER DEFAULT 1000;'); } catch (e) {}
try { db.exec('ALTER TABLE user_stats ADD COLUMN ranked_games_played INTEGER DEFAULT 0;'); } catch (e) {}
try { db.exec('ALTER TABLE user_stats ADD COLUMN ranked_games_won INTEGER DEFAULT 0;'); } catch (e) {}
try { db.exec('ALTER TABLE user_stats ADD COLUMN pending_penalty_notice TEXT DEFAULT NULL;'); } catch (e) {}

// Prepared Statements
const stmtFindUserByName = db.prepare('SELECT * FROM users WHERE username = ?');
const stmtFindUserById = db.prepare(`
  SELECT u.id, u.username, u.avatar_id, u.title, u.created_at,
         s.games_played, s.games_won, s.games_lost, s.current_streak, s.max_win_streak,
         s.podium_finishes, s.total_points, s.highest_score, s.bids_made, s.bids_hit,
         s.wizards_played, s.jesters_played,
         s.skill_rating, s.highest_skill_rating, s.ranked_games_played, s.ranked_games_won,
         s.pending_penalty_notice
  FROM users u
  LEFT JOIN user_stats s ON u.id = s.user_id
  WHERE u.id = ?
`);

const stmtInsertUser = db.prepare('INSERT INTO users (username, password_hash, avatar_id) VALUES (?, ?, ?)');
const stmtInsertStats = db.prepare('INSERT INTO user_stats (user_id, skill_rating, highest_skill_rating) VALUES (?, 1000, 1000)');
const stmtCreateSession = db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)');
const stmtFindSession = db.prepare(`
  SELECT s.token, s.expires_at, u.id, u.username, u.avatar_id, u.title,
         st.games_played, st.games_won, st.games_lost, st.current_streak, st.max_win_streak,
         st.podium_finishes, st.total_points, st.highest_score, st.bids_made, st.bids_hit,
         st.wizards_played, st.jesters_played,
         st.skill_rating, st.highest_skill_rating, st.ranked_games_played, st.ranked_games_won,
         st.pending_penalty_notice
  FROM sessions s
  JOIN users u ON s.user_id = u.id
  LEFT JOIN user_stats st ON u.id = st.user_id
  WHERE s.token = ?
`);
const stmtDeleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');
const stmtUpdateProfile = db.prepare('UPDATE users SET avatar_id = COALESCE(?, avatar_id), title = COALESCE(?, title) WHERE id = ?');
const stmtGetLeaderboard = db.prepare(`
  SELECT u.id, u.username, u.avatar_id, u.title,
         s.games_played, s.games_won, s.games_lost, s.max_win_streak, s.highest_score,
         s.bids_made, s.bids_hit, s.total_points, s.skill_rating
  FROM users u
  JOIN user_stats s ON u.id = s.user_id
  WHERE s.games_played > 0
  ORDER BY s.games_won DESC, s.highest_score DESC, s.total_points DESC
  LIMIT ?
`);

const stmtGetRankedLeaderboard = db.prepare(`
  SELECT u.id, u.username, u.avatar_id, u.title,
         s.skill_rating, s.highest_skill_rating, s.ranked_games_played, s.ranked_games_won,
         s.games_played, s.games_won, s.bids_made, s.bids_hit
  FROM users u
  JOIN user_stats s ON u.id = s.user_id
  WHERE s.ranked_games_played > 0 OR s.skill_rating != 1000
  ORDER BY s.skill_rating DESC, s.ranked_games_won DESC, s.highest_skill_rating DESC
  LIMIT ?
`);

// Validierungshilfen
function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'Bitte gib einen Spielernamen ein.';
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 18) return 'Der Name muss zwischen 3 und 18 Zeichen lang sein.';
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return 'Der Name darf nur Buchstaben, Zahlen, Bindestriche und Unterstriche enthalten.';
  return null;
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Registriert einen neuen Spieler
 */
function registerUser(username, password, avatarId = 'wizard_blue') {
  const nameError = validateUsername(username);
  if (nameError) return { success: false, error: nameError };

  if (!password || typeof password !== 'string' || password.length < 6) {
    return { success: false, error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' };
  }

  const cleanName = username.trim();
  const existing = stmtFindUserByName.get(cleanName);
  if (existing) {
    return { success: false, error: `Der Spielername "${cleanName}" ist bereits vergeben.` };
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = stmtInsertUser.run(cleanName, hash, avatarId || 'wizard_blue');
  const userId = info.lastInsertRowid;
  stmtInsertStats.run(userId);

  // 30 Tage Session
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  stmtCreateSession.run(token, userId, expiresAt);

  const user = stmtFindUserById.get(userId);
  return { success: true, token, user: formatUserWithRank(user) };
}

/**
 * Authentifiziert einen Spieler
 */
function loginUser(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Bitte gib Benutzername und Passwort ein.' };
  }

  const cleanName = username.trim();
  const user = stmtFindUserByName.get(cleanName);
  if (!user) {
    return { success: false, error: 'Ungültiger Benutzername oder falsches Passwort.' };
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    return { success: false, error: 'Ungültiger Benutzername oder falsches Passwort.' };
  }

  // 30 Tage Session
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  stmtCreateSession.run(token, user.id, expiresAt);

  const fullUser = stmtFindUserById.get(user.id);
  return { success: true, token, user: formatUserWithRank(fullUser) };
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
    rank: getRankDetailsFromSR(user.skill_rating || 1000)
  };
}

/**
 * Validiert ein Session-Token
 */
function getUserByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const row = stmtFindSession.get(token);
  if (!row) return null;

  if (new Date(row.expires_at) < new Date()) {
    stmtDeleteSession.run(token);
    return null;
  }
  return formatUserWithRank(row);
}

/**
 * Beendet eine Session (Logout)
 */
function logoutUser(token) {
  if (token) {
    stmtDeleteSession.run(token);
  }
  return { success: true };
}

/**
 * Aktualisiert Profilangaben (Avatar, Titel)
 */
function updateUserProfile(userId, { avatar_id, title }) {
  stmtUpdateProfile.run(avatar_id || null, title || null, userId);
  return stmtFindUserById.get(userId);
}

/**
 * Verzeichnet Ansagen und Treffer am Rundenende
 */
function recordRoundBid(userId, bid, tricksWon) {
  if (!userId) return;
  const hit = (bid === tricksWon) ? 1 : 0;
  db.prepare(`
    UPDATE user_stats 
    SET bids_made = bids_made + 1,
        bids_hit = bids_hit + ?
    WHERE user_id = ?
  `).run(hit, userId);
}

/**
 * Verzeichnet gespielte Zauberer / Narren
 */
function recordSpecialCard(userId, cardType) {
  if (!userId) return;
  if (cardType === 'wizard') {
    db.prepare('UPDATE user_stats SET wizards_played = wizards_played + 1 WHERE user_id = ?').run(userId);
  } else if (cardType === 'jester') {
    db.prepare('UPDATE user_stats SET jesters_played = jesters_played + 1 WHERE user_id = ?').run(userId);
  }
}

/**
 * Verzeichnet das Spielergebnis am Ende einer vollständigen Partie
 */
function recordGameFinished(userId, { rank, totalPlayers, points, hadZeroWizardTrickWin }) {
  if (!userId) return;
  const isWin = (rank === 1);
  const isPodium = (rank <= 3 && totalPlayers >= 3);

  const current = db.prepare('SELECT current_streak, max_win_streak, highest_score, bids_made, bids_hit, games_won FROM user_stats WHERE user_id = ?').get(userId);
  if (!current) return;

  const newCurrentStreak = isWin ? (current.current_streak + 1) : 0;
  const newMaxStreak = Math.max(current.max_win_streak, newCurrentStreak);
  const newHighestScore = Math.max(current.highest_score, points || 0);
  const gamesWonInc = isWin ? 1 : 0;
  const gamesLostInc = isWin ? 0 : 1;
  const podiumInc = isPodium ? 1 : 0;

  db.prepare(`
    UPDATE user_stats
    SET games_played = games_played + 1,
        games_won = games_won + ?,
        games_lost = games_lost + ?,
        current_streak = ?,
        max_win_streak = ?,
        podium_finishes = podium_finishes + ?,
        total_points = total_points + ?,
        highest_score = ?
    WHERE user_id = ?
  `).run(gamesWonInc, gamesLostInc, newCurrentStreak, newMaxStreak, podiumInc, points || 0, newHighestScore, userId);

  // Prüfe Titel-Freischaltungen
  checkAndGrantTitles(userId, {
    totalWins: current.games_won + gamesWonInc,
    maxStreak: newMaxStreak,
    bidsMade: current.bids_made,
    bidsHit: current.bids_hit,
    hadZeroWizardTrickWin
  });
}

function grantAchievement(userId, achievementId) {
  try {
    db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, achievementId);
  } catch (e) {}
}

function checkAndGrantTitles(userId, { totalWins, maxStreak, bidsMade, bidsHit, hadZeroWizardTrickWin }) {
  if (totalWins >= 25) {
    grantAchievement(userId, 'title_grandmaster');
  }
  if (maxStreak >= 5) {
    grantAchievement(userId, 'title_invincible');
  }
  if (bidsMade >= 20 && (bidsHit / bidsMade) >= 0.75) {
    grantAchievement(userId, 'title_seer');
  }
  if (hadZeroWizardTrickWin) {
    grantAchievement(userId, 'title_illusion_master');
  }
}

/**
 * Ruft die globale Bestenliste ab
 */
function getLeaderboard(limit = 10) {
  const rows = stmtGetLeaderboard.all(limit);
  return rows.map(r => ({
    id: r.id,
    username: r.username,
    avatar_id: r.avatar_id,
    title: r.title,
    games_played: r.games_played,
    games_won: r.games_won,
    games_lost: r.games_lost,
    win_rate: r.games_played > 0 ? Math.round((r.games_won / r.games_played) * 100) : 0,
    max_win_streak: r.max_win_streak,
    highest_score: r.highest_score,
    prophecy_rate: r.bids_made > 0 ? Math.round((r.bids_hit / r.bids_made) * 100) : 0,
    total_points: r.total_points
  }));
}

/**
 * Ruft die kompetitive Ranglisten-Tabelle ab
 */
function getRankedLeaderboard(limit = 25) {
  const rows = stmtGetRankedLeaderboard.all(limit);
  return rows.map((r, idx) => {
    const rankInfo = getRankDetailsFromSR(r.skill_rating || 1000);
    const played = r.ranked_games_played || 0;
    const won = r.ranked_games_won || 0;
    const lost = Math.max(0, played - won);
    const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
    return {
      rankPosition: idx + 1,
      id: r.id,
      username: r.username,
      avatar_id: r.avatar_id,
      title: r.title,
      skill_rating: r.skill_rating || 1000,
      highest_skill_rating: r.highest_skill_rating || 1000,
      ranked_games_played: played,
      ranked_games_won: won,
      ranked_games_lost: lost,
      win_rate: winRate,
      ranked_win_rate: winRate,
      rank: rankInfo
    };
  });
}

/**
 * Verbucht das Ergebnis eines gewerteten Matches und berechnet SR-Fortschritt
 */
function recordRankedGameFinished(userId, { rank, totalPlayers, points, bidsMade, bidsHit }) {
  if (!userId) return null;
  const current = db.prepare('SELECT skill_rating, highest_skill_rating, ranked_games_played, ranked_games_won FROM user_stats WHERE user_id = ?').get(userId);
  if (!current) return null;

  const oldSR = current.skill_rating || 1000;
  const isWin = (rank === 1);
  const prophecyRate = (bidsMade > 0) ? (bidsHit / bidsMade) : 0;

  // Overwatch-inspiriertes SR-Delta basierend auf Platzierung und Teilnehmerzahl
  let delta = 0;
  if (totalPlayers >= 4) {
    if (rank === 1) delta = 28;
    else if (rank === 2) delta = 14;
    else if (rank === 3) delta = 3;
    else if (rank === 4) delta = -10;
    else if (rank === 5) delta = -18;
    else if (rank === 6) delta = -25;
  } else {
    // 3 Spieler
    if (rank === 1) delta = 25;
    else if (rank === 2) delta = 0;
    else delta = -22;
  }

  // Bonus für hohe Vorhersagegenauigkeit
  if (prophecyRate >= 0.70) delta += 3;
  if (prophecyRate >= 0.90) delta += 2;

  const newSR = Math.max(0, oldSR + delta);
  const newHighest = Math.max(current.highest_skill_rating || 1000, newSR);
  const rankedWonInc = isWin ? 1 : 0;

  db.prepare(`
    UPDATE user_stats
    SET skill_rating = ?,
        highest_skill_rating = ?,
        ranked_games_played = ranked_games_played + 1,
        ranked_games_won = ranked_games_won + ?
    WHERE user_id = ?
  `).run(newSR, newHighest, rankedWonInc, userId);

  const oldRank = getRankDetailsFromSR(oldSR);
  const newRank = getRankDetailsFromSR(newSR);

  return {
    oldSR,
    newSR,
    delta,
    deltaSR: delta,
    oldRank,
    newRank,
    isTierUp: (newRank.tierKey !== oldRank.tierKey && newSR > oldSR),
    isTierDown: (newRank.tierKey !== oldRank.tierKey && newSR < oldSR)
  };
}

/**
 * Bestraft vorzeitiges Verlassen eines gewerteten Matches (-50 SR)
 */
function applyLeaverPenalty(userId) {
  if (!userId) return null;
  const current = db.prepare('SELECT skill_rating FROM user_stats WHERE user_id = ?').get(userId);
  if (!current) return null;

  const oldSR = current.skill_rating || 1000;
  const penalty = 50;
  const newSR = Math.max(0, oldSR - penalty);

  const notice = '⚠️ RATS-VERWARNUNG: Du hast eine gewertete Partie vorzeitig verlassen. Der Hohe Rat hat dir -50 Rangpunkte (SR) aberkannt!';

  db.prepare(`
    UPDATE user_stats
    SET skill_rating = ?,
        pending_penalty_notice = ?
    WHERE user_id = ?
  `).run(newSR, notice, userId);

  return { oldSR, newSR, penalty, notice };
}

/**
 * Holt eine anstehende Straf-Benachrichtigung ab und löscht sie
 */
function popPenaltyNotice(userId) {
  if (!userId) return null;
  const row = db.prepare('SELECT pending_penalty_notice FROM user_stats WHERE user_id = ?').get(userId);
  if (!row || !row.pending_penalty_notice) return null;

  const notice = row.pending_penalty_notice;
  db.prepare('UPDATE user_stats SET pending_penalty_notice = NULL WHERE user_id = ?').run(userId);
  return notice;
}

/**
 * Freundesverwaltung: Grimoire der Gefährten
 */
const stmtFindFriendship = db.prepare('SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?');
const stmtInsertFriendship = db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)');
const stmtDeleteFriendship = db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)');
const stmtGetFriends = db.prepare(`
  SELECT u.id, u.username, u.avatar_id, u.title, u.created_at,
         s.games_played, s.games_won, s.games_lost, s.current_streak, s.max_win_streak,
         s.podium_finishes, s.total_points, s.highest_score, s.bids_made, s.bids_hit,
         s.wizards_played, s.jesters_played,
         s.skill_rating, s.highest_skill_rating, s.ranked_games_played, s.ranked_games_won
  FROM friendships f
  JOIN users u ON f.friend_id = u.id
  LEFT JOIN user_stats s ON u.id = s.user_id
  WHERE f.user_id = ?
  ORDER BY u.username COLLATE NOCASE ASC
`);

function addFriend(userId, friendUsername) {
  if (!userId) return { success: false, error: 'Nicht authentifiziert.' };
  if (!friendUsername || typeof friendUsername !== 'string') {
    return { success: false, error: 'Bitte gib einen gültigen Magiernamen ein.' };
  }
  const cleanName = friendUsername.trim();
  const targetUser = stmtFindUserByName.get(cleanName);
  if (!targetUser) {
    return { success: false, error: `Kein Magier namens "${cleanName}" in den Gildenbüchern gefunden.` };
  }
  if (targetUser.id === userId) {
    return { success: false, error: 'Du kannst dich nicht selbst als Gefährten aufnehmen.' };
  }
  const existing = stmtFindFriendship.get(userId, targetUser.id);
  if (existing) {
    return { success: false, error: `${targetUser.username} ist bereits dein Gefährte.` };
  }

  const tx = db.transaction(() => {
    stmtInsertFriendship.run(userId, targetUser.id);
    stmtInsertFriendship.run(targetUser.id, userId);
  });
  tx();

  const friendFull = formatUserWithRank(stmtFindUserById.get(targetUser.id));
  return { success: true, friend: friendFull };
}

function removeFriend(userId, friendId) {
  if (!userId || !friendId) return { success: false, error: 'Ungültige Anfrage.' };
  stmtDeleteFriendship.run(userId, friendId, friendId, userId);
  return { success: true };
}

function getFriends(userId) {
  if (!userId) return [];
  const rows = stmtGetFriends.all(userId);
  return rows.map(r => formatUserWithRank(r));
}

function closeDatabase() {
  try {
    if (dbPath !== ':memory:') {
      db.pragma('wal_checkpoint(TRUNCATE)');
    }
  } catch (e) {}
}

process.once('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.once('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

module.exports = {
  db,
  registerUser,
  loginUser,
  getUserByToken,
  logoutUser,
  updateUserProfile,
  recordRoundBid,
  recordSpecialCard,
  recordGameFinished,
  recordRankedGameFinished,
  applyLeaverPenalty,
  popPenaltyNotice,
  getLeaderboard,
  getRankedLeaderboard,
  getRankDetailsFromSR,
  formatUserWithRank,
  getUserById: (id) => formatUserWithRank(stmtFindUserById.get(id)),
  addFriend,
  removeFriend,
  getFriends,
  closeDatabase
};

