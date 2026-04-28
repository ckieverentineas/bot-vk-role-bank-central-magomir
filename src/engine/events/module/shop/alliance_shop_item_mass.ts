import { timer_text } from "../../../..";
import { Confirm_User_Success, Input_Number, Send_Message, Send_Message_Smart } from "../../../core/helper";
import { InventoryType } from "../data_center/standart";
import prisma from "../prisma_client";
import {
    buildTransferItemLogSummary,
    parseItemIdsText,
    resolveTransferItemOwnership
} from "./alliance_shop_item_mass_helpers";

interface QuestionResponse {
    isTimeout?: boolean;
    text?: string;
}

interface ShopMassContext {
    senderId: number;
    send(message: string, params?: unknown): Promise<unknown>;
    question(message: string, params?: unknown): Promise<QuestionResponse>;
}

interface CategoryInfo {
    id: number;
    name: string;
    shopId: number;
    shopName: string;
    chestId: number | null;
    chestName: string;
}

interface TransferItemInfo {
    id: number;
    name: string;
    hidden: boolean;
    categoryId: number;
    categoryName: string;
    shopName: string;
    inventoryCount: number;
}

interface TargetChestInfo {
    id: number | null;
    name: string;
}

interface MigrationResult {
    totalInventories: number;
    movedInventories: number;
    failedInventories: number;
}

export async function AllianceShopItem_Mass_Transfer(context: ShopMassContext, allianceId: number): Promise<void> {
    const categories = await getAllianceCategories(allianceId);

    if (categories.length === 0) {
        await context.send("❌ В этой ролевой пока нет категорий магазинов.");
        return;
    }

    const targetCategoryId = await Input_Number(
        context,
        buildCategorySelectionText(categories),
        false
    );

    if (targetCategoryId === false) {
        await context.send("❌ Перенос товаров отменён.");
        return;
    }

    const targetCategory = categories.find((category) => category.id === targetCategoryId);

    if (!targetCategory) {
        await context.send(`❌ Категория с ID ${targetCategoryId} не найдена в вашей ролевой.`);
        return;
    }

    const itemIds = await askItemIds(context);

    if (!itemIds) {
        return;
    }

    const validation = await getTransferItems(allianceId, itemIds);

    if (validation.missingItemIds.length > 0 || validation.foreignItemIds.length > 0) {
        await context.send(buildValidationErrorText(validation.missingItemIds, validation.foreignItemIds));
        return;
    }

    if (validation.items.length === 0) {
        await context.send("❌ Не найдено товаров для переноса.");
        return;
    }

    const targetChest = await getCategoryChestPreview(targetCategory.id, allianceId);
    await context.send(buildTransferPreviewText(validation.items, targetCategory, targetChest));

    const migrateConfirm = await Confirm_User_Success(
        context,
        `перенести уже купленные экземпляры этих товаров в сундук "${targetChest.name}"?`
    );
    await context.send(migrateConfirm.text);

    const shouldMigratePurchasedItems = migrateConfirm.status === true;
    const finalConfirm = await Confirm_User_Success(
        context,
        `перенести ${validation.items.length} товар(ов) в категорию "${targetCategory.name}"` +
        `${shouldMigratePurchasedItems ? ` и мигрировать уже купленные экземпляры в "${targetChest.name}"` : ""}?`
    );
    await context.send(finalConfirm.text);

    if (!finalConfirm.status) {
        await context.send("❌ Перенос товаров отменён.");
        return;
    }

    const movedShopItemsCount = await moveShopItemsToCategory(validation.items, targetCategory.id);
    let migrationResult: MigrationResult | null = null;
    let resolvedTargetChest = targetChest;

    if (shouldMigratePurchasedItems) {
        const targetChestForMigration = await ensureTargetChest(targetChest, allianceId);
        resolvedTargetChest = targetChestForMigration;
        migrationResult = await migratePurchasedItemsToChest(itemIds, targetChestForMigration.id);
    }

    const resultText = buildTransferResultText(
        validation.items.length,
        movedShopItemsCount,
        targetCategory,
        resolvedTargetChest,
        migrationResult
    );

    await context.send(resultText);
    await writeTransferLogs(context, allianceId, validation.items, targetCategory, resolvedTargetChest, migrationResult);
}

