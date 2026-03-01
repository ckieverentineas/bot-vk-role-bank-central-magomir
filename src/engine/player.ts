import { HearManager } from "@vk-io/hear";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { IQuestionMessageContext } from "vk-io-question";
import { answerTimeLimit, chat_id, root, timer_text, vk } from '../index';
import { Accessed, Antivirus_VK, Confirm_User_Success, Keyboard_Index, Logger, Send_Message } from "./core/helper";
import prisma from "./events/module/prisma_client";
import { User_Info } from "./events/module/tool";
import { Account, Alliance, User } from "@prisma/client";
import { Person_Detector, Person_Get, Person_Register, Person_Selector } from "./events/module/person/person";
import { Alliance_Add, Alliance_Updater } from "./events/module/alliance/alliance";
import { Alliance_Coin_Printer } from "./events/module/alliance/alliance_coin";
import { Alliance_Facult_Printer, getFacultyTerminology } from "./events/module/alliance/alliance_facult";
import { Person_Coin_Printer_Self } from "./events/module/person/person_coin";
import { Alliance_Scoopins_Converter_Editor_Printer } from "./events/module/alliance/alliance_scoopins_converter_editor";
import { Alliance_Year_End_Printer } from "./events/module/alliance/alliance_year_end";
import { Alliance_Coin_Rank_Admin_Printer } from "./events/module/rank/rank_alliance";
import { Alliance_Monitor_Printer } from "./events/module/alliance/monitor";
import { restartMonitor, stopMonitor } from "../monitring";
import { Operation_Solo } from "./events/module/tranzaction/operation_solo";
import { Operation_Group } from "./events/module/tranzaction/operation_group";
import { AllianceShop_Printer } from "./events/module/shop/alliance_shop";
import { AllianceShop_Selector } from "./events/module/shop/alliance_shop_client";
import { Inventory_Printer } from "./events/module/shop/alliance_inventory_shop_alliance";
import { Keyboard_User_Main, Main_Menu_Init } from "./events/contoller";
import { generateAllWeeks } from "./core/weather";
import { Operation_SBP } from "./events/module/tranzaction/sbp";
import { Alliance_Coin_Converter_Editor_Printer, Alliance_Coin_Converter_Printer } from "./events/module/alliance/alliance_converter_editor";
import { ico_list } from "./events/module/data_center/icons_lib";
import { getTerminology } from "./events/module/alliance/terminology_helper";
import { Alliance_Class_Settings_Printer } from "./events/module/alliance/alliance_class_settings";
import { Alliance_Topic_Monitor_Printer } from "./events/module/alliance/alliance_topic_monitor";
import { createReadStream } from "fs";
import * as path from 'path';
import { join } from "path";
import { AllianceChest_Manager } from "./events/module/alliance/alliance_chest_manager";
import { Alliance_Enter, Alliance_Enter_Admin } from "./events/module/alliance/alliance_menu";
import { Inventory_With_Chests } from "./events/module/shop/alliance_inventory_with_chests";
import { Legacy_Category_Printer } from "./events/module/shop/legacy_category_manager";
import { CardSystem } from "./core/card_system";
const fs = require('fs');

