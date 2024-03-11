import { Category, Inventory, Item, User } from "@prisma/client"
import prisma from "./prisma_client"
import { KeyboardBuilder } from "vk-io"
import { Image_Interface, Image_Random } from "../../core/imagecpu"
import { chat_id, vk } from "../../.."
import { Analyzer_Buying_Counter } from "./analyzer"

async function Searcher(data: any, target: number) {
    let counter = 0
    while (data.length != counter) {
        if (data[counter].id_item == target) {
            return true
        }
        counter++
    }
    return false
}
/*export async function Gen_Inline_Button_Item(category: any, context: any) {
    await context.send(`⌛ Вы оказались в ${category.name}`)
    const user: any = await prisma.user.findFirst({ where: {    idvk: context.senderId  }   })
    const data: any= await prisma.item.findMany({   where: {    id_category: Number(category.id)    }   })
    let stopper = false
	let modif: number = 0
	const lim = 3 
    while (stopper == false) {
        let i = modif
        let counter = 0
        const inventory: any = await prisma.inventory.findMany({    where: {    id_user: user.id    }   })
        const item_render = []
        for (let j = modif; j < modif+3 && j < data.length; j++) {
            item_render.push({ name: data[j].name, price: `${data[j].price}G` })
        }
        await Image_Interface(item_render, context)
        let keyboard = Keyboard.builder()
        while (i < data.length && counter <lim) {
            const checker = await Searcher(inventory, data[i].id)
            
            if (checker && data[i].type != 'unlimited') {
                const text = `✅${data[i].name}`
                keyboard
                .textButton({   label: text.slice(0,40),
                                payload: {  command: `null`, operation: 'cant byuing'  },
                                color: 'positive'                           })
                .row()
            } else {
                const text = `🛒${data[i].price}💰 - ${data[i].name}`
                keyboard
                .textButton({   label: text.slice(0,40),
                                payload: {  command: `${i}`, operation: 'byuing'  },
                                color: 'secondary'                          })
                .row()
            }
            counter++
            i++
        }
        await context.send(`🛍 Чего желаете?`, { keyboard: keyboard.oneTime().inline() } )
        const  push = await context.question('🧷 Быстрый доступ',
            { keyboard: Keyboard.builder()
                .textButton({   label: '<',
                                payload: { command: "left" },
                                color: 'primary'              })
                .textButton({   label: `${(modif+3)/3}/${Math.round(data.length/3)}`,
                                payload: { command: "terminal" },
                                color: 'primary'              })
                .textButton({   label: '>',
                                payload: { command: 'right' },
                                color: 'primary'              }).row()
                .textButton({   label: 'Назад',
                                payload: { command: 'back' },
                                color: 'primary'              })
                .textButton({   label: 'Закончить',
                                payload: { command: 'end' },
                                color: 'primary'              })
                .oneTime(), answerTimeLimit
            }
        )
        if (push.isTimeout) { await context.send('⏰ Время ожидания выбора товаров истекло!'); return true }
        if (push.payload) {
            if (push.payload.operation == 'byuing') {
                const user: any = await prisma.user.findFirst({ where: { idvk: context.senderId } })
                const item_buy:any = data[push.payload.command]
                const item_inventory:any = await prisma.inventory.findFirst({ where: { id_item: item_buy.id, id_user: user.id } })
                if ((!item_inventory || item_buy.type == 'unlimited') && user.gold >= item_buy.price) {
                    const money = await prisma.user.update({ data: { gold: user.gold - item_buy.price }, where: { id: user.id } })
                    await context.send(`⚙ С вашего счета списано ${item_buy.price}💰, остаток: ${money.gold}💰`)
                    const inventory = await prisma.inventory.create({ data: { id_user: user.id, id_item: item_buy.id } })
                    console.log(`User ${context.senderId} bought new item ${item_buy.id}`)
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `🛍 @id${user.idvk}(${user.name}) покупает "${item_buy.name}" в "${category.name}" Косого переулка`
                    })
                    await context.send(`⚙ Ваша покупка доставится в течение нескольких секунд: ${item_buy.name}`)
                } else {
                    console.log(`User ${context.senderId} can't buy new item ${item_buy.id}`)
                    !item_inventory ? context.send(`💡 У вас  недостаточно средств для покупки ${item_buy.name}!!`) : context.send(`💡 У вас уже есть ${item_buy.name}!`)
                }
            }
            if (push.payload.command == 'back') { await context.send(`⌛ Возврат в Косой переулок...`); return false }
            if (push.payload.command == 'end') { await context.send(`⌛ Шоппинг успешно завершен`); return true }
            if (push.payload.command == 'right') { if (modif+lim < data.length) { modif += lim } }
            if (push.payload.command == 'left') { if (modif-lim >= 0) { modif -= lim } }
        }
    }
}*/

