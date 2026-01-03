import { Alliance, AllianceCoin, User, BalanceFacult } from "@prisma/client";
import prisma from "../prisma_client";
import { Person_Get } from "../person/person";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id, timer_text, timer_text_oper } from "../../../..";
import { Confirm_User_Success, Keyboard_Index, Logger, Send_Message } from "../../../core/helper";
import { button_alliance_return } from "../data_center/standart";
import { ico_list } from "../data_center/icons_lib";
import { getTerminology } from "../alliance/terminology_helper"

// Контроллер управления валютами альянса
// В alliance_converter.ts исправьте функцию Alliance_Coin_Get:
async function Alliance_Coin_Get(cursor: number, alliance: Alliance) {
    const batchSize = 5;
    
    // Вместо ручного подсчета используем Prisma с skip/take
    return await prisma.allianceCoin.findMany({
        where: { id_alliance: alliance.id },
        orderBy: { id: 'asc' },
        skip: cursor,
        take: batchSize
    });
}

export async function Alliance_Coin_Converter_Printer(context: any) {
    const user = await Person_Get(context);
    const alliance = await prisma.alliance.findFirst({ 
        where: { id: user?.id_alliance! } 
    });
    
    if (!alliance || !user) { 
        await context.send(`⚠ Альянс не найден!`);
        return;
    }

    // Выбор типа конвертации
    const keyboard = new KeyboardBuilder()
        .textButton({ 
            label: '🔘 Конвертация жетонов', 
            payload: { command: 'select_converter_type', type: 'medal' }, 
            color: 'secondary' 
        }).row()
        .textButton({ 
            label: '🌕 Конвертация S-coins', 
            payload: { command: 'select_converter_type', type: 'scoopins' }, 
            color: 'secondary' 
        }).row()
        .textButton({ 
            label: `${ico_list['stop'].ico}`, 
            payload: { command: 'converter_cancel' }, 
            color: 'secondary' 
        }).oneTime();

    const typeSelect = await context.question(
        `${ico_list['converter'].ico} Выберите тип конвертации:`, 
        { keyboard, answerTimeLimit }
    );

    if (typeSelect.isTimeout) {
        await context.send(`⏰ Время ожидания истекло!`);
        return;
    }

    if (typeSelect.payload?.command === 'converter_cancel') {
        await context.send(`❌ Конвертация отменена`);
        return;
    }

    const converterType = typeSelect.payload?.type;
    
    if (converterType === 'medal') {
        await Medal_Converter_Flow(context, user, alliance);
    } else if (converterType === 'scoopins') {
        await Scoopins_Converter_Flow(context, user, alliance);
    }
}

async function Medal_Converter_Flow(context: any, user: any, alliance: any) {
    let allicoin_tr = false;
    let cursor = 0;
    
    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = `${ico_list['converter'].ico} Конвертация жетонов в валюты ${alliance.name}:\n\n`;
        
        let counter = 0;
        for await (const alliance_coin of await Alliance_Coin_Get(cursor, alliance)) {
            if (alliance_coin.converted) {
                keyboard.textButton({ 
                    label: `${alliance_coin.smile} ${alliance_coin.name.slice(0,25)}`, 
                    payload: { 
                        command: 'alliance_coin_edit', 
                        cursor: cursor, 
                        id_alliance_coin: alliance_coin.id,
                        type: 'medal'
                    }, 
                    color: 'secondary' 
                }).row();
                
                event_logger += `№${counter} ${alliance_coin.smile} ${alliance_coin.name}\n`;
                event_logger += `Курс: ${alliance_coin.course_medal}🔘 → ${alliance_coin.course_coin}${alliance_coin.smile}\n\n`;
                counter++;
            }
        }
        
        if (cursor >= 5) { 
            keyboard.textButton({ 
                label: `←`, 
                payload: { command: 'alliance_coin_back', cursor: cursor, type: 'medal' }, 
                color: 'secondary' 
            }); 
        }
        
        const alliance_coin_counter = await prisma.allianceCoin.count({ 
            where: { 
                id_alliance: alliance.id,
                converted: true 
            } 
        });
        
        if (5 + cursor < alliance_coin_counter) { 
            keyboard.textButton({ 
                label: `→`, 
                payload: { command: 'alliance_coin_next', cursor: cursor, type: 'medal' }, 
                color: 'secondary' 
            }); 
        }
        
        keyboard.textButton({ 
            label: `🚫`, 
            payload: { command: 'alliance_coin_return', cursor: cursor, type: 'medal' }, 
            color: 'secondary' 
        }).oneTime();
        
        event_logger += `\n${1 + cursor} из ${alliance_coin_counter}`;
        
        const allicoin_bt = await context.question(event_logger, {	
            keyboard: keyboard, 
            answerTimeLimit
        });
        
        if (allicoin_bt.isTimeout) { 
            return await context.send(`⏰ Время ожидания истекло!`); 
        }
        
        if (!allicoin_bt.payload) {
            await context.send(`💡 Жмите только по кнопкам!`);
            continue;
        }
        
        const config: any = {
            'alliance_coin_edit': Alliance_Coin_Edit,
            'alliance_coin_next': Alliance_Coin_Next,
            'alliance_coin_back': Alliance_Coin_Back,
            'alliance_coin_return': Alliance_Coin_Return,
        };
        
        const ans = await config[allicoin_bt.payload.command](context, allicoin_bt.payload, alliance, 'medal');
        cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor;
        allicoin_tr = ans.stop ? ans.stop : false;
    }
}

