-- CreateTable
CREATE TABLE "ItemStorage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false
);
