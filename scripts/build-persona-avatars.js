const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const brainDir = '/Users/joelguzman/.gemini/antigravity-ide/brain/912cdc52-e126-4eda-a424-78f362871043';
const outDir = '/Users/joelguzman/Vibe-Code/debate_master/public/personas';

const personas = [
  {
    id: 'consequentialist',
    source: path.join(brainDir, 'consequentialist_avatar_1788337055118.jpg'),
    themeColor: '#06b6d4',
    secondaryColor: '#3b82f6',
  },
  {
    id: 'logician',
    source: path.join(brainDir, 'logician_avatar_1788336788003.jpg'),
    themeColor: '#8b5cf6',
    secondaryColor: '#4338ca',
  },
  {
    id: 'contrarian',
    source: path.join(brainDir, 'contrarian_portrait_1788339450048.jpg'),
    themeColor: '#ef4444',
    secondaryColor: '#be185d',
  },
  {
    id: 'presuppositionalist',
    source: path.join(brainDir, 'presupp_avatar_1788339469843.jpg'),
    themeColor: '#d4a147',
    secondaryColor: '#78350f',
  },
  {
    id: 'traditionalist',
    source: path.join(brainDir, 'traditionalist_avatar_1788339353854.jpg'),
    themeColor: '#14b8a6',
    secondaryColor: '#0f766e',
  },
  {
    id: 'voluntaryist',
    source: path.join(brainDir, 'voluntaryist_portrait_1788339764909.jpg'),
    themeColor: '#f59e0b',
    secondaryColor: '#ea580c',
  },
];

async function createOverlay(type, color, secondary) {
  if (type === 'speaking') {
    return Buffer.from(`
      <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="speakGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="${secondary}" stop-opacity="0.1"/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle cx="256" cy="256" r="246" fill="none" stroke="${color}" stroke-width="8" opacity="0.85" filter="url(#glow)"/>
        <g transform="translate(370, 390)" filter="url(#glow)">
          <rect x="0" y="24" width="8" height="32" rx="4" fill="${color}" opacity="0.9"/>
          <rect x="14" y="8" width="8" height="48" rx="4" fill="${color}" opacity="0.95"/>
          <rect x="28" y="0" width="8" height="56" rx="4" fill="#ffffff" opacity="1"/>
          <rect x="42" y="12" width="8" height="44" rx="4" fill="${color}" opacity="0.95"/>
          <rect x="56" y="26" width="8" height="30" rx="4" fill="${color}" opacity="0.9"/>
        </g>
      </svg>
    `);
  } else if (type === 'thinking') {
    return Buffer.from(`
      <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="thinkGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="${secondary}" stop-opacity="0.2"/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect width="512" height="512" fill="url(#thinkGrad)" opacity="0.2"/>
        <circle cx="256" cy="256" r="248" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="16 12" opacity="0.7" filter="url(#glow)"/>
        <g transform="translate(390, 420)" filter="url(#glow)">
          <circle cx="0" cy="0" r="7" fill="${color}" opacity="0.8"/>
          <circle cx="20" cy="0" r="9" fill="${color}" opacity="0.9"/>
          <circle cx="44" cy="0" r="11" fill="#ffffff" opacity="1"/>
        </g>
      </svg>
    `);
  }
  return null;
}

async function processAll() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const p of personas) {
    console.log(`Processing ${p.id}...`);

    const baseBuffer = await sharp(p.source)
      .resize(512, 512, { fit: 'cover' })
      .png({ quality: 90, compressionLevel: 8 })
      .toBuffer();

    fs.writeFileSync(path.join(outDir, `${p.id}.png`), baseBuffer);

    const speakSvg = await createOverlay('speaking', p.themeColor, p.secondaryColor);
    const speakBuffer = await sharp(baseBuffer)
      .composite([{ input: speakSvg, blend: 'over' }])
      .png({ quality: 90, compressionLevel: 8 })
      .toBuffer();
    fs.writeFileSync(path.join(outDir, `${p.id}-speaking.png`), speakBuffer);

    const thinkSvg = await createOverlay('thinking', p.themeColor, p.secondaryColor);
    const thinkBuffer = await sharp(baseBuffer)
      .composite([{ input: thinkSvg, blend: 'over' }])
      .png({ quality: 90, compressionLevel: 8 })
      .toBuffer();
    fs.writeFileSync(path.join(outDir, `${p.id}-thinking.png`), thinkBuffer);

    console.log(`Saved ${p.id}.png, ${p.id}-speaking.png, ${p.id}-thinking.png`);
  }
  console.log('All personas generated successfully!');
}

processAll().catch(err => {
  console.error(err);
  process.exit(1);
});
