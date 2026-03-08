# iGetBestMiniApp

## Описание системы

iGetBestMiniApp — Telegram Mini App для принятия обоснованных решений. Пользователь создаёт сравнение, добавляет варианты (то, что сравнивает) и параметры (критерии с важностью 1–10). Приложение строит матрицу вариант×параметр, рассчитывает взвешенные баллы и ранжирует варианты. Подходит для выбора товаров, услуг, мест отдыха, сотрудников и многого другого. Данные хранятся в Telegram Cloud Storage. Поддерживаются импорт и экспорт в JSON и кратком формате, готовые примеры на русском, английском и китайском. Интерфейс адаптирован под тему Telegram.

Референс: iGetBest (Swift/SwiftUI).

## Стек

- Vue 3 + TypeScript + Vite
- Naive UI, Vue Router, Pinia, vue-i18n
- @tma.js/sdk, @vicons/ionicons5

## Возможности

- Список сравнений с вариантами, параметрами, баллами
- Добавление и редактирование вариантов и параметров
- Импорт/экспорт (JSON, краткий формат)
- Примеры поштучно (подменю): Телевизор, Телефон, Курорт, Сотрудник, Образ, Кафе, Жених, Smartphone, 咖啡馆
- Локализация: RU, EN, 中文

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

Подробная инструкция по запуску в реальном Telegram: **[TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)**

## Структура

- `src/views/` — страницы (ComparisonList, ComparisonResults)
- `src/stores/` — Pinia store (comparisons)
- `src/data/` — примеры (samples)
- `src/utils/` — импорт/экспорт, расчёт баллов
- `src/composables/` — useStorage, useTelegramTheme
- `src/i18n/` — локализация (RU, EN, ZH)
- `src/types/` — типы данных
