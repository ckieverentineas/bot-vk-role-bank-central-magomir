import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit, timer_text } from "../../../..";
import { Confirm_User_Success, Get_Url_Picture, Input_Number, Select_Alliance_Coin, Send_Message_Question, Send_Message_Smart } from "../../../core/helper";
import { AllianceCoin } from "@prisma/client";
import { ico_list } from "../data_center/icons_lib";
import { InventoryType } from "../data_center/standart";

async function AllianceShopItem_Get(cursor: number, id_category: number) {
    const batchSize = 5;
    let counter = 0;
    let limiter = 0;
    let res: any[] = [];

    for (const item of await prisma.allianceShopItem.findMany({ where: { id_shop: id_category } })) {
        if ((cursor <= counter && batchSize + cursor >= counter) && limiter < batchSize) {
            res.push(item);
            limiter++;
        }
        counter++;
    }

    return res;
}

export async function AllianceShopItem_Printer(context: any, id_category: number) {
    const category = await prisma.allianceShopCategory.findFirst({ where: { id: id_category } });
    let item_tr = false;
    let cursor = 0;

    while (!item_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = '';

        for await (const item of await AllianceShopItem_Get(cursor, id_category)) {
            keyboard.textButton({
                label: `🧳 ${item.id}-${item.name.slice(0, 30)}`,
                payload: { command: 'allianceshopitem_select', cursor, id_item: item.id },
                color: 'secondary'
            }).row()

            event_logger += `💬 ${item.id} - ${item.name}\n`;
        }

        if (cursor >= 5) {
            keyboard.textButton({ label: `↞`, payload: { command: 'allianceshopitem_first', cursor }, color: 'secondary' });
            keyboard.textButton({ label: `←`, payload: { command: 'allianceshopitem_back', cursor }, color: 'secondary' });
        }

        const item_counter = await prisma.allianceShopItem.count({ where: { id_shop: id_category } });
        if (5 + cursor < item_counter) {
            keyboard.textButton({ label: `→`, payload: { command: 'allianceshopitem_next', cursor }, color: 'secondary' });
            keyboard.textButton({ label: `↠`, payload: { command: 'allianceshopitem_last', cursor }, color: 'secondary' });
        }

        // Проверка на добавление row, если есть навигационные кнопки
        if (cursor >= 5 || 5 + cursor < item_counter) {
            keyboard.row();
        }

        keyboard.textButton({ label: `➕`, payload: { command: 'allianceshopitem_create', cursor }, color: 'positive' }).row()

        event_logger += `\n${1 + cursor} из ${item_counter}`;
        const attached = category?.image ? category?.image : null;
        const item_bt = await Send_Message_Question(context, `💎 Выберите товар для категории ${category?.name}:\n${event_logger}`, keyboard, attached ?? undefined);
        if (item_bt.exit) { return; }
        const config: any = {
            'allianceshopitem_select': AllianceShopItem_Select,
            'allianceshopitem_create': AllianceShopItem_Create,
            'allianceshopitem_next': AllianceShopItem_Next,
            'allianceshopitem_back': AllianceShopItem_Back,
            'allianceshopitem_first': AllianceShopItem_First,
            'allianceshopitem_last': AllianceShopItem_Last,
        };
        const ans = await config[item_bt.payload.command](context, item_bt.payload, category);
        cursor = ans?.cursor ?? cursor;
        item_tr = ans.stop ?? false;
    }
}

async function AllianceShopItem_First(context: any, data: any, category: any) {
    const res = { cursor: 0 };
    return res;
}

async function AllianceShopItem_Last(context: any, data: any, category: any) {
    const item_counter = await prisma.allianceShopItem.count({ where: { id_shop: category.id } });
    const lastCursor = Math.floor((item_counter - 1) / 5) * 5;
    const res = { cursor: lastCursor };
    return res;
}

