const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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

function createPostgresEngine(connectionStringOrConfig, sharedHelpers) {
  const { getRankDetailsFromSR, formatUserWithRank, RESERVED_USERNAMES, validateUsername } = sharedHelpers;

  let pool;
  if (connectionStringOrConfig && typeof connectionStringOrConfig.connect === 'function') {
    pool = connectionStringOrConfig;
  } else {
    const poolConfig = typeof connectionStringOrConfig === 'string'
      ? { connectionString: connectionStringOrConfig }
      : (connectionStringOrConfig || {});

    // SSL-Handhabung für Cloud-Hosts (Render, Supabase, Neon, AWS RDS etc.)
    const connStr = poolConfig.connectionString || process.env.DATABASE_URL || '';
    const isCloudHost = connStr.includes('render.com') ||
      connStr.includes('supabase') ||
      connStr.includes('neon.tech') ||
      connStr.includes('sslmode=require') ||
      process.env.RENDER ||
      process.env.PGSSLMODE === 'require' ||
      process.env.NODE_ENV === 'production';

    if (connStr && !poolConfig.ssl && isCloudHost) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    pool = new Pool(poolConfig);
  }

  if (pool && typeof pool.on === 'function') {
    pool.on('error', (err) => {
      console.warn('[Database] PostgreSQL Client/Pool Warnung:', err.message);
    });
  }

  let initPromise = null;

  async function ensureInitialized() {
    if (!initPromise) {
      initPromise = (async () => {
        const client = await pool.connect();
        try {
          await client.query(`
            CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              username VARCHAR(32) NOT NULL,
              password_hash TEXT NOT NULL,
              avatar_id VARCHAR(64) DEFAULT 'wizard_blue',
              title VARCHAR(64) DEFAULT 'Zauberlehrling',
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));

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
              jesters_played INTEGER DEFAULT 0,
              skill_rating INTEGER DEFAULT 1000,
              highest_skill_rating INTEGER DEFAULT 1000,
              ranked_games_played INTEGER DEFAULT 0,
              ranked_games_won INTEGER DEFAULT 0,
              pending_penalty_notice TEXT DEFAULT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
              token VARCHAR(128) PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              expires_at TIMESTAMPTZ NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_achievements (
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              achievement_id VARCHAR(64) NOT NULL,
              unlocked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (user_id, achievement_id)
            );

            CREATE TABLE IF NOT EXISTS friendships (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, friend_id)
            );

            CREATE TABLE IF NOT EXISTS user_inventory (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              item_type VARCHAR(64) NOT NULL,
              item_id VARCHAR(64) NOT NULL,
              acquired_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, item_type, item_id)
            );

            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS account_level INTEGER DEFAULT 1;
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS account_xp INTEGER DEFAULT 0;
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS chests_wooden INTEGER DEFAULT 1;
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS chests_silver INTEGER DEFAULT 0;
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS chests_gold INTEGER DEFAULT 0;
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS astral_dust INTEGER DEFAULT 0;
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS weekly_matches_played INTEGER DEFAULT 0;
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS weekly_matches_won INTEGER DEFAULT 0;
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS weekly_perfect_bids INTEGER DEFAULT 0;
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS weekly_claimed_milestones TEXT DEFAULT '[]';
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS weekly_period_id VARCHAR(32) DEFAULT '';
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS equipped_card_back VARCHAR(64) DEFAULT 'default';
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS equipped_table_skin VARCHAR(64) DEFAULT 'emerald_felt';
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS equipped_avatar_frame VARCHAR(64) DEFAULT 'none';
            ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS equipped_lobby_background VARCHAR(64) DEFAULT 'citadel_halls';
          `);
        } finally {
          client.release();
        }
      })().catch(err => {
        initPromise = null;
        throw err;
      });
    }
    return initPromise;
  }

  function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async function isUsernameAvailable(username) {
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

    await ensureInitialized();
    const res = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [clean]);
    if (res.rows.length > 0) {
      return { available: false, error: `Der Spielername "${clean}" ist bereits vergeben.` };
    }

    return { available: true, cleanName: clean };
  }

  async function registerUser(username, password, avatarId = 'wizard_blue') {
    const availability = await isUsernameAvailable(username);
    if (!availability.available) {
      return { success: false, error: availability.error };
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return { success: false, error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' };
    }

    const cleanName = availability.cleanName;
    const hash = bcrypt.hashSync(password, 10);

    await ensureInitialized();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertUserRes = await client.query(
        'INSERT INTO users (username, password_hash, avatar_id) VALUES ($1, $2, $3) RETURNING id, username, avatar_id, title, created_at',
        [cleanName, hash, avatarId || 'wizard_blue']
      );
      const userId = insertUserRes.rows[0].id;

      await client.query(
        'INSERT INTO user_stats (user_id, skill_rating, highest_skill_rating) VALUES ($1, 1000, 1000)',
        [userId]
      );

      const token = generateSessionToken();
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      await client.query(
        'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
        [token, userId, expiresAt]
      );

      await client.query('COMMIT');

      const fullUser = await getUserById(userId);
      return { success: true, token, user: formatUserWithRank(fullUser) };
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') { // unique_violation
        return { success: false, error: `Der Spielername "${cleanName}" ist bereits vergeben.` };
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async function loginUser(username, password) {
    if (!username || !password) {
      return { success: false, error: 'Bitte gib Benutzername und Passwort ein.' };
    }

    await ensureInitialized();
    const cleanName = username.trim();
    const res = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [cleanName]);
    const user = res.rows[0];
    if (!user) {
      return { success: false, error: 'Ungültiger Benutzername oder falsches Passwort.' };
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return { success: false, error: 'Ungültiger Benutzername oder falsches Passwort.' };
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, user.id, expiresAt]);

    const fullUser = await getUserById(user.id);
    return { success: true, token, user: formatUserWithRank(fullUser) };
  }

  async function touchSession(token) {
    if (!token) return;
    try {
      await ensureInitialized();
      const newExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      await pool.query('UPDATE sessions SET expires_at = $1 WHERE token = $2', [newExpiry, token]);
    } catch (e) {}
  }

  async function getUserByToken(token, refresh = true) {
    if (!token || typeof token !== 'string') return null;
    await ensureInitialized();

    const query = `
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
      WHERE s.token = $1
    `;
    const res = await pool.query(query, [token]);
    const row = res.rows[0];
    if (!row) return null;

    if (new Date(row.expires_at) < new Date()) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
      return null;
    }

    if (refresh) {
      await touchSession(token);
    }

    return formatUserWithRank(row);
  }

  async function logoutUser(token) {
    if (token) {
      await ensureInitialized();
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    }
    return { success: true };
  }

  async function getUserById(id) {
    if (!id) return null;
    await ensureInitialized();
    const query = `
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
      WHERE u.id = $1
    `;
    const res = await pool.query(query, [id]);
    return formatUserWithRank(res.rows[0]);
  }

  async function updateUserProfile(userId, { avatar_id, title }) {
    await ensureInitialized();
    await pool.query(
      'UPDATE users SET avatar_id = COALESCE($1, avatar_id), title = COALESCE($2, title) WHERE id = $3',
      [avatar_id || null, title || null, userId]
    );
    return await getUserById(userId);
  }

  async function recordRoundBid(userId, bid, tricksWon) {
    if (!userId) return;
    await ensureInitialized();
    const hit = (bid === tricksWon) ? 1 : 0;
    await pool.query(`
      UPDATE user_stats 
      SET bids_made = bids_made + 1,
          bids_hit = bids_hit + $1
      WHERE user_id = $2
    `, [hit, userId]);
  }

  async function recordSpecialCard(userId, cardType) {
    if (!userId) return;
    await ensureInitialized();
    if (cardType === 'wizard') {
      await pool.query('UPDATE user_stats SET wizards_played = wizards_played + 1 WHERE user_id = $1', [userId]);
    } else if (cardType === 'jester') {
      await pool.query('UPDATE user_stats SET jesters_played = jesters_played + 1 WHERE user_id = $1', [userId]);
    }
  }

  async function grantAchievement(userId, achievementId) {
    try {
      await ensureInitialized();
      await pool.query(
        'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, achievementId]
      );
    } catch (e) {}
  }

  async function checkAndGrantTitles(userId, { totalWins, maxStreak, bidsMade, bidsHit, hadZeroWizardTrickWin }) {
    if (totalWins >= 25) {
      await grantAchievement(userId, 'title_grandmaster');
    }
    if (maxStreak >= 5) {
      await grantAchievement(userId, 'title_invincible');
    }
    if (bidsMade >= 20 && (bidsHit / bidsMade) >= 0.75) {
      await grantAchievement(userId, 'title_seer');
    }
    if (hadZeroWizardTrickWin) {
      await grantAchievement(userId, 'title_illusion_master');
    }
  }

  async function recordGameFinished(userId, { rank, totalPlayers, points, hadZeroWizardTrickWin }) {
    if (!userId) return;
    await ensureInitialized();
    const isWin = (rank === 1);
    const isPodium = (rank <= 3 && totalPlayers >= 3);

    const res = await pool.query(
      'SELECT current_streak, max_win_streak, highest_score, bids_made, bids_hit, games_won FROM user_stats WHERE user_id = $1',
      [userId]
    );
    const current = res.rows[0];
    if (!current) return;

    const newCurrentStreak = isWin ? (current.current_streak + 1) : 0;
    const newMaxStreak = Math.max(current.max_win_streak, newCurrentStreak);
    const newHighestScore = Math.max(current.highest_score, points || 0);
    const gamesWonInc = isWin ? 1 : 0;
    const gamesLostInc = isWin ? 0 : 1;
    const podiumInc = isPodium ? 1 : 0;

    await pool.query(`
      UPDATE user_stats
      SET games_played = games_played + 1,
          games_won = games_won + $1,
          games_lost = games_lost + $2,
          current_streak = $3,
          max_win_streak = $4,
          podium_finishes = podium_finishes + $5,
          total_points = total_points + $6,
          highest_score = $7
      WHERE user_id = $8
    `, [gamesWonInc, gamesLostInc, newCurrentStreak, newMaxStreak, podiumInc, points || 0, newHighestScore, userId]);

    await checkAndGrantTitles(userId, {
      totalWins: current.games_won + gamesWonInc,
      maxStreak: newMaxStreak,
      bidsMade: current.bids_made,
      bidsHit: current.bids_hit,
      hadZeroWizardTrickWin
    });
  }

  async function getLeaderboard(limit = 10) {
    await ensureInitialized();
    const query = `
      SELECT u.id, u.username, u.avatar_id, u.title,
             s.games_played, s.games_won, s.games_lost, s.max_win_streak, s.highest_score,
             s.bids_made, s.bids_hit, s.total_points, s.skill_rating
      FROM users u
      JOIN user_stats s ON u.id = s.user_id
      WHERE s.games_played > 0
      ORDER BY s.games_won DESC, s.highest_score DESC, s.total_points DESC
      LIMIT $1
    `;
    const res = await pool.query(query, [limit]);
    return res.rows.map(r => ({
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

  async function getRankedLeaderboard(limit = 25) {
    await ensureInitialized();
    const query = `
      SELECT u.id, u.username, u.avatar_id, u.title,
             s.skill_rating, s.highest_skill_rating, s.ranked_games_played, s.ranked_games_won,
             s.games_played, s.games_won, s.bids_made, s.bids_hit
      FROM users u
      JOIN user_stats s ON u.id = s.user_id
      WHERE s.ranked_games_played > 0 OR s.skill_rating != 1000
      ORDER BY s.skill_rating DESC, s.ranked_games_won DESC, s.highest_skill_rating DESC
      LIMIT $1
    `;
    const res = await pool.query(query, [limit]);
    return res.rows.map((r, idx) => {
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

  async function recordRankedGameFinished(userId, { rank, totalPlayers, points, bidsMade, bidsHit }) {
    if (!userId) return null;
    await ensureInitialized();
    const res = await pool.query(
      'SELECT skill_rating, highest_skill_rating, ranked_games_played, ranked_games_won FROM user_stats WHERE user_id = $1',
      [userId]
    );
    const current = res.rows[0];
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

    await pool.query(`
      UPDATE user_stats
      SET skill_rating = $1,
          highest_skill_rating = $2,
          ranked_games_played = ranked_games_played + 1,
          ranked_games_won = ranked_games_won + $3
      WHERE user_id = $4
    `, [newSR, newHighest, rankedWonInc, userId]);

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

  async function applyLeaverPenalty(userId) {
    if (!userId) return null;
    await ensureInitialized();
    const res = await pool.query('SELECT skill_rating FROM user_stats WHERE user_id = $1', [userId]);
    const current = res.rows[0];
    if (!current) return null;

    const oldSR = current.skill_rating || 1000;
    const penalty = 50;
    const newSR = Math.max(0, oldSR - penalty);

    const notice = '⚠️ RATS-VERWARNUNG: Du hast eine gewertete Partie vorzeitig verlassen. Der Hohe Rat hat dir -50 Rangpunkte (SR) aberkannt!';

    await pool.query(`
      UPDATE user_stats
      SET skill_rating = $1,
          pending_penalty_notice = $2
      WHERE user_id = $3
    `, [newSR, notice, userId]);

    return { oldSR, newSR, penalty, notice };
  }

  async function popPenaltyNotice(userId) {
    if (!userId) return null;
    await ensureInitialized();
    const res = await pool.query('SELECT pending_penalty_notice FROM user_stats WHERE user_id = $1', [userId]);
    const row = res.rows[0];
    if (!row || !row.pending_penalty_notice) return null;

    const notice = row.pending_penalty_notice;
    await pool.query('UPDATE user_stats SET pending_penalty_notice = NULL WHERE user_id = $1', [userId]);
    return notice;
  }

  async function addFriend(userId, friendUsername) {
    if (!userId) return { success: false, error: 'Nicht authentifiziert.' };
    if (!friendUsername || typeof friendUsername !== 'string') {
      return { success: false, error: 'Bitte gib einen gültigen Magiernamen ein.' };
    }
    const cleanName = friendUsername.trim();
    await ensureInitialized();

    const userRes = await pool.query('SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)', [cleanName]);
    const targetUser = userRes.rows[0];
    if (!targetUser) {
      return { success: false, error: `Kein Magier namens "${cleanName}" in den Gildenbüchern gefunden.` };
    }
    if (targetUser.id === userId) {
      return { success: false, error: 'Du kannst dich nicht selbst als Gefährten aufnehmen.' };
    }

    const friendCheck = await pool.query('SELECT id FROM friendships WHERE user_id = $1 AND friend_id = $2', [userId, targetUser.id]);
    if (friendCheck.rows.length > 0) {
      return { success: false, error: `${targetUser.username} ist bereits dein Gefährte.` };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, targetUser.id]
      );
      await client.query(
        'INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [targetUser.id, userId]
      );
      await client.query('COMMIT');

      const friendFull = await getUserById(targetUser.id);
      return { success: true, friend: friendFull };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async function removeFriend(userId, friendId) {
    if (!userId || !friendId) return { success: false, error: 'Ungültige Anfrage.' };
    await ensureInitialized();
    await pool.query(
      'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [userId, friendId]
    );
    return { success: true };
  }

  async function getFriends(userId) {
    if (!userId) return [];
    await ensureInitialized();
    const query = `
      SELECT u.id, u.username, u.avatar_id, u.title, u.created_at,
             s.games_played, s.games_won, s.games_lost, s.current_streak, s.max_win_streak,
             s.podium_finishes, s.total_points, s.highest_score, s.bids_made, s.bids_hit,
             s.wizards_played, s.jesters_played,
             s.skill_rating, s.highest_skill_rating, s.ranked_games_played, s.ranked_games_won
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      LEFT JOIN user_stats s ON u.id = s.user_id
      WHERE f.user_id = $1
      ORDER BY LOWER(u.username) ASC
    `;
    const res = await pool.query(query, [userId]);
    return res.rows.map(r => formatUserWithRank(r));
  }

  async function getUserCosmetics(userId) {
    if (!userId) return null;
    await ensureInitialized();
    const user = await getUserById(userId);
    if (!user) return null;

    const curPeriod = getCurrentWeeklyPeriodId();
    if (user.weekly_period_id !== curPeriod) {
      await pool.query(`
        UPDATE user_stats
        SET weekly_matches_played = 0,
            weekly_matches_won = 0,
            weekly_perfect_bids = 0,
            weekly_claimed_milestones = '[]',
            weekly_period_id = $1
        WHERE user_id = $2
      `, [curPeriod, userId]);
      user.weekly_matches_played = 0;
      user.weekly_matches_won = 0;
      user.weekly_perfect_bids = 0;
      user.weekly_claimed_milestones = '[]';
      user.weekly_period_id = curPeriod;
    }

    const invRes = await pool.query('SELECT item_type, item_id, acquired_at FROM user_inventory WHERE user_id = $1', [userId]);
    let claimedMilestones = [];
    try {
      claimedMilestones = JSON.parse(user.weekly_claimed_milestones || '[]');
    } catch (e) {
      claimedMilestones = [];
    }

    return {
      success: true,
      user,
      inventory: invRes.rows,
      catalog: COSMETICS_CATALOG,
      rarityConfig: RARITY_CONFIG,
      chestTiers: CHEST_TIERS,
      weeklyMilestones: WEEKLY_MILESTONES,
      weeklyStats: {
        periodId: curPeriod,
        matchesPlayed: user.weekly_matches_played || 0,
        matchesWon: user.weekly_matches_won || 0,
        perfectBids: user.weekly_perfect_bids || 0,
        claimedMilestones
      }
    };
  }

  async function openChest(userId, chestType) {
    if (!userId) return { success: false, error: 'Nicht angemeldet.' };
    const validTiers = ['wooden', 'silver', 'gold'];
    if (!validTiers.includes(chestType)) {
      return { success: false, error: 'Ungültiger Truhentyp.' };
    }

    await ensureInitialized();
    const user = await getUserById(userId);
    if (!user) return { success: false, error: 'Benutzer nicht gefunden.' };

    const chestCol = `chests_${chestType}`;
    const available = user[chestCol] || 0;
    if (available < 1) {
      const tierName = CHEST_TIERS[chestType] ? CHEST_TIERS[chestType].name : 'Truhen';
      return { success: false, error: `Keine ${tierName} verfügbar.` };
    }

    const invRes = await pool.query('SELECT item_id FROM user_inventory WHERE user_id = $1', [userId]);
    const ownedIds = invRes.rows.map(r => r.item_id);

    const rollRes = rollChestRewards(chestType, ownedIds);
    const newChestCount = available - 1;
    const newDust = (user.astral_dust || 0) + (rollRes.totalDustGained || 0);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE user_stats SET ${chestCol} = $1, astral_dust = $2 WHERE user_id = $3`, [newChestCount, newDust, userId]);
      for (const item of rollRes.rewards) {
        if (!item.isDuplicate) {
          let singularType = item.type;
          if (singularType.endsWith('s')) singularType = singularType.slice(0, -1);
          if (['avatar_icon', 'card_back', 'table_skin', 'avatar_frame', 'title', 'lobby_background'].includes(singularType)) {
            await client.query(
              'INSERT INTO user_inventory (user_id, item_type, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [userId, singularType, item.id]
            );
          }
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      success: true,
      chestType,
      rewards: rollRes.rewards,
      totalDustGained: rollRes.totalDustGained,
      remainingChests: newChestCount,
      newDustBalance: newDust
    };
  }

  async function equipCosmetic(userId, itemType, itemId) {
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

    await ensureInitialized();
    if (!catalogItem.isDefault) {
      const check = await pool.query('SELECT id FROM user_inventory WHERE user_id = $1 AND item_type = $2 AND item_id = $3', [userId, itemType, itemId]);
      if (check.rows.length === 0) {
        return { success: false, error: 'Diesen Gegenstand besitzt du noch nicht.' };
      }
    }

    if (itemType === 'avatar_icon') {
      await pool.query('UPDATE users SET avatar_id = $1 WHERE id = $2', [itemId, userId]);
    } else if (itemType === 'title') {
      await pool.query('UPDATE users SET title = $1 WHERE id = $2', [itemId, userId]);
    } else if (itemType === 'card_back') {
      await pool.query('UPDATE user_stats SET equipped_card_back = $1 WHERE user_id = $2', [itemId, userId]);
    } else if (itemType === 'table_skin') {
      await pool.query('UPDATE user_stats SET equipped_table_skin = $1 WHERE user_id = $2', [itemId, userId]);
    } else if (itemType === 'avatar_frame') {
      await pool.query('UPDATE user_stats SET equipped_avatar_frame = $1 WHERE user_id = $2', [itemId, userId]);
    } else if (itemType === 'lobby_background') {
      await pool.query('UPDATE user_stats SET equipped_lobby_background = $1 WHERE user_id = $2', [itemId, userId]);
    }

    const updatedUser = await getUserById(userId);
    return { success: true, itemType, itemId, user: updatedUser };
  }

  async function craftCosmetic(userId, itemType, itemId) {
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

    await ensureInitialized();
    const check = await pool.query('SELECT id FROM user_inventory WHERE user_id = $1 AND item_type = $2 AND item_id = $3', [userId, itemType, itemId]);
    if (check.rows.length > 0) return { success: false, error: 'Diesen Gegenstand besitzt du bereits.' };

    const rarityMeta = RARITY_CONFIG[catalogItem.rarity] || RARITY_CONFIG.common;
    const cost = rarityMeta.dustCost;

    const user = await getUserById(userId);
    const curDust = user ? (user.astral_dust || 0) : 0;
    if (curDust < cost) {
      return { success: false, error: `Nicht genügend Astralstaub (benötigt: ${cost}, vorhanden: ${curDust}).` };
    }

    const newDust = curDust - cost;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE user_stats SET astral_dust = $1 WHERE user_id = $2', [newDust, userId]);
      await client.query('INSERT INTO user_inventory (user_id, item_type, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, itemType, itemId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      success: true,
      item: catalogItem,
      newDustBalance: newDust
    };
  }

  async function claimWeeklyMilestone(userId, milestoneId) {
    if (!userId) return { success: false, error: 'Nicht angemeldet.' };
    const milestone = WEEKLY_MILESTONES.find(m => m.id === milestoneId);
    if (!milestone) return { success: false, error: 'Meilenstein nicht gefunden.' };

    await ensureInitialized();
    const user = await getUserById(userId);
    if (!user) return { success: false, error: 'Benutzer nicht gefunden.' };

    let claimed = [];
    try { claimed = JSON.parse(user.weekly_claimed_milestones || '[]'); } catch (e) {}
    if (claimed.includes(milestoneId)) {
      return { success: false, error: 'Diesen Meilenstein hast du diese Woche bereits eingelöst.' };
    }

    let currentVal = 0;
    if (milestone.type === 'matches') currentVal = user.weekly_matches_played || 0;
    else if (milestone.type === 'wins') currentVal = user.weekly_matches_won || 0;
    else if (milestone.type === 'bids') currentVal = user.weekly_perfect_bids || 0;

    if (currentVal < milestone.target) {
      return { success: false, error: `Meilenstein noch nicht erreicht (${currentVal}/${milestone.target}).` };
    }

    claimed.push(milestoneId);
    let newWooden = user.chests_wooden || 0;
    let newSilver = user.chests_silver || 0;
    let newGold = user.chests_gold || 0;
    let newDust = user.astral_dust || 0;

    if (milestone.reward.type === 'chest') {
      if (milestone.reward.chestType === 'wooden') newWooden += (milestone.reward.amount || 1);
      else if (milestone.reward.chestType === 'silver') newSilver += (milestone.reward.amount || 1);
      else if (milestone.reward.chestType === 'gold') newGold += (milestone.reward.amount || 1);
    } else if (milestone.reward.type === 'dust') {
      newDust += (milestone.reward.amount || 0);
    }

    await pool.query(`
      UPDATE user_stats
      SET weekly_claimed_milestones = $1,
          chests_wooden = $2,
          chests_silver = $3,
          chests_gold = $4,
          astral_dust = $5
      WHERE user_id = $6
    `, [JSON.stringify(claimed), newWooden, newSilver, newGold, newDust, userId]);

    return {
      success: true,
      milestoneId,
      reward: milestone.reward,
      claimedMilestones: claimed,
      chests: { wooden: newWooden, silver: newSilver, gold: newGold },
      newDustBalance: newDust
    };
  }

  async function applyMatchProgression(userId, matchStats = {}) {
    if (!userId) return null;
    await ensureInitialized();
    const user = await getUserById(userId);
    if (!user) return null;

    const curPeriod = getCurrentWeeklyPeriodId();
    let weeklyPlayed = user.weekly_matches_played || 0;
    let weeklyWon = user.weekly_matches_won || 0;
    let weeklyBids = user.weekly_perfect_bids || 0;
    let claimedMilestones = user.weekly_claimed_milestones || '[]';

    if (user.weekly_period_id !== curPeriod) {
      weeklyPlayed = 0;
      weeklyWon = 0;
      weeklyBids = 0;
      claimedMilestones = '[]';
    }

    weeklyPlayed += 1;
    if (matchStats.isWinner || matchStats.rank === 1) weeklyWon += 1;
    if (matchStats.bidsHit > 0) weeklyBids += matchStats.bidsHit;

    const gainedXP = calculateMatchXP(matchStats);
    const progress = calculateLevelProgress(user.account_level || 1, user.account_xp || 0, gainedXP);

    let newWooden = (user.chests_wooden || 0) + progress.chestsAwarded.wooden;
    let newSilver = (user.chests_silver || 0) + progress.chestsAwarded.silver;
    let newGold = (user.chests_gold || 0) + progress.chestsAwarded.gold;

    await pool.query(`
      UPDATE user_stats
      SET account_level = $1,
          account_xp = $2,
          chests_wooden = $3,
          chests_silver = $4,
          chests_gold = $5,
          weekly_matches_played = $6,
          weekly_matches_won = $7,
          weekly_perfect_bids = $8,
          weekly_claimed_milestones = $9,
          weekly_period_id = $10
      WHERE user_id = $11
    `, [
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
    ]);

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

  async function awardBonusXP(userId, bonusXP = 50) {
    if (!userId) return null;
    await ensureInitialized();
    const user = await getUserById(userId);
    if (!user) return null;

    const gainedXP = Math.max(0, parseInt(bonusXP, 10) || 0);
    const progress = calculateLevelProgress(user.account_level || 1, user.account_xp || 0, gainedXP);

    let newWooden = (user.chests_wooden || 0) + progress.chestsAwarded.wooden;
    let newSilver = (user.chests_silver || 0) + progress.chestsAwarded.silver;
    let newGold = (user.chests_gold || 0) + progress.chestsAwarded.gold;

    await pool.query(`
      UPDATE user_stats
      SET account_level = $1,
          account_xp = $2,
          chests_wooden = $3,
          chests_silver = $4,
          chests_gold = $5
      WHERE user_id = $6
    `, [
      progress.newLevel,
      progress.currentXP,
      newWooden,
      newSilver,
      newGold,
      userId
    ]);

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

  async function awardCosmetic(userId, itemType, itemId) {
    if (!userId || !itemType || !itemId) return false;
    await ensureInitialized();
    try {
      await pool.query('INSERT INTO user_inventory (user_id, item_type, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, itemType, itemId]);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function backupDatabase() {
    return Promise.resolve({
      success: true,
      engine: 'postgres',
      note: 'PostgreSQL Backups werden über pg_dump oder Managed Cloud Snapshots ausgeführt.'
    });
  }

  async function restoreUserPhoenix(payload) {
    if (!payload || !payload.username) {
      return { success: false, error: 'Ungültiger Wiederherstellungs-Payload.' };
    }
    const cleanName = payload.username.trim();
    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: 'Ungültiger Benutzername.' };
    }

    await ensureInitialized();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query('SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)', [cleanName]);
      let userId;

      if (userRes.rows.length === 0) {
        const passHash = payload.passwordHash || (payload.recoveryKey ? await bcrypt.hash(payload.recoveryKey, 10) : await bcrypt.hash('phoenix_' + Date.now(), 10));
        const insUser = await client.query(`
          INSERT INTO users (username, password_hash, avatar_id, title)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [cleanName, passHash, payload.avatarId || 'default', payload.title || 'Novize der Akademie']);
        userId = insUser.rows[0].id;

        await client.query(`
          INSERT INTO user_stats (
            user_id, account_level, account_xp, chests_wooden, chests_silver, chests_gold, astral_dust,
            equipped_card_back, equipped_table_skin, equipped_avatar_frame, equipped_lobby_background
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          userId,
          Math.max(1, payload.accountLevel || 1),
          Math.max(0, payload.currentXp || 0),
          Math.max(0, payload.chestsWooden ?? 1),
          Math.max(0, payload.chestsSilver || 0),
          Math.max(0, payload.chestsGold || 0),
          Math.max(0, payload.astralDust || 0),
          payload.equipped?.equipped_card_back || 'default',
          payload.equipped?.equipped_table_skin || 'emerald_felt',
          payload.equipped?.equipped_avatar_frame || 'none',
          payload.equipped?.equipped_lobby_background || 'citadel_halls'
        ]);
      } else {
        userId = userRes.rows[0].id;
        if (payload.avatarId || payload.title) {
          await client.query('UPDATE users SET avatar_id = COALESCE($1, avatar_id), title = COALESCE($2, title) WHERE id = $3',
            [payload.avatarId || null, payload.title || null, userId]);
        }
        await client.query(`
          UPDATE user_stats SET
            account_level = GREATEST(account_level, $1),
            account_xp = GREATEST(account_xp, $2),
            astral_dust = GREATEST(astral_dust, $3),
            chests_wooden = GREATEST(chests_wooden, $4),
            chests_silver = GREATEST(chests_silver, $5),
            chests_gold = GREATEST(chests_gold, $6),
            equipped_card_back = COALESCE($7, equipped_card_back),
            equipped_table_skin = COALESCE($8, equipped_table_skin),
            equipped_avatar_frame = COALESCE($9, equipped_avatar_frame),
            equipped_lobby_background = COALESCE($10, equipped_lobby_background)
          WHERE user_id = $11
        `, [
          payload.accountLevel || 1,
          payload.currentXp || 0,
          payload.astralDust || 0,
          payload.chestsWooden || 0,
          payload.chestsSilver || 0,
          payload.chestsGold || 0,
          payload.equipped?.equipped_card_back || null,
          payload.equipped?.equipped_table_skin || null,
          payload.equipped?.equipped_avatar_frame || null,
          payload.equipped?.equipped_lobby_background || null,
          userId
        ]);
      }

      if (Array.isArray(payload.inventory)) {
        for (const item of payload.inventory) {
          if (item && item.item_type && item.item_id) {
            await client.query(`
              INSERT INTO user_inventory (user_id, item_type, item_id, acquired_at)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (user_id, item_type, item_id) DO NOTHING
            `, [userId, item.item_type, item.item_id, item.acquired_at || new Date().toISOString()]);
          }
        }
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await client.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expiresAt]);

      await client.query('COMMIT');

      const fullUser = await getUserById(userId);
      return { success: true, token, user: fullUser };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[Database] PostgreSQL restoreUserPhoenix Fehler:', err);
      return { success: false, error: err.message };
    } finally {
      client.release();
    }
  }

  async function closeDatabase() {
    try {
      await pool.end();
    } catch (e) {}
  }

  return {
    engine: 'postgres',
    pool,
    db: pool,
    ensureInitialized,
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
    restoreUserPhoenix,
    exportAccountsBackup: async () => true,
    importAccountsBackupIfEmpty: async () => true,
    closeDatabase
  };
}

module.exports = { createPostgresEngine };
