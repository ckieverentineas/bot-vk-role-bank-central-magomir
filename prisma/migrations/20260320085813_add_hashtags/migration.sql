-- CreateTable
CREATE TABLE "PostHashtag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postStatisticId" INTEGER NOT NULL,
    "hashtag" TEXT NOT NULL,
    "monitorId" INTEGER NOT NULL,
    "allianceId" INTEGER NOT NULL,
    CONSTRAINT "PostHashtag_postStatisticId_fkey" FOREIGN KEY ("postStatisticId") REFERENCES "PostStatistic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonitorHashtag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "monitorId" INTEGER NOT NULL,
    "hashtag" TEXT NOT NULL,
    CONSTRAINT "MonitorHashtag_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PostHashtag_hashtag_idx" ON "PostHashtag"("hashtag");

-- CreateIndex
CREATE INDEX "PostHashtag_monitorId_idx" ON "PostHashtag"("monitorId");

-- CreateIndex
CREATE INDEX "PostHashtag_allianceId_idx" ON "PostHashtag"("allianceId");

-- CreateIndex
CREATE UNIQUE INDEX "PostHashtag_postStatisticId_hashtag_key" ON "PostHashtag"("postStatisticId", "hashtag");

-- CreateIndex
CREATE INDEX "MonitorHashtag_hashtag_idx" ON "MonitorHashtag"("hashtag");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorHashtag_monitorId_hashtag_key" ON "MonitorHashtag"("monitorId", "hashtag");
