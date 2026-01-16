import { KeyboardBuilder } from "vk-io";
import prisma from "./prisma_client";
import { Person_Get } from "./person/person";
import { Logger, Send_Message, Input_Text } from "../../core/helper";
import { getTerminology } from "./alliance/terminology_helper";
import { ico_list } from "./data_center/icons_lib";

type SortBy = 'posts' | 'characters' | 'words' | 'pc' | 'mb';
type PeriodType = 'week' | 'month' | 'all_time' | 'week_-1' | 'week_-2' | 'week_-3' | 'week_-4';
type ViewType = 'all' | 'monitor' | 'topic' | 'facult';

export async function Topic_Rank_V2_Enter(context: any) {
    const user = await Person_Get(context);
    if (!user) return;

    const alliance = await prisma.alliance.findFirst({ 
        where: { id: user.id_alliance ?? 0 } 
    });
    if (!alliance) return;

    // Получаем параметры из payload
    const period = (context.eventPayload?.period || 'week') as PeriodType;
    const sortBy = (context.eventPayload?.sortBy || 'pc') as SortBy;
    const viewType = (context.eventPayload?.viewType || 'all') as ViewType;
    const monitorId = context.eventPayload?.monitorId || null;
    const topicId = context.eventPayload?.topicId || null;
    const facultId = context.eventPayload?.facultId || null;
    const page = context.eventPayload?.page || 0;
    const perPage = 10;

    // Получаем данные
    const { stats, totalCount, filters, allUsers, allStats } = await getActivityStatsWithRanking(
        alliance.id, user.id, period, sortBy, viewType, monitorId, topicId, facultId, page, perPage
    );
    
    // Получаем терминологию
    const prepositional = await getTerminology(alliance.id, 'prepositional'); // факультете/фракции
    
    // Формируем заголовок
    let text = `${ico_list['statistics'].ico} Рейтинг активности за `;
    
    // Добавляем информацию о периоде
    const periodText = getPeriodText(period);
    text += `${periodText} `;
    
    // Добавляем информацию о сортировке
    const sortText = getSortText(sortBy);
    text += `(${sortText}) в ролевом проекте ${alliance.name}`;
    
    // Добавляем информацию о фильтрах
    if (filters.monitorName) {
        text += `\n📱 Монитор: ${filters.monitorName}`;
    }
    
    if (filters.topicName && filters.topicUrl) {
        // Добавляем ссылку на обсуждение
        text += `\n📖 Обсуждение: [${filters.topicUrl}|${filters.topicName}]`;
    } else if (filters.topicName) {
        text += `\n📖 Обсуждение: ${filters.topicName}`;
    }
    
    if (filters.facultName) {
        text += `, 🎓 ${prepositional}: ${filters.facultName}`;
    }
    
    text += `:\n\n`;
    
    // ИСПРАВЛЕНО: Показываем галочку для текущего пользователя всегда
    let counter_last = page * perPage + 1;
    let counter_limit = 0;
    
    for (const stat_sel of stats) {
        if (counter_limit < perPage) {
            const isMe = stat_sel.userIdvk === context.senderId;
            const score = getScoreBySortType(stat_sel, sortBy);
            const scoreText = getScoreText(score, sortBy);
            
            // ИСПРАВЛЕНО: Галочка для текущего пользователя
            text += `${isMe ? ico_list['success'].ico : ico_list['person'].ico} ${counter_last} - UID-${stat_sel.userId} @id${stat_sel.userIdvk}(${stat_sel.userName}) --> ${scoreText}\n`;
            
            counter_limit++;
        }
        counter_last++;
    }
    
    // Пагинация
    const totalPages = Math.ceil(totalCount / perPage);
    if (totalPages > 1) {
        text += `\n📄 Страница ${page + 1} из ${totalPages}`;
    }
    
    text += `\n\n${ico_list['help'].ico} В статистике участвует ${allUsers.length} персонажей`;
    
    const keyboard = buildRankKeyboardV2(
        period, sortBy, viewType, monitorId, topicId, facultId,
        page, totalPages,
        context.id
    );

    await Send_Message(context.peerId, text, keyboard);
    await Logger(`Просмотр рейтинга активности пользователем ${user.idvk}`);
}

