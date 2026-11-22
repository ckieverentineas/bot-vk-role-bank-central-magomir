import { KeyboardBuilder } from "vk-io";
import { answerTimeLimit } from "../../../..";
import prisma from "../prisma_client";
import { Input_Number, Send_Message } from "../../../core/helper";
import { isAdmin } from "../../../core/permissions";
import { InventoryType } from "../data_center/standart";
import { Calculate_Item_Expiry } from "./inventory_expiration";

/** Give shop items to another character for free while consuming finite shop stock. */
export async function Give_Shop_Item_Free(
    context: any,
    item: any,
    category: any,
    shop: any,
    alliance: any,
    adminUser: any
): Promise<void> {
    // Защита не только на уровне кнопки: повторно проверяем системную роль.
    if (!(await isAdmin(adminUser))) {
        await context.send(`❌ Бесплатная выдача доступна только системным администраторам.`);
        return;
    }

    const targetUid = await Input_Number(
        context,
        `🎁 Бесплатная выдача товара «${item.name}»\nВведите UID персонажа-получателя:`,
        false
    );
    if (targetUid === false) return;

    const target = await prisma.user.findFirst({
        where: { id: Number(targetUid), id_alliance: alliance.id }
    });
    if (!target) {
        await context.send(`❌ Персонаж с UID ${targetUid} не найден в этой ролевой.`);
        return;
    }

    const countValue = await Input_Number(
        context,
        `Введите количество товара «${item.name}» для бесплатной выдачи. ${item.limit_tr ? `Остаток магазина: ${item.limit}.` : 'Товар без складского лимита.'}`,
        false,
        9
    );
    if (countValue === false || !Number.isInteger(Number(countValue)) || Number(countValue) <= 0) {
        await context.send(`❌ Количество должно быть положительным целым числом.`);
        return;
    }
    const count = Number(countValue);
    if (item.limit_tr && item.limit < count) {
        await context.send(`❌ На складе только ${item.limit} шт. Запрошено: ${count}.`);
        return;
    }

    const destinationKeyboard = new KeyboardBuilder()
        .textButton({ label: '📁 Сундук категории', payload: { command: 'shop_gift_category_chest' }, color: 'positive' })
        .textButton({ label: '🎒 Выбрать сундук', payload: { command: 'shop_gift_choose_chest' }, color: 'secondary' })
        .inline().oneTime();

    const destinationAnswer = await context.question(
        `🎒 Куда положить «${item.name}» для ${target.name}?`,
        { keyboard: destinationKeyboard, answerTimeLimit }
    );
    if (destinationAnswer.isTimeout) {
        await context.send(`⏰ Время выбора сундука истекло.`);
        return;
    }

    let chest: any = null;
    if (destinationAnswer.payload?.command === 'shop_gift_category_chest') {
        const binding = await prisma.categoryChest.findFirst({
            where: { id_category: category.id },
            include: { chest: true }
        });
        if (binding?.chest && binding.chest.id_alliance === target.id_alliance) {
            chest = binding.chest;
        }
    } else if (destinationAnswer.payload?.command === 'shop_gift_choose_chest') {
        const chests = await prisma.allianceChest.findMany({
            where: { id_alliance: target.id_alliance ?? 0 },
            orderBy: [{ id_parent: 'asc' }, { order: 'asc' }, { id: 'asc' }]
        });
        if (chests.length === 0) {
            await context.send(`❌ У персонажа пока нет сундуков.`);
            return;
        }
        const chestList = chests.map((entry: any) =>
            `${entry.id_parent ? '  ↳ ' : '🎒 '}[${entry.id}] ${entry.name}`
        ).join('\n');
        const chestId = await Input_Number(
            context,
            `Выберите сундук для ${target.name}, введя его ID:\n\n${chestList}`,
            false
        );
        if (chestId === false) return;
        chest = chests.find((entry: any) => entry.id === Number(chestId)) ?? null;
        if (!chest) {
            await context.send(`❌ Сундук с ID ${chestId} не найден.`);
            return;
        }
    } else {
        await context.send(`❌ Выбор места хранения отменён.`);
        return;
    }

    // If the category has no configured chest, or its binding is absent, use/create Основное.
    if (!chest) {
        chest = await prisma.allianceChest.findFirst({
            where: { id_alliance: target.id_alliance ?? 0, name: 'Основное', id_parent: null }
        });
        if (!chest) {
            chest = await prisma.allianceChest.create({
                data: { name: 'Основное', id_alliance: target.id_alliance ?? 0, id_parent: null, order: 0 }
            });
        }
    }

    const purchaseDate = new Date();
    const expiresAt = Calculate_Item_Expiry(purchaseDate, item.expirationDays);
    const comment = `Бесплатная выдача из магазина «${shop.name}» администратором ${adminUser.name} (UID: ${adminUser.id})`;

    // Выдача аналогична покупке по количеству и складскому остатку,
    // но без списания валюты и без начисления владельцу магазина.
    try {
        await prisma.$transaction(async (tx: any) => {
            if (item.limit_tr) {
                const stockUpdate = await tx.allianceShopItem.updateMany({
                    where: { id: item.id, limit: { gte: count } },
                    data: { limit: { decrement: count } }
                });
                if (stockUpdate.count !== 1) {
                    throw new Error('Недостаточно товара на складе: остаток изменился во время выдачи.');
                }
            }

            for (let i = 0; i < count; i++) {
                const inventoryItem = await tx.inventory.create({
                    data: {
                        id_user: target.id,
                        id_item: item.id,
                        type: InventoryType.ITEM_SHOP_ALLIANCE,
                        comment,
                        purchaseDate,
                        expiresAt
                    }
                });
                await tx.chestItemLink.create({
                    data: { id_chest: chest.id, id_inventory: inventoryItem.id }
                });
            }
        });
    } catch (error: any) {
        await context.send(`❌ Бесплатная выдача не выполнена: ${error?.message ?? error}`);
        return;
    }

    await Send_Message(
        target.idvk,
        `🎁 Вам бесплатно выдали товар из магазина «${shop.name}»!\n` +
        `📦 Предмет: «${item.name}» × ${count}\n` +
        `🎒 Сундук: ${chest.name}\n` +
        (expiresAt ? `⌛ Годен до: ${expiresAt.toLocaleString('ru-RU')}\n` : '')
    );

    const logMessage =
        `🎁 Бесплатная выдача товара из магазина\n` +
        `👤 Получатель: @id${target.idvk}(${target.name}) (UID: ${target.id})\n` +
        `🛍 Магазин: «${shop.name}» / категория «${category.name}»\n` +
        `📦 Товар: «${item.name}» × ${count}\n` +
        `🎒 Сундук: ${chest.name}\n` +
        `🗿 Инициатор: @id${adminUser.idvk}(${adminUser.name}) (UID: ${adminUser.id})`;

    if (alliance.id_chat_shop && alliance.id_chat_shop > 0) {
        await Send_Message(alliance.id_chat_shop, logMessage);
    }
    const updatedItem = item.limit_tr
        ? await prisma.allianceShopItem.findFirst({ where: { id: item.id }, select: { limit: true } })
        : null;
    await context.send(`✅ Выдано: «${item.name}» × ${count} → ${target.name}, сундук «${chest.name}».` +
        (item.limit_tr ? `\n📦 Остаток магазина: ${updatedItem?.limit ?? 'не удалось получить'}` : ''));
}
