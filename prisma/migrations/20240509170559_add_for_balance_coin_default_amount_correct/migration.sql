-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BalanceCoin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_coin" INTEGER NOT NULL,
    "id_user" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BalanceCoin_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BalanceCoin_id_coin_fkey" FOREIGN KEY ("id_coin") REFERENCES "AllianceCoin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BalanceCoin" ("amount", "id", "id_coin", "id_user") SELECT "amount", "id", "id_coin", "id_user" FROM "BalanceCoin";
DROP TABLE "BalanceCoin";
ALTER TABLE "new_BalanceCoin" RENAME TO "BalanceCoin";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
