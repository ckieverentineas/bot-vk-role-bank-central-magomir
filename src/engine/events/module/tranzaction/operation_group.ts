import { Keyboard, KeyboardBuilder } from "vk-io"
import { Accessed, Fixed_Number_To_Five, Keyboard_Index, Logger, Send_Message, Send_Coin_Operation_Notification } from "../../../core/helper"
import { answerTimeLimit, chat_id, timer_text } from "../../../.."
import prisma from "../prisma_client"
import { Person_Coin_Printer_Self } from "../person/person_coin"
import { Back, Ipnut_Gold, Ipnut_Message } from "./operation_global"
import { AllianceCoin, BalanceCoin, BalanceFacult, User } from "@prisma/client"
import { Facult_Coin_Printer_Self } from "../alliance/facult_rank"
import { ico_list } from "../data_center/icons_lib"
import { getTerminology } from "../alliance/terminology_helper"

interface LightAllianceCoin {
    id: number;
    name: string;
    smile: string;
    point: boolean;
    converted: boolean;
    converted_point: boolean;
    sbp_on: boolean;
    course_medal: number;
    course_coin: number;
}

// В функции Operation_Group добавляем новую кнопку и обработку ввода 0
export async function Operation_Group(context: any) {
    if (context.peerType == 'chat') { return }
    if (await Accessed(context) == 1) { return }
    let name_check = false
    let uids_prefab = null
    while (name_check == false) {
        const uid: any = await context.question( 
            `🧷 Введите список 💳UID банковских счетов получателей формата:\n"UID1 UID2 .. UIDN"\n\n` +
            `💡 Или введите 0, если хотите указать разные суммы для каждого пользователя`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: '🚫Отмена', payload: { command: 'limited' }, color: 'secondary' })
                .oneTime().inline(),
                timer_text
            }
        )
        if (uid.isTimeout) { return await context.send('⏰ Время ожидания на ввод банковского счета получателя истекло!')}
        
        if (uid.text === "0") {
            // Пользователь хочет кастомные операции - сразу переходим к выбору типа
            uids_prefab = []
            name_check = true
            await context.send(`⚙ Переходим к операциям с разными суммами`)
            
            // Показываем только кастомные операции для валют
            const account_adm = await prisma.account.findFirst({ where: { idvk: context.senderId } })
            if (!account_adm) { return }
            const person_adm = await prisma.user.findFirst({ where: { id: account_adm.select_user } })
            if (!person_adm) { return }
            let info_coin: { text: string, smile: string } | undefined = { text: ``, smile: `` }
            info_coin = await Person_Coin_Printer_Self(context, person_adm.id)
            
            const keyboard = new KeyboardBuilder()
            if (await Accessed(context) == 3) { 
                keyboard.textButton({ label: '🎯🔘', payload: { command: 'medal_custom_many' }, color: 'primary' }).row()
            }
            keyboard.textButton({ label: `🎯${info_coin?.smile}`, payload: { command: 'coin_engine_many_custom' }, color: 'primary' }).row()
            .textButton({ label: '🔙', payload: { command: 'back' }, color: 'secondary' }).row()
            
            const ans: any = await context.question( `✉ Выберите тип операции с разными суммами:`,
                {   
                    keyboard: keyboard.oneTime().inline(),
                    answerTimeLimit                                                                       
                }
            )
            
            if (ans.isTimeout) { return await context.send(`⏰ Время ожидания выбора операции истекло!`) }
            if (ans.payload && ans.payload.command != 'back') {
                const config: any = {
                    'back': Back,
                    'coin_engine_many_custom': Coin_Engine_Many_Custom,
                    'medal_custom_many': Medal_Custom_Many
                }
                const commandHandler = config[ans.payload.command];
                const answergot = await commandHandler([], context, person_adm)
                
                // ДОБАВЛЕНО: После выполнения кастомных операций показываем завершающие сообщения
                if (answergot !== false) { // Проверяем, что операция не была отменена
                    await context.send(`✅ Процедура массовых операций под названием операция "Ы" успешно завершена!`)
                    await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
                }
            } else {
                await context.send(`⚙ Операция отменена пользователем.`)
            }
            return // Завершаем обработчик
        }
        
        if (/(?:^|\s)(\d+)(?=\s|$)/g.test(uid.text)) {
            uids_prefab = uid.text.match(/(?:^|\s)(\d+)(?=\s|$)/g)
            await context.send(`⚙ Подготовка к массовым операциям, товарищ ДОК!`)
            name_check = true
        } else {
            if (uid.text == "🚫Отмена") { 
                await context.send(`💡 Операции прерваны пользователем!`) 
                return await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
            }
            await context.send(`💡 Необходимо ввести корректные UID или 0 для разных сумм!`)
        }
    }

    // Обычный процесс для стандартных операций
    const account_adm = await prisma.account.findFirst({ where: { idvk: context.senderId } })
    if (!account_adm) { return }
    const person_adm = await prisma.user.findFirst({ where: { id: account_adm.select_user } })
    if (!person_adm) { return }
    let info_coin: { text: string, smile: string } | undefined = { text: ``, smile: `` }
    info_coin = await Person_Coin_Printer_Self(context, person_adm.id)
    let uids: Array<number> = []
    for (const ui of uids_prefab) {
        const user_gt = await prisma.user.findFirst({ where: { id: Number(ui) } })
        if (!user_gt) { await Send_Message(context.senderId, `⚠ Персонаж с UID ${ui} не найден`); continue }
        if (user_gt.id_alliance != person_adm.id_alliance) {
            await Send_Message(context.senderId, `⚠ Персонаж с UID ${ui} не состоит в вашей ролевой`); 
            if (await Accessed(context) != 3) { continue }
        }
        uids.push(Number(ui))
    }
    const keyboard = new KeyboardBuilder()
    if (await Accessed(context) == 3) { 
        keyboard.textButton({ label: '+🔘', payload: { command: 'medal_up_many' }, color: 'secondary' })
        .textButton({ label: '—🔘', payload: { command: 'medal_down_many' }, color: 'secondary' }).row()
        .textButton({ label: '🎯🔘', payload: { command: 'medal_custom_many' }, color: 'primary' }).row() // Кнопка для кастомных операций с жетонами
    }
    const ans: any = await context.question( `✉ Доступны следующие операции с 💳UID: ${JSON.stringify(uids)}`,
        {   
            keyboard: keyboard
            .textButton({ label: `➕➖${info_coin?.smile}`, payload: { command: 'coin_engine_many' }, color: 'secondary' }).row()
            .textButton({ label: `♾️${info_coin?.smile}`, payload: { command: 'coin_engine_many_infinity' }, color: 'secondary' })
            .textButton({ label: `🎯${info_coin?.smile}`, payload: { command: 'coin_engine_many_custom' }, color: 'primary' }).row() // Кнопка для кастомных операций с валютами
            .textButton({ label: '🔙', payload: { command: 'back' }, color: 'secondary' }).row()
            .oneTime().inline(),
            answerTimeLimit                                                                       
        }
    )
    if (ans.isTimeout) { return await context.send(`⏰ Время ожидания на ввод операции с 💳UID: ${JSON.stringify(uids)} истекло!`) }
    const config: any = {
        'back': Back,
        'coin_engine_many': Coin_Engine_Many,
        'coin_engine_many_infinity': Coin_Engine_Many_Infinity,
        'coin_engine_many_custom': Coin_Engine_Many_Custom,
        'medal_up_many': Medal_Up_Many,
        'medal_down_many': Medal_Down_Many,
        'medal_custom_many': Medal_Custom_Many // Новая функция для кастомных операций с жетонами
    }
    if (ans?.payload?.command in config) {
        const commandHandler = config[ans.payload.command];
        const answergot = await commandHandler(uids, context, person_adm)
        
        // ДОБАВЛЕНО: Проверяем, что операция не была отменена
        if (answergot !== false && ans.payload.command !== 'back') {
            await context.send(`✅ Процедура массовых операций под названием операция "Ы" успешно завершена!`)
            await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
        }
    } else {
        await context.send(`⚙ Операция отменена пользователем.`)
    }
}

