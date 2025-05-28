import { Alliance, AllianceFacult, User } from "@prisma/client";
import prisma from "../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id } from "../../../..";
import { Confirm_User_Success, Input_Text, Keyboard_Index, Logger, Send_Message } from "../../../core/helper";
import { Person_Get } from "../person/person";
import { Facult_Rank_Printer } from "./facult_rank";
import { Person_Coin_Printer } from "../person/person_coin";
import { ico_list } from "../data_center/icons_lib";

//контроллер управления валютами альянса
async function Alliance_Facult_Get(cursor: number, alliance: Alliance) {
    const batchSize = 5;
    let counter = 0
    let limiter = 0
    let res: AllianceFacult[] = []
    for (const allifacult of await prisma.allianceFacult.findMany({ where: { id_alliance: alliance?.id } })) {
        if ((cursor <= counter && batchSize+cursor >= counter) && limiter < batchSize) {
            res.push(allifacult)
            limiter++
        }
        counter++
    }
    
   return res
}

export async function Alliance_Facult_Printer(context: any) {
    const user = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } })
    if (!alliance) { return }
    if (!user) { return }
    let allifacult_tr = false
    let cursor = 0
    while (!allifacult_tr) {
        const coin = await Person_Coin_Printer(context)
        const facult_rank = await Facult_Rank_Printer(context)
        const keyboard = new KeyboardBuilder()
        let event_logger = ``
        for await (const alliance_facult of await Alliance_Facult_Get(cursor, alliance!)) {
            keyboard.textButton({ label: `${ico_list['edit'].ico} ${alliance_facult.id}-${alliance_facult.name.slice(0,30)}`, payload: { command: 'alliance_facult_edit', cursor: cursor, id_alliance_facult: alliance_facult.id }, color: 'secondary' })
            .textButton({ label: `${ico_list['delete'].ico}`, payload: { command: 'alliance_facult_delete', cursor: cursor, id_alliance_facult: alliance_facult.id }, color: 'secondary' }).row()
            event_logger += `${alliance_facult.smile} ${alliance_facult.name}: id${alliance_facult.id}\n\n`
        }
        if (cursor >= 5) { keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'alliance_facult_back', cursor: cursor }, color: 'secondary' }) }
        const alliance_facult_counter = await prisma.allianceFacult.count({ where: { id_alliance: alliance?.id } })
        if (5+cursor < alliance_facult_counter) { keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'alliance_facult_next', cursor: cursor }, color: 'secondary' }) }
        keyboard.textButton({ label: `${ico_list['add'].ico}`, payload: { command: 'alliance_facult_create', cursor: cursor }, color: 'secondary' }).row()
        .textButton({ label: `${ico_list['cancel'].ico}`, payload: { command: 'alliance_facult_return', cursor: cursor }, color: 'secondary' }).oneTime()
        event_logger += `\n ${1+cursor} из ${alliance_facult_counter}`
        const allifacult_bt: any = await context.question(`${ico_list['attach'].ico} Выберите факультет ролевой ${alliance?.name}:\n\n ${event_logger}`, { keyboard: keyboard, answerTimeLimit })
        if (allifacult_bt.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания выбора факультета ролевой ${alliance?.name} истекло!`) }
        const config: any = {
            'alliance_facult_edit': Alliance_Facult_Edit,
            'alliance_facult_create': Alliance_Facult_Create,
            'alliance_facult_next': Alliance_Facult_Next,
            'alliance_facult_back': Alliance_Facult_Back,
            'alliance_facult_return': Alliance_Facult_Return,
            'alliance_facult_delete': Alliance_Facult_Delete
        }
        if (allifacult_bt?.payload?.command in config) {
            const commandHandler = config[allifacult_bt.payload.command];
            const ans = await commandHandler(context, allifacult_bt.payload, alliance, user)
            cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor
            allifacult_tr = ans.stop ? ans.stop : false
        } else {
            await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`)
        }
    }
    await Keyboard_Index(context, `${ico_list['help'].ico} Мерлинова борода, что у нас здесь?!`)
}

