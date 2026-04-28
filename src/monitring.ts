import { CommentContext, Context, LikeContext, VK, WallPostContext } from "vk-io";
import prisma from "./engine/events/module/prisma_client";
import { Group_Id_Get, Logger, Send_Message } from "./engine/core/helper";
import { Date_Compare_Resetor } from "./engine/events/module/alliance/limiter";
import { chat_id, SECRET_KEY } from ".";
import * as CryptoJS from 'crypto-js';
import { Calc_Bonus_Activity, User_Bonus_Check } from "./engine/events/module/alliance/monitor";
import { handleTopicPost } from "./engine/events/module/alliance/alliance_topic_monitor";
import { MonitorStartupReportItem, buildMonitorStartupReportMessages } from "./engine/core/monitor_startup_report";

// Функция для расшифровки данных
function Decrypt_Data(encryptedData: string): string {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY ?? '');
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
        return decryptedData;
    } catch(e) {
        Logger(`Невозможно расшифровать ${e}`);
        return `zero`;
    }
}

const monitors: { [key: number]: { running: boolean; instance: VK } } = {};

export async function Monitoring() {
    const startupReports: MonitorStartupReportItem[] = [];
    const startupMonitors = await prisma.monitor.findMany({ where: { starting: true } });
    const allianceById = await getAllianceNameById(startupMonitors);

    for (const monitor of startupMonitors) {
        const allianceName = allianceById.get(monitor.id_alliance) ?? `Ролевая ${monitor.id_alliance}`;

        if (monitors[monitor.id]) {
            await Logger(`Монитор с ID ${monitor.id} уже запущен.`);
            startupReports.push(await buildAlreadyRunningMonitorReport(monitor, allianceName));
            continue;
        }

        startupReports.push(await startMonitor(monitor, allianceName));
    }

    for (const message of buildMonitorStartupReportMessages(startupReports)) {
        await Send_Message(chat_id, message);
    }
}

