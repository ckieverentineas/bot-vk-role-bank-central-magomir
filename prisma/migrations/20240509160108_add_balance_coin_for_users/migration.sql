-- CreateTable
CREATE TABLE "BalanceCoin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_coin" INTEGER NOT NULL,
    "id_user" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "BalanceCoin_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BalanceCoin_id_coin_fkey" FOREIGN KEY ("id_coin") REFERENCES "AllianceCoin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
