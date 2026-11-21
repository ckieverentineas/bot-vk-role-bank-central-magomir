// src/engine/events/module/shop/legacy_category_manager.ts
import { KeyboardBuilder } from "vk-io";
import prisma from "../prisma_client";
import { answerTimeLimit } from "../../../..";
import { 
    Confirm_User_Success, 
    Send_Message_Question, 
    Send_Message_Smart,
    Send_Message,
    Input_Number
} from "../../../core/helper";
import { getChestSelectionForCategory } from "../alliance/chest_category_binder";
import { migrateCategoryItems } from "./alliance_inventory_with_chests";
import { InventoryType } from "../data_center/standart";

// Функция для получения только легаси-категорий (удаленных) для конкретного альянса
async function LegacyCategory_Get(cursor: number, allianceId: number) {
    const batchSize = 5;
    
    // 1. Находим все монеты (валюты) этого альянса
    const allianceCoins = await prisma.allianceCoin.findMany({
        where: { id_alliance: allianceId },
        select: { id: true }
    });
    
    if (allianceCoins.length === 0) {
        return { categories: [], total: 0 };
    }
    
    const allianceCoinIds = allianceCoins.map(coin => coin.id);
    //console.log(`Монеты альянса ${allianceId}: ${allianceCoinIds.join(', ')}`);
    
    // 2. Находим все существующие категории альянса
    const existingCategories = await prisma.allianceShopCategory.findMany({
        where: {
            Alliance_Shop: {
                id_alliance: allianceId
            }
        },
        select: { id: true }
    });
    
    const existingCategoryIds = existingCategories.map(cat => cat.id);
    //console.log(`Существующие категории альянса ${allianceId}: ${existingCategoryIds.length} шт.`);
    
    // 3. Находим все id_shop из товаров, которые используют монеты альянса
    const allItemsWithShop = await prisma.allianceShopItem.findMany({
        where: {
            id_coin: { in: allianceCoinIds }  // Только товары с монетами альянса
        },
        select: { id_shop: true },
        distinct: ['id_shop']
    });
    
    const allShopIdsFromItems = allItemsWithShop.map(item => item.id_shop);
    //console.log(`id_shop из товаров альянса: ${allShopIdsFromItems.slice(0, 20).join(', ')}...`);
    
    // 4. Легаси-категории = id_shop товаров альянса, которых нет в существующих категориях
    const potentialLegacyIds = allShopIdsFromItems.filter(
        shopId => !existingCategoryIds.includes(shopId)
    );
    
    //console.log(`Потенциальные легаси: ${potentialLegacyIds.length} шт.`);
    
    if (potentialLegacyIds.length === 0) {
        return { categories: [], total: 0 };
    }
    
    // 5. Проверяем, есть ли у игроков альянса товары из этих категорий
    const legacyCategories = [];
    
    for (const categoryId of potentialLegacyIds) {
        // Находим товары в этой категории с монетами альянса
        const itemsInCategory = await prisma.allianceShopItem.findMany({
            where: { 
                id_shop: categoryId,
                id_coin: { in: allianceCoinIds }
            },
            select: { id: true, name: true }
        });
        
        if (itemsInCategory.length === 0) continue;
        
        const itemIds = itemsInCategory.map(item => item.id);
        
        // Проверяем, есть ли эти товары в инвентаре игроков альянса
        const inventoryCount = await prisma.inventory.count({
            where: {
                id_item: { in: itemIds },
                type: InventoryType.ITEM_SHOP_ALLIANCE,
                user: {
                    id_alliance: allianceId
                }
            }
        });
        
        if (inventoryCount > 0) {
            //console.log(`✅ Найдена легаси-категория ${categoryId}: ${inventoryCount} предметов у игроков альянса`);
            
            // Используем первое название товара для названия категории
            const categoryName = itemsInCategory[0]?.name || `Удаленная категория ${categoryId}`;
            
            legacyCategories.push({
                id: categoryId,
                name: categoryName,
                shop_name: 'Неизвестный магазин',
                id_alliance_shop: 0,
                item_count: inventoryCount
            });
        }
    }
    
    //console.log(`Найдено легаси-категорий: ${legacyCategories.length}`);
    
    // 6. Пагинация - FIX: правильно рассчитываем start и end
    const total = legacyCategories.length;
    const start = cursor;
    const end = Math.min(cursor + batchSize, total);
    const paginatedCategories = legacyCategories.slice(start, end);
    
    //console.log(`LegacyCategory_Get DEBUG: cursor=${cursor}, batchSize=${batchSize}`);
    //console.log(`Total categories found: ${total}`);
    //console.log(`Range: ${start} to ${end} (showing ${paginatedCategories.length} items)`);
    if (paginatedCategories.length > 0) {
        //console.log(`First item in page: ID=${paginatedCategories[0].id}, Name=${paginatedCategories[0].name}`);
        if (paginatedCategories.length > 1) {
            //console.log(`Last item in page: ID=${paginatedCategories[paginatedCategories.length-1].id}, Name=${paginatedCategories[paginatedCategories.length-1].name}`);
        }
    }

    return {
        categories: paginatedCategories,
        total: total
    };
}

