import { Alliance, AllianceCoin, AllianceFacult, BalanceCoin, BalanceFacult, ItemStorage, User } from "@prisma/client"
import { Person_Get } from "../person/person"
import { Accessed, Confirm_User_Success, Fixed_Number_To_Five, Get_Url_Picture, Keyboard_Index, Logger, Send_Message, Send_Message_Smart } from "../../../core/helper"
import { Keyboard, KeyboardBuilder } from "vk-io"
import { answerTimeLimit, chat_id, timer_text } from "../../../.."
import { Person_Coin_Printer_Self } from "../person/person_coin"
import { Facult_Coin_Printer_Self } from "../alliance/facult_rank"
import prisma from "../prisma_client"
import { Back, Ipnut_Gold, Ipnut_Message } from "./operation_global"
import { Sub_Menu } from "./operation_sub"
import { ico_list } from "../data_center/icons_lib"
import { InventoryType } from "../data_center/standart"

export async function Operation_Solo(context: any) {
    if (context.peerType == 'chat') { return }
    const user_adm: User | null | undefined = await Person_Get(context)
    if (await Accessed(context) == 1) { return }
    let name_check = false
	let datas: any = []
    let info_coin: { text: string, smile: string } | undefined = { text: ``, smile: `` }
	while (name_check == false) {
		const uid: any = await context.question( `🧷 Введите 💳UID банковского счета получателя:`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: '🚫Отмена', payload: { command: 'limited' }, color: 'secondary' })
                .oneTime().inline(),
                timer_text
            }
        )
        if (uid.isTimeout) { return await context.send('⏰ Время ожидания на ввод банковского счета получателя истекло!')}
		if (/^(0|-?[1-9]\d{0,5})$/.test(uid.text)) {
            const get_user = await prisma.user.findFirst({ where: { id: Number(uid.text) } })
            if (get_user && (user_adm?.id_alliance == get_user.id_alliance || get_user.id_alliance == 0 || get_user.id_alliance == -1 || await Accessed(context) == 3)) {
                info_coin = await Person_Coin_Printer_Self(context, get_user.id)
                const info_facult_rank = await Facult_Coin_Printer_Self(context, get_user.id)
                await Logger(`In a private chat, opened ${get_user.idvk} card UID ${get_user.id} is viewed by admin ${context.senderId}`)
                name_check = true
			    datas.push({id: `${uid.text}`})
                const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(get_user.id_alliance) } })
                const facult_get: AllianceFacult | null = await prisma.allianceFacult.findFirst({ where: { id: Number(get_user.id_facult) } })
                await context.send(`🏦 Открыта следующая карточка: \n\n💳 UID: ${get_user.id} \n🕯 GUID: ${get_user.id_account} \n🔘 Жетоны: ${get_user.medal} \n👤 Имя: ${get_user.name} \n👑 Статус: ${get_user.class}  \n🔨 Профессия: ${get_user?.spec} \n🏠 Ролевая: ${get_user.id_alliance == 0 ? `Соло` : get_user.id_alliance == -1 ? `Не союзник` : alli_get?.name}\n${facult_get ? facult_get.smile : `🔮`} Факультет: ${facult_get ? facult_get.name : `Без факультета`} \n🧷 Страница: https://vk.com/id${get_user.idvk}\n${info_coin?.text}` )
                //await context.send(`Рейтинги факультетов:\n\n ${info_facult_rank?.text}`)
            } else { 
                if (user_adm?.id_alliance != get_user?.id_alliance) {
                    await context.send(`💡 Игрок ${get_user?.name} ${get_user?.id} в ролевой AUID: ${get_user?.id_alliance}, в то время, как вы состоите в AUID: ${user_adm?.id_alliance}`)
                } else {
                    await context.send(`💡 Нет такого банковского счета!`) 
                }
            }
		} else {
            if (uid.text == "🚫Отмена") { 
                await context.send(`💡 Операции прерваны пользователем!`) 
                return await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
            }
			await context.send(`💡 Необходимо ввести корректный UID!`)
		}
	}
    const keyboard = new KeyboardBuilder()
    if (await Accessed(context) == 3) {
        keyboard.textButton({ label: '➕🔘', payload: { command: 'medal_up' }, color: 'secondary' })
        .textButton({ label: '➖🔘', payload: { command: 'medal_down' }, color: 'secondary' }).row()
    }
    keyboard.textButton({ label: `➕➖${info_coin?.smile.slice(0,30)}`, payload: { command: 'coin_engine' }, color: 'secondary' }).row()
    .textButton({ label: `♾️${info_coin?.smile.slice(0,30)}`, payload: { command: 'coin_engine_infinity' }, color: 'secondary' })
    .textButton({ label: `👥➕➖${info_coin?.smile.slice(0,30)}`, payload: { command: 'coin_engine_multi' }, color: 'secondary' }).row()
    .textButton({ label: '📦 Хранилище', payload: { command: 'storage_engine' }, color: 'secondary' })
    .textButton({ label: '⚙', payload: { command: 'sub_menu' }, color: 'secondary' }).row()
    .textButton({ label: `🛍 Назначить магазин`, payload: { command: 'alliance_shop_owner_sel' }, color: 'secondary' })
    .textButton({ label: '🔙', payload: { command: 'back' }, color: 'secondary' }).row()
    .oneTime().inline()
    const ans: any = await context.question(`✉ Доступны следующие операции с 💳UID: ${datas[0].id}`, { keyboard: keyboard, answerTimeLimit })
    if (ans.isTimeout) { return await context.send(`⏰ Время ожидания на ввод операции с 💳UID: ${datas[0].id} истекло!`) }
    const config: any = {
        'back': Back,
        'sub_menu': Sub_Menu,
        'medal_up': Medal_Up,
        'medal_down': Medal_Down,
        'coin_engine': Coin_Engine,
        'coin_engine_infinity': Coin_Engine_Infinity,
        'coin_engine_multi': Coin_Engine_Multi,
        'alliance_shop_owner_sel': Alliance_Shop_Owner_Selector,
        'storage_engine': Storage_Engine
    }
    if (ans?.payload?.command in config) {
        const commandHandler = config[ans.payload.command];
        const answergot = await commandHandler(Number(datas[0].id), context, user_adm)
    } else {
        await context.send(`⚙ Операция отменена пользователем.`)
    }
    await Keyboard_Index(context, `💡 Как насчет еще одной операции? Может позвать доктора?`)
}

