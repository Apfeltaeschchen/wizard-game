const fs = require('fs');
const path = require('path');
const assert = require('assert');

const dir = path.join(__dirname, '..', 'public', 'images', 'frames');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));

console.log('--- TESTE AVATAR-RAHMEN GEOMETRIE & SUBTILE 3D-TIEFE ---');

function parsePathPoints(d) {
  const points = [];
  const commands = d.match(/[a-df-z][^a-df-z]*/gi) || [];
  let curX = 0, curY = 0;
  for (const cmd of commands) {
    const type = cmd[0];
    const coords = cmd.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (type.toUpperCase() === 'Z') continue;
    for (let i = 0; i < coords.length; i += 2) {
      if (isNaN(coords[i]) || isNaN(coords[i+1])) continue;
      let x = coords[i];
      let y = coords[i+1];
      if (type === type.toLowerCase()) {
        curX += x;
        curY += y;
      } else {
        curX = x;
        curY = y;
      }
      points.push({ x: curX, y: curY });
    }
  }
  return points;
}

let passed = 0;
files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  let minR = 999;
  let maxR = 0;

  // Suche nach übergeordneter Gruppe <g transform="translate(50, Y)">
  let tx = 0, ty = 0;
  let inGroup = false;

  // Schnelles Token-Parsing
  const lines = content.split('\n');
  lines.forEach(line => {
    const transMatch = line.match(/<g\s+transform="translate\(([^,]+),\s*([^)]+)\)"/);
    if (transMatch) {
      tx = parseFloat(transMatch[1]);
      ty = parseFloat(transMatch[2]);
      inGroup = true;
    }
    if (inGroup && line.includes('</g>')) {
      // Prüfe ob dies das Ende der transformierten Gruppe ist
      if (line.trim() === '</g>' && (lines.indexOf(line) >= lines.length - 3)) {
        inGroup = false;
        tx = 0; ty = 0;
      }
    }

    const tagRegex = /<(path|polygon|circle|ellipse|line|polyline)[^>]+>/g;
    let match;
    while ((match = tagRegex.exec(line)) !== null) {
      const tag = match[0];
      if (tag.includes('r="35.5"') || tag.includes('r="37') || tag.includes('cx="50" cy="50"')) continue;
      let pts = [];
      if (tag.includes('points="')) {
        const raw = tag.match(/points="([^"]+)"/)[1].trim().split(/[\s,]+/);
        for (let i = 0; i < raw.length; i += 2) pts.push({ x: parseFloat(raw[i]), y: parseFloat(raw[i+1]) });
      } else if (tag.includes(' d="')) {
        pts = parsePathPoints(tag.match(/ d="([^"]+)"/)[1]);
      } else if (tag.includes('cx="')) {
        pts.push({ x: parseFloat(tag.match(/cx="([^"]+)"/)[1]), y: parseFloat(tag.match(/cy="([^"]+)"/)[1]) });
      }
      pts.forEach(p => {
        let absX = p.x;
        let absY = p.y;
        if (inGroup) {
          absX += tx;
          absY += ty;
        }
        const dist = Math.sqrt((absX - 50)**2 + (absY - 50)**2);
        if (dist < minR) minR = dist;
        if (dist > maxR) maxR = dist;
      });
    }
  });

  console.log(`✓ ${f.padEnd(26)} -> Fassungs-Tiefe: minR = ${minR.toFixed(1)}, Außenrand: maxR = ${maxR.toFixed(1)}`);
  assert(minR >= 31.8, `${f}: minR (${minR.toFixed(1)}) ist kleiner als 31.8 (ragt zu weit ins Gesicht)`);
  assert(maxR <= 44.5, `${f}: maxR (${maxR.toFixed(1)}) ist größer als 44.5 (ragt in UI-Elemente)`);
  passed++;
});

console.log(`\n🎉 ALLE ${passed} AVATAR-RAHMEN ERFOLGREICH VERIFIZIERT!`);