async function AllianceShopItem_Create(context: any, data: any, category: any) {
    const res = { cursor: data.cursor };
    let name_loc = null;
    let desc = '';
    let image_url = '';
    let limit = 0;
    let limit_tr = false;

    const name = await context.question(`🔖 Введите название товара:`, timer_text);
    if (name.isTimeout) return res;
    name_loc = name.text;

    const description = await context.question(`📝 Введите описание товара:`, timer_text);
    if (description.isTimeout) return res;
    desc = description.text;

    const imageUrl = await context.question(`📷 Вставьте только ссылку на изображение (или "нет"):`, timer_text);
    if (imageUrl.isTimeout) return res;
    image_url = imageUrl.text.toLowerCase() === 'нет' ? '' : Get_Url_Picture(imageUrl.text) ?? '';

    const alli_shop_cat = await prisma.allianceShopCategory.findFirst({ where: { id: category.id } })
    if (!alli_shop_cat) { return }
    const alli_shop = await prisma.allianceShop.findFirst({ where: { id: alli_shop_cat.id_alliance_shop } })
    if (!alli_shop) { return }
    const coin_pass: AllianceCoin[] = await prisma.allianceCoin.findMany({ where: { id_alliance: Number(alli_shop.id_alliance) }, orderBy: { order: 'asc' } })
    const selectedCoinId = await Select_Alliance_Coin(context, Number(alli_shop.id_alliance));
    const id_coin = selectedCoinId
    const newPrice = await Input_Number(context, `Введите цену для товара "${name_loc}"`, true)
    if (!newPrice) { return res }

    const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `сделать товар лимитным?`);
    await context.send(confirm.text);
    if (confirm.status) {
        limit_tr = true;
        const limitInput = await context.question(`🔢 Укажите лимит товара:`, timer_text);
        if (limitInput.isTimeout) return res;
        limit = parseInt(limitInput.text) || 0;
    }

    const confirm1: { status: boolean, text: string } = await Confirm_User_Success(context, `добавлять товар в инвентарь пользователя при покупке покупателем?`);
    await context.send(confirm1.text);
    const inventory_tr = confirm1.status ? true : false
    if (name_loc) {
        const item_cr = await prisma.allianceShopItem.create({
            data: {
                name: name_loc,
                description: desc,
                image: image_url,
                price: newPrice,
                id_shop: category.id,
                id_coin: id_coin ?? 0,
                limit: limit,
                limit_tr: limit_tr,
                inventory_tr: inventory_tr
            }
        });
        await Send_Message_Smart(context, `"Конфигурация товаров магазина" -->  добавлен новый товар: ${item_cr.id}-${item_cr.name}`, 'admin_solo')
    }

    return res;
}

async function AllianceShopItem_Delete(context: any, data: any, category: any) {
    const res = { cursor: data.cursor };
    const item = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item) return res;

    const confirm = await Confirm_User_Success(context, `удалить товар "${item.name}"?`);
    await context.send(confirm.text);
    if (!confirm.status) return res;
    const confirm2 = await Confirm_User_Success(context, `удалить товар "${item.name}", все купленные товары также исчезнут из инвентаря игроков?`);
    await context.send(confirm.text);
    if (!confirm2.status) return res;
    const confirm3 = await Confirm_User_Success(context, `удалить товар "${item.name}", вы можете скрыть товар для покупки, вы уверены?`);
    await context.send(confirm.text);
    if (!confirm3.status) return res;

    const item_del = await prisma.allianceShopItem.delete({ where: { id: item.id } });
    await Send_Message_Smart(context, `"Конфигурация товаров магазина" -->  удален товар из магазина и у всех игроков из инвентаря: ${item_del.id}-${item_del.name}`, 'admin_solo')
    await context.send(`✅ Товар удалён из магазина`);

    return res;
}

async function AllianceShopItem_Next(context: any, data: any, category: any) {
    const res = { cursor: data.cursor + 5 };
    return res;
}

async function AllianceShopItem_Back(context: any, data: any, category: any) {
    const res = { cursor: data.cursor - 5 };
    return res;
}

