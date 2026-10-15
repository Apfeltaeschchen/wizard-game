const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const roadmapPath = path.join(__dirname, '..', 'ROADMAP.md');
const svgPath = path.join(__dirname, '..', 'public', 'images', 'table_felt.svg');
const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
const clientJsPath = path.join(__dirname, '..', 'public', 'client.js');

test('Table Layout & Ergonomics: Roadmap KI-Schwierigkeitsgrade', () => {
  const roadmap = fs.readFileSync(roadmapPath, 'utf8');

  assert.ok(
    roadmap.includes('ERWEITERUNG D: Mehrstufige KI-Schwierigkeitsgrade'),
    'ROADMAP.md must contain ERWEITERUNG D'
  );
  assert.ok(
    roadmap.includes('Stufe 1: Novize'),
    'ROADMAP.md must define Stufe 1: Novize'
  );
  assert.ok(
    roadmap.includes('Stufe 2: Meister'),
    'ROADMAP.md must define Stufe 2: Meister'
  );
  assert.ok(
    roadmap.includes('Stufe 3: Erzmagier'),
    'ROADMAP.md must define Stufe 3: Erzmagier'
  );
  assert.ok(
    roadmap.includes('S2D'),
    'Mermaid flowchart in ROADMAP.md must include S2D'
  );
});

test('Table Layout & Ergonomics: Table Felt SVG Clean Lighting & Vignette', () => {
  const svg = fs.readFileSync(svgPath, 'utf8');

  assert.ok(
    !svg.includes('id="tableEdgeVignette"'),
    'table_felt.svg must not define distorted tableEdgeVignette'
  );
  assert.ok(
    !svg.includes('fill="url(#tableEdgeVignette)"'),
    'table_felt.svg must not render distorted tableEdgeVignette rect'
  );
  assert.ok(
    svg.includes('plankGrad1') && svg.includes('plankGrad5'),
    'table_felt.svg must maintain harmonized plank gradients'
  );
});

test('Table Layout & Ergonomics: Uniform Table Shadow & Vignette in index.html', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Must have symmetric box-shadow without 12px Y-offset
  assert.ok(
    html.includes('box-shadow: 0 0 28px rgba(0, 0, 0, 0.85)'),
    '.poker-table must have symmetric outer shadow'
  );
  assert.ok(
    !html.includes('0 12px 35px rgba(0,0,0,0.85)'),
    'Old asymmetric 12px Y-offset shadow must be removed'
  );

  // Must have .poker-table::before radial vignette
  assert.ok(
    html.includes('.poker-table::before'),
    '.poker-table::before vignette overlay must exist'
  );
  assert.ok(
    html.includes('radial-gradient(ellipse at center'),
    '.poker-table::before must use radial-gradient ellipse'
  );
});

test('Table Layout & Ergonomics: Compact Trump Dock & 100% Center Trick Area', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Trump dock must be top-left absolute positioned
  assert.ok(
    html.includes('.trump-section-fixed {') && html.includes('position: absolute;'),
    '.trump-section-fixed must be absolute positioned dock'
  );
  assert.ok(
    html.includes('.trump-card-compact'),
    '.trump-card-compact style class must exist'
  );

  // Table center row must be centered
  assert.ok(
    html.includes('.table-center-row {') && html.includes('justify-content: center;'),
    '.table-center-row must be 100% centered'
  );
});

test('Table Layout & Ergonomics: Compact Horizontal Seat Pills in HTML & CSS', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  assert.ok(
    html.includes('.seat-bid-pill'),
    '.seat-bid-pill class must be defined in CSS'
  );
  assert.ok(
    html.includes('height: 28px;'),
    '.player-seat must have compact height'
  );
});

test('Table Layout & Ergonomics: In-Game Citadel Menu Has Gefährten Entry', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  assert.ok(
    html.includes('id="btnMenuCompanions"'),
    'btnMenuCompanions button must exist in game-menu-modal'
  );
  assert.ok(
    html.includes('Grimoire der Gefährten'),
    'btnMenuCompanions must have text Grimoire der Gefährten'
  );
});

test('Table Layout & Ergonomics: client.js Wiring for Seats, Trump & Companions', () => {
  const js = fs.readFileSync(clientJsPath, 'utf8');

  // GrimoireGameMenu handles btnMenuCompanions
  assert.ok(
    js.includes('btnMenuCompanions'),
    'client.js must reference btnMenuCompanions'
  );
  assert.ok(
    js.includes('CompanionsManager.open();'),
    'btnMenuCompanions must trigger CompanionsManager.open()'
  );

  // renderOpponents renders seat-bid-pill
  assert.ok(
    js.includes('class="seat-bid-pill"'),
    'renderOpponents must output seat-bid-pill'
  );

  // renderTrumpCard uses trump-card-compact
  assert.ok(
    js.includes('trump-card-compact'),
    'renderTrumpCard must apply trump-card-compact class'
  );
});
