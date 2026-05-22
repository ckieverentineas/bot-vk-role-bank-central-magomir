import { Alliance, AllianceCoin, BalanceCoin, User } from "@prisma/client";
import prisma from "../prisma_client";
import { Person_Get } from "../person/person";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id, timer_text, timer_text_oper } from "../../../..";
import { Confirm_User_Success, Format_Number_Correction, Keyboard_Index, Logger, Select_Alliance_Coin, Send_Message, Send_Message_Question } from "../../../core/helper";
import { button_alliance_return } from "../data_center/standart";
import { ico_list } from "../data_center/icons_lib";
import { getTerminology } from "../alliance/terminology_helper"

type InternalConversionWithCoins = {
    id: number;
    enabled: boolean;
    course_source: number;
    course_target: number;
    id_alliance: number;
    id_source_coin: number;
    id_target_coin: number;
    sourceCoin: AllianceCoin;
    targetCoin: AllianceCoin;
};

type InternalConversionCourse = {
    course_source: number;
    course_target: number;
};

type FacultRatingOperation = 'increment' | 'decrement';

type FacultRatingChange = {
    line: string;
};

const INTERNAL_CONVERSION_BATCH_SIZE = 5;
const CONVERTER_MENU_INTERNAL_BATCH_SIZE = 5;
const MAX_INTERNAL_COURSE_VALUE = 1000000;

async function Send_Finance_Log(allianceChatId: number | null | undefined, message: string) {
    if (allianceChatId && allianceChatId > 0) {
        const sentToAllianceChat = await Send_Message(allianceChatId, message);
        if (sentToAllianceChat) {
            return;
        }
    }

    await Send_Message(chat_id, message);
}

function Format_Facult_Rating_Block(changes: FacultRatingChange[]) {
    if (changes.length === 0) {
        return '';
    }

    return `\n\n📊 Факультетские рейтинги:\n${changes.map((change) => change.line).join('\n')}`;
}

function Format_Switch_Status(value: boolean | null | undefined) {
    return value ? '✅' : '⛔';
}

async function Apply_Facult_Rating_Change(
    alliance: Alliance,
    user: User,
    coin: AllianceCoin,
    amount: number,
    operation: FacultRatingOperation
): Promise<FacultRatingChange | null> {
    if (!user.id_facult) {
        return null;
    }

    const facult = await prisma.allianceFacult.findFirst({
        where: {
            id: user.id_facult,
            id_alliance: alliance.id
        }
    });

    if (!facult) {
        return null;
    }

    let facultBalance = await prisma.balanceFacult.findFirst({
        where: {
            id_coin: coin.id,
            id_facult: user.id_facult
        }
    });

    const shouldIncrementRating = operation === 'increment' && coin.point && coin.converted_point;
    const shouldDecrementRating = operation === 'decrement' && Boolean(facultBalance);

    if (!shouldIncrementRating && !shouldDecrementRating) {
        return null;
    }

    if (!facultBalance) {
        facultBalance = await prisma.balanceFacult.create({
            data: {
                id_coin: coin.id,
                id_facult: user.id_facult,
                amount: 0
            }
        });
    }

    const updatedFacult = operation === 'increment'
        ? await prisma.balanceFacult.update({
            where: { id: facultBalance.id },
            data: { amount: { increment: amount } }
        })
        : await prisma.balanceFacult.update({
            where: { id: facultBalance.id },
            data: { amount: { decrement: amount } }
        });

    const sign = operation === 'increment' ? '+' : '-';

    return {
        line: `${facult.smile} ${facult.name} [${coin.smile} ${coin.name}]: ` +
            `${Format_Currency_Amount(facultBalance.amount)} ${sign} ${Format_Currency_Amount(amount)} = ${Format_Currency_Amount(updatedFacult.amount)}`
    };
}

// Контроллер управления валютами альянса
// В alliance_converter.ts исправьте функцию Alliance_Coin_Get:
async function Alliance_Coin_Get(cursor: number, alliance: Alliance) {
    const batchSize = 5;
    
    // Вместо ручного подсчета используем Prisma с skip/take
    return await prisma.allianceCoin.findMany({
        where: { id_alliance: alliance.id },
        orderBy: { order: 'asc' },
        skip: cursor,
        take: batchSize
    });
}

async function Internal_Conversion_Get(
    allianceId: number,
    cursor: number,
    onlyEnabled = false,
    take?: number
): Promise<InternalConversionWithCoins[]> {
    return await prisma.allianceCoinInternalConversion.findMany({
        where: {
            id_alliance: allianceId,
            ...(onlyEnabled ? { enabled: true } : {})
        },
        include: {
            sourceCoin: true,
            targetCoin: true
        },
        orderBy: { id: 'asc' },
        skip: cursor,
        ...(take ? { take } : {})
    });
}

async function Internal_Conversion_Find(
    id: number,
    allianceId: number
): Promise<InternalConversionWithCoins | null> {
    return await prisma.allianceCoinInternalConversion.findFirst({
        where: {
            id,
            id_alliance: allianceId
        },
        include: {
            sourceCoin: true,
            targetCoin: true
        }
    });
}

async function Balance_Coin_Get_Or_Create(userId: number, coinId: number): Promise<BalanceCoin> {
    const balance = await prisma.balanceCoin.findFirst({
        where: {
            id_user: userId,
            id_coin: coinId
        }
    });

    if (balance) {
        return balance;
    }

    return await prisma.balanceCoin.create({
        data: {
            id_user: userId,
            id_coin: coinId,
            amount: 0
        }
    });
}

function Parse_Positive_Amount(text: string): number | null {
    const value = Number(text.replace(',', '.'));

    if (!Number.isFinite(value) || value <= 0) {
        return null;
    }

    return Math.round(value * 1000) / 1000;
}

