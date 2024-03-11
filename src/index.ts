import { VK, Keyboard } from 'vk-io';
import { HearManager } from '@vk-io/hear';
import {
    QuestionManager,
    IQuestionMessageContext
} from 'vk-io-question';
import { registerUserRoutes } from './engine/player'
import { InitGameRoutes } from './engine/init';
import { Keyboard_Index } from './engine/core/helper';
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import prisma from './engine/events/module/prisma_client';
import { Exit, Main_Menu_Init } from './engine/events/contoller';
import { Admin_Enter, Artefact_Enter, Birthday_Enter, Card_Enter, Card_Private, Inventory_Enter, Rank_Enter, Statistics_Enter} from './engine/events/module/info';
import { Operation_Enter, Right_Enter } from './engine/events/module/tool';
import { Service_Beer_Open, Service_Beer_Premium_Open, Service_Cancel, Service_Convert_Galleon, Service_Convert_Galleon_Change, Service_Convert_Magic_Experience, Service_Convert_Magic_Experience_Change, Service_Enter, Service_Level_Up, Service_Level_Up_Change, Service_Quest_Open, Service_Underwear_Open } from './engine/events/module/service';
import { Shop_Bought, Shop_Buy, Shop_Cancel, Shop_Category_Enter, Shop_Enter } from './engine/events/module/shop';
dotenv.config()

export const token: string = String(process.env.token)
export const root: number = Number(process.env.root) //root user
export const chat_id: number = Number(process.env.chat_id) //chat for logs
export const group_id: number = Number(process.env.group_id)//clear chat group
export const timer_text = { answerTimeLimit: 300_000 } // ожидать пять минут
export const timer_text_oper = { answerTimeLimit: 60_000 } // ожидать пять минут
export const answerTimeLimit = 300_000 // ожидать пять минут
//авторизация
export const vk = new VK({ token: token, pollingGroupId: group_id, apiLimit: 1 });
//инициализация
const questionManager = new QuestionManager();
const hearManager = new HearManager<IQuestionMessageContext>();

/*prisma.$use(async (params, next) => {
	console.log('This is middleware!')
	// Modify or interrogate params here
	console.log(params)
	return next(params)
})*/

//настройка
vk.updates.use(questionManager.middleware);
vk.updates.on('message_new', hearManager.middleware);

//регистрация роутов из других классов
InitGameRoutes(hearManager)
registerUserRoutes(hearManager)

