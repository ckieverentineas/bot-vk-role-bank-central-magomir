import { Context, KeyboardBuilder } from "vk-io"
import { Fixed_Number_To_Five, Input_Text, Logger, Send_Message } from "../../../core/helper"
import prisma from "../prisma_client"
import { Alliance } from "@prisma/client"
import { chat_id, vk } from "../../../.."
import { ico_list } from "../data_center/icons_lib"
import { Person_Get } from "../person/person"

export async function Alliance_Control_Multi(context: Context) {
    const keyboard = new KeyboardBuilder()
    let id_builder_sent = await Fixed_Number_To_Five(context.eventPayload.id_builder_sent ?? 0)
    let id_planet = context.eventPayload.id_planet ?? 0
    let event_logger = `${ico_list['alliance'].ico} Отдел управления союзами:\n\n`
    const builder_list: Alliance[] = await prisma.alliance.findMany({})
    if (builder_list.length > 0) {
        const limiter = 5
        let counter = 0
        for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
            const builder = builder_list[i]
            keyboard.callbackButton({ label: `${ico_list['config'].ico} ${builder.id}-${builder.name.slice(0,30)}`, payload: { command: 'alliance_control', id_builder_sent: i, id_planet: builder.id }, color: 'secondary' }).row()
            event_logger += `\n\n${ico_list['alliance'].ico} ${builder.id} - ${builder.name}\n${ico_list['attach'].ico} Ссылка: https://vk.com/club${builder.idvk}`
            counter++
        }
        event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent+limiter : limiter-(builder_list.length-id_builder_sent)} из ${builder_list.length} ~~~~` : ''}`
        // предыдушая страница
        if (builder_list.length > limiter && id_builder_sent > limiter-1 ) {
            keyboard.callbackButton({ label: `${ico_list['back'].ico}`, payload: { command: 'alliance_control_multi', id_builder_sent: id_builder_sent-limiter, id_planet: id_planet }, color: 'secondary' })
        }
        // следующая страница
        if (builder_list.length > limiter && id_builder_sent < builder_list.length-limiter) {
            keyboard.callbackButton({ label: `${ico_list['next'].ico}`, payload: { command: 'alliance_control_multi', id_builder_sent: id_builder_sent+limiter, id_planet: id_planet }, color: 'secondary' })
        }
    } else {
        event_logger = `${ico_list['warn'].ico} У вас еще нет альянсов!`
    }
    keyboard.textButton({ label: `${ico_list['add'].ico}${ico_list['alliance'].ico}`, payload: { command: 'alliance_controller', command_sub: 'alliance_add', id_builder_sent: id_builder_sent, id_planet: id_planet }, color: 'secondary' })
    keyboard.callbackButton({ label: `${ico_list['cancel'].ico}`, payload: { command: 'system_call' }, color: 'secondary' }).inline().oneTime() 
    await Send_Message(context.peerId, event_logger, keyboard)
}

