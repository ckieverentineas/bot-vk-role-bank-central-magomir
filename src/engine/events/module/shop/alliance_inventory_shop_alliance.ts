import { Inventory, Prisma, User } from "@prisma/client";
import prisma from "../prisma_client";
import { KeyboardBuilder } from "vk-io";
import { answerTimeLimit, chat_id } from "../../../..";
import { Confirm_User_Success, Input_Number, Keyboard_Index, Logger, Send_Message, Send_Message_Smart } from "../../../core/helper";
import { button_alliance_return, InventoryType } from "../data_center/standart";

// Функция для группировки предметов в инвентаре
async function groupInventoryItems(user_id: number): Promise<any[]> {
    const items = await prisma.inventory.findMany({
        where: { id_user: user_id }
    });

    const grouped: {[key: string]: any} = {};

    for (const item of items) {
        const key = `${item.type}_${item.id_item}`;
        
        if (!grouped[key]) {
            // Получаем информацию о предмете
            let itemInfo = null;
            if (item.type == InventoryType.ITEM_SHOP_ALLIANCE) {
                itemInfo = await prisma.allianceShopItem.findFirst({ where: { id: item.id_item } });
            } else if (item.type == InventoryType.ITEM_SHOP) {
                itemInfo = await prisma.item.findFirst({ where: { id: item.id_item } });
            } else if (item.type == InventoryType.ITEM_STORAGE) {
                itemInfo = await prisma.itemStorage.findFirst({ where: { id: item.id_item } });
            }

            grouped[key] = {
                type: item.type,
                id_item: item.id_item,
                name: itemInfo?.name || 'Неизвестный предмет',
                count: 1,
                inventory_ids: [item.id],
                item_info: itemInfo
            };
        } else {
            grouped[key].count++;
            grouped[key].inventory_ids.push(item.id);
        }
    }

    return Object.values(grouped);
}

async function Inventory_Get(cursor: number, user_id: number, group_mode: boolean = false): Promise<{items: Inventory[], grouped: any[]}> {
    const batchSize = 5;
    let counter = 0;
    let limiter = 0;
    let res: Inventory[] = [];

    // Получаем все предметы пользователя
    const items = await prisma.inventory.findMany({
        where: { id_user: user_id }
    });

    // Группируем предметы по типу и id_item
    const groupedItems = await groupInventoryItems(user_id);

    if (!group_mode) {
        // Старая логика для постраничного вывода (оставляем для совместимости)
        for (const item of items) {
            if ((cursor <= counter && batchSize + cursor >= counter) && limiter < batchSize) {
                res.push(item);
                limiter++;
            }
            counter++;
        }
    }

    return { items: res, grouped: groupedItems };
}

// Функция для обрезки текста кнопки
function truncateButtonLabel(text: string, maxLength: number = 40): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

