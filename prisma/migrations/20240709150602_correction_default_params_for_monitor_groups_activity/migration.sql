-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Monitor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "id_alliance" INTEGER NOT NULL,
    "cost_like" INTEGER NOT NULL DEFAULT 2,
    "cost_comment" INTEGER NOT NULL DEFAULT 5,
    "cost_post" INTEGER NOT NULL DEFAULT 30,
    "lim_like" INTEGER NOT NULL DEFAULT 3,
    "lim_comment" INTEGER NOT NULL DEFAULT 3,
    "starting" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Monitor_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Monitor" ("cost_comment", "cost_like", "cost_post", "id", "id_alliance", "lim_comment", "lim_like", "starting", "token") SELECT "cost_comment", "cost_like", "cost_post", "id", "id_alliance", "lim_comment", "lim_like", "starting", "token" FROM "Monitor";
DROP TABLE "Monitor";
ALTER TABLE "new_Monitor" RENAME TO "Monitor";
CREATE TABLE "new_Limiter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_monitor" INTEGER NOT NULL,
    "id_user" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comment" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Limiter_id_monitor_fkey" FOREIGN KEY ("id_monitor") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Limiter_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Limiter" ("comment", "id", "id_monitor", "id_user", "likes") SELECT "comment", "id", "id_monitor", "id_user", "likes" FROM "Limiter";
DROP TABLE "Limiter";
ALTER TABLE "new_Limiter" RENAME TO "Limiter";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