// НОВАЯ ФУНКЦИЯ: Кастомные массовые операции с министерскими жетонами
async function Medal_Custom_Many(uids: number[], context: any, person_adm: User) {
    const messa: string = await Ipnut_Message(context, 'массовых операций с министерскими жетонами')
    
    const users_target = await context.question(`📊 Введите список UID и операций в формате:\nUID1+СУММА1\nUID2-СУММА2\nUID3+СУММА3\n...\n\nПример:\n5+34\n6-23\n7+53\n44-10`, 
        { answerTimeLimit }
    )
    
    if (users_target.isTimeout) { 
        await context.send(`⏰ Время ожидания ввода данных истекло!`)
        return false // Возвращаем false для отмены завершающих сообщений
    }

    const lines = users_target.text.split('\n').map((line: string) => line.trim());
    const uid_res: Array<{ id: number, amount: number, operation: string }> = []

    for (const line of lines) {
        if (!line.includes('+') && !line.includes('-')) {
            await context.send(`⚠ Неверный формат: ${line} - нет операции (+ или -)`);
            continue;
        }

        // Определяем операцию и разделяем строку
        let operation = '';
        let parts: string[] = [];
        
        if (line.includes('+')) {
            operation = '+';
            parts = line.split('+');
        } else if (line.includes('-')) {
            operation = '-';
            parts = line.split('-');
        }

        if (parts.length !== 2) {
            await context.send(`⚠ Неверный формат: ${line}`);
            continue;
        }

        const uidStr = parts[0].trim();
        const amountStr = parts[1].trim();
        const uid = parseInt(uidStr);
        const amount = parseFloat(amountStr);

        if (isNaN(uid) || isNaN(amount)) {
            await context.send(`⚠ Неверный формат: ${line}`);
            continue;
        }

        // Для кастомных операций не проверяем на uids.includes(uid) - разрешаем любые UID
        const user = await prisma.user.findFirst({ where: { id: uid } });
        if (!user) {
            await context.send(`❌ Пользователь с UID ${uid} не найден.`);
            continue;
        }

        uid_res.push({ id: uid, amount: amount, operation: operation });
    }

    if (uid_res.length === 0) {
        await context.send(`❌ Не удалось обработать ни одной записи. Операция отменена.`);
        return false // Возвращаем false для отмены завершающих сообщений
    }

    // Выполнение операций
    for (const ui of uid_res) {
        const user_get: any = await prisma.user.findFirst({ where: { id: ui.id } })
        if (!user_get) { 
            await context.send(`⛔ Банковская карточка с 💳UID ${ui.id} не найдена`); 
            continue 
        }
        
        let new_balance = 0;
        let operation_text = '';
        
        if (ui.operation === '+') {
            // НАЧИСЛЕНИЕ
            new_balance = user_get.medal + ui.amount;
            operation_text = `+${ui.amount}🔘`;
        } else {
            // СНЯТИЕ - проверяем баланс
            if (user_get.medal - ui.amount >= 0) {
                new_balance = user_get.medal - ui.amount;
                operation_text = `-${ui.amount}🔘`;
            } else {
                // Запрашиваем подтверждение для отрицательного баланса
                const confirmq = await context.question(`⚠ Недостаточно средств! UID ${ui.id} (${user_get.name}): ${user_get.medal}🔘 ${ui.operation}${ui.amount}🔘 = ${user_get.medal - ui.amount}🔘\nПродолжить снятие?`,
                    {
                        keyboard: Keyboard.builder()
                        .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
                        .textButton({ label: 'Нет', payload: { command: 'cancel' }, color: 'secondary' })
                        .oneTime().inline(),
                        answerTimeLimit
                    }
                )
                
                if (confirmq.isTimeout) { 
                    await context.send(`⏰ Время ожидания подтверждения истекло! Пропускаем UID ${ui.id}`)
                    continue
                }
                
                if (confirmq.payload?.command === 'confirm') {
                    new_balance = user_get.medal - ui.amount;
                    operation_text = `-${ui.amount}🔘`;
                } else {
                    await context.send(`❌ Операция для UID ${ui.id} отменена`)
                    continue
                }
            }
        }
        
        // Выполняем операцию
        const money_put = await prisma.user.update({ 
            where: { id: user_get.id }, 
            data: { medal: new_balance } 
        })
        
        try {
            const operation_message = ui.operation === '+' 
                ? `⚙ Вам начислено ${ui.amount}🔘. \nВаш счёт: ${money_put.medal}🔘 \nУведомление: ${messa}`
                : `⚙ С вас снято ${ui.amount}🔘. \nВаш счёт: ${money_put.medal}🔘 \nУведомление: ${messa}`;
                
            await Send_Message(user_get.idvk, operation_message)
            await context.send(`✅ Успешная операция для UID ${ui.id}: ${operation_text}`)
        } catch (error) {
            console.log(`User ${user_get.idvk} blocked chating with bank`)
            await context.send(`⚙ Операция с 💳UID ${ui.id} завершена, но уведомление не доставлено пользователю!`)
        }
        
        const log_message = ui.operation === '+'
            ? `🎯 @id${context.senderId}(Admin) > "+🔘" > ${user_get.medal}🔘+${ui.amount}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
            : `🎯 @id${context.senderId}(Admin) > "-🔘" > ${user_get.medal}🔘-${ui.amount}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`;
            
        await Send_Message(chat_id, log_message)
        
        console.log(`User ${user_get.idvk} ${ui.operation === '+' ? 'got' : 'lost'} ${ui.amount} medals. Him/Her bank now ${money_put.medal}`)
    }
    
    return true // Возвращаем true для показа завершающих сообщений
}

// НОВАЯ ФУНКЦИЯ: Массовые операции с разными суммами
async function Coin_Engine_Many_Custom(uids: number[], context: any, person_adm: User) {
    // Используем персонажа администратора для определения ролевой
    const person: { coin: LightAllianceCoin | null, operation: string | null } = { coin: null, operation: null }
    
    const alli_get = await prisma.alliance.findFirst({ where: { id: person_adm.id_alliance ?? 0 } })
    const coin_pass = await prisma.allianceCoin.findMany({ 
        where: { id_alliance: Number(person_adm?.id_alliance) },
        select: {
            id: true,
            name: true,
            smile: true,
            point: true,
            converted: true,
            converted_point: true,
            sbp_on: true,
            course_medal: true,
            course_coin: true
        }
    }) as LightAllianceCoin[];
    if (!coin_pass) { 
        await context.send(`Валют ролевых пока еще нет, чтобы начать=)`)
        return false 
    }
    
    // Выбор валюты
    let coin_check = false
    let id_builder_sent = 0
    while (!coin_check) {
        const keyboard = new KeyboardBuilder()
        id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
        let event_logger = `❄ Выберите валюту для массовых операций:\n\n`
        const builder_list: LightAllianceCoin[] = coin_pass
        if (builder_list.length > 0) {
            const limiter = 5
            let counter = 0
            for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                const builder = builder_list[i]
                keyboard.textButton({ label: `${builder.smile}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent: i, target: builder }, color: 'secondary' }).row()
                event_logger += `\n\n💬 ${builder.smile} -> ${builder.id} - ${builder.name}\n`
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
            event_logger = `💬 Админы ролевой еще не создали ролевые валюты`
            await context.send(`💬 Админы ролевой еще не создали ролевые валюты`)
            return false
        }
        const answer1: any = await context.question(`${event_logger}`,
            {	
                keyboard: keyboard.inline(), answerTimeLimit
            }
        )
        if (answer1.isTimeout) { 
            await context.send(`⏰ Время ожидания выбора валюты истекло!`)
            return false 
        }
        if (!answer1.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            if (answer1.text == '→' || answer1.text =='←') {
                id_builder_sent = answer1.payload.id_builder_sent
            } else {
                person.coin = answer1.payload.target
                coin_check = true
            }
        }
    }
    
    // Ввод данных в формате UID+СУММА или UID-СУММА
    const messa: string = await Ipnut_Message(context, `[массовая операция ${person.coin?.smile} с разными суммами]`)
    const users_target = await context.question(`📊 Введите список UID и операций в формате:\nUID1+СУММА1\nUID2-СУММА2\nUID3+СУММА3\n...\n\nПример:\n5+3402\n6-23\n7+53\n44-100`, 
        { answerTimeLimit }
    )
    
    if (users_target.isTimeout) { 
        await context.send(`⏰ Время ожидания ввода данных истекло!`)
        return false 
    }

    const lines = users_target.text.split('\n').map((line: string) => line.trim());
    const uid_res: Array<{ id: number, amount: number, operation: string }> = []

    for (const line of lines) {
        if (!line.includes('+') && !line.includes('-')) {
            await context.send(`⚠ Неверный формат: ${line} - нет операции (+ или -)`);
            continue;
        }

        // Определяем операцию и разделяем строку
        let operation = '';
        let parts: string[] = [];
        
        if (line.includes('+')) {
            operation = '+';
            parts = line.split('+');
        } else if (line.includes('-')) {
            operation = '-';
            parts = line.split('-');
        }

        if (parts.length !== 2) {
            await context.send(`⚠ Неверный формат: ${line}`);
            continue;
        }

        const uidStr = parts[0].trim();
        const amountStr = parts[1].trim();
        const uid = parseInt(uidStr);
        const amount = parseFloat(amountStr);

        if (isNaN(uid) || isNaN(amount)) {
            await context.send(`⚠ Неверный формат: ${line}`);
            continue;
        }

        // Для кастомных операций не проверяем на uids.includes(uid) - разрешаем любые UID
        const user = await prisma.user.findFirst({ where: { id: uid } });
        if (!user) {
            await context.send(`❌ Пользователь с UID ${uid} не найден.`);
            continue;
        }

        uid_res.push({ id: uid, amount: amount, operation: operation });
    }

    if (uid_res.length === 0) {
        await context.send(`❌ Не удалось обработать ни одной записи. Операция отменена.`);
        return false
    }

    // Выполнение операций
    for (const ui of uid_res) {
        const pers = await prisma.user.findFirst({ where: { id: ui.id } })
        if (!pers) { await context.send(`UID ${ui.id} не найдено`); continue }
        
        // Проверяем, что пользователь в той же ролевой (если не суперадмин)
        if (pers.id_alliance != person_adm.id_alliance && await Accessed(context) != 3) {
            await context.send(`⚠ Пользователь UID ${ui.id} не состоит в вашей ролевой`);
            continue;
        }
        
        const pers_bal_coin: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: pers.id }})
        if (!pers_bal_coin) { 
            // Создаем баланс, если его нет
            const new_balance = await prisma.balanceCoin.create({ 
                data: { 
                    id_coin: person.coin!.id, 
                    id_user: pers.id,
                    amount: 0
                } 
            })
            if (!new_balance) {
                await context.send(`❌ Не удалось создать валютный счет для UID ${ui.id}`);
                continue;
            }
            await context.send(`✅ Создан новый валютный счет для UID ${ui.id}`);
        }

        const current_balance = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: pers.id }})
        if (!current_balance) { 
            await context.send(`❌ Ошибка доступа к балансу UID ${ui.id}`);
            continue;
        }

        const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: pers.id_facult ?? 0 } })
        
        let new_balance_amount = 0;
        let operation_text = '';
        
        if (ui.operation === '+') {
            new_balance_amount = current_balance.amount + ui.amount;
            operation_text = `+${ui.amount}${person.coin?.smile}`;
        } else {
            // Проверяем достаточно ли средств для снятия
            if (current_balance.amount - ui.amount >= 0) {
                new_balance_amount = current_balance.amount - ui.amount;
                operation_text = `-${ui.amount}${person.coin?.smile}`;
            } else {
                // Запрашиваем подтверждение для отрицательного баланса
                const confirmq = await context.question(`⚠ Недостаточно средств! UID ${ui.id} (${pers.name}): ${current_balance.amount}${person.coin?.smile} ${ui.operation}${ui.amount}${person.coin?.smile} = ${current_balance.amount - ui.amount}${person.coin?.smile}\nПродолжить снятие?`,
                    {
                        keyboard: Keyboard.builder()
                        .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
                        .textButton({ label: 'Нет', payload: { command: 'cancel' }, color: 'secondary' })
                        .oneTime().inline(),
                        answerTimeLimit
                    }
                )
                
                if (confirmq.isTimeout) { 
                    await context.send(`⏰ Время ожидания подтверждения истекло! Пропускаем UID ${ui.id}`)
                    continue
                }
                
                if (confirmq.payload?.command === 'confirm') {
                    new_balance_amount = current_balance.amount - ui.amount;
                    operation_text = `-${ui.amount}${person.coin?.smile}`;
                } else {
                    await context.send(`❌ Операция для UID ${ui.id} отменена`)
                    continue
                }
            }
        }

        // Обновляем баланс
        const updated_balance = await prisma.balanceCoin.update({ 
            where: { id: current_balance.id }, 
            data: { amount: new_balance_amount } 
        })

        let facult_income = ''
        if (person.coin?.point == true && alli_fac) {
            const rank_put_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
            const alliance = await prisma.alliance.findFirst({ 
                where: { id: pers.id_alliance ?? 0 } 
            });
            const singular = await getTerminology(alliance?.id || 0, 'singular');
            const genitive = await getTerminology(alliance?.id || 0, 'genitive');
            if (rank_put_check) {
                const rank_updated = ui.operation === '+' 
                    ? await prisma.balanceFacult.update({ where: { id: rank_put_check.id }, data: { amount: { increment: ui.amount } } })
                    : await prisma.balanceFacult.update({ where: { id: rank_put_check.id }, data: { amount: { decrement: ui.amount } } });
                
                facult_income = rank_updated ? `🌐 "${ui.operation}${person.coin?.smile}" > ${rank_put_check.amount} ${ui.operation} ${ui.amount} = ${rank_updated.amount} для ${genitive} [${alli_fac.smile} ${alli_fac.name}]` : ''
            }
        }
        
        const notif_ans = await Send_Coin_Operation_Notification(
            pers,
            ui.operation,
            ui.amount,
            person.coin?.smile ?? '',
            current_balance.amount,
            updated_balance.amount,
            messa,
            facult_income
        )
        
        const ans_log = `🎯 @id${context.senderId}(${person_adm.name}) > "${ui.operation}${person.coin?.smile}" > ${current_balance.amount} ${ui.operation} ${ui.amount} = ${updated_balance.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`
        const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
        if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) }
        await Logger(`User ${pers.idvk} ${ui.operation} ${ui.amount} ${person.coin?.smile}. Balance now ${updated_balance.amount}`)
        !notif_ans ? await context.send(`⚙ Сообщение для UID ${ui.id} не доставлено`) : await context.send(`✅ Успешная операция для UID ${ui.id}: ${operation_text}`)
    }
    
    return true // Возвращаем true для показа завершающих сообщений
}

