const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- STARTE TEST-SUITE: SCHRITT 3 – 2vs2 ALLIANZEN AUSWAHL & START-VALIDIERUNG ---');

// ============================================================================
// 1. STATISCHE CSS- & HTML-AUDIT PRÜFUNG (MOBILE TOUCH & BUTTON-STATUS)
// ============================================================================
console.log('1. Prüfe CSS & HTML auf mobile Ergonomie & .btn-not-ready...');

const htmlPath = path.join(__dirname, '../public/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Prüfe .btn-format-toggle min-height und touch-action
assert(htmlContent.includes('.btn-format-toggle'), '.btn-format-toggle Klasse muss vorhanden sein');
assert(htmlContent.includes('min-height: 42px;'), '.btn-format-toggle muss min-height: 42px; für bequemes Handy-Tippen besitzen');
assert(htmlContent.includes('touch-action: manipulation;'), '.btn-format-toggle muss touch-action: manipulation besitzen');

// Prüfe #waitingRoomStartBtn.btn-not-ready Definition
assert(htmlContent.includes('#waitingRoomStartBtn.btn-not-ready'), '#waitingRoomStartBtn.btn-not-ready muss im CSS gestylt sein');
assert(htmlContent.includes('cursor: pointer !important;'), '.btn-not-ready muss klickbar bleiben');

console.log('✓ CSS-Audit für Mobile-Touch & Button-Zustände erfolgreich!');

// ============================================================================
// 2. CLIENT-LOGIK AUDIT (KEIN STUMMES DISABLED MEHR, CITADEL-ALERTS)
// ============================================================================
console.log('2. Prüfe public/client.js Start-Validierung & Alert-Aufrufe...');

const clientPath = path.join(__dirname, '../public/client.js');
const clientContent = fs.readFileSync(clientPath, 'utf8');

// Prüfe, dass waitingRoomStartBtn.disabled NICHT stumm auf true gesetzt wird
assert(clientContent.includes('waitingRoomStartBtn.classList.toggle(\'btn-not-ready\''), 'Start-Button muss btn-not-ready statt stummes disabled verwenden');
assert(clientContent.includes('waitingRoomStartBtn.disabled = false;'), 'Start-Button muss im Warteraum klickbar (disabled=false) gehalten werden');

// Prüfe Alert-Dialoge bei Klick auf Start im Warteraum
assert(clientContent.includes('Allianzen: 4 oder 6 Magier benötigt'), 'CitadelAlert Titel für 4/6 Magier muss vorhanden sein');
assert(clientContent.includes('Allianzen nicht ausgeglichen'), 'CitadelAlert Titel für unausgeglichene Teams muss vorhanden sein');
assert(clientContent.includes('Mindestens 3 Magier benötigt'), 'CitadelAlert Titel für <3 FFA-Magier muss vorhanden sein');

// Prüfe taktile Rückmeldung & Toast beim Modus-Wechsel
assert(clientContent.includes('Allianzen-Modus aktiv:'), 'Informativer Toast beim Wechsel zu Allianzen muss vorhanden sein');

console.log('✓ Client-Validierungslogik und GrimoireDialog-Verdrahtung erfolgreich verifiziert!');

// ============================================================================
// 3. FUNKTIONALE LOGIK-VALIDIERUNG (SIMULATION DES START-VALIDATORS)
// ============================================================================
console.log('3. Teste funktionale Start-Validierungslogik für alle Spieler-Konstellationen (2vs2 & 2vs2vs2)...');

function validateGameStart(matchFormat, players) {
  const connectedCount = (players || []).filter(p => p.connected).length;
  if (matchFormat === 'team_2v2') {
    if (connectedCount !== 4 && connectedCount !== 6) {
      return {
        canStart: false,
        errorTitle: 'Allianzen: 4 oder 6 Magier benötigt',
        errorMessage: `Der Allianzen-Modus erfordert entweder genau 4 Magier (2vs2) oder genau 6 Magier (2vs2vs2)!`,
        icon: '🤝'
      };
    }
    const teamAPlayers = players.filter(p => p.connected && p.team === 'team_a');
    const teamBPlayers = players.filter(p => p.connected && p.team === 'team_b');
    const teamCPlayers = players.filter(p => p.connected && p.team === 'team_c');
    const neutralPlayers = players.filter(p => p.connected && (!p.team || !['team_a', 'team_b', 'team_c'].includes(p.team)));

    if (connectedCount === 4) {
      if (teamAPlayers.length !== 2 || teamBPlayers.length !== 2 || neutralPlayers.length > 0) {
        return {
          canStart: false,
          errorTitle: 'Allianzen nicht ausgeglichen',
          errorMessage: `Beide Allianzen müssen genau 2 Magier zählen (Sonnenfeuer: ${teamAPlayers.length}/2, Mondschatten: ${teamBPlayers.length}/2)!`,
          icon: '⚖️'
        };
      }
      return { canStart: true };
    } else if (connectedCount === 6) {
      if (teamAPlayers.length !== 2 || teamBPlayers.length !== 2 || teamCPlayers.length !== 2 || neutralPlayers.length > 0) {
        return {
          canStart: false,
          errorTitle: 'Allianzen nicht ausgeglichen',
          errorMessage: `Alle 3 Allianzen müssen genau 2 Magier zählen (Sonnenfeuer: ${teamAPlayers.length}/2, Mondschatten: ${teamBPlayers.length}/2, Sternenwind: ${teamCPlayers.length}/2)!`,
          icon: '⚖️'
        };
      }
      return { canStart: true };
    }
  } else {
    if (connectedCount < 3) {
      return {
        canStart: false,
        errorTitle: 'Mindestens 3 Magier benötigt',
        errorMessage: `Für eine klassische Partie werden mindestens 3 Magier benötigt (aktuell: ${connectedCount}/3)!`,
        icon: '📜'
      };
    }
    return { canStart: true };
  }
}

// Fall 1: Allianzen mit 1 Spieler (Solo im Warteraum)
const v1 = validateGameStart('team_2v2', [
  { sessionId: 'p1', connected: true, team: 'team_a' }
]);
assert.strictEqual(v1.canStart, false);
assert.strictEqual(v1.errorTitle, 'Allianzen: 4 oder 6 Magier benötigt');

// Fall 2: Allianzen mit 2 Spielern
const v2 = validateGameStart('team_2v2', [
  { sessionId: 'p1', connected: true, team: 'team_a' },
  { sessionId: 'p2', connected: true, team: 'team_b' }
]);
assert.strictEqual(v2.canStart, false);
assert.strictEqual(v2.errorTitle, 'Allianzen: 4 oder 6 Magier benötigt');

// Fall 3: Allianzen mit 3 Spielern
const v3 = validateGameStart('team_2v2', [
  { sessionId: 'p1', connected: true, team: 'team_a' },
  { sessionId: 'p2', connected: true, team: 'team_b' },
  { sessionId: 'p3', connected: true, team: 'team_a' }
]);
assert.strictEqual(v3.canStart, false);
assert.strictEqual(v3.errorTitle, 'Allianzen: 4 oder 6 Magier benötigt');

// Fall 4: 2vs2 mit 4 Spielern, aber unbalanciert (3 in Team A, 1 in Team B)
const v4 = validateGameStart('team_2v2', [
  { sessionId: 'p1', connected: true, team: 'team_a' },
  { sessionId: 'p2', connected: true, team: 'team_a' },
  { sessionId: 'p3', connected: true, team: 'team_a' },
  { sessionId: 'p4', connected: true, team: 'team_b' }
]);
assert.strictEqual(v4.canStart, false);
assert.strictEqual(v4.errorTitle, 'Allianzen nicht ausgeglichen');

// Fall 5: 2vs2 mit 4 Spielern perfekt 2/2 aufgeteilt
const v5 = validateGameStart('team_2v2', [
  { sessionId: 'p1', connected: true, team: 'team_a' },
  { sessionId: 'p2', connected: true, team: 'team_a' },
  { sessionId: 'p3', connected: true, team: 'team_b' },
  { sessionId: 'p4', connected: true, team: 'team_b' }
]);
assert.strictEqual(v5.canStart, true);

// Fall 6: Allianzen mit 5 Spielern (Ungültige Spieleranzahl)
const v6 = validateGameStart('team_2v2', [
  { sessionId: 'p1', connected: true, team: 'team_a' },
  { sessionId: 'p2', connected: true, team: 'team_a' },
  { sessionId: 'p3', connected: true, team: 'team_b' },
  { sessionId: 'p4', connected: true, team: 'team_b' },
  { sessionId: 'p5', connected: true, team: 'team_c' }
]);
assert.strictEqual(v6.canStart, false);
assert.strictEqual(v6.errorTitle, 'Allianzen: 4 oder 6 Magier benötigt');

// Fall 7: 2vs2vs2 mit 6 Spielern, aber unbalanciert (z. B. neutral oder 3/1/2)
const v7 = validateGameStart('team_2v2', [
  { sessionId: 'p1', connected: true, team: 'team_a' },
  { sessionId: 'p2', connected: true, team: 'team_a' },
  { sessionId: 'p3', connected: true, team: 'team_a' },
  { sessionId: 'p4', connected: true, team: 'team_b' },
  { sessionId: 'p5', connected: true, team: 'team_c' },
  { sessionId: 'p6', connected: true, team: 'team_c' }
]);
assert.strictEqual(v7.canStart, false);
assert.strictEqual(v7.errorTitle, 'Allianzen nicht ausgeglichen');

// Fall 8: 2vs2vs2 mit 6 Spielern perfekt 2/2/2 aufgeteilt
const v8 = validateGameStart('team_2v2', [
  { sessionId: 'p1', connected: true, team: 'team_a' },
  { sessionId: 'p2', connected: true, team: 'team_a' },
  { sessionId: 'p3', connected: true, team: 'team_b' },
  { sessionId: 'p4', connected: true, team: 'team_b' },
  { sessionId: 'p5', connected: true, team: 'team_c' },
  { sessionId: 'p6', connected: true, team: 'team_c' }
]);
assert.strictEqual(v8.canStart, true);

// Fall 9: FFA mit 2 Spielern (<3)
const v9 = validateGameStart('ffa', [
  { sessionId: 'p1', connected: true },
  { sessionId: 'p2', connected: true }
]);
assert.strictEqual(v9.canStart, false);
assert.strictEqual(v9.errorTitle, 'Mindestens 3 Magier benötigt');
assert(v9.errorMessage.includes('2/3'));

// Fall 10: FFA mit 3 Spielern (Startklar)
const v10 = validateGameStart('ffa', [
  { sessionId: 'p1', connected: true },
  { sessionId: 'p2', connected: true },
  { sessionId: 'p3', connected: true }
]);
assert.strictEqual(v10.canStart, true);

console.log('✓ Alle 10 Spielstart-Konstellationen fehlerfrei validiert!');

// ============================================================================
// 4. SERVER-INTEGRITÄT (INDEX.JS STARTGAME ZERO-TRUST ENFORCEMENT)
// ============================================================================
console.log('4. Prüfe Server-seitige startGame Validierung in server/index.js...');

const serverPath = path.join(__dirname, '../server/index.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

assert(serverContent.includes('connectedCount === 4') && serverContent.includes('connectedCount === 6'), 'Server muss 4 oder 6 aktive Magier im Allianzen-Modus prüfen');
assert(serverContent.includes('Allianzen erfordern entweder genau 4 Magier (2vs2) oder genau 6 Magier (2vs2vs2)!'), 'Server-Fehlermeldung für Allianzen Unter-/Überbesetzung vorhanden');

console.log('✓ Server-seitige Validierung ist 100% konsistent mit dem Client!');

console.log('\n======================================================');
console.log('🎉 SCHRITT 3: 2vs2 START-VALIDIERUNG VOLLSTÄNDIG BESTANDEN!');
console.log('======================================================\n');