function buildRankKeyboardV2(
    period: PeriodType,
    sortBy: SortBy,
    viewType: ViewType,
    monitorId: number | null,
    topicId: number | null,
    facultId: number | null,
    page: number,
    totalPages: number,
    messageId?: number
): KeyboardBuilder {
    const keyboard = new KeyboardBuilder();

    // === СТРОКА 1: ПЕРИОДЫ ===
    // Нед Мес Все Недели
    keyboard.callbackButton({
        label: period === 'week' ? '📅 Нед ✅' : '📅 Нед',
        payload: {
            command: 'topic_rank_v2',
            period: 'week',
            sortBy, viewType, monitorId, topicId, facultId, page: 0
        },
        color: period === 'week' ? 'positive' : 'secondary'
    });

    keyboard.callbackButton({
        label: period === 'month' ? '📅 Мес ✅' : '📅 Мес',
        payload: {
            command: 'topic_rank_v2',
            period: 'month',
            sortBy, viewType, monitorId, topicId, facultId, page: 0
        },
        color: period === 'month' ? 'positive' : 'secondary'
    });

    keyboard.callbackButton({
        label: period === 'all_time' ? '📅 Все ✅' : '📅 Все',
        payload: {
            command: 'topic_rank_v2',
            period: 'all_time',
            sortBy, viewType, monitorId, topicId, facultId, page: 0
        },
        color: period === 'all_time' ? 'positive' : 'secondary'
    });

    keyboard.callbackButton({
        label: '📆 Недели',
        payload: {
            command: 'topic_rank_v2_weeks',
            period, sortBy, viewType, monitorId, topicId, facultId, page
        },
        color: 'secondary'
    }).row();

    // === СТРОКА 2: ОСНОВНЫЕ ФИЛЬТРЫ ===
    // Все Мониторы Обсуждения Фильтр
    const hasAnyFilter = monitorId || topicId || facultId;
    
    keyboard.callbackButton({
        label: !hasAnyFilter ? '👁️ Все ✅' : '👁️ Все',
        payload: {
            command: 'topic_rank_v2',
            period, sortBy, viewType: 'all',
            monitorId: null, topicId: null, facultId: null, page: 0
        },
        color: !hasAnyFilter ? 'positive' : 'secondary'
    });

    keyboard.callbackButton({
        label: monitorId ? '📱 Мониторы ✅' : '📱 Мониторы',
        payload: {
            command: 'topic_rank_v2_select_monitor',
            period, sortBy, viewType, monitorId, topicId, facultId, page
        },
        color: monitorId ? 'positive' : 'secondary'
    });

    keyboard.callbackButton({
        label: topicId ? '📖 Обсуждения ✅' : '📖 Обсуждения',
        payload: {
            command: 'topic_rank_v2_search_topic',
            period, sortBy, viewType, monitorId, topicId, facultId, page
        },
        color: topicId ? 'positive' : 'secondary'
    });

    keyboard.callbackButton({
        label: facultId ? '🎓 Фильтр ✅' : '🎓 Фильтр',
        payload: {
            command: 'topic_rank_v2_select_facult',
            period, sortBy, viewType, monitorId, topicId, facultId, page
        },
        color: facultId ? 'positive' : 'secondary'
    }).row();

    // === СТРОКА 3: СОРТИРОВКА (первая часть) ===
    // Постов Символы Слова
    keyboard.callbackButton({
        label: sortBy === 'posts' ? '📝 ✅' : '📝',
        payload: {
            command: 'topic_rank_v2',
            period, sortBy: 'posts', viewType, monitorId, topicId, facultId, page: 0
        },
        color: sortBy === 'posts' ? 'positive' : 'secondary'
    });

    keyboard.callbackButton({
        label: sortBy === 'characters' ? '🔤 ✅' : '🔤',
        payload: {
            command: 'topic_rank_v2',
            period, sortBy: 'characters', viewType, monitorId, topicId, facultId, page: 0
        },
        color: sortBy === 'characters' ? 'positive' : 'secondary'
    });

    keyboard.callbackButton({
        label: sortBy === 'words' ? '📖 ✅' : '📖',
        payload: {
            command: 'topic_rank_v2',
            period, sortBy: 'words', viewType, monitorId, topicId, facultId, page: 0
        },
        color: sortBy === 'words' ? 'positive' : 'secondary'
    }).row();

    // === СТРОКА 4: СОРТИРОВКА (вторая часть) ===
    // ПК МБ
    keyboard.callbackButton({
        label: sortBy === 'pc' ? '💻 ✅' : '💻',
        payload: {
            command: 'topic_rank_v2',
            period, sortBy: 'pc', viewType, monitorId, topicId, facultId, page: 0
        },
        color: sortBy === 'pc' ? 'positive' : 'secondary'
    });

    keyboard.callbackButton({
        label: sortBy === 'mb' ? '📱 ✅' : '📱',
        payload: {
            command: 'topic_rank_v2',
            period, sortBy: 'mb', viewType, monitorId, topicId, facultId, page: 0
        },
        color: sortBy === 'mb' ? 'positive' : 'secondary'
    }).row();

    // === СТРОКА 5: ПАГИНАЦИЯ (только если есть страницы) ===
    if (totalPages > 1) {
        if (page > 0) {
            keyboard.callbackButton({
                label: '◀️ Назад',
                payload: {
                    command: 'topic_rank_v2',
                    period, sortBy, viewType, monitorId, topicId, facultId, page: page - 1
                },
                color: 'secondary'
            });
        }

        if (page < totalPages - 1) {
            keyboard.callbackButton({
                label: 'Вперед ▶️',
                payload: {
                    command: 'topic_rank_v2',
                    period, sortBy, viewType, monitorId, topicId, facultId, page: page + 1
                },
                color: 'secondary'
            });
        }
        
        keyboard.row();
    }

    // === СТРОКА 6: УПРАВЛЕНИЕ ===
    // Сброс Выход
    keyboard.callbackButton({
        label: '🔄 Сброс',
        payload: {
            command: 'topic_rank_v2',
            period: 'week',
            sortBy: 'pc',
            viewType: 'all',
            monitorId: null,
            topicId: null,
            facultId: null,
            page: 0
        },
        color: 'negative'
    });

    keyboard.callbackButton({
        label: '🚫 Выход',
        payload: { 
            command: 'systemok_call',
            messageId: messageId
        },
        color: 'secondary'
    })

    return keyboard;
}

