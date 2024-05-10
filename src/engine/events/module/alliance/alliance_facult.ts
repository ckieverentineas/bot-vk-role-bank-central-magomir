import { Alliance, AllianceCoin, AllianceFacult } from "@prisma/client";
import prisma from "../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, timer_text } from "../../../..";
import { Confirm_User_Success, Logger } from "../../../core/helper";
import { Person_Get } from "../person/person";
import { Facult_Rank_Printer } from "./facult_rank";
import { Person_Coin_Printer } from "../person/person_coin";

//контроллер управления валютами альянса
async function Alliance_Facult_Get(cursor: number, alliance: Alliance) {
    const batchSize = 5;
    let counter = 0
    let limiter = 0
    let res: AllianceFacult[] = []
    for (const allifacult of await prisma.allianceFacult.findMany({ where: { id_alliance: alliance.id } })) {
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
    const alliance = await prisma.alliance.findFirst({ where: { id: user?.id_alliance!}})
    if (!user) { return }
    let allifacult_tr = false
    let cursor = 0
    while (!allifacult_tr) {
        const coin = await Person_Coin_Printer(context)
        const facult_rank = await Facult_Rank_Printer(context)
        const keyboard = new KeyboardBuilder()
        let event_logger = ``
        for await (const alliance_facult of await Alliance_Facult_Get(cursor, alliance!)) {
            keyboard.textButton({ label: `✏ ${alliance_facult.id}-${alliance_facult.name.slice(0,30)}`, payload: { command: 'alliance_facult_edit', cursor: cursor, id_alliance_facult: alliance_facult.id }, color: 'secondary' })
            .textButton({ label: `⛔`, payload: { command: 'alliance_facult_delete', cursor: cursor, id_alliance_facult: alliance_facult.id }, color: 'secondary' }).row()
            //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
            event_logger += `${alliance_facult.smile} ${alliance_facult.name}: id${alliance_facult.id}\n\n`
        }
        if (cursor >= 5) { keyboard.textButton({ label: `←`, payload: { command: 'alliance_facult_back', cursor: cursor }, color: 'secondary' }) }
        const alliance_facult_counter = await prisma.allianceFacult.count({ where: { id_alliance: alliance!.id! } })
        if (5+cursor < alliance_facult_counter) { keyboard.textButton({ label: `→`, payload: { command: 'alliance_facult_next', cursor: cursor }, color: 'secondary' }) }
        keyboard.textButton({ label: `➕`, payload: { command: 'alliance_facult_create', cursor: cursor }, color: 'secondary' }).row()
        .textButton({ label: `🚫`, payload: { command: 'alliance_facult_return', cursor: cursor }, color: 'secondary' }).oneTime()
        event_logger += `\n ${1+cursor} из ${alliance_facult_counter}`
        const allifacult_bt = await context.question(`🧷 Выберите факультет ролевой ${alliance?.name}:\n\n ${event_logger}`,
            {	
                keyboard: keyboard, answerTimeLimit
            }
        )
        if (allifacult_bt.isTimeout) { return await context.send(`⏰ Время ожидания выбора факультета ролевой ${alliance?.name} истекло!`) }
        if (!allifacult_bt.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            const config: any = {
                'alliance_facult_edit': Alliance_Facult_Edit,
                'alliance_facult_create': Alliance_Facult_Create,
                'alliance_facult_next': Alliance_Facult_Next,
                'alliance_facult_back': Alliance_Facult_Back,
                'alliance_facult_return': Alliance_Facult_Return,
                'alliance_facult_delete': Alliance_Facult_Delete
            }
            const ans = await config[allifacult_bt.payload.command](context, allifacult_bt.payload, alliance)
            cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor
            allifacult_tr = ans.stop ? ans.stop : false
        }
    }
    
}

async function Alliance_Facult_Delete(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor }
    const alliance_facult_check = await prisma.allianceFacult.findFirst({ where: { id: data.id_alliance_facult } })
    const confirm: { status: boolean, text: String } = await Confirm_User_Success(context, `удалить факультет ${alliance_facult_check?.id}-${alliance_facult_check?.name}?`)
    await context.send(`${confirm.text}`)
    if (!confirm.status) { return res }
    if (alliance_facult_check) {
        const alliance_facult_del = await prisma.allianceFacult.delete({ where: { id: alliance_facult_check.id } })
        if (alliance_facult_del) {
            await Logger(`In database, deleted alliance facult: ${alliance_facult_del.id}-${alliance_facult_del.name} by admin ${context.senderId}`)
            await context.send(`Вы удалили факультет: ${alliance_facult_del.id}-${alliance_facult_del.name} для ролевой ${alliance.name}!`)
        }
    }
    return res
}

