-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AllianceCoin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "smile" TEXT NOT NULL,
    "point" BOOLEAN NOT NULL DEFAULT false,
    "converted" BOOLEAN NOT NULL DEFAULT true,
    "converted_point" BOOLEAN NOT NULL DEFAULT false,
    "sbp_on" BOOLEAN NOT NULL DEFAULT false,
    "course_medal" INTEGER NOT NULL DEFAULT 1,
    "course_coin" INTEGER NOT NULL DEFAULT 1,
    "scoopins_converted" BOOLEAN NOT NULL DEFAULT false,
    "course_scoopins_medal" INTEGER NOT NULL DEFAULT 1,
    "course_scoopins_coin" INTEGER NOT NULL DEFAULT 1,
    "id_alliance" INTEGER NOT NULL,
    CONSTRAINT "AllianceCoin_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AllianceCoin" ("converted", "converted_point", "course_coin", "course_medal", "id", "id_alliance", "name", "point", "sbp_on", "smile") SELECT "converted", "converted_point", "course_coin", "course_medal", "id", "id_alliance", "name", "point", "sbp_on", "smile" FROM "AllianceCoin";
DROP TABLE "AllianceCoin";
ALTER TABLE "new_AllianceCoin" RENAME TO "AllianceCoin";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "idvk" INTEGER NOT NULL,
    "spec" TEXT NOT NULL,
    "id_alliance" INTEGER,
    "medal" INTEGER NOT NULL DEFAULT 5,
    "scoopins" INTEGER NOT NULL DEFAULT 1000,
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
INSERT INTO "new_User" ("class", "comment", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "notification", "private", "spec") SELECT "class", "comment", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "notification", "private", "spec" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
