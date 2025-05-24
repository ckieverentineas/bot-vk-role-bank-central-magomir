import { Context, VK } from "vk-io";
import prisma from "./engine/events/module/prisma_client";
import { Group_Id_Get, Logger, Send_Message, Sleep } from "./engine/core/helper";
import { BalanceFacult, Limiter } from "@prisma/client";
import { Date_Compare_Resetor } from "./engine/events/module/alliance/limiter";
import { chat_id, SECRET_KEY } from ".";
import * as CryptoJS from 'crypto-js';
import { Calc_Bonus_Activity, User_Bonus_Check } from "./engine/events/module/alliance/monitor";

// Функция для расшифровки данных
function Decrypt_Data(encryptedData: string): string {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
        return decryptedData;
    } catch(e) {
        Logger(`Невозможно расшифровать ${e}`)
        return `zero`
    }
    
}

const monitors: { [key: number]: { running: boolean; instance: VK } } = {};

export async function Monitoring() {
    for (const monitor of await prisma.monitor.findMany({ where: { starting: true } })) {
        if (monitors[monitor.id]) {
            await Logger(`Монитор с ID ${monitor.id} уже запущен.`);
            await Send_Message(chat_id, `⚠ Монитор с ID ${monitor.id} уже запущен.`)
            continue;
        }

        await startMonitor(monitor);
    }
}

// Функция для запуска монитора
async function startMonitor(monitor: any) {
    try {
        const idvk = await Group_Id_Get(Decrypt_Data(monitor.token));
        const token = Decrypt_Data(monitor.token);

        const vks = new VK({
            token: token,
            apiLimit: 1,
            pollingGroupId: idvk,
        });

        vks.updates.on('wall_post_new', async (context: Context, next: any) => { 
            if (!monitor.wall_on) { return await next(); }
            if (Math.abs(context.wall.authorId) == idvk) {
                await Calc_Bonus_Activity(
                    context.wall.signerId ?? context.wall.createdUserId, 
                    '+', 
                    monitor.cost_post, 
                    'пост', 
                    `https://vk.com/club${Math.abs(context.wall.authorId)}?w=wall${context.wall.authorId}_${context.wall.id}`,
                    monitor
                )
            }
            return await next();
        })
        vks.updates.on('like_add', async (context: Context, next: any) => {
            if (!monitor.like_on) { return await next(); }
            //проверяем есть ли пользователь в базах данных
            const whitelist = ['post'/*, 'comment' */]
            if ( !whitelist.includes(context.objectType) ) { return await next() }
            //модуль лимитов
            const user = await User_Bonus_Check(context.likerId, monitor)
            if (!user) { return await next(); }
            let limiter = await prisma.limiter.findFirst({ where: { id_monitor: monitor.id, id_user: user.id } })
            if (!limiter) { limiter = await prisma.limiter.create({ data: { id_monitor: monitor.id, id_user: user.id } }) }
            limiter = await Date_Compare_Resetor(limiter)
            if (limiter.likes >= monitor.lim_like) { return await next(); }
            const limiter_up = await prisma.limiter.update({ where: { id: limiter.id }, data: { likes: { increment: 1 } } })
            if (!limiter_up) { return await next(); }
            //модуль наград и штрафов
            await Calc_Bonus_Activity(
                context.likerId, 
                '+', 
                monitor.cost_like, 
                'лайк', 
                `https://vk.com/club${Math.abs(context.objectOwnerId)}?w=wall${context.objectOwnerId}_${context.objectId}`,
                monitor
            )
            return await next();
        })
        vks.updates.on('like_remove', async (context: Context, next: any) => {
            if (!monitor.like_on) { return await next(); }
            //проверяем есть ли пользователь в базах данных
            const whitelist = ['post'/*, 'comment' */]
            if ( !whitelist.includes(context.objectType) ) { return await next() }
            await Calc_Bonus_Activity(
                context.likerId, 
                '-', 
                monitor.cost_like, 
                'лайк', 
                `https://vk.com/club${Math.abs(context.objectOwnerId)}?w=wall${context.objectOwnerId}_${context.objectId}`,
                monitor
            )
            return await next();
        })
        vks.updates.on('wall_reply_new', async (context: Context, next: any) => {
            if (!monitor.comment_on) { return await next(); }
            //проверяем есть ли пользователь в базах данных
            //console.log(context)
            if (context.text.length < 20 || context.fromId < 0) { return await next(); }
            const user = await User_Bonus_Check(context.fromId, monitor)
            if (!user) { return await next(); }
            //модуль лимитов
            let limiter = await prisma.limiter.findFirst({ where: { id_monitor: monitor.id, id_user: user.id } })
            if (!limiter) { limiter = await prisma.limiter.create({ data: { id_monitor: monitor.id, id_user: user.id } }) }
            limiter = await Date_Compare_Resetor(limiter)
            if (limiter.comment >= monitor.lim_comment) { return await next(); }
            const limiter_up = await prisma.limiter.update({ where: { id: limiter.id }, data: { comment: { increment: 1 } } })
            if (!limiter_up) { return await next(); }
            await Calc_Bonus_Activity(
                context.fromId, 
                '+', 
                monitor.cost_comment, 
                'комментарий', 
                `https://vk.com/wall${context.ownerId}_${context.objectId}?reply=${context.id}`,
                monitor
            )
            return await next();
        })
        vks.updates.on('wall_reply_delete', async (context: Context, next: any) => {
            if (!monitor.comment_on) { return await next(); }
            await Calc_Bonus_Activity(
                context.deleterUserId, 
                '-', 
                monitor.cost_comment, 
                'комментарий', 
                `https://vk.com/wall${context.ownerId}_${context.objectId}?reply=${context.id}`,
                monitor
            )
            return await next();
        })

        vks.updates.start().then(async () => {
            monitors[monitor.id] = { running: true, instance: vks };
            await Logger(`(system) ~ running monitor ${monitor.name}-${monitor.idvk} success by <system> №0`);
            await Sleep(5000);
            await Send_Message(chat_id, `🎥 Мама я заработаль, монитор №${monitor.id} по адресу: https://vk.com/club${monitor.idvk}`);
            try {
                await vks.api.groups.enableOnline({ group_id: monitor.idvk });
            } catch (e) {
                Logger(`${e}`)
            }
            
        }).catch(console.error);
    } catch (error) {
        console.error(error);
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
        await Send_Message(chat_id, `🚫 Монитор с ID ${monitorId} остановлен.`)
    } else {
        await Logger(`Монитор с ID ${monitorId} не запущен.`);
        await Send_Message(chat_id, `⚠ Монитор с ID ${monitorId} не запущен.`)
    }
}

// Функция для ручного перезапуска монитора
export async function restartMonitor(monitorId: number) {
    const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
    if (!monitor) {
        await Logger(`Монитор с ID ${monitorId} не найден.`);
        await Send_Message(chat_id, `⚠ Монитор с ID ${monitorId} не найден.`)
        return;
    }

    if (monitors[monitorId]) {
        await Logger(`Монитор с ID ${monitorId} уже запущен.`);
        await Send_Message(chat_id, `⚠ Монитор с ID ${monitorId} уже запущен.`)
        return;
    }

    await startMonitor(monitor);
    await Logger(`Монитор с ID ${monitorId} запущен вручную.`);
    await Send_Message(chat_id, `🚀 Монитор с ID ${monitorId} запущен вручную.`)
}
