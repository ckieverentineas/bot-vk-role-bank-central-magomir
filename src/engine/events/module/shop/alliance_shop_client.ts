import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit, chat_id } from "../../../..";
import { Logger, Send_Message } from "../../../core/helper";

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

        keyboard.textButton({ label: `🚫 Отмена`, payload: { command: 'buyershop_return' }, color: 'negative' }).oneTime();

        event_logger += `\n${1 + cursor} из ${category_counter}`;

        const bt = await context.question(
            `📁 Выберите категорию:\n${event_logger}`,
            { keyboard, answerTimeLimit }
        );

        if (bt.isTimeout) {
            await context.send(`⏰ Время истекло!`);
            return;
        }

        if (!bt.payload || !bt.payload.command) {
            await context.send(`💡 Жмите только на кнопки.`);
            continue;
        }

        const config: any = {
            'buyershop_category_select': Buyer_Category_Select,
            'buyershop_category_next': Buyer_Category_Next,
            'buyershop_category_back': Buyer_Category_Back,
            'buyershop_return': Buyer_Return
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

async function Buyer_Return(context: any, data: any, shop: any) {
    const res = { stop: true };
    await context.send(`Вы вышли из магазина.`);
    return res;
}

async function Buyer_Item_Get(cursor: number, id_category: number) {
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

export async function Buyer_Item_Printer(context: any, id_category: number) {
    const category = await prisma.allianceShopCategory.findFirst({ where: { id: id_category } });
    let item_tr = false;
    let cursor = 0;

    while (!item_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = '';

        for await (const item of await Buyer_Item_Get(cursor, id_category)) {
            keyboard.textButton({
                label: `💎 ${item.name.slice(0, 30)} — ${item.price}🔘`,
                payload: { command: 'buyershop_item_select', cursor, id_item: item.id },
                color: 'secondary'
            }).row();

            event_logger += `💎 ${item.id} - ${item.name} — ${item.price}🔘\n`;
        }

        if (cursor >= 5) {
            keyboard.textButton({ label: `←`, payload: { command: 'buyershop_item_back', cursor }, color: 'secondary' });
        }

        const item_counter = await prisma.allianceShopItem.count({ where: { id_shop: id_category } });
        if (5 + cursor < item_counter) {
            keyboard.textButton({ label: `→`, payload: { command: 'buyershop_item_next', cursor }, color: 'secondary' });
        }

        keyboard.textButton({ label: `🚫 Назад`, payload: { command: 'buyershop_item_return', cursor }, color: 'negative' }).oneTime();

        event_logger += `\n${1 + cursor} из ${item_counter}`;

        const bt = await context.question(
            `💎 Выберите товар:\n${event_logger}`,
            { keyboard, answerTimeLimit }
        );

        if (bt.isTimeout) {
            await context.send(`⏰ Время истекло!`);
            return;
        }

        if (!bt.payload || !bt.payload.command) {
            await context.send(`💡 Жмите только на кнопки.`);
            continue;
        }

        const config: any = {
            'buyershop_item_select': Buyer_Item_Select,
            'buyershop_item_next': Buyer_Item_Next,
            'buyershop_item_back': Buyer_Item_Back,
            'buyershop_item_return': Buyer_Item_Return
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
        await context.send(`❌ Товар не найден.`);
        return res;
    }

    // Проверяем баланс пользователя
    const user = await prisma.user.findFirst({ where: { idvk: context.senderId } });
    if (!user) {
        await context.send(`❌ Игрок не найден.`);
        return res;
    }

    /*if (user.balance < item.price) {
        await context.send(`💸 У вас недостаточно монет для покупки "${item.name}".`);
        return res;
    }*/

    // Проверяем наличие лимита
    if (item.limit_tr && item.limit <= 0) {
        await context.send(`⚠️ Этот товар закончился.`);
        return res;
    }

    // Списание средств
    /*await prisma.user.update({
        where: { id: user.id },
        data: { balance: user.balance - item.price }
    });*/

    // Выдача предмета
    await prisma.inventory.create({
        data: { id_user: user.id, id_item: item.id }
    });

    // Обновление лимита
    if (item.limit_tr) {
        await prisma.allianceShopItem.update({
            where: { id: item.id },
            data: { limit: item.limit - 1 }
        });
    }

    // Логирование
    await Logger(`Игрок @id${context.senderId} купил "${item.name}" за ${item.price} монет`);
    await Send_Message(chat_id, `🛍 @id${context.senderId}(Player) купил "${item.name}"`);

    // Кнопка "ОК"
    const okKeyboard = new KeyboardBuilder()
        .textButton({ label: `✅ ОК`, payload: { command: 'buyershop_item_ok' }, color: 'positive' })
        .inline().oneTime();

    await context.send({
        message: `✅ Вы купили "${item.name}" за ${item.price} монет.`,
        keyboard: okKeyboard
    });

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

async function Buyer_Item_Return(context: any, data: any, category: any) {
    const res = { stop: true };
    await context.send(`Вы вернулись в меню категорий.`);
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
                label: `🛍 ${shop.name}`,
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

        keyboard.textButton({ label: `🚫 Отмена`, payload: { command: 'buyershop_return' }, color: 'negative' }).oneTime();

        event_logger += `\n${1 + cursor} из ${shop_counter}`;

        const bt = await context.question(
            `🛒 Выберите магазин:\n${event_logger}`,
            { keyboard, answerTimeLimit }
        );

        if (bt.isTimeout) {
            await context.send(`⏰ Время истекло!`);
            return;
        }

        if (!bt.payload || !bt.payload.command) {
            await context.send(`💡 Жмите только на кнопки.`);
            continue;
        }

        const config: any = {
            'buyershop_select': Buyershop_Select,
            'buyershop_next': Buyershop_Next,
            'buyershop_back': Buyershop_Back,
            'buyershop_return': Buyershop_Return
        };

        const ans = await config[bt.payload.command](context, bt.payload);
        cursor = ans?.cursor ?? cursor;
        shop_tr = ans.stop ?? false;
    }
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

async function Buyershop_Return(context: any, data: any) {
    const res = { stop: true };
    await context.send(`Вы вышли из магазина.`);
    return res;
}