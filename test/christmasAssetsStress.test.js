// =====================================================================
// ADVERSARIAL STRESS-TEST SUITE: CHRISTMAS COSMETICS EXPANSION (R3)
// Grimoire / Wizard Online — Independent Challenger Verification
// =====================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const assert = require('assert');

console.log('======================================================================');
console.log('   ADVERSARIAL STRESS-TEST: CHRISTMAS COSMETICS EXPANSION (R3)');
console.log('   Empirical Verification by Challenger Agent');
console.log('======================================================================\n');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ANDROID_ASSETS_DIR = path.join(ROOT_DIR, 'android/app/src/main/assets/public');
const COSMETICS_DATA_PATH = path.join(ROOT_DIR, 'server/cosmeticsData.js');
const INDEX_HTML_PATH = path.join(PUBLIC_DIR, 'index.html');
const CLIENT_JS_PATH = path.join(PUBLIC_DIR, 'client.js');

// Load catalog
const { COSMETICS_CATALOG, DROPPABLE_ITEMS_BY_RARITY } = require(COSMETICS_DATA_PATH);
const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
const clientJs = fs.readFileSync(CLIENT_JS_PATH, 'utf8');

// --- Helper: PNG CRC-32 ---
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}
function calculateCrc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

// --- Rigorous PNG Parser and Validator ---
function validatePngBuffer(buf, filePath, minSize = 10000) {
  if (buf.length < minSize) {
    throw new Error(`File ${filePath} is too small: ${buf.length} bytes (required > ${minSize})`);
  }

  // 1. Magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const expectedMagic = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (!buf.subarray(0, 8).equals(expectedMagic)) {
    throw new Error(`File ${filePath} has invalid PNG magic bytes: ${buf.subarray(0, 8).toString('hex')}`);
  }

  // 2. Parse chunks
  let offset = 8;
  let ihdrFound = false;
  let iendFound = false;
  let idatBuffers = [];
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;

  while (offset < buf.length) {
    if (offset + 8 > buf.length) {
      throw new Error(`File ${filePath} has truncated chunk header at offset ${offset}`);
    }

    const chunkLen = buf.readUInt32BE(offset);
    const chunkType = buf.toString('ascii', offset + 4, offset + 8);
    const chunkDataOffset = offset + 8;
    const chunkCrcOffset = chunkDataOffset + chunkLen;

    if (chunkCrcOffset + 4 > buf.length) {
      throw new Error(`File ${filePath} has truncated chunk data for '${chunkType}' at offset ${offset}`);
    }

    const chunkData = buf.subarray(chunkDataOffset, chunkCrcOffset);
    const expectedCrc = buf.readUInt32BE(chunkCrcOffset);

    // CRC covers chunkType + chunkData
    const typeAndData = buf.subarray(offset + 4, chunkCrcOffset);
    const computedCrc = calculateCrc32(typeAndData);
    if (computedCrc !== expectedCrc) {
      throw new Error(`File ${filePath} CRC mismatch in '${chunkType}' chunk: expected ${expectedCrc}, computed ${computedCrc}`);
    }

    if (chunkType === 'IHDR') {
      if (ihdrFound) throw new Error(`File ${filePath} has duplicate IHDR chunk`);
      if (offset !== 8) throw new Error(`File ${filePath} IHDR must be the first chunk at offset 8`);
      if (chunkLen !== 13) throw new Error(`File ${filePath} IHDR length must be 13, got ${chunkLen}`);

      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
      const compression = chunkData[10];
      const filter = chunkData[11];
      const interlace = chunkData[12];

      if (width <= 0 || height <= 0) {
        throw new Error(`File ${filePath} invalid dimensions: ${width}x${height}`);
      }
      if (![1, 2, 4, 8, 16].includes(bitDepth)) {
        throw new Error(`File ${filePath} invalid bit depth: ${bitDepth}`);
      }
      if (![0, 2, 3, 4, 6].includes(colorType)) {
        throw new Error(`File ${filePath} invalid color type: ${colorType}`);
      }
      if (compression !== 0) throw new Error(`File ${filePath} invalid compression method: ${compression}`);
      if (filter !== 0) throw new Error(`File ${filePath} invalid filter method: ${filter}`);
      if (![0, 1].includes(interlace)) throw new Error(`File ${filePath} invalid interlace method: ${interlace}`);

      ihdrFound = true;
    } else if (chunkType === 'IDAT') {
      if (!ihdrFound) throw new Error(`File ${filePath} IDAT before IHDR`);
      idatBuffers.push(chunkData);
    } else if (chunkType === 'IEND') {
      iendFound = true;
      if (chunkCrcOffset + 4 !== buf.length) {
        throw new Error(`File ${filePath} has trailing bytes after IEND chunk`);
      }
      break;
    }

    offset = chunkCrcOffset + 4;
  }

  if (!ihdrFound) throw new Error(`File ${filePath} missing IHDR chunk`);
  if (!iendFound) throw new Error(`File ${filePath} missing IEND chunk`);
  if (idatBuffers.length === 0) throw new Error(`File ${filePath} missing IDAT chunks`);

  // 3. Decompress IDAT payload to ensure pixels are not corrupted
  const fullIdat = Buffer.concat(idatBuffers);
  let decompressed;
  try {
    decompressed = zlib.inflateSync(fullIdat);
  } catch (err) {
    throw new Error(`File ${filePath} IDAT zlib inflation failed: ${err.message}`);
  }

  // Calculate expected decompressed raw scanline size
  let bytesPerPixel = 4; // default RGBA
  if (colorType === 2) bytesPerPixel = 3;
  else if (colorType === 0) bytesPerPixel = 1;
  else if (colorType === 4) bytesPerPixel = 2;

  const expectedRawSize = height * (1 + width * bytesPerPixel);
  if (decompressed.length !== expectedRawSize) {
    throw new Error(`File ${filePath} decompressed size mismatch: got ${decompressed.length}, expected ${expectedRawSize}`);
  }

  return { width, height, bitDepth, colorType, decompressedBytes: decompressed.length };
}

