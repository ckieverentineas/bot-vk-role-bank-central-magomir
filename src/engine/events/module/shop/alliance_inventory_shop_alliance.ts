import { Inventory, Prisma, User } from "@prisma/client";
import prisma from "../prisma_client";
import { KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id } from "../../../..";
import { Confirm_User_Success, Input_Number, Keyboard_Index, Logger, Send_Message, Send_Message_Smart } from "../../../core/helper";
import { button_alliance_return, InventoryType } from "../data_center/standart";

async function Inventory_Get(cursor: number, user_id: number): Promise<Inventory[]> {
    const batchSize = 5;
    let counter = 0;
    let limiter = 0;
    let res: Inventory[] = [];

    const items = await prisma.inventory.findMany({
        where: { id_user: user_id }
    });

    for (const item of items) {
        if ((cursor <= counter && batchSize + cursor >= counter) && limiter < batchSize) {
            res.push(item);
            limiter++;
        }
        counter++;
    }

    return res;
}

export async function Inventory_Printer(context: any, user: User, user_adm?: User) {
    let inventory_tr = false;
    let cursor = 0;

    while (!inventory_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = '';

        const items = await Inventory_Get(cursor, user.id);

        for await (const inv of items) {
            let item = null
            if (inv.type == InventoryType.ITEM_SHOP_ALLIANCE) {
                item = await prisma.allianceShopItem.findFirst({ where: { id: inv.id_item } })
            }
            if (inv.type == InventoryType.ITEM_SHOP) {
                item = await prisma.item.findFirst({ where: { id: inv.id_item } })
            }
            if (inv.type == InventoryType.ITEM_STORAGE) {
                item = await prisma.itemStorage.findFirst({ where: { id: inv.id_item } })
            }
            keyboard.textButton({
                label: `🧳 ${item?.name.slice(0, 30)} — ${inv.id}`,
                payload: { command: 'inventory_select', cursor, id_item: inv.id },
                color: 'secondary'
            })
            //if (user_adm) {
            keyboard.textButton({ label: `🎁`, payload: { command: 'inventory_present', cursor, id_item: inv.id }, color: 'negative' })
            .textButton({ label: `⛔`, payload: { command: 'inventory_delete', cursor, id_item: inv.id }, color: 'negative' });
            //}
            keyboard.row()
            event_logger += `🧳 ${inv.id} - ${item?.name}\n`;
        }

        if (cursor >= 5) {
            keyboard.textButton({ label: `←`, payload: { command: 'inventory_back', cursor }, color: 'secondary' });
        }

        const totalItems = await prisma.inventory.count({ where: { id_user: user.id } });
        if (5 + cursor < totalItems) {
            keyboard.textButton({ label: `→`, payload: { command: 'inventory_next', cursor }, color: 'secondary' });
        }

        keyboard.textButton({ label: `<🔎>`, payload: { command: 'inventory_target', cursor }, color: 'secondary' })
        .textButton({ label: `🚫 Выход`, payload: { command: 'inventory_return', cursor }, color: 'negative' }).oneTime();

        event_logger += `\n${1 + cursor} из ${totalItems}`;

        const inv_bt = await context.question(
            `🎒 ${user_adm ? `${user.name}` : 'Ваш'} инвентарь:\n${event_logger}`,
            { keyboard, answerTimeLimit }
        );

        if (inv_bt.isTimeout) {
            await context.send(`⏰ Время истекло!`);
            return;
        }

        if (!inv_bt.payload || !inv_bt.payload.command) {
            await context.send(`💡 Жмите только на кнопки.`);
            continue;
        }

        const config: any = {
            'inventory_select': Inventory_Select,
            'inventory_delete': Inventory_Delete,
            'inventory_present': Inventory_Present,
            'inventory_next': Inventory_Next,
            'inventory_target': Inventory_Target,
            'inventory_back': Inventory_Back,
            'inventory_return': Inventory_Return
        };

        const ans = await config[inv_bt.payload.command](context, inv_bt.payload, user, user_adm);
        cursor = ans?.cursor ?? cursor;
        inventory_tr = ans.stop ?? false;
    }
    await Keyboard_Index(context, `⌛ Вместимость неограничена, это маготехнологии министерства?`)
}

