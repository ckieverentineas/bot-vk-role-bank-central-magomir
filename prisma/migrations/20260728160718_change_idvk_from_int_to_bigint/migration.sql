/*
  Warnings:

  - You are about to alter the column `idvk` on the `Account` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `idvk` on the `Alliance` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `idvk` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `idvk` on the `Monitor` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `idvk` on the `BlackBox` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idvk" BIGINT NOT NULL,
    "crdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "select_user" INTEGER NOT NULL DEFAULT 0,
    "monitor_select_user" INTEGER
);
INSERT INTO "new_Account" ("crdate", "id", "idvk", "monitor_select_user", "select_user") SELECT "crdate", "id", "idvk", "monitor_select_user", "select_user" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE TABLE "new_Alliance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "idvk" BIGINT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "id_chat" INTEGER NOT NULL DEFAULT 0,
    "id_chat_monitor" INTEGER NOT NULL DEFAULT 0,
    "id_chat_shop" INTEGER NOT NULL DEFAULT 0,
    "id_chat_ability" INTEGER NOT NULL DEFAULT 0,
    "id_chat_topic" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Alliance" ("hidden", "id", "id_chat", "id_chat_ability", "id_chat_monitor", "id_chat_shop", "id_chat_topic", "idvk", "name") SELECT "hidden", "id", "id_chat", "id_chat_ability", "id_chat_monitor", "id_chat_shop", "id_chat_topic", "idvk", "name" FROM "Alliance";
DROP TABLE "Alliance";
ALTER TABLE "new_Alliance" RENAME TO "Alliance";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "idvk" BIGINT NOT NULL,
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
    "card_image" TEXT,
    "salary_coin_id" INTEGER,
    "salary_amount" REAL,
    CONSTRAINT "User_id_account_fkey" FOREIGN KEY ("id_account") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_id_role_fkey" FOREIGN KEY ("id_role") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("card_image", "class", "comment", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "notification", "notification_topic", "private", "salary_amount", "salary_coin_id", "scoopins", "spec") SELECT "card_image", "class", "comment", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "notification", "notification_topic", "private", "salary_amount", "salary_coin_id", "scoopins", "spec" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE TABLE "new_Monitor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "idvk" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "id_alliance" INTEGER NOT NULL,
    "id_coin" INTEGER,
    "id_topic_coin" INTEGER,
    "id_topic_extra_coin" INTEGER,
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
CREATE TABLE "new_BlackBox" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idvk" BIGINT NOT NULL
);
INSERT INTO "new_BlackBox" ("id", "idvk") SELECT "id", "idvk" FROM "BlackBox";
DROP TABLE "BlackBox";
ALTER TABLE "new_BlackBox" RENAME TO "BlackBox";
CREATE UNIQUE INDEX "BlackBox_idvk_key" ON "BlackBox"("idvk");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