// Функция для форматирования диапазона дат в формате "дд.мм-дд.мм"
function formatDateRange(startDate: Date, endDate: Date): string {
    const formatDate = (date: Date): string => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}.${month}`;
    };
    
    return `${formatDate(startDate)}-${formatDate(endDate)}`;
}

// Функция для получения диапазона дат в формате "дд.мм-дд.мм"
function getDateRangeText(period: PeriodType): string {
    const now = new Date();
    
    switch(period) {
        case 'week': {
            const monday = getMondayOfWeek(now);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            return formatDateRange(monday, sunday);
        }
        case 'month': {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return formatDateRange(firstDay, lastDay);
        }
        case 'week_-1': {
            const lastWeek = new Date(now);
            lastWeek.setDate(lastWeek.getDate() - 7);
            const monday = getMondayOfWeek(lastWeek);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            return formatDateRange(monday, sunday);
        }
        case 'week_-2': {
            const twoWeeksAgo = new Date(now);
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            const monday = getMondayOfWeek(twoWeeksAgo);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            return formatDateRange(monday, sunday);
        }
        case 'week_-3': {
            const threeWeeksAgo = new Date(now);
            threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
            const monday = getMondayOfWeek(threeWeeksAgo);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            return formatDateRange(monday, sunday);
        }
        case 'week_-4': {
            const fourWeeksAgo = new Date(now);
            fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
            const monday = getMondayOfWeek(fourWeeksAgo);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            return formatDateRange(monday, sunday);
        }
        case 'all_time':
        default:
            return "";
    }
}

async function getActivityStatsWithRanking(
    allianceId: number,
    currentUserId: number,
    period: PeriodType,
    sortBy: SortBy,
    viewType: ViewType,
    monitorId: number | null,
    topicId: number | null,
    facultId: number | null,
    page: number,
    perPage: number
) {
    // ИСПРАВЛЕНО: Правильное определение даты начала периода
    const periodStart = getPeriodStartDate(period);
    
    // Базовые условия WHERE
    const whereClause: any = {
        topicMonitor: {
            monitor: { id_alliance: allianceId }
        }
    };

    // ИСПРАВЛЕНО: Добавляем фильтр по дате только если periodStart не null
    if (periodStart) {
        whereClause.date = { gte: periodStart };
        
        // Также добавляем ограничение по максимальной дате (конец периода)
        const periodEnd = getPeriodEndDate(period);
        if (periodEnd) {
            whereClause.date.lte = periodEnd;
        }
    }

    // Фильтры по виду отображения
    if (viewType === 'monitor' && monitorId) {
        whereClause.topicMonitor.monitorId = monitorId;
    } else if (viewType === 'topic' && topicId) {
        whereClause.topicMonitorId = topicId;
    }

    // Если выбран конкретный монитор или топик
    if (monitorId) {
        whereClause.topicMonitor.monitorId = monitorId;
    }
    
    if (topicId) {
        whereClause.topicMonitorId = topicId;
    }

    // Получаем данные с группировкой
    const stats = await prisma.postStatistic.groupBy({
        by: ['userId'],
        where: whereClause,
        _count: { id: true },
        _sum: { 
            characters: true,
            words: true,
            pc: true,
            mb: true
        }
    });

    // Получаем ВСЕХ пользователей альянса с фильтром по факультету
    const allUsersWhere: any = { 
        id_alliance: allianceId 
    };
    
    // Фильтр по факультету: если указан facultId
    if (facultId) {
        allUsersWhere.id_facult = facultId;
    }

    const allUsers = await prisma.user.findMany({
        where: allUsersWhere,
        select: { id: true, name: true, idvk: true, id_facult: true }
    });

    // Формируем результат для всех пользователей
    const allStats = allUsers.map(user => {
        const stat = stats.find(s => s.userId === user.id);
        
        return {
            userId: user.id,
            userIdvk: user.idvk,
            userName: user.name || 'Неизвестный',
            userFacultId: user.id_facult || null,
            postCount: stat?._count.id || 0,
            totalChars: stat?._sum.characters || 0,
            totalWords: stat?._sum.words || 0,
            totalPc: stat?._sum.pc || 0,
            totalMb: stat?._sum.mb || 0
        };
    });

    // Сортировка
    allStats.sort((a: any, b: any) => {
        switch(sortBy) {
            case 'posts': return b.postCount - a.postCount;
            case 'characters': return b.totalChars - a.totalChars;
            case 'words': return b.totalWords - a.totalWords;
            case 'pc': return b.totalPc - a.totalPc;
            case 'mb': return b.totalMb - a.totalMb;
            default: return b.totalChars - a.totalChars;
        }
    });

    // Получаем информацию о фильтрах
    const filters = {
        monitorName: monitorId ? (await prisma.monitor.findFirst({ where: { id: monitorId } }))?.name || null : null,
        topicName: null as string | null,
        topicUrl: null as string | null,
        facultName: null as string | null
    };

    // Определяем название и ссылку обсуждения
    if (topicId) {
        const topic = await prisma.topicMonitor.findFirst({ 
            where: { id: topicId },
            include: { monitor: true }
        });
        
        if (topic) {
            filters.topicName = topic.name;
            filters.topicUrl = `https://vk.com/topic${topic.monitor.idvk}_${topic.topicId}`;
        }
    }

    // Определяем название факультета для отображения
    if (facultId) {
        const facult = await prisma.allianceFacult.findFirst({ where: { id: facultId } });
        filters.facultName = facult?.name || null;
    }

    // Пагинация
    const totalCount = allStats.length;
    const start = page * perPage;
    const paginatedResult = allStats.slice(start, start + perPage);

    return { 
        stats: paginatedResult, 
        totalCount, 
        filters,
        allUsers,
        allStats
    };
}