async function Alliance_Coin_Edit_Course(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    
    const alliance_coin = await prisma.allianceCoin.findFirst({ 
        where: { id: data.id_alliance_coin } 
    });
    
    if (!alliance_coin) { 
        await context.send(`Валюта не найдена`);
        return res;
    }
    
    // НАСТРОЙКА КУРСА ЖЕТОНОВ, а не конвертация!
    let spec_check = false;
    const course_change = { course_medal: alliance_coin.course_medal, course_coin: alliance_coin.course_coin };
    
    // Настройка курса жетонов
    while (!spec_check) {
        const response = await context.question(
            `${ico_list['attach'].ico} Настройка курса конвертации жетонов для ${alliance_coin.smile} ${alliance_coin.name}:\n\n` +
            `Текущий курс: ${alliance_coin.course_medal}🔘 → ${alliance_coin.course_coin}${alliance_coin.smile}\n\n` +
            `Введите, сколько 🔘 жетонов нужно для получения 1${alliance_coin.smile}:`,
            {   
                keyboard: Keyboard.builder()
                    .textButton({ label: `${ico_list['stop'].ico} Отмена`, payload: { command: 'cancel' }, color: 'secondary' })
                    .oneTime().inline(),
                timer_text
            }
        );
        
        if (response.isTimeout) {
            await context.send(`${ico_list['time'].ico} Время истекло!`);
            return res;
        }
        
        if (response.text === `${ico_list['stop'].ico} Отмена`) {
            await context.send(`${ico_list['stop'].ico} Настройка отменена`);
            return res;
        }
        
        const input = parseInt(response.text);
        if (!isNaN(input) && input > 0 && input <= 10000) {
            course_change.course_medal = input;
            spec_check = true;
        } else {
            await context.send(`${ico_list['help'].ico} Введите число от 1 до 10000!`);
        }
    }
    
    spec_check = false;
    
    // Настройка сколько валюты за жетоны
    while (!spec_check) {
        const response = await context.question(
            `Введите, сколько ${alliance_coin.smile} получится из ${course_change.course_medal}🔘:`,
            {   
                keyboard: Keyboard.builder()
                    .textButton({ label: `${ico_list['stop'].ico} Отмена`, payload: { command: 'cancel' }, color: 'secondary' })
                    .oneTime().inline(),
                timer_text
            }
        );
        
        if (response.isTimeout) {
            await context.send(`${ico_list['time'].ico} Время истекло!`);
            return res;
        }
        
        if (response.text === `${ico_list['stop'].ico} Отмена`) {
            await context.send(`${ico_list['stop'].ico} Настройка отменена`);
            return res;
        }
        
        const input = parseInt(response.text);
        if (!isNaN(input) && input > 0 && input <= 10000) {
            course_change.course_coin = input;
            spec_check = true;
        } else {
            await context.send(`${ico_list['help'].ico} Введите число от 1 до 10000!`);
        }
    }
    
    const confirm = await Confirm_User_Success(
        context, 
        `установить курс конвертации жетонов:\n` +
        `${course_change.course_medal}🔘 → ${course_change.course_coin}${alliance_coin.smile}?`
    );
    
    if (confirm.status) {
        const updated = await prisma.allianceCoin.update({
            where: { id: alliance_coin.id },
            data: {
                course_medal: course_change.course_medal,
                course_coin: course_change.course_coin
            }
        });
        
        await context.send(
            `${ico_list['reconfig'].ico} Курс конвертации жетонов обновлен!\n\n` +
            `Валюта: ${alliance_coin.smile} ${alliance_coin.name}\n` +
            `Новый курс: ${updated.course_medal}🔘 → ${updated.course_coin}${alliance_coin.smile}`
        );
        
        await Logger(`Настройка курса жетонов: ${alliance_coin.name} ${updated.course_medal}🔘 → ${updated.course_coin}${alliance_coin.smile} by ${user.idvk}`);
        await Send_Message(chat_id,
            `${ico_list['reconfig'].ico} Настройка курса конвертации жетонов\n` +
            `${alliance_coin.smile} ${alliance_coin.name}\n` +
            `Курс: ${updated.course_medal}🔘 → ${updated.course_coin}${alliance_coin.smile}\n` +
            `${ico_list['person'].ico} @id${user.idvk}(${user.name})\n` +
            `${ico_list['alliance'].ico} ${alliance.name}`
        );
    }
    
    return res;
}

