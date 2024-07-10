import { Context, VK } from "vk-io";
import prisma from "./engine/events/module/prisma_client";
import { Send_Message } from "./engine/core/helper";

export const vks: VK[] = [];

async function Group_Id_Get(token: string) {
	const vk = new VK({ token: token, apiLimit: 1 });
	const [group] = await vk.api.groups.getById(vk);
	const groupId = group.id;
	return groupId
}
export async function Monitoring() {
    for (const monitor of await prisma.monitor.findMany({})) {
        try {
            //let idvk = entity.type === 'group' ? Number((await Group_Id_Get(entity.token))) : Number(await User_Id_Get(entity.token))
            const idvk = await Group_Id_Get(monitor.token).then((data: any) => { return data })
            //console.log(idvk);
            // Авторизация
            const vks = new VK({
              token: monitor.token,
              apiLimit: 1,
              pollingGroupId: idvk,
            });
            
            vks.updates.on('wall_post_new', async (context: Context, next: any) => { 
                if (Math.abs(context.wall.authorId) == idvk) {
                    const account = await prisma.account.findFirst({ where: { idvk: context.wall.signerId ?? context.wall.createdUserId } })
                    if (!account) { return await next(); }
                    const user = await prisma.user.findFirst({ where: { id_account: account.id, id_alliance: monitor.id_alliance } })
                    if (!user) { return await next(); }
                    const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_user: user.id }})
                    if (!balance) { return await next(); }
                    const balance_up = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { increment: monitor.cost_post } } })
                    if (!balance_up) { return await next(); }
                    await Send_Message(account.idvk, `Вам начислено за пост ${JSON.stringify(context.wall)} 30 шекелей`)
                }
                return await next();
            })
            vks.updates.on('like_add', async (context: Context, next: any) => {
                //проверяем есть ли пользователь в базах данных
                const whitelist = ['post'/*, 'comment' */]
                if ( !whitelist.includes(context.objectType) ) { return await next() }
                const account = await prisma.account.findFirst({ where: { idvk: context.likerId } })
                if (!account) { return await next(); }
                const user = await prisma.user.findFirst({ where: { id_account: account.id, id_alliance: monitor.id_alliance } })
                if (!user) { return await next(); }
                const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_user: user.id }})
                if (!balance) { return await next(); }
                const balance_up = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { increment: monitor.cost_like } } })
                if (!balance_up) { return await next(); }
                await Send_Message(account.idvk, `Вам начислено за лайк ${JSON.stringify(context)} 30 шекелей`)
                return await next();
            })
            vks.updates.on('like_remove', async (context: Context, next: any) => {
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
                await Send_Message(account.idvk, `С вас снято за дизлайк ${JSON.stringify(context)} 30 шекелей`)
                return await next();
            })
            vks.updates.on('wall_reply_new', async (context: Context, next: any) => {
                //проверяем есть ли пользователь в базах данных
                //console.log(context)
                if (context.text.length < 20 || context.fromId < 0) { return await next(); }
                const account = await prisma.account.findFirst({ where: { idvk: context.fromId } })
                if (!account) { return await next(); }
                const user = await prisma.user.findFirst({ where: { id_account: account.id, id_alliance: monitor.id_alliance } })
                if (!user) { return await next(); }
                const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_user: user.id }})
                if (!balance) { return await next(); }
                const balance_up = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { increment: monitor.cost_comment } } })
                if (!balance_up) { return await next(); }
                await Send_Message(account.idvk, `Вам начислено за коммент ${JSON.stringify(context)} 30 шекелей`)
                return await next();
            })
            vks.updates.on('wall_reply_delete', async (context: Context, next: any) => {
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
                await Send_Message(account.idvk, `С вас снято за удаление коммента ${JSON.stringify(context)} 30 шекелей`)
                return await next();
            })
            vks.updates.start().then(() => {
                console.log('Бот успешно запущен и готов к эксплуатации!')
            }).catch(console.log);
        } catch (error) {
            console.error(error);
        }
    }
}