//Модуль мульти начислений в цикле
async function Coin_Engine_Many_Infinity(uids: number[], context: any, person_adm: User) {
    const user: User | null | undefined = await prisma.user.findFirst({ where: { id: uids[0] } })
    const person: { coin: LightAllianceCoin | null, operation: string | null, amount: number } = { coin: null, operation: null, amount: 0 }
    if (!user) { return }
    const alli_get = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 } })
    const coin_pass = await prisma.allianceCoin.findMany({ 
        where: { id_alliance: Number(user?.id_alliance) },
        select: {
            id: true,
            name: true,
            smile: true,
            point: true,
            converted: true,
            converted_point: true,
            sbp_on: true,
            course_medal: true,
            course_coin: true
        }
    }) as LightAllianceCoin[];
    if (!coin_pass) { return context.send(`Валют ролевых пока еще нет, чтобы начать=)`) }
    let infinity_pay = false
    while (!infinity_pay) {
        let coin_check = false
        let id_builder_sent = 0
        while (!coin_check) {
            const keyboard = new KeyboardBuilder()
            id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
            let event_logger = `❄ Выберите валюту, с которой будем делать отчисления:\n\n`
            const builder_list: LightAllianceCoin[] = coin_pass
            if (builder_list.length > 0) {
                const limiter = 5
                let counter = 0
                for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                    const builder = builder_list[i]
                    keyboard.textButton({ label: `${builder.smile}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent: i, target: builder }, color: 'secondary' }).row()
                    event_logger += `\n\n💬 ${builder.smile} -> ${builder.id} - ${builder.name}\n`
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
                event_logger = `💬 Админы ролевой еще не создали ролевые валюты`
                return context.send(`💬 Админы ролевой еще не создали ролевые валюты`)
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
                    person.coin = answer1.payload.target
                    coin_check = true
                }
            }
        }
        let answer_check = false
        while (answer_check == false) {
            const answer_selector = await context.question(`🧷 Укажите вариант операции:`,
                {	
                    keyboard: Keyboard.builder()
                    .textButton({ label: '+', payload: { command: 'student' }, color: 'secondary' })
                    .textButton({ label: '-', payload: { command: 'professor' }, color: 'secondary' })
                    .oneTime().inline(), answerTimeLimit
                }
            )
            if (answer_selector.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
            if (!answer_selector.payload) {
                await context.send(`💡 Жмите только по кнопкам с иконками!`)
            } else {
                person.operation = answer_selector.text
                answer_check = true
            }
        }
        person.amount = await Ipnut_Gold(context, `[массовая ${person.operation}${person.coin?.smile}]`) 
        const messa: string = await Ipnut_Message(context, `[массовая ${person.operation}${person.coin?.smile}]`)
        let passer = true
        switch (person.operation) {
            case '+':
                for (const ui of uids) {
                    const pers = await prisma.user.findFirst({ where: { id: ui } })
                    if (!pers) { continue }
                    const pers_info_coin = await Person_Coin_Printer_Self(context, pers.id)
                    const pers_info_facult_rank = await Facult_Coin_Printer_Self(context, pers.id)
                    const pers_bal_coin: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: pers.id }})
                    if (!pers_bal_coin) { continue }
                    const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: pers.id_facult ?? 0 } })
                    const currentAlliance = await prisma.alliance.findFirst({ 
                        where: { id: pers.id_alliance ?? 0 } 
                    });
                    const singular = await getTerminology(currentAlliance?.id || 0, 'singular');
                    const genitive = await getTerminology(currentAlliance?.id || 0, 'genitive');
                    const money_put_plus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: pers_bal_coin?.id }, data: { amount: { increment: person.amount } } })
                    let facult_income = ''
                    if (person.coin?.point == true && alli_fac) {
                        const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 

                        const rank_put_plus: BalanceFacult | null = rank_put_plus_check ? await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { increment: person.amount } } }) : null
                        facult_income = rank_put_plus ? `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check?.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для ${genitive} [${alli_fac.smile} ${alli_fac.name}]` : ''
                    }
                    
                    const notif_ans = await Send_Coin_Operation_Notification(
                        pers,
                        person.operation!,
                        person.amount,
                        person.coin?.smile ?? '',
                        pers_bal_coin.amount,
                        money_put_plus.amount,
                        messa,
                        facult_income
                    )
                    
                    const ans_log = `🗿 @id${context.senderId}(${person_adm.name}) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_plus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`
                    const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                    if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) }
                    await Logger(`User ${pers.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
                    !notif_ans ? await context.send(`⚙ Сообщение для UID ${ui} не доставлено`) : await context.send(`✅ Успешное начисление для UID ${ui}`)
                }
                break;
            case '-':
                for (const ui of uids) {
                    const pers = await prisma.user.findFirst({ where: { id: ui } })
                    if (!pers) { continue }
                    const pers_info_coin = await Person_Coin_Printer_Self(context, pers.id)
                    const pers_info_facult_rank = await Facult_Coin_Printer_Self(context, pers.id)
                    const currentAlliance = await prisma.alliance.findFirst({ 
                        where: { id: pers.id_alliance ?? 0 } 
                    });
                    const singular = await getTerminology(currentAlliance?.id || 0, 'singular');
                    const genitive = await getTerminology(currentAlliance?.id || 0, 'genitive');
                    const pers_bal_coin: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: pers.id }})
                    if (!pers_bal_coin) { continue }
                    const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: pers.id_facult ?? 0 } })
                    const money_put_minus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: pers_bal_coin.id }, data: { amount: { decrement: person.amount } } })
                    let facult_income = ''
                    if (person.coin?.point == true && alli_fac) {
                        const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
                        if (rank_put_plus_check) {
                            const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { decrement: person.amount } } })
                            if (rank_put_plus) {
                                facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для ${genitive} [${alli_fac.smile} ${alli_fac.name}]`
                            }
                        }
                    }
                    
                    const notif_ans = await Send_Coin_Operation_Notification(
                        pers,
                        person.operation!,
                        person.amount,
                        person.coin?.smile ?? '',
                        pers_bal_coin.amount,
                        money_put_minus.amount,
                        messa,
                        facult_income
                    )
                    
                    const ans_log = `🗿 @id${context.senderId}(${person_adm.name}) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_minus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`
                    const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                    if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) }
                    await Logger(`User ${pers.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
                    !notif_ans ? await context.send(`⚙ Сообщение для UID ${ui} не доставлено`) : await context.send(`✅ Успешное снятие для UID ${ui}`)
                }
                break;
            default:
                passer = false
                break;
        }
        if (!passer) { infinity_pay = true; return context.send(`⚠ Производится отмена команды, недопустимая операция!`) }
        const answer = await context.question(`${ico_list['load'].ico} Вы уверены, что хотите приступить к процедуре повторного отчисления?`,
            {	
                keyboard: Keyboard.builder()
                .textButton({ label: 'Полностью', payload: { command: 'Согласиться' }, color: 'positive' }).row()
                .textButton({ label: 'Передумал(а)', payload: { command: 'Отказаться' }, color: 'negative' }).oneTime(),
                answerTimeLimit
            }
        );
        if (answer.isTimeout) { infinity_pay = true; return await context.send(`⏰ Время ожидания подтверждения согласия истекло!`) }
        if (!/да|yes|Согласиться|конечно|✏|Полностью|полностью/i.test(answer.text|| '{}')) {
            await context.send(`${ico_list['stop'].ico} Вы отменили режим повторных операций!`)
            infinity_pay = true; 
        }
    }
}

