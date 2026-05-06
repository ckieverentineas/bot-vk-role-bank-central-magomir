import { Alliance, AllianceCoin, User } from "@prisma/client";
import prisma from "../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id } from "../../../..";
import { Confirm_User_Success, Input_Text, Keyboard_Index, Logger, Send_Message, Send_Message_Question } from "../../../core/helper";
import { Person_Get } from "../person/person";
import { ico_list } from "../data_center/icons_lib";
import { button_alliance_return } from "../data_center/standart";

//контроллер управления валютами альянса
function Format_Bool_Status(value: boolean) {
    return value ? "✅" : "⛔"
}

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
            event_logger += `${alliance_coin.smile} ${alliance_coin.name}: id${alliance_coin.id}\nРейтинговая валюта: ${Format_Bool_Status(alliance_coin.point)}\nСБП: ${Format_Bool_Status(alliance_coin.sbp_on)}\n\n`
        }
        if (cursor >= 5) { keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'alliance_coin_back', cursor: cursor }, color: 'secondary' }) }
        const alliance_coin_counter = await prisma.allianceCoin.count({ where: { id_alliance: alliance!.id! } })
        if (5+cursor < alliance_coin_counter) { keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'alliance_coin_next', cursor: cursor }, color: 'secondary' }) }
        keyboard.textButton({ label: `${ico_list['add'].ico}`, payload: { command: 'alliance_coin_create', cursor: cursor }, color: 'secondary' }).row()
        .textButton({ label: `${ico_list['stop'].ico}`, payload: { command: 'alliance_coin_return', cursor: cursor }, color: 'secondary' }).oneTime()
        event_logger += `\n ${1+cursor} из ${alliance_coin_counter}`
        const allicoin_bt: any = await context.question(`${ico_list['attach'].ico} Выберите валюту ${alliance?.name}:\n\n${event_logger}`,
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
    await context.send(`${ico_list['stop'].ico} Отмена меню управления валютами ролевого проекта ${alliance.id}-${alliance.name}`, { keyboard: button_alliance_return })
    return res
}

async function Alliance_Coin_Edit(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }

    while (true) {
        const alliance_coin_check = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } })
        if (!alliance_coin_check) {
            await context.send(`${ico_list['warn'].ico} Валюта не найдена.`)
            return res
        }

        const keyboard = new KeyboardBuilder()
            .textButton({ label: '✏ Название', payload: { command: 'alliance_coin_edit_name', cursor: data.cursor, id_alliance_coin: alliance_coin_check.id }, color: 'secondary' })
            .textButton({ label: '😀 Смайлик', payload: { command: 'alliance_coin_edit_smile', cursor: data.cursor, id_alliance_coin: alliance_coin_check.id }, color: 'secondary' }).row()
            .textButton({ label: '🏆 Рейтинг', payload: { command: 'alliance_coin_edit_point', cursor: data.cursor, id_alliance_coin: alliance_coin_check.id }, color: 'secondary' })
            .textButton({ label: '💸 СБП', payload: { command: 'alliance_coin_edit_sbp', cursor: data.cursor, id_alliance_coin: alliance_coin_check.id }, color: 'secondary' }).row()

        const text =
            `${ico_list['edit'].ico} Редактирование валюты ${alliance.name}\n\n` +
            `${alliance_coin_check.smile} ${alliance_coin_check.name}\n` +
            `ID: ${alliance_coin_check.id}\n` +
            `Рейтинговая: ${Format_Bool_Status(alliance_coin_check.point)}\n` +
            `СБП: ${Format_Bool_Status(alliance_coin_check.sbp_on)}\n\n` +
            `Выберите, что изменить:`

        const answer = await Send_Message_Question(context, text, keyboard)
        if (answer.exit) { return res }

        const config: any = {
            'alliance_coin_edit_name': Alliance_Coin_Edit_Name,
            'alliance_coin_edit_smile': Alliance_Coin_Edit_Smile,
            'alliance_coin_edit_point': Alliance_Coin_Edit_Point,
            'alliance_coin_edit_sbp': Alliance_Coin_Edit_Sbp
        }

        if (answer.payload?.command in config) {
            await config[answer.payload.command](context, answer.payload, alliance, user)
        }
    }
}

