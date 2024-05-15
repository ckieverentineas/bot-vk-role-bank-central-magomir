import { Alliance, User } from "@prisma/client"
import { Person_Get } from "../person/person"
import prisma from "../prisma_client"
import { Person_Coin_Printer, Person_Coin_Printer_Self } from "../person/person_coin"
import { Facult_Rank_Printer } from "./facult_rank"
import { KeyboardBuilder } from "vk-io"
import { Logger } from "../../../core/helper"
import { vk } from "../../../.."

export async function Alliance_Rank_Enter(context:any) {
    //let attached = await Image_Random(context, "birthday")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const facult = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult ?? 0, id_alliance: Number(user.id_alliance) } })
    let facult_tr = context.eventPayload.facult ?? false
    const stats = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 }})
    let text = `⚙ Рейтинг персонажей по жетонам в ролевом проекте ${stats?.name} ${facult_tr ? `на факультете ${facult?.smile} ${facult?.name}` : ``}:\n\n`
    const keyboard = new KeyboardBuilder()
    const stat: { rank: number, text: string, score: number, me: boolean }[] = []
    let counter = 1
    for (const userok of facult_tr ? await prisma.user.findMany({ where: { id_alliance: user.id_alliance, id_facult: user.id_facult } }) : await prisma.user.findMany({ where: { id_alliance: user.id_alliance } })) {
        stat.push({
            rank: counter,
            text: `- UID-${userok.id} [https://vk.com/id${userok.idvk}|${userok.name.slice(0, 20)}] --> ${userok.medal}🔘\n`,
            score: userok.medal,
            me: userok.idvk == user.idvk ? true : false
        })
        counter++
    }
    stat.sort(function(a, b){
        return b.score - a.score;
    });
    let counter_last = 1
    let counter_limit = 0
    let counter_init = context.eventPayload.counter_init ?? 0
    let trig_find_me = false
    for (const stat_sel of stat) {
        if (counter_last >= counter_init && counter_limit <= 10) {
            text += `${stat_sel.me ? '✅' : '👤'} ${counter_last} ${stat_sel.text}`
            if (stat_sel.me) { trig_find_me = true }
            counter_limit++
        }
        if ((counter_last <= counter_init || counter_limit > 10)) {
            if (stat_sel.me) {
                text += `\n\n${stat_sel.me ? '✅' : '👤'} ${counter_last} ${stat_sel.text}`
            }
            
        }
        counter_last++
    }
    text += `\n\n☠ В статистике участвует ${counter-1} персонажей`
    await Logger(`In a private chat, the rank information is viewed by user ${user.idvk}`)
    if (await prisma.allianceCoin.findFirst({ where: { id_alliance: user.id_alliance ?? 0 } })) {
        keyboard.callbackButton({ label: '💳', payload: { command: 'alliance_rank_coin_enter' }, color: 'secondary' })
    }
    if (facult && !facult_tr) {
        keyboard.callbackButton({ label: `🔮 ${facult.name.slice(0,30)}🔘`, payload: { command: 'alliance_rank_enter', facult: true }, color: 'secondary' }).row()
    }
    if (-10+counter_init >= 0 && -10+counter_init < stat.length) {
        keyboard.callbackButton({ label: '<', payload: { command: 'alliance_rank_enter', counter_init: -10+counter_init }, color: 'secondary' })
    }
    if (10+counter_init < stat.length) {
        keyboard.callbackButton({ label: '>', payload: { command: 'alliance_rank_enter', counter_init: 10+counter_init }, color: 'secondary', })
    }
    keyboard.callbackButton({ label: '🚫', payload: { command: 'alliance_enter' }, color: 'secondary' }).inline().oneTime()
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, /*attachment: attached?.toString()*/}) 
}

