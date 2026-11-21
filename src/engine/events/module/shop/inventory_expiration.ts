import prisma from "../prisma_client";
import { Add_Exact_Days } from "../../../core/date_time";

/** Calculates the absolute expiry instant for one purchased item. */
export function Calculate_Item_Expiry(
    purchaseDate: Date,
    expirationDays?: number | null
): Date | null {
    if (expirationDays === null || expirationDays === undefined) return null;
    if (!Number.isInteger(expirationDays) || expirationDays <= 0) return null;
    return Add_Exact_Days(purchaseDate, expirationDays);
}

/** Removes expired inventory entries; linked chest entries are removed by FK cascade. */
export async function Cleanup_Expired_Inventory_Items(): Promise<number> {
    const result = await prisma.inventory.deleteMany({
        where: {
            expiresAt: { lte: new Date() }
        }
    });
    return result.count;
}

export function Format_Expiration_Days(days?: number | null): string {
    if (!Number.isInteger(days) || !days || days <= 0) return "без срока годности";
    if (days % 7 === 0) {
        const weeks = days / 7;
        return `${weeks} ${weeks === 1 ? "неделя" : weeks >= 2 && weeks <= 4 ? "недели" : "недель"} (${days} дн.)`;
    }
    return `${days} дн.`;
}
