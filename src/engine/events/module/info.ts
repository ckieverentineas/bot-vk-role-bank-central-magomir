import { KeyboardBuilder } from "vk-io"
import prisma from "./prisma_client"
import { chat_id, vk } from "../../.."
import { Alliance, AllianceFacult, Trigger, User } from "@prisma/client"
import { Image_Interface_Inventory, Image_Random, Image_Text_Add_Card } from "../../core/imagecpu"
import { randomInt } from "crypto"
import { Analyzer_Birthday_Counter } from "./analyzer"
import { Person_Get } from "./person/person"
import { Logger } from "../../core/helper"
import { Person_Coin_Printer } from "./person/person_coin"
import { Facult_Rank_Printer } from "./alliance/facult_rank"

export async function Card_Enter(context:any) {
    const get_user: User | null | undefined = await Person_Get(context)
    if (get_user) {
        const attached = await Image_Text_Add_Card(context, 50, 650, get_user)
        const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
        const coin = await Person_Coin_Printer(context)
        const facult_rank = await Facult_Rank_Printer(context)
        console.log(coin)
        const facult_get: AllianceFacult | null = await prisma.allianceFacult.findFirst({ where: { id: Number(get_user.id_facult) } })
        const text = `✉ Вы достали свою карточку: \n\n 💳 UID: ${get_user.id} \n 🕯 GUID: ${get_user.id_account} \n 🔘 Жетоны: ${get_user.medal} \n 👤 Имя: ${get_user.name} \n 👑 Статус: ${get_user.class}  \n 🔨 Профессия: ${get_user?.spec} \n 🏠 Ролевая: ${get_user.id_alliance == 0 ? `Соло` : get_user.id_alliance == -1 ? `Не союзник` : alli_get?.name} \n ${facult_get ? facult_get.smile : `🎓`} Факультет: ${facult_get ? facult_get.name : `Фигачит на заводе!`}\n${coin}\n${facult_rank}`
        //🗄 \n 💰Галлеоны: ${get_user.gold} \n 🧙Магический опыт: ${get_user.xp} \n 📈Уровень: ${get_user.lvl} \n 🌟Достижения: ${achievement_counter} \n 🔮Артефакты: ${artefact_counter} \n ⚙${get_user.private ? "Вы отказываетесь ролить" : "Вы разрешили приглашения на отролы"}
        const keyboard = new KeyboardBuilder()
        //.callbackButton({ label: '🎁', payload: { command: 'birthday_enter' }, color: 'secondary' })
        //.callbackButton({ label: '📊', payload: { command: 'statistics_enter' }, color: 'secondary' })
        .textButton({ label: '➕👤', payload: { command: 'Согласиться' }, color: 'secondary' })
        if (await prisma.user.count({ where: { idvk: get_user.idvk } }) > 1) {
            keyboard.textButton({ label: '🔃👥', payload: { command: 'Согласиться' }, color: 'secondary' })
        }
        keyboard.callbackButton({ label: '🏆', payload: { command: 'rank_enter' }, color: 'secondary' })
        .callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
        await Logger(`In a private chat, the card is viewed by user ${get_user.idvk}`)
        let ii = `В общем вы ${get_user.medal > 100 ? "при жетонах" : "без жетонов"}.`
        await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, attachment: attached?.toString()})
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

