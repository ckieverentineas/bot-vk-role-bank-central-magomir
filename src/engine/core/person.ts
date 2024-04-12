import { Keyboard, KeyboardBuilder, MessageContext } from "vk-io"
import { answerTimeLimit, chat_id, timer_text, vk } from "../.."
import { Fixed_Number_To_Five, Keyboard_Index, Logger } from "./helper"
import prisma from "../events/module/prisma_client"
import { Alliance, User } from "@prisma/client"

export async function Person_Register(context: any) {
    const person: { name: null | string, id_alliance: null | number, alliance: null | string, class: null | string, spec: null | string } = { name: null, id_alliance: null, alliance: null, class: null, spec: null }
    const answer = await context.question(`⌛ Вы уверены, что хотите приступить к процедуре создания нового персонажа?`,
		{	
			keyboard: Keyboard.builder()
			.textButton({ label: 'Полностью', payload: { command: 'Согласиться' }, color: 'positive' }).row()
			.textButton({ label: 'Передумал(а)', payload: { command: 'Отказаться' }, color: 'negative' }).oneTime(),
			answerTimeLimit
		}
	);
	if (answer.isTimeout) { return await context.send(`⏰ Время ожидания подтверждения согласия истекло!`) }
	if (!/да|yes|Согласиться|конечно|✏|Полностью|полностью/i.test(answer.text|| '{}')) {
        await context.send(`⌛ Вы отменили создание персонажа!`)
        await Keyboard_Index(context, `⌛ Отменяем алгоритмы...`)
		return;
	}
    let name_check = false
	while (name_check == false) {
		const name = await context.question( `🧷 Введите имя и фамилию нового персонажа`, timer_text)
		if (name.isTimeout) { return await context.send(`⏰ Время ожидания ввода имени истекло!`) }
		if (name.text.length <= 64) {
            const confirma = await context.question( `🧷 Вы ввели: ${name.text}\n Вы уверены?`, {	
				keyboard: Keyboard.builder()
				.textButton({ label: 'Да', payload: { command: 'student' }, color: 'secondary' })
				.textButton({ label: 'Нет', payload: { command: 'professor' }, color: 'secondary' })
				.oneTime().inline(), answerTimeLimit
			})
		    if (confirma.isTimeout) { return await context.send(`⏰ Время ожидания ввода имени истекло!`) }
            if (confirma.text == "Да") {
                person.name = `${name.text}`
                name_check = true
            } else {
                continue
            }

		} else { await context.send(`⛔ Ваши ФИО не влезают на бланк повышенной ширины (64 символа), и вообще, запрещены магическим законодательством! Выплатите штраф в 30 жетонов или мы будем вынуждены позвать стражей порядка для отправки вас в Азкабан.`) }
	}
	let answer_check = false
	while (answer_check == false) {
		const answer_selector = await context.question(`🧷 Укажите ваш статус в Министерстве Магии`,
			{	
				keyboard: Keyboard.builder()
				.textButton({ label: 'Союзник', payload: { command: 'student' }, color: 'secondary' })
				.textButton({ label: 'Не союзник', payload: { command: 'professor' }, color: 'secondary' })
				.textButton({ label: 'Соло', payload: { command: 'citizen' }, color: 'secondary' })
				.oneTime().inline(), answerTimeLimit
			}
		)
		if (answer_selector.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
		if (!answer_selector.payload) {
			await context.send(`💡 Жмите только по кнопкам с иконками!`)
		} else {
			person.alliance = answer_selector.text
            person.id_alliance = answer_selector.text == 'Не союзник' ? -1 : 0
			answer_check = true
		}
	}
    let alliance_check = false
	if (person.alliance == 'Союзник') {
        let id_builder_sent = 0
        while (!alliance_check) {
            const keyboard = new KeyboardBuilder()
            id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
            let event_logger = `❄ Выберите союзный ролевой проект, к которому принадлежите:\n\n`
            const builder_list: Alliance[] = await prisma.alliance.findMany({})

            if (builder_list.length > 0) {
                const limiter = 5
                let counter = 0
                for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                    const builder = builder_list[i]
                    keyboard.textButton({ label: `👀 ${i}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent: i, target: builder }, color: 'secondary' }).row()
                    //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
                    event_logger += `\n\n💬 ${i} -> ${builder.id} - ${builder.name}\n 🧷 Ссылка: https://vk.com/club${builder.idvk}`
                    /*
                    const services_ans = await Builder_Lifer(user, builder, id_planet)*/
                    counter++
                }
                event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent+limiter : limiter-(builder_list.length-id_builder_sent)} из ${builder_list.length} ~~~~` : ''}`
                //предыдущий офис
                if (builder_list.length > limiter && id_builder_sent > limiter-1 ) {
                    keyboard.textButton({ label: '←', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent-limiter}, color: 'secondary' })
                }
                //следующий офис
                if (builder_list.length > limiter && id_builder_sent < builder_list.length-limiter) {
                    keyboard.textButton({ label: '→', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent+limiter }, color: 'secondary' })
                }
            } else {
                event_logger = `💬 Вы еще не построили здания, как насчет что-то построить??`
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
                    id_builder_sent = answer1.payload.id_builder_sent
                } else {
                    person.alliance = answer1.payload.target.name
                    person.id_alliance = answer1.payload.target.id
                    alliance_check = true
                }
		    }
        }
    }
    let answer_check1 = false
	while (answer_check1 == false) {
		const answer1 = await context.question(`🧷 Укажите ваше положение в ${person.alliance}`,
			{	
				keyboard: Keyboard.builder()
				.textButton({ label: 'Ученик', payload: { command: 'student' }, color: 'secondary' })
				.textButton({ label: 'Профессор', payload: { command: 'professor' }, color: 'secondary' })
				.textButton({ label: 'Житель', payload: { command: 'citizen' }, color: 'secondary' })
				.oneTime().inline(), answerTimeLimit
			}
		)
		if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания выбора положения истекло!`) }
		if (!answer1.payload) {
			await context.send(`💡 Жмите только по кнопкам с иконками!`)
		} else {
			person.class = answer1.text
			answer_check1 = true
		}
	}
	let spec_check = false
	while (spec_check == false) {
		const name = await context.question( `🧷 Укажите вашу специализацию в ${person.alliance}. Если вы профессор/житель, введите должность. Если вы студент, укажите факультет`, timer_text)
		if (name.isTimeout) { return await context.send(`⏰ Время ожидания выбора специализации истекло!`) }
		if (name.text.length <= 30) {
			spec_check = true
			person.spec = name.text
		} else { await context.send(`💡 Введите до 30 символов включительно!`) }
	}
    const account = await prisma.account.findFirst({ where: { idvk: context.senderId } })
    const role = await prisma.role.findFirst({})
    if (!role) { await prisma.role.create({ data: { name: "user" } }) }
    const save = await prisma.user.create({ data: { name: person.name!, id_alliance: person.id_alliance!, id_account: account?.id, spec: person.spec!, class: person.class!, idvk: account?.idvk! } })
    await context.send(`⌛ Поздравляем с регистрацией персонажа: ${save.name}-${save.id}`)
    await Logger(`In database, created new person GUID ${account?.id} UID ${save.id} by user ${context.senderId}`)
	const check_bbox = await prisma.blackBox.findFirst({ where: { idvk: context.senderId } })
	const ans_selector = `⁉ ${save.class} @id${account?.idvk}(${save.name}) ${save.spec} ${!check_bbox ? "легально" : "НЕЛЕГАЛЬНО"} получает банковскую карту UID: ${save.id}!`
	await vk.api.messages.send({
		peer_id: chat_id,
		random_id: 0,
		message: ans_selector
	})
	await Keyboard_Index(context, `💡 Подсказка: Когда все операции вы успешно завершили, напишите [!банк] без квадратных скобочек, а затем нажмите кнопку: ✅Подтвердить авторизацию!`)
}
	/*const save = await prisma.user.create({	data: {	idvk: context.senderId, name: datas[0].name, class: datas[1].class, spec: datas[2].spec, id_role: 1, gold: 65 } })
	await context.send(`⌛ Благодарю за сотрудничество ${save.class} ${save.name}, ${save.spec}. \n ⚖Вы получили банковскую карту UID: ${save.id}. \n 🏦Вам зачислено ${save.gold} галлеонов`)
	console.log(`Success save user idvk: ${context.senderId}`)
	await context.send(`‼ Список обязательных для покупки вещей: \n 1. Волшебная палочка \n 2. Сова, кошка или жаба \n 3. Комплект учебников \n \n Посетите Косой переулок и приобретите их первым делом!`)
	const check_bbox = await prisma.blackBox.findFirst({ where: { idvk: context.senderId } })
	const ans_selector = `⁉ ${save.class} @id${save.idvk}(${save.name}) ${save.spec} ${!check_bbox ? "легально" : "НЕЛЕГАЛЬНО"} получает банковскую карту UID: ${save.id}!`
	await vk.api.messages.send({
		peer_id: chat_id,
		random_id: 0,
		message: ans_selector
	})*/

export async function Person_Selector(context: any) {
    const account = await prisma.account.findFirst({ where: { idvk: context.senderId } })
    const person = await prisma.user.findMany({where: {id_account: account?.id }})
    let person_check = false
    let person_sel = null
    if (person.length > 0) {
        let id_builder_sent = 0
        while (!person_check) {
            const keyboard = new KeyboardBuilder()
            id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
            let event_logger = `❄ Выберите требуемого персонажа:\n\n`
            if (person.length > 0) {
                const limiter = 5
                let counter = 0
                for (let i=id_builder_sent; i < person.length && counter < limiter; i++) {
                    const builder = person[i]
                    keyboard.textButton({ label: `👀 ${builder.id}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent: i, id_person: builder.id }, color: 'secondary' }).row()
                    //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
                    event_logger += `\n\n💬 ${builder.id}-${builder.name}`
                    /*
                    const services_ans = await Builder_Lifer(user, builder, id_planet)*/
                    counter++
                }
                event_logger += `\n\n${person.length > 1 ? `~~~~ ${person.length > limiter ? id_builder_sent+limiter : limiter-(person.length-id_builder_sent)} из ${person.length} ~~~~` : ''}`
                //предыдущий офис
                if (person.length > limiter && id_builder_sent > limiter-1 ) {
                    keyboard.textButton({ label: '←', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent-limiter}, color: 'secondary' })
                }
                //следующий офис
                if (person.length > limiter && id_builder_sent < person.length-limiter) {
                    keyboard.textButton({ label: '→', payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent+limiter }, color: 'secondary' })
                }
            } else {
                event_logger = `💬 Вы еще не построили здания, как насчет что-то построить??`
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
                    id_builder_sent = answer1.payload.id_builder_sent
                } else {
                    person_sel = answer1.payload.id_person
                    person_check = true
                }
            }
        }
    }
    const person_get = await prisma.user.findFirst({ where: { id: person_sel, id_account: account?.id } })
    const person_was = await prisma.user.findFirst({ where: { id: account?.select_user } })
    const person_sel_up = await prisma.account.update({ where: { id: account?.id }, data: { select_user: person_sel } })
    await context.send(`⚙ Вы сменили персонажа\n с ${person_was?.id}💳 ${person_was?.name}👤\n на ${person_get?.id}💳 ${person_get?.name}👤`)
    await Logger(`In private chat, changed drom person ${person_was?.name}-${person_was?.id} on ${person_get?.name}-${person_get?.id} by user ${context.senderId}`)
    await Keyboard_Index(context, `⌛ Сменили вам персонажа...`)
    //await context.send(`Ваш персонаж:\nGUID: ${person_get?.id_account}\nUID: ${person_get?.id}\nФИО: ${person_get?.name}\nАльянс: ${person_get?.alliance}\nЖетоны: ${person_get?.medal}\nРегистрация: ${person_get?.crdate}\n\nИнвентарь: Ла-Ла-Ла`)
}

export async function Person_Detector(context: any) {
    const account = await prisma.account.findFirst({ where: { idvk: context.senderId ?? context.peerId } })
    const person_find = await prisma.user.findFirst({ where: { id: account?.select_user } })
    if (!person_find) { 
        const person_sel = await prisma.user.findFirst({ where: { id_account: account?.id } })
        if (!person_sel) {
            await context.send(`⚠ У вас еще нет персонажа, создать?`,
                { 	
                    keyboard: Keyboard.builder()
                    .textButton({ label: '➕👤', payload: { command: 'Согласиться' }, color: 'secondary' }).oneTime().inline(),
                    answerTimeLimit
                }
            )
        } else {
            const account_up = await prisma.account.update({ where: { id: account?.id }, data: { select_user: person_sel?.id } })
            if (account_up) { await Logger(`In private chat, succes init default person ${account_up.select_user} by user ${context.senderId}`) }
        }
        
    }
}

export async function Person_Get(context: any) {
    const account = await prisma.account.findFirst({ where: { idvk: context.peerId ?? context.senderId } })
    const get_user: User | null | undefined = await prisma.user.findFirst({ where: { id: account?.select_user } })
    return get_user
}