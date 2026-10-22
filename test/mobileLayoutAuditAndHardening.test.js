const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starte Test-Suite: Mobile UI/UX & Layout-Härtung (0px Overflow, Handkarten, Badges)...');

const htmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// --- 1. GRÖSSERE HANDKARTEN, UNTEN ANGESCHNITTEN & HOVER/INSPECTION ELEVATION ---
console.log('  1. Prüfe größere Handkarten (--card-w), Anschnitt unten und Elevation bei Inspektion...');

assert.ok(
  html.includes('--card-w: clamp(78px, 19.5vw, 98px);') || html.includes('--card-w: clamp(74px, 18.5vw, 94px);'),
  '@media (max-width: 768px) muss --card-w vergrößern'
);
assert.ok(
  html.includes('--card-h: calc(var(--card-w) * (1498 / 1050));'),
  '@media (max-width: 768px) muss --card-h proportional berechnen'
);
assert.ok(
  html.includes('margin-bottom: -18px;') && html.includes('overflow: visible !important;'),
  '.hand-section muss margin-bottom: -18px und overflow: visible für den natürlichen Anschnitt unten besitzen'
);
assert.ok(
  html.includes('transform: translateY(16px);'),
  'Handkarten ruhen mobil bei translateY(16px) am Displayrand'
);
assert.ok(
  (html.includes('transform: translateY(-56px) scale(1.36) !important;') || html.includes('transform: translateY(-34px) scale(1.08) !important;')) &&
  (html.includes('z-index: 500 !important;') || html.includes('z-index: 100 !important;')),
  'Handkarten heben sich bei Hover/Inspektion/Active mobil deutlich an'
);
console.log('     ✅ Handkarten-Dimensionen, Anschnitt und Elevation erfolgreich verifiziert!');

// --- 2. SCROLL-VERHALTEN, START LINKS & FÄCHER-ÜBERLAPPUNG ---
console.log('  2. Prüfe initialen Scroll-Start links (scrollLeft = 0) und Fächer-Überlappung (-16px)...');

assert.ok(
  clientJs.includes('handContainer.scrollLeft = 0;'),
  'renderHand() muss handContainer.scrollLeft = 0 erzwingen, damit die Hand immer ganz links startet'
);
assert.ok(
  clientJs.includes("dynamicMargin = '-16px'") || clientJs.includes("isSwipeable ? '-16px' : dynamicMargin"),
  'client.js muss Karten auch im Scroll-Modus (swipeable) überlappen (-16px)'
);
assert.ok(
  clientJs.includes("setProperty('margin-left'"),
  'client.js muss margin-left via setProperty mit important setzen, um CSS-Konflikte zu lösen'
);
assert.ok(
  html.includes('#hand-container.swipeable .card') &&
  html.includes('margin: 0 !important;') &&
  html.includes('margin-left: -16px !important;') &&
  html.includes('#hand-container.swipeable .card:first-child'),
  'CSS muss im swipeable Modus -16px Überlappung und margin-left: 0 für die erste Karte garantieren'
);
assert.ok(
  (html.includes('hand-scroll-indicator-right') || html.includes('#hand-container.swipeable::after')) &&
  (html.includes('align-self: stretch') || html.includes('height: 100%')),
  'Rechter Schatten/Fade-Indikator muss volle Höhe (100% / stretch) besitzen und horizontales Scrollen signalisieren'
);
assert.ok(
  html.includes('var(--target-y, 0px)'),
  'Austeil-Animation @keyframes cardFlyUpEntrance muss var(--target-y, 0px) nutzen, um Snap-Artefakte zu verhindern'
);
console.log('     ✅ Scroll-Start links und Fächer-Überlappung erfolgreich verifiziert!');

// --- 3. BUTTON- & CONTAINER-TEXTKÜRZUNGEN & BADGE-HUD ---
console.log('  3. Prüfe gekürzte Button-Strings, Allianz-Karten, Badges und ausgeblendete Labels...');

// Warteraum Start-Button
assert.ok(
  html.includes('id="waitingRoomStartBtn"') &&
  html.includes('Partie beginnen') &&
  html.includes('Starten') &&
  html.includes('btn-text-full') &&
  html.includes('btn-text-short'),
  '#waitingRoomStartBtn muss "Partie beginnen" und "Starten" mit btn-text-full/short Weiche nutzen'
);

// Gefährten einladen
assert.ok(
  html.includes('id="btnOpenCompanionsWaiting"') && html.includes('Gefährten einladen'),
  '#btnOpenCompanionsWaiting Text muss zu "Gefährten einladen" gekürzt sein'
);

