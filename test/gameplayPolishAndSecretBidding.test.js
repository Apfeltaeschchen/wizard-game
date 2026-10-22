const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
const clientJsPath = path.join(__dirname, '..', 'public', 'client.js');
const serverIndexPath = path.join(__dirname, '..', 'server', 'index.js');
const gameLogicPath = path.join(__dirname, '..', 'server', 'gameLogic.js');

test('Secret Bidding: Server marks secret bidding as simultaneous and transitions directly to trick play without countdown', () => {
  const serverCode = fs.readFileSync(serverIndexPath, 'utf8');

  // Both simultaneous and secret bidding modes use simultaneous collection
  assert.ok(
    serverCode.includes("isSimultaneous = (room.biddingMode === 'simultaneous' || room.biddingMode === 'secret')"),
    'Server must treat secret mode as simultaneous bidding'
  );

  // Secret bidding bypasses countdown reveal overlay
  assert.ok(
    serverCode.includes("if (room.biddingMode === 'secret')"),
    'Server must check for secret bidding mode to bypass reveal countdown'
  );
});

test('Secret Bidding: getSanitizedPlayers completely hides bids from all viewers during round', () => {
  const serverCode = fs.readFileSync(serverIndexPath, 'utf8');

  // During bidding: shows checkmark '✓' when player has bid
  assert.ok(
    serverCode.includes("bidVal = hasBid ? '✓' : null;"),
    'Sanitized players must display checkmark during secret bidding'
  );

  // During trick play: masks bid as '?' even for teammates
  assert.ok(
    serverCode.includes("bidVal = hasBid ? '?' : null;"),
    'Sanitized players must mask secret bids as ? during trick play'
  );

  // Attaches career userStats for registered accounts
  assert.ok(
    serverCode.includes('userStats: userStats') && serverCode.includes('gamesPlayed: u.games_played'),
    'Server must attach career userStats for registered accounts'
  );
});

test('Cloud & Bomb Interaction: Bomb completely negates Cloud bid adjustment', () => {
  const serverCode = fs.readFileSync(serverIndexPath, 'utf8');

  // stepCloud checks trickResult.isBombed
  assert.ok(
    serverCode.includes('if (!hadCloud || trickResult.isBombed) return next();'),
    'Bombed trick must cancel cloud bid adjustment step'
  );
});

test('Mondbiest Terminology: Werwolf renamed to Mondbiest across user interface', () => {
  const clientCode = fs.readFileSync(clientJsPath, 'utf8');
  const htmlCode = fs.readFileSync(indexHtmlPath, 'utf8');

  // Rules drawer & descriptions refer to Mondbiest
  assert.ok(htmlCode.includes('Das Mondbiest'), 'Rules drawer must refer to Das Mondbiest');
  assert.ok(!htmlCode.includes('Mondbestie'), 'Old Mondbestie moniker must not exist in index.html');
  assert.ok(clientCode.includes('🐺 Mondbiest'), 'Client must label werewolf card as Mondbiest');
  assert.ok(!clientCode.includes('🐺 Du hast die Mondbestie!'), 'Status message must say Mondbiest');
});

test('Card Visual Polish: Bottom labels on all non-number cards and Doppelgänger (E)/(S)', () => {
  const clientCode = fs.readFileSync(clientJsPath, 'utf8');
  const htmlCode = fs.readFileSync(indexHtmlPath, 'utf8');

  // Bottom label container
  assert.ok(clientCode.includes('card-bottom-label'), 'Cards must have card-bottom-label');
  assert.ok(htmlCode.includes('.card-bottom-label'), 'CSS must define .card-bottom-label');

  // Doppelgänger shows (E) for Erzmagier and (S) for Scharlatan
  assert.ok(clientCode.includes('🎭 Doppelgänger (E)'), 'Doppelgänger wizard role must display (E)');
  assert.ok(clientCode.includes('🎭 Doppelgänger (S)'), 'Doppelgänger jester role must display (S)');

  // Wolke and Jongleur colored box shadow glow
  assert.ok(clientCode.includes('card-glow-${card.chosenSuit}') || clientCode.includes('card-glow-'), 'Wolke and Jongleur must have suit glow class');
  assert.ok(htmlCode.includes('.card-glow-red'), 'CSS must define .card-glow-red');
  assert.ok(htmlCode.includes('.card-glow-blue'), 'CSS must define .card-glow-blue');
  assert.ok(htmlCode.includes('.card-glow-green'), 'CSS must define .card-glow-green');
  assert.ok(htmlCode.includes('.card-glow-yellow'), 'CSS must define .card-glow-yellow');
});

