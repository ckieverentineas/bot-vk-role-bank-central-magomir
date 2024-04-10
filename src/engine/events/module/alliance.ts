import { Context, KeyboardBuilder } from "vk-io"
import { Fixed_Number_To_Five, Logger } from "../../core/helper"
import prisma from "./prisma_client"
import { Alliance } from "@prisma/client"
import { chat_id, timer_text, vk } from "../../.."

export async function Alliance_Control_Multi(context: Context) {
    const keyboard = new KeyboardBuilder()
    let id_builder_sent = await Fixed_Number_To_Five(context.eventPayload.id_builder_sent ?? 0)
    let id_planet = context.eventPayload.id_planet ?? 0
    let event_logger = `❄ Отдел управления Союзами:\n\n`
    const builder_list: Alliance[] = await prisma.alliance.findMany({})
    if (builder_list.length > 0) {
        const limiter = 5
        let counter = 0
        
        for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
            const builder = builder_list[i]
            
            keyboard.callbackButton({ label: `👀 ${builder.id}-${builder.name.slice(0,30)}`, payload: { command: 'alliance_control', id_builder_sent: i, id_planet: builder.id }, color: 'secondary' }).row()
            //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
            event_logger += `\n\n💬 ${builder.id} - ${builder.name}\n 🧷 Ссылка: https://vk.com/club${builder.idvk}`
            /*
            const services_ans = await Builder_Lifer(user, builder, id_planet)*/
            counter++
        }
        event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent+limiter : limiter-(builder_list.length-id_builder_sent)} из ${builder_list.length} ~~~~` : ''}`
        //предыдущий офис
        if (builder_list.length > limiter && id_builder_sent > limiter-1 ) {
            keyboard.callbackButton({ label: '←', payload: { command: 'alliance_control_multi', id_builder_sent: id_builder_sent-limiter, id_planet: id_planet }, color: 'secondary' })
        }
        //следующий офис
        if (builder_list.length > limiter && id_builder_sent < builder_list.length-limiter) {
            keyboard.callbackButton({ label: '→', payload: { command: 'alliance_control_multi', id_builder_sent: id_builder_sent+limiter, id_planet: id_planet }, color: 'secondary' })
        }
    } else {
        event_logger = `💬 У вас еще нет альянсов!`
    }
    //новый офис
    keyboard.textButton({ label: '➕🌐', payload: { command: 'alliance_controller', command_sub: 'alliance_add', id_builder_sent: id_builder_sent, id_planet: id_planet }, color: 'secondary' })
    //назад хз куда
    keyboard.callbackButton({ label: '❌', payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime() 
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${event_logger}`, keyboard: keyboard/*, attachment: attached.toString()*/ })
}

export async function Alliance_Control(context: Context) {
    const keyboard = new KeyboardBuilder()
    let id_builder_sent = context.eventPayload.id_builder_sent ?? 0
    let id_planet = context.eventPayload.id_planet ?? 0
    let event_logger = `❄ Отдел управления отношениями с союзником №${id_planet}:\n\n`
    const builder_list: Alliance[] = await prisma.alliance.findMany({})
    const builder = builder_list[id_builder_sent]
    if (builder_list.length > 0) {
        //const sel = buildin[0]
        keyboard.callbackButton({ label: '💥 Разорвать', payload: { command: 'alliance_controller', command_sub: 'alliance_destroy', id_builder_sent: id_builder_sent, target: builder.id, id_planet: id_planet }, color: 'secondary' }).row()
        event_logger += `\n\n💬 ${builder.id} - ${builder.name}\n 🧷 Ссылка: https://vk.com/club${builder.idvk}`
        event_logger +=`\n\n${builder_list.length > 1 ? `~~~~ ${1+id_builder_sent} из ${builder_list.length} ~~~~` : ''}`;
        
    } else {
        event_logger = `💬 Вы еще не построили здания, как насчет что-то построить??`
    }
    
    //предыдущий офис
    if (builder_list.length > 1 && id_builder_sent > 0) {
        keyboard.callbackButton({ label: '←', payload: { command: 'alliance_control', id_builder_sent: id_builder_sent-1, target: builder.id, id_planet: id_planet }, color: 'secondary' })
    }
    //следующий офис
    if (builder_list.length > 1 && id_builder_sent < builder_list.length-1) {
        keyboard.callbackButton({ label: '→', payload: { command: 'alliance_control', id_builder_sent: id_builder_sent+1, target: builder.id, id_planet: id_planet }, color: 'secondary' })
    }
    if (builder_list.length > 5) {
        if ( id_builder_sent < builder_list.length/2) {
            //последний офис
            keyboard.callbackButton({ label: '→🕯', payload: { command: 'alliance_control', id_builder_sent: builder_list.length-1, target: builder.id, id_planet: id_planet }, color: 'secondary' })
        } else {
            //первый офис
            keyboard.callbackButton({ label: '←🕯', payload: { command: 'alliance_control', id_builder_sent: 0, target: builder.id, id_planet: id_planet }, color: 'secondary' })
        }
    }
    //новый офис
    keyboard.textButton({ label: '➕🌐', payload: { command: 'alliance_controller', command_sub: 'alliance_add', id_builder_sent: id_builder_sent, id_planet: id_planet }, color: 'secondary' })
    //назад хз куда
    keyboard.callbackButton({ label: '❌', payload: { command: 'alliance_control_multi', id_builder_sent: id_builder_sent, id_planet: id_planet }, color: 'secondary' }).inline().oneTime() 
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${event_logger}`, keyboard: keyboard/*, attachment: attached.toString()*/ })
}

export async function Alliance_Controller(context: Context) {
    const target = context.eventPayload.target ?? 0
    const config: Office_Controller = {
        'alliance_add': Alliance_Add,
        'alliance_destroy': Alliance_Destroy,
    }
    await config[context.eventPayload.command_sub](context, target)
}
type Office_Controller = {
    [key: string]: (context: Context, target: number) => Promise<void>;
}

export async function Alliance_Add(context: Context) {
    let spec_check = false
    let targeta = null
	while (spec_check == false) {
		const name = await context.question( `🧷 Введите ссылку на сообщество нового союзника`, timer_text)
		if (name.isTimeout) { return await context.send(`⏰ Время ожидания выбора специализации истекло!`) }
		if (name.text.length <= 256) {
			spec_check = true
			targeta = name.text
		} else { await context.send(`💡 Ввведите до 30 символов включительно!`) }
	}
    const temp = targeta.replace(/.*[/]/, "");
    try {
        const [group] = await vk.api.groups.getById({ group_id: temp });
	    if (!group) { return }
	    const alli_check = await prisma.alliance.findFirst({ where: { idvk: group.id } })
	    if (!alli_check) {
	    	const alli_cr = await prisma.alliance.create({ data: { name: group.name!, idvk: group.id!, }})
	    	await Logger(`In database created new alliance id ${alli_cr.id} name ${alli_cr.name} by user ${context.peerId}`)
	    	await context.send(`✅ Поздравляем с заключением нового союза!\n\n💬 ${alli_cr.id} - ${alli_cr.name}\n 🧷 Ссылка: https://vk.com/club${alli_cr.idvk}`)
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `🌐 Поздравляем с заключением нового союза!\n\n💬 ${alli_cr.id} - ${alli_cr.name}\n 🧷 Ссылка: https://vk.com/club${alli_cr.idvk}`
            })
	    } else {
	    	await Logger(`In database already created alliance name ${group.id}`)
            await context.send(`🤝🏻 Союз уже был заключен с:\n\n💬 ${alli_check.id} - ${alli_check.name}\n 🧷 Ссылка: https://vk.com/club${alli_check.idvk}`)
	    }
    } catch (e) {
        await context.send(`⛔ Такой группы не найдено! Союз не установлен!`)
    }
}