export async function Inventory_Printer(context: any, user: User, user_adm?: User) {
    let inventory_tr = false;
    let cursor = 0;
    let group_mode = false;

    while (!inventory_tr) {
        const keyboard = new KeyboardBuilder();
        let event_logger = '';

        const inventoryData = await Inventory_Get(cursor, user.id, group_mode);
        const items = inventoryData.items;
        const groupedItems = inventoryData.grouped;

        if (group_mode) {
            // Режим группировки - показываем сгруппированные предметы
            const displayedGroups = groupedItems.slice(cursor, cursor + 5);
            
            for await (const group of displayedGroups) {
                // Ограничиваем длину названия предмета для кнопки
                const itemName = group.name.length > 25 ? group.name.slice(0, 25) + '...' : group.name;
                let buttonLabel = `🧳 ${itemName} × ${group.count}`;
                
                // Проверяем, что длина не превышает 40 символов
                if (buttonLabel.length > 40) {
                    // Если все равно превышает, дополнительно сокращаем
                    const maxNameLength = 35 - group.count.toString().length - 5; // 5 для эмодзи и символов
                    const truncatedName = group.name.slice(0, maxNameLength) + '...';
                    buttonLabel = `🧳 ${truncatedName} × ${group.count}`;
                    
                    // Если все еще слишком длинное, используем минимальный вариант
                    if (buttonLabel.length > 40) {
                        buttonLabel = `🧳 × ${group.count}`;
                    }
                }
                
                // Основная кнопка предмета
                keyboard.textButton({
                    label: buttonLabel,
                    payload: { 
                        command: 'inventory_group_select', 
                        cursor, 
                        type: group.type, 
                        id_item: group.id_item,
                        group_mode: true 
                    },
                    color: 'secondary'
                });
                
                // Кнопки действий в той же строке - показываем ВСЕГДА
                keyboard.textButton({ 
                    label: `🎁`, 
                    payload: { 
                        command: 'inventory_group_present', 
                        cursor, 
                        type: group.type, 
                        id_item: group.id_item,
                        group_mode: true 
                    }, 
                    color: 'negative' 
                });
                keyboard.textButton({ 
                    label: `⛔`, 
                    payload: { 
                        command: 'inventory_group_delete', 
                        cursor, 
                        type: group.type, 
                        id_item: group.id_item,
                        group_mode: true 
                    }, 
                    color: 'negative' 
                });
                keyboard.row(); // Переход на новую строку после всех кнопок предмета
                event_logger += `🧳 ${group.name} × ${group.count}\n`;
            }
        } else {
            // Старый режим - показываем поштучно
            for await (const inv of items) {
                let item = null;
                if (inv.type == InventoryType.ITEM_SHOP_ALLIANCE) {
                    item = await prisma.allianceShopItem.findFirst({ where: { id: inv.id_item } });
                }
                if (inv.type == InventoryType.ITEM_SHOP) {
                    item = await prisma.item.findFirst({ where: { id: inv.id_item } });
                }
                if (inv.type == InventoryType.ITEM_STORAGE) {
                    item = await prisma.itemStorage.findFirst({ where: { id: inv.id_item } });
                }
                
                const itemName = item?.name ? (item.name.length > 25 ? item.name.slice(0, 25) + '...' : item.name) : 'Неизвестный предмет';
                let buttonLabel = `🧳 ${itemName} — ${inv.id}`;
                
                // Проверяем длину для поштучного режима
                if (buttonLabel.length > 40) {
                    const maxNameLength = 30 - inv.id.toString().length - 5;
                    const truncatedName = item?.name ? (item.name.slice(0, maxNameLength) + '...') : 'Предмет';
                    buttonLabel = `🧳 ${truncatedName} — ${inv.id}`;
                    
                    if (buttonLabel.length > 40) {
                        buttonLabel = `🧳 ID:${inv.id}`;
                    }
                }
                
                // Основная кнопка предмета
                keyboard.textButton({
                    label: buttonLabel,
                    payload: { command: 'inventory_select', cursor, id_item: inv.id, group_mode: false },
                    color: 'secondary'
                });
                
                // Кнопки действий в той же строке - показываем ВСЕГДА
                keyboard.textButton({ 
                    label: `🎁`, 
                    payload: { command: 'inventory_present', cursor, id_item: inv.id, group_mode: false }, 
                    color: 'negative' 
                });
                keyboard.textButton({ 
                    label: `⛔`, 
                    payload: { command: 'inventory_delete', cursor, id_item: inv.id, group_mode: false }, 
                    color: 'negative' 
                });
                keyboard.row(); // Переход на новую строку после всех кнопок предмета
                event_logger += `🧳 ${inv.id} - ${item?.name || 'Неизвестный предмет'}\n`;
            }
        }

        // Навигация (старый визуал)
        const totalItems = group_mode ? groupedItems.length : await prisma.inventory.count({ where: { id_user: user.id } });
        
        if (cursor >= 5) {
            keyboard.textButton({ 
                label: `←`, 
                payload: { command: 'inventory_back', cursor, group_mode }, 
                color: 'secondary' 
            });
        }

        if (5 + cursor < totalItems) {
            keyboard.textButton({ 
                label: `→`, 
                payload: { command: 'inventory_next', cursor, group_mode }, 
                color: 'secondary' 
            });
        }

        if (cursor >= 5 || 5 + cursor < totalItems) {
            keyboard.row();
        }

        // Кнопки управления (старый визуал)
        keyboard.textButton({ 
            label: group_mode ? `📋 Поштучно` : `📦 Группами`, 
            payload: { command: 'inventory_toggle_mode', cursor, group_mode }, 
            color: 'primary' 
        });
        keyboard.textButton({ 
            label: `<🔎>`, 
            payload: { command: 'inventory_target', cursor, group_mode }, 
            color: 'secondary' 
        });
        keyboard.textButton({ 
            label: `🎁 ∞`, 
            payload: { command: 'inventory_mass_present', cursor, group_mode }, 
            color: 'positive' 
        });
        keyboard.textButton({ 
            label: `🚫 Выход`, 
            payload: { command: 'inventory_return', cursor }, 
            color: 'negative' 
        });
        
        keyboard.oneTime();

        const totalCount = await prisma.inventory.count({ where: { id_user: user.id } });
        const uniqueCount = groupedItems.length;
        
        event_logger += `\n${1 + Math.floor(cursor / 5)} из ${Math.ceil(totalItems / 5)}`;
        event_logger += `\n📊 Всего предметов: ${totalCount} | Уникальных: ${uniqueCount}`;
        event_logger += `\n🔧 Режим: ${group_mode ? 'Группы' : 'Поштучно'}`;

        const inv_bt = await context.question(
            `🎒 ${user_adm ? `${user.name}` : 'Ваш'} инвентарь:\n${event_logger}`,
            { keyboard, answerTimeLimit }
        );

        // Остальной код обработки без изменений...
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
            'inventory_group_select': Inventory_Group_Select,
            'inventory_delete': Inventory_Delete,
            'inventory_group_delete': Inventory_Group_Delete,
            'inventory_present': Inventory_Present,
            'inventory_group_present': Inventory_Group_Present,
            'inventory_mass_present': Inventory_Mass_Present,
            'inventory_next': Inventory_Next,
            'inventory_back': Inventory_Back,
            'inventory_target': Inventory_Target,
            'inventory_toggle_mode': Inventory_Toggle_Mode,
            'inventory_return': Inventory_Return,
            'mass_present_select_item': Mass_Present_Select_Item,
            'mass_present_mode': Mass_Present_Mode,
            'mass_present_prev_page': Mass_Present_Prev_Page,
            'mass_present_next_page': Mass_Present_Next_Page,
            'mass_present_cancel': Mass_Present_Cancel
        };

        const ans = await config[inv_bt.payload.command](context, inv_bt.payload, user, user_adm);
        cursor = ans?.cursor ?? cursor;
        group_mode = ans?.group_mode ?? group_mode;
        inventory_tr = ans.stop ?? false;
    }
    await Keyboard_Index(context, `⌛ Вместимость неограничена, это маготехнологии министерства?`);
}

