-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AllianceCoin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "smile" TEXT NOT NULL,
    "point" BOOLEAN NOT NULL DEFAULT false,
    "course_medal" INTEGER NOT NULL DEFAULT 1,
    "course_coin" INTEGER NOT NULL DEFAULT 1,
    "id_alliance" INTEGER NOT NULL,
    CONSTRAINT "AllianceCoin_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AllianceCoin" ("id", "id_alliance", "name", "point", "smile") SELECT "id", "id_alliance", "name", "point", "smile" FROM "AllianceCoin";
DROP TABLE "AllianceCoin";
ALTER TABLE "new_AllianceCoin" RENAME TO "AllianceCoin";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
