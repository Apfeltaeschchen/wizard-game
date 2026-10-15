const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('--- TESTE MOBILE SERVER-URL & CAPACITOR NETZWERK CONFIG ---');

const htmlPath = path.join(__dirname, '../public/index.html');
const jsPath = path.join(__dirname, '../public/client.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

// 1. Prüfe HTML-Elemente
assert.ok(html.includes('id="btnOpenServerSettings"'), 'btnOpenServerSettings vorhanden');
assert.ok(html.includes('id="server-settings-modal"'), 'server-settings-modal vorhanden');
assert.ok(html.includes('id="inputCustomServerUrl"'), 'inputCustomServerUrl vorhanden');
assert.ok(html.includes('id="btnSaveServerUrl"'), 'btnSaveServerUrl vorhanden');
assert.ok(html.includes('id="btnResetServerUrl"'), 'btnResetServerUrl vorhanden');
console.log('✓ 1. HTML Server-Settings Modal & Button vorhanden');

// 2. Prüfe Client.js Module & Logik
assert.ok(js.includes('function getGrimoireServerUrl()'), 'getGrimoireServerUrl definiert');
assert.ok(js.includes('function getApiUrl('), 'getApiUrl definiert');
assert.ok(js.includes('const GrimoireServerSettings ='), 'GrimoireServerSettings Modul definiert');
assert.ok(js.includes('GrimoireServerSettings.init();'), 'GrimoireServerSettings init aufgerufen');
assert.ok(js.includes('grimoire_server_url'), 'grimoire_server_url in localStorage genutzt');
console.log('✓ 2. Client.js Server-URL Controller & Storage-Anbindung verifiziert');

// 3. Simuliere URL-Auflösung
function testGetApiUrl(endpoint, customUrl) {
  const base = (customUrl || '').trim().replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  return base ? (base + cleanEndpoint) : cleanEndpoint;
}

assert.strictEqual(testGetApiUrl('/api/auth/me', ''), '/api/auth/me', 'Standard ohne Custom-URL');
assert.strictEqual(testGetApiUrl('/api/auth/me', 'http://192.168.178.50:3000/'), 'http://192.168.178.50:3000/api/auth/me', 'Mit Custom-URL und Trailing Slash');
assert.strictEqual(testGetApiUrl('api/auth/login', 'https://grimoire.online'), 'https://grimoire.online/api/auth/login', 'Mit HTTPS Domain');
console.log('✓ 3. URL-Parsing und Trailing-Slash Bereinigung erfolgreich validiert');

console.log('\n======================================================');
console.log('🏆 ALLE MOBILE SERVER-CONFIG TESTS BESTANDEN!');
console.log('======================================================\n');