// Функция информации о странице
async function Inventory_Page_Info(context: any, data: any, user: User, user_adm?: User) {
    const totalItems = data.group_mode ? 
        (await groupInventoryItems(user.id)).length : 
        await prisma.inventory.count({ where: { id_user: user.id } });
    
    const totalPages = Math.ceil(totalItems / 5);
    const currentPage = Math.floor(data.cursor / 5) + 1;
    
    await context.send(`📄 Страница ${currentPage} из ${totalPages}\n📊 Всего предметов: ${totalItems}`);
    
    return { cursor: data.cursor, group_mode: data.group_mode };
}

// Функция отмены массового дарения
async function Mass_Present_Cancel(context: any, data: any, user: User, user_adm?: User) {
    await context.send(`❌ Массовое дарение отменено.`);
    return { cursor: data.cursor, group_mode: data.group_mode };
}

// Переключение режима отображения
async function Inventory_Toggle_Mode(context: any, data: any, user: User, user_adm?: User) {
    // Инвертируем текущий режим
    const new_group_mode = !data.group_mode;
    const res = { cursor: 0, group_mode: new_group_mode }; // Сбрасываем курсор при смене режима
    await context.send(`🔧 Режим изменен на: ${new_group_mode ? 'Группы' : 'Поштучно'}`);
    return res;
}

// Выбор группы предметов
async function Inventory_Group_Select(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor, group_mode: data.group_mode };
    
    // Получаем информацию о группе предметов
    const groupedItems = await groupInventoryItems(user.id);
    const group = groupedItems.find(g => g.type === data.type && g.id_item === data.id_item);
    
    if (!group) {
        await context.send(`❌ Группа предметов не найдена.`);
        return res;
    }

    let text = '';
    if (group.type == InventoryType.ITEM_SHOP_ALLIANCE) {
        text = `🛍 Предмет: ${group.name}\n🧾 Количество: ${group.count}\n📜 Описание: ${group.item_info?.description || 'Нет описания'}\n💰 Стоимость: ${group.item_info?.price || 'N/A'}\n📦 Версия: ${group.item_info?.limit_tr ? `ограниченное издание` : '∞ Безлимит'}\n🧲 Где куплено: в Ролевом магазине`;
    } else if (group.type == InventoryType.ITEM_STORAGE) {
        text = `🛍 Предмет: ${group.name}\n🧾 Количество: ${group.count}\n📜 Описание: ${group.item_info?.description || 'Нет описания'}\n🧲 Как получено: Артефакт`;
    } else if (group.type == InventoryType.ITEM_SHOP) {
        text = `🛍 Предмет: ${group.name}\n🧾 Количество: ${group.count}\n📜 Описание: ${group.item_info?.description || 'Нет описания'}\n💰 Стоимость: ${group.item_info?.price || 'N/A'}\n🧲 Где куплено: в Маголавке`;
    }

    const attached = group.item_info?.image ? group.item_info.image : null;
    const okKeyboard = new KeyboardBuilder()
        .textButton({ label: `✅ ОК`, payload: { command: 'inventory_return' }, color: 'positive' })
        .inline().oneTime();

    await Send_Message(context.peerId, text, okKeyboard, attached);

    return res;
}

