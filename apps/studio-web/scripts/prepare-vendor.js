const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const targetDir = path.join(appRoot, 'public', 'vendor');
const copies = [
  { from: path.join(appRoot, 'node_modules', 'three', 'build', 'three.module.js'), to: 'three.module.js' },
  { from: path.join(appRoot, 'node_modules', 'three', 'build', 'three.core.js'), to: 'three.core.js' },
];

fs.mkdirSync(targetDir, { recursive: true });

for (const entry of copies) {
  const target = path.join(targetDir, entry.to);
  fs.copyFileSync(entry.from, target);
  console.log(`Copied ${entry.to} -> ${target}`);
}