//Модуль мульти начислений
async function Coin_Engine_Many(uids: number[], context: any, person_adm: User) {
    const user: User | null | undefined = await prisma.user.findFirst({ where: { id: uids[0] } })
    const person: { coin: LightAllianceCoin | null, operation: string | null, amount: number } = { coin: null, operation: null, amount: 0 }
    if (!user) { return }
    const alli_get = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 } })
    const coin_pass = await prisma.allianceCoin.findMany({ 
        where: { id_alliance: Number(user?.id_alliance) },
        select: {
            id: true,
            name: true,
            smile: true,
            point: true,
            converted: true,
            converted_point: true,
            sbp_on: true,
            course_medal: true,
            course_coin: true
        }
    }) as LightAllianceCoin[];
    if (!coin_pass) { return context.send(`Валют ролевых пока еще нет, чтобы начать=)`) }
    let coin_check = false
    let id_builder_sent = 0
    while (!coin_check) {
        const keyboard = new KeyboardBuilder()
        id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
        let event_logger = `❄ Выберите валюту, с которой будем делать отчисления:\n\n`
        const builder_list: LightAllianceCoin[] = coin_pass
        if (builder_list.length > 0) {
            const limiter = 5
            let counter = 0
            for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                const builder = builder_list[i]
                keyboard.textButton({ label: `${builder.smile}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent: i, target: builder }, color: 'secondary' }).row()
                event_logger += `\n\n💬 ${builder.smile} -> ${builder.id} - ${builder.name}\n`
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
            event_logger = `💬 Админы ролевой еще не создали ролевые валюты`
            return context.send(`💬 Админы ролевой еще не создали ролевые валюты`)
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
                person.coin = answer1.payload.target
                coin_check = true
            }
        }
    }
    let answer_check = false
    while (answer_check == false) {
        const answer_selector = await context.question(`🧷 Укажите вариант операции:`,
            {	
                keyboard: Keyboard.builder()
                .textButton({ label: '+', payload: { command: 'student' }, color: 'secondary' })
                .textButton({ label: '-', payload: { command: 'professor' }, color: 'secondary' })
                .oneTime().inline(), answerTimeLimit
            }
        )
        if (answer_selector.isTimeout) { return await context.send(`⏰ Время ожидания выбора статуса истекло!`) }
        if (!answer_selector.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            person.operation = answer_selector.text
            answer_check = true
        }
    }
    person.amount = await Ipnut_Gold(context, `[массовая ${person.operation}${person.coin?.smile}]`) 
    const messa: string = await Ipnut_Message(context, `[массовая ${person.operation}${person.coin?.smile}]`)
    let passer = true
    switch (person.operation) {
        case '+':
            for (const ui of uids) {
                const pers = await prisma.user.findFirst({ where: { id: ui } })
                if (!pers) { continue }
                const pers_info_coin = await Person_Coin_Printer_Self(context, pers.id)
                const pers_info_facult_rank = await Facult_Coin_Printer_Self(context, pers.id)
                const pers_bal_coin: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: pers.id }})
                if (!pers_bal_coin) { continue }
                const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: pers.id_facult ?? 0 } })
                const money_put_plus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: pers_bal_coin?.id }, data: { amount: { increment: person.amount } } })
                const currentAlliance = await prisma.alliance.findFirst({ 
                    where: { id: pers.id_alliance ?? 0 } 
                });

                const singular = await getTerminology(currentAlliance?.id || 0, 'singular');
                const genitive = await getTerminology(currentAlliance?.id || 0, 'genitive');
                let facult_income = ''
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
                    const rank_put_plus: BalanceFacult | null = rank_put_plus_check ? await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { increment: person.amount } } }) : null
                    facult_income = rank_put_plus ? `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check?.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для ${genitive} [${alli_fac.smile} ${alli_fac.name}]` : ''
                }
                
                const notif_ans = await Send_Coin_Operation_Notification(
                    pers,
                    person.operation!,
                    person.amount,
                    person.coin?.smile ?? '',
                    pers_bal_coin.amount,
                    money_put_plus.amount,
                    messa,
                    facult_income
                )
                
                const ans_log = `🗿 @id${context.senderId}(${person_adm.name}) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_plus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) }
                await Logger(`User ${pers.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
                !notif_ans ? await context.send(`⚙ Сообщение для UID ${ui} не доставлено`) : await context.send(`✅ Успешное начисление для UID ${ui}`)
            }
            break;
        case '-':
            for (const ui of uids) {
                const pers = await prisma.user.findFirst({ where: { id: ui } })
                if (!pers) { continue }
                const pers_info_coin = await Person_Coin_Printer_Self(context, pers.id)
                const pers_info_facult_rank = await Facult_Coin_Printer_Self(context, pers.id)
                const pers_bal_coin: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: pers.id }})
                if (!pers_bal_coin) { continue }
                const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: pers.id_facult ?? 0 } })
                const money_put_minus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: pers_bal_coin.id }, data: { amount: { decrement: person.amount } } })
                const currentAlliance = await prisma.alliance.findFirst({ 
                    where: { id: pers.id_alliance ?? 0 } 
                });

                const singular = await getTerminology(currentAlliance?.id || 0, 'singular');
                const genitive = await getTerminology(currentAlliance?.id || 0, 'genitive');
                let facult_income = ''
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
                    if (rank_put_plus_check) {
                        const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { decrement: person.amount } } })
                        if (rank_put_plus) {
                            facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для ${genitive} [${alli_fac.smile} ${alli_fac.name}]`
                        }
                    }
                }
                
                const notif_ans = await Send_Coin_Operation_Notification(
                    pers,
                    person.operation!,
                    person.amount,
                    person.coin?.smile ?? '',
                    pers_bal_coin.amount,
                    money_put_minus.amount,
                    messa,
                    facult_income
                )
                
                const ans_log = `🗿 @id${context.senderId}(${person_adm.name}) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_minus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) }
                await Logger(`User ${pers.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
                !notif_ans ? await context.send(`⚙ Сообщение для UID ${ui} не доставлено`) : await context.send(`✅ Успешное снятие для UID ${ui}`)
            }
            break;
        default:
            passer = false
            break;
    }
    if (!passer) { return context.send(`⚠ Производится отмена команды, недопустимая операция!`) }
}

