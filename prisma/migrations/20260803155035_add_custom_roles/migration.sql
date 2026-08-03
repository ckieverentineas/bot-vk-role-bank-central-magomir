-- CreateTable
CREATE TABLE "CustomRole" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "allianceId" INTEGER NOT NULL,
    "canMassOperations" BOOLEAN NOT NULL DEFAULT false,
    "canMassKick" BOOLEAN NOT NULL DEFAULT false,
    "canManageRoles" BOOLEAN NOT NULL DEFAULT false,
    "canManageRolesAssign" BOOLEAN NOT NULL DEFAULT false,
    "canManageShops" BOOLEAN NOT NULL DEFAULT false,
    "canManageAbilities" BOOLEAN NOT NULL DEFAULT false,
    "canManageSkills" BOOLEAN NOT NULL DEFAULT false,
    "canManageChests" BOOLEAN NOT NULL DEFAULT false,
    "canManageLegacy" BOOLEAN NOT NULL DEFAULT false,
    "canManageBackgrounds" BOOLEAN NOT NULL DEFAULT false,
    "canManageFacults" BOOLEAN NOT NULL DEFAULT false,
    "canManageClassSettings" BOOLEAN NOT NULL DEFAULT false,
    "canManageYearEnd" BOOLEAN NOT NULL DEFAULT false,
    "canManageSalary" BOOLEAN NOT NULL DEFAULT false,
    "canManageFinance" BOOLEAN NOT NULL DEFAULT false,
    "canManageConverter" BOOLEAN NOT NULL DEFAULT false,
    "canManageScoopins" BOOLEAN NOT NULL DEFAULT false,
    "canManageMonitors" BOOLEAN NOT NULL DEFAULT false,
    "canManageTopics" BOOLEAN NOT NULL DEFAULT false,
    "canViewAllUsers" BOOLEAN NOT NULL DEFAULT false,
    "canViewInventoryAll" BOOLEAN NOT NULL DEFAULT false,
    "canEditAllUsers" BOOLEAN NOT NULL DEFAULT false,
    "canEditInventoryAll" BOOLEAN NOT NULL DEFAULT false,
    "canGiveItemsAll" BOOLEAN NOT NULL DEFAULT false,
    "canEditCoins" BOOLEAN NOT NULL DEFAULT false,
    "canUpgradeOthers" BOOLEAN NOT NULL DEFAULT false,
    "canAssignAbility" BOOLEAN NOT NULL DEFAULT false,
    "canAssignSkill" BOOLEAN NOT NULL DEFAULT false,
    "canAssignShopOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomRole_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "idvk" BIGINT NOT NULL,
    "spec" TEXT NOT NULL,
    "id_alliance" INTEGER,
    "medal" INTEGER NOT NULL DEFAULT 5,
    "scoopins" INTEGER NOT NULL DEFAULT 0,
    "id_facult" INTEGER,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "notification" BOOLEAN NOT NULL DEFAULT true,
    "notification_topic" BOOLEAN NOT NULL DEFAULT true,
    "crdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_role" INTEGER NOT NULL DEFAULT 1,
    "id_account" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "card_image" TEXT,
    "customRoleId" INTEGER,
    "salary_coin_id" INTEGER,
    "salary_amount" REAL,
    CONSTRAINT "User_id_account_fkey" FOREIGN KEY ("id_account") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_id_role_fkey" FOREIGN KEY ("id_role") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("card_image", "class", "comment", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "notification", "notification_topic", "private", "salary_amount", "salary_coin_id", "scoopins", "spec") SELECT "card_image", "class", "comment", "crdate", "id", "id_account", "id_alliance", "id_facult", "id_role", "idvk", "medal", "name", "notification", "notification_topic", "private", "salary_amount", "salary_coin_id", "scoopins", "spec" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "CustomRole_allianceId_idx" ON "CustomRole"("allianceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_allianceId_name_key" ON "CustomRole"("allianceId", "name");
