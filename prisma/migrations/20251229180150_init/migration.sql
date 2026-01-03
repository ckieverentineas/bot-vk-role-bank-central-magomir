-- CreateTable
CREATE TABLE "AllianceTerminology" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_alliance" INTEGER NOT NULL,
    "singular" TEXT NOT NULL DEFAULT 'факультет',
    "plural" TEXT NOT NULL DEFAULT 'факультеты',
    "genitive" TEXT NOT NULL DEFAULT 'факультета',
    "dative" TEXT NOT NULL DEFAULT 'факультету',
    "accusative" TEXT NOT NULL DEFAULT 'факультет',
    "instrumental" TEXT NOT NULL DEFAULT 'факультетом',
    "prepositional" TEXT NOT NULL DEFAULT 'факультете',
    "plural_genitive" TEXT NOT NULL DEFAULT 'факультетов',
    "crdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "upddate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllianceTerminology_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AllianceTerminology_id_alliance_key" ON "AllianceTerminology"("id_alliance");
