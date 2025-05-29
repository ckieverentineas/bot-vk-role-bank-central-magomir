import { Context, KeyboardBuilder } from "vk-io"
import prisma from "./module/prisma_client"
import { vk } from "../.."
import { User } from "@prisma/client";
import { Person_Detector, Person_Get } from "./module/person/person";
import { Accessed, Send_Message } from "../core/helper";
import { image_bank } from "./module/data_center/system_image";
import { ico_list } from "./module/data_center/icons_lib";
import { Person_Coin_Printer } from "./module/person/person_coin";
import { Facult_Rank_Printer } from "./module/alliance/facult_rank";

export async function Main_Menu_Init(context: any) {
    const attached = image_bank//await Image_Random(context, "bank")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const coin = await Person_Coin_Printer(context)
    const facult_rank = await Facult_Rank_Printer(context)
    const alli_get = await prisma.alliance.findFirst({ where: { id: user?.id_alliance ?? 0 } })
    let text = ''
    if (alli_get) {
        text = `${ico_list['alliance'].ico} Доступ разрешен, зашифрованное соединение через VPN: https:/${alli_get.name}:${alli_get.idvk}/Central_Bank_MM/${user?.id}:${user?.idvk}\n✅ Вы авторизованы, ${user?.name}! 💳 UID-${user?.id}\n${coin}\n\n Добро пожаловать в [${alli_get?.name} - 📜 AUID: ${alli_get?.id}] \n${facult_rank}`
    } else {
        text = `🏦 Доступ разрешен, зашифрованное соединение по proxy: https:/Ministry_of_Magic/Central_Bank_MM/${user?.id}:${user?.idvk}\n✅ Вы авторизованы, ${user?.name}!\n💳 UID-${user?.id} Баланс: ${user.medal}🔘`
    }
    await Send_Message(context.peerId, text, await Keyboard_User_Main(context), attached)
}
export async function Exit(context: any) {
    const text = `💡 Сессия успешно завершена. Чтобы начать новую, напишите [!банк] без квадратных скобочек`
    await Send_Message(context.peerId, text)
    await vk?.api.messages.sendMessageEventAnswer({
        event_id: context.eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
            type: "show_snackbar",
            text: "🔔 Выход из системы успешно завершен!"
        })
    })
}

export async function Keyboard_User_Main(context: Context) {
    await Person_Detector(context)
    const user = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: user?.id_alliance ?? 0 } })
    const keyboard_user = new KeyboardBuilder()
    .callbackButton({ label: '💳 Карта', payload: { command: 'card_enter' }, color: 'secondary' })
    .callbackButton({ label: '👜 Инвентарь', payload: { command: 'inventory_enter' }, color: 'secondary' }).row()
    if (alliance) {
        keyboard_user.callbackButton({ label: `${ico_list['statistics'].ico} Рейтинги`, payload: { command: 'alliance_rank_enter' }, color: 'secondary' })
        .textButton({ label: `${ico_list['statistics'].ico} Отчатор`, payload: { command: 'alliance_rank_enter' }, color: 'secondary' }).row()
        .textButton({ label: `🛍 Магазины`, payload: { command: 'operation_enter' }, color: 'secondary' })
        .textButton({ label: `${ico_list[`converter`].ico} Конвертер`, payload: { command: 'operation_enter' }, color: 'secondary' }).row()
    } 
    keyboard_user.callbackButton({ label: '🧚‍♀ Услуги', payload: { command: 'service_enter' }, color: 'secondary' })
    .urlButton({ label: '⚡ Инструкция', url: `https://vk.com/@bank_mm-instrukciya-po-polzovaniu-botom-centrobanka-magomira` }).row()
    .callbackButton({ label: '✨ Маголавка "Чудо в перьях"', payload: { command: 'shop_category_enter' }, color: 'positive' }).row()
    if (await Accessed(context) != 1) { 
        keyboard_user.callbackButton({ label: '🔧 Еще', payload: { command: 'system_call_admin' }, color: 'positive' })
    }
    keyboard_user.oneTime().inline()
    return keyboard_user
}

async function Keyboard_Admin_Main(context: Context) {
    await Person_Detector(context)
    const admin = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: admin?.id_alliance ?? 0 } })
    const keyboard_admin = new KeyboardBuilder()
    if (await Accessed(context) != 1) {
        keyboard_admin.callbackButton({ label: '⚙ Админы', payload: { command: 'admin_enter' }, color: 'secondary' })
        .callbackButton({ label: `${ico_list['config'].ico} Админам`, payload: { command: 'alliance_enter_admin' }, color: 'secondary' }).row()
    }
    if (await Accessed(context) == 3) {
        keyboard_admin.callbackButton({ label: '⚙ Союзники', payload: { command: 'alliance_control_multi' }, color: 'negative' }).row()
    }
    keyboard_admin.callbackButton({ label: `${ico_list['cancel'].ico}`, payload: { command: 'system_call' }, color: 'secondary' }).oneTime().inline()
    return keyboard_admin
}

export async function Main_Menu_Admin_Init(context: any) {
    const attached = image_bank
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const coin = await Person_Coin_Printer(context)
    const facult_rank = await Facult_Rank_Printer(context)
    const alli_get = await prisma.alliance.findFirst({ where: { id: user?.id_alliance ?? 0 } })
    let text = ''
    if (alli_get) {
        text = `${ico_list['alliance'].ico} Доступ разрешен, зашифрованное соединение через VPN: https:/${alli_get.name}:${alli_get.idvk}/Central_Bank_MM/${user?.id}:${user?.idvk}\n✅ Вы авторизованы, ${user?.name}! 💳 UID-${user?.id}\n Баланс: ${coin}\n\n Добро пожаловать в [${alli_get?.name} - 📜 AUID: ${alli_get?.id}] \n${facult_rank}`
    } else {
        text = `🏦 Доступ разрешен, зашифрованное соединение по proxy: https:/Ministry_of_Magic/Central_Bank_MM/${user?.id}:${user?.idvk}\n✅ Вы авторизованы, ${user?.name}!\n💳 UID-${user?.id} Баланс: ${user.medal}🔘`
    }
    await Send_Message(context.peerId, text, await Keyboard_Admin_Main(context), attached)
}