async function Ask_Positive_Integer(context: any, message: string, maxValue: number): Promise<number | null> {
    while (true) {
        const answer = await context.question(message, {
            keyboard: Keyboard.builder()
                .textButton({ label: `${ico_list['stop'].ico} Отмена`, payload: { command: 'cancel' }, color: 'secondary' })
                .oneTime().inline(),
            ...timer_text
        });

        if (answer.isTimeout) {
            await context.send(`${ico_list['time'].ico} Время истекло!`);
            return null;
        }

        if (answer.text === `${ico_list['stop'].ico} Отмена`) {
            await context.send(`${ico_list['stop'].ico} Настройка отменена`);
            return null;
        }

        const input = Number(String(answer.text ?? '').trim());

        if (Number.isInteger(input) && input > 0 && input <= maxValue) {
            return input;
        }

        await context.send(`${ico_list['help'].ico} Введите целое число от 1 до ${maxValue}.`);
    }
}

function Calculate_Internal_Conversion(amount: number, courseSource: number, courseTarget: number): number {
    return Math.round((amount / courseSource * courseTarget) * 1000) / 1000;
}

function Format_Currency_Amount(amount: number): number | string {
    return Format_Number_Correction(amount);
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

    let cursor = 0;

    while (true) {
        const internalConversions = await Internal_Conversion_Get(
            alliance.id,
            cursor,
            true,
            CONVERTER_MENU_INTERNAL_BATCH_SIZE
        );
        const internalConversionCount = await prisma.allianceCoinInternalConversion.count({
            where: {
                id_alliance: alliance.id,
                enabled: true
            }
        });

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
            }).row();

        for (const conversion of internalConversions) {
            keyboard.textButton({
                label: `${conversion.sourceCoin.smile} ${conversion.sourceCoin.name.slice(0,12)} → ${conversion.targetCoin.smile} ${conversion.targetCoin.name.slice(0,12)}`,
                payload: {
                    command: 'select_converter_type',
                    type: 'internal',
                    id_internal_conversion: conversion.id
                },
                color: 'secondary'
            }).row();
        }

        if (cursor >= CONVERTER_MENU_INTERNAL_BATCH_SIZE) {
            keyboard.textButton({
                label: `${ico_list['back'].ico}`,
                payload: {
                    command: 'converter_page_back',
                    cursor: Math.max(0, cursor - CONVERTER_MENU_INTERNAL_BATCH_SIZE)
                },
                color: 'secondary'
            });
        }

        if (cursor + CONVERTER_MENU_INTERNAL_BATCH_SIZE < internalConversionCount) {
            keyboard.textButton({
                label: `${ico_list['next'].ico}`,
                payload: {
                    command: 'converter_page_next',
                    cursor: cursor + CONVERTER_MENU_INTERNAL_BATCH_SIZE
                },
                color: 'secondary'
            });
        }

        if (internalConversionCount > CONVERTER_MENU_INTERNAL_BATCH_SIZE) {
            keyboard.row();
        }

        keyboard.textButton({
            label: `${ico_list['stop'].ico}`,
            payload: { command: 'converter_cancel' },
            color: 'secondary'
        }).oneTime();

        let eventLogger = `${ico_list['converter'].ico} Выберите тип конвертации:\n\n`;
        eventLogger += `🔘 Конвертация жетонов\n`;
        eventLogger += `🌕 Конвертация S-coins\n`;

        if (internalConversions.length > 0) {
            const pageInfo = internalConversionCount > CONVERTER_MENU_INTERNAL_BATCH_SIZE
                ? `: страница ${Math.floor(cursor / CONVERTER_MENU_INTERNAL_BATCH_SIZE) + 1} из ${Math.ceil(internalConversionCount / CONVERTER_MENU_INTERNAL_BATCH_SIZE)}`
                : '';

            eventLogger += `\nМестные варианты${pageInfo}:\n`;

            for (const conversion of internalConversions) {
                eventLogger += `• ${conversion.sourceCoin.smile} ${conversion.sourceCoin.name} → ${conversion.targetCoin.smile} ${conversion.targetCoin.name}\n`;
                eventLogger += `  Курс: ${Format_Currency_Amount(conversion.course_source)}${conversion.sourceCoin.smile} → ${Format_Currency_Amount(conversion.course_target)}${conversion.targetCoin.smile}\n`;
            }
        }

        const typeSelect = await context.question(
            eventLogger,
            { keyboard, answerTimeLimit }
        );

        if (typeSelect.isTimeout) {
            await context.send(`⏰ Время ожидания истекло!`);
            await context.send(`${ico_list['help'].ico} Возврат к основным командам.`, { keyboard: button_alliance_return });
            return;
        }

        const command = typeSelect.payload?.command;

        if (command === 'converter_page_next' || command === 'converter_page_back') {
            cursor = Number(typeSelect.payload?.cursor ?? 0);
            continue;
        }

        if (command === 'converter_cancel') {
            await context.send(`❌ Конвертация отменена`);
            await context.send(`${ico_list['help'].ico} Возврат к основным командам.`, { keyboard: button_alliance_return });
            return;
        }

        const converterType = typeSelect.payload?.type;

        if (converterType === 'medal') {
            await Medal_Converter_Flow(context, user, alliance);
        } else if (converterType === 'scoopins') {
            await Scoopins_Converter_Flow(context, user, alliance);
        } else if (converterType === 'internal') {
            await Internal_Converter_Edit(
                context,
                { id_internal_conversion: Number(typeSelect.payload?.id_internal_conversion), cursor: 0 },
                alliance
            );
        } else {
            await context.send(`${ico_list['help'].ico} Выберите вариант конвертации кнопкой.`);
            continue;
        }

        await context.send(`${ico_list['help'].ico} Конвертация завершена.`, { keyboard: button_alliance_return });
        return;
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

    while (true) {
        const alliance_coin = await prisma.allianceCoin.findFirst({
            where: { id: data.id_alliance_coin, id_alliance: alliance.id }
        });

        if (!alliance_coin) {
            await context.send(`Валюта не найдена`);
            return res;
        }

        const keyboard = new KeyboardBuilder()
            .textButton({ label: '🔘 Списывать', payload: { command: 'coin_course_medal', cursor: data.cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' })
            .textButton({ label: `${alliance_coin.smile} Начислять`, payload: { command: 'coin_course_coin', cursor: data.cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' }).row();

        const text =
            `${ico_list['attach'].ico} Настройка курса конвертации жетонов\n\n` +
            `${alliance_coin.smile} ${alliance_coin.name}\n` +
            `Текущий курс: ${alliance_coin.course_medal}🔘 → ${alliance_coin.course_coin}${alliance_coin.smile}\n\n` +
            `Выберите, какую сторону курса изменить:`;

        const answer = await Send_Message_Question(context, text, keyboard);
        if (answer.exit) { return res; }

        const config: any = {
            'coin_course_medal': Alliance_Coin_Edit_Course_Medal,
            'coin_course_coin': Alliance_Coin_Edit_Course_Coin
        };

        if (answer.payload?.command in config) {
            await config[answer.payload.command](context, answer.payload, alliance, user);
        }
    }
}

async function Notify_Medal_Course_Update(context: any, alliance: Alliance, user: User, coinBefore: AllianceCoin, coinAfter: AllianceCoin, changes: string) {
    await context.send(
        `${ico_list['reconfig'].ico} Курс конвертации жетонов обновлен!\n\n` +
        `${coinAfter.smile} ${coinAfter.name}\n` +
        `${changes}\n` +
        `Текущий курс: ${coinAfter.course_medal}🔘 → ${coinAfter.course_coin}${coinAfter.smile}`
    );
    await Logger(`Настройка курса жетонов: ${coinAfter.name} ${coinAfter.course_medal}🔘 → ${coinAfter.course_coin}${coinAfter.smile} by ${user.idvk}`);
    await Send_Message(chat_id,
        `${ico_list['reconfig'].ico} Настройка курса конвертации жетонов\n` +
        `${coinBefore.smile} ${coinBefore.name}\n` +
        `${changes}\n` +
        `Курс: ${coinAfter.course_medal}🔘 → ${coinAfter.course_coin}${coinAfter.smile}\n` +
        `${ico_list['person'].ico} @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
        `${ico_list['alliance'].ico} ${alliance.name}`
    );
}

async function Alliance_Coin_Edit_Course_Medal(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    const coin = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } });
    if (!coin) { return res; }

    const value = await Ask_Positive_Integer(
        context,
        `${ico_list['attach'].ico} Сколько 🔘 жетонов списывать за обмен?\n\n` +
        `Текущий курс: ${coin.course_medal}🔘 → ${coin.course_coin}${coin.smile}`,
        10000
    );
    if (value === null) { return res; }

    const updated = await prisma.allianceCoin.update({ where: { id: coin.id }, data: { course_medal: value } });
    await Notify_Medal_Course_Update(context, alliance, user, coin, updated, `Списывать: ${coin.course_medal}🔘 --> ${updated.course_medal}🔘`);
    return res;
}

async function Alliance_Coin_Edit_Course_Coin(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    const coin = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } });
    if (!coin) { return res; }

    const value = await Ask_Positive_Integer(
        context,
        `${ico_list['attach'].ico} Сколько ${coin.smile} ${coin.name} начислять за обмен?\n\n` +
        `Текущий курс: ${coin.course_medal}🔘 → ${coin.course_coin}${coin.smile}`,
        10000
    );
    if (value === null) { return res; }

    const updated = await prisma.allianceCoin.update({ where: { id: coin.id }, data: { course_coin: value } });
    await Notify_Medal_Course_Update(context, alliance, user, coin, updated, `Начислять: ${coin.course_coin}${coin.smile} --> ${updated.course_coin}${updated.smile}`);
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

async function Internal_Converter_Edit(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor ?? 0 };
    const user = await Person_Get(context);

    if (!user) {
        return res;
    }

    const conversion = await Internal_Conversion_Find(Number(data.id_internal_conversion), alliance.id);

    if (!conversion || !conversion.enabled) {
        await context.send(`${ico_list['warn'].ico} Внутренняя конвертация не найдена или отключена.`);
        return res;
    }

    const sourceBalance = await Balance_Coin_Get_Or_Create(user.id, conversion.sourceCoin.id);
    const targetBalance = await Balance_Coin_Get_Or_Create(user.id, conversion.targetCoin.id);

    if (sourceBalance.amount <= 0) {
        await context.send(
            `${ico_list['warn'].ico} На балансе нет ${conversion.sourceCoin.smile} ${conversion.sourceCoin.name} для конвертации.`
        );
        return res;
    }

    let money_check = false;
    let sourceAmount = Math.round(sourceBalance.amount * 1000) / 1000;
    let targetAmount = Calculate_Internal_Conversion(sourceAmount, conversion.course_source, conversion.course_target);

    while (!money_check) {
        targetAmount = Calculate_Internal_Conversion(sourceAmount, conversion.course_source, conversion.course_target);

        const answer: any = await context.question(
            `${ico_list['converter'].ico} Внутренняя конвертация:\n\n` +
            `Ваш баланс: ${Format_Currency_Amount(sourceBalance.amount)}${conversion.sourceCoin.smile}\n` +
            `Курс: ${Format_Currency_Amount(conversion.course_source)}${conversion.sourceCoin.smile} → ${Format_Currency_Amount(conversion.course_target)}${conversion.targetCoin.smile}\n` +
            `Будет сконвертировано: ${Format_Currency_Amount(sourceAmount)}${conversion.sourceCoin.smile} → ${Format_Currency_Amount(targetAmount)}${conversion.targetCoin.smile}\n\n` +
            `Введите количество ${conversion.sourceCoin.smile} ${conversion.sourceCoin.name} для конвертации:`,
            {
                keyboard: Keyboard.builder()
                    .textButton({ label: '!подтвердить', payload: { command: 'confirm' }, color: 'secondary' })
                    .textButton({ label: '!отмена', payload: { command: 'cancel' }, color: 'secondary' })
                    .oneTime().inline(),
                timer_text_oper
            }
        );

        if (answer.isTimeout) {
            await context.send(`${ico_list['time'].ico} Время ожидания истекло!`);
            return res;
        }

        if (answer.text === '!подтвердить') {
            if (targetAmount <= 0) {
                await context.send(`${ico_list['warn'].ico} По этому курсу получится 0${conversion.targetCoin.smile}. Введите большее количество.`);
                continue;
            }

            money_check = true;
            continue;
        }

        if (answer.text === '!отмена') {
            return res;
        }

        const input = Parse_Positive_Amount(String(answer.text ?? ''));

        if (input === null) {
            await context.send(`${ico_list['warn'].ico} Введите положительное число.`);
            continue;
        }

        if (input > sourceBalance.amount) {
            await context.send(
                `${ico_list['warn'].ico} Недостаточно ${conversion.sourceCoin.smile} ${conversion.sourceCoin.name}. Максимум: ${Format_Currency_Amount(sourceBalance.amount)}${conversion.sourceCoin.smile}`
            );
            continue;
        }

        sourceAmount = input;
    }

    const confirm = await Confirm_User_Success(
        context,
        `сконвертировать ${Format_Currency_Amount(sourceAmount)}${conversion.sourceCoin.smile} ${conversion.sourceCoin.name} ` +
        `в ${Format_Currency_Amount(targetAmount)}${conversion.targetCoin.smile} ${conversion.targetCoin.name}?`
    );

    await context.send(`${confirm.text}`);

    if (!confirm.status) {
        return res;
    }

    const operationSourceBalance = await Balance_Coin_Get_Or_Create(user.id, conversion.sourceCoin.id);

    if (operationSourceBalance.amount < sourceAmount) {
        await context.send(
            `${ico_list['warn'].ico} Баланс ${conversion.sourceCoin.smile} ${conversion.sourceCoin.name} изменился. ` +
            `Сейчас доступно ${Format_Currency_Amount(operationSourceBalance.amount)}${conversion.sourceCoin.smile}.`
        );
        return res;
    }

    const operationTargetBalance = await Balance_Coin_Get_Or_Create(user.id, conversion.targetCoin.id);

    const [sourceUpdate, targetUpdate] = await prisma.$transaction([
        prisma.balanceCoin.update({
            where: { id: operationSourceBalance.id },
            data: { amount: { decrement: sourceAmount } }
        }),
        prisma.balanceCoin.update({
            where: { id: operationTargetBalance.id },
            data: { amount: { increment: targetAmount } }
        })
    ]);

    const facultyChanges = [
        await Apply_Facult_Rating_Change(alliance, user, conversion.sourceCoin, sourceAmount, 'decrement'),
        await Apply_Facult_Rating_Change(alliance, user, conversion.targetCoin, targetAmount, 'increment')
    ].filter((change): change is FacultRatingChange => change !== null);
    const facultyBlock = Format_Facult_Rating_Block(facultyChanges);

    const userMessage =
        `${ico_list['success'].ico} Конвертация успешна!\n\n` +
        `${conversion.sourceCoin.smile} ${conversion.sourceCoin.name}: ${Format_Currency_Amount(operationSourceBalance.amount)} - ${Format_Currency_Amount(sourceAmount)} = ${Format_Currency_Amount(sourceUpdate.amount)}\n` +
        `${conversion.targetCoin.smile} ${conversion.targetCoin.name}: ${Format_Currency_Amount(operationTargetBalance.amount)} + ${Format_Currency_Amount(targetAmount)} = ${Format_Currency_Amount(targetUpdate.amount)}` +
        facultyBlock;

    await Logger(
        `Внутренняя конвертация: ${conversion.sourceCoin.name} ${operationSourceBalance.amount} - ${sourceAmount} = ${sourceUpdate.amount}, ` +
        `${conversion.targetCoin.name} ${operationTargetBalance.amount} + ${targetAmount} = ${targetUpdate.amount}` +
        `${facultyChanges.length > 0 ? `, факультет: ${facultyChanges.map((change) => change.line).join('; ')}` : ''} by player ${context.senderId}`
    );
    await context.send(userMessage);

    const chatMessage =
        `⌛ @id${user.idvk}(${user.name}) (UID: ${user.id}) конвертирует ${Format_Currency_Amount(sourceAmount)} [${conversion.sourceCoin.smile} ${conversion.sourceCoin.name}] ` +
        `в ${Format_Currency_Amount(targetAmount)} [${conversion.targetCoin.smile} ${conversion.targetCoin.name}].\n\n` +
        `${conversion.sourceCoin.smile} --> ${Format_Currency_Amount(operationSourceBalance.amount)} - ${Format_Currency_Amount(sourceAmount)} = ${Format_Currency_Amount(sourceUpdate.amount)}\n` +
        `${conversion.targetCoin.smile} --> ${Format_Currency_Amount(operationTargetBalance.amount)} + ${Format_Currency_Amount(targetAmount)} = ${Format_Currency_Amount(targetUpdate.amount)}` +
        facultyBlock;

    await Send_Finance_Log(alliance.id_chat, chatMessage);

    return res;
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
        let event_logger = `${ico_list['converter'].ico} Настройка конвертации жетонов для валют ${alliance.name}:\n\n`
        
        for await (const alliance_coin of await Alliance_Coin_Get(cursor, alliance!)) {
            keyboard.textButton({ 
                label: `${ico_list['edit'].ico} ${alliance_coin.id}-${alliance_coin.name.slice(0,30)}`, 
                payload: { 
                    command: 'alliance_coin_edit_course',
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

export async function Alliance_Internal_Converter_Editor_Printer(context: any) {
    const user = await Person_Get(context);
    const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } });

    if (!alliance || !user) {
        return;
    }

    const coinCount = await prisma.allianceCoin.count({ where: { id_alliance: alliance.id } });

    if (coinCount < 2) {
        await context.send(`${ico_list['warn'].ico} Для внутренней конвертации нужно минимум две ролевые валюты.`);
        return;
    }

    let internalConversionStop = false;
    let cursor = 0;

    while (!internalConversionStop) {
        const keyboard = new KeyboardBuilder();
        const conversions = await Internal_Conversion_Get(alliance.id, cursor, false, INTERNAL_CONVERSION_BATCH_SIZE);
        const conversionCount = await prisma.allianceCoinInternalConversion.count({
            where: { id_alliance: alliance.id }
        });

        let event_logger = `${ico_list['converter'].ico} Настройка внутренней конвертации валют ${alliance.name}:\n\n`;

        if (conversions.length === 0) {
            event_logger += `${ico_list['warn'].ico} Внутренние курсы пока не настроены.\n\n`;
        }

        for (const conversion of conversions) {
            keyboard.textButton({
                label: `${ico_list['edit'].ico} ${conversion.id}: ${conversion.sourceCoin.smile}→${conversion.targetCoin.smile}`,
                payload: {
                    command: 'internal_conversion_edit_course',
                    cursor,
                    id_internal_conversion: conversion.id
                },
                color: 'secondary'
            })
            .textButton({
                label: conversion.enabled ? `${ico_list['success'].ico}` : `${ico_list['delete'].ico}`,
                payload: {
                    command: 'internal_conversion_config',
                    cursor,
                    id_internal_conversion: conversion.id
                },
                color: conversion.enabled ? 'positive' : 'negative'
            })
            .textButton({
                label: `${ico_list['delete'].ico}`,
                payload: {
                    command: 'internal_conversion_delete',
                    cursor,
                    id_internal_conversion: conversion.id
                },
                color: 'negative'
            }).row();

            event_logger += `${conversion.enabled ? '✅' : '⛔'} id${conversion.id}: `;
            event_logger += `${conversion.sourceCoin.smile} ${conversion.sourceCoin.name} → ${conversion.targetCoin.smile} ${conversion.targetCoin.name}\n`;
            event_logger += `⚖ Курс: ${Format_Currency_Amount(conversion.course_source)}${conversion.sourceCoin.smile} → ${Format_Currency_Amount(conversion.course_target)}${conversion.targetCoin.smile}\n\n`;
        }

        keyboard.textButton({
            label: `${ico_list['add'].ico} Добавить`,
            payload: { command: 'internal_conversion_add', cursor },
            color: 'positive'
        }).row();

        if (cursor >= INTERNAL_CONVERSION_BATCH_SIZE) {
            keyboard.textButton({
                label: `${ico_list['back'].ico}`,
                payload: { command: 'internal_conversion_back', cursor },
                color: 'secondary'
            });
        }

        if (cursor + INTERNAL_CONVERSION_BATCH_SIZE < conversionCount) {
            keyboard.textButton({
                label: `${ico_list['next'].ico}`,
                payload: { command: 'internal_conversion_next', cursor },
                color: 'secondary'
            });
        }

        keyboard.textButton({
            label: `${ico_list['stop'].ico}`,
            payload: { command: 'internal_conversion_return', cursor },
            color: 'secondary'
        }).oneTime();

        event_logger += `\n Страница ${Math.floor(cursor / INTERNAL_CONVERSION_BATCH_SIZE) + 1} из ${Math.max(1, Math.ceil(conversionCount / INTERNAL_CONVERSION_BATCH_SIZE))}`;

        const answer: any = await context.question(event_logger, {
            keyboard,
            answerTimeLimit
        });

        if (answer.isTimeout) {
            return await context.send(`${ico_list['time'].ico} Время ожидания истекло!`);
        }

        const config: Record<string, (ctx: any, data: any, currentAlliance: Alliance, currentUser: User) => Promise<{ cursor: number; stop?: boolean }>> = {
            'internal_conversion_add': Internal_Conversion_Add,
            'internal_conversion_edit_course': Internal_Conversion_Edit_Course,
            'internal_conversion_config': Internal_Conversion_Config,
            'internal_conversion_delete': Internal_Conversion_Delete,
            'internal_conversion_next': Internal_Conversion_Next,
            'internal_conversion_back': Internal_Conversion_Back,
            'internal_conversion_return': Internal_Conversion_Return,
        };

        if (answer?.payload?.command in config) {
            const ans = await config[answer.payload.command](context, answer.payload, alliance, user);
            cursor = ans?.cursor || ans?.cursor === 0 ? ans.cursor : cursor;
            internalConversionStop = ans.stop ? ans.stop : false;
        } else {
            await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`);
        }
    }

    await Keyboard_Index(context, `${ico_list['help'].ico} Настройка внутренней конвертации завершена!`);
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

async function Internal_Conversion_Next(context: any, data: any, alliance: Alliance, user: User) {
    return { cursor: data.cursor + INTERNAL_CONVERSION_BATCH_SIZE };
}

async function Internal_Conversion_Back(context: any, data: any, alliance: Alliance, user: User) {
    return { cursor: Math.max(0, data.cursor - INTERNAL_CONVERSION_BATCH_SIZE) };
}

async function Internal_Conversion_Return(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor, stop: true };

    await context.send(`${ico_list['stop'].ico} Отмена настройки внутренней конвертации`, {
        keyboard: button_alliance_return
    });

    return res;
}

async function Internal_Conversion_Add(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    const sourceCoinId = await Select_Alliance_Coin(context, alliance.id);

    if (!sourceCoinId) {
        return res;
    }

    let targetCoinId: number | null = null;

    while (!targetCoinId) {
        targetCoinId = await Select_Alliance_Coin(context, alliance.id);

        if (!targetCoinId) {
            return res;
        }

        if (targetCoinId === sourceCoinId) {
            await context.send(`${ico_list['warn'].ico} Валюта назначения должна отличаться от исходной.`);
            targetCoinId = null;
        }
    }

    const sourceCoin = await prisma.allianceCoin.findFirst({
        where: {
            id: sourceCoinId,
            id_alliance: alliance.id
        }
    });
    const targetCoin = await prisma.allianceCoin.findFirst({
        where: {
            id: targetCoinId,
            id_alliance: alliance.id
        }
    });

    if (!sourceCoin || !targetCoin) {
        await context.send(`${ico_list['warn'].ico} Валюта не найдена.`);
        return res;
    }

    const existing = await prisma.allianceCoinInternalConversion.findFirst({
        where: {
            id_alliance: alliance.id,
            id_source_coin: sourceCoin.id,
            id_target_coin: targetCoin.id
        }
    });
    const course = await Internal_Conversion_Ask_Course(context, sourceCoin, targetCoin, existing ?? undefined);

    if (!course) {
        return res;
    }

    const confirm = await Confirm_User_Success(
        context,
        `${existing ? 'обновить' : 'создать'} внутреннюю конвертацию:\n` +
        `${sourceCoin.smile} ${sourceCoin.name} → ${targetCoin.smile} ${targetCoin.name}\n` +
        `Курс: ${Format_Currency_Amount(course.course_source)}${sourceCoin.smile} → ${Format_Currency_Amount(course.course_target)}${targetCoin.smile}?`
    );

    await context.send(`${confirm.text}`);

    if (!confirm.status) {
        return res;
    }

    const conversion = existing
        ? await prisma.allianceCoinInternalConversion.update({
            where: { id: existing.id },
            data: {
                enabled: true,
                course_source: course.course_source,
                course_target: course.course_target
            }
        })
        : await prisma.allianceCoinInternalConversion.create({
            data: {
                id_alliance: alliance.id,
                id_source_coin: sourceCoin.id,
                id_target_coin: targetCoin.id,
                enabled: true,
                course_source: course.course_source,
                course_target: course.course_target
            }
        });

    await Logger(`Настройка внутренней конвертации: ${sourceCoin.name} -> ${targetCoin.name} by ${user.idvk}`);
    await context.send(
        `${ico_list['reconfig'].ico} Внутренняя конвертация сохранена!\n\n` +
        `id${conversion.id}: ${sourceCoin.smile} ${sourceCoin.name} → ${targetCoin.smile} ${targetCoin.name}\n` +
        `Курс: ${Format_Currency_Amount(conversion.course_source)}${sourceCoin.smile} → ${Format_Currency_Amount(conversion.course_target)}${targetCoin.smile}`
    );
    await Send_Message(chat_id,
        `${ico_list['reconfig'].ico} Настройка внутренней конвертации\n` +
        `${sourceCoin.smile} ${sourceCoin.name} → ${targetCoin.smile} ${targetCoin.name}\n` +
        `Курс: ${Format_Currency_Amount(conversion.course_source)}${sourceCoin.smile} → ${Format_Currency_Amount(conversion.course_target)}${targetCoin.smile}\n` +
        `${ico_list['person'].ico} @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
        `${ico_list['alliance'].ico} ${alliance.name}`
    );

    return res;
}

async function Internal_Conversion_Edit_Course(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };

    while (true) {
        const conversion = await Internal_Conversion_Find(Number(data.id_internal_conversion), alliance.id);

        if (!conversion) {
            await context.send(`${ico_list['warn'].ico} Внутренняя конвертация не найдена.`);
            return res;
        }

        const keyboard = new KeyboardBuilder()
            .textButton({ label: `${conversion.sourceCoin.smile} Списывать`, payload: { command: 'internal_course_source', cursor: data.cursor, id_internal_conversion: conversion.id }, color: 'secondary' })
            .textButton({ label: `${conversion.targetCoin.smile} Начислять`, payload: { command: 'internal_course_target', cursor: data.cursor, id_internal_conversion: conversion.id }, color: 'secondary' }).row();

        const text =
            `${ico_list['attach'].ico} Настройка курса внутренней конвертации\n\n` +
            `${conversion.sourceCoin.smile} ${conversion.sourceCoin.name} → ${conversion.targetCoin.smile} ${conversion.targetCoin.name}\n` +
            `Текущий курс: ${Format_Currency_Amount(conversion.course_source)}${conversion.sourceCoin.smile} → ${Format_Currency_Amount(conversion.course_target)}${conversion.targetCoin.smile}\n\n` +
            `Выберите, какую сторону курса изменить:`;

        const answer = await Send_Message_Question(context, text, keyboard);
        if (answer.exit) { return res; }

        const config: any = {
            'internal_course_source': Internal_Conversion_Edit_Course_Source,
            'internal_course_target': Internal_Conversion_Edit_Course_Target
        };

        if (answer.payload?.command in config) {
            await config[answer.payload.command](context, answer.payload, alliance, user);
        }
    }
}

async function Notify_Internal_Conversion_Course_Update(context: any, user: User, conversion: InternalConversionWithCoins, updated: InternalConversionWithCoins, changes: string) {
    await Logger(`Обновлен курс внутренней конвертации ${conversion.id} by ${user.idvk}`);
    await context.send(
        `${ico_list['reconfig'].ico} Курс внутренней конвертации обновлен!\n\n` +
        `${conversion.sourceCoin.smile} ${conversion.sourceCoin.name} → ${conversion.targetCoin.smile} ${conversion.targetCoin.name}\n` +
        `${changes}\n` +
        `Текущий курс: ${Format_Currency_Amount(updated.course_source)}${conversion.sourceCoin.smile} → ${Format_Currency_Amount(updated.course_target)}${conversion.targetCoin.smile}`
    );
}

async function Internal_Conversion_Edit_Course_Source(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    const conversion = await Internal_Conversion_Find(Number(data.id_internal_conversion), alliance.id);
    if (!conversion) { return res; }

    const value = await Internal_Conversion_Ask_Positive_Number(
        context,
        `${ico_list['attach'].ico} Сколько ${conversion.sourceCoin.smile} ${conversion.sourceCoin.name} списывать за обмен?\n\n` +
        `Текущий курс: ${Format_Currency_Amount(conversion.course_source)}${conversion.sourceCoin.smile} → ${Format_Currency_Amount(conversion.course_target)}${conversion.targetCoin.smile}`
    );
    if (value === null) { return res; }

    await prisma.allianceCoinInternalConversion.update({
        where: { id: conversion.id },
        data: { course_source: value }
    });
    const updated = await Internal_Conversion_Find(conversion.id, alliance.id);
    if (updated) {
        await Notify_Internal_Conversion_Course_Update(context, user, conversion, updated, `Списывать: ${Format_Currency_Amount(conversion.course_source)}${conversion.sourceCoin.smile} --> ${Format_Currency_Amount(updated.course_source)}${updated.sourceCoin.smile}`);
    }
    return res;
}

async function Internal_Conversion_Edit_Course_Target(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    const conversion = await Internal_Conversion_Find(Number(data.id_internal_conversion), alliance.id);
    if (!conversion) { return res; }

    const value = await Internal_Conversion_Ask_Positive_Number(
        context,
        `${ico_list['attach'].ico} Сколько ${conversion.targetCoin.smile} ${conversion.targetCoin.name} начислять за обмен?\n\n` +
        `Текущий курс: ${Format_Currency_Amount(conversion.course_source)}${conversion.sourceCoin.smile} → ${Format_Currency_Amount(conversion.course_target)}${conversion.targetCoin.smile}`
    );
    if (value === null) { return res; }

    await prisma.allianceCoinInternalConversion.update({
        where: { id: conversion.id },
        data: { course_target: value }
    });
    const updated = await Internal_Conversion_Find(conversion.id, alliance.id);
    if (updated) {
        await Notify_Internal_Conversion_Course_Update(context, user, conversion, updated, `Начислять: ${Format_Currency_Amount(conversion.course_target)}${conversion.targetCoin.smile} --> ${Format_Currency_Amount(updated.course_target)}${updated.targetCoin.smile}`);
    }
    return res;
}

async function Internal_Conversion_Config(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    const conversion = await Internal_Conversion_Find(Number(data.id_internal_conversion), alliance.id);

    if (!conversion) {
        await context.send(`${ico_list['warn'].ico} Внутренняя конвертация не найдена.`);
        return res;
    }

    const nextEnabled = !conversion.enabled;
    const confirm = await Confirm_User_Success(
        context,
        `${nextEnabled ? 'разрешить' : 'запретить'} внутреннюю конвертацию ` +
        `[${conversion.sourceCoin.smile} ${conversion.sourceCoin.name} → ${conversion.targetCoin.smile} ${conversion.targetCoin.name}]?`
    );

    await context.send(`${confirm.text}`);

    if (!confirm.status) {
        return res;
    }

    const updated = await prisma.allianceCoinInternalConversion.update({
        where: { id: conversion.id },
        data: { enabled: nextEnabled }
    });

    await Logger(`Изменена внутренняя конвертация ${conversion.id}: ${updated.enabled} by ${user.idvk}`);
    await context.send(
        `${ico_list['reconfig'].ico} Внутренняя конвертация ` +
        `${updated.enabled ? 'разрешена ✅' : 'запрещена ⛔'}`
    );

    return res;
}

async function Internal_Conversion_Delete(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor };
    const conversion = await Internal_Conversion_Find(Number(data.id_internal_conversion), alliance.id);

    if (!conversion) {
        await context.send(`${ico_list['warn'].ico} Внутренняя конвертация не найдена.`);
        return res;
    }

    const confirm = await Confirm_User_Success(
        context,
        `удалить внутреннюю конвертацию ` +
        `[${conversion.sourceCoin.smile} ${conversion.sourceCoin.name} → ${conversion.targetCoin.smile} ${conversion.targetCoin.name}]?`
    );

    await context.send(`${confirm.text}`);

    if (!confirm.status) {
        return res;
    }

    await prisma.allianceCoinInternalConversion.delete({
        where: { id: conversion.id }
    });
    await Logger(`Удалена внутренняя конвертация ${conversion.id} by ${user.idvk}`);
    await context.send(`${ico_list['delete'].ico} Внутренняя конвертация удалена.`);

    return res;
}

async function Internal_Conversion_Ask_Course(
    context: any,
    sourceCoin: AllianceCoin,
    targetCoin: AllianceCoin,
    current?: InternalConversionCourse
): Promise<InternalConversionCourse | null> {
    const course: InternalConversionCourse = {
        course_source: current?.course_source ?? 1,
        course_target: current?.course_target ?? 1
    };

    const sourceAmount = await Internal_Conversion_Ask_Positive_Number(
        context,
        `${ico_list['attach'].ico} Настройка курса ${sourceCoin.smile} ${sourceCoin.name} → ${targetCoin.smile} ${targetCoin.name}:\n\n` +
        `Текущий курс: ${Format_Currency_Amount(course.course_source)}${sourceCoin.smile} → ${Format_Currency_Amount(course.course_target)}${targetCoin.smile}\n\n` +
        `Введите, сколько ${sourceCoin.smile} ${sourceCoin.name} списывать за обмен:`
    );

    if (sourceAmount === null) {
        return null;
    }

    course.course_source = sourceAmount;

    const targetAmount = await Internal_Conversion_Ask_Positive_Number(
        context,
        `Введите, сколько ${targetCoin.smile} ${targetCoin.name} начислять за ${Format_Currency_Amount(course.course_source)}${sourceCoin.smile}:`
    );

    if (targetAmount === null) {
        return null;
    }

    course.course_target = targetAmount;

    return course;
}

async function Internal_Conversion_Ask_Positive_Number(context: any, message: string): Promise<number | null> {
    while (true) {
        const answer = await context.question(message, {
            keyboard: Keyboard.builder()
                .textButton({ label: `${ico_list['stop'].ico} Отмена`, payload: { command: 'cancel' }, color: 'secondary' })
                .oneTime().inline(),
            ...timer_text
        });

        if (answer.isTimeout) {
            await context.send(`${ico_list['time'].ico} Время истекло!`);
            return null;
        }

        if (answer.text === `${ico_list['stop'].ico} Отмена`) {
            await context.send(`${ico_list['stop'].ico} Настройка отменена`);
            return null;
        }

        const input = Parse_Positive_Amount(String(answer.text ?? ''));

        if (input !== null && input <= MAX_INTERNAL_COURSE_VALUE) {
            return input;
        }

        await context.send(`${ico_list['help'].ico} Введите положительное число до ${MAX_INTERNAL_COURSE_VALUE}.`);
    }
}

async function Alliance_Coin_Config(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }

    while (true) {
        const alliance_coin_check = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } })
        if (!alliance_coin_check) {
            await context.send(`${ico_list['warn'].ico} Валюта не найдена.`)
            return res
        }

        const plural_genitive = await getTerminology(alliance.id, 'plural_genitive');

        const keyboard = new KeyboardBuilder()
            .textButton({ label: `${ico_list['converter'].ico} Конвертация`, payload: { command: 'alliance_coin_config_converted', cursor: data.cursor, id_alliance_coin: alliance_coin_check.id }, color: 'secondary' }).row()

        if (alliance_coin_check.point) {
            keyboard.textButton({ label: '📊 В рейтинги', payload: { command: 'alliance_coin_config_converted_point', cursor: data.cursor, id_alliance_coin: alliance_coin_check.id }, color: 'secondary' }).row()
        }

        const text =
            `${ico_list['config'].ico} Настройка конвертации валюты\n\n` +
            `${alliance_coin_check.smile} ${alliance_coin_check.id}-${alliance_coin_check.name}\n` +
            `Конвертация валюты: ${Format_Switch_Status(alliance_coin_check.converted)}\n` +
            `Конвертация в рейтинги ${plural_genitive}: ${alliance_coin_check.point ? Format_Switch_Status(alliance_coin_check.converted_point) : 'недоступно, валюта не рейтинговая'}\n\n` +
            `Выберите, что изменить:`

        const answer = await Send_Message_Question(context, text, keyboard)
        if (answer.exit) { return res }

        const config: any = {
            'alliance_coin_config_converted': Alliance_Coin_Config_Converted,
            'alliance_coin_config_converted_point': Alliance_Coin_Config_Converted_Point
        }

        if (answer.payload?.command in config) {
            await config[answer.payload.command](context, answer.payload, alliance, user)
        }
    }
}

async function Notify_Alliance_Coin_Config_Update(context: any, alliance: Alliance, user: User, coinBefore: AllianceCoin, coinAfter: AllianceCoin, changes: string) {
    const plural_genitive = await getTerminology(alliance.id, 'plural_genitive');
    await Logger(`In database, updated config alliance coin: ${coinAfter.id}-${coinAfter.name} by admin ${context.senderId}`)
    await context.send(`${ico_list['reconfig'].ico} Вы скорректировали конфигурацию валюты:\n${changes}`)
    await Send_Message(chat_id, `${ico_list['reconfig'].ico} Корректировка конфигурации курса конвертации ролевой валюты\n${ico_list['message'].ico} Сообщение:\nНазвание: ${coinBefore.id}-${coinBefore.name}\n${changes}\nТекущее состояние: конвертация ${Format_Switch_Status(coinAfter.converted)}, в рейтинги ${Format_Switch_Status(coinAfter.converted_point)} ${plural_genitive}\n${ico_list['person'].ico} @id${user.idvk}(${user.name}) (UID: ${user.id})\n${ico_list['alliance'].ico} ${alliance.name}`)
}

async function Alliance_Coin_Config_Converted(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const coin = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } })
    if (!coin) { return res }

    const nextValue = !coin.converted
    const confirm: { status: boolean, text: String } = await Confirm_User_Success(context, `переключить конвертацию валюты [${coin.smile} ${coin.name}]: ${Format_Switch_Status(coin.converted)} --> ${Format_Switch_Status(nextValue)}?`)
    await context.send(`${confirm.text}`)
    if (!confirm.status) { return res }

    const coin_up = await prisma.allianceCoin.update({ where: { id: coin.id }, data: { converted: nextValue } })
    await Notify_Alliance_Coin_Config_Update(context, alliance, user, coin, coin_up, `Конвертация валюты: ${Format_Switch_Status(coin.converted)} --> ${Format_Switch_Status(coin_up.converted)}`)
    return res
}

async function Alliance_Coin_Config_Converted_Point(context: any, data: any, alliance: Alliance, user: User) {
    const res = { cursor: data.cursor }
    const coin = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin, id_alliance: alliance.id } })
    if (!coin) { return res }

    if (!coin.point) {
        await context.send(`${ico_list['warn'].ico} Валюта не рейтинговая, конвертацию в рейтинги включить нельзя.`)
        return res
    }

    const plural_genitive = await getTerminology(alliance.id, 'plural_genitive');
    const nextValue = !coin.converted_point
    const confirm: { status: boolean, text: String } = await Confirm_User_Success(context, `переключить конвертацию [${coin.smile} ${coin.name}] в рейтинги ${plural_genitive}: ${Format_Switch_Status(coin.converted_point)} --> ${Format_Switch_Status(nextValue)}?`)
    await context.send(`${confirm.text}`)
    if (!confirm.status) { return res }

    const coin_up = await prisma.allianceCoin.update({ where: { id: coin.id }, data: { converted_point: nextValue } })
    await Notify_Alliance_Coin_Config_Update(context, alliance, user, coin, coin_up, `Конвертация в рейтинги ${plural_genitive}: ${Format_Switch_Status(coin.converted_point)} --> ${Format_Switch_Status(coin_up.converted_point)}`)
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
    const res: { cursor: number; stop?: boolean } = { cursor: data.cursor };
    
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
            res.stop = true;
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
    
    if (!confirm.status) {
        res.stop = true;
        return res;
    }

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

            const facultyChanges: FacultRatingChange[] = [];

            if (alliance_coin.converted_point) {
                const facultyChange = await Apply_Facult_Rating_Change(alliance, user, alliance_coin, calc, 'increment');

                if (facultyChange) {
                    facultyChanges.push(facultyChange);
                }
            }

            const facultyBlock = Format_Facult_Rating_Block(facultyChanges);

            if (facultyBlock) {
                user_message += facultyBlock;
                log_message += `, факультет: ${facultyChanges.map((change) => change.line).join('; ')}`;
            }
            
            await Logger(`Конвертация: ${log_message} by player ${context.senderId}`);
            await context.send(user_message);
            
            const allianceObj = await prisma.alliance.findFirst({ 
                where: { id: user.id_alliance ?? 0 } 
            });

            const chatMessage = `⌛ @id${user.idvk}(${user.name}) (UID: ${user.id}) конвертирует ${coi} [${currency_emoji} ${type === 'medal' ? 'Жетоны' : 'S-coins'}] в ${calc} [${alliance_coin.smile} ${alliance_coin.name}].\n\n` +
                `${currency_emoji} --> ${currency_balance} - ${coi} = ${type === 'medal' ? currency_update.medal : currency_update.scoopins}\n` +
                `${alliance_coin.smile} --> ${balance_check.amount} + ${calc} = ${balance_update.amount}` +
                facultyBlock;

            await Send_Finance_Log(allianceObj?.id_chat, chatMessage);
        }
    }
    
    res.stop = true;
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
