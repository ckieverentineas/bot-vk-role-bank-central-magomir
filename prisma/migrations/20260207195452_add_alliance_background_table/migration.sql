-- CreateTable
CREATE TABLE "AllianceBackground" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "alliance_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "attachment" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllianceBackground_alliance_id_fkey" FOREIGN KEY ("alliance_id") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AllianceBackground_alliance_id_key" ON "AllianceBackground"("alliance_id");
