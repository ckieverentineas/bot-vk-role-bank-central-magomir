import { HearManager } from "@vk-io/hear";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { IQuestionMessageContext } from "vk-io-question";
import { answerTimeLimit, chat_id, root, timer_text, timer_text_oper, vk } from '../index';
import { Accessed, Fixed_Number_To_Five, Keyboard_Index, Logger, Send_Message } from "./core/helper";
import prisma from "./events/module/prisma_client";
import { User_Info } from "./events/module/tool";
import { Account, Alliance, AllianceCoin, AllianceFacult, BalanceCoin, BalanceFacult, Item, User } from "@prisma/client";
import { Person_Detector, Person_Get, Person_Register, Person_Selector } from "./events/module/person/person";
import { Alliance_Add, Alliance_Updater } from "./events/module/alliance/alliance";
import { Alliance_Coin_Printer } from "./events/module/alliance/alliance_coin";
import { Alliance_Facult_Printer } from "./events/module/alliance/alliance_facult";
import { Person_Coin_Printer_Self } from "./events/module/person/person_coin";
import { Facult_Coin_Printer_Self } from "./events/module/alliance/facult_rank";
import { Alliance_Coin_Converter_Printer } from "./events/module/converter";
import { Alliance_Coin_Converter_Editor_Printer } from "./events/module/alliance/alliance_converter_editor";
import { Alliance_Year_End_Printer } from "./events/module/alliance/alliance_year_end";
import { Alliance_Coin_Rank_Admin_Printer } from "./events/module/rank/rank_alliance";
import { Alliance_Monitor_Printer } from "./events/module/alliance/monitor";
import { restartMonitor, stopMonitor } from "../monitring";
import { ico_list } from "./events/module/data_center/icons_lib";
import { Operation_Solo } from "./events/module/tranzaction/operation_solo";

