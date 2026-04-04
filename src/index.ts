import { Keyboard, KeyboardBuilder, MessageEventContext, VK } from 'vk-io';
import { HearManager } from '@vk-io/hear';
import { QuestionManager, IQuestionMessageContext } from 'vk-io-question';
import { registerUserRoutes } from './engine/player'
import { InitGameRoutes } from './engine/init';
import { Accessed, Antivirus_VK, Group_Id_Get, Logger, Send_Message, Sleep, Worker_Checker, Worker_Online_Setter } from './engine/core/helper';
import * as dotenv from 'dotenv'
import { Admin_Enter, Card_Enter, Comment_Person_Enter, Rank_Enter, Statistics_Enter} from './engine/events/module/info';
import { Operation_Enter, Right_Enter, User_Info } from './engine/events/module/tool';
import { Service_Cancel, Service_Enter, Service_Kvass_Open } from './engine/events/module/service';
import { Person_Detector, Person_Get } from './engine/events/module/person/person';
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
import { Alliance_Topic_Monitor_Printer } from './engine/events/module/alliance/alliance_topic_monitor';
import { Topic_Rank_V2_Enter, Topic_Rank_V2_Search_Topic, Topic_Rank_V2_Search_Topic_Process, Topic_Rank_V2_Select_Facult, Topic_Rank_V2_Select_Monitor, Topic_Rank_V2_Weeks } from './engine/events/module/topic_rank_v2';
import { CleanupOldPostStatistics } from './cleanup_old_posts';
import { button_alliance_return } from './engine/events/module/data_center/standart';
import { Exit, Keyboard_Admin_Main, Keyboard_User_Main, Main_Menu_Admin_Init, Main_Menu_Init } from './engine/events/contoller';
import { Abilities_Upgrade_Menu } from './engine/events/module/abilities/abilities_upgrade';
import { deductAbilityCost, getAllianceLevels, getLevelName } from './engine/events/module/abilities/abilities_helper';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
        
        const pk_counter_st = await Counter_PK_Module(context)
        if (pk_counter_st) { return await next(); }
        
        if (context.peerType == 'chat') { 
            return await next();
        }
        
        await Account_Register(context)
        
        // Проверяем, не является ли это ответом на поиск обсуждений
        const isSearchResponse = await Topic_Rank_V2_Search_Topic_Process(context);
        if (isSearchResponse) {
            return; // Не обрабатываем дальше, так как сообщение уже обработано
        }
        
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
        
        const config: Record<string, (ctx: any) => Promise<void>> = {
            "system_call": Main_Menu_Init,
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
            "operation_enter": Operation_Enter,
            "right_enter": Right_Enter,
            "service_kvass_open": Service_Kvass_Open,
            "statistics_enter": Statistics_Enter,
            "rank_enter": Rank_Enter,
            "alliance_control_multi": Alliance_Control_Multi,
            "alliance_control": Alliance_Control,
            "alliance_controller": Alliance_Controller,
            'alliance_enter': Alliance_Enter,
            'alliance_rank_enter': Alliance_Rank_Enter,
            'alliance_rank_coin_enter': Alliance_Rank_Coin_Enter,
            'comment_person_enter': Comment_Person_Enter,
            "monitor_select_person": Monitor_Select_Person_Handler,
            "alliance_topic_monitor_enter": Alliance_Topic_Monitor_Printer,
            "topic_rank_v2": Topic_Rank_V2_Enter,
            "alliance_config_coin_order": async (ctx: any) => {
            await ctx.send('!порядок валют настроить');
            await ctx.answer();
            },
            "abilities_upgrade_enter": async (ctx: any) => {
            ////console.log("🔍 [INDEX] abilities_upgrade_enter вызвана из index.ts");
            await Abilities_Upgrade_Menu(ctx);
            },
            "do_upgrade_callback": async (ctx: any) => {
            },
            "upgrade_prev_callback": async (ctx: any) => {
            await Abilities_Upgrade_Menu(ctx);
            await ctx.answer();
            },

            "upgrade_next_callback": async (ctx: any) => {
            await Abilities_Upgrade_Menu(ctx);
            await ctx.answer();
            },

            "upgrade_exit_action": async (ctx: any) => {
            
            const user = await Person_Get(ctx);
            if (!user) return;
            
            const cmid = ctx.eventPayload?.cmid;
            
            // Редактируем сообщение, убирая клавиатуру (оставляем только текст)
            if (cmid) {
                try {
                await vk?.api.messages.edit({
                    peer_id: ctx.peerId,
                    conversation_message_id: cmid,
                    message: `⚡ Вы вышли из меню прокачки.`,
                    keyboard: JSON.stringify({ buttons: [] }) // пустая клавиатура
                });
                } catch (e) {
                console.log("Не удалось отредактировать сообщение:", e);
                }
            }
            
            // Показываем главное меню новым сообщением
            await Main_Menu_Init(ctx);
            
            await ctx.answer();
            },
                        
            "confirm_upgrade_action": async (ctx: any) => {
            const payload = ctx.eventPayload;
            
            const user = await Person_Get(ctx);
            if (!user) return;
            
            // Проверяем, что пользователь в альянсе
            if (!user.id_alliance || user.id_alliance <= 0) {
                await Send_Message(ctx.peerId, `❌ Вы не состоите в альянсе!`);
                await ctx.answer();
                return;
            }
            
            const prismaAny = prisma as any;
            
            // Проверяем, не достигнут ли уже максимальный уровень
            const userAbility = await prismaAny.userAbility.findFirst({
                where: { userId: user.id, abilityId: payload.abilityId },
                include: { ability: true }
            });
            
            if (!userAbility) {
                await Send_Message(ctx.peerId, `❌ У вас нет этой способности!`);
                return;
            }
            
            // Получаем уровни (уже с проверкой id_alliance)
            const levels = await getAllianceLevels(user.id_alliance);
            const currentLevel = levels.find((l: any) => l.id === userAbility.levelId);
            const nextLevel = levels.find((l: any) => l.id === payload.nextLevelId);
            const maxLevel = levels.find((l: any) => l.id === userAbility.ability.maxLevelId);
            
            if (currentLevel && maxLevel && currentLevel.order >= maxLevel.order) {
                await Send_Message(ctx.peerId, `❌ Способность "${payload.abilityName}" уже имеет максимальный уровень!`);
                await ctx.answer();
                await Abilities_Upgrade_Menu(ctx);
                return;
            }
            
            const result = await deductAbilityCost(user.id, payload.currencyId, payload.price);
            if (!result.success) {
                await Send_Message(ctx.peerId, `❌ Недостаточно средств!`);
                return;
            }
            
            await prismaAny.userAbility.update({
                where: { id: payload.userAbilityId },
                data: { levelId: payload.nextLevelId }
            });
            
            // Отправляем сообщение с балансом
            await Send_Message(
                ctx.peerId, 
                `✅ "${payload.abilityName}" прокачан до ${payload.nextLevelName}!\n` +
                `💰 ${payload.currencySmile}: ${result.oldBalance} - ${payload.price} = ${result.newBalance}`
            );
            
            await ctx.answer();
            
            await Abilities_Upgrade_Menu(ctx);
            },

            "upgrade_prev_action": async (ctx: any) => {
            // Обновляем cursor в контексте
            ctx.eventPayload = { ...ctx.eventPayload, cursor: ctx.eventPayload.cursor };
            await Abilities_Upgrade_Menu(ctx);
            await ctx.answer();
            },

            "upgrade_next_action": async (ctx: any) => {
            await Abilities_Upgrade_Menu(ctx);
            await ctx.answer();
            },
            "confirm_upgrade": async (ctx: any) => {},
            "cancel_upgrade": async (ctx: any) => {},
            "topic_rank_v2_search_topic": Topic_Rank_V2_Search_Topic,
            "topic_rank_v2_weeks": Topic_Rank_V2_Weeks,
            "topic_rank_v2_select_monitor": Topic_Rank_V2_Select_Monitor,
            "topic_rank_v2_select_facult": Topic_Rank_V2_Select_Facult,   
            "do_upgrade_action": async (ctx: any) => {
            //console.log("🔍 [do_upgrade_action] Вызван!");
            const payload = ctx.eventPayload;
            //console.log("🔍 [do_upgrade_action] payload:", payload);
            
            const user = await Person_Get(ctx);
            if (!user) return;
            
            const prismaAny = prisma as any;
            
            // Получаем текущую способность пользователя
            const userAbility = await prismaAny.userAbility.findFirst({
                where: { userId: user.id, abilityId: payload.abilityId }
            });
            
            if (!userAbility) {
                await Send_Message(ctx.peerId, `❌ У вас нет этой способности!`);
                return;
            }
            
            //console.log("🔍 [do_upgrade_action] userAbility.id:", userAbility.id);
            
            const currentLevelName = await getLevelName(userAbility.levelId);
            
            // ПРАВИЛЬНО: создаем payload ДЛЯ кнопки подтверждения
            const confirmPayload = {
                command: 'confirm_upgrade_action',
                abilityId: payload.abilityId,
                nextLevelId: payload.nextLevelId,
                price: payload.price,
                currencyId: payload.currencyId,
                currencySmile: payload.currencySmile,
                abilityName: payload.abilityName,
                nextLevelName: payload.nextLevelName,
                userAbilityId: userAbility.id  // ← вот здесь добавляем!
            };
            
            const confirmKeyboard = new KeyboardBuilder()
                .callbackButton({ 
                label: '✅ Да', 
                payload: confirmPayload, 
                color: 'positive' 
                })
                .callbackButton({ 
                label: '❌ Нет', 
                payload: { command: 'cancel_upgrade_action' }, 
                color: 'negative' 
                })
                .inline().oneTime();
            
            await Send_Message(
                ctx.peerId,
                `⚠️ Подтверждение прокачки\n\nВы уверены, что хотите прокачать "${payload.abilityName}" с ${currentLevelName} до ${payload.nextLevelName}?\n\n💰 Стоимость: ${payload.price}${payload.currencySmile}`,
                confirmKeyboard
            );
            
            await ctx.answer();
            },

            "cancel_upgrade_action": async (ctx: any) => {
            await Send_Message(ctx.peerId, `❌ Прокачка отменена.`);
            await ctx.answer();
            await Abilities_Upgrade_Menu(ctx);
            },

            "admin_page": async (ctx: any) => {
                const page = ctx.eventPayload?.page || 1;
                await Alliance_Enter_Admin(ctx, page);
                await ctx.answer();
            },

            "alliance_config_menu_bg": async (ctx: any) => {
                await ctx.send('!основу настроить');
                await ctx.answer();
            },
            
            "alliance_config_menu_bg_remove": async (ctx: any) => {
                await ctx.send('!основу удалить');
                await ctx.answer();
            },
            
            "alliance_config_card_bg": async (ctx: any) => {
                await ctx.send('!карту настроить');
                await ctx.answer();
            },
            
            "alliance_config_card_bg_remove": async (ctx: any) => {
                await ctx.send('!карту удалить');
                await ctx.answer();
            },
            
            "alliance_enter_admin": async (ctx: any) => {
                await Alliance_Enter_Admin(ctx, 1);
                await ctx.answer();
            },
            
            "system_call_admin": async (ctx: any) => {
                await Main_Menu_Admin_Init(ctx);
                await ctx.answer();
            },
            
            "systemok_call": async (ctx: any) => {
                try {
                    const messageId = ctx.eventPayload?.messageId;
                    
                    // Отвечаем на callback
                    await vk?.api.messages.sendMessageEventAnswer({
                        event_id: ctx.eventId,
                        user_id: ctx.userId,
                        peer_id: ctx.peerId,
                        event_data: JSON.stringify({
                            type: "show_snackbar",
                            text: "🔔 Возврат в главное меню"
                        })
                    });
                    
                    // Получаем пользователя
                    const user = await Person_Get(ctx);
                    if (!user) return;
                    
                    // Создаем ТЕКСТОВУЮ клавиатуру (не inline)
                    const keyboard = new KeyboardBuilder();
                    
                    // Добавляем кнопки как в Keyboard_Index
                    if (user.idvk == root) {
                        keyboard.textButton({ label: '!Лютный переулок', payload: { command: 'sliz' }, color: 'positive' }).row();
                    }
                    
                    if (await Accessed(ctx) != 1) {
                        keyboard.textButton({ label: '!права', payload: { command: 'sliz' }, color: 'negative' }).row();
                        keyboard.textButton({ label: '!опсоло', payload: { command: 'sliz' }, color: 'positive' });
                        keyboard.textButton({ label: '!опмасс', payload: { command: 'sliz' }, color: 'negative' }).row();
                    } 
                    
                    keyboard.textButton({ label: '!банк', payload: { command: 'sliz' }, color: 'positive' }).row().oneTime();
                    keyboard.textButton({ label: '!помощь', payload: { command: 'sliz' }, color: 'secondary' }).row();
                    keyboard.textButton({ label: '!СБП', payload: { command: 'sliz' }, color: 'secondary' });
                    
                    // Отправляем новое сообщение с ТЕКСТОВОЙ клавиатурой
                    await vk?.api.messages.send({ 
                        peer_id: ctx.peerId, 
                        random_id: 0, 
                        message: `🏦 Возврат в главное меню\n\n✅ Вы авторизованы, ${user.name}!\n💳 UID-${user.id}\n\nДля открытия банка нажмите: !банк`,
                        keyboard: keyboard 
                    });
                    
                    // Если нужно, удаляем старое сообщение с рейтингом
                    if (messageId) {
                        try {
                            await vk?.api.messages.delete({
                                peer_id: ctx.peerId,
                                message_ids: [messageId],
                                delete_for_all: 1
                            });
                        } catch (deleteError) {
                            console.log("Не удалось удалить сообщение:", deleteError);
                        }
                    }
                    
                } catch (error) {
                    console.error("Ошибка в systemok_call:", error);
                }
            }
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
        await Start_Worker_API_Bot();
        
        // Запуск регулярных задач
        setInterval(Worker_Online_Setter.bind(null, group_id!), 3600000); // онлайн каждые 60 минут
        setInterval(Worker_Checker, 86400000); // раз в день
        setInterval(Auto_Backup_DB, 86400000); // бекап каждый день
        
        // Очистка старых данных - каждый день через час после бекапа
        setInterval(CleanupOldPostStatistics, 86400000);
        
        // Первый запуск очистки через 5 минут после старта
        setTimeout(CleanupOldPostStatistics, 300000);
    })
    .catch((error) => {
        console.error('🛑 Ошибка запуска бота:', error);
    });

    await Monitoring();
})