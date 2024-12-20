import { Category, Inventory, Item, User } from "@prisma/client"
import prisma from "./prisma_client"
import { KeyboardBuilder } from "vk-io"
import { Image_Interface, Image_Item_Target, Image_Random } from "../../core/imagecpu"
import { chat_id, vk } from "../../.."
import { Analyzer_Buying_Counter } from "./analyzer"
import { Person_Get } from "./person/person"
import { Edit_Message, Logger } from "../../core/helper"
/*
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

export async function Shop_Enter(context: any) {
    if (context.eventPayload.item == "id") {
        //console.log(`Shop: ${JSON.stringify(context)}`)
        const input = context.eventPayload.value
        const user: User | null | undefined = await Person_Get(context)
        let keyboard = new KeyboardBuilder()
        let attached = null
        if (!user) { return }
        if (user) {
            let text = `⌛ Вы оказались в ${input.name}. Ваш баланс: ${user.medal}🔘\n\n`
            const data: Item[] = await prisma.item.findMany({ where: { id_category: Number(input.id) } })
            const inventory: Inventory[] = await prisma.inventory.findMany({ where: { id_user: user.id } })
            if (data.length > 0) {
                const item_render = []
                let counter_pict = 0
                let bonus = context.eventPayload.current
                for (let j = bonus; j < data.length; j++) { counter_pict++; if (counter_pict > 3) { continue } item_render.push({ name: data[j].name, price: `${data[j].price}` }) }
                if (context.eventPayload.rendering) { attached = await Image_Interface(item_render, context) }
                
                let counter = 0
                for (let i = bonus; i < data.length; i++) {
                    counter++
                    if (counter > 3) {continue}
                    const checker = await Searcher(inventory, data[i].id)
                    if (checker && data[i].type != 'unlimited') {
                        const text = `✅${data[i].name}`
                        keyboard.callbackButton({ label: text.slice(0,40), payload: { command: "shop_bought", item: "id", value: input, current: bonus, item_sub: "item", value_sub: data[i].id, rendering: true }, color: 'positive' }).row()
                    } else {
                        const text = `🛒${data[i].price}🔘 - ${data[i].name}`
                        keyboard.callbackButton({ label: text.slice(0,40), payload: { command: "shop_buy", item: "id", value: input, current: bonus, item_sub: "item", value_sub: data[i].id, rendering: false }, color: 'secondary' }).row()
                    }
                    text += `🛒 Наименование: ${data[i].name}\n 💬 Описание: ${data[i].description}\n\n`
                }
                if (data.length >= 3 && bonus >= 3) {
                    keyboard.callbackButton({ label: '<', payload: { command: 'shop_enter', item: "id", value: context.eventPayload.value, current: context.eventPayload.current-3, rendering: true }, color: 'secondary' })
                }
                if (data.length >= 3 && bonus+3 < data.length) {
                    keyboard.callbackButton({ label: '>', payload: { command: 'shop_enter', item: "id", value: context.eventPayload.value, current: context.eventPayload.current+3, rendering: true }, color: 'secondary' })
                }
            } else {
                text += `\n ⛔ Здесь еще нет товаров!`
            }
            keyboard.callbackButton({ label: '🚫', payload: { command: 'shop_cancel' }, color: 'secondary' })
            .callbackButton({ label: '✅', payload: { command: 'system_call' }, color: 'secondary' }).row().inline().oneTime()
            await Logger(`In a private chat, open shop ${input.name} is viewed by user ${context.peerId}`)
            if (context.eventPayload.rendering) {
                await Edit_Message(context, text, keyboard, attached)
            } else {
                await Edit_Message(context, text, keyboard)
            }
            
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
        const item = await prisma.item.findFirst({ where: { id: Number(input) } })
        if (context?.eventPayload?.command == "shop_bought") {
            await vk.api.messages.sendMessageEventAnswer({
                event_id: context.eventId,
                user_id: context.userId,
                peer_id: context.peerId,
                event_data: JSON.stringify({
                    type: "show_snackbar",
                    text: `🔔 Вы уже купили ${item!.name.slice(30)}`
                })
            })
        }
    }
}
export async function Shop_Buy(context: any) {
    if (context.eventPayload.command == "shop_buy" && context.eventPayload.item_sub == "item") {
        //console.log(`Byuing: ${JSON.stringify(context)}`)
        const item_id = context.eventPayload.value_sub
        const input = await prisma.item.findFirst({ where: { id: Number(item_id) } })
        if (!input) { return }
        const user: User | null | undefined = await Person_Get(context)
        if (!user) { return }
        const item_inventory:any = await prisma.inventory.findFirst({ where: { id_item: input.id, id_user: user.id } })
        let text = ``
        if ((!item_inventory || input.type == 'unlimited') && user.medal >= input.price) {
            //добавить обработчик ошибок
            const money = await prisma.user.update({ data: { medal: user.medal - input.price }, where: { id: user.id } })
            const inventory = await prisma.inventory.create({ data: { id_user: user.id, id_item: input.id } })
            await Logger(`In a private chat, bought a new item ${input.id} by user ${user.idvk}`)
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `🛍 @id${user.idvk}(${user.name}) покупает ${input.name}`
            })
            if (context?.eventPayload?.command == "shop_buy") {
                text = `🔔 Доставлено ${input.name}. Списано: ${input.price}🔘`
            }
            await Analyzer_Buying_Counter(context)
            
            //await Shop_Enter(context)
        } else {
            await Logger(`In a private chat, can't bought a new item ${input.id} by user ${user.idvk}`)
            if (context?.eventPayload?.command == "shop_buy") {
                text = !item_inventory || input.type == 'unlimited' ? `💡 У вас  недостаточно средств для покупки ${input.name}!!` : `💡 У вас уже есть ${input.name}!`
            }
        }       
        const attached = await Image_Item_Target(input.name)
        let keyboard = new KeyboardBuilder()
        keyboard.callbackButton({ label: 'ОК', payload: { command: 'shop_enter', item: "id", value: context.eventPayload.value, current: context.eventPayload.current, rendering: true }, color: 'secondary' }).inline()
        await Edit_Message(context, text, keyboard, attached)
    }
}
export async function Shop_Cancel(context: any) {
    await Logger(`In a private chat, left in shopping is viewed by user ${context.peerId}`)
    await Shop_Category_Enter(context)
    await vk.api.messages.sendMessageEventAnswer({
        event_id: context.eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
            type: "show_snackbar",
            text: `🔔 Возврат в центральный холл Маголавки "Чудо в перьях".`
        })
    })
}
export async function Shop_Category_Enter(context: any) {
    const attached = await Image_Random(context, "shop")
    const category: Category[] = await prisma.category.findMany({})
    let text = '✉ Орк сопроводил вас в Маголавку "Чудо в перьях" или по крайней мере дал карту...'
    if (category.length == 0) {
        text += `\n ✉ Магазинов еще нет`
    } 
    const keyboard = new KeyboardBuilder()
    for(const i in category) {
        keyboard.callbackButton({ label: `🎪 ${category[i].name}`, payload: { command: "shop_enter", item: "id", value: category[i], current: 0, rendering: true }, color: 'primary' }).row()
    }
    keyboard.callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
    await Edit_Message(context, text, keyboard, attached)
    await Logger(`In a private chat, enter in shopping is viewed by user ${context.peerId}`)
    if (context?.eventPayload?.command == "shop_category_enter") {
        await vk.api.messages.sendMessageEventAnswer({
            event_id: context.eventId,
            user_id: context.userId,
            peer_id: context.peerId,
            event_data: JSON.stringify({
                type: "show_snackbar",
                text: `🔔 Вы в Маголавке "Чудо в перьях", что вас интересует?`
            })
        })
    }
}*/