// Главная функция легаси-категорий
export async function Legacy_Category_Printer(context: any, allianceId: number) {
    let category_tr = false;
    let cursor = 0;

    while (!category_tr) {
        const keyboard = new KeyboardBuilder();
        
        // Получаем легаси-категории (удаленные) с пагинацией
        const result = await LegacyCategory_Get(cursor, allianceId);
        const legacyCategories = result.categories;
        const totalCategories = result.total;
        
        // Если нет легаси-категорий
        if (legacyCategories.length === 0) {
            await context.send("❌ Нет удаленных категорий с товарами (легаси-категорий).");
            return;
        }
        
        let event_logger = '📁 Выберите легаси-категорию:\n\n';

        for (const category of legacyCategories) {
            // Получаем информацию о привязанном сундуке
            const categoryChest = await prisma.categoryChest.findFirst({
                where: { id_category: category.id },
                include: { chest: true }
            });
            
            let chestInfo = '';
            if (categoryChest?.chest) {
                chestInfo = `, сундук [${categoryChest.chest.name}]`;
            }
            
            event_logger += `📁 ${category.id} (${category.item_count}📦)${chestInfo}\n`;
            
            // Кнопки для легаси-категории
            keyboard.textButton({
                label: `📁 ${category.id}`,
                payload: { 
                    command: 'legacycategory_select', 
                    cursor: cursor, // Важно: передаем текущий курсор
                    id_category: category.id 
                },
                color: 'secondary'
            })
            .textButton({
                label: `🎒`,
                payload: { 
                    command: 'legacycategory_bind', 
                    cursor: cursor, // Важно: передаем текущий курсор
                    id_category: category.id 
                },
                color: 'secondary'
            }).row();
        }

        const pageSize = 5;
        const currentPage = Math.floor(cursor / pageSize) + 1;
        const totalPages = Math.ceil(totalCategories / pageSize);

        // Отладка
        //console.log(`Пагинация: cursor=${cursor}, currentPage=${currentPage}, totalPages=${totalPages}, totalCategories=${totalCategories}`);

        // Навигационные кнопки
        if (currentPage > 1) {
            const prevCursor = Math.max(0, cursor - pageSize);
            keyboard.textButton({ 
                label: `←`, 
                payload: { command: 'legacycategory_back', cursor: prevCursor }, 
                color: 'secondary' 
            });
            //console.log(`Кнопка "←": cursor=${prevCursor}`);
        }

        if (currentPage < totalPages) {
            const nextCursor = Math.min(cursor + pageSize, totalCategories);
            keyboard.textButton({ 
                label: `→`, 
                payload: { command: 'legacycategory_next', cursor: nextCursor }, 
                color: 'secondary' 
            });
            //console.log(`Кнопка "→": cursor=${nextCursor}`);
        }

        event_logger += `\n\n📄 Страница ${currentPage} из ${totalPages} (категории ${cursor + 1}-${Math.min(cursor + pageSize, totalCategories)})`;
        
        const bt = await Send_Message_Question(context, event_logger, keyboard.oneTime());
        if (bt.exit) { 
            category_tr = true;
            continue;
        }
        
        // Обработка payload
        let payloadData: any;
        if (typeof bt.payload === 'string') {
            try {
                payloadData = JSON.parse(bt.payload);
            } catch (e) {
                console.error("Error parsing payload:", e);
                await context.send(`💡 Жмите только на кнопки.`);
                continue;
            }
        } else if (typeof bt.payload === 'object') {
            payloadData = bt.payload;
        }
        
        if (!payloadData || !payloadData.command) {
            await context.send(`💡 Жмите только на кнопки.`);
            continue;
        }
        
        const config: any = {
            'legacycategory_select': LegacyCategory_Select,
            'legacycategory_bind': LegacyCategory_Bind,
            'legacycategory_next': LegacyCategory_Next,
            'legacycategory_back': LegacyCategory_Back
        };

        if (config[payloadData.command]) {
            const ans = await config[payloadData.command](context, payloadData, allianceId);
            if (ans?.cursor !== undefined) {
                cursor = ans.cursor;
            }
            if (ans?.stop) {
                category_tr = true;
            }
        } else {
            await context.send(`❌ Неизвестная команда: ${payloadData.command}`);
        }
    }
}

