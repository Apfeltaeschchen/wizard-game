/**
 * Bereinigungsskript: Entfernt alle generierten Test-Accounts aus Supabase und lokaler SQLite.
 */

const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function cleanTestAccounts() {
  const pgUrl = process.argv[2] || process.env.DATABASE_URL || 'postgresql://postgres:YoKV1HptBN0ac84A@db.budrbpwndnmxzkkesznp.supabase.co:5432/postgres';
  const sqlitePath = path.join(__dirname, 'data/wizard.db');

  console.log('====================================================');
  console.log('🧹 BEREINIGUNG DER TEST-ACCOUNTS');
  console.log('====================================================');

  const testPatternsSqlite = [
    'RankedTester_%',
    'TestWiz_%',
    'Persist_%',
    'Dup_%',
    'Hero_%',
    'DualTester_%'
  ];

  // 1. Lokale SQLite bereinigen
  if (fs.existsSync(sqlitePath)) {
    console.log(`\n📁 Bereinige lokale SQLite: ${sqlitePath}`);
    const sqlite = new Database(sqlitePath);
    sqlite.pragma('foreign_keys = ON');

    const selectStmt = sqlite.prepare(`
      SELECT id, username FROM users 
      WHERE username LIKE 'RankedTester_%'
         OR username LIKE 'TestWiz_%'
         OR username LIKE 'Persist_%'
         OR username LIKE 'Dup_%'
         OR username LIKE 'Hero_%'
         OR username LIKE 'DualTester_%'
    `);
    const toDeleteSqlite = selectStmt.all();
    console.log(`🔍 Gefundene Test-Accounts in SQLite: ${toDeleteSqlite.length}`);

    const deleteStmt = sqlite.prepare(`
      DELETE FROM users 
      WHERE username LIKE 'RankedTester_%'
         OR username LIKE 'TestWiz_%'
         OR username LIKE 'Persist_%'
         OR username LIKE 'Dup_%'
         OR username LIKE 'Hero_%'
         OR username LIKE 'DualTester_%'
    `);
    const resSqlite = deleteStmt.run();
    console.log(`✅ ${resSqlite.changes} Test-Accounts aus lokaler SQLite gelöscht.`);

    const remainingSqlite = sqlite.prepare('SELECT id, username, created_at FROM users').all();
    console.log('👥 Verbleibende Accounts in SQLite:', remainingSqlite);
    sqlite.close();
  }

  // 2. Supabase Cloud PostgreSQL bereinigen
  console.log(`\n☁️ Bereinige Supabase Cloud PostgreSQL...`);
  const pool = new Pool({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    const toDeletePg = await client.query(`
      SELECT id, username FROM users 
      WHERE username ILIKE 'RankedTester_%'
         OR username ILIKE 'TestWiz_%'
         OR username ILIKE 'Persist_%'
         OR username ILIKE 'Dup_%'
         OR username ILIKE 'Hero_%'
         OR username ILIKE 'DualTester_%'
    `);
    console.log(`🔍 Gefundene Test-Accounts in Supabase: ${toDeletePg.rows.length}`);

    const deleteResPg = await client.query(`
      DELETE FROM users 
      WHERE username ILIKE 'RankedTester_%'
         OR username ILIKE 'TestWiz_%'
         OR username ILIKE 'Persist_%'
         OR username ILIKE 'Dup_%'
         OR username ILIKE 'Hero_%'
         OR username ILIKE 'DualTester_%'
    `);
    console.log(`✅ ${deleteResPg.rowCount} Test-Accounts aus Supabase gelöscht.`);

    const remainingPg = await client.query('SELECT id, username, created_at FROM users ORDER BY id ASC');
    console.log('👥 Verbleibende Accounts in Supabase:', remainingPg.rows);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n====================================================');
  console.log('🎉 BEREINIGUNG VOLLSTÄNDIG ABGESCHLOSSEN!');
  console.log('====================================================');
}

cleanTestAccounts().catch(err => {
  console.error('❌ Fehler bei der Bereinigung:', err);
  process.exit(1);
});
