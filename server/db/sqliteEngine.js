const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const {
  COSMETICS_CATALOG,
  RARITY_CONFIG,
  CHEST_TIERS,
  WEEKLY_MILESTONES,
  getCurrentWeeklyPeriodId,
  rollChestRewards,
  calculateMatchXP,
  calculateLevelProgress,
  XP_PER_LEVEL
} = require('../cosmeticsData');

function isDirectoryWritable(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return false;
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return false;
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch (e) {
    return false;
  }
}

function resolveSafeDatabasePath(customDbPath) {
  if (customDbPath) return customDbPath;
  if (process.env.WIZARD_DB_PATH) return process.env.WIZARD_DB_PATH;

  // 1. Persistent Disk auf Render (/var/data)
  if (isDirectoryWritable('/var/data')) {
    return path.join('/var/data', 'wizard.db');
  }

  // 2. Lokaler Daten-Ordner (server/data)
  const dataDir = path.join(__dirname, '../data');
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (isDirectoryWritable(dataDir)) {
      return path.join(dataDir, 'wizard.db');
    }
  } catch (e) {}

  // 3. Arbeitsverzeichnis Fallback (process.cwd())
  try {
    if (isDirectoryWritable(process.cwd())) {
      return path.join(process.cwd(), 'wizard.db');
    }
  } catch (e) {}

  // 4. In-Memory als sichere Rückfallebene
  return ':memory:';
}

