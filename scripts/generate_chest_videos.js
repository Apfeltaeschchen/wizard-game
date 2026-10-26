const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 48292;
const OUTPUT_DIR = path.join(__dirname, '../public/video/chests');
const IMAGES_DIR = path.join(__dirname, '../public/images/chests');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Map files to save
const savedFiles = new Set();
const expectedFiles = [
  'chest_wooden_idle.mp4', 'chest_wooden_idle.webm',
  'chest_wooden_open.mp4', 'chest_wooden_open.webm',
  'chest_silver_idle.mp4', 'chest_silver_idle.webm',
  'chest_silver_open.mp4', 'chest_silver_open.webm',
  'chest_gold_idle.mp4', 'chest_gold_idle.webm',
  'chest_gold_open.mp4', 'chest_gold_open.webm'
];

let edgeProcess = null;

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHtmlContent());
    return;
  }

  if (parsedUrl.pathname.startsWith('/images/')) {
    const imgName = path.basename(parsedUrl.pathname);
    const imgPath = path.join(IMAGES_DIR, imgName);
    if (fs.existsSync(imgPath)) {
      const ext = path.extname(imgPath);
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(imgPath).pipe(res);
      return;
    }
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  if (parsedUrl.pathname === '/upload') {
    const filename = parsedUrl.searchParams.get('filename');
    if (!filename) {
      res.writeHead(400);
      res.end('Missing filename');
      return;
    }

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const targetPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(targetPath, buffer);
      console.log(`[GENERATOR] Saved ${filename} (${buffer.length} bytes)`);
      savedFiles.add(filename);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, saved: filename }));

      if (expectedFiles.every(f => savedFiles.has(f))) {
        console.log('[GENERATOR] All 12 video assets successfully created!');
        setTimeout(() => {
          if (edgeProcess) edgeProcess.kill();
          server.close(() => {
            console.log('[GENERATOR] Server closed. Done.');
            process.exit(0);
          });
        }, 1000);
      }
    });
    return;
  }

  if (parsedUrl.pathname === '/log') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log(`[BROWSER LOG] ${body}`);
      res.writeHead(200);
      res.end('ok');
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

function getHtmlContent() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Chest Video Generator</title>
</head>
<body style="background:#000; color:#fff; font-family:sans-serif;">
<h1>Generating Cinematic Chest Videos for Methode A...</h1>
<canvas id="cv" width="480" height="420" style="background:#000; display:block; border:1px solid #333;"></canvas>
<div id="status">Starting...</div>

<script>
function log(msg) {
  document.getElementById('status').innerText = msg;
  fetch('/log', { method: 'POST', body: msg }).catch(() => {});
}

async function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function start() {
  log('Loading source images...');
  const imgs = {
    wooden_closed: await loadImg('/images/chest_wooden_closed.png'),
    silver_closed: await loadImg('/images/chest_silver_closed.png'),
    gold_closed: await loadImg('/images/chest_gold_closed.png'),
    gold_open: await loadImg('/images/chest_gold_open.png'),
  };
  log('Images loaded. Beginning render pipeline...');

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d', { alpha: false }); // pure RGB on black

  const tiers = [
    {
      tier: 'wooden',
      imgClosed: imgs.wooden_closed,
      imgOpen: imgs.wooden_closed, // synthesized open lid
      glowCol: 'rgba(245, 158, 11, ', // amber
      sparkCol: '#fbbf24',
      coreCol: '#fef08a'
    },
    {
      tier: 'silver',
      imgClosed: imgs.silver_closed,
      imgOpen: imgs.silver_closed, // synthesized open lid
      glowCol: 'rgba(56, 189, 248, ', // frost blue / sapphire
      sparkCol: '#38bdf8',
      coreCol: '#e0f2fe'
    },
    {
      tier: 'gold',
      imgClosed: imgs.gold_closed,
      imgOpen: imgs.gold_open, // genuine open 3d gold render
      glowCol: 'rgba(251, 191, 36, ', // 24k gold / celestial purple
      sparkCol: '#c084fc',
      coreCol: '#fef08a'
    }
  ];

  for (const t of tiers) {
    // 1. Idle Loop
    log('Rendering ' + t.tier + ' idle...');
    await renderAndRecord(cv, ctx, t, 'idle');
    // 2. Open Burst
    log('Rendering ' + t.tier + ' open burst...');
    await renderAndRecord(cv, ctx, t, 'open');
  }

  log('All renders complete!');
}

