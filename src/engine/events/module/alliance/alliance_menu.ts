import { Alliance, User } from "@prisma/client"
import { Person_Get } from "../person/person"
import prisma from "../prisma_client"
import { Person_Coin_Printer } from "../person/person_coin"
import { Facult_Rank_Printer } from "./facult_rank"
import { KeyboardBuilder } from "vk-io"
import { Logger } from "../../../core/helper"
import { vk } from "../../../.."

export async function Alliance_Enter(context:any) {
    const get_user: User | null | undefined = await Person_Get(context)
    if (get_user) {
        const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
        const coin = await Person_Coin_Printer(context)
        const facult_rank = await Facult_Rank_Printer(context)
        const text = `✉ Добро пожаловать в ${alli_get?.name} <-- \n${facult_rank}`
        //🗄 \n 💰Галлеоны: ${get_user.gold} \n 🧙Магический опыт: ${get_user.xp} \n 📈Уровень: ${get_user.lvl} \n 🌟Достижения: ${achievement_counter} \n 🔮Артефакты: ${artefact_counter} \n ⚙${get_user.private ? "Вы отказываетесь ролить" : "Вы разрешили приглашения на отролы"}
        const keyboard = new KeyboardBuilder()
        //.callbackButton({ label: '🎁', payload: { command: 'birthday_enter' }, color: 'secondary' })
        //.callbackButton({ label: '📊', payload: { command: 'statistics_enter' }, color: 'secondary' })
        .textButton({ label: '🛍 Лютный переулок', payload: { command: 'Согласиться' }, color: 'secondary' }).row()
        if (await prisma.allianceCoin.findFirst({ where: { id_alliance: get_user.id_alliance ?? 0 } })) {
            keyboard.textButton({ label: '⚖ Конвертер', payload: { command: 'Согласиться' }, color: 'secondary' }).row()
        }
        
        keyboard.callbackButton({ label: '📊 Рейтинги', payload: { command: 'alliance_rank_enter' }, color: 'secondary' }).row()
        if (get_user.id_role == 2) {
            keyboard.callbackButton({ label: '⚙ Админам', payload: { command: 'alliance_enter_admin' }, color: 'secondary' }).row()
        }
        keyboard.callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
        await Logger(`In a private chat, the alliance card is viewed by user ${get_user.idvk}`)
        await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard/*, attachment: attached?.toString()*/})
        if (context?.eventPayload?.command == "card_enter") {
            await vk.api.messages.sendMessageEventAnswer({
                event_id: context.eventId,
                user_id: context.userId,
                peer_id: context.peerId,
                event_data: JSON.stringify({
                    type: "show_snackbar",
                    text: `🔔 Вы дома: ${alli_get?.name.slice(0,40)}`
                })
            })
        }
    }
}

export async function Alliance_Enter_Admin(context:any) {
    const get_user: User | null | undefined = await Person_Get(context)
    if (get_user) {
        const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
        const coin = await Person_Coin_Printer(context)
        const facult_rank = await Facult_Rank_Printer(context)
        const text = `✉ Добро пожаловать в меню администрирования ролевого проекта [${alli_get?.name} <-- \n${facult_rank}]:`
        //🗄 \n 💰Галлеоны: ${get_user.gold} \n 🧙Магический опыт: ${get_user.xp} \n 📈Уровень: ${get_user.lvl} \n 🌟Достижения: ${achievement_counter} \n 🔮Артефакты: ${artefact_counter} \n ⚙${get_user.private ? "Вы отказываетесь ролить" : "Вы разрешили приглашения на отролы"}
        const keyboard = new KeyboardBuilder()
        //.callbackButton({ label: '🎁', payload: { command: 'birthday_enter' }, color: 'secondary' })
        //.callbackButton({ label: '📊', payload: { command: 'statistics_enter' }, color: 'secondary' })
        .textButton({ label: '🛍 Лютный переулок', payload: { command: 'Согласиться' }, color: 'secondary' }).row()
        if (await prisma.allianceCoin.findFirst({ where: { id_alliance: get_user.id_alliance ?? 0 } })) {
            keyboard.textButton({ label: '⚖ Конвертер', payload: { command: 'Согласиться' }, color: 'secondary' }).row()
        }
        
        keyboard.callbackButton({ label: '📊 Рейтинги', payload: { command: 'rank_enter' }, color: 'secondary' }).row()
        if (get_user.id_role == 2) {
            keyboard.textButton({ label: '⚙ !настроить факультеты', payload: { command: 'Согласиться' }, color: 'secondary' }).row()
            keyboard.textButton({ label: '⚙ !настроить валюты', payload: { command: 'Согласиться' }, color: 'secondary' }).row()
        }
        keyboard.callbackButton({ label: '🚫', payload: { command: 'alliance_enter' }, color: 'secondary' }).inline().oneTime()
        await Logger(`In a private chat, the alliance card is viewed by user ${get_user.idvk}`)
        await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard/*, attachment: attached?.toString()*/})
        if (context?.eventPayload?.command == "card_enter") {
            await vk.api.messages.sendMessageEventAnswer({
                event_id: context.eventId,
                user_id: context.userId,
                peer_id: context.peerId,
                event_data: JSON.stringify({
                    type: "show_snackbar",
                    text: `🔔 Вы дома: ${alli_get?.name.slice(0,40)}`
                })
            })
        }
    }
}