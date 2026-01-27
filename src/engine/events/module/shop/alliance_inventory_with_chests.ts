// src/engine/events/module/shop/alliance_inventory_with_chests.ts
import { Inventory, User, AllianceChest, Prisma } from "@prisma/client";
import prisma from "../prisma_client";
import { answerTimeLimit, chat_id } from "../../../..";
import { Confirm_User_Success, Input_Number, Keyboard_Index, Logger, Send_Message, Send_Message_Question, Send_Message_Smart } from "../../../core/helper";
import { button_alliance_return, InventoryType } from "../data_center/standart";
import { Keyboard, KeyboardBuilder } from "vk-io";

// Тип для отображаемых данных инвентаря
interface InventoryDisplayItem {
    id: number;
    name: string;
    count: number;
    type: string;
    image?: string;
    description?: string;
    price?: number;
    inventory_ids: number[];
    chest_id?: number;
}

async function getLogChatForMassPresent(sender: User, recipient: User): Promise<number | null> {
    //console.log(`DEBUG getLogChatForMassPresent: Checking logs for sender ${sender.id} (alliance: ${sender.id_alliance}) and recipient ${recipient.id} (alliance: ${recipient.id_alliance})`);
    
    // Если оба игрока из одного альянса и у альянса есть основной чат
    if (sender.id_alliance && recipient.id_alliance && 
        sender.id_alliance === recipient.id_alliance) {
        
        console.log(`DEBUG: Both users in same alliance: ${sender.id_alliance}`);
        
        const alliance = await prisma.alliance.findFirst({
            where: { id: sender.id_alliance }
        });
        
        console.log(`DEBUG: Alliance found: ${alliance?.name}, id_chat: ${alliance?.id_chat}`);
        
        // Если у альянса есть основной чат и он настроен
        if (alliance?.id_chat && alliance.id_chat !== 0) {
            console.log(`DEBUG: Returning main chat ID: ${alliance.id_chat}`);
            return alliance.id_chat;
        } else {
            console.log(`DEBUG: No valid id_chat found (value: ${alliance?.id_chat})`);
        }
    } else {
        console.log(`DEBUG: Users in different alliances or no alliance`);
    }
    
    // В остальных случаях - возвращаем null
    console.log(`DEBUG: Returning null (no main chat)`);
    return null;
}

// ===================== ОСНОВНАЯ ФУНКЦИЯ ИНВЕНТАРЯ С СУНДУКАМИ =====================

export async function Inventory_With_Chests(context: any, user: User, user_adm?: User) {
    let currentChestId: number | null = null;
    let cursor = 0;
    let group_mode = false;
    let childChestCursor = 0; // ДОБАВЬТЕ ЭТО

    while (true) {
        // Если не выбран сундук - показываем список сундуков
        if (currentChestId === null) {
            const result = await showChestSelection(context, user, cursor, user_adm);
            
            if (result === 'exit') {
                await context.send(`✅ Вы вышли из инвентаря.`, { keyboard: button_alliance_return });
                break;
            }
            
            if (typeof result === 'number') {
                currentChestId = result;
                cursor = 0;
                group_mode = false;
                childChestCursor = 0; // Сбрасываем при выборе нового сундука
                continue;
            }
            
            if (result && 'cursor' in result) {
                cursor = result.cursor;
                continue;
            }
        } 
        // Если выбран сундук - показываем его содержимое
        else {
            // ВАЖНО: Передаем childChestCursor в функцию
            const result = await showChestContents(context, user, currentChestId, cursor, group_mode, user_adm, childChestCursor);
            
            if (result?.back) {
                currentChestId = null;
                cursor = 0;
                group_mode = false; // ИСПРАВЬТЕ: Добавьте это
                childChestCursor = 0; // ИСПРАВЬТЕ: Добавьте это
                continue;
            }
            
            if (result?.stop) {
                await context.send(`✅ Вы вышли из инвентаря.`, { keyboard: button_alliance_return });
                break;
            }
            
            // ИСПРАВЬТЕ: Обновляем все параметры
            cursor = result?.cursor ?? cursor;
            group_mode = result?.group_mode ?? group_mode;
            childChestCursor = result?.childChestCursor ?? childChestCursor; // ВАЖНО: Обновляем childChestCursor
            
            // Также важно: если в результате есть currentChestId (например, при открытии дочернего сундука)
            // обновляем currentChestId
            if (result?.currentChestId !== undefined) {
                currentChestId = result.currentChestId;
                // При смене сундука сбрасываем курсоры
                cursor = 0;
                group_mode = false;
                childChestCursor = 0;
            }
        }
    }
    
    await Keyboard_Index(context, `⌛ Сундуки закрыты!`);
}

// ===================== СПИСОК СУНДУКОВ =====================

async function showChestSelection(
    context: any, 
    user: User, 
    cursor: number, 
    user_adm?: User
): Promise<number | 'exit' | {cursor: number}> {
    const LIMIT = 4;
    
    // Получаем сундуки альянса пользователя
    const allianceChests = await prisma.allianceChest.findMany({
        where: { 
            id_alliance: user.id_alliance || 0,
            id_parent: null // Только основные сундуки
        },
        orderBy: [
            // Сначала сундук "Основное"
            {
                name: 'asc',
            },
            {
                order: 'asc'
            }
        ]
    });
    
    // Убеждаемся, что есть "Основное"
    let mainChest = allianceChests.find(c => c.name === "Основное");
    if (!mainChest) {
        mainChest = await prisma.allianceChest.create({
            data: {
                name: "Основное",
                id_alliance: user.id_alliance || 0,
                id_parent: null,
                order: 0
            }
        });
        allianceChests.push(mainChest);
    }
    
    // ПЕРЕСОРТИРОВКА: Сначала "Основное", потом остальные по алфавиту
    const sortedChests = allianceChests.sort((a, b) => {
        if (a.name === "Основное") return -1;
        if (b.name === "Основное") return 1;
        return a.name.localeCompare(b.name);
    });
    
    const totalChests = sortedChests.length;
    const pageChests = sortedChests.slice(cursor, cursor + LIMIT);
    
    // Формируем текст с информацией о владельце
    let text = `🎒 ${getOwnerInfo(user, user_adm)}\n\n`;
    
    if (sortedChests.length === 0) {
        text += "📦 Сундуки не настроены администратором.\nПоказываются все предметы в основной куче.\n\n";
    } else {
        text += `Доступные сундуки:\n`;
        
        for (let i = 0; i < pageChests.length; i++) {
            const chest = pageChests[i];
            
            // Считаем содержимое сундука
            const childCount = await prisma.allianceChest.count({
                where: { id_parent: chest.id }
            });
            
            const itemCount = await prisma.chestItemLink.count({
                where: { 
                    id_chest: chest.id,
                    inventory: {
                        id_user: user.id
                    }
                }
            });
            
            const stats = childCount > 0 
                ? `(${childCount}🧳, ${itemCount}📦)` 
                : `(${itemCount}📦)`;
            
            const icon = chest.name === "Основное" ? '🔘' : '🎒';
            text += `${icon} [${chest.id}] ${chest.name} ${stats}\n`;
        }
        
        text += `\n${Math.floor(cursor / LIMIT) + 1} из ${Math.ceil(totalChests / LIMIT)}\n\n`;
    }
    
    text += `Выберите сундук для просмотра:`;
    
    // Формируем клавиатуру (упрощенную - МАКСИМУМ 10 КНОПОК)
    const keyboard = new KeyboardBuilder();
    
    // Кнопки сундуков (по одной на строку)
    for (const chest of pageChests) {
        const icon = chest.name === "Основное" ? '🔘' : '🎒';
        
        // Ограничиваем длину названия для кнопки
        let displayName = chest.name;
        if (displayName.length > 15) {
            displayName = displayName.slice(0, 12) + '...';
        }
        
        const label = `${icon} ${displayName}`;
        
        keyboard.textButton({
            label: label,
            payload: { command: 'select_chest', id: chest.id },
            color: 'secondary'
        });
        keyboard.row();
    }
    
    // Навигация - ВСЕГДА ПОКАЗЫВАЕМ, даже если мало места
    if (totalChests > LIMIT) {
        if (cursor > 0) {
            keyboard.textButton({
                label: `←`,
                payload: { command: 'chest_prev', cursor: Math.max(0, cursor - LIMIT) },
                color: 'secondary'
            });
        }
        
        if (cursor + LIMIT < totalChests) {
            keyboard.textButton({
                label: `→`,
                payload: { command: 'chest_next', cursor: cursor + LIMIT },
                color: 'secondary'
            });
        }
        
        keyboard.row();
    }
    
    // Используем Send_Message_Question вместо Send_Message
    try {
        const bt = await Send_Message_Question(context, text, keyboard.oneTime().inline());
        
        if (bt.exit) {
            return 'exit';
        }
        
        if (!bt.payload) {
            await context.send(`💡 Жмите только на кнопки.`);
            return { cursor };
        }
        
        // Обработка команд
        if (bt.payload.command === 'select_chest') {
            return bt.payload.id;
        }
        
        if (bt.payload.command === 'return') {
            return 'exit';
        }
        
        if (bt.payload.command === 'chest_prev') {
            return { cursor: bt.payload.cursor };
        }
        
        if (bt.payload.command === 'chest_next') {
            return { cursor: bt.payload.cursor };
        }
        
        await context.send(`❌ Неизвестная команда.`);
        return { cursor };
    } catch (error: any) {
        console.error("Ошибка в showChestSelection:", error);
        
        // В случае ошибки отправляем простое сообщение
        await context.send(`❌ Ошибка отображения. Попробуйте снова.`);
        return 'exit';
    }
}

// ===================== СОДЕРЖИМОЕ СУНДУКА =====================