async function Inventory_Select(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor };
    const inv = await prisma.inventory.findFirst({
        where: { id: data.id_item },
    });

    if (!inv) {
        await context.send(`❌ Предмет не найден.`);
        return res;
    }
    let item = null
    let text = ''
    if (inv.type == InventoryType.ITEM_SHOP_ALLIANCE) {
        item = await prisma.allianceShopItem.findFirst({ where: { id: inv.id_item } })
        if (!item) {
            await context.send(`❌ Предмет не найден.`);
            return res;
        }
        text = `🛍 Предмет: **${item.name}**\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n💰 Стоимость: ${item.price}\n📦 Версия: ${item.limit_tr ? `ограниченное издание` : '∞ Безлимит'}\n🧲 Где куплено: в Ролевом магазине\n💬 Комментарий: ${inv.comment}`;
    }
    if (inv.type == InventoryType.ITEM_STORAGE) {
        item = await prisma.itemStorage.findFirst({ where: { id: inv.id_item } })
        if (!item) {
            await context.send(`❌ Предмет не найден.`);
            return res;
        }
        text = `🛍 Предмет: **${item.name}**\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n🧲 Как получено: Артефакт\n💬 Комментарий: ${inv.comment}`;
    }
    if (inv.type == InventoryType.ITEM_SHOP) {
        item = await prisma.item.findFirst({ where: { id: inv.id_item } })
        if (!item) {
            await context.send(`❌ Предмет не найден.`);
            return res;
        }
        text = `🛍 Предмет: **${item.name}**\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n💰 Стоимость: ${item.price}\n🧲 Где куплено: в Маголавке`;
    }
    const attached = item?.image ? item?.image : null;
    const okKeyboard = new KeyboardBuilder()
        .textButton({ label: `✅ ОК`, payload: { command: 'inventory_return' }, color: 'positive' })
        .inline().oneTime();

    await Send_Message(context.peerId, text, okKeyboard, attached);

    return res;
}

