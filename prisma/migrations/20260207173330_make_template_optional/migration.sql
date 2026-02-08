-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserCard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "attachment" TEXT NOT NULL,
    "template_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "UserCard_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "CardTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserCard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserCard" ("attachment", "created_at", "id", "template_id", "updated_at", "user_id") SELECT "attachment", "created_at", "id", "template_id", "updated_at", "user_id" FROM "UserCard";
DROP TABLE "UserCard";
ALTER TABLE "new_UserCard" RENAME TO "UserCard";
CREATE UNIQUE INDEX "UserCard_user_id_key" ON "UserCard"("user_id");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