async function showChestContents(
    context: any, 
    user: User, 
    chestId: number, 
    cursor: number, 
    group_mode: boolean,
    user_adm?: User,
    childChestCursor: number = 0
): Promise<{cursor?: number, group_mode?: boolean, back?: boolean, stop?: boolean, childChestCursor?: number, currentChestId?: number}> {
    const STANDARD_LIMIT = 4;
    const STANDARD_CHILD_LIMIT = 3;
    const DUAL_MODE_CHILD_LIMIT = 3;
    const DUAL_MODE_ITEM_LIMIT = 3;
    
    const chest = await prisma.allianceChest.findFirst({
        where: { 
            id: chestId,
            id_alliance: user.id_alliance || 0
        },
        include: {
            Children: {
                orderBy: { order: 'asc' }
            },
            Parent: true
        }
    });
    
    if (!chest) {
        await context.send(`❌ Сундук не найден.`);
        return { back: true };
    }
    
    const chestItems = await getChestInventoryItems(user.id, chest.id, group_mode);
    const childChests = chest.Children;
    
    const hasChildChests = childChests.length > 0 && chest.name !== "Основное";
    const hasItems = chestItems.length > 0;
    const isDualMode = hasChildChests && hasItems;
    
    const itemLimit = isDualMode ? DUAL_MODE_ITEM_LIMIT : STANDARD_LIMIT;
    const childChestLimit = isDualMode ? DUAL_MODE_CHILD_LIMIT : STANDARD_CHILD_LIMIT;
    
    const totalItems = chestItems.length;
    const pageItems = chestItems.slice(cursor, cursor + itemLimit);
    
    const totalChildChests = childChests.length;
    const pageChildChests = childChests.slice(childChestCursor, childChestCursor + childChestLimit);
    
    // Улучшенный текст с информацией о владельце
    let text = '';
    if (chest.Parent) {
        text += `🧳 Сундучок "${chest.name}" (внутри "${chest.Parent.name}")${getOwnerSuffix(user, user_adm)}\n\n`;
    } else {
        text += `📦 Сундук "${chest.name}"${getOwnerSuffix(user, user_adm)}\n\n`;
    }
    
    if (hasChildChests) {
        text += `Сундучки внутри:\n`;
        
        for (let i = 0; i < pageChildChests.length; i++) {
            const child = pageChildChests[i];
            const childItemCount = await prisma.chestItemLink.count({
                where: { 
                    id_chest: child.id,
                    inventory: {
                        id_user: user.id
                    }
                }
            });
            
            const itemDisplay = childItemCount === 0 ? '0📦' : `${childItemCount}📦`;
            text += `🧳 [${child.id}] ${child.name} (${itemDisplay})\n`;
        }
        
        // Навигация по сундучкам
        if (totalChildChests > childChestLimit) {
            const currentChildPage = Math.floor(childChestCursor / childChestLimit) + 1;
            const totalChildPages = Math.ceil(totalChildChests / childChestLimit);
            text += `\nСундучки: ${currentChildPage} из ${totalChildPages}\n`;
        }
        
        text += `\n`;
    }
    
    // Показываем товары
    text += `Товары в сундуке:\n`;
    
    if (chestItems.length === 0) {
        text += `📭 Сундук пуст.\n\n`;
    } else {
        if (group_mode) {
            for (let i = 0; i < pageItems.length; i++) {
                const item = pageItems[i];
                text += `🧳 ${item.name} × ${item.count}\n`;
            }
        } else {
            for (let i = 0; i < pageItems.length; i++) {
                const item = pageItems[i];
                text += `🧳 [${item.id}] ${item.name}\n`;
            }
        }
        
        // Навигация по товарам
        if (totalItems > 0) {
            const currentPage = Math.floor(cursor / itemLimit) + 1;
            const totalPages = Math.ceil(totalItems / itemLimit);
            text += `\nТовары: ${currentPage} из ${totalPages}\n`;
        }
    }
    
    // Показываем информацию о режиме только если есть предметы
    if (totalItems > 0) {
        text += `\nРежим: ${group_mode ? 'Группы' : 'Поштучно'}`;
        
        // Если в режиме "2+2", добавляем пояснение
        if (isDualMode) {
            text += ` | 👁 Показано по 3 (сундучка и товара)`;
        }
    }
    
    const keyboard = new KeyboardBuilder();
    
    // Кнопки сундучков
    if (hasChildChests) {
        for (let i = 0; i < pageChildChests.length; i++) {
            const child = pageChildChests[i];
            const label = child.name.length > 10 ? 
                `🧳 ${child.name.slice(0, 8)}...` : 
                `🧳 ${child.name}`;
            
            keyboard.textButton({
                label: label,
                payload: { 
                    command: 'open_child_chest',
                    chestId: child.id,
                    cursor: 0,
                    group_mode: false,
                    childChestCursor: 0
                },
                color: 'primary'
            }).row();
        }
        
        // Навигация по сундучкам (только если их больше лимита)
        if (totalChildChests > childChestLimit) {
            if (childChestCursor > 0) {
                const prevChildCursor = Math.max(0, childChestCursor - childChestLimit);
                keyboard.textButton({
                    label: `← Сундучки`,
                    payload: { 
                        command: 'child_chests_prev',
                        cursor: cursor,
                        group_mode: group_mode,
                        childChestCursor: prevChildCursor,
                        currentChestId: chest.id
                    },
                    color: 'secondary'
                });
            }
            
            if (childChestCursor + childChestLimit < totalChildChests) {
                const nextChildCursor = childChestCursor + childChestLimit;
                keyboard.textButton({
                    label: `Сундучки →`,
                    payload: { 
                        command: 'child_chests_next',
                        cursor: cursor,
                        group_mode: group_mode,
                        childChestCursor: nextChildCursor,
                        currentChestId: chest.id
                    },
                    color: 'secondary'
                });
            }
            
            keyboard.row();
        }
    }
    
    // Кнопки предметов
    if (hasItems) {
        for (const item of pageItems) {
            let label = '';
            
            if (group_mode) {
                const truncatedName = item.name.length > 15 ? 
                    item.name.slice(0, 12) + '...' : item.name;
                label = `🧳 ${truncatedName} × ${item.count}`;
                
                if (label.length > 40) {
                    label = `🧳 × ${item.count}`;
                }
                
                keyboard.textButton({
                    label: label,
                    payload: { 
                        command: 'group_item_select',
                        id: item.id,
                        type: item.type,
                        cursor: cursor,
                        group_mode: group_mode,
                        childChestCursor: childChestCursor,
                        currentChestId: chest.id
                    },
                    color: 'secondary'
                });
                
                keyboard.textButton({
                    label: `🎁`,
                    payload: { 
                        command: 'group_item_present',
                        id: item.id,
                        type: item.type,
                        cursor: cursor,
                        group_mode: group_mode,
                        childChestCursor: childChestCursor,
                        currentChestId: chest.id
                    },
                    color: 'negative'
                });
                keyboard.textButton({
                    label: `⛔`,
                    payload: { 
                        command: 'group_item_delete',
                        id: item.id,
                        type: item.type,
                        cursor: cursor,
                        group_mode: group_mode,
                        childChestCursor: childChestCursor,
                        currentChestId: chest.id
                    },
                    color: 'negative'
                }).row();
            } else {
                const truncatedName = item.name.length > 20 ? 
                    item.name.slice(0, 17) + '...' : item.name;
                label = `🧳 ${truncatedName}`;
                
                if (label.length > 40) {
                    label = `🧳 ID:${item.id}`;
                }
                
                keyboard.textButton({
                    label: label,
                    payload: { 
                        command: 'item_select',
                        id: item.id,
                        cursor: cursor,
                        group_mode: group_mode,
                        childChestCursor: childChestCursor,
                        currentChestId: chest.id
                    },
                    color: 'secondary'
                });
                
                keyboard.textButton({
                    label: `🎁`,
                    payload: { 
                        command: 'item_present',
                        id: item.id,
                        cursor: cursor,
                        group_mode: group_mode,
                        childChestCursor: childChestCursor,
                        currentChestId: chest.id
                    },
                    color: 'negative'
                });
                keyboard.textButton({
                    label: `⛔`,
                    payload: { 
                        command: 'item_delete',
                        id: item.id,
                        cursor: cursor,
                        group_mode: group_mode,
                        childChestCursor: childChestCursor,
                        currentChestId: chest.id
                    },
                    color: 'negative'
                }).row();
            }
        }
        
        // Навигация по товарам (только если их больше лимита)
        if (totalItems > itemLimit) {
            if (cursor > 0) {
                keyboard.textButton({
                    label: `← Товары`,
                    payload: { 
                        command: 'items_prev', 
                        cursor: Math.max(0, cursor - itemLimit),
                        group_mode: group_mode,
                        childChestCursor: childChestCursor,
                        currentChestId: chest.id
                    },
                    color: 'secondary'
                });
            }
            
            const currentPage = Math.floor(cursor / itemLimit) + 1;
            const totalPages = Math.ceil(totalItems / itemLimit);
            
            keyboard.textButton({
                label: `Товары ${currentPage}/${totalPages}`,
                payload: { 
                    command: 'select_page', 
                    cursor: cursor,
                    group_mode: group_mode,
                    childChestCursor: childChestCursor,
                    chestId: chest.id
                },
                color: 'primary'
            });
            
            if (cursor + itemLimit < totalItems) {
                keyboard.textButton({
                    label: `Товары →`,
                    payload: { 
                        command: 'items_next', 
                        cursor: cursor + itemLimit,
                        group_mode: group_mode,
                        childChestCursor: childChestCursor,
                        currentChestId: chest.id
                    },
                    color: 'secondary'
                });
            }
            
            if (cursor > 0 || cursor + itemLimit < totalItems) {
                keyboard.row();
            }
        }
    }
    
    // Кнопки действий
    if (hasItems) {
        keyboard.textButton({
            label: group_mode ? `📋 Поштучно` : `📦 Группами`,
            payload: { 
                command: 'toggle_mode',
                cursor: 0,
                group_mode: !group_mode,
                childChestCursor: 0,
                currentChestId: chest.id
            },
            color: 'primary'
        });
        
        keyboard.textButton({
            label: `🎁 ∞`,
            payload: { 
                command: 'chest_mass_present',
                cursor: cursor,
                group_mode: group_mode,
                childChestCursor: childChestCursor,
                chestId: chest.id
            },
            color: 'positive'
        });
    }
    
    keyboard.textButton({
        label: `← Назад к сундукам`,
        payload: { 
            command: 'back_to_chests',
            currentChestId: chest.id
        },
        color: 'secondary'
    }).row();
    
    try {
        const bt = await Send_Message_Question(context, text, keyboard.oneTime());
        
        if (bt.exit) {
            return { stop: true };
        }
        
        if (!bt.payload) {
            await context.send(`💡 Жмите только на кнопки.`);
            return { cursor, group_mode, childChestCursor };
        }
        
        let payloadData: any;
        
        // Если bt.payload это строка (JSON), парсим ее
        if (typeof bt.payload === 'string') {
            try {
                payloadData = JSON.parse(bt.payload);
            } catch (e) {
                console.error(`DEBUG: Error parsing payload as JSON:`, e);
                payloadData = {};
            }
        } 
        // Если bt.payload это объект, проверяем есть ли в нем payload
        else if (typeof bt.payload === 'object' && bt.payload !== null) {
            if (bt.payload.payload) {
                payloadData = bt.payload.payload;
            } else if (bt.payload.command) {
                payloadData = bt.payload;
            } else {
                // Пробуем получить payload из текста сообщения
                if (bt.payload.text && bt.payload.text.includes('{')) {
                    try {
                        const match = bt.payload.text.match(/\{.*\}/);
                        if (match) {
                            payloadData = JSON.parse(match[0]);
                        }
                    } catch (e) {
                        console.error(`DEBUG: Error extracting JSON from text:`, e);
                    }
                }
                
                if (!payloadData && bt.payload.messagePayload) {
                    payloadData = bt.payload.messagePayload;
                }
            }
        }
        
        if (!payloadData || !payloadData.command) {
            await context.send(`💡 Жмите только на кнопки.`);
            return { cursor, group_mode, childChestCursor };
        }
        
        // ОБНОВЛЯЕМ ОБРАБОТЧИКИ КОМАНД ДЛЯ УЧЕТА ИЗМЕНЕННЫХ ЛИМИТОВ
        const commandHandlers: any = {
            'back_to_chests': () => ({ back: true }),
            'exit': () => ({ stop: true }),
            'toggle_mode': () => ({ 
                cursor: 0,
                group_mode: !group_mode, 
                childChestCursor: 0
            }),
            'items_prev': () => { 
                // Используем itemLimit вместо фиксированного LIMIT
                const newCursor = Math.max(0, cursor - itemLimit);
                return { 
                    cursor: newCursor, 
                    group_mode: group_mode, 
                    childChestCursor: childChestCursor 
                };
            },
            'items_next': () => { 
                const newCursor = cursor + itemLimit;
                return { 
                    cursor: newCursor, 
                    group_mode: group_mode, 
                    childChestCursor: childChestCursor 
                };
            },
            'select_page': () => handleSelectPage(context, payloadData, user, user_adm, chest),
            'child_chests_prev': () => { 
                // Используем childChestLimit вместо фиксированного MAX_CHILD_CHESTS
                const newChildCursor = Math.max(0, childChestCursor - childChestLimit);
                return { 
                    cursor: cursor, 
                    group_mode: group_mode, 
                    childChestCursor: newChildCursor
                };
            },
            'child_chests_next': () => { 
                const newChildCursor = childChestCursor + childChestLimit;
                return { 
                    cursor: cursor, 
                    group_mode: group_mode, 
                    childChestCursor: newChildCursor
                };
            },
            'open_child_chest': async () => {
                if (!payloadData.chestId) {
                    console.error(`ERROR: chestId is undefined in payloadData`);
                    await context.send(`❌ Ошибка: ID сундучка не указан.`);
                    return { cursor, group_mode, childChestCursor };
                }
                return {
                    currentChestId: payloadData.chestId,
                    cursor: 0,
                    group_mode: false,
                    childChestCursor: 0
                };
            },
            'chest_mass_by_type_multi': async () => {
                return await handleChestMassByTypeMulti(context, payloadData, user, user_adm, chest);
            },
            'chest_mass_by_type_multi_page': async () => {
                return await handleChestMassByTypeMulti(context, payloadData, user, user_adm, chest);
            },
            'chest_mass_select_item_multi': async () => {
                return await handleChestMassSelectItemMulti(context, payloadData, user, user_adm, chest);
            },
            'chest_mass_select_page': async () => {
                return await handleChestMassSelectPage(context, payloadData, user, user_adm, chest);
            },
            'chest_mass_single': () => ({ 
                cursor: payloadData.cursor, 
                group_mode: payloadData.group_mode, 
                childChestCursor: payloadData.childChestCursor 
            }),
            'item_select': () => handleItemSelect(context, payloadData, user, user_adm, chest),
            'group_item_select': () => handleGroupItemSelect(context, payloadData, user, user_adm, chest),
            'item_present': () => handleItemPresent(context, payloadData, user, user_adm, chest),
            'group_item_present': () => handleGroupItemPresent(context, payloadData, user, user_adm, chest),
            'item_delete': () => handleItemDelete(context, payloadData, user, user_adm, chest),
            'group_item_delete': () => handleGroupItemDelete(context, payloadData, user, user_adm, chest),
            'chest_mass_present': () => handleChestMassPresent(context, payloadData, user, user_adm, chest),
            'chest_mass_by_ids': () => handleChestMassByIds(context, payloadData, user, user_adm, chest),
            'chest_mass_by_type': () => handleChestMassByType(context, payloadData, user, user_adm, chest),
            'chest_mass_select_item': () => handleChestMassSelectItem(context, payloadData, user, user_adm, chest),
            'chest_mass_by_ids_multi': () => handleChestMassByIdsMulti(context, payloadData, user, user_adm, chest),
            'chest_mass_multiple': () => handleChestMassMultiple(context, payloadData, user, user_adm, chest),
            'chest_mass_cancel': () => handleChestMassCancel(context, payloadData, user, user_adm, chest),
            'chest_mass_select_item_single': () => handleChestMassSelectItemSingle(context, payloadData, user, user_adm, chest),
            'chest_mass_by_type_page': () => handleChestMassByType(context, payloadData, user, user_adm, chest),
            'chest_mass_select_page_single': () => handleChestMassSelectPageSingle(context, payloadData, user, user_adm, chest),
        };
        
        if (commandHandlers[payloadData.command]) {
            const result = await commandHandlers[payloadData.command]();
            return result;
        }
        
        await context.send(`❌ Неизвестная команда: ${payloadData.command}`);
        return { cursor, group_mode, childChestCursor };
    } catch (error: any) {
        console.error("Ошибка в showChestContents:", error);
        
        const errorKeyboard = new KeyboardBuilder()
            .textButton({ 
                label: '← Назад', 
                payload: { 
                    command: 'back_to_chests',
                    currentChestId: chest.id 
                }, 
                color: 'secondary' 
            })
            .oneTime();
            
        await Send_Message_Question(context, `⚠ Произошла ошибка. Возврат к выбору сундуков.`, errorKeyboard);
        
        return { back: true };
    }
}

// ===================== МАССОВОЕ ДАРЕНИЕ ИЗ СУНДУКА =====================

async function handleChestMassPresent(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor, 
        group_mode: data.group_mode, 
        childChestCursor: data.childChestCursor 
    };
    
    // Используем функцию для подсчета предметов
    const itemCount = await getChestItemCount(user.id, chest.id);
    
    if (itemCount === 0) {
        await context.send(`📦 Сундук "${chest.name}" пуст. Нечего дарить.`);
        return res;
    }
    
    // Сначала спрашиваем, одному или нескольким персонажам
    const keyboard = new KeyboardBuilder()
        .textButton({
            label: '👤 Одному персонажу',
            payload: {
                command: 'chest_mass_single',
                cursor: data.cursor,
                group_mode: data.group_mode,
                childChestCursor: data.childChestCursor,
                chestId: chest.id
            },
            color: 'primary'
        })
        .textButton({
            label: '👥 Нескольким персонажам',
            payload: {
                command: 'chest_mass_multiple',
                cursor: data.cursor,
                group_mode: data.group_mode,
                childChestCursor: data.childChestCursor,
                chestId: chest.id
            },
            color: 'primary'
        })
        .row()
        .textButton({
            label: '❌ Отмена',
            payload: {
                command: 'chest_mass_cancel',
                cursor: data.cursor,
                group_mode: data.group_mode,
                childChestCursor: data.childChestCursor
            },
            color: 'negative'
        })
        .oneTime();

    try {
        const response = await Send_Message_Question(
            context,
            `🎁 Массовое дарение из сундука "${chest.name}"\n\n` +
            `📦 Всего предметов: ${itemCount}\n\n` +
            `Выберите тип дарения:\n\n` +
            `👤 Одному персонажу — все выбранные предметы будут подарены одному получателю\n` +
            `👥 Нескольким персонажам — предметы можно распределить между разными получателями`,
            keyboard
        );
        
        if (response.exit) {
            return res;
        }
        
        if (!response.payload) {
            await context.send(`💡 Жмите только на кнопки.`);
            return res;
        }
        
        // Обработка выбора
        if (response.payload.command === 'chest_mass_cancel') {
            await context.send(`❌ Массовое дарение отменено.`);
            return res;
        }
        
        if (response.payload.command === 'chest_mass_single') {
            // Показываем выбор типа дарения для одного получателя
            return await showMassGiftTypeSelection(context, response.payload, user, user_adm, chest, false);
        }
        
        if (response.payload.command === 'chest_mass_multiple') {
            // Показываем выбор типа дарения для нескольких получателей
            return await showMassGiftTypeSelection(context, response.payload, user, user_adm, chest, true);
        }
        
        return res;
        
    } catch (error) {
        console.error("Ошибка в handleChestMassPresent:", error);
        return res;
    }
}

async function getChestItemCount(userId: number, chestId: number): Promise<number> {
    try {
        const count = await prisma.inventory.count({
            where: {
                id_user: userId,
                ChestItemLink: {
                    is: {
                        id_chest: chestId
                    }
                }
            }
        });
        return count;
    } catch (error) {
        console.error(`Error counting items in chest ${chestId}:`, error);
        return 0;
    }
}

async function showMassGiftTypeSelection(
    context: any, 
    data: any, 
    user: User, 
    user_adm?: User, 
    chest?: any,
    isMultipleRecipients: boolean = false
): Promise<{cursor?: number, group_mode?: boolean, childChestCursor?: number}> {
    
    const defaultReturn = {
        cursor: data.cursor, 
        group_mode: data.group_mode, 
        childChestCursor: data.childChestCursor 
    };
    
    const keyboard = new KeyboardBuilder()
        .textButton({
            label: '📋 По ID предметов',
            payload: {
                ...data,
                command: isMultipleRecipients ? 'chest_mass_by_ids_multi' : 'chest_mass_by_ids',
                isMultiple: isMultipleRecipients
            },
            color: 'primary'
        })
        .textButton({
            label: '📦 По типу и количеству',
            payload: {
                ...data,
                command: isMultipleRecipients ? 'chest_mass_by_type_multi' : 'chest_mass_by_type',
                isMultiple: isMultipleRecipients
            },
            color: 'primary'
        })
        .row()
        .textButton({
            label: '❌ Отмена',
            payload: {
                command: 'chest_mass_cancel',
                cursor: data.cursor,
                group_mode: data.group_mode,
                childChestCursor: data.childChestCursor
            },
            color: 'negative'
        })
        .oneTime();

    try {
        const response = await Send_Message_Question(
            context,
            `🎁 Выберите режим массового дарения:\n\n` +
            `📋 По ID предметов — укажите ID предметов\n` +
            `📦 По типу и количеству — выберите предмет и укажите, сколько штук подарить\n\n` +
            `🎯 ${isMultipleRecipients ? 'Для нескольких получателей' : 'Для одного получателя'}`,
            keyboard
        );
        
        if (response.exit || !response.payload) {
            return defaultReturn;
        }
        
        // Обработка выбора
        let payloadData: any;
        if (typeof response.payload === 'string') {
            try {
                payloadData = JSON.parse(response.payload);
            } catch (e) {
                console.error(`Error parsing payload:`, e);
                return defaultReturn;
            }
        } else if (typeof response.payload === 'object') {
            payloadData = response.payload;
        } else {
            return defaultReturn;
        }
        
        // Обработка команд
        if (payloadData.command === 'chest_mass_by_ids') {
            return await handleChestMassByIds(context, payloadData, user, user_adm, chest);
        }
        
        if (payloadData.command === 'chest_mass_by_ids_multi') {
            return await handleChestMassByIdsMulti(context, payloadData, user, user_adm, chest);
        }
        
        if (payloadData.command === 'chest_mass_by_type') {
            return await handleChestMassByType(context, payloadData, user, user_adm, chest);
        }
        
        if (payloadData.command === 'chest_mass_by_type_multi') {
            return await handleChestMassByTypeMulti(context, payloadData, user, user_adm, chest);
        }
        
        if (payloadData.command === 'chest_mass_cancel') {
            await context.send(`❌ Массовое дарение отменено.`);
            return defaultReturn;
        }
        
    } catch (error) {
        console.error("Ошибка в showMassGiftTypeSelection:", error);
    }
    
    return defaultReturn;
}

