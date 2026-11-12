-- CreateTable
CREATE TABLE "TopicLocationAccess" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicMonitorId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME NOT NULL,
    CONSTRAINT "TopicLocationAccess_topicMonitorId_fkey" FOREIGN KEY ("topicMonitorId") REFERENCES "TopicMonitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TopicLocationAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicAccessExemption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topicMonitorId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TopicAccessExemption_topicMonitorId_fkey" FOREIGN KEY ("topicMonitorId") REFERENCES "TopicMonitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TopicAccessExemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    CONSTRAINT "TopicMonitor_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TopicMonitor" ("createdAt", "id", "linesRewards", "minPcLines", "minPcMessage", "monitorId", "name", "rewardEnabled", "rewardMinLines", "topicId", "topicUrl", "uniformReward", "updatedAt") SELECT "createdAt", "id", "linesRewards", "minPcLines", "minPcMessage", "monitorId", "name", "rewardEnabled", "rewardMinLines", "topicId", "topicUrl", "uniformReward", "updatedAt" FROM "TopicMonitor";
DROP TABLE "TopicMonitor";
ALTER TABLE "new_TopicMonitor" RENAME TO "TopicMonitor";
CREATE INDEX "TopicMonitor_monitorId_idx" ON "TopicMonitor"("monitorId");
CREATE UNIQUE INDEX "TopicMonitor_monitorId_topicId_key" ON "TopicMonitor"("monitorId", "topicId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "TopicLocationAccess_topicMonitorId_validUntil_idx" ON "TopicLocationAccess"("topicMonitorId", "validUntil");

-- CreateIndex
CREATE INDEX "TopicLocationAccess_userId_idx" ON "TopicLocationAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicLocationAccess_topicMonitorId_userId_key" ON "TopicLocationAccess"("topicMonitorId", "userId");

-- CreateIndex
CREATE INDEX "TopicAccessExemption_userId_idx" ON "TopicAccessExemption"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicAccessExemption_topicMonitorId_userId_key" ON "TopicAccessExemption"("topicMonitorId", "userId");