// Выбор категории - показ товаров
async function LegacyCategory_Select(context: any, data: any, allianceId: number) {
    //console.log(`LegacyCategory_Select: categoryId=${data.id_category}, cursor=${data.cursor}`);
    await LegacyCategory_Items_Printer(context, data.id_category, 0);
    // Возвращаем тот же курсор, чтобы при возврате остаться на той же странице
    return { cursor: data.cursor };
}

// Привязка сундука к легаси-категории
async function LegacyCategory_Bind(context: any, data: any, allianceId: number) {
    const res = { cursor: data.cursor };
    
    const categoryId = data.id_category;
    
    // Получаем все товары в категории
    const itemsInCategory = await prisma.allianceShopItem.findMany({
        where: { id_shop: categoryId },
        select: { name: true }
    });
    
    if (itemsInCategory.length === 0) {
        await context.send(`❌ В легаси-категории ${categoryId} нет товаров.`);
        return res;
    }
    
    // Используем более осмысленное название
    const categoryName = `Легаси-категория ${categoryId} (${itemsInCategory.length} товаров)`;
    
    // Используем существующую функцию привязки сундука
    await bindChestToLegacyCategory(context, categoryId, categoryName, allianceId);
    
    return res;
}

// Функция миграции для легаси-категорий (УПРОЩЕННАЯ ВЕРСИЯ)
async function migrateLegacyCategoryItems(context: any, categoryId: number, newChestId: number): Promise<boolean> {
    try {
        // Получаем новый сундук
        const newChest = await prisma.allianceChest.findFirst({
            where: { id: newChestId }
        });
        
        if (!newChest) {
            await context.send(`❌ Новый сундук не найден.`);
            return false;
        }
        
        // Получаем товары легаси-категории
        const allItems = await prisma.allianceShopItem.findMany({
            where: { id_shop: categoryId }
        });
        
        if (allItems.length === 0) {
            await context.send(`ℹ️ В легаси-категории ${categoryId} нет товаров.`);
            return true;
        }
        
        // Подсчитываем видимые и скрытые товары
        const visibleItems = allItems.filter(item => !item.hidden);
        const hiddenItems = allItems.filter(item => item.hidden);
        
        // ПЕРВЫЙ ЭТАП: Простой выбор
        await context.send(`🔄 Миграция товаров из легаси-категории ${categoryId} в сундук "${newChest.name}"\n\n` +
            `📊 Статистика:\n` +
            `• Всего товаров: ${allItems.length}\n` +
            `• Видимых: ${visibleItems.length}\n` +
            `• Скрытых: ${hiddenItems.length}\n\n` +
            `Выберите, какие товары мигрировать:`);
        
        const keyboard = new KeyboardBuilder()
            .textButton({
                label: '✅ Все товары',
                payload: { command: 'migrate_all', categoryId, newChestId },
                color: 'positive'
            })
            .textButton({
                label: '👁 Только видимые',
                payload: { command: 'migrate_visible', categoryId, newChestId },
                color: 'primary'
            })
            .row()
            .oneTime();
        
        const response = await Send_Message_Question(context, 'Выберите вариант:', keyboard);
        
        if (response.exit || !response.payload) {
            await context.send(`❌ Миграция отменена.`);
            return false;
        }
        
        let payloadData: any;
        if (typeof response.payload === 'string') {
            payloadData = JSON.parse(response.payload);
        } else {
            payloadData = response.payload;
        }
        
        if (payloadData.command === 'cancel_migration') {
            await context.send(`❌ Миграция отменена.`);
            return false;
        }
        
        // ВТОРОЙ ЭТАП: Подтверждение
        const itemsToMigrate = payloadData.command === 'migrate_all' ? allItems : visibleItems;
        const modeText = payloadData.command === 'migrate_all' ? 'ВСЕ товары' : 'только видимые товары';
        
        await context.send(`📋 Подтверждение миграции:\n\n` +
            `📁 Категория: Легаси-категория ${categoryId}\n` +
            `🎒 Целевой сундук: ${newChest.name}\n` +
            `👁 Режим: ${modeText}\n` +
            `📦 Товаров к миграции: ${itemsToMigrate.length}\n\n` +
            `💡 Будет обновлено расположение всех купленных экземпляров этих товаров у игроков альянса.`);
        
        const confirm = await Confirm_User_Success(context, `выполнить миграцию ${itemsToMigrate.length} товаров?`);
        
        if (!confirm.status) {
            await context.send(`❌ Миграция отменена.`);
            return false;
        }
        
        // Выполнение миграции
        return await executeLegacyMigration(context, categoryId, newChestId, itemsToMigrate, newChest.name, modeText);
        
    } catch (error: any) {
        console.error('Error in migrateLegacyCategoryItems:', error);
        await context.send(`❌ Ошибка при миграции: ${error.message}`);
        return false;
    }
}