function createSqliteEngine(customDbPath, sharedHelpers) {
  const { getRankDetailsFromSR, formatUserWithRank, RESERVED_USERNAMES, validateUsername } = sharedHelpers;

  let dbPath = resolveSafeDatabasePath(customDbPath);
  let db;
  try {
    db = new Database(dbPath);
  } catch (err) {
    console.warn(`[SQLite Engine] Konnte "${dbPath}" nicht öffnen (${err.message}). Verwende lokalen Ausweichpfad...`);
    try {
      dbPath = path.join(process.cwd(), 'wizard.db');
      db = new Database(dbPath);
    } catch (err2) {
      console.warn(`[SQLite Engine] Ausweichpfad fehlgeschlagen (${err2.message}). Wechsle zu In-Memory.`);
      dbPath = ':memory:';
      db = new Database(':memory:');
    }
  }

  if (dbPath !== ':memory:') {
    try { db.pragma('journal_mode = WAL'); } catch (e) {}
  }
  try { db.pragma('foreign_keys = ON'); } catch (e) {}

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

    CREATE TABLE IF NOT EXISTS user_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, item_type, item_id)
    );
  `);

  // Migrationen für Ranglisten-Felder
  try { db.exec('ALTER TABLE user_stats ADD COLUMN skill_rating INTEGER DEFAULT 1000;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN highest_skill_rating INTEGER DEFAULT 1000;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN ranked_games_played INTEGER DEFAULT 0;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN ranked_games_won INTEGER DEFAULT 0;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN pending_penalty_notice TEXT DEFAULT NULL;'); } catch (e) {}

  // Migrationen für Etappe 6: Kosmetik, Schatztruhen & Overwatch-Style Progression
  try { db.exec('ALTER TABLE user_stats ADD COLUMN account_level INTEGER DEFAULT 1;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN account_xp INTEGER DEFAULT 0;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN chests_wooden INTEGER DEFAULT 1;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN chests_silver INTEGER DEFAULT 0;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN chests_gold INTEGER DEFAULT 0;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN astral_dust INTEGER DEFAULT 0;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN weekly_matches_played INTEGER DEFAULT 0;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN weekly_matches_won INTEGER DEFAULT 0;'); } catch (e) {}
  try { db.exec('ALTER TABLE user_stats ADD COLUMN weekly_perfect_bids INTEGER DEFAULT 0;'); } catch (e) {}
  try { db.exec("ALTER TABLE user_stats ADD COLUMN weekly_claimed_milestones TEXT DEFAULT '[]';"); } catch (e) {}
  try { db.exec("ALTER TABLE user_stats ADD COLUMN weekly_period_id TEXT DEFAULT '';"); } catch (e) {}
  try { db.exec("ALTER TABLE user_stats ADD COLUMN equipped_card_back TEXT DEFAULT 'default';"); } catch (e) {}
  try { db.exec("ALTER TABLE user_stats ADD COLUMN equipped_table_skin TEXT DEFAULT 'emerald_felt';"); } catch (e) {}
  try { db.exec("ALTER TABLE user_stats ADD COLUMN equipped_avatar_frame TEXT DEFAULT 'none';"); } catch (e) {}
  try { db.exec("ALTER TABLE user_stats ADD COLUMN equipped_lobby_background TEXT DEFAULT 'citadel_halls';"); } catch (e) {}

  // Prepared Statements
  const stmtFindUserByName = db.prepare('SELECT * FROM users WHERE username = ?');
  const stmtFindUserById = db.prepare(`
    SELECT u.id, u.username, u.avatar_id, u.title, u.created_at,
           s.games_played, s.games_won, s.games_lost, s.current_streak, s.max_win_streak,
           s.podium_finishes, s.total_points, s.highest_score, s.bids_made, s.bids_hit,
           s.wizards_played, s.jesters_played,
           s.skill_rating, s.highest_skill_rating, s.ranked_games_played, s.ranked_games_won,
           s.pending_penalty_notice,
           s.account_level, s.account_xp, s.chests_wooden, s.chests_silver, s.chests_gold,
           s.astral_dust, s.weekly_matches_played, s.weekly_matches_won, s.weekly_perfect_bids,
           s.weekly_claimed_milestones, s.weekly_period_id,
           s.equipped_card_back, s.equipped_table_skin, s.equipped_avatar_frame, s.equipped_lobby_background
    FROM users u
    LEFT JOIN user_stats s ON u.id = s.user_id
    WHERE u.id = ?
  `);

  const stmtInsertUser = db.prepare('INSERT INTO users (username, password_hash, avatar_id) VALUES (?, ?, ?)');
  const stmtInsertStats = db.prepare('INSERT INTO user_stats (user_id, skill_rating, highest_skill_rating, chests_wooden) VALUES (?, 1000, 1000, 1)');
  const stmtCreateSession = db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)');
  const stmtFindSession = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.username, u.avatar_id, u.title,
           st.games_played, st.games_won, st.games_lost, st.current_streak, st.max_win_streak,
           st.podium_finishes, st.total_points, st.highest_score, st.bids_made, st.bids_hit,
           st.wizards_played, st.jesters_played,
           st.skill_rating, st.highest_skill_rating, st.ranked_games_played, st.ranked_games_won,
           st.pending_penalty_notice,
           st.account_level, st.account_xp, st.chests_wooden, st.chests_silver, st.chests_gold,
           st.astral_dust, st.weekly_matches_played, st.weekly_matches_won, st.weekly_perfect_bids,
           st.weekly_claimed_milestones, st.weekly_period_id,
           st.equipped_card_back, st.equipped_table_skin, st.equipped_avatar_frame, st.equipped_lobby_background
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN user_stats st ON u.id = st.user_id
    WHERE s.token = ?
  `);
  const stmtDeleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');
  const stmtTouchSession = db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?');
  const stmtUpdateProfile = db.prepare('UPDATE users SET avatar_id = COALESCE(?, avatar_id), title = COALESCE(?, title) WHERE id = ?');
  const stmtGetInventory = db.prepare('SELECT item_type, item_id, acquired_at FROM user_inventory WHERE user_id = ?');
  const stmtInsertInventory = db.prepare('INSERT OR IGNORE INTO user_inventory (user_id, item_type, item_id) VALUES (?, ?, ?)');
  const stmtHasInventoryItem = db.prepare('SELECT id FROM user_inventory WHERE user_id = ? AND item_type = ? AND item_id = ?');
  const stmtUpdateEquippedCardBack = db.prepare('UPDATE user_stats SET equipped_card_back = ? WHERE user_id = ?');
  const stmtUpdateEquippedTableSkin = db.prepare('UPDATE user_stats SET equipped_table_skin = ? WHERE user_id = ?');
  const stmtUpdateEquippedAvatarFrame = db.prepare('UPDATE user_stats SET equipped_avatar_frame = ? WHERE user_id = ?');
  const stmtUpdateEquippedLobbyBackground = db.prepare('UPDATE user_stats SET equipped_lobby_background = ? WHERE user_id = ?');
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

  function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  function isUsernameAvailable(username) {
    if (!username || typeof username !== 'string') {
      return { available: false, error: 'Bitte gib einen Spielernamen ein.' };
    }
    const clean = username.trim();
    const formatError = validateUsername(clean);
    if (formatError) {
      return { available: false, error: formatError };
    }

    const lower = clean.toLowerCase();
    if (RESERVED_USERNAMES.includes(lower) || lower.endsWith('(ki)') || lower.endsWith('[bot]') || lower.includes('(ki)')) {
      return { available: false, error: 'Dieser Name ist für Rats-Magier (KI) oder das System reserviert.' };
    }

    const existing = stmtFindUserByName.get(clean);
    if (existing) {
      return { available: false, error: `Der Spielername "${clean}" ist bereits vergeben.` };
    }

    return { available: true, cleanName: clean };
  }

  function registerUser(username, password, avatarId = 'wizard_blue') {
    const availability = isUsernameAvailable(username);
    if (!availability.available) {
      return { success: false, error: availability.error };
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return { success: false, error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' };
    }

    const cleanName = availability.cleanName;
    const hash = bcrypt.hashSync(password, 10);
    const info = stmtInsertUser.run(cleanName, hash, avatarId || 'wizard_blue');
    const userId = info.lastInsertRowid;
    stmtInsertStats.run(userId);

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    stmtCreateSession.run(token, userId, expiresAt);

    const user = stmtFindUserById.get(userId);
    return { success: true, token, user: formatUserWithRank(user) };
  }

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

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    stmtCreateSession.run(token, user.id, expiresAt);

    const fullUser = stmtFindUserById.get(user.id);
    return { success: true, token, user: formatUserWithRank(fullUser) };
  }

  function touchSession(token) {
    if (!token) return;
    try {
      const newExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      stmtTouchSession.run(newExpiry, token);
    } catch (e) {}
  }

  function backupDatabase() {
    if (dbPath === ':memory:' || !fs.existsSync(dbPath)) return Promise.resolve(null);
    try {
      const backupDir = path.dirname(dbPath);
      const backupPath = path.join(backupDir, 'wizard.db.backup');
      if (typeof db.backup === 'function') {
        return db.backup(backupPath).then(() => backupPath).catch(err => {
          console.warn('[Database] Backup fehlgeschlagen:', err);
          return null;
        });
      }
    } catch (e) {
      console.warn('[Database] Backup-Fehler:', e);
    }
    return Promise.resolve(null);
  }

  function getUserByToken(token, refresh = true) {
    if (!token || typeof token !== 'string') return null;
    const row = stmtFindSession.get(token);
    if (!row) return null;

    if (new Date(row.expires_at) < new Date()) {
      stmtDeleteSession.run(token);
      return null;
    }
    if (refresh) {
      touchSession(token);
    }
    return formatUserWithRank(row);
  }

  function logoutUser(token) {
    if (token) {
      stmtDeleteSession.run(token);
    }
    return { success: true };
  }

  function getUserById(id) {
    if (!id) return null;
    return formatUserWithRank(stmtFindUserById.get(id));
  }

  function updateUserProfile(userId, { avatar_id, title }) {
    stmtUpdateProfile.run(avatar_id || null, title || null, userId);
    return getUserById(userId);
  }

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

  function recordSpecialCard(userId, cardType) {
    if (!userId) return;
    if (cardType === 'wizard') {
      db.prepare('UPDATE user_stats SET wizards_played = wizards_played + 1 WHERE user_id = ?').run(userId);
    } else if (cardType === 'jester') {
      db.prepare('UPDATE user_stats SET jesters_played = jesters_played + 1 WHERE user_id = ?').run(userId);
    }
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

    checkAndGrantTitles(userId, {
      totalWins: current.games_won + gamesWonInc,
      maxStreak: newMaxStreak,
      bidsMade: current.bids_made,
      bidsHit: current.bids_hit,
      hadZeroWizardTrickWin
    });
  }

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

  function recordRankedGameFinished(userId, { rank, totalPlayers, points, bidsMade, bidsHit }) {
    if (!userId) return null;
    const current = db.prepare('SELECT skill_rating, highest_skill_rating, ranked_games_played, ranked_games_won FROM user_stats WHERE user_id = ?').get(userId);
    if (!current) return null;

    const oldSR = current.skill_rating || 1000;
    const isWin = (rank === 1);
    const prophecyRate = (bidsMade > 0) ? (bidsHit / bidsMade) : 0;

    let delta = 0;
    if (totalPlayers >= 4) {
      if (rank === 1) delta = 28;
      else if (rank === 2) delta = 14;
      else if (rank === 3) delta = 3;
      else if (rank === 4) delta = -10;
      else if (rank === 5) delta = -18;
      else if (rank === 6) delta = -25;
    } else {
      if (rank === 1) delta = 25;
      else if (rank === 2) delta = 0;
      else delta = -22;
    }

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

  function popPenaltyNotice(userId) {
    if (!userId) return null;
    const row = db.prepare('SELECT pending_penalty_notice FROM user_stats WHERE user_id = ?').get(userId);
    if (!row || !row.pending_penalty_notice) return null;

    const notice = row.pending_penalty_notice;
    db.prepare('UPDATE user_stats SET pending_penalty_notice = NULL WHERE user_id = ?').run(userId);
    return notice;
  }

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

  function getUserCosmetics(userId) {
    if (!userId) return null;
    const userRow = stmtFindUserById.get(userId);
    if (!userRow) return null;

    const curPeriod = getCurrentWeeklyPeriodId();
    if (userRow.weekly_period_id !== curPeriod) {
      db.prepare(`
        UPDATE user_stats
        SET weekly_matches_played = 0,
            weekly_matches_won = 0,
            weekly_perfect_bids = 0,
            weekly_claimed_milestones = '[]',
            weekly_period_id = ?
        WHERE user_id = ?
      `).run(curPeriod, userId);
      userRow.weekly_matches_played = 0;
      userRow.weekly_matches_won = 0;
      userRow.weekly_perfect_bids = 0;
      userRow.weekly_claimed_milestones = '[]';
      userRow.weekly_period_id = curPeriod;
    }

    const inv = stmtGetInventory.all(userId);
    let claimedMilestones = [];
    try {
      claimedMilestones = JSON.parse(userRow.weekly_claimed_milestones || '[]');
    } catch (e) {
      claimedMilestones = [];
    }

    return {
      success: true,
      user: formatUserWithRank(userRow),
      inventory: inv,
      catalog: COSMETICS_CATALOG,
      rarityConfig: RARITY_CONFIG,
      chestTiers: CHEST_TIERS,
      weeklyMilestones: WEEKLY_MILESTONES,
      weeklyStats: {
        periodId: curPeriod,
        matchesPlayed: userRow.weekly_matches_played || 0,
        matchesWon: userRow.weekly_matches_won || 0,
        perfectBids: userRow.weekly_perfect_bids || 0,
        claimedMilestones
      }
    };
  }

  function openChest(userId, chestType) {
    if (!userId) return { success: false, error: 'Nicht angemeldet.' };
    const validTiers = ['wooden', 'silver', 'gold'];
    if (!validTiers.includes(chestType)) {
      return { success: false, error: 'Ungültiger Truhentyp.' };
    }

    const userRow = stmtFindUserById.get(userId);
    if (!userRow) return { success: false, error: 'Benutzer nicht gefunden.' };

    const chestCol = `chests_${chestType}`;
    const available = userRow[chestCol] || 0;
    if (available < 1) {
      const tierName = CHEST_TIERS[chestType] ? CHEST_TIERS[chestType].name : 'Truhen';
      return { success: false, error: `Keine ${tierName} verfügbar.` };
    }

    const inv = stmtGetInventory.all(userId);
    const ownedIds = inv.map(i => i.item_id);

    const rollRes = rollChestRewards(chestType, ownedIds);
    const newChestCount = available - 1;
    const newDust = (userRow.astral_dust || 0) + (rollRes.totalDustGained || 0);

    const tx = db.transaction(() => {
      db.prepare(`UPDATE user_stats SET ${chestCol} = ?, astral_dust = ? WHERE user_id = ?`).run(newChestCount, newDust, userId);
      for (const item of rollRes.rewards) {
        if (!item.isDuplicate) {
          let singularType = item.type;
          if (singularType.endsWith('s')) singularType = singularType.slice(0, -1);
          if (['avatar_icon', 'card_back', 'table_skin', 'avatar_frame', 'title', 'lobby_background'].includes(singularType)) {
            stmtInsertInventory.run(userId, singularType, item.id);
          }
        }
      }
    });
    tx();

    return {
      success: true,
      chestType,
      rewards: rollRes.rewards,
      totalDustGained: rollRes.totalDustGained,
      remainingChests: newChestCount,
      newDustBalance: newDust
    };
  }

  function equipCosmetic(userId, itemType, itemId) {
    if (!userId) return { success: false, error: 'Nicht angemeldet.' };
    const validTypes = ['avatar_icon', 'card_back', 'table_skin', 'avatar_frame', 'title', 'lobby_background'];
    if (!validTypes.includes(itemType)) {
      return { success: false, error: 'Ungültiger Kosmetiktyp.' };
    }

    let catalogList = [];
    if (itemType === 'avatar_icon') catalogList = COSMETICS_CATALOG.avatar_icons;
    else if (itemType === 'card_back') catalogList = COSMETICS_CATALOG.card_backs;
    else if (itemType === 'table_skin') catalogList = COSMETICS_CATALOG.table_skins;
    else if (itemType === 'avatar_frame') catalogList = COSMETICS_CATALOG.avatar_frames;
    else if (itemType === 'lobby_background') catalogList = COSMETICS_CATALOG.lobby_backgrounds;
    else if (itemType === 'title') catalogList = COSMETICS_CATALOG.titles;

    const catalogItem = catalogList.find(i => i.id === itemId);
    if (!catalogItem) {
      return { success: false, error: 'Gegenstand existiert nicht im Katalog.' };
    }

    if (!catalogItem.isDefault) {
      const owned = stmtHasInventoryItem.get(userId, itemType, itemId);
      if (!owned) {
        return { success: false, error: 'Diesen Gegenstand besitzt du noch nicht.' };
      }
    }

    if (itemType === 'avatar_icon') {
      stmtUpdateProfile.run(itemId, null, userId);
    } else if (itemType === 'title') {
      stmtUpdateProfile.run(null, itemId, userId);
    } else if (itemType === 'card_back') {
      stmtUpdateEquippedCardBack.run(itemId, userId);
    } else if (itemType === 'table_skin') {
      stmtUpdateEquippedTableSkin.run(itemId, userId);
    } else if (itemType === 'avatar_frame') {
      stmtUpdateEquippedAvatarFrame.run(itemId, userId);
    } else if (itemType === 'lobby_background') {
      stmtUpdateEquippedLobbyBackground.run(itemId, userId);
    }

    const updatedUser = formatUserWithRank(stmtFindUserById.get(userId));
    return { success: true, itemType, itemId, user: updatedUser };
  }

  function craftCosmetic(userId, itemType, itemId) {
    if (!userId) return { success: false, error: 'Nicht angemeldet.' };
    const validTypes = ['avatar_icon', 'card_back', 'table_skin', 'avatar_frame', 'title', 'lobby_background'];
    if (!validTypes.includes(itemType)) return { success: false, error: 'Ungültiger Typ.' };

    let catalogList = [];
    if (itemType === 'avatar_icon') catalogList = COSMETICS_CATALOG.avatar_icons;
    else if (itemType === 'card_back') catalogList = COSMETICS_CATALOG.card_backs;
    else if (itemType === 'table_skin') catalogList = COSMETICS_CATALOG.table_skins;
    else if (itemType === 'avatar_frame') catalogList = COSMETICS_CATALOG.avatar_frames;
    else if (itemType === 'lobby_background') catalogList = COSMETICS_CATALOG.lobby_backgrounds;
    else if (itemType === 'title') catalogList = COSMETICS_CATALOG.titles;

    const catalogItem = catalogList.find(i => i.id === itemId);
    if (!catalogItem) return { success: false, error: 'Gegenstand nicht gefunden.' };
    if (catalogItem.isDefault) return { success: false, error: 'Standard-Gegenstände müssen nicht geschmiedet werden.' };

    const owned = stmtHasInventoryItem.get(userId, itemType, itemId);
    if (owned) return { success: false, error: 'Diesen Gegenstand besitzt du bereits.' };

    const rarityMeta = RARITY_CONFIG[catalogItem.rarity] || RARITY_CONFIG.common;
    const cost = rarityMeta.dustCost;

    const userRow = stmtFindUserById.get(userId);
    const curDust = userRow ? (userRow.astral_dust || 0) : 0;
    if (curDust < cost) {
      return { success: false, error: `Nicht genügend Astralstaub (benötigt: ${cost}, vorhanden: ${curDust}).` };
    }

    const newDust = curDust - cost;
    const tx = db.transaction(() => {
      db.prepare('UPDATE user_stats SET astral_dust = ? WHERE user_id = ?').run(newDust, userId);
      stmtInsertInventory.run(userId, itemType, itemId);
    });
    tx();

    return {
      success: true,
      item: catalogItem,
      newDustBalance: newDust
    };
  }

  function claimWeeklyMilestone(userId, milestoneId) {
    if (!userId) return { success: false, error: 'Nicht angemeldet.' };
    const milestone = WEEKLY_MILESTONES.find(m => m.id === milestoneId);
    if (!milestone) return { success: false, error: 'Meilenstein nicht gefunden.' };

    const userRow = stmtFindUserById.get(userId);
    if (!userRow) return { success: false, error: 'Benutzer nicht gefunden.' };

    let claimed = [];
    try { claimed = JSON.parse(userRow.weekly_claimed_milestones || '[]'); } catch (e) {}
    if (claimed.includes(milestoneId)) {
      return { success: false, error: 'Diesen Meilenstein hast du diese Woche bereits eingelöst.' };
    }

    let currentVal = 0;
    if (milestone.type === 'matches') currentVal = userRow.weekly_matches_played || 0;
    else if (milestone.type === 'wins') currentVal = userRow.weekly_matches_won || 0;
    else if (milestone.type === 'bids') currentVal = userRow.weekly_perfect_bids || 0;

    if (currentVal < milestone.target) {
      return { success: false, error: `Meilenstein noch nicht erreicht (${currentVal}/${milestone.target}).` };
    }

    claimed.push(milestoneId);
    let newWooden = userRow.chests_wooden || 0;
    let newSilver = userRow.chests_silver || 0;
    let newGold = userRow.chests_gold || 0;
    let newDust = userRow.astral_dust || 0;

    if (milestone.reward.type === 'chest') {
      if (milestone.reward.chestType === 'wooden') newWooden += (milestone.reward.amount || 1);
      else if (milestone.reward.chestType === 'silver') newSilver += (milestone.reward.amount || 1);
      else if (milestone.reward.chestType === 'gold') newGold += (milestone.reward.amount || 1);
    } else if (milestone.reward.type === 'dust') {
      newDust += (milestone.reward.amount || 0);
    }

    db.prepare(`
      UPDATE user_stats
      SET weekly_claimed_milestones = ?,
          chests_wooden = ?,
          chests_silver = ?,
          chests_gold = ?,
          astral_dust = ?
      WHERE user_id = ?
    `).run(JSON.stringify(claimed), newWooden, newSilver, newGold, newDust, userId);

    return {
      success: true,
      milestoneId,
      reward: milestone.reward,
      claimedMilestones: claimed,
      chests: { wooden: newWooden, silver: newSilver, gold: newGold },
      newDustBalance: newDust
    };
  }

  function applyMatchProgression(userId, matchStats = {}) {
    if (!userId) return null;
    const userRow = stmtFindUserById.get(userId);
    if (!userRow) return null;

    const curPeriod = getCurrentWeeklyPeriodId();
    let weeklyPlayed = userRow.weekly_matches_played || 0;
    let weeklyWon = userRow.weekly_matches_won || 0;
    let weeklyBids = userRow.weekly_perfect_bids || 0;
    let claimedMilestones = userRow.weekly_claimed_milestones || '[]';

    if (userRow.weekly_period_id !== curPeriod) {
      weeklyPlayed = 0;
      weeklyWon = 0;
      weeklyBids = 0;
      claimedMilestones = '[]';
    }

    weeklyPlayed += 1;
    if (matchStats.isWinner || matchStats.rank === 1) weeklyWon += 1;
    if (matchStats.bidsHit > 0) weeklyBids += matchStats.bidsHit;

    const gainedXP = calculateMatchXP(matchStats);
    const progress = calculateLevelProgress(userRow.account_level || 1, userRow.account_xp || 0, gainedXP);

    let newWooden = (userRow.chests_wooden || 0) + progress.chestsAwarded.wooden;
    let newSilver = (userRow.chests_silver || 0) + progress.chestsAwarded.silver;
    let newGold = (userRow.chests_gold || 0) + progress.chestsAwarded.gold;

    db.prepare(`
      UPDATE user_stats
      SET account_level = ?,
          account_xp = ?,
          chests_wooden = ?,
          chests_silver = ?,
          chests_gold = ?,
          weekly_matches_played = ?,
          weekly_matches_won = ?,
          weekly_perfect_bids = ?,
          weekly_claimed_milestones = ?,
          weekly_period_id = ?
      WHERE user_id = ?
    `).run(
      progress.newLevel,
      progress.currentXP,
      newWooden,
      newSilver,
      newGold,
      weeklyPlayed,
      weeklyWon,
      weeklyBids,
      claimedMilestones,
      curPeriod,
      userId
    );

    return {
      userId,
      gainedXP,
      oldLevel: progress.oldLevel,
      newLevel: progress.newLevel,
      leveledUp: progress.leveledUp,
      currentXP: progress.currentXP,
      xpRequired: progress.xpRequired,
      chestsAwarded: progress.chestsAwarded,
      chests: { wooden: newWooden, silver: newSilver, gold: newGold }
    };
  }

  function awardBonusXP(userId, bonusXP = 50) {
    if (!userId) return null;
    const userRow = stmtFindUserById.get(userId);
    if (!userRow) return null;

    const gainedXP = Math.max(0, parseInt(bonusXP, 10) || 0);
    const progress = calculateLevelProgress(userRow.account_level || 1, userRow.account_xp || 0, gainedXP);

    let newWooden = (userRow.chests_wooden || 0) + progress.chestsAwarded.wooden;
    let newSilver = (userRow.chests_silver || 0) + progress.chestsAwarded.silver;
    let newGold = (userRow.chests_gold || 0) + progress.chestsAwarded.gold;

    db.prepare(`
      UPDATE user_stats
      SET account_level = ?,
          account_xp = ?,
          chests_wooden = ?,
          chests_silver = ?,
          chests_gold = ?
      WHERE user_id = ?
    `).run(
      progress.newLevel,
      progress.currentXP,
      newWooden,
      newSilver,
      newGold,
      userId
    );

    return {
      userId,
      gainedXP,
      oldLevel: progress.oldLevel,
      newLevel: progress.newLevel,
      leveledUp: progress.leveledUp,
      currentXP: progress.currentXP,
      xpRequired: progress.xpRequired,
      chestsAwarded: progress.chestsAwarded,
      chests: { wooden: newWooden, silver: newSilver, gold: newGold }
    };
  }

  function awardCosmetic(userId, itemType, itemId) {
    if (!userId || !itemType || !itemId) return false;
    try {
      stmtInsertInventory.run(userId, itemType, itemId);
      return true;
    } catch (e) {
      return false;
    }
  }

  function closeDatabase() {
    try {
      if (dbPath !== ':memory:') {
        db.pragma('wal_checkpoint(TRUNCATE)');
      }
    } catch (e) {}
  }

  return {
    engine: 'sqlite',
    db,
    dbPath,
    isUsernameAvailable,
    registerUser,
    loginUser,
    getUserByToken,
    touchSession,
    backupDatabase,
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
    getUserById,
    addFriend,
    removeFriend,
    getFriends,
    getUserCosmetics,
    openChest,
    equipCosmetic,
    craftCosmetic,
    claimWeeklyMilestone,
    applyMatchProgression,
    awardBonusXP,
    awardCosmetic,
    closeDatabase
  };
}

module.exports = { createSqliteEngine };
