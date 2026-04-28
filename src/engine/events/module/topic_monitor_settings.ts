export interface MonitorTopicSettingsSource {
    id_coin?: number | null;
    id_topic_coin?: number | null;
    topicMinPcLines?: number | null;
    topicMinPcMessage?: string | null;
    topicRewardEnabled?: boolean | null;
    topicLinesRewards?: string | null;
    topicUniformReward?: number | null;
    topicRewardMinLines?: number | null;
}

export interface LegacyTopicSettingsSource {
    minPcLines?: number | null;
    minPcMessage?: string | null;
    rewardEnabled?: boolean | null;
    linesRewards?: string | null;
    uniformReward?: number | null;
    rewardMinLines?: number | null;
}

export interface TopicRewardSettings {
    minPcLines: number;
    minPcMessage: string | null;
    rewardEnabled: boolean;
    linesRewards: string | null;
    uniformReward: number | null;
    rewardMinLines: number;
}

export function getTopicRewardCoinId(monitor: MonitorTopicSettingsSource): number | null {
    return monitor.id_topic_coin ?? monitor.id_coin ?? null;
}

export function resolveTopicRewardSettings(
    monitor: MonitorTopicSettingsSource,
    legacyTopic?: LegacyTopicSettingsSource | null
): TopicRewardSettings {
    return {
        minPcLines: getNumberSetting(monitor, "topicMinPcLines", legacyTopic?.minPcLines ?? 0),
        minPcMessage: getNullableStringSetting(monitor, "topicMinPcMessage", legacyTopic?.minPcMessage ?? null),
        rewardEnabled: getBooleanSetting(monitor, "topicRewardEnabled", legacyTopic?.rewardEnabled ?? false),
        linesRewards: getNullableStringSetting(monitor, "topicLinesRewards", legacyTopic?.linesRewards ?? null),
        uniformReward: getNullableNumberSetting(monitor, "topicUniformReward", legacyTopic?.uniformReward ?? null),
        rewardMinLines: getNumberSetting(monitor, "topicRewardMinLines", legacyTopic?.rewardMinLines ?? 1)
    };
}

export function applyMonitorTopicSettings<T extends LegacyTopicSettingsSource>(
    topicMonitor: T,
    monitor: MonitorTopicSettingsSource
): T & TopicRewardSettings {
    const settings = resolveTopicRewardSettings(monitor, topicMonitor);

    return {
        ...topicMonitor,
        ...settings
    };
}

function getNumberSetting(
    source: MonitorTopicSettingsSource,
    key: "topicMinPcLines" | "topicRewardMinLines",
    fallback: number
): number {
    if (!hasOwnSetting(source, key)) {
        return fallback;
    }

    const value = source[key];

    return typeof value === "number" ? value : fallback;
}

function getNullableNumberSetting(
    source: MonitorTopicSettingsSource,
    key: "topicUniformReward",
    fallback: number | null
): number | null {
    if (!hasOwnSetting(source, key)) {
        return fallback;
    }

    const value = source[key];

    return typeof value === "number" ? value : null;
}

function getNullableStringSetting(
    source: MonitorTopicSettingsSource,
    key: "topicMinPcMessage" | "topicLinesRewards",
    fallback: string | null
): string | null {
    if (!hasOwnSetting(source, key)) {
        return fallback;
    }

    const value = source[key];

    return typeof value === "string" ? value : null;
}

function getBooleanSetting(
    source: MonitorTopicSettingsSource,
    key: "topicRewardEnabled",
    fallback: boolean
): boolean {
    if (!hasOwnSetting(source, key)) {
        return fallback;
    }

    const value = source[key];

    return typeof value === "boolean" ? value : fallback;
}

function hasOwnSetting(source: object, key: keyof MonitorTopicSettingsSource): boolean {
    return Object.prototype.hasOwnProperty.call(source, key);
}