async function Storage_Engine(id: number, context: any, user_adm: User) {
    const user_get: User | null = await prisma.user.findFirst({ where: { id } });
    if (!user_get) {
        return await context.send("❌ Пользователь не найден.");
    }

    const alliance = await prisma.alliance.findFirst({
        where: { id: user_get.id_alliance ?? 0 }
    });

    if (!alliance) {
        return await context.send("❌ Союз не найден.");
    }

    let cursor = 0;
    const limit = 5;

    while (true) {
        const batchSize = 5;
        let counter = 0;
        let limiter = 0;
        let items_storage: ItemStorage[] = [];

        const items= await prisma.itemStorage.findMany({
            where: {
                id_alliance: user_get.id_alliance ?? 0,
                hidden: false
            },
            orderBy: { id: "desc" }
        });

        for (const item of items) {
            if ((cursor <= counter && batchSize + cursor >= counter) && limiter < batchSize) {
                items_storage.push(item);
                limiter++;
            }
            counter++;
        }

        if (items_storage.length === 0) {
            await context.send("📦 В хранилище пока нет доступных предметов.");
            //break;
        }

        const keyboard = new KeyboardBuilder();

        for (const item of items_storage) {
            keyboard.textButton({
                label: `${item.name} (${item.id})`,
                payload: { command: 'give_item', item_id: item.id },
                color: 'secondary'
            }).row();
        }

        // Навигация
        if (cursor >= 5) {
            keyboard.textButton({
                label: '<',
                payload: { command: 'navigate', cursor: cursor - 5 },
                color: 'secondary'
            });
        }

        if (5 + cursor < items.length) {
            keyboard.textButton({
                label: '>',
                payload: { command: 'navigate', cursor: cursor + 5 },
                color: 'secondary'
            });
        }

        keyboard
            .textButton({
                label: '🆕 Создать',
                payload: { command: 'create_item' },
                color: 'positive'
            })
            .textButton({
                label: '❌ Выход',
                payload: { command: 'exit' },
                color: 'negative'
            });
            //console.log(keyboard)
        const answer = await context.question("📦 Выберите предмет для выдачи:", {
            keyboard: keyboard.inline(),
            answerTimeLimit
        });

        if (answer.isTimeout) {
            await context.send("⏰ Время ожидания истекло.");
            break;
        }

        if (answer.payload?.command === 'navigate') {
            cursor = answer.payload.cursor;
            continue;
        }

        if (answer.payload?.command === 'give_item') {
            const itemId = answer.payload.item_id;

            const item = await prisma.itemStorage.findFirst({
                where: { id: itemId }
            });

            if (!item) {
                await context.send("⚠ Предмет не найден.");
                continue;
            }
            const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `выдать предмет "${item?.name}" игроку ${user_get.name}?`);
            //await context.send(confirm.text);
            if (!confirm.status) return;
            // Выдача предмета
            await prisma.inventory.create({
                data: {
                    id_user: user_get.id,
                    id_item: item.id,
                    type: InventoryType.ITEM_STORAGE,
                    comment: `Получено от ${user_adm.name}`
                }
            });
            const notif = `"🎁" --> выдача товара "${item?.name}" игроку @id${user_get.idvk}(${user_get.name})${user_adm ? `\n🗿 Инициатор: @id${user_adm.idvk}(${user_adm.name})` : ''}`
            await Send_Message_Smart(context, notif, 'client_callback', user_get)
            if (user_adm) { await Send_Message(user_adm.idvk, notif) }
            //await context.send(`🎁 Предмет "${item.name}" успешно выдан игроку ${user_get.name}.`);
            continue;
        }

        if (answer.payload?.command === 'create_item') {
            const name_answer = await context.question("✏ Введите название нового предмета:");
            if (name_answer.isTimeout) {
                await context.send("⏰ Время ввода истекло.");
                continue;
            }

            const desc_answer = await context.question("✏ Введите описание предмета:");
            if (desc_answer.isTimeout) {
                await context.send("⏰ Время ввода истекло.");
                continue;
            }
            const imageUrl = await context.question(`📷 Вставьте только ссылку на изображение (или "нет"):`, timer_text);
            if (imageUrl.isTimeout) return;
            const image_url = imageUrl.text.toLowerCase() === 'нет' ? '' : Get_Url_Picture(imageUrl.text) ?? '';
            const newItem = await prisma.itemStorage.create({
                data: {
                    name: name_answer.text.trim(),
                    description: desc_answer.text.trim(),
                    id_alliance: user_get.id_alliance,
                    hidden: false,
                    image: image_url
                }
            });

            await context.send(`🆕 Предмет "${newItem.name}" создан и добавлен в хранилище.`);

            // Автоматически выдать этот предмет пользователю?
            const confirm_answer = await context.question(
                `❓ Выдать этот предмет игроку ${user_get.name}?`,
                {
                    keyboard: Keyboard.builder()
                        .textButton({ label: 'Да', payload: { command: 'give_created' }, color: 'positive' })
                        .textButton({ label: 'Нет', payload: { command: 'skip_give' }, color: 'negative' })
                        .oneTime().inline(),
                    answerTimeLimit
                }
            );

            if (confirm_answer.payload?.command === 'give_created') {
                await prisma.inventory.create({
                    data: {
                        id_user: user_get.id,
                        id_item: newItem.id,
                        type: "item_shop",
                        comment: `Выдан админом @id${context.senderId}`
                    }
                });
                const notif = `"🎁" --> выдача товара "${newItem?.name}" игроку @id${user_get.idvk}(${user_get.name})${user_adm ? `\n🗿 Инициатор: @id${user_adm.idvk}(${user_adm.name})` : ''}`
                await Send_Message_Smart(context, notif, 'client_callback', user_get)
                if (user_adm) { await Send_Message(user_adm.idvk, notif) }
                //await context.send(`🎁 Предмет "${newItem.name}" выдан игроку.`);
            }

            continue;
        }

        if (answer.payload?.command === 'exit') {
            await context.send("🚪 Операция завершена.");
            break;
        }
    }

    await Keyboard_Index(context, "💡 Как насчет еще одной операции?");
}

