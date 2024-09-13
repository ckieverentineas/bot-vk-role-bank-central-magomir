import { Alliance, AllianceCoin, BalanceFacult, Monitor } from "@prisma/client";
import prisma from "../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id, SECRET_KEY, timer_text, vk } from "../../../..";
import { Confirm_User_Success, Fixed_Number_To_Five, Keyboard_Index, Logger, Send_Message } from "../../../core/helper";
import { Person_Get } from "../person/person";
import * as CryptoJS from 'crypto-js';

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
            event_logger += `🎥 ${monitor.name}: id${monitor.id}\n🧷 Ссылка: https://vk.com/club${monitor.idvk}\n${coins?.smile} Валюта: ${coins?.name}\n🚧 Лимиты: ${monitor.lim_like}👍 ${monitor.lim_comment}💬 ♾📰\n💰 Стоимость: ${monitor.cost_like}👍 ${monitor.cost_comment}💬 ${monitor.cost_post}📰\n⚙ Статус: ${monitor.like_on}👍 ${monitor.comment_on}💬 ${monitor.wall_on}📰\n\n`
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
        if (allicoin_bt.isTimeout) { return await context.send(`⏰ Время ожидания выбора подключенной группы для проекта ${alliance?.name} истекло!`) }
        const config: any = {
            'alliance_coin_edit': Alliance_Monitor_Edit,
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

async function Alliance_Monitor_Edit(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor }
    const monitora = await prisma.monitor.findFirst({ where: { id: data.id_alliance_coin } })
    if (!monitora) { return }
    const monik = { alliance: alliance.name, coin: '', id_coin: monitora.id_coin, cost_like: monitora.cost_like, cost_comment: monitora.cost_comment, cost_post: monitora.cost_post, lim_like: monitora.lim_like, lim_comment: monitora.lim_comment, starting: monitora.starting, wall_on: monitora.wall_on, like_on: monitora.like_on, comment_on: monitora.comment_on }
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

    let lim_like_tr = false;
	while (lim_like_tr == false) {
		const name = await context.question( `🧷 Вы редактируете лимит лайков в день, cейчас, ${monik.lim_like}👍! Введите новое значение:`, timer_text)
		if (name.isTimeout) { await context.send(`⏰ Время ожидания ввода для количества лайков в сутки истекло!`); return res }
		if (typeof Number(name.text) === "number") {
            const input = Math.floor(Number(name.text))
            if (Number.isNaN(input)) { await context.send(`⚠ Не ну реально, ты дурак/дура или как? Число напиши нафиг!`); continue }
			lim_like_tr = true
			monik.lim_like = Number(name.text)
		} else { await context.send(`💡 Ввведите число!`) }
	}
    let cost_like_tr = false;
	while (cost_like_tr == false) {
		const name = await context.question( `🧷 Вы редактируете стоимость лайка, cейчас, ${monik.cost_like}👍! Введите новое значение:`, timer_text)
		if (name.isTimeout) { await context.send(`⏰ Время ожидания ввода для стоимости лайка истекло!`); return res }
		if (typeof Number(name.text) === "number") {
            const input = Math.floor(Number(name.text))
            if (Number.isNaN(input)) { await context.send(`⚠ Не ну реально, ты дурак/дура или как? Число напиши нафиг!`); continue }
			cost_like_tr = true
			monik.cost_like = Number(name.text)
		} else { await context.send(`💡 Ввведите число!`) }
	}

    let lim_comment_tr = false;
	while (lim_comment_tr == false) {
		const name = await context.question( `🧷 Вы редактируете лимит комментариев в день, cейчас, ${monik.lim_comment}💬 ! Введите новое значение:`, timer_text)
		if (name.isTimeout) { await context.send(`⏰ Время ожидания ввода для количества комментариев в сутки истекло!`); return res }
		if (typeof Number(name.text) === "number") {
            const input = Math.floor(Number(name.text))
            if (Number.isNaN(input)) { await context.send(`⚠ Не ну реально, ты дурак/дура или как? Число напиши нафиг!`); continue }
			lim_comment_tr = true
			monik.lim_comment = Number(name.text)
		} else { await context.send(`💡 Ввведите число!`) }
	}
    let cost_comment_tr = false;
	while (cost_comment_tr == false) {
		const name = await context.question( `🧷 Вы редактируете стоимость комментария, cейчас, ${monik.cost_comment}💬 ! Введите новое значение:`, timer_text)
		if (name.isTimeout) { await context.send(`⏰ Время ожидания ввода для стоимости комментария истекло!`); return res }
		if (typeof Number(name.text) === "number") {
            const input = Math.floor(Number(name.text))
            if (Number.isNaN(input)) { await context.send(`⚠ Не ну реально, ты дурак/дура или как? Число напиши нафиг!`); continue }
			cost_comment_tr = true
			monik.cost_comment = Number(name.text)
		} else { await context.send(`💡 Ввведите число!`) }
	}

    let cost_post_tr = false;
	while (cost_post_tr == false) {
		const name = await context.question( `🧷 Вы редактируете стоимость поста, cейчас, ${monik.cost_post}📰 ! Введите новое значение:`, timer_text)
		if (name.isTimeout) { await context.send(`⏰ Время ожидания ввода для стоимости поста истекло!`); return res }
		if (typeof Number(name.text) === "number") {
            const input = Math.floor(Number(name.text))
            if (Number.isNaN(input)) { await context.send(`⚠ Не ну реально, ты дурак/дура или как? Число напиши нафиг!`); continue }
			cost_post_tr = true
			monik.cost_post = Number(name.text)
		} else { await context.send(`💡 Ввведите число!`) }
	}

    const starting_tr: { status: boolean, text: String } = await Confirm_User_Success(context, `запланировать запуск бота в качестве монитора для группы ${monik.alliance}?`)
    monik.starting = starting_tr.status
    await context.send(`${starting_tr.text}`)

    const like_on_tr: { status: boolean, text: String } = await Confirm_User_Success(context, `включить активность монитора во славу проекта ${monik.alliance} для работы с лайками?`)
    monik.like_on = like_on_tr.status
    await context.send(`${like_on_tr.text}`)

    const comment_on_tr: { status: boolean, text: String } = await Confirm_User_Success(context, `включить активность монитора во славу проекта ${monik.alliance} для работы с комментариями?`)
    monik.comment_on = comment_on_tr.status
    await context.send(`${comment_on_tr.text}`)

    const wall_on_tr: { status: boolean, text: String } = await Confirm_User_Success(context, `включить активность монитора во славу проекта ${monik.alliance} для работы с постами?`)
    monik.wall_on = wall_on_tr.status
    await context.send(`${wall_on_tr.text}`)

    const monitor_up = await prisma.monitor.update({ where: { id: monitora.id }, data: { id_coin: monik.id_coin, cost_like: monik.cost_like, cost_comment: monik.cost_comment, cost_post: monik.cost_post, lim_like: monik.lim_like, lim_comment: monik.lim_comment, starting: monik.starting, wall_on: monik.wall_on, like_on: monik.like_on, comment_on: monik.comment_on } })
    if (!monitor_up) { return res }
    await Logger(`In database, updated monitor: ${monitor_up.id}-${monitor_up.name} by admin ${context.senderId}`)
    await context.send(`⚙ Вы обновили конфигурацию монитора ${monitor_up.id}-${monitor_up.name}, чтобы изменения вступили в силу, пройдемтесь по пути !банк --> ${alliance.name} --> ⚙ Админам --> ⚙ !мониторы нафиг --> 🚫 !моники_off --> 🚀 !моники_on.`)
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
			monik.token = `${Encrypt_Data(name.text)}`
		} else { await context.send(`💡 Ввведите до 300 символов включительно!`) }
	}
    await context.send(`⚠ Токен принят, удалите отправку своего токена из чата в целях безопасности, в базе данных он будет храниться в зашифрованном виде!`)
    
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
	const starting_check: { status: boolean, text: String } = await Confirm_User_Success(context, `запланировать запуск бота для группы ${monik.alliance}?`)
    await context.send(`${starting_check.text}`)
    const monitor_cr = await prisma.monitor.create({ data: { token: monik.token, id_alliance: monik.id_alliance, id_coin: monik.id_coin, name: monik.name, idvk: monik.idvk_group, starting: starting_check.status } })
    if (monitor_cr) {
        await Logger(`In database, created monitor for group ${monik.alliance} by admin ${context.senderId}`)
        await context.send(`⚙ Вы добавили новый монитор ${monitor_cr.id} для ролевой ${monik.alliance}\n Чтобы его поднять на пятый этаж, пройдемтесь по пути !банк --> ${alliance.name} --> ⚙ Админам --> ⚙ !мониторы нафиг --> 🚀 !моники_on`)
        await Send_Message(chat_id, `🎥 Добавлен новый монитор ${monitor_cr.name}-${monitor_cr.id} для ролевой ${monik.alliance}-${monik.id_alliance}`)
    }
    return res
}

