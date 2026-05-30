const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function transformSvg(svgContent) {
  return svgContent.replace('</style>', '.st37{fill:none!important;}</style>');
}

function bake() {
  const svgPath = path.join(ROOT, 'aesthetic', 'render.svg');
  const outPath = path.join(ROOT, 'src', 'render-svg-uri.js');
  const svg     = fs.readFileSync(svgPath, 'utf8');
  const modified = transformSvg(svg);
  const b64     = Buffer.from(modified).toString('base64');
  const uri     = `data:image/svg+xml;base64,${b64}`;
  fs.writeFileSync(outPath, `window.RENDER_SVG_URI = ${JSON.stringify(uri)};\n`);
  console.log(`Baked render.svg → ${outPath} (${Math.round(uri.length / 1024)} KB)`);
}

if (require.main === module) bake();
module.exports = { transformSvg };