async function askItemIds(context: ShopMassContext): Promise<number[] | null> {
    const answer = await context.question(
        "🧳 Введите ID товаров, которые нужно перенести, через пробел:",
        timer_text
    );

    if (answer.isTimeout) {
        await context.send("⏰ Время ожидания ввода товаров истекло.");
        return null;
    }

    const parsed = parseItemIdsText(answer.text ?? "");

    if (parsed.status === "error") {
        await context.send(`❌ ${parsed.message}`);
        return null;
    }

    return parsed.itemIds;
}

async function getAllianceCategories(allianceId: number): Promise<CategoryInfo[]> {
    const shops = await prisma.allianceShop.findMany({
        where: { id_alliance: allianceId },
        orderBy: { id: "asc" }
    });

    if (shops.length === 0) {
        return [];
    }

    const shopById = new Map(shops.map((shop) => [shop.id, shop]));
    const categories = await prisma.allianceShopCategory.findMany({
        where: { id_alliance_shop: { in: shops.map((shop) => shop.id) } },
        orderBy: { id: "asc" }
    });

    const categoryIds = categories.map((category) => category.id);
    const bindings = categoryIds.length > 0
        ? await prisma.categoryChest.findMany({ where: { id_category: { in: categoryIds } } })
        : [];
    const chestIds = bindings.map((binding) => binding.id_chest);
    const chests = chestIds.length > 0
        ? await prisma.allianceChest.findMany({ where: { id: { in: chestIds } } })
        : [];

    const bindingByCategoryId = new Map(bindings.map((binding) => [binding.id_category, binding]));
    const chestById = new Map(chests.map((chest) => [chest.id, chest]));

    return categories.flatMap((category) => {
        const shop = shopById.get(category.id_alliance_shop);

        if (!shop) {
            return [];
        }

        const binding = bindingByCategoryId.get(category.id);
        const chest = binding ? chestById.get(binding.id_chest) : null;

        return [{
            id: category.id,
            name: category.name,
            shopId: shop.id,
            shopName: shop.name,
            chestId: chest?.id ?? null,
            chestName: chest?.name ?? "Основное"
        }];
    });
}

async function getTransferItems(
    allianceId: number,
    itemIds: readonly number[]
): Promise<{ items: TransferItemInfo[]; missingItemIds: number[]; foreignItemIds: number[] }> {
    const items = await prisma.allianceShopItem.findMany({
        where: { id: { in: [...itemIds] } }
    });

    const itemById = new Map(items.map((item) => [item.id, item]));
    const missingItemIds = itemIds.filter((itemId) => !itemById.has(itemId));
    const categoryIds = Array.from(new Set(items.map((item) => item.id_shop)));
    const categories = categoryIds.length > 0
        ? await prisma.allianceShopCategory.findMany({ where: { id: { in: categoryIds } } })
        : [];
    const shopIds = Array.from(new Set(categories.map((category) => category.id_alliance_shop)));
    const shops = shopIds.length > 0
        ? await prisma.allianceShop.findMany({ where: { id: { in: shopIds } } })
        : [];
    const allianceCoins = await prisma.allianceCoin.findMany({
        where: { id_alliance: allianceId },
        select: { id: true }
    });
    const allianceCoinIds = allianceCoins.map((coin) => coin.id);

    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const shopById = new Map(shops.map((shop) => [shop.id, shop]));
    const foreignItemIds: number[] = [];
    const transferItems: TransferItemInfo[] = [];

    for (const itemId of itemIds) {
        const item = itemById.get(itemId);

        if (!item) {
            continue;
        }

        const category = categoryById.get(item.id_shop);
        const shop = category ? shopById.get(category.id_alliance_shop) : null;
        const ownership = resolveTransferItemOwnership({
            allianceId,
            allianceCoinIds,
            itemCategoryId: item.id_shop,
            itemCoinId: item.id_coin,
            category: category
                ? {
                    id: category.id,
                    name: category.name
                }
                : null,
            shop: shop
                ? {
                    allianceId: shop.id_alliance,
                    name: shop.name
                }
                : null
        });

        if (ownership.status === "foreign") {
            foreignItemIds.push(item.id);
            continue;
        }

        const inventoryCount = await prisma.inventory.count({
            where: {
                id_item: item.id,
                type: InventoryType.ITEM_SHOP_ALLIANCE
            }
        });

        transferItems.push({
            id: item.id,
            name: item.name,
            hidden: item.hidden,
            categoryId: item.id_shop,
            categoryName: ownership.categoryName,
            shopName: ownership.shopName,
            inventoryCount
        });
    }

    return {
        items: transferItems,
        missingItemIds,
        foreignItemIds
    };
}

