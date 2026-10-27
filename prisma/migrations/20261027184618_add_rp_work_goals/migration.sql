-- CreateTable
CREATE TABLE "RpWorkSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "allianceId" INTEGER NOT NULL,
    "ratePerPc" REAL NOT NULL DEFAULT 0,
    "highSeniority" BOOLEAN NOT NULL DEFAULT false,
    "seniorityBonus" REAL NOT NULL DEFAULT 200,
    "minimumPcPerYear" REAL NOT NULL DEFAULT 10,
    "workScope" TEXT NOT NULL DEFAULT 'all',
    "workHashtag" TEXT,
    "workYearStart" DATETIME,
    "workYearEnd" DATETIME,
    "lifeHashtag" TEXT NOT NULL DEFAULT 'жизнь',
    "lifeTierRates" TEXT NOT NULL DEFAULT '[{"maxPc":500,"amount":3},{"maxPc":800,"amount":5},{"maxPc":1200,"amount":7},{"maxPc":1500,"amount":10},{"maxPc":2000,"amount":15},{"maxPc":null,"amount":20}]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RpWorkSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RpWorkSettings_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RpWritingGoal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "allianceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "hashtag" TEXT,
    "targetPc" REAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RpWritingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RpWritingGoal_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NotificationTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allianceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationTemplate_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NotificationTemplate" ("allianceId", "createdAt", "id", "name", "text", "updatedAt") SELECT "allianceId", "createdAt", "id", "name", "text", "updatedAt" FROM "NotificationTemplate";
DROP TABLE "NotificationTemplate";
ALTER TABLE "new_NotificationTemplate" RENAME TO "NotificationTemplate";
CREATE INDEX "NotificationTemplate_allianceId_idx" ON "NotificationTemplate"("allianceId");
CREATE UNIQUE INDEX "NotificationTemplate_allianceId_name_key" ON "NotificationTemplate"("allianceId", "name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "RpWorkSettings_allianceId_idx" ON "RpWorkSettings"("allianceId");

-- CreateIndex
CREATE INDEX "RpWorkSettings_userId_idx" ON "RpWorkSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RpWorkSettings_userId_allianceId_key" ON "RpWorkSettings"("userId", "allianceId");

-- CreateIndex
CREATE INDEX "RpWritingGoal_userId_allianceId_idx" ON "RpWritingGoal"("userId", "allianceId");

-- CreateIndex
CREATE INDEX "RpWritingGoal_startDate_endDate_idx" ON "RpWritingGoal"("startDate", "endDate");
