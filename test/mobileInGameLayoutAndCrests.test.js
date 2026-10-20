const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
const clientJsPath = path.join(__dirname, '..', 'public', 'client.js');
const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

test('Mobile In-Game Layout & Orientation: Top Nav Bar 3 Elements', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Must have 3 balanced top-nav items
  assert.ok(html.includes('id="score-drawer-toggle"'), 'Score drawer toggle must exist');
  assert.ok(html.includes('id="displayRoomCodePill"'), 'Room code pill must exist');
  assert.ok(html.includes('id="btnOpenGameMenu"'), 'Citadel menu toggle button must exist');

  // Verify class room-round-pill
  assert.ok(html.includes('class="room-round-pill"'), 'room-round-pill class must be defined');
});

test('Mobile In-Game Layout & Orientation: Consolidated Game Menu Modal', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  assert.ok(html.includes('id="game-menu-modal"'), 'game-menu-modal must exist in HTML');
  assert.ok(html.includes('id="btnCloseGameMenu"'), 'btnCloseGameMenu must exist');
  assert.ok(html.includes('id="btnMenuAudioSettings"'), 'btnMenuAudioSettings must exist');
  assert.ok(html.includes('id="btnMenuRules"'), 'btnMenuRules must exist');
  assert.ok(html.includes('id="btnMenuServerSettings"'), 'btnMenuServerSettings must exist');
  assert.ok(html.includes('id="btnLeaveGame"'), 'btnLeaveGame must exist inside game menu');

  // CSS for game menu modal
  assert.ok(html.includes('.game-menu-card'), '.game-menu-card class must exist');
  assert.ok(html.includes('.game-menu-item-btn'), '.game-menu-item-btn class must exist');
});

test('Mobile In-Game Layout & Orientation: Landscape Blocker Overlay', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  assert.ok(html.includes('id="rotate-device-overlay"'), 'rotate-device-overlay markup must exist');
  assert.ok(html.includes('orientation: landscape'), 'orientation: landscape media query must exist');
  assert.ok(html.includes('max-height: 550px'), 'max-height 550px filter must exist so desktops are unaffected');
});

test('Mobile In-Game Layout & Orientation: Android Manifest Portrait Lock', () => {
  const manifest = fs.readFileSync(manifestPath, 'utf8');

  assert.ok(
    manifest.includes('android:screenOrientation="portrait"'),
    'AndroidManifest.xml must lock MainActivity to portrait orientation'
  );
});

test('Mobile In-Game Layout & Orientation: Proportional Card Typography', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Check clamp definitions for card elements
  assert.ok(html.includes('clamp(14px, calc(var(--card-w) * 0.32), 28px)'), 'card-center-val clamp font size');
  assert.ok(html.includes('clamp(18px, calc(var(--card-w) * 0.42), 36px)'), 'card-center-crest clamp font size');
  assert.ok(html.includes('clamp(10px, calc(var(--card-w) * 0.18), 15px)'), 'card-val clamp font size');
  assert.ok(html.includes('clamp(8px, calc(var(--card-w) * 0.14), 12px)'), 'card-mini-icon clamp font size');
});

test('Mobile In-Game Layout & Orientation: Table Seats Ornate Names Without Badge Clutter (No SVG Clipping)', () => {
  const js = fs.readFileSync(clientJsPath, 'utf8');

  // In renderOpponents, table seats use decorated seat-name and must NOT embed SVG crests
  const renderOpponentsMatch = js.match(/function renderOpponents\(\)[\s\S]*?opponentsContainer\.appendChild\(seatEl\);/);
  assert.ok(renderOpponentsMatch, 'renderOpponents function must exist');

  const renderOpponentsCode = renderOpponentsMatch[0];
  assert.ok(
    renderOpponentsCode.includes('seat-name'),
    'renderOpponents must use seat-name class for ornate player names'
  );
  assert.ok(
    !renderOpponentsCode.includes('RANK_CRESTS['),
    'renderOpponents must NOT render SVG crests (no clipping at poker table)'
  );
});

test('Mobile In-Game Layout & Orientation: GrimoireGameMenu Controller in client.js', () => {
  const js = fs.readFileSync(clientJsPath, 'utf8');

  assert.ok(js.includes('const GrimoireGameMenu = {'), 'GrimoireGameMenu object must be defined');
  assert.ok(js.includes('GrimoireGameMenu.init();'), 'GrimoireGameMenu.init() must be called');
  assert.ok(js.includes('displayRoomCodePill'), 'displayRoomCodePill copy handler must be set up');
});
