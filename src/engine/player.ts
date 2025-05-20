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
import { Operation_Group } from "./events/module/tranzaction/operation_group";
import { AllianceShop_Printer } from "./events/module/shop/alliance_shop";
import { AllianceShop_Selector } from "./events/module/shop/alliance_shop_client";

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
        await Operation_Group(context)
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
    hearManager.hear(/!админка/, async (context: any) => {
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
    hearManager.hear(/!енотик/, async (context: any) => {
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
    hearManager.hear(/!привязать финансы/, async (context: any) => {
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
        await Send_Message( alli_log_up.id_chat, `✅ @id${account.idvk}(${user_check.name}), поздравляем, вы привязали свой чат к уведомлениям для альянса [${alli_get.name}] по финансовым транзакциям\n💬 id_chat: ${alli_get.id_chat} --> ${alli_log_up.id_chat}`)
    })
    hearManager.hear(/!привязать мониторы/, async (context: any) => {
        if (context.peerType != 'chat') { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
		const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
		if (!user_check) { return }
        if (await Accessed(context) == 1) { return }
        if (user_check.id_alliance == 0 || user_check.id_alliance == -1) { return }
        const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(user_check.id_alliance) } })
        if (!alli_get) { return }
        const alli_log_up = await prisma.alliance.update({ where: { id: alli_get.id }, data: { id_chat_monitor: context.peerId }})
        if (!alli_log_up) { return }
        await Send_Message( alli_log_up.id_chat_monitor, `✅ @id${account.idvk}(${user_check.name}), поздравляем, вы привязали свой чат к уведомлениям для альянса [${alli_get.name}] по программе вознаграждений\n💬 id_chat_monitor: ${alli_get.id_chat_monitor} --> ${alli_log_up.id_chat_monitor}`)
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
    hearManager.hear(/!помощь/, async (context) => {
        await context.send(`☠ Меню помощи Спектр-3001:
            \n👤 [!уведомления] - включить/выключить уведомления с мониторов
            \n👤 [📊 Отчатор] - меню получения информации внутри ролевого проекта
            \n👤 [➕👤] - создание нового персонажа
            \n👤 [🔃👥] - смена персонажа
            \n⭐ [⚙ !мониторы нафиг] - вызов меню конфигурации мониторов
            \n⭐ [!привязать мониторы] - пишется в чате с ботом, чтобы привязать чат для логов с мониторов ролевого проекта
            \n⭐ [!привязать финансы] - пишется в чате с ботом, чтобы привязать чат для логов внутрифинансовых операций ролевого проекта
            \n⭐ [🚀 !моники_on] - запуск мониторов ролевого проекта
            \n⭐ [🚫 !моники_off] - остановка мониторов ролевого проекта
            \n⭐ [!обновить ролки] - синхронизация названий ролевых проектов с базой данных

            \n⚠ Команды с символами:\n👤 - Доступны обычным пользователям;\n⭐ - Доступны администраторам бота;`
        )
        await Keyboard_Index(context, `⌛ 911, что у вас случилось?`)
    })
    hearManager.hear(/!магаз/, async (context: any) => {
        if (context.peerType == 'chat') { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
		const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
		if (!user_check) { return }
        if (await Accessed(context) == 1) { return }
        if (user_check.id_alliance == 0 || user_check.id_alliance == -1) { return }
        const keyboard = new KeyboardBuilder()
        await AllianceShop_Printer(context, user_check.id_alliance!)
        //await Send_Message( user_check.idvk, `⚙ @id${account.idvk}(${user_check.name}), Добро пожаловать в панель управления мониторами:`, keyboard)
    })
    hearManager.hear(/!покупки/, async (context: any) => {
        if (context.peerType == 'chat') { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
		const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
		if (!user_check) { return }
        if (user_check.id_alliance == 0 || user_check.id_alliance == -1) { return }
        const keyboard = new KeyboardBuilder()
        await AllianceShop_Selector(context, user_check.id_alliance!)
        //await Send_Message( user_check.idvk, `⚙ @id${account.idvk}(${user_check.name}), Добро пожаловать в панель управления мониторами:`, keyboard)
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

    