import { Keyboard } from "vk-io";
import { answerTimeLimit } from "../../../..";
import prisma from "../prisma_client";
import { Confirm_User_Success, Input_Number, Send_Message } from "../../../core/helper";
import { migrateCategoryItems } from "../shop/alliance_inventory_with_chests";

export async function getChestSelectionForCategory(context: any, categoryId: number, allianceId: number): Promise<boolean> {
    try {
        // Получаем категорию
        const category = await prisma.allianceShopCategory.findFirst({
            where: { id: categoryId }
        });
        
        if (!category) {
            await context.send(`❌ Категория не найдена.`);
            return false;
        }
        
        // Получаем все сундуки альянса
        const allChests = await prisma.allianceChest.findMany({
            where: { id_alliance: allianceId },
            include: { Children: true },
            orderBy: [{ id_parent: 'asc' }, { order: 'asc' }]
        });
        
        // Ищем текущую привязку
        const currentBinding = await prisma.categoryChest.findFirst({
            where: { id_category: categoryId },
            include: { chest: true }
        });
        
        const currentChestName = currentBinding?.chest?.name || "Основное";
        
        let text = `🎒 Настройка привязки к сундуку\n\n`;
        text += `Категория: "${category.name}"\n`;
        text += `Текущая привязка: ${currentChestName} (ID: ${currentBinding?.id_chest || 0})\n\n`;
        text += `Выберите сундук для товаров этой категории:\n`;
        
        // Формируем список сундуков
        const mainChests = allChests.filter(c => c.id_parent === null);
        
        for (const chest of mainChests) {
            const icon = chest.name === "Основное" ? '🔘' : '🎒';
            text += `${icon} [${chest.id}] "${chest.name}"\n`;
        }
        
        text += `\nВведите ID сундука:`;
        
        // Запрашиваем выбор сундука
        const chestIdInput = await Input_Number(context, text, true);
        if (chestIdInput === false) {
            await context.send(`❌ Отмена настройки привязки.`);
            return false;
        }
        
        let selectedChestId: number;
        let selectedChest: any;
        
        if (chestIdInput === 0) {
            // Ищем "Основное"
            const mainChest = allChests.find(c => c.name === "Основное");
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
                selectedChestId = newMainChest.id;
                selectedChest = newMainChest;
            } else {
                selectedChestId = mainChest.id;
                selectedChest = mainChest;
            }
        } else {
            const chest = allChests.find(c => c.id === chestIdInput);
            if (!chest) {
                await context.send(`❌ Сундук с ID ${chestIdInput} не найден.`);
                return false;
            }
            selectedChestId = chestIdInput;
            selectedChest = chest;
        }
        
        // Проверяем, есть ли сундучки внутри
        const childChests = allChests.filter(c => c.id_parent === selectedChestId);
        
        if (childChests.length > 0) {
            let childText = `🎒 Выбран сундук: ${selectedChest.name}\n\n`;
            childText += `Выберите сундучок:\n`;
            childText += `🎒 [${selectedChestId}] Оставить в выбранном сундуке\n`;
            
            for (const child of childChests) {
                childText += `      🧳 [${child.id}] ${child.name}\n`;
            }

            childText += `\nВведите ID сундучка (или ${selectedChestId} сундука):`;
            
            const childIdInput = await Input_Number(context, childText, true);
            if (childIdInput === false) {
                await context.send(`❌ Отмена настройки привязки.`);
                return false;
            }
            
            if (childIdInput !== selectedChestId) {
                const selectedChild = childChests.find(c => c.id === childIdInput);
                if (!selectedChild) {
                    await context.send(`❌ Сундучок с ID ${childIdInput} не найден.`);
                    return false;
                }
                selectedChestId = childIdInput;
                selectedChest = selectedChild;
            }
        }
        
        // Запрашиваем подтверждение
        const confirmText = `привязать категорию "${category.name}" к сундуку "${selectedChest.name}"?`;
        const confirm = await Confirm_User_Success(context, confirmText);
        
        if (!confirm.status) {
            await context.send(`❌ Привязка отменена.`);
            return false;
        }
        
        // Спрашиваем о миграции существующих предметов
        if (currentBinding?.id_chest !== selectedChestId) {
            const migrateText = `🔄 Хотите перенести уже купленные товары этой категории в новый сундук "${selectedChest.name}"?\n\n` +
                `✅ Да — все существующие покупки этой категории будут перенесены\n` +
                `❌ Нет — только новые покупки будут попадать в новый сундук\n\n` +
                `💡 Рекомендуется выполнить миграцию, чтобы у всех игроков предметы были в одном сундуке.`;
            
            const migrateResponse = await context.question(migrateText, {
                keyboard: Keyboard.builder()
                    .textButton({ label: '✅ Да, перенести', payload: { command: 'migrate_yes' }, color: 'positive' })
                    .textButton({ label: '❌ Нет, оставить как есть', payload: { command: 'migrate_no' }, color: 'negative' })
                    .oneTime().inline(),
                answerTimeLimit
            });
            
            if (migrateResponse.isTimeout) {
                await context.send(`⏰ Время ожидания истекло.`);
                return false;
            }
            
            if (migrateResponse.payload?.command === 'migrate_yes') {
                await context.send(`🔄 Начинаю миграцию существующих покупок...`);
                const migrationSuccess = await migrateCategoryItems(context, categoryId, selectedChestId);
                
                if (!migrationSuccess) {
                    await context.send(`⚠ Миграция завершена с ошибками, но привязка будет сохранена.`);
                }
            } else {
                await context.send(`ℹ️ Миграция не выполнена. Только новые покупки будут попадать в сундук "${selectedChest.name}".`);
            }
        }
        
        // Сохраняем привязку
        try {
            ////console.log(`DEBUG: Saving category chest binding: categoryId=${categoryId}, chestId=${selectedChestId}`);
            
            // Просто создаем/обновляем привязку
            // Теперь разные категории могут быть привязаны к одному сундуку!
            await prisma.categoryChest.upsert({
                where: { id_category: categoryId },
                update: { id_chest: selectedChestId },
                create: {
                    id_category: categoryId,
                    id_chest: selectedChestId
                }
            });
            
            ////console.log(`DEBUG: Category chest binding saved successfully`);
            
        } catch (error: any) {
            console.error('Error saving category chest binding:', error);
            
            // Теперь должна быть только ошибка на id_category
            if (error.code === 'P2002' && error.meta?.target?.includes('id_category')) {
                await context.send(`❌ Категория "${category.name}" уже привязана к другому сундуку.`);
                
                // Находим текущую привязку
                const currentBinding = await prisma.categoryChest.findFirst({
                    where: { id_category: categoryId },
                    include: { chest: true }
                });
                
                if (currentBinding?.chest) {
                    const confirmOverwrite = await Confirm_User_Success(
                        context,
                        `перепривязать категорию "${category.name}" от сундука "${currentBinding.chest.name}" к сундуку "${selectedChest.name}"?`
                    );
                    
                    if (!confirmOverwrite.status) {
                        await context.send(`❌ Привязка отменена.`);
                        return false;
                    }
                    
                    // Обновляем привязку
                    await prisma.categoryChest.update({
                        where: { id_category: categoryId },
                        data: { id_chest: selectedChestId }
                    });
                    
                    await context.send(`✅ Категория "${category.name}" перепривязана к сундуку "${selectedChest.name}".`);
                    return true;
                }
            }
            
            await context.send(`❌ Ошибка при сохранении привязки: ${error.message}`);
            return false;
        }
        
        await context.send(`✅ Категория "${category.name}" привязана к сундуку: ${selectedChest.name} (ID: ${selectedChestId})`);
        
        // Логируем
        const admin = await prisma.user.findFirst({ where: { idvk: context.senderId } });
        const adminLogName = admin
            ? `@id${admin.idvk}(${admin.name}) (UID: ${admin.id})`
            : `@id${context.senderId}`;

        const logMessage = `🧷 Привязка категории магазина\n\n` +
            `📁 Категория: "${category.name}" (ID: ${categoryId})\n` +
            `🎒 Сундук: "${selectedChest.name}" (ID: ${selectedChestId})\n` +
            `👤 Админ: ${adminLogName}`;
        
        // Отправляем в чат магазина если настроен
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
        
        return true;
        
    } catch (error: any) {
        console.error('Error in getChestSelectionForCategory:', error);
        await context.send(`❌ Ошибка при настройке привязки: ${error.message}`);
        return false;
    }
}
