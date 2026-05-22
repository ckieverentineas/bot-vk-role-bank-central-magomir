import { Account, Alliance, AllianceCoin, User } from "@prisma/client";
import { vk } from "../../../..";
import { Antivirus_VK, Format_Number_Correction, Logger } from "../../../core/helper";
import { splitVkMessage } from "../../../core/vk_limits";
import prisma from "../prisma_client";

const HISTORY_PAGE_SIZE = 200;
const MAX_HISTORY_PAGES = 100;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NUMBER_EPSILON = 0.000001;

type FinanceStatCommand = {
    coinId: number;
    weekNumber: number;
};

type FinanceStatPeriod = {
    startDate: Date;
    endDate: Date;
    startUnix: number;
    endUnix: number;
};

type FinanceLogMessage = {
    date: number;
    text: string;
};

type FinanceStatIdentity = {
    uid: number | null;
    idvk: number | null;
    name: string;
};

type FinanceCoinDelta = FinanceStatIdentity & {
    delta: number;
};

type ResolvedFinanceCoinDelta = {
    uid: number;
    name: string;
    delta: number;
};

export async function Finance_Statistics_Command(context: any): Promise<void> {
    const anti_vk_defender = await Antivirus_VK(context);
    if (anti_vk_defender) { return; }

    const command = Parse_Command(context.text);
    if (!command) {
        await context.send('⚠ Формат команды: !стата <айди валюты> <номер недели>');
        return;
    }

    const user = await Get_Admin_User(context);
    if (!user?.id_alliance) { return; }

    const alliance: Alliance | null = await prisma.alliance.findFirst({
        where: { id: Number(user.id_alliance) }
    });
    if (!alliance) {
        await context.send('❌ Альянс выбранного персонажа не найден.');
        return;
    }

    if (!alliance.id_chat || alliance.id_chat <= 0) {
        await context.send('❌ Сначала привяжите финансовый лог-чат командой !привязать финансы.');
        return;
    }

    const coin = await prisma.allianceCoin.findFirst({
        where: {
            id: command.coinId,
            id_alliance: alliance.id
        }
    });
    if (!coin) {
        await context.send(`❌ Валюта ID ${command.coinId} не найдена в вашем альянсе.`);
        return;
    }

    const period = Build_Period(command.weekNumber);
    try {
        const messages = await Fetch_Log_Messages(alliance.id_chat, period);
        const stats = await Resolve_Coin_Deltas(Collect_Coin_Deltas(messages, coin), alliance.id);
        const response = Build_Response(stats, coin, period);

        for (const message of splitVkMessage(response)) {
            await context.send(message);
        }
    } catch (error: any) {
        await Logger(`Finance statistics failed for alliance ${alliance.id}, coin ${coin.id}: ${error?.message ?? error}`);
        await context.send('❌ Не удалось прочитать финансовый лог-чат. Проверьте, что бот состоит в привязанном чате и имеет доступ к истории.');
    }
}

function Parse_Command(text: string | undefined): FinanceStatCommand | null {
    const match = (text ?? '').trim().match(/^!стата\s+(\d+)\s+(\d+)$/i);
    if (!match) { return null; }

    const coinId = Number(match[1]);
    const weekNumber = Number(match[2]);
    if (!Number.isSafeInteger(coinId) || !Number.isSafeInteger(weekNumber) || coinId <= 0 || weekNumber <= 0) {
        return null;
    }

    return { coinId, weekNumber };
}

function Build_Period(weekNumber: number): FinanceStatPeriod {
    const endDate = new Date(Date.now() - ((weekNumber - 1) * WEEK_MS));
    const startDate = new Date(endDate.getTime() - WEEK_MS);

    return {
        startDate,
        endDate,
        startUnix: Math.floor(startDate.getTime() / 1000),
        endUnix: Math.floor(endDate.getTime() / 1000)
    };
}

async function Get_Admin_User(context: any): Promise<User | null> {
    const user = await Get_Selected_User_By_Sender(context);
    if (!user) {
        await context.send('❌ Сначала выберите персонажа для работы с банком.');
        return null;
    }

    const role = await prisma.role.findFirst({
        where: { id: user.id_role }
    });
    if (role?.name !== 'admin' && role?.name !== 'root') {
        await context.send('❌ Команда доступна только администраторам альянса.');
        return null;
    }

    if (!user.id_alliance || user.id_alliance <= 0) {
        await context.send('❌ Команда доступна только администраторам альянсов.');
        return null;
    }

    return user;
}

async function Get_Selected_User_By_Sender(context: any): Promise<User | null> {
    const account: Account | null = await prisma.account.findFirst({
        where: { idvk: context.senderId }
    });
    if (!account) { return null; }

    return prisma.user.findFirst({
        where: { id: account.select_user }
    });
}

