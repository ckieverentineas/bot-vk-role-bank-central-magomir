-- CreateTable
CREATE TABLE "MonitorSelection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "allianceId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonitorSelection_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonitorSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonitorSelection_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MonitorSelection_accountId_idx" ON "MonitorSelection"("accountId");

-- CreateIndex
CREATE INDEX "MonitorSelection_allianceId_idx" ON "MonitorSelection"("allianceId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorSelection_accountId_allianceId_key" ON "MonitorSelection"("accountId", "allianceId");