async function handleChestMassByIdsMulti(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor, 
        group_mode: data.group_mode, 
        childChestCursor: data.childChestCursor 
    };
    
    await context.send(
        `👥 Для дарения нескольким получателям по ID предметов:\n\n` +
        `1. Используйте формат:\n` +
        `UID_получателя ID1 ID2 ID3\n\n` +
        `Пример:\n` +
        `44 1670 1671\n` +
        `55 1676 1677\n\n` +
        `💡 Каждая строка — отдельный получатель\n` +
        `💡 ID предметов через пробел\n` +
        `💡 Предметы должны быть в сундуке "${chest.name}"`
    );
    
    // Запрашиваем комментарий (общий для всех получателей)
    let globalComment = "";
    const want_comment = await context.question(
        `💬 Хотите добавить общий комментарий ко всем подаркам?`,
        {
            keyboard: Keyboard.builder()
                .textButton({ label: '✅ Да', payload: { command: 'add_comment' }, color: 'positive' })
                .textButton({ label: '❌ Нет', payload: { command: 'no_comment' }, color: 'negative' })
                .oneTime().inline(),
            answerTimeLimit
        }
    );
    
    if (want_comment.isTimeout) {
        await context.send(`⏰ Время ожидания истекло!`);
        return res;
    }
    
    if (want_comment.payload?.command === 'add_comment') {
        const comment_input = await context.question(
            `💬 Введите общий комментарий к подаркам (максимум 200 символов):`,
            { answerTimeLimit }
        );
        
        if (comment_input.isTimeout) {
            await context.send(`⏰ Время ожидания истекло!`);
            return res;
        }
        
        if (comment_input.text && comment_input.text.length <= 200) {
            globalComment = comment_input.text;
        } else if (comment_input.text && comment_input.text.length > 200) {
            await context.send(`⚠ Комментарий слишком длинный (${comment_input.text.length}/200). Комментарий не будет добавлен.`);
        }
    }
    
    // Запрашиваем данные
    const itemsResponse = await context.question(
        `📝 Введите данные для дарения (каждый получатель на новой строке):\n` +
        `Пример:\n` +
        `44 1670 1671\n` +
        `55 1676 1677\n\n` +
        `💡 Предметы должны быть в сундуке "${chest.name}"`,
        { answerTimeLimit }
    );
    
    if (itemsResponse.isTimeout || !itemsResponse.text) {
        await context.send(`⏰ Время ввода истекло!`);
        return res;
    }
    
    // Парсим ввод
    const lines = itemsResponse.text.trim().split('\n');
    const operations: Array<{recipientId: number, itemIds: number[]}> = [];
    
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
            const recipientId = parseInt(parts[0]);
            const itemIds = parts.slice(1).map((id: string) => parseInt(id)).filter((id: number) => !isNaN(id));
            
            if (!isNaN(recipientId) && itemIds.length > 0) {
                operations.push({
                    recipientId,
                    itemIds
                });
            }
        }
    }
    
    if (operations.length === 0) {
        await context.send(`❌ Не указаны корректные данные для дарения.`);
        return res;
    }
    
    const recipientsList = operations.map(op => 
        `UID ${op.recipientId}: ${op.itemIds.length} предметов`
    ).join('\n');

    let ownerText = '';
    if (user_adm) {
        ownerText = `из инвентаря ${user.name}`;
    } else {
        ownerText = `из своего инвентаря`;
    }

    const confirmText = `раздать предметы ${operations.length} получателям ${ownerText}?` +
        (globalComment ? `\n💬 Общий комментарий: "${globalComment}"` : '') +
        `\n\n${recipientsList}`;

    const confirm = await Confirm_User_Success(context, confirmText);

    if (!confirm.status) {
        await context.send(`❌ Дарение отменено.`);
        return res;
    }
    
    // Выполняем дарение
    let totalSuccessCount = 0;
    let totalFailedCount = 0;
    const recipientResults: { [key: number]: { name: string, success: number, failed: number, chestName: string, items: string[] } } = {};
    
    for (const operation of operations) {
        const recipient = await prisma.user.findFirst({ where: { id: operation.recipientId } });
        if (!recipient) {
            totalFailedCount += operation.itemIds.length;
            continue;
        }
        
        if (!recipientResults[operation.recipientId]) {
            recipientResults[operation.recipientId] = { 
                name: recipient.name, 
                success: 0, 
                failed: 0,
                chestName: 'Основное',
                items: []
            };
        }
        
        let successCount = 0;
        let failedCount = 0;
        
        for (const itemId of operation.itemIds) {
            try {
                const inv = await prisma.inventory.findFirst({
                    where: { 
                        id: itemId,
                        id_user: user.id,
                        ChestItemLink: {
                            is: {
                                id_chest: chest.id
                            }
                        }
                    }
                });
                
                if (!inv) {
                    failedCount++;
                    continue;
                }
                
                // Получаем информацию о предмете
                let itemInfo: any = null;
                let itemName = 'Неизвестный предмет';
                
                if (inv.type === InventoryType.ITEM_SHOP_ALLIANCE) {
                    itemInfo = await prisma.allianceShopItem.findFirst({ where: { id: inv.id_item } });
                    itemName = itemInfo?.name || 'Предмет магазина';
                } else if (inv.type === InventoryType.ITEM_SHOP) {
                    itemInfo = await prisma.item.findFirst({ where: { id: inv.id_item } });
                    itemName = itemInfo?.name || 'Предмет магазина';
                } else if (inv.type === InventoryType.ITEM_STORAGE) {
                    itemInfo = await prisma.itemStorage.findFirst({ where: { id: inv.id_item } });
                    itemName = itemInfo?.name || 'Артефакт';
                }
                
                // Находим связь с сундуком
                const chestLink = await prisma.chestItemLink.findFirst({
                    where: { id_inventory: inv.id }
                });
                
                // Находим сундук получателя
                const recipientChestId = await findRecipientChest(
                    recipient.id,
                    chestLink?.id_chest || chest.id,
                    chest.id_alliance || user.id_alliance || 0
                );
                
                // Получаем имя сундука получателя
                const recipientChest = await prisma.allianceChest.findFirst({
                    where: { id: recipientChestId }
                });
                
                if (recipientChest) {
                    recipientResults[operation.recipientId].chestName = recipientChest.name;
                }
                
                // Обновляем предмет с комментарием
                const updatedItem = await prisma.inventory.update({
                    where: { id: inv.id },
                    data: {
                        id_user: recipient.id,
                        comment: globalComment ? 
                            `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}. Комментарий: ${globalComment}` :
                            `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}`
                    }
                });
                
                if (updatedItem) {
                    successCount++;
                    recipientResults[operation.recipientId].items.push(itemName);
                    
                    // Обновляем связь с сундуком
                    if (chestLink) {
                        await prisma.chestItemLink.update({
                            where: { id: chestLink.id },
                            data: { id_chest: recipientChestId }
                        });
                    } else {
                        await prisma.chestItemLink.create({
                            data: {
                                id_chest: recipientChestId,
                                id_inventory: inv.id
                            }
                        });
                    }
                } else {
                    failedCount++;
                }
            } catch (error) {
                console.error(`Error giving item ${itemId}:`, error);
                failedCount++;
            }
        }
        
        recipientResults[operation.recipientId].success += successCount;
        recipientResults[operation.recipientId].failed += failedCount;
        totalSuccessCount += successCount;
        totalFailedCount += failedCount;
    }
    
    // Результат
    let resultMessage = `🎁 Массовое дарение завершено!\n\n` +
        `✅ Успешно передано: ${totalSuccessCount} предметов\n` +
        `❌ Не удалось передать: ${totalFailedCount} предметов\n\n` +
        `📁 Из сундука: "${chest.name}"\n`;
    
    if (globalComment) {
        resultMessage += `💬 Комментарий: "${globalComment}"\n\n`;
    }
    
    resultMessage += `📊 Результаты по получателям:\n`;
    
    for (const [recipientId, result] of Object.entries(recipientResults)) {
        if (result.success > 0) {
            resultMessage += `👤 ${result.name} (UID: ${recipientId}): ✅ ${result.success} ❌ ${result.failed} → сундук: ${result.chestName}\n`;
        }
    }
    
    await context.send(resultMessage);
    
    // Уведомления получателям и логирование
    for (const [recipientId, result] of Object.entries(recipientResults)) {
        if (result.success > 0) {
            const recipient = await prisma.user.findFirst({ where: { id: parseInt(recipientId) } });
            if (recipient) {
                // Уведомление получателю
                let receiverMessage = `🎁 Вам подарены предметы от @id${user.idvk}(${user.name}) (UID: ${user.id})!\n\n` +
                    `🎯 Получено персонажем: ${recipient.name} (UID: ${recipient.id})\n` +
                    `📦 Получено предметов: ${result.success}\n` +
                    `📁 Предметы находятся в сундуке: ${result.chestName}`;
                
                if (globalComment) {
                    receiverMessage += `\n💬 Комментарий: "${globalComment}"`;
                }
                
                if (result.items.length > 0) {
                    const uniqueItems = Array.from(new Set(result.items));
                    if (uniqueItems.length <= 5) {
                        receiverMessage += `\n\n🎁 Предметы:\n${uniqueItems.join('\n')}`;
                    }
                }
                
                await Send_Message(recipient.idvk, receiverMessage);
                
                // Логирование
                const logMessage = `🎁 Массовое дарение из сундука\n\n` +
                    `👤 Отправитель: @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
                    `🎯 Получатель: @id${recipient.idvk}(${recipient.name}) (UID: ${recipient.id})\n` +
                    `📦 Передано: ${result.success} предметов\n` +
                    (globalComment ? `💬 Комментарий: "${globalComment}"\n` : '') +
                    `📁 Из сундука: "${chest.name}"\n` +
                    `📁 В сундук: ${result.chestName}`;
                
                // Используем функцию для определения чата логирования
                const logChatId = await getLogChatForMassPresent(user, recipient);
                if (logChatId !== null) {
                    await Send_Message(logChatId, logMessage);
                }
                
                // Отправляем только одно уведомление инициатору (если это админ)
                if (user_adm && parseInt(recipientId) === user_adm.id) {
                    const adminMessage =
                        `🎁 Передача товаров (${result.success} шт.) от игрока ${user.name} (UID: ${user.id}) игроку ${recipient.name} (UID: ${recipient.id})\n` +
                        (globalComment ? `💬 Комментарий: "${globalComment}"\n` : '') +
                        `📁 Из сундука: "${chest.name}"\n` +
                        `📁 В сундук: ${result.chestName}`;
                    
                    await Send_Message(user_adm.idvk, adminMessage);
                }
            }
        }
    }
    
    return res;
}

async function handleChestMassByTypeMulti(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor || 0,  // Добавляем значение по умолчанию
        group_mode: data.group_mode || false, 
        childChestCursor: data.childChestCursor || 0 
    };
    
    // Получаем все предметы в сундуке в групповом режиме
    const chestItems = await getChestInventoryItems(user.id, chest.id, true);
    
    if (chestItems.length === 0) {
        await context.send(`📦 Сундук "${chest.name}" пуст.`);
        return res;
    }
    
    // Фильтруем только предметы, которых больше 1 штуки
    const multipleItems = chestItems.filter(item => item.count > 1);
    
    if (multipleItems.length === 0) {
        await context.send(`❌ В сундуке "${chest.name}" нет предметов, которых больше 1 штуки.\nИспользуйте режим "По ID предметов" для дарения одиночных предметов.`);
        return res;
    }
    
    // ПАГИНАЦИЯ: 5 предметов на страницу
    const ITEMS_PER_PAGE = 5;
    const currentPage = Math.floor(res.cursor / ITEMS_PER_PAGE);
    const totalPages = Math.ceil(multipleItems.length / ITEMS_PER_PAGE);
    
    // Получаем предметы для текущей страницы
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageItems = multipleItems.slice(startIndex, endIndex);
    
    // Показываем предметы для выбора
    let text = `📦 Выберите предмет для дарения:\n\n`;
    text += `💡 Показаны только предметы, которых у вас больше 1 штуки\n`;
    text += `📊 Найдено предметов: ${multipleItems.length}\n`;
    text += `📄 Страница ${currentPage + 1} из ${totalPages}\n\n`;
    text += `📁 Из сундука: "${chest.name}"\n\n`;
    
    for (let i = 0; i < pageItems.length; i++) {
        const item = pageItems[i];
        const itemNumber = startIndex + i + 1;
        text += `${itemNumber}. ${item.name} × ${item.count}\n`;
    }
    
    const keyboard = new KeyboardBuilder();
    
    // Кнопки предметов (максимум 5 на страницу)
    for (let i = 0; i < pageItems.length; i++) {
        const item = pageItems[i];
        const itemNumber = startIndex + i + 1;
        const label = item.name.length > 10 ? 
            `${itemNumber}. ${item.name.slice(0, 8)}... × ${item.count}` : 
            `${itemNumber}. ${item.name} × ${item.count}`;
        
        keyboard.textButton({
            label: `🧳 ${label}`,
            payload: {
                command: 'chest_mass_select_item_multi',
                item_id: item.id,
                item_type: item.type,
                chest_id: chest.id,
                cursor: res.cursor,
                group_mode: res.group_mode,
                childChestCursor: res.childChestCursor
            },
            color: 'secondary'
        }).row();
    }
    
    // Навигация по страницам
    if (multipleItems.length > ITEMS_PER_PAGE) {
        if (currentPage > 0) {
            const prevCursor = Math.max(0, (currentPage - 1) * ITEMS_PER_PAGE);
            keyboard.textButton({
                label: `⬅️ Назад`,
                payload: {
                    command: 'chest_mass_by_type_multi_page',
                    cursor: prevCursor,
                    group_mode: res.group_mode,
                    childChestCursor: res.childChestCursor,
                    chestId: chest.id
                },
                color: 'secondary'
            });
        }
        
        if (currentPage < totalPages - 1) {
            const nextCursor = (currentPage + 1) * ITEMS_PER_PAGE;
            keyboard.textButton({
                label: `Вперед ➡️`,
                payload: {
                    command: 'chest_mass_by_type_multi_page',
                    cursor: nextCursor,
                    group_mode: res.group_mode,
                    childChestCursor: res.childChestCursor,
                    chestId: chest.id
                },
                color: 'secondary'
            });
        }
        
        keyboard.row();
    }
    
    try {
        const response = await Send_Message_Question(context, text, keyboard.oneTime());
        
        if (response.exit) {
            return res;
        }
        
        if (!response.payload) {
            await context.send(`💡 Жмите только на кнопки.`);
            return res;
        }
        
        // Проверяем, является ли payload строкой JSON
        let payloadData: any;
        if (typeof response.payload === 'string') {
            try {
                payloadData = JSON.parse(response.payload);
            } catch (e) {
                console.error(`Error parsing payload:`, e);
                await context.send(`❌ Ошибка обработки команды.`);
                return res;
            }
        } else if (typeof response.payload === 'object' && response.payload !== null) {
            // Проверяем разные форматы payload
            if (response.payload.payload) {
                payloadData = response.payload.payload;
            } else if (response.payload.command) {
                payloadData = response.payload;
            } else {
                await context.send(`💡 Жмите только на кнопки.`);
                return res;
            }
        } else {
            await context.send(`💡 Жмите только на кнопки.`);
            return res;
        }
        
        // Обработка команд
        if (payloadData.command === 'chest_mass_select_item_multi') {
            return await handleChestMassSelectItemMulti(context, payloadData, user, user_adm, chest);
        }
        
        if (payloadData.command === 'chest_mass_by_type_multi_page') {
            // Навигация по страницам - вызываем саму себя с новым курсором
            return await handleChestMassByTypeMulti(context, payloadData, user, user_adm, chest);
        }
        
        if (payloadData.command === 'chest_mass_select_page') {
            // Запрос номера страницы
            return await handleChestMassSelectPage(context, payloadData, user, user_adm, chest);
        }
        
        if (payloadData.command === 'chest_mass_cancel') {
            await context.send(`❌ Массовое дарение отменено.`);
            // Возвращаемся к стандартному виду сундука
            return {
                cursor: payloadData.cursor,
                group_mode: payloadData.group_mode,
                childChestCursor: payloadData.childChestCursor,
                currentChestId: chest.id
            };
        }
        
        return res;
        
    } catch (error) {
        console.error("Ошибка в handleChestMassByTypeMulti:", error);
        return res;
    }
}

async function handleChestMassSelectPage(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor, 
        group_mode: data.group_mode, 
        childChestCursor: data.childChestCursor 
    };
    
    // Получаем все предметы
    const chestItems = await getChestInventoryItems(user.id, chest.id, true);
    const multipleItems = chestItems.filter(item => item.count > 1);
    
    if (multipleItems.length === 0) {
        return res;
    }
    
    const ITEMS_PER_PAGE = 5;
    const totalPages = Math.ceil(multipleItems.length / ITEMS_PER_PAGE);
    
    // Запрашиваем номер страницы
    const pageResponse = await context.question(
        `📄 Введите номер страницы (от 1 до ${totalPages}):`,
        { answerTimeLimit }
    );
    
    if (pageResponse.isTimeout || !pageResponse.text) {
        await context.send(`⏰ Время ввода истекло!`);
        return res;
    }
    
    const pageNumber = parseInt(pageResponse.text.trim());
    
    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
        await context.send(`❌ Неверный номер страницы! Введите число от 1 до ${totalPages}`);
        return res;
    }
    
    // Рассчитываем новый курсор
    const newCursor = (pageNumber - 1) * ITEMS_PER_PAGE;
    
    // Возвращаемся к показу страницы
    return {
        cursor: newCursor,
        group_mode: data.group_mode,
        childChestCursor: data.childChestCursor
    };
}

async function handleChestMassSelectItemMulti(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor, 
        group_mode: data.group_mode, 
        childChestCursor: data.childChestCursor 
    };
    
    // Получаем информацию о группе предметов
    const chestItems = await getChestInventoryItems(user.id, chest.id, true);
    const group = chestItems.find(item => 
        item.id === data.item_id && item.type === data.item_type
    );
    
    if (!group) {
        await context.send(`❌ Группа предметов не найдена.`);
        return res;
    }
    
    // Запрашиваем общее количество для распределения
    const countResponse = await context.question(
        `🔢 У вас есть ${group.count} предметов "${group.name}"\n\n` +
        `Сколько всего штук вы хотите раздать? (введите число от 1 до ${group.count}):`,
        { answerTimeLimit }
    );
    
    if (countResponse.isTimeout || !countResponse.text) {
        await context.send(`⏰ Время ввода истекло!`);
        return res;
    }
    
    const giftCount = parseInt(countResponse.text.trim());
    
    if (isNaN(giftCount) || giftCount < 1 || giftCount > group.count) {
        await context.send(`❌ Неверное количество! Введите число от 1 до ${group.count}`);
        return res;
    }
    
    // Запрашиваем комментарий (общий для всех получателей)
    let globalComment = "";
    const want_comment = await context.question(
        `💬 Хотите добавить общий комментарий ко всем подаркам?`,
        {
            keyboard: Keyboard.builder()
                .textButton({ label: '✅ Да', payload: { command: 'add_comment' }, color: 'positive' })
                .textButton({ label: '❌ Нет', payload: { command: 'no_comment' }, color: 'negative' })
                .oneTime().inline(),
            answerTimeLimit
        }
    );
    
    if (want_comment.isTimeout) {
        await context.send(`⏰ Время ожидания истекло!`);
        return res;
    }
    
    if (want_comment.payload?.command === 'add_comment') {
        const comment_input = await context.question(
            `💬 Введите общий комментарий к подаркам (максимум 200 символов):`,
            { answerTimeLimit }
        );
        
        if (comment_input.isTimeout) {
            await context.send(`⏰ Время ожидания истекло!`);
            return res;
        }
        
        if (comment_input.text && comment_input.text.length <= 200) {
            globalComment = comment_input.text;
        } else if (comment_input.text && comment_input.text.length > 200) {
            await context.send(`⚠ Комментарий слишком длинный (${comment_input.text.length}/200). Комментарий не будет добавлен.`);
        }
    }
    
    // Ввод распределения по получателям
    const distributionResponse = await context.question(
        `📊 Распределите ${giftCount} предметов "${group.name}" между получателями:\n\n` +
        `Введите данные в формате:\n` +
        `UID_получателя-Количество\n\n` +
        `Пример:\n` +
        `44-3\n` +
        `65-2\n\n` +
        `💡 Сумма количеств должна равняться ${giftCount}`,
        { answerTimeLimit }
    );
    
    if (distributionResponse.isTimeout) {
        await context.send(`⏰ Время ввода истекло!`);
        return res;
    }
    
    const lines = distributionResponse.text.trim().split('\n');
    let totalDistributed = 0;
    const operations = [];
    
    for (const line of lines) {
        const parts = line.split('-').map((part: string) => part.trim());
        if (parts.length === 2) {
            const [recipientId, quantity] = parts.map((part: string) => parseInt(part));
            if (!isNaN(recipientId) && !isNaN(quantity) && quantity > 0) {
                operations.push({
                    recipient_id: recipientId,
                    quantity: quantity
                });
                totalDistributed += quantity;
            }
        }
    }
    
    if (totalDistributed !== giftCount) {
        await context.send(`❌ Сумма количеств (${totalDistributed}) не равна общему количеству (${giftCount}). Операция отменена.`);
        return res;
    }
    
    // Подтверждение с комментарием
    let ownerText = '';
    if (user_adm) {
        ownerText = `из инвентаря ${user.name}`;
    } else {
        ownerText = `из своего инвентаря`;
    }

    const confirmText = `раздать ${giftCount} предметов "${group.name}" между ${operations.length} получателями ${ownerText}?` +
        (globalComment ? `\n💬 Комментарий: "${globalComment}"` : '');

    const confirm = await Confirm_User_Success(context, confirmText);
    
    if (!confirm.status) {
        await context.send(`❌ Дарение отменено.`);
        return res;
    }
    
    // Выполняем дарение
    let successCount = 0;
    let failedCount = 0;
    let itemIndex = 0;
    const recipientResults: { [key: number]: { name: string, count: number, chestName: string } } = {};
    
    for (const operation of operations) {
        const recipient = await prisma.user.findFirst({ where: { id: operation.recipient_id } });
        if (!recipient) {
            failedCount += operation.quantity;
            continue;
        }
        
        if (!recipientResults[operation.recipient_id]) {
            recipientResults[operation.recipient_id] = { 
                name: recipient.name, 
                count: 0, 
                chestName: 'Основное' 
            };
        }
        
        // Берем предметы из группы
        for (let i = 0; i < operation.quantity; i++) {
            if (itemIndex >= group.inventory_ids.length) break;
            
            const inventoryId = group.inventory_ids[itemIndex];
            try {
                const inv = await prisma.inventory.findFirst({
                    where: { id: inventoryId }
                });
                
                if (!inv) {
                    failedCount++;
                    itemIndex++;
                    continue;
                }
                
                // Находим связь с сундуком
                const chestLink = await prisma.chestItemLink.findFirst({
                    where: { id_inventory: inventoryId }
                });
                
                // Находим сундук получателя
                const recipientChestId = await findRecipientChest(
                    recipient.id,
                    chestLink?.id_chest || chest.id,
                    chest.id_alliance || user.id_alliance || 0
                );
                
                // Получаем имя сундука получателя
                const recipientChest = await prisma.allianceChest.findFirst({
                    where: { id: recipientChestId }
                });
                
                if (recipientChest) {
                    recipientResults[operation.recipient_id].chestName = recipientChest.name;
                }
                
                // Обновляем предмет с комментарием
                const updatedItem = await prisma.inventory.update({
                    where: { id: inventoryId },
                    data: {
                        id_user: recipient.id,
                        comment: globalComment ? 
                            `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}. Комментарий: ${globalComment}` :
                            `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}`
                    }
                });
                
                if (updatedItem) {
                    successCount++;
                    recipientResults[operation.recipient_id].count++;
                    
                    // Обновляем связь с сундуком
                    if (chestLink) {
                        await prisma.chestItemLink.update({
                            where: { id: chestLink.id },
                            data: { id_chest: recipientChestId }
                        });
                    } else {
                        await prisma.chestItemLink.create({
                            data: {
                                id_chest: recipientChestId,
                                id_inventory: inventoryId
                            }
                        });
                    }
                } else {
                    failedCount++;
                }
            } catch (error) {
                console.error(`Error giving item ${inventoryId}:`, error);
                failedCount++;
            }
            itemIndex++;
        }
    }
    
    // Результат
    let resultMessage = `🎁 Массовое дарение завершено!\n\n` +
        `✅ Успешно передано: ${successCount} предметов\n` +
        `❌ Не удалось передать: ${failedCount} предметов\n\n` +
        `📦 Предмет: ${group.name}\n` +
        `📁 Из сундука: "${chest.name}"\n`;
    
    if (globalComment) {
        resultMessage += `💬 Комментарий: "${globalComment}"\n\n`;
    }
    
    resultMessage += `📊 Распределение:\n`;
    
    for (const [recipientId, result] of Object.entries(recipientResults)) {
        if (result.count > 0) {
            resultMessage += `👤 ${result.name} (UID: ${recipientId}): ${result.count} шт. → сундук: ${result.chestName}\n`;
        }
    }
    
    await context.send(resultMessage);
    
    // Уведомления получателям и логирование
    for (const [recipientId, result] of Object.entries(recipientResults)) {
        if (result.count > 0) {
            const recipient = await prisma.user.findFirst({ where: { id: parseInt(recipientId) } });
            if (recipient) {
                // Уведомление получателю
                let receiverMessage = `🎁 Вам подарены предметы от @id${user.idvk}(${user.name}) (UID: ${user.id})!\n\n` +
                    `🎯 Получено персонажем: ${recipient.name} (UID: ${recipient.id})\n` +
                    `🎯 Получено: ${group.name} × ${result.count}\n` +
                    `📁 Предметы находятся в сундуке: ${result.chestName}`;
                
                if (globalComment) {
                    receiverMessage += `\n💬 Комментарий: "${globalComment}"`;
                }
                
                await Send_Message(recipient.idvk, receiverMessage);
                
                // Логирование
                const logMessage = `🎁 Массовое дарение из сундука\n\n` +
                    `👤 Отправитель: @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
                    `🎯 Получатель: @id${recipient.idvk}(${recipient.name}) (UID: ${recipient.id})\n` +
                    `📦 Предмет: ${group.name} × ${result.count}\n` +
                    (globalComment ? `💬 Комментарий: "${globalComment}"\n` : '') +
                    `📁 Из сундука: "${chest.name}"\n` +
                    `📁 В сундук: ${result.chestName}`;
                
                // Используем функцию для определения чата логирования
                const logChatId = await getLogChatForMassPresent(user, recipient);
                if (logChatId !== null) {
                    await Send_Message(logChatId, logMessage);
                }
                
                // Отправляем только одно уведомление инициатору (если это админ)
                if (user_adm && parseInt(recipientId) === user_adm.id) {
                    const adminMessage =
                        `🎁 Передача товара "${group.name}" от игрока ${user.name} (UID: ${user.id}) игроку ${recipient.name} (UID: ${recipient.id})\n` +
                        (globalComment ? `💬 Комментарий: "${globalComment}"\n` : '') +
                        `📁 Из сундука: "${chest.name}"\n` +
                        `📁 В сундук: ${result.chestName}`;
                    
                    await Send_Message(user_adm.idvk, adminMessage);
                }
            }
        }
    }
    
    return res;
}