// НОВАЯ ФУНКЦИЯ: Выбор факультета для фильтрации
export async function Topic_Rank_V2_Select_Facult(context: any) {
    const user = await Person_Get(context);
    if (!user) return;

    const alliance = await prisma.alliance.findFirst({ 
        where: { id: user.id_alliance ?? 0 } 
    });
    if (!alliance) return;

    // Получаем терминологию - ИСПРАВЛЕНО: используем accusative
    const accusative = await getTerminology(alliance.id, 'accusative'); // факультет/фракцию
    const pluralGenitive = await getTerminology(alliance.id, 'plural_genitive'); //факультетов/фракций

    // Получаем текущие параметры
    const period = (context.eventPayload?.period || 'week') as PeriodType;
    const sortBy = (context.eventPayload?.sortBy || 'pc') as SortBy;
    const viewType = (context.eventPayload?.viewType || 'all') as ViewType;
    const monitorId = context.eventPayload?.monitorId || null;
    const topicId = context.eventPayload?.topicId || null;
    const facultId = context.eventPayload?.facultId || null;
    const page = context.eventPayload?.page || 0;

    // Получаем все факультеты альянса
    const facults = await prisma.allianceFacult.findMany({
        where: { id_alliance: alliance.id },
        orderBy: { name: 'asc' }
    });

    if (facults.length === 0) {
        await context.send(`🎓 В проекте нет ${pluralGenitive}.`);
        return;
    }

    const keyboard = new KeyboardBuilder();
    let text = `🎓 Выберите ${accusative} для отображения статистики:\n\n`;
    
    // Отображаем все факультеты (максимум 8 для 4 строк)
    const facultsToShow = facults.slice(0, 8);
    
    for (let i = 0; i < facultsToShow.length; i += 2) {
        const facult1 = facultsToShow[i];
        let facult2 = null;
        
        if (i + 1 < facultsToShow.length) {
            facult2 = facultsToShow[i + 1];
        }
        
        keyboard.callbackButton({
            label: facultId === facult1.id ? `✅ ${facult1.smile} ${facult1.name.slice(0, 10)}` : `${facult1.smile} ${facult1.name.slice(0, 10)}`,
            payload: {
                command: 'topic_rank_v2',
                period, sortBy, viewType: 'all',
                monitorId, topicId, facultId: facult1.id, page: 0
            },
            color: facultId === facult1.id ? 'positive' : 'secondary'
        });

        if (facult2) {
            keyboard.callbackButton({
                label: facultId === facult2.id ? `✅ ${facult2.smile} ${facult2.name.slice(0, 10)}` : `${facult2.smile} ${facult2.name.slice(0, 10)}`,
                payload: {
                    command: 'topic_rank_v2',
                    period, sortBy, viewType: 'all',
                    monitorId, topicId, facultId: facult2.id, page: 0
                },
                color: facultId === facult2.id ? 'positive' : 'secondary'
            });
        }
        keyboard.row();
        
        text += `${i + 1}. ${facult1.smile} ${facult1.name}\n`;
        if (facult2) {
            text += `${i + 2}. ${facult2.smile} ${facult2.name}\n`;
        }
    }

    // Кнопка "Сбросить фильтр"
    keyboard.callbackButton({
        label: '❌ Сбросить фильтр',
        payload: {
            command: 'topic_rank_v2',
            period, sortBy, viewType: 'all',
            monitorId, topicId, facultId: null, page: 0
        },
        color: 'negative'
    }).row();

    // Кнопка возврата
    keyboard.callbackButton({
        label: '↩️ Назад',
        payload: {
            command: 'topic_rank_v2',
            period, sortBy, viewType, monitorId, topicId, facultId, page
        },
        color: 'secondary'
    }).inline().oneTime();

    await Send_Message(context.peerId, text, keyboard);
}

