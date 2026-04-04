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
    "order" INTEGER NOT NULL DEFAULT 0,
    "id_alliance" INTEGER NOT NULL,
    CONSTRAINT "AllianceCoin_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AllianceCoin" ("converted", "converted_point", "course_coin", "course_medal", "course_scoopins_coin", "course_scoopins_medal", "id", "id_alliance", "name", "point", "sbp_on", "scoopins_converted", "smile") SELECT "converted", "converted_point", "course_coin", "course_medal", "course_scoopins_coin", "course_scoopins_medal", "id", "id_alliance", "name", "point", "sbp_on", "scoopins_converted", "smile" FROM "AllianceCoin";
DROP TABLE "AllianceCoin";
ALTER TABLE "new_AllianceCoin" RENAME TO "AllianceCoin";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