async function AllianceShopItem_Select(context: any, data: any, category: any) {
    const res = { cursor: data.cursor };
    const item_check = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item_check) { await context.send(`❌ Товар не найден.`); return res; }
    const alli_shop_cat = await prisma.allianceShopCategory.findFirst({ where: { id: category.id } })
    if (!alli_shop_cat) { return }
    const alli_shop = await prisma.allianceShop.findFirst({ where: { id: alli_shop_cat.id_alliance_shop } })
    if (!alli_shop) { return }
    const coin_get: AllianceCoin | null = await prisma.allianceCoin.findFirst({ where: { id_alliance: Number(alli_shop.id_alliance), id: item_check.id_coin } })
    let text = `🛍 Просмотр товара: ${item_check.name}\n\n🧾 ID: ${item_check.id}\n${coin_get?.smile ?? '💰'} Стоимость [${coin_get?.name ?? ''}]: ${item_check.price}\n📜 Описание: ${item_check.description || 'Нет описания'}\n📍 Магазин: ${alli_shop?.name || 'Неизвестный магазин'}\n📁 Категория: ${alli_shop_cat?.name || 'Без категории'}\n${item_check.limit_tr ? `📦 Количество товаров: ${item_check.limit}` : '♾️ Количество товаров: безлимит'}\n🔊 Товар ${item_check.hidden ? 'недоступен' : 'доступен'} к покупке пользователями\n👜 Покупка ${item_check.inventory_tr ? 'попадет' : 'не попадет'} в ваш инвентарь\n\n⚙ Выберите действие:`;
    const keyboard = new KeyboardBuilder()
        .textButton({ label: '✏ Название', payload: { command: 'allianceshopitem_edit_name', id_item: item_check.id }, color: 'secondary' })
        .textButton({ label: '🖼 Картинка', payload: { command: 'allianceshopitem_edit_image', id_item: item_check.id }, color: 'secondary' }).row()
        .textButton({ label: '📉 Лимит', payload: { command: 'allianceshopitem_edit_limit', id_item: item_check.id }, color: 'secondary' })
        .textButton({ label: '📜 Описание', payload: { command: 'allianceshopitem_edit_description', id_item: item_check.id }, color: 'secondary' }).row()
        .textButton({ label: '💰 Цена', payload: { command: 'allianceshopitem_edit_price', id_item: item_check.id }, color: 'secondary' })
        .textButton({ label: '💱 Валюта', payload: { command: 'allianceshopitem_edit_coin', id_item: item_check.id }, color: 'secondary' }).row()
        .textButton({ label: '📊 Статистика', payload: { command: 'allianceshopitem_view_stats', id_item: item_check.id }, color: 'secondary' })
        .textButton({ label: '👜  Инвентарь', payload: { command: 'allianceshopitem_edit_inventory_put', id_item: item_check.id }, color: 'secondary' }).row()
        .textButton({ label: '⛔ Удалить', payload: { command: 'allianceshopitem_delete', id_item: item_check.id }, color: 'negative' })
        .textButton({ label: '🚫 Скрыть', payload: { command: 'allianceshopitem_hide', id_item: item_check.id }, color: 'negative' })
    const attached = item_check.image ? item_check.image : null;
    const item_bt = await Send_Message_Question(context, `${text}`, keyboard, attached ?? undefined);
    if (item_bt.exit) { return res; }
    const config: any = {
        'allianceshopitem_delete': AllianceShopItem_Delete,
        'allianceshopitem_edit_name': AllianceShopItem_Edit_Name,
        'allianceshopitem_edit_image': AllianceShopItem_Edit_Image,
        'allianceshopitem_edit_limit': AllianceShopItem_Edit_Limit,
        'allianceshopitem_view_stats': AllianceShopItem_View_Stats,
        'allianceshopitem_hide': AllianceShopItem_Hide,
        'allianceshopitem_edit_description': AllianceShopItem_Edit_Description,
        'allianceshopitem_edit_price': AllianceShopItem_Edit_Price,  
        'allianceshopitem_edit_coin': AllianceShopItem_Edit_Coin,
        'allianceshopitem_edit_inventory_put': AllianceShopItem_Edit_Inventory_Put
    };

    const ans = await config[item_bt.payload.command](context, item_bt.payload, category);

    return res;
}

