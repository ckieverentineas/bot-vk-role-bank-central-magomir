import { Alliance, AllianceCoin, User } from "@prisma/client";
import prisma from "./../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id, timer_text } from "../../../..";
import { Confirm_User_Success, Keyboard_Index, Logger, Send_Message } from "./../../../core/helper";
import { Person_Get } from "./../person/person";
import { ico_list } from "./../data_center/icons_lib";
import { button_alliance_return } from "./../data_center/standart";

// Контроллер управления конвертацией S-coins для валют альянса
async function Alliance_Coin_Get(cursor: number, alliance: Alliance) {
    const batchSize = 5;
    let counter = 0;
    let limiter = 0;
    let res: AllianceCoin[] = [];
    
    for (const allicoin of await prisma.allianceCoin.findMany({ 
        where: { id_alliance: alliance.id } 
    })) {
        if ((cursor <= counter && batchSize+cursor >= counter) && limiter < batchSize) {
            res.push(allicoin);
            limiter++;
        }
        counter++;
    }
    
    return res;
}

export async function Alliance_Scoopins_Converter_Editor_Printer(context: any) {
    const user = await Person_Get(context);
    const alliance = await prisma.alliance.findFirst({ 
        where: { id: Number(user?.id_alliance) } 
    });
    
    if (!alliance || !user) { 
        await context.send(`${ico_list['stop'].ico} Альянс не найден!`);
        return;
    }

    let allicoin_tr = false;
    let cursor = 0;
    
    while (!allicoin_tr) {
            const keyboard = new KeyboardBuilder();
            let event_logger = `${ico_list['attach'].ico} Управление конвертацией 🌕 S-coins для валют ${alliance.name}:\n\n`;
            
            // ВАЖНОЕ ПРИМЕЧАНИЕ ДЛЯ АДМИНОВ
            event_logger += `${ico_list['warn'].ico} Внимание! Прежде чем разрешать конвертацию S-coins и настраивать курс:\n`;
            event_logger += `Если валюта является РЕЙТИНГОВОЙ (участвует в рейтинге), сначала необходимо:\n`;
            event_logger += `1. Перейти в меню: ${ico_list['config'].ico} !конвертацию настроить, нажать ⚙ той рейтинговой валюты, в которую будет конвертация.\n`;
            event_logger += `2. Система задаст два вопроса:\n`;
            event_logger += `• Первый вопрос (о конвертации из ЖЕТОНОВ) — ответ опционален;\n`;
            event_logger += `• Второй вопрос (о конвертации в рейтинги) — ОБЯЗАТЕЛЬНО выбрать "ДА" (эта настройка общая для ЖЕТОНОВ И S-КОИНОВ).\n`;
            event_logger += `3. Принять изменения. Повторить для каждой рейтинговой валюты, в которую хотите конвертировать!\n`;
            event_logger += `4. Только после этого настраивать конвертацию S-coins здесь!\n\n`;
            event_logger += `${ico_list['money'].ico} Достуыпные валюты:\n`;
            
            for await (const alliance_coin of await Alliance_Coin_Get(cursor, alliance)) {
                keyboard.textButton({ 
                    label: `${alliance_coin.scoopins_converted ? '✅' : '⛔'} ${alliance_coin.id}-${alliance_coin.name.slice(0,25)}`, 
                    payload: { 
                        command: 'scoopins_coin_edit', 
                        cursor: cursor, 
                        id_alliance_coin: alliance_coin.id 
                    }, 
                    color: alliance_coin.scoopins_converted ? 'positive' : 'negative' 
                })
            .textButton({ 
                label: `${ico_list['config'].ico}`, 
                payload: { 
                    command: 'scoopins_coin_config', 
                    cursor: cursor, 
                    id_alliance_coin: alliance_coin.id 
                }, 
                color: 'secondary' 
            }).row();
            
            event_logger += `${alliance_coin.smile} ${alliance_coin.name}: id${alliance_coin.id}\n`;
            event_logger += `Конвертация 🌕: ${alliance_coin.scoopins_converted ? "✅" : "⛔"}\n`;
            event_logger += `Курс: ${alliance_coin.course_scoopins_medal}🌕 → ${alliance_coin.course_scoopins_coin}${alliance_coin.smile}\n\n`;
        }
        
        if (cursor >= 5) { 
            keyboard.textButton({ 
                label: `${ico_list['back'].ico}`, 
                payload: { command: 'scoopins_coin_back', cursor: cursor }, 
                color: 'secondary' 
            }); 
        }
        
        const alliance_coin_counter = await prisma.allianceCoin.count({ 
            where: { id_alliance: alliance.id } 
        });
        
        if (5 + cursor < alliance_coin_counter) { 
            keyboard.textButton({ 
                label: `${ico_list['next'].ico}`, 
                payload: { command: 'scoopins_coin_next', cursor: cursor }, 
                color: 'secondary' 
            }); 
        }
        
        keyboard.textButton({ 
            label: `${ico_list['stop'].ico}`, 
            payload: { command: 'scoopins_coin_return', cursor: cursor }, 
            color: 'secondary' 
        }).oneTime();
        
        event_logger += `\nСтраница ${Math.floor(cursor/5) + 1} из ${Math.ceil(alliance_coin_counter/5)}`;
        
        const allicoin_bt: any = await context.question(event_logger, {	
            keyboard: keyboard, 
            answerTimeLimit
        });
        
        if (allicoin_bt.isTimeout) { 
            return await context.send(`${ico_list['time'].ico} Время ожидания истекло!`); 
        }
        
        const config: any = {
            'scoopins_coin_edit': Scoopins_Coin_Edit,
            'scoopins_coin_config': Scoopins_Coin_Config,
            'scoopins_coin_next': Scoopins_Coin_Next,
            'scoopins_coin_back': Scoopins_Coin_Back,
            'scoopins_coin_return': Scoopins_Coin_Return,
        };
        
        if (allicoin_bt?.payload?.command in config) {
            const commandHandler = config[allicoin_bt.payload.command];
            const ans = await commandHandler(context, allicoin_bt.payload, alliance, user);
            cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor;
            allicoin_tr = ans.stop ? ans.stop : false;
        } else {
            await context.send(`${ico_list['help'].ico} Жмите только по кнопкам!`);
        }
    }
    
    await Keyboard_Index(context, `${ico_list['help'].ico} Конфигурация S-coins завершена!`);
}

