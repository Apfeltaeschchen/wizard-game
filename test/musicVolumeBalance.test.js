const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('--- TESTE MUSIK-LAUTSTÄRKE-BALANCE (GAIN-MATCHING & DYNAMICS COMPRESSOR) ---');

const clientJsPath = path.join(__dirname, '../public/client.js');
assert.ok(fs.existsSync(clientJsPath), 'public/client.js existiert');
const clientJsContent = fs.readFileSync(clientJsPath, 'utf8');

// 1. Quellcode-Validierung: gainFactor und DynamicsCompressor in client.js vorhanden
assert.ok(clientJsContent.includes('gainFactor: 1.0'), 'The Old Tower Inn hat gainFactor: 1.0');
assert.ok(clientJsContent.includes('gainFactor: 0.62'), "King's Feast hat gainFactor: 0.62");
assert.ok(clientJsContent.includes('gainFactor: 0.35'), 'Market Day hat gainFactor: 0.35');
assert.ok(clientJsContent.includes('createDynamicsCompressor'), 'createDynamicsCompressor in getContext() integriert');
console.log('✓ 1. Quellcode-Prüfung: gainFactor für alle 3 Tracks und createDynamicsCompressor erfolgreich verifiziert');

// 2. Mathematische Verifikation des Gain-Matchings (RMS Angleichung)
const measuredRms = {
  'tavern_music.mp3': 0.0969,  // -20.28 dB
  'Kings_Feast.mp3': 0.1551,   // -16.19 dB (+4.09 dB lauter)
  'Market_Day.mp3': 0.2787     // -11.10 dB (+9.18 dB lauter)
};

const gainFactors = {
  'tavern_music.mp3': 1.0,
  'Kings_Feast.mp3': 0.62,
  'Market_Day.mp3': 0.35
};

const balancedRmsDb = {};
for (const [file, rawRms] of Object.entries(measuredRms)) {
  const effectiveRms = rawRms * gainFactors[file];
  balancedRmsDb[file] = 20 * Math.log10(effectiveRms);
}

const dbValues = Object.values(balancedRmsDb);
const maxDb = Math.max(...dbValues);
const minDb = Math.min(...dbValues);
const dbSpread = maxDb - minDb;

console.log('Effektive RMS-Pegel nach Gain-Matching:');
for (const [file, db] of Object.entries(balancedRmsDb)) {
  console.log(`  - ${file}: ${db.toFixed(2)} dB`);
}
console.log(`  -> Maximale Pegelabweichung: ${dbSpread.toFixed(2)} dB`);
assert.ok(dbSpread < 0.25, `Pegelabweichung (${dbSpread.toFixed(2)} dB) liegt unter 0.25 dB Toleranzgrenze`);
console.log('✓ 2. Mathematisches Gain-Matching: Alle Tracks liegen innerhalb von < 0.25 dB');

// 3. Funktionale Verifikation in VM-Sandbox mit Mock Web Audio API
(function testAudioEngineVolumeBalance() {
  class MockParam {
    constructor(val = 0) {
      this.value = val;
    }
    setValueAtTime(val) {
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
      getItem: () => JSON.stringify({ master: 0.8, music: 0.5, sfx: 0.9, musicMuted: false, sfxMuted: false }),
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
  assert.strictEqual(playlist.length, 3, 'Playlist enthält 3 Tracks');
  assert.strictEqual(playlist[0].gainFactor, 1.0, 'Track 0 gainFactor ist 1.0');
  assert.strictEqual(playlist[1].gainFactor, 0.62, 'Track 1 gainFactor ist 0.62');
  assert.strictEqual(playlist[2].gainFactor, 0.35, 'Track 2 gainFactor ist 0.35');

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

  // Lautstärketest: Track 0 (gainFactor 1.0)
  assert.strictEqual(audioEngine.getCurrentTrackGainFactor(), 1.0, 'Track 0 hat gainFactor 1.0');

  // Springe zu Track 1 (King\'s Feast, gainFactor 0.62)
  audioEngine.skipNextTrack();
  assert.strictEqual(audioEngine.getCurrentTrackTitle(), "King's Feast", 'Track 1 ist King\'s Feast');
  assert.strictEqual(audioEngine.getCurrentTrackGainFactor(), 0.62, 'Track 1 hat gainFactor 0.62');

  // Springe zu Track 2 (Market Day, gainFactor 0.35)
  audioEngine.skipNextTrack();
  assert.strictEqual(audioEngine.getCurrentTrackTitle(), 'Market Day', 'Track 2 ist Market Day');
  assert.strictEqual(audioEngine.getCurrentTrackGainFactor(), 0.35, 'Track 2 hat gainFactor 0.35');

  // Springe zurück zu Track 0 (Loop)
  audioEngine.skipNextTrack();
  assert.strictEqual(audioEngine.getCurrentTrackTitle(), 'The Old Tower Inn', 'Loop zurück zu Track 0');
  assert.strictEqual(audioEngine.getCurrentTrackGainFactor(), 1.0, 'Track 0 hat gainFactor 1.0');

  console.log('✓ 3. Funktionale VM-Sandbox-Prüfung: AudioContext, DynamicsCompressor und Playlist-Gains erfolgreich verifiziert');
})();

console.log('\n================================================================');
console.log('🏆 ALLE MUSIK-LAUTSTÄRKE-BALANCE TESTS BESTANDEN!');
console.log('================================================================\n');
