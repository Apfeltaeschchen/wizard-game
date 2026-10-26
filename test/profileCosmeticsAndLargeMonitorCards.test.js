const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: PROFIL-KOSMETIK & GROSSE BILDSCHIRME START ---');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');

assert.ok(fs.existsSync(indexHtmlPath), 'index.html existiert');
assert.ok(fs.existsSync(clientJsPath), 'client.js existiert');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const clientJs = fs.readFileSync(clientJsPath, 'utf8');

// [1/3] Überprüfe Profil-Drawer Ausrüstungs-Bereich (Dropdown-Menü bereinigt, Schnellzugriff zur Garderobe)
console.log('[1/3] Überprüfe Profil-Garderobe Elemente...');
assert.ok(!indexHtml.includes('id="profileSelectAvatar"'), 'profileSelectAvatar Dropdown erfolgreich aus Profil entfernt');
assert.ok(!indexHtml.includes('id="profileSelectFrame"'), 'profileSelectFrame Dropdown erfolgreich aus Profil entfernt');
assert.ok(!indexHtml.includes('id="profileSelectCardBack"'), 'profileSelectCardBack Dropdown erfolgreich aus Profil entfernt');
assert.ok(!indexHtml.includes('id="profileSelectTableSkin"'), 'profileSelectTableSkin Dropdown erfolgreich aus Profil entfernt');
assert.ok(indexHtml.includes('id="btnProfileOpenVault"'), 'btnProfileOpenVault Button für direkte Garderoben-Verwaltung vorhanden');
console.log('✓ Profil-Drawer sauber bereinigt: Garderobe wird exklusiv in der Schatzkammer verwaltet.');

// [2/3] Überprüfe progressive CSS-Skalierung für große Monitore
console.log('[2/3] Überprüfe progressive CSS-Skalierung für große Monitore (1080p, 1440p, 4K)...');
assert.ok(indexHtml.includes('@media (min-width: 1400px) and (min-height: 800px)'), '1400px Desktop Breakpoint definiert');
assert.ok(indexHtml.includes('clamp(105px, 8.8vw, 160px)'), '1400px Kartenbreite bis 160px');
assert.ok(indexHtml.includes('@media (min-width: 1900px) and (min-height: 950px)'), '1900px Full HD / WQHD Breakpoint definiert');
assert.ok(indexHtml.includes('clamp(125px, 9vw, 185px)'), '1900px Kartenbreite bis 185px');
assert.ok(indexHtml.includes('@media (min-width: 2500px) and (min-height: 1200px)'), '2500px 4K UHD Breakpoint definiert');
assert.ok(indexHtml.includes('clamp(150px, 9vw, 230px)'), '2500px Kartenbreite bis 230px');
console.log('✓ Progressive CSS-Skalierung für Desktop- & Großmonitore verifiziert.');

// [3/3] Überprüfe Client.js Controller Hooks
console.log('[3/3] Überprüfe Client.js Profil-Garderobe Controller...');
assert.ok(clientJs.includes('function renderProfileCosmetics()'), 'renderProfileCosmetics Funktion implementiert');
assert.ok(clientJs.includes('WizardVault.equipItem'), 'WizardVault.equipItem wird im Profil aufgerufen');
assert.ok(clientJs.includes('btnProfileOpenVault'), 'btnProfileOpenVault Click-Handler registriert');
assert.ok(clientJs.includes('avatarShieldEl.className = `seat-avatar frame-${f}`'), 'Profil-Avatar rendert Rahmen');
assert.ok(clientJs.includes('getVaultData: () => vaultData'), 'WizardVault exponiert getVaultData');
console.log('✓ Client.js Profil-Garderoben Integration verifiziert.');

console.log('--- TEST: PROFIL-KOSMETIK & GROSSE BILDSCHIRME BESTANDEN! ---');