// Дарение группы предметов
async function Inventory_Group_Present(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor, group_mode: data.group_mode };
    
    // Получаем информацию о группе
    const groupedItems = await groupInventoryItems(user.id);
    const group = groupedItems.find(g => g.type === data.type && g.id_item === data.id_item);
    
    if (!group) {
        await context.send(`❌ Группа предметов не найдена.`);
        return res;
    }

    const confirm: { status: boolean, text: string } = await Confirm_User_Success(
        context, 
        `подарить ${group.count} предметов "${group.name}"?`
    );
    
    if (!confirm.status) return res;

    // Получаем UID получателя
    const person_goten = await Input_Number(context, `Введите UID персонажа, которому будут подарены ${group.count} предметов "${group.name}":`, true);
    if (!person_goten) { 
        await context.send(`❌ Получатель не указан.`); 
        return res; 
    }
    
    if (person_goten == user.id) { 
        await context.send(`❌ Нельзя дарить предметы самому себе!`); 
        return res;
    }
    
    const person_goten_check = await prisma.user.findFirst({ where: { id: person_goten } });
    if (!person_goten_check) { 
        await context.send(`❌ Персонаж с UID ${person_goten} не найден!`); 
        return res; 
    }

    // Подтверждение финальное
    const final_confirm: { status: boolean, text: string } = await Confirm_User_Success(
        context, 
        `подарить ${group.count} предметов "${group.name}" игроку ${person_goten_check.name}?`
    );
    
    if (!final_confirm.status) {
        await context.send(`❌ Дарение группы предметов отменено.`);
        return res;
    }

    // Выполняем дарение всех предметов группы
    let success_count = 0;
    let failed_count = 0;

    for (const inventory_id of group.inventory_ids) {
        try {
            const updated_item = await prisma.inventory.update({
                where: { id: inventory_id },
                data: { 
                    id_user: person_goten_check.id,
                    comment: `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}`
                }
            });

            if (updated_item) {
                success_count++;
            } else {
                failed_count++;
            }
        } catch (error) {
            await context.send(`⚠ Ошибка при передаче предмета ID ${inventory_id}`);
            failed_count++;
        }
    }

    // Отправляем уведомления
    const result_message = `🎁 Дарение группы предметов завершено!\n\n✅ Успешно передано: ${success_count} предметов\n❌ Не удалось передать: ${failed_count} предметов\n\n📦 Получатель: ${person_goten_check.name} (UID: ${person_goten_check.id})\n🎯 Предмет: ${group.name} × ${success_count}`;

    await context.send(result_message);

    // Уведомление получателю
    const receiver_message = `🎁 Вам подарены предметы от @id${user.idvk}(${user.name}) (UID: ${user.id})!\n\n🎯 Получено персонажем: ${person_goten_check.name} (UID: ${person_goten_check.id})\n\nБыло передано ${success_count} предметов: ${group.name} × ${success_count}`;

    await Send_Message(person_goten_check.idvk, receiver_message);

    // Уведомление в чат
    const log_message = `🎁 Дарение группы предметов

👤 Отправитель: @id${user.idvk}(${user.name}) (UID: ${user.id})
🎯 Получатель: @id${person_goten_check.idvk}(${person_goten_check.name}) (UID: ${person_goten_check.id})
📦 Передано предметов: ${success_count}
🎯 Предмет: ${group.name} × ${success_count}`;

    await Send_Message(chat_id, log_message);

    return res;
}

// Удаление группы предметов
async function Inventory_Group_Delete(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor, group_mode: data.group_mode };
    
    // Получаем информацию о группе
    const groupedItems = await groupInventoryItems(user.id);
    const group = groupedItems.find(g => g.type === data.type && g.id_item === data.id_item);
    
    if (!group) {
        await context.send(`❌ Группа предметов не найдена.`);
        return res;
    }

    const confirm: { status: boolean, text: string } = await Confirm_User_Success(
        context, 
        `удалить ${group.count} предметов "${group.name}" из инвентаря?`
    );
    
    if (!confirm.status) return res;

    // Выполняем удаление всех предметов группы
    let success_count = 0;
    let failed_count = 0;

    for (const inventory_id of group.inventory_ids) {
        try {
            const deleted = await prisma.inventory.delete({
                where: { id: inventory_id }
            });

            if (deleted) {
                success_count++;
            } else {
                failed_count++;
            }
        } catch (error) {
            await context.send(`⚠ Ошибка при удалении предмета ID ${inventory_id}`);
            failed_count++;
        }
    }

    // Логируем и уведомляем
    if (success_count > 0) {
        await Logger(`Игрок @id${user_adm?.idvk || user.idvk} удалил "${group.name} × ${success_count}" из инвентаря`);
        await context.send(`Вы удалили "${group.name} × ${success_count}" из инвентаря.`);
        
        if(user_adm) {
            await Send_Message(user.idvk, `🎒 Ваши покупки "${group.name} × ${success_count}" выкрали из инвентаря, надеемся, что их раздали бездомным детям в Африке, а не себе, или хотя бы пожертвовали в Азкабан.`);
            await Send_Message(chat_id, `🎒 @id${user_adm.idvk}(${user_adm.name}) удаляет "${group.name} × ${success_count}" из инвентаря для клиента @id${user.idvk}(${user.name})`);
        } else { 
            await Send_Message(chat_id, `🎒 @id${user.idvk}(${user.name}) удаляет "${group.name} × ${success_count}" из инвентаря`);
        }
    }

    await context.send(`🗑 Удаление завершено:\n✅ Успешно удалено: ${success_count} предметов\n❌ Не удалось удалить: ${failed_count} предметов`);

    return res;
}

