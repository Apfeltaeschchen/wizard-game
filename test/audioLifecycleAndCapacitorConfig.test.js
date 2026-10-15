const fs = require('fs');
const assert = require('assert');
const path = require('path');
const vm = require('vm');

console.log('--- TESTE ANDROID WEBVAPPER MIXED CONTENT & AUDIO LIFECYCLE ---');

// 1. capacitor.config.json Validierung
const capConfigPath = path.join(__dirname, '../capacitor.config.json');
assert.ok(fs.existsSync(capConfigPath), 'capacitor.config.json existiert');
const capConfig = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));

assert.strictEqual(capConfig.appId, 'de.grimoire.online', 'appId korrekt');
assert.ok(capConfig.server, 'server block in capacitor.config.json vorhanden');
assert.strictEqual(capConfig.server.androidScheme, 'http', 'androidScheme ist auf "http" gesetzt');
assert.strictEqual(capConfig.server.cleartext, true, 'cleartext ist auf true gesetzt');
console.log('✓ 1. capacitor.config.json: androidScheme="http" und cleartext=true erfolgreich verifiziert');

// 2. network_security_config.xml Validierung
const netSecPath = path.join(__dirname, '../android/app/src/main/res/xml/network_security_config.xml');
assert.ok(fs.existsSync(netSecPath), 'network_security_config.xml existiert');
const netSecContent = fs.readFileSync(netSecPath, 'utf8');

assert.ok(netSecContent.includes('<network-security-config>'), 'Wurzelelement <network-security-config> vorhanden');
assert.ok(netSecContent.includes('<base-config cleartextTrafficPermitted="true">'), 'cleartextTrafficPermitted="true" vorhanden');
assert.ok(netSecContent.includes('<trust-anchors>'), '<trust-anchors> vorhanden');
assert.ok(netSecContent.includes('<certificates src="system" />'), '<certificates src="system" /> vorhanden');
console.log('✓ 2. network_security_config.xml: Cleartext-Freigabe und Systemzertifikate erfolgreich verifiziert');

// 3. AndroidManifest.xml Validierung
const manifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');
assert.ok(fs.existsSync(manifestPath), 'AndroidManifest.xml existiert');
const manifestContent = fs.readFileSync(manifestPath, 'utf8');

assert.ok(manifestContent.includes('android:networkSecurityConfig="@xml/network_security_config"'), 'networkSecurityConfig im <application>-Tag registriert');
assert.ok(manifestContent.includes('android:usesCleartextTraffic="true"'), 'usesCleartextTraffic im <application>-Tag aktiv');
console.log('✓ 3. AndroidManifest.xml: networkSecurityConfig und usesCleartextTraffic im <application>-Tag verifiziert');

// 4. MainActivity.java Validierung
const mainActivityPath = path.join(__dirname, '../android/app/src/main/java/de/grimoire/online/MainActivity.java');
assert.ok(fs.existsSync(mainActivityPath), 'MainActivity.java existiert');
const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf8');

assert.ok(mainActivityContent.includes('import android.webkit.WebSettings;'), 'WebSettings importiert');
assert.ok(mainActivityContent.includes('import android.webkit.WebView;'), 'WebView importiert');
assert.ok(mainActivityContent.includes('public class MainActivity extends BridgeActivity'), 'MainActivity erweitert BridgeActivity');
assert.ok(mainActivityContent.includes('public void onResume()'), 'onResume implementiert');
assert.ok(mainActivityContent.includes('setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW)'), 'setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW) aktiv');
console.log('✓ 4. MainActivity.java: onResume & MIXED_CONTENT_ALWAYS_ALLOW WebView-Settings verifiziert');

// 5. client.js Quellcode-Validierung
const clientJsPath = path.join(__dirname, '../public/client.js');
assert.ok(fs.existsSync(clientJsPath), 'public/client.js existiert');
const clientJsContent = fs.readFileSync(clientJsPath, 'utf8');

assert.ok(clientJsContent.includes('handleAppBackground'), 'handleAppBackground in client.js vorhanden');
assert.ok(clientJsContent.includes('handleAppForeground'), 'handleAppForeground in client.js vorhanden');
assert.ok(clientJsContent.includes('wasPlayingBeforeHide'), 'wasPlayingBeforeHide in client.js deklariert');
assert.ok(clientJsContent.includes("document.addEventListener('visibilitychange'"), 'visibilitychange Listener vorhanden');
assert.ok(clientJsContent.includes("window.addEventListener('pagehide'"), 'pagehide Listener vorhanden');
assert.ok(clientJsContent.includes("window.addEventListener('blur'"), 'blur Listener vorhanden');
assert.ok(clientJsContent.includes("window.addEventListener('focus'"), 'focus Listener vorhanden');
console.log('✓ 5. public/client.js: Audio Lifecycle Methoden & globale Event-Listener verifiziert');