// Выполнение миграции легаси-категории
async function executeLegacyMigration(
    context: any, 
    categoryId: number, 
    newChestId: number, 
    items: any[], 
    chestName: string,
    modeText: string
): Promise<boolean> {
    try {
        let totalInventories = 0;
        let migratedCount = 0;
        let failedCount = 0;
        let processedItems = 0;
        
        const totalItems = items.length;
        const progressStep = Math.max(1, Math.floor(totalItems / 10));
        
        await context.send(`🔄 Начинаю миграцию ${modeText.toLowerCase()} (${totalItems} товаров)...`);
        
        // Для каждого товара находим и обновляем инвентарные записи
        for (const item of items) {
            processedItems++;
            
            // Показываем прогресс каждые 10%
            if (processedItems % progressStep === 0 || processedItems === totalItems) {
                const percent = Math.round((processedItems / totalItems) * 100);
                await context.send(`🔄 Обработка: ${processedItems}/${totalItems} (${percent}%)...`);
            }
            
            try {
                // Находим все инвентарные записи этого товара у игроков альянса
                const inventories = await prisma.inventory.findMany({
                    where: { 
                        id_item: item.id,
                        type: InventoryType.ITEM_SHOP_ALLIANCE
                    },
                    include: {
                        ChestItemLink: true,
                        user: {
                            select: { id_alliance: true }
                        }
                    }
                });
                
                // Фильтруем только игроков текущего альянса (опционально, если нужно)
                const allianceInventories = inventories; // Можно добавить фильтрацию по альянсу
                
                totalInventories += allianceInventories.length;
                
                for (const inventory of allianceInventories) {
                    try {
                        if (inventory.ChestItemLink) {
                            // Обновляем существующую связь
                            await prisma.chestItemLink.update({
                                where: { id: inventory.ChestItemLink.id },
                                data: { id_chest: newChestId }
                            });
                        } else {
                            // Создаем новую связь
                            await prisma.chestItemLink.create({
                                data: {
                                    id_chest: newChestId,
                                    id_inventory: inventory.id
                                }
                            });
                        }
                        migratedCount++;
                    } catch (error) {
                        console.error(`Error migrating inventory ${inventory.id}:`, error);
                        failedCount++;
                    }
                }
                
                // Небольшая задержка для больших объемов
                if (allianceInventories.length > 50) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
            } catch (error) {
                console.error(`Error processing item ${item.id}:`, error);
                failedCount++;
            }
        }
        
        // Результат
        const resultMessage = `✅ Миграция завершена!\n\n` +
            `📁 Легаси-категория: ${categoryId}\n` +
            `🎒 Сундук: "${chestName}"\n` +
            `👁 Режим: ${modeText}\n` +
            `🛒 Товаров обработано: ${items.length}\n` +
            `📦 Инвентарных записей: ${totalInventories}\n` +
            `✅ Успешно перенесено: ${migratedCount}\n` +
            `❌ Ошибок: ${failedCount}`;
        
        await context.send(resultMessage);
        
        // Логирование
        if (totalInventories > 0) {
            const logMessage = `🔄 Миграция легаси-категории\n\n` +
                `📁 Категория: Легаси-категория ${categoryId}\n` +
                `🎒 Сундук: "${chestName}" (ID: ${newChestId})\n` +
                `👁 Режим: ${modeText}\n` +
                `🛒 Товаров: ${items.length}\n` +
                `📦 Предметов у игроков: ${totalInventories}\n` +
                `✅ Перенесено: ${migratedCount}`;
            
            // Можно добавить отправку в лог-чат альянса
        }
        
        return failedCount === 0;
        
    } catch (error: any) {
        console.error('Error in executeLegacyMigration:', error);
        await context.send(`❌ Ошибка при выполнении миграции: ${error.message}`);
        return false;
    }
}

