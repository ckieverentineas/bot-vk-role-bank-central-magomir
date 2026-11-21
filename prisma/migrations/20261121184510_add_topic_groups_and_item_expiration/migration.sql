-- AlterTable
ALTER TABLE "AllianceShopItem" ADD COLUMN "expirationDays" INTEGER;

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN "expiresAt" DATETIME;

-- CreateTable
CREATE TABLE "MonitorTopicGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "monitorId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonitorTopicGroup_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "paidAccessGroupId" INTEGER,
    CONSTRAINT "TopicMonitor_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TopicMonitor_paidAccessGroupId_fkey" FOREIGN KEY ("paidAccessGroupId") REFERENCES "MonitorTopicGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TopicMonitor" ("createdAt", "id", "linesRewards", "locationAccessCost", "locationAccessDays", "locationAccessEnabled", "minPcLines", "minPcMessage", "monitorId", "name", "paidAccessCoinId", "paidAccessDays", "paidAccessMode", "paidAccessPrice", "rewardEnabled", "rewardMinLines", "topicId", "topicUrl", "uniformReward", "updatedAt") SELECT "createdAt", "id", "linesRewards", "locationAccessCost", "locationAccessDays", "locationAccessEnabled", "minPcLines", "minPcMessage", "monitorId", "name", "paidAccessCoinId", "paidAccessDays", "paidAccessMode", "paidAccessPrice", "rewardEnabled", "rewardMinLines", "topicId", "topicUrl", "uniformReward", "updatedAt" FROM "TopicMonitor";
DROP TABLE "TopicMonitor";
ALTER TABLE "new_TopicMonitor" RENAME TO "TopicMonitor";
CREATE INDEX "TopicMonitor_monitorId_idx" ON "TopicMonitor"("monitorId");
CREATE INDEX "TopicMonitor_paidAccessGroupId_idx" ON "TopicMonitor"("paidAccessGroupId");
CREATE UNIQUE INDEX "TopicMonitor_monitorId_topicId_key" ON "TopicMonitor"("monitorId", "topicId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "MonitorTopicGroup_monitorId_idx" ON "MonitorTopicGroup"("monitorId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorTopicGroup_monitorId_name_key" ON "MonitorTopicGroup"("monitorId", "name");

-- CreateIndex
CREATE INDEX "Inventory_expiresAt_idx" ON "Inventory"("expiresAt");