export async function Shop_Enter(context: any) {
    if (context.eventPayload.item == "id") {
        const input = context.eventPayload.value
        const user: User | null = await prisma.user.findFirst({ where: { idvk: context.peerId } })
        if (user) {
            let text = `⌛ Вы оказались в ${input.name}. Ваш баланс: ${user.gold}`
            const data: Item[] = await prisma.item.findMany({ where: { id_category: Number(input.id) } })
            const inventory: Inventory[] = await prisma.inventory.findMany({ where: { id_user: user.id } })
            const item_render = []
            let counter_pict = 0
            let bonus = context.eventPayload.current
            for (let j = bonus; j < data.length; j++) { counter_pict++; if (counter_pict > 3) { continue } item_render.push({ name: data[j].name, price: `${data[j].price}G` }) }
            const attached = await Image_Interface(item_render, context)
            let keyboard = new KeyboardBuilder()
            let counter = 0
            for (let i = bonus; i < data.length; i++) {
                counter++
                if (counter > 3) {continue}
                const checker = await Searcher(inventory, data[i].id)
                if (checker && data[i].type != 'unlimited') {
                    const text = `✅${data[i].name}`
                    keyboard.callbackButton({ label: text.slice(0,40), payload: { command: "shop_bought", item: "id", value: input, current: bonus, item_sub: "item", value_sub: data[i] }, color: 'positive' }).row()
                } else {
                    const text = `🛒${data[i].price}💰 - ${data[i].name}`
                    keyboard.callbackButton({ label: text.slice(0,40), payload: { command: "shop_buy", item: "id", value: input, current: bonus, item_sub: "item", value_sub: data[i] }, color: 'secondary' }).row()
                }
            }
            if (data.length >= 3 && bonus >= 3) {
                keyboard.callbackButton({ label: '<', payload: { command: 'shop_enter', item: "id", value: context.eventPayload.value, current: context.eventPayload.current-3 }, color: 'secondary' })
            }
            if (data.length >= 3 && bonus+3 < data.length) {
                keyboard.callbackButton({ label: '>', payload: { command: 'shop_enter', item: "id", value: context.eventPayload.value, current: context.eventPayload.current+3 }, color: 'secondary' })
            }
            keyboard.callbackButton({ label: '🚫', payload: { command: 'shop_cancel' }, color: 'secondary' })
            .callbackButton({ label: '✅', payload: { command: 'system_call' }, color: 'secondary' }).row().inline().oneTime()
            await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, attachment: attached?.toString()})
            if (context?.eventPayload?.command == "shop_enter") {
                await vk.api.messages.sendMessageEventAnswer({
                    event_id: context.eventId,
                    user_id: context.userId,
                    peer_id: context.peerId,
                    event_data: JSON.stringify({
                        type: "show_snackbar",
                        text: `🔔 Вы в ${input.name}, куда пойдем?`
                    })
                })
            }
        }
    }
}
export async function Shop_Bought(context: any) {
    if (context.eventPayload.command == "shop_bought" && context.eventPayload.item_sub == "item") {
        const input = context.eventPayload.value_sub
        if (context?.eventPayload?.command == "shop_bought") {
            await vk.api.messages.sendMessageEventAnswer({
                event_id: context.eventId,
                user_id: context.userId,
                peer_id: context.peerId,
                event_data: JSON.stringify({
                    type: "show_snackbar",
                    text: `🔔 Вы уже купили ${input.name}`
                })
            })
        }
    }
}
export async function Shop_Buy(context: any) {
    if (context.eventPayload.command == "shop_buy" && context.eventPayload.item_sub == "item") {
        const input = context.eventPayload.value_sub
        const user: any = await prisma.user.findFirst({ where: { idvk: context.peerId } })
        const item_inventory:any = await prisma.inventory.findFirst({ where: { id_item: input.id, id_user: user.id } })
        if ((!item_inventory || input.type == 'unlimited') && user.gold >= input.price) {
            const money = await prisma.user.update({ data: { gold: user.gold - input.price }, where: { id: user.id } })
            const inventory = await prisma.inventory.create({ data: { id_user: user.id, id_item: input.id } })
            console.log(`User ${context.peerId} bought new item ${input.id}`)
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `🛍 @id${user.idvk}(${user.name}) покупает ${input.name}`
            })
            if (context?.eventPayload?.command == "shop_buy") {
                await vk.api.messages.sendMessageEventAnswer({
                    event_id: context.eventId,
                    user_id: context.userId,
                    peer_id: context.peerId,
                    event_data: JSON.stringify({
                        type: "show_snackbar",
                        text: `🔔 Доставлено ${input.name}. Списано: ${input.price}💰`
                    })
                })
            }
            await Analyzer_Buying_Counter(context)
            await Shop_Enter(context)
        } else {
            console.log(`User ${context.peerId} can't buy new item ${input.id}`)
            if (context?.eventPayload?.command == "shop_buy") {
                const ii = !item_inventory || input.type == 'unlimited' ? `💡 У вас  недостаточно средств для покупки ${input.name}!!` : `💡 У вас уже есть ${input.name}!`
                await vk.api.messages.sendMessageEventAnswer({
                    event_id: context.eventId,
                    user_id: context.userId,
                    peer_id: context.peerId,
                    event_data: JSON.stringify({
                        type: "show_snackbar",
                        text: ii
                    })
                })
            }
        }       
    }
}
export async function Shop_Cancel(context: any) {
    await Shop_Category_Enter(context)
    await vk.api.messages.sendMessageEventAnswer({
        event_id: context.eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
            type: "show_snackbar",
            text: `🔔 Возврат в Косой переулок.`
        })
    })
}
export async function Shop_Category_Enter(context: any) {
    const attached = await Image_Random(context, "shop")
    console.log(`User ${context.peerId} enter in shopping`)
    const category: Category[] = await prisma.category.findMany({})
    let text = '✉ Гоблин сопроводил вас в Косой переулок или по крайней мере дал карту...'
    if (category.length == 0) {
        text += `\n ✉ Магазинов еще нет`
    } 
    const keyboard = new KeyboardBuilder()
    for(const i in category) {
        keyboard.callbackButton({ label: `⚓ ${category[i].name}`, payload: { command: "shop_enter", item: "id", value: category[i], current: 0 }, color: 'primary' }).row()
    }
    keyboard.callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, attachment: attached?.toString()})
    if (context?.eventPayload?.command == "shop_category_enter") {
        await vk.api.messages.sendMessageEventAnswer({
            event_id: context.eventId,
            user_id: context.userId,
            peer_id: context.peerId,
            event_data: JSON.stringify({
                type: "show_snackbar",
                text: `🔔 Вы в косом переулке, куда пойдем?`
            })
        })
    }
    /*
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
                        const buer: any= await context.send(`🛍 ${element.name} ${element.price}💰`,
                            {   keyboard: Keyboard.builder()
                                .textButton({   label: 'Купить',
                                                payload: { command: `${element.name}` },
                                                color: 'secondary'                        })
                                .textButton({   label: '✏Имя',
                                                payload: { command: `${element.name}` },
                                                color: 'secondary'                        })
                                .textButton({   label: '✏Тип',
                                                payload: { command: `${element.name}` },
                                                color: 'secondary'                        })
                                .oneTime().inline()                                             })  })
                }
                const ans_item: any = await context.question( `✉ Что будем делать?`,
                    {   keyboard: Keyboard.builder()
                        .textButton({   label: 'Добавить товар',
                                        payload: { command: 'new_item' },
                                        color: 'secondary'                  })
                        .textButton({   label: 'Перейти к покупкам',
                                        payload: { command: 'continue' },
                                        color: 'secondary'                  })
                        .oneTime().inline()                                     }
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
    } else {
        
    }
    await Keyboard_Index(context, `💡 А может быть в косом переулке есть подполье?`)*/
}