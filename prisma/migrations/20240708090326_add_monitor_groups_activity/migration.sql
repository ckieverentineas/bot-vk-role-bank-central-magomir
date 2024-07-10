-- CreateTable
CREATE TABLE "Monitor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "id_alliance" INTEGER NOT NULL,
    "cost_like" INTEGER NOT NULL,
    "cost_comment" INTEGER NOT NULL,
    "cost_post" INTEGER NOT NULL,
    "lim_like" INTEGER NOT NULL,
    "lim_comment" INTEGER NOT NULL,
    "starting" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Monitor_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Limiter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_monitor" INTEGER NOT NULL,
    "id_user" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL,
    "comment" INTEGER NOT NULL,
    CONSTRAINT "Limiter_id_monitor_fkey" FOREIGN KEY ("id_monitor") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Limiter_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