async function getCategoryChestPreview(categoryId: number, allianceId: number): Promise<TargetChestInfo> {
    const binding = await prisma.categoryChest.findFirst({
        where: { id_category: categoryId }
    });

    if (binding) {
        const chest = await prisma.allianceChest.findFirst({
            where: {
                id: binding.id_chest,
                id_alliance: allianceId
            }
        });

        if (chest) {
            return {
                id: chest.id,
                name: chest.name
            };
        }
    }

    const mainChest = await prisma.allianceChest.findFirst({
        where: {
            id_alliance: allianceId,
            name: "Основное"
        }
    });

    return {
        id: mainChest?.id ?? null,
        name: "Основное"
    };
}

async function ensureTargetChest(chest: TargetChestInfo, allianceId: number): Promise<{ id: number; name: string }> {
    if (chest.id !== null) {
        return {
            id: chest.id,
            name: chest.name
        };
    }

    const createdChest = await prisma.allianceChest.create({
        data: {
            name: "Основное",
            id_alliance: allianceId,
            id_parent: null,
            order: 0
        }
    });

    return {
        id: createdChest.id,
        name: createdChest.name
    };
}

async function moveShopItemsToCategory(items: readonly TransferItemInfo[], targetCategoryId: number): Promise<number> {
    const itemIdsToMove = items
        .filter((item) => item.categoryId !== targetCategoryId)
        .map((item) => item.id);

    if (itemIdsToMove.length === 0) {
        return 0;
    }

    const result = await prisma.allianceShopItem.updateMany({
        where: { id: { in: itemIdsToMove } },
        data: { id_shop: targetCategoryId }
    });

    return result.count;
}

async function migratePurchasedItemsToChest(
    itemIds: readonly number[],
    targetChestId: number
): Promise<MigrationResult> {
    const inventories = await prisma.inventory.findMany({
        where: {
            id_item: { in: [...itemIds] },
            type: InventoryType.ITEM_SHOP_ALLIANCE
        }
    });

    const inventoryIds = inventories.map((inventory) => inventory.id);
    const existingLinks = inventoryIds.length > 0
        ? await prisma.chestItemLink.findMany({ where: { id_inventory: { in: inventoryIds } } })
        : [];
    const linkByInventoryId = new Map(existingLinks.map((link) => [link.id_inventory, link]));

    let movedInventories = 0;
    let failedInventories = 0;

    for (const inventory of inventories) {
        try {
            const existingLink = linkByInventoryId.get(inventory.id);

            if (existingLink) {
                await prisma.chestItemLink.update({
                    where: { id: existingLink.id },
                    data: { id_chest: targetChestId }
                });
            } else {
                await prisma.chestItemLink.create({
                    data: {
                        id_chest: targetChestId,
                        id_inventory: inventory.id
                    }
                });
            }

            movedInventories++;
        } catch (error) {
            console.error(`Failed to migrate inventory ${inventory.id}:`, error);
            failedInventories++;
        }
    }

    return {
        totalInventories: inventories.length,
        movedInventories,
        failedInventories
    };
}

function buildCategorySelectionText(categories: readonly CategoryInfo[]): string {
    const lines = categories.map((category) =>
        `📁 ${category.id} — ${category.name} | магазин: ${category.shopName} | сундук: ${category.chestName}`
    );

    return limitMessage(
        `📦 Массовый перенос товаров между категориями\n\n` +
        `Введите ID категории, в которую нужно переложить товары:\n\n${lines.join("\n")}`
    );
}

