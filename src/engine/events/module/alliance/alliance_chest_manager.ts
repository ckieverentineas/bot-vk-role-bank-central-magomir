import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit } from "../../../..";
import { 
    Input_Text, 
    Input_Number,
    Send_Message_Question, 
    Send_Message_Smart,
    Confirm_User_Success,
    Carusel_Selector 
} from "../../../core/helper";
import { Person_Get } from "../person/person";
import { Accessed } from "../../../core/helper";
import { ico_list } from "../data_center/icons_lib";

// Главная точка входа
export async function AllianceChest_Manager(context: any) {
    const user = await Person_Get(context);
    if (!user || !user.id_alliance) {
        await context.send("❌ Вы не состоите в ролевом проекте.");
        return;
    }
    
    if (await Accessed(context) === 1) {
        await context.send("❌ У вас нет прав администратора.");
        return;
    }
    
    await showMainChestMenu(context, user.id_alliance, user);
}

// ===================== ОСНОВНЫЕ ФУНКЦИИ =====================

// Главное меню сундуков
async function showMainChestMenu(context: any, allianceId: number, user: any, cursor: number = 0) {
    const LIMIT = 2;
    
    const chests = await prisma.allianceChest.findMany({
        where: { id_alliance: allianceId },
        orderBy: [{ id_parent: 'asc' }, { order: 'asc' }]
    });
    
    const mainChests = chests.filter(c => c.id_parent === null);
    
    // ПЕРЕСОРТИРОВКА: Сначала "Основное", потом остальные по алфавиту
    const sortedChests = mainChests.sort((a, b) => {
        if (a.name === "Основное") return -1;
        if (b.name === "Основное") return 1;
        return a.name.localeCompare(b.name);
    });
    
    const totalChests = sortedChests.length;
    const pageChests = sortedChests.slice(cursor, cursor + LIMIT);
    
    let text = `🌐 Меню управления сундуками\n\n`;
    
    if (mainChests.length === 0) {
        text += "📭 Нет созданных сундуков.\nСоздайте свой первый сундук!\n\n";
    } else {
        for (let i = 0; i < pageChests.length; i++) {
            const chest = pageChests[i];
            const childCount = chests.filter(c => c.id_parent === chest.id).length;
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
            
            text += `${chest.name === "Основное" ? '🔘' : '🎒'} [${chest.id}] ${chest.name} ${stats}\n`;
        }
        
        text += `\n${Math.floor(cursor / LIMIT) + 1} из ${Math.ceil(totalChests / LIMIT)}`;
    }
    
    // ОПТИМИЗИРОВАННАЯ КЛАВИАТУРА (максимум 10 кнопок)
    const keyboard = new KeyboardBuilder();
    
    // 1. Кнопки сундуков
    for (const chest of pageChests) {
        // Укорачиваем название для кнопки
        const displayName = chest.name.length > 10 ? 
            chest.name.slice(0, 7) + '...' : chest.name;
        
        // Для "Основное" показываем ТОЛЬКО кнопку выбора, без кнопок действий
        if (chest.name === "Основное") {
            // Только кнопка выбора, занимет всю строку
            const label = `🔘 ${displayName}`;
            keyboard.textButton({ 
                label: label, 
                payload: { command: 'chest_select', id: chest.id }, 
                color: 'secondary' 
            }).row();
        } else {
            // Для остальных сундуков: кнопка выбора + кнопки действий
            // Кнопка выбора сундука
            keyboard.textButton({ 
                label: `🎒 ${displayName}`, 
                payload: { command: 'chest_select', id: chest.id }, 
                color: 'secondary' 
            });
            
            // Кнопки действий (для НЕ "Основное" сундуков)
            keyboard.textButton({ 
                label: `✏`, 
                payload: { command: 'chest_rename', id: chest.id }, 
                color: 'secondary' 
            });
            keyboard.textButton({ 
                label: `⛔`, 
                payload: { command: 'chest_delete', id: chest.id }, 
                color: 'negative' 
            });
            keyboard.row(); // Переход на новую строку после всех кнопок предмета
        }
    }
    
    // 2. Навигация
    if (cursor > 0) {
        keyboard.textButton({ 
            label: `←`, 
            payload: { command: 'chest_prev', cursor: cursor - LIMIT }, 
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
    
    if (cursor > 0 || cursor + LIMIT < totalChests) {
        keyboard.row(); // Новая строка для кнопки создания
    }
    
    // 3. Кнопка создания
    keyboard.textButton({ 
        label: `➕ Создать сундук`, 
        payload: { command: 'chest_create' }, 
        color: 'positive' 
    });
    
    // Отправляем сообщение
    try {
        const response = await Send_Message_Question(
            context, 
            text, 
            keyboard.oneTime().inline()
        );
        
        if (response.exit) return;
        
        // Обработка команд...
        const commands: any = {
            'chest_select': handleChestSelect,
            'chest_rename': handleChestRename,
            'chest_delete': handleChestDelete,
            'chest_create': handleChestCreate,
            'chest_prev': handleChestPrev,
            'chest_next': handleChestNext,
            'noop': () => ({ cursor: cursor }), // Пустая команда
            'chest_exit': () => ({ stop: true })
        };
        
        if (response.payload && response.payload.command in commands) {
            const result = await commands[response.payload.command](context, response.payload, allianceId, user, cursor);
            if (result?.stop) return;
            if (result?.cursor !== undefined) {
                await showMainChestMenu(context, allianceId, user, result.cursor);
            }
        }
    } catch (error: any) {
        console.error("Ошибка клавиатуры:", error);
        await context.send("⚠ Произошла ошибка с клавиатурой. Упрощаем интерфейс...");
        
        // Упрощенная клавиатура в случае ошибки
        const simpleKeyboard = new KeyboardBuilder()
            .textButton({ label: '← Назад', payload: { command: 'chest_prev', cursor: Math.max(0, cursor - LIMIT) }, color: 'secondary' })
            .textButton({ label: '→ Вперед', payload: { command: 'chest_next', cursor: cursor + LIMIT }, color: 'secondary' })
            .row()
            .textButton({ label: '➕ Создать', payload: { command: 'chest_create' }, color: 'positive' })
            .oneTime().inline();
            
        await Send_Message_Question(context, text, simpleKeyboard);
    }
}

// 2. Выбор сундука → показываем сундучки внутри
async function handleChestSelect(context: any, data: any, allianceId: number, user: any, currentCursor: number) {
    const chestId = data.id;
    await showChildChestMenu(context, allianceId, chestId, user, 0);
    return { cursor: currentCursor }; // Возвращаемся на ту же позицию
}

// 3. Меню сундучков внутри сундука
async function showChildChestMenu(context: any, allianceId: number, parentChestId: number, user: any, cursor: number = 0) {
    const LIMIT = 1;
    
    const childChests = await prisma.allianceChest.findMany({
        where: { 
            id_alliance: allianceId,
            id_parent: parentChestId 
        },
        orderBy: { order: 'asc' }
    });
    
    const parentChest = await prisma.allianceChest.findFirst({
        where: { id: parentChestId }
    });
    
    // Если родительский сундук "Основное", не показываем меню сундучков
    if (parentChest?.name === "Основное") {
        await context.send("📦 В сундуке 'Основное' нет сундучков для управления.\nПредметы автоматически попадают в этот сундук.");
        return { back: true };
    }
    
    const totalChildren = childChests.length;
    const pageChildren = childChests.slice(cursor, cursor + LIMIT);
    
    let text = `📦 Управление сундучками внутри "${parentChest?.name}"\n\n`;
    
    if (childChests.length === 0) {
        text += "❌ В этом сундуке пока нет сундучков.\n\n";
    } else {
        for (let i = 0; i < pageChildren.length; i++) {
            const child = pageChildren[i];
            const itemCount = await prisma.chestItemLink.count({
                where: { 
                    id_chest: child.id,
                    inventory: {
                        id_user: user.id
                    }
                }
            });
            
            text += `🧳 [${child.id}] ${child.name} (${itemCount}📦)\n`;
        }
        text += `\n${Math.floor(cursor / LIMIT) + 1} из ${Math.ceil(totalChildren / LIMIT)}`;
    }
    
    // КЛАВИАТУРА ДЛЯ СУНДУЧКОВ
    const keyboard = new KeyboardBuilder();
    
    // 1. Кнопки сундучков
    for (const child of pageChildren) {
        // Укорачиваем название для кнопки
        const displayName = child.name.length > 10 ? 
            child.name.slice(0, 7) + '...' : child.name;
        
        // Создаем строку из 3 кнопок
        keyboard.textButton({ 
            label: `🧳 ${displayName}`, 
            payload: { command: 'child_select', id: child.id }, 
            color: 'secondary' 
        });
        
        keyboard.textButton({ 
            label: `✏`, 
            payload: { command: 'child_rename', id: child.id }, 
            color: 'secondary' 
        });
        
        keyboard.textButton({ 
            label: `⛔`, 
            payload: { command: 'child_delete', id: child.id }, 
            color: 'negative' 
        });
        
        keyboard.row();
    }
    
    // 2. Навигация
    if (cursor > 0) {
        keyboard.textButton({ label: '←', payload: { command: 'child_prev', cursor: cursor - LIMIT }, color: 'secondary' });
    }

    if (cursor + LIMIT < totalChildren) {
        keyboard.textButton({ label: '→', payload: { command: 'child_next', cursor: cursor + LIMIT }, color: 'secondary' });
    }

    if (cursor > 0 || cursor + LIMIT < totalChildren) {
        keyboard.row();
    }
    
    // 3. Действия
    keyboard.textButton({ 
        label: `➕ Создать сундучок`, 
        payload: { command: 'child_create', parent: parentChestId }, 
        color: 'positive' 
    });
    
    keyboard.textButton({ 
        label: `← К сундукам`, 
        payload: { command: 'child_back' }, 
        color: 'secondary' 
    })
    
    // Отправляем сообщение
    try {
        const response = await Send_Message_Question(
            context, 
            text, 
            keyboard.oneTime().inline()
        );
        
        if (response.exit) return { stop: true };
        
        // Обработка команд
        const commands: any = {
            'child_select': handleChildSelect,
            'child_rename': handleChildRename,
            'child_delete': handleChildDelete,
            'child_create': handleChildCreate,
            'child_prev': handleChildPrev,
            'child_next': handleChildNext,
            'child_back': () => ({ back: true })
        };
        
        if (response.payload && response.payload.command in commands) {
            const result = await commands[response.payload.command](context, response.payload, allianceId, parentChestId, user, cursor);
            
            if (result?.stop) return { stop: true };
            if (result?.back) return { back: true };
            if (result?.cursor !== undefined) {
                await showChildChestMenu(context, allianceId, parentChestId, user, result.cursor);
            }
        }
        
        return { back: true };
    } catch (error: any) {
        console.error("Ошибка клавиатуры для сундучков:", error);
        await context.send("⚠ Упрощаем интерфейс сундучков...");
        
        // Упрощенная версия
        const simpleKeyboard = new KeyboardBuilder()
            .textButton({ label: '←', payload: { command: 'child_prev', cursor: Math.max(0, cursor - LIMIT) }, color: 'secondary' })
            .textButton({ label: '→', payload: { command: 'child_next', cursor: cursor + LIMIT }, color: 'secondary' })
            .row()
            .textButton({ label: '➕ Создать', payload: { command: 'child_create', parent: parentChestId }, color: 'positive' })
            .textButton({ label: '← Назад', payload: { command: 'child_back' }, color: 'secondary' })
            .oneTime().inline();
            
        await Send_Message_Question(context, text, simpleKeyboard);
    }
}

// 4. Создание сундука
async function handleChestCreate(context: any, data: any, allianceId: number, user: any, currentCursor: number) {
    const name = await Input_Text(context, "➕ Создание нового сундука\n\n🧷 Введите название (до 40 символов):", 40);
    if (!name) return { cursor: currentCursor };
    
    // Проверяем, есть ли уже сундук с таким названием
    const existing = await prisma.allianceChest.findFirst({
        where: { 
            id_alliance: allianceId,
            name: name 
        }
    });
    
    if (existing) {
        await context.send(`❌ Сундук с названием "${name}" уже существует.`);
        return { cursor: currentCursor };
    }
    
    // Создаем сундук
    try {
        const newChest = await prisma.allianceChest.create({
            data: {
                name: name,
                id_alliance: allianceId,
                id_parent: null,
                order: 0
            }
        });
        
        await Send_Message_Smart(context, `Создан новый сундук: ${newChest.name} (ID: ${newChest.id})`, 'admin_solo');
    } catch (error) {
        await context.send(`❌ Ошибка при создании сундука: ${error}`);
    }
    
    // Возвращаемся в меню с обновленным списком
    await showMainChestMenu(context, allianceId, user, currentCursor);
    return { cursor: currentCursor };
}

// 5. Создание сундучка
async function handleChildCreate(context: any, data: any, allianceId: number, parentChestId: number, user: any, currentCursor: number) {
    const name = await Input_Text(context, "➕ Создание сундучка\n\n🧷 Введите название (до 40 символов):", 40);
    if (!name) return { cursor: currentCursor };
    
    // Проверяем, есть ли уже сундучок с таким названием в этом сундуке
    const existing = await prisma.allianceChest.findFirst({
        where: { 
            id_alliance: allianceId,
            id_parent: parentChestId,
            name: name 
        }
    });
    
    if (existing) {
        await context.send(`❌ Сундучок с названием "${name}" уже существует в этом сундуке.`);
        return { cursor: currentCursor };
    }
    
    // Создаем сундучок
    try {
        const newChild = await prisma.allianceChest.create({
            data: {
                name: name,
                id_alliance: allianceId,
                id_parent: parentChestId,
                order: 0
            }
        });
        
        await Send_Message_Smart(context, `Создан новый сундучок: ${newChild.name} (ID: ${newChild.id})`, 'admin_solo');
    } catch (error) {
        await context.send(`❌ Ошибка при создании сундучка: ${error}`);
    }
    
    // Возвращаемся в меню с обновленным списком
    await showChildChestMenu(context, allianceId, parentChestId, user, currentCursor);
    return { cursor: currentCursor };
}

// 6. Переименование сундука/сундучка
async function handleChestRename(context: any, data: any, allianceId: number, user: any, currentCursor: number) {
    const chestId = data.id;
    const chest = await prisma.allianceChest.findFirst({
        where: { id: chestId }
    });
    
    if (!chest) {
        await context.send("❌ Сундук не найден.");
        return { cursor: currentCursor };
    }
    
    const newName = await Input_Text(
        context, 
        `✏ Переименование сундука\n\nТекущее название: ${chest.name}\n🧷 Введите новое название (до 40 символов):`, 
        40
    );
    
    if (!newName) return { cursor: currentCursor };
    
    // Обновляем название
    await prisma.allianceChest.update({
        where: { id: chestId },
        data: { name: newName }
    });
    
    await Send_Message_Smart(context, `✅ Сундук переименован: ${chest.name} → ${newName}`, 'admin_solo');
    return { cursor: currentCursor };
}

// 7. Удаление сундука (с перемещением содержимого)
async function handleChestDelete(context: any, data: any, allianceId: number, user: any, currentCursor: number) {
    const chestId = data.id;
    
    // Получаем информацию о сундуке
    const chest = await prisma.allianceChest.findFirst({
        where: { id: chestId },
        include: {
            Children: true
        }
    });
    
    if (!chest) {
        await context.send("❌ Сундук не найден.");
        return { cursor: currentCursor };
    }
    
    // ЗАПРЕТ на удаление сундука "Основное"
    if (chest.name === "Основное") {
        await context.send("❌ Нельзя удалить сундук 'Основное'!");
        return { cursor: currentCursor };
    }
    
    // Считаем содержимое
    const itemCount = await prisma.chestItemLink.count({
        where: { 
            id_chest: chest.id,
            inventory: {
                id_user: user.id
            }
        }
    });
    
    let childItemCount = 0;
    for (const child of chest.Children) {
        const count = await prisma.chestItemLink.count({
            where: { 
                id_chest: child.id,
                inventory: {
                    id_user: user.id
                }
            }
        });
        childItemCount += count;
    }
    
    // Показываем диалог удаления
    let text = `⛔ Удаление сундука "${chest.name}"\n\n`;
    text += `📦 Содержимое:\n`;
    text += `• Товаров в сундуке: ${itemCount}\n`;
    text += `• Сундучков внутри: ${chest.Children.length}\n`;
    text += `• Товаров в сундучках: ${childItemCount}\n\n`;
    text += `Куда переместить всё содержимое?\n`;
    
    // Показываем все доступные сундуки (кроме удаляемого)
    const allChests = await prisma.allianceChest.findMany({
        where: { 
            id_alliance: allianceId,
            id: { not: chestId }
        },
        include: { Children: true }
    });
    
    // Формируем список
    const mainChest = await prisma.allianceChest.findFirst({
        where: { 
            name: "Основное",
            id_alliance: allianceId 
        }
    });

    if (mainChest) {
        text += `🔘 [${mainChest.id}] В "Основное"\n`;
    } else {
        text += `🔘 [0] В "Основное"\n`;
    }
    
    for (const targetChest of allChests) {
        if (targetChest.id_parent === null) { // Основные сундуки
            // Исключаем "Основное" из списка, так как оно уже есть как [0]
            // Также исключаем сам удаляемый сундук
            if (targetChest.name !== "Основное") {
                text += `🎒 [${targetChest.id}] ${targetChest.name}\n`;
                
                // Сундучки внутри (только если это не удаляемый сундук)
                for (const child of targetChest.Children) {
                    text += `  🧳 [${child.id}] ${child.name}\n`;
                }
            }
        }
    }
    
    text += `\nВведите ID сундука/сундучка:`;
    
    // Запрашиваем ID целевого сундука
    const targetIdInput = await Input_Number(context, text, true);
    if (targetIdInput === false) return { cursor: currentCursor };
    
    let targetChestId: number;
    
    if (targetIdInput === 0) {
        // Ищем "Основное" для этого альянса
        const mainChest = await prisma.allianceChest.findFirst({
            where: { 
                id_alliance: allianceId,
                name: "Основное" 
            }
        });
        
        if (!mainChest) {
            // Создаем "Основное" если нет
            const newMainChest = await prisma.allianceChest.create({
                data: {
                    name: "Основное",
                    id_alliance: allianceId,
                    id_parent: null,
                    order: 0
                }
            });
            targetChestId = newMainChest.id;
        } else {
            targetChestId = mainChest.id;
        }
    } else {
        // Проверяем, существует ли целевой сундук
        const targetChest = await prisma.allianceChest.findFirst({
            where: { id: targetIdInput }
        });
        
        if (!targetChest) {
            await context.send(`❌ Сундук с ID ${targetIdInput} не найден.`);
            return { cursor: currentCursor };
        }
        targetChestId = targetIdInput;
    }
    
    // Подтверждение
    const targetChest = await prisma.allianceChest.findFirst({
        where: { id: targetChestId }
    });
    
    const confirm = await Confirm_User_Success(
        context,
        `удалить сундук "${chest.name}" и переместить всё содержимое в "${targetChest?.name || 'Основное'}"?`
    );
    
    if (!confirm.status) {
        await context.send("❌ Удаление отменено.");
        return { cursor: currentCursor };
    }
    
    // Выполняем удаление с перемещением
    await deleteChestWithMove(chestId, targetChestId, user.id);
    
    await Send_Message_Smart(
        context, 
        `Сундук "${chest.name}" удалён. Содержимое перемещено в "${targetChest?.name || 'Основное'}".`, 
        'admin_solo'
    );
    
    return { cursor: currentCursor };
}

// 8. Функция удаления с перемещением
async function deleteChestWithMove(chestId: number, targetChestId: number, userId: number) {
    // 1. Перемещаем товары из удаляемого сундука
    await prisma.chestItemLink.updateMany({
        where: { 
            id_chest: chestId,
            inventory: {
                id_user: userId
            }
        },
        data: { id_chest: targetChestId }
    });
    
    // 2. Перемещаем товары из сундучков
    const childChests = await prisma.allianceChest.findMany({
        where: { id_parent: chestId }
    });
    
    for (const child of childChests) {
        await prisma.chestItemLink.updateMany({
            where: { 
                id_chest: child.id,
                inventory: {
                    id_user: userId
                }
            },
            data: { id_chest: targetChestId }
        });
        
        // Удаляем сундучок
        await prisma.allianceChest.delete({
            where: { id: child.id }
        });
    }
    
    // 3. Обновляем привязки категорий
    await prisma.categoryChest.updateMany({
        where: { id_chest: chestId },
        data: { id_chest: targetChestId }
    });
    
    // 4. Удаляем основной сундук
    await prisma.allianceChest.delete({
        where: { id: chestId }
    });
}

// 9. Навигация
async function handleChestPrev(context: any, data: any, allianceId: number, user: any, currentCursor: number) {
    return { cursor: data.cursor };
}

async function handleChestNext(context: any, data: any, allianceId: number, user: any, currentCursor: number) {
    return { cursor: data.cursor };
}

async function handleChildSelect(context: any, data: any, allianceId: number, parentChestId: number, user: any, currentCursor: number) {
    // Открываем содержимое сундучка (вместо того, чтобы просто возвращать курсор)
    await showChestContentsMenu(context, allianceId, data.id, user, 0);
    return { cursor: currentCursor };
}

async function showChestContentsMenu(context: any, allianceId: number, chestId: number, user: any, cursor: number = 0) {
    const chest = await prisma.allianceChest.findFirst({
        where: { id: chestId }
    });
    
    if (!chest) {
        await context.send("❌ Сундучок не найден.");
        return;
    }
    
    // Считаем содержимое сундучка
    const itemCount = await prisma.chestItemLink.count({
        where: { 
            id_chest: chest.id,
            inventory: {
                id_user: user.id
            }
        }
    });
    
    let text = `🧳 Сундучок: "${chest.name}"\n\n`;
    text += `📦 Содержимое: ${itemCount} предметов\n\n`;
    text += `Это сундучок находится внутри другого сундука.\nДля управления товарами используйте основной инвентарь.`;
    
    const keyboard = new KeyboardBuilder()
        .textButton({ 
            label: `← Назад`, 
            payload: { command: 'child_back' }, 
            color: 'secondary' 
        })
        .oneTime().inline();
    
    await context.send(text, { keyboard });
}

// 11. Навигация назад для сундучков
async function handleChildPrev(context: any, data: any, allianceId: number, parentChestId: number, user: any, currentCursor: number) {
    return { cursor: data.cursor };
}

// 12. Навигация вперед для сундучков
async function handleChildNext(context: any, data: any, allianceId: number, parentChestId: number, user: any, currentCursor: number) {
    return { cursor: data.cursor };
}

// 13. Возврат из меню сундучков
async function handleChildBack(context: any, data: any, allianceId: number, parentChestId: number, user: any, currentCursor: number) {
    return { back: true };
}

// 14. Переименование сундучка
async function handleChildRename(context: any, data: any, allianceId: number, parentChestId: number, user: any, currentCursor: number) {
    const childId = data.id;
    const child = await prisma.allianceChest.findFirst({
        where: { id: childId }
    });
    
    if (!child) {
        await context.send("❌ Сундучок не найден.");
        return { cursor: currentCursor };
    }
    
    const newName = await Input_Text(
        context, 
        `✏ Переименование сундучка\n\nТекущее название: ${child.name}\n🧷 Введите новое название (до 40 символов):`, 
        40
    );
    
    if (!newName) return { cursor: currentCursor };
    
    // Обновляем название
    await prisma.allianceChest.update({
        where: { id: childId },
        data: { name: newName }
    });
    
    await Send_Message_Smart(context, `✅ Сундучок переименован: ${child.name} → ${newName}`, 'admin_solo');
    return { cursor: currentCursor };
}

// 15. Удаление сундучка
async function handleChildDelete(context: any, data: any, allianceId: number, parentChestId: number, user: any, currentCursor: number) {
    const childId = data.id;
    
    // Получаем информацию о сундучке
    const child = await prisma.allianceChest.findFirst({
        where: { id: childId }
    });
    
    if (!child) {
        await context.send("❌ Сундучок не найден.");
        return { cursor: currentCursor };
    }
    
    // Получаем информацию о родительском сундуке
    const parentChest = await prisma.allianceChest.findFirst({
        where: { id: parentChestId }
    });
    
    // ЗАПРЕТ на удаление сундучков внутри "Основное"
    if (parentChest?.name === "Основное") {
        await context.send("❌ Нельзя удалять сундучки внутри 'Основное' сундука!");
        return { cursor: currentCursor };
    }
    
    // Считаем содержимое
    const itemCount = await prisma.chestItemLink.count({
        where: { 
            id_chest: child.id,
            inventory: {
                id_user: user.id
            }
        }
    });
    
    // Показываем диалог удаления
    let text = `⛔ Удаление сундучка "${child.name}"\n\n`;
    text += `📦 Содержимое: ${itemCount} товаров\n\n`;
    text += `Куда переместить содержимое?\n`;
    
    // Показываем все доступные сундуки (кроме удаляемого)
    const allChests = await prisma.allianceChest.findMany({
        where: { 
            id_alliance: allianceId,
            id: { not: childId }
        },
        include: { Children: true }
    });
    
    const mainChest = allChests.find(c => c.name === "Основное");
    if (mainChest) {
        text += `🔘 [${mainChest.id}] "Основное"\n`;
    }
    
    for (const targetChest of allChests) {
        if (targetChest.id_parent === null) { // Основные сундуки
            // Исключаем "Основное" из списка, так как оно уже есть как [0]
            if (targetChest.name !== "Основное") {
                text += `🎒 [${targetChest.id}] ${targetChest.name}\n`;
                
                // Сундучки внутри (кроме удаляемого)
                for (const childChest of targetChest.Children) {
                    if (childChest.id !== childId) {
                        text += `  🧳 [${childChest.id}] ${childChest.name}\n`;
                    }
                }
            }
        }
    }
    
    text += `\nВведите ID сундука/сундучка:`;
    
    // Запрашиваем ID целевого сундука
    const targetIdInput = await Input_Number(context, text, true);
    if (targetIdInput === false) return { cursor: currentCursor };
    
    let targetChestId: number;
    
    if (targetIdInput === 0) {
        // Ищем "Основное" для этого альянса
        const mainChest = await prisma.allianceChest.findFirst({
            where: { 
                id_alliance: allianceId,
                name: "Основное" 
            }
        });
        
        if (!mainChest) {
            // Создаем "Основное" если нет
            const newMainChest = await prisma.allianceChest.create({
                data: {
                    name: "Основное",
                    id_alliance: allianceId,
                    id_parent: null,
                    order: 0
                }
            });
            targetChestId = newMainChest.id;
        } else {
            targetChestId = mainChest.id;
        }
    } else {
        // Проверяем, существует ли целевой сундук
        const targetChest = await prisma.allianceChest.findFirst({
            where: { id: targetIdInput }
        });
        
        if (!targetChest) {
            await context.send(`❌ Сундук с ID ${targetIdInput} не найден.`);
            return { cursor: currentCursor };
        }
        targetChestId = targetIdInput;
    }
    
    // Подтверждение
    const targetChest = await prisma.allianceChest.findFirst({
        where: { id: targetChestId }
    });
    
    const confirm = await Confirm_User_Success(
        context,
        `удалить сундучок "${child.name}" и переместить ${itemCount} товаров в "${targetChest?.name || 'Основное'}"?`
    );
    
    if (!confirm.status) {
        await context.send("❌ Удаление отменено.");
        return { cursor: currentCursor };
    }
    
    // Перемещаем товары
    await prisma.chestItemLink.updateMany({
        where: { 
            id_chest: childId,
            inventory: {
                id_user: user.id
            }
        },
        data: { id_chest: targetChestId }
    });
    
    // Обновляем привязки категорий (если они ссылались на этот сундучок)
    await prisma.categoryChest.updateMany({
        where: { id_chest: childId },
        data: { id_chest: targetChestId }
    });
    
    // Удаляем сундучок
    await prisma.allianceChest.delete({
        where: { id: childId }
    });
    
    await Send_Message_Smart(
        context, 
        `Сундучок "${child.name}" удалён. Содержимое перемещено в "${targetChest?.name || 'Основное'}".`, 
        'admin_solo'
    );
    
    return { cursor: currentCursor };
}