// =====================================================================
// AUTOMATED TEST SUITE: TABLE AURA, BOT AVATARS & FOREHEAD CARDS (R1–R4)
// =====================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- TESTSUITE: TABLE AURA, BOT AVATARS & FOREHEAD CARDS (R1–R4) START ---');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const clientJsPath = path.join(__dirname, '../public/client.js');
const botLogicPath = path.join(__dirname, '../server/botLogic.js');
const avatarsDir = path.join(__dirname, '../public/images/avatars');
const androidAvatarsDir = path.join(__dirname, '../android/app/src/main/assets/public/images/avatars');

const html = fs.readFileSync(indexHtmlPath, 'utf8');
const js = fs.readFileSync(clientJsPath, 'utf8');
const { BOT_PROFILES, createBotPlayer } = require(botLogicPath);

// ---------------------------------------------------------------------
// [1/4] R4: TISCHRAND-AURA (.my-turn-aura) EXKLUSIV AN DER KANTE
// ---------------------------------------------------------------------
console.log('[1/4] Prüfe R4: Tischrand-Aura & Keyframes ohne Inset-Überstrahlung...');

// 1.1 Keyframe medievalTurnPulse darf kein helles Inset-Glow enthalten
const pulseMatch = html.match(/@keyframes medievalTurnPulse\s*\{([\s\S]*?)\}/);
assert.ok(pulseMatch, '@keyframes medievalTurnPulse muss in index.html definiert sein');
const pulseBody = pulseMatch[1];
assert.ok(!pulseBody.includes('inset 0 0 45px rgba(240, 195, 85'), 'medievalTurnPulse darf kein 45px helles Inset-Glow ins Spielfeld werfen');
assert.ok(pulseBody.includes('0 0 0 2.5px') || pulseBody.includes('0 0 0 2px') || pulseBody.includes('0 0 0 1px'), 'medievalTurnPulse muss Kanten-Spread-Ring für Rand-Glow definieren');

// 1.2 Alle 6 Skins müssen ihre themenspezifische .my-turn-aura Klasse und Keyframes besitzen
const requiredSkins = ['emerald_felt', 'tavern_wood', 'amethyst_crypt', 'volcano_keep', 'astral_observatory', 'haunted_crypt'];
requiredSkins.forEach(skinId => {
  const auraClass = `.poker-table.table-skin-${skinId}.my-turn-aura`;
  assert.ok(html.includes(auraClass), `Themen-Aura ${auraClass} muss in index.html existieren`);
});
assert.ok(html.includes('@keyframes turnPulseEmerald'), 'turnPulseEmerald Keyframes fehlen');
assert.ok(html.includes('@keyframes turnPulseTavern'), 'turnPulseTavern Keyframes fehlen');
assert.ok(html.includes('@keyframes turnPulseAmethyst'), 'turnPulseAmethyst Keyframes fehlen');
assert.ok(html.includes('@keyframes turnPulseVolcano'), 'turnPulseVolcano Keyframes fehlen');
assert.ok(html.includes('@keyframes turnPulseAstral'), 'turnPulseAstral Keyframes fehlen');
assert.ok(html.includes('@keyframes turnPulseHaunted'), 'turnPulseHaunted Keyframes fehlen');

// 1.3 CSS Klammern müssen perfekt balanciert sein (Invariant für Style-Tags)
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
assert.ok(styleMatch, 'Style-Tag in index.html gefunden');
let depth = 0;
for (const c of styleMatch[1]) {
  if (c === '{') depth++;
  if (c === '}') depth--;
}
assert.strictEqual(depth, 0, `CSS-Klammern in index.html müssen perfekt balanciert sein (Tiefe: ${depth})`);

console.log('✓ R4: Tischrand-Aura erfolgreich verifiziert.');

// ---------------------------------------------------------------------
// [2/4] R2: DOPPELTE SPIELERNAMEN ÜBER SCHWEBENDEN STIRNKARTEN ENTFERNEN
// ---------------------------------------------------------------------
console.log('[2/4] Prüfe R2: Entfernen des Spielernamens über schwebenden Stirnkarten...');

// Stirnkarte in client.js darf keinen .forehead-player-name mehr über der Karte einbetten
assert.ok(!js.includes('<div class="forehead-player-name">'), 'foreheadCardHtml darf keinen separaten .forehead-player-name über der Stirnkarte rendern');

// Defensive CSS-Regel in index.html
assert.ok(html.includes('.forehead-player-name') && html.includes('display: none !important;'), 'index.html muss .forehead-player-name mit display: none !important unterdrücken');

// Gespielte Stichkarten (.trick-container) müssen den Spielernamen weiterhin rendern
assert.ok(js.includes('trick-card-player-name'), 'Stichkarten im Trick-Container müssen .trick-card-player-name beibehalten');
assert.ok(html.includes('.trick-card-player-name'), 'index.html muss .trick-card-player-name stylen');

console.log('✓ R2: Keine doppelten Spielernamen über Stirnkarten verifiziert.');

// ---------------------------------------------------------------------
// [3/4] R3: AVATAR-ARTWORKS FÜR KI-BOTS
// ---------------------------------------------------------------------
console.log('[3/4] Prüfe R3: Dedizierte Bot-Avatar Bilddateien und UI-Einbindung...');

