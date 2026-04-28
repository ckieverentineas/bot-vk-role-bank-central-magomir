export type ParseItemIdsResult =
    | { status: "success"; itemIds: number[] }
    | { status: "error"; message: string };

export interface TransferItemOwnershipInput {
    allianceId: number;
    allianceCoinIds: readonly number[];
    itemCategoryId: number;
    itemCoinId: number;
    category: TransferItemCategory | null;
    shop: TransferItemShop | null;
}

export interface TransferItemCategory {
    id: number;
    name: string;
}

export interface TransferItemShop {
    allianceId: number;
    name: string;
}

export type TransferItemOwnership =
    | {
        status: "owned";
        categoryName: string;
        shopName: string;
        isLegacy: boolean;
    }
    | { status: "foreign" };

export interface TransferItemLogInfo {
    id: number;
    name: string;
}

export function parseItemIdsText(text: string): ParseItemIdsResult {
    const tokens = text.trim().split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
        return {
            status: "error",
            message: "Введите хотя бы один ID товара."
        };
    }

    const invalidTokens = tokens.filter((token) => !isPositiveIntegerToken(token));

    if (invalidTokens.length > 0) {
        return {
            status: "error",
            message: `Некорректные ID товаров: ${invalidTokens.join(", ")}. Используйте положительные целые числа через пробел.`
        };
    }

    return {
        status: "success",
        itemIds: getUniqueIds(tokens.map(Number))
    };
}

export function resolveTransferItemOwnership(input: TransferItemOwnershipInput): TransferItemOwnership {
    const categoryBelongsToAlliance = Boolean(
        input.category &&
        input.shop &&
        input.shop.allianceId === input.allianceId
    );

    if (categoryBelongsToAlliance && input.category && input.shop) {
        return {
            status: "owned",
            categoryName: input.category.name,
            shopName: input.shop.name,
            isLegacy: false
        };
    }

    if (input.allianceCoinIds.includes(input.itemCoinId)) {
        return {
            status: "owned",
            categoryName: `Легаси-категория ${input.itemCategoryId}`,
            shopName: "Удалённая категория",
            isLegacy: true
        };
    }

    return { status: "foreign" };
}

export function buildTransferItemLogSummary(
    items: readonly TransferItemLogInfo[],
    maxLength: number
): string {
    if (maxLength < 1) {
        return "";
    }

    const header = `${items.length} товар(ов): `;
    let summary = header;
    let visibleCount = 0;

    for (const item of items) {
        const itemText = `${item.id}-${item.name}`;
        const separator = visibleCount > 0 ? ", " : "";
        const nextSummary = `${summary}${separator}${itemText}`;
        const remainingCount = items.length - visibleCount - 1;
        const tail = remainingCount > 0 ? `, ещё ${remainingCount}` : "";

        if (nextSummary.length + tail.length > maxLength) {
            return appendRemainingCount(summary, items.length - visibleCount, maxLength);
        }

        summary = nextSummary;
        visibleCount++;
    }

    return summary.slice(0, maxLength);
}

function isPositiveIntegerToken(token: string): boolean {
    if (!/^\d+$/.test(token)) {
        return false;
    }

    const value = Number(token);

    return Number.isSafeInteger(value) && value > 0;
}

function getUniqueIds(ids: readonly number[]): number[] {
    const seenIds = new Set<number>();
    const uniqueIds: number[] = [];

    for (const id of ids) {
        if (seenIds.has(id)) {
            continue;
        }

        seenIds.add(id);
        uniqueIds.push(id);
    }

    return uniqueIds;
}

function appendRemainingCount(text: string, remainingCount: number, maxLength: number): string {
    const tailText = `ещё ${remainingCount}`;

    if (tailText.length >= maxLength) {
        return tailText.slice(0, maxLength);
    }

    const separator = text.trimEnd().endsWith(":") ? " " : ", ";
    const tail = `${separator}${tailText}`;
    const availableTextLength = maxLength - tail.length;
    const trimmedText = text
        .slice(0, availableTextLength)
        .replace(/[,\s]+$/g, "");

    return `${trimmedText}${tail}`;
}
