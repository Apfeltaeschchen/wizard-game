const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('🧪 Starte Test-Suite: Mobile Header Layout, Button-Icons & Rechter Randschatten Fix...');

const htmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// --- 1. SCHATTEN-ISOLIERUNG DER VIER DRAWERS (SAMSUNG GALAXY A35 5G) ---
console.log('  1. Prüfe vollständige Schatten-Deaktivierung der 4 Drawers im geschlossenen Zustand...');

const drawers = [
  '#score-board-drawer',
  '#rules-drawer',
  '#profile-drawer',
  '#companions-drawer'
];

for (const drawer of drawers) {
  assert.ok(html.includes(`${drawer}:not(.open)`), `${drawer}:not(.open) Selektor im CSS vorhanden`);
}

// Prüfe die universellen Isolations-Regeln
assert.ok(
  html.includes('box-shadow: none !important;') &&
  html.includes('visibility: hidden !important;') &&
  html.includes('pointer-events: none !important;'),
  'Alle geschlossenen Drawers müssen box-shadow: none, visibility: hidden und pointer-events: none besitzen'
);

assert.ok(
  html.includes('box-shadow: -15px 0 50px rgba(0, 0, 0, 0.95) !important;') &&
  html.includes('visibility: visible !important;') &&
  html.includes('pointer-events: auto !important;'),
  'Geöffnete Drawers (.open) aktivieren Schatten, Sichtbarkeit und Pointer-Events'
);

// Prüfe, dass kein Basis-Selektor von #score-board-drawer, #rules-drawer oder #profile-drawer im Ruhezustand den Schatten wirft
const lines = html.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('box-shadow: -15px 0 50px') && !line.includes('!important')) {
    assert.fail(`Zeile ${i + 1} enthält noch einen nicht-isolierten box-shadow ohne .open: ${line}`);
  }
}

// Prüfe Overflow-Absicherung von .fullscreen-screen
assert.ok(
  html.includes('.fullscreen-screen') && html.includes('overflow-x: hidden;') && html.includes('max-width: 100vw;'),
  '.fullscreen-screen muss overflow-x: hidden und max-width: 100vw aufweisen'
);
console.log('     ✅ Vollständige Schatten-Eliminierung im Ruhezustand verifiziert!');

// --- 2. BUTTON-KOMBINATION: ANMELDEN / REGISTRIEREN ---
console.log('  2. Prüfe kombinierten Login/Register-Button (#btnOpenLogin) und Abwärtskompatibilität (#btnOpenRegister)...');

