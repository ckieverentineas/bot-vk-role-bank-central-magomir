import {
  applyMonitorTopicSettings,
  buildRewardBalanceChanges,
  getExtraRewardCoinIdForPostStatistic,
  getPostStatisticExtraRewardCoinId,
  getPostStatisticRewardCoinId,
  getRewardCoinIdForPostStatistic,
  getTopicExtraRewardCoinId,
  resolveTopicExtraRewardSettings,
  getTopicRewardCoinId,
  resolveTopicRewardSettings
} from "../src/engine/events/module/topic_monitor_settings";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected "${expected}", got "${actual}"`);
  }
}

const monitorSettings = {
  id_coin: 10,
  id_topic_coin: 20,
  id_topic_extra_coin: 30,
  topicMinPcLines: 3,
  topicMinPcMessage: "Пост слишком короткий",
  topicRewardEnabled: true,
  topicLinesRewards: null,
  topicUniformReward: 15,
  topicRewardMinLines: 2,
  topicExtraRewardEnabled: true,
  topicExtraLinesRewards: "[{\"lines\":4,\"reward\":8}]",
  topicExtraUniformReward: null,
  topicExtraRewardMinLines: 4
};

const legacyTopicSettings = {
  id: 77,
  name: "Северная локация",
  minPcLines: 1,
  minPcMessage: "Старое сообщение",
  rewardEnabled: false,
  linesRewards: "[{\"lines\":5,\"reward\":10}]",
  uniformReward: null,
  rewardMinLines: 5
};

assertEqual(
  getTopicRewardCoinId(monitorSettings),
  20,
  "Topic reward coin must prefer monitor topic currency"
);
assertEqual(
  getTopicExtraRewardCoinId(monitorSettings),
  30,
  "Extra topic reward coin must use its own monitor setting"
);

const resolvedSettings = resolveTopicRewardSettings(monitorSettings, legacyTopicSettings);

assertEqual(resolvedSettings.minPcLines, 3, "Monitor minimum PC lines must override topic setting");
assertEqual(resolvedSettings.minPcMessage, "Пост слишком короткий", "Monitor min message must override topic setting");
assertEqual(resolvedSettings.rewardEnabled, true, "Monitor reward flag must override topic setting");
assertEqual(resolvedSettings.uniformReward, 15, "Monitor uniform reward must override topic setting");
assertEqual(resolvedSettings.linesRewards, null, "Monitor line rewards must override topic setting");
assertEqual(resolvedSettings.rewardMinLines, 2, "Monitor reward minimum must override topic setting");

const effectiveTopic = applyMonitorTopicSettings(legacyTopicSettings, monitorSettings);

assertEqual(effectiveTopic.name, "Северная локация", "Effective topic must preserve location name");
assertEqual(effectiveTopic.minPcLines, 3, "Effective topic must use monitor minimum PC lines");
assertEqual(effectiveTopic.rewardEnabled, true, "Effective topic must use monitor reward flag");
assertEqual(effectiveTopic.uniformReward, 15, "Effective topic must use monitor uniform reward");

const fallbackSettings = resolveTopicRewardSettings(
  {
    id_coin: 10,
    id_topic_coin: null
  },
  legacyTopicSettings
);

assertEqual(getTopicRewardCoinId({ id_coin: 10, id_topic_coin: null }), 10, "Topic reward coin must fall back to monitor currency");
assertEqual(fallbackSettings.minPcLines, 1, "Missing monitor minimum PC lines must fall back to topic setting");
assertEqual(fallbackSettings.minPcMessage, "Старое сообщение", "Missing monitor message must fall back to topic setting");
assertEqual(fallbackSettings.rewardEnabled, false, "Missing monitor reward flag must fall back to topic setting");
assertEqual(fallbackSettings.linesRewards, "[{\"lines\":5,\"reward\":10}]", "Missing monitor line rewards must fall back to topic setting");
assertEqual(fallbackSettings.rewardMinLines, 5, "Missing monitor reward minimum must fall back to topic setting");

const extraSettings = resolveTopicExtraRewardSettings(monitorSettings);

assertEqual(extraSettings.rewardEnabled, true, "Extra reward flag must use extra monitor setting");
assertEqual(extraSettings.linesRewards, "[{\"lines\":4,\"reward\":8}]", "Extra reward steps must use extra monitor setting");
assertEqual(extraSettings.uniformReward, null, "Extra uniform reward must use extra monitor setting");
assertEqual(extraSettings.rewardMinLines, 4, "Extra reward minimum must use extra monitor setting");

assertEqual(
  getRewardCoinIdForPostStatistic(true, 12, monitorSettings),
  20,
  "Rewarded post statistic must store the topic reward coin"
);
assertEqual(
  getRewardCoinIdForPostStatistic(false, 0, monitorSettings),
  null,
  "Post statistic without reward must not store a reward coin"
);
assertEqual(
  getPostStatisticRewardCoinId({ rewardGiven: true, rewardAmount: 12, rewardCoinId: 30 }, monitorSettings),
  30,
  "Existing post statistic reward coin must be used for corrections"
);
assertEqual(
  getPostStatisticRewardCoinId({ rewardGiven: true, rewardAmount: 12, rewardCoinId: null }, monitorSettings),
  20,
  "Legacy rewarded post statistic without reward coin must fall back to current topic reward currency"
);

assertEqual(
  getExtraRewardCoinIdForPostStatistic(true, 8, monitorSettings),
  30,
  "Extra rewarded post statistic must store the extra topic reward coin"
);
assertEqual(
  getExtraRewardCoinIdForPostStatistic(false, 0, monitorSettings),
  null,
  "Post statistic without extra reward must not store an extra reward coin"
);
assertEqual(
  getPostStatisticExtraRewardCoinId({ extraRewardGiven: true, extraRewardAmount: 8, extraRewardCoinId: 40 }, monitorSettings),
  40,
  "Existing post statistic extra reward coin must be used for corrections"
);
assertEqual(
  getPostStatisticExtraRewardCoinId({ extraRewardGiven: true, extraRewardAmount: 8, extraRewardCoinId: null }, monitorSettings),
  30,
  "Legacy extra rewarded post statistic must fall back to current extra currency"
);

const sameCoinChanges = buildRewardBalanceChanges(5, 20, 12, 20);
assertEqual(sameCoinChanges.length, 1, "Same coin reward edit must produce one balance change");
assertEqual(sameCoinChanges[0].coinId, 20, "Same coin reward edit must target the reward coin");
assertEqual(sameCoinChanges[0].amountChange, 7, "Same coin reward edit must apply only the delta");

const changedCoinChanges = buildRewardBalanceChanges(5, 10, 12, 20);
assertEqual(changedCoinChanges.length, 2, "Changed reward coin edit must produce two balance changes");
assertEqual(changedCoinChanges[0].coinId, 10, "Changed reward coin edit must subtract from the old coin");
assertEqual(changedCoinChanges[0].amountChange, -5, "Changed reward coin edit must remove old reward");
assertEqual(changedCoinChanges[1].coinId, 20, "Changed reward coin edit must add to the new coin");
assertEqual(changedCoinChanges[1].amountChange, 12, "Changed reward coin edit must add new reward");