async function Alliance_Destroy(context: Context, target: number) {
    const keyboard = new KeyboardBuilder()
    const alliance: Alliance | null = await prisma.alliance.findFirst({ where: { id: target }})
    let event_logger = `В данный момент нельзя снести здания...`
    let id_planet = context.eventPayload.id_planet ?? 0
    let id_builder_sent = context.eventPayload.id_builder_sent ?? 0
    if (alliance) {
        if (context.eventPayload.status == "ok") {
            await prisma.$transaction([
                prisma.alliance.delete({ where: { id: alliance.id } }),
            ]).then(([alli_del]) => {
                event_logger = `✅ Поздравляем с разрушением союза для:\n\n💬 ${alli_del.id} - ${alli_del.name}\n 🧷 Ссылка: https://vk.com/club${alli_del.idvk}` 
                Logger(`In database deleted alliance ${alli_del.name}-${alli_del.id} by user ${context.peerId}`);
                vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `💥 Поздравляем с разрушением союза для:\n\n💬 ${alli_del.id} - ${alli_del.name}\n 🧷 Ссылка: https://vk.com/club${alli_del.idvk}`
                })
            })
            .catch((error) => {
                event_logger = `⌛ Произошла ошибка разрушения союза, попробуйте позже` 
                Logger(`Error delete alliance from database: ${error.message}`);
            });
        } else {
            event_logger = `🌐 Вы уверены, что хотите рассторгнуть союз с:\n\n💬 ${alliance.id} - ${alliance.name}\n 🧷 Ссылка: https://vk.com/club${alliance.idvk}`
            keyboard.callbackButton({ label: 'Хочу', payload: { command: 'alliance_controller', command_sub: 'alliance_destroy', id_builder_sent: id_builder_sent, office_current: 0, target: alliance.id, status: "ok", id_planet: id_planet }, color: 'secondary' })
        } 
    }
    //назад хз куда
    keyboard.callbackButton({ label: '❌', payload: { command: 'alliance_control', office_current: 0, id_builder_sent, target: undefined, id_planet: id_planet }, color: 'secondary' }).inline().oneTime() 
    await vk.api.messages.edit({peer_id: context.peerId, conversation_message_id: context.conversationMessageId, message: `${event_logger}`, keyboard: keyboard/*, attachment: attached.toString()*/ })
}