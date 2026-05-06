import { KeyboardBuilder } from "vk-io";
import { answerTimeLimit, timer_text } from "../../../..";
import prisma from "../prisma_client";
import { AllianceShopItem_Printer } from "./alliance_shop_item";
import { Confirm_User_Success, Get_Url_Picture, Send_Message_Question, Send_Message_Smart } from "../../../core/helper";
import { getChestSelectionForCategory } from "../alliance/chest_category_binder";

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
            // Получаем информацию о привязанном сундуке
            const categoryChest = await prisma.categoryChest.findFirst({
                where: { id_category: category.id },
                include: { chest: true }
            });
            
            let chestInfo = '';
            if (categoryChest?.chest) {
                chestInfo = `, сундук [${categoryChest.chest.name}]`;
            }
            
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

            event_logger += `📁 ${category.id} - ${category.name}${chestInfo}\n`;
        }

        if (cursor >= 5) {
            keyboard.textButton({ label: `←`, payload: { command: 'allianceshopcategory_back', cursor }, color: 'secondary' });
        }

        const category_counter = await prisma.allianceShopCategory.count({ where: { id_alliance_shop: id_shop } });
        if (5 + cursor < category_counter) {
            keyboard.textButton({ label: `→`, payload: { command: 'allianceshopcategory_next', cursor }, color: 'secondary' });
        }

        keyboard.textButton({ label: `➕`, payload: { command: 'allianceshopcategory_create', cursor }, color: 'positive' }).row()
        event_logger += `\n${Math.floor(cursor / 5) + 1} из ${Math.ceil(category_counter / 5)}`;
        const attached = shop?.image ? shop?.image : null;
        const category_bt = await Send_Message_Question(context, `📁 Выберите категорию для магазина ${shop?.name}:\n${event_logger}`, keyboard, attached ?? undefined);
        if (category_bt.exit) { return; }
        const config: any = {
            'allianceshopcategory_select': AllianceShopCategory_Select,
            'allianceshopcategory_create': AllianceShopCategory_Create,
            'allianceshopcategory_next': AllianceShopCategory_Next,
            'allianceshopcategory_back': AllianceShopCategory_Back,
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

    while (true) {
        const category_check = await prisma.allianceShopCategory.findFirst({
            where: { id: category_id },
            include: {
                Alliance_Shop: {
                    include: {
                        Alliance: true
                    }
                }
            }
        });

        if (!category_check) {
            await context.send(`❌ Категория не найдена.`);
            return res;
        }

        const keyboard = new KeyboardBuilder()
            .textButton({ label: '✏ Название', payload: { command: 'allianceshopcategory_edit_name', cursor: data.cursor, id_category: category_check.id }, color: 'secondary' })
            .textButton({ label: '🖼 Картинка', payload: { command: 'allianceshopcategory_edit_image', cursor: data.cursor, id_category: category_check.id }, color: 'secondary' }).row()
            .textButton({ label: '🎒 Сундук', payload: { command: 'allianceshopcategory_edit_chest', cursor: data.cursor, id_category: category_check.id }, color: 'secondary' }).row();

        const text =
            `📁 Редактирование категории "${category_check.name}"\n\n` +
            `ID: ${category_check.id}\n` +
            `📷 Картинка: ${category_check.image || 'нет'}\n\n` +
            `Выберите, что изменить:`;

        const answer = await Send_Message_Question(context, text, keyboard, category_check.image || undefined);
        if (answer.exit) { return res; }

        const config: any = {
            'allianceshopcategory_edit_name': AllianceShopCategory_Edit_Name,
            'allianceshopcategory_edit_image': AllianceShopCategory_Edit_Image,
            'allianceshopcategory_edit_chest': AllianceShopCategory_Edit_Chest
        };

        if (answer.payload?.command in config) {
            await config[answer.payload.command](context, answer.payload, shop);
        }
    }
}

async function AllianceShopCategory_Edit_Name(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor };
    const category_check = await prisma.allianceShopCategory.findFirst({ where: { id: data.id_category } });
    if (!category_check) { return res; }

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

    const updatedCategory = await prisma.allianceShopCategory.update({
        where: { id: category_check.id },
        data: { name: name.text }
    });

    if (updatedCategory) {
        await Send_Message_Smart(
            context,
            `"Конфигурация категорий магазина" --> изменено название категории магазина [${shop?.name}]: ${category_check.id}-${category_check.name} -> ${updatedCategory.id}-${updatedCategory.name}`,
            'admin_solo'
        );
    }

    return res;
}

