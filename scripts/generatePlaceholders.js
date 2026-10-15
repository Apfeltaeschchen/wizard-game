const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public', 'images', 'cards');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const cards = [
  { file: 'archmage.svg', name: 'Erzmagier', symbol: 'E', color1: '#3b0764', color2: '#1e0338', border: '#c084fc', desc: 'Hüter der arkanen Siegel des Hohen Rates' },
  { file: 'charlatan.svg', name: 'Scharlatan', symbol: 'S', color1: '#334155', color2: '#0f172a', border: '#94a3b8', desc: 'Maskierter Gaukler & Schattengänger' },
  { file: 'unicorn.svg', name: 'Einhorn', symbol: 'H', color1: '#4c1d95', color2: '#1e1b4b', border: '#f0abfc', desc: 'Kosmisches Urwesen aus reinem Sternenlicht' },
  { file: 'lindwurm.svg', name: 'Lindwurm', symbol: 'L', color1: '#7f1d1d', color2: '#450a0a', border: '#f59e0b', desc: 'Ältester Schrecken der Ascheberge' },
  { file: 'sylph.svg', name: 'Waldnymphe', symbol: 'F', color1: '#0369a1', color2: '#082f49', border: '#38bdf8', desc: 'Ätherische Lichtgestalt des Weltenbaums' },
  { file: 'collapse.svg', name: 'Magiekollaps', symbol: 'K', color1: '#c2410c', color2: '#431407', border: '#fb923c', desc: 'Arkane Implosion der Zerstörung' },
  { file: 'doppelganger.svg', name: 'Doppelgänger', symbol: 'D', color1: '#047857', color2: '#022c22', border: '#34d399', desc: 'Gestaltloses Schattenwesen' },
  { file: 'bloodlord.svg', name: 'Blutfürst', symbol: 'B', color1: '#831843', color2: '#4c0519', border: '#f43f5e', desc: 'Dunkler Aristokrat der Nacht' },
  { file: 'cloud.svg', name: 'Himmelsschleier', symbol: '9¾', color1: '#1e293b', color2: '#020617', border: '#60a5fa', desc: 'Arkane Gewitterwolke am Firmament' },
  { file: 'moonbeast.svg', name: 'Mondbestie', symbol: 'M', color1: '#78350f', color2: '#1c1917', border: '#f59e0b', desc: 'Wilde Bestie des Blutmonds' },
  { file: 'shadowwitch.svg', name: 'Schattenhexe', symbol: 'X', color1: '#581c87', color2: '#18022e', border: '#d8b4fe', desc: 'Hüterin der Schicksalsfäden' },
  { file: 'trickster.svg', name: 'Taschenspieler', symbol: '7½', color1: '#0e7490', color2: '#083344', border: '#22d3ee', desc: 'Flinker Schelm der Schenken' }
];

cards.forEach(c => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1050 1498" width="1050" height="1498">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="${c.color1}" />
      <stop offset="70%" stop-color="${c.color2}" />
      <stop offset="100%" stop-color="#050308" />
    </radialGradient>
    <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffd700" />
      <stop offset="50%" stop-color="${c.border}" />
      <stop offset="100%" stop-color="#b45309" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1050" height="1498" rx="42" fill="url(#bgGrad)" />

  <!-- Outer Ornate Frame -->
  <rect x="30" y="30" width="990" height="1438" rx="36" fill="none" stroke="url(#goldBorder)" stroke-width="8" stroke-dasharray="12 4" opacity="0.65" />
  <rect x="52" y="52" width="946" height="1394" rx="28" fill="none" stroke="url(#goldBorder)" stroke-width="4" opacity="0.85" />
  <rect x="68" y="68" width="914" height="1362" rx="22" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" />

  <!-- Corner Badges -->
  <!-- Top-Left -->
  <g transform="translate(100, 130)">
    <circle cx="0" cy="0" r="48" fill="#110c1f" stroke="${c.border}" stroke-width="4" />
    <text x="0" y="20" font-family="'Cinzel', serif, Arial" font-size="${c.symbol.length > 1 ? 38 : 54}" font-weight="900" fill="#fef08a" text-anchor="middle">${c.symbol}</text>
  </g>
  <!-- Bottom-Right -->
  <g transform="translate(950, 1368)">
    <circle cx="0" cy="0" r="48" fill="#110c1f" stroke="${c.border}" stroke-width="4" />
    <text x="0" y="20" font-family="'Cinzel', serif, Arial" font-size="${c.symbol.length > 1 ? 38 : 54}" font-weight="900" fill="#fef08a" text-anchor="middle">${c.symbol}</text>
  </g>

  <!-- Center Artwork Placeholder Box -->
  <rect x="140" y="240" width="770" height="850" rx="24" fill="rgba(0,0,0,0.4)" stroke="${c.border}" stroke-width="3" opacity="0.8" />
  
  <g transform="translate(525, 620)">
    <!-- Arcane Icon Ring -->
    <circle cx="0" cy="0" r="140" fill="none" stroke="${c.border}" stroke-width="3" stroke-dasharray="8 6" opacity="0.7"/>
    <circle cx="0" cy="0" r="110" fill="rgba(255,255,255,0.03)" stroke="#ffd700" stroke-width="2" />
    
    <!-- Big Symbol -->
    <text x="0" y="42" font-family="'Cinzel', serif, Arial" font-size="${c.symbol.length > 1 ? 90 : 120}" font-weight="900" fill="#fef08a" text-anchor="middle">${c.symbol}</text>
  </g>

  <!-- Title & Lore Banner -->
  <g transform="translate(525, 1170)">
    <rect x="-340" y="-45" width="680" height="90" rx="16" fill="#110c1f" stroke="url(#goldBorder)" stroke-width="3" />
    <text x="0" y="15" font-family="'Cinzel Decorative', 'Cinzel', serif, Arial" font-size="46" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="3">${c.name.toUpperCase()}</text>
  </g>

  <g transform="translate(525, 1290)">
    <text x="0" y="0" font-family="'Crimson Text', serif, Arial" font-size="28" font-style="italic" fill="#cbd5e1" text-anchor="middle">${c.desc}</text>
    <text x="0" y="45" font-family="'Cinzel', serif, Arial" font-size="18" fill="#d97706" text-anchor="middle" letter-spacing="2">1050 × 1498 PX ARTWORK-SLOT</text>
  </g>
</svg>`;

  fs.writeFileSync(path.join(targetDir, c.file), svg, 'utf8');
});

// Alias-Kopien anlegen, damit bestehende und alternative Dateinamen immer funktionieren
const aliases = [
  ['unicorn.svg', 'horned_beast.svg'],
  ['lindwurm.svg', 'wyrm.svg'],
  ['sylph.svg', 'waldnymphe.svg'],
  ['doppelganger.svg', 'metamorph.svg'],
  ['bloodlord.svg', 'vampire.svg'],
  ['cloud.svg', 'himmelsschleier.svg'],
  ['moonbeast.svg', 'lycanthrope.svg'],
  ['shadowwitch.svg', 'witch.svg'],
  ['shadowwitch.svg', 'oracle.svg'],
  ['trickster.svg', 'gaukler.svg'],
  ['collapse.svg', 'magiekollaps.svg']
];

aliases.forEach(([src, dest]) => {
  const srcPath = path.join(targetDir, src);
  const destPath = path.join(targetDir, dest);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
  }
});

console.log(`✓ 12 formatfüllende 1050 × 1498 SVG-Kartenplatzhalter + Aliase erfolgreich generiert in ${targetDir}`);