async function handleChestMassByIds(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor, 
        group_mode: data.group_mode, 
        childChestCursor: data.childChestCursor 
    };
    
    // Запрашиваем получателя
    const recipientId = await Input_Number(
        context,
        `Введите UID получателя:`,
        true
    );
    
    if (!recipientId) {
        await context.send(`❌ Получатель не указан.`);
        return res;
    }
    
    if (recipientId == user.id) {
        await context.send(`❌ Нельзя дарить предметы самому себе!`);
        return res;
    }
    
    const recipient = await prisma.user.findFirst({ where: { id: recipientId } });
    if (!recipient) {
        await context.send(`❌ Персонаж с UID ${recipientId} не найден!`);
        return res;
    }
    
    // Запрашиваем комментарий
    let comment = "";
    const want_comment = await context.question(
        `💬 Хотите добавить комментарий к подарку?`,
        {
            keyboard: Keyboard.builder()
                .textButton({ label: '✅ Да', payload: { command: 'add_comment' }, color: 'positive' })
                .textButton({ label: '❌ Нет', payload: { command: 'no_comment' }, color: 'negative' })
                .oneTime().inline(),
            answerTimeLimit
        }
    );
    
    if (want_comment.isTimeout) {
        await context.send(`⏰ Время ожидания истекло!`);
        return res;
    }
    
    if (want_comment.payload?.command === 'add_comment') {
        const comment_input = await context.question(
            `💬 Введите комментарий к подарку (максимум 200 символов):`,
            { answerTimeLimit }
        );
        
        if (comment_input.isTimeout) {
            await context.send(`⏰ Время ожидания истекло!`);
            return res;
        }
        
        if (comment_input.text && comment_input.text.length <= 200) {
            comment = comment_input.text;
        } else if (comment_input.text && comment_input.text.length > 200) {
            await context.send(`⚠ Комментарий слишком длинный (${comment_input.text.length}/200). Комментарий не будет добавлен.`);
        }
    }
    
    // Запрашиваем ID предметов
    const itemsResponse = await context.question(
        `📝 Введите ID предметов для дарения через пробел:\n` +
        `Пример: 1670 1671 1676 1677\n\n` +
        `💡 ID предметов указаны в сундуке "${chest.name}"`,
        { answerTimeLimit }
    );
    
    if (itemsResponse.isTimeout || !itemsResponse.text) {
        await context.send(`⏰ Время ввода истекло!`);
        return res;
    }
    
    const itemIds = itemsResponse.text.trim().split(/\s+/)
        .map((id: string) => parseInt(id))
        .filter((id: number) => !isNaN(id));
    
    if (itemIds.length === 0) {
        await context.send(`❌ Не указаны ID предметов.`);
        return res;
    }
    
    // Подтверждение с комментарием
    let ownerText = '';
    if (user_adm) {
        ownerText = `из инвентаря ${user.name}`;
    } else {
        ownerText = `из своего инвентаря`;
    }

    const confirm = await Confirm_User_Success(
        context,
        `подарить ${itemIds.length} предметов игроку ${recipient.name} ${ownerText}?${comment ? `\n💬 Комментарий: "${comment}"` : ''}`
    );
    
    if (!confirm.status) {
        await context.send(`❌ Дарение отменено.`);
        return res;
    }
    
    // Выполняем дарение
    let successCount = 0;
    let failedCount = 0;
    const giftedItems: string[] = [];
    let finalRecipientChestId: number | null = null;
    let finalRecipientChestName = 'Основное';
    
    for (const itemId of itemIds) {
        try {
            const inv = await prisma.inventory.findFirst({
                where: { 
                    id: itemId,
                    id_user: user.id,
                    ChestItemLink: {
                        is: {
                            id_chest: chest.id
                        }
                    }
                }
            });
            
            if (!inv) {
                failedCount++;
                continue;
            }
            
            // Получаем информацию о предмете
            let itemInfo: any = null;
            let itemName = 'Неизвестный предмет';
            
            if (inv.type === InventoryType.ITEM_SHOP_ALLIANCE) {
                itemInfo = await prisma.allianceShopItem.findFirst({ where: { id: inv.id_item } });
                itemName = itemInfo?.name || 'Предмет магазина';
            } else if (inv.type === InventoryType.ITEM_SHOP) {
                itemInfo = await prisma.item.findFirst({ where: { id: inv.id_item } });
                itemName = itemInfo?.name || 'Предмет магазина';
            } else if (inv.type === InventoryType.ITEM_STORAGE) {
                itemInfo = await prisma.itemStorage.findFirst({ where: { id: inv.id_item } });
                itemName = itemInfo?.name || 'Артефакт';
            }
            
            // Находим связь с сундуком
            const chestLink = await prisma.chestItemLink.findFirst({
                where: { id_inventory: inv.id }
            });
            
            // Находим сундук получателя
            const recipientChestId = await findRecipientChest(
                recipient.id,
                chestLink?.id_chest || chest.id,
                chest.id_alliance || user.id_alliance || 0
            );
            
            // Сохраняем ID сундука получателя
            finalRecipientChestId = recipientChestId;
            
            // Обновляем предмет с комментарием
            const updatedItem = await prisma.inventory.update({
                where: { id: inv.id },
                data: {
                    id_user: recipient.id,
                    comment: comment ? 
                        `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}. Комментарий: ${comment}` :
                        `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}`
                }
            });
            
            if (updatedItem) {
                successCount++;
                giftedItems.push(`${itemName} (ID: ${itemId})`);
                
                // Обновляем связь с сундуком
                if (chestLink) {
                    await prisma.chestItemLink.update({
                        where: { id: chestLink.id },
                        data: { id_chest: recipientChestId }
                    });
                } else {
                    await prisma.chestItemLink.create({
                        data: {
                            id_chest: recipientChestId,
                            id_inventory: inv.id
                        }
                    });
                }
            } else {
                failedCount++;
            }
        } catch (error) {
            console.error(`Error giving item ${itemId}:`, error);
            failedCount++;
        }
    }
    
    // Получаем информацию о сундуке получателя
    if (finalRecipientChestId) {
        const recipientChest = await prisma.allianceChest.findFirst({
            where: { id: finalRecipientChestId }
        });
        if (recipientChest) {
            finalRecipientChestName = recipientChest.name;
        }
    }
    
    // Результат
    let resultMessage = `🎁 Массовое дарение завершено!\n\n` +
        `✅ Успешно передано: ${successCount} предметов\n` +
        `❌ Не удалось передать: ${failedCount} предметов\n\n` +
        `👤 Получатель: ${recipient.name} (UID: ${recipient.id})\n` +
        `📁 Из сундука: ${chest.name}`;
    
    if (comment) {
        resultMessage += `\n💬 Комментарий: "${comment}"`;
    }
    
    if (giftedItems.length > 0) {
        resultMessage += `\n\n🎁 Предметы:\n${giftedItems.join('\n')}`;
    }
    
    await context.send(resultMessage);
    
    // Уведомление получателю
    if (successCount > 0) {
        let receiverMessage = `🎁 Вам подарены предметы от @id${user.idvk}(${user.name}) (UID: ${user.id})!\n\n` +
            `🎯 Получено персонажем: ${recipient.name} (UID: ${recipient.id})\n` +
            `📦 Получено предметов: ${successCount}\n` +
            `📁 Предметы находятся в сундуке: ${finalRecipientChestName}`;
        
        if (comment) {
            receiverMessage += `\n💬 Комментарий: "${comment}"`;
        }
        
        if (giftedItems.length > 0) {
            receiverMessage += `\n\n🎁 Список:\n${giftedItems.map(item => item.split(' (ID:')[0]).join('\n')}`;
        }
        
        await Send_Message(recipient.idvk, receiverMessage);
    }
    
    // Логирование с определением правильного чата
    if (successCount > 0) {
        const logMessage = `🎁 Массовое дарение из сундука\n\n` +
            `👤 Отправитель: @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
            `🎯 Получатель: @id${recipient.idvk}(${recipient.name}) (UID: ${recipient.id})\n` +
            `📦 Передано: ${successCount} предметов\n` +
            `${comment ? `💬 Комментарий: "${comment}"\n` : ''}` +
            `📁 Из сундука: ${chest.name}\n` +
            `📁 В сундук: ${finalRecipientChestName}`;
        
        // Используем функцию для определения чата логирования
        const logChatId = await getLogChatForMassPresent(user, recipient);
        if (logChatId !== null) {
            await Send_Message(logChatId, logMessage);
        }
    }
    
    return res;
}

// 2. Массовое дарение по типу и количеству (одному получателю)
async function handleChestMassByType(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor || 0,  // Добавляем значение по умолчанию
        group_mode: data.group_mode || false, 
        childChestCursor: data.childChestCursor || 0 
    };
    
    // Получаем все предметы в сундуке в групповом режиме
    const chestItems = await getChestInventoryItems(user.id, chest.id, true);
    
    if (chestItems.length === 0) {
        await context.send(`📦 Сундук "${chest.name}" пуст.`);
        return res;
    }
    
    // Фильтруем только предметы, которых больше 1 штуки (для массового дарения)
    const multipleItems = chestItems.filter(item => item.count > 1);
    
    if (multipleItems.length === 0) {
        await context.send(`❌ В сундуке "${chest.name}" нет предметов, которых больше 1 штуки.\nИспользуйте режим "По ID предметов" для дарения одиночных предметов.`);
        return res;
    }
    
    // ПАГИНАЦИЯ: 5 предметов на страницу
    const ITEMS_PER_PAGE = 5;
    const currentPage = Math.floor(res.cursor / ITEMS_PER_PAGE);
    const totalPages = Math.ceil(multipleItems.length / ITEMS_PER_PAGE);
    
    // Получаем предметы для текущей страницы
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageItems = multipleItems.slice(startIndex, endIndex);
    
    // Показываем предметы для выбора
    let text = `📦 Выберите предмет для дарения:\n\n`;
    text += `💡 Показаны только предметы, которых у вас больше 1 штуки\n`;
    text += `📊 Найдено предметов: ${multipleItems.length}\n`;
    text += `📄 Страница ${currentPage + 1} из ${totalPages}\n\n`;
    text += `📁 Из сундука: "${chest.name}"\n\n`;
    
    for (let i = 0; i < pageItems.length; i++) {
        const item = pageItems[i];
        const itemNumber = startIndex + i + 1;
        text += `${itemNumber}. ${item.name} × ${item.count}\n`;
    }
    
    const keyboard = new KeyboardBuilder();
    
    // Кнопки предметов (максимум 5 на страницу)
    for (let i = 0; i < pageItems.length; i++) {
        const item = pageItems[i];
        const itemNumber = startIndex + i + 1;
        const label = item.name.length > 10 ? 
            `${itemNumber}. ${item.name.slice(0, 8)}... × ${item.count}` : 
            `${itemNumber}. ${item.name} × ${item.count}`;
        
        keyboard.textButton({
            label: `🧳 ${label}`,
            payload: {
                command: 'chest_mass_select_item_single',
                item_id: item.id,
                item_type: item.type,
                chest_id: chest.id,
                cursor: res.cursor,
                group_mode: res.group_mode,
                childChestCursor: res.childChestCursor
            },
            color: 'secondary'
        }).row();
    }
    
    // Навигация по страницам
    if (multipleItems.length > ITEMS_PER_PAGE) {
        if (currentPage > 0) {
            const prevCursor = Math.max(0, (currentPage - 1) * ITEMS_PER_PAGE);
            keyboard.textButton({
                label: `⬅️ Назад`,
                payload: {
                    command: 'chest_mass_by_type_page',
                    cursor: prevCursor,
                    group_mode: res.group_mode,
                    childChestCursor: res.childChestCursor,
                    chestId: chest.id
                },
                color: 'secondary'
            });
        }
        
        if (currentPage < totalPages - 1) {
            const nextCursor = (currentPage + 1) * ITEMS_PER_PAGE;
            keyboard.textButton({
                label: `Вперед ➡️`,
                payload: {
                    command: 'chest_mass_by_type_page',
                    cursor: nextCursor,
                    group_mode: res.group_mode,
                    childChestCursor: res.childChestCursor,
                    chestId: chest.id
                },
                color: 'secondary'
            });
        }
        
        keyboard.row();
    }
    
    try {
        const response = await Send_Message_Question(context, text, keyboard.oneTime());
        
        if (response.exit) {
            return res;
        }
        
        if (!response.payload) {
            await context.send(`💡 Жмите только на кнопки.`);
            return res;
        }
        
        // Проверяем, является ли payload строкой JSON
        let payloadData: any;
        if (typeof response.payload === 'string') {
            try {
                payloadData = JSON.parse(response.payload);
            } catch (e) {
                console.error(`Error parsing payload:`, e);
                await context.send(`❌ Ошибка обработки команды.`);
                return res;
            }
        } else if (typeof response.payload === 'object' && response.payload !== null) {
            // Проверяем разные форматы payload
            if (response.payload.payload) {
                payloadData = response.payload.payload;
            } else if (response.payload.command) {
                payloadData = response.payload;
            } else {
                await context.send(`💡 Жмите только на кнопки.`);
                return res;
            }
        } else {
            await context.send(`💡 Жмите только на кнопки.`);
            return res;
        }
        
        // Обработка команд
        if (payloadData.command === 'chest_mass_select_item_single') {
            return await handleChestMassSelectItemSingle(context, payloadData, user, user_adm, chest);
        }
        
        if (payloadData.command === 'chest_mass_by_type_page') {
            // Навигация по страницам - вызываем саму себя с новым курсором
            return await handleChestMassByType(context, payloadData, user, user_adm, chest);
        }
        
        if (payloadData.command === 'chest_mass_select_page_single') {
            // Запрос номера страницы
            return await handleChestMassSelectPageSingle(context, payloadData, user, user_adm, chest);
        }
        
        if (payloadData.command === 'chest_mass_cancel') {
            await context.send(`❌ Массовое дарение отменено.`);
            // Возвращаемся к стандартному виду сундука
            return {
                cursor: payloadData.cursor,
                group_mode: payloadData.group_mode,
                childChestCursor: payloadData.childChestCursor,
                currentChestId: chest.id
            };
        }
        
        return res;
        
    } catch (error) {
        console.error("Ошибка в handleChestMassByType:", error);
        return res;
    }
}

async function handleChestMassSelectPageSingle(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor, 
        group_mode: data.group_mode, 
        childChestCursor: data.childChestCursor 
    };
    
    // Получаем все предметы
    const chestItems = await getChestInventoryItems(user.id, chest.id, true);
    const multipleItems = chestItems.filter(item => item.count > 1);
    
    if (multipleItems.length === 0) {
        return res;
    }
    
    const ITEMS_PER_PAGE = 5;
    const totalPages = Math.ceil(multipleItems.length / ITEMS_PER_PAGE);
    
    // Запрашиваем номер страницы
    const pageResponse = await context.question(
        `📄 Введите номер страницы (от 1 до ${totalPages}):`,
        { answerTimeLimit }
    );
    
    if (pageResponse.isTimeout || !pageResponse.text) {
        await context.send(`⏰ Время ввода истекло!`);
        return res;
    }
    
    const pageNumber = parseInt(pageResponse.text.trim());
    
    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
        await context.send(`❌ Неверный номер страницы! Введите число от 1 до ${totalPages}`);
        return res;
    }
    
    // Рассчитываем новый курсор
    const newCursor = (pageNumber - 1) * ITEMS_PER_PAGE;
    
    // Возвращаемся к показу страницы
    return {
        cursor: newCursor,
        group_mode: data.group_mode,
        childChestCursor: data.childChestCursor
    };
}

async function handleChestMassSelectItemSingle(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor, 
        group_mode: data.group_mode, 
        childChestCursor: data.childChestCursor 
    };
    
    // Получаем информацию о группе предметов
    const chestItems = await getChestInventoryItems(user.id, chest.id, true);
    const group = chestItems.find(item => 
        item.id === data.item_id && item.type === data.item_type
    );
    
    if (!group) {
        await context.send(`❌ Группа предметов не найдена.`);
        return res;
    }
    
    // Запрашиваем получателя
    const recipientId = await Input_Number(
        context,
        `🔢 У вас есть ${group.count} предметов "${group.name}"\n\n` +
        `Введите UID получателя:`,
        true
    );
    
    if (!recipientId) {
        await context.send(`❌ Получатель не указан.`);
        return res;
    }
    
    if (recipientId == user.id) {
        await context.send(`❌ Нельзя дарить предметы самому себе!`);
        return res;
    }
    
    const recipient = await prisma.user.findFirst({ where: { id: recipientId } });
    if (!recipient) {
        await context.send(`❌ Персонаж с UID ${recipientId} не найден!`);
        return res;
    }
    
    // Запрашиваем количество
    const countResponse = await context.question(
        `Сколько предметов "${group.name}" подарить? (введите число от 1 до ${group.count}):`,
        { answerTimeLimit }
    );
    
    if (countResponse.isTimeout || !countResponse.text) {
        await context.send(`⏰ Время ввода истекло!`);
        return res;
    }
    
    const giftCount = parseInt(countResponse.text.trim());
    
    if (isNaN(giftCount) || giftCount < 1 || giftCount > group.count) {
        await context.send(`❌ Неверное количество! Введите число от 1 до ${group.count}`);
        return res;
    }
    
    // Запрашиваем комментарий
    let comment = "";
    const want_comment = await context.question(
        `💬 Хотите добавить комментарий к подарку?`,
        {
            keyboard: Keyboard.builder()
                .textButton({ label: '✅ Да', payload: { command: 'add_comment' }, color: 'positive' })
                .textButton({ label: '❌ Нет', payload: { command: 'no_comment' }, color: 'negative' })
                .oneTime().inline(),
            answerTimeLimit
        }
    );
    
    if (want_comment.isTimeout) {
        await context.send(`⏰ Время ожидания истекло!`);
        return res;
    }
    
    if (want_comment.payload?.command === 'add_comment') {
        const comment_input = await context.question(
            `💬 Введите комментарий к подарку (максимум 200 символов):`,
            { answerTimeLimit }
        );
        
        if (comment_input.isTimeout) {
            await context.send(`⏰ Время ожидания истекло!`);
            return res;
        }
        
        if (comment_input.text && comment_input.text.length <= 200) {
            comment = comment_input.text;
        } else if (comment_input.text && comment_input.text.length > 200) {
            await context.send(`⚠ Комментарий слишком длинный (${comment_input.text.length}/200). Комментарий не будет добавлен.`);
        }
    }
    
    // Подтверждение с комментарием
    let ownerText = '';
    if (user_adm) {
        ownerText = `из инвентаря ${user.name}`;
    } else {
        ownerText = `из своего инвентаря`;
    }

    const confirm = await Confirm_User_Success(
        context,
        `подарить ${giftCount} предметов "${group.name}" игроку ${recipient.name} ${ownerText}?${comment ? `\n💬 Комментарий: "${comment}"` : ''}`
    );
    
    if (!confirm.status) {
        await context.send(`❌ Дарение отменено.`);
        return res;
    }
    
    // Выполняем дарение
    let successCount = 0;
    let failedCount = 0;
    let finalRecipientChestId: number | null = null;
    let finalRecipientChestName = 'Основное';
    
    // Берем первые N предметов из группы
    const itemsToGive = group.inventory_ids.slice(0, giftCount);
    
    for (const inventoryId of itemsToGive) {
        try {
            const inv = await prisma.inventory.findFirst({
                where: { id: inventoryId }
            });
            
            if (!inv) {
                failedCount++;
                continue;
            }
            
            // Находим связь с сундуком
            const chestLink = await prisma.chestItemLink.findFirst({
                where: { id_inventory: inventoryId }
            });
            
            // Находим сундук получателя
            const recipientChestId = await findRecipientChest(
                recipient.id,
                chestLink?.id_chest || chest.id,
                chest.id_alliance || user.id_alliance || 0
            );

            // Сохраняем ID сундука получателя
            finalRecipientChestId = recipientChestId;
            
            // Обновляем предмет с комментарием
            const updatedItem = await prisma.inventory.update({
                where: { id: inventoryId },
                data: {
                    id_user: recipient.id,
                    comment: comment ? 
                        `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}. Комментарий: ${comment}` :
                        `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}`
                }
            });
            
            if (updatedItem) {
                successCount++;
                
                // Обновляем связь с сундуком
                if (chestLink) {
                    await prisma.chestItemLink.update({
                        where: { id: chestLink.id },
                        data: { id_chest: recipientChestId }
                    });
                } else {
                    await prisma.chestItemLink.create({
                        data: {
                            id_chest: recipientChestId,
                            id_inventory: inventoryId
                        }
                    });
                }
            } else {
                failedCount++;
            }
        } catch (error) {
            console.error(`Error giving item ${inventoryId}:`, error);
            failedCount++;
        }
    }
    
    // Получаем информацию о сундуке получателя
    if (finalRecipientChestId) {
        const recipientChest = await prisma.allianceChest.findFirst({
            where: { id: finalRecipientChestId }
        });
        if (recipientChest) {
            finalRecipientChestName = recipientChest.name;
        }
    }
    
    // Результат
    let resultMessage = `🎁 Массовое дарение завершено!\n\n` +
        `✅ Успешно передано: ${successCount} предметов\n` +
        `❌ Не удалось передать: ${failedCount} предметов\n\n` +
        `📦 Предмет: ${group.name} × ${successCount}\n` +
        `👤 Получатель: ${recipient.name} (UID: ${recipient.id})\n` +
        `📁 Из сундука: "${chest.name}"`;
    
    if (comment) {
        resultMessage += `\n💬 Комментарий: "${comment}"`;
    }
    
    await context.send(resultMessage);
    
    // Уведомление получателю
    if (successCount > 0) {
        let receiverMessage = `🎁 Вам подарены предметы от @id${user.idvk}(${user.name}) (UID: ${user.id})!\n\n` +
            `🎯 Получено персонажем: ${recipient.name} (UID: ${recipient.id})\n` +
            `🎯 Получено: ${group.name} × ${successCount}\n` +
            `📁 Предметы находятся в сундуке: ${finalRecipientChestName}`;
        
        if (comment) {
            receiverMessage += `\n💬 Комментарий: "${comment}"`;
        }
        
        await Send_Message(recipient.idvk, receiverMessage);
    }
    
    // Логирование с определением правильного чата
    if (successCount > 0) {
        const logMessage = `🎁 Массовое дарение из сундука\n\n` +
            `👤 Отправитель: @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
            `🎯 Получатель: @id${recipient.idvk}(${recipient.name}) (UID: ${recipient.id})\n` +
            `📦 Предмет: ${group.name} × ${successCount}\n` +
            `${comment ? `💬 Комментарий: "${comment}"\n` : ''}` +
            `📁 Из сундука: "${chest.name}"\n` +
            `📁 В сундук: ${finalRecipientChestName}`;
        
        // Используем функцию для определения чата логирования
        const logChatId = await getLogChatForMassPresent(user, recipient);
        if (logChatId !== null) {
            await Send_Message(logChatId, logMessage);
        }
    }
    
    // Возвращаемся к списку предметов для массового дарения
    return {
        cursor: data.cursor,
        group_mode: data.group_mode,
        childChestCursor: data.childChestCursor
    };
}

