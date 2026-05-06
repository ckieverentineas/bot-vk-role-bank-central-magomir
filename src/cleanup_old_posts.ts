import { chat_id } from ".";
import { Logger, Send_Message } from "./engine/core/helper";
import prisma from "./engine/events/module/prisma_client";

export async function CleanupOldPostStatistics() {
    try {
        // Рассчитываем дату 7 недель назад
        const sevenWeeksAgo = new Date(Date.now() - (7 * 7 * 24 * 60 * 60 * 1000)); // 7 недель в миллисекундах

        console.log(`🧹 Начинаю очистку данных старше ${sevenWeeksAgo.toLocaleDateString('ru-RU')}`);

        // 1. Проверяем, сколько данных подлежит удалению
        const countToDelete = await prisma.postStatistic.count({
            where: {
                date: { lt: sevenWeeksAgo }
            }
        });

        if (countToDelete === 0) {
            console.log('✅ Нет старых данных для очистки');
            return;
        }

        console.log(`📊 Найдено ${countToDelete} старых записей статистики для удаления`);

        // 2. ВАЖНО: Просто удаляем статистику, НЕ трогаем балансы!
        // Балансы уже были начислены пользователям, оставляем их как есть
        
        // 3. Удаляем только старые записи статистики
        console.log('🗑️ Удаляю старые записи статистики...');
        const deletedCount = await prisma.postStatistic.deleteMany({
            where: {
                date: { lt: sevenWeeksAgo }
            }
        });

        // 4. Логируем результат
        const logMessage = `🧹 Очистка статистики: удалено ${deletedCount.count} записей (старше 7 недель)`;
        await Logger(logMessage);
        console.log(`✅ Очистка завершена: удалено ${deletedCount.count} записей статистики`);
        
        // 5. Отправляем в основной чат
        await Send_Message(chat_id, 
            `🧹 Автоматическая очистка древних записей по ролевым постам\n` +
            `🗑️ Удалено записей статистики: ${deletedCount.count}\n` +
            `📅 Старше: ${sevenWeeksAgo.toLocaleDateString('ru-RU')}\n` +
            `ℹ️ Балансы пользователей не изменены`
        );
        
        console.log('ℹ️ Балансы пользователей остались без изменений');
        
        // 6. (Опционально) Проверяем, не остались ли записи
        const remainingCount = await prisma.postStatistic.count({
            where: {
                date: { lt: sevenWeeksAgo }
            }
        });
        
        if (remainingCount > 0) {
            const warningMessage = `⚠ Осталось ${remainingCount} записей, которые не удалось удалить`;
            console.warn(warningMessage);
            await Send_Message(chat_id, warningMessage);
        }

    } catch (error) {
        const errorMessage = `❌ Ошибка при очистке старых данных: ${error}`;
        console.error(errorMessage);
        await Logger(errorMessage);
        await Send_Message(chat_id, errorMessage);
    }
}
