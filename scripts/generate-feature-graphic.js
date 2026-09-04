const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function createFeatureGraphic() {
  const width = 1024;
  const height = 500;
  const outPath = path.join(__dirname, '../public/brand/google-play-feature-graphic-1024x500.png');

  console.log('Generating 1024x500 Google Play Feature Graphic...');

  // 1. Process background hero image
  const heroPath = path.join(__dirname, '../public/images/debate-stage-hero.png');
  const bgBuffer = await sharp(heroPath)
    .resize(1024, 576, { fit: 'cover', position: 'center' })
    .extract({ left: 0, top: 38, width: 1024, height: 500 })
    .modulate({ brightness: 0.65, saturation: 0.9 })
    .toBuffer();

  // 2. Prepare the gold crest (resized to 160x144)
  const crestPath = path.join(__dirname, '../public/brand/debate-master-crest-dark.png');
  const crestResized = await sharp(crestPath)
    .resize(160, 144, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // 3. Create SVG overlay with lighting gradients, vignette, and typography
  const svgOverlay = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Atmospheric dark vignette -->
      <radialGradient id="vignette" cx="50%" cy="45%" r="65%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.25" />
        <stop offset="55%" stop-color="#050609" stop-opacity="0.75" />
        <stop offset="100%" stop-color="#030406" stop-opacity="0.95" />
      </radialGradient>

      <!-- Center warm crest aura -->
      <radialGradient id="crestGlow" cx="50%" cy="32%" r="28%">
        <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.35" />
        <stop offset="40%" stop-color="#B88D4C" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#B88D4C" stop-opacity="0.0" />
      </radialGradient>

      <!-- Gold gradient for title -->
      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" />
        <stop offset="35%" stop-color="#F7E7CE" />
        <stop offset="70%" stop-color="#E2B765" />
        <stop offset="100%" stop-color="#C59B4C" />
      </linearGradient>

      <!-- Subtle border frame -->
      <linearGradient id="frameGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#B88D4C" stop-opacity="0.1" />
        <stop offset="50%" stop-color="#D4AF37" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#B88D4C" stop-opacity="0.1" />
      </linearGradient>
    </defs>

    <!-- Dark atmospheric layer -->
    <rect width="${width}" height="${height}" fill="url(#vignette)" />

    <!-- Center golden ambient glow behind crest -->
    <rect width="${width}" height="${height}" fill="url(#crestGlow)" />

    <!-- Subtle framing lines -->
    <rect x="24" y="24" width="976" height="452" rx="16" fill="none" stroke="url(#frameGradient)" stroke-width="1.5" />

    <!-- Title: DEBATE MASTER -->
    <text
      x="512"
      y="285"
      text-anchor="middle"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cinzel', serif"
      font-size="46"
      font-weight="800"
      letter-spacing="6"
      fill="url(#goldGradient)"
      style="filter: drop-shadow(0 4px 12px rgba(0,0,0,0.9));"
    >
      DEBATE MASTER
    </text>

    <!-- Subtitle divider lines & star -->
    <line x1="280" y1="320" x2="430" y2="320" stroke="#B88D4C" stroke-width="1.5" stroke-opacity="0.6" />
    <circle cx="512" cy="320" r="3" fill="#D4AF37" />
    <line x1="594" y1="320" x2="744" y2="320" stroke="#B88D4C" stroke-width="1.5" stroke-opacity="0.6" />

    <!-- Tagline -->
    <text
      x="512"
      y="355"
      text-anchor="middle"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-size="16"
      font-weight="600"
      letter-spacing="4"
      fill="#D1D5DB"
      style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.8)); text-transform: uppercase;"
    >
      AI Rhetoric &amp; Intellectual Sparring
    </text>

    <!-- Feature highlights badges -->
    <g transform="translate(512, 415)">
      <!-- Badge background -->
      <rect x="-240" y="-18" width="480" height="36" rx="18" fill="#0E1118" fill-opacity="0.75" stroke="#B88D4C" stroke-opacity="0.3" stroke-width="1" />
      <text
        x="0"
        y="5"
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="12"
        font-weight="500"
        letter-spacing="2"
        fill="#E5E7EB"
      >
        STRUCTURED SPARRING  ·  AI JUDGE RUBRICS  ·  LEADERBOARDS
      </text>
    </g>
  </svg>
  `;

  // 4. Composite all layers together:
  // Base background (1024x500) + Crest image positioned at (x: 432, y: 70) + SVG overlay
  const finalImage = await sharp(bgBuffer)
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      },
      {
        input: crestResized,
        top: 60,
        left: Math.round((width - 160) / 2),
      },
    ])
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(outPath);

  console.log('Feature graphic saved successfully to:', outPath);
  console.log('Final metadata:', finalImage);
}

createFeatureGraphic().catch(err => {
  console.error('Error generating feature graphic:', err);
  process.exit(1);
});