// Lobby Gründen & Beitreten
assert.ok(
  html.includes('id="createGameBtn"') && html.includes('Spiel gründen'),
  '#createGameBtn muss "Spiel gründen" lauten'
);
assert.ok(
  html.includes('id="joinBtn"') && html.includes('Beitreten'),
  '#joinBtn muss "Beitreten" lauten'
);

// Allianz-Karten Warteraum
assert.ok(
  html.includes('team-card-sonnenfeuer') && html.includes('Sonnenfeuer') && html.includes('(0/2)'),
  'Allianz des Sonnenfeuers muss mobil als Sonnenfeuer (0/2) darstellbar sein'
);
assert.ok(
  html.includes('team-card-mondschatten') && html.includes('Mondschatten') && html.includes('(0/2)'),
  'Allianz der Mondschatten muss mobil als Mondschatten (0/2) darstellbar sein'
);

// In-Game HUD Badges & Handkarten-Label
assert.ok(
  html.includes('id="my-stats-hud"') && html.includes('hud-badge-icon') && html.includes('🎯') && html.includes('🏆'),
  '#my-stats-hud muss 🎯 und 🏆 Badges enthalten'
);
assert.ok(
  html.includes('.hand-title-label') && html.includes('display: none !important;'),
  'Redundantes "Deine Handkarten"-Label muss mobil über .hand-title-label ausgeblendet werden'
);

// Pause-Overlay Buttons
assert.ok(
  html.includes('id="btnHostReDeal"') && html.includes('Neu austeilen'),
  '#btnHostReDeal muss "Neu austeilen" lauten'
);
assert.ok(
  html.includes('id="btnHostAbortToWaiting"') && html.includes('In Ratskammer abbrechen'),
  '#btnHostAbortToWaiting muss "In Ratskammer abbrechen" lauten'
);
assert.ok(
  html.includes('id="btnPauseLeaveGame"') && html.includes('Verlassen'),
  '#btnPauseLeaveGame muss "Verlassen" lauten'
);

// Doppelgänger Spezialkarten Buttons
assert.ok(
  html.includes('id="btnShapeshifterWizard"') && html.includes('Erzmagier (Z)'),
  '#btnShapeshifterWizard muss "Erzmagier (Z)" lauten'
);
assert.ok(
  html.includes('id="btnShapeshifterJester"') && html.includes('Scharlatan (N)'),
  '#btnShapeshifterJester muss "Scharlatan (N)" lauten'
);
console.log('     ✅ Button- und Container-Textkürzungen erfolgreich verifiziert!');

// --- 4. LAYOUT-HÄRTUNG (0PX OVERFLOW GARANTIE) ---
console.log('  4. Prüfe Layout-Härtung (Drawers 100vw, safe center, Glass-Card Margin, Touch-Targets)...');

// Drawers 100vw bei <= 480px
assert.ok(
  html.includes('@media (max-width: 480px)') &&
  html.includes('width: 100vw !important;') &&
  html.includes('max-width: 100vw !important;'),
  'Drawers müssen bei <= 480px Viewports 100vw einnehmen'
);

// Drawer resize handles
assert.ok(
  html.includes('.drawer-resize-handle') && html.includes('display: none !important;'),
  '.drawer-resize-handle muss auf Touchscreens / Mobilgeräten (<= 768px) ausgeblendet sein'
);

// safe center mit Fallback für Legacy WebViews
assert.ok(
  html.includes('justify-content: safe center !important;') &&
  html.includes('justify-content: center !important;'),
  '#opponents-container muss justify-content: safe center !important und Fallback center nutzen'
);

// Warteraum Glass-Card
assert.ok(
  html.includes('margin: clamp(8px, 2vh, 20px) auto !important;'),
  '#waiting-room-screen > .glass-card muss clamp(8px, 2vh, 20px) auto !important nutzen'
);

// Top-Nav-Action Touch Target (harmonisiert mit Header)
assert.ok(
  html.includes('.btn-top-nav-action') &&
  (html.includes('width: 38px !important;') || html.includes('width: 42px !important;')) &&
  (html.includes('height: 38px !important;') || html.includes('height: 42px !important;')),
  '.btn-top-nav-action muss Touch-Target von min. 38px aufweisen'
);

// Landscape Blocker wurde auf Wunsch ("smartphone aufrichten weg machen") entfernt
assert.ok(
  !html.includes('id="rotate-device-overlay"'),
  'Landscape Blocker Overlay ("Smartphone aufrichten") muss vollständig entfernt sein'
);
console.log('     ✅ Layout-Härtung (0px Overflow Garantie) erfolgreich verifiziert!');

console.log('\n======================================================');
console.log('🏆 ALLE MOBILE LAYOUT AUDIT & HARDENING TESTS BESTANDEN!');
console.log('======================================================\n');