export function registerUserRoutes(hearManager: HearManager<IQuestionMessageContext>): void {
    hearManager.hear(/Лютный переулок/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (context.senderId == root) {
            console.log(`Admin ${context.senderId} enter in shopping`)
            const category:any = await prisma.category.findMany({})
            if (category.length == 0) {
                const ans: any = await context.question(
                    `✉ Магазинов еще нет`,
                    {   keyboard: Keyboard.builder()
                        .textButton({   label: 'Добавить магазин',
                                        payload: {  command: 'new_shop' },
                                        color: 'secondary'                  })
                        .oneTime().inline()                                     }
                )
                if (ans.payload.command == 'new_shop') {
                    const shop: any = await context.question(`🧷 Введите название магазина:`)
                    const shop_create = await prisma.category.create({  data: { name: shop.text }   })
                    console.log(`User ${context.senderId} open new shop`)
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `⚙ @id${context.senderId}(ROOT) пользователь открывает следующий магазин ${shop_create.name}`
                    })
                    await context.send(`⚙ Вы открыли следующий магазин ${shop_create.name}`)
                }
            } else {
                let keyboard = Keyboard.builder()
                category.forEach(async (element: any) => {
                    keyboard.textButton({   label: element.name,
                                            payload: { command: `${element.id}` }   })
                    .textButton({   label: "Удалить",
                                    payload: { command: `${element.id}` }   }).row()
                })
                const ans: any = await context.question(`✉ Куда пойдем?`,
                    {   keyboard: keyboard
                        .textButton({   label: 'Добавить магазин',
                                        payload: { command: 'new_shop' },
                                        color: 'secondary'                  })
                        .oneTime().inline()                                     })
                if (ans.text == "Удалить") {
                    const shop_delete = await prisma.category.delete({ where: { id: Number(ans.payload.command) } })
                    console.log(`User ${context.senderId} close shop`)
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `⚙ @id${context.senderId}(ROOT) пользователь закрывает следующий магазин ${shop_delete.name}`
                    })
                    await context.send(`⚙ Удален магазин ${shop_delete.name}`)
                }
                if (ans.payload?.command == 'new_shop') {
                    const shop: any = await context.question( `🧷 Введите название магазина:` )
                    const shop_create: any = await prisma.category.create({ data: { name: shop.text } })
                    console.log(`User ${context.senderId} open new shop`)
                    await context.send(`⚙ Вы открыли следующий магазин ${shop_create.name}`)
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `⚙ @id${context.senderId}(ROOT) пользователь открыл следующий магазин ${shop_create.name}`
                    })
                }
                if (category.find((i: any) => i.name == ans.text)) {
                    await context.send(`⌛ Вы оказались в ${ans.text}`)
                    const item: any= await prisma.item.findMany({ where: { id_category: Number(ans.payload.command) } })
                    if (item.length == 0) {
                        await context.send(`✉ К сожалению приалвки пока что пусты=/`)
                    } else {
                        item.forEach(async (element: any) => {
                            await context.send(`🛍 ${element.name} ${element.price}💰`,
                                {
                                    keyboard: Keyboard.builder()
                                    .textButton({ label: 'Купить', payload: { command: `${element.name}` }, color: 'secondary' })
                                    .textButton({ label: '✏Имя', payload: { command: `${element.name}` }, color: 'secondary' })
                                    .textButton({ label: '✏Тип', payload: { command: `${element.name}` }, color: 'secondary' })
                                    .oneTime().inline()                                             
                                }
                            )  
                        })
                    }
                    const ans_item: any = await context.question( `✉ Что будем делать?`,
                        {   
                            keyboard: Keyboard.builder()
                            .textButton({ label: 'Добавить товар', payload: { command: 'new_item' }, color: 'secondary' })
                            .textButton({ label: 'Перейти к покупкам', payload: { command: 'continue' }, color: 'secondary' })
                            .oneTime().inline()
                        }
                    )
                    if (ans_item.payload?.command == 'new_item') {
                        const item_name: any = await context.question( `🧷 Введите название предмета:` )
                        const item_price = await context.question( `🧷 Введите его ценность:` )
                        const item_type: any = await context.question( `🧷 Укажите тип товара: \n 🕐 — покупается пользователем однажды; \n ♾ — покупается пользователем бесконечное количество раз.`,
                            {   keyboard: Keyboard.builder()
                                .textButton({   label: '🕐',
                                                payload: { command: 'limited' },
                                                color: 'secondary'                  })
                                .textButton({   label: '♾',
                                                payload: { command: 'unlimited' },
                                                color: 'secondary'                  })
                                .oneTime().inline()                                     }
                        )
                        const item_create = await prisma.item.create({ data: {  name: item_name.text, price: Number(item_price.text), id_category: Number(ans.payload.command), type: item_type.payload.command } })
                        console.log(`User ${context.senderId} added new item ${item_create.id}`)
                        await context.send(`⚙ Для магазина ${ans.text} добавлен новый товар ${item_name.text} стоимостью ${item_price.text} галлеонов`)
                        await vk.api.messages.send({
                            peer_id: chat_id,
                            random_id: 0,
                            message: `⚙ @id${context.senderId}(ROOT) пользователь добавляет новый товар ${item_name.text} стоимостью ${item_price.text} галлеонов`
                        })
                    }
                    if (ans_item.payload.command == 'continue') { await context.send(`💡 Нажимайте кнопку купить у желаемого товара`) }
                }
            }
        }
        await Keyboard_Index(context, `💡 А может быть в косом переулке есть подполье?`)
    })
    hearManager.hear(/✏Тип/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (context.messagePayload == null && context.senderId != root) {
            await Logger(`In a private chat, stop correction item type user is viewed by admin ${context.senderId}`)
            return
        }
        const item_buy:any = await prisma.item.findFirst({ where: { name: context.messagePayload.command } })
        if (item_buy) {
            const item_type: any = await context.question( `🧷 Укажите тип товара для ${item_buy.name}: \n 🕐 — покупается пользователем однажды; \n ♾ — покупается пользователем бесконечное количество раз. \n Текущий тип: ${item_buy.type}`,
                {   
                    keyboard: Keyboard.builder()
                    .textButton({ label: '🕐', payload: { command: 'limited' }, color: 'secondary' })
                    .textButton({ label: '♾', payload: { command: 'unlimited' }, color: 'secondary' })
                    .oneTime().inline()
                }
            )
            const item_update = await prisma.item.update({ where: { id: item_buy.id }, data: { type: item_type.payload.command } })
            console.log(`Admin ${context.senderId} edit type item ${item_buy.id}`)
            await context.send(`⚙ Тип предмета ${item_buy.name} изменен с ${item_buy.type} на ${item_update.type}`)
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(ROOT) пользователь корректирует тип предмета ${item_buy.name} с ${item_buy.type} на ${item_update.type}`
            })
        } else {
            console.log(`Admin ${context.senderId} can't edit type item ${item_buy.id}`)
            await context.send(`✉ Тип предмета не удалось поменять`)
        }
        await Keyboard_Index(context, `💡 Вот бы всегда безлимит, и редактировать бы ничего не пришлось?`)
    })
    hearManager.hear(/✏Имя/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (context.messagePayload == null && context.senderId != root) {
            await Logger(`In a private chat, stop correction name item is viewed by admin ${context.senderId}`)
            return
        }
        const item_buy:any = await prisma.item.findFirst({ where: { name: context.messagePayload.command } })
        if (item_buy) {
            const name: any = await context.question(`🧷 Предмет: ${item_buy.name}.\nВведите новое имя для товара:`)
            const item_update = await prisma.item.update({ where: { id: item_buy.id }, data: { name: name.text } })
            console.log(`Admin ${context.senderId} edit name item ${item_buy.id}`)
            await context.send(`⚙ Имя предмета ${item_buy.name} изменено на ${item_update.name}`)
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(ROOT) пользователь корректирует имя предмета с ${item_buy.name} на ${item_update.name}`
            })
        } else {
            console.log(`Admin ${context.senderId} can't edit name item ${item_buy.id}`)
            await context.send(`✉ Имя предмета не удалось поменять`)
        }
        await Keyboard_Index(context, `💡 Может еще что-нибудь отредактировать?`)
    })
    hearManager.hear(/!опмасс/, async (context) => {
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
                .textButton({ label: `♾️${info_coin?.smile}`, payload: { command: 'coin_engine_many_infinity' }, color: 'secondary' }).row()
                /*.textButton({ label: '+💰', payload: { command: 'gold_up_many' }, color: 'secondary' })
                .textButton({ label: '—💰', payload: { command: 'gold_down_many' }, color: 'secondary' }).row()
                .textButton({ label: '+🧙', payload: { command: 'xp_up_many' }, color: 'secondary' })
                .textButton({ label: '—🧙', payload: { command: 'xp_down_many' }, color: 'secondary' }).row()
                .textButton({ label: '+💰🧙', payload: { command: 'multi_up_many' }, color: 'secondary' })
                .textButton({ label: '—💰🧙', payload: { command: 'multi_down_many' }, color: 'secondary' }).row()*/
                .textButton({ label: '🔙', payload: { command: 'back' }, color: 'secondary' }).row()
                .oneTime().inline(),
                answerTimeLimit                                                                       
            }
        )
        if (ans.isTimeout) { return await context.send(`⏰ Время ожидания на ввод операции с 💳UID: ${JSON.stringify(uids)} истекло!`) }
        const config: any = {
            //'gold_up_many': Gold_Up_Many,
            //'gold_down_many': Gold_Down_Many,
            //'xp_up_many': Xp_Up_Many,
            //'xp_down_many': Xp_Down_Many,
            'back': Back,
            //'multi_up_many': Multi_Up_Many,
            //'multi_down_many': Multi_Down_Many,
            'coin_engine_many': Coin_Engine_Many,
            'coin_engine_many_infinity': Coin_Engine_Many_Infinity,
            'medal_up_many': Medal_Up_Many,
            'medal_down_many': Medal_Down_Many
        }
        if (ans?.payload?.command in config) {
            const commandHandler = config[ans.payload.command];
            const answergot = await commandHandler(uids)
        } else {
            await context.send(`⚙ Операция отменена пользователем.`)
        }
        await context.send(`✅ Процедура массовых операций под названием операция "Ы" успешно завершена!`)
        await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
        //Модуль мульти начислений в цикле
        async function Coin_Engine_Many_Infinity(uids: number[]) {
            const user: User | null | undefined = await prisma.user.findFirst({ where: { id: uids[0] } })
            const person: { coin: AllianceCoin | null, operation: String | null, amount: number } = { coin: null, operation: null, amount: 0 }
            if (!user) { return }
            const coin_pass: AllianceCoin[] = await prisma.allianceCoin.findMany({ where: { id_alliance: Number(user?.id_alliance) } })
            if (!coin_pass) { return context.send(`Валют ролевых пока еще нет, чтобы начать=)`) }
            let infinity_pay = false
            while (!infinity_pay) {
                let coin_check = false
                let id_builder_sent = 0
                while (!coin_check) {
                    const keyboard = new KeyboardBuilder()
                    id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
                    let event_logger = `❄ Выберите валюту с которой будем делать отчисления:\n\n`
                    const builder_list: AllianceCoin[] = coin_pass
                    if (builder_list.length > 0) {
                        const limiter = 5
                        let counter = 0
                        for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                            const builder = builder_list[i]
                            keyboard.textButton({ label: `${builder.smile}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent: i, target: builder }, color: 'secondary' }).row()
                            //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
                            event_logger += `\n\n💬 ${builder.smile} -> ${builder.id} - ${builder.name}\n`
                            /*
                            const services_ans = await Builder_Lifer(user, builder, id_planet)*/
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
	            			//.textButton({ label: '/', payload: { command: 'citizen' }, color: 'secondary' })
                            //.textButton({ label: '*', payload: { command: 'citizen' }, color: 'secondary' }).row()
                            //.textButton({ label: '!', payload: { command: 'citizen' }, color: 'secondary' })
                            //.textButton({ label: '√', payload: { command: 'citizen' }, color: 'secondary' })
                            //.textButton({ label: 'log', payload: { command: 'citizen' }, color: 'secondary' })
                            //.textButton({ label: 'log10', payload: { command: 'citizen' }, color: 'secondary' })
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
                person.amount = await Ipnut_Gold() 
                const messa: string = await Ipnut_Message()
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
                            await Send_Message(pers.idvk, `⚙ Вам ${person.operation} ${person.amount}${person.coin?.smile}. \nВаш счёт изменяется магическим образом: ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_plus.amount}\n Уведомление: ${messa}\n${facult_income}`)
                            await Send_Message(chat_id, `🗿 @id${context.senderId}(Admin) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_plus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`)
                            await Logger(`User ${pers.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
                            await context.send(`✅ Успешное начисление для UID ${ui}`)
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
                            await Send_Message(pers.idvk, `⚙ Вам ${person.operation} ${person.amount}${person.coin?.smile}. \nВаш счёт изменяется магическим образом: ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_minus.amount}\n Уведомление: ${messa}\n${facult_income}`)
                            await Send_Message(chat_id, `🗿 @id${context.senderId}(Admin) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_minus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`)
                            await Logger(`User ${pers.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
                            await context.send(`✅ Успешное начисление для UID ${ui}`)
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
                    await context.send(`${ico_list['cancel'].ico} Вы отменили режим повторных операций!`)
	            	infinity_pay = true; 
	            }
            }
        }
        //Модуль мульти начислений
        async function Coin_Engine_Many(uids: number[]) {
            const user: User | null | undefined = await prisma.user.findFirst({ where: { id: uids[0] } })
            const person: { coin: AllianceCoin | null, operation: String | null, amount: number } = { coin: null, operation: null, amount: 0 }
            if (!user) { return }
            const coin_pass: AllianceCoin[] = await prisma.allianceCoin.findMany({ where: { id_alliance: Number(user?.id_alliance) } })
            if (!coin_pass) { return context.send(`Валют ролевых пока еще нет, чтобы начать=)`) }
            let coin_check = false
            let id_builder_sent = 0
            while (!coin_check) {
                const keyboard = new KeyboardBuilder()
                id_builder_sent = await Fixed_Number_To_Five(id_builder_sent)
                let event_logger = `❄ Выберите валюту с которой будем делать отчисления:\n\n`
                const builder_list: AllianceCoin[] = coin_pass
                if (builder_list.length > 0) {
                    const limiter = 5
                    let counter = 0
                    for (let i=id_builder_sent; i < builder_list.length && counter < limiter; i++) {
                        const builder = builder_list[i]
                        keyboard.textButton({ label: `${builder.smile}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent: i, target: builder }, color: 'secondary' }).row()
                        //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
                        event_logger += `\n\n💬 ${builder.smile} -> ${builder.id} - ${builder.name}\n`
                        /*
                        const services_ans = await Builder_Lifer(user, builder, id_planet)*/
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
	        			//.textButton({ label: '/', payload: { command: 'citizen' }, color: 'secondary' })
                        //.textButton({ label: '*', payload: { command: 'citizen' }, color: 'secondary' }).row()
                        //.textButton({ label: '!', payload: { command: 'citizen' }, color: 'secondary' })
                        //.textButton({ label: '√', payload: { command: 'citizen' }, color: 'secondary' })
                        //.textButton({ label: 'log', payload: { command: 'citizen' }, color: 'secondary' })
                        //.textButton({ label: 'log10', payload: { command: 'citizen' }, color: 'secondary' })
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
            person.amount = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
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
                        await Send_Message(pers.idvk, `⚙ Вам ${person.operation} ${person.amount}${person.coin?.smile}. \nВаш счёт изменяется магическим образом: ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_plus.amount}\n Уведомление: ${messa}\n${facult_income}`)
                        await Send_Message(chat_id, `🗿 @id${context.senderId}(Admin) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_plus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`)
                        await Logger(`User ${pers.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
                        await context.send(`✅ Успешное начисление для UID ${ui}`)
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
                        await Send_Message(pers.idvk, `⚙ Вам ${person.operation} ${person.amount}${person.coin?.smile}. \nВаш счёт изменяется магическим образом: ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_minus.amount}\n Уведомление: ${messa}\n${facult_income}`)
                        await Send_Message(chat_id, `🗿 @id${context.senderId}(Admin) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${person.amount} = ${money_put_minus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`)
                        await Logger(`User ${pers.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
                        await context.send(`✅ Успешное начисление для UID ${ui}`)
                    }
                    break;
                default:
                    passer = false
                    break;
            }
            if (!passer) { return context.send(`⚠ Производится отмена команды, недопустимая операция!`) }
        }
        /*
        async function Multi_Up_Many(uids: number[]) {
            await context.send(`⚠ Приступаем к начислению галлеонов`)
            const gold: number = await Ipnut_Gold() 
            await context.send(`⚠ Приступаем к начислению магического опыта`)
            const xp: number = await Ipnut_Gold()
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: User | null = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                const money_put = await prisma.user.update({ where: { id: user_get?.id }, data: { gold: { increment: gold }, xp: { increment: xp } } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get?.idvk,
                        random_id: 0,
                        message: `⚙ Вам начислено ${gold}💰 ${xp}🧙. \n\nВаш счёт:\n${money_put.gold}💰\n${money_put.xp}🧙\n\n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get?.idvk} blocked chating with bank`)
                    await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `🗿 @id${context.senderId}(Admin) > "+💰🧙" >\n${user_get?.gold}+${gold}=${money_put.gold}💰\n${user_get?.xp}+${xp}=${money_put.xp}🧙\n для @id${user_get?.idvk}(${user_get?.name}) 🧷: ${messa}`
                })
                await Logger(`In a private chat, user ${user_get?.idvk} got ${gold} gold and ${xp} xp. Him/Her bank now ${money_put.gold} by admin ${context.senderId}`)
            }
        }
        async function Multi_Down_Many(uids: number[]) {
            await context.send(`⚠ Приступаем к снятию галлеонов`)
            const gold: number = await Ipnut_Gold() 
            await context.send(`⚠ Приступаем к снятию магического опыта`)
            const xp: number = await Ipnut_Gold()
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: User | null = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                const money_put = await prisma.user.update({ where: { id: user_get?.id }, data: { gold: { decrement: gold }, xp: { decrement: xp } } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get?.idvk,
                        random_id: 0,
                        message: `⚙ С вас снято ${gold}💰 ${xp}🧙. \n\nВаш счёт:\n${money_put.gold}💰\n${money_put.xp}🧙\n\n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get?.idvk} blocked chating with bank`)
                    await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `🗿 @id${context.senderId}(Admin) > "-💰🧙" >\n${user_get?.gold}-${gold}=${money_put.gold}💰\n${user_get?.xp}-${xp}=${money_put.xp}🧙\n для @id${user_get?.idvk}(${user_get?.name}) 🧷: ${messa}`
                })
                await Logger(`In a private chat, user ${user_get?.idvk} left ${gold} gold and ${xp} xp. Him/Her bank now ${money_put.gold} by admin ${context.senderId}`)
            }
        }
        //Модуль начислений
        async function Gold_Up_Many(uids: number[]) {
            const count: number = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: any = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { gold: user_get.gold + count } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get.idvk,
                        random_id: 0,
                        message: `⚙ Вам начислено ${count}💰. \nВаш счёт: ${money_put.gold}💰 \n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get.idvk} blocked chating with bank`)
                    await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `🗿 @id${context.senderId}(Admin) > "+💰" > ${money_put.gold-count}💰+${count}💰=${money_put.gold}💰 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                })
                await Logger(`In a private chat, user ${user_get.idvk} got ${count} gold. Him/Her bank now ${money_put.gold} by admin ${context.senderId}`)
            }
        }
        async function Gold_Down_Many(uids: number[]) {
            const count: number = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: any = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                if (user_get.gold-count >= 0) {
                    const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { gold: user_get.gold - count } })
                    try {
                        await vk.api.messages.send({
                            user_id: user_get.idvk,
                            random_id: 0,
                            message: `⚙ С вас снято ${count}💰. \nВаш счёт: ${money_put.gold}💰 \n Уведомление: ${messa}`
                        })
                        await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                    } catch (error) {
                        console.log(`User ${user_get.idvk} blocked chating with bank`)
                        await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                    }
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `🗿 @id${context.senderId}(Admin) > "-💰" > ${money_put.gold+count}💰-${count}💰=${money_put.gold}💰 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                    })
                    await Logger(`In a private chat, user ${user_get.idvk} lost ${count} gold. Him/Her bank now ${money_put.gold} by admin ${context.senderId}`)
                } else {
                    const confirmq = await context.question(`⌛ Вы хотите снять ${count} 💰галлеонов c счета ${user_get.name}, но счет этого ${user_get.spec} ${user_get.gold}. Уверены, что хотите сделать баланс: ${user_get.gold-count}`,
                        {
                            keyboard: Keyboard.builder()
                            .textButton({ label: 'Да', payload: { command: 'confirm' }, color: 'secondary' })
                            .textButton({ label: 'Нет', payload: { command: 'gold_down' }, color: 'secondary' })
                            .oneTime().inline(),
                            answerTimeLimit
                        }
                    )
                    if (confirmq.isTimeout) { return await context.send(`⏰ Время ожидания на снятие галлеонов с ${user_get.name} истекло!`) }
                    if (confirmq.payload.command === 'confirm') {
                        const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { gold: user_get.gold - count } })
                        try {
                            await vk.api.messages.send({
                                user_id: user_get.idvk, random_id: 0,
                                message: `⚙ С вас снято ${count}💰. \nВаш счёт: ${money_put.gold}💰 \n Уведомление: ${messa}`
                            })
                            await context.send(`⚙ Операция завершена успешно`)
                        } catch (error) {
                            console.log(`User ${user_get.idvk} blocked chating with bank`)
                            await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                        }
                        await vk.api.messages.send({
                            peer_id: chat_id,
                            random_id: 0,
                            message: `🗿 @id${context.senderId}(Admin) > "-💰" > ${money_put.gold+count}💰-${count}💰=${money_put.gold}💰 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                        })
                        await Logger(`In a private chat, user ${user_get.idvk} lost ${count} gold. Him/Her bank now ${money_put.gold} by admin ${context.senderId}`)
                    } else {
                        await context.send(`💡 Нужно быть жестче! Греби бабло`)
                    }
                }
            }
        }
        async function Xp_Up_Many(uids: number[]) {
            const count: number = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: any = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { xp: user_get.xp + count } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get.idvk,
                        random_id: 0,
                        message: `⚙ Вам начислено ${count}🧙. \nВаш МО: ${money_put.xp}🧙 \n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get.idvk} blocked chating with bank`)
                    await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `🗿 @id${context.senderId}(Admin) > "+🧙" > ${money_put.xp-count}🧙+${count}🧙=${money_put.xp}🧙 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                })
                await Logger(`In a private chat, user ${user_get.idvk} got ${count} MO. Him/Her XP now ${money_put.xp} by admin ${context.senderId}`)
            }
        }
        async function Xp_Down_Many(uids: number[]) {
            const count: number = await Ipnut_Gold() 
            if (count === 0) { return }
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: any = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                if (user_get.xp-count >= 0) {
                    const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { xp: user_get.xp - count } })
                    try {
                        await vk.api.messages.send({
                            user_id: user_get.idvk,
                            random_id: 0,
                            message: `⚙ С вас снято ${count}🧙. \nВаш МО: ${money_put.xp}🧙  \n Уведомление: ${messa}`
                        })
                        await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                    } catch (error) {
                        console.log(`User ${user_get.idvk} blocked chating with bank`)
                        await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                    }
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `🗿 @id${context.senderId}(Admin) > "-🧙" > ${money_put.xp+count}🧙-${count}🧙=${money_put.xp}🧙 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                    })
                    await Logger(`In a private chat, user ${user_get.idvk} lost ${count} MO. Him/Her XP now ${money_put.xp} by admin ${context.senderId}`)
                } else {
                    await context.send(`⌛ Вы хотите снять ${count} 🧙магического опыта c счета ${user_get.name}, но счет этого ${user_get.spec} ${user_get.xp}. Уверены, что хотите сделать баланс: ${user_get.xp-count}? (Автоподтверждение)`)
                    const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { xp: user_get.xp - count } })
                    try {
                        await vk.api.messages.send({
                            user_id: user_get.idvk,
                            random_id: 0,
                            message: `⚙ С вас снято ${count}🧙. \nВаш МО: ${money_put.xp}🧙  \n Уведомление: ${messa}`
                        })
                        await context.send(`⚙ Операция завершена успешно`)
                    } catch (error) {
                        console.log(`User ${user_get.idvk} blocked chating with bank`)
                        await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                    }
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `🗿 @id${context.senderId}(Admin) > "-🧙" > ${money_put.xp+count}🧙-${count}🧙=${money_put.xp}🧙 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                    })
                    await Logger(`In a private chat, user ${user_get.idvk} lost ${count} MO. Him/Her XP now ${money_put.xp} by admin ${context.senderId}`)
                }
            }
        }
        */
        //Модуль обработки ввода пользователем 
        async function Ipnut_Gold() {
            let golden: number = 0
            let money_check = false
            while (money_check == false) {
                const gold: any = await context.question(`🧷 Введите количество для операции ${ans.text}: `, timer_text_oper)
                if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание количества ${ans.text} истекло!`); return golden }
                if (typeof Number(gold.text) == "number") {
                    money_check = true
                    golden = Number(gold.text)
                } 
            }
            return golden
        }
        async function Ipnut_Message() {
            let golden = ''
            let money_check = false
            while (money_check == false) {
                const gold = await context.question(`🧷 Введите уведомление пользователю ${ans.text}:`, timer_text_oper)
                if (gold.isTimeout) { await context.send(`⏰ Время ожидания на задание уведомления пользователю ${ans.text} истекло!`); return "Отсутствует." }
                if (gold.text) {
                    money_check = true
                    golden = gold.text
                } 
            }
            return golden
        }
        //Модуль вовзврата
        async function Back(id: number, count: number) {
            await Logger(`In a private chat, canceled operations for user UID ${id} by admin ${context.senderId}`)
            await context.send(`⚙ Операция отменена пользователем.`)
        }
        // модуль Министерских операций
        //Модуль начислений
        async function Medal_Up_Many(uids: number[]) {
            const count: number = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: any = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { medal: user_get.medal + count } })
                try {
                    await vk.api.messages.send({
                        user_id: user_get.idvk,
                        random_id: 0,
                        message: `⚙ Вам начислено ${count}🔘, ${money_put.name}. \nВаш счёт: ${money_put.medal}🔘 \n Уведомление: ${messa}`
                    })
                    await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                } catch (error) {
                    console.log(`User ${user_get.idvk} blocked chating with bank`)
                    await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `🗿 @id${context.senderId}(Admin) > "+🔘" > ${money_put.medal-count}🔘+${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                })
                await Logger(`In a private chat, user ${user_get.idvk} got ${count} medal. Him/Her bank now ${money_put.medal} by admin ${context.senderId}`)
            }
        }
        async function Medal_Down_Many(uids: number[]) {
            const count: number = await Ipnut_Gold() 
            const messa: string = await Ipnut_Message()
            for (const ids of uids) {
                const id = Number(ids)
                const user_get: any = await prisma.user.findFirst({ where: { id } })
                if (!user_get) { await context.send(`⛔ Банковская карточка с 💳UID ${id} не найдена`); continue }
                if (user_get.medal-count >= 0) {
                    const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { medal: user_get.medal - count } })
                    try {
                        await vk.api.messages.send({
                            user_id: user_get.idvk,
                            random_id: 0,
                            message: `⚙ С вас снято ${count}🔘, ${money_put.name}. \nВаш счёт: ${money_put.medal}🔘 \n Уведомление: ${messa}`
                        })
                        await context.send(`⚙ Операция с 💳UID ${id} завершена успешно`)
                    } catch (error) {
                        console.log(`User ${user_get.idvk} blocked chating with bank`)
                        await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                    }
                    await vk.api.messages.send({
                        peer_id: chat_id,
                        random_id: 0,
                        message: `🗿 @id${context.senderId}(Admin) > "-🔘" > ${money_put.medal+count}🔘-${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                    })
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
                        try {
                            await vk.api.messages.send({
                                user_id: user_get.idvk, random_id: 0,
                                message: `⚙ С вас снято ${count}🔘, ${money_put.name}. \nВаш счёт: ${money_put.medal}🔘 \n Уведомление: ${messa}`
                            })
                            await context.send(`⚙ Операция завершена успешно`)
                        } catch (error) {
                            console.log(`User ${user_get.idvk} blocked chating with bank`)
                            await context.send(`⚙ Операция с 💳UID ${id} завершена, но уведомление не доставлено пользователю!`)
                        }
                        await vk.api.messages.send({
                            peer_id: chat_id,
                            random_id: 0,
                            message: `🗿 @id${context.senderId}(Admin) > "-🔘" > ${money_put.medal+count}🔘-${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
                        })
                        await Logger(`In a private chat, user ${user_get.idvk} lost ${count} medal. Him/Her bank now ${money_put.medal} by admin ${context.senderId}`)
                    } else {
                        await context.send(`💡 Нужно быть жестче! Греби жетоны`)
                    }
                }
            }
        }
    })                
    hearManager.hear(/!опсоло/, async (context) => {
        await Operation_Solo(context)
    })
    //Обработчики удаления инвентаря и артефактов
    hearManager.hear(/Удалить👜/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (context.messagePayload == null) {
            return
        }
        const art_get: any = await prisma.inventory.findFirst({ where: { id: Number(context.messagePayload.command) } })
        const item: any = await prisma.item.findFirst({ where: { id: art_get.id_item } })
        if (art_get) {
            const art_del = await prisma.inventory.delete({ where: { id: Number(context.messagePayload.command) } })
            await context.send(`⚙ Удален товар ${item.name}-${art_del.id}`)
            const user_find = await prisma.user.findFirst({ where: { id: art_del.id_user } })
            if (user_find) {
                try {
                    await vk.api.messages.send({
                        user_id: user_find.idvk,
                        random_id: 0,
                        message: `⚙ Ваш товар ${item.name} пожертвовали в АЗКАБАН!`
                    })
                    await context.send(`⚙ Удаление товара успешно завершено`)
                } catch (error) {
                    console.log(`User ${user_find.idvk} blocked chating with bank`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `⚙ @id${context.senderId}(Admin) > "🚫👜" > товар ${item.name} пожертвовали в Азкабан! у @id${user_find.idvk}(${user_find.name})`
                })
            }
            await Logger(`In database deleted item ${item.name}-${art_del.id} for user ${user_find?.idvk}-${user_find?.id} by admin ${context.senderId}`)
        }
        await Keyboard_Index(context, '💡 Был товар, нееет товара!')
    })
    hearManager.hear(/Удалить🔮/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (context.messagePayload == null) {
            return
        }
        const art_get: any = await prisma.artefact.findFirst({ where: { id: Number(context.messagePayload.command) } })
        if (art_get) {
            const art_del = await prisma.artefact.delete({ where: { id: Number(context.messagePayload.command) } })
            await context.send(`⚙ Удален артефакт ${art_del.name}`)
            const user_find = await prisma.user.findFirst({ where: { id: art_del.id_user } })
            if (user_find) {
                try {
                    await vk.api.messages.send({
                        user_id: user_find.idvk,
                        random_id: 0,
                        message: `⚙ Ваш артефакт ${art_del.name} изъял ОМОН!`
                    })
                    await context.send(`⚙ Удаление артефакта успешно завершено`)
                } catch (error) {
                    console.log(`User ${user_find.idvk} blocked chating with bank`)
                }
                await vk.api.messages.send({
                    peer_id: chat_id,
                    random_id: 0,
                    message: `⚙ @id${context.senderId}(Admin) > "🚫🔮" > артефакт ${art_del.name} изьял ОМОН! у @id${user_find.idvk}(${user_find.name})`
                })
            }
            console.log(`Admin ${context.senderId} destroy artefact from user UID: ${user_find?.idvk}`)
        }
        await Keyboard_Index(context, '💡 Был артефакт, нееет артефакта!')
    })

    hearManager.hear(/админка/, async (context: any) => {
        if (context.peerType == 'chat') { return }
        if (context.senderId == root) {
            const user: User | null = await prisma.user.findFirst({ where: { idvk: Number(context.senderId) } })
            if (!user) { return }
            const adma = await prisma.role.findFirst({ where: { name: `root` } })
            const lvlup = await prisma.user.update({ where: { id: user.id }, data: { id_role: adma?.id } })
            if (lvlup) {
                await context.send(`⚙ Рут права получены`)
            } else {
                await context.send(`⚙ Ошибка`)
            }
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(${user.name}) становится администратором!)`
            })
            await Logger(`Super user ${context.senderId} got root`)
        }
        await Keyboard_Index(context, `💡 Захват мира снова в теме!`)
    })
    hearManager.hear(/!новая роль/, async (context: any) => {
        if (context.peerType == 'chat') { return }
        if (context.senderId == root) {
            const user:any = await prisma.user.findFirst({ where: { idvk: Number(context.senderId) } })
            const role_check = await prisma.role.findFirst({ where: { name: `root`}})
            if (!role_check) {
                const adm = await prisma.role.create({ data: { name: `root` } })
                if (adm) {
                    await context.send(`⚙ Добавлена новая супер роль ${adm.name}-${adm.id}`)
                } else {
                    await context.send(`⚙ Ошибка`)
                }
            } else {
                const lvlup = await prisma.role.update({ where: { id: role_check.id }, data: { name: `root` } })
                if (lvlup) {
                    await context.send(`⚙ Изменена новая супер роль c ${role_check.name}-${role_check.id} на ${lvlup.name}-${lvlup.id}`)
                } else {
                    await context.send(`⚙ Ошибка`)
                }
            }
            await vk.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(Root) становится администратором!)`
            })
            await Logger(`Super user ${context.senderId} got root`)
        }
        await Keyboard_Index(context, `💡 Захват мира снова в теме!`)
    })
    hearManager.hear(/!права/, async (context: any) => {
        if (context.peerType == 'chat') { return }
        const user_adm: User | null | undefined = await Person_Get(context)
        if (await Accessed(context) == 1) { return }
        const uid = await context.question(`🧷 Введите 💳UID банковского счета получателя:`, timer_text)
        if (uid.isTimeout) { return await context.send(`⏰ Время ожидания ввода банковского счета истекло!`) }
		if (uid.text) {
            const get_user = await prisma.user.findFirst({ where: { id: Number(uid.text) } })
            if (get_user && (user_adm?.id_alliance == get_user.id_alliance || get_user.id_alliance == 0 || get_user.id_alliance == -1 || await Accessed(context) == 3)) {
                const role: any = await prisma.role.findFirst({ where: { id: get_user.id_role } })
                const info_coin: { text: string, smile: string } | undefined = await Person_Coin_Printer_Self(context, get_user.id)
                const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
                await context.send(`✉ Открыта следующая карточка: ${get_user.class} ${get_user.name}, ${get_user.spec}: \n\n 💳 UID: ${get_user.id} \n 🕯 GUID: ${get_user.id_account} \n 🔘 Жетоны: ${get_user.medal} \n 👤 Имя: ${get_user.name} \n 👑 Статус: ${get_user.class}  \n 🔨 Профессия: ${get_user?.spec} \n 🏠 Ролевая: ${get_user.id_alliance == 0 ? `Соло` : get_user.id_alliance == -1 ? `Не союзник` : alli_get?.name}\n 🧷 Страница: https://vk.com/id${get_user.idvk}\n${info_coin?.text}\n \n Права пользователя: ${role.name} `)
                const keyboard = new KeyboardBuilder()
                keyboard.textButton({ label: 'Дать админку', payload: { command: 'access' }, color: 'secondary' }).row()
                .textButton({ label: 'Снять админку (в том числе супер)', payload: { command: 'denied' }, color: 'secondary' }).row()
                
                if (await Accessed(context) == 3) {
                    keyboard.textButton({ label: 'Дать Супер админку', payload: { command: 'access_pro' }, color: 'secondary' }).row()
                }
                keyboard.textButton({ label: 'Ничего не делать', payload: { command: 'cancel' }, color: 'secondary' }).row()
                keyboard.oneTime().inline()
                const answer1 = await context.question(`⌛ Что будем делать?`, { keyboard: keyboard, answerTimeLimit })
                if (answer1.isTimeout) { return await context.send(`⏰ Время ожидания изменения прав истекло!`) }
                if (!answer1.payload) {
                    await context.send(`💡 Жмите только по кнопкам с иконками!`)
                } else {
                    if (answer1.payload.command === 'access') {
                        const adma = await prisma.role.findFirst({ where: { name: `admin` } })
                        const lvlup = await prisma.user.update({ where: { id: get_user.id }, data: { id_role: adma?.id } })
                        if (lvlup) {
                            await context.send(`⚙ Администратором становится ${get_user.name}`)
                            try {
                                await vk.api.messages.send({
                                    user_id: get_user.idvk,
                                    random_id: 0,
                                    message: `⚙ Вас назначили администратором`
                                })
                                await context.send(`⚙ Операция назначения администратора завершена успешно.`)
                            } catch (error) {
                                console.log(`User ${get_user.idvk} blocked chating with bank`)
                            }
                            await vk.api.messages.send({
                                peer_id: chat_id,
                                random_id: 0,
                                message: `⚙ @id${context.senderId}(Root) > делает администратором @id${get_user.idvk}(${get_user.name})`
                            })
                            await Logger(`In private chat, get status admin user ${get_user?.idvk}-${get_user?.id} by admin ${context.senderId}`)
                        } else {
                            await context.send(`💡 Ошибка`)
                        }
                    }
                    if (answer1.payload.command === 'access_pro') {
                        const adma = await prisma.role.findFirst({ where: { name: `root` } })
                        const lvlup = await prisma.user.update({ where: { id: get_user.id }, data: { id_role: adma?.id } })
                        if (lvlup) {
                            await context.send(`⚙ Супер Администратором становится ${get_user.name}`)
                            try {
                                await vk.api.messages.send({
                                    user_id: get_user.idvk,
                                    random_id: 0,
                                    message: `⚙ Вас назначили Супер администратором`
                                })
                                await context.send(`⚙ Операция назначения Супер администратора завершена успешно.`)
                            } catch (error) {
                                console.log(`User ${get_user.idvk} blocked chating with bank`)
                            }
                            await vk.api.messages.send({
                                peer_id: chat_id,
                                random_id: 0,
                                message: `⚙ @id${context.senderId}(Root) > делает Супер администратором @id${get_user.idvk}(${get_user.name})`
                            })
                            await Logger(`In private chat, get status admin user ${get_user?.idvk}-${get_user?.id} by admin ${context.senderId}`)
                        } else {
                            await context.send(`💡 Ошибка`)
                        }
                    }
                    if (answer1.payload.command === 'denied') {
                        const adma = await prisma.role.findFirst({ where: { name: `user` } })
                        const lvlup = await prisma.user.update({ where: { id: get_user.id }, data: { id_role: adma?.id } })
                        if (lvlup) {
                            await context.send(`⚙ Обычным пользователем становится ${get_user.name}`)
                            try {
                                await vk.api.messages.send({
                                    user_id: get_user.idvk,
                                    random_id: 0,
                                    message: `⚙ Вас понизили до обычного пользователя`
                                })
                                await context.send(`⚙ Операция назначения пользователем завершена успешно.`)
                            } catch (error) {
                                console.log(`User ${get_user.idvk} blocked chating with bank`)
                            }
                            await vk.api.messages.send({
                                peer_id: chat_id,
                                random_id: 0,
                                message: `⚙ @id${context.senderId}(Root) > делает обычным пользователем @id${get_user.idvk}(${get_user.name})`
                            })
                            await Logger(`In private chat, left status admin user ${get_user?.idvk}-${get_user?.id} by admin ${context.senderId}`)
                        } else {
                            await context.send(`💡 Ошибка`)
                        }
                    }
                    if (answer1.payload.command === 'cancel') {
                        await context.send(`💡 Тоже вариант`)
                    }
                }
            } else {
                if (user_adm?.id_alliance != get_user?.id_alliance) {
                    await context.send(`💡 Игрок ${get_user?.name} ${get_user?.id} в ролевой AUID: ${get_user?.id_alliance}, в то время, как вы состоите в AUID: ${user_adm?.id_alliance}`)
                } else {
                    await context.send(`💡 Нет такого банковского счета!`) 
                }
            }
		} else {
			await context.send(`💡 Нет такого банковского счета!`)
		}
        await Keyboard_Index(context, `💡 Повышение в должности, не всегда понижение!`)
    })
    hearManager.hear(/енотик/, async (context: any) => {
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await context.sendDocuments({ value: `./prisma/dev.db`, filename: `dev.db` }, { message: '💡 Открывать на сайте: https://sqliteonline.com/' } );
        await vk.api.messages.send({
            peer_id: chat_id,
            random_id: 0,
            message: `‼ @id${context.senderId}(Admin) делает бекап баз данных dev.db.`
        })
        await Logger(`In private chat, did backup database by admin ${context.senderId}`)
    })
    hearManager.hear(/!банк|!Банк/, async (context: any) => {
        if (context.peerType == 'chat') { return }
        await Person_Detector(context)
        const user_check: User | null | undefined = await Person_Get(context)
        if (!user_check) { return }
		if (await Accessed(context) == 1) {
            await Keyboard_Index(context, `🏦 Центробанк Магомира Онлайн 0.41v:\n👥 ${user_check.name}\n🔘 ${user_check.medal} \n\n`)
		} else {
            const user_count = await prisma.user.count()
		    const sums: any = await prisma.user.aggregate({ _sum: { medal: true } })
			await Keyboard_Index(context, `🏦 Центробанк Магомира Онлайн 0.41v:\n👥 ${user_count}\n🔘 ${sums._sum.medal}\n\n`)
		}
		const user_inf = await User_Info(context)
        const keyboard = new KeyboardBuilder().callbackButton({
            label: '✅ Подтвердить авторизацию',
            payload: {
                command: 'system_call',
                item: 'coffee'
            }
        })
        if (await prisma.user.count({ where: { idvk: user_check.idvk } }) > 1) {
            keyboard.textButton({ label: '🔃👥', payload: { command: 'Согласиться' }, color: 'secondary' })
        }
        keyboard.inline()
		await context.send(`${user_inf.first_name}, чтобы авторизоваться в Центробанк Магомира Онлайн 0.16v, под ${user_check.name} нажмите кнопку под этим сообщением!`, {
			keyboard: keyboard
		})
        
        await Logger(`In private chat, invite enter in system is viewed by user ${context.senderId}`)
    })
    hearManager.hear(/➕👤/, async (context) => {
        if (context.peerType == 'chat') { return }
        await Person_Register(context)
    })
    hearManager.hear(/➕🌐/, async (context) => {
        if (context.peerType == 'chat') { return }
        await Alliance_Add(context)
    })
    hearManager.hear(/🔃👥/, async (context) => {
        if (context.peerType == 'chat') { return }
        await Person_Selector(context)
    })
    hearManager.hear(/!отчет по ролкам/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        const res: Array<{ name: String, count: number }> = []
        for (const alli of await prisma.alliance.findMany({})) {
            res.push({ name: alli.name, count: 0 })
        }
        res.push({ name: `Соло`, count: 0 })
        res.push({ name: `Не союзник`, count: 0 })
        for (const us of await prisma.user.findMany({})) {
            const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(us.id_alliance) } })
            const alli_name = `${us.id_alliance == 0 ? `Соло` : us.id_alliance == -1 ? `Не союзник` : alli_get?.name}`
            for (const re of res) {
                if (re.name == alli_name) {
                    re.count++
                }
            }
        }
        res.sort(function(a, b){
            return b.count - a.count;
        });
        const res_ans = res.map(re => `🌐 ${re.name} - ${re.count}\n`).join('')
        await context.send(`📜 Отчет по количеству персонажей в ролевых под грифом секретно:\n\n${res_ans}`)
    })
    hearManager.hear(/!обновить ролки/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Updater(context)
    })
    hearManager.hear(/⚙ !настроить валюты/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Coin_Printer(context)
    })
    hearManager.hear(/⚙ !настроить конвертацию/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Coin_Converter_Editor_Printer(context)
    })
    hearManager.hear(/⚙ !настроить факультеты/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Facult_Printer(context)
    })
    hearManager.hear(/⚙ !закончить учебный год/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Year_End_Printer(context)
    })
    hearManager.hear(/⚙ !подключить группу/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Monitor_Printer(context)
    })
    hearManager.hear(/🚫 !моники_off/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
		const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
		if (!user_check) { return }
        for (const monitor of await prisma.monitor.findMany({ where: { id_alliance: Number(user_check.id_alliance) } })) {
            await stopMonitor(monitor.id)
        }
        await Send_Message( user_check.idvk, `🔧 Запрос на выключение мониторов альянса направлен, ознакомьтесь с результатом выполнения в лог-main чате`)
    })
    hearManager.hear(/🚀 !моники_on/, async (context) => {
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
		const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
		if (!user_check) { return }
        for (const monitor of await prisma.monitor.findMany({ where: { id_alliance: Number(user_check.id_alliance) } })) {
            await restartMonitor(monitor.id)
        }
        await Send_Message( user_check.idvk, `🔧 Запрос на включение мониторов альянса направлен, ознакомьтесь с результатом выполнения в лог-main чате`)
    })
    hearManager.hear(/⚖ Конвертер/, async (context) => {
        if (context.peerType == 'chat') { return }
        await Alliance_Coin_Converter_Printer(context)
    })
    hearManager.hear(/📊 Отчатор/, async (context) => {
        if (context.peerType == 'chat') { return }
        await Alliance_Coin_Rank_Admin_Printer(context)
    })
    hearManager.hear(/🔔 Уведомления|!уведомления/, async (context: any) => {
        if (context.peerType == 'chat') { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
		const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
		if (!user_check) { return }
        const censored_change = await prisma.user.update({ where: { id: user_check.id }, data: { notification: user_check.notification ? false : true } })
        if (censored_change) { 
			await Send_Message(user_check.idvk, `🔔 Уведомления монитора ${censored_change.notification ? 'активированы' : 'отключены'}`)
			await Logger(`(private chat) ~ changed status activity notification self by <user> №${context.senderId}`)
		}
		await Keyboard_Index(context, `⌛ Спокойствие, только спокойствие! Еноты уже несут узбагоительное...`)
    })
    hearManager.hear(/!привязать/, async (context: any) => {
        if (context.peerType != 'chat') { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
		const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
		if (!user_check) { return }
        if (await Accessed(context) == 1) { return }
        if (user_check.id_alliance == 0 || user_check.id_alliance == -1) { return }
        const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(user_check.id_alliance) } })
        if (!alli_get) { return }
        const alli_log_up = await prisma.alliance.update({ where: { id: alli_get.id }, data: { id_chat: context.peerId }})
        if (!alli_log_up) { return }
        await Send_Message( alli_log_up.id_chat, `✅ @id${account.idvk}(${user_check.name}), поздравляем, вы привязали свой чат к уведомлениям для альянса [${alli_get.name}]\n💬 id_chat: ${alli_get.id_chat} --> ${alli_log_up.id_chat}`)
    })
    hearManager.hear(/⚙ !мониторы нафиг/, async (context: any) => {
        if (context.peerType == 'chat') { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
		const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
		if (!user_check) { return }
        if (await Accessed(context) == 1) { return }
        if (user_check.id_alliance == 0 || user_check.id_alliance == -1) { return }
        const keyboard = new KeyboardBuilder()
        keyboard.textButton({ label: '⚙ !подключить группу', payload: { command: 'Согласиться' }, color: 'negative' }).row()
        keyboard.textButton({ label: '🚀 !моники_on', payload: { command: 'Согласиться' }, color: 'negative' })
        keyboard.textButton({ label: '🚫 !моники_off', payload: { command: 'Согласиться' }, color: 'negative' }).row().inline().oneTime()
        await Send_Message( user_check.idvk, `⚙ @id${account.idvk}(${user_check.name}), Добро пожаловать в панель управления мониторами:`, keyboard)
    })
    /*hearManager.hear(/фото/, async (context: any) => {
        if (context.hasAttachments('photo')) {
            // Получаем информацию о вложенной фотографии
            const attachment = context.message.attachments[0];
            const photoId = attachment.photo.id;
            const ownerId = attachment.photo.owner_id;
    
            // Формат для вложения
            const attachmentStr = `photo${ownerId}_${photoId}`;
            const photoUrl = attachment.photo.sizes[attachment.photo.sizes.length - 1].url
    
            // Сохраняем фото для пользователя
            const userId = context.senderId;
            console.log(attachmentStr)
            await context.send('Фото сохранено!');
            try {
                await context.send({ attachment: attachmentStr });
            } catch (e) {
                await context.send(`Произошла ошибка: ${e}`);
            }
            
            //await vk.api.messages.send({ peer_id: 463031671, random_id: 0, message: `тест`, attachment: attachmentStr } )
            
        } else  {
            await context.send('Пожалуйста, отправьте фотографию или введите "мои фото", чтобы увидеть сохраненные фотографии.');
        }
    })*/
}

    