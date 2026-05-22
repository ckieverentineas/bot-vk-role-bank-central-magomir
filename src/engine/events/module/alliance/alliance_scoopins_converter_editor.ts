import { Alliance, AllianceCoin, User } from "@prisma/client";
import prisma from "./../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id, timer_text } from "../../../..";
import { Confirm_User_Success, Keyboard_Index, Logger, Send_Message, Send_Message_Question } from "./../../../core/helper";
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
            event_logger += `${ico_list['money'].ico} Доступные валюты:\n`;
            
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
        `${ico_list['person'].ico} @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
        `${ico_list['alliance'].ico} ${alliance.name}`
    );
    
    return res;
}

async function Scoopins_Coin_Config(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };

    while (true) {
        const alliance_coin = await prisma.allianceCoin.findFirst({
            where: { id: data.id_alliance_coin, id_alliance: alliance.id }
        });

        if (!alliance_coin) {
            await context.send(`${ico_list['warn'].ico} Валюта не найдена!`);
            return res;
        }

        const keyboard = new KeyboardBuilder()
            .textButton({ label: '🌕 Списывать', payload: { command: 'scoopins_course_medal', cursor: data.cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' })
            .textButton({ label: `${alliance_coin.smile} Начислять`, payload: { command: 'scoopins_course_coin', cursor: data.cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' }).row();

        const text =
            `${ico_list['attach'].ico} Настройка курса S-coins\n\n` +
            `${alliance_coin.smile} ${alliance_coin.name}\n` +
            `Текущий курс: ${alliance_coin.course_scoopins_medal}🌕 → ${alliance_coin.course_scoopins_coin}${alliance_coin.smile}\n\n` +
            `Выберите, какую сторону курса изменить:`;

        const answer = await Send_Message_Question(context, text, keyboard);
        if (answer.exit) { return res; }

        const config: any = {
            'scoopins_course_medal': Scoopins_Coin_Config_Medal,
            'scoopins_course_coin': Scoopins_Coin_Config_Coin
        };

        if (answer.payload?.command in config) {
            await config[answer.payload.command](context, answer.payload, alliance, user);
        }

    }
}

async function Ask_Scoopins_Course_Integer(context: any, message: string, maxValue: number): Promise<number | null> {
    while (true) {
        const response = await context.question(message, {
            keyboard: Keyboard.builder()
                .textButton({ label: `${ico_list['stop'].ico} Отмена`, payload: { command: 'cancel' }, color: 'secondary' })
                .oneTime().inline(),
            ...timer_text
        });

        if (response.isTimeout) {
            await context.send(`${ico_list['time'].ico} Время истекло!`);
            return null;
        }

        if (response.text === `${ico_list['stop'].ico} Отмена`) {
            await context.send(`${ico_list['stop'].ico} Отмена настройки курса`);
            return null;
        }

        const input = Number(String(response.text ?? '').trim());

        if (Number.isInteger(input) && input > 0 && input <= maxValue) {
            return input;
        }

        await context.send(`${ico_list['help'].ico} Введите целое число от 1 до ${maxValue}!`);
    }
}

async function Notify_Scoopins_Course_Update(context: any, alliance: Alliance, user: User, coinBefore: AllianceCoin, coinAfter: AllianceCoin, changes: string) {
    await context.send(
        `${ico_list['reconfig'].ico} Курс S-coins обновлен!\n` +
        `${changes}\n` +
        `Текущий курс: ${coinAfter.course_scoopins_medal}🌕 → ${coinAfter.course_scoopins_coin}${coinAfter.smile}`
    );
    await Logger(`Обновлен курс S-coins для ${coinAfter.name} by ${user.idvk}`);
    await Send_Message(chat_id,
        `${ico_list['reconfig'].ico} Обновление курса S-coins\n` +
        `${coinBefore.smile} ${coinBefore.name}\n` +
        `${changes}\n` +
        `Курс: ${coinAfter.course_scoopins_medal}🌕 → ${coinAfter.course_scoopins_coin}${coinAfter.smile}\n` +
        `${ico_list['person'].ico} @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
        `${ico_list['alliance'].ico} ${alliance.name}`
    );
}

async function Scoopins_Coin_Config_Medal(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    const alliance_coin = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } });
    if (!alliance_coin) { return res; }

    const value = await Ask_Scoopins_Course_Integer(
        context,
        `${ico_list['attach'].ico} Сколько 🌕 S-coins списывать за обмен?\n\n` +
        `Текущий курс: ${alliance_coin.course_scoopins_medal}🌕 → ${alliance_coin.course_scoopins_coin}${alliance_coin.smile}`,
        10000
    );
    if (value === null) { return res; }

    const confirm = await Confirm_User_Success(
        context,
        `установить списание ${value}🌕 для курса ${alliance_coin.smile} ${alliance_coin.name}?`
    );
    await context.send(`${confirm.text}`);

    if (confirm.status) {
        const updated = await prisma.allianceCoin.update({
            where: { id: alliance_coin.id },
            data: { course_scoopins_medal: value }
        });
        await Notify_Scoopins_Course_Update(context, alliance, user, alliance_coin, updated, `Списывать: ${alliance_coin.course_scoopins_medal}🌕 --> ${updated.course_scoopins_medal}🌕`);
    }

    return res;
}

async function Scoopins_Coin_Config_Coin(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    const alliance_coin = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } });
    if (!alliance_coin) { return res; }

    const value = await Ask_Scoopins_Course_Integer(
        context,
        `${ico_list['attach'].ico} Сколько ${alliance_coin.smile} ${alliance_coin.name} начислять за обмен?\n\n` +
        `Текущий курс: ${alliance_coin.course_scoopins_medal}🌕 → ${alliance_coin.course_scoopins_coin}${alliance_coin.smile}`,
        10000
    );
    if (value === null) { return res; }

    const confirm = await Confirm_User_Success(
        context,
        `установить начисление ${value}${alliance_coin.smile} для курса S-coins?`
    );
    await context.send(`${confirm.text}`);

    if (confirm.status) {
        const updated = await prisma.allianceCoin.update({
            where: { id: alliance_coin.id },
            data: { course_scoopins_coin: value }
        });
        await Notify_Scoopins_Course_Update(context, alliance, user, alliance_coin, updated, `Начислять: ${alliance_coin.course_scoopins_coin}${alliance_coin.smile} --> ${updated.course_scoopins_coin}${updated.smile}`);
    }

    return res;
}

async function Scoopins_Coin_Next(context: any, data: any, alliance: Alliance, user: User) {
    return { cursor: data.cursor + 5 };
}

async function Scoopins_Coin_Back(context: any, data: any, alliance: Alliance, user: User) {
    return { cursor: data.cursor - 5 };
}