const expectedBots = [
  // Novizen
  { name: 'Rincewind (KI)', key: 'rincewind' },
  { name: 'Gilderoy Lockhart (KI)', key: 'lockhart' },
  { name: 'Presto (KI)', key: 'presto' },
  { name: 'Gargamel (KI)', key: 'gargamel' },
  { name: 'Neville Longbottom (KI)', key: 'longbottom' },
  { name: 'Orko (KI)', key: 'orko' },
  // Meister
  { name: 'Severus Snape (KI)', key: 'snape' },
  { name: 'Doctor Strange (KI)', key: 'strange' },
  { name: 'Yennefer von Vengerberg (KI)', key: 'yennefer' },
  { name: 'Howl Pendragon (KI)', key: 'howl' },
  { name: 'Raistlin Majere (KI)', key: 'raistlin' },
  { name: 'Minerva McGonagall (KI)', key: 'mcgonagall' },
  // Erzmagier
  { name: 'Gandalf (KI)', key: 'gandalf' },
  { name: 'Albus Dumbledore (KI)', key: 'dumbledore' },
  { name: 'Merlin (KI)', key: 'merlin' },
  { name: 'Saruman (KI)', key: 'saruman' },
  { name: 'Lord Voldemort (KI)', key: 'voldemort' },
  { name: 'Elminster (KI)', key: 'elminster' }
];

assert.strictEqual(expectedBots.length, 18, 'Exakt 18 Bots erwartet');

expectedBots.forEach(bot => {
  const filename = `icon_bot_${bot.key}.png`;
  const fullPath = path.join(avatarsDir, filename);
  assert.ok(fs.existsSync(fullPath), `Avatar-Datei ${filename} muss in ${avatarsDir} existieren`);
  const stats = fs.statSync(fullPath);
  assert.ok(stats.size > 10000, `Avatar-Datei ${filename} muss valide Bilddaten (>10KB) enthalten, gefunden: ${stats.size}`);

  // Android-Spiegelung
  const androidPath = path.join(androidAvatarsDir, filename);
  assert.ok(fs.existsSync(androidPath), `Avatar-Datei ${filename} muss in Android Assets gespiegelt sein`);
});

// botLogic.js createBotPlayer muss icon_bot_* IDs vergeben
const sampleBotNovice = createBotPlayer([], 'novice');
assert.ok(sampleBotNovice.avatarId.startsWith('icon_bot_'), `Novizen-Bot muss icon_bot_* Avatar besitzen (erhalten: ${sampleBotNovice.avatarId})`);
const sampleBotMaster = createBotPlayer([], 'master');
assert.ok(sampleBotMaster.avatarId.startsWith('icon_bot_'), `Meister-Bot muss icon_bot_* Avatar besitzen (erhalten: ${sampleBotMaster.avatarId})`);
const sampleBotArchmage = createBotPlayer([], 'archmage');
assert.ok(sampleBotArchmage.avatarId.startsWith('icon_bot_'), `Erzmagier-Bot muss icon_bot_* Avatar besitzen (erhalten: ${sampleBotArchmage.avatarId})`);

// client.js muss icon_ Avatare via <img> laden und onerror mit span.seat-avatar-initial behandeln
assert.ok(js.includes('p.avatarId.startsWith(\'icon_\')'), 'client.js muss icon_* Avatare erkennen');
assert.ok(js.includes('seat-avatar-initial'), 'client.js muss fallback initial span verwenden');

console.log('✓ R3: Alle 18 Bot-Avatare existieren, sind gespiegelt und in botLogic/client.js verdrahtet.');

// ---------------------------------------------------------------------
// [4/4] R1: STIRNKARTEN-LAYOUT IN RUNDE 1 OHNE ÜBERLAPPUNG
// ---------------------------------------------------------------------
console.log('[4/4] Prüfe R1: Überlappungsfreies Stirnkarten-Layout (6 Spieler Konstellation)...');

// CSS-Regeln für Stirnkarten-Clearance & Zonen-Differenzierung
assert.ok(html.includes('.forehead-floating-card'), '.forehead-floating-card muss in CSS definiert sein');
assert.ok(html.includes('@keyframes foreheadCardFloat'), '@keyframes foreheadCardFloat muss definiert sein');
assert.ok(html.includes('transform: translateX(-50%) translateY(0)'), 'foreheadCardFloat muss translateX(-50%) beibehalten');

// Invertiertes Anchoring für 2. Sitz in vertikalen Zonen
assert.ok(html.includes('.perimeter-zone-right .player-seat:nth-child(2) .forehead-floating-card'), 'index.html muss 2. Sitz in zone-right nach unten anordnen');
assert.ok(html.includes('.perimeter-zone-left .player-seat:nth-child(2) .forehead-floating-card'), 'index.html muss 2. Sitz in zone-left nach unten anordnen');
assert.ok(html.includes('top: calc(100% + 8px)'), '2. Sitz Stirnkarte muss unterhalb positioniert sein');

// Gap Expansion in Runde 1
assert.ok(html.includes('#opponents-container.round-1-opponents .perimeter-zone-right'), 'Runde 1 side zone gap muss erweitert werden');
assert.ok(html.includes('top: clamp(88px, 13vh, 108px) !important;'), 'Runde 1 top zone clearance muss mindestens 88px betragen');

console.log('✓ R1: 6-Spieler Stirnkarten-Layout & Clearance fehlerfrei verifiziert.');

console.log('================================================================');
console.log('🏆 ALLE TESTS FÜR R1-R4 ERFOLGREICH BESTANDEN!');
console.log('================================================================');