// ФУНКЦИЯ: Поиск обсуждений по названию
export async function Topic_Rank_V2_Search_Topic(context: any) {
    const user = await Person_Get(context);
    if (!user) return;

    const alliance = await prisma.alliance.findFirst({ 
        where: { id: user.id_alliance ?? 0 } 
    });
    if (!alliance) return;

    // Получаем текущие параметры
    const period = (context.eventPayload?.period || 'week') as PeriodType;
    const sortBy = (context.eventPayload?.sortBy || 'pc') as SortBy;
    const viewType = (context.eventPayload?.viewType || 'all') as ViewType;
    const monitorId = context.eventPayload?.monitorId || null;
    const topicId = context.eventPayload?.topicId || null;
    const facultId = context.eventPayload?.facultId || null;
    const page = context.eventPayload?.page || 0;

    // Отправляем сообщение с инструкцией и создаем сессию для ввода
    const sessionId = `topic_search_${Date.now()}_${user.id}`;
    
    // Сохраняем параметры в сессии
    const searchParams = {
        userId: user.id,
        allianceId: alliance.id,
        period,
        sortBy,
        viewType,
        monitorId,
        topicId,
        facultId,
        page,
        command: 'topic_rank_v2_search_topic_process' // Новая команда для обработки
    };

    // Здесь нужно сохранить searchParams в каком-то хранилище (например, в памяти)
    // Для простоты можно использовать глобальный объект
    (global as any).topicSearchSessions = (global as any).topicSearchSessions || {};
    (global as any).topicSearchSessions[sessionId] = searchParams;

    // Отправляем инструкцию
    const text = `🔍 Введите название обсуждения для поиска:\n\n` +
                `Примеры:\n` +
                `- "Основной сюжет"\n` +
                `- "Таверна"\n` +
                `- "Библиотека"\n\n` +
                `ℹ️ Просто отправьте текст сообщением в этот чат\n` +
                `❌ Или отправьте "отмена" для возврата`;
    
    await Send_Message(context.peerId, text);
    
    // Логируем
    await Logger(`Пользователь ${user.idvk} начал поиск обсуждений, сессия: ${sessionId}`);
}