export async function Artefact_Enter(context: any) {
    const get_user: User | null | undefined = await Person_Get(context)
    if (!get_user) { return }
    const attached = await Image_Random(context, "artefact")
    let artefact_list = `✉ Ваши артефакты, ${get_user.class} ${get_user.name}, ${get_user.spec}: \n`
    const artefact = await prisma.artefact.findMany({ where: { id_user: get_user.id } })
    if (artefact.length > 0) {
        for (const i in artefact) { artefact_list += `\n💬: ${artefact[i].name} \n 🔧: ${artefact[i].type}${artefact[i].label} \n 🧷:  ${artefact[i].description}` }
    } else { artefact_list += `\n✉ У Вас еще нет артефактов =(` }
    console.log(`User ${get_user.idvk} see artefacts`)
    const keyboard = new KeyboardBuilder().callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${artefact_list}`, keyboard: keyboard, attachment: attached?.toString()})
    let ii = ''
    if (artefact.length > 0) {
        ii += `${artefact.length > 2 ? 'Вы тоже чувствуете эту силу мощи?' : 'Слабое пронизивание источает силу.'}`
    } else { 
        ii += `Вероятно вы магл, раз у вас нет артефакта..`
    }
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
    if ((fUArr && fUArr[0] != undefined) && fUArr.length <= 20) { attached = await Image_Interface_Inventory(fUArr, context) }
    let final: any = Array.from(new Set(compile));
    const text = final.length > 0 ? `✉ Вы приобрели следующее: \n ${final.toString().replace(/,/g, '')}` : `✉ Вы еще ничего не приобрели:(`
    await Logger(`In a private chat, the inventory is viewed by user ${get_user.idvk}`)
    const keyboard = new KeyboardBuilder().callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, attachment: attached?.toString()})
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
    const attached = await Image_Random(context, "admin")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    let puller = '🏦 Полный спектр рабов... \n'
    if (user?.id_role == 2) {
        const users = await prisma.user.findMany({ where: { id_role: 2 } })
        for (const i in users) { puller += `\n👤 ${users[i].id} - @id${users[i].idvk}(${users[i].name})` }
    } else {
        puller += `\n🚫 Доступ запрещен\n`
    }
    const keyboard = new KeyboardBuilder().callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${puller}`, keyboard: keyboard, attachment: attached?.toString()})
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

export async function Birthday_Enter(context: any) {
    let attached = await Image_Random(context, "birthday")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const trigger: any = await prisma.trigger.findFirst({ where: { id_user: user.id, name: 'birthday' } })
    if (!trigger) { 
        const trigger_init: any = await prisma.trigger.create({ data: { id_user: user.id, name: 'birthday', value: false, crdate: user.crdate } })
        console.log(`Init birthday for user ${context.peerId}`)
    }
    let text = ''
    const keyboard = new KeyboardBuilder()
    
    const trigger_check: Trigger | null = await prisma.trigger.findFirst({ where: { id_user: user.id, name: 'birthday' } })
    if (!trigger_check) { return }
    const datenow: any = new Date()
    const dateold: any = new Date(trigger_check.crdate)
    const timeouter = 31536000000 //время кд в днюхе
    const year = datenow.getFullYear(); // получаем текущий год
    const month = dateold.getMonth(); // получаем месяц из объекта Date с датой регистрации
    const day = dateold.getDate(); // получаем день из объекта Date с датой регистрации
    if (datenow - dateold >= timeouter) {
        if (context.eventPayload?.command_sub == 'beer_buying') {
            const gold = randomInt(365, 778)
            const xp = randomInt(15, 151)
            const user_update: any = await prisma.user.update({ where: { id: user.id }, data: { medal: { increment: gold } } })
            const trigger_update: any = await prisma.trigger.update({ where: { id: trigger_check.id }, data: { crdate: new Date(year, month, day) } })
            text = `⚙ Развязав бантик бантиков c красивой упакованной коробочки, вы нашли внутри ${gold}💰 и ${xp}🧙. В самом дне коробки лежала записочка: С днем Рождения, сук@!`
            console.log(`User ${context.peerId} get gift for birthday`)
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `🎁 @id${user.idvk}(${user.name}) празднует свой день Рождения и получает в подарок от жадных гоблинов ${gold}💰 и ${xp}🧙.`
            })
            await Analyzer_Birthday_Counter(context)
        } else {
            text += `🎁 Кто-бы мог подумать, у дверей возникла посылка с бантиками, красиво обтягивающими коробку!`
            keyboard.callbackButton({ label: '+🎁', payload: { command: 'birthday_enter', command_sub: "beer_buying" }, color: 'secondary' }).row()
        }
    } else {
        attached = await Image_Random(context, "birthday_drop")
        text = `🔔 Последний ваш день Рождения отмечали всем банком: ${dateold.getDate()}-${dateold.getMonth()}-${dateold.getFullYear()} ${dateold.getHours()}:${dateold.getMinutes()}! До вашего нового дня Рождения осталось ${((timeouter-(datenow-dateold))/60000/60).toFixed(2)} часов.`
    }
    keyboard.callbackButton({ label: '🚫', payload: { command: 'card_enter' }, color: 'secondary' }).inline().oneTime()
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, attachment: attached?.toString()}) 
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
    if (await prisma.allianceCoin.findFirst({ where: { id_alliance: user.id_alliance ?? 0 } })) {
        keyboard.callbackButton({ label: '🌐💳', payload: { command: 'rank_coin_enter' }, color: 'secondary' })
    }
    if (await prisma.allianceFacult.findFirst({ where: { id: user.id_facult ?? 0 } })) {
        keyboard.callbackButton({ label: '🌐🔮', payload: { command: 'rank_facult_enter' }, color: 'secondary' })
        keyboard.callbackButton({ label: '🌐🔘', payload: { command: 'rank_medal_enter' }, color: 'secondary' })
    }
    keyboard.callbackButton({ label: '🚫', payload: { command: 'card_enter' }, color: 'secondary' }).inline().oneTime()
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, /*attachment: attached?.toString()*/}) 
}