// Миграция всех товаров
async function migrateAllLegacyItems(context: any, categoryId: number, newChestId: number, items: any[]) {
    let totalMigrated = 0;
    let totalFailed = 0;
    
    await context.send(`🔄 Начинаю миграцию ВСЕХ товаров (${items.length})...`);
    
    for (const item of items) {
        const success = await migrateItemToChest(item.id, newChestId);
        if (success) {
            totalMigrated++;
        } else {
            totalFailed++;
        }
        
        // Показываем прогресс каждые 10 товаров
        if ((totalMigrated + totalFailed) % 10 === 0) {
            const progress = totalMigrated + totalFailed;
            const percent = Math.round((progress / items.length) * 100);
            await context.send(`🔄 Прогресс: ${progress}/${items.length} (${percent}%)...`);
        }
    }
    
    await context.send(`✅ Миграция завершена!\n\n` +
        `📦 Всего товаров: ${items.length}\n` +
        `✅ Успешно перенесено: ${totalMigrated}\n` +
        `❌ Ошибок: ${totalFailed}`);
    
    return totalFailed === 0;
}

// Вспомогательная функция для миграции одного товара
async function migrateItemToChest(itemId: number, chestId: number): Promise<boolean> {
    try {
        // Находим все инвентарные записи этого товара
        const inventories = await prisma.inventory.findMany({
            where: { 
                id_item: itemId,
                type: InventoryType.ITEM_SHOP_ALLIANCE
            },
            include: {
                ChestItemLink: true
            }
        });
        
        for (const inventory of inventories) {
            if (inventory.ChestItemLink) {
                // Обновляем существующую связь
                await prisma.chestItemLink.update({
                    where: { id: inventory.ChestItemLink.id },
                    data: { id_chest: chestId }
                });
            } else {
                // Создаем новую связь
                await prisma.chestItemLink.create({
                    data: {
                        id_chest: chestId,
                        id_inventory: inventory.id
                    }
                });
            }
        }
        
        return true;
    } catch (error) {
        console.error(`Error migrating item ${itemId}:`, error);
        return false;
    }
}