async function AllianceShopItem_Edit_Name(context: any, data: any) {
    const res = { cursor: data.cursor };
    const item_check = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item_check) return res;

    const newName = await context.question(`🧷 Введите новое название для "${item_check.name}":`, timer_text);
    if (newName.isTimeout || !newName.text) return res;

    const item_name = await prisma.allianceShopItem.update({
        where: { id: item_check.id },
        data: { name: newName.text }
    });
    await Send_Message_Smart(context, `"Конфигурация товаров магазина" -->  изменено название товара: ${item_check.id}-${item_check.name} -> ${item_name.id}-${item_name.name}`, 'admin_solo')
    return res;
}

async function AllianceShopItem_Edit_Image(context: any, data: any) {
    const res = { cursor: data.cursor };
    const item_check = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item_check) return res;

    const newImage = await context.question(`📷 Вставьте ссылку на новое изображение или "нет":`, timer_text);
    if (newImage.isTimeout) return res;
    const imageUrl = newImage.text.toLowerCase() === 'нет' ? '' : Get_Url_Picture(newImage.text) ?? '';

    const item_image = await prisma.allianceShopItem.update({ where: { id: item_check.id }, data: { image: imageUrl } });
    await Send_Message_Smart(context, `"Конфигурация товаров магазина" -->  изменено изображение товара [${item_check.id}-${item_check.name}]: https://vk.com/${item_check.image} -> https://vk.com/${item_image?.image}`, 'admin_solo')
    return res;
}

async function AllianceShopItem_Edit_Limit(context: any, data: any) {
    const res = { cursor: data.cursor };
    const item_check = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item_check) return res;
    let limit = item_check?.limit
    let limit_tr = false

    const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `сделать товар лимитным, сейчас [${item_check.limit_tr ? 'лимит' : 'безлимит'}]?`);
    await context.send(confirm.text);
    if (confirm.status) {
        limit_tr = true;
        const limitInput = await context.question(`🔢 Укажите лимит товара, сейчас [${item_check.limit}]:`, timer_text);
        if (limitInput.isTimeout) return res;
        limit = parseInt(limitInput.text) || 0;
    }
    const item_limit = await prisma.allianceShopItem.update({ where: { id: item_check.id }, data: { limit_tr: limit_tr, limit: limit } });
    await Send_Message_Smart(context, `"Конфигурация товаров магазина" -->  изменен лимит товара [${item_limit.id}-${item_limit.name}]: ${item_check.limit_tr ? `количество товаров ${item_check.limit}` : 'безлимит'} -> ${item_limit.limit_tr ? `количество товаров ${item_limit.limit}` : 'безлимит'}`, 'admin_solo')
    return res;
}

async function AllianceShopItem_View_Stats(context: any, data: any) {
    const res = { cursor: data.cursor };
    const purchases = await prisma.inventory.count({
        where: { id_item: data.id_item, type: InventoryType.ITEM_SHOP_ALLIANCE }
    });

    const item = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item) return res;

    const statsText = `📈 Статистика товара "${item.name}"\n🛒 Куплено: ${purchases} раз(а)\n📦 Осталось: ${item.limit_tr ? item.limit : '∞ Безлимит'}`;

    await context.send(statsText);
    return res;
}

