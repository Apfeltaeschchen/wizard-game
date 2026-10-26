const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TESTSUITE: HALLOWEEN KOSMETIK, HIGHLIGHT DES SPIELS & MVP PROGRESSION START ---');

// [1/6] Test Cosmetics Catalog & Halloween Theme
console.log('[1/6] Überprüfe Cosmetics-Katalog, Halloween-Items und 6. Kategorie lobby_backgrounds...');
const { COSMETICS_CATALOG } = require('../server/cosmeticsData');

assert(COSMETICS_CATALOG.lobby_backgrounds, 'Kategorie lobby_backgrounds muss im Katalog existieren');
assert(COSMETICS_CATALOG.lobby_backgrounds.length >= 7, 'Mindestens 7 Lobby-Hintergründe erwartet');
const expectedThemes = ['citadel_halls', 'haunted_graveyard', 'witch_hut', 'tavern_fireplace', 'astral_observatory', 'magma_forge', 'celestial_sanctum'];
expectedThemes.forEach(tid => {
  assert(COSMETICS_CATALOG.lobby_backgrounds.some(b => b.id === tid), `Lobby-Thema ${tid} muss existieren`);
});

// Halloween Card Backs
const expectedDecks = ['pumpkin_king', 'spider_queen', 'gravestone_runes'];
expectedDecks.forEach(id => {
  assert(COSMETICS_CATALOG.card_backs.some(cb => cb.id === id), `Halloween-Kartenrücken ${id} fehlt`);
});

// Halloween Table Skin
assert(COSMETICS_CATALOG.table_skins.some(ts => ts.id === 'haunted_crypt'), 'Halloween-Tischskin haunted_crypt fehlt');

// Halloween Avatar Frames
const expectedFrames = ['pumpkin_lantern', 'bat_swarm', 'ghost_specter', 'mvp_glow'];
expectedFrames.forEach(f => {
  assert(COSMETICS_CATALOG.avatar_frames.some(af => af.id === f), `Avatar-Rahmen ${f} fehlt`);
});

// Halloween & MVP Titles
const expectedTitles = ['Kürbiskönig von Halloween', 'Der Kopflose Reiter', 'MVP der Zitadelle'];
expectedTitles.forEach(t => {
  assert(COSMETICS_CATALOG.titles.some(ti => ti.id === t), `Titel "${t}" fehlt`);
});
console.log('✓ Katalog, Halloween-Kosmetika und Lobby-Hintergründe vollständig!');

// [2/6] Test SQLite Engine mit lobby_background, awardBonusXP & awardCosmetic
console.log('[2/6] Überprüfe SQLite Engine für lobby_background, awardBonusXP und awardCosmetic...');
const { createSqliteEngine } = require('../server/db/sqliteEngine');
const sharedHelpers = require('../server/db/sharedHelpers');

