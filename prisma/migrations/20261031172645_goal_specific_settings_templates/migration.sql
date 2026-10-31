-- CreateTable
CREATE TABLE "RpWorkTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allianceId" INTEGER NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RpWorkTemplate_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "completionNotified" BOOLEAN NOT NULL DEFAULT false,
    "completionNotifiedSuccess" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RpWritingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RpWritingGoal_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RpWritingGoal" ("allianceId", "completionNotified", "createdAt", "endDate", "hashtag", "id", "name", "startDate", "targetPc", "updatedAt", "userId") SELECT "allianceId", "completionNotified", "createdAt", "endDate", "hashtag", "id", "name", "startDate", "targetPc", "updatedAt", "userId" FROM "RpWritingGoal";
DROP TABLE "RpWritingGoal";
ALTER TABLE "new_RpWritingGoal" RENAME TO "RpWritingGoal";
CREATE INDEX "RpWritingGoal_userId_allianceId_idx" ON "RpWritingGoal"("userId", "allianceId");
CREATE INDEX "RpWritingGoal_startDate_endDate_idx" ON "RpWritingGoal"("startDate", "endDate");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "RpWorkTemplate_allianceId_idx" ON "RpWorkTemplate"("allianceId");

-- CreateIndex
CREATE INDEX "RpWorkTemplate_createdByUserId_idx" ON "RpWorkTemplate"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RpWorkTemplate_allianceId_code_key" ON "RpWorkTemplate"("allianceId", "code");
