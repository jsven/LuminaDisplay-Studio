const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.join(__dirname, '..', 'public', 'generated');
const files = ['portable-monitor-16-inch.json', 'portable-monitor-07-inch.json'];

const packs = files.map((file) => {
  const fullPath = path.join(outputDir, file);
  const raw = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
  const payload = JSON.parse(raw);

  return {
    file,
    id: payload.product.id,
    label: payload.product.sizeLabel,
    sizeDirectory: payload.product.sizeDirectory,
    title: payload.summary.title,
    subtitle: payload.summary.subtitle,
  };
});

const manifest = {
  generatedAt: new Date().toISOString(),
  defaultPackId: 'portable-monitor-16-inch',
  packs,
};

fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Manifest written to ' + path.join(outputDir, 'manifest.json'));