export function registerUserRoutes(hearManager: HearManager<IQuestionMessageContext>): void {
    hearManager.hear(/!Лютный переулок/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
                    await vk?.api.messages.send({
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
                    await vk?.api.messages.send({
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
                    await vk?.api.messages.send({
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
                        await vk?.api.messages.send({
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
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
            await vk?.api.messages.send({
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
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
            await vk?.api.messages.send({
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
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        await Operation_Group(context)
    })                
    hearManager.hear(/!опсоло/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        await Operation_Solo(context)
    })
    hearManager.hear(/!админка/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
            await vk?.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(${user.name}) становится администратором!)`
            })
            await Logger(`Super user ${context.senderId} got root`)
        }
        await Keyboard_Index(context, `💡 Захват мира снова в теме!`)
    })
    hearManager.hear(/!новая роль/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
            await vk?.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `⚙ @id${context.senderId}(Root) становится администратором!)`
            })
            await Logger(`Super user ${context.senderId} got root`)
        }
        await Keyboard_Index(context, `💡 Захват мира снова в теме!`)
    })
    hearManager.hear(/!права/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
                                await vk?.api.messages.send({
                                    user_id: get_user.idvk,
                                    random_id: 0,
                                    message: `⚙ Вас назначили администратором`
                                })
                                await context.send(`⚙ Операция назначения администратора завершена успешно.`)
                            } catch (error) {
                                console.log(`User ${get_user.idvk} blocked chating with bank`)
                            }
                            await vk?.api.messages.send({
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
                                await vk?.api.messages.send({
                                    user_id: get_user.idvk,
                                    random_id: 0,
                                    message: `⚙ Вас назначили Супер администратором`
                                })
                                await context.send(`⚙ Операция назначения Супер администратора завершена успешно.`)
                            } catch (error) {
                                console.log(`User ${get_user.idvk} blocked chating with bank`)
                            }
                            await vk?.api.messages.send({
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
                                await vk?.api.messages.send({
                                    user_id: get_user.idvk,
                                    random_id: 0,
                                    message: `⚙ Вас понизили до обычного пользователя`
                                })
                                await context.send(`⚙ Операция назначения пользователем завершена успешно.`)
                            } catch (error) {
                                console.log(`User ${get_user.idvk} blocked chating with bank`)
                            }
                            await vk?.api.messages.send({
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
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        
        try {
            const filePath = path.join(process.cwd(), 'prisma/dev.db');
            
            if (!fs.existsSync(filePath)) {
                await context.send('❌ Файл не найден');
                return;
            }

            const fileBuffer = fs.readFileSync(filePath);
            
            await context.sendDocuments({ 
                value: fileBuffer, 
                filename: `dev.db` 
            }, { 
                message: '💡 Открывать на сайте: https://sqliteonline.com/' 
            });
            
            await vk?.api.messages.send({
                peer_id: chat_id,
                random_id: 0,
                message: `‼ @id${context.senderId}(Admin) делает бекап баз данных dev.db.`
            });
            
            await Logger(`Backup database by admin ${context.senderId}`);
            
        } catch (error) {
            console.error('Backup error:', error);
            await context.send('❌ Ошибка при создании бекапа');
        }
    });
    hearManager.hear(/!банк|!Банк/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        await Person_Detector(context)
        const user_check: User | null | undefined = await Person_Get(context)
        if (!user_check) { return }
		await Main_Menu_Init(context)
        await Logger(`In private chat, invite enter in system is viewed by user ${context.senderId}`)
    })
    hearManager.hear(/➕👤/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        await Person_Register(context)
    })
    hearManager.hear(/➕🌐/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        await Alliance_Add(context)
    })
    hearManager.hear(/🔃👥/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        await Person_Selector(context)
    })
    hearManager.hear(/!отчет по ролкам/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Updater(context)
    })
    hearManager.hear(/⚙ !валюты настроить/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Coin_Printer(context)
    })
    hearManager.hear(/⚙ !конвертацию настроить/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Coin_Converter_Editor_Printer(context)
    })
    hearManager.hear(/⚙ !S-coins настроить/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Scoopins_Converter_Editor_Printer(context)
    })
    hearManager.hear(/⚙ !основу настроить/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context);
        if (anti_vk_defender) return;
        
        if (await Accessed(context) === 1) {
            await context.send('❌ У вас нет прав администратора для этой команды.');
            return;
        }
        
        const account = await prisma.account.findFirst({ 
            where: { idvk: context.senderId } 
        });
        if (!account) return;
        
        const user = await prisma.user.findFirst({ 
            where: { id: account.select_user } 
        });
        if (!user || !user.id_alliance || user.id_alliance <= 0) {
            await context.send('❌ Эта команда доступна только администраторам ролевых проектов.');
            return;
        }
        
        // Получаем текущий фон (если есть)
        const background = await CardSystem.getAllianceMenuBackground(user.id_alliance);
        
        let message = `🎨 Настройка фона главного меню\n\n`;
        
        if (background) {
            message += `📂 Текущий фон: "${background.name}"\n`;
            message += `📅 Добавлен: ${background.created_at.toLocaleDateString('ru-RU')}\n\n`;
        } else {
            message += `📂 Фон еще не установлен\n\n`;
        }
        
        message += `📷 Отправьте фотографию для фона:\n`;
        message += `• Заменит текущий фон (если есть)\n`;
        message += `• Используется в главном меню участников альянса\n\n`;
        message += `❌ Для удаления фона используйте команду !основу удалить`;
        
        await context.send(message);
        
        try {
            // Ждем ответ с фото
            const photoAnswer = await context.question('Отправьте фотографию для фона:', {
                answerTimeLimit: 60000
            });
            
            if (photoAnswer.isTimeout) {
                await context.send('⏰ Время ожидания истекло.');
                return;
            }
            
            // Проверяем вложения
            if (!photoAnswer.attachments || photoAnswer.attachments.length === 0) {
                await context.send('❌ Фотография не получена. Отправьте фото.');
                return;
            }
            
            // Используем функцию setMenuBackgroundForAlliance
            const success = await CardSystem.setMenuBackgroundForAlliance(
                user.id_alliance,
                photoAnswer,
                `Фон главного меню`
            );
            
            if (success) {
                const alliance = await prisma.alliance.findFirst({
                    where: { id: user.id_alliance }
                });
                
                await context.send(
                    `✅ Фон главного меню ${background ? 'обновлен' : 'добавлен'}!\n\n` +
                    `📌 Участники альянса "${alliance?.name}" будут видеть новый фон в главном меню.`
                );
                
            } else {
                await context.send('❌ Ошибка при сохранении фона.');
            }
            
        } catch (error) {
            console.error('[MENU_BG SETUP] Error:', error);
            await context.send('❌ Произошла ошибка.');
        }
        
        await Keyboard_Index(context, '💡 Новый фон — новые впечатления!');
    });

    hearManager.hear(/⚙ !основу удалить/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context);
        if (anti_vk_defender) return;
        
        if (await Accessed(context) === 1) {
            await context.send('❌ У вас нет прав администратора для этой команды.');
            return;
        }
        
        const account = await prisma.account.findFirst({ 
            where: { idvk: context.senderId } 
        });
        if (!account) return;
        
        const user = await prisma.user.findFirst({ 
            where: { id: account.select_user } 
        });
        if (!user || !user.id_alliance || user.id_alliance <= 0) {
            await context.send('❌ Эта команда доступна только администраторам ролевых проектов.');
            return;
        }
        
        const background = await CardSystem.getAllianceMenuBackground(user.id_alliance);
        
        if (!background) {
            await context.send('❌ Фон для этого альянса не найден.');
            return;
        }
        
        const confirm = await Confirm_User_Success(context, 'удалить фон главного меню?');
        
        if (confirm.status) {
            const success = await CardSystem.deleteMenuBackgroundForAlliance(user.id_alliance);
            
            if (success) {
                await context.send('✅ Фон главного меню удален. Участники будут использовать стандартный фон.');
            } else {
                await context.send('❌ Ошибка при удалении фона.');
            }
        } else {
            await context.send('🚫 Удаление отменено.');
        }
        
        await Keyboard_Index(context, '💡 Управление фоном меню');
    });
    hearManager.hear(/⚙ !карту настроить/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context);
        if (anti_vk_defender) return;
        
        if (await Accessed(context) === 1) {
            await context.send('❌ У вас нет прав администратора для этой команды.');
            return;
        }
        
        const account = await prisma.account.findFirst({ 
            where: { idvk: context.senderId } 
        });
        if (!account) return;
        
        const user = await prisma.user.findFirst({ 
            where: { id: account.select_user } 
        });
        if (!user || !user.id_alliance || user.id_alliance <= 0) {
            await context.send('❌ Эта команда доступна только администраторам ролевых проектов.');
            return;
        }
        
        // Получаем текущий шаблон (если есть)
        const template = await CardSystem.getAllianceTemplate(user.id_alliance);
        
        let message = `🎨 Настройка фона карточек\n\n`;
        
        if (template) {
            message += `📂 Текущий фон: "${template.name}"\n`;
            message += `📅 Добавлен: ${template.created_at.toLocaleDateString('ru-RU')}\n\n`;
        } else {
            message += `📂 Фон еще не установлен\n\n`;
        }
        
        message += `📷 Отправьте фотографию для фона:\n`;
        message += `• Заменит текущий фон (если есть)\n`;
        message += `• Карточки всех участников автоматически обновятся\n\n`;
        message += `❌ Для удаления фона используйте команду !карту удалить`;
        
        await context.send(message);
        
        try {
            // Ждем ответ с фото
            const photoAnswer = await context.question('Отправьте фотографию для фона:', {
                answerTimeLimit: 60000
            });
            
            if (photoAnswer.isTimeout) {
                await context.send('⏰ Время ожидания истекло.');
                return;
            }
            
            // Проверяем вложения
            if (!photoAnswer.attachments || photoAnswer.attachments.length === 0) {
                await context.send('❌ Фотография не получена. Отправьте фото.');
                return;
            }
            
            // Используем новую функцию setTemplateForAlliance (принимает context)
            const success = await CardSystem.setTemplateForAlliance(
                user.id_alliance,
                photoAnswer, // передаем контекст с фото
                `Фон карточки`
            );
            
            if (success) {
                const alliance = await prisma.alliance.findFirst({
                    where: { id: user.id_alliance }
                });
                
                await context.send(
                    `✅ Фон карточки ${template ? 'обновлен' : 'добавлен'}!\n\n` +
                    `📌 Участники альянса "${alliance?.name}" получат новые карточки при следующем открытии.`
                );
                
            } else {
                await context.send('❌ Ошибка при сохранении фона.');
            }
            
        } catch (error) {
            console.error('[CARD SETUP] Error:', error);
            await context.send('❌ Произошла ошибка.');
        }
        
        await Keyboard_Index(context, '💡 Новый фон — новые впечатления!');
    });

    // Добавьте также команду для удаления фона:
    hearManager.hear(/⚙ !карту удалить/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context);
        if (anti_vk_defender) return;
        
        if (await Accessed(context) === 1) {
            await context.send('❌ У вас нет прав администратора для этой команды.');
            return;
        }
        
        const account = await prisma.account.findFirst({ 
            where: { idvk: context.senderId } 
        });
        if (!account) return;
        
        const user = await prisma.user.findFirst({ 
            where: { id: account.select_user } 
        });
        if (!user || !user.id_alliance || user.id_alliance <= 0) {
            await context.send('❌ Эта команда доступна только администраторам ролевых проектов.');
            return;
        }
        
        const template = await CardSystem.getAllianceTemplate(user.id_alliance);
        
        if (!template) {
            await context.send('❌ Фон для этого альянса не найден.');
            return;
        }
        
        // Подтверждение удаления
        const confirm = await Confirm_User_Success(context, 'удалить фон карточек?');
        
        if (confirm.status) {
            const success = await CardSystem.deleteAllianceTemplate(user.id_alliance);
            
            if (success) {
                await context.send('✅ Фон карточек удален. Участники будут использовать стандартный фон.');
            } else {
                await context.send('❌ Ошибка при удалении фона.');
            }
        } else {
            await context.send('🚫 Удаление отменено.');
        }
        
        await Keyboard_Index(context, '💡 Управление фоном карточек');
    });
    hearManager.hear(/⚙ !легаси настроить/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
        const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
        if (!user_check) { return }
        if (await Accessed(context) == 1) { return }
        if (user_check.id_alliance == 0 || user_check.id_alliance == -1) { return }
        
        await Legacy_Category_Printer(context, user_check.id_alliance!);
    })
    hearManager.hear(/⚙ !отслеживание обсуждений/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context);
        if (anti_vk_defender) return;
        if (context.peerType == 'chat') return;
        
        const account = await prisma.account.findFirst({ where: { idvk: context.senderId } });
        if (!account) return;
        
        const user_check = await prisma.user.findFirst({ where: { id: account.select_user } });
        if (!user_check) return;
        
        if (await Accessed(context) == 1) {
            await context.send(`❌ У вас нет прав администратора для этой команды.`);
            return;
        }
        
        await Alliance_Topic_Monitor_Printer(context);
    })
    hearManager.hear(/⚙ !факультеты настроить/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        
        // Получаем терминологию для отображения
        const user = await Person_Get(context);
        const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } });
        if (alliance) {
            const terminology = await getFacultyTerminology(alliance.id);
            await context.send(`${ico_list['config'].ico} Открываю меню управления ${terminology.plural_genitive}...`);
        }
        
        await Alliance_Facult_Printer(context)
    })
    hearManager.hear(/⚙ !положения настроить/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Class_Settings_Printer(context)
    })
    hearManager.hear(/⚙ !сундуки настроить/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context);
        if (anti_vk_defender) return;
        if (context.peerType == 'chat') return;
        
        const account = await prisma.account.findFirst({ 
            where: { idvk: context.senderId } 
        });
        if (!account) return;
        
        const user_check = await prisma.user.findFirst({ 
            where: { id: account.select_user } 
        });
        if (!user_check) return;
        
        if (await Accessed(context) == 1) {
            await context.send(`❌ У вас нет прав администратора для этой команды.`);
            return;
        }
        
        await AllianceChest_Manager(context);
    });
    hearManager.hear(/⚙ !закончить учебный год/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Year_End_Printer(context)
    })
    hearManager.hear(/⚙ !подключить группу/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        if (await Accessed(context) == 1) { return }
        await Alliance_Monitor_Printer(context)
    })
    hearManager.hear(/🚫 !моники_off/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        await Alliance_Coin_Converter_Printer(context)
    })
    hearManager.hear(/📊 Отчатор/, async (context) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        await Alliance_Coin_Rank_Admin_Printer(context)
    })
    hearManager.hear(/🔔 Мониторы|!уведомления/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
		const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
		if (!user_check) { return }
        const censored_change = await prisma.user.update({ where: { id: user_check.id }, data: { notification: user_check.notification ? false : true } })
        if (censored_change) { 
			await Send_Message(user_check.idvk, `🔔 Уведомления монитора ${censored_change.notification ? 'активированы. Теперь вы будете получать уведомления о ваших лайках/комментариях.' : 'отключены. Теперь вы НЕ будете получать уведомления о ваших лайках/комментариях.'}`)
			await Logger(`(private chat) ~ changed status activity notification self by <user> №${context.senderId}`)
		}
		await Keyboard_Index(context, `⌛ Спокойствие, только спокойствие! Еноты уже несут узбагоительное...`)
    })
    hearManager.hear(/📝 Обсуждения|!уведы обсуждений/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
        const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
        if (!user_check) { return }
        
        const newStatus = !user_check.notification_topic;
        const censored_change = await prisma.user.update({ 
            where: { id: user_check.id }, 
            data: { notification_topic: newStatus } 
        });
        
        if (censored_change) { 
            await Send_Message(user_check.idvk, 
                `🔔 Уведомления обсуждений ${newStatus ? 'активированы ✅' : 'отключены ❌'}\n` +
                `ℹ️ Теперь вы ${newStatus ? 'будете получать' : 'НЕ будете получать'} уведомления о ваших постах в ролевых обсуждениях.`
            )
            await Logger(`(private chat) ~ changed status topic notification by <user> №${context.senderId}`)
        }
        
        await Keyboard_Index(context, `⌛ Настройки уведомлений обновлены!`)
    })
    hearManager.hear(/!привязать финансы/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
    hearManager.hear(/!привязать покупки/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType != 'chat') { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
        const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
        if (!user_check) { return }
        if (await Accessed(context) == 1) { return }
        if (user_check.id_alliance == 0 || user_check.id_alliance == -1) { return }
        const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(user_check.id_alliance) } })
        if (!alli_get) { return }
        const alli_log_up = await prisma.alliance.update({ 
            where: { id: alli_get.id }, 
            data: { id_chat_shop: context.peerId }
        })
        if (!alli_log_up) { return }
        await Send_Message( 
            alli_log_up.id_chat_shop, 
            `✅ @id${account.idvk}(${user_check.name}), поздравляем, вы привязали свой чат к уведомлениям для альянса [${alli_get.name}] по покупкам из ролевых магазинов\n💬 id_chat_shop: ${alli_get.id_chat_shop} --> ${alli_log_up.id_chat_shop}`
        )
    })
    hearManager.hear(/!привязать обсуждения/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType != 'chat') { return }
        
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
        const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
        if (!user_check) { return }
        
        if (await Accessed(context) == 1) { return }
        if (user_check.id_alliance == 0 || user_check.id_alliance == -1) { return }
        
        const alli_get: Alliance | null = await prisma.alliance.findFirst({ where: { id: Number(user_check.id_alliance) } })
        if (!alli_get) { return }
        
        const alli_log_up = await prisma.alliance.update({ 
            where: { id: alli_get.id }, 
            data: { id_chat_topic: context.peerId }
        })
        
        if (!alli_log_up) { return }
        
        await Send_Message( 
            alli_log_up.id_chat_topic, 
            `✅ @id${account.idvk}(${user_check.name}), поздравляем, вы привязали свой чат к уведомлениям для альянса [${alli_get.name}] по активности в обсуждениях\n💬 id_chat_topic: ${alli_get.id_chat_topic} → ${alli_log_up.id_chat_topic}`
        )
    })
    hearManager.hear(/⚙ !мониторы настроить/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        await context.send(`☠ Меню помощи Спектр-3001:
👤 [!уведомления] — включить/выключить уведомления с мониторов
👤 [!уведы обсуждений] — включить/выключить уведомления о постах в обсуждениях
👤 [📊 Отчатор] — меню получения информации внутри ролевого проекта
👤 [➕👤] — создание нового персонажа
👤 [🔃👥] — смена персонажа
⭐ [⚙ !факультеты настроить] — настройка факультетов/фракций ролевой
⭐ [⚙ !магазины настроить] — управление магазинами ролевой
⭐ [⚙ !валюты настроить] — создание и настройка валют
⭐ [⚙ !положения настроить] — кастомизация кнопок положений персонажей
⭐ [⚙ !сундуки настроить] — создание и настройка сундуков, сундучков
⭐ [⚙ !легаси настроить] — привязка удалённых категорий магазинов к сундукам
⭐ [⚙ !конвертацию настроить] — настройка курсов конвертации валют
⭐ [⚙ !S-coins настроить] — управление S-коинами
⭐ [⚙ !мониторы настроить] — вызов меню конфигурации мониторов
⭐ [⚙ !отслеживание обсуждений] — настройка мониторинга обсуждений альянса
⭐ [!привязать мониторы] — привязать чат для логов с мониторов ролевого проекта
⭐ [!привязать финансы] — привязать чат для логов внутрифинансовых операций
⭐ [!привязать покупки] — привязать чат для логов о покупках из магазинов
⭐ [!привязать обсуждения] — привязать чат для логов активности в обсуждениях
⭐ [🚀 !моники_on] — запуск мониторов ролевого проекта
⭐ [🚫 !моники_off] — остановка мониторов ролевого проекта
⭐ [!обновить ролки] — синхронизация названий ролевых проектов с базой данных
⭐ [⚙ !закончить учебный год] — завершение учебного года/сезона ролевой
⭐ [⚙ !основу настроить] — установка/изменение фона главного меню альянса
⭐ [⚙ !основу удалить] — удаление фона главного меню альянса
⭐ [⚙ !карту настроить] — установка/изменение фона карточек персонажей
⭐ [⚙ !карту удалить] — удаление фона карточек персонажей
                    \n📞 Контакты поддержки:
• 🍬 @vazocka_s_konfetami — если что-то не работает, что-то непонятно, потерялся, нашел, но не уверен, хочешь спросить, предложить, уточнить, возразить, согласиться, поделиться мыслями, сомнениями, наблюдениями, радостями или трудностями, а также если не знаешь, к кому обратиться, или знаешь, но решил начать с главного — сюда. Это основной контакт по всем вопросам, от А до Я, включая Й, Ё и прочие буквы алфавита.
• 🛠️ @dj.federation — если бот сошел с ума окончательно и бесповоротно, без вариантов на реабилитацию, механический боточердак не просто поехал, а капитально съехал, сорвался с тормозов, пробил крышу, разнес стропильную систему и теперь раскидывает шифер во все стороны с невиданной силой, мощью и разрушительной грацией, при этом сервер упал, всё крашнулось, горит синим, красным, фиолетовым пламенем и требует срочного вмешательства тяжелой технической артиллерии, реанимации, экзорцизма и полного перепрошивания матрицы — тогда строго сюда. Только по таким критическим багам, коллапсам и апокалипсисам.
• 🎭 @annterstellar — только если вы хотите вести здесь дела своей ролевой, то есть подключить ее к системе банка, интегрировать, синхронизировать, обсудить условия сотрудничества, возможности взаимодействия, перспективы развития и прочие организационно-ролевые моменты.
                    \n⚠ Важно: команда !помощь не создает заявку в поддержку и не вызывает человека. Бот не умеет читать мысли. Если нужна помощь — пиши кому-то из списка выше самостоятельно.
                    \n⚠ Команды с символами:\n👤 — Доступны обычным пользователям;\n⭐ — Доступны администраторам бота;`
                )
        await Keyboard_Index(context, `⌛ 911, что у вас случилось?`)
    })
    hearManager.hear(/⚙ !магазины настроить/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
    hearManager.hear(/🛍 Магазины/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
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
    hearManager.hear(/👜 Инвентарь/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        if (context.peerType == 'chat') { return }
        const account: Account | null = await prisma.account.findFirst({ where: { idvk: context.senderId } })
        if (!account) { return }
        const user_check = await prisma.user.findFirst({ where: { id: account.select_user } })
        if (!user_check) { return }
        
        // Проверяем, есть ли у альянса настроенные сундуки
        const allianceChests = await prisma.allianceChest.findMany({
            where: { id_alliance: user_check.id_alliance || 0 }
        });
        
        if (allianceChests.length === 0) {
            // Если сундуков нет, используем старый инвентарь
            await Inventory_Printer(context, user_check);
        } else {
            // Если есть сундуки, используем новый инвентарь с сундуками
            await Inventory_With_Chests(context, user_check);
        }
    });
    hearManager.hear(/!gpt/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        /**
         * Вызов LLM через fetch API (без axios)
         * @param prompt Текстовый промпт
         * @param model Имя модели (например, 'llama3', 'mistral')
         * @returns Ответ от Ollama или null
         */
        await context.send(`${await callOllama(`${context.text}`, 'llama3.1:8b')}`)
        async function callOllama(prompt: string, model: string = 'llama3.1:8b'): Promise<string | null> {
            const OLLAMA_URL = 'http://localhost:11434/api/generate';
        
            try {
                const response = await fetch(OLLAMA_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        prompt,
                        stream: false
                    })
                });
            
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            
                const data: any = await response.json();
                return data.response || null;
            
            } catch (error) {
                console.error('Ошибка при обращении к Ollama:', error);
                return null;
            }
        }
    })
    hearManager.hear(/!погода/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        const fullForecast = generateAllWeeks(); // май
        await sendLongMessage(context, fullForecast);
        async function sendLongMessage(context: any, text: string, chunkSize = 4000) {
            const chunks = [];
        
            // Разбиваем текст на чанки
            for (let i = 0; i < text.length; i += chunkSize) {
                chunks.push(text.slice(i, i + chunkSize));
            }
        
            // Отправляем по одному сообщению
            for (const chunk of chunks) {
                await context.send(chunk);
                // Задержка не обязательна, но может помочь избежать рейт-лимита
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    })
    hearManager.hear(/!СБП|!сбп|!Сбп/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context)
        if (anti_vk_defender) { return; }
        await Operation_SBP(context)
        await Keyboard_Index(context, `⌛ Как насчет пожертвовать свои накопления админу?`)
    })
    hearManager.hear(/!обнулить scoopins/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context);
        if (anti_vk_defender) return;
        if (context.peerType === 'chat') return;
    
        const ROOT_ID = 200840769;
        if (context.senderId !== ROOT_ID) {
            await context.send('❌ У вас нет прав на выполнение этой команды.');
            return;
        }
    
        try {
            // Получаем всех пользователей
            const allUsers = await prisma.$queryRaw<{ id: number; name: string; idvk: number; scoopins: number }[]>`
                SELECT id, name, idvk, scoopins FROM "User"
            `;
    
            const total = allUsers.length;
            const users1000 = allUsers.filter(u => u.scoopins === 1000);
            const users0 = allUsers.filter(u => u.scoopins === 0);
            const usersCustom = allUsers.filter(u => u.scoopins !== 0 && u.scoopins !== 1000);
    
            // === Сводка ===
            const chatId = chat_id;
            const summary = `📊 Сводка перед обнулением \`scoopins\`:\n` +
                `Всего: ${total}\n` +
                `• 1000 → будет обнулено: ${users1000.length}\n` +
                `• Уже 0: ${users0.length}\n` +
                `• Активные (≠0,≠1000): ${usersCustom.length}`;
    
            await vk?.api.messages.send({
                peer_id: chatId,
                random_id: 0,
                message: summary
            });
    
            // === Лог изменений баланса: 1000 → 0 ===
            if (users1000.length > 0) {
                // Обнуляем в БД
                await prisma.$executeRaw`
                    UPDATE "User" SET scoopins = 0 WHERE scoopins = 1000
                `;
    
                // Формируем строки изменений
                const balanceChanges = users1000.map(u =>
                    `📉 UID-${u.id} [БАЛАНС] ${u.name} (VK: ${u.idvk}) — 1000 → 0`
                );
    
                const balanceLog = `📉 ИЗМЕНЕНИЯ БАЛАНСА (всего: ${users1000.length}):\n\n` + balanceChanges.join('\n');
                await sendLongMessage(vk, chatId, balanceLog);
            }
    
            // === Нестандартные значения (для контекста) ===
            if (usersCustom.length > 0) {
                const customLines = usersCustom.map(u =>
                    `🔸 ${u.name} (VK: ${u.idvk}) → ${u.scoopins}`
                );
                const customLog = `🔍 Пользователи с НЕСТАНДАРТНЫМ \`scoopins\` (≠0,≠1000), всего: ${usersCustom.length}:\n\n` + customLines.join('\n');
                await sendLongMessage(vk, chatId, customLog);
            }
    
            // === Ответ админу ===
            await context.send(
                `✅ Обнуление завершено.\n` +
                `Изменено: ${users1000.length} аккаунтов\n` +
                `Активных: ${usersCustom.length}`
            );
    
            await Logger(`Admin ${context.senderId} обнулить scoopins. Изменено: ${users1000.length}.`);
    
        } catch (error) {
            console.error('Ошибка в !обнулить scoopins:', error);
            await context.send('⚠️ Ошибка при выполнении команды.');
        }
    });
    
    // Вспомогательная функция для длинных сообщений
    async function sendLongMessage(vkInstance: any, peerId: number, fullText: string) {
        const MAX_LENGTH = 3900;
        let start = 0;
        while (start < fullText.length) {
            let end = start + MAX_LENGTH;
            if (end < fullText.length) {
                const lastNewline = fullText.lastIndexOf('\n', end);
                if (lastNewline > start) end = lastNewline;
            }
            await vkInstance?.api.messages.send({
                peer_id: peerId,
                random_id: 0,
                message: fullText.slice(start, end)
            });
            start = end;
        }
    }
    /*hearManager.hear(/!начислить scoopins рандом/, async (context: any) => {
        const anti_vk_defender = await Antivirus_VK(context);
        if (anti_vk_defender) return;
        if (context.peerType === 'chat') return;
    
        const ROOT_ID = 200840769;
        if (context.senderId !== ROOT_ID) {
            await context.send('❌ У вас нет прав на выполнение этой команды.');
            return;
        }
    
        const MAX_COINS = 10000; // максимальное случайное значение
        const MIN_COINS = 1;  // минимальное
    
        try {
            // Получаем всех пользователей с текущим scoopins
            const users = await prisma.$queryRaw<{ id: number; name: string; idvk: number; scoopins: number }[]>`
                SELECT id, name, idvk, scoopins FROM "User"
            `;
    
            if (users.length === 0) {
                await context.send('📭 Нет пользователей для начисления.');
                return;
            }
    
            const chatId = chat_id;
            const changes: { id: number; add: number; newTotal: number; name: string; idvk: number }[] = [];
            const balanceUpdates: { id: number; newScoopins: number }[] = [];
    
            // Генерируем изменения
            for (const user of users) {
                const add = Math.floor(Math.random() * (MAX_COINS - MIN_COINS + 1)) + MIN_COINS;
                const newTotal = user.scoopins + add;
    
                changes.push({
                    id: user.id,
                    add,
                    newTotal,
                    name: user.name,
                    idvk: user.idvk
                });
    
                balanceUpdates.push({
                    id: user.id,
                    newScoopins: newTotal
                });
            }
    
            // Обновляем всех за один проход через SQL (без цикла запросов)
            // SQLite не поддерживает bulk-UPDATE по массиву, поэтому делаем через транзакцию вручную
            const updateQueries = balanceUpdates.map(u =>
                `UPDATE "User" SET scoopins = ${u.newScoopins} WHERE id = ${u.id};`
            ).join('\n');
    
            await prisma.$transaction(updateQueries.split(';').filter(q => q.trim() !== '').map(q => prisma.$executeRawUnsafe(q + ';')));
    
            // === Формируем лог изменений ===
            const changeLines = changes.map(ch =>
                `📈 [БАЛАНС] ${ch.name} (VK: ${ch.idvk}) — +${ch.add} → итого ${ch.newTotal}`
            );
    
            const fullLog = `🎲 Случайное начисление \`scoopins\` (${MIN_COINS}–${MAX_COINS}) для ${users.length} пользователей:\n\n` + changeLines.join('\n');
            await sendLongMessage(vk, chatId, fullLog);
    
            // === Ответ админу ===
            const totalAdded = changes.reduce((sum, ch) => sum + ch.add, 0);
            await context.send(
                `✅ Выполнено случайное начисление!\n` +
                `Пользователей: ${users.length}\n` +
                `Всего монет выдано: ${totalAdded}\n` +
                `Диапазон: ${MIN_COINS}–${MAX_COINS}`
            );
    
            await Logger(`Admin ${context.senderId} выполнил рандомное начисление scoopins. Всего выдано: ${totalAdded}.`);
    
        } catch (error) {
            console.error('Ошибка в !начислить рандом:', error);
            await context.send('⚠️ Ошибка при начислении монет.');
        }
    });*/
    /*hearManager.hear(/фото/, async (context: any) => {
        //console.log(context)
	    console.log(context)
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
            
            //await vk?.api.messages.send({ peer_id: 463031671, random_id: 0, message: `тест`, attachment: attachmentStr } )
            
        } else  {
            await context.send('Пожалуйста, отправьте фотографию или введите "мои фото", чтобы увидеть сохраненные фотографии.');
        }
    })*/
}

    
