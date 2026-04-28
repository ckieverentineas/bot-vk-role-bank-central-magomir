ALTER TABLE "Monitor" ADD COLUMN "topicMinPcLines" INTEGER DEFAULT 1;
ALTER TABLE "Monitor" ADD COLUMN "topicMinPcMessage" TEXT;
ALTER TABLE "Monitor" ADD COLUMN "topicRewardEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Monitor" ADD COLUMN "topicLinesRewards" TEXT;
ALTER TABLE "Monitor" ADD COLUMN "topicUniformReward" REAL;
ALTER TABLE "Monitor" ADD COLUMN "topicRewardMinLines" INTEGER DEFAULT 1;

UPDATE "Monitor"
SET
    "topicMinPcLines" = COALESCE((
        SELECT "minPcLines"
        FROM "TopicMonitor"
        WHERE "TopicMonitor"."monitorId" = "Monitor"."id"
          AND "minPcLines" IS NOT NULL
        ORDER BY "id"
        LIMIT 1
    ), 1),
    "topicMinPcMessage" = (
        SELECT "minPcMessage"
        FROM "TopicMonitor"
        WHERE "TopicMonitor"."monitorId" = "Monitor"."id"
          AND "minPcMessage" IS NOT NULL
        ORDER BY "id"
        LIMIT 1
    ),
    "topicRewardEnabled" = COALESCE((
        SELECT "rewardEnabled"
        FROM "TopicMonitor"
        WHERE "TopicMonitor"."monitorId" = "Monitor"."id"
        ORDER BY "id"
        LIMIT 1
    ), false),
    "topicLinesRewards" = (
        SELECT "linesRewards"
        FROM "TopicMonitor"
        WHERE "TopicMonitor"."monitorId" = "Monitor"."id"
          AND "linesRewards" IS NOT NULL
        ORDER BY "id"
        LIMIT 1
    ),
    "topicUniformReward" = (
        SELECT "uniformReward"
        FROM "TopicMonitor"
        WHERE "TopicMonitor"."monitorId" = "Monitor"."id"
          AND "uniformReward" IS NOT NULL
        ORDER BY "id"
        LIMIT 1
    ),
    "topicRewardMinLines" = COALESCE((
        SELECT "rewardMinLines"
        FROM "TopicMonitor"
        WHERE "TopicMonitor"."monitorId" = "Monitor"."id"
          AND "rewardMinLines" IS NOT NULL
        ORDER BY "id"
        LIMIT 1
    ), 1);