// Функция для привязки сундука к легаси-категории
async function bindChestToLegacyCategory(context: any, categoryId: number, categoryName: string, allianceId: number) {
    // 1. Получаем или создаем связь категория-сундук
    const existingBinding = await prisma.categoryChest.findFirst({
        where: { id_category: categoryId },
        include: { chest: true }
    });
    
    let currentChestName = 'Не привязан';
    if (existingBinding?.chest) {
        currentChestName = existingBinding.chest.name;
    }
    
    await context.send(`🧷 🎒 Настройка привязки к сундуку\n\n` +
                      `Категория: "${categoryName}" (ID: ${categoryId})\n` +
                      `Текущая привязка: ${currentChestName}\n\n` +
                      `Выберите сундук для товаров этой категории:`);
    
    // 2. Получаем ВСЕ сундуки альянса с вложенными структурами
    const allChests = await prisma.allianceChest.findMany({
        where: { id_alliance: allianceId },
        include: { Children: true },
        orderBy: [{ id_parent: 'asc' }, { order: 'asc' }]
    });
    
    // 3. Формируем текст с ВСЕМ ДЕРЕВОМ сундуков
    let text = `🎒 Выберите сундук для категории "${categoryName}":\n\n`;
    
    // Функция для рекурсивного вывода сундуков
    function printChests(chests: any[], parentId: number | null = null, level: number = 0): string {
        let result = '';
        const prefix = '      '.repeat(level);
        
        const filteredChests = chests.filter(c => c.id_parent === parentId);
        
        for (const chest of filteredChests) {
            // Приводим тип с Children
            const chestWithChildren = chest as any & { Children: any[] };
            
            let icon = '🎒';
            
            if (chest.name === "Основное") {
                icon = existingBinding?.id_chest === chest.id ? '🔘' : '🎒';
            } else if (level >= 1) {
                // Это дочерний сундук (сундучок)
                icon = '🧳';
                if (existingBinding?.id_chest === chest.id) {
                    icon = '🧳';
                }
            } else if (existingBinding?.id_chest === chest.id) {
                // Выделяем выбранный основной сундук
                icon = '🔘';
            }
            
            // Добавляем сундук
            result += `${prefix}${icon} [${chest.id}] "${chest.name}"\n`;
            
            // Рекурсивно добавляем сундучки
            if (chestWithChildren.Children && chestWithChildren.Children.length > 0) {
                result += printChests(chests, chest.id, level + 1);
            }
        }
        
        return result;
    }
    
    // Выводим всё дерево
    text += printChests(allChests);
    
    // Убеждаемся, что есть "Основное" - ищем без приведения типа
    let mainChest: any | null = allChests.find(c => c.name === "Основное" && c.id_parent === null);
    if (!mainChest) {
        mainChest = await prisma.allianceChest.create({
            data: {
                name: "Основное",
                id_alliance: allianceId,
                id_parent: null,
                order: 0
            }
        });
        allChests.push(mainChest);
    }
    
    text += `\nВведите ID сундука:`;
    
    // 4. Получаем выбор пользователя
    const chestIdInput = await Input_Number(context, text, true);
    if (chestIdInput === false) {
        await context.send(`❌ Отменено.`);
        return;
    }
    
    let selectedChestId: number;
    let selectedChestName: string;
    
    // Проверяем существование выбранного сундука
    const selectedChest = allChests.find(c => c.id === chestIdInput);
    if (!selectedChest) {
        // Если не нашли сундук, проверяем специальные случаи
        if (chestIdInput === 0 || chestIdInput === mainChest.id) {
            selectedChestId = mainChest.id;
            selectedChestName = "Основное";
        } else {
            await context.send(`❌ Сундук с ID ${chestIdInput} не найден. Используется "Основное".`);
            selectedChestId = mainChest.id;
            selectedChestName = "Основное";
        }
    } else {
        selectedChestId = selectedChest.id;
        selectedChestName = selectedChest.name;
    }
    
    // 5. Создаем или обновляем привязку
    if (existingBinding) {
        await prisma.categoryChest.update({
            where: { id: existingBinding.id },
            data: { id_chest: selectedChestId }
        });
        
        await context.send(`✅ Привязка обновлена: "${categoryName}" → сундук "${selectedChestName}"`);
    } else {
        await prisma.categoryChest.create({
            data: {
                id_category: categoryId,
                id_chest: selectedChestId
            }
        });
        
        await context.send(`✅ Привязка создана: "${categoryName}" → сундук "${selectedChestName}"`);
    }
    
    // 6. Предлагаем мигрировать существующие предметы (ДВУХЭТАПНАЯ МИГРАЦИЯ)
    const confirm = await Confirm_User_Success(
        context,
        `перенести все существующие предметы из легаси-категории "${categoryName}" в сундук "${selectedChestName}"?\n\n` +
        `💡 Это запустит двухэтапный процесс миграции с выбором режима.`
    );
    
    if (confirm.status) {
        // Используем новую функцию двухэтапной миграции
        await migrateLegacyCategoryItems(context, categoryId, selectedChestId);
    } else {
        await context.send(`ℹ️ Привязка сохранена. Существующие предметы остались в прежних сундуках.\n` +
                          `Новые покупки будут попадать в сундук "${selectedChestName}".`);
    }
}

// Навигация
async function LegacyCategory_Next(context: any, data: any, allianceId: number) {
    //console.log(`LegacyCategory_Next: received cursor=${data.cursor}, returning as is`);
    return { cursor: data.cursor };
}

async function LegacyCategory_Back(context: any, data: any, allianceId: number) {
    //console.log(`LegacyCategory_Back: received cursor=${data.cursor}, returning as is`);
    return { cursor: data.cursor };
}

