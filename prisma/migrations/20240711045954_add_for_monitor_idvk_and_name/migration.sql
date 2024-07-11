/*
  Warnings:

  - Added the required column `idvk` to the `Monitor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Monitor` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Monitor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "idvk" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "id_alliance" INTEGER NOT NULL,
    "id_coin" INTEGER,
    "cost_like" INTEGER NOT NULL DEFAULT 2,
    "cost_comment" INTEGER NOT NULL DEFAULT 5,
    "cost_post" INTEGER NOT NULL DEFAULT 30,
    "lim_like" INTEGER NOT NULL DEFAULT 3,
    "lim_comment" INTEGER NOT NULL DEFAULT 3,
    "starting" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Monitor_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Monitor" ("cost_comment", "cost_like", "cost_post", "id", "id_alliance", "id_coin", "lim_comment", "lim_like", "starting", "token") SELECT "cost_comment", "cost_like", "cost_post", "id", "id_alliance", "id_coin", "lim_comment", "lim_like", "starting", "token" FROM "Monitor";
DROP TABLE "Monitor";
ALTER TABLE "new_Monitor" RENAME TO "Monitor";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
