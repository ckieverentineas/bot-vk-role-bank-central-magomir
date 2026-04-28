UPDATE "PostStatistic"
SET "rewardCoinId" = (
    SELECT COALESCE("Monitor"."id_topic_coin", "Monitor"."id_coin")
    FROM "TopicMonitor"
    JOIN "Monitor" ON "Monitor"."id" = "TopicMonitor"."monitorId"
    WHERE "TopicMonitor"."id" = "PostStatistic"."topicMonitorId"
    LIMIT 1
)
WHERE "rewardGiven" = true
  AND COALESCE("rewardAmount", 0) > 0;
