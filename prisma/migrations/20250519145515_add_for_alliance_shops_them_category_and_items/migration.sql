-- CreateTable
CREATE TABLE "AllianceShop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "id_alliance" INTEGER NOT NULL,
    CONSTRAINT "AllianceShop_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllianceShopCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "id_alliance_shop" INTEGER NOT NULL,
    CONSTRAINT "AllianceShopCategory_id_alliance_shop_fkey" FOREIGN KEY ("id_alliance_shop") REFERENCES "AllianceShop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllianceShopItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "price" INTEGER NOT NULL,
    "id_coin" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL,
    "limit_tr" BOOLEAN NOT NULL,
    "id_shop" INTEGER NOT NULL,
    CONSTRAINT "AllianceShopItem_id_shop_fkey" FOREIGN KEY ("id_shop") REFERENCES "AllianceShopCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
