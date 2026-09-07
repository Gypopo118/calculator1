// Готовит исходник launcher-иконки для @capacitor/assets.
// Единый источник правды — icons/icon512.png (та же иконка, что в manifest.json),
// поэтому иконка APK всегда совпадает с иконкой PWA. Дубликат файла в репозитории
// не храним: копия создаётся на время сборки и игнорируется гитом (.tmp-assets/).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'icons', 'icon512.png');
const OUT_DIR = path.join(ROOT, '.tmp-assets');
const OUT = path.join(OUT_DIR, 'icon.png');

if (!fs.existsSync(SRC)) {
  console.error('missing launcher icon source: icons/icon512.png');
  process.exit(1);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.copyFileSync(SRC, OUT);
console.log('launcher icon source prepared: .tmp-assets/icon.png');