// ФУНКЦИЯ: Обработка введенного поискового запроса
export async function Topic_Rank_V2_Search_Topic_Process(context: any): Promise<boolean> {
    const user = await Person_Get(context);
    if (!user) return false;

    // Проверяем активные сессии поиска
    const activeSessions = (global as any).topicSearchSessions || {};
    const sessionKey = Object.keys(activeSessions).find(key => 
        activeSessions[key]?.userId === user.id
    );
    
    if (!sessionKey) {
        return false; // Нет активной сессии
    }
    
    const searchParams = activeSessions[sessionKey];
    const searchQuery = context.text?.trim();
    
    // Удаляем сессию
    delete (global as any).topicSearchSessions[sessionKey];
    
    if (!searchQuery || searchQuery.toLowerCase() === 'отмена') {
        // Возвращаемся к рейтингу
        const payload = {
            command: 'topic_rank_v2',
            period: searchParams.period,
            sortBy: searchParams.sortBy,
            viewType: searchParams.viewType,
            monitorId: searchParams.monitorId,
            topicId: searchParams.topicId,
            facultId: searchParams.facultId,
            page: searchParams.page
        };
        context.eventPayload = payload;
        await Topic_Rank_V2_Enter(context);
        return true;
    }
    
    // Ищем обсуждения
    const allTopics = await prisma.topicMonitor.findMany({
        where: {
            monitor: { id_alliance: searchParams.allianceId }
        },
        orderBy: { name: 'asc' },
        include: {
            monitor: true // Добавляем монитор чтобы получить idvk
        }
    });
    
    const searchQueryLower = searchQuery.toLowerCase();
    const topics = allTopics
        .filter(topic => 
            topic.name.toLowerCase().includes(searchQueryLower)
        )
        .slice(0, 10);
    
    if (topics.length === 0) {
        await context.send(`📭 Обсуждений по запросу "${searchQuery}" не найдено.`);
        
        const payload = {
            command: 'topic_rank_v2',
            period: searchParams.period,
            sortBy: searchParams.sortBy,
            viewType: searchParams.viewType,
            monitorId: searchParams.monitorId,
            topicId: searchParams.topicId,
            facultId: searchParams.facultId,
            page: searchParams.page
        };
        context.eventPayload = payload;
        await Topic_Rank_V2_Enter(context);
        return true;
    }
    
    // Показываем найденные обсуждения
    let text = `🔍 Найдено обсуждений: ${topics.length}\n\n`;
    
    const keyboard = new KeyboardBuilder();
    
    for (let i = 0; i < topics.length; i += 2) {
        const topic1 = topics[i];
        let topic2 = null;
        
        if (i + 1 < topics.length) {
            topic2 = topics[i + 1];
        }
        
        // Формируем текст со ссылкой
        const topic1Link = `[https://vk.com/topic${topic1.monitor.idvk}_${topic1.topicId}|${topic1.name}]`;
        const topic2Link = topic2 ? `[https://vk.com/topic${topic2.monitor.idvk}_${topic2.topicId}|${topic2.name}]` : null;
        
        keyboard.callbackButton({
            label: searchParams.topicId === topic1.id ? `✅ ${topic1.name.slice(0, 15)}` : topic1.name.slice(0, 15),
            payload: {
                command: 'topic_rank_v2',
                period: searchParams.period,
                sortBy: searchParams.sortBy,
                viewType: 'all',
                monitorId: searchParams.monitorId,
                topicId: topic1.id,
                facultId: searchParams.facultId,
                page: 0
            },
            color: searchParams.topicId === topic1.id ? 'positive' : 'secondary'
        });

        if (topic2) {
            keyboard.callbackButton({
                label: searchParams.topicId === topic2.id ? `✅ ${topic2.name.slice(0, 15)}` : topic2.name.slice(0, 15),
                payload: {
                    command: 'topic_rank_v2',
                    period: searchParams.period,
                    sortBy: searchParams.sortBy,
                    viewType: 'all',
                    monitorId: searchParams.monitorId,
                    topicId: topic2.id,
                    facultId: searchParams.facultId,
                    page: 0
                },
                color: searchParams.topicId === topic2.id ? 'positive' : 'secondary'
            });
        }
        keyboard.row();
        
        // Добавляем текст со ссылкой
        text += `${i + 1}. ${topic1Link}\n`;
        if (topic2) {
            text += `${i + 2}. ${topic2Link}\n`;
        }
    }

    keyboard.callbackButton({
        label: '❌ Сбросить фильтр',
        payload: {
            command: 'topic_rank_v2',
            period: searchParams.period,
            sortBy: searchParams.sortBy,
            viewType: 'all',
            monitorId: searchParams.monitorId,
            topicId: null,
            facultId: searchParams.facultId,
            page: 0
        },
        color: 'negative'
    }).row();

    keyboard.callbackButton({
        label: '↩️ Назад к рейтингу',
        payload: { 
            command: 'topic_rank_v2',
            period: searchParams.period,
            sortBy: searchParams.sortBy,
            viewType: searchParams.viewType,
            monitorId: searchParams.monitorId,
            topicId: searchParams.topicId,
            facultId: searchParams.facultId,
            page: searchParams.page
        },
        color: 'secondary'
    }).inline().oneTime();

    await Send_Message(context.peerId, text, keyboard);
    return true;
}

// ФУНКЦИЯ: Выбор монитора
export async function Topic_Rank_V2_Select_Monitor(context: any) {
    const user = await Person_Get(context);
    if (!user) return;

    const alliance = await prisma.alliance.findFirst({ 
        where: { id: user.id_alliance ?? 0 } 
    });
    if (!alliance) return;

    // Получаем текущие параметры
    const period = (context.eventPayload?.period || 'week') as PeriodType;
    const sortBy = (context.eventPayload?.sortBy || 'pc') as SortBy;
    const viewType = (context.eventPayload?.viewType || 'all') as ViewType;
    const monitorId = context.eventPayload?.monitorId || null;
    const topicId = context.eventPayload?.topicId || null;
    const facultId = context.eventPayload?.facultId || null;
    const page = context.eventPayload?.page || 0;

    // Получаем все мониторы альянса
    const monitors = await prisma.monitor.findMany({
        where: { id_alliance: alliance.id },
        orderBy: { name: 'asc' }
    });

    if (monitors.length === 0) {
        await context.send(`📭 В проекте нет мониторов.`);
        return;
    }

    const keyboard = new KeyboardBuilder();
    let text = `📱 Выберите монитор для отображения статистики:\n\n`;
    
    // Отображаем все мониторы (максимум 8 для 4 строк)
    const monitorsToShow = monitors.slice(0, 8);
    
    for (let i = 0; i < monitorsToShow.length; i += 2) {
        const monitor1 = monitorsToShow[i];
        let monitor2 = null;
        
        if (i + 1 < monitorsToShow.length) {
            monitor2 = monitorsToShow[i + 1];
        }
        
        keyboard.callbackButton({
            label: monitorId === monitor1.id ? `✅ ${monitor1.name.slice(0, 12)}` : monitor1.name.slice(0, 12),
            payload: {
                command: 'topic_rank_v2',
                period, sortBy, viewType: 'all',
                monitorId: monitor1.id, topicId, facultId, page: 0
            },
            color: monitorId === monitor1.id ? 'positive' : 'secondary'
        });

        if (monitor2) {
            keyboard.callbackButton({
                label: monitorId === monitor2.id ? `✅ ${monitor2.name.slice(0, 12)}` : monitor2.name.slice(0, 12),
                payload: {
                    command: 'topic_rank_v2',
                    period, sortBy, viewType: 'all',
                    monitorId: monitor2.id, topicId, facultId, page: 0
                },
                color: monitorId === monitor2.id ? 'positive' : 'secondary'
            });
        }
        keyboard.row();
        
        text += `${i + 1}. ${monitor1.name}\n`;
        if (monitor2) {
            text += `${i + 2}. ${monitor2.name}\n`;
        }
    }

    // Кнопка "Сбросить фильтр"
    keyboard.callbackButton({
        label: '❌ Сбросить фильтр',
        payload: {
            command: 'topic_rank_v2',
            period, sortBy, viewType: 'all',
            monitorId: null, topicId, facultId, page: 0
        },
        color: 'negative'
    }).row();

    // Кнопка возврата
    keyboard.callbackButton({
        label: '↩️ Назад',
        payload: {
            command: 'topic_rank_v2',
            period, sortBy, viewType, monitorId, topicId, facultId, page
        },
        color: 'secondary'
    }).inline().oneTime();

    await Send_Message(context.peerId, text, keyboard);
}

