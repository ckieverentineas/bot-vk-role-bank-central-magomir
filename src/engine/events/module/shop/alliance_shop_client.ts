import { Keyboard, KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit } from "../../../..";
import { Confirm_User_Success, Input_Number, Input_Text, Keyboard_Index, Send_Message, Send_Message_Question, Send_Message_Smart } from "../../../core/helper";
import { BalanceFacult } from "@prisma/client";
import { button_alliance_return, InventoryType } from "../data_center/standart";

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

        if (cursor >= 5) {
            keyboard.textButton({ label: `←`, payload: { command: 'buyershop_category_back', cursor }, color: 'secondary' });
        }

        const category_counter = await prisma.allianceShopCategory.count({ where: { id_alliance_shop: id_shop } });
        if (5 + cursor < category_counter) {
            keyboard.textButton({ label: `→`, payload: { command: 'buyershop_category_next', cursor }, color: 'secondary' });
        }
        event_logger += `\n${1 + cursor} из ${category_counter}`;
        const attached = shop?.image ? shop?.image : null;
        const bt = await Send_Message_Question(context, `📁 Выберите категорию:\n${event_logger}`, keyboard, attached ?? undefined);
        if (bt.exit) { return; }
        const config: any = {
            'buyershop_category_select': Buyer_Category_Select,
            'buyershop_category_next': Buyer_Category_Next,
            'buyershop_category_back': Buyer_Category_Back,
        };

        const ans = await config[bt.payload.command](context, bt.payload, shop);
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

        if (cursor >= 5) {
            keyboard.textButton({ label: `←`, payload: { command: 'buyershop_item_back', cursor }, color: 'secondary' });
        }

        const item_counter = await prisma.allianceShopItem.count({ where: { id_shop: id_category } });
        if (5 + cursor < item_counter) {
            keyboard.textButton({ label: `→`, payload: { command: 'buyershop_item_next', cursor }, color: 'secondary' });
        }
        event_logger += `\n${1 + cursor} из ${item_counter}`;
        const attached = category?.image ? category?.image : null;
        const bt = await Send_Message_Question(context, `🛒 Выберите товар:\n${event_logger}`, keyboard, attached ?? undefined);
        if (bt.exit) { return; }
        const config: any = {
            'buyershop_item_select': Buyer_Item_Select,
            'buyershop_item_next': Buyer_Item_Next,
            'buyershop_item_back': Buyer_Item_Back,
        };

        const ans = await config[bt.payload.command](context, bt.payload, category);
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
    let answer_log = ''
    if (!item) {
        await context.send(`❌ Товар не найден.`);
        return res;
    }
    const coin_get = await prisma.allianceCoin.findFirst({ where: { id: item.id_coin}})
    if (!coin_get) {
        await context.send(`❌ Валюта не найдена.`);
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
    const balance = await prisma.balanceCoin.findFirst({ where: { id_coin: item.id_coin ?? 0, id_user: user.id }})
    if (!balance) { 
        await context.send(`❌ Валютный счет ${coin_get.name}${coin_get.smile} не открыт.`);
        return res;
    }
    
    // подготавливаем внешний вид товара
    let text_item = `${coin_get.smile} Ваш баланс [${coin_get.name}]: ${balance.amount}\n\n🛍 Товар: ${item.name}\n📜 Описание: ${item.description || 'Нет описания'}\n${coin_get?.smile ?? '💰'} Цена: ${item.price}\n👜 Покупка ${item.inventory_tr ? 'попадет' : 'не попадет'} в ваш инвентарь\n\n📦 Осталось: ${item.limit_tr ? `${item.limit}` : '♾️'}`;
    const attached = item?.image?.includes('photo') ? item.image : null
    await Send_Message(context.senderId, `${text_item}`, undefined, attached)
    const confirm_ask: { status: boolean, text: string } = await Confirm_User_Success(context, `купить данный товар?`);
        //await context.send(confirm.text);
    if (!confirm_ask.status) { return res }
    // задаем количество товара
    const item_count = await Input_Number(context, `Введите желаемое количество товаров ${item.name} к покупке, в наличии есть ${item.limit_tr ? item.limit : 'дофига' }:`, false, 2)
    if (!item_count) { return res }
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
    if (balance.amount < item.price*item_count) {
        await context.send(`💸 У вас недостаточно [${coin_get.name}${coin_get.smile}] для покупки [${item.name}].`);
        return res;
    }
    // Добавление комментария к покупке
    const item_comment = await Input_Text(context, `Введите комментарий к покупке`)
    if (!item_comment) { return res }
    // Списание средств
    const buying_act = await prisma.balanceCoin.update({ where: { id: balance.id }, data: { amount: { decrement: item.price*item_count } } });
    answer_log += `Совершена покупка товара "${item.name}"x${item_count} за ${item.price*item_count}${coin_get.smile}.\n${coin_get.smile} Баланс изменился: ${balance.amount}-${item.price*item_count}=${buying_act.amount}\n💬 Комментарий: ${item_comment}`
    // Списание баллов факультета
    const alli_fac = await prisma.allianceFacult.findFirst({ where: { id: user.id_facult ?? 0 } })
    const balance_facult_check = await prisma.balanceFacult.findFirst({ where: { id_coin: item.id_coin ?? 0, id_facult: user.id_facult ?? 0 } })
    if (coin_get?.point == true && balance_facult_check) {
        const balance_facult_plus: BalanceFacult = await prisma.balanceFacult.update({ where: { id: balance_facult_check.id }, data: { amount: { decrement: item.price*item_count } } })
        if (balance_facult_plus) {
            answer_log += `\n🌐 "-${coin_get?.smile}x${item_count}" > ${balance_facult_check.amount} - ${item.price*item_count} = ${balance_facult_plus.amount} для Факультета [${alli_fac?.smile} ${alli_fac?.name}]`
        }
    }
    // Выдача предмета
    if (item.inventory_tr) {
        for (let i=0; i<item_count; i++) {
            const save_item = await prisma.inventory.create({ data: { id_user: user.id, id_item: item.id, type: InventoryType.ITEM_SHOP_ALLIANCE, comment: item_comment } });
        }
    }
    // Обновление лимита
    if (item.limit_tr) {
        await prisma.allianceShopItem.update({
            where: { id: item.id },
            data: { limit: { decrement: item_count } }
        });
    }
    // Логирование
    await Send_Message_Smart(context, answer_log, 'client_solo')

    //модуль откатов
    let answer_owner_alliance_log = ''
    const user_payed_check = await prisma.user.findFirst({ where: { id: item_shop_check.id_user_owner} })
    if (!user_payed_check) { return res; }
    const user_payed_balance_check = await prisma.balanceCoin.findFirst({ where: { id_user: user_payed_check.id, id_coin: item.id_coin } })
    if (!user_payed_balance_check) { return res; }
    const user_paying = await prisma.balanceCoin.update({ where: { id: user_payed_balance_check.id }, data: { amount: { increment: item.price*item_count } } })
    if (!user_paying) { return res; }
    const alli_fac_owner = await prisma.allianceFacult.findFirst({ where: { id: user_payed_check.id_facult ?? 0 } })
    const balance_facult_check_owner = await prisma.balanceFacult.findFirst({ where: { id_coin: item.id_coin ?? 0, id_facult: user_payed_check.id_facult ?? 0 } })
    if (coin_get?.point == true && balance_facult_check_owner) {
        const balance_facult_plus_owner: BalanceFacult = await prisma.balanceFacult.update({ where: { id: balance_facult_check_owner.id }, data: { amount: { increment: item.price*item_count } } })
        if (balance_facult_plus_owner) {
            answer_owner_alliance_log += `🌐 "+${coin_get?.smile}x${item_count}" > ${balance_facult_check_owner.amount} + ${item.price*item_count} = ${balance_facult_plus_owner.amount} для Факультета [${alli_fac_owner?.smile} ${alli_fac_owner?.name}]`
        }
    }
    await Send_Message_Smart(context, `"+ ${coin_get?.smile}" --> продажа товара "${item.name}" через магазин [${item_shop_check.name}] ${user_payed_balance_check?.amount} + ${item.price*item_count} = ${user_paying?.amount}\n${answer_owner_alliance_log}`, 'client_callback', user_payed_check)
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

        if (cursor >= 5) {
            keyboard.textButton({ label: `←`, payload: { command: 'buyershop_back', cursor }, color: 'secondary' });
        }

        const shop_counter = await prisma.allianceShop.count({ where: { id_alliance: id_alliance } });
        if (5 + cursor < shop_counter) {
            keyboard.textButton({ label: `→`, payload: { command: 'buyershop_next', cursor }, color: 'secondary' });
        }
        event_logger += `\n${1 + cursor} из ${shop_counter}`;
        const bt = await Send_Message_Question(context, `🛒 Выберите магазин:\n${event_logger}`, keyboard, undefined);
        if (bt.exit) { await context.send(`Вы вышли из магазина.`, { keyboard: button_alliance_return }); return await Keyboard_Index(context, `⌛ Приходите еще, вдруг новинки появятся, как на валдберисе?`); }
        const config: any = {
            'buyershop_select': Buyershop_Select,
            'buyershop_next': Buyershop_Next,
            'buyershop_back': Buyershop_Back,
        };

        const ans = await config[bt.payload.command](context, bt.payload);
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