// Обновленные функции навигации с учетом режима группировки
async function Inventory_Next(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor + 5, group_mode: data.group_mode ?? false };
    return res;
}

async function Inventory_Back(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: Math.max(0, data.cursor - 5), group_mode: data.group_mode ?? false };
    return res;
}

async function Inventory_Target(context: any, data: any, user: User, user_adm?: User) {
    const totalItems = data.group_mode ? 
        (await groupInventoryItems(user.id)).length : 
        await prisma.inventory.count({ where: { id_user: user.id } });
    
    const cursor_change = await Input_Number(context, `Введите позицию, сейчас [${Math.floor(data.cursor / 5) + 1}]:`, false);
    
    // Проверяем, что cursor_change - число, а не false
    if (cursor_change === false) {
        const res = { cursor: data.cursor, group_mode: data.group_mode ?? false };
        return res;
    }
    
    // Проверяем, что введенная позиция не превышает общее количество страниц
    const totalPages = Math.ceil(totalItems / 5);
    if (cursor_change > totalPages) {
        // Устанавливаем курсор на последнюю доступную страницу
        const lastCursor = (totalPages - 1) * 5;
        const res = { cursor: lastCursor, group_mode: data.group_mode ?? false };
        await context.send(`⚠ Вы ввели позицию ${cursor_change}, но у вас всего ${totalPages} страниц. Курсор установлен на последнюю страницу.`);
        return res;
    }
    
    // Проверяем, что позиция не отрицательная
    if (cursor_change < 1) {
        const res = { cursor: 0, group_mode: data.group_mode ?? false };
        await context.send(`⚠ Позиция не может быть меньше 1. Курсор установлен на начало.`);
        return res;
    }
    
    const res = { cursor: (cursor_change - 1) * 5, group_mode: data.group_mode ?? false };
    return res;
}

// Существующие функции (оставляем без изменений, но добавляем поддержку group_mode)
async function Inventory_Select(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor, group_mode: data.group_mode ?? false };
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
        text = `🛍 Предмет: ${item.name}\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n💰 Стоимость: ${item.price}\n📦 Версия: ${item.limit_tr ? `ограниченное издание` : '∞ Безлимит'}\n🧲 Где куплено: в Ролевом магазине\n💬 Комментарий: ${inv.comment}`;
    }
    if (inv.type == InventoryType.ITEM_STORAGE) {
        item = await prisma.itemStorage.findFirst({ where: { id: inv.id_item } })
        if (!item) {
            await context.send(`❌ Предмет не найден.`);
            return res;
        }
        text = `🛍 Предмет: ${item.name}\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n🧲 Как получено: Артефакт\n💬 Комментарий: ${inv.comment}`;
    }
    if (inv.type == InventoryType.ITEM_SHOP) {
        item = await prisma.item.findFirst({ where: { id: inv.id_item } })
        if (!item) {
            await context.send(`❌ Предмет не найден.`);
            return res;
        }
        text = `🛍 Предмет: ${item.name}\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n💰 Стоимость: ${item.price}\n🧲 Где куплено: в Маголавке`;
    }
    const attached = item?.image ? item?.image : null;
    const okKeyboard = new KeyboardBuilder()
        .textButton({ label: `✅ ОК`, payload: { command: 'inventory_return' }, color: 'positive' })
        .inline().oneTime();

    await Send_Message(context.peerId, text, okKeyboard, attached);

    return res;
}

async function Inventory_Delete(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor, group_mode: data.group_mode ?? false };
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
    }
    if (inv.type == InventoryType.ITEM_SHOP) {
        item = await prisma.item.findFirst({ where: { id: inv.id_item } })
        if (!item) {
            await context.send(`❌ Предмет не найден.`);
            return res;
        }
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
            await Send_Message(user.idvk, `🎒 Вашу покупку "${deleted.id}-${item?.name}" выкрали из инвентаря, надеемся, что ее раздали бездомным детям в Африке, а не себе, или хотя бы пожертвовали в Азкабан.`);
            await Send_Message(chat_id, `🎒 @id${user_adm.idvk}(${user_adm.name}) удаляет "${deleted.id}-${item?.name}" из инвентаря для клиента @id${user.idvk}(${user.name})`);
        } else { 
            await Send_Message(chat_id, `🎒 @id${user.idvk}(${user.name}) удаляет "${deleted.id}-${item?.name}" из инвентаря`);
        }
    }

    return res;
}

