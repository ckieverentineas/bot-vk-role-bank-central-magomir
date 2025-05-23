-- CreateTable
CREATE TABLE "InventoryAllianceShop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_user" INTEGER NOT NULL,
    "id_item" INTEGER NOT NULL,
    CONSTRAINT "InventoryAllianceShop_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryAllianceShop_id_item_fkey" FOREIGN KEY ("id_item") REFERENCES "AllianceShopItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
