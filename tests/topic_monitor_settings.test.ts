import {
  applyMonitorTopicSettings,
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
  topicMinPcLines: 3,
  topicMinPcMessage: "Пост слишком короткий",
  topicRewardEnabled: true,
  topicLinesRewards: null,
  topicUniformReward: 15,
  topicRewardMinLines: 2
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
