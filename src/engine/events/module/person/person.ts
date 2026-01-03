import { Keyboard, KeyboardBuilder } from "vk-io"
import { answerTimeLimit, chat_id, timer_text } from "../../../.."
import { Fixed_Number_To_Five, Input_Text, Keyboard_Index, Logger, Send_Message } from "../../../core/helper"
import prisma from "../prisma_client"
import { Alliance, AllianceFacult, User } from "@prisma/client"
import { ico_list } from "../data_center/icons_lib"
import { Simply_Carusel_Selector } from "../../../core/simply_carusel_selector"
import { Person_Coin_Printer_Self } from "./person_coin"
import { Facult_Coin_Printer_Self } from "../alliance/facult_rank"
import { Ipnut_Gold } from "../tranzaction/operation_global"
import { getTerminology } from "../alliance/terminology_helper"
import { Get_Person_Monitor_Status } from "./monitor_select"

export async function Person_Register(context: any) {
    const person: { name: null | string, id_alliance: null | number, alliance: null | string, class: null | string, spec: null | string, facult: null | string, id_facult: null | number } = { name: null, id_alliance: null, alliance: null, class: null, spec: null, facult: null, id_facult: null }
    const answer = await context.question(`${ico_list['load'].ico} Вы уверены, что хотите приступить к процедуре создания нового персонажа?`,
		{	
			keyboard: Keyboard.builder()
			.textButton({ label: 'Полностью', payload: { command: 'Согласиться' }, color: 'positive' }).row()
			.textButton({ label: 'Передумал(а)', payload: { command: 'Отказаться' }, color: 'negative' }).oneTime(),
			answerTimeLimit
		}
	);
	if (answer.isTimeout) { return await context.send(`⏰ Время ожидания подтверждения согласия истекло!`) }
	if (!/да|yes|Согласиться|конечно|✏|Полностью|полностью/i.test(answer.text|| '{}')) {
        await context.send(`${ico_list['stop'].ico} Вы отменили создание персонажа!`)
        await Keyboard_Index(context, `${ico_list['stop'].ico} Отменяем алгоритмы...`)
		return;
	}
    // ввод имени и фамилии нового персонажа
    const person_name = await Input_Text(context, `Введите имя и фамилию нового персонажа.\n${ico_list['help'].ico} Отправьте сообщение в чат для изменения:`, 64)
    if (!person_name) { return }
    person.name = person_name
    /*
    const name_pass = await prisma.user.findFirst({ where: { name: person.name! } })
    if (name_pass) {
        await context.send(`🚫 Внимание, система безопасности обнаружила, что у вас уже имеется персонаж с таким именем, а это запрещено, регистрация персонажа сброшена!\n\n⚠ Если вы хотели пересоздать персонажа из-за того, что допустили ошибку в указанных данных, то напишите в личные сообщения Министерства Магии: https://vk.com/harrypotterpotteroman`)
        await Keyboard_Index(context, `💡 Подсказка: Когда все операции вы успешно завершили, напишите [!банк] без квадратных скобочек, а затем нажмите кнопку: ✅Подтвердить авторизацию!`)
        return
    }*/
	let answer_check = false
	while (answer_check == false) {
		const answer_selector = await context.question(`${ico_list['attach'].ico} Укажите ваш статус, при выборе "Союзник", вас попросят выбрать подключенный ролевой проект или ввести AUID проекта.\n\nДля этого нажмите либо "Союзник Кнопки" (чтобы листать список проектов), либо "Союзник Номер" (чтобы ввести AUID из предложенного списка).`,
			{	
				keyboard: Keyboard.builder()
				.textButton({ label: 'Союзник Кнопки', payload: { command: 'student' }, color: 'secondary' }).row()
                .textButton({ label: 'Союзник Номер', payload: { command: 'student' }, color: 'secondary' }).row()
				.textButton({ label: 'Не союзник', payload: { command: 'professor' }, color: 'secondary' })
				.textButton({ label: 'Соло', payload: { command: 'citizen' }, color: 'secondary' })
				.oneTime().inline(), answerTimeLimit
			}
		)
		if (answer_selector.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания выбора статуса истекло!`) }
		if (!answer_selector.payload) {
			await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`)
		} else {
			person.alliance = answer_selector.text
            if (answer_selector.text == 'Не союзник') { person.id_alliance = -1 }
            if (answer_selector.text == 'Соло') { person.id_alliance = 0 }
			answer_check = true
		}
	}
    let alliance_check = false
	if (person.alliance == 'Союзник Кнопки') {
        const alliance_list: Alliance[] = await prisma.alliance.findMany({})
        const alliance_id_sel = await Simply_Carusel_Selector(
            context,
            `Выберите союзный ролевой проект, к которому принадлежите`,
            alliance_list,
            async (item) => `\n\n${ico_list['lock'].ico} Ролевой проект №${item.id} <--\n${ico_list['alliance'].ico} Название: ${item.name}\n${ico_list['attach'].ico} Ссылка: https://vk.com/club${item.idvk}`,
            (item) => `🌐 №${item.id}-${item.name.slice(0,30)}`, // labelExtractor
            (item, index) => ({ command: 'builder_control', id_item_sent: index, id_item: item.id }) // payloadExtractor
        );
        if (!alliance_id_sel) { return }
        const alliance_get = await prisma.alliance.findFirst({ where: { id: alliance_id_sel } })
        if (!alliance_get) { return }
        person.alliance = alliance_get.name
        person.id_alliance = alliance_get.id
    }
    if (person.alliance == 'Союзник Номер') {
        let alli_list = ''
        for (const alli of await prisma.alliance.findMany({})) {
            alli_list += `${alli.id} - ${alli.name}\n`
        }
        await context.send(`Текущие союзные ролевые проекты и их уникальные идентификаторы:\n${alli_list}`)
        const input_alliance = await Ipnut_Gold(context, 'ввода уникального идентификатора ролевого проекта AUID (укажите номер)📜')
        const alliance = await prisma.alliance.findFirst({ where: { id: Number(input_alliance) } })
        if (!alliance) { return context.send(`Альянс под AUID ${input_alliance} не найден! Повторите регистрацию заново с нуля.`) }
        person.alliance = alliance.name
        person.id_alliance = alliance.id
    }
    let answer_check1 = false
	while (answer_check1 == false) {
		const answer1 = await context.question(`${ico_list['attach'].ico} Укажите ваше положение в ${person.alliance}.\n\n(Эти данные носят исключительно декоративный характер — выберите статус, который лучше всего резонирует с вашим внутренним сигналом).`,
			{	
				keyboard: Keyboard.builder()
				.textButton({ label: 'Ученик', payload: { command: 'student' }, color: 'secondary' })
                .textButton({ label: 'Житель', payload: { command: 'citizen' }, color: 'secondary' }).row()
				.textButton({ label: 'Профессор', payload: { command: 'professor' }, color: 'secondary' })
                .textButton({ label: 'Декан', payload: { command: 'professor' }, color: 'secondary' }).row()
                .textButton({ label: 'Бизнесвумен(мэн)', payload: { command: 'professor' }, color: 'secondary' })
                .textButton({ label: 'Другое', payload: { command: 'citizen' }, color: 'secondary' })
				.oneTime().inline(), answerTimeLimit
			}
		)
		if (answer1.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания выбора положения истекло!`) }
		if (!answer1.payload) {
			await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`)
		} else {
			person.class = answer1.text
			answer_check1 = true
		}
	}
    if (person.class == 'Ученик') { person.spec = `Без специализации` }
    if (person.class != 'Ученик') {
        // ввод специализации
        const accusative = await getTerminology(person.id_alliance || 0, 'accusative');
        const spec_name = await Input_Text(context, `Укажите вашу специализацию в [${person.alliance}]. Если вы профессор/житель, введите должность (не ${accusative}) и т.п. ...\n${ico_list['help'].ico}Отправьте сообщение в чат для изменения:`, 64)
        if (!spec_name) { return }
        person.spec = spec_name
    }
    let facult_check = false
	if (await prisma.allianceFacult.findFirst({ where: { id_alliance: Number(person.id_alliance) } })) {
        let id_builder_sent = 0
        while (!facult_check) {
            const keyboard = new KeyboardBuilder()
            id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
            const singular = await getTerminology(Number(person.id_alliance), 'singular');
            const plural = await getTerminology(Number(person.id_alliance), 'plural');
            const genitive = await getTerminology(Number(person.id_alliance), 'genitive');
            const accusative = await getTerminology(Number(person.id_alliance), 'accusative');
            let event_logger = `${ico_list['facult'].ico} Выберите ${accusative} в [${person.alliance}], к которому(ой) принадлежите:\n\n`
            const builder_list: AllianceFacult[] = await prisma.allianceFacult.findMany({ where: { id_alliance: Number(person.id_alliance) } })
            if (builder_list.length > 0) {
                const limiter = 5
                let counter = 0
                for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                    const builder = builder_list[i]
                    keyboard.textButton({ label: `${builder.smile} №${i}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent: i, target: builder }, color: 'secondary' }).row()
                    event_logger += `\n\n${ico_list['facult'].ico} Ролевой(ая) ${singular} №${i} <--\n${ico_list['info'].ico} FUID: ${builder.id}\n${builder.smile} Название: ${builder.name}`
                    counter++
                }
                event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent+limiter : limiter-(builder_list.length-id_builder_sent)} из ${builder_list.length} ~~~~` : ''}`
                if (builder_list.length > limiter && id_builder_sent > limiter-1 ) {
                    keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent-limiter}, color: 'secondary' })
                }
                //следующий офис
                if (builder_list.length > limiter && id_builder_sent < builder_list.length-limiter) {
                    keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'builder_control_multi', id_builder_sent: id_builder_sent+limiter }, color: 'secondary' })
                }
                keyboard.textButton({ label: 'Нафиг учебу', payload: { command: 'builder_control_multi', target: { id: 0, name: `Без ${genitive}`, smile: '🔥', id_alliance: person.id_alliance } }, color: 'secondary' })
            } else {
                event_logger = `${ico_list['warn'].ico} Вы еще не открыли ${plural}, как насчет что-то открыть??`
            }
            const answer1: any = await context.question(`${event_logger}`, { keyboard: keyboard.inline(), answerTimeLimit })
            if (answer1.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания выбора ${genitive} истекло!`) }
		    if (!answer1.payload) {
		    	await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`)
		    } else {
                if (answer1.text == `${ico_list['next'].ico}` || answer1.text == `${ico_list['back'].ico}`) {
                    id_builder_sent = answer1.payload.id_builder_sent
                } else {
                    person.facult = answer1.payload.target.name
                    person.id_facult = answer1.payload.target.id
                    facult_check = true
                }
		    }
        }
    }
    const account = await prisma.account.findFirst({ where: { idvk: context.senderId } })
    const role = await prisma.role.findFirst({ where: { name: "user" } }) ? await prisma.role.findFirst({ where: { name: "user" } }) : await prisma.role.create({ data: { name: "user" } })
    const save = await prisma.user.create({ data: { name: person.name!, id_alliance: person.id_alliance!, id_account: account?.id, spec: person.spec!, class: person.class!, idvk: account?.idvk!, id_facult: person.id_facult, id_role: role!.id } })
    await context.send(`${ico_list['save'].ico} Поздравляем с регистрацией аккаунта в РП-банке:\n${save.name}-${save.id}`)
    await Logger(`In database, created new person GUID ${account?.id} UID ${save.id} by user ${context.senderId}`)
	const check_bbox = await prisma.blackBox.findFirst({ where: { idvk: context.senderId } })
    const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(save.id_alliance) } })
    const facult_get: AllianceFacult | null = await prisma.allianceFacult.findFirst({ where: { id: Number(save.id_facult) } })
    const info_coin = await Person_Coin_Printer_Self(context, save.id)
    const info_facult_rank = await Facult_Coin_Printer_Self(context, save.id)
    const singular = await getTerminology(alli_get?.id || 0, 'singular');
    const genitive = await getTerminology(alli_get?.id || 0, 'genitive');
    const facultTerminology = singular.charAt(0).toUpperCase() + singular.slice(1);
    const withoutFaculty = `Без ${genitive}`;

    const ans_selector = `${ico_list['save'].ico} Сохранение аватара [${!check_bbox ? "легально" : "НЕЛЕГАЛЬНО"}] UID-${save.id}:\n👥 ${save.spec} ${save.class} @id${account?.idvk}(${save.name})\n${ico_list['alliance'].ico} Ролевая: ${save.id_alliance == 0 ? `Соло` : save.id_alliance == -1 ? `Не союзник` : alli_get?.name}\n${facult_get ? facult_get.smile : `🔮`} ${facultTerminology}: ${facult_get ? facult_get.name : withoutFaculty}`
    await Send_Message(chat_id, `${ans_selector}`)
	await Keyboard_Index(context, `${ico_list['help'].ico} Подсказка: Когда все операции вы успешно завершили, напишите [!банк] без квадратных скобочек, а затем нажмите кнопку: ${ico_list['success'].ico}Подтвердить авторизацию!`)
}

export async function Person_Selector(context: any) {
    const account = await prisma.account.findFirst({ where: { idvk: context.senderId } })
    if (!account) return;
    
    const person = await prisma.user.findMany({where: {id_account: account?.id }})
    
    // Для каждого персонажа получаем статус мониторов
    const personsWithStatus = await Promise.all(person.map(async (item) => {
        const alliance = await prisma.alliance.findFirst({ where: { id: item.id_alliance ?? 0 } });
        const monitorStatus = await Get_Person_Monitor_Status(account.id, item.id, item.id_alliance);
        
        return {
            ...item,
            allianceName: alliance?.name,
            monitorStatus
        };
    }));
    
    const person_sel = await Simply_Carusel_Selector(
        context,
        `Выберите требуемого персонажа`,
        personsWithStatus,
        async (item) => {
            const allianceInfo = item.id_alliance == 0 ? `Соло` : 
                               item.id_alliance == -1 ? `Не союзник` : 
                               item.allianceName;
            
            return `\n\n${item.monitorStatus.emoji} ${ico_list['person'].ico} ${item.id}-${item.name}\n🌐 Ролевая: ${allianceInfo}\n📊 ${item.monitorStatus.description}`;
        },
        (item) => `${item.monitorStatus.emoji} ${item.id}-${item.name.slice(0, 28)}`, // Обрезаем до 28 символов для эмодзи
        (item, index) => ({ command: 'builder_control', id_item_sent: index, id_item: item.id })
    );
    
    if (!person_sel) { return }
    const person_get = await prisma.user.findFirst({ where: { id: person_sel, id_account: account?.id } })
    const person_was = await prisma.user.findFirst({ where: { id: account?.select_user } })
    const person_sel_up = await prisma.account.update({ where: { id: account?.id }, data: { select_user: person_sel } })
    
    // Получаем статус для нового выбранного персонажа
    const newMonitorStatus = await Get_Person_Monitor_Status(account.id, person_sel, person_get?.id_alliance);
    
    await context.send(
        `${ico_list['change'].ico} Вы сменили персонажа:\n` +
        `${ico_list['stop'].ico} ${person_was?.id}${ico_list['card'].ico} ${person_was?.name}${ico_list['person'].ico}\n` +
        `${ico_list['success'].ico} ${person_get?.id}${ico_list['card'].ico} ${person_get?.name}${ico_list['person'].ico}\n\n` +
        `${newMonitorStatus.description}`,
        {   
            keyboard: Keyboard.builder()
            .callbackButton({ label: `${ico_list['card'].ico} Карта`, payload: { command: 'card_enter' }, color: 'secondary' })
            .oneTime().inline(),
            timer_text
        }
    )
    
    await Logger(`In private chat, changed from person ${person_was?.name}-${person_was?.id} to ${person_get?.name}-${person_get?.id} by user ${context.senderId}`)
    await Keyboard_Index(context, `${ico_list['load'].ico} Сменили вам персонажа...`)
}

export async function Person_Detector(context: any) {
    const account = await prisma.account.findFirst({ where: { idvk: context.senderId ?? context.peerId } })
    const person_find = await prisma.user.findFirst({ where: { id: account?.select_user } })
    if (!person_find) { 
        const person_sel = await prisma.user.findFirst({ where: { id_account: account?.id } })
        if (!person_sel) {
            await context.send(`${ico_list['warn'].ico} У вас еще нет персонажа, создать?`,
                { 	
                    keyboard: Keyboard.builder()
                    .textButton({ label: `${ico_list['add'].ico}${ico_list['person'].ico}`, payload: { command: 'Согласиться' }, color: 'secondary' }).oneTime().inline(),
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
    //console.log(`[DEBUG Person_Get] Context: peerId=${context.peerId}, senderId=${context.senderId}, userId=${context.userId}`);
    
    // Пробуем разные варианты получения idvk
    const idvk = context.peerId || context.senderId || context.userId;
    //console.log(`[DEBUG Person_Get] Using idvk: ${idvk}`);
    
    const account = await prisma.account.findFirst({ 
        where: { idvk: idvk } 
    });
    
    //console.log(`[DEBUG Person_Get] Account found: ${account?.id}, select_user: ${account?.select_user}`);
    
    const get_user: User | null | undefined = await prisma.user.findFirst({ 
        where: { id: account?.select_user } 
    });
    
    //console.log(`[DEBUG Person_Get] User found: ${get_user?.id} - ${get_user?.name}`);
    
    return get_user;
}