function buildValidationErrorText(missingItemIds: readonly number[], foreignItemIds: readonly number[]): string {
    const lines = ["❌ Нельзя выполнить перенос товаров."];

    if (missingItemIds.length > 0) {
        lines.push(`Не найдены товары: ${missingItemIds.join(", ")}`);
    }

    if (foreignItemIds.length > 0) {
        lines.push(`Не принадлежат вашей ролевой: ${foreignItemIds.join(", ")}`);
    }

    return lines.join("\n");
}

function buildTransferPreviewText(
    items: readonly TransferItemInfo[],
    targetCategory: CategoryInfo,
    targetChest: TargetChestInfo
): string {
    const lines = items.map((item) => {
        const status = item.hidden ? "скрыт" : "видим";
        const place = item.categoryId === targetCategory.id
            ? "уже в этой категории"
            : `${item.shopName} / ${item.categoryName}`;

        return `🧳 ${item.id} — ${item.name} (${status}), сейчас: ${place}, куплено: ${item.inventoryCount}`;
    });

    return limitMessage(
        `📦 Предпросмотр переноса\n\n` +
        `Новая категория: ${targetCategory.name} (ID: ${targetCategory.id})\n` +
        `Сундук новых покупок: ${targetChest.name}${targetChest.id ? ` (ID: ${targetChest.id})` : ""}\n\n` +
        `${lines.join("\n")}`
    );
}

function buildTransferResultText(
    selectedItemsCount: number,
    movedShopItemsCount: number,
    targetCategory: CategoryInfo,
    targetChest: TargetChestInfo,
    migrationResult: MigrationResult | null
): string {
    let text = `✅ Массовый перенос товаров завершён\n\n` +
        `📁 Новая категория: ${targetCategory.name} (ID: ${targetCategory.id})\n` +
        `🧳 Выбрано товаров: ${selectedItemsCount}\n` +
        `🔄 Перенесено между категориями: ${movedShopItemsCount}`;

    if (migrationResult) {
        text += `\n🎒 Сундук купленных экземпляров: ${targetChest.name}` +
            `\n📦 Купленных экземпляров найдено: ${migrationResult.totalInventories}` +
            `\n🔄 Переложено в сундук: ${migrationResult.movedInventories}` +
            `\n❌ Ошибок миграции: ${migrationResult.failedInventories}`;
    } else {
        text += `\n🎒 Уже купленные экземпляры не мигрировали.`;
    }

    return text;
}

async function writeTransferLogs(
    context: ShopMassContext,
    allianceId: number,
    items: readonly TransferItemInfo[],
    targetCategory: CategoryInfo,
    targetChest: TargetChestInfo,
    migrationResult: MigrationResult | null
): Promise<void> {
    const itemText = buildTransferItemLogSummary(items, 2400);
    const migrationText = migrationResult
        ? `, купленные экземпляры: ${migrationResult.movedInventories}/${migrationResult.totalInventories} в сундук "${targetChest.name}"`
        : ", купленные экземпляры не мигрировали";
    const logMessage =
        `"Массовый перенос товаров" --> товары [${itemText}] перенесены в категорию ` +
        `[${targetCategory.id}-${targetCategory.name}]${migrationText}`;

    await Send_Message_Smart(context, logMessage, "admin_solo");
    await sendShopLogMessage(allianceId, `🧳 Массовый перенос товаров\n\n${logMessage}\n👤 Админ: @id${context.senderId}`);
}

async function sendShopLogMessage(allianceId: number, message: string): Promise<void> {
    const alliance = await prisma.alliance.findFirst({
        where: { id: allianceId }
    });

    if (!alliance?.id_chat_shop || alliance.id_chat_shop <= 0) {
        return;
    }

    await Send_Message(alliance.id_chat_shop, message);
}

function limitMessage(message: string): string {
    const maxLength = 3900;

    if (message.length <= maxLength) {
        return message;
    }

    return `${message.slice(0, maxLength - 80)}\n\n...список слишком длинный, остальные записи скрыты. ID всё равно можно ввести вручную.`;
}