export async function Alliance_Control(context: Context) {
    const keyboard = new KeyboardBuilder()
    let id_builder_sent = context.eventPayload.id_builder_sent ?? 0
    let id_planet = context.eventPayload.id_planet ?? 0
    let event_logger = `${ico_list['config'].ico} Отдел управления отношениями с союзником №${id_planet}:\n\n`
    const builder_list: Alliance[] = await prisma.alliance.findMany({})
    const builder = builder_list[id_builder_sent]
    if (builder_list.length > 0) {
        keyboard.callbackButton({ label: `${ico_list['delete'].ico} Разорвать`, payload: { command: 'alliance_controller', command_sub: 'alliance_destroy', id_builder_sent: id_builder_sent, target: builder.id, id_planet: id_planet }, color: 'secondary' }).row()
        event_logger += `\n\n${ico_list['alliance'].ico} ${builder.id} - ${builder.name}\n${ico_list['attach'].ico} Ссылка: https://vk.com/club${builder.idvk}`
        event_logger +=`\n\n${builder_list.length > 1 ? `~~~~ ${1+id_builder_sent} из ${builder_list.length} ~~~~` : ''}`;
    } else {
        event_logger = `${ico_list['warn'].ico} Вы еще не заключали союзов, как насчет заключить??`
    }
    if (builder_list.length > 1 && id_builder_sent > 0) {
        keyboard.callbackButton({ label: `${ico_list['back'].ico}`, payload: { command: 'alliance_control', id_builder_sent: id_builder_sent-1, target: builder.id, id_planet: id_planet }, color: 'secondary' })
    }
    if (builder_list.length > 1 && id_builder_sent < builder_list.length-1) {
        keyboard.callbackButton({ label: `${ico_list['next'].ico}`, payload: { command: 'alliance_control', id_builder_sent: id_builder_sent+1, target: builder.id, id_planet: id_planet }, color: 'secondary' })
    }
    if (builder_list.length > 5) {
        if ( id_builder_sent < builder_list.length/2) {
            keyboard.callbackButton({ label: `${ico_list['next'].ico}${ico_list['next'].ico}`, payload: { command: 'alliance_control', id_builder_sent: builder_list.length-1, target: builder.id, id_planet: id_planet }, color: 'secondary' })
        } else {
            keyboard.callbackButton({ label: `${ico_list['back'].ico}${ico_list['back'].ico}`, payload: { command: 'alliance_control', id_builder_sent: 0, target: builder.id, id_planet: id_planet }, color: 'secondary' })
        }
    }
    keyboard.textButton({ label: `${ico_list['add'].ico}${ico_list['alliance'].ico}`, payload: { command: 'alliance_controller', command_sub: 'alliance_add', id_builder_sent: id_builder_sent, id_planet: id_planet }, color: 'secondary' })
    keyboard.callbackButton({ label: `${ico_list['cancel'].ico}`, payload: { command: 'alliance_control_multi', id_builder_sent: id_builder_sent, id_planet: id_planet }, color: 'secondary' }).inline().oneTime() 
    await Send_Message(context.peerId, event_logger, keyboard)
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
    const user = await Person_Get(context)
    if (!user) { return }
    // ввод ссылки на сообщество вк
    const targeta = await Input_Text(context, `Введите ссылку на сообщество нового союзника.\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`)
    if (!targeta) { return}
    const temp = targeta.replace(/.*[/]/, "");
    try {
        const [group] = await vk.api.groups.getById({ group_id: temp });
	    if (!group) { return }
	    const alli_check = await prisma.alliance.findFirst({ where: { idvk: group.id } })
	    if (!alli_check) {
	    	const alli_cr = await prisma.alliance.create({ data: { name: group.name!, idvk: group.id!, }})
	    	await Logger(`In database created new alliance id ${alli_cr.id} name ${alli_cr.name} by user ${context.peerId}`)
	    	await context.send(`${ico_list['save'].ico} Поздравляем с заключением нового союза!\n\n${ico_list['message'].ico} ${alli_cr.id} - ${alli_cr.name}\n${ico_list['attach'].ico} Ссылка: https://vk.com/club${alli_cr.idvk}`)
            await Send_Message(chat_id, `${ico_list['save'].ico} Заключен новый союз \n${ico_list['message'].ico} Сообщение: ${alli_cr.id} - ${alli_cr.name}\n${ico_list['attach'].ico} Ссылка: https://vk.com/club${alli_cr.idvk}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} Министерство Магии`)
	    } else {
	    	await Logger(`In database already created alliance name ${group.id}`)
            await context.send(`${ico_list['warn'].ico} Союз уже был заключен с:\n\n${ico_list['message'].ico} ${alli_check.id} - ${alli_check.name}\n${ico_list['attach'].ico} Ссылка: https://vk.com/club${alli_check.idvk}`)
	    }
    } catch (e) {
        await context.send(`${ico_list['warn'].ico} Такой группы не найдено! Союз не установлен!`)
    }
}