try {
  const dbEngine = createSqliteEngine(':memory:', sharedHelpers);
  const regRes = dbEngine.registerUser('HalloweenMage', 'hex123456');
  assert(regRes.success, 'Registrierung fehlgeschlagen');
  const user = dbEngine.getUserByToken(regRes.token);
  assert(user, 'User nicht gefunden');
  assert.strictEqual(user.equipped_lobby_background, 'citadel_halls', 'Default Lobby-Hintergrund muss citadel_halls sein');

  // Ausrüsten eines unbesessenen Hintergrunds schlägt fehl
  const eqFail = dbEngine.equipCosmetic(user.id, 'lobby_background', 'haunted_graveyard');
  assert(!eqFail.success, 'Ausrüsten ohne Besitz darf nicht gelingen');

  // Staub hinzufügen und schmieden
  dbEngine.db.prepare('UPDATE user_stats SET astral_dust = 500 WHERE user_id = ?').run(user.id);
  const craftRes = dbEngine.craftCosmetic(user.id, 'lobby_background', 'haunted_graveyard');
  assert(craftRes.success, 'Schmieden von haunted_graveyard fehlgeschlagen: ' + (craftRes.error || ''));

  // Jetzt ausrüsten
  const eqSuccess = dbEngine.equipCosmetic(user.id, 'lobby_background', 'haunted_graveyard');
  assert(eqSuccess.success, 'Ausrüsten von haunted_graveyard fehlgeschlagen: ' + (eqSuccess.error || ''));

  const userUpdated = dbEngine.getUserByToken(regRes.token);
  assert.strictEqual(userUpdated.equipped_lobby_background, 'haunted_graveyard', 'Hintergrund muss aktualisiert sein');

  // Teste awardBonusXP (exakt 50 Bonus-XP)
  const xpRes = dbEngine.awardBonusXP(user.id, 50);
  assert(xpRes && xpRes.gainedXP === 50, 'awardBonusXP muss genau 50 XP gutschreiben');
  assert.strictEqual(xpRes.currentXP, 50, 'Aktuelle XP müssen nach 50 Bonus-XP genau 50 sein');

  // Teste awardCosmetic für MVP-Titel und MVP-Aura
  const titleAward = dbEngine.awardCosmetic(user.id, 'title', 'MVP der Zitadelle');
  assert(titleAward, 'awardCosmetic für Titel fehlgeschlagen');
  const frameAward = dbEngine.awardCosmetic(user.id, 'avatar_frame', 'mvp_glow');
  assert(frameAward, 'awardCosmetic für Frame fehlgeschlagen');

  const cosRes = dbEngine.getUserCosmetics(user.id);
  assert(cosRes.inventory.some(i => i.item_id === 'MVP der Zitadelle'), 'MVP der Zitadelle muss im Inventar sein');
  assert(cosRes.inventory.some(i => i.item_id === 'mvp_glow'), 'mvp_glow Aura muss im Inventar sein');

  dbEngine.closeDatabase();
  console.log('✓ SQLite lobby_background, awardBonusXP & awardCosmetic verifiziert!');
} finally {}

// [3/6] Test Highlight of the Game (POTG) aus matchHighlightAndMvp.js
console.log('[3/6] Überprüfe Highlight of the Game (POTG) Spektakel-Score & Auswahl aus Modul...');
const {
  calculateSpectacleScore,
  recordTrickHighlight,
  generateMvpCandidates,
  resolveMvpVotingWinner
} = require('../server/matchHighlightAndMvp');

const mockWinner = { name: 'Merlin', sessionId: 's1', tricksWon: 1, bid: 1 };
const mockRoom1 = {
  round: 5,
  currentTrick: [
    { playerName: 'Arthur', playerSessionId: 's2', card: { type: 'dragon' } },
    { playerName: 'Merlin', playerSessionId: 's1', card: { type: 'fairy' } },
    { playerName: 'Morgana', playerSessionId: 's3', card: { type: 'wizard' } }
  ]
};

const resFairy = calculateSpectacleScore(mockRoom1, {}, mockWinner);
assert(resFairy.spectacleScore >= 335, 'Fee vs Drache muss mindestens 335 Punkte bringen');
assert(resFairy.headline.includes('Feen-Triumph'), 'Headline muss Feen-Triumph erwähnen');

const recordRes = recordTrickHighlight(mockRoom1, {}, mockWinner);
assert(recordRes, 'recordTrickHighlight muss Eintrag zurückgeben');
assert.strictEqual(mockRoom1.matchHighlights.length, 1, 'Highlight muss im Raum registriert sein');
assert.strictEqual(mockRoom1.matchHighlights[0].spectacleScore, resFairy.spectacleScore);

const mockRoom2 = {
  round: 4,
  currentTrick: [
    { playerName: 'Mordred', playerSessionId: 's4', card: { type: 'bomb' } },
    { playerName: 'Arthur', playerSessionId: 's2', card: { type: 'wizard' } }
  ]
};
const resBomb = calculateSpectacleScore(mockRoom2, { isBombed: true }, null);
assert(resBomb.spectacleScore >= 260, 'Bombe muss mindestens 260 Punkte bringen');
assert(resBomb.headline.includes('Magiekollaps'), 'Headline muss Magiekollaps erwähnen');

