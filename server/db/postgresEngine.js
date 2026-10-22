const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
             st.pending_penalty_notice
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
             s.pending_penalty_notice
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

  async function backupDatabase() {
    return Promise.resolve({
      success: true,
      engine: 'postgres',
      note: 'PostgreSQL Backups werden über pg_dump oder Managed Cloud Snapshots ausgeführt.'
    });
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
    closeDatabase
  };
}

module.exports = { createPostgresEngine };
