ALTER TABLE "Monitor" ADD COLUMN "id_topic_extra_coin" INTEGER;
ALTER TABLE "Monitor" ADD COLUMN "topicExtraRewardEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Monitor" ADD COLUMN "topicExtraLinesRewards" TEXT;
ALTER TABLE "Monitor" ADD COLUMN "topicExtraUniformReward" REAL;
ALTER TABLE "Monitor" ADD COLUMN "topicExtraRewardMinLines" INTEGER DEFAULT 1;

ALTER TABLE "PostStatistic" ADD COLUMN "rewardCoinId" INTEGER;
ALTER TABLE "PostStatistic" ADD COLUMN "extraRewardGiven" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PostStatistic" ADD COLUMN "extraRewardAmount" REAL;
ALTER TABLE "PostStatistic" ADD COLUMN "extraRewardCoinId" INTEGER;

UPDATE "PostStatistic"
SET "rewardCoinId" = (
    SELECT "Monitor"."id_coin"
    FROM "TopicMonitor"
    JOIN "Monitor" ON "Monitor"."id" = "TopicMonitor"."monitorId"
    WHERE "TopicMonitor"."id" = "PostStatistic"."topicMonitorId"
    LIMIT 1
)
WHERE "rewardGiven" = true
  AND COALESCE("rewardAmount", 0) > 0;
