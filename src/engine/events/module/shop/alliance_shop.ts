import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit, chat_id, timer_text } from "../../../..";
import { Confirm_User_Success, Logger, Send_Message } from "../../../core/helper";
import { AllianceShopCategory_Printer } from "./alliance_shop_category";

async function AllianceShop_Get(cursor: number, id_alliance: number) {
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

export async function AllianceShop_Printer(context: any, id_alliance: number) {
    let shop_tr = false;
    let cursor = 0;

    while (!shop_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = '';

        for await (const shop of await AllianceShop_Get(cursor, id_alliance)) {
            keyboard.textButton({
                label: `🧾 ${shop.id}-${shop.name.slice(0, 30)}`,
                payload: { command: 'allianceshop_select', cursor: cursor, id_shop: shop.id },
                color: 'secondary'
            })
            .textButton({
                label: `⛔`,
                payload: { command: 'allianceshop_delete', cursor: cursor, id_shop: shop.id },
                color: 'negative'
            }).row();

            event_logger += `💬 ${shop.id} - ${shop.name}\n`;
        }

        if (cursor >= 5) {
            keyboard.textButton({
                label: `←`,
                payload: { command: 'allianceshop_back', cursor },
                color: 'secondary'
            });
        }

        const shop_counter = await prisma.allianceShop.count({ where: { id_alliance: id_alliance } });
        if (5 + cursor < shop_counter) {
            keyboard.textButton({
                label: `→`,
                payload: { command: 'allianceshop_next', cursor },
                color: 'secondary'
            });
        }

        keyboard.textButton({
            label: `➕`,
            payload: { command: 'allianceshop_create', cursor },
            color: 'positive'
        }).row()
        .textButton({
            label: `🚫 Отмена`,
            payload: { command: 'allianceshop_return', cursor },
            color: 'negative'
        }).oneTime();

        event_logger += `\n${1 + cursor} из ${shop_counter}`;

        const shop_bt = await context.question(
            `🛍 Выберите магазин:\n${event_logger}`,
            { keyboard, answerTimeLimit }
        );

        if (shop_bt.isTimeout) {
            await context.send(`⏰ Время ожидания выбора истекло!`);
            return;
        }

        if (!shop_bt.payload) {
            await context.send(`💡 Жмите только по кнопкам!`);
            continue;
        }

        const config: any = {
            'allianceshop_select': AllianceShop_Select,
            'allianceshop_create': AllianceShop_Create,
            'allianceshop_next': AllianceShop_Next,
            'allianceshop_back': AllianceShop_Back,
            'allianceshop_return': AllianceShop_Return,
            'allianceshop_delete': AllianceShop_Delete
        };

        const ans = await config[shop_bt.payload.command](context, shop_bt.payload, id_alliance);
        cursor = ans?.cursor ?? cursor;
        shop_tr = ans.stop ?? false;
    }
}

async function AllianceShop_Delete(context: any, data: any) {
    const res = { cursor: data.cursor };
    const shop_check = await prisma.allianceShop.findFirst({ where: { id: data.id_shop } });
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `удалить магазин ${shop_check?.id}-${shop_check?.name}?`);

    await context.send(confirm.text);
    if (!confirm.status) return res;

    if (shop_check) {
        const shop_del = await prisma.allianceShop.delete({ where: { id: shop_check.id } });
        if (shop_del) {
            await Logger(`Удалён магазин: ${shop_del.id}-${shop_del.name} админом ${context.senderId}`);
            await context.send(`Вы удалили магазин: ${shop_del.id}-${shop_del.name}`);
            await Send_Message(chat_id, `📅 @id${context.senderId}(GameMaster) > удаляет магазин: ${shop_del.id}-${shop_del.name}`);
        }
    }

    return res;
}

async function AllianceShop_Return(context: any, data: any) {
    const res = { cursor: data.cursor, stop: true };
    await context.send(`Вы отменили управление магазинами.`);
    return res;
}

async function AllianceShop_Select(context: any, data: any) {
    const res = { cursor: data.cursor };
    await AllianceShopCategory_Printer(context, data.id_shop);
    return res;
}

async function AllianceShop_Next(context: any, data: any) {
    const res = { cursor: data.cursor + 5 };
    return res;
}

async function AllianceShop_Back(context: any, data: any) {
    const res = { cursor: data.cursor - 5 };
    return res;
}

async function AllianceShop_Create(context: any, data: any, id_alliance: number) {
    const res = { cursor: data.cursor };
    let name_loc = null;

    while (!name_loc) {
        const name = await context.question(`🧷 Введите название нового магазина:`, timer_text);
        if (name.isTimeout) {
            await context.send(`⏰ Время истекло!`);
            return res;
        }
        if (name.text.length > 0 && name.text.length <= 100) {
            name_loc = name.text;
        } else {
            await context.send(`💡 Название должно быть от 1 до 100 символов!`);
        }
    }

    const allianceId = id_alliance;
    const shop_cr = await prisma.allianceShop.create({
        data: {
            name: name_loc,
            id_alliance: allianceId
        }
    });

    if (shop_cr) {
        await Logger(`Создан магазин: ${shop_cr.id}-${shop_cr.name} админом ${context.senderId}`);
        await context.send(`Вы создали магазин: ${shop_cr.id}-${shop_cr.name}`);
        await Send_Message(chat_id, `📅 @id${context.senderId}(GameMaster) > создаёт магазин: ${shop_cr.id}-${shop_cr.name}`);
    }

    return res;
}