async function Alliance_Shop_Owner_Selector(id: number, context: any, user_adm: User) {
    const user_get: User | null = await prisma.user.findFirst({ where: { id } })
    if (!user_get) { return }
    const uid: any = await context.question( `🧷 Введите SUID магазина для назначения владельцем:`,
        {   
            keyboard: Keyboard.builder()
            .textButton({ label: '🚫Отмена', payload: { command: 'limited' }, color: 'secondary' })
            .oneTime().inline(),
            timer_text
        }
    )
    if (uid.isTimeout) { return await context.send('⏰ Время ожидания на ввод банковского счета получателя истекло!')}
    if (/^(0|-?[1-9]\d{0,5})$/.test(uid.text)) {
        const get_alliance_shop = await prisma.allianceShop.findFirst({ where: { id: Number(uid.text) } })
        if (get_alliance_shop && (user_adm?.id_alliance == get_alliance_shop.id_alliance || user_get?.id_alliance == get_alliance_shop.id_alliance)) {
            const shop_up = await prisma.allianceShop.update({ where: { id: get_alliance_shop.id }, data: { id_user_owner: user_get.id } })
            const owner_old = await prisma.user.findFirst({ where: { id: get_alliance_shop.id_user_owner } })
            await Send_Message_Smart(context, `"🛍 Назначить владение магазином [${shop_up?.name}]" --> изменен владелец магазина ${owner_old?.id}-${owner_old?.name} -> ${shop_up.id_user_owner}-${user_get.name}`, 'admin_and_client', user_get)
        } else { 
            if (get_alliance_shop?.id_alliance != user_get?.id_alliance) {
                await context.send(`💡 Игрок ${user_get?.name} ${user_get?.id} в ролевой AUID: ${user_get?.id_alliance}, в то время, как магазин состоит в AUID: ${get_alliance_shop?.id_alliance}`)
            } else {
                await context.send(`💡 Нет такого магазина!`) 
            }
        }
    } else {
        if (uid.text == "🚫Отмена") { 
            return await context.send(`💡 Операции прерваны пользователем!`) 
            
        }
        await context.send(`💡 Необходимо ввести корректный UID!`)
    }
}
// модуль Министреских начислений
async function Medal_Up(id: number, context: any, user_adm: User) {
    const count: number = await Ipnut_Gold(context, 'начисления министерских жетонов') 
    const messa: string = await Ipnut_Message(context, 'начисления министерских жетонов')
    const user_get: User | null = await prisma.user.findFirst({ where: { id } })
    if (!user_get) { return }
    const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { medal: user_get.medal + count } })
    const notif_ans = await Send_Message(user_get.idvk, `⚙ Вам начислено ${count}🔘, ${money_put.name}. \nВаш счёт ${user_get.name}: ${money_put.medal}🔘 \n Уведомление: ${messa}`)
    !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user_get.name} не доставлено`) : await context.send(`⚙ Операция начисления министерских жетонов завершена успешно`)
    const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "+🔘" > ${money_put.medal-count}🔘+${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
    await Send_Message(chat_id, ans_log)
    await Logger(`In private chat, user ${user_get.idvk} got ${count} medal. Him/Her bank now ${money_put.medal} by admin ${context.senderId}`)
}
async function Medal_Down(id: number, context: any, user_adm: User) {
    const count: number = await Ipnut_Gold(context, 'снятия министерских жетонов') 
    const messa: string = await Ipnut_Message(context, 'снятия министерских жетонов')
    const user_get: any = await prisma.user.findFirst({ where: { id } })
    if (user_get.medal-count >= 0) {
        const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { medal: user_get.medal - count } })
        const notif_ans = await Send_Message(user_get.idvk, `⚙ С вас снято ${count}🔘, ${money_put.name}. \nВаш счёт ${user_get.name}: ${money_put.medal}🔘 \n Уведомление: ${messa}`)
        !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user_get.name} не доставлено`) : await context.send(`⚙ Операция снятия министерских жетонов завершена успешно`)
        const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "-🔘" > ${money_put.medal+count}🔘-${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
        await Send_Message(chat_id, ans_log)
        await Logger(`In private chat, user ${user_get.idvk} lost ${count} medal. Him/Her bank now ${money_put.medal} by admin ${context.senderId}`)
    } else {
        const confirmq = await context.question(`⌛ Вы хотите снять ${count}🔘 жетонов c счета ${user_get.name}, но счет данного пользователя ${user_get.medal}. Уверены, что хотите сделать баланс: ${user_get.medal-count}`,
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
            const money_put = await prisma.user.update({ where: { id: user_get.id }, data: { medal: user_get.medal - count } })
            const notif_ans = await Send_Message(user_get.idvk, `⚙ С вас снято ${count}🔘, ${money_put.name}. \nВаш счёт: ${money_put.medal}🔘 \n Уведомление: ${messa}`)
            !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user_get.name} не доставлено`) : await context.send(`⚙ Операция снятия министерских жетонов завершена успешно`)
            const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "-🔘" > ${money_put.medal+count}🔘-${count}🔘=${money_put.medal}🔘 для @id${user_get.idvk}(${user_get.name}) 🧷: ${messa}`
            await Send_Message(chat_id, ans_log)
            await Logger(`In private chat, user ${user_get.idvk} lost ${count} medal. Him/Her bank now ${money_put.medal} by admin ${context.senderId}`)
        } else {
            await context.send(`💡 Нужно быть жестче! Греби жетоны`)
        }
    }
}
//Модуль мульти начислений
async function Coin_Engine_Multi(id: number, context: any, user_adm: User) {
    const user: User | null | undefined = await prisma.user.findFirst({ where: { id: id } })
    const person: { coin: AllianceCoin | null, operation: String | null, amount: number } = { coin: null, operation: null, amount: 0 }
    if (!user) { return }
    const alli_get = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 } })
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
    const messa: string = await Ipnut_Message(context, `[массовая ${person.operation}${person.coin?.smile}]`)
    const users_target = await Ipnut_Message(context, `Введите список UID и сумм в формате:\n5-3402\n6-23.4\n7-53\n...`) 

    const lines = users_target.split('\n').map(line => line.trim());
    const uid_res: Array<{ id: number, amount: number }> = []

    for (const line of lines) {
        if (!line.includes('-')) {
            await context.send(`⚠ Неверный формат: ${line}`);
            continue;
        }

        const [uidStr, amountStr] = line.split('-').map(s => s.trim());
        const uid = parseInt(uidStr);
        const amount = parseFloat(amountStr);

        if (isNaN(uid) || isNaN(amount)) {
            await context.send(`⚠ Неверный формат: ${line}`);
            continue;
        }

        const user = await prisma.user.findFirst({ where: { id: uid } });
        if (!user) {
            await context.send(`❌ Пользователь с UID ${uid} не найден.`);
            continue;
        }

        uid_res.push({ id: uid, amount: amount });
    }
    let passer = true
    switch (person.operation) {
        case '+':
            for (const ui of uid_res) {
                const pers = await prisma.user.findFirst({ where: { id: ui.id } })
                if (!pers) { await context.send(`UID ${ui.id} не найдено`); continue }
                const pers_info_coin = await Person_Coin_Printer_Self(context, pers.id)
                const pers_info_facult_rank = await Facult_Coin_Printer_Self(context, pers.id)
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
                const notif_ans = await Send_Message(pers.idvk, `⚙ Вам ${person.operation} ${ui.amount}${person.coin?.smile}. \nВаш счёт изменяется магическим образом: ${pers_bal_coin.amount} ${person.operation} ${ui.amount} = ${money_put_plus.amount}\n Уведомление: ${messa}\n${facult_income}`)
                const ans_log = `🗿 @id${context.senderId}(${user_adm.name}) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${ui.amount} = ${money_put_plus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) }
                await Logger(`User ${pers.idvk} ${person.operation} ${ui.amount} gold. Him/Her bank now unknown`)
                !notif_ans ? await context.send(`⚙ Сообщение для UID ${ui.id} не доставлено`) : await context.send(`✅ Успешное начисление для UID ${ui.id}`)
            }
            break;
        case '-':
            for (const ui of uid_res) {
                const pers = await prisma.user.findFirst({ where: { id: ui.id } })
                if (!pers) { await context.send(`UID ${ui.id} не найдено`); continue }
                const pers_info_coin = await Person_Coin_Printer_Self(context, pers.id)
                const pers_info_facult_rank = await Facult_Coin_Printer_Self(context, pers.id)
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
                const notif_ans = await Send_Message(pers.idvk, `⚙ Вам ${person.operation} ${ui.amount}${person.coin?.smile}. \nВаш счёт изменяется магическим образом: ${pers_bal_coin.amount} ${person.operation} ${ui.amount} = ${money_put_minus.amount}\n Уведомление: ${messa}\n${facult_income}`)
                const ans_log = `🗿 @id${context.senderId}(${user_adm.name}) > "${person.operation}${person.coin?.smile}" > ${pers_bal_coin.amount} ${person.operation} ${ui.amount} = ${money_put_minus.amount} для @id${pers.idvk}(${pers.name}) 🧷: ${messa}\n${facult_income}`
                const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
                if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) }
                await Logger(`User ${pers.idvk} ${person.operation} ${ui.amount} gold. Him/Her bank now unknown`)
                !notif_ans ? await context.send(`⚙ Сообщение для UID ${ui.id} не доставлено`) : await context.send(`✅ Успешное снятие для UID ${ui.id}`)
            }
            break;
        default:
            passer = false
            break;
    }
    if (!passer) { return context.send(`⚠ Производится отмена команды, недопустимая операция!`) }
}
//Модуль начислений
async function Coin_Engine(id: number, context: any, user_adm: User) {
    const user: User | null | undefined = await prisma.user.findFirst({ where: { id: id } })
    const person: { coin: AllianceCoin | null, operation: String | null, amount: number } = { coin: null, operation: null, amount: 0 }
    if (!user) { return }
    const alli_get = await prisma.alliance.findFirst({ where: { id: user.id_alliance ?? 0 } })
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
    person.amount = await Ipnut_Gold(context, `[${person.operation}${person.coin?.smile}]`) 
    const messa: string = await Ipnut_Message(context, `[${person.operation}${person.coin?.smile}]`)
    const findas: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: user.id }})
    const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult ?? 0 } })
    let incomer = 0
    let facult_income = ``
    let passer = true
    switch (person.operation) {
        case '+':
            const money_put_plus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: findas?.id }, data: { amount: { increment: person.amount } } })
            incomer = money_put_plus.amount
            if (person.coin?.point == true && alli_fac) {
                const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: user.id_facult! } }) 
                if (rank_put_plus_check) {
                    const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { increment: person.amount } } })
                    if (rank_put_plus) {
                        facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для Факультета [${alli_fac.smile} ${alli_fac.name}]`
                    }
                }
            }
            break;
        case '-':
            const money_put_minus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: findas?.id }, data: { amount: { decrement: person.amount } } })
            incomer = money_put_minus.amount
            if (person.coin?.point == true && alli_fac) {
                const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: user.id_facult! } }) 
                if (rank_put_plus_check) {
                    const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { decrement: person.amount } } })
                    if (rank_put_plus) {
                        facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для Факультета [${alli_fac.smile} ${alli_fac.name}]`
                    }
                }
            }
            break;
    
        default:
            passer = false
            break;
    }
    if (!passer) { return context.send(`⚠ Производится отмена команды, недопустимая операция!`) }
    await Send_Message_Smart(context, `"${person.operation} ${person.amount}${person.coin?.smile}" --> ${findas?.amount} ${person.operation} ${person.amount} = ${incomer}\n🧷 Сообщение: ${messa}\n${facult_income}`, 'admin_and_client',user)
    await Logger(`User ${user.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
}

//Модуль начислений бесконечнный
async function Coin_Engine_Infinity(id: number, context: any, user_adm: User) {
    const user: User | null | undefined = await prisma.user.findFirst({ where: { id: id } })
    const person: { coin: AllianceCoin | null, operation: String | null, amount: number } = { coin: null, operation: null, amount: 0 }
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
        person.amount = await Ipnut_Gold(context, `[${person.operation}${person.coin?.smile}]`) 
        const messa: string = await Ipnut_Message(context, `[${person.operation}${person.coin?.smile}]`)
        const findas: BalanceCoin | null = await prisma.balanceCoin.findFirst({ where: { id_coin: person.coin?.id, id_user: user.id }})
        const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult ?? 0 } })
        let incomer = 0
        let facult_income = ``
        let passer = true
        switch (person.operation) {
            case '+':
                const money_put_plus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: findas?.id }, data: { amount: { increment: person.amount } } })
                incomer = money_put_plus.amount
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: user.id_facult! } }) 
                    if (rank_put_plus_check) {
                        const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { increment: person.amount } } })
                        if (rank_put_plus) {
                            facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для Факультета [${alli_fac.smile} ${alli_fac.name}]`
                        }
                    }
                }
                break;
            case '-':
                const money_put_minus: BalanceCoin = await prisma.balanceCoin.update({ where: { id: findas?.id }, data: { amount: { decrement: person.amount } } })
                incomer = money_put_minus.amount
                if (person.coin?.point == true && alli_fac) {
                    const rank_put_plus_check = await prisma.balanceFacult.findFirst({ where: { id_coin: person.coin.id, id_facult: user.id_facult! } }) 
                    if (rank_put_plus_check) {
                        const rank_put_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: rank_put_plus_check.id }, data: { amount: { decrement: person.amount } } })
                        if (rank_put_plus) {
                            facult_income += `🌐 "${person.operation}${person.coin?.smile}" > ${rank_put_plus_check.amount} ${person.operation} ${person.amount} = ${rank_put_plus.amount} для Факультета [${alli_fac.smile} ${alli_fac.name}]`
                        }
                    }
                }
                break;
            
            default:
                passer = false
                break;
        }
        if (!passer) { return context.send(`⚠ Производится отмена команды, недопустимая операция!`) }
        const notif_ans = await Send_Message(user.idvk, `⚙ Вам ${person.operation} ${person.amount}${person.coin?.smile}. \nВаш счёт изменяется магическим образом, ${user.name}: ${findas?.amount} ${person.operation} ${person.amount} = ${incomer}\n Уведомление: ${messa}\n${facult_income}`)
        !notif_ans ? await context.send(`⚙ Сообщение пользователю ${user.name} не доставлено`) : await context.send(`⚙ Операция завершена успешно`)
        const ans_log = `⚙ @id${context.senderId}(${user_adm.name}) > "${person.operation}${person.coin?.smile}" > ${findas?.amount} ${person.operation} ${person.amount} = ${incomer} для @id${user.idvk}(${user.name}) 🧷: ${messa}\n${facult_income}`
        const notif_ans_chat = await Send_Message(alli_get?.id_chat ?? 0, ans_log)
        if (!notif_ans_chat ) { await Send_Message(chat_id, ans_log) } 
        await Logger(`User ${user.idvk} ${person.operation} ${person.amount} gold. Him/Her bank now unknown`)
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