async function Scoopins_Coin_Return(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor, stop: true };
    await context.send(`${ico_list['stop'].ico} Отмена меню управления конвертацией S-coins`, { 
        keyboard: button_alliance_return 
    });
    return res;
}

async function Scoopins_Coin_Edit(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    
    const alliance_coin = await prisma.allianceCoin.findFirst({ 
        where: { id: data.id_alliance_coin } 
    });
    
    if (!alliance_coin) {
        await context.send(`${ico_list['warn'].ico} Валюта не найдена!`);
        return res;
    }
    
    // Переключаем разрешение конвертации
    const newStatus = !alliance_coin.scoopins_converted;
    const update = await prisma.allianceCoin.update({
        where: { id: alliance_coin.id },
        data: { scoopins_converted: newStatus }
    });
    
    await context.send(
        `${ico_list['reconfig'].ico} Конвертация 🌕 S-coins в ${alliance_coin.smile} ${alliance_coin.name} ` +
        `${newStatus ? 'разрешена ✅' : 'запрещена ⛔'}`
    );
    
    await Logger(`Изменена конвертация S-coins для ${alliance_coin.name}: ${newStatus} by ${user.idvk}`);
    await Send_Message(chat_id, 
        `${ico_list['reconfig'].ico} Изменение конвертации S-coins\n` +
        `${alliance_coin.smile} ${alliance_coin.name}\n` +
        `Конвертация: ${newStatus ? '✅' : '⛔'}\n` +
        `${ico_list['person'].ico} @id${user.idvk}(${user.name})\n` +
        `${ico_list['alliance'].ico} ${alliance.name}`
    );
    
    return res;
}

