import prisma from "../prisma_client";
import { Add_Exact_Days } from "../../../core/date_time";
import { Logger, Send_Message } from "../../../core/helper";

/** Calculates the absolute expiry instant for one inventory item. */
export function Calculate_Item_Expiry(
    purchaseDate: Date,
    expirationDays?: number | null
): Date | null {
    if (expirationDays === null || expirationDays === undefined) return null;
    if (!Number.isInteger(expirationDays) || expirationDays <= 0) return null;
    return Add_Exact_Days(purchaseDate, expirationDays);
}

/** Parses values such as 14д, 2н, or нет. */
export function Parse_Expiration_Days(rawValue: string): { valid: boolean; days: number | null } {
    const raw = String(rawValue ?? "").trim().toLowerCase().replace(/\s+/g, "");
    if (["нет", "0", "безсрока", "бессрочно"].includes(raw)) {
        return { valid: true, days: null };
    }

    const match = raw.match(/^(\d+)(д|дн|день|дня|дней|н|нед|неделя|недели|недель)?$/);
    if (!match) return { valid: false, days: null };

    const amount = Number(match[1]);
    const unit = match[2] ?? "д";
    const days = unit.startsWith("н") ? amount * 7 : amount;
    if (!Number.isInteger(days) || days <= 0 || days > 36500) {
        return { valid: false, days: null };
    }
    return { valid: true, days };
}

/** Removes expired inventory entries and notifies each affected player and alliance log chat. */
export async function Cleanup_Expired_Inventory_Items(): Promise<number> {
    const expired = await prisma.inventory.findMany({
        where: { expiresAt: { lte: new Date() } },
        include: {
            user: true,
            ChestItemLink: { include: { chest: true } }
        },
        orderBy: [{ id_user: "asc" }, { id_item: "asc" }, { id: "asc" }]
    });

    if (expired.length === 0) return 0;

    type ExpiredGroup = {
        user: (typeof expired)[number]["user"];
        type: string;
        itemId: number;
        chestId: number | null;
        chestName: string | null;
        itemName: string;
        inventoryIds: number[];
    };

    const groups = new Map<string, ExpiredGroup>();
    const itemNameCache = new Map<string, string>();

    for (const entry of expired) {
        const chest = entry.ChestItemLink?.chest ?? null;
        const key = `${entry.id_user}|${entry.type}|${entry.id_item}|${chest?.id ?? 0}`;
        let itemName = itemNameCache.get(`${entry.type}|${entry.id_item}`);

        if (!itemName) {
            try {
                if (entry.type === "item_shop_alliance") {
                    const item = await prisma.allianceShopItem.findFirst({ where: { id: entry.id_item }, select: { name: true } });
                    itemName = item?.name;
                } else if (entry.type === "item_shop") {
                    const item = await prisma.item.findFirst({ where: { id: entry.id_item }, select: { name: true } });
                    itemName = item?.name;
                } else if (entry.type === "item_storage") {
                    const item = await prisma.itemStorage.findFirst({ where: { id: entry.id_item }, select: { name: true } });
                    itemName = item?.name;
                }
            } catch (error) {
                await Logger(`Не удалось определить название просроченного предмета ${entry.type}:${entry.id_item}: ${error}`);
            }
            itemName = itemName || `Неизвестный предмет (ID: ${entry.id_item})`;
            itemNameCache.set(`${entry.type}|${entry.id_item}`, itemName);
        }

        const group = groups.get(key) ?? {
            user: entry.user,
            type: entry.type,
            itemId: entry.id_item,
            chestId: chest?.id ?? null,
            chestName: chest?.name ?? null,
            itemName,
            inventoryIds: []
        };
        group.inventoryIds.push(entry.id);
        groups.set(key, group);
    }

    let deletedTotal = 0;
    const notificationsByUser = new Map<number, { user: ExpiredGroup["user"]; lines: string[] }>();
    const logsByChat = new Map<number, string[]>();

    for (const group of groups.values()) {
        try {
            // Delete only the records still present. Their ChestItemLink rows are removed by cascade.
            const deleted = await prisma.inventory.deleteMany({
                where: { id: { in: group.inventoryIds }, expiresAt: { lte: new Date() } }
            });
            if (deleted.count === 0) continue;
            deletedTotal += deleted.count;

            const quantity = deleted.count > 1 ? ` × ${deleted.count}` : "";
            const storagePlace = group.chestName
                ? `в сундуке «${group.chestName}»`
                : "в инвентаре";
            const line = `📦 ${storagePlace}: «${group.itemName}»${quantity}`;

            const userNotification = notificationsByUser.get(group.user.id) ?? {
                user: group.user,
                lines: []
            };
            userNotification.lines.push(line);
            notificationsByUser.set(group.user.id, userNotification);

            const alliance = group.user.id_alliance
                ? await prisma.alliance.findFirst({ where: { id: group.user.id_alliance }, select: { id_chat: true } })
                : null;
            const logLine =
                `🗑️ Истёк срок годности предмета\n` +
                `👤 Персонаж: @id${group.user.idvk}(${group.user.name}) (UID: ${group.user.id})\n` +
                `🎒 Место хранения: ${storagePlace}\n` +
                `📦 Предмет: «${group.itemName}»${quantity}`;

            // Log only to the corresponding roleplay main log chat (id_chat).
            // The global chat_id and shop-purchases chat (id_chat_shop) are not used.
            const targetChat = alliance?.id_chat ?? 0;
            if (targetChat > 0) {
                const logLines = logsByChat.get(targetChat) ?? [];
                logLines.push(logLine);
                logsByChat.set(targetChat, logLines);
            }
        } catch (error) {
            await Logger(`Ошибка удаления просроченного предмета ${group.itemName} у UID ${group.user.id}: ${error}`);
        }
    }

    // A player receives one compact message even when several different items expired at once.
    for (const { user, lines } of notificationsByUser.values()) {
        const message =
            `🗑️ Срок годности истёк!\n` +
            `У персонажа ${user.name} (UID: ${user.id}) закончился срок действия следующих предметов. Они удалены из инвентаря:\n\n` +
            lines.map((line) => `• ${line}`).join("\n");
        await Send_Message(user.idvk, message);
    }

    // Only the alliance's main log chat (id_chat) is used.
    for (const [targetChat, entries] of logsByChat.entries()) {
        await Send_Message(targetChat, `🗑️ Автоматическое удаление просроченных предметов\n\n${entries.join("\n\n")}`);
    }

    if (deletedTotal > 0) {
        await Logger(`Автоматическая очистка инвентаря: удалено ${deletedTotal} просроченных предметов; уведомления отправлены игрокам и в ролевые лог-чаты.`);
    }

    return deletedTotal;
}

export function Format_Expiration_Days(days?: number | null): string {
    if (!Number.isInteger(days) || !days || days <= 0) return "без срока годности";
    if (days % 7 === 0) {
        const weeks = days / 7;
        return `${weeks} ${weeks === 1 ? "неделя" : weeks >= 2 && weeks <= 4 ? "недели" : "недель"} (${days} дн.)`;
    }
    return `${days} дн.`;
}
