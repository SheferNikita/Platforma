-- Заполнение publishedAt для существующих опубликованных уроков
-- ЭТОТ СКРИПТ УЖЕ БЫЛ ВЫПОЛНЕН 25.02.2026 через Node.js
-- Сохранён для документации

-- 1. Уроки с существующим publishAt (запланированная публикация в прошлом)
UPDATE "Lesson"
SET "publishedAt" = "publishAt"
WHERE "isPublished" = true
  AND "publishAt" IS NOT NULL
  AND "publishAt" <= NOW()
  AND "publishedAt" IS NULL;

-- 2. Предобучение — даты извлечены из названий:
--    "Путь человека". Запись вебинара от 2 февраля 2026 г.  -> 2026-02-02 09:00 UTC (12:00 MSK)
--    "Семь уровней..." от 3 февраля 2026 г.                -> 2026-02-03 09:00 UTC
--    "Трезвость как радость..." от 4 февраля 2026 г.        -> 2026-02-04 09:00 UTC

-- 3. Вебинар с наркологом — fallback к createdAt

-- 4. Модуль 1: День N = 2026-02-08 + N дней, 09:00 UTC (12:00 MSK)
--    День 1 = 9 февраля, День 2 = 10 февраля, ...
--    Уроки с одинаковым номером дня получают одну дату

-- 5. Остальные опубликованные — fallback к createdAt
UPDATE "Lesson"
SET "publishedAt" = "createdAt"
WHERE "isPublished" = true
  AND "publishedAt" IS NULL;
