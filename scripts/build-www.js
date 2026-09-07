// Копирует файлы PWA из корня проекта в www/ — веб-ассеты для Capacitor.
// Белый список: только то, что нужно приложению в WebView.
// Всё сборочное (android/, node_modules/, .github/ и т.д.) не попадает в APK.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www');

const FILES = ['index.html', 'style.css', 'app.js', 'manifest.json', 'service-worker.js'];
const DIRS = ['icons', 'assets'];

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  // Пропускаем заготовки Android-иконок внутри icons/drawable-*: они нужны
  // только нативной оболочке, а не WebView. Сама оболочка создаётся штатно.
  const SKIP_PREFIX = 'drawable-';
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith(SKIP_PREFIX)) continue;
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else if (entry.isFile()) copyFile(src, dest);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const file of FILES) {
  const src = path.join(ROOT, file);
  if (!fs.existsSync(src)) {
    console.error(`missing required file: ${file}`);
    process.exit(1);
  }
  copyFile(src, path.join(OUT, file));
}

for (const dir of DIRS) {
  const src = path.join(ROOT, dir);
  if (!fs.existsSync(src)) {
    console.error(`missing required dir: ${dir}`);
    process.exit(1);
  }
  copyDir(src, path.join(OUT, dir));
}

console.log(`www/ assembled: ${FILES.length} files + dirs [${DIRS.join(', ')}]`);
