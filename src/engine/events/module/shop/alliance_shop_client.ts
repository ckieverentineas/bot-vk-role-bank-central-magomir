import { Keyboard, KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit } from "../../../..";
import { Confirm_User_Success, Input_Number, Input_Text, Keyboard_Index, Logger, Send_Message, Send_Message_Question, Send_Message_Smart } from "../../../core/helper";
import { BalanceFacult } from "@prisma/client";
import { button_alliance_return, InventoryType } from "../data_center/standart";
import { getTerminology } from "../alliance/terminology_helper";

async function Buyer_Category_Get(cursor: number, id_shop: number) {
    const batchSize = 5;
    let counter = 0;
    let limiter = 0;
    let res: any[] = [];

    for (const category of await prisma.allianceShopCategory.findMany({ where: { id_alliance_shop: id_shop } })) {
        if ((cursor <= counter && batchSize + cursor >= counter) && limiter < batchSize) {
            res.push(category);
            limiter++;
        }
        counter++;
    }

    return res;
}

export async function Buyer_Category_Printer(context: any, id_shop: number) {
    const shop = await prisma.allianceShop.findFirst({ where: { id: id_shop } });
    let category_tr = false;
    let cursor = 0;
    const category_counter = await prisma.allianceShopCategory.count({ where: { id_alliance_shop: id_shop } });

    while (!category_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = '';

        for await (const category of await Buyer_Category_Get(cursor, id_shop)) {
            keyboard.textButton({
                label: `📁 ${category.name.slice(0, 30)}`,
                payload: { command: 'buyershop_category_select', cursor, id_category: category.id },
                color: 'secondary'
            }).row();

            event_logger += `📁 ${category.id} - ${category.name}\n`;
        }

        // Навигация для категорий
        if (cursor >= 5) {
            keyboard.textButton({ label: `↞`, payload: { command: 'buyershop_category_first', cursor }, color: 'secondary' });
            keyboard.textButton({ label: `←`, payload: { command: 'buyershop_category_back', cursor }, color: 'secondary' });
        }

        if (5 + cursor < category_counter) {
            keyboard.textButton({ label: `→`, payload: { command: 'buyershop_category_next', cursor }, color: 'secondary' });
            keyboard.textButton({ label: `↠`, payload: { command: 'buyershop_category_last', cursor }, color: 'secondary' });
        }

        if (cursor >= 5 || 5 + cursor < category_counter) {
            keyboard.row();
        }

        event_logger += `\n${1 + cursor} из ${category_counter}`;
        const attached = shop?.image ? shop?.image : null;
        const bt = await Send_Message_Question(context, `📁 Выберите категорию:\n${event_logger}`, keyboard, attached ?? undefined);
        if (bt.exit) { return; }
        const config: any = {
            'buyershop_category_select': Buyer_Category_Select,
            'buyershop_category_next': Buyer_Category_Next,
            'buyershop_category_back': Buyer_Category_Back,
            'buyershop_category_first': Buyer_Category_First,
            'buyershop_category_last': Buyer_Category_Last,
        };

        const ans = await config[bt.payload.command](context, bt.payload, shop, category_counter);
        cursor = ans?.cursor ?? cursor;
        category_tr = ans.stop ?? false;
    }
}

async function Buyer_Category_Select(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor };
    await Buyer_Item_Printer(context, data.id_category);
    return res;
}

async function Buyer_Category_Next(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor + 5 };
    return res;
}

async function Buyer_Category_Back(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor - 5 };
    return res;
}

async function Buyer_Category_First(context: any, data: any, shop: any) {
    const res = { cursor: 0 };
    return res;
}

async function Buyer_Category_Last(context: any, data: any, shop: any, category_counter: number) {
    const lastCursor = Math.floor((category_counter - 1) / 5) * 5;
    const res = { cursor: lastCursor };
    return res;
}

async function Buyer_Item_Get(cursor: number, id_category: number) {
    const batchSize = 5;
    let counter = 0;
    let limiter = 0;
    let res: any[] = [];

    for (const item of await prisma.allianceShopItem.findMany({ where: { id_shop: id_category, hidden: false } })) {
        if ((cursor <= counter && batchSize + cursor >= counter) && limiter < batchSize) {
            res.push(item);
            limiter++;
        }
        counter++;
    }

    return res;
}

