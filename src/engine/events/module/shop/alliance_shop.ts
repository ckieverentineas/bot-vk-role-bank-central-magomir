import { Keyboard, KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit, timer_text } from "../../../..";
import { Confirm_User_Success, Get_Url_Picture, Keyboard_Index, Send_Message_Question, Send_Message_Smart } from "../../../core/helper";
import { AllianceShopCategory_Printer } from "./alliance_shop_category";
import { button_alliance_return } from "../data_center/standart";

export async function AllianceShop_Get(cursor: number, id_alliance: number) {
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
            const user_owner = await prisma.user.findFirst({ where: { id: shop.id_user_owner } })
            keyboard.textButton({
                label: `🧾 ${shop.id}-${shop.name.slice(0, 30)}`,
                payload: { command: 'allianceshop_select', cursor: cursor, id_shop: shop.id },
                color: 'secondary'
            })
            .textButton({
                label: `✏`,
                payload: { command: 'allianceshop_edit', cursor, id_shop: shop.id },
                color: 'secondary'
            })
            .textButton({
                label: `⛔`,
                payload: { command: 'allianceshop_delete', cursor: cursor, id_shop: shop.id },
                color: 'negative'
            }).row();

            event_logger += `💬 ${shop.id} - ${shop.name}, владелец [${user_owner?.name}-${user_owner?.id}]\n`;
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
        event_logger += `\n${1 + cursor} из ${shop_counter}`;
        const shop_bt = await Send_Message_Question(context, `🛍 Выберите магазин:\n${event_logger}`, keyboard, undefined);
        if (shop_bt.exit) { await context.send(`Вы отменили управление магазинами.`, { keyboard: button_alliance_return }); return await Keyboard_Index(context, `⌛ Магазины уже здесь, как такое произошло?`); }
        const config: any = {
            'allianceshop_select': AllianceShop_Select,
            'allianceshop_create': AllianceShop_Create,
            'allianceshop_next': AllianceShop_Next,
            'allianceshop_back': AllianceShop_Back,
            'allianceshop_delete': AllianceShop_Delete,
            'allianceshop_edit': AllianceShop_Edit
        };

        const ans = await config[shop_bt.payload.command](context, shop_bt.payload, id_alliance);
        cursor = ans?.cursor ?? cursor;
        shop_tr = ans.stop ?? false;
    }
    await Keyboard_Index(context, `⌛ Магазины уже здесь, как такое произошло?`)
}

async function AllianceShop_Edit(context: any, data: any) {
    const res = { cursor: data.cursor };
    const shop_id = data.id_shop;

    // Получаем текущий магазин
    const shop_check = await prisma.allianceShop.findFirst({ where: { id: shop_id } });
    if (!shop_check) {
        await context.send(`❌ Магазин не найден.`);
        return res;
    }

    // Запрашиваем новое имя
    const name = await context.question(
        `🧷 Вы редактируете магазин "${shop_check.name}". Введите новое название (до 100 символов):`,
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
    let image_url = ''
    const imageUrl = await context.question(`📷 Вставьте только ссылку на изображение (или "нет"), сейчас [${shop_check.image}]:`, timer_text);
    if (imageUrl.isTimeout) return res;
    image_url = imageUrl.text.toLowerCase() === 'нет' ? '' : Get_Url_Picture(imageUrl.text) ?? '';
    // Обновляем магазин
    const updatedShop = await prisma.allianceShop.update({
        where: { id: shop_check.id },
        data: { name: name.text, image: image_url }

    });

    if (updatedShop) { await Send_Message_Smart(context, `"Конфигурация магазинов" -->  изменено название и картинка магазина: ${shop_check.id}-${shop_check.name}-${shop_check.image} -> ${updatedShop.id}-${updatedShop.name}-${updatedShop.image}`, 'admin_solo') }

    return res;
}

async function AllianceShop_Delete(context: any, data: any) {
    const res = { cursor: data.cursor };
    const shop_check = await prisma.allianceShop.findFirst({ where: { id: data.id_shop } });
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `удалить магазин ${shop_check?.id}-${shop_check?.name}?`);
    //await context.send(confirm.text);
    if (!confirm.status) return res;
    const confirm2: { status: boolean, text: string } = await Confirm_User_Success(context, `удалить магазин ${shop_check?.id}-${shop_check?.name}, все категории магазина и их товары?`);
    //await context.send(confirm.text);
    if (!confirm2.status) return res;
    const confirm3: { status: boolean, text: string } = await Confirm_User_Success(context, `ТОЧНО удалить магазин ${shop_check?.id}-${shop_check?.name}? (Все покупки из данного магазина в инвентарях игроков останутся, не пропадут)`);
    //await context.send(confirm.text);
    if (!confirm3.status) return res;

    if (shop_check) {
        const shop_del = await prisma.allianceShop.delete({ where: { id: shop_check.id } });
        if (shop_del) { await Send_Message_Smart(context, `"Конфигурация магазинов" -->  удален магазин: ${shop_del.id}-${shop_del.name}`, 'admin_solo') }
    }

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

    let image_url = ''
    const imageUrl = await context.question(`📷 Вставьте только ссылку на изображение (или "нет"):`, timer_text);
    if (imageUrl.isTimeout) return res;
    image_url = imageUrl.text.toLowerCase() === 'нет' ? '' : Get_Url_Picture(imageUrl.text) ?? '';
    const allianceId = id_alliance;
    const shop_cr = await prisma.allianceShop.create({
        data: {
            name: name_loc,
            id_alliance: allianceId,
            image: image_url
        }
    });

    if (shop_cr) { await Send_Message_Smart(context, `"Конфигурация магазинов" -->  открыт новый магазин: ${shop_cr.id}-${shop_cr.name}`, 'admin_solo') }

    return res;
}
