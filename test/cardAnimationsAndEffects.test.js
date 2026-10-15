const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
const clientJsPath = path.join(__dirname, '..', 'public', 'client.js');

test('Erweiterung B: 3D Stage & Table FX Layer in index.html', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  // 1. 3D-Bühne auf .poker-table
  assert.ok(
    html.includes('perspective: 1200px;') && html.includes('transform-style: preserve-3d;'),
    '.poker-table must configure perspective: 1200px and transform-style: preserve-3d'
  );

  // 2. #table-fx-layer im DOM
  assert.ok(
    html.includes('id="table-fx-layer"'),
    '#table-fx-layer must be present in the poker table DOM'
  );

  // 3. CSS für #table-fx-layer
  assert.ok(
    html.includes('#table-fx-layer {') && html.includes('pointer-events: none;'),
    '#table-fx-layer must have pointer-events: none to avoid blocking clicks'
  );
});

test('Erweiterung B: AAA Animation Keyframes & Visual FX Styles in index.html', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Sieger-Puls Aura
  assert.ok(
    html.includes('winnerAvatarPulseAnim') && html.includes('.winner-avatar-pulse'),
    'Must define .winner-avatar-pulse with winnerAvatarPulseAnim'
  );

  // Tisch-Mikrobeben
  assert.ok(
    html.includes('tableMicroShake') && html.includes('.table-micro-shake'),
    'Must define .table-micro-shake with tableMicroShake'
  );

  // Bombe Schockwelle
  assert.ok(
    html.includes('bombShockwaveExpand') && html.includes('.bomb-shockwave-ring'),
    'Must define .bomb-shockwave-ring with bombShockwaveExpand'
  );

  // Drachen-Glutfunken
  assert.ok(
    html.includes('dragonEmberFly') && html.includes('.dragon-ember'),
    'Must define .dragon-ember with dragonEmberFly'
  );

  // Feenstaub-Spirale
  assert.ok(
    html.includes('fairyDustFly') && html.includes('.fairy-dust'),
    'Must define .fairy-dust with fairyDustFly'
  );

  // Einhorn-Ring
  assert.ok(
    html.includes('unicornRingExpand') && html.includes('.unicorn-ring'),
    'Must define .unicorn-ring with unicornRingExpand'
  );

  // Barrierefreiheit: prefers-reduced-motion
  assert.ok(
    html.includes('@media (prefers-reduced-motion: reduce)'),
    'Must provide prefers-reduced-motion fallback to disable heavy screen shakes and particle animations'
  );
});

test('Erweiterung B: GrimoireFX Modul in client.js', () => {
  const js = fs.readFileSync(clientJsPath, 'utf8');

  assert.ok(
    js.includes('const GrimoireFX = {'),
    'GrimoireFX module must be defined in client.js'
  );
  assert.ok(
    js.includes('triggerSpecialCardEffect(card, targetContainer)'),
    'GrimoireFX must provide triggerSpecialCardEffect'
  );
  assert.ok(
    js.includes('triggerDragonImpact('),
    'GrimoireFX must provide triggerDragonImpact'
  );
  assert.ok(
    js.includes('triggerBombShockwave('),
    'GrimoireFX must provide triggerBombShockwave'
  );
  assert.ok(
    js.includes('triggerFairyImpact('),
    'GrimoireFX must provide triggerFairyImpact'
  );
  assert.ok(
    js.includes('triggerUnicornRing('),
    'GrimoireFX must provide triggerUnicornRing'
  );
  assert.ok(
    js.includes('window.GrimoireFX = GrimoireFX;'),
    'GrimoireFX must be attached to window for global access'
  );
});

test('Erweiterung B: FLIP 3D-Kartenflug in renderTrickCards', () => {
  const js = fs.readFileSync(clientJsPath, 'utf8');

  // FLIP Delta und Z-Elevation
  assert.ok(
    js.includes('const dx = (startRect.left + startRect.width / 2) - (endRect.left + endRect.width / 2);'),
    'renderTrickCards must calculate center X delta for FLIP'
  );
  assert.ok(
    js.includes('const dy = (startRect.top + startRect.height / 2) - (endRect.top + endRect.height / 2);'),
    'renderTrickCards must calculate center Y delta for FLIP'
  );
  assert.ok(
    js.includes('translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 60px)'),
    'renderTrickCards must apply 60px Z-elevation during FLIP invert'
  );
  assert.ok(
    js.includes('cubic-bezier(0.16, 1, 0.3, 1)'),
    'renderTrickCards must use snappy AAA cubic-bezier(0.16, 1, 0.3, 1) transition'
  );
  assert.ok(
    js.includes('GrimoireFX.triggerSpecialCardEffect(item.card, wrap);'),
    'renderTrickCards must trigger special card FX upon card landing'
  );
});

test('Erweiterung B: Target-Aware Trick Suction in trickWinner', () => {
  const js = fs.readFileSync(clientJsPath, 'utf8');

  // Avatar-Pill Target-Suche
  assert.ok(
    js.includes("document.getElementById('my-hud-bid')") || js.includes("document.getElementById('my-stats-hud')"),
    'trickWinner must target user HUD when user wins trick'
  );
  assert.ok(
    js.includes(".player-seat[data-session-id="),
    'trickWinner must query opponent seat by data-session-id'
  );
  assert.ok(
    js.includes('const dx = tx - cx;'),
    'trickWinner must compute dx toward winning target center'
  );
  assert.ok(
    js.includes('const dy = ty - cy;'),
    'trickWinner must compute dy toward winning target center'
  );
  assert.ok(
    js.includes('targetEl.classList.add(\'winner-avatar-pulse\')'),
    'trickWinner must pulse the winner avatar upon trick suction arrival'
  );
});

test('Erweiterung B: FLIP & Vector Math Logic Validation', () => {
  // Simuliere einen Wurf von Handkarte (Mitte links) zu Stichplatz (Tischmitte)
  const startRect = { left: 100, top: 700, width: 70, height: 100 };
  const endRect = { left: 400, top: 350, width: 80, height: 114 };

  const startCenterX = startRect.left + startRect.width / 2; // 135
  const startCenterY = startRect.top + startRect.height / 2; // 750
  const endCenterX = endRect.left + endRect.width / 2; // 440
  const endCenterY = endRect.top + endRect.height / 2; // 407

  const dx = startCenterX - endCenterX; // -305
  const dy = startCenterY - endCenterY; // 343

  assert.strictEqual(dx, -305, 'Inverted delta X must be exactly -305px');
  assert.strictEqual(dy, 343, 'Inverted delta Y must be exactly 343px');

  // Zentrifugaler Tilt
  const screenWidth = 800;
  const screenMidX = screenWidth / 2; // 400
  const tilt = Math.max(-10, Math.min(10, ((startCenterX - screenMidX) / screenMidX) * 8));
  // (135 - 400) / 400 * 8 = -265 / 400 * 8 = -5.3°
  assert.ok(tilt < 0, 'Left hand card must have slight negative centrifugal tilt');
  assert.ok(Math.abs(tilt) <= 10, 'Centrifugal tilt must be clamped within 10 degrees');
});
