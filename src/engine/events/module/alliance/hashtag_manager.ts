import prisma from "../prisma_client";

export async function getHashtagRank(
    allianceId: number,
    hashtag: string,
    periodStart: Date | null,
    sortBy: string = 'pc',
    page: number = 0,
    perPage: number = 10
): Promise<{ stats: any[], totalCount: number }> {
    console.log(`\n📊 [DEBUG] getHashtagRank:`);
    console.log(`   allianceId: ${allianceId}, hashtag: #${hashtag}`);
    console.log(`   periodStart: ${periodStart}`);
    
    const whereClause: any = {
        hashtag: hashtag,
        allianceId: allianceId
    };
    
    if (periodStart) {
        whereClause.postStatistic = {
            date: { gte: periodStart }
        };
    }
    
    // Сначала проверяем, есть ли вообще записи с этим хештегом
    const totalHashtagRecords = await prisma.postHashtag.count({
        where: { hashtag: hashtag, allianceId: allianceId }
    });
    console.log(`   Всего записей с хештегом #${hashtag}: ${totalHashtagRecords}`);
    
    const stats = await prisma.postHashtag.groupBy({
        by: ['postStatisticId'],
        where: whereClause,
        _count: { postStatisticId: true }
    });
    
    console.log(`   Уникальных постов с хештегом: ${stats.length}`);
    
    const postStatisticIds = stats.map((s: { postStatisticId: any; }) => s.postStatisticId);
    
    if (postStatisticIds.length === 0) {
        console.log(`   ⚠ Нет постов с хештегом #${hashtag}`);
        return { stats: [], totalCount: 0 };
    }
    
    // Получаем агрегированную статистику по пользователям
    const userStats = await prisma.postStatistic.groupBy({
        by: ['userId'],
        where: {
            id: { in: postStatisticIds }
        },
        _count: { id: true },
        _sum: {
            characters: true,
            words: true,
            pc: true,
            mb: true
        }
    });
    
    console.log(`   Уникальных пользователей: ${userStats.length}`);
    
    // Получаем пользователей
    const users = await prisma.user.findMany({
        where: {
            id: { in: userStats.map(s => s.userId) },
            id_alliance: allianceId
        },
        select: { id: true, name: true, idvk: true }
    });
    
    const result = userStats.map(stat => {
        const user = users.find(u => u.id === stat.userId);
        return {
            userId: stat.userId,
            userIdvk: user?.idvk || 0,
            userName: user?.name || 'Неизвестный',
            postCount: stat._count.id,
            totalChars: stat._sum.characters || 0,
            totalWords: stat._sum.words || 0,
            totalPc: stat._sum.pc || 0,
            totalMb: stat._sum.mb || 0
        };
    });
    
    // Сортировка
    result.sort((a, b) => {
        switch(sortBy) {
            case 'posts': return b.postCount - a.postCount;
            case 'characters': return b.totalChars - a.totalChars;
            case 'words': return b.totalWords - a.totalWords;
            case 'pc': return b.totalPc - a.totalPc;
            case 'mb': return b.totalMb - a.totalMb;
            default: return b.totalPc - a.totalPc;
        }
    });
    
    const totalCount = result.length;
    const start = page * perPage;
    const paginatedResult = result.slice(start, start + perPage);
    
    console.log(`   Итоговый результат: ${totalCount} пользователей`);
    if (paginatedResult.length > 0) {
        console.log(`   Пример: ${paginatedResult[0].userName} - ${paginatedResult[0].totalPc} ПК`);
    }
    
    return { stats: paginatedResult, totalCount };
}

// Получение всех хештегов монитора
export async function getMonitorHashtags(monitorId: number): Promise<string[]> {
    const hashtags = await prisma.monitorHashtag.findMany({
        where: { monitorId },
        select: { hashtag: true }
    });
    return hashtags.map((h: { hashtag: any; }) => h.hashtag);
}

// Добавление хештега к монитору
export async function addMonitorHashtag(monitorId: number, hashtag: string): Promise<boolean> {
    try {
        // Очищаем хештег: убираем #, приводим к нижнему регистру
        const cleanHashtag = hashtag.replace(/^#/, '').toLowerCase();
        
        // Проверяем, существует ли уже
        const existing = await prisma.monitorHashtag.findFirst({
            where: { monitorId, hashtag: cleanHashtag }
        });
        
        if (existing) {
            return false;
        }
        
        await prisma.monitorHashtag.create({
            data: {
                monitorId,
                hashtag: cleanHashtag
            }
        });
        
        return true;
    } catch (error) {
        console.error('Error adding monitor hashtag:', error);
        return false;
    }
}

export function extractHashtags(text: string): string[] {
    if (!text) return [];
    const hashtagRegex = /#([\wа-яё]+)/gi;
    const matches = text.match(hashtagRegex);
    if (!matches) return [];
    
    // Убираем #, приводим к нижнему регистру
    return matches.map(tag => tag.slice(1).toLowerCase());
}

// Удаление хештега монитора
export async function removeMonitorHashtag(monitorId: number, hashtag: string): Promise<boolean> {
    try {
        await prisma.monitorHashtag.deleteMany({
            where: { monitorId, hashtag }
        });
        return true;
    } catch (error) {
        console.error('Error removing monitor hashtag:', error);
        return false;
    }
}