const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('--- STARTE POSTGRESQL & DUAL-SUPPORT ARCHITEKTUR TESTS ---');

// 1. Standard-Verhalten: SQLite als Default Engine
const dbModule = require('../server/database');
assert.strictEqual(dbModule.getEngine(), 'sqlite', 'Standard-Engine muss SQLite sein, wenn keine DATABASE_URL gesetzt ist');
assert.strictEqual(dbModule.isPostgres(), false, 'isPostgres() muss false sein');
console.log('✓ 1. SQLite Default-Engine und Erkennung erfolgreich verifiziert');

// 2. Shared Helpers & Formatierung
const rank1 = dbModule.getRankDetailsFromSR(1000);
assert.strictEqual(rank1.tierKey, 'adept');
assert.strictEqual(rank1.division, 5);

const rankHigh = dbModule.getRankDetailsFromSR(3200);
assert.strictEqual(rankHigh.tierKey, 'high_council');
assert.strictEqual(rankHigh.divisionName, 'Oberster Rat');
console.log('✓ 2. Geteilte Rang- und Formatierungs-Helfer konsistent');

// 3. SQLite In-Memory Engine Factory
const memoryEngine = dbModule.createSqliteEngine(':memory:');
assert.strictEqual(memoryEngine.engine, 'sqlite');
const regMem = memoryEngine.registerUser('DualTester_1', 'geheim123', 'wizard_green');
assert.strictEqual(regMem.success, true);
assert.ok(regMem.token);
const foundMem = memoryEngine.getUserByToken(regMem.token);
assert.strictEqual(foundMem.username, 'DualTester_1');
console.log('✓ 3. SQLite Factory & In-Memory Isolation verifiziert');

// 4. PostgreSQL Engine Konstruktion & Query-Architektur
const { createPostgresEngine } = require('../server/db/postgresEngine');
const sharedHelpers = require('../server/db/sharedHelpers');

// Simulierter PostgreSQL Client / Pool für Offline-Unit-Test der SQL-Generierung
const executedQueries = [];
let queryResponses = {};

const mockClient = {
  query: async (sql, params = []) => {
    executedQueries.push({ sql: sql.trim(), params });
    if (sql.includes('SELECT id FROM users WHERE LOWER(username)')) {
      const username = params[0] ? params[0].toLowerCase() : '';
      if (queryResponses.existingUser && queryResponses.existingUser.toLowerCase() === username) {
        return { rows: [{ id: 42, username: params[0] }] };
      }
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO users')) {
      return { rows: [{ id: 101, username: params[0], avatar_id: params[2], title: 'Zauberlehrling', created_at: new Date() }] };
    }
    if (sql.includes('SELECT u.id, u.username')) {
      return {
        rows: [{
          id: 101,
          username: 'PgWizard',
          avatar_id: 'wizard_gold',
          title: 'Zauberlehrling',
          created_at: new Date(),
          games_played: 0,
          games_won: 0,
          games_lost: 0,
          current_streak: 0,
          max_win_streak: 0,
          podium_finishes: 0,
          total_points: 0,
          highest_score: 0,
          bids_made: 0,
          bids_hit: 0,
          wizards_played: 0,
          jesters_played: 0,
          skill_rating: 1000,
          highest_skill_rating: 1000,
          ranked_games_played: 0,
          ranked_games_won: 0,
          pending_penalty_notice: null
        }]
      };
    }
    return { rows: [] };
  },
  release: () => {}
};

const mockPool = {
  connect: async () => mockClient,
  query: async (sql, params = []) => mockClient.query(sql, params),
  end: async () => {}
};

// Teste createPostgresEngine mit Mock
(async () => {
  const pgEngine = createPostgresEngine(mockPool, sharedHelpers);

  // Initialisierung ausführen
  await pgEngine.ensureInitialized();
  const ddlQuery = executedQueries.find(q => q.sql.includes('CREATE TABLE IF NOT EXISTS users'));
  assert.ok(ddlQuery, 'PostgreSQL Schema-DDL muss CREATE TABLE IF NOT EXISTS users enthalten');
  assert.ok(ddlQuery.sql.includes('users_username_lower_idx'), 'Case-Insensitiv Index muss enthalten sein');
  assert.ok(ddlQuery.sql.includes('friendships'), 'friendships-Tabelle muss enthalten sein');
  console.log('✓ 4. PostgreSQL DDL-Schema & Index-Generierung verifiziert');

  // Prüfe Namens-Verfügbarkeit
  const availFree = await pgEngine.isUsernameAvailable('NewPgWiz');
  assert.strictEqual(availFree.available, true);
  assert.strictEqual(availFree.cleanName, 'NewPgWiz');

  const availReserved = await pgEngine.isUsernameAvailable('admin');
  assert.strictEqual(availReserved.available, false);
  console.log('✓ 5. PostgreSQL Username-Validierung & Reservierungsprüfung verifiziert');

  // 6. Migrationsskript Prüfung
  const migrationScriptPath = path.join(__dirname, '../server/migrateSqliteToPg.js');
  assert.ok(fs.existsSync(migrationScriptPath), 'server/migrateSqliteToPg.js muss existieren');
  const migrationContent = fs.readFileSync(migrationScriptPath, 'utf8');
  assert.ok(migrationContent.includes('INSERT INTO users'), 'Migrationsskript muss users übertragen');
  assert.ok(migrationContent.includes('INSERT INTO user_stats'), 'Migrationsskript muss user_stats übertragen');
  assert.ok(migrationContent.includes('INSERT INTO friendships'), 'Migrationsskript muss friendships übertragen');
  console.log('✓ 6. Migrationsskript (server/migrateSqliteToPg.js) verifiziert');

  // 7. Docker-Compose & Environment Prüfung
  const dockerComposePath = path.join(__dirname, '../docker-compose.yml');
  assert.ok(fs.existsSync(dockerComposePath), 'docker-compose.yml muss existieren');
  const envExamplePath = path.join(__dirname, '../.env.example');
  assert.ok(fs.existsSync(envExamplePath), '.env.example muss existieren');
  console.log('✓ 7. Docker Compose & .env.example verifiziert');

  console.log('\n======================================================');
  console.log('🏆 ALLE POSTGRESQL & DUAL-SUPPORT TESTS BESTANDEN!');
  console.log('======================================================\n');
})().catch(err => {
  console.error('Test fehlgeschlagen:', err);
  process.exit(1);
});