export async function Alliance_Rank_Coin_Enter(context:any) {
    //let attached = await Image_Random(context, "birthday")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const facult = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult ?? 0, id_alliance: Number(user.id_alliance) } })
    let facult_tr = context.eventPayload.facult ?? false
    let id_coin = context.eventPayload.id_coin ?? 0
    const stats = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 }})
    const coin = await prisma.allianceCoin.findFirst({ where: { id: id_coin }})
    let text = `⚙ Рейтинг персонажей по ${coin?.name} в ролевом проекте ${stats?.name} ${facult_tr ? `на факультете ${facult?.smile} ${facult?.name}` : ``}:\n\n`
    const keyboard = new KeyboardBuilder()
    const stat: { rank: number, text: string, score: number, me: boolean }[] = []
    let counter = 1
    for (const userok of facult_tr ? await prisma.user.findMany({ where: { id_alliance: user.id_alliance, id_facult: user.id_facult } }) : await prisma.user.findMany({ where: { id_alliance: user.id_alliance } })) {
        const info_coin = await Person_Coin_Printer_Self(context, userok.id)
        const user_balance = await prisma.balanceCoin.findFirst({ where: { id_coin: id_coin, id_user: userok.id } })
        if (user_balance) {
            stat.push({
                rank: counter,
                text: `- UID-${userok.id} [https://vk.com/id${userok.idvk}|${userok.name.slice(0, 20)}] --> ${user_balance.amount}${coin?.smile}\n`,
                score: user_balance.amount,
                me: userok.idvk == user.idvk ? true : false
            })
            counter++
        }
    }
    stat.sort(function(a, b){
        return b.score - a.score;
    });
    let counter_last = 1
    let counter_limit = 0
    let counter_init = context.eventPayload.counter_init ?? 0
    let trig_find_me = false
    for (const stat_sel of stat) {
        if (counter_last >= counter_init && counter_limit <= 10) {
            text += `${stat_sel.me ? '✅' : '👤'} ${counter_last} ${stat_sel.text}`
            if (stat_sel.me) { trig_find_me = true }
            counter_limit++
        }
        if ((counter_last <= counter_init || counter_limit > 10)) {
            if (stat_sel.me) {
                text += `\n\n${stat_sel.me ? '✅' : '👤'} ${counter_last} ${stat_sel.text}`
            }
            
        }
        counter_last++
    }
    text += `\n\n☠ В статистике участвует ${counter-1} персонажей`
    await Logger(`In a private chat, the rank information is viewed by user ${user.idvk}`)
    for (const coi of await prisma.allianceCoin.findMany({ where: { id_alliance: user.id_alliance ?? 0 } })) {
        keyboard.callbackButton({ label: `${coi.smile}`, payload: { command: 'alliance_rank_coin_enter', facult: facult_tr, id_coin: coi.id }, color: 'secondary' })
    }
    if (facult && !facult_tr) {
        keyboard.row().callbackButton({ label: `🔮 ${facult.name.slice(0,30)}`, payload: { command: 'alliance_rank_coin_enter', facult: true, id_coin: id_coin }, color: 'secondary' }).row()
    }
    if (facult && facult_tr) {
        keyboard.row().callbackButton({ label: `🌐 ${stats?.name.slice(0,30)}`, payload: { command: 'alliance_rank_coin_enter', facult: false, id_coin: id_coin }, color: 'secondary' }).row()
    }
    if (-10+counter_init >= 0 && -10+counter_init < stat.length) {
        keyboard.callbackButton({ label: '<', payload: { command: 'alliance_rank_coin_enter', counter_init: -10+counter_init, facult: facult_tr, id_coin: id_coin }, color: 'secondary' })
    }
    if (10+counter_init < stat.length) {
        keyboard.callbackButton({ label: '>', payload: { command: 'alliance_rank_coin_enter', counter_init: 10+counter_init, facult: facult_tr, id_coin: id_coin }, color: 'secondary', })
    }
    keyboard.callbackButton({ label: '🚫', payload: { command: 'alliance_enter' }, color: 'secondary' }).inline().oneTime()
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, /*attachment: attached?.toString()*/}) 
}