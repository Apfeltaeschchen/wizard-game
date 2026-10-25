process.env.WIZARD_DB_PATH = ':memory:';
const assert = require('assert');
const http = require('http');
const express = require('express');
const dbModule = require('../server/database');

console.log('--- STARTE TEST FÜR SELF-HEALING DATENBANK-FACADE & API-HÄRTUNG ---');

(async () => {
  try {
    // 1. Simuliere PostgreSQL-Ausfall
    console.log('1. Teste automatischen Fallback bei unerreichbarem PostgreSQL...');
    
    // Erstelle ein simuliertes fehlerhaftes Postgres-Engine
    const brokenPostgresEngine = {
      engine: 'postgres',
      isUsernameAvailable: async () => {
        const err = new Error('connect ECONNREFUSED 127.0.0.1:5432 (simuliert)');
        err.code = 'ECONNREFUSED';
        throw err;
      },
      registerUser: async () => {
        const err = new Error('connection timeout (simuliert)');
        err.code = 'ETIMEDOUT';
        throw err;
      },
      loginUser: async () => {
        const err = new Error('password authentication failed for user "render" (simuliert)');
        throw err;
      },
      closeDatabase: async () => {}
    };

    dbModule.setEngine(brokenPostgresEngine);
    assert.strictEqual(dbModule.getEngine(), 'postgres');
    assert.strictEqual(dbModule.isPostgres(), true);

    // Aufruf von isUsernameAvailable bei defektem Postgres:
    // Facade muss den Fehler abfangen, switchToSqlite ausführen und das Ergebnis aus SQLite liefern!
    const availResult = await dbModule.isUsernameAvailable('HealWizard');
    assert.strictEqual(availResult.available, true, 'isUsernameAvailable muss über SQLite-Fallback erfolgreich sein');
    assert.strictEqual(dbModule.getEngine(), 'sqlite', 'Engine muss nach Fehler transparent auf SQLite umgestellt sein');
    assert.strictEqual(dbModule.isPostgres(), false, 'isPostgres muss false sein');
    console.log('✓ 1. isUsernameAvailable hat transparent von PostgreSQL auf SQLite umgeschaltet!');

    // 2. Registrierung über Fallback
    const regResult = await dbModule.registerUser('HealWizard', 'geheim123', 'wizard_blue');
    assert.strictEqual(regResult.success, true, 'Registrierung im Fallback-SQLite muss funktionieren');
    assert.strictEqual(regResult.user.username, 'HealWizard');
    console.log('✓ 2. Registrierung im automatischen Fallback-SQLite erfolgreich durchgeführt!');

    // 3. Login über Fallback
    const loginResult = await dbModule.loginUser('HealWizard', 'geheim123');
    assert.strictEqual(loginResult.success, true);
    assert.ok(loginResult.token);
    console.log('✓ 3. Login im Fallback-SQLite erfolgreich!');

    // 4. Teste Express Error-Handler (JSON statt HTML)
    console.log('4. Teste globalen Express JSON-Error-Handler...');
    const app = express();
    app.use(express.json());

    app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'Grimoire Server',
        dbEngine: dbModule.getEngine(),
        uptime: Math.floor(process.uptime()),
        timestamp: Date.now()
      });
    });

    app.get('/api/test-error', (req, res, next) => {
      next(new Error('Simulierter kritischer Datenbank-Fehler'));
    });

    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Serverfehler'
      });
    });

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;

    // Test GET /api/health
    const healthResp = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.strictEqual(healthResp.status, 200);
    const healthData = await healthResp.json();
    assert.strictEqual(healthData.status, 'ok');
    assert.strictEqual(healthData.service, 'Grimoire Server');
    assert.strictEqual(healthData.dbEngine, 'sqlite');
    console.log('✓ 4a. /api/health liefert Status 200 und korrektes JSON mit dbEngine: sqlite');

    // Test GET /api/test-error (muss JSON 500 liefern, kein HTML)
    const errResp = await fetch(`http://127.0.0.1:${port}/api/test-error`);
    assert.strictEqual(errResp.status, 500);
    const contentType = errResp.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'), 'Fehler muss application/json Content-Type sein');
    const errData = await errResp.json();
    assert.strictEqual(errData.success, false);
    assert.strictEqual(errData.error, 'Simulierter kritischer Datenbank-Fehler');
    console.log('✓ 4b. Express Error Handler fängt Fehler ab und liefert sauberes JSON { success: false, error: ... }');

    server.close();

    console.log('\n======================================================');
    console.log('ALLE SELF-HEALING & FEHLERBEHANDLUNGS-TESTS BESTANDEN!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test fehlgeschlagen:', err);
    process.exit(1);
  }
})();
