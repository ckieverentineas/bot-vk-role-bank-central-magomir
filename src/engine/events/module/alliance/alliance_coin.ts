import { Alliance, AllianceCoin, User } from "@prisma/client";
import prisma from "../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id } from "../../../..";
import { Confirm_User_Success, Input_Text, Keyboard_Index, Logger, Send_Message } from "../../../core/helper";
import { Person_Get } from "../person/person";
import { ico_list } from "../data_center/icons_lib";

//контроллер управления валютами альянса
async function Alliance_Coin_Get(cursor: number, alliance: Alliance) {
    const batchSize = 5;
    let counter = 0
    let limiter = 0
    let res: AllianceCoin[] = []
    for (const allicoin of await prisma.allianceCoin.findMany({ where: { id_alliance: alliance.id } })) {
        if ((cursor <= counter && batchSize+cursor >= counter) && limiter < batchSize) {
            res.push(allicoin)
            limiter++
        }
        counter++
    }
    
   return res
}

export async function Alliance_Coin_Printer(context: any) {
    const user = await Person_Get(context)
    if (!user) { return }
    const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } })
    if (!alliance) { return }
    let allicoin_tr = false
    let cursor = 0
    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder()
        let event_logger = ``
        for await (const alliance_coin of await Alliance_Coin_Get(cursor, alliance!)) {
            keyboard.textButton({ label: `${ico_list['edit'].ico} ${alliance_coin.id}-${alliance_coin.name.slice(0,30)}`, payload: { command: 'alliance_coin_edit', cursor: cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' })
            .textButton({ label: `${ico_list['delete'].ico}`, payload: { command: 'alliance_coin_delete', cursor: cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' }).row()
            event_logger += `${alliance_coin.smile} ${alliance_coin.name}: id${alliance_coin.id}\nРейтинговая валюта: ${alliance_coin?.point == true ? "✅" : "⛔"}\n\n`
        }
        if (cursor >= 5) { keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'alliance_coin_back', cursor: cursor }, color: 'secondary' }) }
        const alliance_coin_counter = await prisma.allianceCoin.count({ where: { id_alliance: alliance!.id! } })
        if (5+cursor < alliance_coin_counter) { keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'alliance_coin_next', cursor: cursor }, color: 'secondary' }) }
        keyboard.textButton({ label: `${ico_list['add'].ico}`, payload: { command: 'alliance_coin_create', cursor: cursor }, color: 'secondary' }).row()
        .textButton({ label: `${ico_list['cancel'].ico}`, payload: { command: 'alliance_coin_return', cursor: cursor }, color: 'secondary' }).oneTime()
        event_logger += `\n ${1+cursor} из ${alliance_coin_counter}`
        const allicoin_bt: any = await context.question(`${ico_list['attach'].ico} Выберите валюту ${alliance?.name}:\n\n ${event_logger}`,
            {	
                keyboard: keyboard, answerTimeLimit
            }
        )
        if (allicoin_bt.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания выбора валюты ${alliance?.name} истекло!`) }
        const config: any = {
            'alliance_coin_edit': Alliance_Coin_Edit,
            'alliance_coin_create': Alliance_Coin_Create,
            'alliance_coin_next': Alliance_Coin_Next,
            'alliance_coin_back': Alliance_Coin_Back,
            'alliance_coin_return': Alliance_Coin_Return,
            'alliance_coin_delete': Alliance_Coin_Delete
        }
        if (allicoin_bt?.payload?.command in config) {
            const commandHandler = config[allicoin_bt.payload.command];
            const ans = await commandHandler(context, allicoin_bt.payload, alliance, user)
            cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor
            allicoin_tr = ans.stop ? ans.stop : false
        } else {
            await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`)
        }
    }
    await Keyboard_Index(context, `${ico_list['help'].ico} Нужно построить зиккурат!`)
}

async function Alliance_Coin_Delete(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const alliance_coin_check = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin } })
    const confirm: { status: boolean, text: String } = await Confirm_User_Success(context, `удалить валюту ${alliance_coin_check?.id}-${alliance_coin_check?.name}?`)
    await context.send(`${confirm.text}`)
    if (!confirm.status) { return res }
    if (alliance_coin_check) {
        const alliance_coin_del = await prisma.allianceCoin.delete({ where: { id: alliance_coin_check.id } })
        if (alliance_coin_del) {
            await Logger(`In database, deleted alliance coin: ${alliance_coin_del.id}-${alliance_coin_del.name} by admin ${context.senderId}`)
            await context.send(`${ico_list['delete'].ico} Валюта [${alliance_coin_del.id}-${alliance_coin_del.name}] для ролевой ${alliance.name} удалена успешно!`)
            await Send_Message(chat_id, `${ico_list['delete'].ico} Удаление ролевой валюты\n${ico_list['message'].ico} Сообщение: ${alliance_coin_del.id}-${alliance_coin_del.name}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} ${alliance.name}`)
        }
    }
    return res
}