export async function Buyer_Item_Printer(context: any, id_category: number) {
    const category = await prisma.allianceShopCategory.findFirst({ where: { id: id_category } });
    let item_tr = false;
    let cursor = 0;
    const item_counter = await prisma.allianceShopItem.count({ where: { id_shop: id_category, hidden: false } });

    while (!item_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = '';

        for await (const item of await Buyer_Item_Get(cursor, id_category)) {
            const coin = await prisma.allianceCoin.findFirst({ where: { id: item.id_coin } })
            keyboard.textButton({
                label: `🛒 ${item.name.slice(0, 30)}`,
                payload: { command: 'buyershop_item_select', cursor, id_item: item.id },
                color: 'secondary'
            }).row();

            event_logger += `🛒 ${item.id} - ${item.name} — ${item.price}${coin?.smile}\n`;
        }

        // Навигация для товаров
        if (cursor >= 5) {
            keyboard.textButton({ label: `↞`, payload: { command: 'buyershop_item_first', cursor }, color: 'secondary' });
            keyboard.textButton({ label: `←`, payload: { command: 'buyershop_item_back', cursor }, color: 'secondary' });
        }

        if (5 + cursor < item_counter) {
            keyboard.textButton({ label: `→`, payload: { command: 'buyershop_item_next', cursor }, color: 'secondary' });
            keyboard.textButton({ label: `↠`, payload: { command: 'buyershop_item_last', cursor }, color: 'secondary' });
        }

        if (cursor >= 5 || 5 + cursor < item_counter) {
            keyboard.row();
        }

        event_logger += `\n${1 + cursor} из ${item_counter}`;
        const attached = category?.image ? category?.image : null;
        const bt = await Send_Message_Question(context, `🛒 Выберите товар:\n${event_logger}`, keyboard, attached ?? undefined);
        if (bt.exit) { return; }
        const config: any = {
            'buyershop_item_select': Buyer_Item_Select,
            'buyershop_item_next': Buyer_Item_Next,
            'buyershop_item_back': Buyer_Item_Back,
            'buyershop_item_first': Buyer_Item_First,
            'buyershop_item_last': Buyer_Item_Last,
        };

        const ans = await config[bt.payload.command](context, bt.payload, category, item_counter);
        cursor = ans?.cursor ?? cursor;
        item_tr = ans.stop ?? false;
    }
}

