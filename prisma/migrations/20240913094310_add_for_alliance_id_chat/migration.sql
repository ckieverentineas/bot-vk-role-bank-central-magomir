-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alliance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "idvk" INTEGER NOT NULL,
    "id_chat" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Alliance" ("id", "idvk", "name") SELECT "id", "idvk", "name" FROM "Alliance";
DROP TABLE "Alliance";
ALTER TABLE "new_Alliance" RENAME TO "Alliance";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