// модуль Министерских операций
async function Medal_Up_Many(uids: number[], context: any, person_adm: User) {
    const count: number = await Ipnut_Gold(context, 'массового начисления министерских жетонов') 
    const messa: string = await Ipnut_Message(context, 'массового начисления министерских жетонов')
    for (const ids of uids) {
        const id = Number(ids)
        const user_get: any = await prisma.user.findFirst({ where: { id } })
        if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
        const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { medal: user_get.medal + count } })
        const notif_ans = await Send_Message(user_get.idvk, `🔔 Уведомление для ${user_get.name} (UID: ${user_get.id})\n💬 "+ ${count}🔘" --> ${user_get.medal} + ${count} = ${money_put.medal}\n🧷 Сообщение: ${messa}`)
        !notif_ans ? await context.send(`⚙ Сообщение пользователю с 💳UID ${id} не доставлено`) : await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
        const ans_log = `🗿 @id${context.senderId}(${person_adm.name}) > "+🔘" > ${money_put.medal-count}🔘+${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
        await Send_Message(chat_id, ans_log)
        await Logger(`In a private chat, user ${user_get.idvk} got ${count} medal. Him/Her bank now ${money_put.medal} by admin ${context.senderId}`)
    }
}
async function Medal_Down_Many(uids: number[], context: any, person_adm: User) {
    const count: number = await Ipnut_Gold(context, 'массового снятия министерских жетонов') 
    const messa: string = await Ipnut_Message(context, 'массового снятия министерских жетонов')
    for (const ids of uids) {
        const id = Number(ids)
        const user_get: any = await prisma.user.findFirst({ where: { id } })
        if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
        if (user_get.medal-count >= 0) {
            const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { medal: user_get.medal - count } })
            const notif_ans = await Send_Message(user_get.idvk, `🔔 Уведомление для ${user_get.name} (UID: ${user_get.id})\n💬 "- ${count}🔘" --> ${user_get.medal} - ${count} = ${money_put.medal}\n🧷 Сообщение: ${messa}`)
            !notif_ans ? await context.send(`⚙ Сообщение пользователю с 💳UID ${id} не доставлено`) : await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
            const ans_log = `🗿 @id${context.senderId}(${person_adm.name}) > "-🔘" > ${money_put.medal+count}🔘-${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
            await Send_Message(chat_id, ans_log)
            await Logger(`In a private chat, user ${user_get.idvk} lost ${count} medal. Him/Her bank now ${money_put.medal} by admin ${context.senderId}`)
        } else {
            const confirmq = await context.question(`⌛ Вы хотите снять ${count}🔘 жетонов c счета ${user_get.name}, но счет этого ${user_get.spec} ${user_get.medal}. Уверены, что хотите сделать баланс: ${user_get.medal-count}`,
                {
                    keyboard: Keyboard.builder()
                    .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
                    .textButton({ label: 'Нет', payload: { command: 'medal_down' }, color: 'secondary' })
                    .oneTime().inline(),
                    answerTimeLimit
                }
            )
            if (confirmq.isTimeout) { return await context.send(`⏰ Время ожидания на снятие жетонов с ${user_get.name} истекло!`) }
            if (confirmq.payload.command === 'confirm') {
                const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { medal: user_get.medal - count } })
                const notif_ans = await Send_Message(user_get.idvk, `🔔 Уведомление для ${user_get.name} (UID: ${user_get.id})\n💬 "- ${count}🔘" --> ${user_get.medal} - ${count} = ${money_put.medal}\n🧷 Сообщение: ${messa}`)
                !notif_ans ? await context.send(`⚙ Сообщение пользователю с 💳UID ${id} не доставлено`) : await context.send(`⚙ Операция завершена успешно`)
                const ans_log = `🗿 @id${context.senderId}(${person_adm.name}) > "-🔘" > ${money_put.medal+count}🔘-${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                await Send_Message(chat_id, ans_log)
                await Logger(`In a private chat, user ${user_get.idvk} lost ${count} medal. Him/Her bank now ${money_put.medal} by admin ${context.senderId}`)
            } else {
                await context.send(`💡 Нужно быть жестче! Греби жетоны`)
            }
        }
    }
}
