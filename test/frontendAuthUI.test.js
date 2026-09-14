const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('--- TESTE FRONTEND AUTH & PROFILE UI INTEGRATION ---');

const htmlPath = path.join(__dirname, '../public/index.html');
const jsPath = path.join(__dirname, '../public/client.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

// 1. Prüfe Lobby-Bar
assert.ok(html.includes('id="auth-lobby-bar"'), 'auth-lobby-bar vorhanden');
assert.ok(html.includes('id="auth-guest-controls"'), 'auth-guest-controls vorhanden');
assert.ok(html.includes('id="auth-user-controls"'), 'auth-user-controls vorhanden');
assert.ok(html.includes('id="authUserPill"'), 'authUserPill vorhanden');
assert.ok(html.includes('id="btnOpenProfile"'), 'btnOpenProfile vorhanden');
assert.ok(html.includes('id="btnOpenLeaderboardGuest"'), 'btnOpenLeaderboardGuest vorhanden');
console.log('✓ 1. Lobby-Bar & Wappen-Pille verifiziert');

// 2. Prüfe Auth-Modal & Wappen-Design
assert.ok(html.includes('id="auth-modal"'), 'auth-modal vorhanden');
assert.ok(html.includes('id="tabLoginBtn"'), 'tabLoginBtn vorhanden');
assert.ok(html.includes('id="tabRegisterBtn"'), 'tabRegisterBtn vorhanden');
assert.ok(html.includes('id="authSubmitBtn"'), 'authSubmitBtn vorhanden');
assert.ok(html.includes('id="authGuestBtn"'), 'authGuestBtn vorhanden');
assert.ok(html.includes('id="lobbyUserAvatarShield"'), 'lobbyUserAvatarShield vorhanden');
assert.ok(html.includes('id="profileAvatarShield"'), 'profileAvatarShield vorhanden');
console.log('✓ 2. Schlankes Auth-Modal & heraldische Wappenschilder verifiziert');

// 3. Prüfe Profil-Drawer & E-Sport Banner
assert.ok(html.includes('id="profile-drawer"'), 'profile-drawer vorhanden');
assert.ok(html.includes('data-drawer="profile-drawer"'), 'profile-drawer resize handle vorhanden');
assert.ok(html.includes('class="esport-banner"'), 'E-Sport Alltime Win/Loss Banner vorhanden');
assert.ok(html.includes('id="profileWinRate"'), 'profileWinRate vorhanden');
assert.ok(html.includes('id="profileProphecyRate"'), 'profileProphecyRate vorhanden');
assert.ok(html.includes('id="profileTitleSelect"'), 'profileTitleSelect vorhanden');
console.log('✓ 3. Profil-Drawer, E-Sport W/L Banner & Wizard-Statistiken verifiziert');

// 4. Prüfe Leaderboard-Modal & Austeil-Animation
assert.ok(html.includes('id="leaderboard-modal"'), 'leaderboard-modal vorhanden');
assert.ok(html.includes('id="leaderboardTableBody"'), 'leaderboardTableBody vorhanden');
assert.ok(html.includes('card-fly-up'), 'card-fly-up CSS vorhanden');
assert.ok(html.includes('cardFlyUpEntrance'), 'cardFlyUpEntrance Keyframe vorhanden');
console.log('✓ 4. Leaderboard-Modal & Fly-Up Austeil-Animation verifiziert');

// 5. Prüfe Client.js Module & Logik
assert.ok(js.includes('const WizardAuth ='), 'WizardAuth Modul definiert');
assert.ok(js.includes('WizardAuth.init();'), 'WizardAuth init aufgerufen');
assert.ok(js.includes('wizard_auth_token'), 'wizard_auth_token in localStorage genutzt');
assert.ok(js.includes('/api/auth/me'), 'GET /api/auth/me aufgerufen');
assert.ok(js.includes('/api/auth/login'), 'POST /api/auth/login aufgerufen');
assert.ok(js.includes('/api/auth/register'), 'POST /api/auth/register aufgerufen');
assert.ok(js.includes('/api/auth/profile'), 'PATCH /api/auth/profile aufgerufen');
assert.ok(js.includes('/api/leaderboard'), 'GET /api/leaderboard aufgerufen');
assert.ok(js.includes('seat-avatar'), 'seat-avatar Wappenschild wird gerendert');
assert.ok(js.includes('card-fly-up'), 'card-fly-up wird in client.js angewendet');
assert.ok(js.includes('p.title'), 'p.title wird in UI gerendert');
console.log('✓ 5. WizardAuth Modul & Methoden in client.js verifiziert');

console.log('\n======================================================');
console.log('ALLE FRONTEND UI & AUTH INTEGRATIONSTESTS BESTANDEN!');
console.log('======================================================\n');