async function handleChestMassSelectItem(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor, 
        group_mode: data.group_mode, 
        childChestCursor: data.childChestCursor 
    };
    
    // Получаем информацию о группе предметов
    const chestItems = await getChestInventoryItems(user.id, chest.id, true);
    const group = chestItems.find(item => 
        item.id === data.item_id && item.type === data.item_type
    );
    
    if (!group) {
        await context.send(`❌ Группа предметов не найдена.`);
        return res;
    }
    
    // Запрашиваем получателя
    const recipientId = await Input_Number(
        context,
        `У вас есть ${group.count} предметов "${group.name}"\n\n` +
        `Введите UID получателя:`,
        true
    );
    
    if (!recipientId) {
        await context.send(`❌ Получатель не указан.`);
        return res;
    }
    
    if (recipientId == user.id) {
        await context.send(`❌ Нельзя дарить предметы самому себе!`);
        return res;
    }
    
    const recipient = await prisma.user.findFirst({ where: { id: recipientId } });
    if (!recipient) {
        await context.send(`❌ Персонаж с UID ${recipientId} не найден!`);
        return res;
    }
    
    // Запрашиваем количество
    const countResponse = await context.question(
        `Сколько предметов "${group.name}" подарить? (от 1 до ${group.count}):`,
        { answerTimeLimit }
    );
    
    if (countResponse.isTimeout || !countResponse.text) {
        await context.send(`⏰ Время ввода истекло!`);
        return res;
    }
    
    const giftCount = parseInt(countResponse.text.trim());
    
    if (isNaN(giftCount) || giftCount < 1 || giftCount > group.count) {
        await context.send(`❌ Неверное количество! Введите число от 1 до ${group.count}`);
        return res;
    }
    
    // Подтверждение
    let ownerText = '';
    if (user_adm) {
        ownerText = `из инвентаря ${user.name}`;
    } else {
        ownerText = `из своего инвентаря`;
    }

    const confirm = await Confirm_User_Success(
        context,
        `подарить ${giftCount} предметов "${group.name}" игроку ${recipient.name} ${ownerText}?`
    );
    
    if (!confirm.status) {
        await context.send(`❌ Дарение отменено.`);
        return res;
    }
    
    // Выполняем дарение
    let successCount = 0;
    let failedCount = 0;
    let finalRecipientChestId: number | null = null;
    let finalRecipientChestName = 'Основное';
    
    // Берем первые N предметов из группы
    const itemsToGive = group.inventory_ids.slice(0, giftCount);
    
    for (const inventoryId of itemsToGive) {
        try {
            const inv = await prisma.inventory.findFirst({
                where: { id: inventoryId }
            });
            
            if (!inv) {
                failedCount++;
                continue;
            }
            
            // Находим связь с сундуком
            const chestLink = await prisma.chestItemLink.findFirst({
                where: { id_inventory: inventoryId }
            });
            
            // Находим сундук получателя
            const recipientChestId = await findRecipientChest(
                recipient.id,
                chestLink?.id_chest || chest.id,
                recipient.id_alliance || 0
            );
            
            // Сохраняем информацию о сундуке получателя
            finalRecipientChestId = recipientChestId;
            
            // Обновляем предмет
            const updatedItem = await prisma.inventory.update({
                where: { id: inventoryId },
                data: {
                    id_user: recipient.id,
                    comment: `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}`
                }
            });
            
            if (updatedItem) {
                successCount++;
                
                // Обновляем связь с сундуком
                if (chestLink) {
                    await prisma.chestItemLink.update({
                        where: { id: chestLink.id },
                        data: { id_chest: recipientChestId }
                    });
                } else {
                    await prisma.chestItemLink.create({
                        data: {
                            id_chest: recipientChestId,
                            id_inventory: inventoryId
                        }
                    });
                }
            } else {
                failedCount++;
            }
        } catch (error) {
            console.error(`Error giving item ${inventoryId}:`, error);
            failedCount++;
        }
    }
    
    // Получаем название сундука получателя
    if (finalRecipientChestId) {
        const recipientChest = await prisma.allianceChest.findFirst({
            where: { id: finalRecipientChestId }
        });
        if (recipientChest) {
            finalRecipientChestName = recipientChest.name;
        }
    }
    
    // Результат для отправителя
    const resultMessage = `🎁 Массовое дарение завершено!\n\n` +
        `✅ Успешно передано: ${successCount} предметов\n` +
        `❌ Не удалось передать: ${failedCount} предметов\n\n` +
        `📦 Предмет: ${group.name} × ${successCount}\n` +
        `👤 Получатель: ${recipient.name} (UID: ${recipient.id})\n` +
        `📁 Из сундука: "${chest.name}"`;
    
    await context.send(resultMessage);
    
    // Уведомление получателю - ТОЛЬКО сундук назначения
    if (successCount > 0) {
        const receiverMessage = `🎁 Вам подарены предметы от @id${user.idvk}(${user.name}) (UID: ${user.id})!\n\n` +
            `🎯 Получено персонажем: ${recipient.name} (UID: ${recipient.id})\n` +
            `🎯 Получено: ${group.name} × ${successCount}\n` +
            `📁 Предметы находятся в сундуке: ${finalRecipientChestName}`;
        
        await Send_Message(recipient.idvk, receiverMessage);
    }
    
    // Логирование - показываем оба сундука
    if (successCount > 0) {
        const logMessage = `🎁 Массовое дарение из сундука\n\n` +
            `👤 Отправитель: @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
            `🎯 Получатель: @id${recipient.idvk}(${recipient.name}) (UID: ${recipient.id})\n` +
            `📦 Предмет: ${group.name} × ${successCount}\n` +
            `📁 Из сундука: "${chest.name}"\n` +
            `📁 В сундук: ${finalRecipientChestName}`;
        
        // Используем функцию для определения чата логирования
        const logChatId = await getLogChatForMassPresent(user, recipient);
        if (logChatId !== null) {
            await Send_Message(logChatId, logMessage);
        }
    }
    
    return res;
}

// 4. Массовое дарение нескольким получателям
async function handleChestMassMultiple(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor, 
        group_mode: data.group_mode, 
        childChestCursor: data.childChestCursor 
    };
    
    await context.send(
        `👥 Для дарения нескольким получателям:\n\n` +
        `1. Используйте режим "По ID предметов"\n` +
        `2. Введите данные в формате:\n` +
        `UID_получателя ID1 ID2 ID3\n\n` +
        `Пример:\n` +
        `44 1670 1671\n` +
        `55 1676 1677\n\n` +
        `💡 Каждая строка — отдельный получатель\n` +
        `💡 ID предметов через пробел`
    );
    
    return res;
}

async function handleChestMassCancel(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { 
        cursor: data.cursor || 0, 
        group_mode: data.group_mode || false, 
        childChestCursor: data.childChestCursor || 0 
    };
    
    await context.send(`❌ Массовое дарение отменено.`);
    
    // Возвращаемся к просмотру сундука
    return {
        ...res,
        currentChestId: chest?.id || 0
    };
}

async function handleSelectPage(
    context: any, 
    data: any, 
    user: User, 
    user_adm?: User, 
    chest?: any
): Promise<{cursor?: number, group_mode?: boolean, childChestCursor?: number}> {
    // Определяем лимиты как в showChestContents
    const chestItems = await getChestInventoryItems(user.id, data.chestId || chest.id, data.group_mode);
    const childChests = chest.Children || [];
    
    const hasChildChests = childChests.length > 0 && chest.name !== "Основное";
    const hasItems = chestItems.length > 0;
    const isDualMode = hasChildChests && hasItems;
    
    const itemLimit = isDualMode ? 3 : 4; // 2 в режиме "2+2", иначе 4
    
    const totalItems = chestItems.length;
    const totalPages = Math.ceil(totalItems / itemLimit);
    
    let text = `📦 Выбор страницы в сундуке "${chest.name}"\n\n`;
    text += `Всего страниц: ${totalPages}\n`;
    text += `Текущая страница: ${Math.floor(data.cursor / itemLimit) + 1}\n\n`;
    text += `Введите номер страницы (1-${totalPages}):`;
    
    const pageNumber = await Input_Number(context, text, true);
    if (pageNumber === false || pageNumber < 1 || pageNumber > totalPages) {
        await context.send(`❌ Некорректный номер страницы.`);
        return { cursor: data.cursor, group_mode: data.group_mode, childChestCursor: data.childChestCursor };
    }
    
    const newCursor = (pageNumber - 1) * itemLimit;
    return { cursor: newCursor, group_mode: data.group_mode, childChestCursor: data.childChestCursor };
}

// Функция для миграции предметов при смене привязки категории
export async function migrateCategoryItems(context: any, categoryId: number, newChestId: number): Promise<boolean> {
    try {
        // Получаем категорию
        const category = await prisma.allianceShopCategory.findFirst({
            where: { id: categoryId }
        });
        
        if (!category) {
            await context.send(`❌ Категория не найдена.`);
            return false;
        }
        
        // Получаем новый сундук
        const newChest = await prisma.allianceChest.findFirst({
            where: { id: newChestId }
        });
        
        if (!newChest) {
            await context.send(`❌ Новый сундук не найден.`);
            return false;
        }
        
        // Спрашиваем, включать ли скрытые товары
        const includeHiddenResponse = await Send_Message_Question(
            context,
            `🔄 Миграция товаров из категории "${category.name}" в сундук "${newChest.name}"\n\n` +
            `📊 Учитывать скрытые товары?\n\n` +
            `✅ Да — мигрировать ВСЕ товары (включая скрытые)\n` +
            `❌ Нет — мигрировать только видимые товары`,
            Keyboard.builder()
                .textButton({
                    label: '✅ Да, включая скрытые',
                    payload: { command: 'migrate_include_hidden', include: true },
                    color: 'positive'
                })
                .textButton({
                    label: '❌ Нет, только видимые',
                    payload: { command: 'migrate_include_hidden', include: false },
                    color: 'negative'
                })
                .oneTime().inline(),
        );
        
        if (includeHiddenResponse.exit) {
            await context.send(`❌ Миграция отменена.`);
            return false;
        }
        
        const includeHidden = includeHiddenResponse.payload?.include || false;
        
        // Получаем статистику по товарам
        const allItemsCount = await prisma.allianceShopItem.count({
            where: { id_shop: categoryId }
        });
        
        const visibleItemsCount = await prisma.allianceShopItem.count({
            where: { 
                id_shop: categoryId,
                hidden: false
            }
        });
        
        const hiddenItemsCount = allItemsCount - visibleItemsCount;
        
        await context.send(`📊 Статистика категории "${category.name}":\n` +
            `• Всего товаров: ${allItemsCount}\n` +
            `• Видимых: ${visibleItemsCount}\n` +
            `• Скрытых: ${hiddenItemsCount}\n\n` +
            `🔄 Начинаю миграцию ${includeHidden ? 'ВСЕХ товаров (включая скрытые)' : 'только видимых товаров'}...`);
        
        // Получаем товары в зависимости от выбора
        const whereClause: any = { 
            id_shop: categoryId
        };
        
        if (!includeHidden) {
            whereClause.hidden = false;
        }
        
        const categoryItems = await prisma.allianceShopItem.findMany({
            where: whereClause
        });
        
        if (categoryItems.length === 0) {
            const message = includeHidden ? 
                `ℹ️ В категории "${category.name}" нет товаров (ни видимых, ни скрытых).` :
                `ℹ️ В категории "${category.name}" нет видимых товаров. ${hiddenItemsCount > 0 ? `Есть ${hiddenItemsCount} скрытых товаров.` : ''}`;
            await context.send(message);
            return true;
        }
        
        let totalInventories = 0;
        let migratedCount = 0;
        let failedCount = 0;
        let processedItems = 0;
        
        // Создаем прогресс-бар
        const totalItems = categoryItems.length;
        const progressStep = Math.max(1, Math.floor(totalItems / 10)); // Обновлять каждые 10%
        
        // Для каждого товара ищем инвентарные записи пользователей
        for (const item of categoryItems) {
            processedItems++;
            
            // Показываем прогресс каждые 10%
            if (processedItems % progressStep === 0 || processedItems === totalItems) {
                const percent = Math.round((processedItems / totalItems) * 100);
                await context.send(`🔄 Обработка: ${processedItems}/${totalItems} (${percent}%)...`);
            }
            
            try {
                // Находим все инвентарные записи этого товара
                const inventories = await prisma.inventory.findMany({
                    where: { 
                        id_item: item.id,
                        type: InventoryType.ITEM_SHOP_ALLIANCE
                    },
                    include: {
                        ChestItemLink: true
                    }
                });
                
                totalInventories += inventories.length;
                
                for (const inventory of inventories) {
                    try {
                        if (inventory.ChestItemLink) {
                            // Получаем старый сундук для лога
                            const oldChest = await prisma.allianceChest.findFirst({
                                where: { id: inventory.ChestItemLink.id_chest }
                            });
                            
                            // Обновляем существующую связь
                            await prisma.chestItemLink.update({
                                where: { id: inventory.ChestItemLink.id },
                                data: { id_chest: newChestId }
                            });
                            
                            console.log(`Migrated inventory ${inventory.id} from chest "${oldChest?.name || 'unknown'}" to "${newChest.name}"`);
                        } else {
                            // Создаем новую связь
                            await prisma.chestItemLink.create({
                                data: {
                                    id_chest: newChestId,
                                    id_inventory: inventory.id
                                }
                            });
                            
                            console.log(`Created link for inventory ${inventory.id} to chest "${newChest.name}"`);
                        }
                        migratedCount++;
                    } catch (error) {
                        console.error(`Error migrating inventory ${inventory.id}:`, error);
                        failedCount++;
                    }
                }
                
                // Небольшая задержка чтобы не перегружать базу при большом количестве записей
                if (inventories.length > 50) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
            } catch (error) {
                console.error(`Error processing item ${item.id}:`, error);
                failedCount++;
            }
        }
        
        // Формируем детальный отчет
        let resultMessage = `✅ Миграция завершена!\n\n` +
            `📁 Категория: "${category.name}"\n` +
            `📦 Новый сундук: "${newChest.name}"\n` +
            `👁 Режим: ${includeHidden ? 'ВСЕ товары (включая скрытые)' : 'Только видимые товары'}\n` +
            `🛒 Товаров в категории: ${allItemsCount}\n` +
            `🔄 Обработано товаров: ${categoryItems.length}\n` +
            `🧳 Всего инвентарных записей: ${totalInventories}\n` +
            `🔄 Успешно перенесено: ${migratedCount}\n` +
            `❌ Ошибок: ${failedCount}`;
        
        // Добавляем информацию о скрытых товарах, если они не были обработаны
        if (!includeHidden && hiddenItemsCount > 0) {
            resultMessage += `\n\nℹ️ Осталось ${hiddenItemsCount} скрытых товаров, которые не были мигрированы.`;
        }
        
        await context.send(resultMessage);
        
        // Логируем в чат альянса
        if (totalInventories > 0) {
            const logMessage = `🔄 Миграция предметов категории\n\n` +
                `📁 Категория: "${category.name}" (ID: ${categoryId})\n` +
                `📦 Сундук: "${newChest.name}" (ID: ${newChestId})\n` +
                `👁 Режим: ${includeHidden ? 'Все товары' : 'Только видимые'}\n` +
                `🛒 Товаров: ${categoryItems.length} из ${allItemsCount}\n` +
                `🧳 Предметов у игроков: ${totalInventories}\n` +
                `🔄 Перенесено: ${migratedCount}`;
            
            // Получаем альянс для отправки в чат
            const shop = await prisma.allianceShop.findFirst({
                where: { id: category.id_alliance_shop }
            });
            
            if (shop) {
                const alliance = await prisma.alliance.findFirst({
                    where: { id: shop.id_alliance }
                });
                
                if (alliance?.id_chat_shop && alliance.id_chat_shop > 0) {
                    await Send_Message(alliance.id_chat_shop, logMessage);
                }
            }
        }
        
        // Предлагаем мигрировать скрытые товары, если они есть и не были обработаны
        if (!includeHidden && hiddenItemsCount > 0) {
            const migrateHiddenResponse = await Send_Message_Question(
                context,
                `ℹ️ Осталось ${hiddenItemsCount} скрытых товаров в категории "${category.name}"\n\n` +
                `Хотите мигрировать скрытые товары тоже?`,
                Keyboard.builder()
                    .textButton({
                        label: '✅ Да, мигрировать скрытые',
                        payload: { command: 'migrate_hidden_only', categoryId, newChestId },
                        color: 'positive'
                    })
                    .textButton({
                        label: '❌ Нет, завершить',
                        payload: { command: 'migrate_complete' },
                        color: 'negative'
                    })
                    .oneTime()
            );
            
            if (!migrateHiddenResponse.exit && migrateHiddenResponse.payload?.command === 'migrate_hidden_only') {
                // Вызываем миграцию только скрытых товаров
                return await migrateHiddenItems(context, categoryId, newChestId, category.name, newChest.name);
            }
        }
        
        return failedCount === 0;
        
    } catch (error: any) {
        console.error('Error in migrateCategoryItems:', error);
        await context.send(`❌ Ошибка при миграции предметов: ${error.message}`);
        return false;
    }
}

// Вспомогательная функция для миграции только скрытых товаров
async function migrateHiddenItems(context: any, categoryId: number, newChestId: number, categoryName: string, chestName: string): Promise<boolean> {
    try {
        await context.send(`🔄 Начинаю миграцию только скрытых товаров из категории "${categoryName}"...`);
        
        // Получаем только скрытые товары
        const hiddenItems = await prisma.allianceShopItem.findMany({
            where: { 
                id_shop: categoryId,
                hidden: true
            }
        });
        
        if (hiddenItems.length === 0) {
            await context.send(`ℹ️ В категории "${categoryName}" нет скрытых товаров для миграции.`);
            return true;
        }
        
        let totalInventories = 0;
        let migratedCount = 0;
        let failedCount = 0;
        let processedItems = 0;
        const totalItems = hiddenItems.length;
        const progressStep = Math.max(1, Math.floor(totalItems / 10));
        
        for (const item of hiddenItems) {
            processedItems++;
            
            if (processedItems % progressStep === 0 || processedItems === totalItems) {
                const percent = Math.round((processedItems / totalItems) * 100);
                await context.send(`🔄 Обработка скрытых: ${processedItems}/${totalItems} (${percent}%)...`);
            }
            
            try {
                const inventories = await prisma.inventory.findMany({
                    where: { 
                        id_item: item.id,
                        type: InventoryType.ITEM_SHOP_ALLIANCE
                    },
                    include: {
                        ChestItemLink: true
                    }
                });
                
                totalInventories += inventories.length;
                
                for (const inventory of inventories) {
                    try {
                        if (inventory.ChestItemLink) {
                            await prisma.chestItemLink.update({
                                where: { id: inventory.ChestItemLink.id },
                                data: { id_chest: newChestId }
                            });
                        } else {
                            await prisma.chestItemLink.create({
                                data: {
                                    id_chest: newChestId,
                                    id_inventory: inventory.id
                                }
                            });
                        }
                        migratedCount++;
                    } catch (error) {
                        console.error(`Error migrating hidden inventory ${inventory.id}:`, error);
                        failedCount++;
                    }
                }
                
                if (inventories.length > 50) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
            } catch (error) {
                console.error(`Error processing hidden item ${item.id}:`, error);
                failedCount++;
            }
        }
        
        const resultMessage = `✅ Миграция скрытых товаров завершена!\n\n` +
            `📁 Категория: "${categoryName}"\n` +
            `📦 Сундук: "${chestName}"\n` +
            `👁 Режим: Только скрытые товары\n` +
            `🛒 Обработано скрытых товаров: ${hiddenItems.length}\n` +
            `🧳 Инвентарных записей: ${totalInventories}\n` +
            `🔄 Успешно перенесено: ${migratedCount}\n` +
            `❌ Ошибок: ${failedCount}`;
        
        await context.send(resultMessage);
        
        return failedCount === 0;
        
    } catch (error: any) {
        console.error('Error in migrateHiddenItems:', error);
        await context.send(`❌ Ошибка при миграции скрытых товаров: ${error.message}`);
        return false;
    }
}

// ===================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====================

async function getChestInventoryItems(userId: number, chestId: number, group_mode: boolean): Promise<InventoryDisplayItem[]> {
    ////console.log(`DEBUG getChestInventoryItems: userId=${userId}, chestId=${chestId}, group_mode=${group_mode}`);
    
    // Получаем пользователя, чтобы узнать его альянс
    const user = await prisma.user.findFirst({ 
        where: { id: userId } 
    });
    
    if (!user) {
        //console.log(`DEBUG: User ${userId} not found`);
        return [];
    }
    
    // Получаем сундук
    const chest = await prisma.allianceChest.findFirst({
        where: { 
            id: chestId,
            id_alliance: user.id_alliance || 0
        },
        include: {
            Parent: true
        }
    });
    
    if (!chest) {
        //console.log(`DEBUG: Chest ${chestId} not found in alliance ${user.id_alliance}`);
        return [];
    }
    
    //console.log(`DEBUG: Using chestId=${chestId} for chest "${chest.name}"`);
    
    // ИСПРАВЛЕННЫЙ ЗАПРОС: Получаем предметы с проверкой привязки к сундуку
    const inventoryItems = await prisma.inventory.findMany({
        where: { 
            id_user: userId,
            ChestItemLink: {
                is: {
                    id_chest: chestId
                }
            }
        }
    });
    
    //console.log(`DEBUG: Found ${inventoryItems.length} inventory items for user ${userId} in chest ${chestId}`);
    
    if (group_mode) {
        // Группируем предметы
        const grouped: {[key: string]: InventoryDisplayItem} = {};
        
        for (const inv of inventoryItems) {
            let itemInfo: any = null;
            
            if (inv.type === InventoryType.ITEM_SHOP_ALLIANCE) {
                itemInfo = await prisma.allianceShopItem.findFirst({ 
                    where: { id: inv.id_item } 
                });
            } else if (inv.type === InventoryType.ITEM_SHOP) {
                itemInfo = await prisma.item.findFirst({ 
                    where: { id: inv.id_item } 
                });
            } else if (inv.type === InventoryType.ITEM_STORAGE) {
                itemInfo = await prisma.itemStorage.findFirst({ 
                    where: { id: inv.id_item } 
                });
            }
            
            const key = `${inv.type}_${inv.id_item}`;
            
            if (!grouped[key]) {
                grouped[key] = {
                    id: inv.id_item,
                    name: itemInfo?.name || 'Неизвестный предмет',
                    count: 1,
                    type: inv.type,
                    image: itemInfo?.image || undefined,
                    description: itemInfo?.description || undefined,
                    price: itemInfo?.price || undefined,
                    inventory_ids: [inv.id],
                    chest_id: chestId
                };
            } else {
                grouped[key].count++;
                grouped[key].inventory_ids.push(inv.id);
            }
        }
        
        return Object.values(grouped);
    } else {
        // Поштучный режим
        const items: InventoryDisplayItem[] = [];
        
        for (const inv of inventoryItems) {
            let itemInfo: any = null;
            
            if (inv.type === InventoryType.ITEM_SHOP_ALLIANCE) {
                itemInfo = await prisma.allianceShopItem.findFirst({ 
                    where: { id: inv.id_item } 
                });
            } else if (inv.type === InventoryType.ITEM_SHOP) {
                itemInfo = await prisma.item.findFirst({ 
                    where: { id: inv.id_item } 
                });
            } else if (inv.type === InventoryType.ITEM_STORAGE) {
                itemInfo = await prisma.itemStorage.findFirst({ 
                    where: { id: inv.id_item } 
                });
            }
            
            items.push({
                id: inv.id,
                name: itemInfo?.name || 'Неизвестный предмет',
                count: 1,
                type: inv.type,
                image: itemInfo?.image || undefined,
                description: itemInfo?.description || undefined,
                price: itemInfo?.price || undefined,
                inventory_ids: [inv.id],
                chest_id: chestId
            });
        }
        
        return items;
    }
}
async function findRecipientChest(recipientId: number, itemChestId: number, senderAllianceId: number): Promise<number> {
    //console.log(`DEBUG findRecipientChest: recipientId=${recipientId}, itemChestId=${itemChestId}, senderAllianceId=${senderAllianceId}`);
    
    // Получаем информацию о получателе
    const recipient = await prisma.user.findFirst({ 
        where: { id: recipientId },
        select: { id_alliance: true, name: true }
    });
    
    console.log(`DEBUG: Recipient ${recipient?.name} has alliance: ${recipient?.id_alliance}`);
    
    // Получаем информацию об исходном сундуке (откуда берут предмет)
    let originalChest = null;
    if (itemChestId) {
        originalChest = await prisma.allianceChest.findFirst({
            where: { id: itemChestId }
        });
        console.log(`DEBUG: Original chest ID ${itemChestId} belongs to alliance: ${originalChest?.id_alliance}, name: "${originalChest?.name}"`);
    }
    
    // Определяем, какой альянс использовать для поиска сундука
    // Приоритет: 1) Альянс исходного сундука, 2) Альянс получателя, 3) Альянс отправителя
    const allianceIdToUse = originalChest?.id_alliance || recipient?.id_alliance || senderAllianceId;
    console.log(`DEBUG: Using alliance ID for search: ${allianceIdToUse} (from: ${originalChest ? 'chest' : recipient ? 'recipient' : 'sender'})`);
    
    // Если получатель в том же альянсе, что и сундук - ищем сундук с таким же ID
    if (recipient?.id_alliance === allianceIdToUse && itemChestId) {
        console.log(`DEBUG: Checking if same chest exists in alliance ${allianceIdToUse}`);
        
        const sameChest = await prisma.allianceChest.findFirst({
            where: { 
                id: itemChestId,
                id_alliance: allianceIdToUse
            }
        });
        
        if (sameChest) {
            console.log(`DEBUG: Found same chest ID ${itemChestId} in alliance ${allianceIdToUse}: "${sameChest.name}"`);
            return itemChestId;
        } else {
            console.log(`DEBUG: Chest ID ${itemChestId} not found in alliance ${allianceIdToUse}`);
        }
    }
    
    // Если нет такого же сундука, ищем сундук с таким же названием в альянсе получателя
    if (originalChest && recipient?.id_alliance === allianceIdToUse) {
        console.log(`DEBUG: Looking for chest with same name "${originalChest.name}" in alliance ${allianceIdToUse}`);
        
        const sameNameChest = await prisma.allianceChest.findFirst({
            where: { 
                name: originalChest.name,
                id_alliance: allianceIdToUse
            }
        });
        
        if (sameNameChest) {
            console.log(`DEBUG: Found chest with same name "${originalChest.name}" (ID: ${sameNameChest.id}) in alliance ${allianceIdToUse}`);
            return sameNameChest.id;
        } else {
            console.log(`DEBUG: No chest with name "${originalChest.name}" in alliance ${allianceIdToUse}`);
        }
    }
    
    // Если нет сундука с таким же названием, ищем "Основное" в нужном альянсе
    console.log(`DEBUG: Looking for "Основное" in alliance ${allianceIdToUse}`);
    const mainChest = await prisma.allianceChest.findFirst({
        where: { 
            name: "Основное",
            id_alliance: allianceIdToUse
        }
    });
    
    if (mainChest) {
        console.log(`DEBUG: Found "Основное" (ID: ${mainChest.id}) in alliance ${allianceIdToUse}`);
        return mainChest.id;
    }
    
    // Если "Основное" не найдено, создаем его
    console.log(`DEBUG: "Основное" not found, creating new one for alliance ${allianceIdToUse}`);
    const newMainChest = await prisma.allianceChest.create({
        data: {
            name: "Основное",
            id_alliance: allianceIdToUse,
            id_parent: null,
            order: 0
        }
    });
    
    console.log(`DEBUG: Created new "Основное" with ID: ${newMainChest.id} for alliance ${allianceIdToUse}`);
    return newMainChest.id;
}

// Обработчики команд
async function handleItemSelect(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const inv = await prisma.inventory.findFirst({
        where: { id: data.id }
    });
    
    if (!inv) {
        await context.send(`❌ Предмет не найден.`);
        return { cursor: data.cursor, group_mode: data.group_mode };
    }
    
    let item = null;
    let text = '';
    
    if (inv.type == InventoryType.ITEM_SHOP_ALLIANCE) {
        item = await prisma.allianceShopItem.findFirst({ where: { id: inv.id_item } })
        text = `🛍 Предмет: ${item?.name}\n🧾 ID: ${item?.id}\n📜 Описание: ${item?.description || 'Нет описания'}\n💰 Стоимость: ${item?.price}\n📦 Версия: ${item?.limit_tr ? `ограниченное издание` : '∞ Безлимит'}\n🧲 Где куплено: в Ролевом магазине\n💬 Комментарий: ${inv.comment}\n📦 Сундук: ${chest?.name || 'Неизвестно'}`;
    } else if (inv.type == InventoryType.ITEM_STORAGE) {
        item = await prisma.itemStorage.findFirst({ where: { id: inv.id_item } })
        text = `🛍 Предмет: ${item?.name}\n🧾 ID: ${item?.id}\n📜 Описание: ${item?.description || 'Нет описания'}\n🧲 Как получено: Артефакт\n💬 Комментарий: ${inv.comment}\n📦 Сундук: ${chest?.name || 'Неизвестно'}`;
    } else if (inv.type == InventoryType.ITEM_SHOP) {
        item = await prisma.item.findFirst({ where: { id: inv.id_item } })
        text = `🛍 Предмет: ${item?.name}\n🧾 ID: ${item?.id}\n📜 Описание: ${item?.description || 'Нет описания'}\n💰 Стоимость: ${item?.price}\n🧲 Где куплено: в Маголавке\n📦 Сундук: ${chest?.name || 'Неизвестно'}`;
    }
    
    await Send_Message(context.peerId, text);
    
    return { cursor: data.cursor, group_mode: data.group_mode };
}

async function handleGroupItemSelect(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    // Получаем информацию о группе
    const items = await getChestInventoryItems(user.id, data.chest_id, true);
    const group = items.find(item => item.id === data.id && item.type.includes(data.type));
    
    if (!group) {
        await context.send(`❌ Группа предметов не найдена.`);
        return { cursor: data.cursor, group_mode: data.group_mode };
    }
    
    let text = '';
    if (group.type.includes('ITEM_SHOP_ALLIANCE')) {
        text = `🛍 Предмет: ${group.name}\n🧾 Количество: ${group.count}\n📜 Описание: ${group.description || 'Нет описания'}\n💰 Стоимость: ${group.price || 'N/A'}\n🧲 Где куплено: в Ролевом магазине\n📦 Сундук: ${chest?.name || 'Неизвестно'}`;
    } else if (group.type.includes('ITEM_STORAGE')) {
        text = `🛍 Предмет: ${group.name}\n🧾 Количество: ${group.count}\n📜 Описание: ${group.description || 'Нет описания'}\n🧲 Как получено: Артефакт\n📦 Сундук: ${chest?.name || 'Неизвестно'}`;
    } else if (group.type.includes('ITEM_SHOP')) {
        text = `🛍 Предмет: ${group.name}\n🧾 Количество: ${group.count}\n📜 Описание: ${group.description || 'Нет описания'}\n💰 Стоимость: ${group.price || 'N/A'}\n🧲 Где куплено: в Маголавке\n📦 Сундук: ${chest?.name || 'Неизвестно'}`;
    }
    
    await Send_Message(context.peerId, text);
    
    return { cursor: data.cursor, group_mode: data.group_mode };
}

async function handleItemPresent(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { cursor: data.cursor, group_mode: data.group_mode };
    const inv = await prisma.inventory.findFirst({
        where: { id: data.id }
    });
    
    if (!inv) {
        await context.send(`❌ Предмет не найден.`);
        return res;
    }
    
    // Получаем информацию о предмете
    let itemInfo: any = null;
    let itemName = 'Неизвестный предмет';
    
    if (inv.type == InventoryType.ITEM_SHOP_ALLIANCE) {
        itemInfo = await prisma.allianceShopItem.findFirst({ where: { id: inv.id_item } });
        itemName = itemInfo?.name || 'Предмет магазина';
    } else if (inv.type == InventoryType.ITEM_STORAGE) {
        itemInfo = await prisma.itemStorage.findFirst({ where: { id: inv.id_item } });
        itemName = itemInfo?.name || 'Артефакт';
    } else if (inv.type == InventoryType.ITEM_SHOP) {
        itemInfo = await prisma.item.findFirst({ where: { id: inv.id_item } });
        itemName = itemInfo?.name || 'Предмет магазина';
    }
    
    // Обновляем текст подтверждения
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(
        context, 
        `подарить кому-то "${itemName}" ${user_adm ? `из инвентаря ${user.name}` : 'из своего инвентаря'}?`
    );
    
    if (!confirm.status) return res;
    
    // Получаем UID получателя
    const person_goten = await Input_Number(
        context, 
        `Введите UID персонажа, которому будет подарен предмет "${itemName}":`, 
        true
    );
    
    if (!person_goten) { 
        await context.send(`❌ Получатель не указан.`); 
        return res; 
    }
    
    if (person_goten == user.id) { 
        await context.send(`❌ Нельзя дарить предметы самому себе!`); 
        return res;
    }
    
    const recipient = await prisma.user.findFirst({ where: { id: person_goten } });
    if (!recipient) { 
        await context.send(`❌ Персонаж с UID ${person_goten} не найден!`); 
        return res; 
    }
    
    // Запрос комментария
    let comment = "";
    const want_comment = await context.question(
        `💬 Хотите добавить комментарий к подарку?`,
        {
            keyboard: Keyboard.builder()
                .textButton({ label: '✅ Да', payload: { command: 'add_comment' }, color: 'positive' })
                .textButton({ label: '❌ Нет', payload: { command: 'no_comment' }, color: 'negative' })
                .oneTime().inline(),
            answerTimeLimit
        }
    );
    
    if (want_comment.isTimeout) {
        await context.send(`⏰ Время ожидания истекло!`);
        return res;
    }
    
    if (want_comment.payload?.command === 'add_comment') {
        const comment_input = await context.question(
            `💬 Введите комментарий к подарку (максимум 200 символов):`,
            { answerTimeLimit }
        );
        
        if (comment_input.isTimeout) {
            await context.send(`⏰ Время ожидания истекло!`);
            return res;
        }
        
        if (comment_input.text && comment_input.text.length <= 200) {
            comment = comment_input.text;
        } else if (comment_input.text.length > 200) {
            await context.send(`⚠ Комментарий слишком длинный (${comment_input.text.length}/200). Комментарий не будет добавлен.`);
        }
    }
    
    // Финальное подтверждение
    let finalOwnerText = '';
    if (user_adm) {
        finalOwnerText = `из инвентаря ${user.name}`; // Админ работает с инвентарем другого игрока
    } else {
        finalOwnerText = `из своего инвентаря`; // Игрок работает со своим инвентарем
    }
    
    const final_confirm: { status: boolean, text: string } = await Confirm_User_Success(
        context, 
        `подарить "${itemName}" ${recipient.name} ${finalOwnerText}?${comment ? `\n💬 Комментарий: "${comment}"` : ''}`
    );
    
    if (!final_confirm.status) {
        await context.send(`❌ Дарение отменено.`);
        return res;
    }
    
    // Находим текущий сундук предмета
    const chestLink = await prisma.chestItemLink.findFirst({
        where: { id_inventory: inv.id }
    });
    
    // Находим подходящий сундук у получателя
    const recipientChestId = await findRecipientChest(
        recipient.id,
        chestLink?.id_chest || 0,
        recipient.id_alliance || 0
    );
    
    // Получаем информацию о сундуке получателя (для уведомления)
    const recipientChest = await prisma.allianceChest.findFirst({
        where: { id: recipientChestId }
    });
    
    // Обновляем предмет в инвентаре
    const item_update = await prisma.inventory.update({ 
        where: { id: inv.id }, 
        data: { 
            id_user: recipient.id,
            comment: comment ? `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}. Комментарий: ${comment}` 
                       : `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}`
        } 
    });
    
    if (!item_update) { 
        await context.send(`❌ Ошибка при передаче предмета.`);
        return res; 
    }
    
    // Обновляем связь с сундуком
    if (chestLink) {
        await prisma.chestItemLink.update({
            where: { id: chestLink.id },
            data: { id_chest: recipientChestId }
        });
    } else {
        // Создаем новую связь, если ее не было
        await prisma.chestItemLink.create({
            data: {
                id_chest: recipientChestId,
                id_inventory: inv.id
            }
        });
    }
    
    // Отправляем уведомления
    const receiver_message = `🎁 Вам подарен предмет от @id${user.idvk}(${user.name}) (UID: ${user.id})!\n\n` +
        `🎯 Получено персонажем: ${recipient.name} (UID: ${recipient.id})\n` +
        `📦 Предмет: ${itemName}\n` +
        `${comment ? `💬 Комментарий: "${comment}"\n` : ''}` +
        `📁 Предмет находится в сундуке: ${recipientChest?.name || 'Основное'}`;
    
    await Send_Message(recipient.idvk, receiver_message);
    
    // Логирование в чат альянса
    const logChatId = await getLogChatForMassPresent(user, recipient);
    if (logChatId !== null) {
        const log_message = `🎁 Передача товара "${itemName}" от игрока @id${user.idvk}(${user.name}) (UID: ${user.id}) игроку @id${recipient.idvk}(${recipient.name}) (UID: ${recipient.id})${comment ? `\n💬 Комментарий: "${comment}"` : ''}\n` +
            `📁 Из сундука: ${chest?.name || 'Основное'}\n` +
            `📁 В сундук: ${recipientChest?.name || 'Основное'}`;
        
        await Send_Message(logChatId, log_message);
    }
    
    // Уведомление для админа (если это админ операция)
    if (user_adm) {
        const admin_message = 
            `🎁 Передача товара "${itemName}" от игрока ${user.name} (UID: ${user.id}) игроку ${recipient.name}\ (UID: ${recipient.id})n` +
            `📁 Из сундука: ${chest?.name || 'Основное'}\n` +
            `📁 В сундук: ${recipientChest?.name || 'Основное'}`;
        
        await Send_Message(user_adm.idvk, admin_message);
    }
    
    return res;
}

async function handleGroupItemPresent(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { cursor: data.cursor, group_mode: data.group_mode };
    
    // Получаем информацию о группе
    const items = await getChestInventoryItems(user.id, data.currentChestId || chest.id, true);
    const group = items.find(item => item.id === data.id && item.type.includes(data.type));
    
    if (!group) {
        await context.send(`❌ Группа предметов не найдена.`);
        return res;
    }

    // Обновляем текст подтверждения
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(
        context, 
        `подарить ${group.count} предметов "${group.name}" ${user_adm ? `из инвентаря ${user.name}` : 'из своего инвентаря'}?`
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
    
    const recipient = await prisma.user.findFirst({ where: { id: person_goten } });
    if (!recipient) { 
        await context.send(`❌ Персонаж с UID ${person_goten} не найден!`); 
        return res; 
    }

    // Запрос комментария для группы предметов
    let comment = "";
    const want_comment = await context.question(
        `💬 Хотите добавить комментарий к подарку?`,
        {
            keyboard: Keyboard.builder()
                .textButton({ label: '✅ Да', payload: { command: 'add_comment' }, color: 'positive' })
                .textButton({ label: '❌ Нет', payload: { command: 'no_comment' }, color: 'negative' })
                .oneTime().inline(),
            answerTimeLimit
        }
    );
    
    if (want_comment.isTimeout) {
        await context.send(`⏰ Время ожидания истекло!`);
        return res;
    }
    
    if (want_comment.payload?.command === 'add_comment') {
        const comment_input = await context.question(
            `💬 Введите комментарий к подарку (максимум 200 символов):`,
            { answerTimeLimit }
        );
        
        if (comment_input.isTimeout) {
            await context.send(`⏰ Время ожидания истекло!`);
            return res;
        }
        
        if (comment_input.text && comment_input.text.length <= 200) {
            comment = comment_input.text;
        } else if (comment_input.text.length > 200) {
            await context.send(`⚠ Комментарий слишком длинный (${comment_input.text.length}/200). Комментарий не будет добавлен.`);
        }
    }

    // Подтверждение финальное
    let finalOwnerText = '';
    if (user_adm) {
        finalOwnerText = `из инвентаря ${user.name}`; // Админ работает с инвентарем другого игрока
    } else {
        finalOwnerText = `из своего инвентаря`; // Игрок работает со своим инвентарем
    }

    const final_confirm: { status: boolean, text: string } = await Confirm_User_Success(
        context, 
        `подарить ${group.count} предметов "${group.name}" игроку ${recipient.name} ${finalOwnerText}?${comment ? `\n💬 Комментарий: "${comment}"` : ''}`
    );

    // Выполняем дарение всех предметов группы
    let success_count = 0;
    let failed_count = 0;
    let finalRecipientChestId: number | null = null;
    let finalRecipientChestName = 'Основное';

    for (const inventory_id of group.inventory_ids) {
        try {
            // Находим исходную связь с сундуком
            const chestLink = await prisma.chestItemLink.findFirst({
                where: { id_inventory: inventory_id }
            });
            
            // Находим подходящий сундук у получателя
            const recipientChestId = await findRecipientChest(
                recipient.id,
                chestLink?.id_chest || 0,
                chest?.id_alliance || user.id_alliance || 0
            );
            
            // Сохраняем ID сундука получателя
            finalRecipientChestId = recipientChestId;

            const updated_item = await prisma.inventory.update({
                where: { id: inventory_id },
                data: { 
                    id_user: recipient.id,
                    comment: comment ? `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}. Комментарий: ${comment}` 
                               : `Подарок от ${user.name}${user_adm ? ` (через ${user_adm.name})` : ''}`
                }
            });

            if (updated_item) {
                success_count++;
                
                // Обновляем связь
                if (chestLink) {
                    await prisma.chestItemLink.update({
                        where: { id: chestLink.id },
                        data: { id_chest: recipientChestId }
                    });
                } else {
                    await prisma.chestItemLink.create({
                        data: {
                            id_chest: recipientChestId,
                            id_inventory: inventory_id
                        }
                    });
                }
            } else {
                failed_count++;
            }
        } catch (error) {
            await context.send(`⚠ Ошибка при передаче предмета ID ${inventory_id}`);
            failed_count++;
        }
    }

    // Получаем информацию о сундуке получателя
    if (finalRecipientChestId) {
        const recipientChestInfo = await prisma.allianceChest.findFirst({
            where: { id: finalRecipientChestId }
        });
        if (recipientChestInfo) {
            finalRecipientChestName = recipientChestInfo.name;
        }
    }

    // Отправляем уведомления
    const result_message = `🎁 Дарение группы предметов завершено!\n\n✅ Успешно передано: ${success_count} предметов\n❌ Не удалось передать: ${failed_count} предметов\n\n📦 Получатель: ${recipient.name} (UID: ${recipient.id})\n🎯 Предмет: ${group.name} × ${success_count}${comment ? `\n💬 Комментарий: "${comment}"` : ''}\n📁 Из сундука: ${chest?.name || 'Основное'}`;

    await context.send(result_message);

    // Уведомление получателю (ОДНО сообщение)
    const receiver_message = `🎁 Вам подарены предметы от @id${user.idvk}(${user.name}) (UID: ${user.id})!\n\n` +
        `🎯 Получено персонажем: ${recipient.name} (UID: ${recipient.id})\n\n` +
        `Было передано ${success_count} предметов: ${group.name} × ${success_count}\n` +
        `${comment ? `💬 Комментарий: "${comment}"\n` : ''}` +
        `📁 Предметы находятся в сундуке: ${finalRecipientChestName}`;

    await Send_Message(recipient.idvk, receiver_message);

    // Логирование в чат альянса
    const logChatId = await getLogChatForMassPresent(user, recipient);
    if (logChatId !== null) {
        const log_message = `🎁 Дарение группы предметов\n\n` +
            `👤 Отправитель: @id${user.idvk}(${user.name}) (UID: ${user.id})\n` +
            `🎯 Получатель: @id${recipient.idvk}(${recipient.name}) (UID: ${recipient.id})\n` +
            `📦 Передано предметов: ${success_count}\n` +
            `🎯 Предмет: ${group.name} × ${success_count}${comment ? `\n💬 Комментарий: "${comment}"` : ''}\n` +
            `📁 Из сундука: ${chest?.name || 'Основное'}\n` +
            `📁 В сундук: ${finalRecipientChestName}`;
        
        await Send_Message(logChatId, log_message);
    }

    // Уведомление для админа (если это админ операция)
    if (user_adm) {
        const admin_message =
            `🎁 Передача товаров (${success_count} шт.) от игрока ${user.name} (UID: ${user.id}) игроку ${recipient.name} (UID: ${recipient.id})\n` +
            `📁 Из сундука: ${chest?.name || 'Основное'}\n` +
            `📁 В сундук: ${finalRecipientChestName}`;
        
        await Send_Message(user_adm.idvk, admin_message);
    }

    return res;
}

// ===================== МАССОВОЕ ДАРЕНИЕ С ОБНОВЛЕНИЕМ СУНДУКОВ =====================

async function handleItemDelete(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { cursor: data.cursor, group_mode: data.group_mode };
    const inv = await prisma.inventory.findFirst({
        where: { id: data.id },
    });
    
    if (!inv) {
        await context.send(`❌ Предмет не найден.`);
        return res;
    }
    
    let item: any = null;
    let itemName = 'Неизвестный предмет';
    
    if (inv.type == InventoryType.ITEM_SHOP_ALLIANCE) {
        item = await prisma.allianceShopItem.findFirst({ where: { id: inv.id_item } });
        itemName = item?.name || 'Предмет магазина альянса';
    } else if (inv.type == InventoryType.ITEM_SHOP) {
        item = await prisma.item.findFirst({ where: { id: inv.id_item } });
        itemName = item?.name || 'Предмет магазина';
    } else if (inv.type == InventoryType.ITEM_STORAGE) {
        item = await prisma.itemStorage.findFirst({ where: { id: inv.id_item } });
        itemName = item?.name || 'Артефакт';
    } else {
        await context.send(`❌ Неизвестный тип предмета: ${inv.type}`);
        return res;
    }

    // Обновляем текст подтверждения
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(
        context, 
        `удалить "${itemName}" ${user_adm ? `из инвентаря ${user.name}` : 'из своего инвентаря'}?`
    );

    if (!confirm.status) return res;
    
    // Удаляем связь с сундуком (если есть)
    await prisma.chestItemLink.deleteMany({
        where: { id_inventory: inv.id }
    });
    
    // Удаляем сам предмет
    const deleted = await prisma.inventory.delete({
        where: { id: inv.id }
    });

    if (deleted) {
        // Обновляем логирование
        if (user_adm) {
            await Logger(`Администратор @id${user_adm.idvk}(${user_adm.name}) удаляет "${deleted.id}-${itemName}" из инвентаря ${user.name} (UID: ${user.id})`);
            await context.send(`Вы удалили "${deleted.id}-${itemName}" из инвентаря ${user.name}.`);
            
            await Send_Message(
                user.idvk, 
                `🎒 Администратор ${user_adm.name} удалил "${deleted.id}-${itemName}" из вашего инвентаря.`
            );
            await Send_Message(
                chat_id, 
                `🎒 @id${user_adm.idvk}(${user_adm.name}) удаляет "${deleted.id}-${itemName}" из инвентаря для клиента @id${user.idvk}(${user.name}) (UID: ${user.id})`
            );
        } else { 
            await Logger(`Игрок @id${user.idvk}(${user.name}) удаляет "${deleted.id}-${itemName}" из своего инвентаря`);
            await context.send(`Вы удалили "${deleted.id}-${itemName}" из своего инвентаря.`);
            await Send_Message(
                chat_id, 
                `🎒 @id${user.idvk}(${user.name}) (UID: ${user.id}) удаляет "${deleted.id}-${itemName}" из своего инвентаря`
            );
        }
    }

    return res;
}

async function handleGroupItemDelete(context: any, data: any, user: User, user_adm?: User, chest?: any) {
    const res = { cursor: data.cursor, group_mode: data.group_mode };
    
    // Получаем информацию о группе
    const items = await getChestInventoryItems(user.id, data.chest_id, true);
    const group = items.find(item => item.id === data.id && item.type.includes(data.type));
    
    if (!group) {
        await context.send(`❌ Группа предметов не найдена.`);
        return res;
    }

    // Обновляем текст подтверждения
    const confirm: { status: boolean, text: string } = await Confirm_User_Success(
        context, 
        `удалить ${group.count} предметов "${group.name}" ${user_adm ? `из инвентаря ${user.name}` : 'из своего инвентаря'}?`
    );
    
    if (!confirm.status) return res;

    // Выполняем удаление всех предметов группы
    let success_count = 0;
    let failed_count = 0;

    for (const inventory_id of group.inventory_ids) {
        try {
            // Удаляем связь с сундуком
            await prisma.chestItemLink.deleteMany({
                where: { id_inventory: inventory_id }
            });
            
            // Удаляем предмет
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

    // Логируем и уведомляем с информацией о владельце
    if (success_count > 0) {
        if (user_adm) {
            await Logger(`Администратор @id${user_adm.idvk}(${user_adm.name}) удаляет "${group.name} × ${success_count}" из инвентаря ${user.name} (UID: ${user.id})`);
            await context.send(`Вы удалили "${group.name} × ${success_count}" из инвентаря ${user.name}.`);
            
            await Send_Message(user.idvk, `🎒 Администратор ${user_adm.name} удалил "${group.name} × ${success_count}" из вашего инвентаря.`);
            await Send_Message(chat_id, `🎒 @id${user_adm.idvk}(${user_adm.name}) удаляет "${group.name} × ${success_count}" из инвентаря для клиента @id${user.idvk}(${user.name}) (UID: ${user.id})`);
        } else { 
            await Logger(`Игрок @id${user.idvk}(${user.name}) удаляет "${group.name} × ${success_count}" из своего инвентаря`);
            await context.send(`Вы удалили "${group.name} × ${success_count}" из своего инвентаря.`);
            await Send_Message(chat_id, `🎒 @id${user.idvk}(${user.name}) (UID: ${user.id}) удаляет "${group.name} × ${success_count}" из своего инвентаря`);
        }
    }

    await context.send(`🗑 Удаление завершено:\n✅ Успешно удалено: ${success_count} предметов\n❌ Не удалось удалить: ${failed_count} предметов`);

    return res;
}

function getOwnerInfo(user: User, user_adm?: User): string {
    if (user_adm) {
        return `Инвентарь ${user.name} (UID: ${user.id})`;
    }
    return 'Ваш инвентарь';
}

function getOwnerSuffix(user: User, user_adm?: User): string {
    if (user_adm) {
        return ` (инвентарь ${user.name}) (UID: ${user.id})`;
    }
    return '';
}