async function Alliance_Facult_Return(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor, stop: true }
    await context.send(`Вы отменили меню управления факультетами ролевого проекта ${alliance.id}-${alliance.name}`)
    return res
}

async function Alliance_Facult_Edit(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor }
    let spec_check = false
    let name_loc = null
    const alliance_facult_check = await prisma.allianceFacult.findFirst({ where: { id: data.id_alliance_facult } })
	while (spec_check == false) {
		const name = await context.question( `🧷 Вы редактируете название факультета: ${alliance_facult_check?.name}. Введите скорректированное название для него:`, timer_text)
		if (name.isTimeout) { return await context.send(`⏰ Время ожидания ввода для корректировки факультета ${alliance_facult_check?.name} истекло!`) }
		if (name.text.length <= 300) {
			spec_check = true
			name_loc = `${name.text}`
		} else { await context.send(`💡 Ввведите до 300 символов включительно!`) }
	}
    let smile_check = false
    let smile = alliance_facult_check?.smile
	while (smile_check == false) {
		const smile_ask: any = await context.question( `🧷 Введите смайлик для обозначения нового факультета ${name_loc}, сейчас стоит ${smile}:`, timer_text)
		if (smile_ask.isTimeout) { return await context.send(`⏰ Время ожидания ввода смайлика для корректировки смайлика факультета ${name_loc} истекло!`) }
		if (smile_ask.text.length <= 10) {
			smile_check = true
			smile = `${smile_ask.text}`
		} else { await context.send(`💡 Ввведите до 10 символов включительно!`) }
	}
    if (name_loc) {
        const quest_up = await prisma.allianceFacult.update({ where: { id: alliance_facult_check?.id }, data: { name: name_loc, smile: smile! } })
        if (quest_up) {
            await Logger(`In database, updated alliance facult: ${quest_up.id}-${quest_up.name} by admin ${context.senderId}`)
            await context.send(`⚙ Вы скорректировали факультет:\n Название: ${alliance_facult_check?.id}-${alliance_facult_check?.name} --> ${quest_up.id}-${quest_up.name}\n Смайлик: ${alliance_facult_check?.smile} --> ${quest_up.smile}\n`)
        }
    }
    return res
}

async function Alliance_Facult_Next(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor+5 }
    return res
}

async function Alliance_Facult_Back(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor-5 }
    return res
}

async function Alliance_Facult_Create(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor }
    let spec_check = false
    let name_loc = null
	while (spec_check == false) {
		const name = await context.question( `🧷 Введите название добавляемого нового факультета:`, timer_text)
		if (name.isTimeout) { return await context.send(`⏰ Время ожидания ввода имени добавляемого нового факультета истекло!`) }
		if (name.text.length <= 300) {
			spec_check = true
			name_loc = `${name.text}`
		} else { await context.send(`💡 Ввведите до 300 символов включительно!`) }
	}
    let smile_check = false
    let smile = null
	while (smile_check == false) {
		const smile_ask: any = await context.question( `🧷 Введите смайлик для обозначения нового факультета ${name_loc}:`, timer_text)
		if (smile_ask.isTimeout) { return await context.send(`⏰ Время ожидания ввода смайлика для обозначения нового факультета ${name_loc} истекло!`) }
		if (smile_ask.text.length <= 10) {
			smile_check = true
			smile = `${smile_ask.text}`
		} else { await context.send(`💡 Ввведите до 10 символов включительно!`) }
	}
    if (name_loc) {
        const loc_cr = await prisma.allianceFacult.create({ data: { name: name_loc, smile: smile!, id_alliance: alliance.id } })
        if (loc_cr) {
            await Logger(`In database, created alliance facult: ${loc_cr.id}-${loc_cr.name} by admin ${context.senderId}`)
            await context.send(`⚙ Вы добавили новый факультет ${loc_cr.id}-${loc_cr.name} для ролевой ${alliance.name}`)
        }
    }
    return res
}