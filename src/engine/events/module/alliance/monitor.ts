import { Alliance, AllianceCoin, Monitor } from "@prisma/client";
import prisma from "../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id, timer_text, vk } from "../../../..";
import { Confirm_User_Success, Fixed_Number_To_Five, Keyboard_Index, Logger, Send_Message } from "../../../core/helper";
import { Person_Get } from "../person/person";

//контроллер управления валютами альянса
async function Alliance_Monitor_Get(cursor: number, alliance: Alliance) {
    const batchSize = 5;
    let counter = 0
    let limiter = 0
    let res: Monitor[] = []
    for (const allicoin of await prisma.monitor.findMany({ where: { id_alliance: alliance.id } })) {
        if ((cursor <= counter && batchSize+cursor >= counter) && limiter < batchSize) {
            res.push(allicoin)
            limiter++
        }
        counter++
    }
    
   return res
}

export async function Alliance_Monitor_Printer(context: any) {
    const user = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } })
    if (!alliance) { return }
    if (!user) { return }
    let allicoin_tr = false
    let cursor = 0
    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder()
        let event_logger = ``
        for await (const monitor of await Alliance_Monitor_Get(cursor, alliance!)) {
            const coins = await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin ?? 0 } })
            keyboard.textButton({ label: `✏ ${monitor.id}-${monitor.name.slice(0,30)}`, payload: { command: 'alliance_coin_edit', cursor: cursor, id_alliance_coin: monitor.id }, color: 'secondary' })
            .textButton({ label: `⛔`, payload: { command: 'alliance_coin_delete', cursor: cursor, id_alliance_coin: monitor.id }, color: 'secondary' }).row()
            //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
            event_logger += `🎥 ${monitor.name}: id${monitor.id}\n🧷 Ссылка: https://vk.com/club${monitor.idvk}\n${coins?.smile} Валюта: ${coins?.name}\n🚧 Лимиты: ${monitor.lim_like}👍 ${monitor.lim_comment}💬 ♾📰\n💰 Стоимость: ${monitor.cost_like}👍 ${monitor.cost_comment}💬 ${monitor.cost_comment}📰\n\n`
        }
        if (cursor >= 5) { keyboard.textButton({ label: `←`, payload: { command: 'alliance_coin_back', cursor: cursor }, color: 'secondary' }) }
        const alliance_coin_counter = await prisma.allianceCoin.count({ where: { id_alliance: alliance!.id! } })
        if (5+cursor < alliance_coin_counter) { keyboard.textButton({ label: `→`, payload: { command: 'alliance_coin_next', cursor: cursor }, color: 'secondary' }) }
        keyboard.textButton({ label: `➕`, payload: { command: 'alliance_coin_create', cursor: cursor }, color: 'secondary' }).row()
        .textButton({ label: `🚫`, payload: { command: 'alliance_coin_return', cursor: cursor }, color: 'secondary' }).oneTime()
        event_logger += `\n ${1+cursor} из ${alliance_coin_counter}`
        const allicoin_bt: any = await context.question(`🧷 Выберите подключенную группу к ${alliance?.name}:\n\n ${event_logger}`,
            {	
                keyboard: keyboard, answerTimeLimit
            }
        )
        if (allicoin_bt.isTimeout) { return await context.send(`⏰ Время ожидания выбора валюты ${alliance?.name} истекло!`) }
        const config: any = {
            'alliance_coin_edit': Alliance_Coin_Edit,
            'alliance_coin_create': Alliance_Monitor_Create,
            'alliance_coin_next': Alliance_Monitor_Next,
            'alliance_coin_back': Alliance_Monitor_Back,
            'alliance_coin_return': Alliance_Monitor_Return,
            'alliance_coin_delete': Alliance_Monitor_Delete
        }
        if (allicoin_bt?.payload?.command in config) {
            const commandHandler = config[allicoin_bt.payload.command];
            const ans = await commandHandler(context, allicoin_bt.payload, alliance)
            cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor
            allicoin_tr = ans.stop ? ans.stop : false
        } else {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        }
    }
    await Keyboard_Index(context, '💡 Нужно построить зиккурат!')
}

async function Alliance_Monitor_Delete(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor }
    const alliance_coin_check = await prisma.monitor.findFirst({ where: { id: data.id_alliance_coin } })
    const confirm: { status: boolean, text: String } = await Confirm_User_Success(context, `удалить монитор ${alliance_coin_check?.id}?`)
    await context.send(`${confirm.text}`)
    if (!confirm.status) { return res }
    if (alliance_coin_check) {
        const alliance_coin_del = await prisma.monitor.delete({ where: { id: alliance_coin_check.id } })
        if (alliance_coin_del) {
            await Logger(`In database, deleted alliance monitor: ${alliance_coin_del.id} by admin ${context.senderId}`)
            await context.send(`Вы удалили монитор: ${alliance_coin_del.id} для ролевой ${alliance.name}!`)
            await Send_Message(chat_id, `🎥 Удален монитор ${alliance_coin_del.name}-${alliance_coin_del.id} для ролевой ${alliance.name}-${alliance.id}`)
        }
    }
    return res
}

async function Alliance_Monitor_Return(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor, stop: true }
    await context.send(`Вы отменили меню управления мониторами ролевого проекта ${alliance.id}-${alliance.name}`, { keyboard: Keyboard.builder().callbackButton({ label: '🌐 В ролевую', payload: { command: 'alliance_enter' }, color: 'primary' }).inline() })
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

async function Alliance_Monitor_Next(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor+5 }
    return res
}

