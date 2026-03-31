const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(appRoot, 'node_modules', 'three', 'build');
const targetDir = path.join(appRoot, 'public', 'vendor');
const files = ['three.module.js', 'three.core.js'];

fs.mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const source = path.join(sourceDir, file);
  const target = path.join(targetDir, file);
  fs.copyFileSync(source, target);
  console.log(`Copied ${file} -> ${target}`);
}