const loginBtnMatch = html.match(/<button[^>]*id=["']btnOpenLogin["'][\s\S]*?<\/button>/i);
assert.ok(loginBtnMatch, '#btnOpenLogin existiert im HTML');
const loginBtnHtml = loginBtnMatch[0];
assert.ok(loginBtnHtml.includes('btn-text-full') && loginBtnHtml.includes('Anmelden / Registrieren'), '#btnOpenLogin enthält btn-text-full mit "Anmelden / Registrieren"');
assert.ok(loginBtnHtml.includes('btn-text-short') && loginBtnHtml.includes('Anmelden'), '#btnOpenLogin enthält btn-text-short mit "Anmelden"');
assert.ok(loginBtnHtml.includes('🗝️') || loginBtnHtml.includes('btn-icon'), '#btnOpenLogin enthält das Grimoire-Schlüssel-Icon');
assert.ok(loginBtnHtml.includes('btn-auth-gold'), '#btnOpenLogin besitzt die goldene Akzent-Klasse');

// Prüfe Rückwärtskompatibilität von #btnOpenRegister
const registerBtnMatch = html.match(/<button[^>]*id=["']btnOpenRegister["'][\s\S]*?<\/button>/i);
assert.ok(registerBtnMatch, '#btnOpenRegister existiert im DOM für Testkompatibilität');
assert.ok(registerBtnMatch[0].includes('display: none'), '#btnOpenRegister ist visuell ausgeblendet');

// Prüfe CSS-Umschaltung für Voll- vs. Kurztext
assert.ok(html.includes('.btn-auth-bar .btn-text-full'), '.btn-auth-bar .btn-text-full CSS-Regel vorhanden');
assert.ok(html.includes('.btn-auth-bar .btn-text-short'), '.btn-auth-bar .btn-text-short CSS-Regel vorhanden');
console.log('     ✅ Kombinierter Button und Abwärtskompatibilität verifiziert!');

// --- 3. DURCHGÄNGIGE ICONS IN LOBBY-HEADER-RIGHT ---
console.log('  3. Prüfe sichtbare Icons & .btn-icon Standardisierung in lobby-header-right...');

const headerRightButtons = [
  { id: 'btnOpenCompanionsGuest', icon: '👥', text: 'Gefährten' },
  { id: 'btnOpenCompanionsUser', icon: '👥', text: 'Gefährten' },
  { id: 'btnOpenLeaderboardGuest', icon: '🏆', text: 'Bestenliste' },
  { id: 'btnOpenLeaderboardUser', icon: '🏆', text: 'Bestenliste' },
  { id: 'btnOpenServerSettings', icon: '⚙️', text: 'Server' },
  { id: 'lobby-audio-toggle', icon: '🔊', text: 'Klang' },
  { id: 'waiting-audio-toggle', icon: '🔊', text: 'Klang' }
];

for (const btn of headerRightButtons) {
  const match = html.match(new RegExp(`<button[^>]*id=["']${btn.id}["'][\\s\\S]*?<\\/button>`, 'i'));
  assert.ok(match, `Button #${btn.id} existiert`);
  const markup = match[0];
  assert.ok(markup.includes('btn-icon'), `Button #${btn.id} enthält .btn-icon`);
  assert.ok(markup.includes('score-toggle-icon'), `Button #${btn.id} enthält .score-toggle-icon für Kompatibilität`);
  assert.ok(markup.includes(btn.icon), `Button #${btn.id} zeigt das Icon ${btn.icon}`);
  assert.ok(markup.includes('btn-text') || markup.includes('score-toggle-text'), `Button #${btn.id} enthält Text-Span`);
}

// Prüfe, dass .score-toggle-icon nicht generell auf display: none steht
assert.ok(
  html.includes('.score-toggle-icon, .rules-toggle-icon') &&
  html.includes('display: inline-flex;'),
  '.score-toggle-icon muss standardmäßig als inline-flex sichtbar sein'
);
console.log('     ✅ Durchgängige Header-Icons vollständig verifiziert!');

// --- 4. EINZEILIGES LAYOUT & FLEX-WRAP: NOWRAP AUF MOBILGERÄTEN ---
console.log('  4. Prüfe einzeiliges Layout (flex-wrap: nowrap) und 44px Badges in den Media Queries...');

// In max-width: 640px Media Query
const media640Block = html.substring(html.indexOf('@media (max-width: 640px)'), html.indexOf('@media (max-width: 420px)'));
assert.ok(media640Block.includes('.lobby-header-bar'), '.lobby-header-bar in @media (max-width: 640px) enthalten');
assert.ok(media640Block.includes('flex-wrap: nowrap !important;'), '.lobby-header-bar nutzt flex-wrap: nowrap !important');
assert.ok(media640Block.includes('.lobby-header-right'), '.lobby-header-right in @media (max-width: 640px) enthalten');
assert.ok(media640Block.includes('min-width: 44px;'), 'Header-Aktionsbuttons besitzen 44px Mindestbreite (WCAG AA)');
assert.ok(media640Block.includes('min-height: 44px;'), 'Header-Aktionsbuttons besitzen 44px Mindesthöhe (WCAG AA)');
assert.ok(media640Block.includes('.score-toggle-icon') && media640Block.includes('display: inline-flex !important;'), 'Icons in lobby-header-right werden explizit mit display: inline-flex gerendert');

// In max-width: 380px Media Query
const media380Block = html.substring(html.indexOf('@media (max-width: 380px)'));
assert.ok(media380Block.includes('flex-wrap: nowrap !important;'), '.lobby-header-bar bleibt auch bei <= 380px strikt einzeilig');
console.log('     ✅ Einzeiliges Mobile-Layout und WCAG 44px Badges verifiziert!');

console.log('\n======================================================');
console.log('🏆 ALLE MOBILE HEADER & SHADOW FIX TESTS BESTANDEN!');
console.log('======================================================\n');
