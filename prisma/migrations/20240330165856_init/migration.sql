/*
  Warnings:

  - You are about to drop the column `alliance` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "idvk" INTEGER NOT NULL,
    "spec" TEXT NOT NULL,
    "id_alliance" INTEGER,
    "lvl" INTEGER NOT NULL DEFAULT 0,
    "medal" INTEGER NOT NULL DEFAULT 5,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "crdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_role" INTEGER NOT NULL DEFAULT 1,
    "id_account" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "User_id_account_fkey" FOREIGN KEY ("id_account") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_id_role_fkey" FOREIGN KEY ("id_role") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("class", "crdate", "gold", "id", "id_account", "id_role", "idvk", "lvl", "medal", "name", "private", "spec", "xp") SELECT "class", "crdate", "gold", "id", "id_account", "id_role", "idvk", "lvl", "medal", "name", "private", "spec", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
