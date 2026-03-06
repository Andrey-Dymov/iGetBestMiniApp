# iGetBestMiniApp

Telegram Mini App для сравнения вариантов по критериям.

## Стек

- Vue 3 + TypeScript + Vite
- Naive UI, Vue Router, Pinia, vue-i18n
- @tma.js/sdk (Telegram Mini Apps)

## Разработка

```bash
npm install
npm run dev
```

Открыть http://localhost:5173/iGetBestMiniApp/

## Сборка и деплой

```bash
npm run build
npm run deploy   # build + push в gh-pages
```

## Структура

- `src/views/` — страницы (Welcome, ComparisonList)
- `src/components/` — компоненты
- `src/composables/` — логика (useTelegramTheme)
- `src/types/` — типы данных
- `src/i18n/` — локализация (RU, EN)
