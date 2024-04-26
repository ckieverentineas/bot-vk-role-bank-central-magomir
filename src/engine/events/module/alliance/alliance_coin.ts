import { Alliance, AllianceCoin } from "@prisma/client";
import prisma from "../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, timer_text } from "../../../..";
import { Confirm_User_Success, Logger } from "../../../core/helper";
import { Person_Get } from "../../../core/person";

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
    const alliance = await prisma.alliance.findFirst({ where: { id: user?.id_alliance!}})
    if (!user) { return }
    let allicoin_tr = false
    let cursor = 0
    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder()
        let event_logger = ``
        for await (const alliance_coin of await Alliance_Coin_Get(cursor, alliance!)) {
            keyboard.textButton({ label: `✏ ${alliance_coin.id}-${alliance_coin.name.slice(0,30)}`, payload: { command: 'alliance_coin_edit', cursor: cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' })
            .textButton({ label: `⛔`, payload: { command: 'alliance_coin_delete', cursor: cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' }).row()
            //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
            event_logger += `${alliance_coin.smile} ${alliance_coin.name}: id${alliance_coin.id}\nРейтинговая валюта: ${alliance_coin?.point == true ? "✅" : "⛔"}\n\n`
        }
        if (cursor >= 5) { keyboard.textButton({ label: `←`, payload: { command: 'alliance_coin_back', cursor: cursor }, color: 'secondary' }) }
        const alliance_coin_counter = await prisma.allianceCoin.count({ where: { id_alliance: alliance!.id! } })
        if (5+cursor < alliance_coin_counter) { keyboard.textButton({ label: `→`, payload: { command: 'alliance_coin_next', cursor: cursor }, color: 'secondary' }) }
        keyboard.textButton({ label: `➕`, payload: { command: 'alliance_coin_create', cursor: cursor }, color: 'secondary' }).row()
        .textButton({ label: `🚫`, payload: { command: 'alliance_coin_return', cursor: cursor }, color: 'secondary' }).oneTime()
        event_logger += `\n ${1+cursor} из ${alliance_coin_counter}`
        const allicoin_bt = await context.question(`🧷 Выберите валюту ${alliance?.name}:\n\n ${event_logger}`,
            {	
                keyboard: keyboard, answerTimeLimit
            }
        )
        if (allicoin_bt.isTimeout) { return await context.send(`⏰ Время ожидания выбора валюты ${alliance?.name} истекло!`) }
        if (!allicoin_bt.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            const config: any = {
                'alliance_coin_edit': Alliance_Coin_Edit,
                'alliance_coin_create': Alliance_Coin_Create,
                'alliance_coin_next': Alliance_Coin_Next,
                'alliance_coin_back': Alliance_Coin_Back,
                'alliance_coin_return': Alliance_Coin_Return,
                'alliance_coin_delete': Alliance_Coin_Delete
            }
            const ans = await config[allicoin_bt.payload.command](context, allicoin_bt.payload, alliance)
            cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor
            allicoin_tr = ans.stop ? ans.stop : false
        }
    }
    
}

async function Alliance_Coin_Delete(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor }
    const alliance_coin_check = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin } })
    const confirm: { status: boolean, text: String } = await Confirm_User_Success(context, `удалить валюту ${alliance_coin_check?.id}-${alliance_coin_check?.name}?`)
    await context.send(`${confirm.text}`)
    if (!confirm.status) { return res }
    if (alliance_coin_check) {
        const alliance_coin_del = await prisma.allianceCoin.delete({ where: { id: alliance_coin_check.id } })
        if (alliance_coin_del) {
            await Logger(`In database, deleted alliance coin: ${alliance_coin_del.id}-${alliance_coin_del.name} by admin ${context.senderId}`)
            await context.send(`Вы удалили валюту: ${alliance_coin_del.id}-${alliance_coin_del.name} для ролевой ${alliance.name}!`)
        }
    }
    return res
}

async function Alliance_Coin_Return(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor, stop: true }
    await context.send(`Вы отменили меню управления валютами ролевого проекта ${alliance.id}-${alliance.name}`)
    return res
}

