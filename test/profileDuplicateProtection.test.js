const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🧪 Starte Test-Suite: Schritt 1 – Profil-Erstellung & Rigoroser Duplikateschutz...');

// 1. UNIT TESTS: database.js
const dbModule = require('../server/database');

console.log('  1. Teste isUsernameAvailable() & Formatregeln...');

// Ungültige Formate
assert.strictEqual(dbModule.isUsernameAvailable('').available, false, 'Leerer Name muss abgelehnt werden');
assert.strictEqual(dbModule.isUsernameAvailable('ab').available, false, 'Zu kurzer Name (<3) muss abgelehnt werden');
assert.strictEqual(dbModule.isUsernameAvailable('ein_viel_zu_langer_spielername_fuer_die_gilde').available, false, 'Zu langer Name (>18) muss abgelehnt werden');
assert.strictEqual(dbModule.isUsernameAvailable('Merlin!#?').available, false, 'Sonderzeichen müssen abgelehnt werden');

// Reservierte Namen (System & Bot)
assert.strictEqual(dbModule.isUsernameAvailable('Meister Merlin').available, false, 'Reservierter Name "Meister Merlin" muss abgelehnt werden');
assert.strictEqual(dbModule.isUsernameAvailable('System').available, false, 'Reservierter Name "System" muss abgelehnt werden');
assert.strictEqual(dbModule.isUsernameAvailable('Zitadelle').available, false, 'Reservierter Name "Zitadelle" muss abgelehnt werden');
assert.strictEqual(dbModule.isUsernameAvailable('ZaubererBot (KI)').available, false, 'Namen mit (KI) Suffix müssen abgelehnt werden');

console.log('     ✅ Format- und Reservierungs-Prüfungen erfolgreich!');

console.log('  2. Teste Registrierung & Case-Insensitive Duplikateschutz...');

// Erstelle Test-Nutzer mit eindeutigem Namen (<= 18 Zeichen)
const suffix = Math.floor(Math.random() * 89999 + 10000);
const testBaseName = `Dup_${suffix}`;
const regResult = dbModule.registerUser(testBaseName, 'streichholz123');
assert.strictEqual(regResult.success, true, `Erste Registrierung muss erfolgreich sein: ${regResult.error || ''}`);
assert.ok(regResult.token, 'Token muss vorhanden sein');
assert.strictEqual(regResult.user.username, testBaseName);

// Exakter Duplikat-Versuch
const dupExact = dbModule.registerUser(testBaseName, 'streichholz123');
assert.strictEqual(dupExact.success, false, 'Exakter Duplikat-Name muss abgewiesen werden');
assert.ok(dupExact.error.includes('bereits vergeben'), 'Fehlermeldung muss vergebenen Namen melden');

// Case-Insensitiv: Lowercase
const dupLower = dbModule.registerUser(testBaseName.toLowerCase(), 'streichholz123');
assert.strictEqual(dupLower.success, false, 'Kleingeschriebener Duplikat-Name muss abgewiesen werden');
assert.ok(dupLower.error.includes('bereits vergeben'));

// Case-Insensitiv: Uppercase
const dupUpper = dbModule.registerUser(testBaseName.toUpperCase(), 'streichholz123');
assert.strictEqual(dupUpper.success, false, 'Großgeschriebener Duplikat-Name muss abgewiesen werden');
assert.ok(dupUpper.error.includes('bereits vergeben'));

// Mit führenden und nachfolgenden Leerzeichen
const dupTrim = dbModule.registerUser(`  ${testBaseName}  `, 'streichholz123');
assert.strictEqual(dupTrim.success, false, 'Getrimmter Duplikat-Name muss abgewiesen werden');
assert.ok(dupTrim.error.includes('bereits vergeben'));

// isUsernameAvailable() muss nun ebenfalls false zurückgeben
assert.strictEqual(dbModule.isUsernameAvailable(testBaseName).available, false);
assert.strictEqual(dbModule.isUsernameAvailable(testBaseName.toLowerCase()).available, false);
assert.strictEqual(dbModule.isUsernameAvailable(testBaseName.toUpperCase()).available, false);

console.log('     ✅ Case-Insensitive Registrierungs-Sperre erfolgreich verifiziert!');

// 3. REST-API TEST: /api/auth/check-username
console.log('  3. Teste HTTP REST-Endpunkt GET /api/auth/check-username...');

const { spawn } = require('child_process');
const TEST_PORT = 3982;
const serverProc = spawn('node', [path.join(__dirname, '../server/index.js')], {
  env: { ...process.env, PORT: TEST_PORT },
  stdio: 'pipe'
});

function httpGetJson(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${TEST_PORT}${urlPath}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForServer(port, maxWaitMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
          resolve(true);
        });
        req.on('error', reject);
        req.setTimeout(500, () => { req.destroy(); reject(new Error('timeout')); });
      });
      return true;
    } catch (e) {
      await wait(100);
    }
  }
  throw new Error('Server start timed out on port ' + port);
}

(async () => {
  try {
    await waitForServer(TEST_PORT); // Robust auf Serverstart warten

    // Belegter Name
    const resTaken = await httpGetJson(`/api/auth/check-username?username=${encodeURIComponent(testBaseName)}`);
    assert.strictEqual(resTaken.status, 200);
    assert.strictEqual(resTaken.body.available, false);
    assert.ok(resTaken.body.error.includes('bereits vergeben'));

    // Reservierter Name
    const resReserved = await httpGetJson(`/api/auth/check-username?username=Meister%20Merlin`);
    assert.strictEqual(resReserved.status, 200);
    assert.strictEqual(resReserved.body.available, false);

    // Freier Name (<= 18 Zeichen)
    const freshName = `Frei_${Math.floor(Math.random() * 89999 + 10000)}`;
    const resFree = await httpGetJson(`/api/auth/check-username?username=${encodeURIComponent(freshName)}`);
    assert.strictEqual(resFree.status, 200);
    assert.strictEqual(resFree.body.available, true);
    assert.strictEqual(resFree.body.cleanName, freshName);

    console.log('     ✅ REST-Endpunkt /api/auth/check-username erfolgreich verifiziert!');

    // 4. DOM & CODEBASE INTEGRATION
    console.log('  4. Prüfe Frontend-Integration (HTML Feedback-Div & client.js Live-Check)...');
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    const clientJs = fs.readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');

    assert.ok(html.includes('id="authUsernameFeedback"'), 'index.html muss #authUsernameFeedback enthalten');
    assert.ok(clientJs.includes('checkLiveUsername'), 'client.js muss checkLiveUsername enthalten');
    assert.ok(clientJs.includes('/api/auth/check-username'), 'client.js muss /api/auth/check-username abfragen');
    assert.ok(clientJs.includes('isUsernameAvailableStatus'), 'client.js muss isUsernameAvailableStatus vor dem Submit validieren');

    console.log('     ✅ Frontend-Integration erfolgreich verifiziert!');

    console.log('\n======================================================');
    console.log('🏆 SCHRITT 1: PROFIL-DUPLIKATESCHUTZ VOLLSTÄNDIG BESTANDEN!');
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Test-Fehler in Schritt 1:', err);
    process.exit(1);
  } finally {
    serverProc.kill();
  }
})();