// ФУНКЦИЯ: Выбор недель
export async function Topic_Rank_V2_Weeks(context: any) {
    const user = await Person_Get(context);
    if (!user) return;

    const alliance = await prisma.alliance.findFirst({ 
        where: { id: user.id_alliance ?? 0 } 
    });
    if (!alliance) return;

    const period = (context.eventPayload?.period || 'week') as PeriodType;
    const sortBy = (context.eventPayload?.sortBy || 'pc') as SortBy;
    const viewType = (context.eventPayload?.viewType || 'all') as ViewType;
    const monitorId = context.eventPayload?.monitorId || null;
    const topicId = context.eventPayload?.topicId || null;
    const facultId = context.eventPayload?.facultId || null;
    const page = context.eventPayload?.page || 0;

    const keyboard = new KeyboardBuilder();
    
    const prevWeeks = [
        { label: '-1 нед', period: 'week_-1' },
        { label: '-2 нед', period: 'week_-2' },
        { label: '-3 нед', period: 'week_-3' },
        { label: '-4 нед', period: 'week_-4' },
    ];

    // Формируем текст с датами
    let text = `📆 Выберите неделю для отображения рейтинга:\n\n`;
    
    // Две строки по 2 кнопки
    for (let i = 0; i < prevWeeks.length; i += 2) {
        const btn1 = prevWeeks[i];
        let btn2 = null;
        
        if (i + 1 < prevWeeks.length) {
            btn2 = prevWeeks[i + 1];
        }
        
        const btn1DateRange = getDateRangeText(btn1.period as PeriodType);
        const btn2DateRange = btn2 ? getDateRangeText(btn2.period as PeriodType) : '';
        
        // Добавляем в текст информацию о датах
        text += `• ${btn1.label} (${btn1DateRange})\n`;
        if (btn2) {
            text += `• ${btn2.label} (${btn2DateRange})\n`;
        }
        
        keyboard.callbackButton({
            label: period === btn1.period ? `${btn1.label} ✅` : btn1.label,
            payload: {
                command: 'topic_rank_v2',
                period: btn1.period,
                sortBy, viewType, monitorId, topicId, facultId, page: 0
            },
            color: period === btn1.period ? 'positive' : 'secondary'
        });

        if (btn2) {
            keyboard.callbackButton({
                label: period === btn2.period ? `${btn2.label} ✅` : btn2.label,
                payload: {
                    command: 'topic_rank_v2',
                    period: btn2.period,
                    sortBy, viewType, monitorId, topicId, facultId, page: 0
                },
                color: period === btn2.period ? 'positive' : 'secondary'
            });
        }
        keyboard.row();
    }

    // Добавляем информацию о текущей неделе
    const currentWeekRange = getDateRangeText('week');
    text += `\n📅 Текущая неделя: ${currentWeekRange}`;

    keyboard.callbackButton({
        label: '↩️ Назад',
        payload: {
            command: 'topic_rank_v2',
            period, sortBy, viewType, monitorId, topicId, facultId, page
        },
        color: 'secondary'
    }).inline().oneTime();

    await Send_Message(context.peerId, text, keyboard);
}

