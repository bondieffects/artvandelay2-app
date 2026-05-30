const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transformSvg } = require('../scripts/bake-render-svg.js');

test('transformSvg: injects st37 override before closing style tag', () => {
  const input = '<style>.st37{fill:#98918f;}</style>';
  const result = transformSvg(input);
  assert.ok(result.includes('.st37{fill:none!important;}'), 'override not injected');
  assert.ok(result.includes('</style>'), 'closing tag was removed');
  assert.ok(
    result.indexOf('.st37{fill:none!important;}') < result.indexOf('</style>'),
    'override must appear before closing tag'
  );
});

test('transformSvg: leaves all other content intact', () => {
  const input = '<style>.st0{stroke-width:1px;}</style><path d="M0,0"/>';
  const result = transformSvg(input);
  assert.ok(result.includes('.st0{stroke-width:1px;}'));
  assert.ok(result.includes('<path d="M0,0"/>'));
});

test('transformSvg: output is encodable as UTF-8 base64', () => {
  const input = '<style>.st37{fill:#ff0000;}</style>';
  const result = transformSvg(input);
  assert.doesNotThrow(() => Buffer.from(result).toString('base64'));
});