async function Alliance_Facult_Delete(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const alliance_facult_check = await prisma.allianceFacult.findFirst({ where: { id: data.id_alliance_facult } })
    const confirm: { status: boolean, text: String } = await Confirm_User_Success(context, `удалить факультет ${alliance_facult_check?.id}-${alliance_facult_check?.name}?`)
    await context.send(`${confirm.text}`)
    if (!confirm.status) { return res }
    if (alliance_facult_check) {
        const alliance_facult_del = await prisma.allianceFacult.delete({ where: { id: alliance_facult_check.id } })
        if (alliance_facult_del) {
            await Logger(`In database, deleted alliance facult: ${alliance_facult_del.id}-${alliance_facult_del.name} by admin ${context.senderId}`)
            await context.send(`${ico_list['delete'].ico} Удален факультет: ${alliance_facult_del.id}-${alliance_facult_del.name} для ролевой ${alliance.name}!`)
            await Send_Message(chat_id, `${ico_list['delete'].ico} Удаление ролевого факультета\n${ico_list['message'].ico} Сообщение: ${alliance_facult_del.id}-${alliance_facult_del.name}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} ${alliance.name}`)
        }
    }
    return res
}

async function Alliance_Facult_Return(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor, stop: true }
    await context.send(`${ico_list['cancel'].ico} Отмена меню управления факультетами ролевого проекта ${alliance.id}-${alliance.name}`, { keyboard: Keyboard.builder().callbackButton({ label: '🌐 В ролевую', payload: { command: 'alliance_enter' }, color: 'primary' }).inline().oneTime() })
    return res
}

async function Alliance_Facult_Edit(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const alliance_facult_check = await prisma.allianceFacult.findFirst({ where: { id: data.id_alliance_facult } })
    // изменение названия факультета
    const facult_name = await Input_Text(context, `Вы редактируете название факультета: [${alliance_facult_check?.name}].\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`)
    if (!facult_name) { return res}
    // изменение смайлика факультета
    const facult_smile = await Input_Text(context, `Введите смайлик для обозначения редактируемого факультета [${facult_name}], сейчас стоит [${alliance_facult_check?.smile}]:.\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`, 10)
    if (!facult_smile) { return res}
    // сохранение
    const facult_up = await prisma.allianceFacult.update({ where: { id: alliance_facult_check?.id }, data: { name: facult_name, smile: facult_smile } })
    if (facult_up) {
        await Logger(`In database, updated alliance facult: ${facult_up.id}-${facult_up.name} by admin ${context.senderId}`)
        await context.send(`${ico_list['reconfig'].ico} Изменен факультет:\n Название: ${alliance_facult_check?.id}-${alliance_facult_check?.name} --> ${facult_up.id}-${facult_up.name}\n Смайлик: ${alliance_facult_check?.smile} --> ${facult_up.smile}\n`)
        await Send_Message(chat_id, `${ico_list['reconfig'].ico} Изменение ролевого факультета\n${ico_list['message'].ico} Сообщение:\nНазвание: ${alliance_facult_check?.id}-${alliance_facult_check?.name} --> ${facult_up.id}-${facult_up.name}\n Смайлик: ${alliance_facult_check?.smile} --> ${facult_up.smile}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} ${alliance.name}`)
    }
    return res
}

async function Alliance_Facult_Next(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor+5 }
    return res
}

async function Alliance_Facult_Back(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor-5 }
    return res
}

async function Alliance_Facult_Create(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    // воод названия факультета
    const facult_name = await Input_Text(context, `Введите название нового факультета:\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`)
    if (!facult_name) { return res}
    // задание смайлика факультета
    const facult_smile = await Input_Text(context, `Введите смайлик для обозначения нового факультета ${facult_name}.\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`, 10)
    if (!facult_smile) { return res}
    // запись нового факультета
    const facult_cr = await prisma.allianceFacult.create({ data: { name: facult_name, smile: facult_smile, id_alliance: alliance.id } })
    if (facult_cr) {
        await Logger(`In database, created alliance facult: ${facult_cr.id}-${facult_cr.name} by admin ${context.senderId}`)
        await context.send(`${ico_list['save'].ico} Вы добавили новый факультет ${facult_cr.id}-${facult_cr.name} для ролевой ${alliance.name}`)
        await Send_Message(chat_id, `${ico_list['save'].ico} Сохранение нового ролевого факультета\n${ico_list['message'].ico} Сообщение: ${facult_cr.id}-${facult_cr.name}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} ${alliance.name}`)
    }
    return res
}