async function AllianceShopCategory_Edit_Image(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor };
    const category_check = await prisma.allianceShopCategory.findFirst({ where: { id: data.id_category } });
    if (!category_check) { return res; }

    const imageUrl = await context.question(
        `📷 Вставьте только ссылку на изображение (или "нет"), сейчас [${category_check.image || 'нет'}]:`,
        timer_text
    );

    if (imageUrl.isTimeout) return res;

    const image_url = imageUrl.text.toLowerCase() === 'нет' ? '' : Get_Url_Picture(imageUrl.text) ?? '';
    const updatedCategory = await prisma.allianceShopCategory.update({
        where: { id: category_check.id },
        data: { image: image_url }
    });

    if (updatedCategory) {
        await Send_Message_Smart(
            context,
            `"Конфигурация категорий магазина" --> изменена картинка категории магазина [${shop?.name} / ${category_check.name}]: ${category_check.image || 'нет'} -> ${updatedCategory.image || 'нет'}`,
            'admin_solo'
        );
    }

    return res;
}

async function AllianceShopCategory_Edit_Chest(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor };
    const category_check = await prisma.allianceShopCategory.findFirst({
        where: { id: data.id_category },
        include: {
            Alliance_Shop: {
                include: {
                    Alliance: true
                }
            }
        }
    });
    const alliance = category_check?.Alliance_Shop?.Alliance;

    if (!category_check || !alliance) {
        await context.send(`❌ Не удалось получить данные категории.`);
        return res;
    }

    await context.send(`🎒 Настраиваем привязку к сундуку для категории "${category_check.name}"...`);
    await getChestSelectionForCategory(context, category_check.id, alliance.id);
    await Send_Message_Smart(context, `"Конфигурация категорий магазина" --> изменена привязка сундука категории [${shop?.name} / ${category_check.name}]`, 'admin_solo');
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
    //await context.send(confirm.text);
    if (!confirm.status) return res;
    const confirm2: { status: boolean, text: string } = await Confirm_User_Success(context, `удалить категорию ${category_check?.id}-${category_check?.name}, все товары в данной категории пропадут?`);
    //await context.send(confirm.text);
    if (!confirm2.status) return res;
    const confirm3: { status: boolean, text: string } = await Confirm_User_Success(context, `ТОЧНО удалить категорию ${category_check?.id}-${category_check?.name}? (Все покупки товаров данной категории останутся в инвентарях пользователей)`);
    //await context.send(confirm.text);
    if (!confirm3.status) return res;

    if (category_check) {
        const category_del = await prisma.allianceShopCategory.delete({ where: { id: category_check.id } });
        if (category_del) { await Send_Message_Smart(context, `"Конфигурация категорий магазина" -->  удалена категория магазина [${shop?.name}]: ${category_del.id}-${category_del.name}`, 'admin_solo') }
    }

    return res;
}

async function AllianceShopCategory_Create(context: any, data: any, shop: any) {
    const res = { cursor: data.cursor };
    let spec_check = false;
    let name_loc = null;

    // 1. Запрашиваем название
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

    // 2. Запрашиваем изображение
    let image_url = '';
    const imageUrl = await context.question(`📷 Вставьте только ссылку на изображение (или "нет"):`, timer_text);
    if (imageUrl.isTimeout) return res;
    image_url = imageUrl.text.toLowerCase() === 'нет' ? '' : Get_Url_Picture(imageUrl.text) ?? '';

    // 3. Создаем категорию
    let category_cr;
    if (name_loc) {
        category_cr = await prisma.allianceShopCategory.create({
            data: {
                name: name_loc,
                id_alliance_shop: shop.id,
                image: image_url
            }
        });

        if (category_cr) { 
            await Send_Message_Smart(
                context, 
                `"Конфигурация категорий магазина" --> добавлена новая категория магазину [${shop?.name}]: ${category_cr.id}-${category_cr.name}`, 
                'admin_solo'
            );
        }
    }

    // 4. ✅ НОВОЕ: Настройка привязки к сундуку (только если создание успешно)
    if (category_cr) {
        // Получаем альянс магазина
        const alliance = await prisma.alliance.findFirst({
            where: { id: shop.id_alliance }
        });
        
        if (alliance) {
            await context.send(`🎒 Настраиваем привязку к сундуку для новой категории "${name_loc}"...`);
            await getChestSelectionForCategory(context, category_cr.id, alliance.id);
        }
    }

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
