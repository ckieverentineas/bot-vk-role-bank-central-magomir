-- CreateTable
CREATE TABLE "TopicMonitor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "monitorId" INTEGER NOT NULL,
    "topicUrl" TEXT NOT NULL,
    "topicId" INTEGER NOT NULL,
    "minPcLines" INTEGER DEFAULT 1,
    "rewardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "linesRewards" TEXT,
    "uniformReward" REAL,
    "rewardMinLines" INTEGER DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TopicMonitor_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostStatistic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicMonitorId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "postId" INTEGER NOT NULL,
    "characters" INTEGER NOT NULL,
    "words" INTEGER NOT NULL,
    "pc" REAL NOT NULL,
    "mb" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "rewardGiven" BOOLEAN NOT NULL DEFAULT false,
    "rewardAmount" REAL,
    CONSTRAINT "PostStatistic_topicMonitorId_fkey" FOREIGN KEY ("topicMonitorId") REFERENCES "TopicMonitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TopicMonitor_monitorId_idx" ON "TopicMonitor"("monitorId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicMonitor_monitorId_topicId_key" ON "TopicMonitor"("monitorId", "topicId");

-- CreateIndex
CREATE INDEX "PostStatistic_topicMonitorId_idx" ON "PostStatistic"("topicMonitorId");

-- CreateIndex
CREATE INDEX "PostStatistic_userId_idx" ON "PostStatistic"("userId");

-- CreateIndex
CREATE INDEX "PostStatistic_date_idx" ON "PostStatistic"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PostStatistic_topicMonitorId_postId_key" ON "PostStatistic"("topicMonitorId", "postId");
