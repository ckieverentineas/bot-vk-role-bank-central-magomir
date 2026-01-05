-- CreateTable
CREATE TABLE "AllianceClassSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allianceId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'default',
    "option1" TEXT DEFAULT 'Ученик',
    "option2" TEXT DEFAULT 'Житель',
    "option3" TEXT DEFAULT 'Профессор',
    "option4" TEXT DEFAULT 'Декан',
    "option5" TEXT DEFAULT 'Бизнесвумен(мэн)',
    "option6" TEXT DEFAULT 'Другое',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllianceClassSetting_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AllianceClassSetting_allianceId_key" ON "AllianceClassSetting"("allianceId");