// Функция для запуска монитора
async function startMonitor(monitor: any, allianceName?: string): Promise<MonitorStartupReportItem> {
    try {
        const idvk = await Group_Id_Get(Decrypt_Data(monitor.token));
        const token = Decrypt_Data(monitor.token);

        const vks = new VK({
            token: token,
            apiLimit: 1,
            pollingGroupId: idvk,
        });

        // === ОБРАБОТКА СТЕНЫ ===
        const postEvents: string[] = [];
        vks.updates.on('wall_post_new', async (context: WallPostContext, next: any) => { 
            if (postEvents.includes(`${context.wall.createdUserId}_${context.wall.id}`)) {
                await Logger(`🔁 Событие добавления лайка уже обработано [${postEvents.length}]: ${context.wall.createdUserId}_${context.wall.id}`);
                return next();
            }
            
            postEvents.push(`${context.wall.createdUserId}_${context.wall.id}`);
            if (!monitor.wall_on) { return await next(); }
            if (Math.abs(context.wall.authorId ?? 0) == idvk) {
                await Calc_Bonus_Activity(
                    context.wall.signerId ?? context.wall.createdUserId ?? 0, 
                    '+', 
                    monitor.cost_post, 
                    'пост', 
                    `https://vk.com/club${Math.abs(context.wall.authorId!)}?w=wall${context.wall.authorId}_${context.wall.id}`,
                    monitor
                );
            }
            return await next();
        });

        // === ОБРАБОТКА ЛАЙКОВ ===
        const likedEvents: string[] = [];
        vks.updates.on('like_add', async (context: LikeContext, next: any) => {
            if (likedEvents.includes(`${context.likerId}_${context.objectId}`)) {
                await Logger(`🔁 Событие добавления лайка уже обработано [${likedEvents.length}]: ${context.likerId}_${context.objectId}`);
                return next();
            }
            likedEvents.push(`${context.likerId}_${context.objectId}`);
            
            if (Date.now() - new Date(context.createdAt).getTime() > 1 * 86400000) { return await next(); }
            if (!monitor.like_on) { return await next(); }
            
            const whitelist = ['post'];
            if (!whitelist.includes(context.objectType)) { return await next(); }
            
            const user = await User_Bonus_Check(context.likerId, monitor);
            if (!user) { return await next(); }
            
            let limiter = await prisma.limiter.findFirst({ where: { id_monitor: monitor.id, id_user: user.id } });
            if (!limiter) { limiter = await prisma.limiter.create({ data: { id_monitor: monitor.id, id_user: user.id } }); }
            limiter = await Date_Compare_Resetor(limiter);
            
            if (limiter.likes >= monitor.lim_like) { return await next(); }
            const limiter_up = await prisma.limiter.update({ where: { id: limiter.id }, data: { likes: { increment: 1 } } });
            if (!limiter_up) { return await next(); }
            
            await Calc_Bonus_Activity(
                context.likerId, 
                '+', 
                monitor.cost_like, 
                'лайк', 
                `https://vk.com/club${Math.abs(context.objectOwnerId)}?w=wall${context.objectOwnerId}_${context.objectId}`,
                monitor
            );
            return await next();
        });

        // === ОБРАБОТКА КОММЕНТАРИЕВ ===
        const commentEvents: string[] = [];
        vks.updates.on('wall_reply_new', async (context: CommentContext, next: any) => {
            const pattern_def = `${context.fromId}_${context.objectId}_${context.id}`;
            if (commentEvents.includes(`${pattern_def}`)) {
                await Logger(`🔁 Событие снятия лайка уже обработано ${commentEvents.length}: ${pattern_def}`);
                return next();
            }
            commentEvents.push(`${pattern_def}`);
            
            if (!monitor.comment_on) { return await next(); }
            if (context.text!.length < 20 || context.fromId! < 0) { return await next(); }
            
            const user = await User_Bonus_Check(context.fromId!, monitor);
            if (!user) { return await next(); }
            
            let limiter = await prisma.limiter.findFirst({ where: { id_monitor: monitor.id, id_user: user.id } });
            if (!limiter) { limiter = await prisma.limiter.create({ data: { id_monitor: monitor.id, id_user: user.id } }); }
            limiter = await Date_Compare_Resetor(limiter);
            
            if (limiter.comment >= monitor.lim_comment) { return await next(); }
            const limiter_up = await prisma.limiter.update({ where: { id: limiter.id }, data: { comment: { increment: 1 } } });
            if (!limiter_up) { return await next(); }
            
            await Calc_Bonus_Activity(
                context.fromId!, 
                '+', 
                monitor.cost_comment, 
                'комментарий', 
                `https://vk.com/wall${context.ownerId}_${context.objectId}?reply=${context.id}`,
                monitor
            );
            return await next();
        });

        // === ОБРАБОТКА ОБСУЖДЕНИЙ (ТОПИКОВ) ===
        const boardEvents: string[] = [];

        // Убираем логирование при инициализации
        console.log(`🎯 Монитор ${monitor.id}: запущен с отслеживанием обсуждений`);

        // ОБРАБОТЧИК КОММЕНТАРИЕВ - упрощенный
        vks.updates.on('comment', async (context: any, next: any) => {
            try {
                // Проверяем, что это комментарий в обсуждении
                const isBoardComment = context.subTypes?.includes('board_post') || 
                                    context.isBoardComment ||
                                    (context.subTypes && Array.isArray(context.subTypes) && 
                                    context.subTypes.some((s: string) => s.includes('board')));
                
                if (!isBoardComment) {
                    return next();
                }
                
                // Определяем действие
                let action: 'new' | 'edit' | 'delete' | 'restore' = 'new';
                if (context.subTypes?.includes('board_post_edit') || context.isEdit) {
                    action = 'edit';
                } else if (context.subTypes?.includes('board_post_delete') || context.isDelete) {
                    action = 'delete';
                } else if (context.subTypes?.includes('board_post_restore') || context.isRestore) {
                    action = 'restore';
                }
                
                // Определяем ID
                const postId = context.id;
                const topicId = context.objectId;
                const groupId = context.ownerId || idvk;
                
                // ОСОБАЯ ОБРАБОТКА ДЛЯ УДАЛЕНИЯ
                let fromId = context.fromId;
                if (action === 'delete' && !fromId) {
                    // Краткий поиск пользователя для удаления
                    const topicMonitor = await prisma.topicMonitor.findFirst({
                        where: { monitorId: monitor.id, topicId: topicId }
                    });
                    
                    if (topicMonitor) {
                        const postStat = await prisma.postStatistic.findFirst({
                            where: { topicMonitorId: topicMonitor.id, postId: postId }
                        });
                        
                        if (postStat) {
                            const user = await prisma.user.findFirst({
                                where: { id: postStat.userId }
                            });
                            
                            if (user) {
                                fromId = user.idvk;
                            }
                        }
                    }
                }
                
                const text = context.text || '';
                
                // Проверка обязательных полей
                if (!postId || !topicId) {
                    return next();
                }
                
                // Проверяем, что это наша группа
                const expectedGroupId = Math.abs(monitor.idvk);
                const actualGroupId = Math.abs(groupId);
                
                if (actualGroupId !== expectedGroupId) {
                    return next();
                }
                
                // Проверка дубликатов событий
                const eventKey = `${fromId}_${topicId}_${postId}_${action}_${Date.now()}`;
                const timestamp = Date.now();
                
                // Разные правила для разных действий:
                let isDuplicate = false;
                
                if (action === 'new') {
                    const recentEvents = boardEvents.slice(-100);
                    isDuplicate = recentEvents.some(event => {
                        const [storedFromId, storedTopicId, storedPostId, storedAction, storedTime] = event.split('_');
                        return storedFromId === fromId?.toString() &&
                            storedTopicId === topicId.toString() &&
                            storedPostId === postId.toString() &&
                            storedAction === action &&
                            (timestamp - parseInt(storedTime)) < 30000;
                    });
                } else if (action === 'edit') {
                    const recentEvents = boardEvents.slice(-50);
                    isDuplicate = recentEvents.some(event => {
                        const [storedFromId, storedTopicId, storedPostId, storedAction, storedTime] = event.split('_');
                        return storedFromId === fromId?.toString() &&
                            storedTopicId === topicId.toString() &&
                            storedPostId === postId.toString() &&
                            storedAction === action &&
                            (timestamp - parseInt(storedTime)) < 5000;
                    });
                }
                
                if (isDuplicate) {
                    return next();
                }
                
                boardEvents.push(eventKey);
                
                if (boardEvents.length > 1000) {
                    boardEvents.splice(0, 500);
                }
                
                // Ищем отслеживаемое обсуждение
                const topicMonitor = await prisma.topicMonitor.findFirst({
                    where: { monitorId: monitor.id, topicId: topicId }
                });
                
                if (!topicMonitor) {
                    return next();
                }
                
                // Подготавливаем контекст
                const boardContext = {
                    fromId: fromId,
                    id: postId,
                    topicId: topicId,
                    text: text,
                    groupId: groupId
                };
                
                // Обрабатываем пост (минимальное логирование)
                await handleTopicPost(boardContext, monitor, action);
                return next();
            } catch (error) {
                console.error('❌ Ошибка в обработке комментария:', error);
                return next();
            }
        });

        // ДОПОЛНИТЕЛЬНЫЕ ОБРАБОТЧИКИ для совместимости
        vks.updates.on('board_post_new' as any, async (context: any, next: any) => {
            //console.log('📘 Обработчик board_post_new сработал');
            return next();
        });

        vks.updates.on('board_comment_new' as any, async (context: any, next: any) => {
            //console.log('📘 Обработчик board_comment_new сработал');
            return next();
        });

        vks.updates.on('board_post_edit' as any, async (context: any, next: any) => {
            //console.log('📘 Обработчик board_post_edit сработал');
            return next();
        });

        vks.updates.on('board_post_delete' as any, async (context: any, next: any) => {
            //console.log('📘 Обработчик board_post_delete сработал');
            return next();
        });

        vks.updates.on('board_post_restore' as any, async (context: any, next: any) => {
            //console.log('📘 Обработчик board_post_restore сработал');
            return next();
        });

        await vks.updates.start();
        monitors[monitor.id] = { running: true, instance: vks };

        // Проверяем, есть ли отслеживаемые обсуждения
        const topicMonitors = await prisma.topicMonitor.findMany({
            where: { monitorId: monitor.id }
        });

        await Logger(`(system) ~ running monitor ${monitor.name}-${monitor.idvk} success by <system> №0`);
        await Logger(`🎯 Монитор ${monitor.id}: отслеживание обсуждений ${topicMonitors.length > 0 ? '✅' : '❌'}`);

        if (topicMonitors.length > 0) {
            console.log(`📚 Монитор ${monitor.id} отслеживает ${topicMonitors.length} обсуждений`);
            await Logger(`📊 Монитор ${monitor.id} отслеживает ${topicMonitors.length} обсуждений`);
        } else {
            console.log(`⚠ Монитор ${monitor.id} не отслеживает обсуждения`);
        }

        try {
            await vks.api.groups.enableOnline({ group_id: monitor.idvk });
        } catch (e) {
            Logger(`${e}`);
        }

        return buildMonitorReport(monitor, allianceName, topicMonitors.length, "started");
    } catch (error) {
        console.error(error);
        return buildMonitorReport(monitor, allianceName, 0, "failed", `${error}`);
    }
}

