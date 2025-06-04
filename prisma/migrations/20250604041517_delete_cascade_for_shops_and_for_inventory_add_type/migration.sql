-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Inventory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_user" INTEGER NOT NULL,
    "id_item" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'item_shop',
    CONSTRAINT "Inventory_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Inventory" ("id", "id_item", "id_user") SELECT "id", "id_item", "id_user" FROM "Inventory";
DROP TABLE "Inventory";
ALTER TABLE "new_Inventory" RENAME TO "Inventory";
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
    "id_shop" INTEGER NOT NULL
);
INSERT INTO "new_AllianceShopItem" ("description", "hidden", "id", "id_coin", "id_shop", "image", "limit", "limit_tr", "name", "price") SELECT "description", "hidden", "id", "id_coin", "id_shop", "image", "limit", "limit_tr", "name", "price" FROM "AllianceShopItem";
DROP TABLE "AllianceShopItem";
ALTER TABLE "new_AllianceShopItem" RENAME TO "AllianceShopItem";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
