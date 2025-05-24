import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit, chat_id, timer_text } from "../../../..";
import { Confirm_User_Success, Fixed_Number_To_Five, Get_Url_Picture, Logger, Send_Message } from "../../../core/helper";
import { AllianceCoin } from "@prisma/client";
import { ico_list } from "../data_center/icons_lib";

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
                label: `💎 ${item.id}-${item.name.slice(0, 30)}`,
                payload: { command: 'allianceshopitem_edit', cursor, id_item: item.id },
                color: 'secondary'
            })
            .textButton({
                label: `⛔`,
                payload: { command: 'allianceshopitem_delete', cursor, id_item: item.id },
                color: 'negative'
            }).row();

            event_logger += `💬 ${item.id} - ${item.name}\n`;
        }

        if (cursor >= 5) {
            keyboard.textButton({ label: `←`, payload: { command: 'allianceshopitem_back', cursor }, color: 'secondary' });
        }

        const item_counter = await prisma.allianceShopItem.count({ where: { id_shop: id_category } });
        if (5 + cursor < item_counter) {
            keyboard.textButton({ label: `→`, payload: { command: 'allianceshopitem_next', cursor }, color: 'secondary' });
        }

        keyboard.textButton({ label: `➕`, payload: { command: 'allianceshopitem_create', cursor }, color: 'positive' }).row()
        .textButton({ label: `🚫 Отмена`, payload: { command: 'allianceshopitem_return', cursor }, color: 'negative' }).oneTime();

        event_logger += `\n${1 + cursor} из ${item_counter}`;

        const item_bt = await context.question(
            `💎 Выберите товар для категории ${category?.name}:\n${event_logger}`,
            { keyboard, answerTimeLimit }
        );

        if (item_bt.isTimeout) {
            await context.send(`⏰ Время ожидания выбора истекло!`);
            return;
        }

        if (!item_bt.payload) {
            await context.send(`💡 Жмите только по кнопкам!`);
            continue;
        }

        const config: any = {
            'allianceshopitem_edit': AllianceShopItem_Edit,
            'allianceshopitem_create': AllianceShopItem_Create,
            'allianceshopitem_next': AllianceShopItem_Next,
            'allianceshopitem_back': AllianceShopItem_Back,
            'allianceshopitem_return': AllianceShopItem_Return,
            'allianceshopitem_delete': AllianceShopItem_Delete
        };

        const ans = await config[item_bt.payload.command](context, item_bt.payload, category);
        cursor = ans?.cursor ?? cursor;
        item_tr = ans.stop ?? false;
    }
}

