-- CreateTable
CREATE TABLE "AbilityCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "allianceId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AbilityCategory_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ability" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "prices" TEXT,
    "maxLevelId" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ability_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "AllianceCoin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ability_maxLevelId_fkey" FOREIGN KEY ("maxLevelId") REFERENCES "SkillLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ability_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AbilityCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAbility" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "abilityId" INTEGER NOT NULL,
    "levelId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserAbility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAbility_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AbilityCategory_allianceId_order_idx" ON "AbilityCategory"("allianceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "AbilityCategory_allianceId_name_key" ON "AbilityCategory"("allianceId", "name");

-- CreateIndex
CREATE INDEX "Ability_categoryId_hidden_idx" ON "Ability"("categoryId", "hidden");

-- CreateIndex
CREATE UNIQUE INDEX "Ability_categoryId_name_key" ON "Ability"("categoryId", "name");

-- CreateIndex
CREATE INDEX "UserAbility_userId_idx" ON "UserAbility"("userId");

-- CreateIndex
CREATE INDEX "UserAbility_abilityId_idx" ON "UserAbility"("abilityId");

-- CreateIndex
CREATE INDEX "UserAbility_levelId_idx" ON "UserAbility"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAbility_userId_abilityId_key" ON "UserAbility"("userId", "abilityId");
