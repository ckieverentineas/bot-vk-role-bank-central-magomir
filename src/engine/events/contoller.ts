import { KeyboardBuilder } from "vk-io"
import prisma from "./module/prisma_client"
import { vk } from "../.."
import { User } from "@prisma/client";
import { Person_Get } from "./module/person/person";
import { Accessed, Send_Message } from "../core/helper";
import { image_bank } from "./module/data_center/system_image";

export async function Main_Menu_Init(context: any) {
    const attached = image_bank//await Image_Random(context, "bank")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const text = `🏦 Доступ разрешен, зашифрованное соединение по proxy: https:/Ministry_of_Magic/Central_Bank_MM/${user?.id}:${user?.idvk}\n✅ Вы авторизованы, ${user?.name}!\n💳 UID-${user?.id} Баланс: ${user.medal}🔘`
    await Send_Message(context.peerId, text, await Main_Menu(context), attached)
    //${user?.gold}💰 ${user?.xp}🧙
    await vk?.api.messages.sendMessageEventAnswer({
        event_id: context.eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
            type: "show_snackbar",
            text: "🔔 Новое сообщение: Где деньги, Лебовски?"
        })
    })
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
export async function Main_Menu(context: any) {
    const user_check: User | null | undefined = await Person_Get(context)
    if (!user_check) { return }
    const keyboard = new KeyboardBuilder()
    .callbackButton({ label: '💳 Карта', payload: { command: 'card_enter' }, color: 'secondary' })
    .callbackButton({ label: '👜 Инвентарь', payload: { command: 'inventory_enter' }, color: 'secondary' }).row()
    
    //.callbackButton({ label: 'Артефакты', payload: { command: 'artefact_enter' }, color: 'secondary' })
    .callbackButton({ label: '✨ Маголавка "Чудо в перьях"', payload: { command: 'shop_category_enter' }, color: 'positive' }).row()
    //.callbackButton({ label: '🎓 Учебля', payload: { command: 'operation_enter' }, color: 'positive' }).row()
    const role_pr = await prisma.alliance.findFirst({ where: { id: user_check.id_alliance ?? 0 }})
    if (role_pr) {
        keyboard.callbackButton({ label: `🌐 ${role_pr.name.slice(0,30)}`, payload: { command: 'alliance_enter' }, color: 'secondary' }).row()
    }
    if (await Accessed(context) != 1) {
        keyboard.callbackButton({ label: '⚙ Админы', payload: { command: 'admin_enter' }, color: 'secondary' })
    }
    if (await Accessed(context) == 3) {
        keyboard.callbackButton({ label: '⚙ Союзники', payload: { command: 'alliance_control_multi' }, color: 'negative' }).row()
    }
    keyboard.urlButton({ label: '⚡ Инструкция', url: `https://vk.com/@bank_mm-instrukciya-po-polzovaniu-botom-centrobanka-magomira` }).row()
    keyboard.callbackButton({ label: '🧚‍♀ Услуги', payload: { command: 'service_enter' }, color: 'secondary' })
    keyboard.callbackButton({ label: '🚫', payload: { command: 'exit' }, color: 'secondary' }).oneTime().inline()
    return keyboard
}