// Функция для остановки мониторов
export async function stopMonitor(monitorId: number) {
    const monitor = monitors[monitorId];
    if (monitor) {
        monitor.running = false; // Устанавливаем флаг остановки

        // Завершаем обработчик обновлений
        await monitor.instance.updates.stop();
        delete monitors[monitorId]; // Удаляем из объекта
        
        await Logger(`Монитор с ID ${monitorId} остановлен.`);
        await Send_Message(chat_id, `🚫 Монитор с ID ${monitorId} остановлен.`);
    } else {
        await Logger(`Монитор с ID ${monitorId} не запущен.`);
        await Send_Message(chat_id, `⚠ Монитор с ID ${monitorId} не запущен.`);
    }
}

// Функция для ручного перезапуска монитора
export async function restartMonitor(monitorId: number) {
    const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
    if (!monitor) {
        await Logger(`Монитор с ID ${monitorId} не найден.`);
        await Send_Message(chat_id, `⚠ Монитор с ID ${monitorId} не найден.`);
        return;
    }

    if (monitors[monitorId]) {
        await Logger(`Монитор с ID ${monitorId} уже запущен.`);
        await Send_Message(chat_id, `⚠ Монитор с ID ${monitorId} уже запущен.`);
        return;
    }

    const result = await startMonitor(monitor);

    if (result.status === "started") {
        await Logger(`Монитор с ID ${monitorId} запущен вручную.`);
        await Send_Message(chat_id, `🚀 Монитор с ID ${monitorId} запущен вручную.`);
        return;
    }

    await Send_Message(chat_id, `⚠ Монитор с ID ${monitorId} не запустился: ${result.errorMessage ?? "ошибка запуска"}`);
}