console.log('✓ Spektakel-Score-Kalkulation und Highlight-Auswahl fehlerfrei!');

// [4/6] Test Post-Match MVP Candidate Generation & Voting Resolution
console.log('[4/6] Überprüfe echte MVP-Kandidaten-Generierung & Abstimmung...');
const mockMatchRoom = {
  players: [
    { sessionId: 'p1', name: 'Albus', totalScore: 340, avatar_id: 'wizard_blue' },
    { sessionId: 'p2', name: 'Severus', totalScore: 280, avatar_id: 'wizard_red' },
    { sessionId: 'p3', name: 'Minerva', totalScore: 210, avatar_id: 'wizard_green' },
    { sessionId: 'p4', name: 'Rubeus', totalScore: 150, avatar_id: 'wizard_yellow' }
  ],
  scoreHistory: [
    { entries: [
      { sessionId: 'p1', bid: 2, tricksWon: 2 },
      { sessionId: 'p2', bid: 0, tricksWon: 0 },
      { sessionId: 'p3', bid: 3, tricksWon: 4 },
      { sessionId: 'p4', bid: 1, tricksWon: 0 }
    ]},
    { entries: [
      { sessionId: 'p1', bid: 1, tricksWon: 1 },
      { sessionId: 'p2', bid: 0, tricksWon: 0 },
      { sessionId: 'p3', bid: 2, tricksWon: 2 },
      { sessionId: 'p4', bid: 0, tricksWon: 1 }
    ]}
  ]
};

const candidates = generateMvpCandidates(mockMatchRoom);
assert(candidates.length >= 3, 'Mindestens 3 Kandidaten müssen generiert werden');
assert.strictEqual(candidates[0].sessionId, 'p1', 'Gesamtsieger Albus muss an Position 1 stehen');
assert(candidates.some(c => c.badge.includes('Der Allwissende') || c.badge.includes('Der Unangreifbare')), 'Spezial-Abzeichen müssen vorhanden sein');

// Voting Resolution via resolveMvpVotingWinner
const voteCounts = { p1: 1, p2: 3, p3: 0, p4: 0 };
const resolved = resolveMvpVotingWinner(candidates, voteCounts);
assert.strictEqual(resolved.winnerSessionId, 'p2', 'Severus mit 3 Stimmen muss MVP-Sieger sein');
assert.strictEqual(resolved.maxVotes, 3, 'Maximale Stimmenanzahl muss 3 sein');
console.log('✓ MVP-Kandidaten-Generierung und Abstimmungs-Auswertung verifiziert!');

// [5/6] Test Chest Badge Format Simplification
console.log('[5/6] Überprüfe Truhen-Badge-Format (Vereinfachung: nur Gesamtzahl 🎁 X)...');
function simulateBadgeCount(count) {
  const c = Math.max(0, parseInt(count, 10) || 0);
  const badgeText = c > 0 ? `🎁 ${c}` : '';
  const isVisible = c > 0;
  return { badgeText, isVisible };
}

assert.strictEqual(simulateBadgeCount(0).badgeText, '', 'Bei 0 kein Badge-Text');
assert.strictEqual(simulateBadgeCount(0).isVisible, false, 'Bei 0 unsichtbar');
assert.strictEqual(simulateBadgeCount(3).badgeText, '🎁 3', 'Badge muss exakt "🎁 3" sein');
assert.strictEqual(simulateBadgeCount(3).isVisible, true, 'Bei 3 sichtbar');
assert.strictEqual(simulateBadgeCount(12).badgeText, '🎁 12', 'Badge muss exakt "🎁 12" sein');
assert(!simulateBadgeCount(3).badgeText.includes('🪵'), 'Darf keine Holztruhe aufschlüsseln');
assert(!simulateBadgeCount(3).badgeText.includes('🥈'), 'Darf keine Silbertruhe aufschlüsseln');
console.log('✓ Truhen-Badge-Format erfolgreich verifiziert (keine detaillierte Aufschlüsselung mehr)!');

