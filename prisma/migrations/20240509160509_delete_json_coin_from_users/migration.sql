/*
  Warnings:

  - You are about to drop the column `coin` on the `User` table. All the data in the column will be lost.

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
    "medal" INTEGER NOT NULL DEFAULT 5,
    "id_facult" INTEGER,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "crdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_role" INTEGER NOT NULL DEFAULT 1,
    "id_account" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "User_id_account_fkey" FOREIGN KEY ("id_account") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_id_role_fkey" FOREIGN KEY ("id_role") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("class", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "private", "spec") SELECT "class", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "private", "spec" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
