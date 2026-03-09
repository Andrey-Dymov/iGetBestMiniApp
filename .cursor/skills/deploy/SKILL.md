---
name: deploy
description: Сборка и публикация приложения на GitHub Pages. Use when the user says "деплой", "deploy", "опубликовать", "сделай деплой", or wants to build and publish the app.
---

# Деплой

## Быстрый старт

Выполни деплой командой:

```bash
npm run deploy
```

Скрипт делает: `npm run build` (vue-tsc + vite build) и `npx gh-pages -d dist`.

## Результат

- Сборка в `dist/`
- Публикация в ветку `gh-pages`
- URL: `https://andrey-dymov.github.io/iGetBestMiniApp/`

## Типичные проблемы

- **Ошибки TypeScript при build** — исправить типы, неиспользуемые переменные, optional chaining
- **404 на GitHub Pages** — репозиторий должен быть публичным; в Settings → Pages: branch `gh-pages`, folder `/ (root)`
- **404 на JS chunks в Telegram WebView** — использовать статические импорты в router вместо lazy load
