-- CreateTable
CREATE TABLE "SalarySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allianceId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "activeUsers" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalarySettings_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SalarySettings_allianceId_key" ON "SalarySettings"("allianceId");
