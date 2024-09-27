import { Alliance, AllianceCoin, User } from "@prisma/client";
import prisma from "../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id, timer_text } from "../../../..";
import { Confirm_User_Success, Keyboard_Index, Logger, Send_Message } from "../../../core/helper";
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

export async function Alliance_Coin_Converter_Editor_Printer(context: any) {
    const user = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } })
    if (!alliance) { return }
    if (!user) { return }
    let allicoin_tr = false
    let cursor = 0
    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder()
        let event_logger = ``
        for await (const alliance_coin of await Alliance_Coin_Get(cursor, alliance!)) {
            keyboard.textButton({ label: `${ico_list['edit'].ico} ${alliance_coin.id}-${alliance_coin.name.slice(0,30)}`, payload: { command: 'alliance_coin_edit', cursor: cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' })
            .textButton({ label: `${ico_list['config'].ico}`, payload: { command: 'alliance_coin_config', cursor: cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' }).row()
            event_logger += `${alliance_coin.smile} ${alliance_coin.name}: id${alliance_coin.id}\nРейтинговая валюта: ${alliance_coin?.point == true ? "✅" : "⛔"}\n⚖ Курс конвертации: ${alliance_coin.course_medal}🔘 --> ${alliance_coin.course_coin}${alliance_coin.smile}\n\n`
        }
        if (cursor >= 5) { keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'alliance_coin_back', cursor: cursor }, color: 'secondary' }) }
        const alliance_coin_counter = await prisma.allianceCoin.count({ where: { id_alliance: alliance!.id! } })
        if (5+cursor < alliance_coin_counter) { keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'alliance_coin_next', cursor: cursor }, color: 'secondary' }) }
        keyboard.textButton({ label: `${ico_list['cancel'].ico}`, payload: { command: 'alliance_coin_return', cursor: cursor }, color: 'secondary' }).oneTime()
        event_logger += `\n ${1+cursor} из ${alliance_coin_counter}`
        const allicoin_bt: any = await context.question(`${ico_list['attach'].ico} Выберите валюту ${alliance?.name} для изменения курса:\n\n ${event_logger}`,
            {	
                keyboard: keyboard, answerTimeLimit
            }
        )
        if (allicoin_bt.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания выбора валюты ${alliance?.name} истекло!`) }
        const config: any = {
            'alliance_coin_edit': Alliance_Coin_Edit,
            'alliance_coin_config': Alliance_Coin_Config,
            'alliance_coin_next': Alliance_Coin_Next,
            'alliance_coin_back': Alliance_Coin_Back,
            'alliance_coin_return': Alliance_Coin_Return,
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

async function Alliance_Coin_Return(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor, stop: true }
    await context.send(`${ico_list['cancel'].ico} Отмена меню управления курсами конвертации валют ролевого проекта ${alliance.id}-${alliance.name}`, { keyboard: Keyboard.builder().callbackButton({ label: '🌐 В ролевую', payload: { command: 'alliance_enter' }, color: 'primary' }).inline() })
    return res
}

async function Alliance_Coin_Edit(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    let spec_check = false
    const alliance_coin_check = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin } })
    const course_change = { course_medal: 1, course_coin: 1 }
	while (spec_check == false) {
		const name = await context.question( `${ico_list['attach'].ico} Вы редактируете курс валюты: ${alliance_coin_check?.name}. Сейчас установлена ценность жетонов ${alliance_coin_check?.course_medal}🔘, введите новую:`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: `${ico_list['cancel'].ico} Отмена`, payload: { command: 'limited' }, color: 'secondary' })
                .oneTime().inline(),
                timer_text
            }
        )
		if (name.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания ввода для нового курса валюты ${alliance_coin_check?.name} по жетонам истекло!`) }
		if (/^(0|-?[1-9]\d{0,5})$/.test(name.text)) {
            course_change.course_medal = Number(name.text)
            spec_check = true
        } else {
            if (name.text == `${ico_list['cancel'].ico} Отмена`) { 
                await context.send(`${ico_list['cancel'].ico} Редактирование курса прерваны пользователем!`) 
                return res
            }
            await context.send(`${ico_list['help'].ico} Необходимо ввести корректное число для нового курса!`)
        }
	}
    let coin_course_checker = false
    while (coin_course_checker == false) {
		const name = await context.question( `${ico_list['attach'].ico} Вы редактируете курс валюты: ${alliance_coin_check?.name}. Сейчас установлена ценность ролевой валюты ${alliance_coin_check?.course_coin}${alliance_coin_check?.smile}, введите новую:`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: `${ico_list['cancel'].ico} Отмена`, payload: { command: 'limited' }, color: 'secondary' })
                .oneTime().inline(),
                timer_text
            }
        )
		if (name.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания ввода для нового курса валюты ${alliance_coin_check?.name} по ролевой валюте истекло!`) }
		if (/^(0|-?[1-9]\d{0,5})$/.test(name.text)) {
            course_change.course_coin = Number(name.text)
            coin_course_checker = true
        } else {
            if (name.text == `${ico_list['cancel'].ico} Отмена`) { 
                await context.send(`${ico_list['cancel'].ico} Редактирование курса прерваны пользователем!`) 
                return res
            }
            await context.send(`${ico_list['help'].ico} Необходимо ввести корректное число для нового курса!`)
        }
	}
	const rank_check: { status: boolean, text: String } = await Confirm_User_Success(context, `изменить курс жетонов:\n${ico_list['medal'].ico} ${alliance_coin_check?.course_medal} --> ${course_change.course_medal}\n изменить курс валюты ${alliance_coin_check?.name}:\n${alliance_coin_check?.smile} ${alliance_coin_check?.course_coin} --> ${course_change.course_coin}?`)
    await context.send(`${rank_check.text}`)
    if (rank_check.status) {
        const quest_up = await prisma.allianceCoin.update({ where: { id: alliance_coin_check?.id }, data: { course_medal: course_change.course_medal, course_coin: course_change.course_coin } })
        if (quest_up) {
            await Logger(`In database, updated course alliance coin: ${quest_up.id}-${quest_up.name} by admin ${context.senderId}`)
            await context.send(`${ico_list['reconfig'].ico} Вы скорректировали курс валюты:\n Название: ${alliance_coin_check?.id}-${alliance_coin_check?.name}\n⛔ ${alliance_coin_check?.course_medal}${ico_list['medal'].ico} --> ${alliance_coin_check?.course_coin}${alliance_coin_check?.smile}\n✅ ${quest_up?.course_medal}${ico_list['medal'].ico} --> ${quest_up?.course_coin}${quest_up?.smile}`)
            await Send_Message(chat_id, `${ico_list['reconfig'].ico} Корректировка курса конвертации ролевой валюты\n${ico_list['message'].ico} Сообщение:\nНазвание: ${alliance_coin_check?.id}-${alliance_coin_check?.name}\n⛔ ${alliance_coin_check?.course_medal}${ico_list['medal'].ico} --> ${alliance_coin_check?.course_coin}${alliance_coin_check?.smile}\n✅ ${quest_up?.course_medal}${ico_list['medal'].ico} --> ${quest_up?.course_coin}${quest_up?.smile}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} ${alliance.name}`)
        }
    }
    return res
}

async function Alliance_Coin_Config(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const alliance_coin_check = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin } })
    const converted_change = { converted: alliance_coin_check?.converted, converted_point: alliance_coin_check?.converted_point }
	const converted_check: { status: boolean, text: String } = await Confirm_User_Success(context, `разрешить конвертацию валюты [${alliance_coin_check?.smile} ${alliance_coin_check?.name}]?`)
	converted_change.converted = converted_check.status
    await context.send(`${converted_check.text}`)
    if (alliance_coin_check?.point) {
        const converted_point_check: { status: boolean, text: String } = await Confirm_User_Success(context, `разрешить конвертацию валюты [${alliance_coin_check?.smile} ${alliance_coin_check?.name}] в рейтинги факультетов?`)
        converted_change.converted_point = converted_point_check.status
        await context.send(`${converted_point_check.text}`)
    }
    const rank_check: { status: boolean, text: String } = await Confirm_User_Success(context, `принять изменения?`)
    await context.send(`${rank_check.text}`)
    if (rank_check.status) {
        const quest_up = await prisma.allianceCoin.update({ where: { id: alliance_coin_check?.id }, data: { converted: converted_change.converted, converted_point: converted_change.converted_point } })
        if (quest_up) {
            await Logger(`In database, updated config alliance coin: ${quest_up.id}-${quest_up.name} by admin ${context.senderId}`)
            await context.send(`${ico_list['reconfig'].ico} Вы скорректировали конфигурацию валюты:\n${alliance_coin_check?.smile} Название: ${alliance_coin_check?.id}-${alliance_coin_check?.name}\n${quest_up.converted ? `✅` : `⛔`} Конвертация валюты\n${quest_up.converted_point ? `✅` : `⛔`} Конвертация валюты в рейтинги факультетов\n`)
            await Send_Message(chat_id, `${ico_list['reconfig'].ico} Корректировка конфигурации курса конвертации ролевой валюты\n${ico_list['message'].ico} Сообщение:\nНазвание: ${alliance_coin_check?.id}-${alliance_coin_check?.name}\n${quest_up.converted ? `✅` : `⛔`} Конвертация валюты\n${quest_up.converted_point ? `✅` : `⛔`} Конвертация валюты в рейтинги факультетов\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} ${alliance.name}`)
        }
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