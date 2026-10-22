/**
 * Migrationsskript: Überträgt alle vorhandenen Daten (Accounts, Statistiken,
 * Freundschaften, Errungenschaften, Sessions) aus der lokalen SQLite-Datenbank (wizard.db)
 * in eine vollwertige PostgreSQL-Datenbank.
 * 
 * Ausführung:
 * node server/migrateSqliteToPg.js [DATABASE_URL]
 * oder:
 * DATABASE_URL=postgres://user:pass@localhost:5432/dbname npm run db:migrate:pg
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

async function migrate() {
  const pgUrl = process.argv[2] || process.env.DATABASE_URL || 'postgres://wizard:secret@localhost:5432/grimoire_db';
  const sqlitePath = process.env.WIZARD_DB_PATH || path.join(__dirname, 'data/wizard.db');

  console.log('====================================================');
  console.log('🧙 GRIMOIRE ONLINE – DATENBANK-MIGRATION (SQLite ➔ PostgreSQL)');
  console.log('====================================================');
  console.log(`📂 SQLite Quelle:     ${sqlitePath}`);
  console.log(`🐘 PostgreSQL Ziel:   ${pgUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log('----------------------------------------------------');

  if (!fs.existsSync(sqlitePath)) {
    console.error(`❌ FEHLER: SQLite-Datei "${sqlitePath}" existiert nicht.`);
    process.exit(1);
  }

  const sqlite = new Database(sqlitePath, { readonly: true });
  const isCloudHost = pgUrl.includes('render.com') ||
    pgUrl.includes('supabase') ||
    pgUrl.includes('neon.tech') ||
    pgUrl.includes('sslmode=require') ||
    process.env.PGSSLMODE === 'require';

  const pool = new Pool({
    connectionString: pgUrl,
    ssl: isCloudHost ? { rejectUnauthorized: false } : undefined
  });

  const client = await pool.connect();
  try {
    console.log('⚡ Erstelle PostgreSQL-Schema falls noch nicht vorhanden...');
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

    await client.query('BEGIN');

    // 1. Users übertragen
    const users = sqlite.prepare('SELECT id, username, password_hash, avatar_id, title, created_at FROM users').all();
    console.log(`📦 Gefundene Accounts in SQLite: ${users.length}`);

    let usersMigrated = 0;
    for (const u of users) {
      await client.query(`
        INSERT INTO users (id, username, password_hash, avatar_id, title, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          password_hash = EXCLUDED.password_hash,
          avatar_id = EXCLUDED.avatar_id,
          title = EXCLUDED.title
      `, [u.id, u.username, u.password_hash, u.avatar_id || 'wizard_blue', u.title || 'Zauberlehrling', u.created_at]);
      usersMigrated++;
    }

    // Sequence für users aktualisieren
    if (users.length > 0) {
      await client.query(`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))`);
    }
    console.log(`✅ ${usersMigrated} Accounts erfolgreich synchronisiert.`);

    // 2. User Stats übertragen
    const stats = sqlite.prepare(`
      SELECT user_id, games_played, games_won, games_lost, current_streak, max_win_streak,
             podium_finishes, total_points, highest_score, bids_made, bids_hit,
             wizards_played, jesters_played, skill_rating, highest_skill_rating,
             ranked_games_played, ranked_games_won, pending_penalty_notice
      FROM user_stats
    `).all();
    console.log(`📊 Gefundene Statistiken: ${stats.length}`);

    let statsMigrated = 0;
    for (const s of stats) {
      await client.query(`
        INSERT INTO user_stats (
          user_id, games_played, games_won, games_lost, current_streak, max_win_streak,
          podium_finishes, total_points, highest_score, bids_made, bids_hit,
          wizards_played, jesters_played, skill_rating, highest_skill_rating,
          ranked_games_played, ranked_games_won, pending_penalty_notice
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (user_id) DO UPDATE SET
          games_played = EXCLUDED.games_played,
          games_won = EXCLUDED.games_won,
          games_lost = EXCLUDED.games_lost,
          current_streak = EXCLUDED.current_streak,
          max_win_streak = EXCLUDED.max_win_streak,
          podium_finishes = EXCLUDED.podium_finishes,
          total_points = EXCLUDED.total_points,
          highest_score = EXCLUDED.highest_score,
          bids_made = EXCLUDED.bids_made,
          bids_hit = EXCLUDED.bids_hit,
          wizards_played = EXCLUDED.wizards_played,
          jesters_played = EXCLUDED.jesters_played,
          skill_rating = EXCLUDED.skill_rating,
          highest_skill_rating = EXCLUDED.highest_skill_rating,
          ranked_games_played = EXCLUDED.ranked_games_played,
          ranked_games_won = EXCLUDED.ranked_games_won,
          pending_penalty_notice = EXCLUDED.pending_penalty_notice
      `, [
        s.user_id, s.games_played || 0, s.games_won || 0, s.games_lost || 0, s.current_streak || 0, s.max_win_streak || 0,
        s.podium_finishes || 0, s.total_points || 0, s.highest_score || 0, s.bids_made || 0, s.bids_hit || 0,
        s.wizards_played || 0, s.jesters_played || 0, s.skill_rating || 1000, s.highest_skill_rating || 1000,
        s.ranked_games_played || 0, s.ranked_games_won || 0, s.pending_penalty_notice || null
      ]);
      statsMigrated++;
    }
    console.log(`✅ ${statsMigrated} Spielstatistiken übertragen.`);

    // 3. Aktive Sessions übertragen (nur unverschimmelte)
    const nowIso = new Date().toISOString();
    const sessions = sqlite.prepare('SELECT token, user_id, created_at, expires_at FROM sessions WHERE expires_at > ?').all(nowIso);
    console.log(`🗝️ Aktive Sessions: ${sessions.length}`);
    for (const sess of sessions) {
      await client.query(`
        INSERT INTO sessions (token, user_id, created_at, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at
      `, [sess.token, sess.user_id, sess.created_at, sess.expires_at]);
    }
    console.log(`✅ ${sessions.length} aktive Sessions gesichert.`);

    // 4. Errungenschaften übertragen
    const achievements = sqlite.prepare('SELECT user_id, achievement_id, unlocked_at FROM user_achievements').all();
    for (const a of achievements) {
      await client.query(`
        INSERT INTO user_achievements (user_id, achievement_id, unlocked_at)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [a.user_id, a.achievement_id, a.unlocked_at]);
    }
    console.log(`🏆 ${achievements.length} Errungenschaften übertragen.`);

    // 5. Freundschaften übertragen
    const friendships = sqlite.prepare('SELECT id, user_id, friend_id, created_at FROM friendships').all();
    console.log(`👥 Gefährten-Bindungen: ${friendships.length}`);
    for (const f of friendships) {
      await client.query(`
        INSERT INTO friendships (id, user_id, friend_id, created_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, friend_id) DO NOTHING
      `, [f.id, f.user_id, f.friend_id, f.created_at]);
    }
    if (friendships.length > 0) {
      await client.query(`SELECT setval(pg_get_serial_sequence('friendships', 'id'), COALESCE((SELECT MAX(id) FROM friendships), 1))`);
    }
    console.log(`✅ ${friendships.length} Freundschaften übertragen.`);

    await client.query('COMMIT');

    console.log('----------------------------------------------------');
    console.log('🎉 MIGRATION VOLLSTÄNDIG & ERFOLGREICH ABGESCHLOSSEN!');
    console.log('Alle deine Accounts stehen dir nun in PostgreSQL zur Verfügung.');
    console.log('====================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ MIGRATION FEHLGESCHLAGEN:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

if (require.main === module) {
  migrate().catch(err => {
    console.error('Unerwarteter Fehler:', err);
    process.exit(1);
  });
}

module.exports = { migrate };