// Показ товаров в легаси-категории
async function LegacyCategory_Items_Printer(context: any, categoryId: number, initialCursor: number = 0) {
    let item_tr = false;
    let cursor = initialCursor;
    const ITEMS_PER_PAGE = 5;
    
    while (!item_tr) {
        const keyboard = new KeyboardBuilder();
        
        // Получаем ВСЕ товары легаси-категории
        const allItems = await prisma.allianceShopItem.findMany({
            where: { id_shop: categoryId }
        });
        
        const totalItems = allItems.length;
        const pageItems = allItems.slice(cursor, cursor + ITEMS_PER_PAGE);
        
        if (totalItems === 0) {
            await context.send(`❌ В легаси-категории ${categoryId} нет товаров.`);
            return;
        }
        
        let event_logger = `💎 Товары в легаси-категории ${categoryId}:\n\n`;
        event_logger += `📦 Всего товаров: ${totalItems}\n\n`;
        
        for (let i = 0; i < pageItems.length; i++) {
            const item = pageItems[i];
            const itemNumber = cursor + i + 1;
            event_logger += `💬 ${item.id} - ${item.name}\n`;
            
            keyboard.textButton({
                label: `${item.id}`,
                payload: { 
                    command: 'legacyitem_select', 
                    cursor: cursor,
                    id_item: item.id,
                    categoryId: categoryId
                },
                color: 'secondary'
            })
            .textButton({
                label: `⛔`,
                payload: { 
                    command: 'legacyitem_delete', 
                    cursor: cursor,
                    id_item: item.id,
                    categoryId: categoryId
                },
                color: 'negative'
            })
            .textButton({
                label: `🚫`,
                payload: { 
                    command: 'legacyitem_hide', 
                    cursor: cursor,
                    id_item: item.id,
                    categoryId: categoryId
                },
                color: 'negative'
            }).row();
        }
        
        // Навигация
        const hasPrevPage = cursor > 0;
        const hasNextPage = cursor + ITEMS_PER_PAGE < totalItems;

        if (hasPrevPage || hasNextPage) {
            if (hasPrevPage) {
                keyboard.textButton({
                    label: `←`,
                    payload: { 
                        command: 'legacyitem_back', 
                        cursor: Math.max(0, cursor - ITEMS_PER_PAGE),
                        categoryId: categoryId
                    },
                    color: 'secondary'
                });
            }
            
            if (hasNextPage) {
                keyboard.textButton({
                    label: `→`,
                    payload: { 
                        command: 'legacyitem_next', 
                        cursor: cursor + ITEMS_PER_PAGE,
                        categoryId: categoryId
                    },
                    color: 'secondary'
                });
            }
            keyboard.row();
        }
        
        // Кнопка возврата
        keyboard.textButton({
            label: `← Назад к категориям`,
            payload: { command: 'legacyitem_back_to_categories' },
            color: 'secondary'
        }).row();
        
        const currentPage = Math.floor(cursor / ITEMS_PER_PAGE) + 1;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        const startItem = cursor + 1;
        const endItem = Math.min(cursor + ITEMS_PER_PAGE, totalItems);
        event_logger += `\n\n📄 Страница ${currentPage} из ${totalPages} (товары ${startItem}-${endItem})`;

        const bt = await Send_Message_Question(context, event_logger, keyboard.oneTime());
        if (bt.exit) { 
            item_tr = true;
            continue;
        }

        // Обработка payload
        let payloadData: any;
        if (typeof bt.payload === 'string') {
            try {
                payloadData = JSON.parse(bt.payload);
            } catch (e) {
                console.error("Error parsing payload:", e);
                await context.send(`💡 Жмите только на кнопки.`);
                continue;
            }
        } else if (typeof bt.payload === 'object') {
            payloadData = bt.payload;
        }

        if (!payloadData || !payloadData.command) {
            await context.send(`💡 Жмите только на кнопки.`);
            continue;
        }

        const config: any = {
            'legacyitem_select': LegacyItem_Select,
            'legacyitem_delete': LegacyItem_Delete,
            'legacyitem_hide': LegacyItem_Hide,
            'legacyitem_next': LegacyItem_Next,
            'legacyitem_back': LegacyItem_Back,
            'legacyitem_back_to_categories': () => ({ stop: true })
        };

        // Убедимся, что передаем categoryId
        if (!payloadData.categoryId) {
            payloadData.categoryId = categoryId;
        }

        if (config[payloadData.command]) {
            const ans = await config[payloadData.command](context, payloadData, { id: categoryId });
            if (ans?.stop) {
                item_tr = true;
            } else if (ans?.cursor !== undefined) {
                // Правильно обновляем курсор
                cursor = ans.cursor;
                //console.log(`Обновлен курсор товаров: ${cursor}`);
            }
        } else {
            await context.send(`❌ Неизвестная команда: ${payloadData.command}`);
        }
    }
}

