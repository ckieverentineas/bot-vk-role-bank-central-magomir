import { HearManager } from "@vk-io/hear";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { IQuestionMessageContext } from "vk-io-question";
import { answerTimeLimit, chat_id, root, timer_text, timer_text_oper, vk } from '../index';
import { Accessed, Keyboard_Index } from "./core/helper";
import { Image_Random} from "./core/imagecpu";
import prisma from "./events/module/prisma_client";
import { User_Info } from "./events/module/tool";
import { Item, User } from "@prisma/client";

export function registerUserRoutes(hearManager: HearManager<IQuestionMessageContext>): void {
    hearManager.hear(/Косой переулок/, async (context) => {
        if (context.senderId == root) {
            console.log(`Admin ${context.senderId} enter in shopping`)
            const category:any = await prisma.category.findMany({})
            if (category.length == 0) {
                const ans: any = await context.question(
                    `✉ Магазинов еще нет`,
                    {   keyboard: Keyboard.builder()
                        .textButton({   label: 'Добавить магазин',
                                        payload: {  command: 'new_shop' },
                                        color: 'secondary'                  })
                        .oneTime().inline()                                     }
                )
                if (ans.payload.command == 'new_shop') {
                    const shop: any = await context.question(`🧷 Введите название магазина:`)
                    const shop_create = await prisma.category.create({  data: { name: shop.text }   })
                    console.log(`User ${context.senderId} open new shop`)
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `⚙ @id${context.senderId}(ROOT) пользователь открывает следующий магазин ${shop_create.name}`
                    })
                    await context.send(`⚙ Вы открыли следующий магазин ${shop_create.name}`)
                }
            } else {
                let keyboard = Keyboard.builder()
                category.forEach(async (element: any) => {
                    keyboard.textButton({   label: element.name,
                                            payload: { command: `${element.id}` }   })
                    .textButton({   label: "Удалить",
                                    payload: { command: `${element.id}` }   }).row()
                })
                const ans: any = await context.question(`✉ Куда пойдем?`,
                    {   keyboard: keyboard
                        .textButton({   label: 'Добавить магазин',
                                        payload: { command: 'new_shop' },
                                        color: 'secondary'                  })
                        .oneTime().inline()                                     })
                if (ans.text == "Удалить") {
                    const shop_delete = await prisma.category.delete({ where: { id: Number(ans.payload.command) } })
                    console.log(`User ${context.senderId} close shop`)
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `⚙ @id${context.senderId}(ROOT) пользователь закрывает следующий магазин ${shop_delete.name}`
                    })
                    await context.send(`⚙ Удален магазин ${shop_delete.name}`)
                }
                if (ans.payload?.command == 'new_shop') {
                    const shop: any = await context.question( `🧷 Введите название магазина:` )
                    const shop_create: any = await prisma.category.create({ data: { name: shop.text } })
                    console.log(`User ${context.senderId} open new shop`)
                    await context.send(`⚙ Вы открыли следующий магазин ${shop_create.name}`)
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `⚙ @id${context.senderId}(ROOT) пользователь открыл следующий магазин ${shop_create.name}`
                    })
                }
                if (category.find((i: any) => i.name == ans.text)) {
                    await context.send(`⌛ Вы оказались в ${ans.text}`)
                    const item: any= await prisma.item.findMany({ where: { id_category: Number(ans.payload.command) } })
                    if (item.length == 0) {
                        await context.send(`✉ К сожалению приалвки пока что пусты=/`)
                    } else {
                        item.forEach(async (element: any) => {
                            await context.send(`🛍 ${element.name} ${element.price}💰`,
                                {
                                    keyboard: Keyboard.builder()
                                    .textButton({ label: 'Купить', payload: { command: `${element.name}` }, color: 'secondary' })
                                    .textButton({ label: '✏Имя', payload: { command: `${element.name}` }, color: 'secondary' })
                                    .textButton({ label: '✏Тип', payload: { command: `${element.name}` }, color: 'secondary' })
                                    .oneTime().inline()                                             
                                }
                            )  
                        })
                    }
                    const ans_item: any = await context.question( `✉ Что будем делать?`,
                        {   
                            keyboard: Keyboard.builder()
                            .textButton({ label: 'Добавить товар', payload: { command: 'new_item' }, color: 'secondary' })
                            .textButton({ label: 'Перейти к покупкам', payload: { command: 'continue' }, color: 'secondary' })
                            .oneTime().inline()
                        }
                    )
                    if (ans_item.payload?.command == 'new_item') {
                        const item_name: any = await context.question( `🧷 Введите название предмета:` )
                        const item_price = await context.question( `🧷 Введите его ценность:` )
                        const item_type: any = await context.question( `🧷 Укажите тип товара: \n 🕐 — покупается пользователем однажды; \n ♾ — покупается пользователем бесконечное количество раз.`,
                            {   keyboard: Keyboard.builder()
                                .textButton({   label: '🕐',
                                                payload: { command: 'limited' },
                                                color: 'secondary'                  })
                                .textButton({   label: '♾',
                                                payload: { command: 'unlimited' },
                                                color: 'secondary'                  })
                                .oneTime().inline()                                     }
                        )
                        const item_create = await prisma.item.create({ data: {  name: item_name.text, price: Number(item_price.text), id_category: Number(ans.payload.command), type: item_type.payload.command } })
                        console.log(`User ${context.senderId} added new item ${item_create.id}`)
                        await context.send(`⚙ Для магазина ${ans.text} добавлен новый товар ${item_name.text} стоимостью ${item_price.text} галлеонов`)
                        await vk.api.messages.send({
                            peer_id: chat_id,
                            random_id: 0,
                            message: `⚙ @id${context.senderId}(ROOT) пользователь добавляет новый товар ${item_name.text} стоимостью ${item_price.text} галлеонов`
                        })
                    }
                    if (ans_item.payload.command == 'continue') { await context.send(`💡 Нажимайте кнопку купить у желаемого товара`) }
                }
            }
        }
        await Keyboard_Index(context, `💡 А может быть в косом переулке есть подполье?`)
    })
    hearManager.hear(/✏Тип/, async (context) => {
        if (context.messagePayload == null && context.senderId != root) {
            console.log((`stop`))
            return
        }
        const item_buy:any = await prisma.item.findFirst({ where: { name: context.messagePayload.command } })
        if (item_buy) {
            const item_type: any = await context.question( `🧷 Укажите тип товара для ${item_buy.name}: \n 🕐 — покупается пользователем однажды; \n ♾ — покупается пользователем бесконечное количество раз. \n Текущий тип: ${item_buy.type}`,
                {   
                    keyboard: Keyboard.builder()
                    .textButton({ label: '🕐', payload: { command: 'limited' }, color: 'secondary' })
                    .textButton({ label: '♾', payload: { command: 'unlimited' }, color: 'secondary' })
                    .oneTime().inline()
                }
            )
            const item_update = await prisma.item.update({ where: { id: item_buy.id }, data: { type: item_type.payload.command } })
            console.log(`Admin ${context.senderId} edit type item ${item_buy.id}`)
            await context.send(`⚙ Тип предмета ${item_buy.name} изменен с ${item_buy.type} на ${item_update.type}`)
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(ROOT) пользователь корректирует тип предмета ${item_buy.name} с ${item_buy.type} на ${item_update.type}`
            })
        } else {
            console.log(`Admin ${context.senderId} can't edit type item ${item_buy.id}`)
            await context.send(`✉ Тип предмета не удалось поменять`)
        }
        await Keyboard_Index(context, `💡 Вот бы всегда безлимит, и редактировать бы ничего не пришлось?`)
    })
    hearManager.hear(/✏Имя/, async (context) => {
        if (context.messagePayload == null && context.senderId != root) {
            console.log((`stop`))
            return
        }
        const item_buy:any = await prisma.item.findFirst({ where: { name: context.messagePayload.command } })
        if (item_buy) {
            const name: any = await context.question(`🧷 Предмет: ${item_buy.name}.\nВведите новое имя для товара:`)
            const item_update = await prisma.item.update({ where: { id: item_buy.id }, data: { name: name.text } })
            console.log(`Admin ${context.senderId} edit name item ${item_buy.id}`)
            await context.send(`⚙ Имя предмета ${item_buy.name} изменено на ${item_update.name}`)
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(ROOT) пользователь корректирует имя предмета с ${item_buy.name} на ${item_update.name}`
            })
        } else {
            console.log(`Admin ${context.senderId} can't edit name item ${item_buy.id}`)
            await context.send(`✉ Имя предмета не удалось поменять`)
        }
        await Keyboard_Index(context, `💡 Может еще что-нибудь отредактировать?`)
    })
    hearManager.hear(/операция/, async (context) => {
        if (await Accessed(context) != 2) {
            return
        }
        let name_check = false
        let uids = null
        while (name_check == false) {
            const uid: any = await context.question( `🧷 Введите список 💳UID банковских счетов получателей формата:\n"UID1 UID2 .. UIDN"`,
                {   
                    keyboard: Keyboard.builder()
                    .textButton({ label: '🚫Отмена', payload: { command: 'limited' }, color: 'secondary' })
                    .oneTime().inline(),
                    timer_text
                }
            )
            if (uid.isTimeout) { return await context.send('⏰ Время ожидания на ввод банковского счета получателя истекло!')}
            if (/(?:^|\s)(\d+)(?=\s|$)/g.test(uid.text)) {
                uids = uid.text.match(/(?:^|\s)(\d+)(?=\s|$)/g)
                await context.send(`⚙ Подготовка к массовым операциям, товарищ ДОК!`)
                name_check = true
            } else {
                if (uid.text == "🚫Отмена") { 
                    await context.send(`💡 Операции прерваны пользователем!`) 
                    return await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
                }
				await context.send(`💡 Необходимо ввести корректный UID!`)
			}
        }
        const ans: any = await context.question( `✉ Доступны следующие операции с 💳UID: ${JSON.stringify(uids)}`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: '+💰', payload: { command: 'gold_up_many' }, color: 'secondary' })
                .textButton({ label: '—💰', payload: { command: 'gold_down_many' }, color: 'secondary' }).row()
                .textButton({ label: '+🧙', payload: { command: 'xp_up_many' }, color: 'secondary' })
                .textButton({ label: '—🧙', payload: { command: 'xp_down_many' }, color: 'secondary' }).row()
                .textButton({ label: '+💰🧙', payload: { command: 'multi_up_many' }, color: 'secondary' })
                .textButton({ label: '—💰🧙', payload: { command: 'multi_down_many' }, color: 'secondary' }).row()
                .textButton({ label: '🔙', payload: { command: 'back' }, color: 'secondary' }).row()
                .oneTime().inline(),
                answerTimeLimit                                                                       
            }
        )
        if (ans.isTimeout) { return await context.send(`⏰ Время ожидания на ввод операции с 💳UID: ${JSON.stringify(uids)} истекло!`) }
        if (ans.payload && ans.payload.command != 'back') {
            const config: any = {
                'gold_up_many': Gold_Up_Many,
                'gold_down_many': Gold_Down_Many,
                'xp_up_many': Xp_Up_Many,
                'xp_down_many': Xp_Down_Many,
                'back': Back,
                'multi_up_many': Multi_Up_Many,
                'multi_down_many': Multi_Down_Many
            }
            const answergot = await config[ans.payload.command](uids)
            
        } else {
            await context.send(`⚙ Операция отменена пользователем.`)
        }
        await context.send(`✅ Процедура массовых операций под названием операция "Ы" успешно завершена!`)
        await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)

        //Модуль мульти начислений
        async function Multi_Up_Many(uids: number[]) {
            await context.send(`⚠ Приступаем к начислению галлеонов`)
            const gold: number = await Ipnut_Gold() 
            await context.send(`⚠ Приступаем к начислению магического опыта`)
            const xp: number = await Ipnut_Gold()
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: User | null = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                const money_put = await prisma.user.update({ where: { id: user_get?.id }, data: { gold: { increment: gold }, xp: { increment: xp } } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get?.idvk,
                        random_id: 0,
                        message: `⚙ Вам начислено ${gold}💰 ${xp}🧙. \n\nВаш счёт:\n${money_put.gold}💰\n${money_put.xp}🧙\n\n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get?.idvk} blocked chating with bank`)
                    await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `🗿 @id${context.senderId}(Admin) > "+💰🧙" >\n${user_get?.gold}+${gold}=${money_put.gold}💰\n${user_get?.xp}+${xp}=${money_put.xp}🧙\n для @id${user_get?.idvk}(${user_get?.name}) 🧷: ${messa}`
                })
                console.log(`User ${user_get?.idvk} got ${gold} gold and ${xp} xp. Him/Her bank now ${money_put.gold}`)
            }
        }
        async function Multi_Down_Many(uids: number[]) {
            await context.send(`⚠ Приступаем к снятию галлеонов`)
            const gold: number = await Ipnut_Gold() 
            await context.send(`⚠ Приступаем к снятию магического опыта`)
            const xp: number = await Ipnut_Gold()
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: User | null = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                const money_put = await prisma.user.update({ where: { id: user_get?.id }, data: { gold: { decrement: gold }, xp: { decrement: xp } } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get?.idvk,
                        random_id: 0,
                        message: `⚙ С вас снято ${gold}💰 ${xp}🧙. \n\nВаш счёт:\n${money_put.gold}💰\n${money_put.xp}🧙\n\n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get?.idvk} blocked chating with bank`)
                    await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `🗿 @id${context.senderId}(Admin) > "-💰🧙" >\n${user_get?.gold}-${gold}=${money_put.gold}💰\n${user_get?.xp}-${xp}=${money_put.xp}🧙\n для @id${user_get?.idvk}(${user_get?.name}) 🧷: ${messa}`
                })
                console.log(`User ${user_get?.idvk} left ${gold} gold and ${xp} xp. Him/Her bank now ${money_put.gold}`)
            }
        }
        //Модуль начислений
        async function Gold_Up_Many(uids: number[]) {
            const count: number = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: any = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { gold: user_get.gold + count } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get.idvk,
                        random_id: 0,
                        message: `⚙ Вам начислено ${count}💰. \nВаш счёт: ${money_put.gold}💰 \n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get.idvk} blocked chating with bank`)
                    await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `🗿 @id${context.senderId}(Admin) > "+💰" > ${money_put.gold-count}💰+${count}💰=${money_put.gold}💰 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                })
                console.log(`User ${user_get.idvk} got ${count} gold. Him/Her bank now ${money_put.gold}`)
            }
        }
        async function Gold_Down_Many(uids: number[]) {
            const count: number = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: any = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                if (user_get.gold-count >= 0) {
                    const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { gold: user_get.gold - count } })
                    try {
                        await vk.api.messages.send({
                            user_id: user_get.idvk,
                            random_id: 0,
                            message: `⚙ С вас снято ${count}💰. \nВаш счёт: ${money_put.gold}💰 \n Уведомление: ${messa}`
                        })
                        await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                    } catch (error) {
                        console.log(`User ${user_get.idvk} blocked chating with bank`)
                        await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                    }
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `🗿 @id${context.senderId}(Admin) > "-💰" > ${money_put.gold+count}💰-${count}💰=${money_put.gold}💰 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                    })
                    console.log(`User ${user_get.idvk} lost ${count} gold. Him/Her bank now ${money_put.gold}`)
                } else {
                    const confirmq = await context.question(`⌛ Вы хотите снять ${count} 💰галлеонов c счета ${user_get.name}, но счет этого ${user_get.spec} ${user_get.gold}. Уверены, что хотите сделать баланс: ${user_get.gold-count}`,
                        {
                            keyboard: Keyboard.builder()
                            .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
                            .textButton({ label: 'Нет', payload: { command: 'gold_down' }, color: 'secondary' })
                            .oneTime().inline(),
                            answerTimeLimit
                        }
                    )
                    if (confirmq.isTimeout) { return await context.send(`⏰ Время ожидания на снятие галлеонов с ${user_get.name} истекло!`) }
                    if (confirmq.payload.command === 'confirm') {
                        const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { gold: user_get.gold - count } })
                        try {
                            await vk.api.messages.send({
                                user_id: user_get.idvk, random_id: 0,
                                message: `⚙ С вас снято ${count}💰. \nВаш счёт: ${money_put.gold}💰 \n Уведомление: ${messa}`
                            })
                            await context.send(`⚙ Операция завершена успешно`)
                        } catch (error) {
                            console.log(`User ${user_get.idvk} blocked chating with bank`)
                            await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                        }
                        await vk.api.messages.send({
                            peer_id: chat_id,
                            random_id: 0,
                            message: `🗿 @id${context.senderId}(Admin) > "-💰" > ${money_put.gold+count}💰-${count}💰=${money_put.gold}💰 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                        })
                        console.log(`User ${user_get.idvk} lost ${count} gold. Him/Her bank now ${money_put.gold}`)
                    } else {
                        await context.send(`💡 Нужно быть жестче! Греби бабло`)
                    }
                }
            }
        }
        async function Xp_Up_Many(uids: number[]) {
            const count: number = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: any = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { xp: user_get.xp + count } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get.idvk,
                        random_id: 0,
                        message: `⚙ Вам начислено ${count}🧙. \nВаш МО: ${money_put.xp}🧙 \n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get.idvk} blocked chating with bank`)
                    await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `🗿 @id${context.senderId}(Admin) > "+🧙" > ${money_put.xp-count}🧙+${count}🧙=${money_put.xp}🧙 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                })
                console.log(`User ${user_get.idvk} got ${count} MO. Him/Her XP now ${money_put.xp}`)
            }
        }
        async function Xp_Down_Many(uids: number[]) {
            const count: number = await Ipnut_Gold() 
            if (count === 0) { return }
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: any = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                if (user_get.xp-count >= 0) {
                    const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { xp: user_get.xp - count } })
                    try {
                        await vk.api.messages.send({
                            user_id: user_get.idvk,
                            random_id: 0,
                            message: `⚙ С вас снято ${count}🧙. \nВаш МО: ${money_put.xp}🧙  \n Уведомление: ${messa}`
                        })
                        await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                    } catch (error) {
                        console.log(`User ${user_get.idvk} blocked chating with bank`)
                        await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                    }
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `🗿 @id${context.senderId}(Admin) > "-🧙" > ${money_put.xp+count}🧙-${count}🧙=${money_put.xp}🧙 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                    })
                    console.log(`User ${user_get.idvk} lost ${count} MO. Him/Her XP now ${money_put.xp}`)
                } else {
                    await context.send(`⌛ Вы хотите снять ${count} 🧙магического опыта c счета ${user_get.name}, но счет этого ${user_get.spec} ${user_get.xp}. Уверены, что хотите сделать баланс: ${user_get.xp-count}? (Автоподтверждение)`)
                    const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { xp: user_get.xp - count } })
                    try {
                        await vk.api.messages.send({
                            user_id: user_get.idvk,
                            random_id: 0,
                            message: `⚙ С вас снято ${count}🧙. \nВаш МО: ${money_put.xp}🧙  \n Уведомление: ${messa}`
                        })
                        await context.send(`⚙ Операция завершена успешно`)
                    } catch (error) {
                        console.log(`User ${user_get.idvk} blocked chating with bank`)
                        await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                    }
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `🗿 @id${context.senderId}(Admin) > "-🧙" > ${money_put.xp+count}🧙-${count}🧙=${money_put.xp}🧙 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                    })
                    console.log(`User ${user_get.idvk} lost ${count} MO. Him/Her XP now ${money_put.xp}`)
                }
            }
        }
        //Модуль обработки ввода пользователем 
        async function Ipnut_Gold() {
            let golden: number = 0
            let money_check = false
            while (money_check == false) {
                const gold: any = await context.question(`🧷 Введите количество для операции ${ans.text}: `, timer_text_oper)
                if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание количества ${ans.text} истекло!`); return golden }
                if (typeof Number(gold.text) == "number") {
                    money_check = true
                    golden = Number(gold.text)
                } 
            }
            return golden
        }
        async function Ipnut_Message() {
            let golden = ''
            let money_check = false
            while (money_check == false) {
                const gold = await context.question(`🧷 Введите уведомление пользователю ${ans.text}:`, timer_text_oper)
                if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание уведомления пользователю ${ans.text} истекло!`); return "Уведомление приняло ИСЛАМ!" }
                if (gold.text) {
                    money_check = true
                    golden = gold.text
                } 
            }
            return golden
        }
        //Модуль вовзврата
        async function Back(id: number, count: number) {
            console.log(`Admin ${context.senderId} canceled operation for user UID: ${id}`)
            await context.send(`⚙ Операция отменена пользователем.`)
        }
    })

    hearManager.hear(/операции/, async (context) => {
        if (await Accessed(context) != 2) {
            return
        }
        let name_check = false
		let datas: any = []
		while (name_check == false) {
			const uid: any = await context.question( `🧷 Введите 💳UID банковского счета получателя:`,
                {   
                    keyboard: Keyboard.builder()
                    .textButton({ label: '🚫Отмена', payload: { command: 'limited' }, color: 'secondary' })
                    .oneTime().inline(),
                    timer_text
                }
            )
            if (uid.isTimeout) { return await context.send('⏰ Время ожидания на ввод банковского счета получателя истекло!')}
			if (/^(0|-?[1-9]\d{0,5})$/.test(uid.text)) {
                const get_user = await prisma.user.findFirst({ where: { id: Number(uid.text) } })
                if (get_user) {
                    console.log(`Admin ${context.senderId} opened ${get_user.idvk} card UID: ${get_user.id}`)
                    name_check = true
				    datas.push({id: `${uid.text}`})
                    const artefact_counter = await prisma.artefact.count({
                        where: {
                            id_user: Number(uid.text)
                        }
                    })
                    await context.send(`🏦 Открыта следующая карточка: ${get_user.class} ${get_user.name}, ${get_user.spec}: \n https://vk.com/id${get_user.idvk} \n 💳UID: ${get_user.id} \n 💰Галлеоны: ${get_user.gold} \n 🧙Магический опыт: ${get_user.xp} \n 📈Уровень: ${get_user.lvl} \n 🔮Количество артефактов: ${artefact_counter}` )
                    const inventory = await prisma.inventory.findMany({ where: { id_user: get_user?.id } })
                    let cart = ''
                    const underwear = await prisma.trigger.count({ where: {    id_user: get_user.id, name:   'underwear', value:  false } })
                    if (underwear) { cart = '👜 Трусы Домашние;' }
                    if (inventory.length == 0) {
                        await context.send(`✉ Покупки пока не совершались`)
                    } else {
                        for (let i = 0; i < inventory.length; i++) {
                            const element = inventory[i].id_item;
                            const item = await prisma.item.findFirst({ where: { id: element } })
                            cart += `👜 ${item?.name};`
                        }
                        const destructor = cart.split(';').filter(i => i)
                        let compile = []
                        for (let i = 0; i < destructor.length; i++) {
                            let counter = 0
                            for (let j = 0; j < destructor.length; j++) {
                                if (destructor[i] != null) {
                                    if (destructor[i] == destructor[j]) {
                                        counter++
                                    }
                                }
                            }
                            compile.push(`${destructor[i]} x ${counter}\n`)
                            counter = 0
                        }
                        let final: any = Array.from(new Set(compile));
                        await context.send(`✉ Были совершены следующие покупки:: \n ${final.toString().replace(/,/g, '')}`)
                    }
                } else { await context.send(`💡 Нет такого банковского счета!`) }
			} else {
                if (uid.text == "🚫Отмена") { 
                    await context.send(`💡 Операции прерваны пользователем!`) 
                    return await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
                }
				await context.send(`💡 Необходимо ввести корректный UID!`)
			}
		}

        const ans: any = await context.question( `✉ Доступны следующие операции с 💳UID: ${datas[0].id}`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: '+💰', payload: { command: 'gold_up' }, color: 'secondary' })
                .textButton({ label: '—💰', payload: { command: 'gold_down' }, color: 'secondary' }).row()
                .textButton({ label: '+🧙', payload: { command: 'xp_up' }, color: 'secondary' })
                .textButton({ label: '—🧙', payload: { command: 'xp_down' }, color: 'secondary' }).row()
                .textButton({ label: '+💰🧙', payload: { command: 'multi_up' }, color: 'secondary' })
                .textButton({ label: '—💰🧙', payload: { command: 'multi_down' }, color: 'secondary' }).row()
                .textButton({ label: '⚙', payload: { command: 'sub_menu' }, color: 'secondary' })
                .textButton({ label: '🔙', payload: { command: 'back' }, color: 'secondary' }).row()
                .textButton({ label: '☠', payload: { command: 'user_delete' }, color: 'secondary' })
                .oneTime().inline(),
                answerTimeLimit                                                                       
            }
        )
        if (ans.isTimeout) { return await context.send(`⏰ Время ожидания на ввод операции с 💳UID: ${datas[0].id} истекло!`) }
        if (ans.payload && ans.payload.command != 'back') {
            const config: any = {
                'gold_up': Gold_Up,
                'gold_down': Gold_Down,
                'xp_up': Xp_Up,
                'xp_down': Xp_Down,
                'back': Back,
                'sub_menu': Sub_Menu,
                'multi_up': Multi_Up,
                'multi_down': Multi_Down
            }
            const answergot = await config[ans.payload.command](Number(datas[0].id))
        } else {
            await context.send(`⚙ Операция отменена пользователем.`)
        }
        await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)

        //Модуль редактирования персонажей
        async function Editor(id: number) {
            let answer_check = false
            while (answer_check == false) {
                const answer1: any = await context.question(`⌛ Переходим в режим редактирования данных, выберите сие злодейство: `,
                    {
                        keyboard: Keyboard.builder()
                        .textButton({ label: '✏Положение', payload: { command: 'edit_class' }, color: 'secondary' }).row()
                        .textButton({ label: '✏Специализация', payload: { command: 'edit_spec' }, color: 'secondary' }).row()
                        .textButton({ label: '✏ФИО', payload: { command: 'edit_name' }, color: 'secondary' }).row()
                        .textButton({ label: '🔙', payload: { command: 'back' }, color: 'secondary' })
                        .oneTime().inline(),
                        answerTimeLimit
                    }
                )
                if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания на корректировку данных юзера истекло!`) }
                if (!answer1.payload) {
                    await context.send(`💡 Жмите только по кнопкам с иконками!`)
                } else {
                    if (answer1.payload && answer1.payload.command != 'back') {
                        answer_check = true
                        const config: any = {
                            'edit_class': Edit_Class,
                            'edit_spec': Edit_Spec,
                            'edit_name': Edit_Name
                        }
                        await config[answer1.payload.command](id)
                    } else {
                        answer_check = true
                        await context.send(`⚙ Отмена редактирования`)
                    }
                }
            }
        }
        async function Edit_Name(id: number){
            const user: any = await prisma.user.findFirst({
                where: {
                    id: id
                }
            })
            let name_check = false
            while (name_check == false) {
                const name: any = await context.question(`🧷 Укажите имя в Хогвартс Онлайн. Для ${user.name}. Введите новое имя до 64 символов:`, timer_text)
                if (name.isTimeout) { return await context.send(`⏰ Время ожидания на изменение имени для ${user.name} истекло!`) }
                if (name.text.length <= 64) {
                    name_check = true
                    const update_name = await prisma.user.update({ where: { id: user.id }, data: { name: name.text } })
                    if (update_name) {
                        await context.send(`⚙ Для пользователя 💳UID которого ${user.id}, произведена смена имени с ${user.name} на ${update_name.name}.`)
                        try {
                            await vk.api.messages.send({
                                user_id: user.idvk,
                                random_id: 0,
                                message: `⚙ Ваше имя в Хогвартс Онлайн изменилось с ${user.name} на ${update_name.name}.`
                            })
                            await context.send(`⚙ Операция смены имени пользователя завершена успешно.`)
                        } catch (error) {
                            console.log(`User ${user.idvk} blocked chating with bank`)
                        }
                        await vk.api.messages.send({
                            peer_id: chat_id,
                            random_id: 0,
                            message: `⚙ @id${context.senderId}(Admin) > "✏👤ФИО" > имя изменилось с ${user.name} на ${update_name.name} для @id${user.idvk}(${user.name})`
                        })
                    }
                    if (name.text.length > 32) {
                        await context.send(`⚠ Новые инициалы не влезают на стандартный бланк (32 символа)! Придется использовать бланк повышенной ширины, с доплатой 1G за каждый не поместившийся символ.`)
                    }
                } else {
                    await context.send(`⛔ Новое ФИО не влезают на бланк повышенной ширины (64 символа), и вообще, запрещены магическим законодательством! Заставим его/ее выплатить штраф в 30G или с помощию ОМОНА переехать в Азкабан.`)
                }
            }
        }
        async function Edit_Class(id: number){
            const user: any = await prisma.user.findFirst({ where: { id: id } })
            let answer_check = false
            while (answer_check == false) {
                const answer1: any = await context.question(`🧷 Укажите положение в Хогвартс Онлайн для ${user.name}, имеющего текущий статус: ${user.class}. `,
                    {
                        keyboard: Keyboard.builder()
                        .textButton({ label: 'Ученик', payload: { command: 'grif' }, color: 'secondary' })
                        .textButton({ label: 'Профессор', payload: { command: 'coga' }, color: 'secondary' })
                        .textButton({ label: 'Житель', payload: { command: 'sliz' }, color: 'secondary'})
                        .oneTime().inline(),
                        answerTimeLimit
                    }
                )
                if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания на изменение положения для ${user.name} истекло!`) }
                if (!answer1.payload) {
                    await context.send(`💡 Жмите только по кнопкам с иконками!`)
                } else {
                    const update_class = await prisma.user.update({ where: { id: user.id }, data: { class: answer1.text } })
                    if (update_class) {
                        await context.send(`⚙ Для пользователя 💳UID которого ${user.id}, произведена смена положения с ${user.class} на ${update_class.class}.`)
                        try {
                            await vk.api.messages.send({
                                user_id: user.idvk,
                                random_id: 0,
                                message: `⚙ Ваше положение в Хогвартс Онлайн изменилось с ${user.class} на ${update_class.class}.`
                            })
                            await context.send(`⚙ Операция смены положения пользователя завершена успешно.`)
                        } catch (error) {
                            console.log(`User ${user.idvk} blocked chating with bank`)
                        }
                        await vk.api.messages.send({
                            peer_id: chat_id,
                            random_id: 0,
                            message: `⚙ @id${context.senderId}(Admin) > "✏👤Положение" > положение изменилось с ${user.class} на ${update_class.class} для @id${user.idvk}(${user.name})`
                        })
                    }
                    answer_check = true
                }
            }
        }
        async function Edit_Spec(id: number){
            const user: any = await prisma.user.findFirst({ where: { id: id } })
            let spec_check = false
		    while (spec_check == false) {
                const spec: any = await context.question(`🧷 Укажите специализацию в Хогвартс Онлайн. Для ${user.name}.Если он/она профессор/житель, введите должность. Если студент(ка), укажите факультет. \nТекущая специализация: ${user.spec}\nВведите новую:`, timer_text)
                if (spec.isTimeout) { return await context.send(`⏰ Время ожидания на изменение специализации для ${user.name} истекло!`) }
                if (spec.text.length <= 32) {
                    spec_check = true
                    const update_spec = await prisma.user.update({ where: { id: user.id }, data: { spec: spec.text } })
                    if (update_spec) {
                        await context.send(`⚙ Для пользователя 💳UID которого ${user.id}, произведена смена специализации с ${user.spec} на ${update_spec.spec}.`)
                        try {
                            await vk.api.messages.send({
                                user_id: user.idvk,
                                random_id: 0,
                                message: `⚙ Ваша специализация в Хогвартс Онлайн изменилась с ${user.spec} на ${update_spec.spec}.`
                            })
                            await context.send(`⚙ Операция смены специализации пользователя завершена успешно.`)
                        } catch (error) {
                            console.log(`User ${user.idvk} blocked chating with bank`)
                        }
                        await vk.api.messages.send({
                            peer_id: chat_id,
                            random_id: 0,
                            message: `⚙ @id${context.senderId}(Admin) > "✏👤Специализация" > специализация изменилась с ${user.spec} на ${update_spec.spec} для @id${user.idvk}(${user.name})`
                        })
                    }
                } else {
                    await context.send(`💡 Ввведите до 32 символов включительно!`)
                }
            }
        }

        //Модуль уничтожения персонажа
        async function User_delete(id: number) {
            const user_get: any = await prisma.user.findFirst({ where: { id: id } })
            const confirmq = await context.question(`⁉ Вы уверены, что хотите удалить клиента ${user_get.name}`,
                {
                    keyboard: Keyboard.builder()
                    .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
                    .textButton({ label: 'Нет', payload: { command: 'gold_down' }, color: 'secondary' })
                    .oneTime().inline(),
                    answerTimeLimit
                }
            )
            if (confirmq.isTimeout) { return await context.send(`⏰ Время ожидания на подтверждение удаления ${user_get.name} истекло!`) }
            if (confirmq.payload.command === 'confirm' && user_get) {
                if (user_get) {
                    const user_del = await prisma.user.delete({ where: { id: id } })
                    await context.send(`❗ Удален пользователь ${user_del.name}`)
                    if (user_del) {
                        const check_bbox = await prisma.blackBox.findFirst({ where: { idvk: user_del.idvk } })
                        if (!check_bbox) {
                            const add_bbox = await prisma.blackBox.create({ data: { idvk: user_del.idvk } })
                            add_bbox ? await context.send(`⚙ @id${user_del.idvk}(${user_del.name}) теперь является нелегалом.`) : await context.send(`⚙ @id${user_del.idvk}(${user_del.name}) не смог стать нелегалом.`)
                        } else {
                            await context.send(`⚙ @id${user_del.idvk}(${user_del.name}) депортируется НА РОДИНУ уже не в первый раз.`)
                        }
                        try {
                            await vk.api.messages.send({
                                user_id: user_del.idvk,
                                random_id: 0,
                                message: `❗ Ваша карточка 💳UID: ${user_del.id} больше не действительна. Спасибо, что пользовались банком Гринготтс 🏦, ${user_del.name}. Возвращайтесь к нам снова!`
                            })
                            await context.send(`⚙ Операция удаления пользователя завершена успешно.`)
                        } catch (error) {
                            console.log(`User ${user_del.idvk} blocked chating with bank`)
                        }
                        await vk.api.messages.send({
                            peer_id: chat_id,
                            random_id: 0,
                            message: `⚙ @id${context.senderId}(Admin) > "🚫👤" > удаляется из банковской системы карточка @id${user_del.idvk}(${user_del.name})`
                        })
                    }
                    console.log(`Admin ${context.senderId} deleted user: ${user_del.idvk}`)
                } 
            } else {
                await context.send(`⚙ Удаление ${user_get.name} отменено.`)
            }
        }
        //Модуль артефактов
        async function Artefact_Add(id: number, count: number) {
            let datas: any = []
            let trigger = false
            while (trigger == false) {
                const name: any = await context.question(`⌛ Внимание! запущена процедура генерации Артефакта для банковского счёта 💳:${id} \n 🧷 Укажите для нового 🔮артефакта название: `, timer_text)
                if (name.isTimeout) { return await context.send(`⏰ Время ожидания на задание имени артефакта истекло!`) }
                if (name.text.length <= 30) {
                    trigger = true
                    datas.push({name: `${name.text}`})
                } else {
                    await context.send(`💡 Ввведите до 30 символов включительно!`)
                }
            }

            trigger = false
            while (trigger == false) {
                const type: any = await context.question(`🧷 Укажите для нового 🔮артефакта тип применения: \n 🕐 — одноразовое; ♾ — многоразовое. `,
                    {
                        keyboard: Keyboard.builder()
                        .textButton({ label: '🕐', payload: { command: 'Одноразовый' }, color: 'secondary' })
                        .textButton({ label: '♾', payload: { command: 'Многоразовый' }, color: 'secondary' })
                        .oneTime().inline(),
                        answerTimeLimit
                    }
                )
                if (type.isTimeout) { return await context.send(`⏰ Время ожидания на задание типа артефакта истекло!`) }
                if (type.payload) {
                    trigger = true
                    datas.push({label: `${type.text}`})
                    datas.push({type: `${type.payload.command}`})
                } else {
                    await context.send(`💡 Может лучше по кнопочкам жать?`)
                }
            }

            trigger = false
            while (trigger == false) {
                const description: any = await context.question(`🧷 Укажите для нового 🔮артефакта ссылку на картинку самого артефакта из альбома группы Хогвартс Онлайн:`, timer_text)
                if (description.isTimeout) { return await context.send(`⏰ Время ожидания на задание ссылки артефакта истекло!`) }
                if (description.text.length <= 1000) {
                    trigger = true
                    datas.push({description: `${description.text}`})
                } else {
                    await context.send(`💡 Ввведите до 1000 символов включительно!`)
                }
            }
            const target: any = await prisma.user.findFirst({ where: { id } })
            const artefact_create = await prisma.artefact.create({ data: { id_user: id, name: datas[0].name, label: datas[1].label, type: datas[2].type, description: datas[3].description } })
            try {
                await vk.api.messages.send({
                    user_id: target.idvk,
                    random_id: 0,
                    message: `⚙ Поздравляем! Вы получили новый 🔮: ${artefact_create.name} \n ${artefact_create.label}: ${artefact_create.type} `
                })
                await context.send(`⚙ Добавление артефакта успешно завершено`)
            } catch (error) {
                console.log(`User ${target.idvk} blocked chating with bank`)
            }
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(Admin) > "➕🔮" > артефакт ${artefact_create.name} получает @id${target.idvk}(${target.name})`
            })
            console.log(`Admin ${context.senderId} create artefact for user: ${target.idvk}`)
            await context.send(`⚙ Операция завершена успешно`)
        }

        //Модуль вовзврата
        async function Back(id: number, count: number) {
            console.log(`Admin ${context.senderId} canceled operation for user UID: ${id}`)
            await context.send(`⚙ Операция отменена пользователем.`)
        }

        //Модуль обработки ввода пользователем 
        async function Ipnut_Gold() {
            let golden: number = 0
            let money_check = false
            while (money_check == false) {
                const gold: any = await context.question(`🧷 Введите количество для операции ${ans.text}: `, timer_text_oper)
                if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание количества ${ans.text} истекло!`); return golden }
                if (typeof Number(gold.text) == "number") {
                    money_check = true
                    golden = Number(gold.text)
                } 
            }
            return golden
        }
        async function Ipnut_Message() {
            let golden = ''
            let money_check = false
            while (money_check == false) {
                const gold = await context.question(`🧷 Введите уведомление пользователю ${ans.text}:`, timer_text_oper)
                if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание уведомления пользователю ${ans.text} истекло!`); return "Уведомление приняло ИСЛАМ!" }
                if (gold.text) {
                    money_check = true
                    golden = gold.text
                } 
            }
            return golden
        }

        // Модуль отображения инвентаря и артефактов
        async function Artefact_Show(id: number) { 
            const artefact = await prisma.artefact.findMany({ where: { id_user: id } })
            if (artefact.length > 0) {
                artefact.forEach(async element => {
                    await context.send(`💬: ${element.name} \n 🔧: ${element.type}${element.label} \n 🧷:  ${element.description} `,
                        {
                            keyboard: Keyboard.builder()
                            .textButton({ label: 'Удалить🔮', payload: { command: `${element.id}` }, color: 'secondary' })
                            .oneTime().inline()
                        }
                    )
                });
            } else {
                await context.send(`✉ Артефакты отсутствуют =(`)
            }
            console.log(`Admin ${context.senderId} see artefacts from user UID: ${id}`)
        }
        async function Inventory_Show(id: number) { 
            const artefact = await prisma.inventory.findMany({ where: { id_user: id } })
            if (artefact.length > 0) {
                for(const element of artefact) {
                    const item: any = await prisma.item.findFirst({ where: { id: element.id_item }, include: { category: true } })
                    await context.send(`💬: ${item.name}-${element.id} \n 🔧: ${item.category.name}-${item.price}💰`,
                        {
                            keyboard: Keyboard.builder()
                            .textButton({ label: 'Удалить👜', payload: { command: `${element.id}` }, color: 'secondary' })
                            .oneTime().inline()
                        }
                    )
                }
            } else {
                await context.send(`✉ Товары отсутствуют =(`)
            }
            console.log(`Admin ${context.senderId} see artefacts from user UID: ${id}`)
        }

        //Модуль мульти начислений
        async function Multi_Up(id: number) {
            await context.send(`⚠ Приступаем к начислению галлеонов`)
            const gold: number = await Ipnut_Gold() 
            await context.send(`⚠ Приступаем к начислению магического опыта`)
            const xp: number = await Ipnut_Gold()
            const messa: string = await Ipnut_Message()
            const user_get: User | null = await prisma.user.findFirst({ where: { id } })
            const money_put = await prisma.user.update({ where: { id: user_get?.id }, data: { gold: { increment: gold }, xp: { increment: xp } } })
            try {
                await vk.api.messages.send({
                    user_id: user_get?.idvk,
                    random_id: 0,
                    message: `⚙ Вам начислено ${gold}💰 ${xp}🧙. \n\nВаш счёт:\n${money_put.gold}💰\n${money_put.xp}🧙\n\n Уведомление: ${messa}`
                })
                await context.send(`⚙ Операция завершена успешно`)
            } catch (error) {
                console.log(`User ${user_get?.idvk} blocked chating with bank`)
            }
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(Admin) > "+💰🧙" >\n${user_get?.gold}+${gold}=${money_put.gold}💰\n${user_get?.xp}+${xp}=${money_put.xp}🧙\n для @id${user_get?.idvk}(${user_get?.name}) 🧷: ${messa}`
            })
            console.log(`User ${user_get?.idvk} got ${gold} gold and ${xp} xp. Him/Her bank now ${money_put.gold}`)
        }
        async function Multi_Down(id: number) {
            await context.send(`⚠ Приступаем к снятию галлеонов`)
            const gold: number = await Ipnut_Gold() 
            await context.send(`⚠ Приступаем к снятию магического опыта`)
            const xp: number = await Ipnut_Gold()
            const messa: string = await Ipnut_Message()
            const user_get: User | null = await prisma.user.findFirst({ where: { id } })
            const money_put = await prisma.user.update({ where: { id: user_get?.id }, data: { gold: { decrement: gold }, xp: { decrement: xp } } })
            try {
                await vk.api.messages.send({
                    user_id: user_get?.idvk,
                    random_id: 0,
                    message: `⚙ С вас снято ${gold}💰 ${xp}🧙. \n\nВаш счёт:\n${money_put.gold}💰\n${money_put.xp}🧙\n\n Уведомление: ${messa}`
                })
                await context.send(`⚙ Операция завершена успешно`)
            } catch (error) {
                console.log(`User ${user_get?.idvk} blocked chating with bank`)
            }
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(Admin) > "-💰🧙" >\n${user_get?.gold}-${gold}=${money_put.gold}💰\n${user_get?.xp}-${xp}=${money_put.xp}🧙\n для @id${user_get?.idvk}(${user_get?.name}) 🧷: ${messa}`
            })
            console.log(`User ${user_get?.idvk} left ${gold} gold and ${xp} xp. Him/Her bank now ${money_put.gold}`)
        }
        //Модуль начислений
        async function Gold_Up(id: number) {
            const count: number = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
            const user_get: any = await prisma.user.findFirst({ where: { id } })
            const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { gold: user_get.gold + count } })
            try {
                await vk.api.messages.send({
                    user_id: user_get.idvk,
                    random_id: 0,
                    message: `⚙ Вам начислено ${count}💰. \nВаш счёт: ${money_put.gold}💰 \n Уведомление: ${messa}`
                })
                await context.send(`⚙ Операция завершена успешно`)
            } catch (error) {
                console.log(`User ${user_get.idvk} blocked chating with bank`)
            }
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(Admin) > "+💰" > ${money_put.gold-count}💰+${count}💰=${money_put.gold}💰 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
            })
            console.log(`User ${user_get.idvk} got ${count} gold. Him/Her bank now ${money_put.gold}`)
        }
        async function Gold_Down(id: number) {
            const count: number = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
            const user_get: any = await prisma.user.findFirst({ where: { id } })
            if (user_get.gold-count >= 0) {
                const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { gold: user_get.gold - count } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get.idvk,
                        random_id: 0,
                        message: `⚙ С вас снято ${count}💰. \nВаш счёт: ${money_put.gold}💰 \n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get.idvk} blocked chating with bank`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `⚙ @id${context.senderId}(Admin) > "-💰" > ${money_put.gold+count}💰-${count}💰=${money_put.gold}💰 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                })
                console.log(`User ${user_get.idvk} lost ${count} gold. Him/Her bank now ${money_put.gold}`)
            } else {
                const confirmq = await context.question(`⌛ Вы хотите снять ${count} 💰галлеонов c счета ${user_get.name}, но счет этого ${user_get.spec} ${user_get.gold}. Уверены, что хотите сделать баланс: ${user_get.gold-count}`,
                    {
                        keyboard: Keyboard.builder()
                        .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
                        .textButton({ label: 'Нет', payload: { command: 'gold_down' }, color: 'secondary' })
                        .oneTime().inline(),
                        answerTimeLimit
                    }
                )
                if (confirmq.isTimeout) { return await context.send(`⏰ Время ожидания на снятие галлеонов с ${user_get.name} истекло!`) }
                if (confirmq.payload.command === 'confirm') {
                    const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { gold: user_get.gold - count } })
                    try {
                        await vk.api.messages.send({
                            user_id: user_get.idvk, random_id: 0,
                            message: `⚙ С вас снято ${count}💰. \nВаш счёт: ${money_put.gold}💰 \n Уведомление: ${messa}`
                        })
                        await context.send(`⚙ Операция завершена успешно`)
                    } catch (error) {
                        console.log(`User ${user_get.idvk} blocked chating with bank`)
                    }
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `⚙ @id${context.senderId}(Admin) > "-💰" > ${money_put.gold+count}💰-${count}💰=${money_put.gold}💰 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                    })
                    console.log(`User ${user_get.idvk} lost ${count} gold. Him/Her bank now ${money_put.gold}`)
                } else {
                    await context.send(`💡 Нужно быть жестче! Греби бабло`)
                }
            }
        }
        async function Xp_Up(id: number) {
            const count: number = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
            const user_get: any = await prisma.user.findFirst({ where: { id } })
            const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { xp: user_get.xp + count } })
            try {
                await vk.api.messages.send({
                    user_id: user_get.idvk,
                    random_id: 0,
                    message: `⚙ Вам начислено ${count}🧙. \nВаш МО: ${money_put.xp}🧙 \n Уведомление: ${messa}`
                })
                await context.send(`⚙ Операция завершена успешно`)
            } catch (error) {
                console.log(`User ${user_get.idvk} blocked chating with bank`)
            }
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(Admin) > "+🧙" > ${money_put.xp-count}🧙+${count}🧙=${money_put.xp}🧙 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
            })
            console.log(`User ${user_get.idvk} got ${count} MO. Him/Her XP now ${money_put.xp}`)
        }
        async function Xp_Down(id: number) {
            const count: number = await Ipnut_Gold() 
            if (count === 0) { return }
            const messa: string = await Ipnut_Message()
            const user_get: any = await prisma.user.findFirst({ where: { id } })
            if (user_get.xp-count >= 0) {
                const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { xp: user_get.xp - count } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get.idvk,
                        random_id: 0,
                        message: `⚙ С вас снято ${count}🧙. \nВаш МО: ${money_put.xp}🧙  \n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get.idvk} blocked chating with bank`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `⚙ @id${context.senderId}(Admin) > "-🧙" > ${money_put.xp+count}🧙-${count}🧙=${money_put.xp}🧙 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                })
                console.log(`User ${user_get.idvk} lost ${count} MO. Him/Her XP now ${money_put.xp}`)
            } else {
                await context.send(`⌛ Вы хотите снять ${count} 🧙магического опыта c счета ${user_get.name}, но счет этого ${user_get.spec} ${user_get.xp}. Уверены, что хотите сделать баланс: ${user_get.xp-count}? (Автоподтверждение)`)
                const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { xp: user_get.xp - count } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get.idvk,
                        random_id: 0,
                        message: `⚙ С вас снято ${count}🧙. \nВаш МО: ${money_put.xp}🧙  \n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get.idvk} blocked chating with bank`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `⚙ @id${context.senderId}(Admin) > "-🧙" > ${money_put.xp+count}🧙-${count}🧙=${money_put.xp}🧙 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                })
                console.log(`User ${user_get.idvk} lost ${count} MO. Him/Her XP now ${money_put.xp}`)
            }
        }

        //Модуль доп клавиатуры
        async function Sub_Menu(id: number) {
            const ans_again: any = await context.question( `✉ Доступны следующие операции с 💳UID: ${datas[0].id}`,
                {   
                    keyboard: Keyboard.builder()
                    .textButton({ label: '➕🔮', payload: { command: 'artefact_add' }, color: 'secondary' })
                    .textButton({ label: '👁🔮', payload: { command: 'artefact_show' }, color: 'secondary' }).row()
                    .textButton({ label: '✏', payload: { command: 'editor' }, color: 'secondary' })
                    .textButton({ label: '👁👜', payload: { command: 'inventory_show' }, color: 'secondary' }).row()
                    .textButton({ label: '🔙', payload: { command: 'back' }, color: 'secondary' }).row()
                    .textButton({ label: '☠', payload: { command: 'user_delete' }, color: 'secondary' })
                    .oneTime().inline(),
                    answerTimeLimit                                                                       
                }
            )
            if (ans_again.isTimeout) { return await context.send(`⏰ Время ожидания на ввод операции с 💳UID: ${datas[0].id} истекло!`) }
            if (ans_again.payload && ans_again.payload.command != 'back') {
                const config: any = {
                    'back': Back,
                    'artefact_add': Artefact_Add,
                    'artefact_show': Artefact_Show,
                    'inventory_show': Inventory_Show,
                    'user_delete': User_delete,
                    'editor': Editor,
                }
                const answergot = await config[ans_again.payload.command](Number(datas[0].id))
            } else {
                await context.send(`⚙ Операция отменена пользователем.`)
            }
        }
    })
    //Обработчики удаления инвентаря и артефактов
    hearManager.hear(/Удалить👜/, async (context) => {
        if (context.messagePayload == null) {
            return
        }
        const art_get: any = await prisma.inventory.findFirst({ where: { id: Number(context.messagePayload.command) } })
        const item: any = await prisma.item.findFirst({ where: { id: art_get.id_item } })
        if (art_get) {
            const art_del = await prisma.inventory.delete({ where: { id: Number(context.messagePayload.command) } })
            await context.send(`⚙ Удален товар ${item.name}-${art_del.id}`)
            const user_find = await prisma.user.findFirst({ where: { id: art_del.id_user } })
            if (user_find) {
                try {
                    await vk.api.messages.send({
                        user_id: user_find.idvk,
                        random_id: 0,
                        message: `⚙ Ваш товар ${item.name} пожертвовали в АЗКАБАН!`
                    })
                    await context.send(`⚙ Удаление товара успешно завершено`)
                } catch (error) {
                    console.log(`User ${user_find.idvk} blocked chating with bank`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `⚙ @id${context.senderId}(Admin) > "🚫👜" > товар ${item.name} пожертвовали в Азкабан! у @id${user_find.idvk}(${user_find.name})`
                })
            }
            console.log(`Admin ${context.senderId} destroy item from user UID: ${user_find?.idvk}`)
        }
        await Keyboard_Index(context, '💡 Был товар, нееет товара!')
    })
    hearManager.hear(/Удалить🔮/, async (context) => {
        if (context.messagePayload == null) {
            return
        }
        const art_get: any = await prisma.artefact.findFirst({ where: { id: Number(context.messagePayload.command) } })
        if (art_get) {
            const art_del = await prisma.artefact.delete({ where: { id: Number(context.messagePayload.command) } })
            await context.send(`⚙ Удален артефакт ${art_del.name}`)
            const user_find = await prisma.user.findFirst({ where: { id: art_del.id_user } })
            if (user_find) {
                try {
                    await vk.api.messages.send({
                        user_id: user_find.idvk,
                        random_id: 0,
                        message: `⚙ Ваш артефакт ${art_del.name} изъял ОМОН!`
                    })
                    await context.send(`⚙ Удаление артефакта успешно завершено`)
                } catch (error) {
                    console.log(`User ${user_find.idvk} blocked chating with bank`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `⚙ @id${context.senderId}(Admin) > "🚫🔮" > артефакт ${art_del.name} изьял ОМОН! у @id${user_find.idvk}(${user_find.name})`
                })
            }
            console.log(`Admin ${context.senderId} destroy artefact from user UID: ${user_find?.idvk}`)
        }
        await Keyboard_Index(context, '💡 Был артефакт, нееет артефакта!')
    })

    hearManager.hear(/админка/, async (context: any) => {
        if (context.senderId == root) {
            const user:any = await prisma.user.findFirst({ where: { idvk: Number(context.senderId) } })
            const lvlup = await prisma.user.update({ where: { id: user.id }, data: { id_role: 2 } })
            if (lvlup) {
                await context.send(`⚙ Рут права получены`)
            } else {
                await context.send(`⚙ Ошибка`)
            }
        }
        await vk.api.messages.send({
            peer_id: chat_id,
            random_id: 0,
            message: `⚙ @id${context.senderId}(Root) становится администратором!)`
        })
        console.log(`Super user ${context.senderId} got root`)
        await Keyboard_Index(context, `💡 Захват мира снова в теме!`)
    })
    hearManager.hear(/права/, async (context: any) => {
        if (context.senderId == root) {
            const uid = await context.question(`🧷 Введите 💳UID банковского счета получателя:`, timer_text)
            if (uid.isTimeout) { return await context.send(`⏰ Время ожидания ввода банковского счета истекло!`) }
			if (uid.text) {
                const get_user = await prisma.user.findFirst({ where: { id: Number(uid.text) } })
                if (get_user) {
                    const artefact_counter = await prisma.artefact.count({ where: { id_user: Number(uid.text) } })
                    const role: any = await prisma.role.findFirst({ where: { id: get_user.id_role } })
                    await context.send(`✉ Открыта следующая карточка: ${get_user.class} ${get_user.name}, ${get_user.spec}: \n\n 💳UID: ${get_user.id} \n 💰Галлеоны: ${get_user.gold} \n 🧙Магический опыт: ${get_user.xp} \n 📈Уровень: ${get_user.lvl} \n 🔮Количество артефактов: ${artefact_counter}\n \n Права пользователя: ${role.name} `)
                    const answer1 = await context.question(`⌛ Что будем делать?`,
                        {
                            keyboard: Keyboard.builder()
                            .textButton({ label: 'Дать админку', payload: { command: 'access' }, color: 'secondary' })
                            .textButton({ label: 'Снять админку', payload: { command: 'denied' }, color: 'secondary' }).row()
                            .textButton({ label: 'Ничего не делать', payload: { command: 'cancel' }, color: 'secondary' })
                            .oneTime().inline(),
                            answerTimeLimit
                        }
                    )
                    if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания изменения прав истекло!`) }
                    if (!answer1.payload) {
                        await context.send(`💡 Жмите только по кнопкам с иконками!`)
                    } else {
                        if (answer1.payload.command === 'access') {
                            const lvlup = await prisma.user.update({ where: { id: get_user.id }, data: { id_role: 2 } })
                            if (lvlup) {
                                await context.send(`⚙ Администратором становится ${get_user.name}`)
                                try {
                                    await vk.api.messages.send({
                                        user_id: get_user.idvk,
                                        random_id: 0,
                                        message: `⚙ Вас назначили администратором`
                                    })
                                    await context.send(`⚙ Операция назначения администратора завершена успешно.`)
                                } catch (error) {
                                    console.log(`User ${get_user.idvk} blocked chating with bank`)
                                }
                                await vk.api.messages.send({
                                    peer_id: chat_id,
                                    random_id: 0,
                                    message: `⚙ @id${context.senderId}(Root) > делает администратором @id${get_user.idvk}(${get_user.name})`
                                })
                                console.log(`Admin ${context.senderId} set status admin for ${get_user.idvk}`)
                            } else {
                                await context.send(`💡 Ошибка`)
                            }
                        }
                        if (answer1.payload.command === 'denied') {
                            const lvlup = await prisma.user.update({ where: { id: get_user.id }, data: { id_role: 1 } })
                            if (lvlup) {
                                await context.send(`⚙ Обычным пользователем становится ${get_user.name}`)
                                try {
                                    await vk.api.messages.send({
                                        user_id: get_user.idvk,
                                        random_id: 0,
                                        message: `⚙ Вас понизили до обычного пользователя`
                                    })
                                    await context.send(`⚙ Операция назначения пользователем завершена успешно.`)
                                } catch (error) {
                                    console.log(`User ${get_user.idvk} blocked chating with bank`)
                                }
                                await vk.api.messages.send({
                                    peer_id: chat_id,
                                    random_id: 0,
                                    message: `⚙ @id${context.senderId}(Root) > делает обычным пользователем @id${get_user.idvk}(${get_user.name})`
                                })
                                console.log(`Admin ${context.senderId} drop status admin for ${get_user.idvk}`)
                            } else {
                                await context.send(`💡 Ошибка`)
                            }
                        }
                        if (answer1.payload.command === 'cancel') {
                            await context.send(`💡 Тоже вариант`)
                        }
                    }
                }
			} else {
				await context.send(`💡 Нет такого банковского счета!`)
			}
        }
        await Keyboard_Index(context, `💡 Повышение в должности, не всегда понижение!`)
    })
    hearManager.hear(/енотик/, async (context: any) => {
        if (await Accessed(context) == 2) {
            await context.sendDocuments({ value: `./prisma/dev.db`, filename: `dev.db` }, { message: '💡 Открывать на сайте: https://sqliteonline.com/' } );
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `‼ @id${context.senderId}(Admin) делает бекап баз данных dev.db.`
            })
        }
    })
    hearManager.hear(/!банк|!Банк/, async (context: any) => {
        const user_count = await prisma.user.count()
		const sums: any = await prisma.user.aggregate({ _sum: { gold: true, lvl: true, xp: true } })
		const artefacts: any = await prisma.artefact.count()
        const achievement: any = await prisma.achievement.count()
        const user_check: any = await prisma.user.findFirst({ where: { idvk: context.senderId } })
        const artefact_counter = await prisma.artefact.count({ where: { id_user: user_check.id } })
        const achievement_counter = await prisma.achievement.count({ where: { id_user: user_check.id } })
		await Image_Random(context, "bank")
		if (user_check.id_role != 1) {
			await Keyboard_Index(context, `🏦 Банк Гринготтс Онлайн 1.19v:\n👥 ${user_count}\n💰 ${sums._sum.gold}\n🧙 ${sums._sum.lvl*150+sums._sum.xp}\n🔮 ${artefacts}\n🌟 ${achievement}\n\n`)
		} else {
			await Keyboard_Index(context, `🏦 Банк Гринготтс Онлайн 1.19v:\n👥 ${user_check.name}\n💰 ${user_check.gold}\n🧙 ${user_check.lvl*150+user_check.xp}\n🔮 ${artefact_counter}\n🌟 ${achievement_counter} \n\n`)
		}
		const user_inf = await User_Info(context)
		await context.send(`${user_inf.first_name}, чтобы авторизоваться, нажмите кнопку под этим сообщением!`, {
			keyboard: new KeyboardBuilder().callbackButton({
				label: '✅ Подтвердить авторизацию',
				payload: {
					command: 'system_call',
					item: 'coffee'
				}
			}).inline()
		})
    })
}

    