async function Scoopins_Converter_Flow(context: any, user: any, alliance: any) {
    let allicoin_tr = false;
    let cursor = 0;
    const batchSize = 5;
    
    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = `${ico_list['converter']?.ico || '⚖'} Конвертация 🌕 S-coins в валюты ${alliance.name}:\n\n`;
        
        // Получаем валюты с конвертацией S-coins
        const allianceCoins = await prisma.allianceCoin.findMany({
            where: { 
                id_alliance: alliance.id,
                scoopins_converted: true 
            },
            orderBy: { id: 'asc' },
            skip: cursor,
            take: batchSize
        });
        
        if (allianceCoins.length === 0) {
            // Если на этой странице нет валют, но общее количество > 0,
            // значит курсор вышел за пределы - возвращаемся на первую страницу
            const totalScoopinsCoins = await prisma.allianceCoin.count({ 
                where: { 
                    id_alliance: alliance.id,
                    scoopins_converted: true 
                } 
            });
            
            if (totalScoopinsCoins === 0) {
                await context.send(`${ico_list['warn']?.ico || '⚠'} Нет валют с разрешенной конвертацией S-coins!`);
                return;
            } else {
                cursor = 0;
                continue;
            }
        }
        
        let counter = 0;
        for (const alliance_coin of allianceCoins) {
            keyboard.textButton({ 
                label: `${alliance_coin.smile} ${alliance_coin.name.slice(0,25)}`, 
                payload: { 
                    command: 'alliance_coin_edit', 
                    cursor: cursor, 
                    id_alliance_coin: alliance_coin.id,
                    type: 'scoopins'
                }, 
                color: 'secondary' 
            }).row();
            
            event_logger += `№${counter} ${alliance_coin.smile} ${alliance_coin.name}\n`;
            event_logger += `Курс: ${alliance_coin.course_scoopins_medal}🌕 → ${alliance_coin.course_scoopins_coin}${alliance_coin.smile}\n\n`;
            counter++;
        }
        
        // ПРАВИЛЬНЫЙ подсчет для пагинации
        const totalCoins = await prisma.allianceCoin.count({ 
            where: { 
                id_alliance: alliance.id,
                scoopins_converted: true 
            } 
        });
        
        // Кнопки навигации
        if (cursor >= batchSize) { 
            keyboard.textButton({ 
                label: `←`, 
                payload: { 
                    command: 'alliance_coin_back', 
                    cursor: Math.max(0, cursor - batchSize), 
                    type: 'scoopins' 
                }, 
                color: 'secondary' 
            }); 
        }
        
        if (cursor + batchSize < totalCoins) { 
            keyboard.textButton({ 
                label: `→`, 
                payload: { 
                    command: 'alliance_coin_next', 
                    cursor: cursor + batchSize,  // ← УЖЕ прибавляем batchSize здесь!
                    type: 'scoopins' 
                }, 
                color: 'secondary' 
            }); 
        }
        
        keyboard.textButton({ 
            label: `🚫`, 
            payload: { command: 'alliance_coin_return', cursor: cursor, type: 'scoopins' }, 
            color: 'secondary' 
        }).oneTime();
        
        event_logger += `\nСтраница ${Math.floor(cursor / batchSize) + 1} из ${Math.ceil(totalCoins / batchSize)}`;
        
        const allicoin_bt = await context.question(event_logger, {	
            keyboard: keyboard, 
            answerTimeLimit
        });
        
        if (allicoin_bt.isTimeout) { 
            return await context.send(`⏰ Время ожидания истекло!`); 
        }
        
        if (!allicoin_bt.payload) {
            await context.send(`💡 Жмите только по кнопкам!`);
            continue;
        }
        
        const config: any = {
            'alliance_coin_edit': Alliance_Coin_Edit_Scoopins,
            'alliance_coin_next': Alliance_Coin_Next_Fixed,  // ← Исправленная функция
            'alliance_coin_back': Alliance_Coin_Back_Fixed,  // ← Исправленная функция
            'alliance_coin_return': Alliance_Coin_Return,
        };
        
        const ans = await config[allicoin_bt.payload.command](context, allicoin_bt.payload, alliance, 'scoopins');
        cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor;
        allicoin_tr = ans.stop ? ans.stop : false;
    }
}

