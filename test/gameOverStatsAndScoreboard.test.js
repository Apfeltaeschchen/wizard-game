const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- TESTE SIEGEREHRUNG: STATISTIKEN, PROFIL-INTERAKTION & PUNKTEKURVEN-DIAGRAMM ---');

const indexPath = path.join(__dirname, '../public/index.html');
const clientPath = path.join(__dirname, '../public/client.js');

const indexHtml = fs.readFileSync(indexPath, 'utf-8');
const clientJs = fs.readFileSync(clientPath, 'utf-8');

// ==========================================
// 1. STATISCHE PRÜFUNG DES HTML-MARKUPS & CSS
// ==========================================
console.log('\n1. Prüfe HTML-Struktur & CSS für Diagramm, Statistiken und Block der Wahrheit...');

// Button für Block der Wahrheit im Siegerehrungs-Modal
assert.ok(indexHtml.includes('id="btnGameOverScoreboard"'), 'btnGameOverScoreboard muss im Siegerehrungs-Modal vorhanden sein');
assert.ok(indexHtml.includes('Block der Wahrheit (Spiel-Chronik)'), 'btnGameOverScoreboard muss passenden Text haben');

// Punktekurven-Modal
assert.ok(indexHtml.includes('id="score-chart-modal"'), 'score-chart-modal muss in index.html vorhanden sein');
assert.ok(indexHtml.includes('id="btnScoreChartClose"'), 'btnScoreChartClose (&times;) muss im Diagramm-Modal existieren');
assert.ok(indexHtml.includes('id="scoreChartPlayerName"'), 'scoreChartPlayerName Header-Element muss existieren');
assert.ok(indexHtml.includes('id="scoreChartPlayerTabs"'), 'scoreChartPlayerTabs Schnellwechsler-Container muss existieren');
assert.ok(indexHtml.includes('id="scoreChartSvgContainer"'), 'scoreChartSvgContainer muss existieren');
assert.ok(indexHtml.includes('id="scoreChartTooltip"'), 'scoreChartTooltip muss existieren');
assert.ok(indexHtml.includes('id="scoreChartMetrics"'), 'scoreChartMetrics Kennzahlen-Container muss existieren');

// CSS-Regeln für das Podest und Diagramm
assert.ok(indexHtml.includes('.podium-player-card'), 'CSS für .podium-player-card muss vorhanden sein');
assert.ok(indexHtml.includes('.podium-stats-row'), 'CSS für .podium-stats-row muss vorhanden sein');
assert.ok(indexHtml.includes('.podium-stat-pill'), 'CSS für .podium-stat-pill muss vorhanden sein');
assert.ok(indexHtml.includes('.podium-chart-btn'), 'CSS für .podium-chart-btn muss vorhanden sein');
assert.ok(indexHtml.includes('.chart-tab-btn'), 'CSS für .chart-tab-btn muss vorhanden sein');
assert.ok(indexHtml.includes('.chart-metric-card'), 'CSS für .chart-metric-card muss vorhanden sein');

// Player-Detail-Modal z-index Prüfung (soll über Siegerehrung 2000 liegen)
assert.ok(indexHtml.includes('id="player-detail-modal"') && indexHtml.includes('z-index: 2300;'), 'player-detail-modal muss z-index: 2300 besitzen');

console.log('✓ 1. HTML-Markup und CSS-Regeln erfolgreich verifiziert!');

// ==========================================
// 2. STATISCHE PRÜFUNG VON CLIENT.JS
// ==========================================
console.log('\n2. Prüfe client.js Funktionen und Logik...');

assert.ok(clientJs.includes('function openScoreChartModal('), 'openScoreChartModal Funktion fehlt');
assert.ok(clientJs.includes('function closeScoreChartModal('), 'closeScoreChartModal Funktion fehlt');
assert.ok(clientJs.includes('function renderScoreChart('), 'renderScoreChart Funktion fehlt');
assert.ok(clientJs.includes('podium-chart-btn'), 'podium-chart-btn Generierung fehlt in client.js');
assert.ok(clientJs.includes('btnGameOverScoreboard'), 'btnGameOverScoreboard Handling fehlt in client.js');
assert.ok(clientJs.includes('👑 '), 'Kronen-Symbol für Spitzenreiter auf der SVG-Kurve vorhanden');

console.log('✓ 2. client.js Funktionen und Bindings erfolgreich verifiziert!');

// ==========================================
// 3. FUNKTIONALE SIMULATION IN VM-SANDBOX
// ==========================================
console.log('\n3. Führe funktionale Simulation des Punktekurven-Diagramms aus...');

function createMockElement(id) {
  const children = [];
  return {
    id,
    className: '',
    style: { display: 'none' },
    attributes: {},
    innerText: '',
    innerHTML: '',
    children,
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
    appendChild(child) { children.push(child); },
    querySelector(sel) {
      if (sel === '.podium-player-info') return { addEventListener: () => {} };
      if (sel === '.podium-chart-btn') return { addEventListener: () => {} };
      return null;
    },
    querySelectorAll(sel) { return []; },
    listeners: {},
    addEventListener(event, fn) {
      this.listeners[event] = fn;
    },
    click() {
      if (this.listeners['click']) this.listeners['click']({ stopPropagation: () => {} });
    }
  };
}

