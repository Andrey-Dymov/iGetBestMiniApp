# iGetBestMiniApp

---

## English

### Description

iGetBestMiniApp is a Telegram Mini App for making informed decisions. Users create comparisons, add variants (what they compare) and parameters (criteria with importance 1–10). The app builds a variant×parameter matrix, calculates weighted scores and ranks variants. Suitable for choosing products, services, vacation spots, employees and more. Data is stored in Telegram Cloud Storage. Supports import/export in JSON and short format, with ready-made examples in Russian, English and Chinese. The interface adapts to the Telegram theme.

Reference: iGetBest (Swift/SwiftUI).

### Tech Stack

- Vue 3 + TypeScript + Vite
- Naive UI, Vue Router, Pinia, vue-i18n
- @tma.js/sdk, @vicons/ionicons5

### Features

- List of comparisons with variants, parameters and scores
- Add and edit variants and parameters
- Import/export (JSON, short format)
- Examples (submenu): TV, Phone, Resort, Employee, Image, Café, Groom, Smartphone, 咖啡馆
- Localization: RU, EN, 中文

### Development

```bash
npm install
npm run dev
```

Open http://localhost:5173/iGetBestMiniApp/

### Build & Deploy

```bash
npm run build
npm run deploy   # build + push to gh-pages
```

Detailed setup for running in Telegram: **[TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)**

### Project Structure

- `src/views/` — pages (ComparisonList, ComparisonResults)
- `src/stores/` — Pinia store (comparisons)
- `src/data/` — samples
- `src/utils/` — import/export, score calculation
- `src/composables/` — useStorage, useTelegramTheme
- `src/i18n/` — localization (RU, EN, ZH)
- `src/types/` — data types

---

## Русский

### Описание системы

iGetBestMiniApp — Telegram Mini App для принятия обоснованных решений. Пользователь создаёт сравнение, добавляет варианты (то, что сравнивает) и параметры (критерии с важностью 1–10). Приложение строит матрицу вариант×параметр, рассчитывает взвешенные баллы и ранжирует варианты. Подходит для выбора товаров, услуг, мест отдыха, сотрудников и многого другого. Данные хранятся в Telegram Cloud Storage. Поддерживаются импорт и экспорт в JSON и кратком формате, готовые примеры на русском, английском и китайском. Интерфейс адаптирован под тему Telegram.

Референс: iGetBest (Swift/SwiftUI).

### Стек

- Vue 3 + TypeScript + Vite
- Naive UI, Vue Router, Pinia, vue-i18n
- @tma.js/sdk, @vicons/ionicons5

### Возможности

- Список сравнений с вариантами, параметрами, баллами
- Добавление и редактирование вариантов и параметров
- Импорт/экспорт (JSON, краткий формат)
- Примеры поштучно (подменю): Телевизор, Телефон, Курорт, Сотрудник, Образ, Кафе, Жених, Smartphone, 咖啡馆
- Локализация: RU, EN, 中文

### Разработка

```bash
npm install
npm run dev
```

Открыть http://localhost:5173/iGetBestMiniApp/

### Сборка и деплой

```bash
npm run build
npm run deploy   # build + push в gh-pages
```

Подробная инструкция по запуску в реальном Telegram: **[TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)**

### Структура

- `src/views/` — страницы (ComparisonList, ComparisonResults)
- `src/stores/` — Pinia store (comparisons)
- `src/data/` — примеры (samples)
- `src/utils/` — импорт/экспорт, расчёт баллов
- `src/composables/` — useStorage, useTelegramTheme
- `src/i18n/` — локализация (RU, EN, ZH)
- `src/types/` — типы данных
