-- AlterTable
ALTER TABLE "Account" ADD COLUMN "monitor_select_user" INTEGER;

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
    "scoopins" INTEGER NOT NULL DEFAULT 0,
    "id_facult" INTEGER,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "notification" BOOLEAN NOT NULL DEFAULT true,
    "crdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_role" INTEGER NOT NULL DEFAULT 1,
    "id_account" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    CONSTRAINT "User_id_account_fkey" FOREIGN KEY ("id_account") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_id_role_fkey" FOREIGN KEY ("id_role") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("class", "comment", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "notification", "private", "scoopins", "spec") SELECT "class", "comment", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "notification", "private", "scoopins", "spec" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