const mockDom = {
  'score-chart-modal': createMockElement('score-chart-modal'),
  'btnScoreChartClose': createMockElement('btnScoreChartClose'),
  'scoreChartPlayerName': createMockElement('scoreChartPlayerName'),
  'scoreChartPlayerTabs': createMockElement('scoreChartPlayerTabs'),
  'scoreChartSvgContainer': createMockElement('scoreChartSvgContainer'),
  'scoreChartTooltip': createMockElement('scoreChartTooltip'),
  'scoreChartMetrics': createMockElement('scoreChartMetrics'),
  'game-over-modal': createMockElement('game-over-modal'),
  'podium-list': createMockElement('podium-list'),
  'btnGameOverScoreboard': createMockElement('btnGameOverScoreboard'),
  'resetGameBtn': createMockElement('resetGameBtn'),
  'btnClaimGlory': createMockElement('btnClaimGlory'),
  'btnGameOverStay': createMockElement('btnGameOverStay'),
  'btnGameOverClose': createMockElement('btnGameOverClose'),
  'btnReopenGameOver': createMockElement('btnReopenGameOver')
};

const sandbox = {
  document: {
    getElementById(id) { return mockDom[id] || null; },
    createElement(tag) { return createMockElement(tag); }
  },
  cachedScoreHistory: [
    {
      round: 1,
      entries: [
        { sessionId: 'sess_merlin', name: 'Merlin', bid: 1, tricksWon: 1, roundPoints: 30, totalScore: 30 },
        { sessionId: 'sess_artus', name: 'Artus', bid: 0, tricksWon: 1, roundPoints: -10, totalScore: -10 },
        { sessionId: 'sess_gandalf', name: 'Gandalf', bid: 0, tricksWon: 0, roundPoints: 20, totalScore: 20 }
      ]
    },
    {
      round: 2,
      entries: [
        { sessionId: 'sess_merlin', name: 'Merlin', bid: 2, tricksWon: 1, roundPoints: -10, totalScore: 20 },
        { sessionId: 'sess_artus', name: 'Artus', bid: 1, tricksWon: 1, roundPoints: 30, totalScore: 20 },
        { sessionId: 'sess_gandalf', name: 'Gandalf', bid: 1, tricksWon: 1, roundPoints: 30, totalScore: 50 }
      ]
    },
    {
      round: 3,
      entries: [
        { sessionId: 'sess_merlin', name: 'Merlin', bid: 2, tricksWon: 2, roundPoints: 40, totalScore: 60 },
        { sessionId: 'sess_artus', name: 'Artus', bid: 0, tricksWon: 0, roundPoints: 20, totalScore: 40 },
        { sessionId: 'sess_gandalf', name: 'Gandalf', bid: 1, tricksWon: 0, roundPoints: -10, totalScore: 40 }
      ]
    }
  ],
  cachedPlayers: [
    { sessionId: 'sess_merlin', name: 'Merlin', totalScore: 60 },
    { sessionId: 'sess_gandalf', name: 'Gandalf', totalScore: 40 },
    { sessionId: 'sess_artus', name: 'Artus', totalScore: 40 }
  ],
  mySessionId: 'sess_merlin',
  escapeHtml(str) { return str; },
  console: console
};

vm.createContext(sandbox);

// Extrahiere renderScoreChart & showGameOverScreen Code aus clientJs
const testScript = `
  ${clientJs.substring(clientJs.indexOf('function openScoreChartModal'), clientJs.indexOf('// Chart Modal Schließen-Buttons'))}
`;

vm.runInContext(testScript, sandbox);

// Führe renderScoreChart für Merlin aus
sandbox.renderScoreChart('sess_merlin');

const svgOutput = mockDom['scoreChartSvgContainer'].innerHTML;
assert.ok(svgOutput.includes('<svg'), 'SVG-Element muss generiert werden');
assert.ok(svgOutput.includes('polyline'), 'Polyline für Kurve muss vorhanden sein');
assert.ok(svgOutput.includes('👑'), 'Merlin war in R1 und R3 auf Platz 1 -> Kronen-Symbol muss im SVG vorhanden sein');

// Prüfe Kennzahlen-Box
const metricsHtml = mockDom['scoreChartMetrics'].innerHTML;
assert.ok(metricsHtml.includes('Spitzenreiter (Platz 1)'), 'Spitzenreiter-Metrik muss angezeigt werden');
assert.ok(metricsHtml.includes('R1') && metricsHtml.includes('R3'), 'Führende Runden 1 und 3 müssen aufgeführt sein');
assert.ok(metricsHtml.includes('Höchststand (Peak)'), 'Peak-Score Metrik muss vorhanden sein');
assert.ok(metricsHtml.includes('60 Pkt.'), 'Höchststand 60 Pkt. muss korrekt ausgewiesen sein');
assert.ok(metricsHtml.includes('Trefferquote'), 'Trefferquote muss aufgeführt sein');
assert.ok(metricsHtml.includes('2/3 (67%)'), 'Trefferquote 2/3 (67%) korrekt berechnet');

// Teste "Alle vergleichen" Modus
sandbox.renderScoreChart('all');
const allSvgOutput = mockDom['scoreChartSvgContainer'].innerHTML;
assert.ok(allSvgOutput.includes('<svg'), 'Vergleichs-SVG muss gerendert werden');
assert.ok(mockDom['scoreChartPlayerName'].innerText.includes('Alle Magier im Vergleich'), 'Titel für Multivergleich korrekt gesetzt');

console.log('✓ 3. Funktionale SVG-Diagramm-Generierung, Platz-1-Kronen und Match-Kennzahlen erfolgreich validiert!');

console.log('\n======================================================');
console.log('🏆 ALLE SIEGEREHRUNGS-STATISTIKEN & DIAGRAMM-TESTS BESTANDEN!');
console.log('======================================================');