async function AllianceShopItem_Hide(context: any, data: any) {
    const res = { cursor: data.cursor };
    const item = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item) return res;

    const confirm = await Confirm_User_Success(context, `скрыть товар "${item.name}"?`);
    await context.send(confirm.text);
    if (!confirm.status) return res;

    const item_hidden = await prisma.allianceShopItem.update({ where: { id: item.id }, data: { hidden: item.hidden ? false : true } });
    if (item_hidden) { await Send_Message_Smart(context, `"Конфигурация товаров магазина" -->  ${item_hidden.hidden ? 'недоступен' : 'доступен'} к покупке товар: ${item_hidden.id}-${item_hidden.name}`, 'admin_solo') }

    return res;
}
async function AllianceShopItem_Edit_Inventory_Put(context: any, data: any) {
    const res = { cursor: data.cursor };
    const item = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item) return res;
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `добавлять товар "${item.name}" в инвентарь пользователя, сейчас [${item.inventory_tr ? 'добавляется' : 'не добавляется'}]?`);
    await context.send(confirm.text);
    const inventory_tr = confirm.status ? true : false
    const item_inventory_tr = await prisma.allianceShopItem.update({ where: { id: item.id }, data: { inventory_tr: inventory_tr } });
    if (item_inventory_tr) { await Send_Message_Smart(context, `"Конфигурация товаров магазина" -->  изменено добавление товара [${item_inventory_tr.id}-${item_inventory_tr.name}] в инвентарь покупателя: ${item.inventory_tr ? 'добавляется' : 'не добавляется'} --> ${item_inventory_tr.inventory_tr ? 'добавляется' : 'не добавляется'}`, 'admin_solo') }
    return res;
}
async function AllianceShopItem_Edit_Description(context: any, data: any) {
    const res = { cursor: data.cursor };
    const item = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item) return res;

    const newDescription = await context.question(
        `📝 Введите новое описание для "${item.name}"\n(текст или "нет"):\n\n${item.description || 'Нет описания'}`,
        timer_text
    );

    if (newDescription.isTimeout) return res;

    const updatedDesc = await prisma.allianceShopItem.update({
        where: { id: item.id },
        data: { description: newDescription.text.toLowerCase() === 'нет' ? '' : newDescription.text }
    });

    await Send_Message_Smart(context, `"Конфигурация товаров магазина" --> обновлено описание товара [${updatedDesc.id}-${updatedDesc.name}]: ${item.description || 'было пустым'} → ${updatedDesc.description || 'стало пустым'}`, 'admin_solo');
    
    return res;
}

async function AllianceShopItem_Edit_Price(context: any, data: any) {
    const res = { cursor: data.cursor };
    const item = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item) return res;
    const coin_get = await prisma.allianceCoin.findFirst({ where: { id: item.id_coin } })
    const newPrice = await Input_Number(context, `Введите новую цену для "${item.name}". Cтарая цена: ${item.price}${coin_get?.smile}`, true)
    if (!newPrice) { return res }
    const updated = await prisma.allianceShopItem.update({
        where: { id: item.id },
        data: { price: newPrice }
    });
    await Send_Message_Smart(context, `"Конфигурация товаров магазина" --> изменена цена товара: ${item.price} → ${updated.price} (${item.name})`, 'admin_solo');
    return res;
}

async function AllianceShopItem_Edit_Coin(context: any, data: any) {
    const res = { cursor: data.cursor };
    const item_check = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item_check) { 
        await context.send(`❌ Не удалось получить данные о товаре`);
        return res;
    }
    const item_category_check = await prisma.allianceShopCategory.findFirst({ where: { id: item_check?.id_shop } })
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

    const id_alliance = item_alliance_check.id;

    // Вызываем твою универсальную функцию выбора валюты
    const selectedCoinId = await Select_Alliance_Coin(context, id_alliance);
    if (!selectedCoinId) {
        await context.send(`${ico_list['warn'].ico} Выбор валюты прерван.`);
        return res;
    }
    const coin_get_old = await prisma.allianceCoin.findFirst({ where: { id: item_check.id_coin } })
    const coin_get = await prisma.allianceCoin.findFirst({ where: { id: selectedCoinId } })
    // Обновляем товар
    const updatedItem = await prisma.allianceShopItem.update({
        where: { id: item_check.id },
        data: {
            id_coin: selectedCoinId
        }
    });
    await Send_Message_Smart(context, `"Конфигурация товаров магазина" --> изменена валюта товара [${item_check.id}-${item_check.name}]: ${item_check.id_coin}-${coin_get_old?.name} → ${updatedItem.id_coin}-${coin_get?.name}`, 'admin_solo');

    //await context.send(`${ico_list['success'].ico} Валюта товара обновлена на ID: ${selectedCoinId}`);

    return res;
}