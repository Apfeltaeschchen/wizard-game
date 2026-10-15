const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Starte Test-Suite: Minimalist Seats, Player Profile Modal & Stirnkarten...');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// 1. Verifiziere das Magier-Profil Modal (#player-detail-modal) in index.html
console.log('  1. Prüfe HTML-Struktur von #player-detail-modal...');
assert(indexHtml.includes('id="player-detail-modal"'), '#player-detail-modal fehlt in index.html');
assert(indexHtml.includes('id="playerDetailAvatar"'), '#playerDetailAvatar fehlt');
assert(indexHtml.includes('id="playerDetailName"'), '#playerDetailName fehlt');
assert(indexHtml.includes('id="playerDetailTitle"'), '#playerDetailTitle fehlt');
assert(indexHtml.includes('id="playerDetailStatus"'), '#playerDetailStatus fehlt');
assert(indexHtml.includes('id="playerDetailRankBox"'), '#playerDetailRankBox fehlt');
assert(indexHtml.includes('id="playerDetailDivision"'), '#playerDetailDivision fehlt');
assert(indexHtml.includes('id="playerDetailSR"'), '#playerDetailSR fehlt');
assert(indexHtml.includes('id="playerDetailStatsTitle"'), '#playerDetailStatsTitle fehlt');
assert(indexHtml.includes('id="playerDetailStatsGrid"'), '#playerDetailStatsGrid fehlt');
assert(indexHtml.includes('id="btnPlayerDetailAddFriend"'), '#btnPlayerDetailAddFriend fehlt');
assert(indexHtml.includes('id="btnPlayerDetailClose"'), '#btnPlayerDetailClose fehlt');
assert(indexHtml.includes('id="playerDetailModalClose"'), '#playerDetailModalClose fehlt');
console.log('     ✅ #player-detail-modal Struktur ist vollständig!');

// 2. Verifiziere das Desktop-Overlay-Verhalten für das Grimoire der Gefährten
console.log('  2. Prüfe Desktop-Backdrop-Fix in CSS & JS...');
assert(indexHtml.includes('@media (min-width: 769px)') && indexHtml.includes('#drawer-backdrop') && indexHtml.includes('display: none !important;'),
  'Desktop-Backdrop sollte bei >= 769px ausgeblendet sein');
assert(clientJs.includes("CompanionsManager.close()"), 'CompanionsManager.close() fehlt im Backdrop/Drawer-Cleanup');
assert(clientJs.includes("e.key === 'Escape'"), 'Escape-Key-Handler fehlt in client.js');
console.log('     ✅ Desktop-Overlay-Fix und Escape-Handler erfolgreich validiert!');

// 3. Verifiziere die minimalistischen Sitze & Mobile Styles
console.log('  3. Prüfe minimalistische Sitze und Mobile Responsive Regeln...');
assert(indexHtml.includes('.seat-dealer-pin'), '.seat-dealer-pin CSS fehlt in index.html');
assert(indexHtml.includes('.player-seat .seat-name-row') && indexHtml.includes('display: none !important;'),
  'Auf mobilen Geräten muss der Name-Row ausgeblendet werden');
assert(indexHtml.includes('.player-seat .seat-avatar') && indexHtml.includes('width: 28px !important;'),
  'Mobile Avatar muss kompakt sein (28px)');
console.log('     ✅ Minimalistische Sitze & Smartphone-Medaillons erfolgreich validiert!');

// 4. Verifiziere Stirnkarte in Runde 1 (Drittes Magie-Auge)
console.log('  4. Prüfe schwebende Stirnkarten-Animation (Runde 1)...');
assert(indexHtml.includes('@keyframes foreheadCardFloat'), '@keyframes foreheadCardFloat fehlt in CSS');
assert(indexHtml.includes('.forehead-floating-card'), '.forehead-floating-card CSS fehlt in index.html');
assert(clientJs.includes('class="forehead-floating-card"'), 'renderOpponents muss .forehead-floating-card verwenden');
console.log('     ✅ Stirnkarten-Animation und Floating-Klasse erfolgreich validiert!');

// 5. Verifiziere openPlayerDetailModal Controller und Klick-Events
console.log('  5. Prüfe openPlayerDetailModal Controller und Klick-Verknüpfung...');
assert(clientJs.includes('function openPlayerDetailModal(data, source = \'table\')'),
  'openPlayerDetailModal Funktion fehlt in client.js');
assert(clientJs.includes('openPlayerDetailModal(p, \'table\')'),
  'Klick auf Gegnersitz muss openPlayerDetailModal aufrufen');
assert(clientJs.includes('openPlayerDetailModal(friend, \'friends\')'),
  'Klick auf Freundeskarte im Grimoire muss openPlayerDetailModal aufrufen');
assert(clientJs.includes('window.openPlayerDetailModal = openPlayerDetailModal'),
  'openPlayerDetailModal muss global verfügbar sein');
console.log('     ✅ Magier-Profil Controller & Klick-Events erfolgreich verifiziert!');

console.log('\n🎉 Alle Tests für Minimalist Seats, Player Profile Modal & Stirnkarten erfolgreich bestanden!');
