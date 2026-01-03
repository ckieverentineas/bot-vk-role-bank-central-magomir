import { Alliance, User } from "@prisma/client"
import { Person_Get } from "../person/person"
import prisma from "../prisma_client"
import { Person_Coin_Printer } from "../person/person_coin"
import { Facult_Rank_Printer } from "./facult_rank"
import { KeyboardBuilder } from "vk-io"
import { Accessed, Logger, Send_Message } from "../../../core/helper"
import { ico_list } from "../data_center/icons_lib"

export async function Alliance_Enter(context:any) {
    const get_user: User | null | undefined = await Person_Get(context)
    if (!get_user) { return }
    const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
    const coin = await Person_Coin_Printer(context)
    const facult_rank = await Facult_Rank_Printer(context)
    const text = `${ico_list['alliance'].ico} Добро пожаловать в [${alli_get?.name} - 📜 AUID: ${alli_get?.id}] \n${facult_rank}`
    const keyboard = new KeyboardBuilder()
    if (await prisma.allianceShop.findFirst({ where: { id_alliance: get_user.id_alliance ?? 0 } })) {
        keyboard.textButton({ label: `🛍 Магазины`, payload: { command: 'operation_enter' }, color: 'secondary' }).row()
    }
    if (await prisma.allianceCoin.findFirst({ where: { id_alliance: get_user.id_alliance ?? 0 } })) {
        keyboard.textButton({ label: `${ico_list[`converter`].ico} Конвертер`, payload: { command: 'operation_enter' }, color: 'secondary' }).row()
    }
    keyboard.callbackButton({ label: `${ico_list['statistics'].ico} Рейтинги`, payload: { command: 'alliance_rank_enter' }, color: 'secondary' }).row()
    keyboard.textButton({ label: `${ico_list['statistics'].ico} Отчатор`, payload: { command: 'alliance_rank_enter' }, color: 'secondary' }).row()
    if (await Accessed(context) != 1) {
        keyboard.callbackButton({ label: `${ico_list['config'].ico} Админам`, payload: { command: 'alliance_enter_admin' }, color: 'secondary' }).row()
    }
    keyboard.callbackButton({ label: `${ico_list['stop'].ico}`, payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime()
    await Logger(`In a private chat, the alliance card is viewed by user ${get_user.idvk}`)
    await Send_Message(context.peerId, text, keyboard)
}

export async function Alliance_Enter_Admin(context:any) {
    const get_user: User | null | undefined = await Person_Get(context)
    if (get_user) {
        const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
        const coin = await Person_Coin_Printer(context)
        const facult_rank = await Facult_Rank_Printer(context)
        const text = `${ico_list['alliance'].ico} Добро пожаловать в меню администрирования ролевого проекта [${alli_get?.name}] --> \n`
        const keyboard = new KeyboardBuilder()
        if (await Accessed(context) != 1) {
            keyboard.textButton({ label: `${ico_list['config'].ico} !факультеты настроить`, color: 'secondary' })
            keyboard.textButton({ label: `${ico_list['config'].ico} !магазины настроить`, color: 'secondary' }).row()
            keyboard.textButton({ label: `${ico_list['config'].ico} !настроить валюты`, color: 'secondary' }).row()
            keyboard.textButton({ label: `${ico_list['config'].ico} !настроить конвертацию`, color: 'secondary' })
            keyboard.textButton({ label: `${ico_list['config'].ico} !настроить S-coins`, color: 'secondary' }).row()
            keyboard.textButton({ label: `${ico_list['config'].ico} !закончить учебный год`, color: 'negative' }).row()
            keyboard.textButton({ label: `${ico_list['config'].ico} !мониторы нафиг`, color: 'positive' }).row()
        }
        keyboard.callbackButton({ label: `${ico_list['stop'].ico}`, payload: { command: "system_call_admin" }, color: 'secondary' }).inline().oneTime()
        await Logger(`In a private chat, the alliance card is viewed by user ${get_user.idvk}`)
        await Send_Message(context.peerId, text, keyboard)
    }
}