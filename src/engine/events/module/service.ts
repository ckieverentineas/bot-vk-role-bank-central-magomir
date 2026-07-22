import { KeyboardBuilder } from "vk-io"
import prisma from "./prisma_client"
import { vk } from "../../.."
import { Analyzer_Kvass_Counter } from "./analyzer"
import { Person_Get } from "./person/person"
import { User } from "@prisma/client"
import { Logger } from "../../core/helper"
import { CardSystem } from "../../core/card_system"
import { image_kvass, image_kvass_drop } from "./data_center/system_image"
import { ico_list } from "./data_center/icons_lib"

const timeouter = 86400000 //время кд квестов

export async function Service_Enter(context: any) {
    const user: User | null | undefined = await Person_Get(context);
    if (!user) { return; }
    const attached = await CardSystem.getServiceMenuBackground(user);

    // [!] ИСПРАВЛЕНИЕ: Пункт 3 - Проверка наличия обсуждений
    let showTopicActivity = false;
    if (user.id_alliance && user.id_alliance > 0) {
        const topicMonitorsCount = await prisma.topicMonitor.count({
            where: {
                monitor: {
                    id_alliance: user.id_alliance
                }
            }
        });
        if (topicMonitorsCount > 0) {
            showTopicActivity = true;
        }
    }

    // Если нет обсуждений - показываем сообщение и выходим
    if (!showTopicActivity) {
        // [!] ИСПРАВЛЕНИЕ: Используем KeyboardBuilder вместо Keyboard
        const exitKeyboard = new KeyboardBuilder()
            .callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' })
            .inline().oneTime();
            
        await vk?.api.messages.edit({ 
            peer_id: context.peerId, 
            conversation_message_id: context.conversationMessageId, 
            message: `📭 В ролевой нет подключенных обсуждений.\n\nОбратитесь к администратору для настройки.`,
            keyboard: exitKeyboard
        });
        return;
    }

    // Если есть обсуждения - показываем меню услуг
    const keyboard = new KeyboardBuilder();

    if (user.medal > 5) {
        keyboard.callbackButton({ label: '🍷 Французское вино — оно одно', payload: { command: 'service_kvass_open' }, color: 'secondary' }).row();
    }

    keyboard.textButton({ label: '!пкметр', payload: { command: 'service_kvass_open' }, color: 'secondary' }).row();
    keyboard.callbackButton({ label: '📊 Активность в РП', payload: { command: 'topic_rank_v2' }, color: 'secondary' }).row();
    keyboard.callbackButton({ label: '🚫', payload: { command: 'system_call' }, color: 'secondary' }).row().inline().oneTime();

    const text = `✉ В данный момент доступны следующие операции:`;
    await vk?.api.messages.edit({ peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, attachment: attached?.toString() });

    if (context?.eventPayload?.command == "service_enter") {
        await vk?.api.messages.sendMessageEventAnswer({
            event_id: context.eventId,
            user_id: context.userId,
            peer_id: context.peerId,
            event_data: JSON.stringify({
                type: "show_snackbar",
                text: `🔔 Ваш баланс: ${user?.medal}🔘`
            })
        });
    }
}

export async function Service_Cancel(context: any) {
    await Service_Enter(context)
    await vk?.api.messages.sendMessageEventAnswer({
        event_id: context.eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
            type: "show_snackbar",
            text: `🔔 Возврат в центр услуг.`
        })
    })
}

