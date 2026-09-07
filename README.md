# Калькулятор (PWA → APK)

[![Android APK](https://github.com/Gypopo118/calculator1/actions/workflows/android-apk.yml/badge.svg)](https://github.com/Gypopo118/calculator1/actions/workflows/android-apk.yml)

Быстрый калькулятор: PWA с историей вычислений, редактируемым вводом и адаптивным экраном.

## Где взять APK

- **Вручную из сборки:** вкладка Actions → последний зелёный прогон → Artifacts → `calculator-debug-apk`.
- **Из релиза:** раздел Releases — APK прикрепляется автоматически к каждому тегу вида `v*` (например `v1.0.0`).

## Как это собирается (код приложения не меняется)

PWA-файлы (`index.html`, `app.js`, `style.css`, `manifest.json`, `service-worker.js`, `icons/`, `assets/`)
упаковываются в нативную Android-оболочку через [Capacitor](https://capacitorjs.com/):

1. `npm run build:www` — скрипт `scripts/build-www.js` копирует PWA по белому списку в `www/`.
2. `npx cap add android` + `npx cap sync android` — создаются Android-проект и ассеты.
3. `./gradlew assembleDebug` — собирается `app-debug.apk`.

Всё это делает workflow `.github/workflows/android-apk.yml` на каждый пуш в `main`.
Папки `www/`, `android/`, `node_modules/` генерируются в CI и в репозиторий не коммитятся.

## Локальный запуск (как сайт)

Откройте `index.html` в браузере — сборке APK это не мешает.