async function Alliance_Destroy(context: Context, target: number) {
    const user = await Person_Get(context)
    if (!user) { return }
    const keyboard = new KeyboardBuilder()
    const alliance: Alliance | null = await prisma.alliance.findFirst({ where: { id: target }})
    const users_check = await prisma.user.count({ where: { id_alliance: alliance!.id! } })
    if (users_check > 0) { 
        await Send_Message(context.peerId, `${ico_list['warn'].ico} Вы не можете разорвать союз, т.к. в ролевом проекте состоит ${users_check} персонажей:\n\n${ico_list['message'].ico} ${alliance?.id} - ${alliance?.name}\n${ico_list['attach'].ico} Ссылка: https://vk.com/club${alliance?.idvk}`)
        return
    }
    let event_logger = `${ico_list['warn'].ico} В данный момент нельзя разорвать союзы...`
    let id_planet = context.eventPayload.id_planet ?? 0
    let id_builder_sent = context.eventPayload.id_builder_sent ?? 0
    if (alliance) {
        if (context.eventPayload.status == "ok") {
            await prisma.$transaction([
                prisma.alliance.delete({ where: { id: alliance.id } }),
            ]).then(([alli_del]) => {
                event_logger = `${ico_list['delete'].ico} Поздравляем с разрушением союза для:\n\n${ico_list['message'].ico} ${alli_del.id} - ${alli_del.name}\n${ico_list['attach'].ico} Ссылка: https://vk.com/club${alli_del.idvk}` 
                Logger(`In database deleted alliance ${alli_del.name}-${alli_del.id} by user ${context.peerId}`);
                Send_Message(chat_id, `${ico_list['delete'].ico} Разорван древний союз \n${ico_list['message'].ico} Сообщение: ${alli_del.id} - ${alli_del.name}\n${ico_list['attach'].ico} Ссылка: https://vk.com/club${alli_del.idvk}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} Министерство Магии`)
            })
            .catch((error) => {
                event_logger = `${ico_list['warn'].ico} Произошла ошибка разрушения союза, попробуйте позже` 
                Logger(`Error delete alliance from database: ${error.message}`);
            });
        } else {
            event_logger = `${ico_list['alliance'].ico} Вы уверены, что хотите рассторгнуть союз с:\n\n${ico_list['message'].ico} ${alliance.id} - ${alliance.name}\n${ico_list['attach'].ico} Ссылка: https://vk.com/club${alliance.idvk}`
            keyboard.callbackButton({ label: `${ico_list['success'].ico} Хочу`, payload: { command: 'alliance_controller', command_sub: 'alliance_destroy', id_builder_sent: id_builder_sent, office_current: 0, target: alliance.id, status: "ok", id_planet: id_planet }, color: 'secondary' })
        } 
    }
    //назад хз куда
    keyboard.callbackButton({ label: `${ico_list['cancel'].ico}`, payload: { command: 'alliance_control', office_current: 0, id_builder_sent: 0, target: undefined, id_planet: 0 }, color: 'secondary' }).inline().oneTime() 
    await Send_Message(context.peerId, event_logger, keyboard)
}

export async function Alliance_Updater(context: any) {
    await Send_Message(context.senderId, `${ico_list['run'].ico} Приступаем к процессу сверки названий ролевых проектов!`)
    for (const alli of await prisma.alliance.findMany({})) {
        const temp = alli.idvk
        const [group] = await vk.api.groups.getById({ group_id: temp });
        if (!group) { continue }
        const alli_check = await prisma.alliance.findFirst({ where: { idvk: group.id } })
        if (alli_check) {
            if (alli_check.name != group.name! ) {
                const alli_cr = await prisma.alliance.update({ where: { id: alli_check.id }, data: { name: group.name! }})
                await Logger(`In database, updated name alliance id: ${alli_check.id} from ${alli_check.name} to ${alli_cr.name} by admin ${context.senderId}`)
                await Send_Message(chat_id, `${ico_list['alliance'].ico} Название Ролевого проекта ${alli_cr.id}-${alli_cr.idvk} изменилось с ${alli_check.name} на ${alli_cr.name}.`)
                await Send_Message(context.senderId, `${ico_list['alliance'].ico} Название Ролевого проекта ${alli_cr.id}-${alli_cr.idvk} изменилось с ${alli_check.name} на ${alli_cr.name}.`)
            } else {
                await Logger(`In database, not need update name alliance id: ${alli_check.id} name: ${alli_check.name} by admin ${context.senderId}`)
            }
        }
    }
    await Send_Message(context.senderId, `${ico_list['success'].ico} Процесс сверки названий ролевых проектов завершен!`)
}