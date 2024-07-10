-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Limiter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_monitor" INTEGER NOT NULL,
    "id_user" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comment" INTEGER NOT NULL DEFAULT 0,
    "update" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Limiter_id_monitor_fkey" FOREIGN KEY ("id_monitor") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Limiter_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Limiter" ("comment", "id", "id_monitor", "id_user", "likes") SELECT "comment", "id", "id_monitor", "id_user", "likes" FROM "Limiter";
DROP TABLE "Limiter";
ALTER TABLE "new_Limiter" RENAME TO "Limiter";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
