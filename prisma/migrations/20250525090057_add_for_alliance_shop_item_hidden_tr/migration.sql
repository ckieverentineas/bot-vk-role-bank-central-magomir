-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AllianceShopItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "price" INTEGER NOT NULL,
    "id_coin" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL,
    "limit_tr" BOOLEAN NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "id_shop" INTEGER NOT NULL,
    CONSTRAINT "AllianceShopItem_id_shop_fkey" FOREIGN KEY ("id_shop") REFERENCES "AllianceShopCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AllianceShopItem" ("description", "id", "id_coin", "id_shop", "image", "limit", "limit_tr", "name", "price") SELECT "description", "id", "id_coin", "id_shop", "image", "limit", "limit_tr", "name", "price" FROM "AllianceShopItem";
DROP TABLE "AllianceShopItem";
ALTER TABLE "new_AllianceShopItem" RENAME TO "AllianceShopItem";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