async function Fetch_Log_Messages(peerId: number, period: FinanceStatPeriod): Promise<FinanceLogMessage[]> {
    if (!vk) {
        throw new Error('VK API is not initialized');
    }

    const messages: FinanceLogMessage[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
        const history = await vk.api.messages.getHistory({
            peer_id: peerId,
            count: HISTORY_PAGE_SIZE,
            offset,
            rev: 0
        });
        const items = history.items ?? [];
        if (items.length === 0) { break; }

        let reachedOlderMessages = false;
        for (const item of items) {
            if (!item.date || !item.text) { continue; }
            if (item.date > period.endUnix) { continue; }
            if (item.date < period.startUnix) {
                reachedOlderMessages = true;
                continue;
            }

            messages.push({
                date: item.date,
                text: item.text
            });
        }

        if (reachedOlderMessages) { break; }

        offset += items.length;
        if (offset >= history.count) { break; }
    }

    return messages;
}

function Collect_Coin_Deltas(messages: FinanceLogMessage[], coin: AllianceCoin): FinanceCoinDelta[] {
    const deltas = new Map<string, FinanceCoinDelta>();

    for (const message of messages) {
        let currentIdentity = Extract_Identity(message.text);

        for (const rawLine of message.text.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line) { continue; }

            const lineIdentity = Extract_Identity(line);
            if (lineIdentity) {
                currentIdentity = lineIdentity;
            }

            if (Should_Skip_Line(line)) { continue; }

            const delta = Parse_Coin_Delta(line, coin);
            if (delta === null || Math.abs(delta) < NUMBER_EPSILON || !currentIdentity) { continue; }

            const identityKey = Get_Identity_Key(currentIdentity);
            if (!identityKey) { continue; }

            const current = deltas.get(identityKey);
            if (current) {
                current.delta += delta;
                current.name = currentIdentity.name;
                continue;
            }

            deltas.set(identityKey, {
                ...currentIdentity,
                delta
            });
        }
    }

    return Array.from(deltas.values())
        .filter((stat) => Math.abs(stat.delta) >= NUMBER_EPSILON);
}

async function Resolve_Coin_Deltas(stats: FinanceCoinDelta[], allianceId: number): Promise<ResolvedFinanceCoinDelta[]> {
    const resolvedStats = new Map<number, ResolvedFinanceCoinDelta>();

    for (const stat of stats) {
        const resolvedStat = await Resolve_Coin_Delta(stat, allianceId);
        if (!resolvedStat) { continue; }

        const current = resolvedStats.get(resolvedStat.uid);
        if (current) {
            current.delta += resolvedStat.delta;
            current.name = resolvedStat.name;
            continue;
        }

        resolvedStats.set(resolvedStat.uid, resolvedStat);
    }

    return Array.from(resolvedStats.values())
        .filter((stat) => Math.abs(stat.delta) >= NUMBER_EPSILON)
        .sort((a, b) => {
            const deltaSort = b.delta - a.delta;
            if (Math.abs(deltaSort) >= NUMBER_EPSILON) { return deltaSort; }

            const nameSort = a.name.localeCompare(b.name, 'ru');
            if (nameSort !== 0) { return nameSort; }

            return a.uid - b.uid;
        });
}

async function Resolve_Coin_Delta(stat: FinanceCoinDelta, allianceId: number): Promise<ResolvedFinanceCoinDelta | null> {
    if (stat.uid) {
        return {
            uid: stat.uid,
            name: stat.name,
            delta: stat.delta
        };
    }

    if (!stat.idvk) { return null; }

    const userByName = await prisma.user.findFirst({
        where: {
            idvk: stat.idvk,
            id_alliance: allianceId,
            name: stat.name
        }
    });
    const user = userByName ?? await prisma.user.findFirst({
        where: {
            idvk: stat.idvk,
            id_alliance: allianceId
        }
    });
    if (!user) { return null; }

    return {
        uid: user.id,
        name: user.name || stat.name,
        delta: stat.delta
    };
}

function Get_Identity_Key(identity: FinanceStatIdentity): string | null {
    if (identity.uid) { return `uid:${identity.uid}`; }
    if (identity.idvk) { return `idvk:${identity.idvk}:${identity.name.toLowerCase()}`; }

    return null;
}

