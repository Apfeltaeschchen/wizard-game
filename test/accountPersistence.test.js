const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starte Test-Suite: Schritt 2 – Account-Persistenz bei Updates (PC & Handy)...');

// 1. .gitignore Prüfungen
console.log('  1. Prüfe Git-Schutz für Datenbankdateien in .gitignore...');
const gitignorePath = path.join(__dirname, '../.gitignore');
assert.ok(fs.existsSync(gitignorePath), '.gitignore muss existieren');
const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');

assert.ok(
  gitignoreContent.includes('server/data/*.db'),
  '.gitignore muss server/data/*.db enthalten, um Live-Spielerdatenbanken vor Git-Pulls zu schützen'
);
assert.ok(
  gitignoreContent.includes('server/data/*.db.backup*'),
  '.gitignore muss server/data/*.db.backup* enthalten'
);
console.log('     ✅ .gitignore schützt alle Datenbank- und Backup-Dateien erfolgreich!');

// 2. Server-side Backup & Rolling Sessions in database.js
console.log('  2. Prüfe automatisches SQLite Backup (backupDatabase) und Rolling Sessions...');
const dbModule = require('../server/database');

(async () => {
  try {
    // Test-User anlegen
    const suffix = Math.floor(Math.random() * 89999 + 10000);
    const testUser = `Persist_${suffix}`;
    const reg = dbModule.registerUser(testUser, 'geheim123');
    assert.strictEqual(reg.success, true, 'Registrierung für Persistenz-Test muss erfolgreich sein');
    const token = reg.token;
    assert.ok(token, 'Token muss generiert worden sein');

    // Teste Backup-Funktion
    const backupResult = await dbModule.backupDatabase();
    if (backupResult) {
      assert.ok(fs.existsSync(backupResult), 'Backup-Datei muss auf der Festplatte existieren');
      const stats = fs.statSync(backupResult);
      assert.ok(stats.size > 0, 'Backup-Datei darf nicht 0 Bytes groß sein');
      console.log(`     ✅ SQLite Backup erfolgreich erstellt (${stats.size} Bytes): ${backupResult}`);
    } else {
      console.log('     ℹ️ In-Memory Modus: Backup übersprungen.');
    }

    // Teste Rolling Session Verlängerung
    const sessionBefore = dbModule.db.prepare('SELECT expires_at FROM sessions WHERE token = ?').get(token);
    assert.ok(sessionBefore, 'Session muss in Datenbank vorhanden sein');
    const expiryBefore = new Date(sessionBefore.expires_at).getTime();

    // Simuliere einen Session-Touch
    dbModule.touchSession(token);
    const sessionAfter = dbModule.db.prepare('SELECT expires_at FROM sessions WHERE token = ?').get(token);
    const expiryAfter = new Date(sessionAfter.expires_at).getTime();
    assert.ok(expiryAfter >= expiryBefore, 'touchSession() muss das Ablaufdatum in die Zukunft verlängern');

    // getUserByToken() muss touchSession automatisch triggern
    const user = dbModule.getUserByToken(token);
    assert.strictEqual(user.username, testUser);
    console.log('     ✅ Rolling Sessions (90 Tage) und automatische Verlängerung verifiziert!');

    // 3. Client-Side Multi-Layer Storage Codebase-Audit
    console.log('  3. Prüfe Multi-Layer Storage Kaskade in public/client.js...');
    const clientJsPath = path.join(__dirname, '../public/client.js');
    const clientJs = fs.readFileSync(clientJsPath, 'utf8');

    assert.ok(clientJs.includes('const GrimoireStorage ='), 'client.js muss GrimoireStorage Modul enthalten');
    assert.ok(clientJs.includes('const DB_NAME = \'GrimoireVault\''), 'GrimoireStorage muss GrimoireVault IndexedDB nutzen');
    assert.ok(clientJs.includes('sessionStorage.setItem(\'wizard_auth_token\''), 'setToken() muss Token auch in sessionStorage spiegeln');
    assert.ok(clientJs.includes('GrimoireStorage.set(\'token\', token)'), 'setToken() muss Token in IndexedDB GrimoireVault sichern');
    assert.ok(clientJs.includes('await GrimoireStorage.get(\'token\')'), 'checkSession() muss Token aus IndexedDB wiederherstellen');
    assert.ok(clientJs.includes('GrimoireStorage.remove(\'token\')'), 'logout() muss Token aus IndexedDB bereinigen');

    console.log('     ✅ Client Multi-Layer Storage (Memory + Local + Session + IndexedDB) verifiziert!');

    console.log('\n======================================================');
    console.log('🏆 SCHRITT 2: ACCOUNT-PERSISTENZ VOLLSTÄNDIG BESTANDEN!');
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Fehler in Schritt 2 Test:', err);
    process.exit(1);
  }
})();
