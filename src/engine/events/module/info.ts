import { KeyboardBuilder } from "vk-io"
import prisma from "./prisma_client"
import { chat_id, vk } from "../../.."
import { Alliance, AllianceFacult, Trigger, User } from "@prisma/client"
import { Image_Text_Add_Card } from "../../core/imagecpu"
import { randomInt } from "crypto"
import { Analyzer_Birthday_Counter } from "./analyzer"
import { Person_Get } from "./person/person"
import { Accessed, Edit_Message, Logger, Send_Message } from "../../core/helper"
import { Person_Coin_Printer } from "./person/person_coin"
import { Facult_Rank_Printer } from "./alliance/facult_rank"
import { image_admin } from "./data_center/system_image"

export async function Card_Enter(context:any) {
    const get_user: User | null | undefined = await Person_Get(context)
    if (get_user) {
        const attached = await Image_Text_Add_Card(context, 50, 650, get_user)
        const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
        const coin = await Person_Coin_Printer(context)
        const facult_rank = await Facult_Rank_Printer(context)
        const facult_get: AllianceFacult | null = await prisma.allianceFacult.findFirst({ where: { id: Number(get_user.id_facult) } })
        const text = `✉ Вы достали свою карточку: \n\n 💳 UID: ${get_user.id} \n 🕯 GUID: ${get_user.id_account} \n 🔘 Жетоны: ${get_user.medal} \n 👤 Имя: ${get_user.name} \n 👑 Статус: ${get_user.class}  \n 🔨 Профессия: ${get_user?.spec} \n 🏠 Ролевая: ${get_user.id_alliance == 0 ? `Соло` : get_user.id_alliance == -1 ? `Не союзник` : alli_get?.name} \n ${facult_get ? facult_get.smile : `🔮`} Факультет: ${facult_get ? facult_get.name : `Без факультета`}\n${coin}`
        const keyboard = new KeyboardBuilder()
        //.callbackButton({ label: '🎁', payload: { command: 'birthday_enter' }, color: 'secondary' })
        //.callbackButton({ label: '📊', payload: { command: 'statistics_enter' }, color: 'secondary' })
        .textButton({ label: '➕👤', payload: { command: 'Согласиться' }, color: 'secondary' })
        if (await prisma.user.count({ where: { idvk: get_user.idvk } }) > 1) {
            keyboard.textButton({ label: '🔃👥', payload: { command: 'Согласиться' }, color: 'secondary' })
        }
        keyboard.callbackButton({ label: '🏆', payload: { command: 'rank_enter' }, color: 'secondary' }).row()
        .textButton({ label: '🔔 Уведомления', payload: { command: 'notification_controller' }, color: 'secondary' })
        .callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
        await Logger(`In a private chat, the card is viewed by user ${get_user.idvk}`)
        let ii = `В общем, вы ${get_user.medal > 100 ? "при жетонах" : "без жетонов"}.`
        await Edit_Message(context, text, keyboard, attached)
        if (context?.eventPayload?.command == "card_enter") {
            await vk.api.messages.sendMessageEventAnswer({
                event_id: context.eventId,
                user_id: context.userId,
                peer_id: context.peerId,
                event_data: JSON.stringify({
                    type: "show_snackbar",
                    text: `🔔 ${ii}`
                })
            })
        }
    }
}