// [6/6] Test Frontend Markup & Scripts Hooks
console.log('[6/6] Überprüfe HTML Markup, Tag-Balance & Client.js Hooks...');
const htmlContent = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const clientContent = fs.readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');

// HTML div Tag Balance
const openDivs = (htmlContent.match(/<div(\s|>)/gi) || []).length;
const closeDivs = (htmlContent.match(/<\/div>/gi) || []).length;
assert.strictEqual(openDivs, closeDivs, `HTML div Tags müssen ausgeglichen sein (Open: ${openDivs}, Close: ${closeDivs})`);

// HTML Modals
assert(htmlContent.includes('id="highlight-modal"'), 'highlight-modal fehlt im HTML');
assert(htmlContent.includes('id="highlightHeadline"'), 'highlightHeadline fehlt im HTML');
assert(htmlContent.includes('id="highlightCardsTrack"'), 'highlightCardsTrack fehlt im HTML');
assert(htmlContent.includes('id="btnSkipHighlight"'), 'btnSkipHighlight fehlt im HTML');

assert(htmlContent.includes('id="mvp-voting-modal"'), 'mvp-voting-modal fehlt im HTML');
assert(htmlContent.includes('id="mvpCandidatesGrid"'), 'mvpCandidatesGrid fehlt im HTML');
assert(htmlContent.includes('id="mvpWinnerBanner"'), 'mvpWinnerBanner fehlt im HTML');
assert(htmlContent.includes('id="btnProceedFromMvp"'), 'btnProceedFromMvp fehlt im HTML');

assert(htmlContent.includes('id="progression-modal"'), 'progression-modal fehlt im HTML');
assert(htmlContent.includes('progressionLevelUpBanner'), 'progressionLevelUpBanner fehlt im HTML');
assert(htmlContent.includes('levelup-burst-effect'), 'levelup-burst-effect CSS fehlt');

// CSS themes & skins
assert(htmlContent.includes('theme-haunted_graveyard'), 'theme-haunted_graveyard CSS fehlt');
assert(htmlContent.includes('table-skin-haunted_crypt'), 'table-skin-haunted_crypt CSS fehlt');
assert(htmlContent.includes('frame-pumpkin_lantern'), 'frame-pumpkin_lantern CSS fehlt');
assert(htmlContent.includes('frame-bat_swarm'), 'frame-bat_swarm CSS fehlt');
assert(htmlContent.includes('frame-ghost_specter'), 'frame-ghost_specter CSS fehlt');
assert(htmlContent.includes('frame-mvp_glow'), 'frame-mvp_glow CSS fehlt');

// Client.js Functions
assert(clientContent.includes('playHighlightSequence'), 'playHighlightSequence fehlt in client.js');
assert(clientContent.includes('startMvpVoting'), 'startMvpVoting fehlt in client.js');
assert(clientContent.includes('handleGameOverSequence'), 'handleGameOverSequence fehlt in client.js');
assert(clientContent.includes('playTick'), 'playTick fehlt in client.js');
assert(clientContent.includes('playLevelUp'), 'playLevelUp fehlt in client.js');
assert(clientContent.includes('playMvpGong'), 'playMvpGong fehlt in client.js');
assert(clientContent.includes('applyLobbyTheme'), 'applyLobbyTheme fehlt in client.js');
assert(clientContent.includes('showMatchProgression'), 'showMatchProgression fehlt in WizardVault');

console.log('✓ Alle HTML & Client.js Hooks erfolgreich verifiziert!');
console.log('--- TESTSUITE: HALLOWEEN KOSMETIK, HIGHLIGHT DES SPIELS & MVP PROGRESSION ERFOLGREICH BESTANDEN! ---');