async function Buyer_Item_Select(context: any, data: any, category: any) {
    const res = { cursor: data.cursor };
    const item = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item) { 
        await context.send(`❌ Не удалось получить данные о товаре`);
        return res;
    }
    
    const item_category_check = await prisma.allianceShopCategory.findFirst({ where: { id: item.id_shop } })
    if (!item_category_check) { 
        await context.send(`❌ Не удалось получить данные о категории товара`);
        return res;
    }
    
    const item_shop_check = await prisma.allianceShop.findFirst({ where: { id: item_category_check?.id_alliance_shop } })
    if (!item_shop_check) { 
        await context.send(`❌ Не удалось получить данные о магазине товара`);
        return res;
    }
    
    const item_alliance_check = await prisma.alliance.findFirst({ where: { id: item_shop_check?.id_alliance } })
    if (!item_alliance_check) { 
        await context.send(`❌ Не удалось получить данные об альянсе товара`);
        return res;
    }
    
    // Проверяем баланс пользователя
    const account = await prisma.account.findFirst({ where: { idvk: context.senderId } })
    if (!account) { 
        await context.send(`❌ Аккаунт не найден.`);
        return res;
    }
    
    const user = await prisma.user.findFirst({ where: { id: account.select_user } })
    if (!user) {
        await context.send(`❌ Игрок не найден.`);
        return res;
    }
    
    const coin_get = await prisma.allianceCoin.findFirst({ where: { id: item.id_coin } })
    if (!coin_get) {
        await context.send(`❌ Валюта не найдена.`);
        return res;
    }
    
    const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: item.id_coin ?? 0, id_user: user.id } })
    if (!balance) { 
        await context.send(`❌ Валютный счет ${coin_get.name}${coin_get.smile} не открыт.`);
        return res;
    }
    
    // Показываем информацию о товаре с указанием сундука
    let text_item = `${coin_get.smile} Ваш баланс [${coin_get.name}]: ${balance.amount}\n\n`;
    text_item += `🛍 Товар: ${item.name}\n`;
    text_item += `📜 Описание: ${item.description || 'Нет описания'}\n`;
    text_item += `${coin_get?.smile ?? '💰'} Цена: ${item.price}\n`;
    
    // ✅ ИСПРАВЛЕНИЕ: Информация о сундуке сразу после информации о покупке
    text_item += `👜 Покупка ${item.inventory_tr ? 'попадет' : 'не попадет'} в ваш инвентарь\n`;
    
    // Показываем в какой сундук попадет предмет
    const categoryChest = await prisma.categoryChest.findFirst({
        where: { id_category: item.id_shop },
        include: { chest: true }
    });
    
    if (categoryChest?.chest && item.inventory_tr) {
        text_item += `🎒 Попадет в сундук: ${categoryChest.chest.name}\n`;
    } else if (item.inventory_tr) {
        text_item += `🎒 Попадет в сундук: Основное\n`;
    }
    
    text_item += `\n📦 Осталось: ${item.limit_tr ? `${item.limit}` : '♾️'}`;
    
    const attached = item?.image?.includes('photo') ? item.image : null;
    
    // Отправляем информацию о товаре
    await Send_Message(context.senderId, `${text_item}`, undefined, attached);
    
    // Подтверждение покупки
    const confirm_ask: { status: boolean, text: string } = await Confirm_User_Success(context, `купить данный товар?`);
    if (!confirm_ask.status) { 
        await context.send(`❌ Покупка отменена.`);
        return res; 
    }
    
    // задаем количество товара
    const item_count = await Input_Number(context, `Введите желаемое количество товаров ${item.name} к покупке, в наличии есть ${item.limit_tr ? item.limit : 'дофига' }:`, false, 2);
    if (!item_count) { 
        await context.send(`❌ Количество не указано.`);
        return res; 
    }
    
    if (item_count == 0) {
        await context.send(`💸 Увы, но воздух купить можно только у межгалактических корпораций.`);
        return res;
    }
    
    // Проверяем наличие лимита
    if (item.limit_tr && item.limit <= 0) {
        await context.send(`⚠️ Этот товар закончился.`);
        return res;
    }
    
    // Проверяем наличие лимита
    if (item.limit_tr && item.limit - item_count < 0) {
        await context.send(`⚠️ На складе магазина нет столько товаров.`);
        return res;
    }
    
    // Проверяем наличие денег
    if (balance.amount < item.price * item_count) {
        await context.send(`💸 У вас недостаточно [${coin_get.name}${coin_get.smile}] для покупки [${item.name}].`);
        return res;
    }
    
    // ===== ИСПРАВЛЕННЫЙ БЛОК: Добавление комментария к покупке с кнопкой "Без комментария" =====
    let item_comment = "";
    
    const comment_keyboard = new KeyboardBuilder()
        .textButton({ 
            label: `Без комментария`, 
            payload: { command: 'skip_comment' }, 
            color: 'secondary' 
        })
        .inline().oneTime();
    
    const comment_response = await context.question(
        `💬 Введите комментарий к покупке:`,
        {
            keyboard: comment_keyboard,
            answerTimeLimit
        }
    );
    
    if (comment_response.isTimeout) {
        await context.send(`⏰ Время ожидания истекло!`);
        return res;
    }
    
    // Проверяем, нажата ли кнопка "Без комментария"
    if (comment_response.payload?.command === 'skip_comment') {
        item_comment = "Без комментария";
    } else {
        // Если введен текст вручную
        if (comment_response.text && comment_response.text.trim()) {
            if (comment_response.text.length <= 200) {
                item_comment = comment_response.text;
            } else {
                await context.send(`⚠ Комментарий слишком длинный (${comment_response.text.length}/200). Комментарий не будет добавлен.`);
                item_comment = "Без комментария";
            }
        } else {
            // Если пустой ввод
            item_comment = "Без комментария";
        }
    }
    // ===== КОНЕЦ ИСПРАВЛЕННОГО БЛОКА =====
    
    // Списание средств
    const buying_act = await prisma.balanceCoin.update({ 
        where: { id: balance.id }, 
        data: { amount: { decrement: item.price * item_count } } 
    });
    
    let answer_log = `Совершена покупка товара "${item.name}"x${item_count} за ${item.price * item_count}${coin_get.smile}.\n`;
    answer_log += `${coin_get.smile} Баланс изменился: ${balance.amount}-${item.price * item_count}=${buying_act.amount}\n`;
    answer_log += `💬 Комментарий: ${item_comment}`;
    
    // Списание баллов факультета
    const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult ?? 0 } });
    const balance_facult_check = await prisma.balanceFacult.findFirst({ 
        where: { id_coin: item.id_coin ?? 0, id_facult: user.id_facult ?? 0 } 
    });
    
    const alliance = await prisma.alliance.findFirst({ 
        where: { id: user.id_alliance ?? 0 } 
    });
    
    const singular = await getTerminology(alliance?.id || 0, 'singular');
    const genitive = await getTerminology(alliance?.id || 0, 'genitive');
    
    if (coin_get?.point == true && balance_facult_check) {
        const balance_facult_plus: BalanceFacult = await prisma.balanceFacult.update({ 
            where: { id: balance_facult_check.id }, 
            data: { amount: { decrement: item.price * item_count } } 
        });
        
        if (balance_facult_plus) {
            answer_log += `\n🌐 "-${coin_get?.smile}x${item_count}" > ${balance_facult_check.amount} - ${item.price * item_count} = ${balance_facult_plus.amount} для ${genitive} [${alli_fac?.smile} ${alli_fac?.name}]`;
        }
    }
    
    // ВЫДАЧА ПРЕДМЕТА С ПРАВИЛЬНЫМ ВЫБОРОМ СУНДУКА
    let chestNameForLog = "Основное";
    let targetChestId = 0;
    
    if (item.inventory_tr) {
        // 1. Проверяем привязку категории к сундуку
        if (categoryChest?.chest) {
            targetChestId = categoryChest.id_chest;
            chestNameForLog = categoryChest.chest.name;
        } else {
            // 2. Если нет привязки категории - ищем "Основное"
            const mainChest = await prisma.allianceChest.findFirst({
                where: { 
                    name: "Основное",
                    id_alliance: user.id_alliance || 0
                }
            });
            
            if (mainChest) {
                targetChestId = mainChest.id;
                chestNameForLog = "Основное";
            } else {
                // Создаем "Основное" если нет
                const newMainChest = await prisma.allianceChest.create({
                    data: {
                        name: "Основное",
                        id_alliance: user.id_alliance || 0,
                        id_parent: null,
                        order: 0
                    }
                });
                targetChestId = newMainChest.id;
                chestNameForLog = "Основное";
            }
        }
        
        // 3. Проверяем, что сундук существует
        const targetChest = await prisma.allianceChest.findFirst({
            where: { id: targetChestId }
        });
        
        // Если сундук не найден, используем "Основное"
        if (!targetChest) {
            const mainChest = await prisma.allianceChest.findFirst({
                where: { 
                    name: "Основное",
                    id_alliance: user.id_alliance || 0
                }
            });
            
            if (mainChest) {
                targetChestId = mainChest.id;
                chestNameForLog = "Основное";
            } else {
                const newMainChest = await prisma.allianceChest.create({
                    data: {
                        name: "Основное",
                        id_alliance: user.id_alliance || 0,
                        id_parent: null,
                        order: 0
                    }
                });
                targetChestId = newMainChest.id;
                chestNameForLog = "Основное";
            }
        }
        
        // 4. Выдаем предметы и привязываем к сундуку
        for (let i = 0; i < item_count; i++) {
            const save_item = await prisma.inventory.create({ 
                data: { 
                    id_user: user.id, 
                    id_item: item.id, 
                    type: InventoryType.ITEM_SHOP_ALLIANCE, 
                    comment: item_comment,
                    purchaseDate: new Date()
                } 
            });
            
            // Привязываем к выбранному сундуку
            await prisma.chestItemLink.create({
                data: {
                    id_chest: targetChestId,
                    id_inventory: save_item.id
                }
            });
        }
        
        answer_log += `\n📦 Предметы добавлены в сундук "${chestNameForLog}"`;
    }
    
    // Получаем обновленную информацию о товаре (после списания лимита)
    let remaining_items = '♾️ Безлимит';
    let item_finished = false;
    
    if (item.limit_tr) {
        const updated_item = await prisma.allianceShopItem.update({
            where: { id: item.id },
            data: { limit: { decrement: item_count } }
        });
        remaining_items = `${updated_item.limit}`;
        
        // Проверяем, закончился ли товар после покупки
        if (updated_item.limit <= 0) {
            item_finished = true;
        }
    }

    // 1. Отправляем короткое сообщение пользователю
    let userMessage = `🛒 Покупка в магазине "${item_shop_check.name}":\n`;
    userMessage += `Совершена покупка товара "${item.name}"x${item_count} за ${item.price * item_count}${coin_get.smile}.\n`;
    userMessage += `${coin_get.smile} Баланс изменился: ${balance.amount}-${item.price * item_count}=${buying_act.amount}\n`;
    userMessage += `💬 Комментарий: ${item_comment}\n`;
    userMessage += `📦 Предметы добавлены в сундук "${chestNameForLog}"`;
    
    await Send_Message(context.senderId, userMessage);

    // 2. Отправляем полное сообщение в лог-чат покупок, если настроен
    const allianceForPurchase = await prisma.alliance.findFirst({ 
        where: { id: item_alliance_check.id } 
    });
    
    let logMessage = `👤 Клиент @id${user.idvk}(${user.name}) (UID: ${user.id})\n`;
    logMessage += `🛍 Магазин: "${item_shop_check.name}"\n`;
    logMessage += `🔧 ${answer_log}\n`;
    logMessage += `📦 Осталось товара в магазине: ${remaining_items}`;
    
    // Добавляем предупреждение о том, что товар закончился
    if (item_finished) {
        logMessage += `\n\n⚠️ ТОВАР ЗАКОНЧИЛСЯ!\n`;
        logMessage += `🛍 Товар: "${item.name}"\n`;
        logMessage += `📁 Категория: "${item_category_check.name}"\n`;
        logMessage += `🏪 Магазин: "${item_shop_check.name}"\n`;
        logMessage += `🚨 Админы, пополните запасы!`;
    }
    
    if (allianceForPurchase?.id_chat_shop && allianceForPurchase.id_chat_shop > 0) {
        await Send_Message(allianceForPurchase.id_chat_shop, logMessage);
    }

    // модуль откатов
    let answer_owner_alliance_log = '';
    const user_payed_check = await prisma.user.findFirst({ where: { id: item_shop_check.id_user_owner } });
    if (!user_payed_check) { 
        await context.send(`⚠️ Владелец магазина не найден, но покупка завершена.`);
        return res; 
    }
    
    const user_payed_balance_check = await prisma.balanceCoin.findFirst({ 
        where: { id_user: user_payed_check.id, id_coin: item.id_coin } 
    });
    
    if (!user_payed_balance_check) { 
        await context.send(`⚠️ У владельца магазина не открыт валютный счет, но покупка завершена.`);
        return res; 
    }
    
    const user_paying = await prisma.balanceCoin.update({ 
        where: { id: user_payed_balance_check.id }, 
        data: { amount: { increment: item.price * item_count } } 
    });
    
    if (!user_paying) { 
        await context.send(`⚠️ Ошибка при начислении средств владельцу магазина, но покупка завершена.`);
        return res; 
    }
    
    const alli_fac_owner = await prisma.allianceFacult.findFirst({ where: { id: user_payed_check.id_facult ?? 0 } });
    const balance_facult_check_owner = await prisma.balanceFacult.findFirst({ 
        where: { id_coin: item.id_coin ?? 0, id_facult: user_payed_check.id_facult ?? 0 } 
    });
    
    if (coin_get?.point == true && balance_facult_check_owner) {
        const balance_facult_plus_owner: BalanceFacult = await prisma.balanceFacult.update({ 
            where: { id: balance_facult_check_owner.id }, 
            data: { amount: { increment: item.price * item_count } } 
        });
        
        if (balance_facult_plus_owner) {
            answer_owner_alliance_log += `\n🌐 "+${coin_get?.smile}x${item_count}" > ${balance_facult_check_owner.amount} + ${item.price * item_count} = ${balance_facult_plus_owner.amount} для ${genitive} [${alli_fac_owner?.smile} ${alli_fac_owner?.name}]`;
        }
    }
    
    const allianceForSale = await prisma.alliance.findFirst({ 
        where: { id: item_alliance_check.id } 
    });
    
    let notificationMessage = `"+ ${coin_get?.smile}" --> продажа товара "${item.name}" через магазин [${item_shop_check.name}]\n`;
    notificationMessage += `💰 Баланс: ${user_payed_balance_check?.amount} + ${item.price * item_count} = ${user_paying?.amount}`;
    notificationMessage += answer_owner_alliance_log;

    if (allianceForSale?.id_chat_shop && allianceForSale.id_chat_shop > 0) {
        await Send_Message(allianceForSale.id_chat_shop, notificationMessage);
    } else {
        await Send_Message_Smart(context, notificationMessage, 'client_callback', user_payed_check);
    }
    
    // Логируем успешную покупку
    await Logger(`Покупка: ${user.name} купил ${item.name}x${item_count} за ${item.price * item_count}${coin_get.smile}, добавлено в сундук "${chestNameForLog}"`);
    
    return res;
}