export async function Inventory_Enter(context: any) {
    const get_user: User | null | undefined = await Person_Get(context)
    if (!get_user) { return }
    const inventory = await prisma.inventory.findMany({ where: { id_user: get_user.id }, include: { item: true } })
    let cart = ''
    for (const i in inventory) {
        cart += `${inventory[i].item.name};`
    }
    const destructor = cart.split(';').filter(i => i)
    let compile = []
    let compile_rendered: any = []
    for (const i in destructor) {
        let counter = 0
        for (const j in destructor) { if (destructor[i] != null) { if (destructor[i] == destructor[j]) { counter++ } } }
        compile.push(`👜 ${destructor[i]} x ${counter}\n`)
        compile_rendered.push({name: destructor[i], text:`x ${counter}`})
        counter = 0
    }
    const fUArr: any = compile_rendered.filter( (li: ArrayLike<any> | { [s: string]: any; }, idx: any, self: ({ [s: string]: any; } | ArrayLike<any>)[]) => 
        self.map( (itm: { [s: string]: any; } | ArrayLike<any>) => Object.values(itm).reduce((r, c) => r.concat(c), '') )
        .indexOf( Object.values(li).reduce((r, c) => r.concat(c), '') ) === idx
    )
    let attached = null
    //if ((fUArr && fUArr[0] != undefined) && fUArr.length <= 20) { attached = await Image_Interface_Inventory(fUArr, context) }
    let final: any = Array.from(new Set(compile));
    const text = final.length > 0 ? `✉ Вы приобрели следующее: \n${final.toString().replace(/,/g, '')}` : `✉ Вы еще ничего не приобрели:(`
    await Logger(`In a private chat, the inventory is viewed by user ${get_user.idvk}`)
    const keyboard = new KeyboardBuilder()
    .textButton({ label: '🧳 Инвентарь ролевой', payload: { command: 'system_call' }, color: 'secondary' }).row()
    .callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' })
    .inline().oneTime()
    await Send_Message(context.peerId, text, keyboard, attached)
    let ii = final.length > 0 ? 'А вы зажиточный клиент' : `Как можно было так лохануться?`
    await vk.api.messages.sendMessageEventAnswer({
        event_id: context.eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
            type: "show_snackbar",
            text: `🔔 ${ii}`
        })
    })
}
export async function Admin_Enter(context: any) {
    const attached = image_admin//await Image_Random(context, "admin")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    let puller = '🏦 Полный спектр рабов... \n'
    if (await Accessed(context) != 1) {
        const admar = await prisma.role.findFirst({ where: { name: `root` } })
        const usersr = await prisma.user.findMany({ where: { id_role: admar?.id } })
        for (const i in usersr) { puller += `\n😎 ${usersr[i].id} - @id${usersr[i].idvk}(${usersr[i].name})` }
        const adma = await prisma.role.findFirst({ where: { name: `admin` } })
        const users = await prisma.user.findMany({ where: { id_role: adma?.id } })
        for (const i in users) { puller += `\n👤 ${users[i].id} - @id${users[i].idvk}(${users[i].name})` }
    } else {
        puller += `\n🚫 Доступ запрещен\n`
    }
    const keyboard = new KeyboardBuilder().callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
    await Send_Message(context.peerId, puller, keyboard, attached)
    await Logger(`In a private chat, the list administrators is viewed by admin ${user.idvk}`)
    await vk.api.messages.sendMessageEventAnswer({
        event_id: context.eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
            type: "show_snackbar",
            text: `🔔 Им бы еще черные очки, и точно люди в черном!`
        })
    })
}

export async function Statistics_Enter(context: any) {
    //let attached = await Image_Random(context, "birthday")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const stats = await prisma.analyzer.findFirst({ where: { id_user: user.id }})
    let text = ''
    const keyboard = new KeyboardBuilder()
    text = `⚙ Конфиденциальная информация:\n\n🍺 Сливочное: ${stats?.beer}/20000\n🍵 Бамбуковое: ${stats?.beer_premiun}/1000\n🎁 Дни Рождения: ${stats?.birthday}/15\n🛒 Покупок: ${stats?.buying}/20000\n🧙 Конвертаций МО: ${stats?.convert_mo}/20000\n📅 Получено ЕЗ: ${stats?.quest}/20000\n👙 Залогов: ${stats?.underwear}/20000\n`
    console.log(`User ${context.peerId} get statistics information`)
    keyboard.callbackButton({ label: '🚫', payload: { command: 'card_enter' }, color: 'secondary' }).inline().oneTime()
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, /*attachment: attached?.toString()*/}) 
}

export async function Rank_Enter(context: any) {
    //let attached = await Image_Random(context, "birthday")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const stats = await prisma.analyzer.findFirst({ where: { id_user: user.id }})
    let text = '⚙ Рейтинг персонажей:\n\n'
    const keyboard = new KeyboardBuilder()


    const stat: { rank: number, text: string, score: number, me: boolean }[] = []
    let counter = 1
    for (const userok of await prisma.user.findMany()) {
        const ach_counter = await prisma.achievement.count({ where: { id_user: userok.id }})
        stat.push({
            rank: counter,
            text: `- [https://vk.com/id${userok.idvk}|${userok.name.slice(0, 20)}] --> ${userok.medal}🔘\n`,
            score: userok.medal,
            me: userok.idvk == user.idvk ? true : false
        })
        counter++
    }
    stat.sort(function(a, b){
        return b.score - a.score;
    });
    let counter_last = 1
    let trig_find_me = false
    for (const stat_sel of stat) {
        if (counter_last <= 10) {
            text += `${stat_sel.me ? '✅' : '👤'} ${counter_last} ${stat_sel.text}`
            if (stat_sel.me) { trig_find_me = true }
        }
        if (counter_last > 10 && !trig_find_me) {
            if (stat_sel.me) {
                text += `\n\n${stat_sel.me ? '✅' : '👤'} ${counter_last} ${stat_sel.text}`
            }
        }
        counter_last++
    }
    text += `\n\n☠ В статистике участвует ${counter-1} персонажей`
    await Logger(`In a private chat, the rank information is viewed by user ${user.idvk}`)
    keyboard.callbackButton({ label: '🚫', payload: { command: 'card_enter' }, color: 'secondary' }).inline().oneTime()
    await Send_Message(context.peerId, text, keyboard)
}