async function Alliance_Coin_Return(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor, stop: true }
    await context.send(`${ico_list['cancel'].ico} Отмена меню управления валютами ролевого проекта ${alliance.id}-${alliance.name}`, { keyboard: Keyboard.builder().callbackButton({ label: '🌐 В ролевую', payload: { command: 'alliance_enter' }, color: 'primary' }).inline().oneTime() })
    return res
}

async function Alliance_Coin_Edit(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const alliance_coin_check = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin } })
    // изменение названия ролевой валюты
    const coin_name = await Input_Text(context, `Вы редактируете название валюты: [${alliance_coin_check?.name}].\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`)
    if (!coin_name) { return res}
    // задание смайлика ролевой валюте
    const coin_smile = await Input_Text(context, `Введите смайлик для изменения обозначения валюты ${coin_name}, сейчас стоит [${alliance_coin_check?.smile}].\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`, 10)
    if (!coin_smile) { return res}
    alliance_coin_check?.point == true ? await context.send(`${ico_list['config'].ico} Валюта ${coin_name} является рейтинговой`) : await context.send(`${ico_list['config'].ico} Валюта ${coin_name} не является рейтинговой`)
	const rank_check: { status: boolean, text: String } = await Confirm_User_Success(context, `сделать валюту ${coin_name} рейтинговой?`)
    await context.send(`${rank_check.text}`)
    const coin_up = await prisma.allianceCoin.update({ where: { id: alliance_coin_check?.id }, data: { name: coin_name, smile: coin_smile, point: rank_check.status } })
    if (coin_up) {
        await Logger(`In database, updated alliance coin: ${coin_up.id}-${coin_up.name} by admin ${context.senderId}`)
        await context.send(`${ico_list['reconfig'].ico} Вы скорректировали валюту:\n Название: ${alliance_coin_check?.id}-${alliance_coin_check?.name} --> ${coin_up.id}-${coin_up.name}\n Смайлик: ${alliance_coin_check?.smile} --> ${coin_up.smile}\n Рейтинговая валюта: ${alliance_coin_check?.point == true ? "✅" : "⛔"} --> ${coin_up.point == true ? "✅" : "⛔"}`)
        await Send_Message(chat_id, `${ico_list['reconfig'].ico} Изменение ролевой валюты\n${ico_list['message'].ico} Сообщение:\n${alliance_coin_check?.id}-${alliance_coin_check?.name} --> ${coin_up.id}-${coin_up.name}\n Смайлик: ${alliance_coin_check?.smile} --> ${coin_up.smile}\n Рейтинговая валюта: ${alliance_coin_check?.point == true ? "✅" : "⛔"} --> ${coin_up.point == true ? "✅" : "⛔"}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} ${alliance.name}`)
    }
    return res
}

async function Alliance_Coin_Next(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor+5 }
    return res
}

async function Alliance_Coin_Back(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor-5 }
    return res
}

async function Alliance_Coin_Create(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    // создание названия новой ролевой валюты
    const coin_name = await Input_Text(context, `Введите название добавляемой новой валюты.\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`)
    if (!coin_name) { return res}
    // задание смайлика ролевой валюте
    const coin_smile = await Input_Text(context, `Введите смайлик для обозначения новой валюты [${coin_name}].\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`, 10)
    if (!coin_smile) { return res}
	const rank_check: { status: boolean, text: String } = await Confirm_User_Success(context, `сделать валюту ${coin_name} рейтинговой?`)
    await context.send(`${rank_check.text}`)
    const loc_cr = await prisma.allianceCoin.create({ data: { name: coin_name, smile: coin_smile, id_alliance: alliance.id, point: rank_check.status } })
    if (loc_cr) {
        await Logger(`In database, created alliance coin: ${loc_cr.id}-${loc_cr.name} by admin ${context.senderId}`)
        await context.send(`${ico_list['save'].ico} Добавлена новая ролевая валюта ${loc_cr.id}-${loc_cr.name} для ролевой ${alliance.name}`)
        await Send_Message(chat_id, `${ico_list['save'].ico} Сохранение новой ролевой валюты\n${ico_list['message'].ico} Сообщение: ${loc_cr.id}-${loc_cr.name}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} ${alliance.name}`)
    }
    return res
}