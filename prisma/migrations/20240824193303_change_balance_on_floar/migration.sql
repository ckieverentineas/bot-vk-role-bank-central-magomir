/*
  Warnings:

  - You are about to alter the column `amount` on the `BalanceCoin` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `amount` on the `BalanceFacult` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BalanceCoin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_coin" INTEGER NOT NULL,
    "id_user" INTEGER NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "BalanceCoin_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BalanceCoin_id_coin_fkey" FOREIGN KEY ("id_coin") REFERENCES "AllianceCoin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BalanceCoin" ("amount", "id", "id_coin", "id_user") SELECT "amount", "id", "id_coin", "id_user" FROM "BalanceCoin";
DROP TABLE "BalanceCoin";
ALTER TABLE "new_BalanceCoin" RENAME TO "BalanceCoin";
CREATE TABLE "new_BalanceFacult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_coin" INTEGER NOT NULL,
    "id_facult" INTEGER NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "BalanceFacult_id_coin_fkey" FOREIGN KEY ("id_coin") REFERENCES "AllianceCoin" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BalanceFacult_id_facult_fkey" FOREIGN KEY ("id_facult") REFERENCES "AllianceFacult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BalanceFacult" ("amount", "id", "id_coin", "id_facult") SELECT "amount", "id", "id_coin", "id_facult" FROM "BalanceFacult";
DROP TABLE "BalanceFacult";
ALTER TABLE "new_BalanceFacult" RENAME TO "BalanceFacult";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
