# Запуск iGetBestMiniApp в реальном Telegram

## Предварительные требования

- Node.js и npm
- Аккаунт Telegram
- Репозиторий на GitHub (уже есть: Andrey-Dymov/iGetBestMiniApp)
- **Репозиторий должен быть публичным** — GitHub Pages не работает с приватными репозиториями на бесплатном плане

---

## Шаг 1. Создать бота в Telegram

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду `/newbot`
3. Введите имя бота (например: **iGetBest**)
4. Введите username бота (должен заканчиваться на `bot`, например: **iGetBestCompareBot**)
5. Сохраните выданный **токен** — он понадобится только если будете добавлять серверную логику

---

## Шаг 2. Собрать и задеплоить приложение

В терминале в папке проекта:

```bash
npm install
npm run deploy
```

Скрипт `deploy` выполняет сборку и публикует приложение в ветку `gh-pages`. Через 1–2 минуты приложение будет доступно по адресу:

**https://andrey-dymov.github.io/iGetBestMiniApp/**

---

## Шаг 3. Привязать Mini App к боту

### Вариант А: Кнопка меню (рекомендуется)

1. В [@BotFather](https://t.me/BotFather) отправьте `/setmenubutton`
2. Выберите своего бота
3. Выберите **Configure menu button**
4. Введите URL: `https://andrey-dymov.github.io/iGetBestMiniApp/`
5. Введите текст кнопки (например: **Открыть приложение**)




Пользователи увидят кнопку слева от поля ввода в чате с ботом.

### Вариант Б: Прямая ссылка (Mini App Store)

1. В [@BotFather](https://t.me/BotFather) отправьте `/newapp`
2. Выберите бота
3. Укажите Direct Link (латиница, например: `compare`)
4. Заполните метаданные: иконка, название, описание
5. Укажите URL: `https://andrey-dymov.github.io/iGetBestMiniApp/`

Приложение будет доступно по ссылке `https://t.me/ваш_бот/compare`.

---

## Шаг 4. Открыть Mini App

1. Найдите своего бота в Telegram
2. Нажмите **Start** или откройте чат
3. Нажмите кнопку меню (слева от поля ввода) — откроется Mini App

Либо перейдите по прямой ссылке `https://t.me/ваш_бот/compare`, если настроили Вариант Б.

---

## Обновление приложения

После изменений в коде:

```bash
npm run deploy
```

Подождите 1–2 минуты и обновите Mini App в Telegram (закройте и откройте заново).

---

## Проверка без деплоя (локально)

- `npm run dev` — приложение на http://localhost:5173/iGetBestMiniApp/
- В обычном браузере работает с mock-данными (localStorage вместо Cloud Storage)
- Для проверки в реальном Telegram нужен деплой на GitHub Pages

---

## Возможные проблемы

| Проблема | Решение |
|----------|---------|
| 404 на GitHub Pages | Репозиторий должен быть **публичным**. Settings → Pages → Source: `gh-pages`, Folder: `/ (root)` |
| Белый экран | Проверьте, что URL в BotFather точно `https://andrey-dymov.github.io/iGetBestMiniApp/` (с завершающим `/`) |
| Данные не сохраняются | Cloud Storage работает только внутри Telegram; в браузере используется localStorage |
| Кнопка не появляется | Убедитесь, что `/setmenubutton` выполнен для нужного бота |