// Функция для шифрования данных
function Encrypt_Data(data: string): string {
    const encryptedData = CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
    return encryptedData;
}

// Функция для проверки пользователя
export async function User_Bonus_Check(idvk: number, monitor: Monitor) {
    const account = await prisma.account.findFirst({ where: { idvk: idvk } })
    if (!account) { return false; }
    const user = await prisma.user.findFirst({ where: { id_account: account.id, id_alliance: monitor.id_alliance } })
    if (!user) { return false; }
    return user
}

// функция для начисления вознаграждения за активность
export async function Calc_Bonus_Activity(idvk: number, operation: '+' | '-', reward: number, target: string, link: string, monitor: Monitor) {
    const answer = { status: false, message: '', console: '', logging: '' } // ответ
    // префаб персонажа
    const account = await prisma.account.findFirst({ where: { idvk: idvk } })
    if (!account) { return answer; }
    const user = await prisma.user.findFirst({ where: { id_account: account.id, id_alliance: monitor.id_alliance } })
    if (!user) { return answer; }
    const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_user: user.id }})
    if (!balance) { return answer; }
    // префаб факультета
    const coin = await prisma.allianceCoin.findFirst({ where: { id: monitor.id_coin ?? 0, id_alliance: monitor.id_alliance }})
    const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult ?? 0 } })
    const alliance = await prisma.alliance.findFirst({ where: { id: monitor.id_alliance } })
    const balance_facult_check = await prisma.balanceFacult.findFirst({ where: { id_coin: monitor.id_coin ?? 0, id_facult: user.id_facult ?? 0 } })
    switch (operation) {
        case '+':
            const balance_up = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { increment: reward } } })
            if (!balance_up) { return answer; }
            answer.message += `📰 Вам начислено за добавленный ${target} ${reward} ${coin?.name}\n🧷 Ссылка: ${link}\n💳 Ваш баланс: ${balance.amount} ${operation} ${reward} = ${balance_up.amount}${coin?.smile}\n`
            answer.console += `(monitor) ~ user ${user.idvk} ${target} and got ${reward} ${coin?.name}, link ${link}, balance ${balance.amount} ${operation} ${reward} = ${balance_up.amount}${coin?.smile} by <monitor> №${monitor.id}`
            answer.status = true
            if (coin?.point == true && balance_facult_check) {
                const balance_facult_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: balance_facult_check.id }, data: { amount: { increment: reward } } })
                if (balance_facult_plus) {
                    answer.message += `🌐 "${operation}${coin?.smile}" > ${balance_facult_check.amount} ${operation} ${reward} = ${balance_facult_plus.amount} для Факультета [${alli_fac?.smile} ${alli_fac?.name}]`
                    answer.logging += `🌐 [${alliance?.name}] --> (монитор №${monitor.id}):\n👤 @id${account.idvk}(${user.name}) --> ✅${target}\n🔮 "${operation}${coin?.smile}" > ${balance_facult_check.amount} ${operation} ${reward} = ${balance_facult_plus.amount} для Факультета [${alli_fac?.smile} ${alli_fac?.name}]`
                }
            }
            break;
        case '-':
            const balance_down = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { decrement: reward } } })
            if (!balance_down) { return answer; }
            answer.message += `📰 С вас снято за удаленный ${target} ${reward} ${coin?.name}\n🧷 Ссылка: ${link}\n💳 Ваш баланс: ${balance.amount} ${operation} ${reward} = ${balance_down.amount}${coin?.smile}\n`
            answer.console += `(monitor) ~ user ${user.idvk} ${target} and lost ${reward} ${coin?.name}, link ${link}, balance ${balance.amount} ${operation} ${reward} = ${balance_down.amount}${coin?.smile} by <monitor> №${monitor.id}`
            answer.status = true
            if (coin?.point == true && balance_facult_check) {
                const balance_facult_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: balance_facult_check.id }, data: { amount: { decrement: reward } } })
                if (balance_facult_plus) {
                    answer.message += `🌐 "${operation}${coin?.smile}" > ${balance_facult_check.amount} ${operation} ${reward} = ${balance_facult_plus.amount} для Факультета [${alli_fac?.smile} ${alli_fac?.name}]`
                    answer.logging += `🌐 [${alliance?.name}] --> (монитор №${monitor.id}):\n👤 @id${account.idvk}(${user.name}) --> ⛔${target}\n🔮 "${operation}${coin?.smile}" > ${balance_facult_check.amount} ${operation} ${reward} = ${balance_facult_plus.amount} для Факультета [${alli_fac?.smile} ${alli_fac?.name}]`
                }
            }
            break;
        default:
            break;
    }
    if (!answer.status) { return }
    if (user.notification) { await Send_Message(account.idvk, answer.message) } 
    await Logger(answer.console)
    if (answer.logging) { 
        try {
            alliance ? await Send_Message(alliance.id_chat, answer.logging) : await Send_Message(chat_id, answer.logging)
        } catch (error) {
            await Send_Message(chat_id, answer.logging)
        } 
    }
}