test('Center Trick Cards: Player name badge rendered above each played card', () => {
  const clientCode = fs.readFileSync(clientJsPath, 'utf8');
  const htmlCode = fs.readFileSync(indexHtmlPath, 'utf8');

  assert.ok(clientCode.includes('trick-card-player-name'), 'Trick cards must include player name badge');
  assert.ok(htmlCode.includes('.trick-card-player-name'), 'CSS must define .trick-card-player-name');
});

test('Turn Alert: Extreme flash animation and crystal chime gong sound', () => {
  const clientCode = fs.readFileSync(clientJsPath, 'utf8');
  const htmlCode = fs.readFileSync(indexHtmlPath, 'utf8');

  // CSS for extreme gold flash
  assert.ok(htmlCode.includes('.turn-start-extreme-flash'), 'CSS must define .turn-start-extreme-flash');
  assert.ok(htmlCode.includes('turnStartExtremeFlashAnim'), 'CSS must define turnStartExtremeFlashAnim keyframes');

  // Client triggers flash on turn start
  assert.ok(clientCode.includes('turn-start-extreme-flash'), 'Client must apply turn-start-extreme-flash on active turn');

  // WizardAudio provides playTurnChime and toggle
  assert.ok(clientCode.includes('playTurnChime'), 'WizardAudio must implement playTurnChime');
  assert.ok(htmlCode.includes('id="turnSoundToggle"'), 'Audio settings modal must have turnSoundToggle');
  assert.ok(htmlCode.includes('id="btnTestTurnSound"'), 'Audio settings modal must have btnTestTurnSound');
});

test('Scoreboard & Team Mode: Columns sorted by alliance and total team bids in HUD', () => {
  const clientCode = fs.readFileSync(clientJsPath, 'utf8');

  // renderScoreBoard sorts columns by team in team mode
  assert.ok(clientCode.includes('const teamOrder = { team_a: 1, team_b: 2, team_c: 3 };'), 'Scoreboard must sort columns by alliance');

  // Total bids pill hidden ONLY in secret mode
  assert.ok(clientCode.includes("if (currentBiddingMode === 'secret') {"), 'Bidding summary pill must hide in secret mode');
});

test('Rules Drawer & Artworks: Real card artwork thumbnails and Lightbox Modal', () => {
  const htmlCode = fs.readFileSync(indexHtmlPath, 'utf8');
  const clientCode = fs.readFileSync(clientJsPath, 'utf8');

  // Rules drawer contains artwork thumbnails with lightbox click handlers
  assert.ok(htmlCode.includes('rules-card-art-thumb'), 'Rules drawer must have rules-card-art-thumb images');
  assert.ok(htmlCode.includes('/images/cards/archmage_1.png'), 'Rules drawer must link archmage_1.png');
  assert.ok(htmlCode.includes('/images/cards/lindwurm.png'), 'Rules drawer must link lindwurm.png');
  assert.ok(htmlCode.includes('/images/cards/magiekollaps.png'), 'Rules drawer must link magiekollaps.png');

  // Lightbox modal markup and client functions
  assert.ok(htmlCode.includes('id="card-art-lightbox-modal"'), 'card-art-lightbox-modal markup must exist');
  assert.ok(clientCode.includes('openCardLightbox'), 'openCardLightbox function must exist');
  assert.ok(clientCode.includes('closeCardLightbox'), 'closeCardLightbox function must exist');
});

test('Landscape Blocker: Completely removed for unobstructed mobile play', () => {
  const htmlCode = fs.readFileSync(indexHtmlPath, 'utf8');

  assert.ok(!htmlCode.includes('id="rotate-device-overlay"'), 'rotate-device-overlay must be completely removed');
  assert.ok(!htmlCode.includes('Bitte Smartphone aufrichten'), 'Smartphone aufrichten prompt must not exist');
});
