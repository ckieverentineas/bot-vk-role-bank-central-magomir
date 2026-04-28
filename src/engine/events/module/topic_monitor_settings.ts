export interface MonitorTopicSettingsSource {
    id_coin?: number | null;
    id_topic_coin?: number | null;
    id_topic_extra_coin?: number | null;
    topicMinPcLines?: number | null;
    topicMinPcMessage?: string | null;
    topicRewardEnabled?: boolean | null;
    topicLinesRewards?: string | null;
    topicUniformReward?: number | null;
    topicRewardMinLines?: number | null;
    topicExtraRewardEnabled?: boolean | null;
    topicExtraLinesRewards?: string | null;
    topicExtraUniformReward?: number | null;
    topicExtraRewardMinLines?: number | null;
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

export interface TopicCurrencyRewardSettings {
    rewardEnabled: boolean;
    linesRewards: string | null;
    uniformReward: number | null;
    rewardMinLines: number;
}

export interface PostStatisticRewardSource {
    rewardGiven?: boolean | null;
    rewardAmount?: number | null;
    rewardCoinId?: number | null;
}

export interface PostStatisticExtraRewardSource {
    extraRewardGiven?: boolean | null;
    extraRewardAmount?: number | null;
    extraRewardCoinId?: number | null;
}

export interface RewardBalanceChange {
    coinId: number;
    amountChange: number;
}

export function getTopicRewardCoinId(monitor: MonitorTopicSettingsSource): number | null {
    return monitor.id_topic_coin ?? monitor.id_coin ?? null;
}

export function getTopicExtraRewardCoinId(monitor: MonitorTopicSettingsSource): number | null {
    return monitor.id_topic_extra_coin ?? null;
}

export function getRewardCoinIdForPostStatistic(
    rewardGiven: boolean,
    rewardAmount: number | null,
    monitor: MonitorTopicSettingsSource
): number | null {
    return rewardGiven && (rewardAmount ?? 0) > 0
        ? getTopicRewardCoinId(monitor)
        : null;
}

export function getPostStatisticRewardCoinId(
    postStatistic: PostStatisticRewardSource | null | undefined,
    monitor: MonitorTopicSettingsSource
): number | null {
    if (!postStatistic?.rewardGiven || !postStatistic.rewardAmount || postStatistic.rewardAmount <= 0) {
        return null;
    }

    return postStatistic.rewardCoinId ?? getTopicRewardCoinId(monitor);
}

export function getExtraRewardCoinIdForPostStatistic(
    extraRewardGiven: boolean,
    extraRewardAmount: number | null,
    monitor: MonitorTopicSettingsSource
): number | null {
    return extraRewardGiven && (extraRewardAmount ?? 0) > 0
        ? getTopicExtraRewardCoinId(monitor)
        : null;
}

export function getPostStatisticExtraRewardCoinId(
    postStatistic: PostStatisticExtraRewardSource | null | undefined,
    monitor: MonitorTopicSettingsSource
): number | null {
    if (!postStatistic?.extraRewardGiven || !postStatistic.extraRewardAmount || postStatistic.extraRewardAmount <= 0) {
        return null;
    }

    return postStatistic.extraRewardCoinId ?? getTopicExtraRewardCoinId(monitor);
}

export function buildRewardBalanceChanges(
    oldRewardAmount: number,
    oldRewardCoinId: number | null,
    newRewardAmount: number,
    newRewardCoinId: number | null
): RewardBalanceChange[] {
    const changes = new Map<number, number>();

    addRewardBalanceChange(changes, oldRewardCoinId, -Math.max(0, oldRewardAmount));
    addRewardBalanceChange(changes, newRewardCoinId, Math.max(0, newRewardAmount));

    return Array.from(changes.entries())
        .filter(([, amountChange]) => amountChange !== 0)
        .map(([coinId, amountChange]) => ({ coinId, amountChange }));
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

export function resolveTopicExtraRewardSettings(monitor: MonitorTopicSettingsSource): TopicCurrencyRewardSettings {
    return {
        rewardEnabled: getBooleanSetting(monitor, "topicExtraRewardEnabled", false),
        linesRewards: getNullableStringSetting(monitor, "topicExtraLinesRewards", null),
        uniformReward: getNullableNumberSetting(monitor, "topicExtraUniformReward", null),
        rewardMinLines: getNumberSetting(monitor, "topicExtraRewardMinLines", 1)
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
    key: "topicMinPcLines" | "topicRewardMinLines" | "topicExtraRewardMinLines",
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
    key: "topicUniformReward" | "topicExtraUniformReward",
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
    key: "topicMinPcMessage" | "topicLinesRewards" | "topicExtraLinesRewards",
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
    key: "topicRewardEnabled" | "topicExtraRewardEnabled",
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

function addRewardBalanceChange(changes: Map<number, number>, coinId: number | null, amountChange: number): void {
    if (!coinId || amountChange === 0) {
        return;
    }

    changes.set(coinId, (changes.get(coinId) ?? 0) + amountChange);
}
