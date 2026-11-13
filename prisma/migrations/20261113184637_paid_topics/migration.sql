-- CreateTable
CREATE TABLE "MonitorPaidAccessTopic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "monitorId" INTEGER NOT NULL,
    "topicMonitorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonitorPaidAccessTopic_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonitorPaidAccessTopic_topicMonitorId_fkey" FOREIGN KEY ("topicMonitorId") REFERENCES "TopicMonitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TopicMonitor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "monitorId" INTEGER NOT NULL,
    "topicUrl" TEXT NOT NULL,
    "topicId" INTEGER NOT NULL,
    "minPcLines" INTEGER,
    "minPcMessage" TEXT,
    "rewardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "linesRewards" TEXT,
    "uniformReward" REAL,
    "rewardMinLines" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "locationAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
    "locationAccessCost" REAL NOT NULL DEFAULT 30,
    "locationAccessDays" INTEGER NOT NULL DEFAULT 3,
    "paidAccessMode" TEXT NOT NULL DEFAULT 'inherit',
    "paidAccessPrice" REAL,
    "paidAccessDays" INTEGER,
    "paidAccessCoinId" INTEGER,
    CONSTRAINT "TopicMonitor_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TopicMonitor" ("createdAt", "id", "linesRewards", "locationAccessCost", "locationAccessDays", "locationAccessEnabled", "minPcLines", "minPcMessage", "monitorId", "name", "rewardEnabled", "rewardMinLines", "topicId", "topicUrl", "uniformReward", "updatedAt") SELECT "createdAt", "id", "linesRewards", "locationAccessCost", "locationAccessDays", "locationAccessEnabled", "minPcLines", "minPcMessage", "monitorId", "name", "rewardEnabled", "rewardMinLines", "topicId", "topicUrl", "uniformReward", "updatedAt" FROM "TopicMonitor";
DROP TABLE "TopicMonitor";
ALTER TABLE "new_TopicMonitor" RENAME TO "TopicMonitor";
CREATE INDEX "TopicMonitor_monitorId_idx" ON "TopicMonitor"("monitorId");
CREATE UNIQUE INDEX "TopicMonitor_monitorId_topicId_key" ON "TopicMonitor"("monitorId", "topicId");
CREATE TABLE "new_Monitor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "idvk" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "id_alliance" INTEGER NOT NULL,
    "id_coin" INTEGER,
    "id_topic_coin" INTEGER,
    "id_topic_extra_coin" INTEGER,
    "paidAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paidAccessPrice" REAL NOT NULL DEFAULT 30,
    "paidAccessDays" INTEGER NOT NULL DEFAULT 3,
    "paidAccessCoinId" INTEGER,
    "topicMinPcLines" INTEGER DEFAULT 1,
    "topicMinPcMessage" TEXT,
    "topicRewardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "topicLinesRewards" TEXT,
    "topicUniformReward" REAL,
    "topicRewardMinLines" INTEGER DEFAULT 1,
    "topicExtraRewardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "topicExtraLinesRewards" TEXT,
    "topicExtraUniformReward" REAL,
    "topicExtraRewardMinLines" INTEGER DEFAULT 1,
    "cost_like" INTEGER NOT NULL DEFAULT 2,
    "cost_comment" INTEGER NOT NULL DEFAULT 5,
    "cost_post" INTEGER NOT NULL DEFAULT 30,
    "lim_like" INTEGER NOT NULL DEFAULT 3,
    "lim_comment" INTEGER NOT NULL DEFAULT 3,
    "starting" BOOLEAN NOT NULL DEFAULT false,
    "wall_on" BOOLEAN NOT NULL DEFAULT true,
    "like_on" BOOLEAN NOT NULL DEFAULT true,
    "comment_on" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Monitor_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Monitor" ("comment_on", "cost_comment", "cost_like", "cost_post", "id", "id_alliance", "id_coin", "id_topic_coin", "id_topic_extra_coin", "idvk", "like_on", "lim_comment", "lim_like", "name", "starting", "token", "topicExtraLinesRewards", "topicExtraRewardEnabled", "topicExtraRewardMinLines", "topicExtraUniformReward", "topicLinesRewards", "topicMinPcLines", "topicMinPcMessage", "topicRewardEnabled", "topicRewardMinLines", "topicUniformReward", "wall_on") SELECT "comment_on", "cost_comment", "cost_like", "cost_post", "id", "id_alliance", "id_coin", "id_topic_coin", "id_topic_extra_coin", "idvk", "like_on", "lim_comment", "lim_like", "name", "starting", "token", "topicExtraLinesRewards", "topicExtraRewardEnabled", "topicExtraRewardMinLines", "topicExtraUniformReward", "topicLinesRewards", "topicMinPcLines", "topicMinPcMessage", "topicRewardEnabled", "topicRewardMinLines", "topicUniformReward", "wall_on" FROM "Monitor";
DROP TABLE "Monitor";
ALTER TABLE "new_Monitor" RENAME TO "Monitor";
CREATE TABLE "new_TopicAccessExemption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicMonitorId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TopicAccessExemption_topicMonitorId_fkey" FOREIGN KEY ("topicMonitorId") REFERENCES "TopicMonitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TopicAccessExemption" ("createdAt", "id", "topicMonitorId", "userId") SELECT "createdAt", "id", "topicMonitorId", "userId" FROM "TopicAccessExemption";
DROP TABLE "TopicAccessExemption";
ALTER TABLE "new_TopicAccessExemption" RENAME TO "TopicAccessExemption";
CREATE INDEX "TopicAccessExemption_topicMonitorId_userId_idx" ON "TopicAccessExemption"("topicMonitorId", "userId");
CREATE INDEX "TopicAccessExemption_userId_idx" ON "TopicAccessExemption"("userId");
CREATE TABLE "new_TopicLocationAccess" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicMonitorId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME NOT NULL,
    "chargedCoinId" INTEGER,
    "chargedAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "TopicLocationAccess_topicMonitorId_fkey" FOREIGN KEY ("topicMonitorId") REFERENCES "TopicMonitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TopicLocationAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TopicLocationAccess" ("id", "paidAt", "topicMonitorId", "userId", "validUntil") SELECT "id", "paidAt", "topicMonitorId", "userId", "validUntil" FROM "TopicLocationAccess";
DROP TABLE "TopicLocationAccess";
ALTER TABLE "new_TopicLocationAccess" RENAME TO "TopicLocationAccess";
CREATE INDEX "TopicLocationAccess_userId_validUntil_idx" ON "TopicLocationAccess"("userId", "validUntil");
CREATE UNIQUE INDEX "TopicLocationAccess_topicMonitorId_userId_key" ON "TopicLocationAccess"("topicMonitorId", "userId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "MonitorPaidAccessTopic_topicMonitorId_key" ON "MonitorPaidAccessTopic"("topicMonitorId");

-- CreateIndex
CREATE INDEX "MonitorPaidAccessTopic_monitorId_idx" ON "MonitorPaidAccessTopic"("monitorId");