async function getAllianceNameById(startupMonitors: any[]): Promise<Map<number, string>> {
    const allianceIds = Array.from(new Set(startupMonitors.map((monitor) => monitor.id_alliance)));
    const alliances = allianceIds.length > 0
        ? await prisma.alliance.findMany({ where: { id: { in: allianceIds } } })
        : [];
    const allianceById = new Map<number, string>();

    for (const alliance of alliances) {
        allianceById.set(alliance.id, alliance.name);
    }

    return allianceById;
}

async function buildAlreadyRunningMonitorReport(monitor: any, allianceName: string): Promise<MonitorStartupReportItem> {
    const topicCount = await prisma.topicMonitor.count({
        where: { monitorId: monitor.id }
    });

    return buildMonitorReport(monitor, allianceName, topicCount, "already_running");
}

function buildMonitorReport(
    monitor: any,
    allianceName: string | undefined,
    topicCount: number,
    status: MonitorStartupReportItem["status"],
    errorMessage?: string
): MonitorStartupReportItem {
    return {
        allianceId: monitor.id_alliance,
        allianceName: allianceName ?? `Ролевая ${monitor.id_alliance}`,
        monitorId: monitor.id,
        monitorName: monitor.name,
        groupId: monitor.idvk,
        topicCount,
        status,
        errorMessage
    };
}