function Extract_Identity(text: string): FinanceStatIdentity | null {
    const targetMatch = text.match(/для\s+@id(\d+)\(([^)]+)\)(?:\s*\(UID:\s*(\d+)\))?/i);
    if (targetMatch) {
        return Build_Identity(targetMatch[2], targetMatch[3], targetMatch[1]);
    }

    const vkIdentity = Find_Last_Vk_Identity(text, /@id(\d+)\(([^)]+)\)(?:\s*\(UID:\s*(\d+)\))?/gi);
    if (vkIdentity) { return vkIdentity; }

    return Find_Last_Plain_Identity(text, /([^()\n@]+?)\s*\(UID:\s*(\d+)\)/gi);
}

function Find_Last_Vk_Identity(text: string, regexp: RegExp): FinanceStatIdentity | null {
    let lastIdentity: FinanceStatIdentity | null = null;
    let match: RegExpExecArray | null = regexp.exec(text);

    while (match) {
        const identity = Build_Identity(match[2], match[3], match[1]);
        if (identity) { lastIdentity = identity; }

        match = regexp.exec(text);
    }

    return lastIdentity;
}

function Find_Last_Plain_Identity(text: string, regexp: RegExp): FinanceStatIdentity | null {
    let lastIdentity: FinanceStatIdentity | null = null;
    let match: RegExpExecArray | null = regexp.exec(text);

    while (match) {
        const identity = Build_Identity(match[1], match[2], null);
        if (identity) { lastIdentity = identity; }

        match = regexp.exec(text);
    }

    return lastIdentity;
}

function Build_Identity(rawName: string, rawUid: string | undefined | null, rawIdvk: string | undefined | null): FinanceStatIdentity | null {
    const uid = rawUid ? Number(rawUid) : null;
    const idvk = rawIdvk ? Number(rawIdvk) : null;
    const name = Normalize_Name(rawName);
    if (uid !== null && (!Number.isSafeInteger(uid) || uid <= 0)) { return null; }
    if (idvk !== null && (!Number.isSafeInteger(idvk) || idvk <= 0)) { return null; }
    if (!uid && !idvk) { return null; }
    if (!name) { return null; }

    return { uid, idvk, name };
}

function Normalize_Name(name: string): string {
    return name
        .replace(/^[^A-Za-zА-Яа-яЁё0-9]+/, '')
        .replace(/^(?:Клиент|Получатель|Отправитель|Уведомление для|Новый владелец)\s*:?\s*/i, '')
        .trim();
}

function Should_Skip_Line(line: string): boolean {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('для факульт')) { return true; }
    if (line.startsWith('🌐') && !line.includes('UID:')) { return true; }

    return false;
}

function Parse_Coin_Delta(line: string, coin: AllianceCoin): number | null {
    if (!Line_Has_Coin_Marker(line, coin)) { return null; }

    const match = line.match(/(-?\d+(?:[.,]\d+)?)\s*([+-])\s*(\d+(?:[.,]\d+)?)\s*=\s*(-?\d+(?:[.,]\d+)?)/);
    if (!match) { return null; }

    const oldAmount = Parse_Log_Number(match[1]);
    const operationAmount = Parse_Log_Number(match[3]);
    const newAmount = Parse_Log_Number(match[4]);
    if (oldAmount === null || operationAmount === null || newAmount === null) { return null; }

    const signedOperationAmount = match[2] === '+' ? operationAmount : -operationAmount;
    const calculatedDelta = newAmount - oldAmount;

    if (Math.abs(calculatedDelta - signedOperationAmount) > NUMBER_EPSILON) {
        return calculatedDelta;
    }

    return signedOperationAmount;
}

function Line_Has_Coin_Marker(line: string, coin: AllianceCoin): boolean {
    if (coin.smile && line.includes(coin.smile)) { return true; }

    return Boolean(coin.name && line.toLowerCase().includes(coin.name.toLowerCase()));
}

function Parse_Log_Number(value: string): number | null {
    const parsed = Number(value.replace(',', '.'));
    if (!Number.isFinite(parsed)) { return null; }

    return parsed;
}

function Build_Response(stats: ResolvedFinanceCoinDelta[], coin: AllianceCoin, period: FinanceStatPeriod): string {
    if (stats.length === 0) {
        return `⚠ За период ${Format_Date(period.startDate)} - ${Format_Date(period.endDate)} изменений по валюте ${coin.name} ${coin.smile} не найдено.`;
    }

    return stats
        .map((stat, index) => `👤 ${index + 1} - UID-${stat.uid} ${stat.name} --> ${Format_Delta(stat.delta)}${coin.smile}`)
        .join('\n');
}

function Format_Delta(delta: number): string {
    const sign = delta >= 0 ? '+' : '-';
    const amount = Format_Number_Correction(Math.abs(delta));

    return `${sign}${amount}`;
}

function Format_Date(date: Date): string {
    return date.toLocaleDateString('ru-RU');
}
