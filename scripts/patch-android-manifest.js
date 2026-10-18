// Дописывает в сгенерированный Capacitor-манифест разрешения, которых нет
// в шаблоне, но которые нужны приложению в WebView.
//
// Сейчас это android.permission.VIBRATE: без него WebView молча игнорирует
// navigator.vibrate() — короткий виброотклик на нажатия клавиш не работал бы
// в APK. Папка android/ в репозиторий не коммитится (создаётся в CI через
// `npx cap add android`), поэтому разрешение добавляет этот скрипт.
//
// Идемпотентен: повторный запуск ничего не дублирует.
const fs = require('fs');
const path = require('path');

const MANIFEST = path.join(
  __dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'
);

const PERMISSIONS = [
  // Короткий виброотклик на нажатия клавиш (Vibration API в WebView).
  'android.permission.VIBRATE',
];

if (!fs.existsSync(MANIFEST)) {
  console.error(`android manifest not found: ${MANIFEST}`);
  console.error('Run `npx cap add android` first.');
  process.exit(1);
}

let xml = fs.readFileSync(MANIFEST, 'utf8');

if (!xml.includes('</manifest>')) {
  console.error(`unexpected manifest (no </manifest>): ${MANIFEST}`);
  process.exit(1);
}

const missing = PERMISSIONS.filter((p) => !xml.includes(`android:name="${p}"`));

if (missing.length === 0) {
  console.log('android manifest: all permissions already present');
  process.exit(0);
}

const lines = missing.map((p) => `    <uses-permission android:name="${p}" />`).join('\n');
fs.writeFileSync(MANIFEST, xml.replace('</manifest>', `${lines}\n</manifest>`));
console.log(`android manifest: added ${missing.join(', ')}`);