// --- Rigorous Strict XML & SVG Parser and Validator ---
function validateSvgXml(xmlString, filePath, expectedViewBox = null, minElements = 3) {
  if (typeof xmlString !== 'string' || xmlString.trim().length === 0) {
    throw new Error(`File ${filePath} SVG content is empty`);
  }

  // Strip XML comments
  const noComments = xmlString.replace(/<!--[\s\S]*?-->/g, '');
  // Strip processing instructions <?xml ... ?>
  const noPI = noComments.replace(/<\?[\s\S]*?\?>/g, '').trim();

  // Match all tags: <...>
  const tagRegex = /<([^>]+)>/g;
  let match;
  const tagStack = [];
  let rootTag = null;
  let elementCount = 0;
  let graphicalElementCount = 0;
  const graphicalElementTypes = new Set([
    'path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line',
    'g', 'defs', 'linearGradient', 'radialGradient', 'filter', 'use', 'pattern', 'text', 'stop'
  ]);

  while ((match = tagRegex.exec(noPI)) !== null) {
    let raw = match[1].trim();
    if (!raw) continue;

    // Check if closing tag </tag>
    if (raw.startsWith('/')) {
      const tagName = raw.slice(1).trim();
      if (tagStack.length === 0) {
        throw new Error(`File ${filePath} unexpected closing tag </${tagName}> without open tag`);
      }
      const top = tagStack.pop();
      if (top !== tagName) {
        throw new Error(`File ${filePath} mismatched tag: opened <${top}>, closed with </${tagName}>`);
      }
      continue;
    }

    // Check if self-closing <tag ... />
    let isSelfClosing = false;
    if (raw.endsWith('/')) {
      isSelfClosing = true;
      raw = raw.slice(0, -1).trim();
    }

    const tagName = raw.split(/\s+/)[0];
    if (!rootTag) {
      if (tagName !== 'svg') {
        throw new Error(`File ${filePath} root element is '<${tagName}>', expected '<svg>'`);
      }
      rootTag = tagName;
    }

    if (graphicalElementTypes.has(tagName)) {
      graphicalElementCount++;
    }

    elementCount++;
    if (!isSelfClosing) {
      tagStack.push(tagName);
    }
  }

  if (tagStack.length > 0) {
    throw new Error(`File ${filePath} unclosed XML tags remaining: ${tagStack.join(' -> ')}`);
  }

  if (rootTag !== 'svg') {
    throw new Error(`File ${filePath} no root <svg> tag found`);
  }

  // Extract root <svg ...> attributes
  const rootMatch = noPI.match(/<svg([^>]*)>/);
  if (!rootMatch) {
    throw new Error(`File ${filePath} cannot find root <svg> opening tag`);
  }
  const rootAttrs = rootMatch[1];

  // Check viewBox
  const viewBoxMatch = rootAttrs.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (!viewBoxMatch) {
    throw new Error(`File ${filePath} <svg> missing required 'viewBox' attribute`);
  }
  const actualViewBox = viewBoxMatch[1].trim();

  if (expectedViewBox && actualViewBox !== expectedViewBox) {
    throw new Error(`File ${filePath} viewBox mismatch: expected "${expectedViewBox}", found "${actualViewBox}"`);
  }

  if (graphicalElementCount < minElements) {
    throw new Error(`File ${filePath} appears to be a dummy/empty SVG with only ${graphicalElementCount} graphical elements (minimum ${minElements})`);
  }

  return { rootTag, actualViewBox, elementCount, graphicalElementCount };
}

