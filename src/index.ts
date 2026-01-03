import { MessageEventContext, VK } from 'vk-io';
import { HearManager } from '@vk-io/hear';
import { QuestionManager, IQuestionMessageContext } from 'vk-io-question';
import { registerUserRoutes } from './engine/player'
import { InitGameRoutes } from './engine/init';
import { Antivirus_VK, Group_Id_Get, Logger, Sleep, Worker_Checker, Worker_Online_Setter } from './engine/core/helper';
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { Exit, Main_Menu_Admin_Init, Main_Menu_Init } from './engine/events/contoller';
import { Admin_Enter, Card_Enter, Comment_Person_Enter, Rank_Enter, Statistics_Enter} from './engine/events/module/info';
import { Operation_Enter, Right_Enter, User_Info } from './engine/events/module/tool';
import { Service_Cancel, Service_Enter, Service_Kvass_Open } from './engine/events/module/service';
import { Person_Detector } from './engine/events/module/person/person';
import { Alliance_Control, Alliance_Control_Multi, Alliance_Controller } from './engine/events/module/alliance/alliance';
import { Alliance_Enter, Alliance_Enter_Admin } from './engine/events/module/alliance/alliance_menu';
import { Alliance_Rank_Coin_Enter, Alliance_Rank_Enter } from './engine/events/module/alliance/alliance_rank';
import { Counter_PK_Module } from './engine/events/module/counter_pk';
import { Monitoring } from './monitring';
import { Account_Register } from './engine/events/module/person/account';
import { Shop_Bought, Shop_Buy, Shop_Cancel, Shop_Category_Enter, Shop_Enter, Shop_Enter_Multi } from './engine/events/module/shop/engine';
import { Auto_Backup_DB } from './engine/core/auto_backup';
import { Start_Worker_API_Bot } from './engine/api';
import { Monitor_Select_Person_Handler } from './engine/events/module/person/monitor_select';

// Загрузка конфигурации
const envConfig = dotenv.config();
if (envConfig.error) {
    throw new Error("Couldn't find .env file");
}

export const token: string = String(process.env.token)
export const root: number = Number(process.env.root) //root user
export const chat_id: number = Number(process.env.chat_id) //chat for logs
export const SECRET_KEY = process.env.SECRET_KEY;
export const timer_text = { answerTimeLimit: 300_000 } // ожидать пять минут
export const timer_text_oper = { answerTimeLimit: 60_000 } // ожидать пять минут
export const answerTimeLimit = 300_000 // ожидать пять минут
export const starting_date = new Date(); // время работы бота
if (!SECRET_KEY) {
    throw new Error("SECRET_KEY must be set in .env");
}
/*prisma.$use(async (params, next) => {
	console.log('This is middleware!')
	// Modify or interrogate params here
	console.log(params)
	return next(params)
})*/
export let group_id: number | null = null;//clear chat group
export let vk: VK | null = null;
export const users_pk: Array<{ idvk: number, text: string, mode: boolean }> = []
// Инициализируем group_id до запуска
const initializeGroupId = async () => {
    try {
        const id = await Group_Id_Get(token);
        if (id) {
            group_id = id;
            await Logger(`✅ Группа инициализирована: ${group_id}`);
        } else {
            throw new Error('❌ Не удалось получить group_id');
        }
    } catch (e) {
        console.error('Не удалось получить group_id:', e);
        process.exit(1);
    }
};

// Загружаем всё перед запуском
initializeGroupId().then(async () => {
    // Здесь создаём экземпляр VK только после инициализации group_id
    const vk_init = new VK({
        token,
        pollingGroupId: group_id!,
        apiLimit: 20,
        apiMode: 'parallel_selected',
		//apiTimeout: 10000, // увеличиваем до 10 секунд
    });
	vk = vk_init
	//инициализация
	const questionManager = new QuestionManager();
	const hearManager = new HearManager<IQuestionMessageContext>();
	// Настройка бота
    vk.updates.use(questionManager.middleware);
    vk.updates.on('message_new', hearManager.middleware);
	//регистрация роутов из других классов
	InitGameRoutes(hearManager)
	registerUserRoutes(hearManager)
	//миддлевар для предварительной обработки сообщений
	vk.updates.on('message_new', async (context: any, next: any) => {
		const anti_vk_defender = await Antivirus_VK(context)
		if (anti_vk_defender) { return await next(); }
		//await vk.api.messages.send({ peer_id: 463031671, random_id: 0, message: `тест2`, attachment: `photo200840769_457273112` } )
		const pk_counter_st = await Counter_PK_Module(context)
		//console.log(users_pk)
		if (pk_counter_st) { return await next(); }
		if (context.peerType == 'chat') { 
			/*
			try { 
				await vk.api.messages.delete({'peer_id': context.peerId, 'delete_for_all': 1, 'cmids': context.conversationMessageId, 'group_id': group_id})
				await Logger(`In chat received a message from the user ${context.senderId} and was deleted`)
				//await vk.api.messages.send({ peer_id: chat_id, random_id: 0, message: `✅🚫 @id${context.senderId} ${context.text}`})  
			} catch (error) { 
				await Logger(`In chat received a message from the user ${context.senderId} and wasn't deleted`)
				//await vk.api.messages.send({ peer_id: chat_id, random_id: 0, message: `⛔🚫 @id${context.senderId} ${context.text}`}) 
			}  */
			return await next();
		}
		await Account_Register(context)
		return await next();
	})
	// Защита от дублей
	const callback_events: String[] = [];
	vk.updates.on('message_event', async (context: MessageEventContext, next: any) => { 
		// Проверяем существование payload
        if (!context.eventPayload || !context.eventPayload.command) {
            await Logger(`🚫 Неизвестное событие ${context.eventPayload}`);
            return next();
        }
		
		if (callback_events.includes(`${context.peerId}_${context.eventId}`)) {
            await Logger(`🔁 Событие уже обработано [[${callback_events.length}]]: ${context.peerId}_${context.eventId}`);
            return next();
        }
		callback_events.push(`${context.peerId}_${context.eventId}`);
		await Person_Detector(context)
		//console.log(context)
		const config: Record<string, (ctx: any) => Promise<void>> = {
			"system_call": Main_Menu_Init,
			"system_call_admin": Main_Menu_Admin_Init,
			"card_enter": Card_Enter,
			"exit": Exit,
			"admin_enter": Admin_Enter,
			"service_enter": Service_Enter,
			"service_cancel": Service_Cancel,
			"shop_category_enter": Shop_Category_Enter,
			"shop_enter_multi": Shop_Enter_Multi,
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
			'alliance_rank_coin_enter': Alliance_Rank_Coin_Enter,
			'comment_person_enter': Comment_Person_Enter,
			"monitor_select_person": Monitor_Select_Person_Handler
		}
		const cmd = context.eventPayload.command;
		if (config[cmd]) {
            try {
                await config[cmd](context);
            } catch (e) {
                await Logger(`⚠ Ошибка при выполнении команды "${cmd}": ${e}`);
            }
        } else {
            await Logger(`🌀 Неизвестная команда: ${cmd}`);
        }
		return await next();
	})

	// Запуск бота
    vk.updates.start()
    .then(async () => {
        await Logger('🚀 Бот успешно запущен');
		await Start_Worker_API_Bot()
        setInterval(Worker_Online_Setter.bind(null, group_id!), 3600000); // онлайн каждые 60 минут
        setInterval(Worker_Checker, 86400000); // раз в день
		setInterval(Auto_Backup_DB, 86400000)
    })
    .catch((error) => {
        console.error('🛑 Ошибка запуска бота:', error);
    });

    await Monitoring();
})