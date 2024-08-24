import { VK, Keyboard } from 'vk-io';
import { HearManager } from '@vk-io/hear';
import {
    QuestionManager,
    IQuestionMessageContext
} from 'vk-io-question';
import { registerUserRoutes } from './engine/player'
import { InitGameRoutes } from './engine/init';
import { Group_Id_Get, Keyboard_Index, Logger, Send_Message, Sleep, Worker_Checker } from './engine/core/helper';
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import prisma from './engine/events/module/prisma_client';
import { Exit, Main_Menu_Init } from './engine/events/contoller';
import { Admin_Enter, Artefact_Enter, Birthday_Enter, Card_Enter, Inventory_Enter, Rank_Enter, Statistics_Enter} from './engine/events/module/info';
import { Operation_Enter, Right_Enter, User_Info } from './engine/events/module/tool';
import { Service_Cancel, Service_Enter, Service_Kvass_Open } from './engine/events/module/service';
import { Shop_Bought, Shop_Buy, Shop_Cancel, Shop_Category_Enter, Shop_Enter } from './engine/events/module/shop';
import { Person_Detector } from './engine/events/module/person/person';
import { Alliance_Control, Alliance_Control_Multi, Alliance_Controller } from './engine/events/module/alliance/alliance';
import { Alliance_Enter, Alliance_Enter_Admin } from './engine/events/module/alliance/alliance_menu';
import { Alliance_Rank_Coin_Enter, Alliance_Rank_Enter } from './engine/events/module/alliance/alliance_rank';
import { Counter_PK_Module } from './engine/events/module/counter_pk';
import { Monitoring } from './monitring';
dotenv.config()