async function renderAndRecord(cv, ctx, tInfo, mode) {
  const durationSec = (mode === 'idle') ? 2.4 : 1.8;
  const fps = 30;
  const totalFrames = Math.round(durationSec * fps);

  // We record both WebM and MP4
  const formats = [
    { ext: 'mp4', mime: 'video/mp4;codecs=avc1' },
    { ext: 'webm', mime: 'video/webm;codecs=vp9' }
  ];

  for (const fmt of formats) {
    const filename = 'chest_' + tInfo.tier + '_' + mode + '.' + fmt.ext;
    log('Recording ' + filename + ' (' + fmt.mime + ')...');

    const stream = cv.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: fmt.mime,
      videoBitsPerSecond: 2500000
    });

    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.start(100);

    for (let f = 0; f < totalFrames; f++) {
      const timeSec = f / fps;
      const progress = f / totalFrames;

      drawFrame(ctx, cv.width, cv.height, tInfo, mode, timeSec, progress);
      await new Promise(r => setTimeout(r, 1000 / fps));
    }

    await new Promise(resolve => {
      recorder.onstop = resolve;
      recorder.stop();
    });

    const blob = new Blob(chunks, { type: fmt.mime });
    log('Uploading ' + filename + ' (' + blob.size + ' bytes)...');
    await fetch('/upload?filename=' + filename, { method: 'POST', body: blob });
  }
}