export async function Service_Kvass_Open(context: any) {
    let attached = image_kvass
    const price = 2
    const price_drop = 1
    const user: User | null | undefined = await Person_Get(context)
    if (!user) { return }
    
    const trigger: any = await prisma.trigger.findFirst({ where: { id_user: user.id, name: 'kvass' } })
    if (!trigger) { 
        const trigger_init: any = await prisma.trigger.create({ data: { id_user: user.id, name: 'kvass', value: false } })
        await Logger(`In a service, init kvass by user ${context.peerId}`)
    }
    
    let text = ''
    const keyboard = new KeyboardBuilder()
    
    const trigger_check: any = await prisma.trigger.findFirst({ where: { id_user: user.id, name: 'kvass' } })
    
    if (trigger_check.value == false) {
        if (user.medal >= price && context.eventPayload?.command_sub == 'kvass_buying') {
            const underwear_sold: User | null = await prisma.user.update({ where: { id: user.id }, data: { medal: { decrement: price } } })
            const trigger_update: any = await prisma.trigger.update({ where: { id: trigger_check.id }, data: { value: true } })
            if (underwear_sold) {
                text = `⚙ Кто бы мог подумать, у дверей возникло охлажденное вино прямиком из рук министра Оливера Мура, настоянное на министерских нанотехнологиях, снято ${price}🔘. Теперь ваш баланс: ${underwear_sold.medal}`
                await Logger(`In a service, sold self kvass by user ${context.peerId}`)
                await Analyzer_Kvass_Counter(context)
            }
        } else {
            if (user.medal >= price) {
                text += `🍷 Желаете охлажденного французского вина прямиком из тайных запасов Наполеона Бонапарта с доставкой на дом, всего лишь за ${price}🔘?`
                keyboard.callbackButton({ label: `-${price}🔘+🥃`, payload: { command: 'service_kvass_open', command_sub: "kvass_buying" }, color: 'secondary' }).row()
            } else {
                text += `🍷 Здесь должно было быть ваше вино, но у вас нет даже ${price}🔘!`
            }
        }
    } else {
        attached = image_kvass_drop
        const datenow: any = new Date()
        const dateold: any = new Date(trigger_check.crdate)
        
        if (datenow-trigger_check.crdate > timeouter && trigger_check.value) {
            const trigger_change: any = await prisma.trigger.update({ where: { id: trigger_check.id }, data: { crdate: datenow } })
            text += `🍷 Вы точно хотите сдать стеклотару от вина на фабрику Министерства Магии, основанную министром магии в 2043 году, за ${price_drop}🔘?`
        } else {
            text = `🔔 Вы уже употребляли изысканное вино: ${dateold.getDate()}-${dateold.getMonth()}-${dateold.getFullYear()} ${dateold.getHours()}:${dateold.getMinutes()}! Приходите через ${((timeouter-(datenow-trigger_check.crdate))/60000/60).toFixed(2)} часов.`
        }
        
        if (context.eventPayload?.command_sub == 'kvass_selling') {
            const underwear_sold: User | null = await prisma.user.update({ where: { id: user.id }, data: { medal: { increment: price_drop } } })
            const trigger_update: any = await prisma.trigger.update({ where: { id: trigger_check.id }, data: { value: false } })
            if (underwear_sold) {
                text = `⚙ В результате утилизации, никто не оценил ваш вклад в сохранение исторических артефактов и защиту магических реликвий, и за такой нанесенный моральный ущерб Министерство Магии выплатило вам +${price_drop}🔘. Теперь ваш баланс: ${underwear_sold.medal}🔘.`
                await Logger(`In a service, return self kvass by user ${context.peerId}`)
            }
        } else {
            if (datenow-trigger_check.crdate > timeouter && trigger_check.value) {
                keyboard.callbackButton({ label: `+${price_drop}🔘-🥃`, payload: { command: 'service_kvass_open', command_sub: "kvass_selling" }, color: 'secondary' }).row()
            }
        }
    }
    
    // Добавляем кнопку возврата в услуги и выхода
    keyboard.callbackButton({ label: '📊 Активность в РП', payload: { command: 'topic_rank_v2' }, color: 'secondary' }).row() // ← ИЗМЕНЕНО: topic_rank_v2
    keyboard.callbackButton({ label: '🚫', payload: { command: 'service_cancel' }, color: 'secondary' }).inline().oneTime()
    
    await vk?.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${text}`, keyboard: keyboard, attachment: attached?.toString()}) 
}