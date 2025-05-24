import { KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id, timer_text } from "../../../..";
import prisma from "../prisma_client";
import { AllianceShopItem_Printer } from "./alliance_shop_item";
import { Confirm_User_Success, Logger, Send_Message } from "../../../core/helper";

async function AllianceShopCategory_Get(cursor: number, id_shop: number) {
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

export async function AllianceShopCategory_Printer(context: any, id_shop: number) {
    const shop = await prisma.allianceShop.findFirst({ where: { id: id_shop } });
    let category_tr = false;
    let cursor = 0;

    while (!category_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = '';

        for await (const category of await AllianceShopCategory_Get(cursor, id_shop)) {
            keyboard.textButton({
                label: `📁 ${category.id}-${category.name.slice(0, 30)}`,
                payload: { command: 'allianceshopcategory_select', cursor, id_category: category.id },
                color: 'secondary'
            })
            .textButton({
                label: `✏`,
                payload: { command: 'allianceshopcategory_edit', cursor, id_category: category.id },
                color: 'secondary'
            })
            .textButton({
                label: `⛔`,
                payload: { command: 'allianceshopcategory_delete', cursor, id_category: category.id },
                color: 'negative'
            }).row();

            event_logger += `💬 ${category.id} - ${category.name}\n`;
        }

        if (cursor >= 5) {
            keyboard.textButton({ label: `←`, payload: { command: 'allianceshopcategory_back', cursor }, color: 'secondary' });
        }

        const category_counter = await prisma.allianceShopCategory.count({ where: { id_alliance_shop: id_shop } });
        if (5 + cursor < category_counter) {
            keyboard.textButton({ label: `→`, payload: { command: 'allianceshopcategory_next', cursor }, color: 'secondary' });
        }

        keyboard.textButton({ label: `➕`, payload: { command: 'allianceshopcategory_create', cursor }, color: 'positive' }).row()
        .textButton({ label: `🚫 Отмена`, payload: { command: 'allianceshopcategory_return', cursor }, color: 'negative' }).oneTime();

        event_logger += `\n${1 + cursor} из ${category_counter}`;

        const category_bt = await context.question(
            `📁 Выберите категорию для магазина ${shop?.name}:\n${event_logger}`,
            { keyboard, answerTimeLimit }
        );

        if (category_bt.isTimeout) {
            await context.send(`⏰ Время ожидания выбора истекло!`);
            return;
        }

        if (!category_bt.payload) {
            await context.send(`💡 Жмите только по кнопкам!`);
            continue;
        }

        const config: any = {
            'allianceshopcategory_select': AllianceShopCategory_Select,
            'allianceshopcategory_create': AllianceShopCategory_Create,
            'allianceshopcategory_next': AllianceShopCategory_Next,
            'allianceshopcategory_back': AllianceShopCategory_Back,
            'allianceshopcategory_return': AllianceShopCategory_Return,
            'allianceshopcategory_delete': AllianceShopCategory_Delete,
            'allianceshopcategory_edit': AllianceShopCategory_Edit
        };

        const ans = await config[category_bt.payload.command](context, category_bt.payload, shop);
        cursor = ans?.cursor ?? cursor;
        category_tr = ans.stop ?? false;
    }
}

async function AllianceShopCategory_Edit(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor };
    const category_id = data.id_category;

    // Получаем текущую категорию
    const category_check = await prisma.allianceShopCategory.findFirst({
        where: { id: category_id }
    });

    if (!category_check) {
        await context.send(`❌ Категория не найдена.`);
        return res;
    }

    // Запрашиваем новое имя
    const name = await context.question(
        `🧷 Вы редактируете категорию "${category_check.name}". Введите новое название (до 100 символов):`,
        { answerTimeLimit }
    );

    if (name.isTimeout) {
        await context.send(`⏰ Время ожидания истекло!`);
        return res;
    }

    if (name.text.length === 0 || name.text.length > 100) {
        await context.send(`💡 Название должно быть от 1 до 100 символов!`);
        return res;
    }

    // Обновляем категорию
    const updatedCategory = await prisma.allianceShopCategory.update({
        where: { id: category_check.id },
        data: { name: name.text }
    });

    if (updatedCategory) {
        await Logger(`Категория обновлена: ${category_check.id} → "${category_check.name}" → "${updatedCategory.name}" админом ${context.senderId}`);
        await context.send(`Вы обновили категорию: ${category_check.id}-${category_check.name} -> ${updatedCategory.id}-${updatedCategory.name}`);
        await Send_Message(chat_id, `📅 @id${context.senderId}(GameMaster) > обновляет категорию: ${category_check.id}-${category_check.name} -> ${updatedCategory.id}-${updatedCategory.name}`);
    }

    return res;
}

async function AllianceShopCategory_Select(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor };
    await AllianceShopItem_Printer(context, data.id_category);
    return res;
}

async function AllianceShopCategory_Delete(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor };
    const category_check = await prisma.allianceShopCategory.findFirst({ where: { id: data.id_category } });
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `удалить категорию ${category_check?.id}-${category_check?.name}?`);

    await context.send(confirm.text);
    if (!confirm.status) return res;

    if (category_check) {
        const category_del = await prisma.allianceShopCategory.delete({ where: { id: category_check.id } });
        if (category_del) {
            await Logger(`Удалена категория: ${category_del.id}-${category_del.name} админом ${context.senderId}`);
            await context.send(`Вы удалили категорию: ${category_del.id}-${category_del.name}`);
            await Send_Message(chat_id, `📅 @id${context.senderId}(GameMaster) > удаляет категорию: ${category_del.id}-${category_del.name}`);
        }
    }

    return res;
}

async function AllianceShopCategory_Create(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor };
    let spec_check = false;
    let name_loc = null;

    while (!spec_check) {
        const name = await context.question(`🧷 Введите название новой категории:`, timer_text);
        if (name.isTimeout) {
            await context.send(`⏰ Время истекло!`);
            return res;
        }
        if (name.text.length > 0 && name.text.length <= 100) {
            spec_check = true;
            name_loc = name.text;
        } else {
            await context.send(`💡 Название должно быть от 1 до 100 символов!`);
        }
    }

    if (name_loc) {
        const category_cr = await prisma.allianceShopCategory.create({
            data: {
                name: name_loc,
                id_alliance_shop: shop.id
            }
        });

        if (category_cr) {
            await Logger(`Создана категория: ${category_cr.id}-${category_cr.name} админом ${context.senderId}`);
            await context.send(`Вы создали категорию: ${category_cr.id}-${category_cr.name}`);
            await Send_Message(chat_id, `📅 @id${context.senderId}(GameMaster) > создаёт категорию: ${category_cr.id}-${category_cr.name}`);
        }
    }

    return res;
}

async function AllianceShopCategory_Return(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor, stop: true };
    await context.send(`Вы вышли из меню категорий.`);
    return res;
}

async function AllianceShopCategory_Next(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor + 5 };
    return res;
}

async function AllianceShopCategory_Back(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor - 5 };
    return res;
}