async function Alliance_Coin_Edit(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor }
    let spec_check = false
    let name_loc = null
    const alliance_coin_check = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin } })
	while (spec_check == false) {
		const name = await context.question( `🧷 Вы редактируете название валюты: ${alliance_coin_check?.name}. Введите скорректированное название для него:`, timer_text)
		if (name.isTimeout) { return await context.send(`⏰ Время ожидания ввода для корректировки валюты ${alliance_coin_check?.name} истекло!`) }
		if (name.text.length <= 300) {
			spec_check = true
			name_loc = `${name.text}`
		} else { await context.send(`💡 Ввведите до 300 символов включительно!`) }
	}
    let smile_check = false
    let smile = alliance_coin_check?.smile
	while (smile_check == false) {
		const smile_ask: any = await context.question( `🧷 Введите смайлик для обозначения новой валюты ${name_loc}, сейчас стоит ${smile}:`, timer_text)
		if (smile_ask.isTimeout) { return await context.send(`⏰ Время ожидания ввода смайлика для корректировки смайлика валюты ${name_loc} истекло!`) }
		if (smile_ask.text.length <= 10) {
			smile_check = true
			smile = `${smile_ask.text}`
		} else { await context.send(`💡 Ввведите до 10 символов включительно!`) }
	}
    alliance_coin_check?.point == true ? await context.send(`Валюта ${name_loc} является рейтинговой`) : await context.send(`Валюта ${name_loc} является рейтинговой`)
	const rank_check: { status: boolean, text: String } = await Confirm_User_Success(context, `сделать валюту ${name_loc} рейтинговой?`)
    await context.send(`${rank_check.text}`)
    if (name_loc) {
        const quest_up = await prisma.allianceCoin.update({ where: { id: alliance_coin_check?.id }, data: { name: name_loc, smile: smile!, point: rank_check.status } })
        if (quest_up) {
            await Logger(`In database, updated alliance coin: ${quest_up.id}-${quest_up.name} by admin ${context.senderId}`)
            await context.send(`⚙ Вы скорректировали валюту:\n Название: ${alliance_coin_check?.id}-${alliance_coin_check?.name} --> ${quest_up.id}-${quest_up.name}\n Смайлик: ${alliance_coin_check?.smile} --> ${quest_up.smile}\n Рейтинговая валюта: ${alliance_coin_check?.point == true ? "✅" : "⛔"} --> ${quest_up.point == true ? "✅" : "⛔"}`)
        }
    }
    return res
}

async function Alliance_Coin_Next(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor+5 }
    return res
}

async function Alliance_Coin_Back(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor-5 }
    return res
}

async function Alliance_Coin_Create(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor }
    let spec_check = false
    let name_loc = null
	while (spec_check == false) {
		const name = await context.question( `🧷 Введите название добавляемого новой валюты:`, timer_text)
		if (name.isTimeout) { return await context.send(`⏰ Время ожидания ввода имени добавляемой новой валюты истекло!`) }
		if (name.text.length <= 300) {
			spec_check = true
			name_loc = `${name.text}`
		} else { await context.send(`💡 Ввведите до 300 символов включительно!`) }
	}
    let smile_check = false
    let smile = null
	while (smile_check == false) {
		const smile_ask: any = await context.question( `🧷 Введите смайлик для обозначения новой валюты ${name_loc}:`, timer_text)
		if (smile_ask.isTimeout) { return await context.send(`⏰ Время ожидания ввода смайлика для обозначения новой валюты ${name_loc} истекло!`) }
		if (smile_ask.text.length <= 10) {
			smile_check = true
			smile = `${smile_ask.text}`
		} else { await context.send(`💡 Ввведите до 10 символов включительно!`) }
	}
	const rank_check: { status: boolean, text: String } = await Confirm_User_Success(context, `сделать валюту ${name_loc} рейтинговой?`)
    await context.send(`${rank_check.text}`)
    if (name_loc) {
        const loc_cr = await prisma.allianceCoin.create({ data: { name: name_loc, smile: smile!, id_alliance: alliance.id, point: rank_check.status } })
        if (loc_cr) {
            await Logger(`In database, created alliance coin: ${loc_cr.id}-${loc_cr.name} by admin ${context.senderId}`)
            await context.send(`⚙ Вы добавили новую валюту ${loc_cr.id}-${loc_cr.name} для ролевой ${alliance.name}`)
        }
    }
    return res
}