const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- STARTE TEST-SUITE: SCHRITT 4 – MOBILE FEINSCHLIFF & HEADER-HARMONISIERUNG ---');

const htmlPath = path.join(__dirname, '../public/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const clientPath = path.join(__dirname, '../public/client.js');
const client = fs.readFileSync(clientPath, 'utf8');

// ============================================================================
// 1. 🎴 HANDKARTEN-FÄCHER AB 5 KARTEN & VERGRÖSSERUNG (4.1 & 4.2)
// ============================================================================
console.log('1. Prüfe Handkarten-Fächer ab 5 Karten & Vergrößerung...');

// Prüfe isSwipeable Bedingung in client.js
assert(client.includes('const isSwipeable = isMobile && total >= 5;'), 'isSwipeable muss auf Mobilgeräten ab >= 5 Handkarten greifen');
assert(client.includes('dynamicMargin = \'-16px\';'), 'Swipeable Handkarten müssen mit -16px fächerartig überlappen');

// Prüfe Basis-Kartenbreite in index.html (78px bis 98px)
assert(html.includes('--card-w: clamp(78px, 19.5vw, 98px);'), 'Basis-Kartenbreite auf Mobile muss auf 78px bis 98px vergrößert sein');

// Prüfe .card.card-inspected Vergrößerung auf scale(1.36) und translateY(-56px)
assert(html.includes('transform: translateY(-56px) scale(1.36) !important;'), 'Inspektierte Karten müssen sich auf scale(1.36) und translateY(-56px) vergrößern');
assert(html.includes('z-index: 500 !important;'), 'Inspektierte Karten müssen mit hohem z-index hervorgehoben werden');

console.log('✓ 4.1 & 4.2 Handkarten-Fächer ab 5 Karten und Klick-Vergrößerung erfolgreich validiert!');

// ============================================================================
// 2. 🏛️ LOBBY-HEADER BEREINIGUNG & ABMELDEBUTTON INS PROFIL (4.3, 4.4a, 4.7, 4.8)
// ============================================================================
console.log('2. Prüfe Lobby-Header Bereinigung & Abmeldebutton im Profil...');

// Prüfe, dass btnLogout in profile-drawer vorhanden ist
assert(html.includes('class="profile-logout-wrap"'), 'profile-logout-wrap muss im profile-drawer existieren');
assert(html.includes('<button id="btnLogout" type="button" class="btn-auth-bar btn-auth-danger"'), 'btnLogout muss sich im profile-drawer befinden');

// Prüfe, dass btnOpenProfile im Lobby-Header nicht mehr sichtbar ist
assert(html.includes('id="btnOpenProfile" type="button" class="btn-auth-bar btn-hybrid-compact" style="display: none !important;"'), 'btnOpenProfile muss im Lobby-Header display: none !important besitzen');

// Prüfe, dass .btn-header-action[style*="display: none"] durch CSS geschützt ist
assert(html.includes('.btn-header-action[style*="display: none"]'), 'CSS muss ausgeblendete Header-Buttons strikt auf display: none !important forcieren');

// Prüfe, dass renderLobbyBar() safeSetDisplay mit important nutzt
assert(client.includes("el.style.setProperty('display', val, 'important')"), 'safeSetDisplay muss im Browser important erzwingen');
assert(client.includes("safeSetDisplay(companionsGuest, 'none')"), 'renderLobbyBar muss companionsGuest via safeSetDisplay ausblenden');
assert(client.includes("safeSetDisplay(companionsUser, 'none')"), 'renderLobbyBar muss companionsUser im Gastmodus via safeSetDisplay ausblenden');

console.log('✓ 4.3, 4.4a, 4.7 & 4.8 Lobby-Header Bereinigung erfolgreich validiert!');

// ============================================================================
// 3. ⚔️ IN-GAME HEADER-BUTTONS HARMONISIERUNG (4.4b)
// ============================================================================
console.log('3. Prüfe In-Game Header-Buttons Harmonisierung...');

// Prüfe .top-nav-bar Mindesthöhe 50px und .btn-top-nav-action 38px
assert(html.includes('min-height: 50px;'), '.top-nav-bar muss min-height: 50px; besitzen');
assert(html.includes('width: 38px !important;'), '.btn-top-nav-action muss width: 38px !important; besitzen');
assert(html.includes('height: 38px !important;'), '.btn-top-nav-action muss height: 38px !important; besitzen');
assert(html.includes('margin: auto 0 !important;'), '.btn-top-nav-action muss mit margin: auto 0 zentriert sein');

console.log('✓ 4.4b In-Game Header-Buttons schweben perfekt zentriert ohne Kanten-Kollision!');

// ============================================================================
// 4. 🔮 RUNDE 1 STIRNKARTEN-SCHAU & GROSSANSICHT (4.5)
// ============================================================================
console.log('4. Prüfe Runde 1 Stirnkarten-Großansicht & Lightbox-Modal...');

// Prüfe vergrößerte Stirnkarten am Sitz
assert(html.includes('width: calc(var(--card-w) * 0.82) !important;'), 'Stirnkarte muss mit 0.82 skaliert sein für klare Artwork-Sichtbarkeit');

// Prüfe forehead-inspect-modal im HTML
assert(html.includes('id="forehead-inspect-modal"'), '#forehead-inspect-modal muss im HTML existieren');
assert(html.includes('id="foreheadInspectCardContainer"'), '#foreheadInspectCardContainer muss existieren');

// Prüfe openForeheadInspectModal Funktion und Klick-Verknüpfung im Sitz
assert(client.includes('function openForeheadInspectModal(player)'), 'openForeheadInspectModal Controller muss in client.js definiert sein');
assert(client.includes('openForeheadInspectModal(p);'), 'Klick auf Stirnkarte am Sitz muss openForeheadInspectModal(p) aufrufen');

console.log('✓ 4.5 Runde 1 Stirnkarten-Großansicht und Inspektion erfolgreich validiert!');

// ============================================================================
// 5. ➕ GEFÄHRTEN 'HINZUFÜGEN'-BUTTON KOMPAKTIERUNG (4.6)
// ============================================================================
console.log('5. Prüfe Kompaktierung von btnAddFriend im Gefährten-Grimoire...');

assert(html.includes('id="btnAddFriend"'), 'btnAddFriend muss vorhanden sein');
assert(html.includes('height: 38px; min-height: 38px;'), 'btnAddFriend muss passgenau 38px Höhe besitzen');
assert(html.includes('<span class="btn-text-short">Neu</span>'), 'btnAddFriend muss kurze responsive Beschriftung besitzen');

console.log('✓ 4.6 Gefährten Hinzufügen-Button erfolgreich kompaktiert!');

console.log('\n======================================================');
console.log('🎉 ALLE TESTS FÜR SCHRITT 4 (MOBILE FEINSCHLIFF) BESTANDEN!');
console.log('======================================================\n');
