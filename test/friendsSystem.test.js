const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Isoliertes Test-DB-File (:memory:)
process.env.WIZARD_DB_PATH = ':memory:';

const dbModule = require('../server/database');

console.log('--- STARTE FREUNDESYSTEM (GRIMOIRE DER GEFÄHRTEN) UNIT-TESTS ---');

try {
  // 1. Zwei Test-Magier registrieren
  const u1 = dbModule.registerUser('Merlin', 'geheim123', 'wizard_blue');
  const u2 = dbModule.registerUser('Morgana', 'geheim456', 'witch');
  const u3 = dbModule.registerUser('Arthur', 'geheim789', 'wizard_red');

  assert.strictEqual(u1.success, true, 'Merlin registriert');
  assert.strictEqual(u2.success, true, 'Morgana registriert');
  assert.strictEqual(u3.success, true, 'Arthur registriert');

  const merlinId = u1.user.id;
  const morganaId = u2.user.id;
  const arthurId = u3.user.id;

  // 2. Selbst-Freundschaft muss abgewiesen werden
  const selfAdd = dbModule.addFriend(merlinId, 'Merlin');
  assert.strictEqual(selfAdd.success, false, 'Selbst-Hinzufügen verhindert');
  assert.ok(selfAdd.error.includes('selbst'), 'Fehlermeldung bei Selbst-Hinzufügen');
  console.log('✓ Test 1: Selbst-Hinzufügen verhindert');

  // 3. Unbekannten Magier hinzufügen muss abgewiesen werden
  const unknownAdd = dbModule.addFriend(merlinId, 'GandalfDerGraue');
  assert.strictEqual(unknownAdd.success, false, 'Unbekannter Nutzer abgewiesen');
  console.log('✓ Test 2: Nicht existierender Magier abgewiesen');

  // 4. Morgana als Gefährtin hinzufügen (Case-insensitive Name)
  const addRes = dbModule.addFriend(merlinId, '  morGana  ');
  assert.strictEqual(addRes.success, true, 'Freundschaft erfolgreich');
  assert.strictEqual(addRes.friend.username, 'Morgana');
  assert.strictEqual(addRes.friend.id, morganaId);
  console.log('✓ Test 3: Morgana erfolgreich als Gefährtin hinzugefügt');

  // 5. Duplikat-Schutz
  const dupAdd = dbModule.addFriend(merlinId, 'Morgana');
  assert.strictEqual(dupAdd.success, false, 'Duplikat abgewiesen');
  console.log('✓ Test 4: Duplikat-Freundschaft abgewiesen');

  // 6. Wechselseitige Sichtbarkeit prüfen (getFriends)
  const merlinFriends = dbModule.getFriends(merlinId);
  assert.strictEqual(merlinFriends.length, 1, 'Merlin hat 1 Gefährten');
  assert.strictEqual(merlinFriends[0].username, 'Morgana');
  assert.ok(merlinFriends[0].rank, 'Gefährte enthält Rang-Details');

  const morganaFriends = dbModule.getFriends(morganaId);
  assert.strictEqual(morganaFriends.length, 1, 'Morgana sieht Merlin als Gefährten');
  assert.strictEqual(morganaFriends[0].username, 'Merlin');
  console.log('✓ Test 5: Wechselseitige Bindung im Grimoire der Gefährten bestätigt');

  // 7. Arthur hinzufügen
  dbModule.addFriend(merlinId, 'Arthur');
  const merlinFriends2 = dbModule.getFriends(merlinId);
  assert.strictEqual(merlinFriends2.length, 2, 'Merlin hat nun 2 Gefährten');
  console.log('✓ Test 6: Mehrere Gefährten im Grimoire');

  // 8. Gefährten entfernen
  const remRes = dbModule.removeFriend(merlinId, morganaId);
  assert.strictEqual(remRes.success, true, 'Entfernen erfolgreich');

  const merlinFriendsAfter = dbModule.getFriends(merlinId);
  assert.strictEqual(merlinFriendsAfter.length, 1, 'Merlin hat nach Entfernen 1 Gefährten');
  assert.strictEqual(merlinFriendsAfter[0].username, 'Arthur');

  const morganaFriendsAfter = dbModule.getFriends(morganaId);
  assert.strictEqual(morganaFriendsAfter.length, 0, 'Morgana hat Merlin nicht mehr als Gefährten');
  console.log('✓ Test 7: Sauberes Entfernen der Freundschaft beidseitig');

  console.log('\n=========================================');
  console.log('🏆 ALLE FREUNDESYSTEM-TESTS BESTANDEN!');
  console.log('=========================================\n');
} finally {
  dbModule.closeDatabase();
}
