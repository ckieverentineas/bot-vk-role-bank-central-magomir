-- CreateTable
CREATE TABLE "AllianceCoin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "smile" TEXT NOT NULL,
    "point" BOOLEAN NOT NULL DEFAULT false,
    "id_alliance" INTEGER NOT NULL,
    CONSTRAINT "AllianceCoin_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllianceFacult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "smile" TEXT NOT NULL,
    "id_alliance" INTEGER NOT NULL,
    CONSTRAINT "AllianceFacult_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllianceStat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "facult_rank" TEXT NOT NULL,
    "id_alliance" INTEGER NOT NULL,
    CONSTRAINT "AllianceStat_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