async function Alliance_Monitor_Back(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor-5 }
    return res
}

async function Alliance_Monitor_Create(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor }
    const monik = { token: ``, id_alliance: alliance.id, alliance: alliance.name, id_coin: 0, coin: ``, name: `zero`, idvk_group: 0 }

    let spec_check1 = false
    let targeta = null
	while (spec_check1 == false) {
		const name = await context.question( `🧷 Введите ссылку на сообщество нового монитора`, timer_text)
		if (name.isTimeout) { return await context.send(`⏰ Время ожидания ввода сообщества для нового монитора истекло!`) }
		if (name.text.length <= 256) {
			spec_check1 = true
			targeta = name.text
		} else { await context.send(`💡 Ввведите до 256 символов включительно!`) }
	}
    const temp = targeta.replace(/.*[/]/, "");
    try {
        const [group] = await vk.api.groups.getById({ group_id: temp });
	    if (!group) { return }
	    const alli_check = await prisma.monitor.findFirst({ where: { idvk: group.id } })
	    if (!alli_check) {
            monik.name = group.name!
            monik.idvk_group = group.id!
	    } else {
	    	await Logger(`In database already created monitor idvk ${group.id}`)
            return await context.send(`⚙ Монитор уже был создан:\n💬 ${alli_check.id} - ${alli_check.name}\n 🧷 Ссылка: https://vk.com/club${alli_check.idvk}\n🌐 Альянс: ${alliance.name}`)
	    }
    } catch (e) {
        return await context.send(`⛔ Такой группы не найдено! Монитор не установлен!`)
    }

    let spec_check = false
	while (spec_check == false) {
		const name = await context.question( `🧷 Введите токен группы:`, timer_text)
		if (name.isTimeout) { return await context.send(`⏰ Время ожидания ввода токена истекло!`) }
		if (name.text.length <= 300) {
			spec_check = true
			monik.token = `${name.text}`
		} else { await context.send(`💡 Ввведите до 300 символов включительно!`) }
	}
    await context.send(`⚠ Токен принят, удалите отправку своего токена из чата в целях безопасности!`)
    
    const coin_pass: AllianceCoin[] = await prisma.allianceCoin.findMany({ where: { id_alliance: Number(alliance.id) } })
    if (!coin_pass) { return context.send(`Валют ролевых пока еще нет, чтобы начать=)`) }
    let coin_check = false
    let id_builder_sent1 = 0
    while (!coin_check) {
        const keyboard = new KeyboardBuilder()
        id_builder_sent1 = await Fixed_Number_To_Five(id_builder_sent1)
        let event_logger = `❄ Выберите валюту с которой будем делать отчисления:\n\n`
        const builder_list: AllianceCoin[] = coin_pass
        if (builder_list.length > 0) {
            const limiter = 5
            let counter = 0
            for (let i=id_builder_sent1; i < builder_list.length && counter < limiter; i++) {
                const builder = builder_list[i]
                keyboard.textButton({ label: `${builder.smile}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent1: i, id_coin: builder.id, coin: builder.name }, color: 'secondary' }).row()
                //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
                event_logger += `\n\n💬 ${builder.smile} -> ${builder.id} - ${builder.name}\n`
                /*
                const services_ans = await Builder_Lifer(user, builder, id_planet)*/
                counter++
            }
            event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent1+limiter : limiter-(builder_list.length-id_builder_sent1)} из ${builder_list.length} ~~~~` : ''}`
            //предыдущий офис
            if (builder_list.length > limiter && id_builder_sent1 > limiter-1 ) {
                keyboard.textButton({ label: '←', payload: { command: 'builder_control_multi', id_builder_sent1: id_builder_sent1-limiter}, color: 'secondary' })
            }
            //следующий офис
            if (builder_list.length > limiter && id_builder_sent1 < builder_list.length-limiter) {
                keyboard.textButton({ label: '→', payload: { command: 'builder_control_multi', id_builder_sent1: id_builder_sent1+limiter }, color: 'secondary' })
            }
        } else {
            event_logger = `💬 Админы ролевой еще не создали ролевые валюты`
            return context.send(`💬 Админы ролевой еще не создали ролевые валюты`)
        }
        const answer1: any = await context.question(`${event_logger}`,
            {	
                keyboard: keyboard.inline(), answerTimeLimit
            }
        )
        if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
        if (!answer1.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            if (answer1.text == '→' || answer1.text =='←') {
                id_builder_sent1 = answer1.payload.id_builder_sent1
            } else {
                monik.coin = answer1.payload.coin
                monik.id_coin = answer1.payload.id_coin
                coin_check = true
            }
        }
    }
	const rank_check: { status: boolean, text: String } = await Confirm_User_Success(context, `запланировать запуск бота для группы ${monik.alliance}?`)
    await context.send(`${rank_check.text}`)
    const monitor_cr = await prisma.monitor.create({ data: { token: monik.token, id_alliance: monik.id_alliance, id_coin: monik.id_coin, name: monik.name, idvk: monik.idvk_group } })
    if (monitor_cr) {
        await Logger(`In database, created monitor for group ${monik.alliance} by admin ${context.senderId}`)
        await context.send(`⚙ Вы добавили новый монитор ${monitor_cr.id} для ролевой ${monik.alliance}`)
        await Send_Message(chat_id, `🎥 Добавлен новый монитор ${monitor_cr.name}-${monitor_cr.id} для ролевой ${monik.alliance}-${monik.id_alliance}`)
    }
    return res
}