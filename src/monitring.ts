import { Context, VK } from "vk-io";
import prisma from "./engine/events/module/prisma_client";
import { Group_Id_Get, Logger, Send_Message, Sleep } from "./engine/core/helper";
import { Limiter } from "@prisma/client";
import { Date_Compare_Resetor } from "./engine/events/module/alliance/limiter";
import { chat_id, SECRET_KEY } from ".";
import * as CryptoJS from 'crypto-js';

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

export async function Monitoring() {
    for (const monitor of await prisma.monitor.findMany({ where: { starting: true } })) {
        try {
            const idvk = await Group_Id_Get(Decrypt_Data(monitor.token)).then((data: any) => { return data })
            //console.log(idvk);
            // Авторизация
            const vks = new VK({
              token: Decrypt_Data(monitor.token),
              apiLimit: 1,
              pollingGroupId: idvk,
            });
            
            vks.updates.on('wall_post_new', async (context: Context, next: any) => { 
                if (!monitor.wall_on) { return await next(); }
                if (Math.abs(context.wall.authorId) == idvk) {
                    const account = await prisma.account.findFirst({ where: { idvk: context.wall.signerId ?? context.wall.createdUserId } })
                    if (!account) { return await next(); }
                    const user = await prisma.user.findFirst({ where: { id_account: account.id, id_alliance: monitor.id_alliance } })
                    if (!user) { return await next(); }
                    const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_user: user.id }})
                    if (!balance) { return await next(); }
                    const balance_up = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { increment: monitor.cost_post } } })
                    if (!balance_up) { return await next(); }
                    const coin = await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin ?? 0, id_alliance: monitor.id_alliance }})
                    user.notification ? await Send_Message(account.idvk, `📰 Вам начислено за написание поста ${monitor.cost_post} ${coin?.name}\n🧷 Ссылка: https://vk.com/club${Math.abs(context.wall.authorId)}?w=wall${context.wall.authorId}_${context.wall.id}\n💳 Ваш баланс: ${balance.amount}+${monitor.cost_post}=${balance_up.amount}${coin?.smile}`) : await Logger(`(monitor) ~ user ${user.idvk} create post and got ${monitor.cost_post} ${coin?.name}, link https://vk.com/club${Math.abs(context.wall.authorId)}?w=wall${context.wall.authorId}_${context.wall.id}, balance ${balance.amount}+${monitor.cost_post}=${balance_up.amount}${coin?.smile} by <monitor> №${monitor.id}`)
                }
                return await next();
            })
            vks.updates.on('like_add', async (context: Context, next: any) => {
                if (!monitor.like_on) { return await next(); }
                //проверяем есть ли пользователь в базах данных
                const whitelist = ['post'/*, 'comment' */]
                if ( !whitelist.includes(context.objectType) ) { return await next() }
                const account = await prisma.account.findFirst({ where: { idvk: context.likerId } })
                if (!account) { return await next(); }
                const user = await prisma.user.findFirst({ where: { id_account: account.id, id_alliance: monitor.id_alliance } })
                if (!user) { return await next(); }
                //модуль лимитов
                let limiter = await prisma.limiter.findFirst({ where: { id_monitor: monitor.id, id_user: user.id } })
                if (!limiter) { limiter = await prisma.limiter.create({ data: { id_monitor: monitor.id, id_user: user.id } }) }
                limiter = await Date_Compare_Resetor(limiter)
                if (limiter.likes >= monitor.lim_like) { return await next(); }
                const limiter_up = await prisma.limiter.update({ where: { id: limiter.id }, data: { likes: { increment: 1 } } })
                if (!limiter_up) { return await next(); }
                //модуль вознаграждения
                const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_user: user.id }})
                if (!balance) { return await next(); }
                const balance_up = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { increment: monitor.cost_like } } })
                if (!balance_up) { return await next(); }
                const coin = await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin ?? 0, id_alliance: monitor.id_alliance }})
                user.notification ? await Send_Message(account.idvk, `👍 Вам начислено за лайк поста ${monitor.cost_like} ${coin?.name}\n🧷 Ссылка: https://vk.com/club${Math.abs(context.objectOwnerId)}?w=wall${context.objectOwnerId}_${context.objectId}\n💳 Ваш баланс: ${balance.amount}+${monitor.cost_like}=${balance_up.amount}${coin?.smile}`) : await Logger(`(monitor) ~ user ${user.idvk} like post and got ${monitor.cost_like} ${coin?.name}, link https://vk.com/club${Math.abs(context.objectOwnerId)}?w=wall${context.objectOwnerId}_${context.objectId}, balance ${balance.amount}+${monitor.cost_like}=${balance_up.amount}${coin?.smile} by <monitor> №${monitor.id}`)
                return await next();
            })
            vks.updates.on('like_remove', async (context: Context, next: any) => {
                if (!monitor.like_on) { return await next(); }
                //проверяем есть ли пользователь в базах данных
                const whitelist = ['post'/*, 'comment' */]
                if ( !whitelist.includes(context.objectType) ) { return await next() }
                const account = await prisma.account.findFirst({ where: { idvk: context.likerId } })
                if (!account) { return await next(); }
                const user = await prisma.user.findFirst({ where: { id_account: account.id, id_alliance: monitor.id_alliance } })
                if (!user) { return await next(); }
                const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_user: user.id }})
                if (!balance) { return await next(); }
                const balance_up = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { decrement: monitor.cost_like } } })
                if (!balance_up) { return await next(); }
                const coin = await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin ?? 0, id_alliance: monitor.id_alliance }})
                user.notification ? await Send_Message(account.idvk, `👎 С вас снято за снятие лайка с поста ${monitor.cost_like} ${coin?.name}\n🧷 Ссылка: https://vk.com/club${Math.abs(context.objectOwnerId)}?w=wall${context.objectOwnerId}_${context.objectId}\n💳 Ваш баланс: ${balance.amount}-${monitor.cost_like}=${balance_up.amount}${coin?.smile}`) : await Logger(`(monitor) ~ user ${user.idvk} dislike post and lost ${monitor.cost_like} ${coin?.name}, link https://vk.com/club${Math.abs(context.objectOwnerId)}?w=wall${context.objectOwnerId}_${context.objectId}, balance ${balance.amount}-${monitor.cost_like}=${balance_up.amount}${coin?.smile} by <monitor> №${monitor.id}`)
                return await next();
            })
            vks.updates.on('wall_reply_new', async (context: Context, next: any) => {
                if (!monitor.comment_on) { return await next(); }
                //проверяем есть ли пользователь в базах данных
                //console.log(context)
                if (context.text.length < 20 || context.fromId < 0) { return await next(); }
                const account = await prisma.account.findFirst({ where: { idvk: context.fromId } })
                if (!account) { return await next(); }
                const user = await prisma.user.findFirst({ where: { id_account: account.id, id_alliance: monitor.id_alliance } })
                if (!user) { return await next(); }
                //модуль лимитов
                let limiter = await prisma.limiter.findFirst({ where: { id_monitor: monitor.id, id_user: user.id } })
                if (!limiter) { limiter = await prisma.limiter.create({ data: { id_monitor: monitor.id, id_user: user.id } }) }
                limiter = await Date_Compare_Resetor(limiter)
                if (limiter.comment >= monitor.lim_comment) { return await next(); }
                const limiter_up = await prisma.limiter.update({ where: { id: limiter.id }, data: { comment: { increment: 1 } } })
                if (!limiter_up) { return await next(); }
                //модуль вознаграждения
                const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_user: user.id }})
                if (!balance) { return await next(); }
                const balance_up = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { increment: monitor.cost_comment } } })
                if (!balance_up) { return await next(); }
                const coin = await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin ?? 0, id_alliance: monitor.id_alliance }})
                user.notification ? await Send_Message(account.idvk, `💬 Вам начислено за комментарий ${monitor.cost_comment} ${coin?.name}\n🧷 Ссылка: https://vk.com/wall${context.ownerId}_${context.objectId}?reply=${context.id}\n💳 Ваш баланс: ${balance.amount}+${monitor.cost_comment}=${balance_up.amount}${coin?.smile}`) : await Logger(`(monitor) ~ user ${user.idvk} send comment and got ${monitor.cost_comment} ${coin?.name}, link https://vk.com/wall${context.ownerId}_${context.objectId}?reply=${context.id}, balance ${balance.amount}+${monitor.cost_comment}=${balance_up.amount}${coin?.smile} by <monitor> №${monitor.id}`)
                return await next();
            })
            vks.updates.on('wall_reply_delete', async (context: Context, next: any) => {
                if (!monitor.comment_on) { return await next(); }
                //проверяем есть ли пользователь в базах данных
                //console.log(context)
                const account = await prisma.account.findFirst({ where: { idvk: context.deleterUserId } })
                if (!account) { return await next(); }
                const user = await prisma.user.findFirst({ where: { id_account: account.id, id_alliance: monitor.id_alliance } })
                if (!user) { return await next(); }
                const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_user: user.id }})
                if (!balance) { return await next(); }
                const balance_up = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { decrement: monitor.cost_comment } } })
                if (!balance_up) { return await next(); }
                const coin = await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin ?? 0, id_alliance: monitor.id_alliance }})
                user.notification ? await Send_Message(account.idvk, `💬 С вас снято за удаленный комментарий ${monitor.cost_comment} ${coin?.name}\n🧷 Ссылка: https://vk.com/wall${context.ownerId}_${context.objectId}?reply=${context.id}\n💳 Ваш баланс: ${balance.amount}-${monitor.cost_comment}=${balance_up.amount}${coin?.smile}`) : await Logger(`(monitor) ~ user ${user.idvk} delete comment and lost ${monitor.cost_comment} ${coin?.name}, link https://vk.com/wall${context.ownerId}_${context.objectId}?reply=${context.id}, balance ${balance.amount}-${monitor.cost_comment}=${balance_up.amount}${coin?.smile} by <monitor> №${monitor.id}`)
                return await next();
            })
            vks.updates.start().then(async () => {
                await Logger(`(system) ~ running monitor ${monitor.name}-${monitor.idvk} succes by <system> №0`);
                try {
                    await Sleep(5000)
                    await Send_Message(chat_id, `🎥 Мама я заработаль, монитор №${monitor.id} по адресу: https://vk.com/club${monitor.idvk}`)
                    await vks.api.groups.enableOnline({ group_id: monitor.idvk }) 
                } catch(e) {
                    await Logger(`${e}`)
                }
            }).catch(console.error);
        } catch (error) {
            console.error(error);
        }
    }
}