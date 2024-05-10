/*
  Warnings:

  - You are about to drop the column `id_alliance` on the `BalanceFacult` table. All the data in the column will be lost.
  - Added the required column `id_facult` to the `BalanceFacult` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BalanceFacult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_coin" INTEGER NOT NULL,
    "id_facult" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BalanceFacult_id_coin_fkey" FOREIGN KEY ("id_coin") REFERENCES "AllianceCoin" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BalanceFacult_id_facult_fkey" FOREIGN KEY ("id_facult") REFERENCES "AllianceFacult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BalanceFacult" ("amount", "id", "id_coin") SELECT "amount", "id", "id_coin" FROM "BalanceFacult";
DROP TABLE "BalanceFacult";
ALTER TABLE "new_BalanceFacult" RENAME TO "BalanceFacult";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
