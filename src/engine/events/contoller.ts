import { KeyboardBuilder } from "vk-io"
import prisma from "./module/prisma_client"
import { root, vk } from "../.."
import { Image_Random } from "../core/imagecpu";
import { User } from "@prisma/client";
import { Person_Get } from "./module/person/person";
import { Edit_Message } from "../core/helper";

export async function Main_Menu_Init(context: any) {
    const attached = await Image_Random(context, "bank")
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    const text = `🏦 Доступ разрешен, зашифрованное соединение по proxy: https:/Ministry_of_Magic/Central_Bank_MM/${user?.id}:${user?.idvk}\n✅ Вы авторизованы, ${user?.name}!\n💳 UID-${user?.id} Баланс: ${user.medal}🔘`
    await Edit_Message(context, text, await Main_Menu(context), attached)
    //${user?.gold}💰 ${user?.xp}🧙
    await vk.api.messages.sendMessageEventAnswer({
        event_id: context.eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
            type: "show_snackbar",
            text: "🔔 Новое сообщение: Где деньги, Лебовский?"
        })
    })
}
export async function Exit(context: any) {
    const text = `💡 Сессия успешно завершена. Чтобы начать новую, напишите [!банк] без квадратных скобочек`
    await Edit_Message(context, text)
    await vk.api.messages.sendMessageEventAnswer({
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
    //.callbackButton({ label: 'Услуги', payload: { command: 'service_enter' }, color: 'primary' })
    const role_pr = await prisma.alliance.findFirst({ where: { id: user_check.id_alliance ?? 0 }})
    if (role_pr) {
        keyboard.callbackButton({ label: `🌐 ${role_pr.name.slice(0,30)}`, payload: { command: 'alliance_enter' }, color: 'secondary' }).row()
    }
    if (user_check.id_role === 2) {
        keyboard.callbackButton({ label: '⚙ Админы', payload: { command: 'admin_enter' }, color: 'secondary' })
        .callbackButton({ label: '⚙ Союзники', payload: { command: 'alliance_control_multi' }, color: 'negative' }).row()
    }
    keyboard.urlButton({ label: '⚡ Инструкция', url: `https://vk.com/@bank_mm-instrukciya-po-polzovaniu-botom-centrobanka-magomira` })
    keyboard.callbackButton({ label: '🚫', payload: { command: 'exit' }, color: 'secondary' }).oneTime().inline()
    return keyboard
}