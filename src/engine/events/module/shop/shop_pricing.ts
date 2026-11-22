/** Applies a category-wide sale and rounds the discounted price to a whole number. */
export function Calculate_Sale_Price(price: number, salePercent?: number | null): number {
    const percent = Number(salePercent ?? 0);
    if (!Number.isFinite(percent) || percent <= 0) return Number(price) || 0;
    const safePercent = Math.min(99, Math.max(0, percent));
    return Math.max(0, Math.round((Number(price) || 0) * (100 - safePercent) / 100));
}

export function Format_Sale_Price(price: number, salePercent?: number | null): string {
    const discounted = Calculate_Sale_Price(price, salePercent);
    return salePercent && salePercent > 0
        ? `${price} → ${discounted} (-${salePercent}%)`
        : `${price}`;
}