// Просмотр товара
async function LegacyItem_Select(context: any, data: any, category: any) {
    const res = { 
        cursor: data.cursor,
        categoryId: data.categoryId || category.id 
    };
    
    const item = await prisma.allianceShopItem.findFirst({
        where: { id: data.id_item }
    });
    
    if (!item) {
        await context.send(`❌ Товар не найден.`);
        return res;
    }
    
    const coin = await prisma.allianceCoin.findFirst({
        where: { id: item.id_coin }
    });
    
    let text = `🛍 Просмотр товара: ${item.name}\n\n`;
    text += `🧾 ID товара: ${item.id}\n`;
    text += `📁 ID категории: ${item.id_shop} (легаси-категория)\n`;
    text += `${coin?.smile ?? '💰'} Стоимость [${coin?.name ?? ''}]: ${item.price}\n`;
    text += `📜 Описание: ${item.description || 'Нет описания'}\n`;
    text += item.limit_tr ? `📦 Количество товаров: ${item.limit}` : '♾️ Количество товаров: безлимит\n';
    text += `🔊 Товар ${item.hidden ? 'недоступен' : 'доступен'} к покупке пользователями\n`;
    text += `👜 Покупка ${item.inventory_tr ? 'попадет' : 'не попадет'} в ваш инвентарь`;
    
    const categoryChest = await prisma.categoryChest.findFirst({
        where: { id_category: item.id_shop },
        include: { chest: true }
    });
    
    if (categoryChest?.chest) {
        text += `\n🎒 Попадает в сундук: ${categoryChest.chest.name}`;
    } else {
        text += `\n🎒 Не привязано к сундуку`;
    }
    
    await context.send(text);
    
    return res;
}

// Удаление товара
async function LegacyItem_Delete(context: any, data: any, category: any) {
    const res = { cursor: data.cursor };
    
    const item = await prisma.allianceShopItem.findFirst({
        where: { id: data.id_item }
    });
    
    if (!item) {
        await context.send(`❌ Товар не найден.`);
        return res;
    }
    
    const confirm1 = await Confirm_User_Success(
        context, 
        `удалить товар "${item.name}"?`
    );
    
    if (!confirm1.status) {
        await context.send(`❌ Удаление отменено.`);
        return res;
    }
    
    const confirm2 = await Confirm_User_Success(
        context, 
        `удалить товар "${item.name}", все купленные товары также исчезнут из инвентаря игроков?`
    );
    
    if (!confirm2.status) {
        await context.send(`❌ Удаление отменено.`);
        return res;
    }
    
    const confirm3 = await Confirm_User_Success(
        context, 
        `удалить товар "${item.name}", вы можете скрыть товар для покупки, вы уверены?`
    );
    
    if (!confirm3.status) {
        await context.send(`❌ Удаление отменено.`);
        return res;
    }
    
    // Удаляем товар
    await prisma.allianceShopItem.delete({
        where: { id: item.id }
    });
    
    await Send_Message_Smart(
        context, 
        `"Легаси-удаление товара" --> удален товар: ${item.id}-${item.name}`, 
        'admin_solo'
    );
    
    await context.send(`✅ Товар удалён.`);
    
    return res;
}

// Скрытие/показ товара
async function LegacyItem_Hide(context: any, data: any, category: any) {
    const res = { cursor: data.cursor };
    
    const item = await prisma.allianceShopItem.findFirst({
        where: { id: data.id_item }
    });
    
    if (!item) {
        await context.send(`❌ Товар не найден.`);
        return res;
    }
    
    const newHiddenStatus = !item.hidden;
    
    const confirm = await Confirm_User_Success(
        context, 
        `${newHiddenStatus ? 'скрыть' : 'показать'} товар "${item.name}"?`
    );
    
    if (!confirm.status) {
        await context.send(`❌ Операция отменена.`);
        return res;
    }
    
    await prisma.allianceShopItem.update({
        where: { id: item.id },
        data: { hidden: newHiddenStatus }
    });
    
    await Send_Message_Smart(
        context, 
        `"Легаси-скрытие товара" --> товар ${item.id}-${item.name} ${newHiddenStatus ? 'скрыт' : 'показан'}`, 
        'admin_solo'
    );
    
    await context.send(`✅ Товар ${newHiddenStatus ? 'скрыт' : 'показан'}.`);
    
    return res;
}

// Навигация товаров
async function LegacyItem_Next(context: any, data: any, category: any) {
    //console.log(`LegacyItem_Next: using cursor from payload: ${data.cursor}, categoryId=${data.categoryId || category.id}`);
    return { 
        cursor: data.cursor,
        categoryId: data.categoryId || category.id 
    };
}

async function LegacyItem_Back(context: any, data: any, category: any) {
    //console.log(`LegacyItem_Back: using cursor from payload: ${data.cursor}, categoryId=${data.categoryId || category.id}`);
    return { 
        cursor: data.cursor,
        categoryId: data.categoryId || category.id 
    };
}