async function Scoopins_Coin_Config(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    
    const alliance_coin = await prisma.allianceCoin.findFirst({ 
        where: { id: data.id_alliance_coin } 
    });
    
    if (!alliance_coin) {
        await context.send(`${ico_list['warn'].ico} Валюта не найдена!`);
        return res;
    }
    
    let config_complete = false;
    const new_course = {
        course_scoopins_medal: alliance_coin.course_scoopins_medal,
        course_scoopins_coin: alliance_coin.course_scoopins_coin
    };
    
    // Настройка курса: сколько S-coins за 1 единицу валюты
    while (!config_complete) {
        const response = await context.question(
            `${ico_list['attach'].ico} Настройка курса для ${alliance_coin.smile} ${alliance_coin.name}:\n\n` +
            `Текущий курс: ${alliance_coin.course_scoopins_medal}🌕 → ${alliance_coin.course_scoopins_coin}${alliance_coin.smile}\n\n` +
            `Введите, сколько 🌕 S-coins нужно для получения 1${alliance_coin.smile}:`,
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
            await context.send(`${ico_list['stop'].ico} Отмена настройки курса`);
            return res;
        }
        
        const input = parseInt(response.text);
        if (!isNaN(input) && input > 0 && input <= 10000) {
            new_course.course_scoopins_medal = input;
            config_complete = true;
        } else {
            await context.send(`${ico_list['help'].ico} Введите число от 1 до 10000!`);
        }
    }
    
    config_complete = false;
    
    // Настройка курса: сколько единиц валюты за 1 S-coin
    while (!config_complete) {
        const response = await context.question(
            `Введите, сколько ${alliance_coin.smile} получится из 1🌕 S-coin:\n` +
            `(рекомендуется: ${Math.floor(1 / new_course.course_scoopins_medal * 100) / 100})`,
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
            await context.send(`${ico_list['stop'].ico} Отмена настройки курса`);
            return res;
        }
        
        const input = parseFloat(response.text);
        if (!isNaN(input) && input > 0 && input <= 1000) {
            new_course.course_scoopins_coin = input;
            config_complete = true;
        } else {
            await context.send(`${ico_list['help'].ico} Введите число от 0.01 до 1000!`);
        }
    }
    
    const confirm = await Confirm_User_Success(
        context, 
        `установить курс: ${new_course.course_scoopins_medal}🌕 → ${new_course.course_scoopins_coin}${alliance_coin.smile}?`
    );
    
    if (confirm.status) {
        const update = await prisma.allianceCoin.update({
            where: { id: alliance_coin.id },
            data: {
                course_scoopins_medal: new_course.course_scoopins_medal,
                course_scoopins_coin: new_course.course_scoopins_coin
            }
        });
        
        await context.send(
            `${ico_list['reconfig'].ico} Курс обновлен!\n` +
            `${new_course.course_scoopins_medal}🌕 → ${new_course.course_scoopins_coin}${alliance_coin.smile}`
        );
        
        await Logger(`Обновлен курс S-coins для ${alliance_coin.name} by ${user.idvk}`);
        await Send_Message(chat_id,
            `${ico_list['reconfig'].ico} Обновление курса S-coins\n` +
            `${alliance_coin.smile} ${alliance_coin.name}\n` +
            `Курс: ${new_course.course_scoopins_medal}🌕 → ${new_course.course_scoopins_coin}${alliance_coin.smile}\n` +
            `${ico_list['person'].ico} @id${user.idvk}(${user.name})\n` +
            `${ico_list['alliance'].ico} ${alliance.name}`
        );
    } else {
        await context.send(`${ico_list['stop'].ico} Изменения отменены`);
    }
    
    return res;
}

async function Scoopins_Coin_Next(context: any, data: any, alliance: Alliance, user: User) {
    return { cursor: data.cursor + 5 };
}

async function Scoopins_Coin_Back(context: any, data: any, alliance: Alliance, user: User) {
    return { cursor: data.cursor - 5 };
}