async function Notify_Alliance_Coin_Update(context: any, alliance: Alliance, user: User, after: AllianceCoin, changes: string) {
    await Logger(`In database, updated alliance coin: ${after.id}-${after.name} by admin ${context.senderId}`)
    await context.send(`${ico_list['reconfig'].ico} Вы скорректировали валюту:\n${changes}`)
    await Send_Message(chat_id, `${ico_list['reconfig'].ico} Изменение ролевой валюты\n${ico_list['message'].ico} Сообщение:\n${changes}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} ${alliance.name}`)
}

async function Alliance_Coin_Edit_Name(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const coin = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } })
    if (!coin) { return res }

    const coin_name = await Input_Text(context, `Текущее название валюты: [${coin.name}].\n${ico_list['help'].ico}Отправьте новое название:`, 80)
    if (!coin_name) { return res }

    const coin_up = await prisma.allianceCoin.update({ where: { id: coin.id }, data: { name: coin_name } })
    await Notify_Alliance_Coin_Update(context, alliance, user, coin_up, `Название: ${coin.id}-${coin.name} --> ${coin_up.id}-${coin_up.name}`)
    return res
}

async function Alliance_Coin_Edit_Smile(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const coin = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } })
    if (!coin) { return res }

    const coin_smile = await Input_Text(context, `Текущий смайлик валюты ${coin.name}: [${coin.smile}].\n${ico_list['help'].ico}Отправьте новый смайлик:`, 10)
    if (!coin_smile) { return res }

    const coin_up = await prisma.allianceCoin.update({ where: { id: coin.id }, data: { smile: coin_smile } })
    await Notify_Alliance_Coin_Update(context, alliance, user, coin_up, `Смайлик ${coin.id}-${coin.name}: ${coin.smile} --> ${coin_up.smile}`)
    return res
}

async function Alliance_Coin_Edit_Point(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const coin = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } })
    if (!coin) { return res }

    const nextPoint = !coin.point
    const confirm: { status: boolean, text: String } = await Confirm_User_Success(context, `переключить рейтинговость валюты ${coin.smile} ${coin.name}: ${Format_Bool_Status(coin.point)} --> ${Format_Bool_Status(nextPoint)}?`)
    await context.send(`${confirm.text}`)
    if (!confirm.status) { return res }

    const coin_up = await prisma.allianceCoin.update({
        where: { id: coin.id },
        data: {
            point: nextPoint,
            converted_point: nextPoint ? coin.converted_point : false
        }
    })
    await Notify_Alliance_Coin_Update(context, alliance, user, coin_up, `Рейтинговая валюта ${coin.id}-${coin.name}: ${Format_Bool_Status(coin.point)} --> ${Format_Bool_Status(coin_up.point)}`)
    return res
}

async function Alliance_Coin_Edit_Sbp(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const coin = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } })
    if (!coin) { return res }

    const nextSbp = !coin.sbp_on
    const confirm: { status: boolean, text: String } = await Confirm_User_Success(context, `переключить СБП для валюты ${coin.smile} ${coin.name}: ${Format_Bool_Status(coin.sbp_on)} --> ${Format_Bool_Status(nextSbp)}?`)
    await context.send(`${confirm.text}`)
    if (!confirm.status) { return res }

    const coin_up = await prisma.allianceCoin.update({ where: { id: coin.id }, data: { sbp_on: nextSbp } })
    await Notify_Alliance_Coin_Update(context, alliance, user, coin_up, `СБП ${coin.id}-${coin.name}: ${Format_Bool_Status(coin.sbp_on)} --> ${Format_Bool_Status(coin_up.sbp_on)}`)
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
    const sbp_check: { status: boolean, text: String } = await Confirm_User_Success(context, `разрешить переводы валюты ${coin_name} между игроками (СБП)?`)
    await context.send(`${sbp_check.text}`)
    const loc_cr = await prisma.allianceCoin.create({ data: { name: coin_name, smile: coin_smile, id_alliance: alliance.id, point: rank_check.status, sbp_on: sbp_check.status } })
    if (loc_cr) {
        await Logger(`In database, created alliance coin: ${loc_cr.id}-${loc_cr.name} by admin ${context.senderId}`)
        await context.send(`${ico_list['save'].ico} Добавлена новая ролевая валюта ${loc_cr.id}-${loc_cr.name} для ролевой ${alliance.name}`)
        await Send_Message(chat_id, `${ico_list['save'].ico} Сохранение новой ролевой валюты\n${ico_list['message'].ico} Сообщение: ${loc_cr.id}-${loc_cr.name}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} ${alliance.name}`)
    }
    return res
}
