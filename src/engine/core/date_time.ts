/**
 * Project date/time helpers.
 * APP_TIME_ZONE can be set in .env (for example: Europe/Amsterdam or Europe/Moscow).
 * If it is omitted, the Node.js process timezone is used.
 */
function resolveAppTimeZone(): string {
    const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const requested = String(process.env.APP_TIME_ZONE ?? "").trim();
    if (!requested) return fallback;

    try {
        new Intl.DateTimeFormat("ru-RU", { timeZone: requested }).format(new Date());
        return requested;
    } catch {
        console.warn(`Invalid APP_TIME_ZONE "${requested}"; using ${fallback}.`);
        return fallback;
    }
}

export function Get_App_Time_Zone(): string {
    // Resolve lazily because dotenv is loaded after application imports.
    return resolveAppTimeZone();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Adds exact 24-hour days to an instant; the result does not depend on server DST. */
export function Add_Exact_Days(date: Date, days: number): Date {
    if (!Number.isFinite(days) || days <= 0) {
        throw new Error("Количество дней должно быть положительным числом.");
    }
    return new Date(date.getTime() + days * DAY_MS);
}

export function Format_App_Date(date: Date): string {
    return new Intl.DateTimeFormat("ru-RU", {
        timeZone: Get_App_Time_Zone(),
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}

export function Format_App_Date_Time(date: Date): string {
    return new Intl.DateTimeFormat("ru-RU", {
        timeZone: Get_App_Time_Zone(),
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).format(date);
}
