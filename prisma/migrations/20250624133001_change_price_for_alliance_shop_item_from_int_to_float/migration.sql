/*
  Warnings:

  - You are about to alter the column `price` on the `AllianceShopItem` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AllianceShopItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "price" REAL NOT NULL,
    "id_coin" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL,
    "limit_tr" BOOLEAN NOT NULL,
    "inventory_tr" BOOLEAN NOT NULL DEFAULT true,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "id_shop" INTEGER NOT NULL
);
INSERT INTO "new_AllianceShopItem" ("description", "hidden", "id", "id_coin", "id_shop", "image", "inventory_tr", "limit", "limit_tr", "name", "price") SELECT "description", "hidden", "id", "id_coin", "id_shop", "image", "inventory_tr", "limit", "limit_tr", "name", "price" FROM "AllianceShopItem";
DROP TABLE "AllianceShopItem";
ALTER TABLE "new_AllianceShopItem" RENAME TO "AllianceShopItem";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