// ИСПРАВЛЕННАЯ функция определения даты начала периода
function getPeriodStartDate(period: PeriodType): Date | null {
    const now = new Date();
    
    switch(period) {
        case 'week':
            return getMondayOfWeek(now);
            
        case 'month':
            return new Date(now.getFullYear(), now.getMonth(), 1);
            
        case 'week_-1':
            const lastWeek = new Date(now);
            lastWeek.setDate(lastWeek.getDate() - 7);
            return getMondayOfWeek(lastWeek);
            
        case 'week_-2':
            const twoWeeksAgo = new Date(now);
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            return getMondayOfWeek(twoWeeksAgo);
            
        case 'week_-3':
            const threeWeeksAgo = new Date(now);
            threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
            return getMondayOfWeek(threeWeeksAgo);
            
        case 'week_-4':
            const fourWeeksAgo = new Date(now);
            fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
            return getMondayOfWeek(fourWeeksAgo);
            
        case 'all_time':
        default:
            return null; // Вся история
    }
}

// ФУНКЦИЯ: Определение даты конца периода
function getPeriodEndDate(period: PeriodType): Date | null {
    const now = new Date();
    
    switch(period) {
        case 'week':
            const monday = getMondayOfWeek(now);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            sunday.setHours(23, 59, 59, 999);
            return sunday;
            
        case 'month':
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            lastDayOfMonth.setHours(23, 59, 59, 999);
            return lastDayOfMonth;
            
        case 'week_-1':
            const lastWeekMonday = getMondayOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
            const lastWeekSunday = new Date(lastWeekMonday);
            lastWeekSunday.setDate(lastWeekSunday.getDate() + 6);
            lastWeekSunday.setHours(23, 59, 59, 999);
            return lastWeekSunday;
            
        case 'week_-2':
            const twoWeeksAgoMonday = getMondayOfWeek(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
            const twoWeeksAgoSunday = new Date(twoWeeksAgoMonday);
            twoWeeksAgoSunday.setDate(twoWeeksAgoSunday.getDate() + 6);
            twoWeeksAgoSunday.setHours(23, 59, 59, 999);
            return twoWeeksAgoSunday;
            
        case 'week_-3':
            const threeWeeksAgoMonday = getMondayOfWeek(new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000));
            const threeWeeksAgoSunday = new Date(threeWeeksAgoMonday);
            threeWeeksAgoSunday.setDate(threeWeeksAgoSunday.getDate() + 6);
            threeWeeksAgoSunday.setHours(23, 59, 59, 999);
            return threeWeeksAgoSunday;
            
        case 'week_-4':
            const fourWeeksAgoMonday = getMondayOfWeek(new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000));
            const fourWeeksAgoSunday = new Date(fourWeeksAgoMonday);
            fourWeeksAgoSunday.setDate(fourWeeksAgoSunday.getDate() + 6);
            fourWeeksAgoSunday.setHours(23, 59, 59, 999);
            return fourWeeksAgoSunday;
            
        case 'all_time':
        default:
            return null; // Вся история - без ограничения
    }
}

// Вспомогательная функция для получения понедельника недели
function getMondayOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // понедельник
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function getScoreBySortType(stat: any, sortBy: SortBy): number {
    switch(sortBy) {
        case 'posts': return stat.postCount;
        case 'characters': return stat.totalChars;
        case 'words': return stat.totalWords;
        case 'pc': return stat.totalPc;
        case 'mb': return stat.totalMb;
        default: return stat.totalChars;
    }
}

function getScoreText(score: number, sortBy: SortBy): string {
    switch(sortBy) {
        case 'posts': return `${score}📝`;
        case 'characters': return `${formatCompactNumber(score)}🔤`;
        case 'words': return `${formatCompactNumber(score)}📖`;
        case 'pc': return `${score.toFixed(2)}💻`;
        case 'mb': return `${score.toFixed(2)}📱`;
        default: return `${formatCompactNumber(score)}🔤`;
    }
}

function getPeriodText(period: PeriodType): string {
    const dateRange = getDateRangeText(period);
    
    switch(period) {
        case 'week': return dateRange ? `неделю (${dateRange})` : 'неделя';
        case 'month': return dateRange ? `месяц (${dateRange})` : 'месяц';
        case 'all_time': return 'всё время';
        case 'week_-1': return dateRange ? `нед -1 (${dateRange})` : 'нед -1';
        case 'week_-2': return dateRange ? `нед -2 (${dateRange})` : 'нед -2';
        case 'week_-3': return dateRange ? `нед -3 (${dateRange})` : 'нед -3';
        case 'week_-4': return dateRange ? `нед -4 (${dateRange})` : 'нед -4';
        default: return '';
    }
}

function getSortText(sortBy: SortBy): string {
    switch(sortBy) {
        case 'posts': return 'по постам';
        case 'characters': return 'по символам';
        case 'words': return 'по словам';
        case 'pc': return 'по ПК';
        case 'mb': return 'по МБ';
        default: return 'по символам';
    }
}

function formatCompactNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toString();
}