function drawFrame(ctx, width, height, tInfo, mode, timeSec, progress) {
  // Pure black background for screen blending:
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height * 0.58;

  if (mode === 'idle') {
    // Smooth breathing & hover
    const hoverY = Math.sin(progress * Math.PI * 2) * 8;
    const breathe = 1 + Math.sin(progress * Math.PI * 2) * 0.02;

    // Ambient floor glow on black
    const auraGrad = ctx.createRadialGradient(cx, cy + 50 + hoverY, 10, cx, cy + 50 + hoverY, 140);
    auraGrad.addColorStop(0, tInfo.glowCol + '0.35)');
    auraGrad.addColorStop(0.5, tInfo.glowCol + '0.12)');
    auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy + 50 + hoverY, 140, 0, Math.PI * 2);
    ctx.fill();

    // Floating particles (deterministic based on progress)
    for (let i = 0; i < 16; i++) {
      const pProg = (progress + (i / 16)) % 1;
      const px = cx + Math.sin(i * 37 + pProg * Math.PI * 2) * (70 + (i % 5) * 12);
      const py = cy + 60 - pProg * 130 + hoverY;
      const alpha = Math.sin(pProg * Math.PI) * 0.75;
      const size = 1.5 + (i % 3) * 1.2;

      ctx.fillStyle = tInfo.glowCol + alpha + ')';
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw chest image centered
    const img = tInfo.imgClosed;
    const aspect = img.width / img.height;
    const destW = 220 * breathe;
    const destH = (220 / aspect) * breathe;

    ctx.save();
    ctx.translate(cx, cy + hoverY);
    ctx.drawImage(img, -destW / 2, -destH / 2, destW, destH);
    ctx.restore();

    // Subtle lock pulsation
    const lockGlow = ctx.createRadialGradient(cx, cy + hoverY, 2, cx, cy + hoverY, 35);
    const lockAlpha = 0.2 + 0.15 * Math.sin(progress * Math.PI * 4);
    lockGlow.addColorStop(0, tInfo.glowCol + lockAlpha + ')');
    lockGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lockGlow;
    ctx.beginPath();
    ctx.arc(cx, cy + hoverY, 35, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // Mode === 'open'
    // Phase 1: 0.0s - 0.40s: Rumble & compression (anticipation)
    // Phase 2: 0.40s - 0.65s: Seal shatter & lid snap open!
    // Apex: 0.65s: Massive light explosion & vertical beam
    // Phase 3: 0.65s - 1.80s: Open chest resting with divine light pillar

    let shakeX = 0;
    let shakeY = 0;
    let scaleX = 1;
    let scaleY = 1;
    let yPos = cy;
    let isOpen = timeSec >= 0.55;

    if (timeSec < 0.45) {
      // Violent anticipation rumble
      const rumbleIntensity = (timeSec / 0.45) * 6;
      shakeX = (Math.sin(timeSec * 70) * rumbleIntensity);
      shakeY = (Math.cos(timeSec * 85) * rumbleIntensity * 0.5);
      scaleY = 1 - (timeSec / 0.45) * 0.08;
      scaleX = 1 + (timeSec / 0.45) * 0.05;
    } else if (timeSec < 0.65) {
      // Recoil & lid pop
      const popProg = (timeSec - 0.45) / 0.2;
      scaleY = 0.92 + popProg * 0.18; // spring up
      scaleX = 1.05 - popProg * 0.1;
      shakeY = -Math.sin(popProg * Math.PI) * 12; // upward pop
    } else {
      // Settled open
      scaleX = 1;
      scaleY = 1;
      shakeX = 0;
      shakeY = 0;
    }

    // Ambient energy rising
    const auraRadius = Math.min(220, 100 + timeSec * 70);
    const auraAlpha = Math.min(0.65, 0.2 + timeSec * 0.35);
    const auraGrad = ctx.createRadialGradient(cx, cy + 40, 10, cx, cy + 40, auraRadius);
    auraGrad.addColorStop(0, tInfo.glowCol + auraAlpha + ')');
    auraGrad.addColorStop(0.7, tInfo.glowCol + (auraAlpha * 0.3) + ')');
    auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy + 40, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw the chest
    ctx.save();
    ctx.translate(cx + shakeX, yPos + shakeY);
    ctx.scale(scaleX, scaleY);

    if (isOpen && tInfo.imgOpen && tInfo.tier === 'gold') {
      const img = tInfo.imgOpen;
      const aspect = img.width / img.height;
      const destW = 240;
      const destH = 240 / aspect;
      ctx.drawImage(img, -destW / 2, -destH / 2 - 10, destW, destH);
    } else {
      const img = tInfo.imgClosed;
      const aspect = img.width / img.height;
      const destW = 220;
      const destH = 220 / aspect;
      ctx.drawImage(img, -destW / 2, -destH / 2, destW, destH);

      // Synthesized lid open for wood/silver
      if (isOpen) {
        ctx.save();
        // Bright open interior glowing void
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(0, -10, 80, 28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glowing core inside
        const coreGrad = ctx.createRadialGradient(0, -10, 2, 0, -10, 45);
        coreGrad.addColorStop(0, tInfo.coreCol);
        coreGrad.addColorStop(0.5, tInfo.sparkCol);
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.ellipse(0, -10, 80, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();

    // Eruption & apex light flash (at 0.65s)
    if (timeSec >= 0.52) {
      const burstAge = timeSec - 0.52; // 0 at 0.52s, 0.13 at 0.65s

      // God rays / light beams shooting up
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rayAlpha = Math.max(0, Math.min(0.85, 1 - (burstAge - 0.15) * 0.9));
      for (let r = 0; r < 7; r++) {
        const angle = -Math.PI / 2 + (r - 3) * 0.18;
        const beamLen = 320;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 15);
        ctx.lineTo(cx + Math.cos(angle - 0.08) * beamLen, cy - 15 + Math.sin(angle - 0.08) * beamLen);
        ctx.lineTo(cx + Math.cos(angle + 0.08) * beamLen, cy - 15 + Math.sin(angle + 0.08) * beamLen);
        ctx.closePath();
        ctx.fillStyle = tInfo.glowCol + (rayAlpha * 0.35) + ')';
        ctx.fill();
      }

      // Scheitelpunkt Core Flash at ~0.65s
      const flashDist = Math.abs(timeSec - 0.65);
      if (flashDist < 0.25) {
        const flashIntensity = Math.max(0, 1 - (flashDist / 0.25));
        const flashGrad = ctx.createRadialGradient(cx, cy - 20, 5, cx, cy - 20, 160 * flashIntensity);
        flashGrad.addColorStop(0, '#ffffff');
        flashGrad.addColorStop(0.3, tInfo.coreCol);
        flashGrad.addColorStop(0.7, tInfo.glowCol + (flashIntensity * 0.8) + ')');
        flashGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(cx, cy - 20, 160 * flashIntensity, 0, Math.PI * 2);
        ctx.fill();

        // Expanding shockwave ring
        const ringRadius = (1 - flashDist / 0.25) * 120;
        ctx.strokeStyle = tInfo.glowCol + (flashIntensity * 0.9) + ')';
        ctx.lineWidth = 4 * flashIntensity;
        ctx.beginPath();
        ctx.ellipse(cx, cy, ringRadius * 1.4, ringRadius * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Spark particles bursting upwards
      for (let sp = 0; sp < 24; sp++) {
        const spAngle = -Math.PI * 0.85 + (sp / 23) * Math.PI * 0.7;
        const spSpeed = 80 + (sp % 7) * 25;
        const spDist = burstAge * spSpeed;
        const spX = cx + Math.cos(spAngle) * spDist;
        const spY = cy - 20 + Math.sin(spAngle) * spDist;
        const spAlpha = Math.max(0, 1 - (burstAge / 1.1));

        ctx.fillStyle = tInfo.glowCol + spAlpha + ')';
        ctx.beginPath();
        ctx.arc(spX, spY, 2 + (sp % 3), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}

window.onload = start;
</script>
</body>
</html>`;
}

server.listen(PORT, () => {
  console.log(`[GENERATOR] Server listening on http://localhost:${PORT}`);
  const edgePath = '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"';
  console.log(`[GENERATOR] Launching headless Edge renderer...`);
  edgeProcess = exec(`${edgePath} --headless --disable-gpu --autoplay-policy=no-user-gesture-required http://localhost:${PORT}`);

  edgeProcess.on('exit', (code) => {
    console.log(`[GENERATOR] Edge exited with code ${code}`);
  });
});
