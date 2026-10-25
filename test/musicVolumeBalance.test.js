const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('--- TESTE CITADEL NIGHT SUITE & BRONZEGONG ---');

const clientJsPath = path.join(__dirname, '../public/client.js');
assert.ok(fs.existsSync(clientJsPath), 'public/client.js existiert');
const clientJsContent = fs.readFileSync(clientJsPath, 'utf8');

// 1. Quellcode-Validierung: Dedizierte Citadel Night Suite, Bronzegong und DynamicsCompressor
assert.ok(clientJsContent.includes('Nacht in der Zitadelle (Harfen-Meditation)'), 'Nacht in der Zitadelle Suite vorhanden');
assert.ok(clientJsContent.includes('/audio/citadel_night_suite.mp3'), 'citadel_night_suite.mp3 Pfad referenziert');
assert.ok(clientJsContent.includes('/audio/gong.ogg'), 'gong.ogg Pfad referenziert');
assert.ok(clientJsContent.includes('createDynamicsCompressor'), 'createDynamicsCompressor in getContext() integriert');
console.log('✓ 1. Quellcode-Prüfung: Citadel Night Suite, Bronzegong und createDynamicsCompressor erfolgreich verifiziert');

// 2. Physische Datei-Validierung der Audio-Assets
const s2Path = path.join(__dirname, '../public/audio/citadel_night_suite.mp3');
const gongPath = path.join(__dirname, '../public/audio/gong.ogg');

assert.ok(fs.existsSync(s2Path), 'citadel_night_suite.mp3 existiert auf der Festplatte');
assert.ok(fs.existsSync(gongPath), 'gong.ogg existiert auf der Festplatte');

const s2Stat = fs.statSync(s2Path);
const gongStat = fs.statSync(gongPath);

assert.ok(s2Stat.size > 20 * 1024 * 1024, `Citadel Night Suite ist langlaufend (${(s2Stat.size / 1024 / 1024).toFixed(2)} MB > 20 MB, ~14 Min)`);
assert.ok(gongStat.size > 40 * 1024, `Gong ist ein echtes Sample (${(gongStat.size / 1024).toFixed(2)} KB > 40 KB)`);
console.log('✓ 2. Physische Prüfung: citadel_night_suite.mp3 und gong.ogg erfolgreich verifiziert');

// 3. Funktionale Verifikation in VM-Sandbox mit Mock Web Audio API
(function testAudioEngineVolumeBalance() {
  class MockParam {
    constructor(val = 0) {
      this.value = val;
    }
    setValueAtTime(val) {
      this.value = val;
    }
    exponentialRampToValueAtTime(val) {
      this.value = val;
    }
  }

  class MockGainNode {
    constructor() {
      this.gain = new MockParam(1.0);
      this.connectedTo = null;
    }
    connect(dest) {
      this.connectedTo = dest;
    }
  }

  class MockOscillatorNode {
    constructor() {
      this.frequency = new MockParam(440);
      this.type = 'sine';
    }
    connect() {}
    start() {}
    stop() {}
  }

  class MockCompressorNode {
    constructor() {
      this.threshold = new MockParam(0);
      this.knee = new MockParam(0);
      this.ratio = new MockParam(1);
      this.attack = new MockParam(0);
      this.release = new MockParam(0);
      this.connectedTo = null;
    }
    connect(dest) {
      this.connectedTo = dest;
    }
  }

  class MockAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
      this.compressorCreated = false;
    }
    createGain() {
      return new MockGainNode();
    }
    createOscillator() {
      return new MockOscillatorNode();
    }
    createDynamicsCompressor() {
      this.compressorCreated = true;
      return new MockCompressorNode();
    }
    suspend() { return Promise.resolve(); }
    resume() { return Promise.resolve(); }
  }

  class MockAudio {
    constructor(src) {
      this.src = src;
      this.paused = true;
      this.volume = 1.0;
    }
    load() {}
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    addEventListener() {}
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
      getItem: () => JSON.stringify({ master: 0.8, music: 0.20, sfx: 0.85, musicMuted: false, sfxMuted: false }),
      setItem: () => {}
    },
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    }
  };

  const startIdx = clientJsContent.indexOf('const WizardAudio = (() => {');
  const endMarker = 'if (typeof window !== \'undefined\') window.WizardAudio = WizardAudio;';
  const endIdx = clientJsContent.indexOf(endMarker);
  assert.ok(startIdx !== -1 && endIdx !== -1, 'WizardAudio IIFE Block auffindbar');
  const audioCode = clientJsContent.substring(startIdx, endIdx) + 'window.WizardAudio = WizardAudio;';

  vm.createContext(sandbox);
  vm.runInContext(audioCode, sandbox);

  const audioEngine = sandbox.window.WizardAudio;
  assert.ok(audioEngine, 'audioEngine erfolgreich geladen');

  // Prüfe Playlist
  const playlist = audioEngine.getPlaylist();
  assert.strictEqual(playlist.length, 1, 'Playlist enthält die dedizierte Citadel Night Suite');
  assert.strictEqual(playlist[0].title, 'Nacht in der Zitadelle (Harfen-Meditation)', 'Track ist Nacht in der Zitadelle');
  assert.strictEqual(playlist[0].gainFactor, 1.0, 'Track gainFactor ist 1.0');

  // Initialisiere Context & prüfe DynamicsCompressor
  const ctx = audioEngine.getContext();
  assert.strictEqual(ctx.compressorCreated, true, 'DynamicsCompressorNode wurde vom AudioContext erzeugt');
  const comp = audioEngine.getCompressorNode();
  assert.ok(comp, 'Compressor-Node in audioEngine referenziert');
  assert.strictEqual(comp.threshold.value, -24, 'Threshold auf -24 dB gesetzt');
  assert.strictEqual(comp.knee.value, 20, 'Knee auf 20 dB gesetzt');
  assert.strictEqual(comp.ratio.value, 6, 'Ratio auf 6 gesetzt');
  assert.strictEqual(comp.attack.value, 0.005, 'Attack auf 0.005 s gesetzt');
  assert.strictEqual(comp.release.value, 0.150, 'Release auf 0.150 s gesetzt');

  // Lautstärketest: Track (gainFactor 1.0)
  assert.strictEqual(audioEngine.getCurrentTrackGainFactor(), 1.0, 'Track hat gainFactor 1.0');

  // Replay-Test: skipNextTrack startet die Suite sauber neu
  audioEngine.skipNextTrack();
  assert.strictEqual(audioEngine.getCurrentTrackTitle(), 'Nacht in der Zitadelle (Harfen-Meditation)', 'Track bleibt Nacht in der Zitadelle');
  assert.strictEqual(audioEngine.getCurrentTrackGainFactor(), 1.0, 'Track behält gainFactor 1.0');

  // Prüfe playTurnChime
  assert.strictEqual(typeof audioEngine.playTurnChime, 'function', 'playTurnChime ist als Funktion exportiert');
  audioEngine.playTurnChime();

  console.log('✓ 3. Funktionale VM-Sandbox-Prüfung: AudioContext, DynamicsCompressor, Bronzegong und Citadel Night Suite verifiziert');
})();

console.log('\n================================================================');
console.log('🏆 ALLE CITADEL NIGHT SUITE & BRONZEGONG TESTS BESTANDEN!');
console.log('================================================================\n');
