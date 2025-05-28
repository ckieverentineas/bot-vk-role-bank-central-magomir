import { Category, Inventory, Item, User } from "@prisma/client"
import { KeyboardBuilder } from "vk-io"
import { Person_Get } from "../person/person"
import prisma from "../prisma_client"
import { Fixed_Number_To_Five, Logger, Send_Message } from "../../../core/helper"
import { chat_id, vk } from "../../../.."
import { Analyzer_Buying_Counter } from "../analyzer"
import { image_shop } from "../data_center/system_image"

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

export async function Shop_Category_Enter(context: any) {
    const attached = image_shop//await Image_Random(context, "shop")
    const category: Category[] = await prisma.category.findMany({})
    let text = '✉ Орк сопроводил вас в «Маголавку «Чудо в перьях» или, по крайней мере, дал карту...'
    if (category.length == 0) {
        text += `\n ✉ Магазинов еще нет`
    } 
    const keyboard = new KeyboardBuilder()
    for(const i in category) {
        keyboard.callbackButton({ label: `🎪 ${category[i].name}`, payload: { command: "shop_enter_multi", item: "id", value: category[i], current: 0, rendering: true }, color: 'primary' }).row()
    }
    keyboard.callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
    await Send_Message(context.peerId, text, keyboard, attached)
    await Logger(`In a private chat, enter in shopping is viewed by user ${context.peerId}`)
}

export async function Shop_Enter_Multi(context: any) {
    const keyboard = new KeyboardBuilder()
    const input = context.eventPayload.value
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    let id_builder_sent = await Fixed_Number_To_Five(context.eventPayload.id_builder_sent ?? 0)
    let event_logger = `⌛ Вы оказались в [${input.name}]. Ваш баланс: ${user.medal}🔘\n\n`
    const builder_list: Item[] = await prisma.item.findMany({ where: { id_category: Number(input.id) } })
    if (builder_list.length > 0) {
        const limiter = 5
        let counter = 0
        for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
            const builder = builder_list[i]
            keyboard.callbackButton({ label: `👀 ${builder.name.slice(0,30)}`, payload: { command: 'shop_enter', id_builder_sent: i, id_item: builder.id, item: "id", value: input, item_sub: "item", }, color: 'secondary' }).row()
            event_logger += `\n💬 ${builder.name} - ${builder.price}🔘`
            counter++
        }
        event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${Math.min(id_builder_sent + limiter, builder_list.length)} из ${builder_list.length} ~~~~` : ''}`
        //предыдущий офис
        if (builder_list.length > limiter && id_builder_sent > limiter-1 ) {
            keyboard.callbackButton({ label: '←', payload: { command: "shop_enter_multi", id_builder_sent: id_builder_sent-limiter, item: "id", value: input, item_sub: "item", }, color: 'secondary' })
        }
        //следующий офис
        if (builder_list.length > limiter && id_builder_sent < builder_list.length-limiter) {
            keyboard.callbackButton({ label: '→', payload: { command: "shop_enter_multi", id_builder_sent: id_builder_sent+limiter, item: "id", value: input, item_sub: "item", }, color: 'secondary' })
        }
    } else {
        event_logger = `💬 Вы еще не построили здания, как насчет что-то построить??`
    }
    //новый офис
    keyboard.callbackButton({ label: '🚫', payload: { command: 'shop_cancel' }, color: 'secondary' })
    .callbackButton({ label: '✅', payload: { command: 'system_call' }, color: 'secondary' }).row().inline().oneTime()
    await Send_Message(context.peerId, `${event_logger}`, keyboard/*, attachment: attached.toString()*/ )
}
export async function Shop_Enter(context: any) {
    if (context.eventPayload.item == "id") {
        //console.log(`Shop: ${JSON.stringify(context)}`)
        const input = context.eventPayload.value
        const id_builder_sent = context.eventPayload.id_builder_sent
        const id_item = context.eventPayload.id_item
        const user: User | null | undefined = await Person_Get(context)
        let keyboard = new KeyboardBuilder()
        if (!user) { return }
        const inventory: Inventory[] = await prisma.inventory.findMany({ where: { id_user: user.id } })
        if (!id_item) { return }
        const checker = await Searcher(inventory, id_item)
        const item_check: Item | null = await prisma.item.findFirst({ where: { id_category: Number(input.id), id: id_item } })
        if (!item_check) { return }
        let text = `⌛ Вы оказались в [${input.name}] и осматриваете [${item_check.name}]. Ваш баланс: ${user.medal}🔘\n\n`
        if (checker && item_check.type != 'unlimited') {
            const text = `✅${item_check.name}`
            keyboard.callbackButton({ label: text.slice(0,40), payload: { command: "shop_bought", item: "id", value: input, item_sub: "item", value_sub: item_check.id, id_builder_sent: id_builder_sent }, color: 'positive' }).row()
        } else {
            const text = `🛒${item_check.price}🔘 - ${item_check.name}`
            keyboard.callbackButton({ label: text.slice(0,40), payload: { command: "shop_buy", item: "id", value: input, item_sub: "item", value_sub: item_check.id, id_builder_sent: id_builder_sent  }, color: 'secondary' }).row()
        }
        text += `🛒 Наименование: ${item_check.name}\n 💬 Описание: ${item_check.description}\n\n`
        keyboard.callbackButton({ label: '🚫', payload: { command: 'shop_enter_multi', id_builder_sent: id_builder_sent, item: "id", value: input, item_sub: "item", }, color: 'secondary' })
        .callbackButton({ label: '✅', payload: { command: 'system_call' }, color: 'secondary' }).row().inline().oneTime()
        const attached = item_check?.image?.includes('photo') ? item_check.image : null
        await Logger(`In a private chat, open shop ${input.name} is viewed by user ${context.peerId}`)
        await Send_Message(context.peerId, text, keyboard, attached)
    }
}
export async function Shop_Bought(context: any) {
    if (context.eventPayload.command == "shop_bought" && context.eventPayload.item_sub == "item") {
        const input = context.eventPayload.value_sub
        const item = await prisma.item.findFirst({ where: { id: Number(input) } })
        if (context?.eventPayload?.command == "shop_bought") {
            await vk?.api.messages.sendMessageEventAnswer({
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
        const id_builder_sent = context.eventPayload.id_builder_sent
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
            await vk?.api.messages.send({
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
        const attached = input.image
        let keyboard = new KeyboardBuilder()
        keyboard.callbackButton({ label: 'ОК', payload: { command: 'shop_enter_multi', item: "id", value: context.eventPayload.value, current: context.eventPayload.current, id_builder_sent: id_builder_sent }, color: 'secondary' }).inline().oneTime()
        await Send_Message(context.peerId, text, keyboard, attached)
    }
}
export async function Shop_Cancel(context: any) {
    await Logger(`In a private chat, left in shopping is viewed by user ${context.peerId}`)
    await Shop_Category_Enter(context)
    await vk?.api.messages.sendMessageEventAnswer({
        event_id: context.eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
            type: "show_snackbar",
            text: `🔔 Возврат в центральный холл Маголавки «Чудо в перьях».`
        })
    })
}