//миддлевар для предварительной обработки сообщений
vk.updates.on('message_new', async (context: any, next: any) => {
	if (context.peerType == 'chat') { 
		try { 
			await vk.api.messages.delete({'peer_id': context.peerId, 'delete_for_all': 1, 'cmids': context.conversationMessageId, 'group_id': group_id})
			console.log(`User ${context.senderId} sent message and deleted`)
			//await vk.api.messages.send({ peer_id: chat_id, random_id: 0, message: `✅🚫 @id${context.senderId} ${context.text}`})  
		} catch (error) { 
			console.log(`User ${context.senderId} sent message and can't deleted`)
			//await vk.api.messages.send({ peer_id: chat_id, random_id: 0, message: `⛔🚫 @id${context.senderId} ${context.text}`}) 
		}  
		return
	}
	//проверяем есть ли пользователь в базах данных
	const user_check = await prisma.user.findFirst({ where: { idvk: context.senderId } })
	//если пользователя нет, то начинаем регистрацию
	if (!user_check) {
		//согласие на обработку
		const answer = await context.question(`⌛ Как только вы открыли дверь банка Гринготтс 🏦, из ниоткуда перед вами предстали два гоблина и надменно сказали: \n — Видимо, вы здесь впервые. Прежде чем войти, распишитесь здесь о своем согласии на обработку персональных данных. \n В тот же миг в их руках магическим образом появился пергамент. \n 💡 Предупреждение, любые вопросы в банковской системе ограничены 5 минутами на ваши ответы в процессе обслуживания!`,
			{	
				keyboard: Keyboard.builder()
				.textButton({ label: '✏', payload: { command: 'Согласиться' }, color: 'positive' }).row()
				.textButton({ label: '👣', payload: { command: 'Отказаться' }, color: 'negative' }).oneTime(),
				answerTimeLimit
			}
		);
		if (answer.isTimeout) { return await context.send(`⏰ Время ожидания подтверждения согласия истекло!`) }
		if (!/да|yes|Согласиться|конечно|✏/i.test(answer.text|| '{}')) {
			await context.send('⌛ Вы отказались дать свое согласие, а живым отсюда никто не уходил, вас упаковали!');
			return;
		}
		//приветствие игрока
		const visit = await context.question(`⌛ Поставив свою подпись, вы, стараясь не смотреть косо на гоблинов, вошли в здание банка, подошли к стойке, где за информационной системой сидела полная гоблинша с бородавкой на носу.`,
			{ 	
				keyboard: Keyboard.builder()
				.textButton({ label: 'Подойти и поздороваться', payload: { command: 'Согласиться' }, color: 'positive' }).row()
				.textButton({ label: 'Ждать, пока она закончит', payload: { command: 'Отказаться' }, color: 'negative' }).oneTime().inline(),
				answerTimeLimit
			}
		);
		if (visit.isTimeout) { return await context.send(`⏰ Время ожидания активности истекло!`) }
		let name_check = false
		let datas: any = []
		while (name_check == false) {
			const name = await context.question( `🧷 Приветствую в Банке Гринготтс🏦! Судя по всему, вы здесь впервые. Назовите ваше имя и фамилию. \n ❗ Внимание! Предоставление заведомо ложных данных преследуются законом!`, timer_text)
			if (name.isTimeout) { return await context.send(`⏰ Время ожидания ввода имени истекло!`) }
			if (name.text.length <= 64) {
				name_check = true
				datas.push({name: `${name.text}`})
				if (name.text.length > 32) { await context.send(`⚠ Ваши ФИО не влезают на стандартный бланк (32 символа)! Гоблин может использовать бланк повышенной ширины, но нужно доплатить 1G за каждый не поместившийся символ.`) }
			} else { await context.send(`⛔ Ваши ФИО не влезают на бланк повышенной ширины (64 символа), и вообще, запрещены магическим законодательством! Выплатите штраф в 30G или мы будем вынуждены позвать стражей порядка для отправки вас в Азкабан.`) }
		}
		let answer_check = false
		while (answer_check == false) {
			const answer1 = await context.question(`🧷 Укажите ваше положение в Хогвартс Онлайн`,
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
				datas.push({class: `${answer1.text}`})
				answer_check = true
			}
		}
		let spec_check = false
		while (spec_check == false) {
			const name = await context.question( `🧷 Укажите вашу специализацию в Хогвартс Онлайн. Если вы профессор/житель, введите должность. Если вы студент, укажите факультет`, timer_text)
			if (name.isTimeout) { return await context.send(`⏰ Время ожидания выбора специализации истекло!`) }
			if (name.text.length <= 30) {
				spec_check = true
				datas.push({spec: `${name.text}`})
			} else { await context.send(`💡 Ввведите до 30 символов включительно!`) }
		}
		const save = await prisma.user.create({	data: {	idvk: context.senderId, name: datas[0].name, class: datas[1].class, spec: datas[2].spec, id_role: 1, gold: 65 } })
		await context.send(`⌛ Благодарю за сотрудничество ${save.class} ${save.name}, ${save.spec}. \n ⚖Вы получили банковскую карту UID: ${save.id}. \n 🏦Вам зачислено ${save.gold} галлеонов`)
		console.log(`Success save user idvk: ${context.senderId}`)
		await context.send(`‼ Список обязательных для покупки вещей: \n 1. Волшебная палочка \n 2. Сова, кошка или жаба \n 3. Комплект учебников \n \n Посетите Косой переулок и приобретите их первым делом!`)
		const check_bbox = await prisma.blackBox.findFirst({ where: { idvk: context.senderId } })
		const ans_selector = `⁉ ${save.class} @id${save.idvk}(${save.name}) ${save.spec} ${!check_bbox ? "легально" : "НЕЛЕГАЛЬНО"} получает банковскую карту UID: ${save.id}!`
		await vk.api.messages.send({
			peer_id: chat_id,
			random_id: 0,
			message: ans_selector
		})
		await Keyboard_Index(context, `💡 Подсказка: Когда все операции вы успешно завершили, напишите [!банк] без квадратных скобочек, а затем нажмите кнопку: ✅Подтвердить авторизацию!`)
	} else {
		await Keyboard_Index(context, `⌛ Загрузка, пожалуйста подождите...`)
	}
	return next();
})
vk.updates.on('message_event', async (context: any, next: any) => { 
	const config: any = {
		"system_call": Main_Menu_Init,
		"card_enter": Card_Enter,
		"card_private": Card_Private,
		"birthday_enter": Birthday_Enter,
		"exit": Exit,
		"artefact_enter": Artefact_Enter,
		"inventory_enter": Inventory_Enter,
		"admin_enter": Admin_Enter,
		"service_enter": Service_Enter,
		"service_cancel": Service_Cancel,
		"service_convert_galleon": Service_Convert_Galleon,
		"service_convert_galleon_change": Service_Convert_Galleon_Change,
		"service_convert_magic_experience": Service_Convert_Magic_Experience,
		"service_convert_magic_experience_change": Service_Convert_Magic_Experience_Change,
		"service_level_up": Service_Level_Up,
		"service_level_up_change": Service_Level_Up_Change,
		"shop_category_enter": Shop_Category_Enter,
		"shop_enter": Shop_Enter,
		"shop_cancel": Shop_Cancel,
		"shop_bought": Shop_Bought,
		"shop_buy": Shop_Buy,
		"operation_enter": Operation_Enter, // заглушки
		"right_enter": Right_Enter, // заглушки
		"service_beer_open": Service_Beer_Open,
		"service_beer_premium_open": Service_Beer_Premium_Open,
		"service_quest_open": Service_Quest_Open,
		"service_underwear_open": Service_Underwear_Open,
		"statistics_enter": Statistics_Enter,
		"rank_enter": Rank_Enter
	}
	try {
		await config[context.eventPayload.command](context)
	} catch (e) {
		console.log(`Ошибка события ${e}`)
	}
	return await next();
})

vk.updates.start().then(() => {
	console.log('Bank ready for services clients!')
}).catch(console.error);

process.on('warning', e => console.warn(e.stack))