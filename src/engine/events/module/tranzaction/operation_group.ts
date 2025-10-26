import { Keyboard, KeyboardBuilder } from "vk-io"
import { Accessed, Fixed_Number_To_Five, Keyboard_Index, Logger, Send_Message, Send_Coin_Operation_Notification } from "../../../core/helper"
import { answerTimeLimit, chat_id, timer_text } from "../../../.."
import prisma from "../prisma_client"
import { Person_Coin_Printer_Self } from "../person/person_coin"
import { Back, Ipnut_Gold, Ipnut_Message } from "./operation_global"
import { AllianceCoin, BalanceCoin, BalanceFacult, User } from "@prisma/client"
import { Facult_Coin_Printer_Self } from "../alliance/facult_rank"
import { ico_list } from "../data_center/icons_lib"

// В функции Operation_Group добавляем новую кнопку
export async function Operation_Group(context: any) {
    if (context.peerType == 'chat') { return }
    if (await Accessed(context) == 1) { return }
    let name_check = false
    let uids_prefab = null
    while (name_check == false) {
        const uid: any = await context.question( `🧷 Введите список 💳UID банковских счетов получателей формата:\n"UID1 UID2 .. UIDN"`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: '🚫Отмена', payload: { command: 'limited' }, color: 'secondary' })
                .oneTime().inline(),
                timer_text
            }
        )
        if (uid.isTimeout) { return await context.send('⏰ Время ожидания на ввод банковского счета получателя истекло!')}
        if (/(?:^|\s)(\d+)(?=\s|$)/g.test(uid.text)) {
            uids_prefab = uid.text.match(/(?:^|\s)(\d+)(?=\s|$)/g)
            await context.send(`⚙ Подготовка к массовым операциям, товарищ ДОК!`)
            name_check = true
        } else {
            if (uid.text == "🚫Отмена") { 
                await context.send(`💡 Операции прерваны пользователем!`) 
                return await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
            }
			await context.send(`💡 Необходимо ввести корректный UID!`)
		}
    }
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
    }
    const ans: any = await context.question( `✉ Доступны следующие операции с 💳UID: ${JSON.stringify(uids)}`,
        {   
            keyboard: keyboard
            .textButton({ label: `➕➖${info_coin?.smile}`, payload: { command: 'coin_engine_many' }, color: 'secondary' }).row()
            .textButton({ label: `♾️${info_coin?.smile}`, payload: { command: 'coin_engine_many_infinity' }, color: 'secondary' })
            .textButton({ label: `🎯${info_coin?.smile}`, payload: { command: 'coin_engine_many_custom' }, color: 'secondary' }).row() // НОВАЯ КНОПКА
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
        'coin_engine_many_custom': Coin_Engine_Many_Custom, // НОВАЯ ФУНКЦИЯ
        'medal_up_many': Medal_Up_Many,
        'medal_down_many': Medal_Down_Many
    }
    if (ans?.payload?.command in config) {
        const commandHandler = config[ans.payload.command];
        const answergot = await commandHandler(uids, context, person_adm)
    } else {
        await context.send(`⚙ Операция отменена пользователем.`)
    }
    await context.send(`✅ Процедура массовых операций под названием операция "Ы" успешно завершена!`)
    await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
}

