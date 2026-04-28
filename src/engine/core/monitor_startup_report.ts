import { VK_MESSAGE_MAX_LENGTH, splitVkMessage } from "./vk_limits";

export type MonitorStartupStatus = "started" | "already_running" | "failed";

export interface MonitorStartupReportItem {
    allianceId: number;
    allianceName: string;
    monitorId: number;
    monitorName: string;
    groupId: number;
    topicCount: number;
    status: MonitorStartupStatus;
    errorMessage?: string;
}

interface MonitorStartupReportGroup {
    allianceId: number;
    allianceName: string;
    items: MonitorStartupReportItem[];
}

export function buildMonitorStartupReportMessages(
    items: readonly MonitorStartupReportItem[],
    maxLength: number = VK_MESSAGE_MAX_LENGTH
): string[] {
    if (items.length === 0) {
        return [];
    }

    const groups = groupByAlliance(items);
    const messages: string[] = [];

    for (const group of groups) {
        const groupMessage = buildGroupMessage(group);
        messages.push(...splitVkMessage(groupMessage, maxLength));
    }

    return messages;
}

function groupByAlliance(items: readonly MonitorStartupReportItem[]): MonitorStartupReportGroup[] {
    const groups: MonitorStartupReportGroup[] = [];
    const groupByAllianceId = new Map<number, MonitorStartupReportGroup>();

    for (const item of items) {
        let group = groupByAllianceId.get(item.allianceId);

        if (!group) {
            group = {
                allianceId: item.allianceId,
                allianceName: item.allianceName,
                items: []
            };

            groupByAllianceId.set(item.allianceId, group);
            groups.push(group);
        }

        group.items.push(item);
    }

    return groups;
}

function buildGroupMessage(group: MonitorStartupReportGroup): string {
    const startedCount = countByStatus(group.items, "started");
    const alreadyRunningCount = countByStatus(group.items, "already_running");
    const failedCount = countByStatus(group.items, "failed");
    const topicCount = group.items.reduce((sum, item) => sum + item.topicCount, 0);

    const lines = [
        "📡 Старт мониторов",
        `🎭 Ролевая: ${group.allianceName} (ID: ${group.allianceId})`,
        `📊 Всего: ${group.items.length}; запущено: ${startedCount}; уже работали: ${alreadyRunningCount}; ошибок: ${failedCount}; обсуждений: ${topicCount}`,
        "",
        ...group.items.map(formatMonitorLine)
    ];

    return lines.join("\n");
}

function countByStatus(
    items: readonly MonitorStartupReportItem[],
    status: MonitorStartupStatus
): number {
    return items.filter((item) => item.status === status).length;
}

function formatMonitorLine(item: MonitorStartupReportItem): string {
    const statusText = getStatusText(item);
    const topicText = item.topicCount > 0
        ? `обсуждений: ${item.topicCount}`
        : "обсуждений нет";

    return `• №${item.monitorId} ${item.monitorName} — ${statusText}; https://vk.com/club${Math.abs(item.groupId)}; ${topicText}`;
}

function getStatusText(item: MonitorStartupReportItem): string {
    if (item.status === "started") {
        return "запущен";
    }

    if (item.status === "already_running") {
        return "уже был запущен";
    }

    return item.errorMessage ? `ошибка: ${item.errorMessage}` : "ошибка запуска";
}
