import { KeyboardBuilder } from "vk-io";
import prisma from "./prisma_client";
import { Person_Get } from "./person/person";
import { Logger, Send_Message } from "../../core/helper";
import { User } from "@prisma/client";

export async function Topic_Notification_Controller(context: any) {
    const user: User | null | undefined = await Person_Get(context);
    if (!user) return;

    const account = await prisma.account.findFirst({ 
        where: { idvk: context.senderId } 
    });
    
    if (!account) return;

    // Меняем статус уведомлений обсуждений
    const newStatus = !user.notification_topic;
    const updatedUser = await prisma.user.update({ 
        where: { id: user.id }, 
        data: { notification_topic: newStatus } 
    });

    // Формируем клавиатуру
    const keyboard = new KeyboardBuilder()
        .textButton({ 
            label: newStatus ? '🔔 Уведы обсужд: ВКЛ ✅' : '🔔 Увед обсужд: ВЫКЛ ❌', 
            payload: { command: 'topic_notification_toggle' }, 
            color: newStatus ? 'positive' : 'negative' 
        }).row()
        .textButton({ 
            label: '🔔 Обычные уведы', 
            payload: { command: 'notification_controller' }, 
            color: 'secondary' 
        }).row()
        .callbackButton({ 
            label: '🚫', 
            payload: { command: 'card_enter' }, 
            color: 'secondary' 
        }).inline().oneTime();

    const message = `🔔 Уведомления обсуждений ${newStatus ? 'активированы ✅' : 'отключены ❌'}\n` +
                   `ℹ️ Теперь вы ${newStatus ? 'будете получать' : 'НЕ будете получать'} уведомления о ваших постах в ролевых обсуждениях.`;

    await Send_Message(context.peerId, message, keyboard);
    await Logger(`Пользователь ${user.idvk} изменил статус уведомлений обсуждений на: ${newStatus}`);
    
    // Если это callback-событие, показываем снекбар
    if (context?.eventPayload?.command === 'topic_notification_controller') {
        // Здесь должен быть код для show_snackbar, если нужно
    }
}
// Контроллер обычных уведомлений (лайки/комментарии/посты)
export async function Notification_Controller(context: any) {
    const user: User | null | undefined = await Person_Get(context);
    if (!user) return;

    const account = await prisma.account.findFirst({ 
        where: { idvk: context.senderId } 
    });
    
    if (!account) return;

    // Меняем статус обычных уведомлений
    const newStatus = !user.notification;
    const updatedUser = await prisma.user.update({ 
        where: { id: user.id }, 
        data: { notification: newStatus } 
    });

    // Формируем клавиатуру
    const keyboard = new KeyboardBuilder()
        .textButton({ 
            label: newStatus ? '🔔 Уведомления: ВКЛ ✅' : '🔔 Уведомления: ВЫКЛ ❌', 
            payload: { command: 'notification_toggle' }, 
            color: newStatus ? 'positive' : 'negative' 
        }).row()
        .textButton({ 
            label: '📝 Уведомления обсуждений', 
            payload: { command: 'topic_notification_controller' }, 
            color: 'secondary' 
        }).row()
        .callbackButton({ 
            label: '🚫', 
            payload: { command: 'card_enter' }, 
            color: 'secondary' 
        }).inline().oneTime();

    const message = `🔔 Уведомления от мониторов ${newStatus ? 'активированы ✅' : 'отключены ❌'}\n` +
                   `ℹ️ Теперь вы ${newStatus ? 'будете получать' : 'НЕ будете получать'} уведомления о лайках, комментариях и постах.`;

    await Send_Message(context.peerId, message, keyboard);
    await Logger(`Пользователь ${user.idvk} изменил статус уведомлений на: ${newStatus}`);
}