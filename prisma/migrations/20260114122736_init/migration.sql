-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "idvk" INTEGER NOT NULL,
    "spec" TEXT NOT NULL,
    "id_alliance" INTEGER,
    "medal" INTEGER NOT NULL DEFAULT 5,
    "scoopins" INTEGER NOT NULL DEFAULT 0,
    "id_facult" INTEGER,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "notification" BOOLEAN NOT NULL DEFAULT true,
    "notification_topic" BOOLEAN NOT NULL DEFAULT true,
    "crdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_role" INTEGER NOT NULL DEFAULT 1,
    "id_account" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    CONSTRAINT "User_id_account_fkey" FOREIGN KEY ("id_account") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_id_role_fkey" FOREIGN KEY ("id_role") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("class", "comment", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "notification", "private", "scoopins", "spec") SELECT "class", "comment", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "notification", "private", "scoopins", "spec" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE TABLE "new_Alliance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "idvk" INTEGER NOT NULL,
    "id_chat" INTEGER NOT NULL DEFAULT 0,
    "id_chat_monitor" INTEGER NOT NULL DEFAULT 0,
    "id_chat_shop" INTEGER NOT NULL DEFAULT 0,
    "id_chat_topic" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Alliance" ("id", "id_chat", "id_chat_monitor", "id_chat_shop", "idvk", "name") SELECT "id", "id_chat", "id_chat_monitor", "id_chat_shop", "idvk", "name" FROM "Alliance";
DROP TABLE "Alliance";
ALTER TABLE "new_Alliance" RENAME TO "Alliance";
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
    CONSTRAINT "TopicMonitor_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TopicMonitor" ("createdAt", "id", "linesRewards", "minPcLines", "monitorId", "name", "rewardEnabled", "rewardMinLines", "topicId", "topicUrl", "uniformReward", "updatedAt") SELECT "createdAt", "id", "linesRewards", "minPcLines", "monitorId", "name", "rewardEnabled", "rewardMinLines", "topicId", "topicUrl", "uniformReward", "updatedAt" FROM "TopicMonitor";
DROP TABLE "TopicMonitor";
ALTER TABLE "new_TopicMonitor" RENAME TO "TopicMonitor";
CREATE INDEX "TopicMonitor_monitorId_idx" ON "TopicMonitor"("monitorId");
CREATE UNIQUE INDEX "TopicMonitor_monitorId_topicId_key" ON "TopicMonitor"("monitorId", "topicId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