// Исправленные функции навигации
async function Alliance_Coin_Next_Fixed(context: any, data: any, alliance: Alliance, type: string) {
    // Просто возвращаем переданный курсор (он уже увеличен в payload)
    return { cursor: data.cursor };
}

async function Alliance_Coin_Back_Fixed(context: any, data: any, alliance: Alliance, type: string) {
    // Просто возвращаем переданный курсор (он уже уменьшен в payload)
    return { cursor: data.cursor };
}

export async function Alliance_Coin_Converter_Editor_Printer(context: any) {
    const user = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } })
    if (!alliance) { return }
    if (!user) { return }
    let allicoin_tr = false
    let cursor = 0
    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder()
        let event_logger = `${ico_list['converter'].ico} настройка конвертации жетонов для валют ${alliance.name}:\n\n`
        
        for await (const alliance_coin of await Alliance_Coin_Get(cursor, alliance!)) {
            keyboard.textButton({ 
                label: `${ico_list['edit'].ico} ${alliance_coin.id}-${alliance_coin.name.slice(0,30)}`, 
                payload: { 
                    command: 'alliance_coin_edit_course', // ИЗМЕНИЛИ команду
                    cursor: cursor, 
                    id_alliance_coin: alliance_coin.id 
                }, 
                color: 'secondary' 
            })
            .textButton({ 
                label: `${ico_list['config'].ico}`, 
                payload: { 
                    command: 'alliance_coin_config', 
                    cursor: cursor, 
                    id_alliance_coin: alliance_coin.id 
                }, 
                color: 'secondary' 
            }).row()
            
            event_logger += `${alliance_coin.smile} ${alliance_coin.name}: id${alliance_coin.id}\n`
            event_logger += `Конвертация 🔘: ${alliance_coin.converted ? "✅" : "⛔"}\n`
            event_logger += `⚖ Курс: ${alliance_coin.course_medal}🔘 → ${alliance_coin.course_coin}${alliance_coin.smile}\n\n`
        }
        
        if (cursor >= 5) { 
            keyboard.textButton({ 
                label: `${ico_list['back'].ico}`, 
                payload: { command: 'alliance_coin_back', cursor: cursor }, 
                color: 'secondary' 
            }) 
        }
        
        const alliance_coin_counter = await prisma.allianceCoin.count({ where: { id_alliance: alliance!.id! } })
        
        if (5 + cursor < alliance_coin_counter) { 
            keyboard.textButton({ 
                label: `${ico_list['next'].ico}`, 
                payload: { command: 'alliance_coin_next', cursor: cursor }, 
                color: 'secondary' 
            }) 
        }
        
        keyboard.textButton({ 
            label: `${ico_list['stop'].ico}`, 
            payload: { command: 'alliance_coin_return', cursor: cursor }, 
            color: 'secondary' 
        }).oneTime()
        
        event_logger += `\n Страница ${Math.floor(cursor / 5) + 1} из ${Math.ceil(alliance_coin_counter / 5)}`
        
        const allicoin_bt: any = await context.question(event_logger, {	
            keyboard: keyboard, 
            answerTimeLimit
        })
        
        if (allicoin_bt.isTimeout) { 
            return await context.send(`${ico_list['time'].ico} Время ожидания истекло!`) 
        }
        
        const config: any = {
            'alliance_coin_edit_course': Alliance_Coin_Edit_Course, // НОВАЯ функция настройки
            'alliance_coin_config': Alliance_Coin_Config,
            'alliance_coin_next': Alliance_Coin_Next_Editor, // Переименуем
            'alliance_coin_back': Alliance_Coin_Back_Editor, // Переименуем
            'alliance_coin_return': Alliance_Coin_Return_Editor, // Переименуем
        }
        
        if (allicoin_bt?.payload?.command in config) {
            const commandHandler = config[allicoin_bt.payload.command];
            const ans = await commandHandler(context, allicoin_bt.payload, alliance, user)
            cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor
            allicoin_tr = ans.stop ? ans.stop : false
        } else {
            await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`)
        }
    }
    await Keyboard_Index(context, `${ico_list['help'].ico} Настройка конвертации жетонов завершена!`)
}

// Функции навигации для редактора (переименуем, чтобы не конфликтовать)
async function Alliance_Coin_Next_Editor(context: any, data: any, alliance: Alliance, user: User) {
    return { cursor: data.cursor + 5 };
}

async function Alliance_Coin_Back_Editor(context: any, data: any, alliance: Alliance, user: User) {
    return { cursor: Math.max(0, data.cursor - 5) };
}

async function Alliance_Coin_Return_Editor(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor, stop: true };
    await context.send(`${ico_list['stop'].ico} Отмена настройки конвертации жетонов`, { 
        keyboard: button_alliance_return 
    });
    return res;
}

async function Alliance_Coin_Config(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const alliance_coin_check = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin } })
    const converted_change = { converted: alliance_coin_check?.converted, converted_point: alliance_coin_check?.converted_point }
    const plural_genitive = await getTerminology(alliance.id, 'plural_genitive');
	const converted_check: { status: boolean, text: String } = await Confirm_User_Success(context, `разрешить конвертацию валюты [${alliance_coin_check?.smile} ${alliance_coin_check?.name}]?`)
	converted_change.converted = converted_check.status
    await context.send(`${converted_check.text}`)
    if (alliance_coin_check?.point) {
        const converted_point_check: { status: boolean, text: String } = await Confirm_User_Success(context, `разрешить конвертацию валюты [${alliance_coin_check?.smile} ${alliance_coin_check?.name}] в рейтинги ${plural_genitive}?`)
        converted_change.converted_point = converted_point_check.status
        await context.send(`${converted_point_check.text}`)
    }
    const rank_check: { status: boolean, text: String } = await Confirm_User_Success(context, `принять изменения?`)
    await context.send(`${rank_check.text}`)
    if (rank_check.status) {
        const quest_up = await prisma.allianceCoin.update({ where: { id: alliance_coin_check?.id }, data: { converted: converted_change.converted, converted_point: converted_change.converted_point } })
        if (quest_up) {
            await Logger(`In database, updated config alliance coin: ${quest_up.id}-${quest_up.name} by admin ${context.senderId}`)
            await context.send(`${ico_list['reconfig'].ico} Вы скорректировали конфигурацию валюты:\n${alliance_coin_check?.smile} Название: ${alliance_coin_check?.id}-${alliance_coin_check?.name}\n${quest_up.converted ? `✅` : `⛔`} Конвертация валюты\n${quest_up.converted_point ? `✅` : `⛔`} Конвертация валюты в рейтинги ${plural_genitive}\n`)
            await Send_Message(chat_id, `${ico_list['reconfig'].ico} Корректировка конфигурации курса конвертации ролевой валюты\n${ico_list['message'].ico} Сообщение:\nНазвание: ${alliance_coin_check?.id}-${alliance_coin_check?.name}\n${quest_up.converted ? `✅` : `⛔`} Конвертация валюты\n${quest_up.converted_point ? `✅` : `⛔`} Конвертация валюты в рейтинги ${plural_genitive}\n${ico_list['person'].ico} @id${user.idvk}(${user.name})\n${ico_list['alliance'].ico} ${alliance.name}`)
        }
    }
    return res
}


async function Alliance_Coin_Return(context: any, data: any, alliance: Alliance, type: string) {
    const res = { cursor: data.cursor, stop: true };
    await context.send(`⚠ Вы отменили меню конвертации ${type === 'medal' ? 'жетонов' : 'S-coins'}`, { 
        keyboard: button_alliance_return 
    });
    return res;
}

async function Alliance_Coin_Edit(context: any, data: any, alliance: Alliance, type: string) {
    const res = { cursor: data.cursor };
    
    const user = await Person_Get(context);
    if (!user) { return res; }
    
    const alliance_coin = await prisma.allianceCoin.findFirst({ 
        where: { id: data.id_alliance_coin } 
    });
    
    if (!alliance_coin) { 
        await context.send(`Валюта не найдена`);
        return res;
    }
    
    let currency_type = '';
    let currency_balance = 0;
    let course_currency = 0;
    let course_coin = 0;
    let currency_emoji = '';
    
    if (type === 'medal') {
        currency_type = 'жетонов';
        currency_balance = user.medal;
        course_currency = alliance_coin.course_medal;
        course_coin = alliance_coin.course_coin;
        currency_emoji = '🔘';
    } else {
        currency_type = 'S-coins';
        currency_balance = user.scoopins;
        course_currency = alliance_coin.course_scoopins_medal;
        course_coin = alliance_coin.course_scoopins_coin;
        currency_emoji = '🌕';
    }
    
    let money_check = false;
    let coi = currency_balance;
    let calc = 0;
    
    while (!money_check) {
        calc = Math.floor(coi / course_currency * course_coin);
        const gold: any = await context.question(
            `${ico_list['converter'].ico} Конвертация ${currency_type}:\n\n` +
            `Ваш баланс: ${currency_balance}${currency_emoji}\n` +
            `Курс: ${course_currency}${currency_emoji} → ${course_coin}${alliance_coin.smile}\n` +
            `Будет сконвертировано: ${coi}${currency_emoji} → ${calc}${alliance_coin.smile}\n\n` +
            `Введите количество ${currency_type} для конвертации:`,
            {	
                keyboard: Keyboard.builder()
                    .textButton({ label: '!подтвердить', payload: { command: 'confirm' }, color: 'secondary' })
                    .textButton({ label: '!отмена', payload: { command: 'cancel' }, color: 'secondary' })
                    .oneTime().inline(),
                timer_text_oper
            }
        );
        
        if (gold.isTimeout) { 
            await context.send(`⏰ Время ожидания истекло!`); 
            return res;
        }
        
        if (gold.text == '!подтвердить') {
            money_check = true;
        } else if (gold.text == '!отмена') {
            return res;
        } else if (typeof Number(gold.text) === "number") {
            const input = Math.floor(Number(gold.text));
            if (input < 0) {
                await context.send(`⚠ Введите положительное число!`);
                continue;
            }
            if (input > currency_balance) {
                await context.send(`⚠ У вас нет столько ${currency_type}! Максимум: ${currency_balance}${currency_emoji}`);
                continue;
            }
            if (Number.isNaN(input)) {
                await context.send(`⚠ Введите число!`);
                continue;
            }
            coi = input;
        }
    }
    
    const confirm = await Confirm_User_Success(
        context, 
        `сконвертировать ${coi}${currency_emoji} в ${calc}${alliance_coin.smile} ${alliance_coin.name}?`
    );
    
    await context.send(`${confirm.text}`);
    
    if (confirm.status) {
        // Находим или создаем баланс валюты
        let balance_check = await prisma.balanceCoin.findFirst({ 
            where: { 
                id_coin: alliance_coin.id, 
                id_user: user.id 
            } 
        });
        
        if (!balance_check) {
            balance_check = await prisma.balanceCoin.create({
                data: {
                    id_coin: alliance_coin.id,
                    id_user: user.id,
                    amount: 0
                }
            });
        }
        
        // Обновляем балансы
        const balance_update = await prisma.balanceCoin.update({ 
            where: { id: balance_check.id }, 
            data: { amount: { increment: calc } } 
        });
        
        // Обновляем жетоны или S-coins
        let currency_update;
        if (type === 'medal') {
            currency_update = await prisma.user.update({ 
                where: { id: user.id }, 
                data: { medal: { decrement: coi } } 
            });
        } else {
            currency_update = await prisma.user.update({ 
                where: { id: user.id }, 
                data: { scoopins: { decrement: coi } } 
            });
        }
        
        if (balance_update && currency_update) {
            let log_message = '';
            let user_message = '';
            
            if (type === 'medal') {
                log_message = `Конвертация жетонов: ${user.medal} - ${coi} = ${currency_update.medal} 🔘, `;
                log_message += `${alliance_coin.smile}: ${balance_check.amount} + ${calc} = ${balance_update.amount}`;
                
                user_message = `✅ Конвертация успешна!\n\n`;
                user_message += `🔘 Жетоны: ${user.medal} - ${coi} = ${currency_update.medal}\n`;
                user_message += `${alliance_coin.smile} ${alliance_coin.name}: ${balance_check.amount} + ${calc} = ${balance_update.amount}`;
            } else {
                log_message = `Конвертация S-coins: ${user.scoopins} - ${coi} = ${currency_update.scoopins} 🌕, `;
                log_message += `${alliance_coin.smile}: ${balance_check.amount} + ${calc} = ${balance_update.amount}`;
                
                user_message = `✅ Конвертация успешна!\n\n`;
                user_message += `🌕 S-coins: ${user.scoopins} - ${coi} = ${currency_update.scoopins}\n`;
                user_message += `${alliance_coin.smile} ${alliance_coin.name}: ${balance_check.amount} + ${calc} = ${balance_update.amount}`;
            }
            
            await Logger(`Конвертация: ${log_message} by player ${context.senderId}`);
            await context.send(user_message);
            
            // Если валюта рейтинговая и разрешена конвертация в рейтинги
            if (alliance_coin.point && alliance_coin.converted_point) {
                if (user.id_facult) {
                    const facult = await prisma.allianceFacult.findFirst({ 
                        where: { id: user.id_facult } 
                    });
                    
                    if (facult) {
                        // НАЙДИТЕ или СОЗДАЙТЕ запись balanceFacult
                        let facult_balance = await prisma.balanceFacult.findFirst({ 
                            where: { 
                                id_coin: alliance_coin.id, 
                                id_facult: user.id_facult
                            } 
                        });
                        
                        // ЕСЛИ НЕТ ЗАПИСИ - СОЗДАЕМ!
                        if (!facult_balance) {
                            facult_balance = await prisma.balanceFacult.create({
                                data: {
                                    id_coin: alliance_coin.id,
                                    id_facult: user.id_facult,
                                    amount: 0
                                }
                            });
                        }
                        
                        // Теперь обновляем
                        const updated_facult = await prisma.balanceFacult.update({ 
                            where: { id: facult_balance.id }, 
                            data: { amount: { increment: calc } } 
                        });
                        
                        if (updated_facult) {
                            // Получаем терминологию для корректного отображения
                            const singular = await getTerminology(alliance.id, 'singular');
                            const dative = await getTerminology(alliance.id, 'dative');
                            
                            await context.send(
                                `📊 Начислены рейтинги ${dative}:\n` +
                                `${facult.smile} ${facult.name}: ${facult_balance.amount} + ${calc} = ${updated_facult.amount}`
                            );
                        }
                    }
                }
            }
            
            // Отправляем в чат логирования
            await Send_Message(chat_id,
                `🔄 Конвертация ${type === 'medal' ? 'жетонов' : 'S-coins'}\n` +
                `👤 @id${user.idvk}(${user.name})\n` +
                `${type === 'medal' ? '🔘' : '🌕'} ${coi} → ${calc}${alliance_coin.smile}\n` +
                `${alliance_coin.name}`
            );
        }
    }
    
    return res;
}

// Аналогичная функция для S-coins (можно объединить, но для наглядности оставим отдельно)
async function Alliance_Coin_Edit_Scoopins(context: any, data: any, alliance: Alliance, type: string) {
    return await Alliance_Coin_Edit(context, data, alliance, 'scoopins');
}

async function Alliance_Coin_Next(context: any, data: any, alliance: Alliance, type: string) {
    return { cursor: data.cursor + 5 };
}

async function Alliance_Coin_Back(context: any, data: any, alliance: Alliance, type: string) {
    return { cursor: data.cursor - 5 };
}