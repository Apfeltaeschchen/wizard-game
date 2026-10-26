const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../public/animations/chests');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function createBezierEase(x1, y1, x2, y2) {
  return {
    i: { x: [x2, x2, x2], y: [y2, y2, y2] },
    o: { x: [x1, x1, x1], y: [y1, y1, y1] }
  };
}

function hexToRgbArray(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b, 1];
}

function buildChestLottie(tierConfig) {
  const {
    tierName,
    bodyColor,
    bodyHighlight,
    bandColor,
    bandBorder,
    gemColor,
    gemBorder,
    auraColor,
    interiorColor,
    rayColor
  } = tierConfig;

  const easeSmooth = createBezierEase(0.42, 0.0, 0.58, 1.0);
  const easeSquash = createBezierEase(0.12, 0.8, 0.32, 1.25);
  const easeSnap = createBezierEase(0.05, 0.9, 0.2, 1.35);

  const lottieData = {
    v: '5.7.4',
    fr: 60,
    ip: 0,
    op: 150,
    w: 300,
    h: 300,
    nm: `Chest_${tierName}`,
    ddd: 0,
    assets: [],
    layers: [
      // 1. SCHATTEN AUF SOCKEL (FLOOR SHADOW)
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Floor Shadow',
        sr: 1,
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [60], ...easeSmooth },
              { t: 30, s: [70], ...easeSmooth },
              { t: 60, s: [60], ...easeSmooth },
              { t: 72, s: [85], ...easeSquash },
              { t: 82, s: [45], ...easeSnap },
              { t: 95, s: [65], ...easeSmooth },
              { t: 110, s: [60] }
            ]
          },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [150, 248, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: {
            a: 1,
            k: [
              { t: 0, s: [100, 100, 100], ...easeSmooth },
              { t: 30, s: [103, 103, 100], ...easeSmooth },
              { t: 60, s: [100, 100, 100], ...easeSmooth },
              { t: 72, s: [118, 118, 100], ...easeSquash },
              { t: 82, s: [90, 90, 100], ...easeSnap },
              { t: 95, s: [105, 105, 100], ...easeSmooth },
              { t: 110, s: [100, 100, 100] }
            ]
          }
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            nm: 'Shadow Group',
            it: [
              {
                ty: 'el',
                nm: 'Shadow Ellipse',
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [175, 26] }
              },
              {
                ty: 'fl',
                nm: 'Shadow Fill',
                c: { a: 0, k: [0, 0, 0, 1] },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          }
        ],
        ip: 0,
        op: 150,
        st: 0
      },

      // 2. AURA & RUNEN-GLIMMEN (AMBIENT AURA)
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: 'Arcane Aura',
        sr: 1,
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [45], ...easeSmooth },
              { t: 30, s: [65], ...easeSmooth },
              { t: 60, s: [45], ...easeSmooth },
              { t: 72, s: [85], ...easeSquash },
              { t: 85, s: [100], ...easeSnap },
              { t: 110, s: [75], ...easeSmooth },
              { t: 150, s: [65] }
            ]
          },
          r: {
            a: 1,
            k: [
              { t: 0, s: [0], ...easeSmooth },
              { t: 150, s: [36] }
            ]
          },
          p: { a: 0, k: [150, 165, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: {
            a: 1,
            k: [
              { t: 0, s: [100, 100, 100], ...easeSmooth },
              { t: 30, s: [106, 106, 100], ...easeSmooth },
              { t: 60, s: [100, 100, 100], ...easeSmooth },
              { t: 72, s: [120, 120, 100], ...easeSquash },
              { t: 85, s: [145, 145, 100], ...easeSnap },
              { t: 110, s: [125, 125, 100], ...easeSmooth },
              { t: 150, s: [120, 120, 100] }
            ]
          }
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            nm: 'Aura Shape',
            it: [
              {
                ty: 'el',
                nm: 'Aura Ellipse',
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [230, 210] }
              },
              {
                ty: 'fl',
                nm: 'Aura Fill',
                c: { a: 0, k: hexToRgbArray(auraColor) },
                o: { a: 0, k: 80 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          }
        ],
        ip: 0,
        op: 150,
        st: 0
      },

      // 3. APEX LICHTSTRAHLEN & ENERGIEKERN (LIGHT RAYS)
      {
        ddd: 0,
        ind: 3,
        ty: 4,
        nm: 'Apex Light Rays',
        sr: 1,
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [0] },
              { t: 78, s: [0], ...easeSnap },
              { t: 85, s: [95], ...easeSnap },
              { t: 115, s: [80], ...easeSmooth },
              { t: 150, s: [75] }
            ]
          },
          r: {
            a: 1,
            k: [
              { t: 80, s: [0] },
              { t: 150, s: [60] }
            ]
          },
          p: { a: 0, k: [150, 142, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: {
            a: 1,
            k: [
              { t: 0, s: [0, 0, 100] },
              { t: 80, s: [10, 10, 100], ...easeSnap },
              { t: 86, s: [135, 135, 100], ...easeSnap },
              { t: 100, s: [115, 115, 100], ...easeSmooth },
              { t: 150, s: [120, 120, 100] }
            ]
          }
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            nm: 'Rays Group',
            it: [
              // Vertikaler Hauptstrahl
              {
                ty: 'rc',
                nm: 'Ray 1',
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [22, 220] },
                r: { a: 0, k: 0 }
              },
              // Horizontaler Strahl
              {
                ty: 'rc',
                nm: 'Ray 2',
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [220, 22] },
                r: { a: 0, k: 0 }
              },
              // 45-Grad-Diagonalstrahl
              {
                ty: 'rc',
                nm: 'Ray 3',
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [16, 190] },
                r: { a: 0, k: 0 }
              },
              {
                ty: 'fl',
                nm: 'Rays Fill',
                c: { a: 0, k: hexToRgbArray(rayColor) },
                o: { a: 0, k: 90 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 45 },
                o: { a: 0, k: 80 }
              }
            ]
          }
        ],
        ip: 0,
        op: 150,
        st: 0
      },

      // 4. TRUHEN-INNENRAUM (INTERIOR CAVITY)
      {
        ddd: 0,
        ind: 4,
        ty: 4,
        nm: 'Chest Interior',
        sr: 1,
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [0] },
              { t: 74, s: [0], ...easeSnap },
              { t: 82, s: [100] },
              { t: 150, s: [100] }
            ]
          },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [150, 150, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] }
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            nm: 'Cavity Group',
            it: [
              {
                ty: 'rc',
                nm: 'Inner Cavity',
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [154, 46] },
                r: { a: 0, k: 8 }
              },
              {
                ty: 'fl',
                nm: 'Cavity Fill',
                c: { a: 0, k: hexToRgbArray(interiorColor) },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          },
          {
            ty: 'gr',
            nm: 'Glowing Core Orb',
            it: [
              {
                ty: 'el',
                nm: 'Core Orb',
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [48, 28] }
              },
              {
                ty: 'fl',
                nm: 'Core Fill',
                c: { a: 0, k: hexToRgbArray(gemColor) },
                o: { a: 0, k: 95 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          }
        ],
        ip: 0,
        op: 150,
        st: 0
      },

      // 5. TRUHEN-KÖRPER (CHEST BODY BASE - UNTERTEIL)
      {
        ddd: 0,
        ind: 5,
        ty: 4,
        nm: 'Chest Body',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [150, 235, 0] }, // Verankerung am Sockelboden
          a: { a: 0, k: [150, 235, 0] },
          s: {
            a: 1,
            k: [
              // Frame 0..60: Sanftes Idle-Atmen
              { t: 0, s: [100, 100, 100], ...easeSmooth },
              { t: 30, s: [101.5, 98.5, 100], ...easeSmooth },
              { t: 60, s: [100, 100, 100], ...easeSquash },
              // Frame 60..72: Kraftvolles Squash & Stretch (Antizipation!)
              { t: 72, s: [114, 86, 100], ...easeSquash },
              // Frame 72..82: Elastischer Federsprung nach oben (Stretch)
              { t: 82, s: [94, 108, 100], ...easeSnap },
              // Frame 82..95: Nachschwingen (Bouncing)
              { t: 95, s: [104, 97, 100], ...easeSmooth },
              { t: 108, s: [99, 101, 100], ...easeSmooth },
              { t: 120, s: [100, 100, 100] }
            ]
          }
        },
        ao: 0,
        shapes: [
          // Hauptkasten Unterteil
          {
            ty: 'gr',
            nm: 'Body Main',
            it: [
              {
                ty: 'rc',
                nm: 'Body Rect',
                p: { a: 0, k: [150, 185] },
                s: { a: 0, k: [176, 76] },
                r: { a: 0, k: 12 }
              },
              {
                ty: 'fl',
                nm: 'Body Fill',
                c: { a: 0, k: hexToRgbArray(bodyColor) },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'st',
                nm: 'Body Border',
                c: { a: 0, k: hexToRgbArray(bodyHighlight) },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 3 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          },
          // Vertikales Metallband Links
          {
            ty: 'gr',
            nm: 'Metal Band Left',
            it: [
              {
                ty: 'rc',
                nm: 'Band Left Rect',
                p: { a: 0, k: [105, 185] },
                s: { a: 0, k: [18, 76] },
                r: { a: 0, k: 2 }
              },
              {
                ty: 'fl',
                nm: 'Band Fill',
                c: { a: 0, k: hexToRgbArray(bandColor) },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'st',
                nm: 'Band Stroke',
                c: { a: 0, k: hexToRgbArray(bandBorder) },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 1.5 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          },
          // Vertikales Metallband Rechts
          {
            ty: 'gr',
            nm: 'Metal Band Right',
            it: [
              {
                ty: 'rc',
                nm: 'Band Right Rect',
                p: { a: 0, k: [195, 185] },
                s: { a: 0, k: [18, 76] },
                r: { a: 0, k: 2 }
              },
              {
                ty: 'fl',
                nm: 'Band Fill',
                c: { a: 0, k: hexToRgbArray(bandColor) },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'st',
                nm: 'Band Stroke',
                c: { a: 0, k: hexToRgbArray(bandBorder) },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 1.5 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          },
          // Schlosssockel (Schlüsselloch-Platte vorne)
          {
            ty: 'gr',
            nm: 'Lock Socket Plate',
            it: [
              {
                ty: 'rc',
                nm: 'Lock Plate Rect',
                p: { a: 0, k: [150, 160] },
                s: { a: 0, k: [32, 30] },
                r: { a: 0, k: 4 }
              },
              {
                ty: 'fl',
                nm: 'Lock Plate Fill',
                c: { a: 0, k: hexToRgbArray(bandColor) },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'st',
                nm: 'Lock Plate Stroke',
                c: { a: 0, k: hexToRgbArray(bandBorder) },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 2 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          },
          // Schlüsselloch-Ausschnitt
          {
            ty: 'gr',
            nm: 'Keyhole Slot',
            it: [
              {
                ty: 'el',
                nm: 'Keyhole Top',
                p: { a: 0, k: [150, 158] },
                s: { a: 0, k: [8, 8] }
              },
              {
                ty: 'rc',
                nm: 'Keyhole Bottom',
                p: { a: 0, k: [150, 163] },
                s: { a: 0, k: [5, 8] },
                r: { a: 0, k: 1 }
              },
              {
                ty: 'fl',
                nm: 'Keyhole Fill',
                c: { a: 0, k: [0, 0, 0, 1] },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          }
        ],
        ip: 0,
        op: 150,
        st: 0
      },

      // 6. SCHLOSS-RIEGEL (SCHNAPPVERSCHLUSS MIT EDELSTEIN)
      {
        ddd: 0,
        ind: 6,
        ty: 4,
        nm: 'Lock Clasp Latch',
        sr: 1,
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [100] },
              { t: 72, s: [100], ...easeSnap },
              { t: 84, s: [0] }, // Schnappt auf und weicht bei Deckelöffnung
              { t: 150, s: [0] }
            ]
          },
          r: {
            a: 1,
            k: [
              { t: 0, s: [0] },
              { t: 68, s: [0], ...easeSnap },
              { t: 76, s: [32], ...easeSnap }, // Riegel springt im Bogen auf
              { t: 84, s: [52] }
            ]
          },
          p: {
            a: 1,
            k: [
              { t: 0, s: [150, 152, 0], ...easeSmooth },
              { t: 30, s: [150, 154, 0], ...easeSmooth },
              { t: 60, s: [150, 152, 0], ...easeSquash },
              { t: 72, s: [150, 158, 0], ...easeSnap }, // Duckt sich mit Truhe
              { t: 77, s: [150, 126, 0], ...easeSnap }, // SCHNELLT ELASTISCH NACH OBEN (-32px)!
              { t: 84, s: [150, 114, 0] }
            ]
          },
          a: { a: 0, k: [150, 142, 0] }, // Drehachse an der oberen Riegelhalterung
          s: { a: 0, k: [100, 100, 100] }
        },
        ao: 0,
        shapes: [
          // Riegel-Bügel
          {
            ty: 'gr',
            nm: 'Clasp Bracket',
            it: [
              {
                ty: 'rc',
                nm: 'Clasp Rect',
                p: { a: 0, k: [150, 148] },
                s: { a: 0, k: [22, 28] },
                r: { a: 0, k: 5 }
              },
              {
                ty: 'fl',
                nm: 'Clasp Fill',
                c: { a: 0, k: hexToRgbArray(bandBorder) },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'st',
                nm: 'Clasp Stroke',
                c: { a: 0, k: hexToRgbArray(bodyHighlight) },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 2 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          },
          // Leuchtender Edelstein auf Riegel
          {
            ty: 'gr',
            nm: 'Clasp Gem',
            it: [
              {
                ty: 'el',
                nm: 'Gem Circle',
                p: { a: 0, k: [150, 152] },
                s: { a: 0, k: [14, 14] }
              },
              {
                ty: 'fl',
                nm: 'Gem Fill',
                c: { a: 0, k: hexToRgbArray(gemColor) },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'st',
                nm: 'Gem Rim',
                c: { a: 0, k: hexToRgbArray(gemBorder) },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 1.5 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          }
        ],
        ip: 0,
        op: 150,
        st: 0
      },

      // 7. TRUHEN-DECKEL (CHEST LID - 3D PERSPEKTIVISCHER SCHARNIERFLIP)
      {
        ddd: 0,
        ind: 7,
        ty: 4,
        nm: 'Chest Lid',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: {
            a: 1,
            k: [
              { t: 0, s: [0] },
              { t: 72, s: [0], ...easeSquash },
              { t: 76, s: [-4], ...easeSnap }, // Antizipiertes Anheben
              { t: 84, s: [-16], ...easeSnap },
              { t: 94, s: [-12], ...easeSmooth },
              { t: 110, s: [-14] }
            ]
          },
          p: {
            a: 1,
            k: [
              { t: 0, s: [150, 148, 0], ...easeSmooth },
              { t: 30, s: [150, 151, 0], ...easeSmooth },
              { t: 60, s: [150, 148, 0], ...easeSquash },
              // Squash: Deckel folgt der Stauchung nach unten
              { t: 72, s: [150, 158, 0], ...easeSquash },
              // Öffnen: Scharnierachse schlägt kraftvoll nach hinten auf
              { t: 84, s: [150, 134, 0], ...easeSnap },
              { t: 94, s: [150, 137, 0], ...easeSmooth },
              { t: 110, s: [150, 136, 0] }
            ]
          },
          a: { a: 0, k: [150, 148, 0] }, // HINTERE SCHARNIERACHSE
          s: {
            a: 1,
            k: [
              // Frame 0..60: Idle-Atmen synchron mit Körper
              { t: 0, s: [100, 100, 100], ...easeSmooth },
              { t: 30, s: [101.5, 98.5, 100], ...easeSmooth },
              { t: 60, s: [100, 100, 100], ...easeSquash },
              // Frame 60..72: Squash Antizipation
              { t: 72, s: [114, 86, 100], ...easeSquash },
              // Frame 72..84: ECHTER SCHARNIER-ÜBERSCHLAG (Scale Y flippt von + nach -!)
              { t: 76, s: [106, 35, 100], ...easeSnap },
              { t: 80, s: [100, -75, 100], ...easeSnap },
              // Frame 84: Anschlag bei Überdrehung (-125%)
              { t: 85, s: [98, -125, 100], ...easeSnap },
              // Frame 85..96: Elastisches Zurückfedern (Bouncing)
              { t: 95, s: [101, -112, 100], ...easeSmooth },
              { t: 108, s: [100, -118, 100], ...easeSmooth },
              { t: 120, s: [100, -116, 100] }
            ]
          }
        },
        ao: 0,
        shapes: [
          // Gewölbter Deckelkörper
          {
            ty: 'gr',
            nm: 'Lid Main Dome',
            it: [
              {
                ty: 'rc',
                nm: 'Lid Dome Rect',
                p: { a: 0, k: [150, 120] },
                s: { a: 0, k: [182, 56] },
                r: { a: 0, k: 18 }
              },
              {
                ty: 'fl',
                nm: 'Lid Fill',
                c: { a: 0, k: hexToRgbArray(bodyColor) },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'st',
                nm: 'Lid Border',
                c: { a: 0, k: hexToRgbArray(bodyHighlight) },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 3 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          },
          // Vertikales Metallband Links (Deckel)
          {
            ty: 'gr',
            nm: 'Lid Band Left',
            it: [
              {
                ty: 'rc',
                nm: 'Lid Band L Rect',
                p: { a: 0, k: [105, 120] },
                s: { a: 0, k: [18, 56] },
                r: { a: 0, k: 4 }
              },
              {
                ty: 'fl',
                nm: 'Lid Band L Fill',
                c: { a: 0, k: hexToRgbArray(bandColor) },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'st',
                nm: 'Lid Band L Stroke',
                c: { a: 0, k: hexToRgbArray(bandBorder) },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 1.5 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          },
          // Vertikales Metallband Rechts (Deckel)
          {
            ty: 'gr',
            nm: 'Lid Band Right',
            it: [
              {
                ty: 'rc',
                nm: 'Lid Band R Rect',
                p: { a: 0, k: [195, 120] },
                s: { a: 0, k: [18, 56] },
                r: { a: 0, k: 4 }
              },
              {
                ty: 'fl',
                nm: 'Lid Band R Fill',
                c: { a: 0, k: hexToRgbArray(bandColor) },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'st',
                nm: 'Lid Band R Stroke',
                c: { a: 0, k: hexToRgbArray(bandBorder) },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 1.5 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          },
          // Zieremblem / Krone auf Deckel
          {
            ty: 'gr',
            nm: 'Lid Crest Emblem',
            it: [
              {
                ty: 'el',
                nm: 'Crest Center',
                p: { a: 0, k: [150, 104] },
                s: { a: 0, k: [22, 16] }
              },
              {
                ty: 'fl',
                nm: 'Crest Fill',
                c: { a: 0, k: hexToRgbArray(bandBorder) },
                o: { a: 0, k: 100 }
              },
              {
                ty: 'st',
                nm: 'Crest Stroke',
                c: { a: 0, k: hexToRgbArray(bodyHighlight) },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 1.5 }
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ]
          }
        ],
        ip: 0,
        op: 150,
        st: 0
      }
    ],
    markers: [
      { tm: 0, cm: 'idle_start', dr: 60 },
      { tm: 60, cm: 'open_anticipation', dr: 12 },
      { tm: 72, cm: 'clasp_snap', dr: 10 },
      { tm: 85, cm: 'apex_reveal', dr: 25 },
      { tm: 110, cm: 'settled_open', dr: 40 }
    ]
  };

  return lottieData;
}

// 1. HOLZTRUHE DES LEHRLINGS: Uriges Eichenholz & warmes Bernsteinschloss
const woodenConfig = {
  tierName: 'wooden',
  bodyColor: '#5c3317',
  bodyHighlight: '#a16207',
  bandColor: '#334155',
  bandBorder: '#64748b',
  gemColor: '#f59e0b',
  gemBorder: '#fef3c7',
  auraColor: '#f59e0b',
  interiorColor: '#1a0c04',
  rayColor: '#fef08a'
};

// 2. SILBERNE MAGIERTRUHE: Chiseled Mithril-Silber & Frostsaphir
const silverConfig = {
  tierName: 'silver',
  bodyColor: '#64748b',
  bodyHighlight: '#e2e8f0',
  bandColor: '#0369a1',
  bandBorder: '#38bdf8',
  gemColor: '#38bdf8',
  gemBorder: '#e0f2fe',
  auraColor: '#38bdf8',
  interiorColor: '#08172e',
  rayColor: '#bae6fd'
};

// 3. GOLDENE ERZMAGIER-KASSETTE: 24k Massivgold, Purpursamt & Drachenherz-Rubin
const goldConfig = {
  tierName: 'gold',
  bodyColor: '#b45309',
  bodyHighlight: '#fde68a',
  bandColor: '#d97706',
  bandBorder: '#fbbf24',
  gemColor: '#ef4444',
  gemBorder: '#ffe4e6',
  auraColor: '#fbbf24',
  interiorColor: '#2b0938',
  rayColor: '#fef08a'
};

const configs = [woodenConfig, silverConfig, goldConfig];
configs.forEach(cfg => {
  const data = buildChestLottie(cfg);
  const outPath = path.join(OUTPUT_DIR, `chest_${cfg.tierName}_lottie.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Generated ${outPath} (${fs.statSync(outPath).size} bytes)`);
});
