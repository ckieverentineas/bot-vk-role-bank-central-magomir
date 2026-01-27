-- CreateTable
CREATE TABLE "AllianceChest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "id_alliance" INTEGER NOT NULL,
    "id_parent" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AllianceChest_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AllianceChest_id_parent_fkey" FOREIGN KEY ("id_parent") REFERENCES "AllianceChest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChestItemLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_chest" INTEGER NOT NULL,
    "id_inventory" INTEGER NOT NULL,
    CONSTRAINT "ChestItemLink_id_inventory_fkey" FOREIGN KEY ("id_inventory") REFERENCES "Inventory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChestItemLink_id_chest_fkey" FOREIGN KEY ("id_chest") REFERENCES "AllianceChest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoryChest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_category" INTEGER NOT NULL,
    "id_chest" INTEGER NOT NULL,
    CONSTRAINT "CategoryChest_id_chest_fkey" FOREIGN KEY ("id_chest") REFERENCES "AllianceChest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AllianceChest_id_alliance_name_key" ON "AllianceChest"("id_alliance", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ChestItemLink_id_inventory_key" ON "ChestItemLink"("id_inventory");

-- CreateIndex
CREATE INDEX "CategoryChest_id_chest_idx" ON "CategoryChest"("id_chest");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryChest_id_category_key" ON "CategoryChest"("id_category");
