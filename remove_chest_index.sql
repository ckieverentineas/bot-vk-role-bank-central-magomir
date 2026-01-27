-- Удаляем индекс, который создает ограничение уникальности на id_chest
DROP INDEX IF EXISTS CategoryChest_id_chest_key;

-- Проверяем результат
SELECT name, sql FROM sqlite_master 
WHERE type='index' AND tbl_name='CategoryChest';