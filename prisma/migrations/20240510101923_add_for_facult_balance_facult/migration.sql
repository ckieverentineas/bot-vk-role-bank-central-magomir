/*
  Warnings:

  - You are about to drop the `AllianceStat` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AllianceStat";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "BalanceFacult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_coin" INTEGER NOT NULL,
    "id_alliance" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BalanceFacult_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BalanceFacult_id_coin_fkey" FOREIGN KEY ("id_coin") REFERENCES "AllianceCoin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