// НОВАЯ ФУНКЦИЯ: Массовые операции с разными суммами
async function Coin_Engine_Many_Custom(uids: number[], context: any, person_adm: User) {
    const user: User | null | undefined = await prisma.user.findFirst({ where: { id: uids[0] } })
    const person: { coin: AllianceCoin | null, operation: string | null } = { coin: null, operation: null }
    if (!user) { return }
    const alli_get = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 } })
    const coin_pass: AllianceCoin[] = await prisma.allianceCoin.findMany({ where: { id_alliance: Number(user?.id_alliance) } })
    if (!coin_pass) { return context.send(`Валют ролевых пока еще нет, чтобы начать=)`) }
    
    // Выбор валюты
    let coin_check = false
    let id_builder_sent = 0
    while (!coin_check) {
        const keyboard = new KeyboardBuilder()
        id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
        let event_logger = `❄ Выберите валюту для массовых операций:\n\n`
        const builder_list: AllianceCoin[] = coin_pass
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
        if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания выбора валюты истекло!`) }
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
    
    // Выбор операции
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
        if (answer_selector.isTimeout) { return await context.send(`⏰ Время ожидания выбора операции истекло!`) }
        if (!answer_selector.payload) {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        } else {
            person.operation = answer_selector.text
            answer_check = true
        }
    }
    
    // Ввод данных в формате UID-СУММА
    const messa: string = await Ipnut_Message(context, `[массовая ${person.operation}${person.coin?.smile} с разными суммами]`)
    const users_target = await context.question(`📊 Введите список UID и сумм в формате:\nUID1-СУММА1\nUID2-СУММА2\nUID3-СУММА3\n...\n\nПример:\n5-3402\n6-23.4\n7-53`, 
        { answerTimeLimit }
    )
    
    if (users_target.isTimeout) { return await context.send(`⏰ Время ожидания ввода данных истекло!`) }

    const lines = users_target.text.split('\n').map((line: string) => line.trim());
    const uid_res: Array<{ id: number, amount: number }> = []

    for (const line of lines) {
        if (!line.includes('-')) {
            await context.send(`⚠ Неверный формат: ${line}`);
            continue;
        }

        const [uidStr, amountStr] = line.split('-').map((s: string) => s.trim());
        const uid = parseInt(uidStr);
        const amount = parseFloat(amountStr);

        if (isNaN(uid) || isNaN(amount)) {
            await context.send(`⚠ Неверный формат: ${line}`);
            continue;
        }

        // Проверяем, что UID есть в исходном списке
        if (!uids.includes(uid)) {
            await context.send(`⚠ UID ${uid} не был в исходном списке получателей`);
            continue;
        }

        const user = await prisma.user.findFirst({ where: { id: uid } });
        if (!user) {
            await context.send(`❌ Пользователь с UID ${uid} не найден.`);
            continue;
        }

        uid_res.push({ id: uid, amount: amount });
    }

    if (uid_res.length === 0) {
        return await context.send(`❌ Не удалось обработать ни одной записи. Операция отменена.`);
    }

    // Выполнение операций
    let passer = true
    switch (person.operation) {
        case '+':
            for (const ui of uid_res) {
                const pers = await prisma.user.findFirst({ where: { id: ui.id } })
                if (!pers) { await context.send(`UID ${ui.id} не найдено`); continue }
                const pers_bal_coin: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: pers.id }})
                if (!pers_bal_coin) { await context.send(`UID ${ui.id} не открыт валютный счет`); continue }
                const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: pers.id_facult ?? 0 } })
                const money_put_plus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: pers_bal_coin?.id }, data: { amount: { increment: ui.amount } } })
                let facult_income = ''
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
                    const rank_put_plus: BalanceFacult | null = rank_put_plus_check ? await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { increment: ui.amount } } }) : null
                    facult_income = rank_put_plus ? `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check?.amount} ${person.operation} ${ui.amount} = ${rank_put_plus.amount} для Факультета [${alli_fac.smile} ${alli_fac.name}]` : ''
                }
                
                const notif_ans = await Send_Coin_Operation_Notification(
                    pers,
                    person.operation!,
                    ui.amount,
                    person.coin?.smile ?? '',
                    pers_bal_coin.amount,
                    money_put_plus.amount,
                    messa,
                    facult_income
                )
                
                const ans_log = `🎯 @id${context.senderId}(${person_adm.name}) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${ui.amount} = ${money_put_plus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) }
                await Logger(`User ${pers.idvk} ${person.operation} ${ui.amount} gold. Him/Her bank now unknown`)
                !notif_ans ? await context.send(`⚙ Сообщение для UID ${ui.id} не доставлено`) : await context.send(`✅ Успешное начисление для UID ${ui.id}: +${ui.amount}${person.coin?.smile}`)
            }
            break;
        case '-':
            for (const ui of uid_res) {
                const pers = await prisma.user.findFirst({ where: { id: ui.id } })
                if (!pers) { await context.send(`UID ${ui.id} не найдено`); continue }
                const pers_bal_coin: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: pers.id }})
                if (!pers_bal_coin) { await context.send(`UID ${ui.id} не открыт валютный счет`); continue }
                const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: pers.id_facult ?? 0 } })
                const money_put_minus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: pers_bal_coin.id }, data: { amount: { decrement: ui.amount } } })
                let facult_income = ''
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
                    if (rank_put_plus_check) {
                        const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { decrement: ui.amount } } })
                        if (rank_put_plus) {
                            facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${ui.amount} = ${rank_put_plus.amount} для Факультета [${alli_fac.smile} ${alli_fac.name}]`
                        }
                    }
                }
                
                const notif_ans = await Send_Coin_Operation_Notification(
                    pers,
                    person.operation!,
                    ui.amount,
                    person.coin?.smile ?? '',
                    pers_bal_coin.amount,
                    money_put_minus.amount,
                    messa,
                    facult_income
                )
                
                const ans_log = `🎯 @id${context.senderId}(${person_adm.name}) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${ui.amount} = ${money_put_minus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) }
                await Logger(`User ${pers.idvk} ${person.operation} ${ui.amount} gold. Him/Her bank now unknown`)
                !notif_ans ? await context.send(`⚙ Сообщение для UID ${ui.id} не доставлено`) : await context.send(`✅ Успешное снятие для UID ${ui.id}: -${ui.amount}${person.coin?.smile}`)
            }
            break;
        default:
            passer = false
            break;
    }
    if (!passer) { return context.send(`⚠ Производится отмена команды, недопустимая операция!`) }
}