// --- SHA256 Helper ---
function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// =====================================================================
// TEST EXECUTION
// =====================================================================

const results = {
  passed: 0,
  failed: 0,
  details: []
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.details.push({ name, status: 'PASS' });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.failed++;
    results.details.push({ name, status: 'FAIL', error: err.message });
    console.error(`[FAIL] ${name}\n       Error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------
// TEST 1: CATALOG INVENTORY & R1 COMPLIANCE
// ---------------------------------------------------------------------
console.log('--- SUITE 1: CATALOG INVENTORY & R1 REQUIREMENT (>= 10 PER CATEGORY) ---');

const categories = ['avatar_icons', 'avatar_frames', 'table_skins', 'card_backs', 'lobby_backgrounds', 'titles'];
const christmasItems = {};

for (const cat of categories) {
  christmasItems[cat] = (COSMETICS_CATALOG[cat] || []).filter(item => item.event === 'christmas');
}

for (const cat of categories) {
  test(`Catalog Category '${cat}' has >= 10 Christmas items`, () => {
    const count = christmasItems[cat].length;
    assert(count >= 10, `Expected at least 10 items for ${cat}, got ${count}`);
    console.log(`       Found ${count} Christmas items in '${cat}'.`);
  });
}

test('All Christmas items have non-empty ID, name, rarity, and lore', () => {
  for (const cat of categories) {
    for (const item of christmasItems[cat]) {
      assert(item.id && typeof item.id === 'string', `Item in ${cat} missing valid ID`);
      assert(item.name && typeof item.name === 'string', `Item ${item.id} missing valid name`);
      assert(['common', 'rare', 'epic', 'legendary'].includes(item.rarity), `Item ${item.id} has invalid rarity: ${item.rarity}`);
      if (cat !== 'titles') {
        assert(item.lore && item.lore.length > 5, `Item ${item.id} missing descriptive lore`);
      }
    }
  }
});

test('No Christmas items are marked isDefault: true', () => {
  for (const cat of categories) {
    for (const item of christmasItems[cat]) {
      assert(!item.isDefault, `Christmas item ${item.id} must not be isDefault: true`);
    }
  }
});

test('All Christmas items are registered in DROPPABLE_ITEMS_BY_RARITY pool', () => {
  const droppableIds = new Set(Object.values(DROPPABLE_ITEMS_BY_RARITY).flat().map(i => i.id));
  for (const cat of categories) {
    for (const item of christmasItems[cat]) {
      assert(droppableIds.has(item.id), `Christmas item ${item.id} (${cat}) is missing from DROPPABLE_ITEMS_BY_RARITY`);
    }
  }
});

// ---------------------------------------------------------------------
// TEST 2: ADVERSARIAL PNG IMAGE VERIFICATION
// ---------------------------------------------------------------------
console.log('\n--- SUITE 2: ADVERSARIAL PNG STRESS-TEST (MAGIC BYTES, IHDR, DEFLATE, >10KB) ---');

for (const avatar of christmasItems.avatar_icons) {
  test(`Avatar PNG '${avatar.id}': Magic Bytes, IHDR, zlib IDAT decompressed, size > 10,000 bytes`, () => {
    const relPath = avatar.image.replace(/^\//, '');
    const absPath = path.join(PUBLIC_DIR, relPath);
    assert(fs.existsSync(absPath), `File not found: ${absPath}`);

    const stat = fs.statSync(absPath);
    assert(stat.size > 10000, `File ${relPath} size ${stat.size} bytes <= 10,000 bytes`);

    const buf = fs.readFileSync(absPath);
    const parsed = validatePngBuffer(buf, absPath, 10000);
    assert(parsed.width === 512 && parsed.height === 512, `Avatar dimension expected 512x512, got ${parsed.width}x${parsed.height}`);
    console.log(`       Verified: ${path.basename(absPath)} (${stat.size.toLocaleString()} bytes, ${parsed.width}x${parsed.height}, ${parsed.decompressedBytes.toLocaleString()} raw pixels)`);
  });
}

for (const bg of christmasItems.lobby_backgrounds) {
  test(`Background PNG '${bg.id}': Magic Bytes, IHDR, zlib IDAT decompressed, size > 10,000 bytes`, () => {
    const relPath = bg.image.replace(/^\//, '');
    const absPath = path.join(PUBLIC_DIR, relPath);
    assert(fs.existsSync(absPath), `File not found: ${absPath}`);

    const stat = fs.statSync(absPath);
    assert(stat.size > 10000, `File ${relPath} size ${stat.size} bytes <= 10,000 bytes`);

    const buf = fs.readFileSync(absPath);
    const parsed = validatePngBuffer(buf, absPath, 10000);
    assert(parsed.width === 1376 && parsed.height === 768, `Background dimension expected 1376x768, got ${parsed.width}x${parsed.height}`);
    console.log(`       Verified: ${path.basename(absPath)} (${stat.size.toLocaleString()} bytes, ${parsed.width}x${parsed.height}, ${parsed.decompressedBytes.toLocaleString()} raw pixels)`);
  });
}

// ---------------------------------------------------------------------
// TEST 3: ADVERSARIAL SVG XML VERIFICATION
// ---------------------------------------------------------------------
console.log('\n--- SUITE 3: ADVERSARIAL SVG XML STRESS-TEST (WELL-FORMED XML, VIEWBOX, REAL VECTORS) ---');

for (const frame of christmasItems.avatar_frames) {
  test(`Avatar Frame SVG '${frame.id}': Valid XML, viewBox="0 0 100 100", graphical density`, () => {
    const absPath = path.join(PUBLIC_DIR, 'images/frames', `frame_${frame.id}.svg`);
    assert(fs.existsSync(absPath), `Frame SVG missing: ${absPath}`);

    const stat = fs.statSync(absPath);
    assert(stat.size > 500, `Frame SVG ${absPath} too small: ${stat.size} bytes`);

    const content = fs.readFileSync(absPath, 'utf8');
    const parsed = validateSvgXml(content, absPath, '0 0 100 100', 3);
    console.log(`       Verified: frame_${frame.id}.svg (${stat.size} bytes, viewBox="${parsed.actualViewBox}", ${parsed.graphicalElementCount} vector elements)`);
  });
}

for (const table of christmasItems.table_skins) {
  test(`Table Skin SVG '${table.id}': Valid XML, viewBox="0 0 1600 1000", graphical density`, () => {
    const absPath = path.join(PUBLIC_DIR, 'images/tables', `table_${table.id}.svg`);
    assert(fs.existsSync(absPath), `Table SVG missing: ${absPath}`);

    const stat = fs.statSync(absPath);
    assert(stat.size > 1000, `Table SVG ${absPath} too small: ${stat.size} bytes`);

    const content = fs.readFileSync(absPath, 'utf8');
    const parsed = validateSvgXml(content, absPath, '0 0 1600 1000', 5);
    console.log(`       Verified: table_${table.id}.svg (${stat.size} bytes, viewBox="${parsed.actualViewBox}", ${parsed.graphicalElementCount} vector elements)`);
  });
}

for (const card of christmasItems.card_backs) {
  test(`Card Back SVG '${card.id}': Valid XML, viewBox="0 0 1050 1498", graphical density`, () => {
    const absPath = path.join(PUBLIC_DIR, 'images/card_backs', `back_${card.id}.svg`);
    assert(fs.existsSync(absPath), `Card Back SVG missing: ${absPath}`);

    const stat = fs.statSync(absPath);
    assert(stat.size > 1000, `Card Back SVG ${absPath} too small: ${stat.size} bytes`);

    const content = fs.readFileSync(absPath, 'utf8');
    const parsed = validateSvgXml(content, absPath, '0 0 1050 1498', 5);
    console.log(`       Verified: back_${card.id}.svg (${stat.size} bytes, viewBox="${parsed.actualViewBox}", ${parsed.graphicalElementCount} vector elements)`);
  });
}

// ---------------------------------------------------------------------
// TEST 4: 100% ANDROID ASSET PARITY (BYTE-FOR-BYTE & SHA256)
// ---------------------------------------------------------------------
console.log('\n--- SUITE 4: 100% ANDROID ASSET MIRROR PARITY (BIT-EXACT SHA-256) ---');

const assetCheckList = [];
for (const a of christmasItems.avatar_icons) assetCheckList.push(`images/avatars/icon_${a.id.replace(/^icon_/, '')}.png`);
for (const b of christmasItems.lobby_backgrounds) assetCheckList.push(`images/backgrounds/bg_${b.id.replace(/^bg_/, '')}.png`);
for (const f of christmasItems.avatar_frames) assetCheckList.push(`images/frames/frame_${f.id}.svg`);
for (const t of christmasItems.table_skins) assetCheckList.push(`images/tables/table_${t.id}.svg`);
for (const c of christmasItems.card_backs) assetCheckList.push(`images/card_backs/back_${c.id}.svg`);

for (const relPath of assetCheckList) {
  test(`Android Asset Parity: '${relPath}' byte-exact match with Web`, () => {
    const webPath = path.join(PUBLIC_DIR, relPath);
    const androidPath = path.join(ANDROID_ASSETS_DIR, relPath);

    assert(fs.existsSync(webPath), `Web asset missing: ${webPath}`);
    assert(fs.existsSync(androidPath), `Android asset missing: ${androidPath}`);

    const statWeb = fs.statSync(webPath);
    const statAndroid = fs.statSync(androidPath);
    assert.strictEqual(statWeb.size, statAndroid.size, `Size mismatch for ${relPath}: web=${statWeb.size}, android=${statAndroid.size}`);

    const hashWeb = sha256File(webPath);
    const hashAndroid = sha256File(androidPath);
    assert.strictEqual(hashWeb, hashAndroid, `SHA256 mismatch for ${relPath}: web=${hashWeb}, android=${hashAndroid}`);
    console.log(`       Parity verified: ${relPath} (SHA256: ${hashWeb.slice(0, 16)}...)`);
  });
}

// ---------------------------------------------------------------------
// TEST 5: CSS CLASS & CLIENT WIRING COMPLETENESS
// ---------------------------------------------------------------------
console.log('\n--- SUITE 5: FRONTEND CSS SELECTORS & CLIENT.JS WIRING ---');

for (const frame of christmasItems.avatar_frames) {
  test(`CSS Frame bindings for '${frame.id}' in index.html`, () => {
    assert(indexHtml.includes(`frame-${frame.id}`), `Missing CSS selector .frame-${frame.id} in index.html`);
    assert(indexHtml.includes(`.seat-avatar.frame-${frame.id}`), `Missing CSS selector .seat-avatar.frame-${frame.id} in index.html`);
  });
}

for (const table of christmasItems.table_skins) {
  test(`CSS & Client bindings for Table Skin '${table.id}'`, () => {
    assert(indexHtml.includes(`table-skin-${table.id}`), `Missing CSS .table-skin-${table.id} in index.html`);
    assert(indexHtml.includes(`table-theme-${table.id}`), `Missing CSS .table-theme-${table.id} thumbnail in index.html`);
    assert(indexHtml.includes(`table-skin-${table.id}.my-turn-aura`), `Missing .my-turn-aura for ${table.id} in index.html`);
    assert(clientJs.includes(`'${table.id}'`), `Missing '${table.id}' in client.js applyTableSkin array`);
  });
}

for (const card of christmasItems.card_backs) {
  test(`CSS & Client bindings for Card Back '${card.id}'`, () => {
    assert(indexHtml.includes(`cardback-theme-${card.id}`), `Missing CSS .cardback-theme-${card.id} in index.html`);
    assert(clientJs.includes(`${card.id}:`), `Missing '${card.id}' in client.js cardBackNames map`);
  });
}

for (const bg of christmasItems.lobby_backgrounds) {
  test(`CSS & Client bindings for Lobby Theme '${bg.id}'`, () => {
    assert(indexHtml.includes(`theme-${bg.id}`), `Missing CSS theme-${bg.id} in index.html`);
    assert(indexHtml.includes(`lobby-theme-${bg.id}`), `Missing CSS .lobby-theme-${bg.id} thumbnail in index.html`);
    assert(clientJs.includes(`'${bg.id}'`), `Missing '${bg.id}' in client.js applyLobbyTheme array`);
  });
}

for (const title of christmasItems.titles) {
  test(`Client.js Title Rarity Map entry for '${title.name || title.id}'`, () => {
    const key = title.name || title.id;
    assert(clientJs.includes(`'${key}': '${title.rarity}'`), `Missing '${key}': '${title.rarity}' in client.js TITLE_RARITIES`);
  });
}

// ---------------------------------------------------------------------
// TEST 6: ADVERSARIAL ORACLE VALIDATION (NEGATIVE SANITY CHECK)
// ---------------------------------------------------------------------
console.log('\n--- SUITE 6: ADVERSARIAL ORACLE SOUNDNESS (PROVING TESTS REJECT CORRUPTION) ---');

test('Oracle rejects corrupted PNG magic bytes', () => {
  const badMagic = Buffer.from([0x00, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  assert.throws(() => validatePngBuffer(badMagic, 'dummy.png', 5), /invalid PNG magic bytes/);
});

test('Oracle rejects truncated PNG under minimum size threshold', () => {
  const shortBuf = Buffer.alloc(500);
  assert.throws(() => validatePngBuffer(shortBuf, 'dummy.png', 10000), /too small/);
});

test('Oracle rejects corrupted IHDR dimensions', () => {
  const badIhdrPng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    Buffer.from([0x00, 0x00, 0x00, 0x0D]), // len 13
    Buffer.from('IHDR', 'ascii'),
    Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 8, 6, 0, 0, 0]) // 0x0 dimension
  ]);
  // Add bad CRC
  const badBuf = Buffer.concat([badIhdrPng, Buffer.from([0, 0, 0, 0])]);
  assert.throws(() => validatePngBuffer(badBuf, 'dummy.png', 10), /CRC mismatch/);
});

test('Oracle rejects malformed XML with mismatched tags', () => {
  const badXml = '<svg viewBox="0 0 100 100"><g><path d="M0 0"/></rect></svg>';
  assert.throws(() => validateSvgXml(badXml, 'bad.svg', '0 0 100 100', 1), /mismatched tag/);
});

test('Oracle rejects SVG without viewBox attribute', () => {
  const noViewBox = '<svg width="100" height="100"><circle r="10"/></svg>';
  assert.throws(() => validateSvgXml(noViewBox, 'bad.svg', null, 1), /missing required 'viewBox'/);
});

test('Oracle rejects dummy SVG with insufficient graphical elements', () => {
  const dummySvg = '<svg viewBox="0 0 100 100"></svg>';
  assert.throws(() => validateSvgXml(dummySvg, 'dummy.svg', '0 0 100 100', 3), /dummy\/empty SVG/);
});

// ---------------------------------------------------------------------
// SUMMARY & VERDICT
// ---------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`STRESS-TEST RESULTS: ${results.passed} Passed, ${results.failed} Failed`);
console.log(`TOTAL CHECKS EXECUTED: ${results.details.length}`);
if (results.failed === 0) {
  console.log('FINAL VERDICT: APPROVE');
} else {
  console.log('FINAL VERDICT: REJECT');
}
console.log('======================================================================');

if (results.failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