async function Buyer_Item_Next(context: any, data: any, category: any) {
    const res = { cursor: data.cursor + 5 };
    return res;
}

async function Buyer_Item_Back(context: any, data: any, category: any) {
    const res = { cursor: data.cursor - 5 };
    return res;
}

async function Buyer_Item_First(context: any, data: any, category: any) {
    const res = { cursor: 0 };
    return res;
}

async function Buyer_Item_Last(context: any, data: any, category: any, item_counter: number) {
    const lastCursor = Math.floor((item_counter - 1) / 5) * 5;
    const res = { cursor: lastCursor };
    return res;
}

async function Buyer_Shop_Get(cursor: number, id_alliance: number) {
    const batchSize = 5;
    let counter = 0;
    let limiter = 0;
    let res: any[] = [];

    for (const shop of await prisma.allianceShop.findMany({ where: { id_alliance: id_alliance } })) {
        if ((cursor <= counter && batchSize + cursor >= counter) && limiter < batchSize) {
            res.push(shop);
            limiter++;
        }
        counter++;
    }

    return res;
}

export async function AllianceShop_Selector(context: any, id_alliance: number) {
    let shop_tr = false;
    let cursor = 0;
    const shop_counter = await prisma.allianceShop.count({ where: { id_alliance: id_alliance } });

    while (!shop_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = '';

        for await (const shop of await Buyer_Shop_Get(cursor, id_alliance)) {
            keyboard.textButton({
                label: `🛍 ${shop.name.slice(0, 30)}`,
                payload: { command: 'buyershop_select', cursor, id_shop: shop.id },
                color: 'secondary'
            }).row();

            event_logger += `🛍 ${shop.id} - ${shop.name}\n`;
        }

        // Навигация для магазинов
        if (cursor >= 5) {
            keyboard.textButton({ label: `↞`, payload: { command: 'buyershop_first', cursor }, color: 'secondary' });
            keyboard.textButton({ label: `←`, payload: { command: 'buyershop_back', cursor }, color: 'secondary' });
        }

        if (5 + cursor < shop_counter) {
            keyboard.textButton({ label: `→`, payload: { command: 'buyershop_next', cursor }, color: 'secondary' });
            keyboard.textButton({ label: `↠`, payload: { command: 'buyershop_last', cursor }, color: 'secondary' });
        }

        if (cursor >= 5 || 5 + cursor < shop_counter) {
            keyboard.row();
        }

        event_logger += `\n${1 + cursor} из ${shop_counter}`;
        const bt = await Send_Message_Question(context, `🛒 Выберите магазин:\n${event_logger}`, keyboard, undefined);
        if (bt.exit) { await context.send(`✅ Вы вышли из магазина.`, { keyboard: button_alliance_return }); return await Keyboard_Index(context, `⌛ Приходите еще, вдруг новинки появятся, как на валдберисе?`); }
        const config: any = {
            'buyershop_select': Buyershop_Select,
            'buyershop_next': Buyershop_Next,
            'buyershop_back': Buyershop_Back,
            'buyershop_first': Buyershop_First,
            'buyershop_last': Buyershop_Last,
        };

        const ans = await config[bt.payload.command](context, bt.payload, shop_counter);
        cursor = ans?.cursor ?? cursor;
        shop_tr = ans.stop ?? false;
    }
    await Keyboard_Index(context, `⌛ Приходите еще, вдруг новинки появятся, как на валдберисе?`)
}

async function Buyershop_Select(context: any, data: any) {
    const res = { cursor: data.cursor };
    await Buyer_Category_Printer(context, data.id_shop);
    return res;
}

async function Buyershop_Next(context: any, data: any) {
    const res = { cursor: data.cursor + 5 };
    return res;
}

async function Buyershop_Back(context: any, data: any) {
    const res = { cursor: data.cursor - 5 };
    return res;
}

async function Buyershop_First(context: any, data: any) {
    const res = { cursor: 0 };
    return res;
}

async function Buyershop_Last(context: any, data: any, shop_counter: number) {
    const lastCursor = Math.floor((shop_counter - 1) / 5) * 5;
    const res = { cursor: lastCursor };
    return res;
}