async function Inventory_Delete(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor };
    const inv = await prisma.inventory.findFirst({
        where: { id: data.id_item },
    });
    if (!inv) {
        await context.send(`❌ Предмет не найден.`);
        return res;
    }
    let item = null
    if (inv.type == InventoryType.ITEM_SHOP_ALLIANCE) {
        item = await prisma.allianceShopItem.findFirst({ where: { id: inv.id_item } })
        if (!item) {
            await context.send(`❌ Предмет не найден.`);
            return res;
        }
        //text = `🛍 Предмет: **${item.name}**\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n💰 Стоимость: ${item.price}\n📦 Версия: ${item.limit_tr ? `ограниченное издание` : '∞ Безлимит'}\n🧲 Где куплено: в Ролевом магазине`;
    }
    if (inv.type == InventoryType.ITEM_SHOP) {
        item = await prisma.item.findFirst({ where: { id: inv.id_item } })
        if (!item) {
            await context.send(`❌ Предмет не найден.`);
            return res;
        }
        //text = `🛍 Предмет: **${item.name}**\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n💰 Стоимость: ${item.price}\n🧲 Где куплено: в Маголавке`;
    }
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `удалить "${item?.name}" из инвентаря?`);

    await context.send(confirm.text);
    if (!confirm.status) return res;
    const deleted = await prisma.inventory.delete({
        where: { id: inv.id }
    });

    if (deleted) {
        await Logger(`Игрок @id${user_adm?.idvk} удалил "${deleted.id}-${item?.name}" из инвентаря`);
        await context.send(`Вы удалили "${deleted.id}-${item?.name}" из инвентаря.`);
        if(user_adm) {
            await Send_Message(user.idvk, `🎒 Вашу покупку "${deleted.id}-${item?.name}" выкрали из инвентаря, надеемся, что ее раздали бездомным детям в африке, а не себе, или хотя бы пожертвовали в Азкабан.`);
            await Send_Message(chat_id, `🎒 @id${user_adm.idvk}(${user_adm.name}) удаляет "${deleted.id}-${item?.name}" из инвентаря для клиента @id${user.idvk}(${user.name})`);
        } else { 
            await Send_Message(chat_id, `🎒 @id${user.idvk}(${user.name}) удаляет "${deleted.id}-${item?.name}" из инвентаря`);
        }
    }

    return res;
}
async function Inventory_Present(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor };
    const inv = await prisma.inventory.findFirst({
        where: { id: data.id_item },
    });
    if (!inv) {
        await context.send(`❌ Предмет не найден.`);
        return res;
    }
    let item = null
    let text = ''
    if (inv.type == InventoryType.ITEM_SHOP_ALLIANCE) {
        item = await prisma.allianceShopItem.findFirst({ where: { id: inv.id_item } })
        if (!item) {
            await context.send(`❌ Предмет не найден.`);
            return res;
        }
        text = `🛍 Предмет: **${item.name}**\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n💰 Стоимость: ${item.price}\n📦 Версия: ${item.limit_tr ? `ограниченное издание` : '∞ Безлимит'}\n🧲 Где куплено: в Ролевом магазине\n💬 Комментарий: ${inv.comment}`;
    }
    if (inv.type == InventoryType.ITEM_SHOP) {
        item = await prisma.item.findFirst({ where: { id: inv.id_item } })
        if (!item) {
            await context.send(`❌ Предмет не найден.`);
            return res;
        }
        text = `🛍 Предмет: **${item.name}**\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n💰 Стоимость: ${item.price}\n🧲 Где куплено: в Маголавке`;
    }
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(context, `подарить кому-то "${item?.name}" из своего инвентаря?`);
    await context.send(confirm.text);
    if (!confirm.status) return res;
    const person_goten = await Input_Number(context, `Введите UID персонажа, которому будет подарено:\n ${text}`, true)
    if (!person_goten) { await context.send(`Получатель не найден`); return res }
    if (person_goten == user.id) { await context.send(`Самому себе вы можете подарить только через шопинг:)`); return res}
    const person_goten_check = await prisma.user.findFirst({ where: { id: person_goten } })
    if (!person_goten_check) { await context.send(`Такого персонажа не числится!`); return res }
    const confirm_gift: { status: boolean, text: string } = await Confirm_User_Success(context, `подарить "${item?.name}" ${person_goten_check.name} из своего инвентаря?`);
    //await context.send(confirm.text);
    if (!confirm_gift.status) return res;
    const item_update = await prisma.inventory.update({ where: { id: inv.id }, data: { id_user: person_goten_check.id } });
    if (!item_update) { return res }
    const notif = `"<🎁>" --> передача товара "${item?.name}" от игрока @id${user.idvk}(${user.name}) игроку @id${person_goten_check.idvk}(${person_goten_check.name})${user_adm ? `\n🗿 Инициатор: @id${user_adm.idvk}(${user_adm.name})` : ''}`
    await Send_Message_Smart(context, notif, 'client_callback', person_goten_check)
    if (user_adm) { await Send_Message(user_adm.idvk, notif) }
    await Send_Message(user.idvk, notif)
    return res;
}

async function Inventory_Next(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor + 5 };
    return res;
}

async function Inventory_Target(context: any, data: any, user: User, user_adm?: User) {
    const cursor_change = await Input_Number(context, `Введите позицию, сейчас [${data.cursor}]:`, false)
    const res = { cursor: cursor_change };
    return res;
}

async function Inventory_Back(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor - 5 };
    return res;
}

async function Inventory_Return(context: any, data: any, user: User, user_adm?: User) {
    const res = { stop: true };
    await context.send(`Вы вышли из инвентаря.`, { keyboard: button_alliance_return });
    return res;
}