async function Inventory_Present(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor, group_mode: data.group_mode ?? false };
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
        text = `🛍 Предмет: ${item.name}\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n💰 Стоимость: ${item.price}\n📦 Версия: ${item.limit_tr ? `ограниченное издание` : '∞ Безлимит'}\n🧲 Где куплено: в Ролевом магазине\n💬 Комментарий: ${inv.comment}`;
    }
    if (inv.type == InventoryType.ITEM_SHOP) {
        item = await prisma.item.findFirst({ where: { id: inv.id_item } })
        if (!item) {
            await context.send(`❌ Предмет не найден.`);
            return res;
        }
        text = `🛍 Предмет: ${item.name}\n🧾 ID: ${item.id}\n📜 Описание: ${item.description || 'Нет описания'}\n💰 Стоимость: ${item.price}\n🧲 Где куплено: в Маголавке`;
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
    if (!confirm_gift.status) return res;
    const item_update = await prisma.inventory.update({ where: { id: inv.id }, data: { id_user: person_goten_check.id } });
    if (!item_update) { return res }
    const notif = `"<🎁>" --> передача товара "${item?.name}" от игрока @id${user.idvk}(${user.name}) игроку @id${person_goten_check.idvk}(${person_goten_check.name})${user_adm ? `\n🗿 Инициатор: @id${user_adm.idvk}(${user_adm.name})` : ''}`
    await Send_Message_Smart(context, notif, 'client_callback', person_goten_check)
    if (user_adm) { await Send_Message(user_adm.idvk, notif) }
    await Send_Message(user.idvk, notif)
    return res;
}

async function Inventory_Return(context: any, data: any, user: User, user_adm?: User) {
    const res = { stop: true };
    await context.send(`✅ Вы вышли из инвентаря.`, { keyboard: button_alliance_return });
    return res;
}

// Вспомогательные функции для массового дарения
async function Mass_Present_Mode(context: any, data: any, user: User, user_adm?: User) {
    return { cursor: data.cursor, group_mode: data.group_mode };
}

async function Mass_Present_Select_Item(context: any, data: any, user: User, user_adm?: User) {
    return { cursor: data.cursor, group_mode: data.group_mode };
}