async function AllianceShopItem_Create(context: any, data: any, category: any) {
    const res = { cursor: data.cursor };
    let name_loc = null;
    let desc = '';
    let image_url = '';
    let price = 0;
    let id_coin = 0;
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
    const coin_pass: AllianceCoin[] = await prisma.allianceCoin.findMany({ where: { id_alliance: Number(alli_shop.id_alliance) } })
    if (!coin_pass) { await context.send(`${ico_list['warn'].ico} Валют ролевых пока еще нет, чтобы начать=)`); return res }
    let coin_check = false
    let id_builder_sent1 = 0
    while (!coin_check) {
        const keyboard = new KeyboardBuilder()
        id_builder_sent1 = await Fixed_Number_To_Five(id_builder_sent1)
        let event_logger = `${ico_list['money'].ico} Выберите валюту, за которую будет покупаться данный товар:\n\n`
        const builder_list: AllianceCoin[] = coin_pass
        if (builder_list.length > 0) {
            const limiter = 5
            let counter = 0
            for (let i=id_builder_sent1; i < builder_list.length && counter < limiter; i++) {
                const builder = builder_list[i]
                keyboard.textButton({ label: `${builder.smile}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent1: i, id_coin: builder.id, coin: builder.name }, color: 'secondary' }).row()
                event_logger += `\n\n${ico_list['message'].ico} ${builder.smile} -> ${builder.id} - ${builder.name}\n`
                counter++
            }
            event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent1+limiter : limiter-(builder_list.length-id_builder_sent1)} из ${builder_list.length} ~~~~` : ''}`
            //предыдущий офис
            if (builder_list.length > limiter && id_builder_sent1 > limiter-1 ) {
                keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'builder_control_multi', id_builder_sent1: id_builder_sent1-limiter}, color: 'secondary' })
            }
            //следующий офис
            if (builder_list.length > limiter && id_builder_sent1 < builder_list.length-limiter) {
                keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'builder_control_multi', id_builder_sent1: id_builder_sent1+limiter }, color: 'secondary' })
            }
        } else {
            event_logger = `${ico_list['warn'].ico} Админы ролевой еще не создали ролевые валюты`
            return context.send(`${event_logger}`)
        }
        const answer1: any = await context.question(`${event_logger}`,
            {	
                keyboard: keyboard.inline(), answerTimeLimit
            }
        )
        if (answer1.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания выбора статуса истекло!`) }
        if (!answer1.payload) {
            await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`)
        } else {
            if (answer1.text == `${ico_list['next'].ico}` || answer1.text == `${ico_list['back'].ico}`) {
                id_builder_sent1 = answer1.payload.id_builder_sent1
            } else {
                id_coin = answer1.payload.id_coin
                coin_check = true
            }
        }
    }

    const priceInput = await context.question(`💰 Введите цену товара:`, timer_text);
    if (priceInput.isTimeout) return res;
    price = parseInt(priceInput.text);

    const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `сделать товар лимитным?`);
    await context.send(confirm.text);
    if (confirm.status) {
        limit_tr = true;
        const limitInput = await context.question(`🔢 Укажите лимит товара:`, timer_text);
        if (limitInput.isTimeout) return res;
        limit = parseInt(limitInput.text) || 0;
    }

    if (name_loc) {
        const item = await prisma.allianceShopItem.create({
            data: {
                name: name_loc,
                description: desc,
                image: image_url,
                price,
                id_shop: category.id,
                id_coin: id_coin,
                limit: limit,
                limit_tr: limit_tr
            }
        });

        await context.send(`✅ Товар создан: ${item.name}`);
    }

    return res;
}

async function AllianceShopItem_Edit(context: any, data: any, category: any) {
    const res = { cursor: data.cursor };
    const item_check = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    if (!item_check) {
        await context.send(`❌ Товар не найден.`);
        return res;
    }
    const alli_shop_cat = await prisma.allianceShopCategory.findFirst({ where: { id: category.id } })
    if (!alli_shop_cat) { return }
    const alli_shop = await prisma.allianceShop.findFirst({ where: { id: alli_shop_cat.id_alliance_shop } })
    if (!alli_shop) { return }
    const coin_get: AllianceCoin | null = await prisma.allianceCoin.findFirst({ where: { id_alliance: Number(alli_shop.id_alliance), id: item_check.id_coin } })
    let text_item = `🛍 Товар: ${item_check.name}\n🧾 ID: ${item_check.id}\n${coin_get?.smile ?? '💰'} Цена: ${item_check.price}\n📜 Описание: ${item_check.description || 'Нет описания'}\n📍 Магазин: ${alli_shop?.name || 'Неизвестный магазин'}\n📁 Категория: ${alli_shop_cat?.name || 'Без категории'}\n ${item_check.limit_tr ? `📦 Количество товаров: ${item_check.limit}` : '♾️ Количество товаров: безлимит'}`;
    const attached = item_check?.image?.includes('photo') ? item_check.image : null
    await context.send(`Вы просматриваете товар: ${text_item}`, { attachment: attached })
    const confirm_ask: { status: boolean, text: string } = await Confirm_User_Success(context, `Хотите отредактировать товар?`);
    //await context.send(confirm.text);
    if (!confirm_ask.status) { return res }
    let limit = item_check?.limit
    let limit_tr = false
    let id_coin = item_check.id_coin

    const name = await context.question(`🧷 Введите новое название товара (или "оставить"), сейчас [${item_check.name}]:`, timer_text);
    if (name.isTimeout) return res;

    const desc = await context.question(`📝 Введите описание товара (или "нет"), сейчас [${item_check.description}]`, timer_text);
    if (desc.isTimeout) return res;

    const imageUrl = await context.question(`📷 Вставьте только ссылку на изображение (или "нет"), сейчас [${item_check.image}]`, timer_text);
    if (imageUrl.isTimeout) return res;

    const coin_pass: AllianceCoin[] = await prisma.allianceCoin.findMany({ where: { id_alliance: Number(alli_shop.id_alliance) } })
    if (!coin_pass) { await context.send(`${ico_list['warn'].ico} Валют ролевых пока еще нет, чтобы начать=)`); return res }
    let coin_check = false
    let id_builder_sent1 = 0
    while (!coin_check) {
        const keyboard = new KeyboardBuilder()
        id_builder_sent1 = await Fixed_Number_To_Five(id_builder_sent1)
        let event_logger = `${ico_list['money'].ico} Выберите валюту, за которую будет покупаться данный товар, сейчас [${item_check.id_coin}]:\n\n`
        const builder_list: AllianceCoin[] = coin_pass
        if (builder_list.length > 0) {
            const limiter = 5
            let counter = 0
            for (let i=id_builder_sent1; i < builder_list.length && counter < limiter; i++) {
                const builder = builder_list[i]
                keyboard.textButton({ label: `${builder.smile}-${builder.name.slice(0,30)}`, payload: { command: 'builder_control', id_builder_sent1: i, id_coin: builder.id, coin: builder.name }, color: 'secondary' }).row()
                event_logger += `\n\n${ico_list['message'].ico} ${builder.smile} -> ${builder.id} - ${builder.name}\n`
                counter++
            }
            event_logger += `\n\n${builder_list.length > 1 ? `~~~~ ${builder_list.length > limiter ? id_builder_sent1+limiter : limiter-(builder_list.length-id_builder_sent1)} из ${builder_list.length} ~~~~` : ''}`
            //предыдущий офис
            if (builder_list.length > limiter && id_builder_sent1 > limiter-1 ) {
                keyboard.textButton({ label: `${ico_list['back'].ico}`, payload: { command: 'builder_control_multi', id_builder_sent1: id_builder_sent1-limiter}, color: 'secondary' })
            }
            //следующий офис
            if (builder_list.length > limiter && id_builder_sent1 < builder_list.length-limiter) {
                keyboard.textButton({ label: `${ico_list['next'].ico}`, payload: { command: 'builder_control_multi', id_builder_sent1: id_builder_sent1+limiter }, color: 'secondary' })
            }
        } else {
            event_logger = `${ico_list['warn'].ico} Админы ролевой еще не создали ролевые валюты`
            return context.send(`${event_logger}`)
        }
        const answer1: any = await context.question(`${event_logger}`,
            {	
                keyboard: keyboard.inline(), answerTimeLimit
            }
        )
        if (answer1.isTimeout) { return await context.send(`${ico_list['time'].ico} Время ожидания выбора статуса истекло!`) }
        if (!answer1.payload) {
            await context.send(`${ico_list['help'].ico} Жмите только по кнопкам с иконками!`)
        } else {
            if (answer1.text == `${ico_list['next'].ico}` || answer1.text == `${ico_list['back'].ico}`) {
                id_builder_sent1 = answer1.payload.id_builder_sent1
            } else {
                id_coin = answer1.payload.id_coin
                coin_check = true
            }
        }
    }

    const priceInput = await context.question(`💰 Введите цену товара, сейчас [${item_check.price}]:`, timer_text);
    if (priceInput.isTimeout) return res;

    const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `сделать товар лимитным, сейчас [${item_check.limit_tr ? 'лимит' : 'безлимит'}]?`);
    await context.send(confirm.text);
    if (confirm.status) {
        limit_tr = true;
        const limitInput = await context.question(`🔢 Укажите лимит товара, сейчас [${item_check.limit}]:`, timer_text);
        if (limitInput.isTimeout) return res;
        limit = parseInt(limitInput.text) || 0;
    }

    const updatedData: any = {};
    if (name.text.toLowerCase() !== 'оставить') updatedData.name = name.text;
    updatedData.description = desc.text.toLowerCase() === 'нет' ? '' : desc.text;
    updatedData.image = imageUrl.text.toLowerCase() === 'нет' ? '' : Get_Url_Picture(imageUrl.text);
    updatedData.price = parseInt(priceInput.text) || item_check.price;
    updatedData.limit = limit;
    updatedData.limit_tr = limit_tr;

    const item_up = await prisma.allianceShopItem.update({
        where: { id: item_check.id },
        data: updatedData
    });

    if (item_up) {
        await Logger(`Товар обновлён: ${item_up.id}-${item_up.name} админом ${context.senderId}`);
        await context.send(`Вы обновили товар: ${item_up.id}-${item_up.name}`);
        await Send_Message(chat_id, `📅 @id${context.senderId}(GameMaster) > обновляет товар: ${item_up.id}-${item_up.name}`);
    }

    return res;
}

async function AllianceShopItem_Delete(context: any, data: any, category: any) {
    const res = { cursor: data.cursor };
    const item_check = await prisma.allianceShopItem.findFirst({ where: { id: data.id_item } });
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `удалить товар ${item_check?.id}-${item_check?.name}?`);

    await context.send(confirm.text);
    if (!confirm.status) return res;

    if (item_check) {
        const item_del = await prisma.allianceShopItem.delete({ where: { id: item_check.id } });
        if (item_del) {
            await Logger(`Удалён товар: ${item_del.id}-${item_del.name} админом ${context.senderId}`);
            await context.send(`Вы удалили товар: ${item_del.id}-${item_del.name}`);
            await Send_Message(chat_id, `📅 @id${context.senderId}(GameMaster) > удаляет товар: ${item_del.id}-${item_del.name}`);
        }
    }

    return res;
}

async function AllianceShopItem_Return(context: any, data: any, category: any) {
    const res = { cursor: data.cursor, stop: true };
    await context.send(`Вы вышли из меню товаров.`);
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