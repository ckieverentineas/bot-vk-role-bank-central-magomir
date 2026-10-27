import { chat_id } from ".";
import { Logger, Send_Message } from "./engine/core/helper";
import prisma from "./engine/events/module/prisma_client";

export async function CleanupOldPostStatistics() {
    try {
        // Рассчитываем дату 7 недель назад
        const sevenWeeksAgo = new Date(Date.now() - (7 * 7 * 24 * 60 * 60 * 1000)); // 7 недель в миллисекундах

        console.log(`🧹 Начинаю очистку данных старше ${sevenWeeksAgo.toLocaleDateString('ru-RU')}`);

        // Данные внутри сохранённых планов и настроенного ролевого года нужны для прогнозов.
        // Не удаляем их даже после семи недель; всё остальное продолжает очищаться как раньше.
        const protectedRanges = await Get_Protected_Post_Ranges();
        const deleteWhere: any = { date: { lt: sevenWeeksAgo } };
        if (protectedRanges.length > 0) {
            deleteWhere.NOT = { OR: protectedRanges };
        }

        // 1. Проверяем, сколько данных подлежит удалению с учётом защищённых периодов.
        const countToDelete = await prisma.postStatistic.count({ where: deleteWhere });

        if (countToDelete === 0) {
            console.log('✅ Нет старых данных для очистки');
            return;
        }

        console.log(`📊 Найдено ${countToDelete} старых записей статистики для удаления`);

        // 2. ВАЖНО: Просто удаляем статистику, НЕ трогаем балансы!
        // Балансы уже были начислены пользователям, оставляем их как есть
        
        // 3. Удаляем только старые записи статистики
        console.log('🗑️ Удаляю старые записи статистики...');
        const deletedCount = await prisma.postStatistic.deleteMany({ where: deleteWhere });

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
        const remainingCount = await prisma.postStatistic.count({ where: deleteWhere });
        
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




/** Returns PostStatistic filters that must be preserved for saved goals and work-year estimates. */
async function Get_Protected_Post_Ranges(): Promise<any[]> {
    const prismaAny = prisma as any;
    const ranges: any[] = [];

    try {
        const goals = await prismaAny.rpWritingGoal.findMany({
            select: { userId: true, startDate: true, endDate: true }
        });
        for (const goal of goals) {
            if (!goal.startDate || !goal.endDate) continue;
            ranges.push({
                userId: goal.userId,
                date: { gte: goal.startDate, lt: Next_Day_UTC(goal.endDate) }
            });
        }

        const settings = await prismaAny.rpWorkSettings.findMany({
            where: { workYearStart: { not: null }, workYearEnd: { not: null } },
            select: { userId: true, workYearStart: true, workYearEnd: true }
        });
        for (const setting of settings) {
            if (!setting.workYearStart || !setting.workYearEnd) continue;
            ranges.push({
                userId: setting.userId,
                date: { gte: setting.workYearStart, lt: Next_Day_UTC(setting.workYearEnd) }
            });
        }
    } catch (error) {
        // Если миграция ещё не применена, не удаляем данные наугад.
        console.error('Не удалось прочитать защищённые периоды статистики; пропускаю очистку:', error);
        throw error;
    }

    return ranges;
}

function Next_Day_UTC(date: Date): Date {
    const next = new Date(date);
    next.setUTCHours(0, 0, 0, 0);
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
}