export async function Rank_Coin_Enter(context: any) {
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
    if (await prisma.allianceCoin.findFirst({ where: { id_alliance: user.id_alliance ?? 0 } })) {
        keyboard.callbackButton({ label: '💳🌐', payload: { command: 'rank_coin_enter' }, color: 'secondary' })
    }
    if (await prisma.allianceFacult.findFirst({ where: { id_alliance: user.id_facult ?? 0 } })) {
        keyboard.callbackButton({ label: '💠🌐', payload: { command: 'rank_facult_enter' }, color: 'secondary' })
        keyboard.callbackButton({ label: '🔘🌐', payload: { command: 'rank_medal_enter' }, color: 'secondary' })
    }
    keyboard.callbackButton({ label: '🚫', payload: { command: 'card_enter' }, color: 'secondary' }).inline().oneTime()
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, /*attachment: attached?.toString()*/}) 
}

export async function Rank_Medal_Enter(context: any) {
    //let attached = await Image_Random(context, "birthday")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const stats = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 }})
    let text = `⚙ Рейтинг персонажей по жетонам в ролевом проекте ${stats?.name}:\n\n`
    const keyboard = new KeyboardBuilder()


    const stat: { rank: number, text: string, score: number, me: boolean }[] = []
    let counter = 1
    for (const userok of await prisma.user.findMany({ where: { id_alliance: user.id_alliance } })) {
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
    if (await prisma.allianceCoin.findFirst({ where: { id_alliance: user.id_alliance ?? 0 } })) {
        keyboard.callbackButton({ label: 'Рейтинг Валют', payload: { command: 'statistics_enter' }, color: 'secondary' })
    }
    if (await prisma.allianceFacult.findFirst({ where: { id_alliance: user.id_alliance ?? 0 } })) {
        keyboard.callbackButton({ label: 'Рейтинг Факультетов', payload: { command: 'statistics_enter' }, color: 'secondary' })
        keyboard.callbackButton({ label: 'Рейтинг Жетонов', payload: { command: 'statistics_enter' }, color: 'secondary' })
    }
    keyboard.callbackButton({ label: '🚫', payload: { command: 'card_enter' }, color: 'secondary' }).inline().oneTime()
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, /*attachment: attached?.toString()*/}) 
}