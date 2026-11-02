// =====================================================================
// GRIMOIRE ONLINE - CHRISTMAS COSMETICS ASSET GENERATOR (PROCEEDURAL)
// Etappe 6 Extension: 57 Festive Assets (PNG & SVG) with zero external deps
// =====================================================================

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- CRC32 for PNG chunks ---
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function buildPng(w, h, pixelShader) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const scanlineLen = 1 + w * 4;
  const raw = Buffer.alloc(h * scanlineLen);

  for (let y = 0; y < h; y++) {
    const rowStart = y * scanlineLen;
    raw[rowStart] = 0; // filter None
    for (let x = 0; x < w; x++) {
      const offset = rowStart + 1 + x * 4;
      const rgba = pixelShader(x, y, w, h);
      raw[offset] = rgba[0] & 0xFF;
      raw[offset + 1] = rgba[1] & 0xFF;
      raw[offset + 2] = rgba[2] & 0xFF;
      raw[offset + 3] = rgba[3] & 0xFF;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([
    sig,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

// Math helpers for procedural textures
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2); }
function lerp(a, b, t) { return a + (b - a) * t; }

// --- 1. AVATAR SHADERS (512x512) ---
const AVATAR_SPECS = [
  {
    id: 'icon_santa_archmage',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      const angle = Math.atan2(y - cy, x - cx);
      // Dark crimson background with golden starry rays
      let r = 139, g = 0, b = 0;
      const rays = Math.sin(angle * 12) * 20;
      r = clamp(r + rays - d * 0.25, 30, 220);
      g = clamp(15 + rays * 0.4 - d * 0.1, 0, 100);
      b = clamp(20 + rays * 0.2 - d * 0.1, 0, 80);
      // White beard & fur collar in lower half
      if (d < 180 && y > cy - 30) {
        const beard = Math.sin(x * 0.1) * 15 + Math.cos(y * 0.12) * 15;
        r = clamp(230 + beard, 200, 255);
        g = clamp(235 + beard, 205, 255);
        b = clamp(245 + beard, 215, 255);
      }
      // Ruby center gem
      if (d < 35) {
        r = 239; g = 68; b = 68;
      }
      // Gold ornate rim
      if (d >= 235 && d <= 250) {
        r = 251; g = 191; b = 36;
      }
      return [r, g, b, 255];
    }
  },
  {
    id: 'icon_rudolph_stag',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      // Midnight sapphire sky
      let r = clamp(15 + (x % 37 === 0 ? 180 : 0) - d * 0.05, 10, 240);
      let g = clamp(23 + (y % 41 === 0 ? 180 : 0) - d * 0.05, 15, 240);
      let b = clamp(42 + 40 * Math.cos(d * 0.03), 30, 180);
      // Silver antlers and stag silhouette
      if (d < 160 && (Math.abs(x - cx) < 30 + (cy - y) * 0.4)) {
        r = 203; g = 213; b = 225;
      }
      // Glowing red nose medallion
      const noseDist = dist(x, y, cx, cy + 30);
      if (noseDist < 28) {
        r = 239; g = 35; b = 35;
      } else if (noseDist < 55) {
        r = clamp(r + (55 - noseDist) * 3, 0, 255);
      }
      if (d >= 235 && d <= 250) { r = 203; g = 213; b = 225; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'icon_gingerbread_golem',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      // Baked spicy gingerbread dough with cookie texture
      const grain = ((x * 13 + y * 17) % 29) - 14;
      let r = clamp(160 + grain - d * 0.15, 80, 210);
      let g = clamp(90 + grain * 0.6 - d * 0.1, 40, 140);
      let b = clamp(44 + grain * 0.3 - d * 0.08, 15, 80);
      // White icing concentric circles and dots
      const wave = Math.abs(Math.sin(d * 0.08)) * 10;
      if (d > 100 && d < 120 && wave > 7) { r = 250; g = 250; b = 250; }
      // Sugar gumdrop eyes
      if ((dist(x, y, cx - 45, cy - 30) < 18) || (dist(x, y, cx + 45, cy - 30) < 18)) {
        r = 34; g = 197; b = 94; // emerald gumdrops
      }
      if (d >= 235 && d <= 250) { r = 245; g = 158; b = 11; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'icon_frost_snowman',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      // Arctic cyan/ice backdrop
      let r = clamp(30 + Math.sin(d * 0.04) * 20, 10, 100);
      let g = clamp(80 + Math.cos(d * 0.04) * 30, 40, 160);
      let b = clamp(140 + Math.sin(x * 0.02) * 40, 80, 220);
      // White snow orb
      if (d < 170) {
        const ice = ((x ^ y) % 17) * 2;
        r = clamp(220 + ice, 190, 255);
        g = clamp(235 + ice, 210, 255);
        b = clamp(250 + ice, 230, 255);
      }
      // Coal eyes & smile
      if (dist(x, y, cx - 40, cy - 40) < 12 || dist(x, y, cx + 40, cy - 40) < 12) {
        r = 20; g = 20; b = 30;
      }
      // Carrot nose
      if (x >= cx - 10 && x <= cx + 45 && Math.abs(y - cy) < (45 - (x - (cx - 10))) * 0.3) {
        r = 249; g = 115; b = 22;
      }
      if (d >= 235 && d <= 250) { r = 56; g = 189; b = 248; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'icon_nutcracker_general',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      const grain = ((x * 23 + y * 29) % 31) - 15;
      // Regal Prussian royal blue & scarlet
      let r = 20, g = 30, b = 70;
      if (y > cy) {
        // Red coat with wool weave texture
        r = 220; g = 38; b = 38;
        if (Math.abs(x - cx) < 25) { r = 255; g = 255; b = 255; } // white center
      } else {
        // Black Shako hat with fur grain
        r = 30; g = 30; b = 40;
        if (dist(x, y, cx, cy - 100) < 25) { r = 251; g = 191; b = 36; } // Gold hat crest
      }
      // Golden epaulettes
      if (y > cy - 20 && y < cy + 40 && Math.abs(x - cx) > 100 && Math.abs(x - cx) < 160) {
        r = 245; g = 158; b = 11;
      }
      r = clamp(r + grain, 0, 255);
      g = clamp(g + grain, 0, 255);
      b = clamp(b + grain, 0, 255);
      if (d >= 235 && d <= 250) { r = 251; g = 191; b = 36; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'icon_yule_elf',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      // Pine green and warm brass
      let r = clamp(21 + Math.sin(x * 0.03) * 15, 5, 80);
      let g = clamp(128 + Math.cos(y * 0.03) * 25, 70, 180);
      let b = clamp(61 + Math.sin(d * 0.02) * 15, 20, 110);
      // Pointed red elf hat
      if (y < cy + 20 && Math.abs(x - cx) < (cy + 20 - y) * 0.7) {
        r = 220; g = 38; b = 38;
      }
      // Jingle bell on top
      if (dist(x, y, cx, cy - 160) < 22) {
        r = 251; g = 191; b = 36;
      }
      if (d >= 235 && d <= 250) { r = 74; g = 222; b = 128; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'icon_krampus_demon',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      // Dark shadowed abyssal purple/black with iron chains
      let r = clamp(30 + Math.sin(x * 0.05) * 15, 10, 70);
      let g = clamp(20 + Math.cos(y * 0.05) * 10, 5, 50);
      let b = clamp(50 + Math.sin(d * 0.03) * 20, 20, 100);
      // Long ram horns
      const leftHorn = dist(x, y, cx - 110, cy - 110);
      const rightHorn = dist(x, y, cx + 110, cy - 110);
      if (leftHorn < 40 || rightHorn < 40) {
        r = 80; g = 70; b = 60;
      }
      // Glowing evil ember eyes
      if (dist(x, y, cx - 40, cy - 10) < 14 || dist(x, y, cx + 40, cy - 10) < 14) {
        r = 239; g = 68; b = 68;
      }
      if (d >= 235 && d <= 250) { r = 168; g = 85; b = 247; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'icon_winter_queen',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      // Glacial blizzard sapphire with sparkling diamond frost
      const sparkle = ((x * 31 + y * 47) % 73 === 0) ? 220 : 0;
      let r = clamp(56 + sparkle + Math.sin(d * 0.05) * 30, 20, 255);
      let g = clamp(189 + sparkle + Math.cos(d * 0.05) * 40, 100, 255);
      let b = clamp(248 + sparkle, 180, 255);
      // Crystal ice crown peaks
      if (y < cy - 20 && y > cy - 150) {
        const peak = Math.abs(Math.sin((x - cx) * 0.05)) * 120;
        if (cy - y < peak) {
          r = 224; g = 242; b = 254;
        }
      }
      if (d >= 235 && d <= 250) { r = 147; g = 197; b = 253; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'icon_frost_golem',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      // Heavy deep ocean blue ice with glowing cyan fissures
      const fissure = Math.abs(Math.sin((x * 0.06 + y * 0.04))) < 0.15 ? 180 : 0;
      let r = clamp(2 + fissure * 0.2, 0, 180);
      let g = clamp(132 + fissure * 0.6, 60, 240);
      let b = clamp(199 + fissure, 120, 255);
      // Rough geometric crystal blocks
      if (d < 180) {
        const block = ((Math.floor(x / 40) + Math.floor(y / 40)) % 2) * 25;
        r += block; g += block; b += block;
      }
      if (d >= 235 && d <= 250) { r = 34; g = 211; b = 238; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'icon_candle_fairy',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      // Warm golden glow radiating from center flame
      let r = clamp(254 - d * 0.45, 60, 255);
      let g = clamp(240 - d * 0.55, 30, 255);
      let b = clamp(138 - d * 0.4, 10, 220);
      // Translucent fairy wings
      const wingDist = dist(Math.abs(x - cx), y, 100, cy);
      if (wingDist < 75) {
        r = clamp(r + 40, 0, 255);
        g = clamp(g + 40, 0, 255);
        b = clamp(b + 90, 0, 255);
      }
      // Central flickering flame
      const flameDist = dist(x, y, cx, cy - 20);
      if (flameDist < 35) {
        r = 255; g = 255; b = 255;
      }
      if (d >= 235 && d <= 250) { r = 245; g = 158; b = 11; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'icon_peppermint_sorcerer',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      const angle = Math.atan2(y - cy, x - cx);
      // Peppermint spiral swirl
      const spiral = Math.sin(angle * 8 + d * 0.05);
      let r = 239, g = 68, b = 68;
      if (spiral > 0) {
        r = 255; g = 255; b = 255;
      }
      // Dark vignette at edge
      r = clamp(r - d * 0.25, 40, 255);
      g = clamp(g - d * 0.25, 20, 255);
      b = clamp(b - d * 0.25, 20, 255);
      if (d >= 235 && d <= 250) { r = 239; g = 68; b = 68; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'icon_yule_goat',
    shader: (x, y, w, h) => {
      const cx = w / 2, cy = h / 2;
      const d = dist(x, y, cx, cy);
      // Woven golden-straw texture with red ribbon bindings
      const straw = ((x * 19 + y * 7) % 31) - 15;
      let r = clamp(217 + straw - d * 0.15, 120, 255);
      let g = clamp(119 + straw * 0.7 - d * 0.12, 60, 200);
      let b = clamp(6 + straw * 0.2 - d * 0.05, 0, 100);
      // Red binding ribbons crossing diagonally
      if (Math.abs((x - y) % 60) < 14 || Math.abs((x + y) % 60) < 14) {
        r = 220; g = 38; b = 38;
      }
      if (d >= 235 && d <= 250) { r = 220; g = 38; b = 38; }
      return [r, g, b, 255];
    }
  }
];

// --- 2. BACKGROUND SHADERS (1376x768) ---
const BACKGROUND_SPECS = [
  {
    id: 'bg_snowy_castle',
    shader: (x, y, w, h) => {
      // Midnight sky fading to dark silhouette battlements with falling snow
      const sky = y / h;
      let r = clamp(15 + sky * 25, 5, 80);
      let g = clamp(23 + sky * 35, 10, 100);
      let b = clamp(42 + sky * 60, 25, 140);
      // Distant castle ramparts silhouette in lower third
      if (y > h * 0.65) {
        const battlement = ((Math.floor(x / 50)) % 2 === 0 && y < h * 0.72) ? 0 : 1;
        if (battlement) { r = 12; g = 16; b = 25; }
      }
      // Falling snowflakes
      if ((x * 79 + y * 113) % 233 === 0) { r = 240; g = 245; b = 255; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'bg_cozy_hearth',
    shader: (x, y, w, h) => {
      // Warm stone hearth with blazing fire glow in center bottom
      const fireDist = dist(x, y, w / 2, h);
      let r = clamp(255 - fireDist * 0.28, 25, 255);
      let g = clamp(140 - fireDist * 0.32, 12, 200);
      let b = clamp(30 - fireDist * 0.15, 8, 80);
      // Stone masonry texture
      const stone = ((Math.floor(x / 80) + Math.floor(y / 40)) % 2) * 15;
      r = clamp(r + stone, 0, 255);
      g = clamp(g + stone * 0.6, 0, 255);
      return [r, g, b, 255];
    }
  },
  {
    id: 'bg_winter_pine_forest',
    shader: (x, y, w, h) => {
      // Dark starry polar sky fading to evergreen silhouettes
      let r = 10, g = 25, b = 45;
      if (y > h * 0.45) {
        // Pine tree serrations
        const treeWave = Math.abs(Math.sin(x * 0.04)) * 120 + h * 0.45;
        if (y > treeWave) {
          r = 8; g = 35; b = 20; // deep pine green
        }
      }
      if (y > h * 0.85) { r = 200; g = 220; b = 240; } // snow ground
      if ((x * 37 + y * 53) % 199 === 0) { r = 250; g = 250; b = 255; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'bg_aurora_borealis',
    shader: (x, y, w, h) => {
      // Emerald & violet curtains over frozen mountains
      const wave1 = Math.sin(x * 0.008 + y * 0.015) * 50 + h * 0.35;
      const wave2 = Math.cos(x * 0.006 - y * 0.01) * 60 + h * 0.45;
      let r = 10, g = 15, b = 35;
      if (Math.abs(y - wave1) < 90) {
        g = clamp(g + (90 - Math.abs(y - wave1)) * 2, 0, 230); // Emerald aurora
      }
      if (Math.abs(y - wave2) < 80) {
        r = clamp(r + (80 - Math.abs(y - wave2)) * 1.8, 0, 190);
        b = clamp(b + (80 - Math.abs(y - wave2)) * 2.2, 0, 240); // Violet aurora
      }
      if (y > h * 0.78) { r = 15; g = 25; b = 45; } // Dark mountain base
      return [r, g, b, 255];
    }
  },
  {
    id: 'bg_santas_workshop',
    shader: (x, y, w, h) => {
      // Warm timber rafters with glowing lanterns
      const beam = (Math.floor(x / 140) % 2 === 0) ? 25 : 0;
      let r = clamp(90 + beam - (y / h) * 30, 40, 160);
      let g = clamp(50 + beam * 0.6 - (y / h) * 20, 20, 110);
      let b = clamp(25 + beam * 0.3, 10, 60);
      // Warm lantern pools
      if (dist(x, y, w * 0.25, h * 0.4) < 120 || dist(x, y, w * 0.75, h * 0.4) < 120) {
        r = clamp(r + 90, 0, 255);
        g = clamp(g + 70, 0, 230);
      }
      return [r, g, b, 255];
    }
  },
  {
    id: 'bg_starlit_bethlehem',
    shader: (x, y, w, h) => {
      // Midnight velvet sky with radiant 8-pointed star in center-top
      const starDist = dist(x, y, w / 2, h * 0.25);
      const angle = Math.atan2(y - h * 0.25, x - w / 2);
      const beam = Math.abs(Math.sin(angle * 4)) * (400 - Math.min(400, starDist)) * 0.5;
      let r = clamp(15 + beam * 0.9, 10, 255);
      let g = clamp(25 + beam * 0.8, 15, 240);
      let b = clamp(60 + beam * 0.4, 30, 255);
      if (starDist < 30) { r = 255; g = 255; b = 255; }
      if (y > h * 0.8) { r = 40; g = 30; b = 25; } // Desert dune horizon
      return [r, g, b, 255];
    }
  },
  {
    id: 'bg_icy_cavern',
    shader: (x, y, w, h) => {
      // Deep glacial cyan ice cavern with stalactites hanging from top
      const ceiling = Math.abs(Math.sin(x * 0.03)) * 80 + 40;
      let r = 8, g = 60, b = 110;
      if (y < ceiling) {
        r = 150; g = 210; b = 245; // Ice stalactite tips
      }
      const glow = Math.sin((x + y) * 0.02) * 30;
      g = clamp(g + glow, 30, 210);
      b = clamp(b + glow * 1.4, 70, 255);
      return [r, g, b, 255];
    }
  },
  {
    id: 'bg_christmas_market',
    shader: (x, y, w, h) => {
      // Night festive square with warm golden stalls and lantern strings
      const cobble = ((Math.floor(x / 20) + Math.floor(y / 15)) % 2) * 12;
      let r = 20 + cobble, g = 20 + cobble, b = 35 + cobble;
      // Lantern string hanging in catenary curve
      const catenary = Math.pow((x - w / 2) / (w / 2), 2) * 120 + h * 0.25;
      if (Math.abs(y - catenary) < 12) {
        r = 251; g = 191; b = 36; // Golden garland lights
      }
      if (y > h * 0.6) {
        // Market stalls wood and snow ground
        r = 80 + cobble; g = 50 + cobble; b = 30 + cobble;
      }
      if ((x * 61 + y * 89) % 211 === 0) { r = 255; g = 255; b = 255; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'bg_toy_factory',
    shader: (x, y, w, h) => {
      // Arcane clockwork brass gears and warm toy workshop atmosphere
      const gear = Math.abs(Math.sin(dist(x, y, w / 2, h / 2) * 0.08)) * 40;
      let r = clamp(120 + gear, 60, 220);
      let g = clamp(80 + gear * 0.7, 30, 180);
      let b = clamp(40 + gear * 0.2, 10, 100);
      return [r, g, b, 255];
    }
  },
  {
    id: 'bg_glacier_peak',
    shader: (x, y, w, h) => {
      // Monumental snow-capped peak under crystal starry dome
      const peak = h * 0.8 - Math.abs(x - w / 2) * 0.7;
      let r = 12, g = 20, b = 48;
      if (y > peak) {
        r = 210; g = 230; b = 250; // Snow peak
      }
      if ((x * 43 + y * 67) % 173 === 0) { r = 255; g = 255; b = 255; }
      return [r, g, b, 255];
    }
  },
  {
    id: 'bg_yule_banquet_hall',
    shader: (x, y, w, h) => {
      // Grand vaulted Gothic banquet hall with crimson tapestries
      const stone = ((Math.floor(x / 40) + Math.floor(y / 25)) % 2) * 15;
      const vault = Math.abs(Math.sin(x * 0.015)) * 140;
      let r = 80 + stone, g = 15 + stone * 0.5, b = 20 + stone * 0.5; // Crimson tapestry
      if (y < vault) { r = 35 + stone; g = 30 + stone; b = 40 + stone; } // Stone vault arches
      if (y > h * 0.7) { r = 120 + stone; g = 80 + stone * 0.7; b = 40 + stone * 0.4; } // Wooden tables
      if ((x % 120 < 10) && y > vault && y < h * 0.7) { r = 245; g = 158; b = 11; } // Gold embroidery lines
      return [r, g, b, 255];
    }
  },
  {
    id: 'bg_gingerbread_village',
    shader: (x, y, w, h) => {
      // Whimsical snowy gingerbread houses with sugar roofs
      let r = 30, g = 40, b = 70;
      if (y > h * 0.55) {
        const roof = ((Math.floor(x / 110) % 2 === 0)) ? 40 : 0;
        r = 160 + roof; g = 95 + roof * 0.6; b = 45; // Gingerbread walls
        if (y < h * 0.62) { r = 250; g = 250; b = 250; } // Icing roof
      }
      return [r, g, b, 255];
    }
  }
];

// --- 3. FRAME SVGS (100x100) ---
function generateFrameSvg(id) {
  switch (id) {
    case 'frame_holly_wreath':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="hollyGrad" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="#14532d" stop-opacity="0"/>
      <stop offset="90%" stop-color="#15803d"/>
      <stop offset="100%" stop-color="#166534"/>
    </radialGradient>
    <filter id="berryGlow"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#ef4444"/></filter>
  </defs>
  <circle cx="50" cy="50" r="46" fill="none" stroke="url(#hollyGrad)" stroke-width="7"/>
  <!-- Holly leaf clusters -->
  <path d="M 50,4 C 47,8 44,14 50,18 C 56,14 53,8 50,4 Z" fill="#22c55e"/>
  <path d="M 96,50 C 92,47 86,44 82,50 C 86,56 92,53 96,50 Z" fill="#22c55e"/>
  <path d="M 50,96 C 47,92 44,86 50,82 C 56,86 53,92 50,96 Z" fill="#22c55e"/>
  <path d="M 4,50 C 8,47 14,44 18,50 C 14,56 8,53 4,50 Z" fill="#22c55e"/>
  <!-- Red berries -->
  <circle cx="48" cy="8" r="3" fill="#dc2626" filter="url(#berryGlow)"/>
  <circle cx="53" cy="10" r="2.5" fill="#ef4444"/>
  <circle cx="92" cy="48" r="3" fill="#dc2626"/>
  <circle cx="90" cy="53" r="2.5" fill="#ef4444"/>
  <circle cx="48" cy="92" r="3" fill="#dc2626"/>
  <circle cx="8" cy="48" r="3" fill="#dc2626"/>
</svg>`;

    case 'frame_icicles':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="iceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e0f2fe" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.3"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="46" fill="none" stroke="#7dd3fc" stroke-width="2.5" opacity="0.8"/>
  <!-- Hanging icicles from top rim -->
  <polygon points="20,10 24,10 22,28" fill="url(#iceGrad)"/>
  <polygon points="35,6 40,6 37.5,34" fill="url(#iceGrad)"/>
  <polygon points="48,4 53,4 50.5,38" fill="url(#iceGrad)"/>
  <polygon points="62,6 67,6 64.5,32" fill="url(#iceGrad)"/>
  <polygon points="78,10 82,10 80,26" fill="url(#iceGrad)"/>
  <!-- Lower frost rim -->
  <circle cx="50" cy="50" r="44" fill="none" stroke="#bae6fd" stroke-width="1.5" stroke-dasharray="3,4"/>
</svg>`;

    case 'frame_golden_tinsel':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="goldTinsel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="46" fill="none" stroke="url(#goldTinsel)" stroke-width="5" stroke-dasharray="6,3"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="#fbbf24" stroke-width="1.5"/>
  <!-- Sparkle stars -->
  <polygon points="50,2 52,6 56,6 53,9 54,13 50,11 46,13 47,9 44,6 48,6" fill="#fde047"/>
  <polygon points="98,50 94,52 94,56 91,53 87,54 89,50 87,46 91,47 94,44 94,48" fill="#fde047"/>
  <polygon points="50,98 48,94 44,94 47,91 46,87 50,89 54,87 53,91 56,94 52,94" fill="#fde047"/>
  <polygon points="2,50 6,48 6,44 9,47 13,46 11,50 13,54 9,53 6,56 6,52" fill="#fde047"/>
</svg>`;

    case 'frame_candy_cane':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <pattern id="candyStripe" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="10" stroke="#dc2626" stroke-width="5"/>
      <line x1="5" y1="0" x2="5" y2="10" stroke="#ffffff" stroke-width="5"/>
    </pattern>
  </defs>
  <circle cx="50" cy="50" r="46" fill="none" stroke="url(#candyStripe)" stroke-width="6"/>
  <circle cx="50" cy="50" r="49" fill="none" stroke="#ef4444" stroke-width="1"/>
  <circle cx="50" cy="50" r="43" fill="none" stroke="#dc2626" stroke-width="1"/>
</svg>`;

    case 'frame_gingerbread_border':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="46" fill="none" stroke="#92400e" stroke-width="6"/>
  <circle cx="50" cy="50" r="46" fill="none" stroke="#fef3c7" stroke-width="2" stroke-dasharray="4,4"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="#b45309" stroke-width="1"/>
  <!-- Icing dots -->
  <circle cx="50" cy="5" r="2.5" fill="#ffffff"/>
  <circle cx="95" cy="50" r="2.5" fill="#ffffff"/>
  <circle cx="50" cy="95" r="2.5" fill="#ffffff"/>
  <circle cx="5" cy="50" r="2.5" fill="#ffffff"/>
</svg>`;

    case 'frame_frostfire':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="frostFlame" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="60%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#e0f2fe"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#frostFlame)" stroke-width="4"/>
  <!-- Flame licks -->
  <path d="M 50,4 C 45,12 40,16 50,22 C 55,16 60,12 50,4 Z" fill="url(#frostFlame)"/>
  <path d="M 96,50 C 88,45 84,40 78,50 C 84,55 88,60 96,50 Z" fill="url(#frostFlame)"/>
  <path d="M 50,96 C 55,88 60,84 50,78 C 45,84 40,88 50,96 Z" fill="url(#frostFlame)"/>
  <path d="M 4,50 C 12,55 16,60 22,50 C 16,45 12,40 4,50 Z" fill="url(#frostFlame)"/>
</svg>`;

    case 'frame_christmas_lights':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="46" fill="none" stroke="#166534" stroke-width="2.5"/>
  <!-- Colored festive bulbs -->
  <circle cx="50" cy="4" r="3.5" fill="#ef4444"/>
  <circle cx="73" cy="12" r="3.5" fill="#eab308"/>
  <circle cx="92" cy="30" r="3.5" fill="#3b82f6"/>
  <circle cx="96" cy="50" r="3.5" fill="#22c55e"/>
  <circle cx="92" cy="70" r="3.5" fill="#ef4444"/>
  <circle cx="73" cy="88" r="3.5" fill="#eab308"/>
  <circle cx="50" cy="96" r="3.5" fill="#3b82f6"/>
  <circle cx="27" cy="88" r="3.5" fill="#22c55e"/>
  <circle cx="8" cy="70" r="3.5" fill="#ef4444"/>
  <circle cx="4" cy="50" r="3.5" fill="#eab308"/>
  <circle cx="8" cy="30" r="3.5" fill="#3b82f6"/>
  <circle cx="27" cy="12" r="3.5" fill="#22c55e"/>
</svg>`;

    case 'frame_snowflake_crystal':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="snowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="100%" stop-color="#60a5fa"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#snowGrad)" stroke-width="3"/>
  <!-- 6-pointed star tips -->
  <line x1="50" y1="2" x2="50" y2="14" stroke="#93c5fd" stroke-width="2"/>
  <line x1="50" y1="86" x2="50" y2="98" stroke="#93c5fd" stroke-width="2"/>
  <line x1="8" y1="26" x2="18" y2="32" stroke="#93c5fd" stroke-width="2"/>
  <line x1="82" y1="68" x2="92" y2="74" stroke="#93c5fd" stroke-width="2"/>
  <line x1="8" y1="74" x2="18" y2="68" stroke="#93c5fd" stroke-width="2"/>
  <line x1="82" y1="32" x2="92" y2="26" stroke="#93c5fd" stroke-width="2"/>
</svg>`;

    case 'frame_nutcracker_gold':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="47" fill="none" stroke="#fbbf24" stroke-width="2"/>
  <circle cx="50" cy="50" r="44" fill="none" stroke="#b91c1c" stroke-width="4"/>
  <circle cx="50" cy="50" r="41" fill="none" stroke="#fbbf24" stroke-width="2"/>
  <!-- Gold braid studs -->
  <circle cx="50" cy="4" r="2.5" fill="#fef08a"/>
  <circle cx="96" cy="50" r="2.5" fill="#fef08a"/>
  <circle cx="50" cy="96" r="2.5" fill="#fef08a"/>
  <circle cx="4" cy="50" r="2.5" fill="#fef08a"/>
</svg>`;

    case 'frame_starlit_halo':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="haloGrad" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="#fde047" stop-opacity="0"/>
      <stop offset="90%" stop-color="#f59e0b" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#d97706" stop-opacity="1"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="47" fill="none" stroke="url(#haloGrad)" stroke-width="6"/>
  <!-- Golden rays radiating outward -->
  <line x1="50" y1="0" x2="50" y2="8" stroke="#fde047" stroke-width="2.5"/>
  <line x1="85" y1="15" x2="79" y2="21" stroke="#fde047" stroke-width="2"/>
  <line x1="100" y1="50" x2="92" y2="50" stroke="#fde047" stroke-width="2.5"/>
  <line x1="85" y1="85" x2="79" y2="79" stroke="#fde047" stroke-width="2"/>
  <line x1="50" y1="100" x2="50" y2="92" stroke="#fde047" stroke-width="2.5"/>
  <line x1="15" y1="85" x2="21" y2="79" stroke="#fde047" stroke-width="2"/>
  <line x1="0" y1="50" x2="8" y2="50" stroke="#fde047" stroke-width="2.5"/>
  <line x1="15" y1="15" x2="21" y2="21" stroke="#fde047" stroke-width="2"/>
</svg>`;

    case 'frame_jingle_bells':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="46" fill="none" stroke="#cbd5e1" stroke-width="4"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <!-- Silver bells -->
  <circle cx="50" cy="5" r="4" fill="#e2e8f0" stroke="#64748b" stroke-width="1"/>
  <circle cx="95" cy="50" r="4" fill="#e2e8f0" stroke="#64748b" stroke-width="1"/>
  <circle cx="50" cy="95" r="4" fill="#e2e8f0" stroke="#64748b" stroke-width="1"/>
  <circle cx="5" cy="50" r="4" fill="#e2e8f0" stroke="#64748b" stroke-width="1"/>
  <!-- Red ribbon bow at top -->
  <path d="M 44,5 Q 50,0 56,5 Q 50,10 44,5 Z" fill="#ef4444"/>
</svg>`;

    default:
      throw new Error(`Unknown frame id ${id}`);
  }
}

// --- 4. TABLE SKIN SVGS (1600x1000) ---
function generateTableSvg(id) {
  const specs = {
    table_velvet_red_gold: {
      marker: 'velvetRedWeave',
      base: '#450a0a',
      inner: '#7f1d1d',
      gold: '#fbbf24',
      accent: '#b91c1c'
    },
    table_frosty_blue_ice: {
      marker: 'frostIceRift',
      base: '#082f49',
      inner: '#0369a1',
      gold: '#38bdf8',
      accent: '#e0f2fe'
    },
    table_pine_green_wood: {
      marker: 'pineGreenGrain',
      base: '#052e16',
      inner: '#14532d',
      gold: '#22c55e',
      accent: '#86efac'
    },
    table_yule_hearthstone: {
      marker: 'hearthStoneAmber',
      base: '#1c1917',
      inner: '#44403c',
      gold: '#f59e0b',
      accent: '#ea580c'
    },
    table_gingerbread_table: {
      marker: 'gingerbreadIcing',
      base: '#451a03',
      inner: '#78350f',
      gold: '#d97706',
      accent: '#fef3c7'
    },
    table_midnight_winter_snow: {
      marker: 'midnightSnowFlake',
      base: '#020617',
      inner: '#0f172a',
      gold: '#93c5fd',
      accent: '#e2e8f0'
    },
    table_candy_cane_felt: {
      marker: 'candyStripeBorder',
      base: '#7f1d1d',
      inner: '#991b1b',
      gold: '#ef4444',
      accent: '#ffffff'
    },
    table_aurora_lake: {
      marker: 'auroraReflectGrad',
      base: '#09090b',
      inner: '#1e1b4b',
      gold: '#a855f7',
      accent: '#2dd4bf'
    },
    table_nutcracker_suite: {
      marker: 'nutcrackerMarquetry',
      base: '#1e1b4b',
      inner: '#312e81',
      gold: '#fbbf24',
      accent: '#dc2626'
    },
    table_starlit_observatory_winter: {
      marker: 'winterConstellation',
      base: '#030712',
      inner: '#111827',
      gold: '#facc15',
      accent: '#60a5fa'
    },
    table_frozen_runestone: {
      marker: 'frostRuneEngrave',
      base: '#0b0f19',
      inner: '#1e293b',
      gold: '#38bdf8',
      accent: '#06b6d4'
    }
  };

  const s = specs[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000">
  <defs>
    <radialGradient id="${s.marker}" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="${s.inner}"/>
      <stop offset="85%" stop-color="${s.base}"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <linearGradient id="${s.marker}_gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${s.gold}"/>
      <stop offset="50%" stop-color="${s.accent}"/>
      <stop offset="100%" stop-color="${s.gold}"/>
    </linearGradient>
    <filter id="${s.marker}_shadow"><feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#000000" flood-opacity="0.8"/></filter>
  </defs>
  <!-- Outer Table Rim -->
  <rect x="20" y="20" width="1560" height="960" rx="480" fill="url(#${s.marker})" stroke="url(#${s.marker}_gold)" stroke-width="18" filter="url(#${s.marker}_shadow)"/>
  <!-- Inner Play Felt Boundary -->
  <rect x="70" y="70" width="1460" height="860" rx="430" fill="none" stroke="${s.gold}" stroke-width="3" stroke-dasharray="14,10" opacity="0.65"/>
  <!-- Center Thematic Ring & Medallion -->
  <circle cx="800" cy="500" r="180" fill="none" stroke="url(#${s.marker}_gold)" stroke-width="4" opacity="0.8"/>
  <circle cx="800" cy="500" r="170" fill="none" stroke="${s.accent}" stroke-width="1.5" stroke-dasharray="8,6" opacity="0.5"/>
  <!-- Decorative Corner Vignettes -->
  <circle cx="350" cy="500" r="30" fill="none" stroke="${s.gold}" stroke-width="2" opacity="0.4"/>
  <circle cx="1250" cy="500" r="30" fill="none" stroke="${s.gold}" stroke-width="2" opacity="0.4"/>
</svg>`;
}

// --- 5. CARD BACK SVGS (1050x1498) ---
function generateCardBackSvg(id) {
  const specs = {
    star_of_bethlehem: { bg: '#030712', border: '#fbbf24', center: '⭐', motif: 'STAR' },
    snowflake_mandala: { bg: '#082f49', border: '#38bdf8', center: '❄️', motif: 'FLAKE' },
    christmas_tree_tapestry: { bg: '#052e16', border: '#22c55e', center: '🎄', motif: 'TREE' },
    reindeer_crest: { bg: '#450a0a', border: '#cbd5e1', center: '🦌', motif: 'STAG' },
    gingerbread_heart: { bg: '#451a03', border: '#fef3c7', center: '🍪', motif: 'HEART' },
    nutcracker_regiment: { bg: '#1e1b4b', border: '#fbbf24', center: '💂', motif: 'CROWN' },
    aurora_borealis_deck: { bg: '#09090b', border: '#a855f7', center: '🌌', motif: 'AURORA' },
    candlelight_vigil: { bg: '#1c1917', border: '#f59e0b', center: '🕯️', motif: 'CANDLE' },
    frost_filigree: { bg: '#0f172a', border: '#94a3b8', center: '🧊', motif: 'ICE' },
    yule_log_fire: { bg: '#262626', border: '#ea580c', center: '🔥', motif: 'FIRE' },
    winter_solstice_gold: { bg: '#172554', border: '#fde047', center: '☀️', motif: 'SOLSTICE' }
  };

  const s = specs[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1050 1498" width="1050" height="1498">
  <defs>
    <radialGradient id="cardGrad_${id}" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${s.border}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${s.bg}"/>
    </radialGradient>
    <filter id="cardShadow_${id}"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.8"/></filter>
  </defs>
  <!-- Card Back Exterior Rim -->
  <rect x="25" y="25" width="1000" height="1448" rx="65" fill="${s.bg}" stroke="${s.border}" stroke-width="18" filter="url(#cardShadow_${id})"/>
  <!-- Inner Guilloche Border -->
  <rect x="65" y="65" width="920" height="1368" rx="45" fill="url(#cardGrad_${id})" stroke="${s.border}" stroke-width="4" stroke-dasharray="12,8"/>
  <rect x="85" y="85" width="880" height="1328" rx="35" fill="none" stroke="${s.border}" stroke-width="1.5" opacity="0.6"/>
  <!-- Center Starburst / Medallion -->
  <circle cx="525" cy="749" r="220" fill="${s.bg}" stroke="${s.border}" stroke-width="6"/>
  <circle cx="525" cy="749" r="195" fill="none" stroke="${s.border}" stroke-width="2" stroke-dasharray="8,6"/>
  <!-- Thematic Symbol -->
  <text x="525" y="785" font-family="'Cinzel Decorative', 'Times New Roman', serif" font-size="110" font-weight="bold" fill="${s.border}" text-anchor="middle">${s.center}</text>
  <!-- Corner Ornaments -->
  <circle cx="130" cy="130" r="20" fill="none" stroke="${s.border}" stroke-width="3"/>
  <circle cx="920" cy="130" r="20" fill="none" stroke="${s.border}" stroke-width="3"/>
  <circle cx="130" cy="1368" r="20" fill="none" stroke="${s.border}" stroke-width="3"/>
  <circle cx="920" cy="1368" r="20" fill="none" stroke="${s.border}" stroke-width="3"/>
</svg>`;
}

// =====================================================================
// MAIN EXECUTION ROUTINE
// =====================================================================
function main() {
  const rootDir = path.resolve(__dirname, '..');
  const publicDir = path.join(rootDir, 'public');
  const androidDir = path.join(rootDir, 'android/app/src/main/assets/public');

  console.log('=== GENERATING 57 CHRISTMAS ASSETS ===');

  let generatedCount = 0;
  let mirroredCount = 0;

  // 1. Generate 12 Avatars
  console.log('\n[1/5] Generating 12 Christmas Avatars (PNG > 10KB)...');
  for (const item of AVATAR_SPECS) {
    const png = buildPng(512, 512, item.shader);
    const filename = `${item.id}.png`;
    const destWeb = path.join(publicDir, 'images/avatars', filename);
    const destAndroid = path.join(androidDir, 'images/avatars', filename);

    fs.writeFileSync(destWeb, png);
    generatedCount++;
    console.log(`  ✓ ${filename} (${png.length} bytes)`);

    if (fs.existsSync(path.dirname(destAndroid))) {
      fs.writeFileSync(destAndroid, png);
      mirroredCount++;
    }
  }

  // 2. Generate 12 Backgrounds
  console.log('\n[2/5] Generating 12 Christmas Lobby Backgrounds (PNG > 10KB)...');
  for (const item of BACKGROUND_SPECS) {
    const png = buildPng(1376, 768, item.shader);
    const filename = `${item.id}.png`;
    const destWeb = path.join(publicDir, 'images/backgrounds', filename);
    const destAndroid = path.join(androidDir, 'images/backgrounds', filename);

    fs.writeFileSync(destWeb, png);
    generatedCount++;
    console.log(`  ✓ ${filename} (${png.length} bytes)`);

    if (fs.existsSync(path.dirname(destAndroid))) {
      fs.writeFileSync(destAndroid, png);
      mirroredCount++;
    }
  }

  // 3. Generate 11 Frames
  console.log('\n[3/5] Generating 11 Christmas Avatar Frames (SVG)...');
  const FRAME_IDS = [
    'holly_wreath', 'icicles', 'golden_tinsel', 'candy_cane', 'gingerbread_border',
    'frostfire', 'christmas_lights', 'snowflake_crystal', 'nutcracker_gold', 'starlit_halo', 'jingle_bells'
  ];
  for (const id of FRAME_IDS) {
    const svg = generateFrameSvg(`frame_${id}`);
    const filename = `frame_${id}.svg`;
    const destWeb = path.join(publicDir, 'images/frames', filename);
    const destAndroid = path.join(androidDir, 'images/frames', filename);

    fs.writeFileSync(destWeb, svg, 'utf8');
    generatedCount++;
    console.log(`  ✓ ${filename} (${svg.length} bytes)`);

    if (fs.existsSync(path.dirname(destAndroid))) {
      fs.writeFileSync(destAndroid, svg, 'utf8');
      mirroredCount++;
    }
  }

  // 4. Generate 11 Tables
  console.log('\n[4/5] Generating 11 Christmas Table Skins (SVG)...');
  const TABLE_IDS = [
    'velvet_red_gold', 'frosty_blue_ice', 'pine_green_wood', 'yule_hearthstone',
    'gingerbread_table', 'midnight_winter_snow', 'candy_cane_felt', 'aurora_lake',
    'nutcracker_suite', 'starlit_observatory_winter', 'frozen_runestone'
  ];
  for (const id of TABLE_IDS) {
    const svg = generateTableSvg(`table_${id}`);
    const filename = `table_${id}.svg`;
    const destWeb = path.join(publicDir, 'images/tables', filename);
    const destAndroid = path.join(androidDir, 'images/tables', filename);

    fs.writeFileSync(destWeb, svg, 'utf8');
    generatedCount++;
    console.log(`  ✓ ${filename} (${svg.length} bytes)`);

    if (fs.existsSync(path.dirname(destAndroid))) {
      fs.writeFileSync(destAndroid, svg, 'utf8');
      mirroredCount++;
    }
  }

  // 5. Generate 11 Card Backs
  console.log('\n[5/5] Generating 11 Christmas Card Backs (SVG)...');
  const CARDBACK_IDS = [
    'star_of_bethlehem', 'snowflake_mandala', 'christmas_tree_tapestry', 'reindeer_crest',
    'gingerbread_heart', 'nutcracker_regiment', 'aurora_borealis_deck', 'candlelight_vigil',
    'frost_filigree', 'yule_log_fire', 'winter_solstice_gold'
  ];
  for (const id of CARDBACK_IDS) {
    const svg = generateCardBackSvg(id);
    const filename = `back_${id}.svg`;
    const destWeb = path.join(publicDir, 'images/card_backs', filename);
    const destAndroid = path.join(androidDir, 'images/card_backs', filename);

    fs.writeFileSync(destWeb, svg, 'utf8');
    generatedCount++;
    console.log(`  ✓ ${filename} (${svg.length} bytes)`);

    if (fs.existsSync(path.dirname(destAndroid))) {
      fs.writeFileSync(destAndroid, svg, 'utf8');
      mirroredCount++;
    }
  }

  console.log(`\n=== ASSET GENERATION FINISHED ===`);
  console.log(`Total generated files: ${generatedCount}/57`);
  console.log(`Total mirrored to Android: ${mirroredCount}/57`);
}

main();