export const token: string = String(process.env.token)
export const root: number = Number(process.env.root) //root user
export const chat_id: number = Number(process.env.chat_id) //chat for logs
export const SECRET_KEY = process.env.SECRET_KEY || '';
export let group_id: number = 0//clear chat group
Group_Id_Get(token).then(async (res) => { 
	await Sleep(1000); 
	group_id = res ?? 0; 
})
export const timer_text = { answerTimeLimit: 300_000 } // ожидать пять минут
export const timer_text_oper = { answerTimeLimit: 60_000 } // ожидать пять минут
export const answerTimeLimit = 300_000 // ожидать пять минут
export const starting_date = new Date(); // время работы бота
//авторизация
export const vk = new VK({ token: token, pollingGroupId: group_id, apiLimit: 20, apiMode: 'parallel_selected' });
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
export const users_pk: Array<{ idvk: number, text: string, mode: boolean }> = []
//миддлевар для предварительной обработки сообщений
vk.updates.on('message_new', async (context: any, next: any) => {
	//await vk.api.messages.send({ peer_id: 463031671, random_id: 0, message: `тест2`, attachment: `photo200840769_457273112` } )
	const pk_counter_st = await Counter_PK_Module(context)
	//console.log(users_pk)
	if (pk_counter_st) { return }
	if (context.peerType == 'chat') { 
		try { 
			await vk.api.messages.delete({'peer_id': context.peerId, 'delete_for_all': 1, 'cmids': context.conversationMessageId, 'group_id': group_id})
			await Logger(`In chat received a message from the user ${context.senderId} and was deleted`)
			//await vk.api.messages.send({ peer_id: chat_id, random_id: 0, message: `✅🚫 @id${context.senderId} ${context.text}`})  
		} catch (error) { 
			await Logger(`In chat received a message from the user ${context.senderId} and wasn't deleted`)
			//await vk.api.messages.send({ peer_id: chat_id, random_id: 0, message: `⛔🚫 @id${context.senderId} ${context.text}`}) 
		}  
		return
	}
	//проверяем есть ли пользователь в базах данных
	const user_check = await prisma.account.findFirst({ where: { idvk: context.senderId } })
	//если пользователя нет, то начинаем регистрацию
	if (!user_check) {
		//согласие на обработку
		const answer = await context.question(`⌛ Вы входите в Центробанк Министерства Магии 🏦, из ниоткуда перед вами предстали два орка и произнесли: \n — Министр Магии говорил нам о вас. Но прежде чем продолжить, распишитесь здесь о своем согласии на обработку персональных данных. \n В тот же миг в их руках магическим образом появился пергамент. \n 💡 У вас есть 5 минут на принятие решения!`,
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
		const visit = await context.question(`⌛ Поставив свою подпись, вы, стараясь не смотреть косо на орков, вошли в личный кабинет Центробанка, и увидели домашнего эльфа, наводящего порядок, ужас и страх.`,
			{ 	
				keyboard: Keyboard.builder()
				.textButton({ label: 'Подойти и поздороваться', payload: { command: 'Согласиться' }, color: 'positive' }).row()
				.textButton({ label: 'Ждать, пока эльф закончит', payload: { command: 'Отказаться' }, color: 'negative' }).oneTime().inline(),
				answerTimeLimit
			}
		);
		if (visit.isTimeout) { return await context.send(`⏰ Время ожидания активности истекло!`) }
		const save = await prisma.account.create({	data: {	idvk: context.senderId } })
		const info = await User_Info(context)
		await context.send(`⌛ Эльф отвлекся от дел, заприметив вас, подошел и сказал.\n - Добро пожаловать в мир меча и магии! \n И протянул вам вашу карточку.\n ⚖Вы получили картотеку, ${info.first_name}\n 🕯 GUID: ${save.id}. \n 🎥 idvk: ${save.idvk}\n ⚰ Дата Регистрации: ${save.crdate}\n`)
		await Logger(`In database created new user with uid [${save.id}] and idvk [${context.senderId}]`)
		await context.send(`⚠ Настоятельно рекомендуем ознакомиться с инструкцией эксплуатации системы "Центробанк Магомира":`,{ 	
			keyboard: Keyboard.builder()
			.urlButton({ label: '⚡ Инструкция', url: `https://vk.com/@bank_mm-instrukciya-po-polzovaniu-botom-centrobanka-magomira` }).row().inline(),
			answerTimeLimit
		})
		const check_bbox = await prisma.blackBox.findFirst({ where: { idvk: context.senderId } })
		const ans_selector = `⁉ @id${save.idvk}(${info.first_name}) ${!check_bbox ? "легально" : "НЕЛЕГАЛЬНО"} получает банковскую карту GUID: ${save.id}!`
		await vk.api.messages.send({
			peer_id: chat_id,
			random_id: 0,
			message: ans_selector
		})
		await Person_Detector(context)
		await Keyboard_Index(context, `💡 Подсказка: Когда все операции вы успешно завершили, напишите [!банк] без квадратных скобочек, а затем нажмите кнопку: ✅Подтвердить авторизацию!`)
	} else {
		await Person_Detector(context)
		await Keyboard_Index(context, `⌛ Загрузка, пожалуйста подождите...`)
	}
	return next();
})
vk.updates.on('message_event', async (context: any, next: any) => { 
	await Person_Detector(context)
	const config: any = {
		"system_call": Main_Menu_Init,
		"card_enter": Card_Enter,
		"birthday_enter": Birthday_Enter,
		"exit": Exit,
		"artefact_enter": Artefact_Enter,
		"inventory_enter": Inventory_Enter,
		"admin_enter": Admin_Enter,
		"service_enter": Service_Enter,
		"service_cancel": Service_Cancel,
		"shop_category_enter": Shop_Category_Enter,
		"shop_enter": Shop_Enter,
		"shop_cancel": Shop_Cancel,
		"shop_bought": Shop_Bought,
		"shop_buy": Shop_Buy,
		"operation_enter": Operation_Enter, // заглушки
		"right_enter": Right_Enter, // заглушки
		"service_kvass_open": Service_Kvass_Open,
		"statistics_enter": Statistics_Enter,
		"rank_enter": Rank_Enter,
		"alliance_control_multi": Alliance_Control_Multi,
		"alliance_control": Alliance_Control,
		"alliance_controller": Alliance_Controller,
		'alliance_enter': Alliance_Enter,
		'alliance_enter_admin': Alliance_Enter_Admin,
		'alliance_rank_enter': Alliance_Rank_Enter,
		'alliance_rank_coin_enter': Alliance_Rank_Coin_Enter
	}
	try {
		await config[context.eventPayload.command](context)
	} catch (e) {
		await Logger(`Error event detected for callback buttons: ${e}`)
	}
	return await next();
})

vk.updates.start().then(async () => {
	await Logger('running succes');
	try {
		await Sleep(1000)
		await vk.api.groups.enableOnline({ group_id: group_id }) 
	} catch(e) {
		await Logger(`${e}`)
	}
}).catch(console.error);
setInterval(Worker_Checker, 86400000);
//process.on('warning', e => console.warn(e.stack))

Monitoring()