async function Inventory_Mass_Present(context: any, data: any, user: User, user_adm?: User) {
    const res = { cursor: data.cursor, group_mode: data.group_mode ?? false };
    
    // Подтверждение массового дарения
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(
        context, 
        `массово раздарить свои предметы? Это действие нельзя отменить!`
    );
    
    if (!confirm.status) {
        await context.send(`❌ Массовое дарение отменено.`);
        return res;
    }

    // Получаем UID получателя
    const person_goten = await Input_Number(context, `Введите UID персонажа, которому будут подарены предметы:`, true);
    if (!person_goten) { 
        await context.send(`❌ Получатель не указан.`); 
        return res; 
    }
    
    if (person_goten == user.id) { 
        await context.send(`❌ Нельзя дарить предметы самому себе!`); 
        return res;
    }
    
    const person_goten_check = await prisma.user.findFirst({ where: { id: person_goten } });
    if (!person_goten_check) { 
        await context.send(`❌ Персонаж с UID ${person_goten} не найден!`); 
        return res; 
    }

    // Выбор режима дарения
    const modeKeyboard = new KeyboardBuilder()
        .textButton({ 
            label: `📋 По ID предметов`, 
            payload: { command: 'mass_present_mode', mode: 'by_ids' }, 
            color: 'primary' 
        })
        .textButton({ 
            label: `📦 По типу и количеству`, 
            payload: { command: 'mass_present_mode', mode: 'by_type' }, 
            color: 'primary' 
        })
        .row()
        .textButton({ 
            label: `❌ Отмена`, 
            payload: { command: 'mass_present_cancel' }, 
            color: 'negative' 
        })
        .oneTime();

    const modeMessage = `🎁 Выберите режим массового дарения:\n\n` +
        `📋 По ID предметов — введите ID предметов через пробел\n` +
        `📦 По типу и количеству — выберите предмет и укажите, сколько штук подарить`;

    const modeResponse = await context.question(modeMessage, { keyboard: modeKeyboard, answerTimeLimit });
    
    if (modeResponse.isTimeout) {
        await context.send(`⏰ Время выбора истекло!`);
        return res;
    }

    if (!modeResponse.payload || modeResponse.payload.command === 'mass_present_cancel') {
        await context.send(`❌ Массовое дарение отменено.`);
        return res;
    }

    const mode = modeResponse.payload.mode;
    let item_ids: number[] = [];
    let gifted_items_info = '';

    if (mode === 'by_ids') {
        // Режим по ID предметов
        const instructionMessage = `📝 Введите ID предметов для дарения через пробел:\nПример: 14 374 85 92\n\n💡 ID предметов указаны в вашем инвентаре перед названием предмета`;
        
        const items_input = await context.question(instructionMessage, { answerTimeLimit });
        if (items_input.isTimeout) {
            await context.send(`⏰ Время ввода истекло!`);
            return res;
        }

        item_ids = items_input.text.trim().split(/\s+/).map(id => parseInt(id)).filter(id => !isNaN(id));
        
        if (item_ids.length === 0) {
            await context.send(`❌ Не указаны ID предметов для дарения.`);
            return res;
        }

    } else if (mode === 'by_type') {
        // Новый режим: выбор предмета по типу и количеству
        let item_cursor = 0;
        let item_selection_complete = false;
        
        while (!item_selection_complete) {
            const groupedItems = await groupInventoryItems(user.id);
            
            // Фильтруем только предметы, которых больше 1 штуки
            const multipleItems = groupedItems.filter(group => group.count > 1);
            
            if (multipleItems.length === 0) {
                await context.send(`❌ В вашем инвентаре нет предметов, которых больше 1 штуки.\nИспользуйте режим "По ID предметов" для дарения одиночных предметов.`);
                return res;
            }

            // Создаем клавиатуру для выбора предмета с пагинацией
            const itemKeyboard = new KeyboardBuilder();
            
            // Показываем предметы для текущей страницы (по 6 на страницу)
            const itemsPerPage = 6;
            const startIndex = item_cursor;
            const endIndex = Math.min(startIndex + itemsPerPage, multipleItems.length);
            const currentPageItems = multipleItems.slice(startIndex, endIndex);

            for (const group of currentPageItems) {
                const itemName = group.name.length > 20 ? group.name.slice(0, 20) + '...' : group.name;
                const buttonLabel = `${itemName} × ${group.count}`;
                
                itemKeyboard.textButton({
                    label: buttonLabel,
                    payload: { 
                        command: 'mass_present_select_item', 
                        type: group.type, 
                        id_item: group.id_item,
                        max_count: group.count,
                        item_cursor: item_cursor
                    },
                    color: 'secondary'
                });
                itemKeyboard.row();
            }

            // Добавляем навигацию
            if (item_cursor > 0) {
                itemKeyboard.textButton({ 
                    label: `←`, 
                    payload: { command: 'mass_present_prev_page', item_cursor }, 
                    color: 'secondary' 
                });
            }

            if (endIndex < multipleItems.length) {
                itemKeyboard.textButton({ 
                    label: `→`, 
                    payload: { command: 'mass_present_next_page', item_cursor }, 
                    color: 'secondary' 
                });
            }

            if (item_cursor > 0 || endIndex < multipleItems.length) {
                itemKeyboard.row();
            }

            itemKeyboard.textButton({ 
                label: `❌ Отмена`, 
                payload: { command: 'mass_present_cancel' }, 
                color: 'negative' 
            });
            itemKeyboard.oneTime();

            const currentPage = Math.floor(item_cursor / itemsPerPage) + 1;
            const totalPages = Math.ceil(multipleItems.length / itemsPerPage);
            
            const itemMessage = `📦 Выберите предмет для дарения (страница ${currentPage} из ${totalPages}):\n\n` +
                `💡 Показаны только предметы, которых у вас больше 1 штуки\n` +
                `📊 Найдено предметов: ${multipleItems.length}`;

            const itemResponse = await context.question(itemMessage, { keyboard: itemKeyboard, answerTimeLimit });
            
            if (itemResponse.isTimeout || !itemResponse.payload) {
                await context.send(`⏰ Время выбора истекло!`);
                return res;
            }

            if (itemResponse.payload.command === 'mass_present_cancel') {
                await context.send(`❌ Массовое дарение отменено.`);
                return res;
            }

            // Обработка навигации
            if (itemResponse.payload.command === 'mass_present_prev_page') {
                item_cursor = Math.max(0, item_cursor - itemsPerPage);
                continue;
            }

            if (itemResponse.payload.command === 'mass_present_next_page') {
                item_cursor = item_cursor + itemsPerPage;
                continue;
            }

            if (itemResponse.payload.command === 'mass_present_select_item') {
                const selectedGroup = multipleItems.find(g => 
                    g.type === itemResponse.payload.type && 
                    g.id_item === itemResponse.payload.id_item
                );

                if (!selectedGroup) {
                    await context.send(`❌ Выбранный предмет не найден.`);
                    continue;
                }

                // Запрашиваем количество
                const countMessage = `🔢 У вас есть ${selectedGroup.count} предметов "${selectedGroup.name}"\n\n` +
                    `Сколько штук вы хотите подарить? (введите число от 1 до ${selectedGroup.count})`;

                const countResponse = await context.question(countMessage, { answerTimeLimit });
                
                if (countResponse.isTimeout) {
                    await context.send(`⏰ Время ввода истекло!`);
                    return res;
                }

                const giftCount = parseInt(countResponse.text.trim());
                
                if (isNaN(giftCount) || giftCount < 1 || giftCount > selectedGroup.count) {
                    await context.send(`❌ Неверное количество! Введите число от 1 до ${selectedGroup.count}`);
                    continue;
                }

                // Берем первые N предметов из группы
                item_ids = selectedGroup.inventory_ids.slice(0, giftCount);
                gifted_items_info = `\n🎁 ${selectedGroup.name} × ${giftCount}`;
                item_selection_complete = true;
            }
        }
    } else {
        await context.send(`❌ Неизвестный режим дарения.`);
        return res;
    }

    // Подтверждение финальное
    const finalConfirmMessage = mode === 'by_ids' 
        ? `подарить ${item_ids.length} предметов игроку ${person_goten_check.name}?`
        : `подарить ${item_ids.length} предметов "${gifted_items_info.split('×')[0].trim()}" игроку ${person_goten_check.name}?`;

    const final_confirm: { status: boolean, text: string } = await Confirm_User_Success(
        context, 
        finalConfirmMessage
    );
    
    if (!final_confirm.status) {
        await context.send(`❌ Массовое дарение отменено.`);
        return res;
    }

    // Выполняем массовое дарение
    let success_count = 0;
    let failed_count = 0;

    // Если в режиме по типу мы еще не собрали информацию о предметах, делаем это сейчас
    if (mode === 'by_ids') {
        gifted_items_info = '';
    }

    for (const item_id of item_ids) {
        try {
            // Проверяем, что предмет принадлежит текущему пользователю
            const inv = await prisma.inventory.findFirst({
                where: { 
                    id: item_id,
                    id_user: user.id 
                }
            });

            if (!inv) {
                await context.send(`⚠ Предмет с ID ${item_id} не найден в вашем инвентаре.`);
                failed_count++;
                continue;
            }

            // Для режима по ID собираем информацию о предметах
            if (mode === 'by_ids') {
                let item_info = null;
                if (inv.type == InventoryType.ITEM_SHOP_ALLIANCE) {
                    item_info = await prisma.allianceShopItem.findFirst({ where: { id: inv.id_item } });
                } else if (inv.type == InventoryType.ITEM_SHOP) {
                    item_info = await prisma.item.findFirst({ where: { id: inv.id_item } });
                } else if (inv.type == InventoryType.ITEM_STORAGE) {
                    item_info = await prisma.itemStorage.findFirst({ where: { id: inv.id_item } });
                }

                if (success_count === 0) {
                    gifted_items_info += `\n🎁 ${item_info?.name || `Предмет ${inv.id}`}`;
                }
            }

            // Передаем предмет
            const updated_item = await prisma.inventory.update({
                where: { id: inv.id },
                data: { 
                    id_user: person_goten_check.id,
                    comment: `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}`
                }
            });

            if (updated_item) {
                success_count++;
                await Logger(`Массовое дарение: ${user.name} -> ${person_goten_check.name}, предмет ID: ${inv.id}`);
            } else {
                failed_count++;
            }

        } catch (error) {
            await context.send(`⚠ Ошибка при передаче предмета ID ${item_id}`);
            failed_count++;
        }
    }

    // Для режима по ID добавляем общее количество
    if (mode === 'by_ids' && success_count > 0) {
        gifted_items_info += ` × ${success_count}`;
    }

    // Отправляем уведомления
    const result_message = `🎁 Массовое дарение завершено!\n\n` +
        `✅ Успешно передано: ${success_count} предметов\n` +
        `❌ Не удалось передать: ${failed_count} предметов\n\n` +
        `📦 Получатель: ${person_goten_check.name} (UID: ${person_goten_check.id})` +
        gifted_items_info;

    await context.send(result_message);

    // Уведомление получателю
    const receiver_message = `🎁 Вам подарены предметы от @id${user.idvk}(${user.name}) (UID: ${user.id})!\n\n` +
        `🎯 Получено персонажем: ${person_goten_check.name} (UID: ${person_goten_check.id})\n\n` +
        `Было передано ${success_count} предметов:` +
        gifted_items_info;

    await Send_Message(person_goten_check.idvk, receiver_message);

    // Уведомление в чат
    const log_message = `🎁 Массовое дарение предметов\n\n` +
        `👤 Отправитель: @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
        `🎯 Получатель: @id${person_goten_check.idvk}(${person_goten_check.name}) (UID: ${person_goten_check.id})\n` +
        `📦 Передано предметов: ${success_count}\n` +
        `📝 Режим: ${mode === 'by_ids' ? 'По ID предметов' : 'По типу и количеству'}` +
        gifted_items_info;

    await Send_Message(chat_id, log_message);

    return res;
}

// Добавляем обработчики для пагинации в массовом дарении
async function Mass_Present_Prev_Page(context: any, data: any, user: User, user_adm?: User) {
    // Эта функция теперь обрабатывается внутри Inventory_Mass_Present
    return { cursor: data.cursor, group_mode: data.group_mode };
}

async function Mass_Present_Next_Page(context: any, data: any, user: User, user_adm?: User) {
    // Эта функция теперь обрабатывается внутри Inventory_Mass_Present
    return { cursor: data.cursor, group_mode: data.group_mode };
}
