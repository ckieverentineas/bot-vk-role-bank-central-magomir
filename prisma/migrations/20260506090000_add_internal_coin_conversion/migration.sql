-- CreateTable
CREATE TABLE "AllianceCoinInternalConversion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "course_source" REAL NOT NULL DEFAULT 1,
    "course_target" REAL NOT NULL DEFAULT 1,
    "id_alliance" INTEGER NOT NULL,
    "id_source_coin" INTEGER NOT NULL,
    "id_target_coin" INTEGER NOT NULL,
    CONSTRAINT "AllianceCoinInternalConversion_id_alliance_fkey" FOREIGN KEY ("id_alliance") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AllianceCoinInternalConversion_id_source_coin_fkey" FOREIGN KEY ("id_source_coin") REFERENCES "AllianceCoin" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AllianceCoinInternalConversion_id_target_coin_fkey" FOREIGN KEY ("id_target_coin") REFERENCES "AllianceCoin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AllianceCoinInternalConversion_id_alliance_id_source_coin_id_target_coin_key" ON "AllianceCoinInternalConversion"("id_alliance", "id_source_coin", "id_target_coin");