//Модуль мульти начислений в цикле
async function Coin_Engine_Many_Infinity(uids: number[], context: any, person_adm: User) {
    const user: User | null | undefined = await prisma.user.findFirst({ where: { id: uids[0] } })
    const person: { coin: AllianceCoin | null, operation: string | null, amount: number } = { coin: null, operation: null, amount: 0 }
    if (!user) { return }
    const alli_get = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 } })
    const coin_pass: AllianceCoin[] = await prisma.allianceCoin.findMany({ where: { id_alliance: Number(user?.id_alliance) } })
    if (!coin_pass) { return context.send(`Валют ролевых пока еще нет, чтобы начать=)`) }
    let infinity_pay = false
    while (!infinity_pay) {
        let coin_check = false
        let id_builder_sent = 0
        while (!coin_check) {
            const keyboard = new KeyboardBuilder()
            id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
            let event_logger = `❄ Выберите валюту, с которой будем делать отчисления:\n\n`
            const builder_list: AllianceCoin[] = coin_pass
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
                    let facult_income = ''
                    if (person.coin?.point == true && alli_fac) {
                        const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
                        const rank_put_plus: BalanceFacult | null = rank_put_plus_check ? await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { increment: person.amount } } }) : null
                        facult_income = rank_put_plus ? `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check?.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для факультета [${alli_fac.smile} ${alli_fac.name}]` : ''
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
                    let facult_income = ''
                    if (person.coin?.point == true && alli_fac) {
                        const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
                        if (rank_put_plus_check) {
                            const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { decrement: person.amount } } })
                            if (rank_put_plus) {
                                facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для Факультета [${alli_fac.smile} ${alli_fac.name}]`
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
    const person: { coin: AllianceCoin | null, operation: string | null, amount: number } = { coin: null, operation: null, amount: 0 }
    if (!user) { return }
    const alli_get = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 } })
    const coin_pass: AllianceCoin[] = await prisma.allianceCoin.findMany({ where: { id_alliance: Number(user?.id_alliance) } })
    if (!coin_pass) { return context.send(`Валют ролевых пока еще нет, чтобы начать=)`) }
    let coin_check = false
    let id_builder_sent = 0
    while (!coin_check) {
        const keyboard = new KeyboardBuilder()
        id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
        let event_logger = `❄ Выберите валюту, с которой будем делать отчисления:\n\n`
        const builder_list: AllianceCoin[] = coin_pass
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
                let facult_income = ''
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
                    const rank_put_plus: BalanceFacult | null = rank_put_plus_check ? await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { increment: person.amount } } }) : null
                    facult_income = rank_put_plus ? `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check?.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для Факультета [${alli_fac.smile} ${alli_fac.name}]` : ''
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
                let facult_income = ''
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: pers.id_facult! } }) 
                    if (rank_put_plus_check) {
                        const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { decrement: person.amount } } })
                        if (rank_put_plus) {
                            facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для Факультета [${alli_fac.smile} ${alli_fac.name}]`
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
        }
    }
}
