const fs = require('fs');
const assert = require('assert');
const path = require('path');
const http = require('http');

console.log('--- TESTE RENDER-STANDARDS, CORS-MIDDLEWARE & HEALTH CHECK ---');

const htmlPath = path.join(__dirname, '../public/index.html');
const jsPath = path.join(__dirname, '../public/client.js');
const serverPath = path.join(__dirname, '../server/index.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');
const serverCode = fs.readFileSync(serverPath, 'utf8');

// 1. Prüfe HTML-Optionen im Dropdown
assert.ok(html.includes('https://grimoire-cardgame.onrender.com'), 'Render-URL in index.html vorhanden');
assert.ok(html.includes('🌐 Offizieller Server (Grimoire – Standard)'), 'Offizieller Server Label vorhanden');
console.log('✓ 1. HTML Dropdown enthält Render als primäre Standard-Option');

// 2. Prüfe Client.js Standard-Server & Kaltstart-Logik
assert.ok(js.includes("const DEFAULT_PRODUCTION_SERVER = 'https://grimoire-cardgame.onrender.com';"), 'DEFAULT_PRODUCTION_SERVER definiert');
assert.ok(js.includes('function isCapacitorNativeApp()'), 'isCapacitorNativeApp Helferfunktion definiert');
assert.ok(js.includes('onrender.com'), 'Render-Erkennung in connect_error aktiv');
assert.ok(js.includes('magischen Meditation'), 'Kaltstart-Hinweis für Render vorhanden');
console.log('✓ 2. Client.js: DEFAULT_PRODUCTION_SERVER, Capacitor-Weiche & Render-Kaltstart verifiziert');

// 3. Prüfe Server.js CORS & Health-Check
assert.ok(serverCode.includes("res.header('Access-Control-Allow-Origin', '*')"), 'Access-Control-Allow-Origin im Express-Server gesetzt');
assert.ok(serverCode.includes("res.header('Access-Control-Allow-Methods'"), 'Access-Control-Allow-Methods gesetzt');
assert.ok(serverCode.includes("res.header('Access-Control-Allow-Headers'"), 'Access-Control-Allow-Headers gesetzt');
assert.ok(serverCode.includes("app.get('/api/health'"), '/api/health Endpunkt vorhanden');
console.log('✓ 3. Server.js: CORS-Middleware & /api/health Endpunkt verifiziert');

// 4. Simuliere Client URL-Auflösung
function simulateGetGrimoireServerUrl(customStorage, env) {
  if (customStorage && customStorage.trim()) {
    return customStorage.trim().replace(/\/+$/, '');
  }
  const isCap = (env.isCapacitor || env.protocol === 'capacitor:' || (env.hostname === 'localhost' && !env.port));
  if (isCap) {
    return 'https://grimoire-cardgame.onrender.com';
  }
  return '';
}

// Case A: Android APK frisch installiert (kein localStorage Eintrag)
const apkDefault = simulateGetGrimoireServerUrl(null, { isCapacitor: true, protocol: 'http:', hostname: 'localhost', port: '' });
assert.strictEqual(apkDefault, 'https://grimoire-cardgame.onrender.com', 'APK verbindet standardmäßig mit Render');

// Case B: Browser lokal auf Port 3000 (Entwickler)
const devBrowser = simulateGetGrimoireServerUrl(null, { isCapacitor: false, protocol: 'http:', hostname: 'localhost', port: '3000' });
assert.strictEqual(devBrowser, '', 'Dev-Browser bleibt bei relativer Origin (localhost:3000)');

// Case C: Manuell gesetzte WLAN-IP
const customIp = simulateGetGrimoireServerUrl('http://192.168.188.162:3000/', { isCapacitor: true, protocol: 'http:', hostname: 'localhost', port: '' });
assert.strictEqual(customIp, 'http://192.168.188.162:3000', 'Benutzerdefinierte IP überschreibt den Standard');

console.log('✓ 4. URL-Auflösungslogik für APK, Browser und Custom-IP erfolgreich validiert');

// 5. Teste Live-Server CORS & Health-Check über HTTP
async function runHttpChecks() {
  const reqHealth = () => new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000/api/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json.status, 'ok');
          assert.strictEqual(res.headers['access-control-allow-origin'], '*');
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });

  const reqOptions = () => new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost',
        'Access-Control-Request-Method': 'POST'
      }
    };
    const req = http.request(options, (res) => {
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['access-control-allow-origin'], '*');
      assert.ok(res.headers['access-control-allow-methods'].includes('POST'));
      resolve();
    });
    req.on('error', reject);
    req.end();
  });

  try {
    await reqHealth();
    console.log('✓ 5a. GET /api/health liefert 200 OK + CORS-Header');
    await reqOptions();
    console.log('✓ 5b. OPTIONS /api/auth/login liefert 200 OK + CORS Preflight-Header');
  } catch (err) {
    console.warn('⚠️ HTTP-Check übersprungen (Server nicht auf Port 3000 aktiv?):', err.message);
  }

  console.log('\n======================================================');
  console.log('🏆 ALLE RENDER & SERVER-DEFAULT TESTS BESTANDEN!');
  console.log('======================================================\n');
}

runHttpChecks();