// 6. Funktionale Verifikation des Audio-Lifecycles im Sandbox-Kontext
(function testAudioLifecycleFunctional() {
  let playCallCount = 0;
  let pauseCallCount = 0;
  let suspendCallCount = 0;
  let resumeCallCount = 0;

  class MockAudio {
    constructor(src) {
      this.src = src;
      this.paused = true;
    }
    load() {}
    play() {
      this.paused = false;
      playCallCount++;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
      pauseCallCount++;
    }
    addEventListener() {}
  }

  class MockAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
    }
    createGain() {
      return {
        gain: { setValueAtTime: () => {} },
        connect: () => {}
      };
    }
    createMediaElementSource() {
      return { connect: () => {} };
    }
    suspend() {
      this.state = 'suspended';
      suspendCallCount++;
      return Promise.resolve();
    }
    resume() {
      this.state = 'running';
      resumeCallCount++;
      return Promise.resolve();
    }
  }

  const sandbox = {
    window: {
      addEventListener: () => {},
      AudioContext: MockAudioContext
    },
    document: {
      addEventListener: () => {},
      visibilityState: 'visible'
    },
    Audio: MockAudio,
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    }
  };

  // Extrahiere den WizardAudio Definitionsblock aus client.js
  const startIdx = clientJsContent.indexOf('const WizardAudio = (() => {');
  const endMarker = 'if (typeof window !== \'undefined\') window.WizardAudio = WizardAudio;';
  const endIdx = clientJsContent.indexOf(endMarker);
  assert.ok(startIdx !== -1 && endIdx !== -1, 'WizardAudio IIFE Block in client.js auffindbar');
  const audioCode = clientJsContent.substring(startIdx, endIdx) + 'window.WizardAudio = WizardAudio;';

  vm.createContext(sandbox);
  vm.runInContext(audioCode, sandbox);

  const audioEngine = sandbox.window.WizardAudio || sandbox.WizardAudio;
  assert.ok(audioEngine, 'audioEngine erfolgreich in Sandbox geladen');
  assert.strictEqual(typeof audioEngine.handleAppBackground, 'function', 'handleAppBackground ist eine Funktion');
  assert.strictEqual(typeof audioEngine.handleAppForeground, 'function', 'handleAppForeground ist eine Funktion');

  // Test-Fall A: Musik startet, dann App in den Hintergrund -> Musik pausiert, Context suspended
  audioEngine.startMusic();
  assert.strictEqual(playCallCount, 1, 'Musik gestartet');

  audioEngine.handleAppBackground();
  assert.strictEqual(pauseCallCount, 1, 'Musik bei Hintergrund pausiert');
  assert.strictEqual(suspendCallCount, 1, 'AudioContext bei Hintergrund suspendiert');
  assert.strictEqual(audioEngine.wasPlayingBeforeHide(), true, 'wasPlayingBeforeHide ist true');

  // Test-Fall B: Mehrfache Background-Events (z. B. blur gefolgt von pagehide)
  audioEngine.handleAppBackground();
  assert.strictEqual(audioEngine.wasPlayingBeforeHide(), true, 'wasPlayingBeforeHide bleibt true bei weiterem Background-Event');

  // Test-Fall C: App kehrt in den Vordergrund zurück -> Musik wird wieder aufgenommen
  audioEngine.handleAppForeground();
  assert.strictEqual(resumeCallCount, 1, 'AudioContext bei Vordergrund reaktiviert');
  assert.strictEqual(playCallCount, 2, 'Musik wurde fortgesetzt');
  assert.strictEqual(audioEngine.wasPlayingBeforeHide(), false, 'wasPlayingBeforeHide zurückgesetzt auf false');

  // Test-Fall D: Musik wird manuell gestoppt -> App in den Hintergrund -> wasPlayingBeforeHide bleibt false
  audioEngine.stopMusic();
  audioEngine.handleAppBackground();
  assert.strictEqual(audioEngine.wasPlayingBeforeHide(), false, 'wasPlayingBeforeHide ist false, da Musik vorher nicht aktiv war');

  // Test-Fall E: App kehrt zurück -> Musik bleibt stumm
  const playCallsBefore = playCallCount;
  audioEngine.handleAppForeground();
  assert.strictEqual(playCallCount, playCallsBefore, 'Musik startet nicht ungewollt');

  // Test-Fall F: SFX-Unterdrückung und kein ungewolltes ctx.resume() im Hintergrund
  audioEngine.handleAppBackground();
  assert.strictEqual(audioEngine.isAppInBackground(), true, 'isAppInBackground ist true');
  const suspendBefore = suspendCallCount;
  const resumeBefore = resumeCallCount;
  const ctx = audioEngine.getContext();
  assert.strictEqual(resumeCallCount, resumeBefore, 'getContext() weckt suspended Context im Hintergrund NICHT auf');

  // SFX-Methoden aufrufen im Hintergrund
  audioEngine.playCardSnap();
  audioEngine.playCardDeal();
  audioEngine.playTableThump();
  audioEngine.playInviteChime();
  assert.strictEqual(resumeCallCount, resumeBefore, 'Keine SFX wecken AudioContext im Hintergrund auf');

  // Test-Fall G: startMusic() im Hintergrund startet nicht sofort, merkt sich aber wasPlayingBeforeHide
  const playCallsBeforeBgStart = playCallCount;
  audioEngine.startMusic();
  assert.strictEqual(playCallCount, playCallsBeforeBgStart, 'startMusic() spielt im Hintergrund keine Musik ab');
  assert.strictEqual(audioEngine.wasPlayingBeforeHide(), true, 'wasPlayingBeforeHide ist true nach startMusic() im Hintergrund');

  // App kehrt zurück -> Musik startet
  audioEngine.handleAppForeground();
  assert.strictEqual(audioEngine.isAppInBackground(), false, 'isAppInBackground ist false nach Vordergrund');
  assert.strictEqual(playCallCount, playCallsBeforeBgStart + 1, 'startMusic() wird bei Vordergrund nachgeholt');

  console.log('✓ 6. Funktionale Verifikation des Audio-Lifecycles im Sandbox-Kontext erfolgreich');
})();

console.log('\n================================================================');
console.log('🏆 ALLE MIXED CONTENT & AUDIO LIFECYCLE TESTS BESTANDEN!');
console.log('================================================================\n');
