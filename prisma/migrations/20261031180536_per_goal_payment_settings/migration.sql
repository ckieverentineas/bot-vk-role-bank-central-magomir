-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RpWritingGoal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "allianceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "hashtag" TEXT,
    "trackingMode" TEXT NOT NULL DEFAULT 'all',
    "trackingHashtags" TEXT NOT NULL DEFAULT '[]',
    "tierRates" TEXT NOT NULL DEFAULT '[]',
    "targetPc" REAL NOT NULL,
    "ratePerPc" REAL NOT NULL DEFAULT 0,
    "minimumPc" INTEGER NOT NULL DEFAULT 10,
    "extraPaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "extraPaymentLabel" TEXT NOT NULL DEFAULT 'Дополнительная выплата',
    "extraPaymentAmount" REAL NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "completionNotified" BOOLEAN NOT NULL DEFAULT false,
    "completionNotifiedSuccess" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RpWritingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RpWritingGoal_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RpWritingGoal" ("allianceId", "completionNotified", "completionNotifiedSuccess", "createdAt", "endDate", "hashtag", "id", "name", "startDate", "targetPc", "tierRates", "trackingHashtags", "trackingMode", "updatedAt", "userId") SELECT "allianceId", "completionNotified", "completionNotifiedSuccess", "createdAt", "endDate", "hashtag", "id", "name", "startDate", "targetPc", "tierRates", "trackingHashtags", "trackingMode", "updatedAt", "userId" FROM "RpWritingGoal";
DROP TABLE "RpWritingGoal";
ALTER TABLE "new_RpWritingGoal" RENAME TO "RpWritingGoal";
CREATE INDEX "RpWritingGoal_userId_allianceId_idx" ON "RpWritingGoal"("userId", "allianceId");
CREATE INDEX "RpWritingGoal_startDate_endDate_idx" ON "RpWritingGoal"("startDate", "endDate");
CREATE TABLE "new_RpWorkSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "allianceId" INTEGER NOT NULL,
    "ratePerPc" REAL NOT NULL DEFAULT 0,
    "highSeniority" BOOLEAN NOT NULL DEFAULT false,
    "seniorityBonus" REAL NOT NULL DEFAULT 0,
    "bonusLabel" TEXT NOT NULL DEFAULT 'Дополнительная выплата',
    "minimumPcPerYear" REAL NOT NULL DEFAULT 10,
    "workScope" TEXT NOT NULL DEFAULT 'all',
    "workHashtag" TEXT,
    "workYearStart" DATETIME,
    "workYearEnd" DATETIME,
    "lifeHashtag" TEXT NOT NULL DEFAULT '',
    "lifeTierRates" TEXT NOT NULL DEFAULT '[]',
    "goalSettingsMigrated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RpWorkSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RpWorkSettings_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RpWorkSettings" ("allianceId", "bonusLabel", "createdAt", "highSeniority", "id", "lifeHashtag", "lifeTierRates", "minimumPcPerYear", "ratePerPc", "seniorityBonus", "updatedAt", "userId", "workHashtag", "workScope", "workYearEnd", "workYearStart") SELECT "allianceId", "bonusLabel", "createdAt", "highSeniority", "id", "lifeHashtag", "lifeTierRates", "minimumPcPerYear", "ratePerPc", "seniorityBonus", "updatedAt", "userId", "workHashtag", "workScope", "workYearEnd", "workYearStart" FROM "RpWorkSettings";
DROP TABLE "RpWorkSettings";
ALTER TABLE "new_RpWorkSettings" RENAME TO "RpWorkSettings";
CREATE INDEX "RpWorkSettings_allianceId_idx" ON "RpWorkSettings"("allianceId");
CREATE INDEX "RpWorkSettings_userId_idx" ON "RpWorkSettings"("userId");
CREATE UNIQUE INDEX "RpWorkSettings_userId_allianceId_key" ON "RpWorkSettings"("userId", "allianceId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
