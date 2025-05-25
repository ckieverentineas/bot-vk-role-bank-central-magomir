-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AllianceShop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "id_alliance" INTEGER NOT NULL,
    "id_user_owner" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AllianceShop_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AllianceShop" ("id", "id_alliance", "name") SELECT "id", "id_alliance", "name" FROM "AllianceShop";
DROP TABLE "AllianceShop";
ALTER TABLE "new_AllianceShop" RENAME TO "AllianceShop";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
